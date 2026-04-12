import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from "@/app/lib/prisma"
import { checkSolvesLogic, Problem, Player, Claim } from '@/lib/checkSolvesLogic'
import { fetchAndFilterProblems } from '@/app/lib/problems';
import { TTRParams, TTRState } from '@/app/types/match';
import { buildEnrichedSolveLog } from '@/lib/enrichSolveLog';
import { awardTtrCoinsAndReplenish } from '@/lib/ttrCoinAwarding';
import { fetchReplacementProblem } from '@/lib/problemUtils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  try {
    const { matchId } = req.body
    if (!matchId) return res.status(400).json({ error: 'matchId required' })
    // const match = await prisma.match.findUnique({ where: { id: matchId } });

    const old = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
    if (!old) {
      return res.status(404).json({ error: 'Match not found' })
    }
    const now = new Date();
    const cooldownSeconds = Number(process.env.POLLING_COOLDOWN_SECONDS) || 60;
    const cutoff = new Date(now.getTime() - cooldownSeconds * 1000);
    const updateResult = await prisma.match.updateMany({
      where: {
        id: matchId,
        lastPolledAt: { lt: cutoff },
      },
      data: {
        lastPolledAt: now,
      },
    });

    if (updateResult.count === 0) {
      const cachedMatch = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          problems: { where: { active: true }, orderBy: { position: 'asc' } },
          teams: { include: { members: true } },
          solveLog: { include: { problem: true }, orderBy: { timestamp: 'desc' } },
        },
      });

      if (cachedMatch?.mode === 'ttr' && cachedMatch?.ttrState) {
        const state = cachedMatch.ttrState as any;
        state.solveLog = buildEnrichedSolveLog(cachedMatch.solveLog, state, cachedMatch.ttrParams);
        cachedMatch.ttrState = state;
      }
      return res.json({ message: "Using cached state", match: cachedMatch });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        problems: true,
        teams: {
          include: { members: true },
        },
        solveLog: { include: { problem: true }, orderBy: { timestamp: 'asc' } },
      },
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' })
    }

    const problems = match.problems
      .filter(p => p.active === true)
      .map(p => ({
        contestId: p.contestId,
        index: p.index,
      }));

    if (match.mode === 'ttr' && match.ttrState) {
      const state = match.ttrState as any;
      if (state.market && Array.isArray(state.market)) {
        for (const p of state.market) {
          problems.push({
            contestId: p.contestId,
            index: p.index,
          });
        }
      }
    }
    const players = match.teams.flatMap(team =>
      team.members.map(member => ({
        handle: member.handle,
        team: team.color,
      }))
    )
    const claims = await checkSolvesLogic(problems, players)
    const newSolves: Array<{
      handle: string;
      team: string;
      contestId: number;
      index: string;
      timestamp: Date;
      matchId: string;
      score?: number | null;
    }> = []
    const changed: Array<{
      handle: string;
      team: string;
      contestId: number;
      index: string;
      timestamp: Date;
      matchId: string;
      score?: number | null;
    }> = []

    for (const [key, claim] of Object.entries(claims)) {
      const [contestIdStr, index] = key.split('-')
      const contestId = Number(contestIdStr)

      if (!match.solveLog.some(log => log.contestId === contestId && log.index === index)) {
        newSolves.push({
          handle: claim.handle,
          team: claim.team,
          contestId,
          index,
          timestamp: new Date(claim.time * 1000),
          matchId: match.id,
        })
      }
      else {
        for (const Solve of match.solveLog) {
          const newTime = new Date(claim.time * 1000);
          if (Solve.contestId === contestId && Solve.index === index && Solve.team != claim.team) {
            if (Solve.timestamp.getTime() > newTime.getTime()) {
              changed.push({
                handle: claim.handle,
                team: claim.team,
                contestId,
                index,
                timestamp: newTime,
                matchId: match.id
              });
            }
          }
        }
      }
    }
    if (changed.length > 0) {
      for (const c of changed) {
        try {
          await prisma.$transaction(async (tx) => {
            const existing = await tx.solveLog.findFirst({
              where: { matchId: c.matchId, contestId: c.contestId, index: c.index },
            });
            if (!existing) return;
            const existingTs = new Date(existing.timestamp).getTime();
            // Only update if our discovered claim is earlier
            if (isNaN(existingTs) || c.timestamp.getTime() < existingTs) {
              await tx.solveLog.update({
                where: { id: existing.id },
                data: { handle: c.handle, team: c.team, timestamp: c.timestamp },
              });
            }
          });
        } catch (err) {
          console.error('Failed to apply changed update for', c, err);
        }
      }
    }
    if (newSolves.length === 0) {
      const updatedMatch = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          problems: { where: { active: true }, orderBy: { position: 'asc' } },
          teams: { include: { members: true } },
          solveLog: { include: { problem: true }, orderBy: { timestamp: 'desc' } },
        },
      });

      if (updatedMatch?.mode === 'ttr' && updatedMatch?.ttrState) {
        const state = updatedMatch.ttrState as any;
        state.solveLog = buildEnrichedSolveLog(updatedMatch.solveLog, state, updatedMatch.ttrParams);
        updatedMatch.ttrState = state;
      }
      return res.status(200).json({ updated: false, match: updatedMatch });
    }
    for (const s of newSolves) {
      const { contestId, index, team } = s;
      let replacementCandidate = null;
      let newRatingTarget: number | null = null;
      if (match.mode === 'replace') {
        const maybeOld = await prisma.problem.findFirst({
          where: { contestId, index, matchId },
        });
        if (maybeOld) {
          const increment = match.replaceIncrement ?? 100;
          newRatingTarget = Math.min(3500, (maybeOld.rating ?? 0) + increment);
          const allHandles = match.teams.flatMap(t => t.members).map(m => m.handle);
          try {
            const problemKeys = match.problems.filter(p => p.active).map(p => `${p.contestId}-${p.index}`);
            replacementCandidate = await fetchReplacementProblem(
              problemKeys,
              newRatingTarget,
              newRatingTarget,
              allHandles
            );
          } catch (err) {
            console.error('fetchReplacementProblem failed', err);
            replacementCandidate = null;
          }
        }
      }
      await prisma.$transaction(async (tx: any) => {
        const existing = await tx.solveLog.findFirst({
          where: { matchId, contestId, index },
        });
        if (existing) {
          return;
        }

        // Fix for TTR mode: create the problem row if it doesn't exist, to satisfy the foreign key constraint
        if (match.mode === 'ttr' && match.ttrState) {
          const state = match.ttrState as any;
          const marketProb = state.market?.find((p: any) => p.contestId === contestId && p.index === index);
          if (marketProb) {
            const probExists = await tx.problem.findUnique({
              where: { contestId_index_matchId: { contestId, index, matchId } }
            });
            if (!probExists) {
              await tx.problem.create({
                data: {
                  contestId,
                  index,
                  matchId,
                  rating: marketProb.rating || 0,
                  name: marketProb.name || `Problem ${index}`,
                  position: 0,
                  active: false
                }
              });
            }
          }
        }

        await tx.solveLog.create({
          data: {
            handle: s.handle,
            team,
            contestId,
            index,
            timestamp: s.timestamp,
            matchId,
          },
        });
        const solvedRow = await tx.problem.findFirst({
          where: { contestId, index, matchId, active: true },
        });

        const oldProblem = solvedRow ?? await tx.problem.findUnique({
          where: { contestId_index_matchId: { contestId, index, matchId } },
        });


        if (match.mode === 'replace' && oldProblem) {
          const increment = match.replaceIncrement ?? 100;
          const newRatingTarget = Math.min(3500, (oldProblem.rating ?? 0) + increment);
          const allHandles = match.teams.flatMap((team) => team.members).map((p) => p.handle);
          // const replacementCandidate = await fetchReplacementProblem(
          //   problems.map(p => `${p.contestId}-${p.index}`), 
          //   newRatingTarget,
          //   newRatingTarget,
          //   allHandles,
          // );

          const oldP = await tx.problem.findFirst({
            where: { contestId: oldProblem.contestId, index: oldProblem.index, matchId, active: true },
          });
          if (!oldP) return;
          await tx.problem.update({
            where: { contestId_index_matchId: { contestId: oldP.contestId, index: oldP.index, matchId } },
            data: { active: false },
          });

          if (replacementCandidate) {
            const dup = await tx.problem.findFirst({
              where: { contestId: replacementCandidate.contestId ?? 0, index: replacementCandidate.index ?? '', matchId }
            });
            if (!dup) {
              await tx.problem.create({
                data: {
                  contestId: replacementCandidate.contestId ?? 0,
                  index: replacementCandidate.index ?? String(Date.now()),
                  matchId,
                  rating: replacementCandidate?.rating ?? newRatingTarget,
                  name: replacementCandidate.name ?? `Problem ${replacementCandidate.index}`,
                  position: oldP.position,
                  active: true,
                },
              });
            }
          } else {
            await tx.problem.create({
              data: {
                contestId: 0,
                index: String(Date.now()),
                matchId,
                rating: newRatingTarget,
                name: `Replacement (${newRatingTarget})`,
                position: oldP.position,
                active: true,
              },
            });
          }
        }
      });
    }

    // TUG MODE: Update tugCount based on solves (wrapped in transaction for concurrency safety)
    if (match.mode === 'tug' && newSolves.length > 0) {
      const teamA = match.teams[0]?.color; // First team
      const teamB = match.teams[1]?.color; // Second team

      await prisma.$transaction(async (tx: any) => {
        // Re-read current tugCount inside the transaction to avoid stale reads
        const freshMatch = await tx.match.findUnique({
          where: { id: matchId },
          select: { tugCount: true },
        });
        let runningCount = freshMatch?.tugCount ?? 0;

        for (const solve of newSolves) {
          const problem = match.problems.find(
            p => p.contestId === solve.contestId && p.index === solve.index
          );
          const rating = problem?.rating ?? 0;

          if (solve.team.toLowerCase() === teamA?.toLowerCase()) {
            runningCount += rating; // Team A increases count
          } else if (solve.team.toLowerCase() === teamB?.toLowerCase()) {
            runningCount -= rating; // Team B decreases count
          }
        }

        await tx.match.update({
          where: { id: matchId },
          data: { tugCount: runningCount },
        });

        match.tugCount = runningCount;
      });

      // For Type B (single), replace the problem outside the transaction
      // (fetchReplacementProblem does external API calls)
      for (const solve of newSolves) {
        const problem = match.problems.find(
          p => p.contestId === solve.contestId && p.index === solve.index
        );
        if (match.tugType === 'single' && problem) {
          const allHandles = match.teams.flatMap(t => t.members).map(m => m.handle);
          const problemKeys = match.problems.filter(p => p.active).map(p => `${p.contestId}-${p.index}`);

          try {
            const replacementCandidate = await fetchReplacementProblem(
              problemKeys,
              match.minRating ?? 800,
              match.maxRating ?? 3500,
              allHandles
            );

            await prisma.$transaction(async (tx: any) => {
              await tx.problem.update({
                where: { contestId_index_matchId: { contestId: problem.contestId, index: problem.index, matchId } },
                data: { active: false },
              });

              if (replacementCandidate) {
                const dup = await tx.problem.findFirst({
                  where: { contestId: replacementCandidate.contestId ?? 0, index: replacementCandidate.index ?? '', matchId }
                });
                if (!dup) {
                  await tx.problem.create({
                    data: {
                      contestId: replacementCandidate.contestId ?? 0,
                      index: replacementCandidate.index ?? String(Date.now()),
                      matchId,
                      rating: replacementCandidate?.rating ?? 800,
                      name: replacementCandidate.name ?? `Problem ${replacementCandidate.index}`,
                      position: problem.position,
                      active: true,
                    },
                  });
                }
              }
            });
          } catch (err) {
            console.error('Error fetching replacement problem in tug mode:', err);
          }
        }
      }
    }

    // TTR MODE: Award coins and replenish market
    if (match.mode === 'ttr' && newSolves.length > 0) {
      await prisma.$transaction(async (tx: any) => {
        for (const solve of newSolves) {
          await awardTtrCoinsAndReplenish(tx, matchId, solve, fetchReplacementProblem);
        }
      });
    }

    const updatedMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        problems: { where: { active: true }, orderBy: { position: 'asc' } },
        teams: { include: { members: true } },
        solveLog: { include: { problem: true }, orderBy: { timestamp: 'desc' } },
      },
    });

    if (updatedMatch?.mode === 'ttr' && updatedMatch?.ttrState) {
      const state = updatedMatch.ttrState as any;
      state.solveLog = buildEnrichedSolveLog(updatedMatch.solveLog, state, updatedMatch.ttrParams);
      updatedMatch.ttrState = state;
    }
    return res.status(200).json({ updated: true, match: updatedMatch });
  } catch (err) {
    console.error('Error in poll-submissions:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

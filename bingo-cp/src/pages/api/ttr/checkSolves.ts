import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/app/lib/prisma';
import { fetchUserSubmissions } from '@/app/lib/codeforces';
import { broadcastTtrUpdate } from '@/lib/pusherServer';
import { awardTtrCoinsAndReplenish } from '@/lib/ttrCoinAwarding';
import { fetchReplacementProblem } from '@/lib/problemUtils';

/**
 * POST /api/ttr/checkSolves
 *
 * Returns immediately (freeing the browser connection) and performs the slow
 * Codeforces API fetch in the background. If new solves are found and coins are
 * awarded, a Pusher broadcast notifies all clients to re-sync.
 *
 * Body: { matchId: string, token: string }
 * Returns: { queued: true }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { matchId, token } = req.body;

    if (!matchId || !token) {
        return res.status(400).json({ error: 'Missing matchId or token' });
    }

    // --- Quick auth + cooldown check (fast, just a DB lookup) ---
    try {
        const member = await prisma.member.findFirst({
            where: {
                secret: token,
                team: { matchId },
                claimed: true,
            },
            include: { team: true },
        });

        if (!member) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const now = new Date();
        const cooldownSeconds = Number(process.env.POLLING_COOLDOWN_SECONDS) || 60;
        const lastPolled = new Date(member.lastPolledAt);

        if (now.getTime() - lastPolled.getTime() <= cooldownSeconds * 1000) {
            // Still in cooldown — return silently without consuming CF quota
            return res.status(200).json({ queued: false, reason: 'cooldown' });
        }

        // Mark lastPolledAt immediately to prevent race conditions from parallel requests
        await prisma.member.update({
            where: { id: member.id },
            data: { lastPolledAt: now },
        });

        // ✅ Return to the client RIGHT NOW — the browser connection is completely freed
        res.status(200).json({ queued: true });

        // 🔥 Everything below runs AFTER the response is sent (fire-and-forget)
        runChecks(matchId, member).catch((err) => {
            console.error('[checkSolves] Background check failed:', err);
        });

    } catch (error: any) {
        // Only errors in the fast auth path reach here
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || 'Internal Error' });
        }
    }
}

// ---------------------------------------------------------------------------
// Background worker — runs entirely AFTER the HTTP response is sent.
// The Codeforces API call happens here, safely isolated from the browser queue.
// ---------------------------------------------------------------------------
async function runChecks(matchId: string, member: any) {
    // Fetch submissions from Codeforces (the slow part — 2-15s)
    const limitStr = process.env.CF_LIVE_POLLING_FETCH_LIMIT;
    const limit = limitStr ? Number(limitStr) : undefined;
    const submissions = await fetchUserSubmissions(member.handle, limit);

    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
        return;
    }

    // Load match + active problems + existing solve log
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            solveLog: true,
        },
    });

    if (!match || !match.ttrState) return;
    const state = match.ttrState as any;

    // Identify new solves for this team
    const newSolves: Array<{
        contestId: number;
        index: string;
        timestamp: Date;
        team: string;
        handle: string;
    }> = [];

    for (const sub of submissions) {
        if (sub.verdict !== 'OK') continue;

        const problem = state.market?.find(
            (p: any) => p.contestId === sub.problem.contestId && p.index === sub.problem.index
        );
        if (!problem) continue;

        // Check if solved by THIS team in THIS match's solveLog
        const alreadyLogged = match.solveLog.some(
            (log: any) =>
                log.contestId === problem.contestId &&
                log.index === problem.index
        );

        if (!alreadyLogged) {
            newSolves.push({
                contestId: problem.contestId,
                index: problem.index,
                timestamp: new Date(sub.creationTimeSeconds * 1000),
                team: member.team.color,
                handle: member.handle,
            });
        }
    }

    if (newSolves.length === 0) return;

    // Persist new solves and award coins inside a single transaction
    await prisma.$transaction(async (tx: any) => {
        for (const solve of newSolves) {
            // Double-check inside transaction to guard against simultaneous requests
            const existing = await tx.solveLog.findFirst({
                where: {
                    matchId,
                    contestId: solve.contestId,
                    index: solve.index,
                },
            });
            if (existing) continue;

            // Fixed for TTR mode: create the problem row if it doesn't exist, to satisfy the foreign key constraint
            // We mark it active: false so it doesn't get re-tracked in future polling cycles.
            const probExists = await tx.problem.findUnique({
                where: { contestId_index_matchId: { contestId: solve.contestId, index: solve.index, matchId } }
            });
            if (!probExists) {
                const marketProb = state.market?.find((p: any) => p.contestId === solve.contestId && p.index === solve.index);
                await tx.problem.create({
                    data: {
                        contestId: solve.contestId,
                        index: solve.index,
                        matchId,
                        rating: marketProb?.rating || 0,
                        name: marketProb?.name || `Problem ${solve.index}`,
                        position: 0,
                        active: false
                    }
                });
            }

            await tx.solveLog.create({
                data: {
                    matchId,
                    contestId: solve.contestId,
                    index: solve.index,
                    handle: solve.handle,
                    team: solve.team,
                    timestamp: solve.timestamp,
                },
            });

            await awardTtrCoinsAndReplenish(tx, matchId, solve, fetchReplacementProblem);
        }
    });

    // 🔔 Notify all clients that coins have been awarded — they will re-sync
    await broadcastTtrUpdate(matchId, { action: 'coinsAwarded', team: member.team.color, count: newSolves.length });

    console.log(`[checkSolves] Awarded coins for ${newSolves.length} new solve(s) by ${member.handle}`);
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchAndFilterProblems } from '@/lib/problems';
import { MatchMode } from '@prisma/client';
import { setMatchBuffer } from '@/lib/matchProblemBuffer';

type ProblemWithGrid = {
  contestId: number;
  index: string;
  row: number;
  col: number;
  name: string;
  rating: number;
  maxPoints: number;
};

export async function POST(req: NextRequest) {
  const {
    startTime,
    durationMinutes,
    minRating,
    maxRating,
    replaceIncrement,
    timeoutMinutes,
    mode,
    gridSize,
    teams,
    showRatings = true,
    tugThreshold,
    tugType,
  } = (await req.json()) as {
    startTime: string;
    durationMinutes: number;
    minRating: number;
    maxRating: number;
    replaceIncrement: number;
    timeoutMinutes?: number | null;
    mode: MatchMode;
    gridSize: number;
    showRatings: boolean;
    tugThreshold?: number;
    tugType?: string;
    teams: Array<{
      name: string;
      color: string;
      members: string[];
    }>;
  };
  const finalGridSize = (mode === 'tug' && tugType === 'single') ? 1 : gridSize;

  // Validate gridSize for non-tug modes, or when tug mode is grid type
  if (mode === 'tug' && tugType === 'single') {
    // For tug single mode, we only need 1 problem
  } else if (![3, 4, 5, 6].includes(finalGridSize)) {
    return NextResponse.json({ error: 'invalid gridSize' }, { status: 400 });
  }

  // Tug mode requires exactly 2 teams
  if (mode === 'tug' && teams.length !== 2) {
    return NextResponse.json({ error: 'Tug of War mode requires exactly 2 teams' }, { status: 400 });
  }

  // Trim and clean handles in teams
  for (const team of teams) {
    team.members = (team.members || [])
      .map((m) => (typeof m === 'string' ? m.trim() : ''))
      .filter((m) => m !== '');
  }

  // Validate teams have members
  for (const team of teams) {
    if (team.members.length === 0) {
      return NextResponse.json({ error: `Team "${team.name}" must have at least one member` }, { status: 400 });
    }
  }

  const Cmode = mode;

  const allHandles = teams.flatMap((team) => team.members);
  
  if (allHandles.length > 0) {
    try {
      const infoRes = await fetch(`https://codeforces.com/api/user.info?handles=${allHandles.join(';')}`);
      const data = await infoRes.json();
      if (data.status === 'FAILED') {
        return NextResponse.json({ error: data.comment || 'One or more Codeforces handles are invalid or not found' }, { status: 400 });
      }
    } catch (e) {
      console.error("Error validating handles:", e);
      return NextResponse.json({ error: 'Failed to validate Codeforces handles' }, { status: 500 });
    }
  }

  try {
    // For tug single mode, fetch only 1 problem; otherwise fetch grid
    const problemCount = (mode === 'tug' && tugType === 'single') ? 1 : finalGridSize * finalGridSize;

    // Buffer size: at least 20 per player, or 10 minimum (one rating range for normal modes)
    const totalPlayers = allHandles.length;
    const bufferSize = Math.max(20 * totalPlayers, 10);
    const totalFetch = problemCount + bufferSize;

    const allFetchedProblems = await fetchAndFilterProblems({
      userHandles: allHandles,
      minRating,
      maxRating,
      count: totalFetch,
    });

    // First `problemCount` go into the match; the rest become the spare buffer
    const selectedProblems = allFetchedProblems.slice(0, problemCount);
    const bufferProblems = allFetchedProblems.slice(problemCount);

    const problems: ProblemWithGrid[] = selectedProblems.map(
      (p, idx) => ({
        contestId: p.contestId,
        index: p.index,
        row: Math.floor(idx / finalGridSize),
        col: idx % finalGridSize,
        rating: p.rating ?? 0,
        name: p.name,
        maxPoints: 0, // maxPoints is missing in ProblemWithGrid definition in original file? waiting for view_file
      })
    );
    // console.time("match");
    const match = await prisma.match.create({
      data: {
        mode: Cmode,
        startTime: new Date(startTime),
        durationMinutes,
        timeoutMinutes: timeoutMinutes === undefined ? null : Math.floor(Number(timeoutMinutes)),
        replaceIncrement: Cmode === 'replace' ? Number(replaceIncrement ?? 100) : undefined, // maybe validate later
        minRating: minRating ?? undefined,
        maxRating: maxRating ?? undefined,
        gridSize: finalGridSize,
        showRatings: Boolean(showRatings),
        tugThreshold: Cmode === 'tug' ? Number(tugThreshold ?? 2000) : undefined,
        tugType: Cmode === 'tug' ? (tugType ?? 'grid') : undefined,
        tugCount: Cmode === 'tug' ? 0 : undefined,
      },
    });
    // console.timeEnd("match");
    // console.time("createMany");
    await prisma.problem.createMany({
      data: problems.map((p) => ({
        // console.log("P: ", p.contestId);
        contestId: p.contestId ?? 1242,
        index: p.index,
        matchId: match.id,
        rating: p.rating ?? 0,
        name: p.name,
        position: p.row * finalGridSize + p.col,
        maxPoints: undefined,
        active: true,
      })),
    });
    // console.timeEnd("createMany");

    for (const team of teams) {
      const createdTeam = await prisma.team.create({
        data: {
          name: team.name,
          color: team.color,
          matchId: match.id,
        },
      });

      await prisma.member.createMany({
        data: team.members.map((handle) => ({
          handle,
          teamId: createdTeam.id,
        })),
      });
    }

    // Store spare problems in server-side buffer for fast replacement during the match
    if (bufferProblems.length > 0) {
      setMatchBuffer(match.id, bufferProblems.map(p => ({
        contestId: p.contestId,
        index: p.index,
        name: p.name,
        rating: p.rating ?? 0,
        tags: (p as any).tags,
      })));
    }

    return NextResponse.json({ id: match.id }, { status: 200 });
  } catch (error) {
    console.error("Match creation failed", error);
    return NextResponse.json({ error: 'Match creation failed' }, { status: 500 });
  }
}

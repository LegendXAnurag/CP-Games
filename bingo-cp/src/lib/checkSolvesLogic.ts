// src/lib/checkSolvesLogic.ts

export type Problem = {
    contestId: number
    index: string
}

export type Player = {
    handle: string
    team: string
}

export type Claim = {
    team: string;
    handle: string;
    time: number;
    id: number
}

import { fetchUserSubmissions } from '@/lib/codeforces'

// ... existing types ...

export async function checkSolvesLogic(problems: Problem[], players: Player[]) {
    const problemKey = (p: Problem) => `${p.contestId}-${p.index}`
    const trackedProblems = new Set(problems.map(problemKey))
    const claims: Record<string, { team: string; handle: string; time: number; id: number }> = {}

    // During live match polling, only fetch the last N submissions (fast).
    // Full history is only needed at match creation (handled in problems.ts).
    const liveLimit = process.env.CF_LIVE_POLLING_FETCH_LIMIT
        ? Number(process.env.CF_LIVE_POLLING_FETCH_LIMIT)
        : undefined;

    // Fetch submissions for all players in parallel to avoid sequential network latency
    const results = await Promise.all(
        players.map(async (player) => {
            try {
                const submissions = await fetchUserSubmissions(player.handle, liveLimit) as Array<{
                    id: number,
                    creationTimeSeconds: number,
                    problem: { contestId: number; index: string },
                    verdict: string
                }>;
                return { player, submissions: submissions || [] };
            } catch (err) {
                console.error(`Error fetching for ${player.handle}`, err);
                return { player, submissions: [] };
            }
        })
    );

    // Process the results synchronously to assign solves to the earliest correct submissions
    for (const { player, submissions } of results) {
        if (!Array.isArray(submissions)) continue;
        console.log(`[CheckSolves] Processing ${submissions.length} submissions for ${player.handle}`);

        for (const sub of submissions) {
            if (sub.verdict !== 'OK') continue
            const key = `${sub.problem.contestId}-${sub.problem.index}`
            if (!trackedProblems.has(key)) continue
            console.log(`[CheckSolves] Match found for ${key} by ${player.handle}`);
            const existing = claims[key]
            if (
                !existing ||
                sub.creationTimeSeconds < existing.time ||
                (sub.creationTimeSeconds === existing.time && sub.id < existing.id)
            ) {
                claims[key] = {
                    team: player.team,
                    handle: player.handle,
                    time: sub.creationTimeSeconds,
                    id: sub.id,
                }
            }
        }
    }

    return claims;
}

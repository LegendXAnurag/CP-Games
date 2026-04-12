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

import { fetchUserSubmissions } from '@/app/lib/codeforces'

// ... existing types ...

export async function checkSolvesLogic(problems: Problem[], players: Player[]) {
    const problemKey = (p: Problem) => `${p.contestId}-${p.index}`
    const trackedProblems = new Set(problems.map(problemKey))
    const claims: Record<string, { team: string; handle: string; time: number; id: number }> = {}

    // Process players in parallel to take advantage of our new coalescing/throttling
    const limitStr = process.env.CF_LIVE_POLLING_FETCH_LIMIT;
    const limit = limitStr ? Number(limitStr) : undefined;
    await Promise.all(players.map(async (player) => {
        try {
            const submissions = await fetchUserSubmissions(player.handle, limit) as Array<{
                id: number,
                creationTimeSeconds: number,
                problem: { contestId: number; index: string },
                verdict: string
            }>;

            if (!submissions || !Array.isArray(submissions)) return;
            console.log(`[CheckSolves] Processing ${submissions.length} submissions for ${player.handle}`);

            for (const sub of submissions) {
                if (sub.verdict !== 'OK') continue
                const key = `${sub.problem.contestId}-${sub.problem.index}`
                // console.log(`[CheckSolves] Checking ${key} for ${player.handle}`);
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
        } catch (err) {
            console.error(`Error processing ${player.handle}`, err)
        }
    }));

    return claims;
}

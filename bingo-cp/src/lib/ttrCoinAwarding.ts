import { getCoinsForRow } from './ttrCoins';
import { TTRState, TTRParams } from '@/types/match';

/**
 * Pre-fetches replacement problems outside of a database transaction.
 * Resolves API request latency / block risks during database transactions.
 */
export async function preFetchTtrReplacements(
    match: any,
    newSolves: Array<{ contestId: number; index: string | number; team: string }>,
    fetchReplacementProblem: (exclude: string[], minRating: number, maxRating: number, handles: string[], matchId?: string) => Promise<any>
): Promise<Record<string, any>> {
    const state = match.ttrState as unknown as TTRState;
    const params = match.ttrParams as unknown as TTRParams;
    if (!state || !state.market) return {};

    const replacementsMap: Record<string, any> = {};
    const excludedKeys = new Set<string>(state.market.map((p: any) => `${p.contestId}-${p.index}`));
    const allHandles = match.teams.flatMap((t: any) => t.members).map((m: any) => m.handle);

    for (const solve of newSolves) {
        const marketIdx = state.market.findIndex(
            (p: any) => p.contestId === solve.contestId && String(p.index) === String(solve.index)
        );
        if (marketIdx === -1) continue;

        const problem = state.market[marketIdx];
        const row = problem.row;

        const levelMin = row === 0 ? params.level1.min : row === 1 ? params.level2.min : row === 2 ? params.level3.min : params.level3.min + 300;
        const levelMax = row === 0 ? params.level1.max : row === 1 ? params.level2.max : row === 2 ? params.level3.max : params.level3.max + 500;

        try {
            const replacement = await fetchReplacementProblem(
                Array.from(excludedKeys),
                levelMin,
                levelMax,
                allHandles,
                match.id,  // pass matchId so the buffer-first path is taken
            );
            if (replacement) {
                replacementsMap[`${solve.contestId}-${solve.index}`] = replacement;
                excludedKeys.add(`${replacement.contestId}-${replacement.index}`);
            }
        } catch (e) {
            console.error("[preFetchTtrReplacements] Failed to pre-fetch replacement", e);
        }
    }
    return replacementsMap;
}

/**
 * Shared logic to award coins for a TTR solve and replenish the market.
 * Must be called INSIDE a Prisma transaction.
 * Takes the already pre-fetched replacement problem to prevent transaction lock blockages.
 */
export async function awardTtrCoinsAndReplenish(
    tx: any,
    matchId: string,
    solve: { contestId: number; index: number | string; team: string },
    preFetchedReplacement: any
) {
    const currentMatch = await tx.match.findUnique({
        where: { id: matchId },
        select: { ttrState: true, ttrParams: true }
    });

    if (!currentMatch?.ttrState) return;

    const state = currentMatch.ttrState as unknown as TTRState;
    const params = currentMatch.ttrParams as unknown as TTRParams;
    let stateChanged = false;

    // Find which problem was solved in the market
    const marketIdx = state.market.findIndex(
        p => p.contestId === solve.contestId && String(p.index) === String(solve.index)
    );

    if (marketIdx !== -1) {
        const problem = state.market[marketIdx];
        const playerTeam = solve.team;

        // Award coins
        const row = problem.row; // 0, 1, 2, 3
        const coins = getCoinsForRow(row, params);

        if (state.players[playerTeam]) {
            state.players[playerTeam].coins += coins;
            console.log(`[awardTtrCoins] Awarded ${coins} coins to ${playerTeam} (row ${row})`);
        }

        // Remove from market
        state.market.splice(marketIdx, 1);

        // Replenish
        if (preFetchedReplacement) {
            state.market.push({
                ...preFetchedReplacement,
                rating: preFetchedReplacement.rating ?? 0,
                row: row,
                col: 0,
                points: 0,
            });
            console.log(`[awardTtrCoins] Replenished market for row ${row} with ${preFetchedReplacement.contestId}-${preFetchedReplacement.index}`);
        }

        stateChanged = true;
    }

    if (stateChanged) {
        await tx.match.update({
            where: { id: matchId },
            data: { ttrState: state as any }
        });
    }
}

import { PrismaClient } from '@prisma/client';
import { getCoinsForRow } from './ttrCoins';
import { TTRState, TTRParams } from '@/types/match';

/**
 * Shared logic to award coins for a TTR solve and replenish the market.
 * Must be called INSIDE a Prisma transaction.
 */
export async function awardTtrCoinsAndReplenish(
    tx: any,
    matchId: string,
    solve: { contestId: number; index: number | string; team: string },
    fetchReplacementProblem: (exclude: string[], minRating: number, maxRating: number, handles: string[]) => Promise<any>
) {
    const currentMatch = await tx.match.findUnique({
        where: { id: matchId },
        select: { ttrState: true, ttrParams: true, teams: { include: { members: true } } }
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
        const levelParams = row === 1 ? params.level2 : row === 2 ? params.level3 : params.level1;
        // Note: level4 is optional, fallback to level3 or expert range
        const levelMin = row === 0 ? params.level1.min : row === 1 ? params.level2.min : row === 2 ? params.level3.min : params.level3.min + 300;
        const levelMax = row === 0 ? params.level1.max : row === 1 ? params.level2.max : row === 2 ? params.level3.max : params.level3.max + 500;

        const allHandles = currentMatch.teams.flatMap((t: any) => t.members).map((m: any) => m.handle);
        try {
            const replacement = await fetchReplacementProblem(
                state.market.map((p: any) => `${p.contestId}-${p.index}`),
                levelMin,
                levelMax,
                allHandles
            );

            if (replacement) {
                state.market.push({
                    ...replacement,
                    rating: replacement.rating ?? 0,
                    row: row,
                    col: 0,
                    points: 0,
                });
                console.log(`[awardTtrCoins] Replenished market for row ${row} with ${replacement.contestId}-${replacement.index}`);
            }
        } catch (e) {
            console.error("[awardTtrCoins] Failed to replenish TTR market", e);
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

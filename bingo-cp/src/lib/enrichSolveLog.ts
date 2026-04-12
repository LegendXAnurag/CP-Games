import { getCoinsForRow } from './ttrCoins';

/**
 * Build an enriched solve-log array for TTR mode.
 *
 * This function is the SINGLE place where we turn raw DB solve-log rows
 * into the `{ team, handle, problemName, coinsAwarded, timestamp }` shape
 * used by the client.
 *
 * Previously this logic was copy-pasted in three places in poll-submissions.ts
 * and once in ttr/sync.ts, each using slightly different coin formulas.
 */
export function buildEnrichedSolveLog(
    solveLog: Array<{
        team: string;
        handle: string;
        timestamp: Date | string;
        index: string;
        contestId: number;
        problem?: { name?: string; rating?: number; position?: number } | null;
    }>,
    ttrState?: {
        allProbs?: Array<{ contestId: number; index: string; row?: number; points?: number }>;
    } | null,
    ttrParams?: any | null,
) {
    return solveLog.map(log => {
        const tsStr = new Date(log.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
        const pName = log.problem?.name || `Problem ${log.index}`;

        // Determine coins: prefer row from allProbs, fall back to row-based formula
        let coins = 0;
        if (ttrState?.allProbs && Array.isArray(ttrState.allProbs)) {
            const probState = ttrState.allProbs.find(
                (p) => p.contestId === log.contestId && p.index === log.index,
            );
            if (probState) {
                coins =
                    probState.points !== undefined
                        ? probState.points
                        : probState.row !== undefined
                            ? getCoinsForRow(probState.row, ttrParams)
                            : 0;
            }
        }

        // Fallback: if we still have 0 and the problem has a row, use row-based formula
        // NOTE: We intentionally do NOT fall back to Math.round(rating/500)+1
        // because that formula produces different values than the row-based
        // formula actually used to award coins.

        return {
            team: log.team,
            handle: log.handle || 'Unknown Solver',
            problemName: pName,
            coinsAwarded: coins,
            timestamp: tsStr,
        };
    });
}

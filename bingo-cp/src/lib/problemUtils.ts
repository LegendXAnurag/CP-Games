import { fetchAndFilterProblems } from '@/lib/problems';
import { getReplacementFromBuffer } from '@/lib/matchProblemBuffer';

/**
 * Fetch a replacement problem for a specific match tile.
 *
 * Strategy:
 *   1. Try the pre-fetched server-side buffer for this match (fast, no CF calls).
 *   2. If no suitable problem is found in the buffer (e.g. buffer exhausted or
 *      evicted), fall back to a full fetchAndFilterProblems run — same pipeline
 *      used at match creation, including full submission history fetch.
 *
 * @param matchId   The match to look up in the buffer.
 * @param exclude   Problem keys (`contestId-index`) already in use on the board.
 * @param minRating Minimum problem rating required.
 * @param maxRating Maximum problem rating required.
 * @param handles   All player CF handles (used only in the fallback path).
 */
export async function fetchReplacementProblem(
    exclude: string[],
    minRating?: number,
    maxRating?: number,
    handles?: string[],
    matchId?: string,
) {
    const min = minRating ?? 800;
    const max = maxRating ?? 3500;
    const excludeSet = new Set(exclude);

    // --- 1. Fast path: serve from pre-fetched buffer ---
    if (matchId) {
        const buffered = getReplacementFromBuffer(matchId, min, max, excludeSet);
        if (buffered) {
            return buffered;
        }
        console.log(
            `[fetchReplacementProblem] Buffer miss for match ${matchId} ` +
            `(rating ${min}-${max}). Falling back to full CF fetch.`
        );
    }

    // --- 2. Slow fallback: re-run the full pipeline (full submission history) ---
    try {
        const candidateProblems = await fetchAndFilterProblems({
            minRating: min,
            maxRating: max,
            exclude: exclude,
            userHandles: handles ?? []
        });

        if (candidateProblems.length > 0) {
            // Pick a random candidate
            return candidateProblems[Math.floor(Math.random() * candidateProblems.length)];
        }
    } catch (err) {
        console.error('Error fetching replacement problem:', err);
    }
    return null;
}


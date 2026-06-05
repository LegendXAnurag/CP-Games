import { fetchAndFilterProblems } from '@/lib/problems';

/**
 * Fetch a replacement problem from Codeforces that hasn't been used yet in the match.
 */
export async function fetchReplacementProblem(
    exclude: string[],
    minRating?: number,
    maxRating?: number,
    handles?: string[]
) {
    try {
        const candidateProblems = await fetchAndFilterProblems({
            minRating: minRating ?? 800,
            maxRating: maxRating ?? 3500,
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

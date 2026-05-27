import { fetchUserSubmissions } from '@/lib/codeforces';

export type Problem = {
    contestId: number;
    index: string;
    name: string;
    rating?: number;
    tags: string[];
};

export type Submission = {
    problem: Problem;
    verdict: string;
};

export type GetProblemsOptions = {
    minRating?: number;
    maxRating?: number;
    userHandles?: string[];
    count?: number;
    exclude?: string[];
};

// --- Problem Set Caching & Request Coalescing ---
let cachedProblemsetPromise: Promise<Problem[]> | null = null;
let cachedProblems: Problem[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 Hour Cache

async function getCachedProblemset(): Promise<Problem[]> {
    const now = Date.now();
    
    // 1. Return valid cache if within expiration time
    if (cachedProblems && (now - lastFetchTime < CACHE_DURATION_MS)) {
        return cachedProblems;
    }
    
    // 2. Coalesce concurrent requests during fetch
    if (cachedProblemsetPromise) {
        return cachedProblemsetPromise;
    }
    
    // 3. Initiate fresh fetch
    cachedProblemsetPromise = (async () => {
        try {
            console.log('[Codeforces Cache] Fetching fresh problemset from Codeforces API...');
            const response = await fetch('https://codeforces.com/api/problemset.problems');
            const data = await response.json();
            if (data.status !== 'OK') {
                throw new Error('Failed to fetch problems from Codeforces.');
            }
            cachedProblems = data.result.problems;
            lastFetchTime = Date.now();
            return cachedProblems!;
        } catch (error) {
            console.error('[Codeforces Cache] Failed to fetch problemset:', error);
            if (cachedProblems) {
                console.warn('[Codeforces Cache] Returning expired cache as fallback');
                return cachedProblems;
            }
            throw error;
        } finally {
            cachedProblemsetPromise = null;
        }
    })();
    
    return cachedProblemsetPromise;
}

export async function fetchAndFilterProblems(options: GetProblemsOptions): Promise<Problem[]> {
    const {
        minRating = 800,
        maxRating = 3500,
        userHandles = [],
        count = 25,
        exclude = [],
    } = options;

    try {
        let problems: Problem[] = await getCachedProblemset();

        problems = problems.filter(
            (p) =>
                !p.tags.includes('*special') &&
                p.rating &&
                p.rating >= minRating &&
                p.rating <= maxRating &&
                !exclude.includes(String(p.contestId) + p.index)
        );

        const solvedSet = new Set<string>();

        // Fetch submissions in parallel using our optimized client
        const limitStr = process.env.CF_MATCH_CREATION_FETCH_LIMIT;
        const limit = limitStr ? Number(limitStr) : undefined;
        await Promise.all(userHandles.map(async (handle) => {
            try {
                const submissions = await fetchUserSubmissions(handle, limit) as Array<{
                    problem: { contestId: number; index: string },
                    verdict: string
                }>;

                if (!submissions || !Array.isArray(submissions)) return;

                for (const sub of submissions) {
                    if (sub.verdict === 'OK') {
                        solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
                    }
                }
            } catch (err) {
                console.error(`Error fetching submissions for ${handle}`, err);
            }
        }));

        const unsolved = problems.filter(
            (p) => !solvedSet.has(`${p.contestId}-${p.index}`) && !exclude.includes(`${p.contestId}-${p.index}`)
        );

        if (unsolved.length === 0 && problems.length > 0) {
            // Only if we literally have NO unsolved problems in this range, 
            // fallback to the problems list but log a warning.
            console.warn(`[fetchAndFilterProblems] No unsolved problems found in range ${minRating}-${maxRating}. Falling back to solved problems.`);
            const shuffledFallback = [...problems].sort(() => Math.random() - 0.5);
            return shuffledFallback.slice(0, count);
        }

        const shuffled = unsolved.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    } catch (error) {
        console.error('Error in fetchAndFilterProblems:', error);
        throw error;
    }
}

/**
 * matchProblemBuffer.ts
 *
 * Server-side in-memory cache of pre-fetched "spare" problems for each match.
 * Populated once at match creation, consumed one-by-one as replacements are needed.
 *
 * Structure per matchId:
 *   problems  – flat list of spare Problem objects (already unsolved by every player in the match)
 *   createdAt – for automatic expiry (evict entries older than BUFFER_TTL_MS)
 */

export type BufferedProblem = {
    contestId: number;
    index: string;
    name: string;
    rating: number;
    tags?: string[];
};

type MatchBuffer = {
    problems: BufferedProblem[];
    createdAt: number;
};

// Evict buffers that are older than 24 hours (matches won't last longer than this)
const BUFFER_TTL_MS = 24 * 60 * 60 * 1000;

const bufferStore = new Map<string, MatchBuffer>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store a set of spare problems for a match.
 * Any existing buffer for the same matchId is replaced.
 */
export function setMatchBuffer(matchId: string, problems: BufferedProblem[]): void {
    evictExpired();
    bufferStore.set(matchId, { problems: [...problems], createdAt: Date.now() });
    console.log(`[MatchBuffer] Stored ${problems.length} spare problems for match ${matchId}`);
}

/**
 * Try to pop one problem from the buffer that:
 *   - has rating within [minRating, maxRating]
 *   - is not already used (not in excludeKeys)
 *
 * The problem is removed from the buffer on success.
 * Returns null if no suitable problem is found.
 */
export function getReplacementFromBuffer(
    matchId: string,
    minRating: number,
    maxRating: number,
    excludeKeys: Set<string>
): BufferedProblem | null {
    evictExpired();
    const entry = bufferStore.get(matchId);
    if (!entry || entry.problems.length === 0) return null;

    const idx = entry.problems.findIndex(
        (p) =>
            p.rating >= minRating &&
            p.rating <= maxRating &&
            !excludeKeys.has(`${p.contestId}-${p.index}`)
    );

    if (idx === -1) return null;

    // Remove from buffer and return
    const [problem] = entry.problems.splice(idx, 1);
    console.log(
        `[MatchBuffer] Served replacement ${problem.contestId}-${problem.index} ` +
        `(rating ${problem.rating}) from buffer for match ${matchId}. ` +
        `${entry.problems.length} remaining.`
    );
    return problem;
}

/**
 * Explicitly delete the buffer for a match (optional clean-up).
 */
export function clearMatchBuffer(matchId: string): void {
    bufferStore.delete(matchId);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function evictExpired(): void {
    const now = Date.now();
    for (const [id, entry] of bufferStore.entries()) {
        if (now - entry.createdAt > BUFFER_TTL_MS) {
            bufferStore.delete(id);
            console.log(`[MatchBuffer] Evicted expired buffer for match ${id}`);
        }
    }
}

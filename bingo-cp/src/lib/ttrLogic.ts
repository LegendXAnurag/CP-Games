import { TTRState, TTRPlayerState, Track, City, Ticket } from '@/types/match';
import { TRACKS, TICKETS } from './ttrData';

export function getTrackCost(track: Track): number {
    return track.length;
}

export function getTrackPoints(track: Track): number {
    const lengths = [0, 1, 2, 4, 7, 10, 15, 18, 21]; // up to 8
    return lengths[track.length] || track.length;
}

// Helper to find track in state (dynamic) or static
export function findTrack(state: TTRState, trackId: string): Track | undefined {
    if (state.mapData) {
        return state.mapData.tracks.find(t => t.id === trackId);
    }
    return TRACKS.find(t => t.id === trackId);
}

export function canBuildTrack(state: TTRState, player: TTRPlayerState, trackId: string): { possible: boolean; reason?: string } {
    if (!player) return { possible: false, reason: "Player not found" };

    const track = findTrack(state, trackId);
    if (!track) return { possible: false, reason: "Track invalid" };

    const trackState = state.tracks[trackId];
    if (trackState && trackState.claimedBy) {
        return { possible: false, reason: "Track already claimed" };
    }

    for (const otherTrackId in state.tracks) {
        const ts = state.tracks[otherTrackId];
        if (ts.claimedBy === player.team || (ts.stationedBy && ts.stationedBy.includes(player.team))) {
            const otherTrack = findTrack(state, otherTrackId);
            if (otherTrack &&
                ((otherTrack.city1 === track.city1 && otherTrack.city2 === track.city2) ||
                    (otherTrack.city1 === track.city2 && otherTrack.city2 === track.city1))) {
                return { possible: false, reason: "You already own a track or station between these two cities" };
            }
        }
    }

    // Check cost
    const cost = getTrackCost(track);
    if (player.coins < cost) {
        return { possible: false, reason: `Not enough coins. Need ${cost}, have ${player.coins}` };
    }

    if (player.trainsLeft < track.length) {
        return { possible: false, reason: "Not enough trains left" };
    }

    return { possible: true };
}

export function buildTrack(state: TTRState, teamColor: string, trackId: string): TTRState | null {
    const player = state.players[teamColor];
    if (!player) return null;

    const track = findTrack(state, trackId);
    if (!track) return null;

    const check = canBuildTrack(state, player, trackId);
    if (!check.possible) return null;

    // Deduct cost
    const cost = getTrackCost(track);
    player.coins -= cost;
    player.trainsLeft -= track.length;

    // Add points
    player.score += getTrackPoints(track);

    // Claim track
    if (!state.tracks[trackId]) {
        state.tracks[trackId] = { id: trackId, claimedBy: null, stationedBy: [] };
    }
    state.tracks[trackId].claimedBy = teamColor;

    // Add to player routes (just IDs for now)
    player.routes.push(trackId);

    return state;
}

export function canBuildStation(state: TTRState, player: TTRPlayerState, trackId: string): { possible: boolean; reason?: string } {
    if (!player) return { possible: false, reason: "Player not found" };

    const track = findTrack(state, trackId);
    if (!track) return { possible: false, reason: "Track invalid" };

    const trackState = state.tracks[trackId];

    // Must be claimed by someone to build a station (allows sharing)
    if (!trackState || !trackState.claimedBy) {
        return { possible: false, reason: "Track must be claimed to build a station" };
    }

    // Cannot build station if you already claimed the track (you already use it)
    if (trackState.claimedBy === player.team) {
        return { possible: false, reason: "You already own this track" };
    }

    // Check if player already has a station here
    if (trackState.stationedBy && trackState.stationedBy.includes(player.team)) {
        return { possible: false, reason: "You already have a station on this track" };
    }

    // Check if team already owns a track or station between these same two cities
    for (const otherTrackId in state.tracks) {
        if (otherTrackId === trackId) continue;
        const ts = state.tracks[otherTrackId];
        if (ts.claimedBy === player.team || (ts.stationedBy && ts.stationedBy.includes(player.team))) {
            const otherTrack = findTrack(state, otherTrackId);
            if (otherTrack &&
                ((otherTrack.city1 === track.city1 && otherTrack.city2 === track.city2) ||
                    (otherTrack.city1 === track.city2 && otherTrack.city2 === track.city1))) {
                return { possible: false, reason: "You already own a track or station between these two cities" };
            }
        }
    }

    if (player.stationsLeft <= 0) {
        return { possible: false, reason: "No stations left" };
    }

    // Cost: 4 - stationsLeft (1st costs 1, 2nd costs 2, 3rd costs 3)
    const cost = 4 - player.stationsLeft;

    if (player.coins < cost) {
        return { possible: false, reason: `Not enough coins. Need ${cost}, have ${player.coins}` };
    }

    return { possible: true };
}

export function buildStation(state: TTRState, teamColor: string, trackId: string): TTRState | null {
    const player = state.players[teamColor];
    if (!player) return null;

    const check = canBuildStation(state, player, trackId);
    if (!check.possible) return null;

    const cost = 4 - player.stationsLeft;
    player.coins -= cost;
    player.stationsLeft -= 1;

    if (!state.tracks[trackId]) {
        // Should exist if claimed, but for safety
        state.tracks[trackId] = { id: trackId, claimedBy: null, stationedBy: [] };
    }

    if (!state.tracks[trackId].stationedBy) {
        state.tracks[trackId].stationedBy = [];
    }

    state.tracks[trackId].stationedBy!.push(teamColor);

    return state;
}

// Longest path DFS logic can be added later if needed for scoring

export function getCompletedRoute(state: TTRState, teamColor: string, city1: string, city2: string): Track[] | null {
    const validTracks: Track[] = [];
    const adj = new Map<string, { neighbor: string; track: Track }[]>();

    for (const trackId of Object.keys(state.tracks)) {
        const tState = state.tracks[trackId];
        if (tState.claimedBy === teamColor || (tState.stationedBy && tState.stationedBy.includes(teamColor))) {
            const track = findTrack(state, trackId);
            if (track) {
                validTracks.push(track);
            }
        }
    }

    for (const track of validTracks) {
        const c1 = track.city1;
        const c2 = track.city2;
        if (!adj.has(c1)) adj.set(c1, []);
        if (!adj.has(c2)) adj.set(c2, []);
        adj.get(c1)!.push({ neighbor: c2, track });
        adj.get(c2)!.push({ neighbor: c1, track });
    }

    if (!adj.has(city1) || !adj.has(city2)) return null;

    const queue: { city: string; path: Track[] }[] = [{ city: city1, path: [] }];
    const visited = new Set<string>();
    visited.add(city1);

    while (queue.length > 0) {
        const { city, path } = queue.shift()!;

        if (city === city2) {
            return path;
        }

        const neighbors = adj.get(city) || [];
        for (const { neighbor, track } of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ city: neighbor, path: [...path, track] });
            }
        }
    }

    return null;
}

export function getTicket(state: TTRState, ticketId: string): Ticket | undefined {
    if (state.mapData && state.mapData.tickets) {
        return state.mapData.tickets.find(t => t.id === ticketId);
    }
    return TICKETS.find(t => t.id === ticketId);
}

export function calculateTotalScore(state: TTRState, teamColor: string): number {
    const player = state.players[teamColor];
    if (!player) return 0;

    let totalScore = player.score;

    for (const ticketId of (player.destinations || [])) {
        if (ticketId === 'optimistic_draw') continue;
        const ticket = getTicket(state, ticketId);
        if (ticket) {
            const completed = getCompletedRoute(state, teamColor, ticket.city1, ticket.city2);
            if (completed) {
                totalScore += ticket.points;
            }
        }
    }

    return totalScore;
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../app/lib/prisma';
import { TTRParams, TTRState, ProblemCell, TTRPlayerState, TTRTrackState } from '../../app/types/match';
import { fetchUserSubmissions } from '../../app/lib/codeforces';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { teams, ttrParams, startTime } = req.body;

        if (!teams || teams.length < 2) {
            return res.status(400).json({ message: 'At least 2 teams required' });
        }

        // Validate teams have members
        for (const team of teams) {
            const validMembers = team.members.filter((m: any) => typeof m === 'string' && m.trim() !== '');
            if (validMembers.length === 0) {
                return res.status(400).json({ message: `Team "${team.name}" must have at least one member` });
            }
        }

        // Fetch problems from Codeforces
        const cfRes = await fetch('https://codeforces.com/api/problemset.problems');
        if (!cfRes.ok) {
            const text = await cfRes.text();
            console.error("Codeforces API error:", cfRes.status, text.substring(0, 200));
            throw new Error(`Codeforces API unreachable (Status ${cfRes.status})`);
        }

        let cfData;
        try {
            cfData = await cfRes.json();
        } catch (e) {
            const text = await cfRes.text();
            console.error("Codeforces returned non-JSON:", text.substring(0, 200));
            throw new Error("Codeforces API returned invalid data");
        }

        if (cfData.status !== 'OK') {
            throw new Error('Failed to fetch problems from Codeforces: ' + (cfData.comment || 'Unknown error'));
        }

        const allProblems = cfData.result.problems as any[];

        // Filter and select problems for each level
        const levels = [ttrParams.level1, ttrParams.level2, ttrParams.level3, ttrParams.level4];
        const marketProblems: ProblemCell[] = [];
        const allProbs: ProblemCell[] = [];

        // Fetch solved problems for all team members
        const solvedSet = new Set<string>();
        const allHandles: string[] = [];
        teams.forEach((team: any) => {
            const teamHandles = team.members
                .map((m: any) => typeof m === 'string' ? m.trim() : m?.handle?.trim() || '')
                .filter((m: string) => m !== '');
            allHandles.push(...teamHandles);
        });

        await Promise.all(allHandles.map(async (handle) => {
            try {
                const submissions = await fetchUserSubmissions(handle);
                if (Array.isArray(submissions)) {
                    for (const sub of submissions as Array<any>) {
                        if (sub.verdict === 'OK' && sub.problem) {
                            solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
                        }
                    }
                }
            } catch (e) {
                console.error(`Error fetching submissions for ${handle}`, e);
            }
        }));

        const unsolvedProblems = allProblems.filter(p => !solvedSet.has(`${p.contestId}-${p.index}`));

        const pickProblems = (min: number, max: number, count: number, coins: number, row: number) => {
            let candidates = unsolvedProblems.filter(p => p.rating >= min && p.rating <= max);

            // Fallback if not enough unsolved problems found
            if (candidates.length < count) {
                const fallbackCandidates = allProblems.filter(p => p.rating >= min && p.rating <= max && solvedSet.has(`${p.contestId}-${p.index}`));
                candidates = [...candidates, ...fallbackCandidates];
            }

            for (let i = candidates.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }

            return candidates.slice(0, count).map((p: any) => ({
                contestId: p.contestId,
                index: p.index,
                name: p.name,
                rating: p.rating,
                points: coins,
                row: row,
                col: 0
            } as ProblemCell));
        };

        levels.forEach((level, idx) => {
            if (!level || level.count === 0) return;
            const poolSize = 30; // Fetch more candidates than needed for rotation possibilities
            // Use level.coins if available, fallback to defaults based on index
            const defaultCoins = idx === 0 ? 2 : idx === 1 ? 3 : idx === 2 ? 4 : 5;
            const coins = level.coins !== undefined ? level.coins : defaultCoins;

            const picked = pickProblems(level.min, level.max, poolSize, coins, idx);
            allProbs.push(...picked);
            marketProblems.push(...picked.slice(0, level.count));
        });

        const players: Record<string, TTRPlayerState> = {};
        const initialCoins = ttrParams.initialCoins !== undefined ? Number(ttrParams.initialCoins) : 0;
        teams.forEach((t: any) => {
            players[t.color] = {
                team: t.color,
                coins: initialCoins,
                trainsLeft: 45,
                stationsLeft: 3,
                score: 0,
                routes: [],
                destinations: []
            };
        });

        if (!ttrParams.mapId) {
            return res.status(400).json({ message: 'Map selection is required' });
        }

        // Initialize collections
        let _tracks: any[] = [];
        let _cities: any[] = [];
        let _tickets: any[] = [];
        let mapData = undefined;

        if (ttrParams.mapId) {
            const map = await prisma.ttrMap.findUnique({
                where: { id: ttrParams.mapId }
            });
            if (!map) {
                return res.status(400).json({ message: 'Map not found' });
            }

            // map.data is Json from Prisma, cast it
            const data = map.data as any; // TtrMapData

            // Normalize tracks from map editor format (cityA/cityB) to logic format (city1/city2)
            // and include units/color
            _tracks = data.tracks.map((t: any) => ({
                id: t.id,
                city1: t.cityA, // Map editor uses cityA
                city2: t.cityB, // Map editor uses cityB
                length: t.length,
                color: t.color,
                double: false, // Map editor currently doesn't seem to flag double routes explicitly in same way, or maybe it does? 
                // Assuming simple track for now or we need to infer double from duplicate city pairs? 
                // For now, take as is.
                units: t.units
            }));

            _cities = data.cities;

            if (data.tickets && data.tickets.length > 0) {
                _tickets = data.tickets.map((t: any) => ({
                    id: t.id,
                    city1: t.cityA || t.city1,
                    city2: t.cityB || t.city2,
                    points: t.points || 0,
                    type: t.type || (t.points >= 20 ? 'long' : 'short') // Fallback if type missing
                }));
            } else {
                _tickets = [];
            }

            mapData = {
                cities: _cities,
                tracks: _tracks,
                imageUrl: data.imageUrl || "",
                width: map.width,
                height: map.height,
                tickets: _tickets
            };
        }

        const tracks: Record<string, TTRTrackState> = {};
        _tracks.forEach(t => {
            tracks[t.id] = {
                id: t.id,
                claimedBy: null
            };
        });

        // Separate tickets
        const longTickets = _tickets.filter(t => t.type === 'long');
        const shortTickets = _tickets.filter(t => t.type !== 'long'); // short or undefined

        // Shuffle helper
        const shuffle = (array: any[]) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        };

        shuffle(longTickets);
        shuffle(shortTickets);

        // Deal tickets to players
        Object.keys(players).forEach(teamColor => {
            const playerDes: string[] = [];

            // Deal 1 long if available
            if (longTickets.length > 0) {
                const t = longTickets.pop();
                playerDes.push(t.id);
            }

            // Deal 3 short if available
            for (let k = 0; k < 3; k++) {
                if (shortTickets.length > 0) {
                    const t = shortTickets.pop();
                    playerDes.push(t.id);
                }
            }
            players[teamColor].destinations = playerDes;
        });

        // Remaining deck (though not used for drawing anymore)
        const ticketDeck = [...longTickets, ...shortTickets].map(t => t.id);
        shuffle(ticketDeck);

        const ttrState: TTRState = {
            players,
            tracks,
            stations: {},
            market: marketProblems,
            allProbs: allProbs,
            ticketDeck,
            mapData
        };

        const match = await prisma.match.create({
            data: {
                startTime: new Date(startTime),
                durationMinutes: Number(ttrParams.gameDurationMinutes),
                mode: 'ttr',
                ttrState: ttrState as any,
                ttrParams: ttrParams as any,
                teams: {
                    create: teams.map((t: any) => ({
                        name: t.name,
                        color: t.color,
                        members: {
                            create: t.members
                                .filter((m: any) => typeof m === 'string' && m.trim() !== '')
                                .map((m: any) => ({ handle: m.trim() }))
                        }
                    }))
                },
                solveLog: { create: [] },
                problems: { create: [] }
            }
        });

        res.status(200).json({ id: match.id });

    } catch (error: any) {
        console.error('Error creating TTR match:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
}

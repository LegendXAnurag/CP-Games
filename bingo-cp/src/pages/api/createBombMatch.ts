import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../app/lib/prisma';
import { fetchAndFilterProblems } from '@/app/lib/problems';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { teams, bombParams, startTime } = req.body;

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

        const allHandles: string[] = [];
        teams.forEach((team: any) => {
            const teamHandles = team.members
                .map((m: any) => typeof m === 'string' ? m.trim() : m?.handle?.trim() || '')
                .filter((m: string) => m !== '');
            allHandles.push(...teamHandles);
        });

        // Pick one initial problem
        const minRating = bombParams.minRating || 800;
        const maxRating = bombParams.maxRating || 1200;

        const selected = await fetchAndFilterProblems({
            userHandles: allHandles,
            minRating: minRating,
            maxRating: maxRating,
            count: 1
        });

        if (!selected || selected.length === 0) {
            return res.status(400).json({ message: 'Could not find any suitable problems for the given ratings and players.' });
        }

        const activeProblem = {
            contestId: selected[0].contestId,
            index: selected[0].index,
            name: selected[0].name,
            rating: selected[0].rating
        };

        const aliveTeams = teams.map((t: any) => t.color);
        const points: Record<string, number> = {};
        teams.forEach((t: any) => {
            points[t.color] = 0;
        });

        // Randomly pick first bomb holder
        const holderTeam = aliveTeams[Math.floor(Math.random() * aliveTeams.length)];

        const bombState = {
            activeProblem,
            holderTeam,
            bombStartTime: new Date(startTime).toISOString(),
            bombStatus: 'ticking', // or 'defused_waiting_pass'
            aliveTeams,
            points
        };

        const match = await prisma.match.create({
            data: {
                startTime: new Date(startTime),
                durationMinutes: Number(bombParams.gameDurationMinutes || 120),
                mode: 'bomb',
                bombState: bombState as any,
                bombParams: bombParams as any,
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
                problems: { 
                    create: [{
                        contestId: activeProblem.contestId,
                        index: activeProblem.index,
                        rating: activeProblem.rating || 0,
                        name: activeProblem.name,
                        position: 0,
                        active: true
                    }]
                }
            }
        });

        res.status(200).json({ id: match.id });

    } catch (error: any) {
        console.error('Error creating Bomb match:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
}

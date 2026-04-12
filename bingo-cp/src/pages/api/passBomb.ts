import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../app/lib/prisma';
import { fetchReplacementProblem } from '@/lib/problemUtils';
import { BombState, BombParams } from '@/app/types/match';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { matchId, targetTeam, secret } = req.body;

        if (!matchId || !targetTeam || !secret) {
            return res.status(400).json({ message: 'Missing parameters' });
        }

        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: {
                teams: { include: { members: true } },
                problems: true
            }
        });

        if (!match || match.mode !== 'bomb' || !match.bombState) {
            return res.status(404).json({ message: 'Match not found or invalid' });
        }

        const state = match.bombState as unknown as BombState;
        const params = match.bombParams as unknown as BombParams;

        if (state.bombStatus !== 'defused_waiting_pass') {
            return res.status(400).json({ message: 'Bomb is not waiting to be passed' });
        }

        // Verify that the person calling is the leader of the holding team
        const holdingTeamObj = match.teams.find((t: any) => t.color === state.holderTeam);
        if (!holdingTeamObj) {
            return res.status(500).json({ message: 'Holder team not found' });
        }

        // The leader is the first member
        const leader = holdingTeamObj.members[0];
        if (leader.secret !== secret) {
            return res.status(403).json({ message: 'Forbidden: only the team leader can pass the bomb' });
        }

        if (!state.aliveTeams.includes(targetTeam)) {
            return res.status(400).json({ message: 'Target team is dead or invalid' });
        }

        // Refresh problem when passed
        const allHandles = match.teams.flatMap((t: any) => t.members).map((m: any) => m.handle);
        const minRating = params.minRating || 800;
        const maxRating = params.maxRating || 1200;
        const usedKeys = match.problems.map(p => `${p.contestId}-${p.index}`);
        
        let newActiveProblem = state.activeProblem;

        try {
            const cand = await fetchReplacementProblem(usedKeys, minRating, maxRating, allHandles);
            if (cand) {
                newActiveProblem = {
                    contestId: cand.contestId,
                    index: cand.index,
                    name: cand.name,
                    rating: cand.rating || 0
                };
                await prisma.$transaction(async (tx: any) => {
                    await tx.problem.updateMany({ where: { matchId: match.id, active: true }, data: { active: false } });
                    await tx.problem.create({
                        data: {
                            contestId: cand.contestId!,
                            index: cand.index!,
                            matchId: match.id,
                            rating: cand.rating || 0,
                            name: cand.name || `Problem`,
                            position: 0,
                            active: true
                        }
                    });
                });
            }
        } catch(err) {
            console.error("Bomb pass problem refresh err", err);
        }

        // Update state
        state.holderTeam = targetTeam;
        state.bombStatus = 'ticking';
        state.bombStartTime = new Date().toISOString();
        state.activeProblem = newActiveProblem;

        await prisma.match.update({
            where: { id: matchId },
            data: { bombState: state as any }
        });

        res.status(200).json({ success: true, bombState: state });

    } catch (error: any) {
        console.error('Error passing bomb:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
}

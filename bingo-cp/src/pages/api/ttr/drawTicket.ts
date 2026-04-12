import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../app/lib/prisma';
import { TTRState } from '../../../app/types/match';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { matchId, team, token } = req.body;

    if (!matchId || !team || !token) {
        return res.status(400).json({ message: 'Missing parameters' });
    }

    try {
        const updatedState = await prisma.$transaction(async (tx) => {
            const member = await tx.member.findFirst({
                where: {
                    secret: token,
                    team: { matchId },
                    claimed: true,
                },
                include: { team: true },
            });

            if (!member || member.team.color !== team) {
                throw new Error('Unauthorized or team mismatch');
            }

            const match = await tx.match.findUnique({
                where: { id: matchId },
                select: { ttrState: true, mode: true }
            });

            if (!match || match.mode !== 'ttr' || !match.ttrState) {
                throw new Error('Invalid match');
            }

            const state = match.ttrState as unknown as TTRState;
            const player = state.players[team];

            if (!player) {
                throw new Error('Player not found');
            }

            if (!state.ticketDeck || state.ticketDeck.length === 0) {
                throw new Error('Deck is empty');
            }

            // Draw 1 ticket
            const ticketId = state.ticketDeck.pop();
            if (ticketId) {
                player.destinations.push(ticketId);
            }

            await tx.match.update({
                where: { id: matchId },
                data: { ttrState: state as any }
            });
            return state;
        });

        res.status(200).json({ success: true, newState: updatedState });
    } catch (error: any) {
        console.error('Error drawing ticket:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
}

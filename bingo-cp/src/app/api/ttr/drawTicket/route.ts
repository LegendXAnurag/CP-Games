import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TTRState } from '@/types/match';

export async function POST(req: NextRequest) {
    

    const { matchId, team, token } = (await req.json());

    if (!matchId || !team || !token) {
        return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
    }

    try {
        const updatedState = await prisma.$transaction(async (tx: any) => {
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

        return NextResponse.json({ success: true, newState: updatedState }, { status: 200 });
    } catch (error: any) {
        console.error('Error drawing ticket:', error);
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

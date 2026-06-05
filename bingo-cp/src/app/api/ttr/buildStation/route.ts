import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildStation } from '@/lib/ttrLogic';
import { TTRState } from '@/types/match';
import { broadcastTtrUpdate } from '@/lib/pusherServer';

export async function POST(req: NextRequest) {
    

    const { matchId, team, trackId, token } = (await req.json());

    if (!matchId || !team || !trackId || !token) {
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

            if (!match) {
                throw new Error('Match not found');
            }
            if (match.mode !== 'ttr' || !match.ttrState) {
                throw new Error('Not a TTR match');
            }

            const ttrState = match.ttrState as unknown as TTRState;
            const newState = buildStation(ttrState, team, trackId);

            if (!newState) {
                throw new Error('Failed to build station (validation failed)');
            }

            await tx.match.update({
                where: { id: matchId },
                data: { ttrState: newState as any }
            });

            return newState;
        });

        // Respond to the requesting player immediately with the new state
        const response = NextResponse.json({ success: true, newState: updatedState }, { status: 200 });

        // Broadcast a compact diff to ALL other clients via Pusher.
        // Clients apply this in-memory — NO /api/ttr/sync round-trip needed.
        const player = updatedState.players[team];
        const trackState = updatedState.tracks[trackId];
        broadcastTtrUpdate(matchId, {
            action: 'buildStation',
            team,
            trackId,
            trackUpdate: trackState,        // { id, claimedBy, stationedBy }
            playerUpdate: {                 // only the changed fields
                coins: player.coins,
                stationsLeft: player.stationsLeft,
            },
        }).catch((err) => {
            console.error('[Pusher] Failed to broadcast ttr-update after buildStation:', err);
        });
        return response;

    } catch (error: any) {
        console.error('Error in buildStation:', error);
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

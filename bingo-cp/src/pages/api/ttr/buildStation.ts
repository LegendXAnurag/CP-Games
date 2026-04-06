import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/app/lib/prisma';
import { buildStation } from '@/lib/ttrLogic';
import { TTRState } from '@/app/types/match';
import { broadcastTtrUpdate } from '@/lib/pusherServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { matchId, team, trackId } = req.body;

    if (!matchId || !team || !trackId) {
        return res.status(400).json({ message: 'Missing parameters' });
    }

    try {
        const updatedState = await prisma.$transaction(async (tx) => {
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
        res.status(200).json({ success: true, newState: updatedState });

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

    } catch (error: any) {
        console.error('Error in buildStation:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
}

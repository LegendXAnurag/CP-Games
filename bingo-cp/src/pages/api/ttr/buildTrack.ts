import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/app/lib/prisma';
import { buildTrack } from '@/lib/ttrLogic';
import { TTRState } from '@/app/types/match';
import { broadcastTtrUpdate } from '@/lib/pusherServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { matchId, team, trackId, token } = req.body;

    if (!matchId || !team || !trackId || !token) {
        return res.status(400).json({ message: 'Missing parameters' });
    }

    try {
        let newState: TTRState | null = null;

        await prisma.$transaction(async (tx) => {
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
            newState = buildTrack(ttrState, team, trackId);

            if (!newState) {
                if (ttrState.tracks && ttrState.tracks[trackId] && ttrState.tracks[trackId].claimedBy) {
                    throw new Error('Track already occupied by someone else');
                }
                throw new Error('Failed to build track (validation failed)');
            }

            if (newState.players[team].trainsLeft < 3 && !newState.finalLapEndTime) {
                newState.finalLapEndTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();
            }

            await tx.match.update({
                where: { id: matchId },
                data: { ttrState: newState as any }
            });
        });

        // Respond to the requesting player immediately with the new state
        res.status(200).json({ success: true, newState });

        // Broadcast a compact diff to ALL other clients via Pusher.
        // Clients apply this in-memory — NO /api/ttr/sync round-trip needed.
        if (newState) {
            const player = (newState as TTRState).players[team];
            const trackState = (newState as TTRState).tracks[trackId];
            broadcastTtrUpdate(matchId, {
                action: 'buildTrack',
                team,
                trackId,
                trackUpdate: trackState,        // { id, claimedBy }
                playerUpdate: {                 // only the changed fields
                    coins: player.coins,
                    trainsLeft: player.trainsLeft,
                    score: player.score,
                    routes: player.routes,
                },
                finalLapEndTime: (newState as TTRState).finalLapEndTime,
            }).catch((err) => {
                console.error('[Pusher] Failed to broadcast ttr-update after buildTrack:', err);
            });
        }

    } catch (error: any) {
        console.error('Error in buildTrack:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
}

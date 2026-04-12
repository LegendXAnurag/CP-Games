import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from "@/app/lib/prisma";
import { broadcastTtrUpdate } from '@/lib/pusherServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { matchId, token, discardedIds } = req.body;

    if (!matchId || !token || !Array.isArray(discardedIds)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const member = await prisma.member.findFirst({
            where: {
                secret: token,
                team: { matchId },
                claimed: true,
            },
            include: { team: true },
        });

        if (!member) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const match = await prisma.match.findUnique({
            where: { id: matchId },
        });

        if (!match || !match.ttrState) {
            return res.status(404).json({ error: 'Match not found' });
        }

        const state = match.ttrState as any;
        const playerTeam = member.team.color;
        const player = state.players[playerTeam];

        if (!player || !player.pendingDestinations) {
            return res.status(400).json({ error: 'Not in selection phase' });
        }

        // Validate discardedIds are a subset of pending
        const pendingSet = new Set(player.pendingDestinations);
        if (!discardedIds.every(id => pendingSet.has(id))) {
            return res.status(400).json({ error: 'Invalid discarded tickets' });
        }

        player.pendingDiscarded = discardedIds;

        await prisma.match.update({
            where: { id: matchId },
            data: { ttrState: state },
        });

        // Broadcast to other members of the same team if they are online
        await broadcastTtrUpdate(matchId, { action: 'draftUpdated', team: playerTeam, discardedIds });

        return res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('Update draft error:', error);
        return res.status(500).json({ error: error.message || 'Internal Error' });
    }
}

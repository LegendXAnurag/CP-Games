import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from "@/app/lib/prisma";
import { broadcastTtrUpdate } from '@/lib/pusherServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { matchId, token, selectedIds } = req.body;

    if (!matchId || !token || !Array.isArray(selectedIds)) {
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

        // Leader Check: Only the first member of the team can select
        const teamMembers = await prisma.member.findMany({
            where: { teamId: member.team.id },
            orderBy: { id: 'asc' },
        });
        if (teamMembers[0]?.handle !== member.handle) {
            return res.status(403).json({ error: 'Only the team leader can select tickets' });
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

        if (!player) {
            return res.status(404).json({ error: 'Player state not found' });
        }

        if (!player.pendingDestinations || player.pendingDestinations.length === 0) {
            return res.status(400).json({ error: 'No pending tickets to select' });
        }

        // Validate selection: must be a subset of pending, and at least 3
        const pendingSet = new Set(player.pendingDestinations);
        const validSelection = selectedIds.every(id => pendingSet.has(id));

        if (!validSelection) {
            return res.status(400).json({ error: 'Invalid ticket selection' });
        }

        const totalCount = (player.destinations?.length || 0) + selectedIds.length;
        if (totalCount < 3) {
            return res.status(400).json({ error: 'Must select at least 3 tickets total (including mandatory long route)' });
        }

        // Move selected to destinations, clear pending
        player.destinations = [...(player.destinations || []), ...selectedIds];
        delete player.pendingDestinations;

        await prisma.match.update({
            where: { id: matchId },
            data: { ttrState: state },
        });

        // Broadcast update
        try {
            await broadcastTtrUpdate(matchId, { action: 'ticketsSelected', team: playerTeam });
        } catch (pusherErr) {
            console.error('Pusher broadcast failed (non-fatal):', pusherErr);
        }

        return res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('Select tickets error:', {
            message: error.message,
            stack: error.stack,
            matchId,
            token: token?.substring(0, 8) + '...'
        });
        return res.status(500).json({ error: `Server Error: ${error.message || 'Unknown'}` });
    }
}

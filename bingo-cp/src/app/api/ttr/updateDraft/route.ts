import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { broadcastTtrUpdate } from '@/lib/pusherServer';

export async function POST(req: NextRequest) {
    

    const { matchId, token, discardedIds } = (await req.json());

    if (!matchId || !token || !Array.isArray(discardedIds)) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const match = await prisma.match.findUnique({
            where: { id: matchId },
        });

        if (!match || !match.ttrState) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        const state = match.ttrState as any;
        const playerTeam = member.team.color;
        const player = state.players[playerTeam];

        if (!player || !player.pendingDestinations) {
            return NextResponse.json({ error: 'Not in selection phase' }, { status: 400 });
        }

        // Validate discardedIds are a subset of pending
        const pendingSet = new Set(player.pendingDestinations);
        if (!discardedIds.every(id => pendingSet.has(id))) {
            return NextResponse.json({ error: 'Invalid discarded tickets' }, { status: 400 });
        }

        // Enforce the 3 tickets minimum rule
        const totalCount = (player.destinations?.length || 0) + player.pendingDestinations.length - discardedIds.length;
        if (totalCount < 3) {
            return NextResponse.json({ error: 'Must keep at least 3 tickets total' }, { status: 400 });
        }

        // Permanently remove discarded from pendingDestinations
        player.pendingDestinations = player.pendingDestinations.filter((id: string) => !discardedIds.includes(id));
        player.pendingDiscarded = [];

        await prisma.match.update({
            where: { id: matchId },
            data: { ttrState: state },
        });

        // Broadcast to other members of the same team if they are online
        try {
            await broadcastTtrUpdate(matchId, { action: 'draftUpdated', team: playerTeam, discardedIds });
        } catch (pusherErr) {
            console.error('Pusher broadcast failed (non-fatal):', pusherErr);
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: any) {
        console.error('Update draft error:', {
            message: error.message,
            stack: error.stack,
            matchId
        });
        return NextResponse.json({ error: `Server Error: ${error.message || 'Unknown'}` }, { status: 500 });
    }
}

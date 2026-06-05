import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { broadcastTtrUpdate } from '@/lib/pusherServer';

export async function POST(req: NextRequest) {
    

    const { matchId, token, selectedIds } = (await req.json());

    if (!matchId || !token || !Array.isArray(selectedIds)) {
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

        // Leader Check: Only the first member of the team can select
        const teamMembers = await prisma.member.findMany({
            where: { teamId: member.team.id },
            orderBy: { id: 'asc' },
        });
        if (teamMembers[0]?.handle !== member.handle) {
            return NextResponse.json({ error: 'Only the team leader can select tickets' }, { status: 403 });
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

        if (!player) {
            return NextResponse.json({ error: 'Player state not found' }, { status: 404 });
        }

        if (!player.pendingDestinations || player.pendingDestinations.length === 0) {
            return NextResponse.json({ error: 'No pending tickets to select' }, { status: 400 });
        }

        // Validate selection: must be a subset of pending, and at least 3
        const pendingSet = new Set(player.pendingDestinations);
        const validSelection = selectedIds.every(id => pendingSet.has(id));

        if (!validSelection) {
            return NextResponse.json({ error: 'Invalid ticket selection' }, { status: 400 });
        }

        const totalCount = (player.destinations?.length || 0) + selectedIds.length;
        if (totalCount < 3) {
            return NextResponse.json({ error: 'Must select at least 3 tickets total (including mandatory long route, { status: 400 })' });
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

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: any) {
        console.error('Select tickets error:', {
            message: error.message,
            stack: error.stack,
            matchId,
            token: token?.substring(0, 8) + '...'
        });
        return NextResponse.json({ error: `Server Error: ${error.message || 'Unknown'}` }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    

    const { matchId, memberId } = (await req.json());

    if (!matchId || !memberId) {
        return NextResponse.json({ error: 'Missing matchId or memberId' }, { status: 400 });
    }

    try {
        // 1. Transaction to atomically claim the member
        const result = await prisma.$transaction(async (tx: any) => {
            // Check if member exists and matches the match
            const member = await tx.member.findUnique({
                where: { id: memberId },
                include: { team: true }, // to verify matchId
            });

            if (!member) {
                throw new Error('Member not found');
            }

            if (member.team.matchId !== matchId) {
                throw new Error('Member does not belong to this match');
            }

            if (member.claimed) {
                throw new Error('This player has already been claimed by someone else.');
            }

            // Generate a secret token
            const secret = crypto.randomBytes(32).toString('hex');

            // Update the member
            const updated = await tx.member.update({
                where: { id: memberId },
                data: {
                    claimed: true,
                    secret: secret,
                },
            });

            return {
                member: updated,
                team: member.team,
                token: secret // Simple token for now (just the secret)
            };
        });

        // 2. Return the token
        return NextResponse.json({
            success: true,
            token: result.token,
            member: {
                id: result.member.id,
                handle: result.member.handle,
                teamId: result.team.id,
                teamColor: result.team.color,
            }
        }, { status: 200 });

    } catch (error: any) {
        console.error("Join error:", error);
        return NextResponse.json({ error: error.message || 'Failed to join match' }, { status: 400 });
    }
}

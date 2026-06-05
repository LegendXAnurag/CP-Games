import { NextRequest, NextResponse } from 'next/server';
// pages/api/match/set-duration.ts
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { matchId, durationMinutes } = (await req.json()) as { matchId?: string; durationMinutes?: number };

    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });
    if (typeof durationMinutes !== 'number' || durationMinutes < 0) {
      return NextResponse.json({ error: 'durationMinutes must be a non-negative number' }, { status: 400 });
    }
    const updated = await prisma.match.update({
      where: { id: matchId },
      data: { durationMinutes: durationMinutes },
    });

    return NextResponse.json({ ok: true, match: updated }, { status: 200 });
  } catch (err) {
    console.error('API set-duration error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

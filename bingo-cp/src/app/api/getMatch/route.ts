import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function getServerMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      problems: { where: { active: true }, orderBy: { position: 'asc' } },
      solveLog: {
        include: {
          problem: true
        }
      },
      teams: {
        include: {
          members: true
        }
      },
    }
  });
}

export async function POST(req: NextRequest) {
  const { matchId } = Object.fromEntries(req.nextUrl.searchParams);
  if (!matchId || typeof matchId !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid matchId' }, { status: 400 });
  }

  const match = await getServerMatch(matchId);
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  return NextResponse.json({ match }, { status: 200 });
}

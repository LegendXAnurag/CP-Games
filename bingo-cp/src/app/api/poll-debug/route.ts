import { NextRequest, NextResponse } from 'next/server';

export function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get('matchId');

  if (matchId) {
    console.log("Poll-submissions logic executed for match ID:", matchId);
  } else {
    console.log("Poll-submissions logic executed (no match ID provided)");
  }

  return NextResponse.json({ ok: true, matchId: matchId ?? null });
}

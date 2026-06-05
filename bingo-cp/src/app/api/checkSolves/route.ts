import { NextRequest, NextResponse } from 'next/server';
// pages/api/checkSolves.ts
import { checkSolvesLogic, Problem, Player } from '@/lib/checkSolvesLogic'

export async function POST(req: NextRequest) {
  

  const { problems, players } = (await req.json()) as {
    problems: Problem[]
    players: Player[]
  }

  try {
    const claims = await checkSolvesLogic(problems, players)
    return NextResponse.json({ claims }, { status: 200 })
  } catch (err) {
    console.error('Error in checkSolves API:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

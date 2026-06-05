import { NextRequest, NextResponse } from 'next/server';
import { fetchAndFilterProblems, type Problem } from '@/lib/problems'

export async function POST(req: NextRequest) {
  
  const {
    minRating = 800,
    maxRating = 3500,
    userHandles = [],
    count = 25,
    exclude = [],
  } = (await req.json())

  try {
    const problems = await fetchAndFilterProblems({
      minRating,
      maxRating,
      userHandles,
      count,
      exclude,
    });
    return NextResponse.json({ problems }, { status: 200 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

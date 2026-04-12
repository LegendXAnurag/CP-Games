import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from "@/app/lib/prisma";
import { buildEnrichedSolveLog } from '@/lib/enrichSolveLog';

/**
 * POST /api/ttr/sync
 *
 * Pure game-state read — no Codeforces polling.
 * Returns masked TTR state fast (~50ms, just a DB read).
 * CF submission checking is handled separately by /api/ttr/checkSolves.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { matchId, token } = req.body;

    if (!matchId) {
        return res.status(400).json({ error: 'Missing matchId' });
    }

    try {
        // Resolve the authenticated member if a token was supplied (needed for masking)
        let authenticatedMember: { team: { color: string } } | null = null;
        if (token) {
            const member = await prisma.member.findFirst({
                where: {
                    secret: token,
                    team: { matchId },
                    claimed: true,
                },
                include: { team: true },
            });
            if (member) {
                authenticatedMember = member;
            }
        }

        // Fetch match state
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: {
                teams: {
                    include: { members: { select: { id: true, handle: true, claimed: true, teamId: true } } },
                },
                solveLog: { include: { problem: true }, orderBy: { timestamp: 'desc' } },
                problems: { where: { active: true } },
            },
        });

        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        // Mask sensitive TTR state
        let safeTtrState: any = match.ttrState;
        if (safeTtrState) {
            const state = JSON.parse(JSON.stringify(safeTtrState));
            const myTeamColor = authenticatedMember?.team.color;

            // Hide hands and tickets of other teams
            if (state.players) {
                Object.keys(state.players).forEach(teamColor => {
                    if (teamColor !== myTeamColor) {
                        if (state.players[teamColor].hand) {
                            state.players[teamColor].handCount = state.players[teamColor].hand.length;
                            delete state.players[teamColor].hand;
                        }
                        if (state.players[teamColor].tickets) {
                            state.players[teamColor].ticketsCount = state.players[teamColor].tickets.length;
                            delete state.players[teamColor].tickets;
                        }
                    }
                });
            }

            // Hide deck (show count only)
            if (state.deck) {
                state.deckCount = state.deck.length;
                delete state.deck;
            }

            state.solveLog = buildEnrichedSolveLog(match.solveLog, state, match.ttrParams);

            safeTtrState = state;
        }

        return res.status(200).json({
            match: {
                ...match,
                ttrState: safeTtrState
            }
        });

    } catch (error: any) {
        console.error('Sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Error' });
    }
}

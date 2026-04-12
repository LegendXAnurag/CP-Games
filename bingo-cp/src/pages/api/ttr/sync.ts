import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from "@/app/lib/prisma";
import { buildEnrichedSolveLog } from '@/lib/enrichSolveLog';
import { broadcastTtrUpdate } from '@/lib/pusherServer';

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

        // Auto-commit selection after 5 minutes
        if (match.mode === 'ttr' && match.ttrState) {
            const state = match.ttrState as any;
            const gameStartedAt = new Date(match.startTime).getTime();
            const fiveMinutesMs = 5 * 60 * 1000;
            const isSelectionTimedOut = Date.now() - gameStartedAt > fiveMinutesMs;

            let stateModified = false;
            if (isSelectionTimedOut && state.players) {
                Object.keys(state.players).forEach(teamColor => {
                    const p = state.players[teamColor];
                    if (p.pendingDestinations && p.pendingDestinations.length > 0) {
                        console.log(`[sync] Auto-committing tickets for ${teamColor} due to timeout`);

                        const discarded = p.pendingDiscarded || [];
                        let kept = p.pendingDestinations.filter((id: string) => !discarded.includes(id));

                        // Enforce 3-route minimum total
                        let total = (p.destinations?.length || 0) + kept.length;
                        if (total < 3) {
                            // Need to pull some back from discarded
                            for (const id of discarded) {
                                if (total >= 3) break;
                                kept.push(id);
                                total++;
                            }
                        }

                        p.destinations = [...(p.destinations || []), ...kept];
                        delete p.pendingDestinations;
                        delete p.pendingDiscarded;
                        stateModified = true;
                    }
                });
            }

            if (stateModified) {
                const updatedMatch = await prisma.match.update({
                    where: { id: matchId },
                    data: { ttrState: state },
                    include: {
                        teams: {
                            include: { members: { select: { id: true, handle: true, claimed: true, teamId: true } } },
                        },
                        solveLog: { include: { problem: true }, orderBy: { timestamp: 'desc' } },
                        problems: { where: { active: true } },
                    },
                });
                try {
                    await broadcastTtrUpdate(matchId, { action: 'ticketsAutoCommitted' });
                } catch (pusherErr) {
                    console.error('Pusher broadcast failed (non-fatal):', pusherErr);
                }
                // Use the updated match for the rest of the handler
                Object.assign(match, updatedMatch);
            }
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
                        // Unmasked: destinations is now public
                        if (state.players[teamColor].pendingDestinations) {
                            state.players[teamColor].pendingDestinationsCount = state.players[teamColor].pendingDestinations.length;
                            delete state.players[teamColor].pendingDestinations;
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
        console.error('Sync error:', {
            message: error.message,
            stack: error.stack,
            matchId
        });
        return res.status(500).json({ error: `Server Error: ${error.message || 'Unknown'}` });
    }
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Match, TTRState, Ticket } from "@/app/types/match";
import TTRMap from "@/components/TTRMap";
import CoinMarketplace from "@/components/CoinMarketplace";
import { calculateTotalScore, getCompletedRoute } from "../../lib/ttrLogic";
import { TICKETS, CITIES } from "../../lib/ttrData";
import { AuthProvider, useTtrAuth } from "../ttr/AuthContext";
import JoinScreen from "../ttr/JoinScreen";
import { TrainFront, MapPin, CheckCircle2, Ticket as TicketIcon, Clock } from "lucide-react";
import { getPusherClient } from "@/lib/pusherClient";
import { motion } from "framer-motion";

interface TTRGameDisplayProps {
    match: Match;
    currentTeam: string;
    setCurrentTeam: (team: string) => void;
    hasStarted?: boolean;
}

const COLOR_HEX: Record<string, string> = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
    purple: '#a855f7', orange: '#f97316', pink: '#db2777',
    yellow: '#eab308', teal: '#14b8a6', brown: '#8B4513',
};

function formatTime(ms: number): string {
    if (ms <= 0) return "00:00:00";
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
}

interface SolveEntry {
    team: string;
    handle: string;
    problemName: string;
    coinsAwarded?: number;
    timestamp: string;
}

function TTRGameContent({ match, currentTeam, setCurrentTeam, hasStarted = false }: TTRGameDisplayProps) {
    const { user, isSpectator, isLoading } = useTtrAuth();
    const [ttrState, setTtrState] = useState<TTRState | null>(match.ttrState as unknown as TTRState);
    const [lastSync, setLastSync] = useState<Date>(new Date());
    const [solveLog, setSolveLog] = useState<SolveEntry[]>([]);
    const [now, setNow] = useState(new Date());
    const [focusedTicket, setFocusedTicketRaw] = useState<Ticket | null>(null);
    // Tracks whether the user has manually overridden the focus (so auto-focus doesn't fight them)
    const userClearedFocusRef = useRef<boolean>(false);
    const [showPenalties, setShowPenalties] = useState(false);

    const [showFinalLapPopup, setShowFinalLapPopup] = useState(false);
    const prevFinalLapRef = useRef(ttrState?.finalLapEndTime);

    // Ticket selection state
    const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
    const [discardedPendingIds, setDiscardedPendingIds] = useState<string[]>([]);
    const [isSubmittingTickets, setIsSubmittingTickets] = useState(false);

    const currentTeamObj = match.teams.find(t => t.color === currentTeam);
    const isLeader = currentTeamObj?.members[0]?.handle === user?.handle;

    useEffect(() => {
        if (!prevFinalLapRef.current && ttrState?.finalLapEndTime) {
            setShowFinalLapPopup(true);
            setTimeout(() => {
                setShowFinalLapPopup(false);
            }, 6000); // Hide after 6 seconds
        }
        prevFinalLapRef.current = ttrState?.finalLapEndTime;
    }, [ttrState?.finalLapEndTime]);

    // Wrapper so user clicks mark the ref
    const setFocusedTicket = (t: Ticket | null) => {
        userClearedFocusRef.current = (t === null); // user explicitly cleared
        setFocusedTicketRaw(t);
    };

    // Clock tick
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    // Auto-highlight completed routes — only when user hasn't manually cleared focus
    useEffect(() => {
        if (!ttrState || !currentTeam) return;
        if (userClearedFocusRef.current) return; // respect user's choice
        const player = ttrState.players[currentTeam];
        if (!player) return;

        const allTickets = (player.destinations || []).map((id: string) => {
            if (ttrState.mapData?.tickets) return ttrState.mapData.tickets.find(t => t.id === id);
            return TICKETS.find(t => t.id === id);
        }).filter(Boolean) as Ticket[];

        const completedTickets = allTickets.filter(t =>
            getCompletedRoute(ttrState, currentTeam, t.city1, t.city2) !== null
        );

        // Keep the current focus if it's still a valid completed ticket
        if (focusedTicket && completedTickets.some(t => t.id === focusedTicket.id)) return;

        // Auto-focus the first completed ticket only (don't clear if none)
        if (completedTickets.length > 0) {
            setFocusedTicketRaw(completedTickets[0]);

            const timer = setTimeout(() => {
                if (!userClearedFocusRef.current) {
                    setFocusedTicketRaw(null);
                }
            }, 4000);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ttrState, currentTeam]);



    useEffect(() => {
        if (user) setCurrentTeam(user.teamColor);
    }, [user, setCurrentTeam]);

    // ── Core sync function — fetches fresh state from the DB ──────────────────
    const syncState = useCallback(async () => {
        try {
            const body: Record<string, string> = { matchId: match.id };
            if (user?.token) body.token = user.token;

            const res = await fetch('/api/ttr/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.match?.ttrState) {
                    const state = data.match.ttrState as TTRState;
                    setTtrState(state);
                    setLastSync(new Date());
                    if (Array.isArray((state as any).solveLog)) {
                        setSolveLog((state as any).solveLog);
                    }
                }
            }
        } catch (e) {
            console.error('State sync failed:', e);
        }
    }, [match.id, user]);

    // ─── Compute timer ─────────────────────────────────────────────────────
    const matchStart = new Date(match.startTime);
    let matchEnd = new Date(matchStart.getTime() + match.durationMinutes * 60 * 1000);

    if (ttrState?.finalLapEndTime) {
        const finalLapEnd = new Date(ttrState.finalLapEndTime);
        if (finalLapEnd < matchEnd) {
            matchEnd = finalLapEnd;
        }
    }

    const msLeft = matchEnd.getTime() - now.getTime();
    const isMatchEnded = msLeft <= 0;

    useEffect(() => {
        if (isMatchEnded && !showPenalties) {
            const timer = setTimeout(() => setShowPenalties(true), 3000);
            return () => clearTimeout(timer);
        }
    }, [isMatchEnded, showPenalties]);

    // ── Fallback polling (every 10s) — safety net for reconnects / missed events
    useEffect(() => {
        if (isLoading || isMatchEnded) return;
        syncState(); // immediate on mount
        const syncInterval = setInterval(syncState, 10000);
        return () => clearInterval(syncInterval);
    }, [isLoading, syncState, isMatchEnded]);

    // ── Pusher WebSocket — instant in-memory update, zero DB round-trip ──────
    useEffect(() => {
        if (isLoading) return;

        const pusher = getPusherClient();
        const channel = pusher.subscribe(`match-${match.id}`);

        channel.bind('ttr-update', (data: any) => {
            if (data?.action === 'buildTrack' && data.trackId && data.team) {
                // Apply track claim diff directly — no network call needed
                setTtrState(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        finalLapEndTime: data.finalLapEndTime !== undefined ? data.finalLapEndTime : prev.finalLapEndTime,
                        tracks: {
                            ...prev.tracks,
                            [data.trackId]: {
                                ...(prev.tracks[data.trackId] || {}),
                                ...data.trackUpdate,
                            },
                        },
                        players: {
                            ...prev.players,
                            [data.team]: {
                                ...prev.players[data.team],
                                ...data.playerUpdate,
                            },
                        },
                    };
                });

            } else if (data?.action === 'buildStation' && data.trackId && data.team) {
                // Apply station build diff directly
                setTtrState(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        tracks: {
                            ...prev.tracks,
                            [data.trackId]: {
                                ...(prev.tracks[data.trackId] || {}),
                                ...data.trackUpdate,
                            },
                        },
                        players: {
                            ...prev.players,
                            [data.team]: {
                                ...prev.players[data.team],
                                ...data.playerUpdate,
                            },
                        },
                    };
                });

            } else {
                // coinsAwarded / unknown action — do a real sync to pick up market/coin changes
                syncState();
            }
        });

        return () => {
            channel.unbind('ttr-update');
            pusher.unsubscribe(`match-${match.id}`);
        };
    }, [match.id, isLoading, syncState]);

    const handleSelectTickets = async () => {
        const pool = ttrState?.players[currentTeam]?.pendingDestinations || [];
        const keptIds = pool.filter(id => !discardedPendingIds.includes(id));
        const totalCount = (ttrState?.players[currentTeam]?.destinations?.length || 0) + keptIds.length;

        if (totalCount < 3) return;

        setIsSubmittingTickets(true);
        try {
            const res = await fetch('/api/ttr/selectTickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: match.id,
                    token: user?.token,
                    selectedIds: keptIds
                }),
            });
            if (res.ok) {
                syncState();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to select tickets');
            }
        } catch (err) {
            console.error('Error selecting tickets:', err);
        } finally {
            setIsSubmittingTickets(false);
        }
    };

    const updateRemoteDraft = async (discardedIds: string[]) => {
        if (!user?.token || !isLeader) return;
        try {
            await fetch('/api/ttr/updateDraft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: match.id,
                    token: user.token,
                    discardedIds
                }),
            });
        } catch (err) {
            console.error('Failed to sync draft:', err);
        }
    };

    // Keep local state in sync with server draft (if user refreshes)
    useEffect(() => {
        const player = ttrState?.players[currentTeam];
        if (player?.pendingDiscarded) {
            setDiscardedPendingIds(player.pendingDiscarded);
            // Also ensure selected reflects what's NOT discarded
            if (player.pendingDestinations) {
                const autoSelected = player.pendingDestinations.filter(id => !player.pendingDiscarded!.includes(id));
                setSelectedPendingIds(autoSelected);
            }
        }
    }, [ttrState?.players, currentTeam]);

    // ── Slow CF solve check (every 65s) — runs Codeforces API fetch ───────────
    useEffect(() => {
        if (isLoading || !user?.token || isMatchEnded) return; // spectators, unauthenticated, or if match ended

        const checkSolves = async () => {
            try {
                await fetch('/api/ttr/checkSolves', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ matchId: match.id, token: user.token }),
                });
                // No need to process the response here — the next syncState() call
                // will pick up any newly awarded coins from the DB.
            } catch (e) {
                console.error('Solve check failed:', e);
            }
        };

        checkSolves(); // run once on mount
        const pollInterval = Number(process.env.NEXT_PUBLIC_CF_POLL_INTERVAL_MS) || 15000;
        const checkInterval = setInterval(checkSolves, pollInterval);
        return () => clearInterval(checkInterval);
    }, [match.id, user, isLoading, isMatchEnded]);

    const handleStateUpdate = (newState: TTRState) => setTtrState(newState);

    // ── Loading state ──────────────────────────────────
    if (isLoading) return (
        <div className="flex items-center justify-center min-h-screen bg-[#050505]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-t-transparent border-[#00f0ff] animate-spin" />
                <p className="text-[#00f0ff] font-mono text-sm tracking-widest uppercase animate-pulse">Loading...</p>
            </div>
        </div>
    );

    // ── Join screen ──────────────────────────────────
    if (!user && !isSpectator) {
        const teamsData = match.teams.map((t: any) => ({
            id: t.id, name: t.name, color: t.color,
            members: t.members.map((m: any) => ({ id: m.id, handle: m.handle, claimed: m.claimed ?? false }))
        }));
        return <JoinScreen matchId={match.id} teams={teamsData} />;
    }

    // ── Pre-game lobby ──────────────────────────────
    if (!hasStarted) {
        const matchStart = new Date(match.startTime);
        const countdown = formatTime(matchStart.getTime() - now.getTime());

        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] gap-8 p-6 relative overflow-hidden">
                {/* Grid background */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                    style={{ backgroundImage: 'linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
                <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

                <div className="relative z-10 text-center space-y-3">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 text-xs font-mono tracking-widest uppercase font-mono">Ticket to Ride</span>
                    </div>
                    <h2 className="text-5xl font-black tracking-tight text-white font-heading">Waiting for Start</h2>
                    <p className="text-[#a3a3a3] font-body">The train is boarding — get ready.</p>

                    {/* Countdown */}
                    <div className="mt-6 px-8 py-4 rounded-2xl" style={{ background: 'rgba(10,10,10,0.9)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <p className="text-[9px] uppercase tracking-widest text-[#a3a3a3] font-heading mb-1">Match starts in</p>
                        <span className="text-4xl font-mono text-emerald-400 font-mono">{countdown}</span>
                    </div>
                </div>

                {user && (
                    <div className="relative z-10 rounded-2xl p-px overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${user.teamColor}50, transparent, ${user.teamColor}20)` }}>
                        <div className="bg-[#0a0a0a] rounded-2xl p-8 text-center space-y-3 min-w-[280px]">
                            <p className="text-xs font-bold uppercase tracking-widest text-[#a3a3a3] font-heading">You are playing as</p>
                            <div className="text-3xl font-black font-heading" style={{ color: user.teamColor }}>{user.handle}</div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold font-heading"
                                style={{ background: `${user.teamColor}20`, color: user.teamColor, border: `1px solid ${user.teamColor}40` }}>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: user.teamColor }} />
                                {user.teamColor} Team
                            </div>
                        </div>
                    </div>
                )}

                {isSpectator && (
                    <div className="relative z-10 rounded-xl p-4 font-semibold flex items-center gap-3 font-body"
                        style={{ background: 'rgba(112,0,255,0.1)', border: '1px solid rgba(112,0,255,0.3)', color: '#a87fff' }}>
                        <span className="text-lg">◉</span>
                        You are in Spectator Mode. Sit tight!
                    </div>
                )}
            </div>
        );
    }

    // ── Error: no state ──────────────────────────────
    if (!ttrState) return (
        <div className="flex items-center justify-center min-h-screen bg-[#050505]">
            <p className="text-red-400 font-mono">Error: TTR State not found. (Mode: {match.mode})</p>
        </div>
    );

    const timerColor = isMatchEnded ? '#ef4444' : msLeft < 5 * 60 * 1000 ? '#ef4444' : '#00f0ff';

    // ─── Scorecard — sort by score descending ──────────────────────────────
    const allTickets = ttrState.mapData?.tickets || TICKETS;
    const players = Object.values(ttrState.players).map(p => {
        const baseScore = calculateTotalScore(ttrState, p.team);
        let penalty = 0;

        for (const ticketId of (p.destinations || [])) {
            if (ticketId === 'optimistic_draw') continue;
            const ticket = allTickets.find(t => t.id === ticketId);
            if (ticket) {
                const completed = getCompletedRoute(ttrState, p.team, ticket.city1, ticket.city2);
                if (!completed) {
                    penalty += ticket.points;
                }
            }
        }

        const finalScore = baseScore - penalty;
        const displayScore = showPenalties ? finalScore : baseScore;

        return {
            ...p,
            baseScore,
            penalty,
            finalScore,
            displayScore
        };
    }).sort((a: any, b: any) => b.displayScore - a.displayScore);

    const player = ttrState.players[currentTeam];
    const confirmedTickets = player ? (player.destinations || []).map((id: string) => {
        if (ttrState.mapData?.tickets) return ttrState.mapData.tickets.find(t => t.id === id);
        return TICKETS.find(t => t.id === id);
    }).filter(Boolean) as Ticket[] : [];

    const pendingPool = player ? (player.pendingDestinations || []).filter(id => !discardedPendingIds.includes(id)).map((id: string) => {
        if (ttrState.mapData?.tickets) return ttrState.mapData.tickets.find(t => t.id === id);
        return TICKETS.find(t => t.id === id);
    }).filter(Boolean) as Ticket[] : [];


    return (
        <div className="flex flex-col bg-[#050505] h-full overflow-y-auto w-full">

            {/* ╔══════════════════════════════════════════════
                    HEADER ROW — 56px
                ══════════════════════════════════════════════╗ */}
            <div
                className="flex items-center justify-between px-6 gap-3 shrink-0"
                style={{
                    height: '64px',
                    background: 'rgba(5,5,5,0.96)',
                    borderBottom: '1px solid rgba(0,240,255,0.08)',
                    backdropFilter: 'blur(12px)',
                }}
            >
                {/* Left: Game badge */}
                <div className="flex items-center gap-2 shrink-0">
                    <TrainFront className="w-4 h-4 text-emerald-400" />
                    <span
                        className="text-sm font-black uppercase tracking-widest font-heading"
                        style={{ color: '#10b981' }}
                    >
                        Ticket to Ride
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
                </div>

                {/* Center: Timer */}
                <div className="flex-1 flex justify-center items-center">
                    <span
                        className="text-3xl font-mono font-black tabular-nums tracking-widest font-mono"
                        style={{ color: timerColor, textShadow: `0 0 20px ${timerColor}60` }}
                    >
                        {isMatchEnded ? "ENDED" : formatTime(msLeft)}
                    </span>
                    {ttrState.finalLapEndTime && !isMatchEnded && (
                        <span className="ml-3 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase animate-pulse border border-red-500/50 bg-red-500/10 text-red-400 font-heading">
                            Final Lap!
                        </span>
                    )}
                </div>

                {/* Right: Identity + sync */}
                <div className="flex items-center gap-3 shrink-0">
                    {user && (
                        <div
                            className="flex items-center gap-2.5 px-4 py-1.5 rounded-full text-sm font-bold font-heading shadow-sm"
                            style={{
                                background: `${COLOR_HEX[user.teamColor] ?? user.teamColor}18`,
                                border: `1px solid ${COLOR_HEX[user.teamColor] ?? user.teamColor}40`,
                                color: COLOR_HEX[user.teamColor] ?? user.teamColor,
                            }}
                        >
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: COLOR_HEX[user.teamColor] ?? user.teamColor }} />
                            <span className="truncate max-w-[150px]">{user.handle}</span>
                            <span className="text-white/40 font-black">·</span>
                            <span className="capitalize">{user.teamColor}</span>
                        </div>
                    )}
                    {isSpectator && (
                        <div
                            className="px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest font-heading shadow-sm"
                            style={{ background: 'rgba(112,0,255,0.15)', border: '1px solid rgba(112,0,255,0.35)', color: '#a87fff' }}
                        >
                            Spectator
                        </div>
                    )}
                    {isSpectator && (
                        <select
                            value={currentTeam}
                            onChange={(e) => setCurrentTeam(e.target.value)}
                            className="text-sm rounded-lg px-3 py-1.5 cursor-pointer font-bold font-heading shadow-sm"
                            style={{ background: 'rgba(10,10,10,0.9)', border: '1px solid rgba(0,240,255,0.2)', color: '#00f0ff' }}
                        >
                            {match.teams.map((t: any) => (
                                <option key={t.color} value={t.color}>{t.name}</option>
                            ))}
                        </select>
                    )}
                    <div className="hidden sm:flex flex-col items-end">
                        <p className="text-[9px] text-[#4b5563] font-mono uppercase tracking-wider font-mono">Synced</p>
                        <p className="text-[10px] font-mono text-[#00f0ff] font-mono">{lastSync.toLocaleTimeString()}</p>
                    </div>
                </div>
            </div>

            {/* ╔══════════════════════════════════════════════
                    SCORECARD — compact vertical stack, one row per team
                ══════════════════════════════════════════════╗ */}
            <div
                className="shrink-0 flex flex-col"
                style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(5,5,5,0.98)',
                }}
            >
                {players.map((player: any, idx: number) => {
                    const color = COLOR_HEX[player.team?.toLowerCase()] || '#6b7280';
                    const isLeader = idx === 0 && players.length > 1;
                    const playerTickets = (player.destinations || []).map((id: string) => allTickets.find(t => t.id === id)).filter(Boolean) as Ticket[];

                    return (
                        <div
                            key={player.team}
                            className="flex items-center gap-4 px-6 py-3"
                            style={{
                                borderLeft: `3px solid ${color}`,
                                borderBottom: idx < players.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                boxShadow: isLeader ? `inset 0 0 60px ${color}06` : 'none',
                            }}
                        >
                            {/* Dot + team name */}
                            <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: color, boxShadow: isLeader ? `0 0 6px ${color}` : 'none' }}
                            />
                            <span className="text-[13px] font-bold uppercase tracking-wider font-heading min-w-[70px]" style={{ color: isLeader ? color : '#d4d4d4' }}>
                                {player.team}
                            </span>
                            {isLeader && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-heading shrink-0" style={{ background: `${color}25`, color }}>LEAD</span>
                            )}
                            {/* Score */}
                            <span className="text-[14px] font-black font-mono tabular-nums shrink-0" style={{ color }}>{player.displayScore}</span>
                            <span className="text-[10px] text-white/30 font-heading shrink-0">pts</span>
                            {/* Separator */}
                            <div className="w-px h-4 bg-white/10 shrink-0 mx-2" />
                            {/* Compact stats */}
                            <span className="text-[12px] font-mono shrink-0" style={{ color: '#eab308' }}>🪙{player.coins}</span>
                            <span className="text-[12px] font-mono shrink-0 ml-2" style={{ color: '#60a5fa' }}>🚂{player.trainsLeft}</span>
                            <span className="text-[12px] font-mono shrink-0 ml-2" style={{ color: '#f87171' }}>🏠{player.stationsLeft}</span>

                            {/* Tickets */}
                            <div className="flex gap-1.5 ml-auto shrink-0 flex-wrap justify-end pl-4">
                                {playerTickets.map(ticket => {
                                    const isCompleted = getCompletedRoute(ttrState, player.team, ticket.city1, ticket.city2) !== null;
                                    const lengthType = ticket.points >= 20 ? 'LONG' : 'SHORT';
                                    return (
                                        <div
                                            key={ticket.id}
                                            className={`flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-heading uppercase tracking-widest transition-colors ${isCompleted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}
                                            title={isCompleted ? `Completed (+${ticket.points} pts)` : `Pending (-${ticket.points} pts penalty)`}
                                        >
                                            {lengthType} {ticket.points}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ╔══════════════════════════════════════════════
                    TICKET TABS — above the map (non-spectator only)
                ══════════════════════════════════════════════╗ */}
            {!isSpectator && (() => {
                if (!player) return null;
                if (confirmedTickets.length === 0 && pendingPool.length === 0) return null;


                const getCityName = (id: string) => {
                    if (id === 'optimistic_draw') return '...';
                    if (ttrState.mapData) return ttrState.mapData.cities.find(c => c.id === id)?.name || id;
                    return CITIES.find(c => c.id === id)?.name || id;
                };

                return (
                    <div
                        className="shrink-0 flex items-center gap-2 px-6 py-2.5 overflow-x-auto"
                        style={{
                            borderTop: '1px solid rgba(168,127,255,0.15)',
                            borderBottom: '1px solid rgba(168,127,255,0.1)',
                            background: 'rgba(5,5,5,0.97)',
                            scrollbarWidth: 'none',
                        }}
                    >
                        <div className="flex items-center gap-1.5 text-[#a87fff] shrink-0 mr-2">
                            <TicketIcon className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-widest font-black font-heading">Tickets</span>
                        </div>
                        <div className="w-px h-4 bg-white/10 shrink-0" />
                        <div className="flex items-center gap-2 flex-nowrap">
                            {[...confirmedTickets, ...pendingPool].map(ticket => {
                                const isPending = player.pendingDestinations?.includes(ticket.id);
                                const isChosen = selectedPendingIds.includes(ticket.id);
                                const isCompleted = !isPending && getCompletedRoute(ttrState, currentTeam, ticket.city1, ticket.city2) !== null;
                                const isFocused = focusedTicket?.id === ticket.id;

                                return (
                                    <button
                                        key={ticket.id}
                                        onClick={() => {
                                            userClearedFocusRef.current = isFocused;
                                            setFocusedTicketRaw(isFocused ? null : ticket);
                                        }}
                                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold font-heading transition-all duration-300 whitespace-nowrap group"
                                        style={isFocused ? {
                                            background: isPending ? 'rgba(168,127,255,0.25)' : 'rgba(168,127,255,0.2)',
                                            border: isPending ? '1.5px solid #a87fff' : '1px solid rgba(168,127,255,0.6)',
                                            color: '#c4a8ff',
                                            boxShadow: '0 0 15px rgba(168,127,255,0.3)',
                                        } : isCompleted ? {
                                            background: 'rgba(16,185,129,0.08)',
                                            border: '1px solid rgba(16,185,129,0.3)',
                                            color: '#34d399',
                                        } : isPending ? {
                                            background: isChosen ? 'rgba(168,127,255,0.15)' : 'rgba(168,127,255,0.05)',
                                            border: isChosen ? '1px solid #a87fff80' : '1px dashed rgba(168,127,255,0.3)',
                                            color: isChosen ? '#c4a8ff' : '#a87fff90',
                                        } : {
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'rgba(255,255,255,0.6)',
                                        }}
                                    >
                                        {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                                        {isPending && isChosen && <div className="w-1.5 h-1.5 rounded-full bg-[#a87fff] animate-pulse" />}
                                        <span>{getCityName(ticket.city1)}</span>
                                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                                        <span>{getCityName(ticket.city2)}</span>
                                        <span
                                            className="ml-1 font-mono tabular-nums text-[10px]"
                                            style={{ color: isFocused ? '#c4a8ff' : isCompleted ? '#34d399' : (isPending && !isChosen) ? '#a87fff' : '#eab308', opacity: 0.9 }}
                                        >
                                            {ticket.points}pts{isPending ? '?' : ''}
                                        </span>
                                    </button>
                                );
                            })}

                            {/* Confirm All Selection Button — Right in the bar */}
                            {isLeader && ttrState.players[currentTeam]?.pendingDestinations && ttrState.players[currentTeam].pendingDestinations!.length > 0 && (
                                <>
                                    <div className="w-px h-4 bg-white/10 shrink-0 mx-2" />
                                    <button
                                        disabled={(confirmedTickets.length + (ttrState.players[currentTeam].pendingDestinations?.length || 0) - discardedPendingIds.length) < 3 || isSubmittingTickets}
                                        onClick={handleSelectTickets}
                                        title={(confirmedTickets.length + (ttrState.players[currentTeam].pendingDestinations?.length || 0) - discardedPendingIds.length) < 3 ? "Must keep at least 3 tickets total (including long route)" : "Finalize ticket selection"}
                                        className={`shrink-0 px-4 py-1.5 rounded-full text-[10px] font-black font-heading uppercase tracking-widest transition-all duration-300 ${(confirmedTickets.length + (ttrState.players[currentTeam].pendingDestinations?.length || 0) - discardedPendingIds.length) >= 3
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95'
                                            : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'
                                            }`}
                                    >
                                        {isSubmittingTickets ? '...' : `Confirm (${confirmedTickets.length + (ttrState.players[currentTeam].pendingDestinations?.length || 0) - discardedPendingIds.length})`}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ╔══════════════════════════════════════════════
                    MAP — takes all remaining visible space.
                    min-height ensures it's large even when scrolled.
                ══════════════════════════════════════════════╗ */}
            <div
                className="w-full relative overflow-hidden"
                style={{
                    borderTop: '1px solid rgba(0,240,255,0.04)',
                    minHeight: 'calc(100vh - 64px - 136px)',
                    flex: '1 1 auto',
                }}
            >
                {/* Route Selection Timer Overlay */}
                {player?.pendingDestinations && player.pendingDestinations.length > 0 && (() => {
                    const gameStartedAt = new Date(match.startTime).getTime();
                    const selectionDeadline = gameStartedAt + 5 * 60 * 1000;
                    const selectionMsLeft = selectionDeadline - now.getTime();
                    if (selectionMsLeft <= 0) return null;

                    return (
                        <motion.div
                            drag
                            dragMomentum={false}
                            className="absolute top-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing animate-in fade-in slide-in-from-top duration-700"
                        >
                            <div className="bg-[#050505] backdrop-blur-xl border border-[#00f0ff]/30 px-6 py-2.5 rounded-[24px] flex items-center gap-4 shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_20px_rgba(0,240,255,0.1)]">
                                <div className="w-10 h-10 rounded-full bg-[#00f0ff]/10 flex items-center justify-center border border-[#00f0ff]/20">
                                    <Clock className="w-5 h-5 text-[#00f0ff] animate-pulse" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#00f0ff]/60 font-black leading-none mb-1">Auto-Confirming In</span>
                                    <span className="text-2xl font-mono font-black text-[#00f0ff] tabular-nums tracking-wider" style={{ textShadow: '0 0 20px rgba(0,240,255,0.3)' }}>
                                        {Math.floor(selectionMsLeft / 60000)}:{(Math.floor(selectionMsLeft / 1000) % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    );
                })()}

                <TTRMap
                    matchId={match.id}
                    state={ttrState}
                    currentTeam={currentTeam}
                    token={user?.token}
                    onUpdate={handleStateUpdate}
                    readOnly={isSpectator || isMatchEnded}
                    focusedTicket={focusedTicket}
                    setFocusedTicket={setFocusedTicket}
                />

                {/* END GAME LEADERBOARD OVERLAY */}
                {isMatchEnded && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-6 max-h-full overflow-y-auto">
                            <div className="text-center space-y-2 shrink-0">
                                <h2 className="text-4xl font-black font-heading text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                                    Match Ended
                                </h2>
                                <p className="text-[#a3a3a3] font-body text-sm uppercase tracking-widest">
                                    {ttrState.finalLapEndTime ? "Final lap completed (trains went below 3)" : "Time limit reached!"}
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                {players.map((player: any, idx: number) => {
                                    const color = COLOR_HEX[player.team?.toLowerCase()] || '#6b7280';
                                    const isWinner = idx === 0 && players.length > 1; // Highlight lead/winner
                                    return (
                                        <div
                                            key={player.team}
                                            className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 ${isWinner ? 'border-2 scale-[1.02]' : 'border hover:scale-[1.01]'}`}
                                            style={{
                                                backgroundColor: isWinner ? `${color}15` : 'rgba(255,255,255,0.02)',
                                                borderColor: isWinner ? color : 'rgba(255,255,255,0.08)',
                                                boxShadow: isWinner ? `0 0 30px ${color}20` : 'none',
                                            }}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="text-2xl font-black text-white/40 w-8 text-center font-heading">
                                                    #{idx + 1}
                                                </div>
                                                <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
                                                <div className="text-xl font-bold uppercase tracking-wider font-heading" style={{ color: isWinner ? color : 'white' }}>
                                                    {player.team} Team
                                                </div>
                                                {isWinner && (
                                                    <span className="text-xs font-bold px-2 py-1 rounded font-heading hidden sm:inline-block" style={{ backgroundColor: `${color}30`, color: color, border: `1px solid ${color}60` }}>
                                                        WINNER
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 sm:gap-6">
                                                <div className="hidden sm:flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs font-mono text-[#a3a3a3]">
                                                    <span title="Coins">🪙 {player.coins}</span>
                                                    <span title="Trains Left">🚂 {player.trainsLeft}</span>
                                                </div>
                                                <div className="flex items-end gap-2 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <div className="flex items-center gap-2">
                                                            {showPenalties && player.penalty > 0 && (
                                                                <>
                                                                    <span className="text-lg font-mono text-white/50 line-through animate-in slide-in-from-right fade-in duration-500">{player.baseScore}</span>
                                                                    <span className="text-lg font-mono text-red-500 animate-in slide-in-from-right fade-in duration-500 delay-150">-{player.penalty}</span>
                                                                    <span className="text-white/30">=</span>
                                                                </>
                                                            )}
                                                            <span className="text-3xl font-black font-mono tabular-nums transition-all duration-500" style={{ color }}>
                                                                {showPenalties ? player.finalScore : player.baseScore}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-sm text-white/30 font-heading mb-1">pts</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* FINAL LAP NOTIFICATION POPUP */}
                {showFinalLapPopup && (
                    <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-in fade-in duration-300 out-fade-out">
                        <div className="bg-gradient-to-br from-[#0a0a0a] to-[#120a0a] border-2 border-red-500/80 rounded-[32px] p-10 max-w-lg shadow-[0_0_120px_rgba(239,68,68,0.3)] flex flex-col items-center gap-4 animate-in zoom-in-90 duration-500">
                            <TrainFront className="w-20 h-20 text-red-500 mb-2 animate-bounce" />
                            <h2 className="text-6xl font-black font-heading text-red-500 uppercase tracking-widest text-center" style={{ textShadow: '0 0 40px rgba(239,68,68,0.5)' }}>
                                FINAL LAP
                            </h2>
                            <p className="text-[#d4d4d4] font-bold font-body text-xl text-center">
                                A team has less than <span className="text-white">3</span> trains.<br />
                                <span className="text-red-400 font-black">2 Minutes Remaining!</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Ticket details overlay at bottom of map */}
                {focusedTicket && !isSpectator && (() => {
                    const getCityName = (id: string) => {
                        if (id === 'optimistic_draw') return '...';
                        if (ttrState.mapData) return ttrState.mapData.cities.find(c => c.id === id)?.name || id;
                        return CITIES.find(c => c.id === id)?.name || id;
                    };
                    const isCompleted = getCompletedRoute(ttrState, currentTeam, focusedTicket.city1, focusedTicket.city2) !== null;
                    return (
                        <motion.div
                            drag
                            dragMomentum={false}
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-5 py-3 rounded-2xl cursor-grab active:cursor-grabbing"
                            style={{
                                background: 'rgba(8,8,12,0.92)',
                                border: isCompleted ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(168,127,255,0.35)',
                                backdropFilter: 'blur(16px)',
                                boxShadow: isCompleted
                                    ? '0 4px 32px rgba(16,185,129,0.12), 0 0 0 1px rgba(16,185,129,0.08)'
                                    : '0 4px 32px rgba(168,127,255,0.12), 0 0 0 1px rgba(168,127,255,0.08)',
                                minWidth: '280px',
                                maxWidth: '90vw',
                            }}
                        >
                            {/* Origin */}
                            <div className="flex flex-col items-center gap-0.5">
                                <MapPin className="w-4 h-4 text-[#00f0ff]" />
                                <span className="text-xs font-bold text-white font-heading">{getCityName(focusedTicket.city1)}</span>
                                <span className="text-[9px] text-white/40 uppercase tracking-widest font-heading">Origin</span>
                            </div>

                            {/* Arrow + points */}
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <div className="flex items-center gap-1 text-white/20">
                                    <div className="w-8 h-px bg-white/20" />
                                    <span className="text-white/30 text-xs">✈</span>
                                    <div className="w-8 h-px bg-white/20" />
                                </div>
                                <div
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black font-mono"
                                    style={isCompleted ? {
                                        background: 'rgba(16,185,129,0.12)',
                                        color: '#34d399',
                                        border: '1px solid rgba(16,185,129,0.3)',
                                    } : {
                                        background: 'rgba(234,179,8,0.1)',
                                        color: '#eab308',
                                        border: '1px solid rgba(234,179,8,0.25)',
                                    }}
                                >
                                    {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : null}
                                    {isCompleted ? 'DONE' : `+${focusedTicket.points} pts${ttrState.players[currentTeam]?.pendingDestinations?.includes(focusedTicket.id) ? '?' : ''}`}
                                </div>
                            </div>

                            {/* Destination */}
                            <div className="flex flex-col items-center gap-0.5">
                                <MapPin className="w-4 h-4 text-[#a87fff]" />
                                <span className="text-xs font-bold text-white font-heading">{getCityName(focusedTicket.city2)}</span>
                                <span className="text-[9px] text-white/40 uppercase tracking-widest font-heading">Destination</span>
                            </div>

                            {/* Selection Controls for Pending Tickets */}
                            {focusedTicket && ttrState.players[currentTeam]?.pendingDestinations?.includes(focusedTicket.id) && (
                                <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
                                    {isLeader ? (
                                        <>
                                            {!discardedPendingIds.includes(focusedTicket.id) ? (
                                                <button
                                                    onClick={() => {
                                                        const newDiscarded = [...discardedPendingIds, focusedTicket.id];
                                                        setDiscardedPendingIds(newDiscarded);
                                                        updateRemoteDraft(newDiscarded);
                                                        setFocusedTicket(null);
                                                    }}
                                                    disabled={confirmedTickets.length + (player?.pendingDestinations?.length || 0) - discardedPendingIds.length <= 3}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${confirmedTickets.length + (player?.pendingDestinations?.length || 0) - discardedPendingIds.length > 3
                                                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                                                        : 'bg-white/5 text-white/10 border border-white/5 cursor-not-allowed'
                                                        }`}
                                                >
                                                    Discard
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        const newDiscarded = discardedPendingIds.filter(id => id !== focusedTicket.id);
                                                        setDiscardedPendingIds(newDiscarded);
                                                        updateRemoteDraft(newDiscarded);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-red-600 transition-colors"
                                                >
                                                    Discarded
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-[9px] text-white/30 italic uppercase tracking-widest px-2">
                                            Leader only
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Confirm All Selection Button */}
                            {isLeader && ttrState.players[currentTeam]?.pendingDestinations && ttrState.players[currentTeam].pendingDestinations!.length > 0 && (
                                <div className="ml-4 pl-4 border-l border-white/10">
                                    <button
                                        disabled={(confirmedTickets.length + (ttrState.players[currentTeam].pendingDestinations?.length || 0) - discardedPendingIds.length) < 3 || isSubmittingTickets}
                                        onClick={handleSelectTickets}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black font-heading uppercase tracking-widest transition-all duration-300 ${(confirmedTickets.length + (ttrState.players[currentTeam].pendingDestinations?.length || 0) - discardedPendingIds.length) >= 3
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95'
                                            : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'
                                            }`}
                                    >
                                        {isSubmittingTickets ? '...' : `Confirm (${confirmedTickets.length + (ttrState.players[currentTeam].pendingDestinations?.length || 0) - discardedPendingIds.length})`}
                                    </button>
                                </div>
                            )}

                            {/* Close button */}
                            <button
                                onClick={() => setFocusedTicket(null)}
                                className="ml-2 w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors text-sm"
                            >
                                ×
                            </button>
                        </motion.div>
                    );
                })()}
            </div>

            {/* ╔══════════════════════════════════════════════
                    BELOW MAP — Marketplace (3x) + Solve Log (1x)
                ══════════════════════════════════════════════╗ */}
            <div
                className="border-t border-white/5"
                style={{ display: 'grid', gridTemplateColumns: '3fr 1fr' }}
            >

                {/* LEFT: Coin Marketplace */}
                <div className="border-r border-white/5">
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
                        <div className="w-1 h-4 rounded-full bg-yellow-400" />
                        <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-400 font-heading">Coin Marketplace</h3>
                    </div>
                    <CoinMarketplace state={ttrState} params={match.ttrParams} />
                </div>

                {/* RIGHT: Solve Log */}
                <div className="flex flex-col min-h-[200px]">
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
                        <div className="w-1 h-4 rounded-full bg-[#00f0ff]" />
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#00f0ff] font-heading">Solve Log</h3>
                    </div>
                    {solveLog.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-3">
                            <div className="w-px h-8 bg-white/10 rounded-full" />
                            <p className="text-xs text-[#4b5563] font-body">No solves yet</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-white/5  max-h-[320px] overflow-y-auto">
                            {solveLog.map((entry, i) => {
                                const c = COLOR_HEX[entry.team?.toLowerCase()] || '#6b7280';
                                return (
                                    <li key={i} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                                        <div className="w-0.5 shrink-0 self-stretch rounded-full opacity-80 mt-1" style={{ backgroundColor: c }} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-white font-semibold font-body truncate">{entry.problemName}</p>
                                            <p className="text-[10px] text-[#6b7280] font-body mt-0.5 flex flex-wrap gap-1 items-center">
                                                <span className="font-bold tracking-wider uppercase font-heading" style={{ color: c }}>{entry.team}</span>
                                                {entry.handle && (
                                                    <>
                                                        <span className="text-white/40">·</span>
                                                        <span className="text-[#a3a3a3]">{entry.handle}</span>
                                                    </>
                                                )}
                                                {entry.coinsAwarded ? (
                                                    <>
                                                        <span className="text-white/40">·</span>
                                                        <span className="text-yellow-400 font-mono text-[9px]">+{entry.coinsAwarded}🪙</span>
                                                    </>
                                                ) : null}
                                                {entry.timestamp && (
                                                    <>
                                                        <span className="text-white/40">·</span>
                                                        {(() => {
                                                            let formattedTime = entry.timestamp;
                                                            try {
                                                                const d = new Date(entry.timestamp);
                                                                if (!isNaN(d.getTime())) {
                                                                    formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                                }
                                                            } catch (e) { }
                                                            return <span className="font-mono text-[9px] text-[#6b7280]">{formattedTime}</span>;
                                                        })()}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

// Tiny scorecard stat chip
function StatChip({ icon, value, label, bg, border, textColor }: {
    icon: string; value: number; label: string; bg: string; border: string; textColor: string;
}) {
    return (
        <div
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold font-body"
            style={{ background: bg, border: `1px solid ${border}`, color: textColor }}
        >
            <span className="text-[10px]">{icon}</span>
            <span className="font-mono font-mono tabular-nums">{value}</span>
            <span className="text-white/40">{label}</span>
        </div>
    );
}

export default function TTRGameDisplay(props: TTRGameDisplayProps) {
    return (
        <AuthProvider matchId={props.match.id}>
            <TTRGameContent {...props} />
        </AuthProvider>
    );
}

import React, { useState, useEffect } from 'react';
import { Match } from '../types/match';
import { Bomb, Skull } from 'lucide-react';
import { AuthProvider, useTtrAuth } from '../ttr/AuthContext';
import JoinScreen from '../ttr/JoinScreen';

interface BombGameDisplayProps {
    match: Match;
    currentTeam: string;
    setCurrentTeam: (c: string) => void;
    hasStarted: boolean;
}

function BombGameContent({ match, currentTeam, setCurrentTeam, hasStarted }: BombGameDisplayProps) {
    const { user, isSpectator, isLoading } = useTtrAuth();

    const state = match.bombState;
    const params = match.bombParams;
    const teams = match.teams || [];

    const aliveTeams = state?.aliveTeams || [];
    const deadTeams = teams.filter(t => !aliveTeams.includes(t.color));

    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [passingTo, setPassingTo] = useState<string | null>(null);
    const [isPassing, setIsPassing] = useState(false);

    useEffect(() => {
        if (user && user.teamColor) {
            setCurrentTeam(user.teamColor);
        }
    }, [user, setCurrentTeam]);

    useEffect(() => {
        if (!state || !params || state.bombStatus !== 'ticking') return;
        const start = new Date(state.bombStartTime).getTime();
        const limitMs = (params.timeLimitMinutes || 10) * 60000;

        const interval = setInterval(() => {
            const el = Date.now() - start;
            const left = Math.max(0, limitMs - el);
            setTimeLeft(left);
        }, 1000);

        return () => clearInterval(interval);
    }, [state?.bombStartTime, state?.bombStatus, params?.timeLimitMinutes]);

    if (isLoading) return <div>Loading Auth...</div>;

    if (!user && !isSpectator) {
        const teamsData = (match.teams as any[]).map((t: any) => ({
            id: t.id, name: t.name, color: t.color,
            members: t.members.map((m: any) => ({ id: m.id, handle: m.handle, claimed: m.claimed ?? false }))
        }));
        return <JoinScreen matchId={match.id} teams={teamsData} />;
    }

    if (!hasStarted) {
        return <div className="flex h-full items-center justify-center text-gray-500">Waiting for match to start...</div>;
    }

    if (!state) return <div>Initializing Bomb state...</div>;

    const handlePass = async () => {
        if (!passingTo || !user?.token) return;
        setIsPassing(true);
        try {
            const res = await fetch('/api/passBomb', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: match.id,
                    targetTeam: passingTo,
                    secret: user.token
                })
            });
            if (!res.ok) {
                const txt = await res.text();
                alert('Failed to pass: ' + txt);
            } else {
                setPassingTo(null);
            }
        } catch(err) {
            alert('Error passing bomb');
        } finally {
            setIsPassing(false);
        }
    };

    const formatTime = (ms: number) => {
        const total = Math.floor(ms / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const numAlive = aliveTeams.length;
    const radius = Math.max(120, 250 - (10 - numAlive) * 10);

    return (
        <div className="flex flex-col h-full bg-[#050505] p-6 relative">
            <h1 className="text-3xl font-serif italic text-center mb-2 text-white">
                Pass the <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Bomb</span>
            </h1>

            <div className="flex flex-wrap justify-center gap-4 mb-4">
                {user && (
                    <div className="bg-white/10 px-4 py-2 rounded border border-white/20 text-white text-sm">
                        Logged in as <span className="font-bold" style={{color: user.teamColor}}>{user.handle}</span> (Team {user.teamColor})
                    </div>
                )}
                {isSpectator && (
                    <div className="bg-white/10 px-4 py-2 rounded border border-white/20 text-white text-sm">
                        Spectating
                    </div>
                )}
            </div>

            <div className="flex flex-wrap justify-center gap-4 mb-10">
                {aliveTeams.map((tColor: string) => {
                    const t = teams.find(x => x.color === tColor);
                    const pts = state.points?.[tColor] || 0;
                    return (
                        <div key={tColor} className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/5">
                            <div className="font-bold mb-1" style={{ color: tColor }}>{t?.name}</div>
                            <div className="text-sm text-white">{pts} pts</div>
                        </div>
                    );
                })}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[400px]">
                {aliveTeams.map((tColor: string, i: number) => {
                    const angle = (2 * Math.PI * i) / numAlive - Math.PI / 2;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    const isHolder = tColor === state.holderTeam;
                    const isDefused = isHolder && state.bombStatus === 'defused_waiting_pass';

                    return (
                        <div key={tColor}
                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-700
                              ${isHolder ? 'scale-125 z-10' : 'scale-100 z-0 opacity-70'}
                            `}
                            style={{
                                left: `calc(50% + ${x}px)`,
                                top: `calc(50% + ${y}px)`,
                            }}
                        >
                            <div 
                                className={`w-16 h-16 rounded-full border-4 flex items-center justify-center cursor-pointer`}
                                style={{ borderColor: tColor, background: isHolder ? `${tColor}30` : '#111' }}
                                onClick={() => {
                                    if (state.bombStatus === 'defused_waiting_pass' && user?.teamColor === state.holderTeam && tColor !== user?.teamColor) {
                                        setPassingTo(tColor);
                                    }
                                }}
                            >
                                {isHolder && !isDefused && <Bomb className="text-red-500 animate-pulse w-8 h-8" />}
                                {isHolder && isDefused && <Bomb className="text-green-500 w-8 h-8" />}
                                {!isHolder && <div className="text-xs uppercase text-white font-bold">{teams.find(t=>t.color===tColor)?.name.substring(0,3)}</div>}
                            </div>
                        </div>
                    );
                })}

                {state.holderTeam && (
                    <div className="absolute z-20 flex flex-col items-center justify-center pointer-events-none w-full h-full">
                        <div className="glass p-6 rounded-2xl flex flex-col items-center max-w-sm border-white/10 border pointer-events-auto bg-black/60 backdrop-blur">
                            <Bomb className={`w-12 h-12 mb-2 ${state.bombStatus === 'ticking' ? 'text-red-500 animate-bounce' : 'text-green-500'}`} />
                            
                            {state.bombStatus === 'ticking' ? (
                                <>
                                    <div className="text-4xl font-mono text-red-500 mb-2 font-bold">{formatTime(timeLeft)}</div>
                                    <div className="text-center text-sm text-gray-300 mb-4">
                                        <span className="font-bold underline text-lg" style={{ color: state.holderTeam }}>
                                            {teams.find(t=>t.color===state.holderTeam)?.name}
                                        </span> must solve:
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-green-400 font-bold mb-4 text-xl animate-pulse">BOMB NEUTRALIZED!</div>
                            )}

                            {state.activeProblem && (
                                <a 
                                    href={`https://codeforces.com/contest/${state.activeProblem.contestId}/problem/${state.activeProblem.index}`}
                                    target="_blank" rel="noreferrer"
                                    className="bg-white/10 border border-white/20 px-6 py-3 rounded-xl mb-4 text-center hover:bg-white/20 transition cursor-pointer"
                                    style={{pointerEvents: 'auto'}}
                                >
                                    <div className="font-bold text-white text-lg">{state.activeProblem.name}</div>
                                    <div className="text-sm text-yellow-500 font-bold mt-1">★ {state.activeProblem.rating}</div>
                                </a>
                            )}

                            {state.bombStatus === 'defused_waiting_pass' && user?.teamColor === state.holderTeam && (
                                <div className="w-full flex flex-col items-center">
                                    <div className="text-sm font-bold text-orange-400 mb-2 text-center">You defused it! Click on a team to pass the bomb.</div>
                                    {passingTo && (
                                        <button 
                                            onClick={handlePass} disabled={isPassing}
                                            className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded w-full border-2 border-orange-400"
                                        >
                                            PASS TO {teams.find(t=>t.color===passingTo)?.name?.toUpperCase() || ''}!
                                        </button>
                                    )}
                                </div>
                            )}
                            {state.bombStatus === 'defused_waiting_pass' && (!user || user.teamColor !== state.holderTeam) && (
                                <div className="text-sm text-gray-400 text-center italic">
                                    Waiting for {teams.find(t=>t.color===state.holderTeam)?.name} leader to pass...
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {deadTeams.length > 0 && (
                <div className="mt-auto border-t border-red-500/30 pt-4 pb-10">
                    <h2 className="text-red-500 font-bold mb-3 flex items-center justify-center gap-2 text-xl">
                        <Skull className="w-6 h-6" /> GRAVEYARD
                    </h2>
                    <div className="flex flex-wrap justify-center gap-4">
                        {deadTeams.map(t => (
                            <div key={t.color} className="opacity-60 text-white font-bold line-through text-sm border border-red-500/40 bg-red-500/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                <Skull className="w-4 h-4 text-red-500" /> {t.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function BombGameDisplay(props: BombGameDisplayProps) {
    return (
        <AuthProvider matchId={props.match.id}>
            <BombGameContent {...props} />
        </AuthProvider>
    );
}

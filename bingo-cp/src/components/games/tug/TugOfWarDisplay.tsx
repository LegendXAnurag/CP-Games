"use client";
import React from 'react';
import { Match, ProblemCell } from '@/types/match';

type TugOfWarDisplayProps = {
    match: Match;
    problems: ProblemCell[];
    solved: Record<string, { team: string }>;
    positionOwners: Record<number, string>;
    showRatings: boolean;
    teamColors: Record<string, string>;
};

// Map color name → CSS color value for inline styles
const COLOR_VALUES: Record<string, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
    purple: '#a855f7',
    orange: '#f97316',
    pink: '#ec4899',
    yellow: '#eab308',
    teal: '#14b8a6',
};

export default function TugOfWarDisplay({
    match,
    problems,
    solved,
    positionOwners,
    showRatings,
    teamColors,
}: TugOfWarDisplayProps) {
    const teamA = match.teams?.[0];
    const teamB = match.teams?.[1];

    if (!teamA || !teamB) {
        return <div className="text-center p-4 text-[#a3a3a3]">Invalid team configuration</div>;
    }

    const threshold = match.tugThreshold ?? 2000;
    const currentCount = match.tugCount ?? 0;
    const tugType = match.tugType ?? 'grid';

    const totalRange = threshold * 2;
    const percentage = ((currentCount + threshold) / totalRange) * 100;
    const clampedPercentage = Math.max(0, Math.min(100, percentage));

    const teamAColor = COLOR_VALUES[teamA.color?.toLowerCase()] || '#3b82f6';
    const teamBColor = COLOR_VALUES[teamB.color?.toLowerCase()] || '#ef4444';

    const teamABgClass = teamColors[teamA.color?.toLowerCase()] || 'bg-blue-500';
    const teamBBgClass = teamColors[teamB.color?.toLowerCase()] || 'bg-red-500';

    const isTeamALeading = currentCount > 0;
    const isTeamBLeading = currentCount < 0;

    const matchStart = new Date(match.startTime);
    const matchEnd = new Date(matchStart.getTime() + match.durationMinutes * 60 * 1000);
    const now = new Date();
    const matchHasEnded = now >= matchEnd;
    const allGridProblemsSolved = tugType === 'grid' && problems.every(p => solved[`${p.contestId}-${p.index}`]);

    const thresholdWin = currentCount >= threshold || currentCount <= -threshold;
    const timeBasedWin = matchHasEnded && !thresholdWin;
    const gridCompletionWin = allGridProblemsSolved && !thresholdWin;

    let winner = null;
    let winReason = '';

    if (currentCount >= threshold) {
        winner = teamA; winReason = `KO! Reached +${threshold}`;
    } else if (currentCount <= -threshold) {
        winner = teamB; winReason = `KO! Reached -${threshold}`;
    } else if (timeBasedWin) {
        winner = currentCount >= 0 ? teamA : teamB;
        winReason = currentCount === 0 ? 'TIME OVER — DRAW' : 'TIME OVER';
    } else if (gridCompletionWin) {
        winner = currentCount >= 0 ? teamA : teamB;
        winReason = 'PERFECT CLEAR';
    }

    const leadingColor = isTeamALeading ? teamAColor : isTeamBLeading ? teamBColor : '#00f0ff';

    return (
        <div className="w-full max-w-7xl mx-auto px-3 py-6 select-none">

            {/* ── WINNER BANNER ── */}
            {winner && (
                <div
                    className="mb-8 rounded-2xl relative overflow-hidden text-center p-8"
                    style={{
                        background: 'rgba(10,10,10,0.95)',
                        border: '2px solid #facc15',
                        boxShadow: '0 0 60px rgba(250,204,21,0.2), inset 0 0 40px rgba(250,204,21,0.05)',
                    }}
                >
                    <div className="absolute inset-0 animate-pulse"
                        style={{ background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.08) 0%, transparent 70%)' }} />
                    <p className="relative z-10 text-xs font-mono tracking-[0.3em] text-yellow-500/70 uppercase mb-2">{winReason}</p>
                    <h2 className="relative z-10 text-5xl md:text-7xl font-black tracking-tighter text-white uppercase"
                        style={{ textShadow: '0 0 40px rgba(250,204,21,0.6)' }}>
                        {winner.name} <span className="text-yellow-400">WINS</span>
                    </h2>
                </div>
            )}

            {/* ── VS HUD ── */}
            <div className="grid grid-cols-3 items-center mb-6 px-2 md:px-6 gap-4">

                {/* Team A */}
                <div className="text-left">
                    <div className="inline-flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamAColor, boxShadow: `0 0 8px ${teamAColor}` }} />
                            <span className="text-xs font-mono uppercase tracking-widest text-[#a3a3a3]">Team A</span>
                        </div>
                        <div
                            className="text-2xl md:text-4xl font-black uppercase tracking-tight transition-all duration-300 truncate"
                            style={{
                                color: isTeamALeading ? teamAColor : '#4b5563',
                                textShadow: isTeamALeading ? `0 0 20px ${teamAColor}60` : 'none',
                            }}
                        >
                            {teamA.name}
                        </div>
                    </div>
                </div>

                {/* Center score */}
                <div className="flex flex-col items-center gap-1">
                    <div
                        className="text-6xl md:text-8xl font-black tabular-nums tracking-tighter leading-none transition-all duration-300"
                        style={{
                            color: leadingColor,
                            textShadow: `0 0 30px ${leadingColor}80`,
                        }}
                    >
                        {Math.abs(currentCount)}
                    </div>
                    <span className="text-[10px] font-mono tracking-[0.3em] text-[#4b5563] uppercase bg-[#0a0a0a] px-3 py-1 rounded-full border border-[#262626]">
                        difference
                    </span>
                </div>

                {/* Team B */}
                <div className="text-right">
                    <div className="inline-flex flex-col items-end">
                        <div className="flex items-center gap-2 mb-1 justify-end">
                            <span className="text-xs font-mono uppercase tracking-widest text-[#a3a3a3]">Team B</span>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamBColor, boxShadow: `0 0 8px ${teamBColor}` }} />
                        </div>
                        <div
                            className="text-2xl md:text-4xl font-black uppercase tracking-tight transition-all duration-300 truncate"
                            style={{
                                color: isTeamBLeading ? teamBColor : '#4b5563',
                                textShadow: isTeamBLeading ? `0 0 20px ${teamBColor}60` : 'none',
                            }}
                        >
                            {teamB.name}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CLASH BAR ── */}
            <div className="relative w-full mb-4 px-2 md:px-6">
                <div
                    className="relative w-full h-16 md:h-20 rounded-xl overflow-hidden"
                    style={{
                        background: '#0d0d0d',
                        border: '1px solid #1f1f1f',
                        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
                    }}
                >
                    {/* Team A fill */}
                    <div
                        className={`absolute left-0 top-0 bottom-0 ${teamABgClass} transition-all duration-700 ease-out`}
                        style={{
                            width: `${clampedPercentage}%`,
                            opacity: 0.85,
                            boxShadow: `4px 0 20px ${teamAColor}60`,
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
                    </div>

                    {/* Team B fill */}
                    <div
                        className={`absolute right-0 top-0 bottom-0 ${teamBBgClass} transition-all duration-700 ease-out`}
                        style={{
                            width: `${100 - clampedPercentage}%`,
                            opacity: 0.85,
                            boxShadow: `-4px 0 20px ${teamBColor}60`,
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-l from-white/0 via-white/10 to-white/0" />
                    </div>

                    {/* Center clash beam */}
                    <div
                        className="absolute top-0 bottom-0 w-10 z-20 flex items-center justify-center transition-all duration-700 ease-out"
                        style={{ left: `${clampedPercentage}%`, transform: 'translateX(-50%)' }}
                    >
                        <div className="h-full w-0.5 bg-white/80" style={{ boxShadow: '0 0 12px #fff, 0 0 4px #fff' }} />
                        <div
                            className="absolute w-9 h-9 rounded-full bg-[#050505] border-2 border-white/80 flex items-center justify-center font-black text-[10px] text-white z-10"
                            style={{ boxShadow: '0 0 16px rgba(255,255,255,0.4)' }}
                        >
                            VS
                        </div>
                    </div>
                </div>

                {/* Threshold labels */}
                <div className="flex justify-between text-[10px] font-mono text-[#4b5563] uppercase mt-2 px-1">
                    <span style={{ color: teamBColor }}>← -{threshold}</span>
                    <span className="text-[#262626]">START</span>
                    <span style={{ color: teamAColor }}>+{threshold} →</span>
                </div>
            </div>

            {/* ── PROBLEMS ── */}
            <div className="mt-10 px-2 md:px-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-1 h-5 rounded-full" style={{ backgroundColor: leadingColor }} />
                    <h3 className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: leadingColor }}>
                        {tugType === 'single' ? 'Current Battle' : 'Battlefield'}
                    </h3>
                    <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${leadingColor}30, transparent)` }} />
                </div>

                {tugType === 'single' ? (
                    <div className="flex justify-center">
                        {problems.length > 0 && (
                            <div
                                onClick={() => window.open(`https://codeforces.com/contest/${problems[0].contestId}/problem/${problems[0].index}`, '_blank')}
                                className="group cursor-pointer rounded-2xl p-8 text-center transition-all duration-300 hover:scale-[1.02]"
                                style={{
                                    background: 'rgba(10,10,10,0.8)',
                                    border: '1px solid rgba(0,240,255,0.15)',
                                    boxShadow: '0 0 0 0 rgba(0,240,255,0)',
                                    maxWidth: 420,
                                    width: '100%',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 30px rgba(0,240,255,0.1)')}
                                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0,240,255,0)')}
                            >
                                {showRatings && (
                                    <div className="inline-block px-3 py-1 rounded-full text-sm font-bold mb-3 border border-[#00f0ff]/20 bg-[#00f0ff]/5 text-[#00f0ff]">
                                        ★ {problems[0].rating}
                                    </div>
                                )}
                                <div className="text-2xl font-bold text-white group-hover:text-[#00f0ff] transition-colors leading-snug">
                                    {problems[0].name}
                                </div>
                                <div className="mt-2 text-xs font-mono text-[#a3a3a3]">{problems[0].index}</div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={`grid gap-2.5 justify-items-center ${problems.length === 9 ? 'grid-cols-3' :
                            problems.length === 16 ? 'grid-cols-4' :
                                problems.length === 25 ? 'grid-cols-5' :
                                    'grid-cols-6'
                        }`}>
                        {problems.map((problem, idx) => {
                            const key = `${problem.contestId}-${problem.index}`;
                            const solvedInfo = solved[key];
                            const ownerTeam = solvedInfo?.team ?? positionOwners[problem.position ?? idx];
                            const isOwned = Boolean(ownerTeam);
                            const ownerColorValue = ownerTeam ? (COLOR_VALUES[ownerTeam] || '#6b7280') : null;

                            return (
                                <div
                                    key={key}
                                    onClick={() => window.open(`https://codeforces.com/contest/${problem.contestId}/problem/${problem.index}`, '_blank')}
                                    className="w-full aspect-square flex flex-col justify-center items-center text-center rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group"
                                    style={isOwned ? {
                                        background: `${ownerColorValue}20`,
                                        border: `2px solid ${ownerColorValue}60`,
                                        boxShadow: `0 0 16px ${ownerColorValue}25, inset 0 0 20px ${ownerColorValue}10`,
                                    } : {
                                        background: 'rgba(13,13,13,0.9)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isOwned) {
                                            e.currentTarget.style.border = '1px solid rgba(0,240,255,0.25)';
                                            e.currentTarget.style.boxShadow = '0 0 12px rgba(0,240,255,0.08)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isOwned) {
                                            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }
                                    }}
                                >
                                    {/* Owned: glowing overlay */}
                                    {isOwned && ownerColorValue && (
                                        <div className="absolute inset-0 opacity-10"
                                            style={{ background: `radial-gradient(ellipse at center, ${ownerColorValue} 0%, transparent 70%)` }} />
                                    )}

                                    {showRatings && (
                                        <div className="text-[10px] sm:text-xs font-bold mb-1 opacity-70"
                                            style={{ color: isOwned ? ownerColorValue || '#fff' : '#6b7280' }}>
                                            {problem.rating}
                                        </div>
                                    )}
                                    <div className={`font-bold leading-tight px-1 relative z-10 ${showRatings ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}
                                        style={{ color: isOwned ? '#fff' : '#9ca3af' }}>
                                        {problem.name}
                                    </div>
                                    <div className="text-[9px] font-mono mt-0.5 opacity-50 relative z-10"
                                        style={{ color: isOwned ? '#fff' : '#6b7280' }}>
                                        {problem.index}
                                    </div>

                                    {/* Checkmark for solved */}
                                    {isOwned && (
                                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                                            style={{ backgroundColor: ownerColorValue || '#fff', boxShadow: `0 0 8px ${ownerColorValue}80` }}>
                                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

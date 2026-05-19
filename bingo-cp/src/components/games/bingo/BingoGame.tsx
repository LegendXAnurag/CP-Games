import React from 'react';
import { ProblemCell } from '@/types/match';

type Winner = {
  team: string;
  type: 'row' | 'col' | 'diag' | 'anti-diag';
  index: number;
  keys: string[];
} | null;

type SolvedInfo = {
  team: string;
};

interface BingoGameProps {
  problems: ProblemCell[];
  solved: Record<string, SolvedInfo>;
  positionOwners: Record<number, string>;
  winner: Winner;
  showRatings: boolean;
  gridSize: 3 | 4 | 5 | 6;
}

const gridClasses = {
  3: "grid-cols-3 gap-4 max-w-2xl mx-auto",
  4: "grid-cols-4 gap-4 max-w-3xl mx-auto",
  5: "grid-cols-5 gap-4 max-w-4xl mx-auto",
  6: "grid-cols-6 gap-4 max-w-5xl mx-auto",
};

export default function BingoGame({
  problems,
  solved,
  positionOwners,
  winner,
  showRatings,
  gridSize
}: BingoGameProps) {
  return (
    <div className={`grid ${gridClasses[gridSize]} px-2 sm:px-4 w-full`}>
      {problems.map((problem, idx) => {
        const key = `${problem.contestId}-${problem.index}`;
        const solvedInfo = solved[key];
        const ownerTeam = solvedInfo?.team ?? positionOwners[problem.position ?? idx];
        const isWinningCell = winner?.keys?.includes(key);
        const isOwned = Boolean(ownerTeam);

        const colorHexMap: Record<string, string> = {
          red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
          purple: '#a855f7', orange: '#f97316', pink: '#ec4899',
          yellow: '#eab308', teal: '#14b8a6',
        };
        const ownerColorHex = ownerTeam ? (colorHexMap[ownerTeam] || '#6b7280') : null;

        return (
          <div
            key={key}
            onClick={() => window.open(`https://codeforces.com/contest/${problem.contestId}/problem/${problem.index}`, '_blank')}
            className="w-full aspect-[4/3] min-h-[3rem] flex flex-col justify-center items-center text-center rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group"
            style={isWinningCell ? {
              background: 'rgba(250,204,21,0.12)',
              border: '2px solid rgba(250,204,21,0.7)',
              boxShadow: '0 0 20px rgba(250,204,21,0.25)',
              transform: 'scale(1.04)',
            } : isOwned && ownerColorHex ? {
              background: `${ownerColorHex}20`,
              border: `2px solid ${ownerColorHex}60`,
              boxShadow: `0 0 14px ${ownerColorHex}20`,
            } : {
              background: 'rgba(13,13,13,0.85)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onMouseEnter={e => {
              if (!isOwned && !isWinningCell) {
                e.currentTarget.style.border = '1px solid rgba(0,240,255,0.3)';
                e.currentTarget.style.boxShadow = '0 0 14px rgba(0,240,255,0.08)';
              }
            }}
            onMouseLeave={e => {
              if (!isOwned && !isWinningCell) {
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {isWinningCell && (
              <div className="absolute inset-0 animate-pulse" style={{ background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.12) 0%, transparent 70%)' }} />
            )}
            {isOwned && ownerColorHex && !isWinningCell && (
              <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse at center, ${ownerColorHex} 0%, transparent 70%)` }} />
            )}

            {showRatings && (
              <div className="text-[10px] sm:text-xs font-bold mb-0.5 relative z-10"
                style={{ color: isWinningCell ? '#facc15' : isOwned && ownerColorHex ? ownerColorHex : '#6b7280' }}>
                ★ {problem.rating} · {problem.index}
              </div>
            )}
            <div className={`font-semibold leading-snug px-1 relative z-10 ${showRatings ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}
              style={{ color: isOwned || isWinningCell ? '#fff' : '#9ca3af' }}>
              {problem.name}
            </div>

            {isOwned && ownerColorHex && (
              <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center z-10"
                style={{ backgroundColor: ownerColorHex, boxShadow: `0 0 6px ${ownerColorHex}` }}>
                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

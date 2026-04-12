"use client";

import { TTRState, TTRParams } from "../app/types/match";
import { ExternalLink } from "lucide-react";
import { getCoinsForRow } from "@/lib/ttrCoins";

interface CoinMarketplaceProps {
    state: TTRState;
    params?: TTRParams;
}

const LEVEL_CONFIG = [
    { label: "Easy", color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)", hover: "rgba(34,197,94,0.12)" },
    { label: "Medium", color: "#eab308", bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.2)", hover: "rgba(234,179,8,0.12)" },
    { label: "Hard", color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)", hover: "rgba(249,115,22,0.12)" },
    { label: "Expert", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", hover: "rgba(239,68,68,0.12)" },
];

export default function CoinMarketplace({ state, params }: CoinMarketplaceProps) {
    const { market } = state;

    const byLevel = [0, 1, 2, 3].map(level => ({
        level,
        config: LEVEL_CONFIG[level],
        coins: getCoinsForRow(level, params),
        problems: market.filter(p => p.row === level),
    }));

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-white/5">
            {byLevel.map(({ level, config, problems, coins }) => (
                <div key={level} className="p-4 flex flex-col gap-2">
                    {/* Level header */}
                    <div className="flex items-center justify-between mb-2">
                        <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest font-heading"
                            style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}
                        >
                            L{level + 1} {config.label}
                        </span>
                        <span
                            className="text-[10px] font-bold font-mono tabular-nums font-mono"
                            style={{ color: config.color }}
                        >
                            +{coins} coins
                        </span>
                    </div>

                    {/* Problem rows */}
                    {problems.length === 0 ? (
                        <p className="text-[11px] text-[#4b5563] italic py-2 font-body">No problems</p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {problems.map(p => (
                                <a
                                    key={p.contestId + p.index}
                                    href={`https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-all duration-150"
                                    style={{
                                        background: 'rgba(10,10,10,0.6)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.background = config.hover;
                                        (e.currentTarget as HTMLElement).style.borderColor = config.border;
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.background = 'rgba(10,10,10,0.6)';
                                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)';
                                    }}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-mono font-bold font-mono" style={{ color: config.color }}>{p.index}</span>
                                            <span className="text-[9px] text-[#4b5563] font-mono font-mono tabular-nums">{p.rating}</span>
                                        </div>
                                        <p className="text-[11px] text-[#d1d5db] truncate mt-0.5 leading-tight font-body">{p.name}</p>
                                    </div>
                                    <ExternalLink className="w-3 h-3 shrink-0 text-[#4b5563] group-hover:text-white/60 transition-colors" />
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

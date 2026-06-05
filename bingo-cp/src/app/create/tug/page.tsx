'use client';
import { useState } from 'react';
import TugMatchCreationForm from '@/components/games/tug/TugMatchCreationForm';
import { Match } from '@/types/match';
import { Swords } from 'lucide-react';

export default function TugModePage() {
    const [match, setMatch] = useState<Match | null>(null);

    if (match) {
        return null;
    }

    return (
        <main className="min-h-screen pt-24 pb-16">
            {/* Ambient glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[-5%] left-[20%] w-[600px] h-[400px] bg-red-500/5 rounded-full blur-[140px]" />
                <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            {/* Branded Hero */}
            <div className="text-center mb-10 px-4">
                <div
                    className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                    style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        boxShadow: '0 0 30px rgba(239,68,68,0.1)',
                    }}
                >
                    <Swords className="w-7 h-7 text-red-400" />
                </div>
                <h1 className="text-4xl md:text-5xl font-serif italic text-white mb-3">
                    Tug of War{' '}
                    <span
                        className="text-transparent bg-clip-text"
                        style={{ backgroundImage: 'linear-gradient(135deg, #ef4444, #7000ff)' }}
                    >
                        Match Setup
                    </span>
                </h1>
                <p className="text-[#a3a3a3] text-base max-w-md mx-auto font-body">
                    Two teams. One rope. Solve problems to pull it your way.
                </p>
            </div>

            {/* Form */}
            <div className="flex justify-center px-4">
                <TugMatchCreationForm onMatchCreated={setMatch} />
            </div>

            {/* How Tug of War Works */}
            <div className="max-w-2xl mx-auto mt-16 px-4">
                <details className="glass rounded-2xl border border-white/5 p-6 group">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                        <span className="text-sm font-bold uppercase tracking-widest text-red-400 font-heading">How Tug of War Works</span>
                        <svg className="w-4 h-4 text-[#a3a3a3] transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="mt-4 space-y-3 text-sm text-[#a3a3a3] font-body">
                        <p><span className="text-white font-semibold">Classic mode:</span> Two teams competing. Solve a problem to pull the rope toward your team.</p>
                        <p><span className="text-white font-semibold">Grid mode:</span> A shared problem grid. Solve a problem to mark it and gain rope advantage.</p>
                        <p><span className="text-white font-semibold">Win condition:</span> The team that reaches the threshold first wins — or whoever leads when time runs out.</p>
                    </div>
                </details>
            </div>
        </main>
    );
}

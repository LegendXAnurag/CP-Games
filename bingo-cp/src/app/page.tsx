// app/page.tsx
'use client';
import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight, Grid3x3, Swords, TrainFront,
  Zap, ShieldCheck, BarChart3,
} from 'lucide-react';
import GameModeCard from '@/components/landing/GameModeCard';
import FeatureCard from '@/components/landing/FeatureCard';

/* ─── Animation variants ─────────────────────────────────── */
const fadeUp: any = {
  hidden: { opacity: 0, y: 30, filter: 'blur(12px)' },
  show: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { type: 'spring', damping: 20, stiffness: 100 }
  },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

/* ─── Game mode card data ─────────────────────────────────── */
const MODES = [
  {
    href: '/create-match',
    label: 'Bingo',
    tag: 'MULTIPLAYER',
    icon: Grid3x3,
    accent: '#06b6d4',
    accentBg: 'rgba(6,182,212,0.06)',
    tagBg: 'rgba(6,182,212,0.12)',
    cta: 'Create Match',
    desc: 'Classic 5×5 grid. Solve CF problems to claim tiles. First to complete a line wins.',
    bullets: ['5×5 Problem Grid', 'Auto CF Verification', 'Multi-team Support'],
  },
  {
    href: '/tug-mode',
    label: 'Tug of War',
    tag: '1v1 · TEAM',
    icon: Swords,
    accent: '#ef4444',
    accentBg: 'rgba(239,68,68,0.06)',
    tagBg: 'rgba(239,68,68,0.12)',
    cta: 'Enter Arena',
    desc: 'Two sides, one rope. Solve harder problems to pull it your way. Push them off the edge.',
    bullets: ['Classic & Grid Modes', 'Rating-based Difficulty', 'Tug Threshold Win'],
  },
  {
    href: '/create-ttr-match',
    label: 'Ticket to Ride',
    tag: 'STRATEGY',
    icon: TrainFront,
    accent: '#10b981',
    accentBg: 'rgba(16,185,129,0.06)',
    tagBg: 'rgba(16,185,129,0.12)',
    cta: 'Start Journey',
    desc: 'Earn coins by solving problems. Spend them to claim train routes across the map.',
    bullets: ['Europe Map', 'Coin Economy', 'Route Strategy'],
  },
];

/* ─── Feature strip data ─────────────────────────────────── */
const FEATURES = [
  {
    icon: Zap,
    accent: '#06b6d4',
    title: 'Real-time Sync',
    body: 'Solve submissions verified against the Codeforces API within seconds.',
  },
  {
    icon: ShieldCheck,
    accent: '#a87fff',
    title: 'Secure Auth',
    body: 'Handle-based team identity. No passwords, no accounts — just your CF handle.',
  },
  {
    icon: BarChart3,
    accent: '#10b981',
    title: 'Live Scoreboards',
    body: 'Watch leaderboards shift in real-time as your team solves and claims territory.',
  },
];

export default function HomePage(): React.JSX.Element {
  return (
    <div className="relative min-h-screen overflow-x-hidden">

      {/* ── Page content ──────────────────────────────── */}
      <div className="relative z-10">

        {/* ═══════════════════════════════════════════
                        HERO
                    ═══════════════════════════════════════════ */}
        <section className="flex flex-col items-center justify-center pt-24 pb-12 px-6 text-center">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="max-w-5xl mx-auto"
          >
            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              className="font-serif italic leading-[1.05] mb-6 tracking-tight"
              style={{ fontSize: 'clamp(3rem, 7vw, 5.5rem)', color: '#fff' }}
            >
              Competitive Programming<br />
              <span
                className="font-serif italic text-transparent bg-clip-text"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #00f0ff 0%, #7000ff 50%, #10b981 100%)',
                  backgroundSize: '200% auto',
                  animation: 'shimmer 5s linear infinite',
                }}
              >
                Evolved.
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 text-lg md:text-xl max-w-2xl mx-auto font-body font-light"
              style={{ color: '#a3a3a3' }}
            >
              A multiplayer arena where Codeforces problems meet real-time strategy, tug-of-war battles, and tactical board games.
            </motion.p>
          </motion.div>
        </section>

        {/* ═══════════════════════════════════════════
                        GAME MODE CARDS
                    ═══════════════════════════════════════════ */}
        <section className="px-6 pb-28 max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            style={{ perspective: '1200px' }}
          >
            {MODES.map((mode) => (
              <motion.div key={mode.href} variants={fadeUp} className="h-full">
                <GameModeCard mode={mode} />
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ═══════════════════════════════════════════
                        FEATURES STRIP
                    ═══════════════════════════════════════════ */}
        <section className="px-6 pb-28 max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} feature={f} index={i} />
            ))}
          </motion.div>
        </section>

        {/* ═══════════════════════════════════════════
                        FOOTER CTA BANNER
                    ═══════════════════════════════════════════ */}
        <section className="px-6 pb-24 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, type: 'spring', damping: 20 }}
            className="relative rounded-3xl px-10 py-12 flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden group bg-white/5 backdrop-blur-md"
          >
            {/* Animated Background */}
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#00f0ff]/10 to-[#7000ff]/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute inset-0 z-0 border border-white/5 rounded-3xl group-hover:border-white/10 transition-colors duration-500" />

            <div className="relative z-10 w-full md:w-auto text-center md:text-left">
              <h2 className="text-3xl md:text-4xl font-black text-white font-heading mb-3 tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-[#00f0ff] group-hover:to-[#7000ff] transition-all duration-500">
                Ready to compete?
              </h2>
              <p className="text-[15px] font-body text-gray-400 group-hover:text-gray-300 transition-colors duration-500">
                Pick a mode, assemble your team, and crush those problems.
              </p>
            </div>

            <Link href="/create-match" className="shrink-0 relative z-10 w-full md:w-auto">
              <button
                className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-[15px] font-bold uppercase tracking-wider hover:scale-105 transition-all duration-300 font-heading bg-white text-black hover:bg-[#00f0ff]/10 hover:text-white border-[2px] border-transparent hover:border-[#00f0ff]"
                style={{
                  boxShadow: '0 0 40px rgba(0,240,255,0.2)',
                }}
              >
                Create a Match <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          </motion.div>

          {/* Fine print */}
          <p className="text-center text-xs mt-10 font-body text-gray-500 uppercase tracking-wider font-semibold">
            More modes coming soon <span className="mx-2 opacity-50">·</span> Codeforces account required to play
          </p>
        </section>

      </div>
    </div>
  );
}

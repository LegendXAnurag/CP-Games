"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Grid3X3, Swords, TrainFront, ChevronDown, Mail, Github, BookOpen } from "lucide-react";

const gameModes = [
  {
    icon: Grid3X3,
    label: "BINGO",
    color: "#00f0ff",
    bg: "rgba(0,240,255,0.08)",
    border: "rgba(0,240,255,0.2)",
    href: "/create/bingo",
  },
  {
    icon: Swords,
    label: "TUG OF WAR",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.2)",
    href: "/create/tug",
  },
  {
    icon: TrainFront,
    label: "TICKET TO RIDE",
    color: "#10b981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.2)",
    href: "/create/ttr",
  },
];

const faqs = [
  {
    q: "Do I need an account?",
    a: "You must provide a Codeforces handle. We use that handle to automatically detect your accepted submissions — no separate CP Games account needed.",
  },
  {
    q: "Can I join a match without being invited?",
    a: "Not currently. Matches are created by a host who then shares the match link with participants.",
  },
  {
    q: "What happens if the Codeforces API is slow?",
    a: "Submission detection may take a few seconds. The system polls periodically and updates tiles as soon as it confirms an accepted submission.",
  },
  {
    q: "I solved a problem but the grid didn't update — what should I do?",
    a: "Give it 10–30 seconds. Verify the handle in the match matches the handle you submitted with, and that the submission shows as accepted on Codeforces. Avoid starting matches during major Codeforces rounds — the API may be throttled.",
  },
  {
    q: "I pressed Create match but nothing happened. How long should it take?",
    a: "Match creation can take 20–40 seconds depending on handles and problem pool size. If it takes much longer, check your network connection or try again.",
  },
];

function AccordionItem({ item, index, openIndex, setOpenIndex }: {
  item: { q: string; a: string };
  index: number;
  openIndex: number | null;
  setOpenIndex: (i: number | null) => void;
}) {
  const isOpen = openIndex === index;
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpenIndex(isOpen ? null : index)}
        className="w-full text-left flex items-center justify-between gap-3 py-4 px-2 focus:outline-none rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer"
      >
        <span className="font-medium text-sm text-white font-body">{item.q}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-4 h-4 text-[#a3a3a3] shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="px-2 pb-4 text-sm text-[#a3a3a3] leading-relaxed font-body">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HelpPage(): React.JSX.Element {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const fadeUp = {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 },
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">

      {/* Ambient glow blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto space-y-12">

        {/* ── Hero ─────────────────────────────────────── */}
        <motion.header {...fadeUp} className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span className="text-xs font-mono text-[#00f0ff] uppercase tracking-widest font-mono">Documentation</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-serif italic text-white">
            Help &{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, #00f0ff, #7000ff)" }}
            >
              Documentation
            </span>
          </h1>
          <p className="text-[#a3a3a3] max-w-xl mx-auto text-base font-body">
            Rules, FAQs, and troubleshooting for all CP Games modes.
          </p>

          {/* Game mode quick links */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {gameModes.map((mode) => (
              <a
                key={mode.label}
                href={mode.href}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200 hover:scale-105"
                style={{
                  background: mode.bg,
                  border: `1px solid ${mode.border}`,
                  color: mode.color,
                }}
              >
                <mode.icon className="w-3.5 h-3.5" />
                {mode.label}
              </a>
            ))}
          </div>
        </motion.header>

        {/* ── Game Mode Cards ───────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Bingo (CPC) */}
          <motion.article {...fadeUp} className="glass rounded-2xl border border-white/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(0,240,255,0.12)", border: "1px solid rgba(0,240,255,0.25)" }}
              >
                <Grid3X3 className="w-4 h-4 text-[#00f0ff]" />
              </div>
              <span
                className="text-xs font-bold uppercase tracking-widest font-heading px-2.5 py-1 rounded-full"
                style={{ color: "#00f0ff", background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.15)" }}
              >
                Bingo
              </span>
            </div>
            <h2 className="text-lg font-bold text-white font-heading">How Bingo Works</h2>
            <div className="space-y-3 text-sm text-[#a3a3a3] font-body">
              <p>Each tile contains a real competitive programming problem from Codeforces. When a team member submits a correct solution, that tile is automatically claimed.</p>
              <p><span className="text-white font-semibold">Classic mode:</span> The first team to complete a full row, column, or diagonal wins. Claimed tiles stay claimed permanently.</p>
              <p><span className="text-white font-semibold">Replace mode:</span> When a tile is claimed, it is immediately replaced with a new problem so the board stays full — matches run longer with no downtime.</p>
            </div>
          </motion.article>

          {/* Problem Selection */}
          <motion.article {...fadeUp} className="glass rounded-2xl border border-white/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(112,0,255,0.12)", border: "1px solid rgba(112,0,255,0.25)" }}
              >
                <span className="text-[#a87fff] text-sm font-bold font-mono">CF</span>
              </div>
              <span
                className="text-xs font-bold uppercase tracking-widest font-heading px-2.5 py-1 rounded-full"
                style={{ color: "#a87fff", background: "rgba(112,0,255,0.08)", border: "1px solid rgba(112,0,255,0.15)" }}
              >
                Codeforces
              </span>
            </div>
            <h2 className="text-lg font-bold text-white font-heading">How Problems Are Chosen</h2>
            <ul className="space-y-2 text-sm text-[#a3a3a3] font-body">
              <li className="flex gap-2"><span className="text-[#00f0ff] font-mono shrink-0">01.</span>A large pool of problems is fetched from Codeforces in the configured rating range.</li>
              <li className="flex gap-2"><span className="text-[#00f0ff] font-mono shrink-0">02.</span>Problems that any player has already attempted or solved are filtered out — keeping the match fair.</li>
              <li className="flex gap-2"><span className="text-[#00f0ff] font-mono shrink-0">03.</span>Random problems from the filtered pool populate the grid.</li>
            </ul>
          </motion.article>

          {/* Tug of War */}
          <motion.article {...fadeUp} className="glass rounded-2xl border border-white/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                <Swords className="w-4 h-4 text-red-400" />
              </div>
              <span
                className="text-xs font-bold uppercase tracking-widest font-heading px-2.5 py-1 rounded-full"
                style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
              >
                Tug of War
              </span>
            </div>
            <h2 className="text-lg font-bold text-white font-heading">How Tug of War Works</h2>
            <div className="space-y-2 text-sm text-[#a3a3a3] font-body">
              <p>Solve problems to push the rope toward the opponent&apos;s side. Each accepted solution adds that problem&apos;s rating as points to your side.</p>
              <p><span className="text-white font-semibold">Classic:</span> One problem at a time. Reach the threshold to win.</p>
              <p><span className="text-white font-semibold">Grid:</span> Multiple problems active at once. Dominate more cells. Team with rope advantage when time runs out wins.</p>
            </div>
          </motion.article>

          {/* Ticket to Ride */}
          <motion.article {...fadeUp} className="glass rounded-2xl border border-white/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}
              >
                <TrainFront className="w-4 h-4 text-emerald-400" />
              </div>
              <span
                className="text-xs font-bold uppercase tracking-widest font-heading px-2.5 py-1 rounded-full"
                style={{ color: "#10b981", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}
              >
                Ticket to Ride
              </span>
            </div>
            <h2 className="text-lg font-bold text-white font-heading">How Ticket to Ride Works</h2>
            <div className="space-y-2 text-sm text-[#a3a3a3] font-body">
              <p>Solve problems to earn coins. Spend coins to claim train routes on the map. Complete destination tickets for bonus points.</p>
              <p>The team with the most points when time expires wins.</p>
            </div>
          </motion.article>
        </div>

        {/* ── Quick Start ───────────────────────────────── */}
        <motion.section {...fadeUp} className="glass rounded-2xl border border-white/5 p-6 space-y-4">
          <h2 className="text-lg font-bold text-white font-heading">Quick Start — Players</h2>
          <ol className="space-y-3 font-body">
            {[
              "Ask the match host for the start time and your team assignment.",
              "Make sure your Codeforces handle matches the one entered into the match.",
              "When the match starts, open the problem on Codeforces, solve it, and submit as usual.",
              "If your submission is accepted, the tile updates automatically for your team.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-[#a3a3a3]">
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono"
                  style={{ background: "rgba(0,240,255,0.1)", color: "#00f0ff", border: "1px solid rgba(0,240,255,0.2)" }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </motion.section>

        {/* ── FAQ ───────────────────────────────────────── */}
        <motion.section {...fadeUp} className="glass rounded-2xl border border-white/5 p-6 space-y-1">
          <h2 className="text-lg font-bold text-white font-heading mb-4">FAQ</h2>
          {faqs.map((item, i) => (
            <AccordionItem
              key={i}
              item={item}
              index={i}
              openIndex={openIndex}
              setOpenIndex={setOpenIndex}
            />
          ))}
        </motion.section>

        {/* ── Contact ─────────────────────────────────── */}
        <motion.section {...fadeUp} className="glass rounded-2xl border border-white/5 p-6 space-y-4">
          <h2 className="text-lg font-bold text-white font-heading">Contact & Feedback</h2>
          <p className="text-sm text-[#a3a3a3] font-body">Found a bug or want to request a feature? Reach out below.</p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:saransh2304@gmail.com"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105"
              style={{
                background: "rgba(0,240,255,0.08)",
                border: "1px solid rgba(0,240,255,0.2)",
                color: "#00f0ff",
              }}
            >
              <Mail className="w-4 h-4" />
              saransh2304@gmail.com
            </a>
            <a
              href="https://github.com/legendxanurag/cp-games"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e5e5e5",
              }}
            >
              <Github className="w-4 h-4" />
              Project Repository
            </a>
          </div>
        </motion.section>

        {/* ── Footer ───────────────────────────────────── */}
        <footer className="text-center border-t border-white/5 pt-8">
          <p className="text-xs text-[#4b5563] font-body">
            &copy; {new Date().getFullYear()} CP Games — help & documentation.
          </p>
        </footer>

      </div>
    </div>
  );
}

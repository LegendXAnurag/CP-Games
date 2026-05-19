'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

export interface GameModeConfig {
    href: string;
    label: string;
    tag: string;
    icon: LucideIcon;
    accent: string;
    accentBg: string;
    tagBg: string;
    cta: string;
    desc: string;
    bullets: string[];
}

export default function GameModeCard({ mode }: { mode: GameModeConfig }) {
    const ref = useRef<HTMLDivElement>(null);
    const Icon = mode.icon;

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

    const [isHovered, setIsHovered] = useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;

        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        x.set(0);
        y.set(0);
    };

    // Create a glow that follows the mouse using a motion template
    const mouseXPixel = useTransform(mouseXSpring, v => (v + 0.5) * 100);
    const mouseYPixel = useTransform(mouseYSpring, v => (v + 0.5) * 100);
    const glowGradient = useMotionTemplate`radial-gradient(400px circle at ${mouseXPixel}% ${mouseYPixel}%, ${mode.accent}25, transparent 50%)`;
    const borderGradient = useMotionTemplate`radial-gradient(200px circle at ${mouseXPixel}% ${mouseYPixel}%, ${mode.accent}90, transparent 60%)`;

    return (
        <motion.div
            style={{
                transformStyle: "preserve-3d",
                rotateX: isHovered ? rotateX : 0,
                rotateY: isHovered ? rotateY : 0,
            }}
            className="relative block h-full z-10 w-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <Link href={mode.href} className="block group h-full focus:outline-none w-full outline-none">
                <div
                    ref={ref}
                    className="relative h-full rounded-3xl p-7 flex flex-col overflow-hidden transition-all duration-300 w-full"
                    style={{
                        background: `linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)`,
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        boxShadow: isHovered ? `0 20px 40px -10px ${mode.accent}30` : '0 10px 30px -10px rgba(0,0,0,0.5)',
                    }}
                >
                    {/* Animated Glow following mouse */}
                    <motion.div
                        className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300"
                        style={{
                            background: glowGradient,
                            opacity: isHovered ? 1 : 0
                        }}
                    />

                    {/* Animated border following mouse */}
                    <div className="absolute inset-0 z-0 rounded-3xl pointer-events-none p-[1.5px]"
                        style={{
                            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                            WebkitMaskComposite: 'xor',
                            maskComposite: 'exclude'
                        }}
                    >
                        <motion.div
                            className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{
                                background: borderGradient,
                            }}
                        />
                        <div className="absolute inset-0 z-0 border-[1.5px] border-white/5 opacity-100 group-hover:opacity-0 transition-opacity duration-300 rounded-3xl" />
                    </div>

                    {/* Inner content wrapper (bumped up in 3D space on hover) */}
                    <motion.div
                        style={{ transform: isHovered ? "translateZ(30px)" : "translateZ(0px)", transformStyle: "preserve-3d" }}
                        className="relative z-10 flex flex-col h-full transition-transform duration-300 w-full"
                    >
                        {/* Mode tag — top right */}
                        <div className="absolute top-0 right-0">
                            <span
                                className="text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full font-heading"
                                style={{ background: mode.tagBg, color: mode.accent }}
                            >
                                {mode.tag}
                            </span>
                        </div>

                        {/* Icon */}
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6"
                            style={{
                                background: `linear-gradient(135deg, ${mode.accent}20, ${mode.accent}05)`,
                                border: `1px solid ${mode.accent}40`,
                                boxShadow: `0 8px 24px -8px ${mode.accent}60`,
                            }}
                        >
                            <Icon style={{ color: mode.accent }} className="w-8 h-8 drop-shadow-[0_0_12px_currentColor]" />
                        </div>

                        {/* Title */}
                        <h3
                            className="text-2xl font-black mb-3 font-heading tracking-tight"
                            style={{ color: '#fff' }}
                        >
                            {mode.label}
                        </h3>

                        {/* Desc */}
                        <p className="text-[15px] leading-relaxed mb-6 font-body flex-1 text-gray-400 group-hover:text-gray-300 transition-colors">
                            {mode.desc}
                        </p>

                        {/* Feature bullets */}
                        <ul className="space-y-3 mb-8">
                            {mode.bullets.map(b => (
                                <li key={b} className="flex items-center gap-3 text-sm font-body font-medium text-gray-400 group-hover:text-gray-300 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: mode.accent, boxShadow: `0 0 10px ${mode.accent}` }} />
                                    {b}
                                </li>
                            ))}
                        </ul>

                        {/* CTA */}
                        <div
                            className="flex items-center gap-2 text-[15px] font-bold font-heading transition-all duration-300 group-hover:gap-3 mt-auto"
                            style={{ color: mode.accent, textShadow: `0 0 16px ${mode.accent}60` }}
                        >
                            {mode.cta} <ArrowRight className="w-4 h-4" />
                        </div>
                    </motion.div>
                </div>
            </Link>
        </motion.div>
    );
}

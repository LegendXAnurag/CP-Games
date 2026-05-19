'use client';

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";

export interface FeatureConfig {
    icon: LucideIcon;
    accent: string;
    title: string;
    body: string;
}

export default function FeatureCard({ feature, index }: { feature: FeatureConfig, index: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const FIcon = feature.icon;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, delay: index * 0.15, type: 'spring', damping: 20 }}
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative rounded-2xl p-[1px] overflow-hidden group h-full"
        >
            {/* Glow border that follows mouse */}
            <div
                className="absolute inset-0 z-0 transition-opacity duration-300"
                style={{
                    opacity: isHovered ? 1 : 0,
                    background: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, ${feature.accent}80, transparent 50%)`,
                }}
            />
            {/* Static border fallback */}
            <div className="absolute inset-0 z-0 opacity-100 group-hover:opacity-0 transition-opacity duration-300 rounded-2xl border border-white/5" />

            {/* Inner card */}
            <div
                className="relative z-10 w-full h-full rounded-2xl p-7 flex gap-5 bg-[#0a0a0a] transition-colors duration-300"
            >
                {/* Soft inner glow on hover */}
                <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-2xl opacity-0 group-hover:opacity-100 mix-blend-screen"
                    style={{
                        background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, ${feature.accent}15, transparent 60%)`,
                    }}
                />

                {/* Accent sidebar indicator that dims when hovering to let the flashlight take over */}
                <div
                    className="absolute left-0 top-6 bottom-6 w-[3px] opacity-70 group-hover:opacity-20 transition-opacity duration-300 rounded-r-full"
                    style={{
                        background: `linear-gradient(to bottom, transparent, ${feature.accent}, transparent)`,
                    }}
                />

                <div
                    className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center mt-0.5 z-10 relative transition-transform duration-300 group-hover:scale-110"
                    style={{
                        background: `linear-gradient(135deg, ${feature.accent}20, transparent)`,
                        border: `1px solid ${feature.accent}30`
                    }}
                >
                    <FIcon className="w-6 h-6" style={{ color: feature.accent }} />
                </div>

                <div className="z-10 relative flex-1">
                    <h4
                        className="font-black text-[16px] mb-2 font-heading tracking-wide transition-colors duration-300"
                        style={{ color: '#fff' }}
                    >
                        {feature.title}
                    </h4>
                    <p className="text-sm leading-relaxed font-body text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                        {feature.body}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

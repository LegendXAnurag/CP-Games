'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function SpotlightAurora() {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
            {/* 1. Base Dark Grid */}
            <div
                className="absolute inset-0 opacity-[0.1]"
                style={{
                    backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
                    backgroundSize: '40px 40px',
                    maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
                }}
            />

            {/* 2. Fluid Aurora Shapes */}
            <div className="absolute inset-0 opacity-50 mix-blend-screen filter blur-[100px]">
                {/* Cyan Orb */}
                <motion.div
                    animate={{
                        x: ['0%', '15%', '-5%', '0%'],
                        y: ['0%', '-15%', '10%', '0%'],
                        scale: [1, 1.2, 0.9, 1],
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[10%] left-[10%] w-[40vw] h-[40vh] rounded-full"
                    style={{ background: 'rgba(0, 240, 255, 0.35)' }}
                />
                {/* Purple Orb */}
                <motion.div
                    animate={{
                        x: ['0%', '-15%', '15%', '0%'],
                        y: ['0%', '15%', '-5%', '0%'],
                        scale: [1, 1.1, 0.8, 1],
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-[20%] right-[10%] w-[45vw] h-[45vh] rounded-full"
                    style={{ background: 'rgba(112, 0, 255, 0.3)' }}
                />
                {/* Emerald Orb */}
                <motion.div
                    animate={{
                        x: ['0%', '20%', '-15%', '0%'],
                        y: ['0%', '-10%', '20%', '0%'],
                        scale: [1, 1.3, 0.9, 1],
                    }}
                    transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[50%] left-[30%] w-[35vw] h-[35vh] rounded-full"
                    style={{ background: 'rgba(16, 185, 129, 0.2)' }}
                />
            </div>

            {/* 3. The Spotlight Reveal layer */}
            <div
                className="absolute inset-0 transition-opacity duration-300 mix-blend-screen filter blur-[80px]"
                style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 240, 255, 0.12), transparent 70%)`
                }}
            />

            {/* 4. Mouse Follow Grid Brightener */}
            <div
                className="absolute inset-0 opacity-[0.4]"
                style={{
                    backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 1px, transparent 1px)
          `,
                    backgroundSize: '40px 40px',
                    maskImage: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent 100%)`,
                    WebkitMaskImage: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent 100%)`
                }}
            />
        </div>
    );
}

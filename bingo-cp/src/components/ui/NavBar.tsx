'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const links = [
    { label: "Bingo", href: '/create-match' },
    { label: "Tug of War", href: '/tug-mode' },
    { label: "Ticket to Ride", href: '/create-ttr-match' },
    { label: "How to Play", href: '/how-to-play' },
];

export default function NavBar() {
    const pathname = usePathname();

    return (
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5"
        >
            <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
                <Link href="/" className="group flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_15px_rgba(6,182,212,0.5)] group-hover:shadow-[0_0_25px_rgba(6,182,212,0.8)] transition-all duration-300">
                        CP
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                        Games
                    </span>
                </Link>

                <div className="flex items-center gap-1">
                    {links.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link key={link.href} href={link.href}>
                                <div className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'text-white bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}>
                                    {link.label}
                                    {isActive && (
                                        <motion.div
                                            layoutId="navbar-indicator"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                </div>
                            </Link>
                        );
                    })}

                    <div className="w-px h-6 bg-white/10 mx-2" />

                    <Link href="/help">
                        <button className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                            Help
                        </button>
                    </Link>
                </div>
            </div>
        </motion.nav>
    );
}

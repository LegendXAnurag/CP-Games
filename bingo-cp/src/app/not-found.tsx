'use client';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main 
      className="min-h-screen text-white pt-24 px-6 flex flex-col items-center justify-center relative overflow-hidden" 
      style={{ background: '#050505' }}
    >
      {/* Aurora glow effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 text-center space-y-6 max-w-md w-full">
        {/* Glow icon or status */}
        <div 
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2"
          style={{ 
            background: 'rgba(6,182,212,0.05)', 
            border: '1px solid rgba(6,182,212,0.2)',
            boxShadow: '0 0 30px rgba(6,182,212,0.05)'
          }}
        >
          <span className="text-3xl font-bold text-cyan-400">404</span>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight font-heading">Page Not Found</h1>
          <p className="text-sm text-gray-400 font-body">
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>
        </div>

        <div className="pt-4">
          <Link href="/">
            <button
              className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 font-heading text-white"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                boxShadow: '0 0 20px rgba(6,182,212,0.25)',
              }}
            >
              Return Home
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}

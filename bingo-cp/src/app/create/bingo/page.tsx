'use client';
import { useEffect, useState } from 'react';
import Loading from '@/components/ui/Loading';
import MatchCreationForm from '@/components/games/bingo/MatchCreationForm';
import { Match, ProblemCell } from '@/types/match';
type solveLog = {
  id: number;
  handle: string;
  team: string;
  contestId: number;
  index: string;
  timestamp: Date;
  score: number;
  match: Match;
  matchId: string;
  problem: ProblemCell;
}
const teamColors: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  yellow: 'bg-yellow-500',
  teal: 'bg-teal-500',
};


type GridSize = 3 | 4 | 5 | 6;

const gridClasses = {
  3: "grid-cols-3 gap-x-0 gap-y-4 justify-items-center mt-4 mx-130",
  4: "grid-cols-4 gap-x-0 gap-y-4 justify-items-center mt-4 mx-110",
  5: "grid-cols-5 gap-x-0 gap-y-4 justify-items-center mt-4 mx-90",
  6: "grid-cols-6 gap-x-0 gap-y-4 justify-items-center mt-4 mx-70",
};

type LogEntry = {
  message: string;
  team: string;
}

type Problem = {
  // id: number;
  name: string;
  rating: number;
  contestId: number;
  index: string;
};
type SolvedInfo = {
  team: string;
  timestamp: string;
};

export default function Home() {
  const [showLog, setShowLog] = useState(true);
  const [currentTeam, setCurrentTeam] = useState<string>('Team Red');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridSize, setgridSize] = useState<GridSize>(5);
  const [solved, setSolved] = useState<Record<string, SolvedInfo>>({});
  const [log, setLog] = useState<LogEntry[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState("Home");

  useEffect(() => {
    if (!match?.id) return;

    const matchStart = new Date(match.startTime);
    const matchEnd = new Date(matchStart.getTime() + match.durationMinutes * 60 * 1000);

    const fetchPoll = async () => {
      const now = new Date();
      if (now < matchStart || now > matchEnd) {
        return;
      }
      try {
        const pollRes = await fetch(`/api/poll-submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: match.id }),
        });
        const pollData = await pollRes.json();

        if (pollData.updated && pollData.match) {
          setMatch(pollData.match);

          const solvedMap: Record<string, SolvedInfo> = {};
          const newLogEntries: LogEntry[] = [];

          pollData.match.solveLog.forEach((entry: solveLog) => {
            const key = `${entry.contestId}-${entry.index}`;

            solvedMap[key] = {
              team: entry.team,
              timestamp: new Date(entry.timestamp).toLocaleTimeString(),
            };

            newLogEntries.push({
              message: `${solvedMap[key].timestamp} — ${entry.team} solved problem ${key}`,
              team: entry.team.toLowerCase(), // make sure matches teamColors keys
            });
          });

          setSolved(solvedMap);

          setLog(prevLog => {
            const combined = [...newLogEntries, ...prevLog];
            const uniqueMap = new Map<string, { message: string; team: string }>();
            for (const entry of combined) {
              if (!uniqueMap.has(entry.message)) {
                uniqueMap.set(entry.message, entry);
              }
            }
            return Array.from(uniqueMap.values());
          });
        }
      } catch (err) {
        console.error('Polling submissions failed', err);
      }
    };

    const interval = setInterval(fetchPoll, 60000);
    return () => clearInterval(interval);
  }, [match?.id, match?.startTime, match?.durationMinutes]);




  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(interval);
  }, []);
  function formatDuration(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }
  function formatCountdown(ms: number): string {
    if (ms <= 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }


  function CountdownToStart({ startTime }: { startTime: Date }) {
    const [timeLeft, setTimeLeft] = useState(() => startTime.getTime() - Date.now());

    useEffect(() => {
      const interval = setInterval(() => {
        setTimeLeft(startTime.getTime() - Date.now());
      }, 1000);

      return () => clearInterval(interval);
    }, [startTime]);

    if (timeLeft <= 0) {
      return <p>Match is starting now...</p>;
    }

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    return (
      <p className="text-yellow-500">
        Match starts in {formatDuration(matchStart.getTime() - Date.now())}
      </p>
    );
  }
  useEffect(() => {
    if (!match) return;
    if (match.problems.length == 36) setgridSize(6);
    else if (match.problems.length == 25) setgridSize(5);
    else if (match.problems.length == 16) setgridSize(4);
    else setgridSize(3);
    setProblems(match.problems);
    setLoading(false);
  }, [match]);
  // function toggleSquare(i: number) {
  //   const key = `${problems[i].contestId}-${problems[i].index}`;
  //   if (solved[key]) return;
  //   const time = new Date().toLocaleTimeString();
  //   setSolved(prev => ({ ...prev, [key]: { team: currentTeam, timestamp: time } }));
  //   setLog(prev => {
  //     const newEntry = {
  //       message: `${time} — ${currentTeam} solved ${problems[i].name}`,
  //       team: currentTeam.toLowerCase(),
  //     };
  //     const combined = [newEntry, ...prev];
  //     const uniqueMap = new Map<string, typeof newEntry>();
  //     for (const entry of combined) {
  //       if (!uniqueMap.has(entry.message)) {
  //         uniqueMap.set(entry.message, entry);
  //       }
  //     }
  //     return Array.from(uniqueMap.values());
  //   });
  // }

  if (!match) {
    return (
      <main className="min-h-screen pt-24 pb-16">
        {/* Ambient glow behind hero */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-[-5%] left-[30%] w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-[140px]" />
        </div>

        {/* Branded Hero */}
        <div className="text-center mb-10 px-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.25)', boxShadow: '0 0 30px rgba(0,240,255,0.1)' }}>
            <svg className="w-7 h-7 text-[#00f0ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif italic text-white mb-3">
            Bingo{" "}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #00f0ff, #7000ff)' }}>
              Match Setup
            </span>
          </h1>
          <p className="text-[#a3a3a3] text-base max-w-md mx-auto font-body">
            Configure your 5×5 battlefield. The first team to complete a line wins.
          </p>
        </div>

        {/* Form container */}
        <div className="flex justify-center px-4">
          <MatchCreationForm onMatchCreated={setMatch} />
        </div>

        {/* How Bingo Works */}
        <div className="max-w-2xl mx-auto mt-16 px-4">
          <details className="glass rounded-2xl border border-white/5 p-6 group">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <span className="text-sm font-bold uppercase tracking-widest text-[#00f0ff] font-heading">How Bingo Works</span>
              <svg className="w-4 h-4 text-[#a3a3a3] transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-4 space-y-3 text-sm text-[#a3a3a3] font-body">
              <p><span className="text-white font-semibold">Classic mode:</span> Solve a problem → tile is permanently claimed for your team. Grid stays fixed.</p>
              <p><span className="text-white font-semibold">Replace mode:</span> Solved tiles are instantly replaced with a new problem — the board stays full.</p>
              <p><span className="text-white font-semibold">Win condition:</span> First team to complete a full row, column, or diagonal wins.</p>
              <p><span className="text-[#a3a3a3]">Tile detection is automatic — just solve on Codeforces with your registered handle.</span></p>
            </div>
          </details>
        </div>
      </main>
    );
  }

  const matchStart = new Date(match.startTime);
  const matchEnd = new Date(matchStart.getTime() + match.durationMinutes * 60 * 1000);
  const currentTime = new Date();

  const matchHasStarted = currentTime >= matchStart;
  const matchHasEnded = currentTime >= matchEnd;
  const matchOngoing = matchHasStarted && !matchHasEnded;

  return (
    <main className="min-h-screen pt-20 pb-8 px-4 transition-colors duration-300">

      {/* Slim status HUD */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest font-heading"
          style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.25)', color: '#00f0ff' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
          BINGO
        </span>

        {/* Team legend */}
        {match.teams.map((t: { name: string; color: string }) => (
          <span key={t.name} className="inline-flex items-center gap-1.5 text-xs font-semibold font-body" style={{ color: '#a3a3a3' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.name}
          </span>
        ))}

        {/* Status */}
        {!matchHasStarted && (
          <span className="text-xs font-mono text-yellow-400">
            Starts in {formatCountdown(matchStart.getTime() - now.getTime())}
          </span>
        )}
        {matchHasEnded && (
          <span className="text-xs font-mono text-red-400">MATCH ENDED</span>
        )}
        {matchOngoing && (
          <span className="text-xs font-mono text-emerald-400">
            {formatDuration(matchEnd.getTime() - now.getTime())} left
          </span>
        )}
      </div>

      {/* Show problem grid always during or after match */}
      {matchHasStarted ? (
        loading ? (
          <Loading />
        ) : (
          <div className={`grid ${gridClasses[gridSize]} gap-x-0 gap-y-4 justify-items-center mt-4 mx-70`}>
            {problems.map((problem) => {
              const key = `${problem.contestId}-${problem.index}`;
              const solvedInfo = solved[key];
              const teamColor = solvedInfo
                ? teamColors[solvedInfo.team] || 'bg-gray-500 text-white'
                : 'bg-white hover:bg-blue-100 dark:bg-gray-800 dark:hover:bg-blue-900 text-gray-800 dark:text-gray-200';

              return (
                <div
                  key={`${problem.contestId}-${problem.index}`}
                  onClick={() =>
                    window.open(
                      `https://codeforces.com/contest/${problem.contestId}/problem/${problem.index}`,
                      '_blank'
                    )
                  }
                  onMouseEnter={(e) => {
                    e.currentTarget.classList.add('scale-[1.04]', 'shadow-md');
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.classList.remove('scale-[1.04]', 'shadow-md');
                  }}
                  className={`w-36 h-24 p-2 flex flex-col justify-center items-center text-center rounded shadow cursor-pointer transition duration-200
                  ${teamColor} ${solvedInfo ? 'text-white' : ''}`}
                >
                  <div className="text-sm font-semibold">
                    {problem.rating} - {problem.index}
                  </div>
                  <div className="text-xs mt-1">{problem.name}</div>
                </div>
              );
            })}
          </div>
        )
      ) : null}

      {/* Log Panel */}
      {showLog && (
        <div
          className="fixed bottom-4 left-3 w-72 max-h-[70vh] overflow-y-auto rounded-2xl z-30 flex flex-col"
          style={{ background: 'rgba(6,6,10,0.92)', border: '1px solid rgba(0,240,255,0.12)', backdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <div className="w-1 h-4 rounded-full bg-[#00f0ff]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#00f0ff] font-heading">Solve Log</h2>
          </div>
          {log.length === 0 ? (
            <p className="text-xs text-[#4b5563] text-center py-6 font-body">No solves yet</p>
          ) : (
            <ul className="text-xs space-y-0 divide-y divide-white/5 overflow-y-auto">
              {log.map((entry, idx) => {
                const colorMap: Record<string, string> = {
                  red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
                  purple: '#a855f7', orange: '#f97316', pink: '#ec4899',
                  yellow: '#eab308', teal: '#14b8a6',
                };
                const c = colorMap[entry.team] || '#6b7280';
                return (
                  <li key={idx} className="flex items-start gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
                    <div className="w-0.5 shrink-0 self-stretch rounded-full mt-0.5" style={{ backgroundColor: c }} />
                    <span className="text-[#a3a3a3] leading-relaxed font-body">{entry.message}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setShowLog(prev => !prev)}
        className="cursor-pointer fixed bottom-4 left-[calc(1.5rem+288px+0.5rem)] px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all z-40 font-heading"
        style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.2)', color: '#00f0ff' }}
      >
        {showLog ? 'Hide Log' : 'Show Log'}
      </button>
    </main>
  );
}

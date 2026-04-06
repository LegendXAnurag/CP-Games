'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Loading from '../../Loading';
import Confetti from 'react-confetti';
import { useRef } from 'react';
import { ProblemCell } from '../../types/match'

// import { MatchStatus } from "./MatchStatus";
// import MatchCreationForm from '../../MatchCreationForm';
import TugOfWarDisplay from '../../TugOfWarDisplay';
import TTRGameDisplay from '../../ttr-mode/TTRGameDisplay';
import { Match } from '../../types/match';
// import TeamsForm from '@/app/TeamsForm';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type SolveLog = {
  contestId: number;
  index: string;
  team: string;
  problem: ProblemCell;
  timestamp?: string | number;
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
  3: "grid-cols-3 gap-4 max-w-2xl mx-auto",
  4: "grid-cols-4 gap-4 max-w-3xl mx-auto",
  5: "grid-cols-5 gap-4 max-w-4xl mx-auto",
  6: "grid-cols-6 gap-4 max-w-5xl mx-auto",
};

type LogEntry = {
  key: string;
  message: string;
  team: string;
}




type SolvedInfo = {
  team: string;

};

type Winner = {
  team: string;
  type: 'row' | 'col' | 'diag' | 'anti-diag';
  index: number;
  keys: string[];
} | null;
function useWindowSize() {
  const isClient = typeof window !== 'undefined';
  const [size, setSize] = useState({ width: isClient ? window.innerWidth : 0, height: isClient ? window.innerHeight : 0 });
  useEffect(() => {
    if (!isClient) return;
    function onResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, [isClient]);
  return size;
}

function notifyBrowser(title: string, body?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch (e) { /* ignore */ }
    return;
  }
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try { new Notification(title, { body }); } catch (e) { }
      }
    });
  }
}

function normalizeProblemsFromServer(raw: ProblemCell[]) {
  if (!Array.isArray(raw)) return [];

  const active = raw.filter(p => p && p.active !== false);
  const hasPosition = active.every(p => typeof p.position === 'number');

  if (hasPosition) {
    const byPos = new Map<number, ProblemCell>();
    for (const p of active) {
      const pos = p.position as number;
      if (!byPos.has(pos)) byPos.set(pos, p);
    }
    return Array.from(byPos.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_, p]) => p);
  }

  const seen = new Set<string>();
  const result: ProblemCell[] = [];
  for (const p of active) {
    const key = `${p.contestId}-${p.index}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

function formatTime(ts?: string | number) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  // show "1:00 PM" style time; change hour12 to false if you prefer 24h
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}




export default function Home() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId; // id is now string | undefined

  // const [showLog, setShowLog] = useState(true);
  const [currentTeam, setCurrentTeam] = useState<string>('');
  const [problems, setProblems] = useState<ProblemCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridSize, setgridSize] = useState<GridSize>(5);
  const [solved, setSolved] = useState<Record<string, SolvedInfo>>({});
  const [log, setLog] = useState<LogEntry[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [now, setNow] = useState(new Date());


  const [winner, setWinner] = useState<Winner>(null);
  const [matchLocked, setMatchLocked] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [positionOwners, setPositionOwners] = useState<Record<number, string>>({});
  const [showRatings, setShowRatings] = useState<boolean>(true);
  const [logCollapsed, setLogCollapsed] = useState(false);


  const { width, height } = useWindowSize();
  const notifiedRef = useRef<Set<string>>(new Set());

  const persistNotified = useCallback((matchId: string) => {
    const key = `notified_${matchId}`;
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(notifiedRef.current)));
    } catch { }
  }, []);

  type Team = {
    name: string;
    color: string;
  }

  const resolveTeamDisplayAndKey = useCallback((teamIdentifier: string | undefined, teamsListParam: Team[] = []) => {
    const teamsList = teamsListParam;
    if (!teamIdentifier) return { displayName: 'Unknown', teamKey: 'unknown' };

    const search = teamIdentifier.toLowerCase();
    const teamObj = teamsList.find(t =>
      (t.color ?? '').toLowerCase() === search || (t.name ?? '').toLowerCase() === search
    );

    const displayName = teamObj?.name ?? teamIdentifier;
    const teamKey = (teamObj?.color ?? teamIdentifier ?? 'unknown').toLowerCase();

    return { displayName, teamKey };
  }, []);

  const findWinnerFromSolved = useCallback((solvedMap: Record<string, SolvedInfo>, problemsArr: ProblemCell[], gSize: number): Winner => {
    if (!problemsArr || problemsArr.length === 0) return null;

    const size = gSize;

    if (problemsArr.length !== size * size) {
      console.warn(`findWinnerFromSolved: mismatch problems.length (${problemsArr.length}) vs expected (${size * size}). Skipping winner detection.`);
      return null;
    }
    const ownerGrid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
    for (let i = 0; i < problemsArr.length; i++) {
      const r = Math.floor(i / size);
      const c = i % size;
      ownerGrid[r][c] = solvedMap[i]?.team ?? positionOwners[i] ?? null;
    }

    // rows
    for (let r = 0; r < size; r++) {
      const first = ownerGrid[r][0];
      if (first && ownerGrid[r].every(cell => cell === first)) {
        const keys = Array.from({ length: size }, (_, c) => `${problemsArr[r * size + c].contestId}-${problemsArr[r * size + c].index}`);
        return { team: first, type: 'row', index: r, keys };
      }
    }

    // columns
    for (let c = 0; c < size; c++) {
      const first = ownerGrid[0][c];
      if (first && ownerGrid.every(row => row[c] === first)) {
        const keys = Array.from({ length: size }, (_, r) => `${problemsArr[r * size + c].contestId}-${problemsArr[r * size + c].index}`);
        return { team: first, type: 'col', index: c, keys };
      }
    }

    // main diagonal
    const firstDiag = ownerGrid[0][0];
    if (firstDiag && ownerGrid.every((row, i) => row[i] === firstDiag)) {
      const keys = Array.from({ length: size }, (_, i) => `${problemsArr[i * size + i].contestId}-${problemsArr[i * size + i].index}`);
      return { team: firstDiag, type: 'diag', index: 0, keys };
    }

    // anti-diagonal
    const firstAnti = ownerGrid[0][size - 1];
    if (firstAnti && ownerGrid.every((row, i) => row[size - 1 - i] === firstAnti)) {
      const keys = Array.from({ length: size }, (_, i) => `${problemsArr[i * size + (size - 1 - i)].contestId}-${problemsArr[i * size + (size - 1 - i)].index}`);
      return { team: firstAnti, type: 'anti-diag', index: 1, keys };
    }

    return null;
  }, [positionOwners]);


  useEffect(() => {
    if (match && typeof match.showRatings === 'boolean') {
      setShowRatings(Boolean(match.showRatings));
    }
  }, [match]); // match.showRatings is derived from match so implicit dependency on match is better or verify structure
  useEffect(() => {
    if (!match?.id) return;
    const key = `notified_${match.id}`;
    const raw = localStorage.getItem(key);
    try {
      const arr = raw ? JSON.parse(raw) : [];
      notifiedRef.current = new Set(arr);
    } catch {
      notifiedRef.current = new Set();
    }
  }, [match?.id]);




  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const fetchMatch = async () => {
      try {
        const res = await fetch(`/api/getMatch?matchId=${encodeURIComponent(id)}`);
        if (!res.ok) {
          console.error('Failed to fetch match', await res.text());
          setMatch(null);
          setLoading(false);
          return;
        }

        let data;
        try {
          data = await res.json();
        } catch (e) {
          console.error("Invalid JSON from getMatch");
          setMatch(null);
          return;
        }

        const matchObj = data.match ?? data;
        setMatch(matchObj);
        try {
          const solvedMap: Record<number, SolvedInfo> = {};
          const newLogEntries: LogEntry[] = [];
          const posOwners: Record<number, string> = {};

          const teamsFromServer = matchObj.teams ?? [];

          (matchObj.solveLog ?? []).forEach((entry: SolveLog) => {
            const key = `${entry.contestId}-${entry.index}`;
            const { displayName, teamKey } = resolveTeamDisplayAndKey(entry.team, teamsFromServer);
            if (entry.problem && typeof entry.problem.position === 'number') {
              solvedMap[entry.problem.position] = {
                team: teamKey,
              };
            }
            if (entry.problem && typeof entry.problem.position === 'number') {
              posOwners[entry.problem.position] = teamKey;
            }

            const problemName = entry.problem?.name ?? `Problem ${entry.index}`;
            const contestAndIndex = `${entry.contestId}${entry.index}`;
            const solveTime = entry.timestamp;
            newLogEntries.push({
              key,
              message: `${displayName} solved ${problemName} (${contestAndIndex}) at ${formatTime(solveTime)}`,
              team: teamKey,
            });
          });
          setPositionOwners(posOwners);  // <-- set state

          setLog(prev => {
            const combined = [...newLogEntries, ...prev];
            const uniqueMap = new Map<string, LogEntry>();
            for (const e of combined) {
              if (!uniqueMap.has(e.key)) uniqueMap.set(e.key, e);
            }
            return Array.from(uniqueMap.values());//.slice(0, 10);
          });
          setSolved(solvedMap);

        } catch (e) {
          console.warn('Could not build solved/log from matchObj.solveLog', e);
        }

      } catch (err) {
        console.error('Error fetching match', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [id, resolveTeamDisplayAndKey]);
  useEffect(() => {
    if (!match) return;

    // prefer DB value; fall back to computing from problems length
    const dbGrid = (match as Match).gridSize; // typed properly if your Match type includes gridSize
    if (typeof dbGrid === 'number' && [3, 4, 5, 6].includes(dbGrid)) {
      setgridSize(dbGrid as GridSize);
    } else {
      // compute if server didn't provide it (safety)
      const len = match.problems?.length ?? problems.length ?? 25;
      const computed = [3, 4, 5, 6].find(n => n * n === len) ?? 5;
      setgridSize(computed as GridSize);
    }
    const normalized = normalizeProblemsFromServer(match.problems || []);
    setProblems(normalized);
    setLoading(false);
  }, [match, problems.length]);





  useEffect(() => {
    if (match?.teams?.length && !currentTeam) {
      setCurrentTeam(match.teams[0].color);
    }
  }, [match, currentTeam]);


  useEffect(() => {
    if (matchLocked) return;
    if (!match?.id) return;

    const matchStart = new Date(match.startTime);
    // const durationMinutes = (match.timeoutMinutes ?? match.durationMinutes);
    // const timeStartWinner = new Date(matchStart.getTime() + durationMinutes * 60 * 1000); // Unused variable
    const matchEnd = new Date(matchStart.getTime() + match.durationMinutes * 60 * 1000);

    const fetchPoll = async () => {
      const now = new Date();
      if (now < matchStart || now > matchEnd) {
        return;
      }
      try {
        const pollRes = await fetch('/api/poll-submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: match.id }),
        });
        if (!pollRes.ok) {
          console.error('Polling submissions returned non-OK', await pollRes.text());
          return;
        }
        const pollData = await pollRes.json();
        const oldlength = Array.isArray(match?.problems) ? match!.problems!.length : 0;
        const serverProblemsLen = Array.isArray(pollData.match?.problems) ? pollData.match.problems.length : 0;
        const serverSolveLen = Array.isArray(pollData.match?.solveLog) ? pollData.match.solveLog.length : 0;
        const localSolveLen = Array.isArray(match?.solveLog) ? match!.solveLog!.length : 0;

        const shouldApply =
          Boolean(pollData.updated) ||
          serverProblemsLen !== oldlength ||
          serverSolveLen !== localSolveLen;

        if (pollData.match && shouldApply) {
          setMatch(pollData.match);

          const solvedMap: Record<string, SolvedInfo> = {};
          const newLogEntries: LogEntry[] = [];
          const posOwners: Record<number, string> = {};

          const problemUpdates: Record<string, { name?: string; rating?: number; contestId?: number; index?: string }> = {};

          const teamsFromServer = pollData.match?.teams ?? [];
          pollData.match.solveLog.forEach((entry: SolveLog) => {
            const key = `${entry.contestId}-${entry.index}`;
            const { displayName, teamKey } = resolveTeamDisplayAndKey(entry.team, teamsFromServer);
            solvedMap[key] = {
              team: teamKey,
            };

            if (entry.problem && typeof entry.problem.position === 'number') {
              posOwners[entry.problem.position] = teamKey;
            }

            if (entry.problem) {
              problemUpdates[key] = {
                name: entry.problem.name ?? undefined,
                rating: entry.problem.rating ?? undefined,
                contestId: entry.contestId,
                index: entry.index,
              };
            }


            const problemName = entry.problem?.name ?? `Problem ${entry.index}`;
            const contestAndIndex = `${entry.contestId}${entry.index}`;
            const solveTime = entry.timestamp;
            newLogEntries.push({
              key,
              message: `${displayName} solved ${problemName} (${contestAndIndex}) at ${formatTime(solveTime)}`,
              team: teamKey,
            });
          });

          setSolved(solvedMap);
          setPositionOwners(posOwners);

          if (pollData.match?.problems && Array.isArray(pollData.match.problems)) {
            const normalized = normalizeProblemsFromServer(pollData.match.problems);
            setProblems(normalized);
          } else if (Object.keys(problemUpdates).length > 0) {
            setProblems(prev =>
              prev.map(p => {
                const k = `${p.contestId}-${p.index}`;
                const upd = problemUpdates[k];
                if (!upd) return p;
                return {
                  ...p,
                  name: upd.name ?? p.name,
                  rating: upd.rating ?? p.rating,
                  contestId: upd.contestId ?? p.contestId,
                  index: upd.index ?? p.index,
                };
              })
            );
          }

          setSolved(solvedMap);
          setPositionOwners(posOwners);

          setLog(prevLog => {
            const combined = [...newLogEntries, ...prevLog];
            const uniqueMap = new Map<string, LogEntry>();
            for (const entry of combined) {
              if (!uniqueMap.has(entry.key)) uniqueMap.set(entry.key, entry);
            }
            const deduped = Array.from(uniqueMap.values());//.slice(0, 10);

            const prevMessages = new Set(prevLog.map(x => x.message));
            newLogEntries.forEach(ne => {
              if (!prevMessages.has(ne.message) && !notifiedRef.current.has(ne.message)) {
                notifyBrowser("Solve reported", ne.message);
                notifiedRef.current.add(ne.message);
              }
            });
            if (pollData.match?.id) persistNotified(pollData.match.id);

            return deduped;
          });

        }
      } catch (err) {
        console.error('Polling submissions failed', err);
      }
    };

    const pollInterval = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS) || 15000;
    const interval = setInterval(fetchPoll, pollInterval);
    return () => clearInterval(interval);
  }, [match?.id, match?.startTime, match?.durationMinutes, matchLocked, resolveTeamDisplayAndKey, match?.problems, match?.solveLog, persistNotified]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!match) return;
    const start = new Date(match.startTime);
    const end = new Date(start.getTime() + match.durationMinutes * 60 * 1000);
    const now = new Date();

    if (now >= end) {
      setMatchLocked(true);
    }
  }, [match]);

  // useEffect(() => {
  //   if (!match) return;
  //   // console.log("for crying out loud: ", match.problems)
  //   const len = match.problems?.length ?? 0;
  //   if(len === 36) setgridSize(6 as GridSize);
  //   else if(len === 25) setgridSize(5 as GridSize);
  //   else if(len === 16) setgridSize(4 as GridSize);
  //   else setgridSize(3 as GridSize);
  //   const normalized = normalizeProblemsFromServer(match.problems || []);
  //   setProblems(normalized);
  //   setLoading(false);
  // }, [match]);
  function formatDuration(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }
  // function formatCountdown(ms: number): string { // Unused
  //   if (ms <= 0) return "00:00:00";
  //   const totalSeconds = Math.floor(ms / 1000);
  //   const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  //   const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  //   const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  //   return `${hours}:${minutes}:${seconds}`;
  // }


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

    // const minutes = Math.floor(timeLeft / 60000); // Unused
    // const seconds = Math.floor((timeLeft % 60000) / 1000); // Unused

    return (
      <p className="text-yellow-500">
        Match starts in {formatDuration(startTime.getTime() - Date.now())}
      </p>
    );
  }


  useEffect(() => {
    if (!problems || problems.length === 0) return;
    if (matchLocked) return; // already locked
    if (!match) {
      console.warn(`match was not found. skipping winner detection`);
      return;
    }
    const matchStart = new Date(match.startTime);
    const timeout = match.timeoutMinutes ?? 0;
    const timeStartWinner = new Date(matchStart.getTime() + timeout * 60 * 1000);
    const now = new Date();
    if (now < timeStartWinner) return;
    // console.log("HHHEHEHE:")
    const w = findWinnerFromSolved(solved, problems, gridSize);
    if (w && !winner) {
      setWinner(w);
      setConfettiActive(true);
      setMatchLocked(true);
      const teamKey = (w.team ?? '').toLowerCase();
      const teamObj = match?.teams?.find(
        t => (t.color ?? '').toLowerCase() === teamKey || (t.name ?? '').toLowerCase() === teamKey
      );
      const displayName = teamObj?.name ?? teamKey ?? 'Unknown';

      setLog(prev => {
        const finalMsg = `${displayName} completed ${w.type === 'row' ? 'a row' : w.type === 'col' ? 'a column' : w.type === 'diag' ? 'the main diagonal' : 'the anti-diagonal'} and won the match!`;
        notifyBrowser(`${displayName} won!`, finalMsg);
        return [{ message: finalMsg, team: w.team.toLowerCase(), key: "" }, ...prev];//.slice(0, 10);
      });
      (async () => {
        try {
          const resp = await fetch('/api/match/setDuration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: match.id, durationMinutes: 1 }),
          });

          if (!resp.ok) {
            console.error('Failed to update match duration on server:', await resp.text());
          } else {
            try {
              await resp.json();
              // optimistic local update so UI shows locked/timer immediately
              setMatch(prev => prev ? { ...prev, durationMinutes: 1 } : prev);
            } catch (e) {
              console.warn("setDuration returned invalid JSON, but status was OK");
            }
          }
        } catch (err) {
          console.error('Error calling set-duration API', err);
        }
      })();
    }
  }, [solved, problems, winner, positionOwners, match, matchLocked, findWinnerFromSolved, gridSize]);

  // toggleSquare function refactored or removed as it was unused and had lint error



  if (loading) return <Loading />;
  if (!match) {
    return <main className="p-6">Match not found</main>;
  }

  const matchStart = new Date(match.startTime);
  const durationMinutes = (match.timeoutMinutes ?? 0);
  const timeStartWinner = new Date(matchStart.getTime() + durationMinutes * 60 * 1000);
  const matchEnd = new Date(matchStart.getTime() + match.durationMinutes * 60 * 1000);
  const currentTime = new Date();

  const matchHasStarted = currentTime >= matchStart;
  const matchHasEnded = currentTime >= matchEnd;
  const matchOngoing = matchHasStarted && !matchHasEnded && !matchLocked;

  // ── TTR mode: escape the padded page layout, fill all remaining viewport space
  if (match.mode === 'ttr') {
    return (
      <main className="text-white" style={{ background: '#050505' }}>
        {winner && confettiActive && <Confetti width={width} height={height} recycle={false} numberOfPieces={300} />}
        {/* Navbar is 64px (pt-16). This div fills exactly the remaining viewport. */}
        <div style={{ paddingTop: '64px', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TTRGameDisplay match={match} currentTeam={currentTeam} setCurrentTeam={setCurrentTeam} hasStarted={matchHasStarted} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white pt-16" style={{ background: '#050505' }}>

      {/* Confetti on winner */}
      {winner && confettiActive && <Confetti width={width} height={height} recycle={false} numberOfPieces={300} />}

      <div className="flex flex-col lg:flex-row gap-6 px-4 md:px-8 pt-6 max-w-[1600px] mx-auto">
        {/* Main Content Area (Grid or Tug) */}
        <div className="flex-1 min-w-0">
          {/* Match Status Badge — hidden for TTR which has its own built-in timer */}
          {match.mode !== 'ttr' && (
            <div className="flex justify-center mt-4 mb-6">
              {!matchHasStarted && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border"
                  style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)', color: '#facc15' }}>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <CountdownToStart startTime={matchStart} />
                </div>
              )}
              {matchHasEnded && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  Match Ended
                </div>
              )}
              {matchOngoing && match && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Ends in {formatDuration(matchEnd.getTime() - Date.now())}
                </div>
              )}
            </div>
          )}

          {/* Show problem grid always during or after match, or always for TTR to allow joining */}
          {(matchHasStarted || match.mode === 'ttr') ? (
            loading ? (
              <Loading />
            ) : match.mode === 'tug' ? (
              <TugOfWarDisplay
                match={match}
                problems={problems}
                solved={solved}
                positionOwners={positionOwners}
                showRatings={showRatings}
                teamColors={teamColors}
              />
            ) : match.mode === 'ttr' ? (
              <TTRGameDisplay match={match} currentTeam={currentTeam} setCurrentTeam={setCurrentTeam} hasStarted={matchHasStarted} />
            ) : (
              <div className={`grid ${gridClasses[gridSize]} px-2 sm:px-4 w-full`}>
                {problems.map((problem, idx) => {
                  const key = `${problem.contestId}-${problem.index}`;
                  const solvedInfo = solved[key];
                  const ownerTeam = solvedInfo?.team ?? positionOwners[problem.position ?? idx];
                  const isWinningCell = winner?.keys?.includes(key);
                  const isOwned = Boolean(ownerTeam);

                  // Map color name to hex for inline styles
                  const colorHexMap: Record<string, string> = {
                    red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
                    purple: '#a855f7', orange: '#f97316', pink: '#ec4899',
                    yellow: '#eab308', teal: '#14b8a6',
                  };
                  const ownerColorHex = ownerTeam ? (colorHexMap[ownerTeam] || '#6b7280') : null;

                  return (
                    <div
                      key={key}
                      onClick={() => window.open(`https://codeforces.com/contest/${problem.contestId}/problem/${problem.index}`, '_blank')}
                      className="w-full aspect-[4/3] min-h-[3rem] flex flex-col justify-center items-center text-center rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group"
                      style={isWinningCell ? {
                        background: 'rgba(250,204,21,0.12)',
                        border: '2px solid rgba(250,204,21,0.7)',
                        boxShadow: '0 0 20px rgba(250,204,21,0.25)',
                        transform: 'scale(1.04)',
                      } : isOwned && ownerColorHex ? {
                        background: `${ownerColorHex}20`,
                        border: `2px solid ${ownerColorHex}60`,
                        boxShadow: `0 0 14px ${ownerColorHex}20`,
                      } : {
                        background: 'rgba(13,13,13,0.85)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                      onMouseEnter={e => {
                        if (!isOwned && !isWinningCell) {
                          e.currentTarget.style.border = '1px solid rgba(0,240,255,0.3)';
                          e.currentTarget.style.boxShadow = '0 0 14px rgba(0,240,255,0.08)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isOwned && !isWinningCell) {
                          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      {/* Winning shimmer */}
                      {isWinningCell && (
                        <div className="absolute inset-0 animate-pulse" style={{ background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.12) 0%, transparent 70%)' }} />
                      )}
                      {/* Owned radial glow */}
                      {isOwned && ownerColorHex && !isWinningCell && (
                        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse at center, ${ownerColorHex} 0%, transparent 70%)` }} />
                      )}

                      {showRatings && (
                        <div className="text-[10px] sm:text-xs font-bold mb-0.5 relative z-10"
                          style={{ color: isWinningCell ? '#facc15' : isOwned && ownerColorHex ? ownerColorHex : '#6b7280' }}>
                          ★ {problem.rating} · {problem.index}
                        </div>
                      )}
                      <div className={`font-semibold leading-snug px-1 relative z-10 ${showRatings ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}
                        style={{ color: isOwned || isWinningCell ? '#fff' : '#9ca3af' }}>
                        {problem.name}
                      </div>

                      {/* Owner checkmark */}
                      {isOwned && ownerColorHex && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center z-10"
                          style={{ backgroundColor: ownerColorHex, boxShadow: `0 0 6px ${ownerColorHex}` }}>
                          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : null}
        </div>

        {/* Solve Log Panel — hidden for TTR mode (TTR has its own) */}
        {match.mode !== 'ttr' && (
          <div className={`shrink-0 mt-8 lg:mt-0 transition-all duration-300 ease-in-out ${logCollapsed ? 'w-full lg:w-10' : 'w-full lg:w-80'}`}>
            <div
              className={`lg:sticky lg:top-6 flex flex-col rounded-xl overflow-hidden transition-all duration-300 ${logCollapsed ? 'h-auto' : 'h-80 lg:h-[calc(100vh-6rem)]'}`}
              style={{ background: 'rgba(10,10,10,0.8)', border: '1px solid rgba(0,240,255,0.1)', backdropFilter: 'blur(12px)' }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                style={{ borderBottom: logCollapsed ? 'none' : '1px solid rgba(0,240,255,0.08)' }}
                onClick={() => setLogCollapsed(!logCollapsed)}
              >
                {!logCollapsed && (
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-[#00f0ff]" />
                    <span className="text-sm font-black uppercase tracking-[0.2em] text-[#00f0ff]">Solve Log</span>
                  </div>
                )}
                <button
                  className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors"
                  style={{ color: '#00f0ff', background: 'rgba(0,240,255,0.08)' }}
                >
                  {logCollapsed ? '▶' : 'Hide'}
                </button>
              </div>

              {/* Entries */}
              {!logCollapsed && (
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                  {log.length === 0 ? (
                    <p className="text-xs text-[#4b5563] text-center py-8 font-mono uppercase tracking-wider">No solves yet...</p>
                  ) : (
                    log.map((entry, idx) => {
                      const colorHexMap: Record<string, string> = {
                        red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
                        purple: '#a855f7', orange: '#f97316', pink: '#ec4899',
                        yellow: '#eab308', teal: '#14b8a6',
                      };
                      const colorHex = colorHexMap[entry.team] || '#6b7280';
                      return (
                        <div
                          key={idx}
                          className="text-xs px-3 py-2 rounded-lg"
                          style={{
                            background: `${colorHex}10`,
                            borderLeft: `3px solid ${colorHex}`,
                            color: '#d1d5db',
                          }}
                        >
                          {entry.message}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )} {/* end: mode !== 'ttr' solve log */}
      </div>
    </main>
  );
}


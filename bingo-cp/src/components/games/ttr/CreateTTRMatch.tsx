"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, TrainFront } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import TTRTeamsForm from "./TTRTeamsForm";

export default function CreateTTRMatch() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [date, setDate] = useState(() => {
        const now = new Date();
        const future = new Date(now.getTime() + 2 * 60000);
        return future.getFullYear() + '-' + String(future.getMonth() + 1).padStart(2, '0') + '-' + String(future.getDate()).padStart(2, '0');
    });
    const [time, setTime] = useState(() => {
        const now = new Date();
        const future = new Date(now.getTime() + 2 * 60000);
        return String(future.getHours()).padStart(2, '0') + ':' + String(future.getMinutes()).padStart(2, '0');
    });
    const [gameDuration, setGameDuration] = useState("120");
    const [initialCoins, setInitialCoins] = useState<number>(0);
    const [problemsPerLevel, setProblemsPerLevel] = useState(5);

    const [level1, setLevel1] = useState({ min: 800, max: 900, count: 5, coins: 2 });
    const [level2, setLevel2] = useState({ min: 1000, max: 1100, count: 5, coins: 3 });
    const [level3, setLevel3] = useState({ min: 1200, max: 1400, count: 5, coins: 4 });
    const [level4, setLevel4] = useState({ min: 1500, max: 3500, count: 5, coins: 5 });

    const [teams, setTeams] = useState<any[]>([
        { name: "Team Red", color: "red", members: [""] },
        { name: "Team Blue", color: "blue", members: [""] },
    ]);
    const [maps, setMaps] = useState<any[]>([]);
    const [selectedMapId, setSelectedMapId] = useState<string>("");

    useEffect(() => {
        console.log("Fetching maps in CreateTTRMatch...");
        fetch('/api/ttr/maps')
            .then(async res => {
                if (!res.ok) throw new Error("Failed to fetch maps");
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error("Invalid JSON from maps API:", text.substring(0, 100));
                    throw new Error("Invalid server response");
                }
            })
            .then(data => {
                console.log("Maps fetched:", data);
                if (Array.isArray(data)) {
                    setMaps(data);
                } else if (data && Array.isArray(data.data)) {
                    setMaps(data.data);
                } else {
                    console.error("Maps data is not an array:", data);
                    setMaps([]);
                }
            })
            .catch(err => console.error("Error fetching maps:", err));
    }, []);

    const handleSubmit = async () => {
        if (!date || !time) {
            setError("Please switch to 'Game Settings' and select Date and Time");
            return;
        }

        if (teams.length < 2) {
            setError("At least 2 teams are required");
            return;
        }

        if (!selectedMapId) {
            setError("Please select a map");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const startTime = new Date(`${date}T${time}`).toISOString();

            const payload = {
                startTime,
                ttrParams: {
                    gameDurationMinutes: parseInt(gameDuration),
                    level1: { ...level1, count: problemsPerLevel },
                    level2: { ...level2, count: problemsPerLevel },
                    level3: { ...level3, count: problemsPerLevel },
                    level4: { ...level4, count: problemsPerLevel },
                    mapId: selectedMapId || undefined,
                    initialCoins: initialCoins
                },
                teams
            };
            const res = await fetch('/api/createTTRMatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const text = await res.text();
                let errorMessage = `Server error (${res.status}): ${res.statusText}`;
                try {
                    const data = JSON.parse(text);
                    if (data.message || data.error) {
                        errorMessage = data.message || data.error;
                    }
                } catch (e) {
                    console.error("Create match error response:", text.substring(0, 100));
                }
                throw new Error(errorMessage);
            }

            const data = await res.json();
            router.push(`/match/${data.id}`);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            {/* ── Branded Hero ── */}
            <div className="text-center space-y-4 pb-4">
                <div
                    className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 0 30px rgba(16,185,129,0.1)' }}
                >
                    <TrainFront className="w-7 h-7 text-emerald-400" />
                </div>
                <h1 className="text-4xl md:text-5xl font-serif italic text-white">
                    Ticket to Ride{" "}
                    <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                        Match Setup
                    </span>
                </h1>
                <p className="text-[#a3a3a3] max-w-md mx-auto font-body">
                    Configure your map, levels, and teams. Earn coins. Claim routes. Win.
                </p>
            </div>

            {/* CTA at top right on desktop */}
            <div className="flex justify-end">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed font-heading"
                    style={{
                        background: loading ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #06b6d4)',
                        boxShadow: loading ? 'none' : '0 0 20px rgba(16,185,129,0.25)',
                        color: '#fff',
                    }}
                >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Creating...' : 'Create Match'}
                </button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="settings" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="settings">Game Settings</TabsTrigger>
                    <TabsTrigger value="levels">Problem Levels</TabsTrigger>
                    <TabsTrigger value="teams">Teams</TabsTrigger>
                </TabsList>

                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Schedule & Duration</CardTitle>
                            <CardDescription>When should the game start?</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Time</Label>
                                    <Input
                                        type="time"
                                        value={time}
                                        onChange={(e) => setTime(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Map</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50 text-gray-100"
                                    value={selectedMapId}
                                    onChange={(e) => setSelectedMapId(e.target.value)}
                                >
                                    <option value="" disabled className="bg-[#0a0a0a] text-white">Select a Map...</option>
                                    {maps.map(m => (
                                        <option key={m.id} value={m.id} className="bg-[#0a0a0a] text-white">{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Duration (Minutes)</Label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="30" max="360" step="15"
                                        value={gameDuration}
                                        onChange={(e) => setGameDuration(e.target.value)}
                                        className="flex-1 accent-emerald-500"
                                    />
                                    <span
                                        className="w-16 text-center text-sm font-bold font-mono tabular-nums px-2 py-1 rounded-lg font-mono"
                                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}
                                    >
                                        {gameDuration}m
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Initial Coins</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={initialCoins}
                                    onChange={(e) => setInitialCoins(parseInt(e.target.value) || 0)}
                                    className="max-w-xs"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="levels">
                    <Card>
                        <CardHeader>
                            <CardTitle>Problem Levels</CardTitle>
                            <CardDescription>Configure difficulty ranges for each color level.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2 pb-4 border-b">
                                <Label className="text-base font-semibold">Questions per Level</Label>
                                <p className="text-sm text-muted-foreground pb-2">
                                    Number of problems available in the market for each level.
                                </p>
                                <Input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={problemsPerLevel}
                                    onChange={(e) => setProblemsPerLevel(parseInt(e.target.value) || 1)}
                                    className="max-w-xs"
                                />
                            </div>

                            {[1, 2, 3, 4].map(l => {
                                const level = l === 1 ? level1 : l === 2 ? level2 : l === 3 ? level3 : level4;
                                const setLevel = l === 1 ? setLevel1 : l === 2 ? setLevel2 : l === 3 ? setLevel3 : setLevel4;
                                const LEVEL_COLORS = [
                                    { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', label: 'Easy' },
                                    { color: '#eab308', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)', label: 'Medium' },
                                    { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', label: 'Hard' },
                                    { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: 'Expert' },
                                ];
                                const lc = LEVEL_COLORS[l - 1];

                                return (
                                    <div
                                        key={l}
                                        className="rounded-xl p-4 space-y-3"
                                        style={{ background: lc.bg, borderTop: `2px solid ${lc.color}50`, border: `1px solid ${lc.border}` }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full font-heading"
                                                style={{ color: lc.color, background: `${lc.color}15`, border: `1px solid ${lc.border}` }}
                                            >
                                                L{l} · {lc.label}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-[#a3a3a3]">Min Rating</Label>
                                                <Input
                                                    type="number"
                                                    value={level.min}
                                                    onChange={(e) => setLevel({ ...level, min: parseInt(e.target.value) })}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-[#a3a3a3]">Max Rating</Label>
                                                <Input
                                                    type="number"
                                                    value={level.max}
                                                    onChange={(e) => setLevel({ ...level, max: parseInt(e.target.value) })}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-[#a3a3a3]">Coins Reward</Label>
                                                <Input
                                                    type="number"
                                                    value={level.coins}
                                                    onChange={(e) => setLevel({ ...level, coins: parseInt(e.target.value) })}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );

                            })}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="teams">
                    <Card>
                        <CardHeader>
                            <CardTitle>Teams</CardTitle>
                            <CardDescription>Add teams and members (Max 6 teams).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TTRTeamsForm teams={teams} onTeamsChange={setTeams} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* How TTR Works */}
            <details className="glass rounded-2xl border border-white/5 p-6 group mt-4">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                    <span className="text-sm font-bold uppercase tracking-widest text-emerald-400 font-heading">How Ticket to Ride Works</span>
                    <svg className="w-4 h-4 text-[#a3a3a3] transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </summary>
                <div className="mt-4 space-y-2 text-sm text-[#a3a3a3] font-body">
                    <p><span className="text-white font-semibold">Solve problems</span> to earn coins — harder problems = more coins per solve.</p>
                    <p><span className="text-white font-semibold">Spend coins</span> to claim train routes on the map. Each route has a coin cost equal to its length.</p>
                    <p><span className="text-white font-semibold">Destination tickets</span> give bonus points when you complete a route between two cities.</p>
                    <p><span className="text-white font-semibold">Win condition:</span> The team with the most points when time expires wins.</p>
                </div>
            </details>
        </div>
    );
}

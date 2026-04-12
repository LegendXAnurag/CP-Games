"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, Bomb } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import TTRTeamsForm from "../create-ttr-match/TTRTeamsForm";

export default function CreateBombMatch() {
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
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
    const [initialPoints, setInitialPoints] = useState(100);

    const [minRating, setMinRating] = useState(800);
    const [maxRating, setMaxRating] = useState(1200);

    const [teams, setTeams] = useState<any[]>([
        { name: "Team Red", color: "red", members: [""] },
        { name: "Team Blue", color: "blue", members: [""] },
    ]);

    const handleSubmit = async () => {
        if (!date || !time) {
            setError("Please switch to 'Game Settings' and select Date and Time");
            return;
        }

        if (teams.length < 2) {
            setError("At least 2 teams are required");
            return;
        }
        if (teams.length > 10) {
            setError("Maximum 10 teams allowed for Pass the Bomb.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const startTime = new Date(`${date}T${time}`).toISOString();

            const payload = {
                startTime,
                bombParams: {
                    gameDurationMinutes: parseInt(gameDuration),
                    timeLimitMinutes,
                    initialPoints,
                    minRating,
                    maxRating
                },
                teams
            };
            const res = await fetch('/api/createBombMatch', {
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
                } catch (e) {}
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
            <div className="text-center space-y-4 pb-4">
                <div
                    className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 0 30px rgba(239,68,68,0.1)' }}
                >
                    <Bomb className="w-7 h-7 text-red-500" />
                </div>
                <h1 className="text-4xl md:text-5xl font-serif italic text-white">
                    Pass the <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #ef4444, #f97316)' }}>Bomb</span>
                </h1>
                <p className="text-[#a3a3a3] max-w-md mx-auto font-body">
                    Solve before the timer explodes. Pass the bomb. Survive.
                </p>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed font-heading"
                    style={{
                        background: loading ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #ef4444, #f97316)',
                        boxShadow: loading ? 'none' : '0 0 20px rgba(239,68,68,0.25)',
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
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="settings">Game Settings</TabsTrigger>
                    <TabsTrigger value="teams">Teams</TabsTrigger>
                </TabsList>

                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Schedule & Settings</CardTitle>
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
                            
                            <div className="space-y-2 pt-4">
                                <Label>Total Match Duration (Minutes)</Label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="30" max="360" step="15"
                                        value={gameDuration}
                                        onChange={(e) => setGameDuration(e.target.value)}
                                        className="flex-1 accent-red-500"
                                    />
                                    <span className="w-16 text-center text-sm font-bold font-mono tabular-nums px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                                        {gameDuration}m
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 mt-4">
                                <div className="space-y-2">
                                    <Label>Bomb Timer Limit (Minutes)</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={timeLimitMinutes}
                                        onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 10)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Initial Problem Points</Label>
                                    <Input
                                        type="number"
                                        min="50"
                                        value={initialPoints}
                                        onChange={(e) => setInitialPoints(parseInt(e.target.value) || 100)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 mt-4">
                                <div className="space-y-2">
                                    <Label>Min Rating</Label>
                                    <Input
                                        type="number"
                                        min="800"
                                        value={minRating}
                                        onChange={(e) => setMinRating(parseInt(e.target.value) || 800)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Rating</Label>
                                    <Input
                                        type="number"
                                        min="800"
                                        value={maxRating}
                                        onChange={(e) => setMaxRating(parseInt(e.target.value) || 1200)}
                                    />
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="teams">
                    <Card>
                        <CardHeader>
                            <CardTitle>Teams</CardTitle>
                            <CardDescription>Add teams and members (Max 10 teams).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TTRTeamsForm teams={teams} onTeamsChange={setTeams} /* Using TTR teams form as it supports multiple dynamic teams well */ />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

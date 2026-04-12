"use client";
import type { Match, Team } from "../types/match";

import { useState } from "react";
import TugTeamsForm from "./TugTeamsForm";
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TugMatchCreationFormProps = {
    onMatchCreated: (match: Match) => void;
};

const TugMatchCreationForm: React.FC<TugMatchCreationFormProps> = ({ }) => {
    const router = useRouter();
    type TeamInput = {
        name: string;
        color: string;
        members: string[];
    };

    const [teams, setTeams] = useState<TeamInput[]>([
        { name: "Team Red", color: "red", members: [""] },
        { name: "Team Blue", color: "blue", members: [""] },
    ]);

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
    const [durationMins, setDurationMins] = useState(60);
    const [minRating, setMinRating] = useState(800);
    const [maxRating, setMaxRating] = useState(1600);
    const [tugThreshold, setTugThreshold] = useState<number>(2000);
    const [tugType, setTugType] = useState<"grid" | "single">("single");
    const [selectedGridSize, setSelectedGridSize] = useState<number>(5);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeoutMinutes, setTimeoutMinutes] = useState("0:00");
    const [showRatings, setShowRatings] = useState<boolean>(true);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // Tug mode requires exactly 2 teams
        if (teams.length !== 2) {
            alert("Tug of War mode requires exactly 2 teams.");
            return;
        }

        const usedColors = new Set();
        for (const team of teams) {
            if (!team.name.trim()) {
                alert("Each team must have a name.");
                return;
            }
            if (!team.color || usedColors.has(team.color)) {
                alert("Each team must have a unique color.");
                return;
            }
            usedColors.add(team.color);

            if (team.members.length < 1 || team.members.length > 16) {
                alert("Each team must have 1 to 16 members.");
                return;
            }
            if (team.members.some(m => !m.trim())) {
                alert("All member handles must be filled.");
                return;
            }
            for (const member of team.members) {
                const submissionsRes = await fetch(
                    `https://codeforces.com/api/user.info?handles=${member}`
                )
                const submissionsData = await submissionsRes.json()

                if (submissionsData.status !== 'OK') {
                    alert("All member handles must be valid");
                    return;
                }
            }
        }

        const allHandles = teams.flatMap((team) =>
            team.members.map((h) => h.trim().toLowerCase())
        );
        const uniqueHandles = new Set(allHandles);
        if (uniqueHandles.size !== allHandles.length) {
            alert("Each Codeforces handle must be unique across all teams.");
            return;
        }

        const teamNames = teams.map((t) => t.name.trim().toLowerCase());
        const uniqueNames = new Set(teamNames);
        if (uniqueNames.size !== teamNames.length) {
            alert("Each team must have a unique name.");
            return;
        }

        const durationMinutes = durationMins;
        if (durationMinutes > 420) {
            alert("Duration cannot exceed 7 hours (420 minutes).");
            return;
        }
        const [hoursT, minutesT] = timeoutMinutes.split(":").map(Number);
        if (isNaN(hoursT) || isNaN(minutesT)) {
            alert("Invalid timeout format. Please use hh:mm.");
            return;
        }
        const timeoutMinutesValue = timeoutMinutes === '' ? null : (hoursT * 60 + minutesT);

        if (isNaN(minRating) || isNaN(maxRating) || isNaN(tugThreshold)) {
            alert("Invalid rating or threshold format.");
            return;
        }
        if (!Number.isInteger(minRating) || !Number.isInteger(maxRating) || !Number.isInteger(tugThreshold)) {
            alert("Ratings and threshold must be integers.");
            return;
        }
        if (maxRating < 800 || maxRating > 3500 || minRating < 800 || minRating > 3500) {
            alert("Ratings should be in the range of [800,3500].");
            return;
        }
        if (tugThreshold < 100) {
            alert("Threshold must be at least 100.");
            return;
        }
        if (minRating % 100 != 0 || maxRating % 100 != 0) {
            alert("Ratings must be in increments of 100 (e.g., 800, 900, 1000).");
            return;
        }

        if (maxRating < minRating) {
            alert("Maximum rating should be greater than minimum rating");
            return;
        }

        const startTime = new Date(`${date}T${time}`);
        if (isNaN(startTime.getTime())) {
            alert("Invalid start time.");
            return;
        }
        if (startTime.getTime() < Date.now()) {
            alert("Match cannot start before the current time.");
            return;
        }

        const matchData = {
            startTime: startTime.toISOString(),
            durationMinutes,
            minRating,
            maxRating,
            mode: 'tug' as const,
            gridSize: tugType === 'grid' ? selectedGridSize : 1,
            tugThreshold,
            tugType,
            teams: teams,
            timeoutMinutes: timeoutMinutesValue,
            problems: [],
            solveLog: [],
            showRatings,
        };

        setIsSubmitting(true);
        try {
            const res = await fetch("../../api/createMatch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(matchData),
            });

            if (!res.ok) {
                const errorText = await res.text();
                let errorMessage = "Failed to create match";
                try {
                    const errJson = JSON.parse(errorText);
                    if (errJson.error || errJson.message) {
                        errorMessage = errJson.error || errJson.message;
                    } else {
                        errorMessage = errorText || errorMessage;
                    }
                } catch {
                    errorMessage = errorText || errorMessage;
                }
                console.error("Failed to create match:", errorMessage);
                alert("Failed to create match: " + errorMessage);
                setIsSubmitting(false);
                return;
            }
            const created = await res.json();
            const newMatchId = created?.id ?? created?.match?.id ?? created?.id;
            if (!newMatchId) {
                alert("Could not create match, no id returned");
                setIsSubmitting(false);
                return;
            }
            router.push(`/match/${newMatchId}`);
        } catch (err) {
            console.error("Error creating match", err);
            alert("Error creating match");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-start">
                <div className="flex flex-col space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Create Tug of War Match</h1>
                    <p className="text-muted-foreground">
                        Configure teams and match settings.
                    </p>
                </div>
                <Button
                    onClick={() => handleSubmit()}
                    disabled={isSubmitting}
                    className="w-auto"
                    size="lg"
                >
                    {isSubmitting ? (
                        <span className="flex items-center">
                            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                            Creating...
                        </span>
                    ) : (
                        'Create Match'
                    )}
                </Button>
            </div>

            <Tabs defaultValue="settings" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="settings">Game Settings</TabsTrigger>
                    <TabsTrigger value="teams">Teams</TabsTrigger>
                </TabsList>

                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Match Options</CardTitle>
                            <CardDescription>Configure schedule and game rules.</CardDescription>
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
                                        step="60"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Duration</Label>
                                    <span
                                        className="text-xs font-bold font-mono px-2.5 py-1 rounded-full"
                                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                                    >
                                        {Math.floor(durationMins / 60)}h {durationMins % 60 > 0 ? `${durationMins % 60}m` : ''}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={30}
                                    max={420}
                                    step={15}
                                    value={durationMins}
                                    onChange={(e) => setDurationMins(Number(e.target.value))}
                                    className="w-full accent-red-500 cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-[#6b7280]">
                                    <span>30m</span><span>2h</span><span>4h</span><span>7h</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Min Rating</Label>
                                    <Input
                                        type="text"
                                        placeholder="e.g. 800"
                                        value={minRating}
                                        onChange={(e) => setMinRating(Number(e.target.value))}
                                        pattern="[0-9]+"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Rating</Label>
                                    <Input
                                        type="text"
                                        placeholder="e.g. 1600"
                                        value={maxRating}
                                        onChange={(e) => setMaxRating(Number(e.target.value))}
                                        pattern="[0-9]+"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Threshold</Label>
                                <Input
                                    type="text"
                                    placeholder="e.g. 2000"
                                    value={tugThreshold}
                                    onChange={(e) => setTugThreshold(Number(e.target.value))}
                                    pattern="[0-9]+"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Game Mode</Label>
                                <select
                                    value={tugType}
                                    onChange={(e) => setTugType(e.target.value as "grid" | "single")}
                                    className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50 text-gray-100"
                                >
                                    <option value="single">Classic (Single Question)</option>
                                    <option value="grid">Grid (Multiple Questions)</option>
                                </select>
                            </div>

                            {tugType === 'grid' && (
                                <div className="space-y-2">
                                    <Label>Grid Size</Label>
                                    <select
                                        value={selectedGridSize}
                                        onChange={(e) => setSelectedGridSize(parseInt(e.target.value))}
                                        className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50 text-gray-100"
                                    >
                                        {[3, 4, 5, 6].map((size) => (
                                            <option key={size} value={size}>
                                                {size} x {size}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="mb-1 block">Show problem ratings</Label>
                                <div className="inline-flex rounded-md shadow-sm" role="group">
                                    <Button
                                        type="button"
                                        variant={showRatings ? "default" : "outline"}
                                        onClick={() => setShowRatings(true)}
                                        className="rounded-r-none"
                                    >
                                        Show
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={!showRatings ? "default" : "outline"}
                                        onClick={() => setShowRatings(false)}
                                        className="rounded-l-none"
                                    >
                                        Hide
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Timeout (hh:mm)</Label>
                                <Input
                                    type="text"
                                    placeholder="e.g. 1:30"
                                    value={timeoutMinutes}
                                    onChange={(e) => setTimeoutMinutes(e.target.value)}
                                    pattern="^\d+:\d{2}$"
                                    required
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="teams">
                    <Card>
                        <CardHeader>
                            <CardTitle>Teams</CardTitle>
                            <CardDescription>Exactly 2 teams required</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TugTeamsForm teams={teams} onTeamsChange={setTeams} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>


        </div>
    );
};

export default TugMatchCreationForm;

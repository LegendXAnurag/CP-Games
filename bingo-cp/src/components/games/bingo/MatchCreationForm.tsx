"use client";
import type { Match, Team } from '@/types/match';
import { useState } from "react";
import TeamsForm from '@/components/games/bingo/TeamsForm';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MatchCreationFormProps = {
  onMatchCreated: (match: Match) => void;
};


const MatchCreationForm: React.FC<MatchCreationFormProps> = ({ }) => {
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
  const [selectedMode, setSelectedMode] = useState<"classic" | "replace">("classic");
  const [selectedGridSize, setSelectedGridSize] = useState<number>(5);
  const [replaceIncrement, setReplaceIncrement] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState("0:00");
  const [showRatings, setShowRatings] = useState<boolean>(true);


  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (teams.length < 2) {
      alert("At least 2 teams are required.");
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

      if (team.members.length < 1) {
        alert(`Team "${team.name}" must have at least one member.`);
        return;
      }
      if (team.members.some(m => !m.trim())) {
        alert("All member handles must be filled.");
        return;
      }
    }

    const durationMinutes = durationMins;

    let timeoutMinutesValue = null;
    if (timeoutMinutes) {
      const [th, tm] = timeoutMinutes.split(":").map(Number);
      if (!isNaN(th) && !isNaN(tm)) {
        timeoutMinutesValue = th * 60 + tm;
      }
    }

    const startTime = new Date(`${date}T${time}`);
    if (isNaN(startTime.getTime())) {
      alert("Invalid start time.");
      return;
    }

    setIsSubmitting(true);

    try {
      const matchData = {
        startTime: startTime.toISOString(),
        durationMinutes,
        minRating,
        maxRating,
        mode: selectedMode,
        gridSize: selectedGridSize,
        replaceIncrement: selectedMode === 'replace' ? replaceIncrement : undefined,
        timeoutMinutes: timeoutMinutesValue,
        showRatings,
        teams,
      };

      const res = await fetch("/api/createMatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        throw new Error(errorMessage);
      }

      const data = await res.json();
      router.push(`/match/${data.id}`);
    } catch (err: any) {
      console.error("Error creating match:", err);
      alert(err.message || "Error creating match");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Create Bingo Match</h1>
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
                    style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}
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
                  className="w-full accent-cyan-500 cursor-pointer"
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
                <Label>Game Mode</Label>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value as "classic" | "replace")}
                  className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50 text-gray-100"
                >
                  <option value="classic">Classic</option>
                  <option value="replace">Replace</option>
                </select>
              </div>

              {selectedMode === 'replace' && (
                <div className="space-y-2">
                  <Label>Replace increment</Label>
                  <Input
                    type="text"
                    placeholder="e.g. 100"
                    value={replaceIncrement}
                    onChange={(e) => setReplaceIncrement(Number(e.target.value))}
                    pattern="[0-9]+"
                    required
                  />
                </div>
              )}

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
              <CardDescription>At least 2 teams required</CardDescription>
            </CardHeader>
            <CardContent>
              <TeamsForm teams={teams} onTeamsChange={setTeams} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MatchCreationForm;

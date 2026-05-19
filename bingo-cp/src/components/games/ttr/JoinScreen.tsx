'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTtrAuth } from './AuthContext';

// Define the props we expect - passing in teams data
interface JoinScreenProps {
    matchId: string;
    teams: Array<{
        id: number;
        name: string;
        color: string;
        members: Array<{
            id: number;
            handle: string;
            claimed: boolean;
        }>;
    }>;
}

export default function JoinScreen({ matchId, teams: initialTeams }: JoinScreenProps) {
    const { login, spectate } = useTtrAuth();
    const [teams, setTeams] = useState(initialTeams);
    const [loadingId, setLoadingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/getMatch?matchId=${matchId}`);
                if (res.ok) {
                    const data = await res.json();
                    const matchData = data.match || data;
                    if (matchData.teams) {
                        const formattedTeams = matchData.teams.map((t: any) => ({
                            id: t.id, name: t.name, color: t.color,
                            members: t.members.map((m: any) => ({ id: m.id, handle: m.handle, claimed: m.claimed ?? false }))
                        }));
                        setTeams(formattedTeams);
                    }
                }
            } catch (err) {
                // Background poll failure, safe to ignore
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [matchId]);

    const handleJoin = async (memberId: number, handle: string, teamId: number, teamColor: string) => {
        setLoadingId(memberId);
        setError(null);
        try {
            const res = await fetch('/api/ttr/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId, memberId }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to join');
            }

            // Login with the returned token
            login({ id: memberId, handle, teamId, teamColor }, data.token);

        } catch (err: any) {
            console.error("Join error:", err);
            setError(err.message || "An error occurred");
        } finally {
            setLoadingId(null);
        }
    };

    const getTeamStyle = (color: string) => {
        switch (color) {
            case 'red': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
            case 'blue': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
            case 'green': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
            case 'yellow': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
            case 'pink': return 'bg-pink-100 text-pink-800 dark:bg-pink-800 dark:text-pink-100';
            case 'brown': return 'bg-orange-200 text-orange-900 dark:bg-[#8B4513] dark:text-orange-100';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-2xl shadow-2xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-bold">Join Match</CardTitle>
                    <CardDescription>Select your handle to start playing, or watch as a spectator.</CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {teams.map((team) => (
                            <div key={team.id} className="space-y-3">
                                <h3 className={`font-bold text-lg px-2 py-1 rounded ${getTeamStyle(team.color)}`}>
                                    {team.name}
                                </h3>
                                <div className="space-y-2">
                                    {team.members.map((member) => (
                                        <Button
                                            key={member.id}
                                            variant={member.claimed ? "secondary" : "outline"}
                                            className={`w-full justify-between group ${member.claimed ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'}`}
                                            disabled={member.claimed || loadingId !== null}
                                            onClick={() => handleJoin(member.id, member.handle, team.id, team.color)}
                                        >
                                            <span className="font-medium">{member.handle}</span>
                                            {member.claimed ? (
                                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Taken</span>
                                            ) : (
                                                <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity text-primary font-bold">Select</span>
                                            )}
                                            {loadingId === member.id && <span className="ml-2 animate-spin">⏳</span>}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-t pt-6 flex flex-col items-center gap-4">
                        <p className="text-sm text-muted-foreground">Just watching?</p>
                        <Button variant="ghost" className="w-full sm:w-auto" onClick={() => spectate()}>
                            Enter as Spectator
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

interface TeamInput {
    name: string;
    color: string;
    members: string[];
}

interface TugTeamsFormProps {
    teams: TeamInput[];
    onTeamsChange: (teams: TeamInput[]) => void;
}

export default function TugTeamsForm({ teams, onTeamsChange }: TugTeamsFormProps) {
    type ColorOption = "red" | "blue" | "green" | "purple" | "orange" | "pink" | "yellow" | "teal";

    const COLOR_OPTIONS: ColorOption[] = [
        "red", "blue", "green", "purple", "orange", "pink", "yellow", "teal"
    ];

    const COLOR_CLASSES: Record<ColorOption, { bg: string; text: string; border: string }> = {
        red: { bg: "bg-red-600", text: "text-white", border: "border-red-500" },
        blue: { bg: "bg-blue-600", text: "text-white", border: "border-blue-500" },
        green: { bg: "bg-green-600", text: "text-white", border: "border-green-500" },
        purple: { bg: "bg-purple-600", text: "text-white", border: "border-purple-500" },
        orange: { bg: "bg-orange-500", text: "text-white", border: "border-orange-500" },
        pink: { bg: "bg-pink-600", text: "text-white", border: "border-pink-500" },
        yellow: { bg: "bg-yellow-500", text: "text-black", border: "border-yellow-500" },
        teal: { bg: "bg-teal-600", text: "text-white", border: "border-teal-500" },
    };

    const updateTeams = (updated: TeamInput[]) => {
        onTeamsChange(updated);
    };

    const updateTeam = <K extends keyof TeamInput>(
        index: number,
        key: K,
        value: TeamInput[K]
    ) => {
        const newTeams = [...teams];
        newTeams[index][key] = value;
        updateTeams(newTeams);
    };

    const updateMember = (teamIndex: number, memberIndex: number, value: string) => {
        const newTeams = [...teams];
        newTeams[teamIndex].members[memberIndex] = value;
        updateTeams(newTeams);
    };

    const addMember = (teamIndex: number) => {
        const newTeams = [...teams];
        if (newTeams[teamIndex].members.length < 16) {
            newTeams[teamIndex].members.push("");
            updateTeams(newTeams);
        }
    };

    const removeMember = (teamIndex: number, memberIndex: number) => {
        const newTeams = [...teams];
        newTeams[teamIndex].members.splice(memberIndex, 1);
        updateTeams(newTeams);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team, i) => (
                    <div
                        key={i}
                        className={`p-4 rounded-lg border-2 space-y-4 shadow-sm ${team.color && COLOR_CLASSES[team.color as ColorOption]
                            ? `${COLOR_CLASSES[team.color as ColorOption].bg} bg-opacity-10 dark:bg-opacity-20 ${COLOR_CLASSES[team.color as ColorOption].border}`
                            : "bg-muted/50"
                            }`}
                    >
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${team.color && COLOR_CLASSES[team.color as ColorOption]?.bg}`}></span>
                                Team {i + 1}
                            </h4>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <Label htmlFor={`team-name-${i}`} className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">Team Name</Label>
                                <Input
                                    id={`team-name-${i}`}
                                    type="text"
                                    placeholder="Enter team name"
                                    value={team.name}
                                    onChange={(e) => updateTeam(i, "name", e.target.value)}
                                    className="bg-white dark:bg-gray-950"
                                />
                            </div>

                            <div>
                                <Label htmlFor={`team-color-${i}`} className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">Team Color</Label>
                                <select
                                    id={`team-color-${i}`}
                                    className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-white dark:bg-gray-950"
                                    value={team.color}
                                    onChange={(e) => updateTeam(i, "color", e.target.value)}
                                >
                                    <option value="">Select Color</option>
                                    {COLOR_OPTIONS.filter((c) =>
                                        c === team.color || !teams.some((t) => t.color === c)
                                    ).map((color) => (
                                        <option key={color} value={color}>
                                            {color.charAt(0).toUpperCase() + color.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <Label className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">Members (Handles)</Label>
                                <div className="space-y-2 mt-1">
                                    {team.members.map((member, j) => (
                                        <div key={j} className="flex gap-2">
                                            <Input
                                                type="text"
                                                placeholder={`Handle ${j + 1}`}
                                                value={member}
                                                onChange={(e) => updateMember(i, j, e.target.value)}
                                                className="h-8 text-sm bg-white dark:bg-gray-950"
                                            />
                                            {team.members.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeMember(i, j)}
                                                    className="h-8 w-8 text-gray-500 hover:text-red-500"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {team.members.length < 16 && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addMember(i)}
                                            className="w-full h-8 text-xs border-dashed"
                                        >
                                            + Add Handle
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

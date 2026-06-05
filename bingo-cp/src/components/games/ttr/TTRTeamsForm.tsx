
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

interface TeamInput {
    name: string;
    color: string;
    members: string[];
}

interface TTRTeamsFormProps {
    teams: TeamInput[];
    onTeamsChange: (teams: TeamInput[]) => void;
}

export default function TTRTeamsForm({ teams, onTeamsChange }: TTRTeamsFormProps) {
    type ColorOption = "red" | "brown" | "blue" | "yellow" | "green" | "pink";

    const COLOR_OPTIONS: ColorOption[] = [
        "red", "brown", "blue", "yellow", "green", "pink"
    ];

    const COLOR_CLASSES: Record<ColorOption, { bg: string; text: string; border: string }> = {
        red: { bg: "bg-red-600", text: "text-white", border: "border-red-800" },
        brown: { bg: "bg-[#8B4513]", text: "text-white", border: "border-[#5C2E0C]" },
        blue: { bg: "bg-blue-600", text: "text-white", border: "border-blue-800" },
        yellow: { bg: "bg-yellow-500", text: "text-black", border: "border-yellow-700" },
        green: { bg: "bg-green-600", text: "text-white", border: "border-green-800" },
        pink: { bg: "bg-pink-600", text: "text-white", border: "border-pink-800" },
    };

    // Helper to notify parent of updates
    const updateTeams = (newTeams: TeamInput[]) => {
        onTeamsChange(newTeams);
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

    const addTeam = () => {
        if (teams.length < 6) {
            // Find first unused color
            const usedColors = teams.map(t => t.color);
            const nextColor = COLOR_OPTIONS.find(c => !usedColors.includes(c)) || "red";

            updateTeams([...teams, {
                name: `Team ${nextColor.charAt(0).toUpperCase() + nextColor.slice(1)}`,
                color: nextColor,
                members: [""]
            }]);
        }
    };

    const removeTeam = (index: number) => {
        if (teams.length > 2) {
            const newTeams = teams.filter((_, i) => i !== index);
            updateTeams(newTeams);
        }
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
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Teams ({teams.length}/6)</h3>
                {teams.length < 6 && (
                    <Button onClick={addTeam} size="sm" className="bg-green-600 hover:bg-green-700">
                        <Plus className="w-4 h-4 mr-2" /> Add Team
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team, i) => (
                    <div key={i} className={`p-4 rounded-lg border-2 space-y-4 shadow-sm ${team.color && COLOR_CLASSES[team.color as ColorOption]
                        ? `${COLOR_CLASSES[team.color as ColorOption].bg} bg-opacity-10 border-${team.color}-200 dark:bg-opacity-20`
                        : "bg-muted/50"
                        }`}>
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${team.color && COLOR_CLASSES[team.color as ColorOption]?.bg}`}></span>
                                Team {i + 1}
                            </h4>
                            {teams.length > 2 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeTeam(i)}
                                    className="h-8 w-8 text-red-500 hover:text-red-700 bg-white hover:bg-gray-200 shadow-sm"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div>
                                <Label className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">Team Name</Label>
                                <Input
                                    type="text"
                                    placeholder="Enter team name"
                                    value={team.name}
                                    onChange={(e) => updateTeam(i, "name", e.target.value)}
                                    className="bg-black/20 border-white/10 text-white"
                                />
                            </div>

                            <div>
                                <Label className="text-xs uppercase font-bold text-gray-500 dark:text-gray-400">Color</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50 text-gray-100"
                                    value={team.color}
                                    onChange={(e) => updateTeam(i, "color", e.target.value)}
                                >
                                    {COLOR_OPTIONS.filter((c) =>
                                        c === team.color || !teams.some((t) => t.color === c)
                                    ).map((color) => (
                                        <option key={color} value={color} className="bg-[#0a0a0a] text-white">
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
                                                placeholder={`Handle ${j + 1}`}
                                                value={member}
                                                onChange={(e) => updateMember(i, j, e.target.value)}
                                                className="h-8 text-sm bg-black/20 border-white/10 text-white"
                                            />
                                            {team.members.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeMember(i, j)}
                                                    className="h-8 w-8 text-gray-500 hover:text-red-500"
                                                >
                                                    &times;
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

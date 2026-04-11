"use client";

import { useEffect, useState, useRef } from "react";
import { TTRState, City, Track, Ticket } from "../app/types/match";
import { CITIES, TRACKS } from "../lib/ttrData";
import { canBuildTrack, canBuildStation, getTrackCost, getCompletedRoute } from "../lib/ttrLogic";
import { X, TrainFront, MapPin, GripHorizontal } from "lucide-react";
import { motion } from "framer-motion";

interface TTRMapProps {
    matchId: string;
    state: TTRState;
    currentTeam: string;
    onUpdate?: (newState: TTRState) => void;
    readOnly?: boolean;
    focusedTicket?: Ticket | null;
    setFocusedTicket?: (t: Ticket | null) => void;
}

export default function TTRMap({ matchId, state, currentTeam, onUpdate, readOnly, focusedTicket, setFocusedTicket }: TTRMapProps) {
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const [confirmTrack, setConfirmTrack] = useState<Track | null>(null);
    const [confirmStationTrack, setConfirmStationTrack] = useState<Track | null>(null);

    const handleTrackClick = (track: Track) => {
        if (readOnly) return;
        const player = state.players[currentTeam];
        if (!player) return;

        // check if track is claimed
        const trackState = state.tracks[track.id];

        // If claimed by someone else, or by us but we want to put a station (wait, logic says we can't put station if we own it)
        // Logic: 
        // 1. If unclaimed -> Build Track dialog
        // 2. If claimed by OTHER -> Build Station dialog
        // 3. If claimed by US -> Do nothing (or show info)

        if (!trackState || !trackState.claimedBy) {
            setConfirmTrack(track);
        } else {
            // Always allow seeing who claimed the track or built stations
            setConfirmStationTrack(track);
        }
    };

    const confirmBuildTrack = async () => {
        if (!confirmTrack) return;

        const originalTrack = confirmTrack;
        setConfirmTrack(null); // Close dialog immediately

        try {
            const res = await fetch('/api/ttr/buildTrack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId, team: currentTeam, trackId: originalTrack.id })
            });
            if (!res.ok) {
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    alert(data.message || "Failed to build track");
                } catch (e) {
                    console.error("Non-JSON error:", text);
                    alert("Server error: " + (res.statusText || "Unknown error"));
                }
            } else {
                const data = await res.json();
                if (data.newState && onUpdate) {
                    onUpdate(data.newState);
                }
            }
        } catch (e) {
            console.error(e);
            alert("Failed to build track");
        }
    };

    const confirmBuildStation = async () => {
        if (!confirmStationTrack) return;

        const trackId = confirmStationTrack.id;
        setConfirmStationTrack(null);

        try {
            const res = await fetch('/api/ttr/buildStation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId, team: currentTeam, trackId })
            });

            if (!res.ok) {
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    alert(data.message || "Failed to build station");
                } catch (e) {
                    console.error("Non-JSON error:", text);
                    alert("Server error: " + (res.statusText || "Unknown error"));
                }
            } else {
                const data = await res.json();
                if (data.newState && onUpdate) {
                    onUpdate(data.newState);
                }
            }
        } catch (e) {
            console.error(e);
            alert("Failed to build station");
        }
    };

    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const parent = containerRef.current.parentElement;
                if (parent) {
                    const availableWidth = parent.clientWidth;
                    const availableHeight = parent.clientHeight;

                    // Map generic size
                    const mapW = state.mapData ? state.mapData.width : 1200;
                    const mapH = state.mapData ? state.mapData.height : 800;

                    const scaleW = availableWidth / mapW;
                    const scaleH = availableHeight / mapH;

                    // Fit 'contain'
                    const newScale = Math.min(scaleW, scaleH, 1);
                    setScale(Math.min(scaleW, scaleH) * 0.95); // 95% to leave some margin
                }
            }
        };

        window.addEventListener('resize', updateScale);
        updateScale(); // initial

        // Also observe parent resize if possible, but window resize is usually enough for global layout changes
        return () => window.removeEventListener('resize', updateScale);
    }, []);

    // ... (handlers)
    const player = state.players[currentTeam];
    const trackCheck = confirmTrack && player ? canBuildTrack(state, player, confirmTrack.id) : { possible: true, reason: "" };
    const stationCheck = confirmStationTrack && player ? canBuildStation(state, player, confirmStationTrack.id) : { possible: true, reason: "" };

    const completedRoute = focusedTicket ? getCompletedRoute(state, currentTeam, focusedTicket.city1, focusedTicket.city2) : null;
    const completedTrackIds = new Set(completedRoute?.map(t => t.id) || []);

    return (
        <div className="relative w-full h-full overflow-hidden bg-transparent flex justify-center items-center">
            <div
                ref={containerRef}
                className="relative bg-black/20 shadow-xl origin-center transition-transform duration-200"
                style={{
                    width: state.mapData ? `${state.mapData.width}px` : '1200px',
                    height: state.mapData ? `${state.mapData.height}px` : '800px',
                    transform: `scale(${scale})`
                }}
            >
                <img
                    src={state.mapData?.imageUrl || "/europe.jpeg"}
                    alt="Map Background"
                    className="absolute inset-0 w-full h-full object-fill opacity-80"
                    style={{ pointerEvents: 'none' }}
                />

                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {(state.mapData ? state.mapData.tracks : TRACKS).map(track => {
                        const cities = state.mapData ? state.mapData.cities : CITIES;
                        const c1 = cities.find(c => c.id === (state.mapData ? track.city1 : track.city1));
                        const c2 = cities.find(c => c.id === (state.mapData ? track.city2 : track.city2));

                        // For custom maps, track might use cityA/cityB if we didn't normalize it, 
                        // but logic expects city1/city2. We should ensure normalization in backend.
                        // Assuming track has city1/city2.

                        if (!c1 || !c2) return null;

                        const trackState = state.tracks[track.id];
                        const isClaimed = !!trackState?.claimedBy;
                        const ownerColor = trackState?.claimedBy || 'gray';

                        // Custom Map Rendering with Units
                        if (track.units && track.units.length > 0) {
                            return (
                                <g key={track.id} onClick={() => handleTrackClick(track)} className={`pointer-events-auto ${readOnly ? '' : 'cursor-pointer'} group`}>
                                    {track.units.map((unit: any, idx: number) => {
                                        const w = unit.width || 20;
                                        const h = unit.height || 8;
                                        const fillColors = isClaimed ? [ownerColor, ...((trackState as any)?.stationedBy || [])] : [track.color || 'gray'];
                                        const colorCount = fillColors.length;
                                        const stripeWidth = w / colorCount;

                                        return (
                                            <g key={idx} transform={`rotate(${unit.rotation}, ${unit.x}, ${unit.y})`}>
                                                {/* Colored Stripes */}
                                                {fillColors.map((c, i) => (
                                                    <rect
                                                        key={`stripe-${i}`}
                                                        x={unit.x - w / 2 + i * stripeWidth}
                                                        y={unit.y - h / 2}
                                                        width={stripeWidth}
                                                        height={h}
                                                        fill={c}
                                                        className={`transition-all ${!isClaimed ? 'hover:fill-yellow-500 hover:opacity-80' : ''}`}
                                                    />
                                                ))}
                                                
                                                {/* Outline / Stroke Over All Stripes */}
                                                <rect
                                                    x={unit.x - w / 2}
                                                    y={unit.y - h / 2}
                                                    width={w}
                                                    height={h}
                                                    fill="none"
                                                    stroke={completedTrackIds.has(track.id) ? "white" : confirmTrack?.id === track.id || confirmStationTrack?.id === track.id ? "yellow" : "black"}
                                                    strokeWidth={completedTrackIds.has(track.id) ? "3" : confirmTrack?.id === track.id || confirmStationTrack?.id === track.id ? "3" : "1"}
                                                    className={`transition-all ${completedTrackIds.has(track.id) || confirmTrack?.id === track.id || confirmStationTrack?.id === track.id ? "animate-pulse" : ""}`}
                                                    style={{ pointerEvents: 'none' }}
                                                />
                                            </g>
                                        );
                                    })}
                                    {/* Helper click area for units? simplified to just clicking units for now */}
                                </g>
                            );
                        }

                        // Legacy Rendering (Straight Lines)
                        const mapW = 1200; // Legacy width
                        const mapH = 800;  // Legacy height
                        const x1 = (c1.x / 100) * mapW;
                        const y1 = (c1.y / 100) * mapH;
                        const x2 = (c2.x / 100) * mapW;
                        const y2 = (c2.y / 100) * mapH;

                        let offsetX = 0;
                        let offsetY = 0;
                        if (track.double) {
                            const dx = x2 - x1;
                            const dy = y2 - y1;
                            const len = Math.sqrt(dx * dx + dy * dy);
                            const perpX = -dy / len;
                            const perpY = dx / len;

                            if (track.id.endsWith('2')) {
                                offsetX = perpX * 6;
                                offsetY = perpY * 6;
                            } else {
                                offsetX = -perpX * 6;
                                offsetY = -perpY * 6;
                            }
                        }

                        return (
                            <g key={track.id} onClick={() => handleTrackClick(track)} className={`pointer-events-auto ${readOnly ? '' : 'cursor-pointer'} group`}>
                                <line
                                    x1={x1 + offsetX}
                                    y1={y1 + offsetY}
                                    x2={x2 + offsetX}
                                    y2={y2 + offsetY}
                                    stroke="transparent"
                                    strokeWidth="20"
                                />
                                <line
                                    x1={x1 + offsetX}
                                    y1={y1 + offsetY}
                                    x2={x2 + offsetX}
                                    y2={y2 + offsetY}
                                    stroke={completedTrackIds.has(track.id) ? "white" : confirmTrack?.id === track.id || confirmStationTrack?.id === track.id ? "yellow" : isClaimed ? ownerColor : 'rgba(0,0,0,0.5)'}
                                    strokeWidth={completedTrackIds.has(track.id) ? "12" : "8"}
                                    strokeDasharray={isClaimed ? "none" : "12, 4"}
                                    className={`transition-all group-hover:stroke-[10px] ${!isClaimed ? 'group-hover:stroke-white group-hover:opacity-80' : ''} ${completedTrackIds.has(track.id) || confirmTrack?.id === track.id || confirmStationTrack?.id === track.id ? "animate-pulse stroke-[10px]" : ""}`}
                                />
                                {trackState && trackState.stationedBy && trackState.stationedBy.length > 0 && (
                                    trackState.stationedBy.map((stationTeam, idx) => {
                                        const midX = (x1 + x2) / 2 + offsetX;
                                        const midY = (y1 + y2) / 2 + offsetY;
                                        const dx = x2 - x1;
                                        const dy = y2 - y1;
                                        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

                                        // Perpendicular rect
                                        return (
                                            <rect
                                                key={idx}
                                                x={midX - 4}
                                                y={midY - 12}
                                                width={8}
                                                height={24}
                                                fill={stationTeam}
                                                stroke="white"
                                                strokeWidth="1"
                                                transform={`rotate(${angle + 90}, ${midX}, ${midY})`}
                                            />
                                        );
                                    })
                                )}
                            </g>
                        );
                    })}
                    {(state.mapData ? state.mapData.cities : CITIES).map(city => {
                        // Removed stationOwner logic from here

                        let cx = city.x;
                        let cy = city.y;

                        if (!state.mapData) {
                            // Legacy conversion
                            cx = (city.x / 100) * 1200;
                            cy = (city.y / 100) * 800;
                        }

                        const isFocusedCity = focusedTicket && (focusedTicket.city1 === city.id || focusedTicket.city2 === city.id);

                        return (
                            <g
                                key={city.id}
                                transform={`translate(${cx}, ${cy})`}
                                className={`pointer-events-auto group`}
                            >
                                {/* City Marker */}
                                <circle
                                    r={isFocusedCity ? 14 : 6}
                                    fill={(state.mapData ? "red" : "#333")}
                                    stroke={isFocusedCity ? "#00f0ff" : "white"}
                                    strokeWidth={isFocusedCity ? "4" : "2"}
                                    className={isFocusedCity ? "animate-pulse" : ""}
                                />

                                {/* City Name */}
                                <text
                                    y={-15}
                                    textAnchor="middle"
                                    className="text-xs font-bold pointer-events-none select-none fill-black transition-all group-hover:font-extrabold"
                                    style={{ textShadow: "0px 0px 2px white" }} // Outline for readability
                                >
                                    {city.name}
                                </text>
                            </g>
                        );
                    })}
                </svg>

                {/* Clear Focus Button */}
                {focusedTicket && setFocusedTicket && (
                    <div className="absolute top-4 right-4 z-50">
                        <button
                            onClick={() => setFocusedTicket(null)}
                            className="bg-black/80 backdrop-blur border border-[#00f0ff]/50 text-[#00f0ff] px-4 py-2 rounded-full font-bold text-xs font-heading tracking-widest uppercase hover:bg-[#00f0ff]/20 transition-colors shadow-[0_0_15px_rgba(0,240,255,0.2)] flex items-center gap-2"
                        >
                            <X className="w-4 h-4" /> Clear Focus
                        </button>
                    </div>
                )}

                {/* Draggable Action Panel */}
                {(confirmTrack || confirmStationTrack) && (
                    <motion.div
                        drag
                        dragConstraints={containerRef}
                        dragMomentum={false}
                        initial={{ opacity: 0, y: 50, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 20, x: "-50%" }}
                        className="absolute bottom-8 left-1/2 w-full max-w-sm bg-black/90 border border-white/20 shadow-2xl rounded-2xl p-4 backdrop-blur-xl z-50 flex flex-col gap-4 cursor-grab active:cursor-grabbing"
                    >
                        {/* Drag Handle & Close */}
                        <div className="flex items-center justify-between w-full border-b border-white/10 pb-2 mb-1">
                            <div className="flex items-center gap-2 text-white/50">
                                <GripHorizontal className="w-4 h-4" />
                                <span className="text-[10px] uppercase font-bold tracking-widest font-heading">Drag to move</span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setConfirmTrack(null); setConfirmStationTrack(null); }}
                                className="p-1 rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 min-w-0 pointer-events-none">
                            {confirmTrack ? (
                                <>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#00f0ff] mb-2 font-heading flex items-center gap-1.5">
                                        <TrainFront className="w-3.5 h-3.5" />
                                        Claim Route
                                    </h3>
                                    <div className="flex items-center gap-2 text-sm font-bold text-white mb-2 truncate">
                                        <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> <span className="truncate max-w-[120px]">{(state.mapData?.cities || CITIES).find(c => c.id === confirmTrack.city1)?.name}</span></div>
                                        <span className="text-white/40 font-light">&rarr;</span>
                                        <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> <span className="truncate max-w-[120px]">{(state.mapData?.cities || CITIES).find(c => c.id === confirmTrack.city2)?.name}</span></div>
                                    </div>
                                    <div className="text-xs text-[#a3a3a3] font-body bg-white/5 p-2 rounded-lg border border-white/5">
                                        <p className="flex justify-between items-center mb-1">
                                            <span>Route Cost:</span> <strong className="text-yellow-400">{getTrackCost(confirmTrack)} coins</strong>
                                        </p>
                                        <p className="flex justify-between items-center">
                                            <span>Your Coins:</span> <strong className="text-white">{state.players[currentTeam]?.coins || 0} coins</strong>
                                        </p>
                                        {!trackCheck.possible && (
                                            <p className="mt-2 text-red-400 font-bold border-t border-red-500/20 pt-2">{trackCheck.reason}</p>
                                        )}
                                    </div>
                                </>
                            ) : confirmStationTrack ? (
                                <>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#a87fff] mb-2 font-heading flex items-center gap-1.5">
                                        <TrainFront className="w-3.5 h-3.5" />
                                        Track Info
                                    </h3>
                                    <div className="flex items-center gap-2 text-sm font-bold text-white mb-2 truncate">
                                        <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#a87fff]" /> <span className="truncate max-w-[120px]">{(state.mapData?.cities || CITIES).find(c => c.id === confirmStationTrack.city1)?.name}</span></div>
                                        <span className="text-white/40 font-light">&rarr;</span>
                                        <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#a87fff]" /> <span className="truncate max-w-[120px]">{(state.mapData?.cities || CITIES).find(c => c.id === confirmStationTrack.city2)?.name}</span></div>
                                    </div>
                                    <div className="text-xs text-[#a3a3a3] font-body bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span>Claimed by:</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: state.tracks[confirmStationTrack.id]?.claimedBy || undefined, boxShadow: `0 0 6px ${state.tracks[confirmStationTrack.id]?.claimedBy || 'gray'}` }} />
                                                <strong className="text-white capitalize text-sm">{state.tracks[confirmStationTrack.id]?.claimedBy || 'None'}</strong>
                                            </div>
                                        </div>
                                        
                                        {state.tracks[confirmStationTrack.id]?.stationedBy && (state.tracks[confirmStationTrack.id]?.stationedBy?.length || 0) > 0 && (
                                            <div className="flex items-center justify-between border-t border-white/10 pt-2">
                                                <span>Stations:</span>
                                                <div className="flex flex-col gap-1 items-end">
                                                    {state.tracks[confirmStationTrack.id]?.stationedBy?.map((team: string) => (
                                                        <div key={team} className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team }} />
                                                            <strong className="text-white capitalize">{team}</strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {(() => {
                                            const trackStateForUI = state.tracks[confirmStationTrack.id];
                                            const isOwnedByUs = trackStateForUI?.claimedBy === currentTeam;
                                            const isStationedByUs = trackStateForUI?.stationedBy?.includes(currentTeam);
                                            const canBuildHere = !isOwnedByUs && !isStationedByUs && !readOnly;
                                            
                                            if (canBuildHere) {
                                                return (
                                                    <div className="border-t border-white/10 pt-2 mt-1">
                                                        <p className="flex justify-between items-center mb-1 text-[11px]">
                                                            <span>Station Cost:</span> <strong className="text-yellow-400">{4 - (state.players[currentTeam]?.stationsLeft || 0)} coins</strong>
                                                        </p>
                                                        {!stationCheck.possible && (
                                                            <p className="mt-1 text-red-400 font-bold border-t border-red-500/20 pt-1 text-[10px]">{stationCheck.reason}</p>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </>
                            ) : null}
                        </div>

                        <div className="shrink-0 flex items-center gap-2 w-full mt-1">
                            {(() => {
                                if (confirmTrack) {
                                    return (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); setConfirmTrack(null); }} className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold border border-white/20 hover:bg-white/5 transition-colors font-body text-white">Cancel</button>
                                            <button disabled={!trackCheck.possible} onClick={(e) => { e.stopPropagation(); confirmBuildTrack(); }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all font-heading ${(!trackCheck.possible) ? "bg-white/10 text-white/40 cursor-not-allowed border border-white/5" : "bg-[#00f0ff] hover:bg-[#00f0ff]/80 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]"}`}>Claim</button>
                                        </>
                                    );
                                } else if (confirmStationTrack) {
                                    const trackStateForUI = state.tracks[confirmStationTrack.id];
                                    const isOwnedByUs = trackStateForUI?.claimedBy === currentTeam;
                                    const isStationedByUs = trackStateForUI?.stationedBy?.includes(currentTeam);
                                    const canBuildHere = !isOwnedByUs && !isStationedByUs && !readOnly;

                                    if (canBuildHere) {
                                        return (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); setConfirmStationTrack(null); }} className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold border border-white/20 hover:bg-white/5 transition-colors font-body text-white">Close</button>
                                                <button disabled={!stationCheck.possible} onClick={(e) => { e.stopPropagation(); confirmBuildStation(); }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all font-heading ${(!stationCheck.possible) ? "bg-white/10 text-white/40 cursor-not-allowed border border-white/5" : "bg-[#00f0ff] hover:bg-[#00f0ff]/80 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]"}`}>Build Station</button>
                                            </>
                                        );
                                    } else {
                                        return (
                                            <button onClick={(e) => { e.stopPropagation(); setConfirmStationTrack(null); }} className="w-full px-3 py-2 rounded-lg text-xs font-semibold border border-white/20 hover:bg-white/5 transition-colors font-body text-white">Close</button>
                                        );
                                    }
                                }
                                return null;
                            })()}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

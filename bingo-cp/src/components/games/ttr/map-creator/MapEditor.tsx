
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { City, Track, TrackUnit, TtrMap, TtrMapData } from '@/types/ttr';
import { v4 as uuidv4 } from 'uuid';

interface MapEditorProps {
    initialMap: TtrMap;
    onSave: (map: TtrMap) => void;
}

type Tool = 'select' | 'city' | 'track';

export default function MapEditor({ initialMap, onSave }: MapEditorProps) {
    const [map, setMap] = useState<TtrMap>(initialMap);
    const [selectedTool, setSelectedTool] = useState<Tool>('select');
    const [selectedElement, setSelectedElement] = useState<{ type: 'city' | 'track' | 'unit'; id: string; parentId?: string } | null>(null);

    // Track creation state
    const [creatingTrack, setCreatingTrack] = useState<{ startCityId: string | null }>({ startCityId: null });

    const svgRef = useRef<SVGSVGElement>(null);

    // Mouse drag for units
    const isDragging = useRef(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    // Ticket Manager State
    const [showTicketManager, setShowTicketManager] = useState(false);
    const [newTicket, setNewTicket] = useState<{ cityA: string, cityB: string, points: number, type: 'long' | 'short' }>({
        cityA: '', cityB: '', points: 10, type: 'short'
    });

    const draggingUnitStartPos = useRef({ x: 0, y: 0 });

    // Helper to get mouse position relative to SVG
    const getMousePos = (e: React.MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const CTM = svgRef.current.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };
        return {
            x: (e.clientX - CTM.e) / CTM.a,
            y: (e.clientY - CTM.f) / CTM.d,
        };
    };

    const handleSvgClick = (e: React.MouseEvent) => {
        if (selectedTool === 'city') {
            const { x, y } = getMousePos(e);
            const newCity: City = {
                id: uuidv4(),
                name: `City ${map.data.cities.length + 1}`,
                x,
                y,
            };
            setMap(prev => ({
                ...prev,
                data: { ...prev.data, cities: [...prev.data.cities, newCity] }
            }));
        } else if (selectedTool === 'select') {
            // Only deselect if not dragging
            if (!isDragging.current) {
                setSelectedElement(null);
            }
        }
    };

    const handleCityClick = (e: React.MouseEvent, cityId: string) => {
        e.stopPropagation();
        if (selectedTool === 'track') {
            if (!creatingTrack.startCityId) {
                setCreatingTrack({ startCityId: cityId });
            } else {
                // Create track
                if (creatingTrack.startCityId !== cityId) {
                    const lengthInput = prompt("Enter track length (number of units):", "3");
                    const length = parseInt(lengthInput || "3", 10) || 3;

                    const newTrack: Track = {
                        id: uuidv4(),
                        cityA: creatingTrack.startCityId,
                        cityB: cityId,
                        length: length,
                        units: []
                    }
                    // Generate default linear units
                    const cityA = map.data.cities.find(c => c.id === newTrack.cityA)!;
                    const cityB = map.data.cities.find(c => c.id === newTrack.cityB)!;

                    const dx = cityB.x - cityA.x;
                    const dy = cityB.y - cityA.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                    for (let i = 0; i < newTrack.length; i++) {
                        const t = (i + 0.5) / newTrack.length;
                        newTrack.units.push({
                            id: uuidv4(),
                            x: cityA.x + dx * t,
                            y: cityA.y + dy * t,
                            rotation: angle
                        });
                    }

                    setMap(prev => ({
                        ...prev,
                        data: { ...prev.data, tracks: [...prev.data.tracks, newTrack] }
                    }));
                }
                setCreatingTrack({ startCityId: null });
            }
        } else {
            setSelectedElement({ type: 'city', id: cityId });
        }
    };

    const handleUnitMouseDown = (e: React.MouseEvent, trackId: string, unitId: string) => {
        e.stopPropagation();
        if (selectedTool === 'select') {
            setSelectedElement({ type: 'unit', id: unitId, parentId: trackId });
            isDragging.current = true;
            dragStartPos.current = { x: e.clientX, y: e.clientY };

            const track = map.data.tracks.find(t => t.id === trackId);
            const unit = track?.units.find(u => u.id === unitId);
            if (unit) {
                draggingUnitStartPos.current = { x: unit.x, y: unit.y };
            }
        }
    }

    const handleCityMouseDown = (e: React.MouseEvent, cityId: string) => {
        e.stopPropagation();
        if (selectedTool === 'select') {
            setSelectedElement({ type: 'city', id: cityId });
            isDragging.current = true;
            dragStartPos.current = { x: e.clientX, y: e.clientY };

            const city = map.data.cities.find(c => c.id === cityId);
            if (city) {
                draggingUnitStartPos.current = { x: city.x, y: city.y };
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging.current && selectedElement) {
            if (!svgRef.current) return;
            const CTM = svgRef.current.getScreenCTM();
            if (!CTM) return;

            const dx = (e.clientX - dragStartPos.current.x) / CTM.a;
            const dy = (e.clientY - dragStartPos.current.y) / CTM.d;

            setMap(prev => {
                if (selectedElement.type === 'unit') {
                    const newTracks = [...prev.data.tracks];
                    const trackIndex = newTracks.findIndex(t => t.id === selectedElement.parentId);
                    if (trackIndex === -1) return prev;

                    const track = { ...newTracks[trackIndex] };
                    const unitIndex = track.units.findIndex(u => u.id === selectedElement.id);
                    if (unitIndex === -1) return prev;

                    const unit = { ...track.units[unitIndex] };
                    unit.x = draggingUnitStartPos.current.x + dx;
                    unit.y = draggingUnitStartPos.current.y + dy;

                    track.units[unitIndex] = unit;
                    newTracks[trackIndex] = track;
                    return { ...prev, data: { ...prev.data, tracks: newTracks } };
                } else if (selectedElement.type === 'city') {
                    const newCities = prev.data.cities.map(c => {
                        if (c.id === selectedElement.id) {
                            return {
                                ...c,
                                x: draggingUnitStartPos.current.x + dx,
                                y: draggingUnitStartPos.current.y + dy
                            };
                        }
                        return c;
                    });

                    // Also move connected tracks? 
                    // Usually tracks are defined by connections. If I move city, the connected tracks end points should move.
                    // But currently tracks are composed of Units with absolute positions!
                    // If I move a City, the track units DO NOT automatically move in this data structure.
                    // This is a limitation of the current "Unit" based structure.
                    // For now, I will just move the city. The user might need to adjust tracks or I'd need complex logic to warp tracks.
                    // Given the request is just "reposition city", I'll move the city.

                    return { ...prev, data: { ...prev.data, cities: newCities } };
                }
                return prev;
            });
        }
    }

    const handleMouseUp = () => {
        isDragging.current = false;
    }

    // Keyboard controls for unit/city movement
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedElement) return;

            const step = e.shiftKey ? 10 : 1;
            const rotateStep = 5;

            setMap(prev => {
                if (selectedElement.type === 'unit') {
                    const newTracks = [...prev.data.tracks];
                    const trackIndex = newTracks.findIndex(t => t.id === selectedElement.parentId);
                    if (trackIndex === -1) return prev;

                    const track = { ...newTracks[trackIndex] };
                    const unitIndex = track.units.findIndex(u => u.id === selectedElement.id);
                    if (unitIndex === -1) return prev;

                    const unit = { ...track.units[unitIndex] };

                    switch (e.key.toLowerCase()) {
                        case 'w': unit.y -= step; break;
                        case 's': unit.y += step; break;
                        case 'a': unit.x -= step; break;
                        case 'd': unit.x += step; break;
                        case 'arrowleft': unit.rotation -= rotateStep; break;
                        case 'arrowright': unit.rotation += rotateStep; break;
                        default: return prev;
                    }

                    track.units[unitIndex] = unit;
                    newTracks[trackIndex] = track;
                    return { ...prev, data: { ...prev.data, tracks: newTracks } };
                } else if (selectedElement.type === 'city') {
                    const newCities = prev.data.cities.map(c => {
                        if (c.id === selectedElement.id) {
                            let { x, y } = c;
                            switch (e.key.toLowerCase()) {
                                case 'w': y -= step; break;
                                case 's': y += step; break;
                                case 'a': x -= step; break;
                                case 'd': x += step; break;
                                default: return c;
                            }
                            return { ...c, x, y };
                        }
                        return c;
                    });
                    return { ...prev, data: { ...prev.data, cities: newCities } };
                }
                return prev;
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedElement]);

    const save = () => {
        onSave(map);
    };

    return (
        <div className="flex h-screen flex-col">
            <div className="bg-gray-800 text-white p-4 flex flex-col gap-2 shrink-0">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    <h1 className="text-xl font-bold">Map Creator</h1>

                    <div className="flex flex-wrap gap-4 items-center">
                        {/* Map Dimensions Group */}
                        <div className="flex gap-2 items-center bg-gray-700 p-2 rounded border border-gray-600">
                            <span className="text-xs font-bold text-gray-300 uppercase">Map Size:</span>
                            <div className="flex flex-col">
                                <label className="text-[10px] text-gray-400">Width</label>
                                <input
                                    type="number"
                                    className="w-16 text-black px-1 text-sm"
                                    value={map.width}
                                    onChange={(e) => setMap({ ...map, width: parseInt(e.target.value) || 800 })}
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] text-gray-400">Height</label>
                                <input
                                    type="number"
                                    className="w-16 text-black px-1 text-sm"
                                    value={map.height}
                                    onChange={(e) => setMap({ ...map, height: parseInt(e.target.value) || 600 })}
                                />
                            </div>
                        </div>

                        {/* Unit Dimensions Group */}
                        <div className="flex gap-2 items-center bg-gray-700 p-2 rounded border border-gray-600">
                            <span className="text-xs font-bold text-gray-300 uppercase">Default Unit:</span>
                            <div className="flex flex-col">
                                <label className="text-[10px] text-gray-400">W</label>
                                <input
                                    type="number"
                                    className="w-16 text-black px-1 text-sm"
                                    value={map.data.unitWidth || 20}
                                    onChange={(e) => setMap({ ...map, data: { ...map.data, unitWidth: parseInt(e.target.value) || 20 } })}
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] text-gray-400">H</label>
                                <input
                                    type="number"
                                    className="w-16 text-black px-1 text-sm"
                                    value={map.data.unitHeight || 8}
                                    onChange={(e) => setMap({ ...map, data: { ...map.data, unitHeight: parseInt(e.target.value) || 8 } })}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 rounded shadow-lg border border-green-500"
                        onClick={save}
                    >
                        Save Changes
                    </button>
                </div>
                <div className="flex gap-2 text-sm ">
                    <button
                        className={`px-3 py-1 rounded ${selectedTool === 'select' ? 'bg-blue-600' : 'bg-gray-600'}`}
                        onClick={() => setSelectedTool('select')}
                    >
                        Select (WASD/Drag to move unit)
                    </button>
                    <button
                        className={`px-3 py-1 rounded ${selectedTool === 'city' ? 'bg-blue-600' : 'bg-gray-600'}`}
                        onClick={() => setSelectedTool('city')}
                    >
                        Add City
                    </button>
                    <button
                        className={`px-3 py-1 rounded ${selectedTool === 'track' ? 'bg-blue-600' : 'bg-gray-600'}`}
                        onClick={() => setSelectedTool('track')}
                    >
                        {creatingTrack.startCityId ? 'Click Destination City' : 'Add Track'}
                    </button>
                    <button
                        className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700"
                        onClick={() => setShowTicketManager(true)}
                    >
                        Manage Tickets ({(map.data.tickets || []).length})
                    </button>
                </div>
            </div>

            <div className="flex-grow relative overflow-auto bg-gray-900 flex justify-center p-10">
                <svg
                    ref={svgRef}
                    width={map.width}
                    height={map.height}
                    className="bg-white shadow-lg border border-gray-300"
                    onClick={handleSvgClick}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Background Image */}
                    <image
                        href={map.data.imageUrl || "/europe.jpeg"}
                        x="0"
                        y="0"
                        width={map.width}
                        height={map.height}
                        preserveAspectRatio="none"
                        opacity="0.5"
                    />

                    {/* Tracks */}
                    {map.data.tracks.map(track => (
                        <g key={track.id}>
                            {/* Units */}
                            {track.units.map(unit => {
                                const w = unit.width || map.data.unitWidth || 20;
                                const h = unit.height || map.data.unitHeight || 8;
                                return (
                                    <rect
                                        key={unit.id}
                                        x={unit.x - w / 2} // Centered
                                        y={unit.y - h / 2} // Centered
                                        width={w}
                                        height={h}
                                        fill={selectedElement?.id === unit.id ? "orange" : (track.color || "gray")}
                                        stroke="black"
                                        strokeWidth="1"
                                        transform={`rotate(${unit.rotation}, ${unit.x}, ${unit.y})`}
                                        onMouseDown={(e) => handleUnitMouseDown(e, track.id, unit.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="cursor-pointer hover:fill-yellow-500"
                                    />
                                );
                            })}
                        </g>
                    ))}

                    {/* Cities */}
                    {map.data.cities.map(city => (
                        <g
                            key={city.id}
                            transform={`translate(${city.x}, ${city.y})`}
                            onClick={(e) => handleCityClick(e, city.id)}
                            onMouseDown={(e) => handleCityMouseDown(e, city.id)}
                            className="cursor-pointer"
                        >
                            <circle
                                r={6}
                                fill={creatingTrack.startCityId === city.id ? "green" : (selectedElement?.id === city.id ? "orange" : "red")}
                                stroke="black"
                                strokeWidth="2"
                            />
                            <text
                                y={-15}
                                textAnchor="middle"
                                className="text-xs font-bold pointer-events-none select-none"
                            >
                                {city.name}
                            </text>
                        </g>
                    ))}
                </svg>

                {/* Properties Panel (Overlay) */}
                {selectedElement && selectedElement.type === 'city' && (
                    <div className="absolute top-4 right-4 bg-white p-4 rounded shadow-lg border w-64">
                        <h3 className="font-bold mb-2">City Properties</h3>
                        <label className="block text-sm">Name:</label>
                        <input
                            type="text"
                            className="w-full border p-1 rounded mb-2"
                            value={map.data.cities.find(c => c.id === selectedElement.id)?.name || ''}
                            onChange={(e) => {
                                const newName = e.target.value;
                                setMap(prev => ({
                                    ...prev,
                                    data: {
                                        ...prev.data,
                                        cities: prev.data.cities.map(c =>
                                            c.id === selectedElement.id ? { ...c, name: newName } : c
                                        )
                                    }
                                }));
                            }}
                        />
                        <button
                            className="bg-red-500 text-white px-3 py-1 rounded w-full mt-2 hover:bg-red-600"
                            onClick={() => {
                                if (confirm('Delete this city and all connected tracks?')) {
                                    setMap(prev => ({
                                        ...prev,
                                        data: {
                                            ...prev.data,
                                            cities: prev.data.cities.filter(c => c.id !== selectedElement.id),
                                            tracks: prev.data.tracks.filter(t => t.cityA !== selectedElement.id && t.cityB !== selectedElement.id)
                                        }
                                    }));
                                    setSelectedElement(null);
                                }
                            }}
                        >
                            Delete City
                        </button>
                    </div>
                )}

                {selectedElement && (selectedElement.type === 'unit' || selectedElement.type === 'track') && (
                    <div className="absolute top-4 right-4 bg-white p-4 rounded shadow-lg border w-64">
                        <h3 className="font-bold mb-2">Track Properties</h3>
                        <p className="text-sm text-gray-500 mb-2">
                            {selectedElement.type === 'unit' ? 'Unit Selected' : 'Track Selected'}
                        </p>

                        {selectedElement.type === 'unit' && (() => {
                            const track = map.data.tracks.find(t => t.id === selectedElement.parentId);
                            const unit = track?.units.find(u => u.id === selectedElement.id);
                            return unit ? (
                                <div className="mb-2">
                                    <label className="block text-xs">Width:</label>
                                    <input
                                        type="number" className="w-full border p-1 rounded mb-1"
                                        value={unit.width || map.data.unitWidth || 20}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setMap(prev => {
                                                const newTracks = [...prev.data.tracks];
                                                const tIdx = newTracks.findIndex(t => t.id === selectedElement.parentId);
                                                if (tIdx === -1) return prev;
                                                const newTrack = { ...newTracks[tIdx] };
                                                const uIdx = newTrack.units.findIndex(u => u.id === selectedElement.id);
                                                if (uIdx === -1) return prev;
                                                newTrack.units[uIdx] = { ...newTrack.units[uIdx], width: val };
                                                newTracks[tIdx] = newTrack;
                                                return { ...prev, data: { ...prev.data, tracks: newTracks } };
                                            });
                                        }}
                                    />
                                    <label className="block text-xs">Height:</label>
                                    <input
                                        type="number" className="w-full border p-1 rounded mb-1"
                                        value={unit.height || map.data.unitHeight || 8}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setMap(prev => {
                                                const newTracks = [...prev.data.tracks];
                                                const tIdx = newTracks.findIndex(t => t.id === selectedElement.parentId);
                                                if (tIdx === -1) return prev;
                                                const newTrack = { ...newTracks[tIdx] };
                                                const uIdx = newTrack.units.findIndex(u => u.id === selectedElement.id);
                                                if (uIdx === -1) return prev;
                                                newTrack.units[uIdx] = { ...newTrack.units[uIdx], height: val };
                                                newTracks[tIdx] = newTrack;
                                                return { ...prev, data: { ...prev.data, tracks: newTracks } };
                                            });
                                        }}
                                    />
                                </div>
                            ) : null;
                        })()}

                        <div className="mb-4">
                            <label className="block text-xs font-bold mb-1">Track Color:</label>
                            <div className="flex flex-wrap gap-1">
                                {['#EFEFEF', '#FFE4E4', '#FFF0D9', '#FFFFE6', '#ECFFE6', '#DCFFFF', '#E6F0FF', '#FFE6FF'].map(color => (
                                    <div
                                        key={color}
                                        onClick={() => {
                                            const trackId = selectedElement.type === 'unit' ? selectedElement.parentId : selectedElement.id;
                                            setMap(prev => {
                                                const newTracks = prev.data.tracks.map(t =>
                                                    t.id === trackId ? { ...t, color } : t
                                                );
                                                return { ...prev, data: { ...prev.data, tracks: newTracks } };
                                            });
                                        }}
                                        className={`w-6 h-6 rounded-full cursor-pointer border hover:scale-110 transition ${(selectedElement.type === 'unit'
                                            ? map.data.tracks.find(t => t.id === selectedElement.parentId)?.color
                                            : map.data.tracks.find(t => t.id === selectedElement.id)?.color) === color
                                            ? 'border-black ring-1 ring-black' : 'border-gray-300'
                                            }`}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            className="bg-red-500 text-white px-3 py-1 rounded w-full mt-2 hover:bg-red-600"
                            onClick={() => {
                                if (confirm('Delete this entire track?')) {
                                    const trackId = selectedElement.type === 'unit' ? selectedElement.parentId : selectedElement.id;
                                    setMap(prev => ({
                                        ...prev,
                                        data: {
                                            ...prev.data,
                                            tracks: prev.data.tracks.filter(t => t.id !== trackId)
                                        }
                                    }));
                                    setSelectedElement(null);
                                }
                            }}
                        >
                            Delete Track
                        </button>
                    </div>
                )}

                {/* Ticket Manager Overlay */}
                {showTicketManager && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded shadow-xl w-[500px] max-h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Route Tickets</h3>
                                <button onClick={() => setShowTicketManager(false)} className="text-gray-500 hover:text-black">
                                    &times;
                                </button>
                            </div>

                            <div className="flex-grow overflow-y-auto mb-4 border rounded p-2 bg-gray-50">
                                {(map.data.tickets || []).length === 0 ? (
                                    <div className="text-center text-gray-400 py-4">No tickets created yet.</div>
                                ) : (
                                    (map.data.tickets || []).map(ticket => {
                                        const cityA = map.data.cities.find(c => c.id === ticket.cityA)?.name || 'Unknown';
                                        const cityB = map.data.cities.find(c => c.id === ticket.cityB)?.name || 'Unknown';
                                        return (
                                            <div key={ticket.id} className="flex justify-between items-center p-2 border-b bg-white mb-1">
                                                <div>
                                                    <div className="font-bold">{cityA} &harr; {cityB}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {ticket.points} pts | {ticket.type === 'long' ? 'Long Route' : 'Short Route'}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setMap(prev => ({
                                                            ...prev,
                                                            data: {
                                                                ...prev.data,
                                                                tickets: (prev.data.tickets || []).filter(t => t.id !== ticket.id)
                                                            }
                                                        }));
                                                    }}
                                                    className="text-red-500 hover:text-red-700 font-bold px-2"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-bold text-sm mb-2">Add New Ticket</h4>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <select
                                        className="border p-1 rounded"
                                        value={newTicket.cityA}
                                        onChange={e => setNewTicket({ ...newTicket, cityA: e.target.value })}
                                    >
                                        <option value="">Select City A</option>
                                        {map.data.cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <select
                                        className="border p-1 rounded"
                                        value={newTicket.cityB}
                                        onChange={e => setNewTicket({ ...newTicket, cityB: e.target.value })}
                                    >
                                        <option value="">Select City B</option>
                                        {map.data.cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="number" className="border p-1 rounded w-20" placeholder="Pts"
                                        value={newTicket.points}
                                        onChange={e => setNewTicket({ ...newTicket, points: parseInt(e.target.value) || 0 })}
                                    />
                                    <select
                                        className="border p-1 rounded flex-grow"
                                        value={newTicket.type}
                                        onChange={e => setNewTicket({ ...newTicket, type: e.target.value as 'long' | 'short' })}
                                    >
                                        <option value="short">Short Route</option>
                                        <option value="long">Long Route</option>
                                    </select>
                                    <button
                                        className="bg-blue-600 text-white px-4 py-1 rounded disabled:opacity-50"
                                        disabled={!newTicket.cityA || !newTicket.cityB || newTicket.cityA === newTicket.cityB}
                                        onClick={() => {
                                            const ticket = {
                                                id: uuidv4(),
                                                cityA: newTicket.cityA,
                                                cityB: newTicket.cityB,
                                                points: newTicket.points,
                                                type: newTicket.type
                                            };
                                            setMap(prev => ({
                                                ...prev,
                                                data: {
                                                    ...prev.data,
                                                    tickets: [...(prev.data.tickets || []), ticket]
                                                }
                                            }));
                                            setNewTicket({ cityA: '', cityB: '', points: 10, type: 'short' });
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

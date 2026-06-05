
'use client';

import React, { useState, useEffect, useRef } from 'react';
import MapEditor from '@/components/games/ttr/map-creator/MapEditor';
import { TtrMap, TtrMapData } from '@/types/ttr';
import { v4 as uuidv4 } from 'uuid';

export default function MapCreatorPage() {
    const [maps, setMaps] = useState<TtrMap[]>([]);
    const [currentMap, setCurrentMap] = useState<TtrMap | null>(null);
    const [loading, setLoading] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const newMapNameRef = useRef<string>("");

    useEffect(() => {
        fetchMaps();
    }, []);

    const fetchMaps = async () => {
        try {
            const res = await fetch('/api/ttr/maps');
            if (res.ok) {
                const data = await res.json();
                setMaps(data);
            }
        } catch (error) {
            console.error('Failed to fetch maps', error);
        } finally {
            setLoading(false);
        }
    };

    const createMapApiCall = async (name: string, imageUrl: string) => {
        try {
            const res = await fetch('/api/ttr/maps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, width: 800, height: 600, imageUrl }),
            });
            if (res.ok) {
                const newMap = await res.json();
                setMaps([newMap, ...maps]);
                setCurrentMap(newMap);
            }
        } catch (error) {
            console.error('Failed to create map', error);
        }
    }

    const createNewMap = async () => {
        const name = prompt('Enter map name:', 'New Map');
        if (!name) return;

        if (confirm("Do you want to upload a custom background image?\n(Click OK to upload, Cancel to use default Europe map)")) {
            newMapNameRef.current = name;
            if (fileInputRef.current) {
                fileInputRef.current.value = ""; // Reset
                fileInputRef.current.click();
            }
        } else {
            createMapApiCall(name, '/europe.jpeg');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic size check (e.g. 4MB limit)
        if (file.size > 4 * 1024 * 1024) {
            alert("Image file is too large! Please choose an image under 4MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
                createMapApiCall(newMapNameRef.current, result);
            }
        };
        reader.readAsDataURL(file);
    };

    const saveMap = async (updatedMap: TtrMap) => {
        try {
            const res = await fetch(`/api/ttr/maps/${updatedMap.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedMap),
            });
            if (res.ok) {
                alert('Map saved successfully!');
                fetchMaps(); // Refresh list
            } else {
                alert('Failed to save map');
            }
        } catch (error) {
            console.error('Failed to save map', error);
            alert('Error saving map');
        }
    };

    if (currentMap) {
        return (
            <div className="flex flex-col h-screen bg-gray-50">
                <div className="bg-gray-900 p-2 text-white">
                    <button
                        onClick={() => setCurrentMap(null)}
                        className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                    >
                        &larr; Back to Maps List
                    </button>
                </div>
                <div className="flex-grow overflow-hidden">
                    <MapEditor initialMap={currentMap} onSave={saveMap} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 bg-green-900">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Ticket to Ride - Map Creator</h1>
                    <button
                        onClick={createNewMap}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                    >
                        Create New Map
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                </div>

                {loading ? (
                    <p>Loading maps...</p>
                ) : (
                    <div className="bg-green-900 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {maps.map(map => (
                            <div
                                key={map.id}
                                className="bg-green-900 p-4 rounded shadow hover:shadow-md transition cursor-pointer"
                                onClick={() => setCurrentMap(map)}
                            >
                                <div className="h-32 bg-gray-800 mb-4 flex items-center justify-center rounded text-gray-400 overflow-hidden relative">
                                    {map.data.imageUrl ? (
                                        <img src={map.data.imageUrl} alt="Map" className="w-full h-full object-cover opacity-50" />
                                    ) : "Preview"}
                                    <span className="absolute text-gray-800 font-bold bg-white/50 px-2 rounded">Preview</span>
                                </div>
                                <h3 className="font-bold text-lg">{map.name}</h3>
                                <p className="text-sm text-gray-500">
                                    Cities: {map.data && (map.data as any).cities ? (map.data as any).cities.length : 0} |
                                    Tracks: {map.data && (map.data as any).tracks ? (map.data as any).tracks.length : 0}
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                    Last updated: {new Date(map.updatedAt).toLocaleDateString()}
                                </p>
                            </div>
                        ))}

                        {maps.length === 0 && (
                            <div className="col-span-full text-center py-10 text-gray-500">
                                No maps found. Create one to get started!
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

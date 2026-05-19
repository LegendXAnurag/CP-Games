export interface TtrMapData {
    cities: City[];
    tracks: Track[];
    imageUrl?: string;
    unitWidth?: number;
    unitHeight?: number;
    tickets?: RouteTicket[];
}

export interface RouteTicket {
    id: string;
    cityA: string;
    cityB: string;
    points: number;
    type: 'long' | 'short';
}

export interface City {
    id: string;
    name: string;
    x: number;
    y: number;
}

export interface Track {
    id: string;
    cityA: string; // ID of city A
    cityB: string; // ID of city B
    color?: string; // Optional for now
    length: number; // Number of units
    units: TrackUnit[];
}

export interface TrackUnit {
    id: string;
    x: number;
    y: number;
    rotation: number; // In degrees
    width?: number;
    height?: number;
}

export interface TtrMap {
    id: string;
    name: string;
    data: TtrMapData;
    width: number;
    height: number;
    createdAt: string;
    updatedAt: string;
}

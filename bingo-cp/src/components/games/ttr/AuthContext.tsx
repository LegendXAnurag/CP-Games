'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Define the shape of our user/member
export interface TtrUser {
    id: number;
    handle: string;
    teamId: number;
    teamColor: string;
    token?: string; // The JWT or secret key
}

interface AuthContextType {
    user: TtrUser | null;
    isSpectator: boolean;
    isLoading: boolean;
    login: (user: TtrUser, token: string) => void;
    spectate: () => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, matchId }: { children: ReactNode; matchId: string }) {
    const [user, setUser] = useState<TtrUser | null>(null);
    const [isSpectator, setIsSpectator] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load from localStorage on mount
        const loadAuth = () => {
            try {
                const stored = localStorage.getItem(`ttr_auth_${matchId}`);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.isSpectator) {
                        setIsSpectator(true);
                    } else if (parsed.user && parsed.token) {
                        setUser({ ...parsed.user, token: parsed.token });
                    }
                }
            } catch (e) {
                console.error("Failed to load auth from storage", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadAuth();
    }, [matchId]);

    const login = (userData: TtrUser, token: string) => {
        const userWithToken = { ...userData, token };
        setUser(userWithToken);
        setIsSpectator(false);
        localStorage.setItem(`ttr_auth_${matchId}`, JSON.stringify({ user: userData, token }));
    };

    const spectate = () => {
        setIsSpectator(true);
        setUser(null);
        localStorage.setItem(`ttr_auth_${matchId}`, JSON.stringify({ isSpectator: true }));
    };

    const logout = () => {
        setUser(null);
        setIsSpectator(false);
        localStorage.removeItem(`ttr_auth_${matchId}`);
    };

    return (
        <AuthContext.Provider value={{ user, isSpectator, isLoading, login, spectate, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useTtrAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useTtrAuth must be used within an AuthProvider');
    }
    return context;
}

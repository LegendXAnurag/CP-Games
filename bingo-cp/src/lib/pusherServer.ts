import Pusher from 'pusher';

// Singleton — reuse across serverless function invocations in the same process
let pusherInstance: Pusher | null = null;

export function getPusherServer(): Pusher {
    if (!pusherInstance) {
        pusherInstance = new Pusher({
            appId: (process.env.app_id || process.env.PUSHER_APP_ID)!.trim(),
            key: (process.env.key || process.env.NEXT_PUBLIC_PUSHER_KEY)!.trim(),
            secret: (process.env.secret || process.env.PUSHER_SECRET)!.trim(),
            cluster: (process.env.cluster || process.env.NEXT_PUBLIC_PUSHER_CLUSTER)!.trim(),
            useTLS: true,
        });
    }
    return pusherInstance;
}

/**
 * Broadcasts a 'ttr-update' event to all clients subscribed to a match channel.
 * Clients that receive this will immediately fetch the new game state from /api/ttr/sync.
 *
 * @param matchId  The match ID to broadcast to.
 * @param payload  Optional extra data (e.g. a hint about what changed).
 */
export async function broadcastTtrUpdate(matchId: string, payload?: Record<string, unknown>) {
    const pusher = getPusherServer();
    await pusher.trigger(`match-${matchId}`, 'ttr-update', payload ?? { ts: Date.now() });
}

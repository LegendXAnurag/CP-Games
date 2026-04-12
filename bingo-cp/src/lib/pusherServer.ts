import Pusher from 'pusher';

// Singleton — reuse across serverless function invocations in the same process
let pusherInstance: Pusher | null = null;

export function getPusherServer(): Pusher {
    if (!pusherInstance) {
        const appId = process.env.app_id || process.env.PUSHER_APP_ID;
        const key = process.env.key || process.env.NEXT_PUBLIC_PUSHER_KEY;
        const secret = process.env.secret || process.env.PUSHER_SECRET;
        const cluster = process.env.cluster || process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

        if (!appId || !key || !secret || !cluster) {
            console.error('Pusher configuration missing!', { appId: !!appId, key: !!key, secret: !!secret, cluster: !!cluster });
            throw new Error('Pusher configuration is incomplete');
        }

        pusherInstance = new Pusher({
            appId: appId.trim(),
            key: key.trim(),
            secret: secret.trim(),
            cluster: cluster.trim(),
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

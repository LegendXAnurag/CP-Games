import PusherJs from 'pusher-js';

// Singleton client — reuse the same connection across the whole page lifetime
let pusherClientInstance: PusherJs | null = null;

export function getPusherClient(): PusherJs {
    if (!pusherClientInstance) {
        pusherClientInstance = new PusherJs(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
            cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        });
    }
    return pusherClientInstance;
}

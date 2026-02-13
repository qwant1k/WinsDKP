import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';

const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  const token = useAuthStore.getState().accessToken;

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[WS] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[WS] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[WS] Connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinAuctionRoom(auctionId: string) {
  getSocket().emit('auction.join', { auctionId });
}

export function leaveAuctionRoom(auctionId: string) {
  getSocket().emit('auction.leave', { auctionId });
}

export function joinRandomizerRoom(sessionId: string) {
  getSocket().emit('randomizer.join', { sessionId });
}

export function joinActivityRoom(activityId: string) {
  getSocket().emit('activity.join', { activityId });
}

export function leaveActivityRoom(activityId: string) {
  getSocket().emit('activity.leave', { activityId });
}

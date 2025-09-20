// Simple Socket.IO client wrapper
import { io } from 'socket.io-client';

let socket = null;

export function connectSocket({ url, userId, name, role }) {
  if (socket && socket.connected) return socket;
  socket = io(url, { transports: ['websocket'] });
  socket.on('connect', () => {
    socket.emit('identify', { userId, name, role });
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
}

export function joinRoom(roomId) {
  if (!socket) return;
  socket.emit('room:join', { roomId });
}

export function onLocationBroadcast(handler) {
  if (!socket) return;
  socket.on('location:broadcast', handler);
}

export function emitLocationUpdate({ lat, lng, role }) {
  if (!socket) return;
  socket.emit('location:update', { lat, lng, role });
}

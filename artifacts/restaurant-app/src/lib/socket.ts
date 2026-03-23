import { io } from "socket.io-client";

// Connects to the same origin, path /socket.io
export const socket = io({ 
  path: "/socket.io", 
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

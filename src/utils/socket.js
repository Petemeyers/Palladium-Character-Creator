/**
 * Centralized Socket.IO connection manager
 * Handles connection errors gracefully when backend is not available
 */

import { io } from "socket.io-client";

let socketInstance = null;

/**
 * Get or create a Socket.IO connection
 * Automatically handles connection errors gracefully
 */
export function getSocket() {
  if (socketInstance) {
    return socketInstance;
  }

  // Create socket with graceful error handling
  socketInstance = io("http://localhost:5000", {
    autoConnect: true,
    reconnection: false, // Disable auto-reconnection to reduce console spam
    reconnectionAttempts: 0, // Don't attempt reconnection
    reconnectionDelay: 0,
    timeout: 2000,
    transports: ["websocket", "polling"],
  });

  // Suppress connection errors completely - backend may not be running
  // This prevents console spam when the backend server is not started
  socketInstance.on("connect_error", (error) => {
    // Silently ignore - backend may not be running
    // Socket.IO will still function for emit calls, they just won't be sent
    if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
      // Only log once, using debug level
      console.debug(
        "Socket.IO: Backend not available (backend may not be running)"
      );
    }
    // Prevent the error from propagating to console.error
    error.preventDefault?.();
  });

  socketInstance.on("connect", () => {
    if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
      console.debug("Socket.IO: Connected to backend");
    }
  });

  socketInstance.on("disconnect", () => {
    if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
      console.debug("Socket.IO: Disconnected from backend");
    }
  });

  // Override emit to handle disconnected state gracefully
  const originalEmit = socketInstance.emit.bind(socketInstance);
  socketInstance.emit = function (...args) {
    if (!socketInstance.connected) {
      // Silently ignore emit calls when not connected
      if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
        console.debug("Socket.IO: Skipping emit (not connected):", args[0]);
      }
      return socketInstance;
    }
    return originalEmit(...args);
  };

  return socketInstance;
}

/**
 * Check if socket is connected
 */
export function isSocketConnected() {
  return socketInstance?.connected || false;
}

/**
 * Disconnect socket (useful for cleanup)
 */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export default getSocket;

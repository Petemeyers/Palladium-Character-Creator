/**
 * Centralized Socket.IO connection manager
 * Handles connection errors gracefully when backend is not available
 */

import { io } from "socket.io-client";
import { isBackendOffline, markBackendOffline } from "./backendStatus.js";

let socketInstance = null;

function createOfflineSocket() {
  return {
    connected: false,
    emit() {
      return this;
    },
    on() {
      return this;
    },
    off() {
      return this;
    },
    disconnect() {
      return this;
    },
    connect() {
      if (!isBackendOffline()) {
        return getSocket({ forceConnect: true });
      }
      return this;
    },
  };
}

/**
 * Get or create a Socket.IO connection
 * Automatically handles connection errors gracefully
 */
export function getSocket(options = {}) {
  if (socketInstance) {
    return socketInstance;
  }

  if (isBackendOffline() && !options.forceConnect) {
    socketInstance = createOfflineSocket();
    return socketInstance;
  }

  // Create socket with graceful error handling
  socketInstance = io("http://localhost:5000", {
    autoConnect: false,
    reconnection: false, // Disable auto-reconnection to reduce console spam
    reconnectionAttempts: 0, // Don't attempt reconnection
    reconnectionDelay: 0,
    timeout: 2000,
    transports: ["websocket", "polling"],
  });

  // Suppress connection errors completely - backend may not be running
  // This prevents console spam when the backend server is not started
  socketInstance.on("connect_error", () => {
    markBackendOffline();
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

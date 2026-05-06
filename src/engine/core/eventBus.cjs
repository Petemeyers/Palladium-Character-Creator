// src/engine/core/eventBus.cjs

function createEventBus() {
  const subscribers = new Set();

  function subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  }

  function emit(event) {
    subscribers.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error("[EventBus] Subscriber error:", err);
      }
    });
  }

  function clear() {
    subscribers.clear();
  }

  return { subscribe, emit, clear };
}

module.exports = { createEventBus };


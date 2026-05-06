const { parentPort } = require("worker_threads");
const { dispatch } = require("../src/engine/engine.cjs");
const { GridState } = require("../src/engine/gridState.cjs");
const { getReachableHexes } = require("../src/engine/reachable.cjs");
const { getModePolicy } = require("../src/engine/movementModes.cjs");

// Global grid state instance (one per combat)
let gridState = null;

// Global time scale (0.25 = slow, 1 = normal, 2 = fast, 0 = pause)
let timeScale = 1.0;

// Lock system: track per-entity locks (moving, acting, turn, etc.)
const locksByEntity = new Map(); // eid -> Set(lockName)

function hasLock(eid, lock) {
  const set = locksByEntity.get(eid);
  return !!set && set.has(lock);
}

function addLock(eid, lock) {
  let set = locksByEntity.get(eid);
  if (!set) {
    set = new Set();
    locksByEntity.set(eid, set);
  }
  set.add(lock);
}

function removeLock(eid, lock) {
  const set = locksByEntity.get(eid);
  if (!set) return;
  set.delete(lock);
  if (set.size === 0) locksByEntity.delete(eid);
}

function getLocks(eid) {
  return Array.from(locksByEntity.get(eid) || []);
}

// Backwards compatibility wrappers for "moving" lock
function isBusy(eid) {
  return hasLock(eid, "moving");
}

function setBusy(eid, reason = "animating") {
  addLock(eid, "moving");
}

function clearBusy(eid) {
  removeLock(eid, "moving");
}

parentPort.on("message", async (msg) => {
  const { id, method, payload } = msg || {};
  try {
    // Preserve engine helpers you already inject (locks, gridState, timeScale)
    const engineCtx = {
      timeScale,
      hasLock,
      addLock,
      removeLock,
      getLocks,
      gridState,
    };

    // Keep gridState init for move and getReachableHexes
    if (method === "move" || method === "getReachableHexes") {
      if (!gridState) {
        gridState = new GridState();
      }
      if (payload?.state?.positions) {
        gridState.initializeFromPositions(payload.state.positions);
      }
      if (payload?.state?.terrain) {
        gridState.initializeFromTerrain(payload.state.terrain);
      }
      engineCtx.gridState = gridState;
    }

    // Special handling for getReachableHexes (not a command, utility)
    if (method === "getReachableHexes") {
      const { eid, state, mode } = payload;
      const fighter = state.fighters.find(f => f.id === eid);
      if (!fighter) {
        parentPort.postMessage({ id, ok: false, error: { message: "Fighter not found" } });
        return;
      }

      const start = state.positions[eid];
      if (!start) {
        parentPort.postMessage({ id, ok: false, error: { message: "No position" } });
        return;
      }

      const policy = getModePolicy(mode, fighter);
      const hexes = getReachableHexes({
        start,
        gridState,
        mover: fighter,
        moverId: eid,
        maxCost: policy.budget,
      });

      parentPort.postMessage({ id, ok: true, result: { mode: policy.mode, hexes } });
      return;
    }

    // Lock management routes (not commands, direct utilities)
    if (method === "hasLock") {
      const { eid, lock } = payload;
      parentPort.postMessage({ id, ok: true, result: { eid, lock, has: hasLock(eid, lock) } });
      return;
    }

    if (method === "getLocks") {
      const { eid } = payload;
      parentPort.postMessage({ id, ok: true, result: { eid, locks: getLocks(eid) } });
      return;
    }

    if (method === "addLock") {
      const { eid, lock } = payload;
      addLock(eid, lock);
      parentPort.postMessage({ id, ok: true, result: { eid, locks: getLocks(eid) } });
      return;
    }

    if (method === "removeLock") {
      const { eid, lock } = payload;
      removeLock(eid, lock);
      parentPort.postMessage({ id, ok: true, result: { eid, locks: getLocks(eid) } });
      return;
    }

    // Backwards compatibility routes (wrappers for "moving" lock)
    if (method === "isBusy") {
      const { eid } = payload;
      parentPort.postMessage({ id, ok: true, result: { eid, busy: isBusy(eid), locks: getLocks(eid) } });
      return;
    }

    if (method === "clearBusy") {
      const { eid } = payload;
      clearBusy(eid);
      parentPort.postMessage({ id, ok: true, result: { eid, locks: getLocks(eid) } });
      return;
    }

    if (method === "setTimeScale") {
      timeScale = Number(payload?.timeScale ?? 1);
      if (!Number.isFinite(timeScale)) timeScale = 1;
      if (timeScale < 0) timeScale = 0;
      parentPort.postMessage({ id, ok: true, result: { timeScale } });
      return;
    }

    if (method === "getTimeScale") {
      parentPort.postMessage({ id, ok: true, result: { timeScale } });
      return;
    }

    // Use unified dispatch for all commands
    const result = await dispatch(method, { ...payload, engine: engineCtx });
    
    // Handle both old format (result.events) and new format (result.ok, result.events)
    if (result && typeof result === "object" && "events" in result) {
      parentPort.postMessage({ id, ok: result.ok !== false, result });
    } else {
      parentPort.postMessage({ id, ok: true, result });
    }
  } catch (err) {
    parentPort.postMessage({
      id,
      ok: false,
      error: { message: err?.message || String(err), stack: err?.stack },
    });
  }
});


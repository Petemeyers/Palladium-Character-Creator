// src/engine/resolveUseTactic.cjs
const { scheduleTactic } = require("./scheduleTactic.cjs");
const { normalizeRange } = require("./utils/normalizeRange.cjs");
const { hexDistanceAxial } = require("./utils/hexDistance.cjs");
const { hasLineOfSightElevation } = require("./losElevationEngine.cjs");

function normalizeTargetToHex({ target, state }) {
  if (!target) return null;

  if (typeof target === "string") {
    const p = state.positions?.[target];
    return p ? { x: p.x, y: p.y } : null;
  }

  if (typeof target === "object") {
    if (Number.isFinite(target.x) && Number.isFinite(target.y)) return { x: target.x, y: target.y };
    if (Number.isFinite(target.q) && Number.isFinite(target.r)) return { x: target.q, y: target.r };
  }

  return null;
}

function getPowerCostfocus(power) {
  return (
    power?.focusCost ??
    power?.focusCost ??
    power?.cost?.focus ??
    power?.cost ??
    0
  );
}

module.exports = function resolveUseTactic(payload) {
  const { user, target, power, state, engine, meta } = payload;
  const events = [];

  if (!user || !power) return { ok: false, error: { message: "Missing user/power" } };

  // locks
  if (engine?.hasLock?.(user, "acting")) return { ok: false, error: { message: "LOCKED_ACTING" } };
  if (engine?.hasLock?.(user, "moving")) return { ok: false, error: { message: "LOCKED_MOVING" } };

  engine?.addLock?.(user, "acting");
  events.push({ type: "ENGINE_SET_LOCK", lock: { type: "entity", id: user, lock: "acting" } });

  const from = state.positions?.[user];
  if (!from) return fail("Missing user position");

  const to = normalizeTargetToHex({ target, state }) || { x: from.x, y: from.y };

  // Range validation (engine authority)
  const userF = state.fighters?.find(f => f.id === user);
  const level = userF?.level ?? userF?.Level ?? 1;
  const maxHex = normalizeRange(power.range, { level });

  if (maxHex !== Infinity) {
    const dist = hexDistanceAxial({ x: from.x, y: from.y }, to);
    if (dist > maxHex) {
      return fail("Out of range");
    }
  }

  // LOS validation (engine-authoritative, elevation-aware)
  if (power.requiresLos !== false) {
    const los = hasLineOfSightElevation(state, {
      fromHex: from,
      toHex: to,
      fromId: user,
      toId: typeof target === "string" ? target : target?.id,
    });

    if (!los.los) {
      return fail("No line of sight");
    }
  }

  // focus validation + spend upfront
  const fighter = state.fighters?.find(f => f.id === user);
  const costfocus = getPowerCostfocus(power);
  const currentfocus = fighter?.currentfocus ?? fighter?.focus ?? 0;

  if (currentfocus < costfocus) return fail("Insufficient focus");

  events.push({
    type: "focus_SPENT",
    eid: user,
    amount: costfocus,
    remaining: Math.max(0, currentfocus - costfocus),
    power: power?.name || power?.id,
  });

  // schedule
  const flightMs = meta?.flightMs ?? 450;

  const items = scheduleTactic({
    userId: user,
    power,
    from: { x: from.x, y: from.y },
    to,
    flightMs,
  });

  items.push({
    t: flightMs + 1,
    e: {
      type: "ENGINE_CALL",
      method: "resolveTacticalImpact",
      payload: { user, target, power, state, meta },
    },
  });

  items.push({
    t: flightMs + 2,
    e: { type: "ENGINE_CLEAR_LOCK", lock: { type: "entity", id: user, lock: "acting" } },
  });

  events.push({
    type: "SCHEDULED_EVENTS",
    id: `sched:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    kind: "tactical",
    owner: { type: "entity", id: user },
    locks: [{ type: "entity", id: user, lock: "acting" }],
    items,
  });

  return { ok: true, events };

  function fail(message) {
    engine?.removeLock?.(user, "acting");
    events.push({ type: "ENGINE_CLEAR_LOCK", lock: { type: "entity", id: user, lock: "acting" } });
    return { ok: false, error: { message }, events };
  }
};

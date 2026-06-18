// src/engine/resolveCastTechnique.cjs
const { scheduleTechnique } = require("./scheduleTechnique.cjs");
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
    if (Number.isFinite(target.x) && Number.isFinite(target.y)) {
      return { x: target.x, y: target.y };
    }
    if (Number.isFinite(target.q) && Number.isFinite(target.r)) {
      return { x: target.q, y: target.r };
    }
  }

  return null;
}

function getTechniqueCost(technique) {
  return (
    technique?.staminaCost ??
    technique?.staminaCost ??
    technique?.stamina ??
    technique?.stamina ??
    technique?.cost?.stamina ??
    technique?.cost ??
    0
  );
}

module.exports = function resolveCastTechnique(payload) {
  const { caster, target, technique, state, engine, meta } = payload;
  const events = [];

  if (!caster || !technique) {
    return { ok: false, error: { message: "Missing caster or technique" } };
  }

  if (engine?.hasLock?.(caster, "acting")) {
    return { ok: false, error: { message: "LOCKED_ACTING" } };
  }
  if (engine?.hasLock?.(caster, "moving")) {
    return { ok: false, error: { message: "LOCKED_MOVING" } };
  }

  engine?.addLock?.(caster, "acting");
  events.push({
    type: "ENGINE_SET_LOCK",
    lock: { type: "entity", id: caster, lock: "acting" },
  });

  const from = state.positions?.[caster];
  if (!from) return fail("Missing caster position");

  const to =
    normalizeTargetToHex({ target, state }) ||
    { x: from.x, y: from.y };

  // Range validation (engine authority)
  const casterF = state.fighters?.find(f => f.id === caster);
  const level = casterF?.level ?? casterF?.Level ?? 1;
  const maxHex = normalizeRange(technique.range, { level });

  if (maxHex !== Infinity) {
    const dist = hexDistanceAxial({ x: from.x, y: from.y }, to);
    if (dist > maxHex) {
      return fail("Out of range");
    }
  }

  // LOS validation (engine-authoritative, elevation-aware)
  if (technique.requiresLos !== false) {
    const los = hasLineOfSightElevation(state, {
      fromHex: from,
      toHex: to,
      fromId: caster,
      toId: typeof target === "string" ? target : target?.id,
    });

    if (!los.los) {
      return fail("No line of sight");
    }
  }

  const fighter = state.fighters?.find(f => f.id === caster);
  const coststamina = getTechniqueCost(technique);
  const currentstamina = fighter?.currentstamina ?? fighter?.stamina ?? 0;

  if (currentstamina < coststamina) {
    return fail("Insufficient stamina");
  }

  events.push({
    type: "stamina_SPENT",
    eid: caster,
    amount: coststamina,
    remaining: Math.max(0, currentstamina - coststamina),
    technique: technique?.name || technique?.id,
  });

  const flightMs = meta?.flightMs ?? 550;
  const castId = meta?.castId ?? `cast:${Date.now()}:${Math.random().toString(16).slice(2)}`;

  const impactMeta = { ...meta, castId };

  const items = scheduleTechnique({
    casterId: caster,
    technique,
    from: { x: from.x, y: from.y },
    to,
    flightMs,
    castId,
  });

  items.push({
    t: flightMs,
    e: {
      type: "ENGINE_CALL",
      method: "resolveTechniqueImpact",
      payload: { caster, target, technique, state, meta: impactMeta },
    },
  });

  items.push({
    t: flightMs + 2,
    e: {
      type: "ENGINE_CLEAR_LOCK",
      lock: { type: "entity", id: caster, lock: "acting" },
    },
  });

  events.push({
    type: "SCHEDULED_EVENTS",
    id: `sched:technique:${castId}`,
    kind: "technique",
    owner: { type: "entity", id: caster },
    locks: [{ type: "entity", id: caster, lock: "acting" }],
    items,
  });

  return { ok: true, events };

  function fail(message) {
    engine?.removeLock?.(caster, "acting");
    events.push({
      type: "ENGINE_CLEAR_LOCK",
      lock: { type: "entity", id: caster, lock: "acting" },
    });
    return { ok: false, error: { message }, events };
  }
};


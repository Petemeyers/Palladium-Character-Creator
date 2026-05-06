// src/engine/resolveCastSpell.cjs
const { scheduleSpell } = require("./scheduleSpell.cjs");
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

function getSpellCost(spell) {
  return (
    spell?.ppeCost ??
    spell?.PPECost ??
    spell?.cost?.ppe ??
    spell?.cost ??
    0
  );
}

module.exports = function resolveCastSpell(payload) {
  const { caster, target, spell, state, engine, meta } = payload;
  const events = [];

  if (!caster || !spell) {
    return { ok: false, error: { message: "Missing caster or spell" } };
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
  const maxHex = normalizeRange(spell.range, { level });

  if (maxHex !== Infinity) {
    const dist = hexDistanceAxial({ x: from.x, y: from.y }, to);
    if (dist > maxHex) {
      return fail("Out of range");
    }
  }

  // LOS validation (engine-authoritative, elevation-aware)
  if (spell.requiresLos !== false) {
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
  const costPPE = getSpellCost(spell);
  const currentPPE = fighter?.currentPPE ?? fighter?.PPE ?? 0;

  if (currentPPE < costPPE) {
    return fail("Insufficient PPE");
  }

  events.push({
    type: "PPE_SPENT",
    eid: caster,
    amount: costPPE,
    remaining: Math.max(0, currentPPE - costPPE),
    spell: spell?.name || spell?.id,
  });

  const flightMs = meta?.flightMs ?? 550;

  // Stable per-cast id so the UI can queue/flush impact-timed logs safely
  const castId =
    meta?.castId ??
    `cast:${caster}:${spell?.name || spell?.id || "spell"}:${Date.now()}:${Math.random().toString(16).slice(2)}`;

  const items = scheduleSpell({
    casterId: caster,
    spell,
    from: { x: from.x, y: from.y },
    to,
    flightMs,
    castId,
  });

// UI hook: impact moment (flush queued logs here)
items.push({
  t: flightMs,
  e: {
    type: "SPELL_IMPACT",
    castId,
    caster,
    target: typeof target === "string" ? target : target?.id ?? null,
    spell: spell?.name || spell?.id || "spell",
  },
});

  items.push({
    t: flightMs + 1,
    e: {
      type: "ENGINE_CALL",
      method: "resolveSpellImpact",
      payload: { caster, target, spell, state, meta: { ...(meta || {}), castId } },
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
    id: `sched:spell:${castId}`,
    kind: "spell",
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


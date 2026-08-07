import { getArmorStaminaBurden } from "../combatStamina.js";

const normalize = (value) => String(value ?? "").trim().toLowerCase().replaceAll("_", "-");

export function createCanonicalMovementRegistry() {
  return new Map();
}

export function calculateCanonicalMovementStaminaCost({
  actor = {},
  distanceFt = 0,
  movementMode = "move",
  forced = false,
} = {}) {
  const distance = Math.max(0, Number(distanceFt) || 0);
  if (forced || distance <= 0) return 0;
  const mode = normalize(movementMode);
  const segments = Math.max(1, Math.ceil(distance / 30));
  const armor = getArmorStaminaBurden(actor, actor.armorProfile || {});
  const isSprint = /sprint/.test(mode);
  const isRun = /run|charge|dash|panic/.test(mode);
  const isFlight = /fly|flight/.test(mode);
  const basePerSegment = isSprint ? 3 : isRun ? 2 : 1;
  const armorPenalty = isRun
    ? armor.panicMovePenalty + armor.shieldPenalty
    : armor.controlledMovePenalty;
  const flightPenalty = isFlight && isRun ? 1 : 0;
  const longMovePenalty = distance >= 60 ? armor.longMovePenalty : 0;
  return basePerSegment * segments + armorPenalty + flightPenalty + longMovePenalty;
}

const movementEvent = (eventType, record, level = "info") => ({
  eventType,
  level,
  actorId: record.actorId,
  executionKey: record.executionKey,
  source: record.source,
  data: { ...record },
});

export function commitCanonicalMovement({
  registry,
  actor,
  actorId = actor?.id ?? actor?._id,
  from,
  to,
  path = null,
  distanceFt,
  movementMode = "move",
  actionCost = 1,
  staminaCost = null,
  source = "movement",
  executionKey,
  forced = false,
  spendStamina,
  commit,
} = {}) {
  if (!(registry instanceof Map) || !actorId || !actor || !executionKey || !to) {
    return { accepted: false, reason: "invalid-canonical-movement-request", events: [] };
  }
  if (registry.has(executionKey)) {
    return {
      accepted: false,
      duplicate: true,
      reason: "movement-execution-already-resolved",
      record: registry.get(executionKey),
      events: [],
    };
  }
  const resolvedDistance = Math.max(0, Number(distanceFt) || 0);
  const resolvedCost = staminaCost == null
    ? calculateCanonicalMovementStaminaCost({ actor, distanceFt: resolvedDistance, movementMode, forced })
    : Math.max(0, Number(staminaCost) || 0);
  const base = {
    actorId,
    from: from ? { ...from } : null,
    to: { ...to },
    path: Array.isArray(path) ? path.map((point) => ({ ...point })) : null,
    distanceFt: resolvedDistance,
    movementMode: normalize(movementMode) || "move",
    actionCost,
    staminaCost: resolvedCost,
    source,
    executionKey,
    forced: Boolean(forced),
    createdAt: Date.now(),
  };
  const events = [movementEvent("movement-stamina-spend-requested", base)];
  const stamina = resolvedCost > 0
    ? spendStamina?.({ actor, amount: resolvedCost, reason: "movement", executionKey, source })
    : { accepted: true, spent: 0, updated: actor, nextStamina: actor.currentStamina ?? actor.currentstamina ?? null };
  if (stamina?.accepted !== true) {
    const record = Object.freeze({ ...base, accepted: false, reason: stamina?.reason || "movement-stamina-rejected", resolvedAt: Date.now() });
    registry.set(executionKey, record);
    events.push(movementEvent("movement-stamina-spend-rejected", record, "warning"));
    return { accepted: false, reason: record.reason, stamina, record, events };
  }
  const committed = commit?.({ actor: stamina.updated || actor, actorId, from, to, path, source, executionKey });
  if (committed === false || committed?.accepted === false) {
    const record = Object.freeze({ ...base, accepted: false, reason: committed?.reason || "movement-commit-rejected", resolvedAt: Date.now() });
    registry.set(executionKey, record);
    events.push(movementEvent("movement-stamina-spend-rejected", record, "warning"));
    return { accepted: false, reason: record.reason, stamina, record, events };
  }
  const record = Object.freeze({
    ...base,
    accepted: true,
    spent: Number(stamina.spent || 0),
    previousStamina: stamina.previousStamina ?? null,
    nextStamina: stamina.nextStamina ?? stamina.currentStamina ?? null,
    committedAt: Date.now(),
  });
  registry.set(executionKey, record);
  events.push(
    movementEvent("movement-stamina-spend-resolved", record),
    movementEvent("movement-committed", record),
  );
  return { accepted: true, actor: stamina.updated || actor, stamina, record, committed, events };
}

export default commitCanonicalMovement;

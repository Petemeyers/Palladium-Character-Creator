import {
  decrementInventoryAmmo,
  getInventoryAmmoCount,
} from "../combatAmmoManager.js";

const normalize = (value) => String(value ?? "").trim().toLowerCase();

export function createCanonicalAmmunitionRegistry() {
  return new Map();
}

const ammunitionEvent = (eventType, record, extra = {}) => ({
  eventType,
  actorId: record.actorId,
  executionKey: record.executionKey,
  source: record.source,
  data: {
    actorId: record.actorId,
    ammoType: record.ammoType,
    quantity: record.quantity,
    previousCount: record.previousCount,
    nextCount: record.nextCount,
    executionKey: record.executionKey,
    projectileReleased: record.projectileReleased,
    source: record.source,
    ...extra,
  },
});

export function spendAmmunitionOnce({
  registry,
  actor,
  actorId = actor?.id ?? actor?._id,
  ammoType,
  quantity = 1,
  executionKey,
  projectileReleased,
  source = "canonical-ranged-attack",
} = {}) {
  if (!(registry instanceof Map)) {
    return { accepted: false, reason: "missing-ammunition-registry", events: [] };
  }
  const normalizedAmmoType = normalize(ammoType);
  const requested = Math.max(1, Math.floor(Number(quantity) || 1));
  if (!actor || !actorId || !normalizedAmmoType || !executionKey || typeof projectileReleased !== "boolean") {
    return { accepted: false, reason: "invalid-ammunition-request", actor, events: [] };
  }

  const existing = registry.get(executionKey);
  if (existing) {
    const matches = existing.actorId === actorId && existing.ammoType === normalizedAmmoType;
    return {
      accepted: matches && existing.accepted,
      duplicate: true,
      projectileAuthorized: false,
      spent: 0,
      reason: matches ? "ammunition-already-resolved" : "execution-key-ammunition-mismatch",
      actor,
      record: existing,
      events: [],
    };
  }

  const previousCount = getInventoryAmmoCount(actor, normalizedAmmoType);
  const base = {
    actorId,
    ammoType: normalizedAmmoType,
    quantity: requested,
    executionKey,
    projectileReleased,
    previousCount,
    nextCount: previousCount,
    source,
    accepted: false,
    createdAt: Date.now(),
  };
  const requestedEvent = ammunitionEvent("ammunition-spend-requested", base);

  if (!projectileReleased) {
    const record = Object.freeze({
      ...base,
      accepted: true,
      spent: 0,
      reason: "projectile-not-released",
      resolvedAt: Date.now(),
    });
    registry.set(executionKey, record);
    return {
      accepted: true,
      projectileAuthorized: false,
      spent: 0,
      actor,
      record,
      events: [requestedEvent, ammunitionEvent("ammunition-spend-resolved", record)],
    };
  }

  if (previousCount < requested) {
    const record = Object.freeze({
      ...base,
      reason: "insufficient-ammunition",
      rejectedAt: Date.now(),
    });
    registry.set(executionKey, record);
    return {
      accepted: false,
      projectileAuthorized: false,
      spent: 0,
      reason: record.reason,
      actor,
      record,
      events: [requestedEvent, ammunitionEvent("ammunition-spend-rejected", record)],
    };
  }

  const updatedActor = decrementInventoryAmmo(actor, normalizedAmmoType, requested);
  const nextCount = getInventoryAmmoCount(updatedActor, normalizedAmmoType);
  const record = Object.freeze({
    ...base,
    accepted: true,
    spent: previousCount - nextCount,
    nextCount,
    reason: "ammunition-spent",
    resolvedAt: Date.now(),
  });
  registry.set(executionKey, record);
  return {
    accepted: true,
    projectileAuthorized: true,
    spent: record.spent,
    actor: updatedActor,
    record,
    events: [
      requestedEvent,
      ammunitionEvent("ammunition-spend-resolved", record),
      ammunitionEvent("projectile-released", record),
    ],
  };
}

export function auditCanonicalAmmunitionRegistry(registry) {
  const records = registry instanceof Map ? [...registry.values()] : [];
  const released = records.filter((record) => record.projectileReleased && record.accepted);
  return {
    transactionCount: records.length,
    releasedCount: released.length,
    spentCount: records.reduce((sum, record) => sum + Number(record.spent || 0), 0),
    uniqueExecutionKeyCount: new Set(records.map((record) => record.executionKey)).size,
    matches: records.length === new Set(records.map((record) => record.executionKey)).size,
  };
}

export default spendAmmunitionOnce;

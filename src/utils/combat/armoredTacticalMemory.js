export const DEFAULT_ARMORED_TACTICAL_MEMORY = Object.freeze({
  solidPlateContacts: 0,
  ineffectiveCutContacts: 0,
  failedGapAttempts: 0,
  successfulGapHits: 0,
  grappleAttempts: 0,
  grappleSuccesses: 0,
  lastTechnique: null,
  lastContactType: null,
  lastRound: null,
  lastTurn: null,
});

export function createArmoredTacticalMemory() {
  return { ...DEFAULT_ARMORED_TACTICAL_MEMORY };
}

export function getArmoredTacticalMemoryKey({ generationId = "default", attackerId, defenderId } = {}) {
  return `${generationId || "default"}::${attackerId || "unknown-attacker"}::${defenderId || "unknown-defender"}`;
}

export const buildArmoredTacticalMemoryKey = getArmoredTacticalMemoryKey;

export function getArmoredTacticalMemory(store, args = {}) {
  if (!store) return createArmoredTacticalMemory();
  const key = typeof args === "string" ? args : getArmoredTacticalMemoryKey(args);
  return { ...createArmoredTacticalMemory(), ...(store.get?.(key) || {}) };
}

export function clearArmoredTacticalMemoryStore(store) {
  store?.clear?.();
  return store;
}

export function clearArmoredTacticalMemoryForGeneration(store, generationId) {
  if (!store?.delete || !store?.keys) return store;
  const prefix = `${generationId || "default"}::`;
  for (const key of store.keys()) {
    if (String(key).startsWith(prefix)) store.delete(key);
  }
  return store;
}

export function updateArmoredTacticalMemory(store, args = {}, patch = {}) {
  if (!store?.set) return createArmoredTacticalMemory();
  const key = getArmoredTacticalMemoryKey(args);
  const previous = getArmoredTacticalMemory(store, key);
  const next = {
    ...previous,
    ...patch,
    lastTechnique: patch.lastTechnique ?? previous.lastTechnique,
    lastContactType: patch.lastContactType ?? previous.lastContactType,
    lastRound: args.round ?? patch.lastRound ?? previous.lastRound,
    lastTurn: args.turn ?? patch.lastTurn ?? previous.lastTurn,
  };
  store.set(key, next);
  return { ...next };
}

export function recordArmorContactOutcome(store, args = {}, contactResult = {}) {
  const previous = getArmoredTacticalMemory(store, args);
  const attackMode = contactResult.attackMode || args.attackMode || previous.lastTechnique;
  const contactType = contactResult.contactType || previous.lastContactType;
  const isSolidPlate = contactType === "solid-plate";
  const isCut = attackMode === "longsword-cut" || String(attackMode || "").includes("cut");
  const isHalfSword = attackMode === "half-sword-thrust";
  const gapReached = Boolean(contactResult.gapReached || contactType === "armor-gap");

  return updateArmoredTacticalMemory(store, args, {
    solidPlateContacts: previous.solidPlateContacts + (isSolidPlate ? 1 : 0),
    ineffectiveCutContacts:
      previous.ineffectiveCutContacts + (isSolidPlate && isCut && !contactResult.damageAllowed ? 1 : 0),
    failedGapAttempts:
      previous.failedGapAttempts + (isHalfSword && !gapReached ? 1 : 0),
    successfulGapHits:
      previous.successfulGapHits + (gapReached ? 1 : 0),
    lastTechnique: attackMode,
    lastContactType: contactType,
  });
}

function getOutcomeType(contactResult = {}) {
  const attackMode = contactResult.attackMode || "";
  const contactType = contactResult.contactType || "";
  const gapReached = Boolean(contactResult.gapReached || contactType === "armor-gap");
  if (gapReached) return "successful-gap-hit";
  if (attackMode === "grapple") return contactResult.success ? "grapple-success" : "grapple-attempt";
  if (attackMode === "pommel-or-crossguard-strike") return "pommel-impact";
  if (attackMode === "half-sword-thrust") return "failed-gap-attempt";
  if (attackMode === "longsword-thrust" && contactResult.gapCapable) return "longsword-thrust-gap-failure";
  if (contactType === "solid-plate") return attackMode === "longsword-cut" ? "ineffective-cut" : "solid-plate-contact";
  return "armor-contact";
}

export function recordArmoredTacticalOutcome(store, args = {}) {
  if (!store?.set) return { memory: createArmoredTacticalMemory(), recorded: false, outcomeType: "no-store" };
  const {
    generationId = "default",
    attackerId,
    defenderId,
    executionKey = "unknown-execution",
    contactResult = {},
    attackMode = contactResult.attackMode,
    round,
    turn,
  } = args;
  const outcomeType = args.outcomeType || getOutcomeType({ ...contactResult, attackMode });
  const idempotencyKey = `${generationId || "default"}::${executionKey}::${outcomeType}`;
  if (!store.__armoredOutcomeIds) {
    Object.defineProperty(store, "__armoredOutcomeIds", {
      value: new Set(),
      enumerable: false,
      configurable: true,
    });
  }
  if (store.__armoredOutcomeIds.has(idempotencyKey)) {
    return {
      memory: getArmoredTacticalMemory(store, { generationId, attackerId, defenderId }),
      recorded: false,
      outcomeType,
      idempotencyKey,
    };
  }
  store.__armoredOutcomeIds.add(idempotencyKey);

  const previous = getArmoredTacticalMemory(store, { generationId, attackerId, defenderId });
  const nextPatch = {
    solidPlateContacts: previous.solidPlateContacts,
    ineffectiveCutContacts: previous.ineffectiveCutContacts,
    failedGapAttempts: previous.failedGapAttempts,
    successfulGapHits: previous.successfulGapHits,
    grappleAttempts: previous.grappleAttempts,
    grappleSuccesses: previous.grappleSuccesses,
    lastTechnique: attackMode || previous.lastTechnique,
    lastContactType: contactResult.contactType || previous.lastContactType,
    lastRound: round,
    lastTurn: turn,
  };

  if (contactResult.contactType === "solid-plate") nextPatch.solidPlateContacts += 1;
  if (outcomeType === "ineffective-cut") nextPatch.ineffectiveCutContacts += 1;
  if (
    outcomeType === "failed-gap-attempt" ||
    outcomeType === "longsword-thrust-gap-failure"
  ) {
    nextPatch.failedGapAttempts += 1;
    if (contactResult.contactType === "solid-plate" && nextPatch.solidPlateContacts === previous.solidPlateContacts) {
      nextPatch.solidPlateContacts += 1;
    }
  }
  if (outcomeType === "successful-gap-hit") {
    nextPatch.successfulGapHits += 1;
    nextPatch.lastContactType = "armor-gap";
  }
  if (outcomeType === "grapple-attempt") nextPatch.grappleAttempts += 1;
  if (outcomeType === "grapple-success") {
    nextPatch.grappleAttempts += 1;
    nextPatch.grappleSuccesses += 1;
  }

  const memory = updateArmoredTacticalMemory(
    store,
    { generationId, attackerId, defenderId, round, turn },
    nextPatch,
  );
  return { memory, recorded: true, outcomeType, idempotencyKey, before: previous, after: memory };
}

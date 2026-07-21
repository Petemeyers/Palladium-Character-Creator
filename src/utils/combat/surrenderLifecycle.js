export const CANONICAL_SURRENDER_STATUSES = Object.freeze({
  OFFERED: "offered", RESPONSE_PENDING: "response-pending", ACCEPTED: "accepted", REFUSED: "refused",
  VICTOR_DECISION_PENDING: "victor-decision-pending", RESOLVED: "resolved", CANCELED: "canceled",
});

export const SURRENDER_DECISION_PHASES = Object.freeze({ RESPONSE: "response", VICTOR: "victor-decision" });
export const SURRENDER_OUTCOMES = Object.freeze({
  takePrisoner: "take-prisoner", setRansomDisposition: "ransom", confiscateAndCapture: "confiscate-and-capture",
  disarmAndRelease: "disarm-and-release", acceptYieldWithoutCapture: "yield-accepted",
  revokeSurrenderAcceptance: "acceptance-revoked", executeSurrenderedOpponent: "executed",
});

const idOf = (actor) => actor?.id ?? actor?._id ?? null;
const unresolved = new Set(["offered", "response-pending", "accepted", "victor-decision-pending"]);
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const event = (eventType, record, data = {}) => ({ eventType, surrenderId: record.surrenderId, actorId: record.offeredById, targetId: record.offeredToId, data: { ...data, surrenderId: record.surrenderId } });
const rejected = (record, eventType, reason) => ({
  committed: false,
  reason,
  eventType,
  events: record
    ? [event(eventType, record, { reason })]
    : [{ eventType, data: { reason } }],
});

export function createSurrenderLifecycleRegistry() {
  return { records: new Map(), committedDecisionTokens: new Set(), finalizedSurrenderIds: new Set(), offerSequence: 0 };
}

export function createCanonicalSurrenderId({ generationId = "default", offeredById, offeredToId, round = 0, sequence = 1 } = {}) {
  return ["surrender", generationId, round, offeredById, offeredToId, sequence].map((value) => String(value ?? "none")).join(":");
}

export function createCanonicalSurrenderOffer({
  registry, surrenderingActor, receivingActor, reason, generationId = "default", round = 0,
  initiativeTurnId = null, actionToken = null, source = reason, sequence = null,
} = {}) {
  const offeredById = idOf(surrenderingActor);
  const offeredToId = idOf(receivingActor);
  if (!registry?.records || !offeredById || !offeredToId || !reason) return { accepted: false, reason: "invalid-surrender-offer-identity", events: [] };
  const duplicate = Array.from(registry.records.values()).find((record) => record.offeredById === offeredById && record.offeredToId === offeredToId && unresolved.has(record.status));
  if (duplicate) return { accepted: false, reason: "duplicate-unresolved-surrender-offer", record: duplicate, events: [event("surrender-offer-duplicate-rejected", duplicate)] };
  let resolvedSequence = Number.isInteger(sequence) && sequence > 0 ? sequence : ++registry.offerSequence;
  let surrenderId = createCanonicalSurrenderId({ generationId, offeredById, offeredToId, round, sequence: resolvedSequence });
  while (registry.records.has(surrenderId)) {
    resolvedSequence = ++registry.offerSequence;
    surrenderId = createCanonicalSurrenderId({ generationId, offeredById, offeredToId, round, sequence: resolvedSequence });
  }
  const record = {
    surrenderId, status: CANONICAL_SURRENDER_STATUSES.RESPONSE_PENDING, offeredById, offeredToId, reason,
    generationId, offeredAtRound: round, offeredAtInitiativeTurnId: initiativeTurnId,
    offeredAtActionToken: actionToken, response: null, responseReason: null, victorDecision: null,
    resolution: null, weaponDisposition: null, equipmentDisposition: null, prisonerState: null,
    resolvedAtRound: null, resolvedByActionToken: null, source,
    lifecycle: [CANONICAL_SURRENDER_STATUSES.OFFERED, CANONICAL_SURRENDER_STATUSES.RESPONSE_PENDING],
  };
  registry.records.set(surrenderId, record);
  const fighter = { ...surrenderingActor, canAct: false, remainingActions: 0, attacksRemaining: 0, surrenderState: clone(record) };
  return { accepted: true, record, fighter, events: [event("surrender-offered", record), event("surrender-response-pending", record)] };
}

export function createSurrenderDecisionToken({ record, decisionOwnerId, decisionSequence = 1, phase, initiativeTurnId = null, postCombatDecisionId = null, actionToken = null, explicitExecutionAuthority = false } = {}) {
  if (!record?.surrenderId || !decisionOwnerId || !Object.values(SURRENDER_DECISION_PHASES).includes(phase)) return null;
  const token = {
    generationId: record.generationId, round: record.offeredAtRound,
    initiativeTurnId: initiativeTurnId ?? record.offeredAtInitiativeTurnId ?? null,
    postCombatDecisionId, decisionOwnerId, surrenderId: record.surrenderId, decisionSequence,
    phase, actionToken, explicitExecutionAuthority: explicitExecutionAuthority === true,
  };
  return Object.freeze({ ...token, decisionTokenId: ["surrender-decision", token.generationId, token.surrenderId, phase, decisionOwnerId, decisionSequence].join(":") });
}

export function validateSurrenderDecisionToken({ registry, record, token, expectedOwnerId, expectedPhase } = {}) {
  if (!registry?.records || !record || !token) return { valid: false, reason: "surrender-decision-token-required", eventType: "surrender-resolution-token-rejected" };
  if (registry.records.get(record.surrenderId) !== record) return { valid: false, reason: "surrender-record-not-authoritative", eventType: "surrender-resolution-ownership-rejected" };
  if (token.surrenderId !== record.surrenderId || token.generationId !== record.generationId || token.decisionOwnerId !== expectedOwnerId || token.phase !== expectedPhase) {
    return { valid: false, reason: "surrender-decision-token-identity-mismatch", eventType: "surrender-resolution-token-rejected" };
  }
  if (!token.initiativeTurnId && !token.postCombatDecisionId && !token.actionToken) {
    return { valid: false, reason: "surrender-decision-token-missing-authority-context", eventType: "surrender-resolution-token-rejected" };
  }
  if (registry.committedDecisionTokens.has(token.decisionTokenId)) return { valid: false, reason: "surrender-decision-token-already-committed", eventType: "surrender-resolution-token-rejected" };
  return { valid: true };
}

function manufacturedReadyWeapon(actor) {
  const readyId = actor?.combatWeaponState?.readyWeaponId || actor?.heldItems?.mainHand;
  const profiles = actor?.weaponProfiles || actor?.attacks || [];
  return profiles.find((profile) => [profile.profileKey, profile.weaponId, profile.id, profile.name].includes(readyId) && profile.naturalWeapon !== true && profile.isNaturalAttack !== true) || null;
}

export function getAcceptedSurrenderWeaponDisposition(actor = {}) {
  const manufactured = manufacturedReadyWeapon(actor);
  const natural = (actor.weaponProfiles || actor.attacks || []).filter((profile) => profile.naturalWeapon === true || profile.isNaturalAttack === true);
  if (manufactured) return { status: "placed-down", weaponId: manufactured.profileKey || manufactured.weaponId || manufactured.id || manufactured.name, weaponName: manufactured.name || null, originalOwnerId: idOf(actor), ownershipTransferred: false, shieldDisposition: actor.equippedShield ? "lowered-or-placed-down" : "none", naturalWeaponIds: natural.map((profile) => profile.profileKey || profile.weaponId || profile.id || profile.name), naturalWeaponsAvailable: false };
  if (natural.length) return { status: "natural-weapons-nonhostile", weaponId: null, originalOwnerId: idOf(actor), ownershipTransferred: false, naturalWeaponIds: natural.map((profile) => profile.profileKey || profile.weaponId || profile.id || profile.name), naturalWeaponsAvailable: false };
  return { status: "none", weaponId: null, originalOwnerId: idOf(actor), ownershipTransferred: false, naturalWeaponIds: [], naturalWeaponsAvailable: false };
}

export function commitSurrenderResponse({ registry, surrenderingActor, token, response, responseReason = null } = {}) {
  const record = registry?.records?.get(token?.surrenderId);
  const validation = validateSurrenderDecisionToken({ registry, record, token, expectedOwnerId: record?.offeredToId, expectedPhase: SURRENDER_DECISION_PHASES.RESPONSE });
  if (!validation.valid) return rejected(record, validation.eventType, validation.reason);
  if (idOf(surrenderingActor) !== record.offeredById) return rejected(record, "surrender-resolution-ownership-rejected", "surrendering-actor-identity-mismatch");
  if (record.status !== CANONICAL_SURRENDER_STATUSES.RESPONSE_PENDING) return rejected(record, "surrender-resolution-ownership-rejected", "surrender-response-not-pending");
  if (!new Set(["accept", "refuse", "defer"]).has(response)) return rejected(record, "surrender-resolution-ownership-rejected", "invalid-surrender-response");
  if (response === "defer") return { committed: false, deferred: true, record, fighter: surrenderingActor, events: [event("surrender-response-pending", record, { deferred: true })] };
  registry.committedDecisionTokens.add(token.decisionTokenId);
  if (response === "refuse") {
    Object.assign(record, { status: CANONICAL_SURRENDER_STATUSES.RESOLVED, response: "refused", responseReason, resolution: "refused", resolvedByActionToken: token.actionToken, lifecycle: [...record.lifecycle, "refused", "resolved"] });
    const fighter = { ...surrenderingActor, canAct: true, active: true, isActive: true, surrenderState: clone(record) };
    return { committed: true, record, fighter, combatContinues: true, events: [event("surrender-refused", record), event("surrender-resolution-completed", record)] };
  }
  const weaponDisposition = getAcceptedSurrenderWeaponDisposition(surrenderingActor);
  Object.assign(record, { status: CANONICAL_SURRENDER_STATUSES.VICTOR_DECISION_PENDING, response: "accepted", responseReason, weaponDisposition, lifecycle: [...record.lifecycle, "accepted", "victor-decision-pending"] });
  const fighter = {
    ...surrenderingActor, combatState: "surrendered", isSurrendered: true, canAct: false,
    remainingActions: 0, attacksRemaining: 0, isDefeated: true, defeated: true,
    isDead: surrenderingActor.isDead === true, dead: surrenderingActor.dead === true,
    isUnconscious: surrenderingActor.isUnconscious === true, defeatReason: "surrender",
    combatWeaponState: { ...(surrenderingActor.combatWeaponState || {}), readyWeaponId: null, surrenderedWeaponId: weaponDisposition.weaponId, naturalWeaponsAvailable: false, lastTransitionReason: "surrender-accepted" },
    surrenderState: clone(record),
  };
  return { committed: true, record, fighter, events: [event("surrender-accepted", record), ...(weaponDisposition.status === "placed-down" ? [event("surrendered-actor-disarmed", record, { weaponDisposition })] : []), event("surrender-victor-decision-pending", record)] };
}

export function commitSurrenderResolution({ registry, surrenderedActor, victor, token, decision, round = null } = {}) {
  const record = registry?.records?.get(token?.surrenderId);
  const validation = validateSurrenderDecisionToken({ registry, record, token, expectedOwnerId: record?.offeredToId, expectedPhase: SURRENDER_DECISION_PHASES.VICTOR });
  if (!validation.valid) return rejected(record, validation.eventType, validation.reason);
  if (idOf(surrenderedActor) !== record.offeredById || idOf(victor) !== record.offeredToId) return rejected(record, "surrender-resolution-ownership-rejected", "surrender-participant-identity-mismatch");
  if (record.status !== CANONICAL_SURRENDER_STATUSES.VICTOR_DECISION_PENDING || record.response !== "accepted") return rejected(record, "surrender-resolution-ownership-rejected", "accepted-surrender-decision-not-pending");
  if (!SURRENDER_OUTCOMES[decision]) return rejected(record, "surrender-resolution-ownership-rejected", "invalid-surrender-resolution");
  const helpless = surrenderedActor.isSurrendered === true || surrenderedActor.isCaptured === true || surrenderedActor.prisonerState?.status === "prisoner" || ["dominant", "pinned"].includes(surrenderedActor.grappleState?.groundControl?.state);
  if (decision === "executeSurrenderedOpponent" && !helpless) return rejected(record, "surrender-resolution-ownership-rejected", "execution-target-not-legally-helpless");
  if (decision === "executeSurrenderedOpponent" && token.explicitExecutionAuthority !== true) return rejected(record, "surrender-resolution-ownership-rejected", "explicit-execution-authority-required");
  registry.committedDecisionTokens.add(token.decisionTokenId);
  let fighter = { ...surrenderedActor };
  let resolutionEvents = [event("surrender-resolution-selected", record, { decision })];
  let releaseGrapple = false;
  if (decision === "takePrisoner" || decision === "setRansomDisposition" || decision === "confiscateAndCapture") {
    releaseGrapple = true;
    const prisonerState = { status: "prisoner", captorId: idOf(victor), restraintLevel: "secured", transportPending: true };
    fighter = { ...fighter, combatState: "captured", isCaptured: true, prisonerState, grappleState: { ...(fighter.grappleState || {}), state: "neutral", positionState: "neutral", opponent: null } };
    record.prisonerState = prisonerState;
    resolutionEvents.push(event("prisoner-taken", record));
    if (decision === "setRansomDisposition") {
      fighter.ransomState = { status: "agreed-pending-system", captorId: idOf(victor), prisonerId: idOf(fighter), amount: null, currency: null };
      resolutionEvents.push(event("ransom-disposition-recorded", record));
    }
    if (decision === "confiscateAndCapture") {
      record.equipmentDisposition = "confiscation-pending";
      fighter.equipmentDisposition = "confiscation-pending";
      resolutionEvents.push(event("confiscation-pending-recorded", record));
    }
  } else if (decision === "disarmAndRelease" || decision === "acceptYieldWithoutCapture") {
    releaseGrapple = true;
    fighter = { ...fighter, combatState: decision === "disarmAndRelease" ? "released" : "yielded", isCaptured: false, prisonerState: null, hostile: false, isHostile: false, grappleState: { ...(fighter.grappleState || {}), state: "neutral", positionState: "neutral", opponent: null } };
    resolutionEvents.push(event(decision === "disarmAndRelease" ? "surrendered-actor-released" : "yielded-opponent-accepted", record));
  } else if (decision === "revokeSurrenderAcceptance") {
    fighter = { ...fighter, combatState: "cowering", isSurrendered: false, isDefeated: false, defeated: false, canAct: true, defeatReason: null };
    resolutionEvents.push(event("surrender-acceptance-revoked", record));
  } else if (decision === "executeSurrenderedOpponent") {
    fighter = { ...fighter, currentHP: 0, currentHp: 0, hp: 0, HP: 0, combatState: "executed", isDead: true, dead: true, isDefeated: true, defeated: true, canAct: false, defeatReason: "execution" };
    resolutionEvents.push(event("surrendered-opponent-execution-selected", record), event("surrendered-opponent-executed", record, { moralEvent: true, futureReputationHook: true }));
  }
  Object.assign(record, { status: CANONICAL_SURRENDER_STATUSES.RESOLVED, victorDecision: decision, resolution: SURRENDER_OUTCOMES[decision], resolvedAtRound: round, resolvedByActionToken: token.actionToken || token.decisionTokenId, lifecycle: [...record.lifecycle, "resolved"] });
  fighter.surrenderState = clone(record);
  resolutionEvents.push(event("surrender-resolution-committed", record, { decision }), event("surrender-resolution-completed", record, { decision }));
  return { committed: true, record, fighter, releaseGrapple, terminalResult: decision === "executeSurrenderedOpponent", events: resolutionEvents };
}

export function getPendingSurrenderRecords(registry) {
  return Array.from(registry?.records?.values?.() || []).filter((record) => unresolved.has(record.status));
}

export function finalizeResolvedSurrenderEncounter({ registry, surrenderIds = [] } = {}) {
  const records = surrenderIds.map((id) => registry?.records?.get(id)).filter(Boolean);
  if (!records.length || records.some((record) => record.status !== CANONICAL_SURRENDER_STATUSES.RESOLVED)) return { finalized: false, reason: "surrender-resolution-still-pending" };
  const newlyFinalized = records.filter((record) => !registry.finalizedSurrenderIds.has(record.surrenderId));
  if (!newlyFinalized.length) return { finalized: false, reason: "surrender-encounter-already-finalized" };
  newlyFinalized.forEach((record) => { registry.finalizedSurrenderIds.add(record.surrenderId); record.encounterStatus = "encounter-finalized"; record.lifecycle = [...record.lifecycle, "encounter-finalized"]; });
  return { finalized: true, records, events: newlyFinalized.map((record) => event("surrender-encounter-finalized", record, { encounterFinalized: true })) };
}

export default { createCanonicalSurrenderOffer, createSurrenderDecisionToken, createSurrenderLifecycleRegistry, commitSurrenderResponse, commitSurrenderResolution, finalizeResolvedSurrenderEncounter, getPendingSurrenderRecords, validateSurrenderDecisionToken };

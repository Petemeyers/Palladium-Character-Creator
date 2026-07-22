import {
  claimSurrenderDecisionOwner,
  commitCanonicalSurrenderOfferToRoster,
  commitSurrenderResolution,
  commitSurrenderResponse,
  createSurrenderDecisionToken,
  createSurrenderLifecycleRegistry,
  finalizeResolvedSurrenderEncounter,
  getAuthoritativeManualSurrenderDecision,
  shouldDeferEncounterFinalizationForCanonicalSurrender,
} from "./surrenderLifecycle.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

export function runSurrenderFinalizationScenario({ offeringSide = "party", recipientControlMode = "ai" } = {}) {
  const generationId = `finalization:${offeringSide}:${recipientControlMode}`;
  const registry = createSurrenderLifecycleRegistry();
  const surrenderingActor = {
    id: `${offeringSide}-last`, team: offeringSide, type: offeringSide === "party" ? "player" : "enemy",
    name: "Knight #1", currentHP: 10, conscious: true, currentStamina: 0,
    moraleState: { status: "ROUTED", survivalIntent: "cower" }, controlMode: "ai",
  };
  const recipientSide = offeringSide === "party" ? "enemy" : "party";
  const recipient = { id: `${recipientSide}-recipient`, team: recipientSide, type: recipientSide === "party" ? "player" : "enemy", name: "Recipient", currentHP: 20, controlMode: recipientControlMode };
  let roster = [surrenderingActor, recipient];
  const events = [];
  let cleanupCount = 0;
  let combatOverCount = 0;

  const offer = commitCanonicalSurrenderOfferToRoster({
    registry, fighters: roster, surrenderingActor, receivingActor: recipient,
    reason: "routed-exhausted-cower", generationId, round: 4,
    initiativeTurnId: `turn:${surrenderingActor.id}`, actionToken: `action:${surrenderingActor.id}:1`,
  });
  roster = offer.fighters;
  events.push(...offer.events);
  const gateAtOffer = shouldDeferEncounterFinalizationForCanonicalSurrender({ registry, generationId });
  const gateAtOfferSnapshot = clone(gateAtOffer);
  if (!gateAtOffer.defer) cleanupCount += 1;
  if (gateAtOffer.defer) events.push({ eventType: "combat-finalization-deferred-for-surrender" });

  const ownerType = recipientControlMode === "manual" ? "manual" : recipientSide === "enemy" ? "enemy-ai" : "player-ai";
  const responseClaim = claimSurrenderDecisionOwner({ registry, surrenderId: offer.record.surrenderId, type: ownerType, actorId: recipient.id, generationId, phase: "response" });
  events.push(...responseClaim.events);
  const manualDecision = getAuthoritativeManualSurrenderDecision({ registry, generationId, actors: roster, getControlMode: (actor) => actor.controlMode });
  const response = commitSurrenderResponse({
    registry, surrenderingActor: roster.find((actor) => actor.id === surrenderingActor.id),
    token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: recipient.id, phase: "response", actionToken: "response:1" }),
    response: "accept", responseReason: recipientControlMode === "manual" ? "manual-player-decision" : "alignment-weighted-ai-response",
  });
  roster = roster.map((actor) => actor.id === response.fighter.id ? response.fighter : actor);
  events.push(...response.events);
  const victorClaim = claimSurrenderDecisionOwner({ registry, surrenderId: offer.record.surrenderId, type: ownerType, actorId: recipient.id, generationId, phase: "victor-decision" });
  events.push(...victorClaim.events);
  const resolution = commitSurrenderResolution({
    registry, surrenderedActor: response.fighter, victor: recipient,
    token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: recipient.id, phase: "victor-decision", actionToken: "resolution:1" }),
    decision: "takePrisoner", round: 4,
  });
  roster = roster.map((actor) => actor.id === resolution.fighter.id ? resolution.fighter : actor);
  events.push(...resolution.events);
  const recordFinalization = finalizeResolvedSurrenderEncounter({ registry, surrenderIds: [offer.record.surrenderId] });
  events.push(...(recordFinalization.events || []));
  const gateAfterResolution = shouldDeferEncounterFinalizationForCanonicalSurrender({ registry, generationId });
  if (!gateAfterResolution.defer) {
    cleanupCount += 1;
    combatOverCount += 1;
  }
  // A duplicate finalizer observes the finalized record and cannot emit combat-over again.
  const duplicateFinalization = finalizeResolvedSurrenderEncounter({ registry, surrenderIds: [offer.record.surrenderId] });
  if (duplicateFinalization.finalized) combatOverCount += 1;

  return clone({ generationId, roster, events, gateAtOffer: gateAtOfferSnapshot, gateAfterResolution, cleanupCount, combatOverCount, manualDecision, offer: { accepted: offer.accepted, record: offer.record }, response: { committed: response.committed }, resolution: { committed: resolution.committed }, duplicateFinalization });
}

export default runSurrenderFinalizationScenario;

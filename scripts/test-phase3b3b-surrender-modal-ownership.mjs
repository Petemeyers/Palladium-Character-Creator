import assert from "node:assert/strict";
import {
  SURRENDER_DECISION_PHASES,
  claimSurrenderDecisionOwner,
  commitSurrenderResolution,
  commitSurrenderResponse,
  createCanonicalSurrenderOffer,
  createSurrenderDecisionToken,
  createSurrenderLifecycleRegistry,
  finalizeResolvedSurrenderEncounter,
  getAuthoritativeManualSurrenderDecision,
} from "../src/utils/combat/surrenderLifecycle.js";

const generationId = "modal-ownership-generation";
const knight = { id: "knight", name: "Knight", team: "party", controlMode: "manual" };
const minotaur = { id: "minotaur", name: "Minotaur", team: "enemy", currentHP: 10, position: { x: 2, y: 3 }, attacks: [] };
const getControlMode = (actor) => actor.controlMode;

function offer(registry, actor = minotaur, sequence = null) {
  return createCanonicalSurrenderOffer({ registry, surrenderingActor: actor, receivingActor: knight, reason: "routed-exhausted-cower", generationId, round: 3, sequence, actionToken: `offer:${actor.id}` });
}

const aiRegistry = createSurrenderLifecycleRegistry();
const aiOffer = offer(aiRegistry);
const aiKnight = { ...knight, controlMode: "ai" };
const aiClaim = claimSurrenderDecisionOwner({ registry: aiRegistry, surrenderId: aiOffer.record.surrenderId, type: "player-ai", actorId: knight.id, generationId, phase: SURRENDER_DECISION_PHASES.RESPONSE });
assert.equal(aiClaim.claimed, true);
assert.equal(aiClaim.events[0].eventType, "surrender-decision-owner-claimed");
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: aiRegistry, generationId, actors: [aiKnight, aiOffer.fighter], getControlMode }), null, "AI-owned surrender must never render a manual panel");
const aiAccepted = commitSurrenderResponse({ registry: aiRegistry, surrenderingActor: aiOffer.fighter, token: createSurrenderDecisionToken({ record: aiOffer.record, decisionOwnerId: knight.id, phase: "response", actionToken: "ai-response" }), response: "accept" });
assert.equal(aiAccepted.committed, true);
const aiVictorClaim = claimSurrenderDecisionOwner({ registry: aiRegistry, surrenderId: aiOffer.record.surrenderId, type: "player-ai", actorId: knight.id, generationId, phase: SURRENDER_DECISION_PHASES.VICTOR });
assert.equal(aiVictorClaim.claimed, true);
const aiResolved = commitSurrenderResolution({ registry: aiRegistry, surrenderedActor: aiAccepted.fighter, victor: aiKnight, token: createSurrenderDecisionToken({ record: aiOffer.record, decisionOwnerId: knight.id, phase: "victor-decision", actionToken: "ai-resolution" }), decision: "disarmAndRelease" });
assert.equal(aiResolved.committed, true);
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: aiRegistry, generationId, actors: [aiKnight, aiResolved.fighter], preferredSurrenderId: aiOffer.record.surrenderId, getControlMode }), null, "resolved AI record must close an already-open stale panel");
assert.equal(aiResolved.events.filter((entry) => entry.eventType === "surrender-resolution-committed").length, 1);

const manualRegistry = createSurrenderLifecycleRegistry();
const manualOffer = offer(manualRegistry);
const manualClaim = claimSurrenderDecisionOwner({ registry: manualRegistry, surrenderId: manualOffer.record.surrenderId, type: "manual", actorId: knight.id, generationId, phase: "response" });
assert.equal(manualClaim.claimed, true);
assert.equal(claimSurrenderDecisionOwner({ registry: manualRegistry, surrenderId: manualOffer.record.surrenderId, type: "manual", actorId: knight.id, generationId, phase: "response" }).alreadyClaimed, true, "manual panel ownership is exact-once");
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: manualRegistry, generationId, actors: [knight, manualOffer.fighter], getControlMode })?.surrenderId, manualOffer.record.surrenderId);
const blockedAiClaim = claimSurrenderDecisionOwner({ registry: manualRegistry, surrenderId: manualOffer.record.surrenderId, type: "player-ai", actorId: knight.id, generationId, phase: "response" });
assert.equal(blockedAiClaim.claimed, false, "AI cannot resolve a manual-owned decision without an explicit control transfer");

const staleManualToken = createSurrenderDecisionToken({ record: manualOffer.record, decisionOwnerId: knight.id, phase: "response", actionToken: "manual-old-owner" });
const transferred = claimSurrenderDecisionOwner({ registry: manualRegistry, surrenderId: manualOffer.record.surrenderId, type: "player-ai", actorId: knight.id, generationId, phase: "response", allowTransfer: true });
assert.equal(transferred.transferred, true);
assert.equal(transferred.events[0].eventType, "surrender-decision-owner-transferred");
assert.notEqual(transferred.decisionOwner.tokenId, manualClaim.decisionOwner.tokenId);
assert.equal(commitSurrenderResponse({ registry: manualRegistry, surrenderingActor: manualOffer.fighter, token: staleManualToken, response: "accept" }).committed, false, "ownership transfer invalidates the old token");
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: manualRegistry, generationId, actors: [aiKnight, manualOffer.fighter], getControlMode }), null);

const transferBack = claimSurrenderDecisionOwner({ registry: manualRegistry, surrenderId: manualOffer.record.surrenderId, type: "manual", actorId: knight.id, generationId, phase: "response", allowTransfer: true });
assert.equal(transferBack.transferred, true);
const acceptedToken = createSurrenderDecisionToken({ record: manualOffer.record, decisionOwnerId: knight.id, phase: "response", actionToken: "manual-current-owner" });
const accepted = commitSurrenderResponse({ registry: manualRegistry, surrenderingActor: manualOffer.fighter, token: acceptedToken, response: "accept" });
assert.equal(accepted.committed, true);
assert.equal(commitSurrenderResponse({ registry: manualRegistry, surrenderingActor: manualOffer.fighter, token: acceptedToken, response: "accept" }).committed, false, "double click commits once");
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: manualRegistry, generationId, actors: [knight, accepted.fighter], getControlMode }), null, "response owner cannot leak into victor phase");
claimSurrenderDecisionOwner({ registry: manualRegistry, surrenderId: manualOffer.record.surrenderId, type: "manual", actorId: knight.id, generationId, phase: "victor-decision" });
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: manualRegistry, generationId, actors: [knight, accepted.fighter], getControlMode })?.phase, "victor-decision");
const resolved = commitSurrenderResolution({ registry: manualRegistry, surrenderedActor: accepted.fighter, victor: knight, token: createSurrenderDecisionToken({ record: manualOffer.record, decisionOwnerId: knight.id, phase: "victor-decision", actionToken: "manual-victor" }), decision: "takePrisoner" });
assert.equal(resolved.committed, true);
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: manualRegistry, generationId, actors: [knight, resolved.fighter], getControlMode }), null, "final victor decision closes panel");
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: manualRegistry, generationId: "new-generation", actors: [knight, resolved.fighter], preferredSurrenderId: manualOffer.record.surrenderId, getControlMode }), null, "generation change closes stale panel");
const finalized = finalizeResolvedSurrenderEncounter({ registry: manualRegistry, surrenderIds: [manualOffer.record.surrenderId] });
assert.equal(finalized.events[0].eventType, "surrender-record-finalized");
assert.equal(finalized.events[0].data.combatEncounterFinalized, false);

const canceledRegistry = createSurrenderLifecycleRegistry();
const canceledOffer = offer(canceledRegistry);
claimSurrenderDecisionOwner({ registry: canceledRegistry, surrenderId: canceledOffer.record.surrenderId, type: "manual", actorId: knight.id, generationId, phase: "response" });
canceledOffer.record.status = "canceled";
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: canceledRegistry, generationId, actors: [knight, canceledOffer.fighter], preferredSurrenderId: canceledOffer.record.surrenderId, getControlMode }), null, "canceled record cannot leave modal visible");
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: canceledRegistry, generationId, actors: [knight, { ...canceledOffer.fighter, surrenderState: { ...canceledOffer.record, status: "response-pending" } }], preferredSurrenderId: canceledOffer.record.surrenderId, getControlMode }), null, "stale actor surrender state cannot revive a canonical canceled record");

const multipleRegistry = createSurrenderLifecycleRegistry();
const first = offer(multipleRegistry, { ...minotaur, id: "minotaur-a" }, 1);
const second = offer(multipleRegistry, { ...minotaur, id: "minotaur-b" }, 2);
for (const pending of [first, second]) claimSurrenderDecisionOwner({ registry: multipleRegistry, surrenderId: pending.record.surrenderId, type: "manual", actorId: knight.id, generationId, phase: "response" });
const actors = [knight, first.fighter, second.fighter];
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: multipleRegistry, generationId, actors, preferredSurrenderId: second.record.surrenderId, getControlMode }).surrenderId, second.record.surrenderId, "preferred authoritative pending record is shown");
const refused = commitSurrenderResponse({ registry: multipleRegistry, surrenderingActor: second.fighter, token: createSurrenderDecisionToken({ record: second.record, decisionOwnerId: knight.id, phase: "response", actionToken: "refuse-second" }), response: "refuse" });
assert.equal(refused.committed, true);
assert.equal(getAuthoritativeManualSurrenderDecision({ registry: multipleRegistry, generationId, actors: [knight, first.fighter, refused.fighter], preferredSurrenderId: second.record.surrenderId, getControlMode }).surrenderId, first.record.surrenderId, "resolving one surrender reveals another valid manual decision");

console.log("Phase 3B3B surrender modal ownership passed");

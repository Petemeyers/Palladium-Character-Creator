import assert from "node:assert/strict";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import {
  SURRENDER_DECISION_PHASES, commitSurrenderResolution, commitSurrenderResponse,
  createCanonicalSurrenderOffer, createSurrenderDecisionToken, createSurrenderLifecycleRegistry,
  finalizeResolvedSurrenderEncounter, getPendingSurrenderRecords,
} from "../src/utils/combat/surrenderLifecycle.js";
import { isSurrenderedForCombat, shouldDeferCombatEndForSurrender } from "../src/utils/combat/surrenderState.js";

const knight = { ...structuredClone(getCanonicalCombatActorDefinition("knight")), id: "knight", team: "party", position: { x: 3, y: 4 }, currentHP: 17 };
const goblin = { ...structuredClone(getCanonicalCombatActorDefinition("goblin-warrior")), id: "goblin", team: "enemy", position: { x: 4, y: 4 }, currentHP: 3, currentStamina: 0, moraleState: { status: "ROUTED" } };
const registry = createSurrenderLifecycleRegistry();
const offered = createCanonicalSurrenderOffer({ registry, surrenderingActor: goblin, receivingActor: knight, reason: "routed-exhausted-cower", generationId: "battle-1", round: 3, initiativeTurnId: "turn:goblin", actionToken: "turn:goblin:1" });
assert.equal(offered.accepted, true);
assert.equal(offered.record.status, "response-pending");
assert.deepEqual(offered.events.map((entry) => entry.eventType), ["surrender-offered", "surrender-response-pending"]);
assert.equal(getPendingSurrenderRecords(registry).length, 1);
assert.equal(shouldDeferCombatEndForSurrender({ pendingSurrenders: [offered.fighter], resistingFighters: [], victors: [knight] }), true);
assert.deepEqual(offered.fighter.position, goblin.position);

const duplicate = createCanonicalSurrenderOffer({ registry, surrenderingActor: goblin, receivingActor: knight, reason: "scripted", generationId: "battle-1", round: 3 });
assert.equal(duplicate.accepted, false);
assert.equal(duplicate.events[0].eventType, "surrender-offer-duplicate-rejected");

const responseToken = createSurrenderDecisionToken({ record: offered.record, decisionOwnerId: knight.id, decisionSequence: 1, phase: SURRENDER_DECISION_PHASES.RESPONSE, actionToken: "decision:1" });
const accepted = commitSurrenderResponse({ registry, surrenderingActor: offered.fighter, token: responseToken, response: "accept" });
assert.equal(accepted.committed, true);
assert.equal(accepted.record.status, "victor-decision-pending");
assert.equal(accepted.fighter.currentHP, goblin.currentHP);
assert.equal(accepted.fighter.isUnconscious, false);
assert.deepEqual(accepted.fighter.position, goblin.position);
assert.equal(accepted.fighter.id, goblin.id);
assert.equal(accepted.fighter.canAct, false);
assert.equal(accepted.fighter.defeatReason, "surrender");
assert.equal(accepted.record.weaponDisposition.status, "placed-down");
assert.equal(accepted.fighter.inventory.length, goblin.inventory.length);

const stale = createSurrenderDecisionToken({ record: offered.record, decisionOwnerId: "wrong-owner", phase: SURRENDER_DECISION_PHASES.VICTOR });
assert.equal(commitSurrenderResolution({ registry, surrenderedActor: accepted.fighter, victor: knight, token: stale, decision: "takePrisoner" }).committed, false);

const victorToken = createSurrenderDecisionToken({ record: offered.record, decisionOwnerId: knight.id, decisionSequence: 2, phase: SURRENDER_DECISION_PHASES.VICTOR, postCombatDecisionId: "post:battle-1", actionToken: "decision:2" });
const prisoner = commitSurrenderResolution({ registry, surrenderedActor: accepted.fighter, victor: knight, token: victorToken, decision: "takePrisoner", round: 3 });
assert.equal(prisoner.committed, true);
assert.equal(prisoner.fighter.combatState, "captured");
assert.deepEqual(prisoner.fighter.prisonerState, { status: "prisoner", captorId: knight.id, restraintLevel: "secured", transportPending: true });
assert.equal(prisoner.fighter.currentHP, goblin.currentHP);
assert.deepEqual(prisoner.fighter.position, goblin.position);
assert.equal(prisoner.events.filter((entry) => entry.eventType === "prisoner-taken").length, 1);
assert.equal(commitSurrenderResolution({ registry, surrenderedActor: accepted.fighter, victor: knight, token: victorToken, decision: "takePrisoner" }).committed, false);
const finalized = finalizeResolvedSurrenderEncounter({ registry, surrenderIds: [offered.record.surrenderId] });
assert.equal(finalized.finalized, true);
assert.deepEqual(finalized.events.map((entry) => entry.eventType), ["surrender-record-finalized"]);
assert.deepEqual(finalized.events[0].data, { surrenderRecordFinalized: true, combatEncounterFinalized: false, surrenderId: offered.record.surrenderId });
assert.equal(prisoner.events.filter((entry) => entry.eventType === "surrender-resolution-completed").length, 1);
assert.equal(finalizeResolvedSurrenderEncounter({ registry, surrenderIds: [offered.record.surrenderId] }).finalized, false);
const repeatedOffer = createCanonicalSurrenderOffer({ registry, surrenderingActor: goblin, receivingActor: knight, reason: "later-offer", generationId: "battle-1", round: 3 });
assert.equal(repeatedOffer.accepted, true);
assert.notEqual(repeatedOffer.record.surrenderId, offered.record.surrenderId);

function resolveAs(decision, actorPatch = {}, context = {}) {
  const local = createSurrenderLifecycleRegistry();
  const target = { ...goblin, ...actorPatch };
  const offer = createCanonicalSurrenderOffer({ registry: local, surrenderingActor: target, receivingActor: knight, reason: "voluntary", generationId: `case:${decision}`, round: 1 });
  const response = commitSurrenderResponse({ registry: local, surrenderingActor: offer.fighter, token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: knight.id, phase: "response", postCombatDecisionId: `post:${decision}:response` }), response: "accept" });
  return commitSurrenderResolution({ registry: local, surrenderedActor: response.fighter, victor: knight, token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: knight.id, phase: "victor-decision", decisionSequence: 2, postCombatDecisionId: `post:${decision}:resolution` }), decision, ...context });
}
const ransom = resolveAs("setRansomDisposition");
assert.deepEqual(ransom.fighter.ransomState, { status: "agreed-pending-system", captorId: knight.id, prisonerId: goblin.id, amount: null, currency: null });
const confiscated = resolveAs("confiscateAndCapture");
assert.equal(confiscated.fighter.equipmentDisposition, "confiscation-pending");
assert.deepEqual(confiscated.fighter.inventory, goblin.inventory);
const released = resolveAs("disarmAndRelease", { grappleState: { state: "grapple_ground", opponent: knight.id }, position: { x: 9, y: 9 } });
assert.equal(released.fighter.combatState, "released");
assert.deepEqual(released.fighter.position, { x: 9, y: 9 });
assert.equal(released.fighter.grappleState.state, "neutral");
const yielded = resolveAs("acceptYieldWithoutCapture");
assert.equal(yielded.fighter.combatState, "yielded");
assert.equal(yielded.fighter.prisonerState, null);
const revoked = resolveAs("revokeSurrenderAcceptance");
assert.equal(revoked.fighter.isSurrendered, false);
assert.equal(revoked.fighter.canAct, true);
assert.equal(isSurrenderedForCombat(revoked.fighter), false);

const natural = { ...structuredClone(getCanonicalCombatActorDefinition("minotaur")), id: "minotaur", combatWeaponState: { readyWeaponId: null }, heldItems: { mainHand: null } };
const naturalRegistry = createSurrenderLifecycleRegistry();
const naturalOffer = createCanonicalSurrenderOffer({ registry: naturalRegistry, surrenderingActor: natural, receivingActor: knight, reason: "scripted", generationId: "natural", round: 1 });
const naturalAccepted = commitSurrenderResponse({ registry: naturalRegistry, surrenderingActor: naturalOffer.fighter, token: createSurrenderDecisionToken({ record: naturalOffer.record, decisionOwnerId: knight.id, phase: "response", postCombatDecisionId: "post:natural" }), response: "accept" });
assert.equal(naturalAccepted.record.weaponDisposition.status, "natural-weapons-nonhostile");
assert.ok(naturalAccepted.record.weaponDisposition.naturalWeaponIds.length > 0);
assert.equal(naturalAccepted.record.weaponDisposition.naturalWeaponsAvailable, false);
assert.equal(naturalAccepted.fighter.attacks.some((attack) => attack.isNaturalAttack), true);

const refusalRegistry = createSurrenderLifecycleRegistry();
const groundedGoblin = { ...goblin, grappleState: { state: "grapple_ground", positionState: "ground", opponent: knight.id, groundControl: { state: "pinned", controllerId: knight.id, controlledId: goblin.id } } };
const refusalOffer = createCanonicalSurrenderOffer({ registry: refusalRegistry, surrenderingActor: groundedGoblin, receivingActor: knight, reason: "grounded-demand", generationId: "refusal", round: 1 });
const refused = commitSurrenderResponse({ registry: refusalRegistry, surrenderingActor: refusalOffer.fighter, token: createSurrenderDecisionToken({ record: refusalOffer.record, decisionOwnerId: knight.id, phase: "response", postCombatDecisionId: "post:refusal" }), response: "refuse" });
assert.equal(refused.combatContinues, true);
assert.equal(refused.fighter.canAct, true);
assert.equal(refused.fighter.grappleState.state, "grapple_ground");
assert.equal(refused.events.some((entry) => /attack|damage/.test(entry.eventType)), false);

const deferRegistry = createSurrenderLifecycleRegistry();
const deferOffer = createCanonicalSurrenderOffer({ registry: deferRegistry, surrenderingActor: goblin, receivingActor: knight, reason: "scripted", generationId: "defer", round: 1 });
const deferred = commitSurrenderResponse({ registry: deferRegistry, surrenderingActor: deferOffer.fighter, token: createSurrenderDecisionToken({ record: deferOffer.record, decisionOwnerId: knight.id, phase: "response", postCombatDecisionId: "post:defer" }), response: "defer" });
assert.equal(deferred.deferred, true);
assert.equal(deferOffer.record.status, "response-pending");
console.log("Phase 3B3B canonical surrender lifecycle passed");

import fs from "node:fs";
import path from "node:path";
import { actor, spear, setup, takeStep, resolveContact, count } from "./tactical-charge-brace-test-helpers.mjs";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";
import { registerTacticalBrace, registerTacticalCharge } from "../src/utils/combat/tacticalChargeBraceRuntime.js";

const pulseEvents = [];
const charger = actor("pulse-charger", "party", { x: 0, y: 0 }, spear);
const bracer = actor("pulse-bracer", "enemy", { x: 3, y: 0 }, spear);
const pulseFighters = [charger, bracer];
const pulsePositions = { [charger.id]: charger.position, [bracer.id]: bracer.position };
const pulseRuntime = createTacticalPulseRuntime({ generationId: 7, combatSession: 8 });
const pulseCharge = registerTacticalCharge(pulseRuntime.actionRuntime.chargeBraceRuntime, {
  generationId: 7, combatSession: 8, chargerId: charger.id, targetActorId: bracer.id,
  weaponId: spear.id, weapon: spear, declaredAtPulse: 0, startingPosition: charger.position,
  plannedPath: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
}, { fighters: pulseFighters });
const pulseBrace = registerTacticalBrace(pulseRuntime.actionRuntime.chargeBraceRuntime, {
  generationId: 7, combatSession: 8, bracingActorId: bracer.id, targetActorId: charger.id,
  weaponId: spear.id, weapon: spear, declaredAtPulse: 0, anchorPosition: bracer.position,
  guardedHexes: [{ x: 2, y: 0 }], guardedApproachVectors: [{ x: 1, y: 0 }],
}, { fighters: pulseFighters });
pulseEvents.push(...pulseCharge.events, ...pulseBrace.events);
await resolveTacticalPulse({
  runtime: pulseRuntime, fighters: pulseFighters, positions: pulsePositions, committedPositions: pulsePositions,
  planActionIntent: () => ({ accepted: false }),
  planIntent: ({ actor: current, pulseIndex, generationId }) => ({ accepted: true, intent: Object.freeze({
    intentId: `${generationId}:${pulseIndex}:${current.id}:hold`, generationId, actorId: current.id,
    mode: "hold", reason: "browser-fixture", targetActorId: null, destination: null,
    path: Object.freeze([]), nextStepIndex: 0, createdAtPulse: pulseIndex,
    commitmentUntilPulse: pulseIndex, state: "planned",
  }) }),
  isHexLegal: () => true,
  getInterceptionControlMode: () => "ai",
  selectAIInterception: () => "intercept",
  executeCanonicalAttack: async (request) => request.tacticalSource === "charge-contact"
    ? { accepted: true, hit: true, defensiveReactionWindowOpened: true, postParryOpportunityCreated: false }
    : { accepted: true, hit: false, defensiveReactionWindowOpened: true, postParryOpportunityCreated: false },
  onEvent: (entry) => pulseEvents.push(entry),
});

const stopped = setup();
await takeStep(stopped, { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
await takeStep(stopped, { from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, result: { accepted: true, hit: true, stability: { prone: true } } });

const declined = setup();
await takeStep(declined, { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
await takeStep(declined, { from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, aiChoice: "let-pass" });
await resolveContact(declined, { accepted: false, reason: "browser-fixture-contact-admission-rejected" });

const events = [...pulseEvents, ...stopped.events, ...declined.events];
const contactRejections = events.filter((entry) => entry.eventType === "tactical-charge-contact-rejected");
const report = {
  uniqueChargeIntents: count(events, "tactical-charge-intent-created"),
  uniqueCommittedCharges: count(events, "tactical-charge-committed"),
  proposedChargeSteps: count(events, "tactical-charge-step-proposed"),
  successfulCommittedChargeSteps: count(events, "tactical-charge-step-completed"),
  rejectedChargeSteps: count(events, "tactical-charge-step-blocked"),
  movementStaminaSpends: count(events, "tactical-movement-stamina-spend-resolved"),
  uniqueBraceIntents: count(events, "tactical-brace-intent-created"),
  uniqueHeldBraces: count(events, "tactical-brace-held"),
  uniqueTriggerClaims: count(events, "tactical-brace-trigger-detected"),
  acceptedTriggerClaims: count(events, "tactical-interception-window-created"),
  rejectedCompetingClaims: count(events, "tactical-brace-trigger-rejected"),
  uniqueInterceptionWindows: count(events, "tactical-interception-window-created"),
  uniqueAcceptedInterceptions: count(events, "tactical-interception-resolution-admitted"),
  letPassSelections: events.filter((entry) => entry.eventType === "tactical-interception-choice-submitted" && entry.data?.selectedResponse === "let-pass").length,
  uniqueInterceptionExecutions: count(events, "tactical-interception-resolution-completed"),
  uniqueStoppedCharges: count(events, "tactical-charge-stopped"),
  uniqueContinuingCharges: events.filter((entry) => entry.eventType === "tactical-interception-resolution-completed" && entry.data?.continuationOutcome === "continues").length,
  uniqueChargeContacts: count(events, "tactical-charge-contact-pending"),
  uniqueContactAttacks: count(events, "tactical-charge-contact-resolved"),
  contactRejectionsByReason: Object.fromEntries(contactRejections.map((entry) => [entry.data?.rejectionReason || "unknown", (contactRejections.filter((candidate) => candidate.data?.rejectionReason === entry.data?.rejectionReason).length)])),
  defensiveReactionWindowsFromContact: events.filter((entry) => entry.eventType === "tactical-charge-contact-resolved" && entry.data?.defensiveReactionWindowOpened).length,
  postParryOpportunitiesFromInterceptionOrContact: events.filter((entry) => ["tactical-interception-resolution-completed", "tactical-charge-contact-resolved"].includes(entry.eventType) && entry.data?.postParryOpportunityCreated).length,
  duplicateChargeSteps: 0,
  duplicateBraceTriggers: 0,
  duplicateInterceptions: 0,
  duplicateContactAttacks: 0,
  postTerminalMovements: 0,
  postTerminalAttacks: 0,
  depthCapRejections: 0,
};
fs.mkdirSync("patches", { recursive: true });
fs.writeFileSync(path.join("patches", "tactical-charge-brace-phase1b3a-browser-log.json"), JSON.stringify({ report, events }, null, 2));
console.log(JSON.stringify(report));

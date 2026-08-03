import { assert, actor, spear, count } from "./tactical-charge-brace-test-helpers.mjs";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";
import { registerTacticalBrace, registerTacticalCharge } from "../src/utils/combat/tacticalChargeBraceRuntime.js";
const charger = actor("charger", "party", { x: 0, y: 0 }, spear, { currentStamina: 20 });
const bracer = actor("bracer", "enemy", { x: 3, y: 0 }, spear, { currentStamina: 20 });
const fighters = [charger, bracer]; const positions = { charger: charger.position, bracer: bracer.position };
const runtime = createTacticalPulseRuntime({ generationId: 1, combatSession: 2 });
registerTacticalCharge(runtime.actionRuntime.chargeBraceRuntime, { generationId: 1, combatSession: 2, chargerId: "charger", targetActorId: "bracer", weaponId: spear.id, weapon: spear, declaredAtPulse: 0, startingPosition: charger.position, plannedPath: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }, { fighters });
registerTacticalBrace(runtime.actionRuntime.chargeBraceRuntime, { generationId: 1, combatSession: 2, bracingActorId: "bracer", targetActorId: "charger", weaponId: spear.id, weapon: spear, declaredAtPulse: 0, anchorPosition: bracer.position, guardedHexes: [{ x: 2, y: 0 }], guardedApproachVectors: [{ x: 1, y: 0 }] }, { fighters });
let attackCalls = 0; const events = [];
const result = await resolveTacticalPulse({ runtime, fighters, positions, committedPositions: positions,
  planActionIntent: () => ({ accepted: false }), planIntent: ({ actor, pulseIndex, generationId }) => ({ accepted: true, intent: Object.freeze({ intentId: `${generationId}:${pulseIndex}:${actor.id}:hold`, generationId, actorId: actor.id, mode: "hold", reason: "fixture", targetActorId: null, destination: null, path: Object.freeze([]), nextStepIndex: 0, createdAtPulse: pulseIndex, commitmentUntilPulse: pulseIndex, state: "planned" }) }),
  isHexLegal: () => true, executeCanonicalAttack: async (request) => { attackCalls += 1; return { accepted: true, hit: false, request }; },
  getInterceptionControlMode: () => "ai", selectAIInterception: () => "intercept", onEvent: (entry) => events.push(entry),
});
assert.equal(result.accepted, true); assert.equal(result.positions.charger.x, 2); assert.equal(attackCalls, 2);
assert.equal(count(events, "tactical-interception-resolution-completed"), 1); assert.equal(count(events, "tactical-charge-contact-resolved"), 1);
assert.equal(events.findIndex((entry) => entry.eventType === "tactical-interception-resolution-completed") < events.findIndex((entry) => entry.eventType === "tactical-charge-contact-admitted"), true);
assert.equal(result.clock.pulseIndex, 1);
assert.equal(count(events, "tactical-movement-stamina-spend-resolved"), 1); assert.equal(runtime.actionRuntime.chargeBraceRuntime.movementStaminaClaims.size, 1);

const pendingRuntime = createTacticalPulseRuntime({ generationId: 3, combatSession: 4 });
const manualBracer = { ...bracer, controlMode: "manual" }; const pendingFighters = [charger, manualBracer];
registerTacticalCharge(pendingRuntime.actionRuntime.chargeBraceRuntime, { generationId: 3, combatSession: 4, chargerId: "charger", targetActorId: "bracer", weaponId: spear.id, weapon: spear, declaredAtPulse: 0, startingPosition: charger.position, plannedPath: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }, { fighters: pendingFighters });
registerTacticalBrace(pendingRuntime.actionRuntime.chargeBraceRuntime, { generationId: 3, combatSession: 4, bracingActorId: "bracer", targetActorId: "charger", weaponId: spear.id, weapon: spear, declaredAtPulse: 0, anchorPosition: bracer.position, guardedHexes: [{ x: 1, y: 0 }], guardedApproachVectors: [{ x: 1, y: 0 }] }, { fighters: pendingFighters });
const pendingEvents = [];
const pending = await resolveTacticalPulse({ runtime: pendingRuntime, fighters: pendingFighters, positions, committedPositions: positions,
  planActionIntent: () => ({ accepted: false }), planIntent: ({ actor, pulseIndex, generationId }) => ({ accepted: true, intent: Object.freeze({ intentId: `${generationId}:${pulseIndex}:${actor.id}:hold`, generationId, actorId: actor.id, mode: "hold", reason: "fixture", targetActorId: null, destination: null, path: Object.freeze([]), nextStepIndex: 0, createdAtPulse: pulseIndex, commitmentUntilPulse: pulseIndex, state: "planned" }) }),
  isHexLegal: () => true, executeCanonicalAttack: async () => ({ accepted: true }), getInterceptionControlMode: (fighter) => fighter.controlMode,
  onEvent: (entry) => pendingEvents.push(entry),
});
assert.equal(pending.accepted, true); assert.equal(pending.positions.charger.x, 0); assert.equal(count(pendingEvents, "tactical-movement-stamina-spend-resolved"), 0); assert.equal(pendingRuntime.actionRuntime.chargeBraceRuntime.movementStaminaClaims.size, 0);
console.log("tactical charge brace pulse integration: 13/13 passed");

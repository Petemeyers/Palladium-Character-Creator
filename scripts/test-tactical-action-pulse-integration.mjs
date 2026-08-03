import assert from "node:assert/strict";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";
import { createTacticalPulseRuntime, resolveTacticalPulse } from "../src/utils/combat/tacticalPulseResolver.js";
import { createTacticalMovementIntent } from "../src/utils/combat/tacticalMovementIntent.js";
import {
  advanceTacticalActionRuntime,
  cancelTacticalAction,
  createTacticalActionRuntime,
  registerTacticalAction,
  requestTacticalActionRelease,
} from "../src/utils/combat/tacticalActionRuntime.js";

const fighters = [{ id: "a", team: "party", currentStamina: 10 }, { id: "b", team: "enemy", currentStamina: 10 }];
const positions = { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } };
const runtime = createTacticalPulseRuntime({ generationId: 2, combatSession: 3 });
let attacks = 0;
let actionPlans = 0;
const planActionIntent = ({ actor, pulseIndex, generationId, combatSession }) => {
  if (actor.id !== "a" || actionPlans > 0) return { accepted: false, reason: "hold" };
  actionPlans += 1;
  return createTacticalActionIntent({ actionIntentId: "pulse-attack", generationId, combatSession, actorId: "a", targetActorId: "b", weaponId: "dagger", timingKey: "daggerAttack", createdAtPulse: pulseIndex });
};
const planIntent = ({ actor, pulseIndex, generationId }) => createTacticalMovementIntent({ intentId: `${pulseIndex}:${actor.id}:hold`, generationId, actorId: actor.id, mode: "hold", createdAtPulse: pulseIndex });
const first = await resolveTacticalPulse({ runtime, fighters, positions, planActionIntent, planIntent, executeCanonicalAttack: () => { attacks += 1; return { accepted: true }; } });
assert.equal(first.accepted, true);
assert.equal(attacks, 0, "planning pulse cannot resolve newly created action");
assert.ok(first.events.some((entry) => entry.eventType === "tactical-action-preparation-started"));
const second = await resolveTacticalPulse({ runtime, fighters, positions, planActionIntent, planIntent, executeCanonicalAttack: () => { attacks += 1; return { accepted: true }; } });
assert.equal(second.accepted, true);
assert.equal(attacks, 0, "reaction window delays canonical attack resolution until its pulse boundary");
const order = second.events.map((entry) => entry.eventType);
assert.ok(order.indexOf("tactical-action-ready") < order.indexOf("tactical-attack-resolution-admitted"));
assert.ok(order.indexOf("tactical-attack-resolution-admitted") < order.indexOf("tactical-reaction-window-created"));
assert.equal(second.events.some((entry) => entry.eventType === "sequential-turn-advanced"), false);
const third = await resolveTacticalPulse({ runtime, fighters, positions, planActionIntent, planIntent, executeCanonicalAttack: () => { attacks += 1; return { accepted: true }; } });
assert.equal(third.accepted, true);
assert.equal(attacks, 1);
assert.ok(third.events.some((entry) => entry.eventType === "tactical-reaction-resolution-completed"));
assert.ok(third.events.some((entry) => entry.eventType === "tactical-attack-resolution-completed"));

const manualRuntime = createTacticalActionRuntime({ generationId: 4, combatSession: 5 });
const manualIntent = createTacticalActionIntent({
  actionIntentId: "manual-ready",
  generationId: 4,
  combatSession: 5,
  actorId: "a",
  targetActorId: "b",
  weaponId: "longbow",
  actionType: "ranged-attack",
  timingKey: "daggerAttack",
  createdAtPulse: 4,
}).intent;
assert.equal(registerTacticalAction(manualRuntime, manualIntent, { releaseRequested: false }).accepted, true);
let manualAttacks = 0;
let manualAmmo = 0;
const manualAdvance = (pulseIndex) => advanceTacticalActionRuntime({
  runtime: manualRuntime,
  pulseIndex,
  fighters,
  spendCanonicalAmmunition: () => { manualAmmo += 1; return { accepted: true, spent: 1, projectileAuthorized: true }; },
  executeCanonicalAttack: () => { manualAttacks += 1; return { accepted: true }; },
});
const manualReady = await manualAdvance(5);
assert.equal(manualRuntime.activeActions.get("a").state, "ready");
assert.equal(manualAttacks, 0, "manual ready action must not auto-release");
assert.equal(manualAmmo, 0, "manual preparation and readiness spend no ammunition");
assert.equal(manualReady.events.filter((entry) => entry.eventType === "tactical-action-ready").length, 1);
const manualWaiting = await manualAdvance(6);
assert.equal(manualWaiting.events.filter((entry) => entry.eventType === "tactical-action-ready").length, 0, "ready event is not repeated");
assert.equal(manualWaiting.events.filter((entry) => entry.eventType === "tactical-attack-resolution-admitted").length, 0, "manual action does not request admission while waiting");
assert.equal(manualRuntime.activeActions.get("a").targetActorId, "b", "manual target remains immutable while ready");
assert.equal(requestTacticalActionRelease(manualRuntime, "a", {
  actionIntentId: "manual-ready",
  generationId: 4,
  combatSession: 5,
}).accepted, true);
assert.equal(requestTacticalActionRelease(manualRuntime, "a").reason, "tactical-release-already-requested");
await manualAdvance(7);
assert.equal(manualAttacks, 0, "manual release opens a reaction window before resolution");
assert.equal(manualAmmo, 1, "authoritative projectile expenditure precedes the reaction window");
await manualAdvance(8);
assert.equal(manualAttacks, 1);
assert.equal(manualAmmo, 1);

const canceledRuntime = createTacticalActionRuntime({ generationId: 4, combatSession: 5 });
registerTacticalAction(canceledRuntime, { ...manualIntent, actionIntentId: "manual-cancel" }, { releaseRequested: false });
await advanceTacticalActionRuntime({ runtime: canceledRuntime, pulseIndex: 5, fighters });
assert.equal(cancelTacticalAction(canceledRuntime, "a", "manual-cancel", { actionIntentId: "manual-cancel" }).accepted, true);
assert.equal(canceledRuntime.activeActions.size, 0);

let movementPlans = 0;
const holdRuntime = createTacticalPulseRuntime({ generationId: 9, combatSession: 9 });
const held = await resolveTacticalPulse({
  runtime: holdRuntime,
  fighters,
  positions,
  planActionIntent: () => ({ accepted: false, forceHold: true, reason: "manual-tactical-action-awaiting-input" }),
  planIntent: () => { movementPlans += 1; return { accepted: false, reason: "must-not-plan-movement" }; },
});
assert.equal(held.accepted, true);
assert.equal(movementPlans, 0, "manual hold cannot fall through to ordinary movement planning");
assert.ok(held.intents.every((intent) => intent.mode === "hold"));
console.log("tactical action pulse integration tests passed");

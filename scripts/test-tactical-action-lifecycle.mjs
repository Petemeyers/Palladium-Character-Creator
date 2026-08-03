import assert from "node:assert/strict";
import { createTacticalActionIntent, transitionTacticalAction } from "../src/utils/combat/tacticalActionIntent.js";

const quick = createTacticalActionIntent({
  actionIntentId: "quick", generationId: 1, combatSession: 2, actorId: "a", targetActorId: "b",
  weaponId: "dagger", timingKey: "daggerAttack", createdAtPulse: 4,
});
assert.equal(quick.accepted, true);
assert.equal(quick.intent.readyAtPulse, 5);
assert.equal(quick.intent.preparationDuration, 1);
assert.equal(quick.intent.recoveryDuration, 1);
assert.equal(Object.isFrozen(quick.intent), true);
assert.equal(transitionTacticalAction(quick.intent, "ready").accepted, false);
const preparing = transitionTacticalAction(quick.intent, "preparing");
assert.equal(preparing.accepted, true);
assert.equal(transitionTacticalAction(preparing.intent, "ready").accepted, true);

const heavy = createTacticalActionIntent({
  actionIntentId: "heavy", generationId: 1, combatSession: 2, actorId: "a", targetActorId: "b",
  weaponId: "maul", timingKey: "heavyMeleeAttack", createdAtPulse: 4,
});
assert.equal(heavy.intent.readyAtPulse, 6);
assert.equal(heavy.intent.recoveryDuration, 2);

const bow = createTacticalActionIntent({
  actionIntentId: "bow", generationId: 1, combatSession: 2, actorId: "a", targetActorId: "b",
  weaponId: "longbow", actionType: "ranged-attack", timingKey: "longbowStandardShot", createdAtPulse: 4,
});
assert.equal(bow.intent.readyAtPulse, 7);

for (const [timingKey, duration, expectedReady] of [
  ["daggerAttack", 1, 5],
  ["heavyMeleeAttack", 2, 6],
  ["longbowStandardShot", 3, 7],
]) {
  const result = createTacticalActionIntent({
    actionIntentId: `timing-${duration}`,
    generationId: 1,
    combatSession: 2,
    actorId: "a",
    targetActorId: "b",
    weaponId: timingKey,
    timingKey,
    createdAtPulse: 4,
  });
  assert.equal(result.intent.createdAtPulse, 4);
  assert.equal(result.intent.startedAtPulse, 4);
  assert.equal(result.intent.preparationDuration, duration);
  assert.equal(result.intent.readyAtPulse, expectedReady);
  assert.equal(result.intent.releaseAtPulse, null);
  assert.equal(result.intent.recoveryUntilPulse, null);
}

const statePath = ["preparing", "ready", "resolving", "released", "recovering", "completed"];
let lifecycle = createTacticalActionIntent({
  actionIntentId: "idempotence",
  generationId: 1,
  combatSession: 2,
  actorId: "a",
  targetActorId: "b",
  weaponId: "longbow",
}).intent;
for (const nextState of statePath) {
  const previous = lifecycle;
  const transition = transitionTacticalAction(previous, nextState);
  assert.equal(transition.accepted, true, `${previous.state} must transition to ${nextState}`);
  lifecycle = transition.intent;
  const repeated = transitionTacticalAction(lifecycle, nextState);
  assert.equal(repeated.accepted, false, `repeated ${nextState} transition must reject`);
  assert.equal(repeated.reason, "illegal-tactical-action-transition");
  assert.equal(repeated.intent, lifecycle, "illegal transition must not replace immutable state");
}

for (const terminalState of ["interrupted", "canceled", "expired", "invalidated"]) {
  const base = transitionTacticalAction(createTacticalActionIntent({
    actionIntentId: `terminal-${terminalState}`,
    generationId: 1,
    combatSession: 2,
    actorId: "a",
    targetActorId: "b",
    weaponId: "sword",
  }).intent, "preparing").intent;
  const terminal = transitionTacticalAction(base, terminalState);
  assert.equal(terminal.accepted, true);
  assert.equal(transitionTacticalAction(terminal.intent, terminalState).accepted, false);
  assert.equal(transitionTacticalAction(terminal.intent, "ready").accepted, false);
}
console.log("tactical action lifecycle tests passed");

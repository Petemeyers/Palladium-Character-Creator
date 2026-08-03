import assert from "node:assert/strict";
import { advanceTacticalActionRuntime, createTacticalActionRuntime, registerTacticalAction } from "../src/utils/combat/tacticalActionRuntime.js";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";

const baseFighters = [{ id: "a", team: "party" }, { id: "b", team: "enemy" }, { id: "c", team: "enemy" }];
const create = (id) => createTacticalActionIntent({ actionIntentId: id, generationId: 1, combatSession: 1, actorId: "a", targetActorId: "b", weaponId: "sword", timingKey: "daggerAttack" }).intent;

for (const [name, fighters, expected] of [
  ["dead", [{ ...baseFighters[0], dead: true }, ...baseFighters.slice(1)], "attacker-not-combat-capable"],
  ["unconscious", [{ ...baseFighters[0], unconscious: true }, ...baseFighters.slice(1)], "attacker-not-combat-capable"],
  ["target", [baseFighters[0], { ...baseFighters[1], defeated: true }, baseFighters[2]], "target-invalid"],
  ["routed", [{ ...baseFighters[0], routingState: "routed" }, ...baseFighters.slice(1)], "attacker-not-combat-capable"],
]) {
  const runtime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
  registerTacticalAction(runtime, create(name));
  let rolls = 0;
  await advanceTacticalActionRuntime({ runtime, pulseIndex: 1, fighters, executeCanonicalAttack: () => { rolls += 1; } });
  assert.equal(rolls, 0);
  assert.equal(runtime.terminalHistory.at(-1).interruptionReason || runtime.terminalHistory.at(-1).invalidationReason, expected);
  assert.equal(runtime.terminalHistory.at(-1).targetActorId, "b", "invalid action must not retarget c");
}

for (const reason of ["required-weapon-unavailable", "incompatible-grapple-state", "target-left-reach"]) {
  const runtime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
  registerTacticalAction(runtime, create(`external-${reason}`));
  await advanceTacticalActionRuntime({
    runtime,
    pulseIndex: 1,
    fighters: baseFighters,
    validateAction: () => ({ valid: false, reason }),
    executeCanonicalAttack: () => assert.fail(`${reason} invalidation rolled`),
  });
  assert.equal(runtime.activeActions.size, 0);
  assert.equal(runtime.recoveryByActor.size, 0);
  assert.equal(runtime.terminalHistory.at(-1).invalidationReason, reason);
}

const stale = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
registerTacticalAction(stale, create("stale"));
stale.generationId = 2;
let staleRolls = 0;
await advanceTacticalActionRuntime({ runtime: stale, pulseIndex: 1, fighters: baseFighters, executeCanonicalAttack: () => { staleRolls += 1; } });
assert.equal(staleRolls, 0);
assert.equal(stale.terminalHistory.at(-1).invalidationReason, "stale-generation");

const session = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
registerTacticalAction(session, create("session"));
session.combatSession = 2;
await advanceTacticalActionRuntime({ runtime: session, pulseIndex: 1, fighters: baseFighters, executeCanonicalAttack: () => assert.fail("stale session rolled") });
assert.equal(session.terminalHistory.at(-1).invalidationReason, "stale-combat-session");

const rejectionRuntime = createTacticalActionRuntime({ generationId: 7, combatSession: 8 });
const rejectedIntent = createTacticalActionIntent({
  actionIntentId: "armored-plan-missing",
  generationId: 7,
  combatSession: 8,
  actorId: "a",
  targetActorId: "b",
  weaponId: "long-sword",
  timingKey: "daggerAttack",
  createdAtPulse: 0,
}).intent;
registerTacticalAction(rejectionRuntime, rejectedIntent);
let rejectedRolls = 0;
const rejection = await advanceTacticalActionRuntime({
  runtime: rejectionRuntime,
  pulseIndex: 1,
  fighters: baseFighters,
  executeCanonicalAttack: () => ({ accepted: false, reason: "missing-armored-action-plan", rolls: rejectedRolls }),
});
assert.equal(rejectedRolls, 0, "rejected armored admission cannot roll");
assert.equal(rejectionRuntime.activeActions.size, 0);
assert.equal(rejectionRuntime.recoveryByActor.size, 0);
assert.equal(rejectionRuntime.terminalHistory.at(-1).state, "invalidated");
assert.equal(rejectionRuntime.terminalHistory.at(-1).invalidationReason, "missing-armored-action-plan");
const rejectedKey = rejectionRuntime.terminalHistory.at(-1).executionKey;
assert.ok(rejectedKey);
assert.equal(rejection.events.filter((entry) => entry.eventType === "tactical-attack-resolution-rejected").length, 1);

const replannedIntent = createTacticalActionIntent({
  actionIntentId: "armored-plan-valid",
  generationId: 7,
  combatSession: 8,
  actorId: "a",
  targetActorId: "b",
  weaponId: "long-sword",
  techniqueId: "half-sword-thrust",
  timingKey: "daggerAttack",
  createdAtPulse: 1,
  actionSequence: 2,
}).intent;
assert.equal(registerTacticalAction(rejectionRuntime, replannedIntent).accepted, true, "rejected admission releases primary ownership for replanning");
const replanned = await advanceTacticalActionRuntime({
  runtime: rejectionRuntime,
  pulseIndex: 2,
  fighters: baseFighters,
  executeCanonicalAttack: ({ techniqueId }) => {
    assert.equal(techniqueId, "half-sword-thrust");
    rejectedRolls += 1;
    return { accepted: true, armorPipeline: true };
  },
});
assert.equal(rejectedRolls, 1);
assert.equal(rejectionRuntime.activeActions.size, 0);
assert.equal(rejectionRuntime.recoveryByActor.has("a"), true);
const replannedCompletion = replanned.events.find((entry) => entry.eventType === "tactical-attack-resolution-completed");
assert.ok(replannedCompletion);
assert.notEqual(replannedCompletion.data.executionKey, rejectedKey, "replan receives a distinct execution identity");

const thrownRuntime = createTacticalActionRuntime({ generationId: 3, combatSession: 3 });
registerTacticalAction(thrownRuntime, createTacticalActionIntent({
  actionIntentId: "thrown-callback",
  generationId: 3,
  combatSession: 3,
  actorId: "a",
  targetActorId: "b",
  weaponId: "sword",
  timingKey: "daggerAttack",
}).intent);
const thrown = await advanceTacticalActionRuntime({
  runtime: thrownRuntime,
  pulseIndex: 1,
  fighters: baseFighters,
  executeCanonicalAttack: () => { throw new Error("adapter exploded"); },
});
assert.equal(thrown.accepted, true, "callback failure is contained as an action rejection rather than aborting the pulse");
assert.equal(thrownRuntime.activeActions.size, 0);
assert.equal(thrownRuntime.recoveryByActor.size, 0);
assert.equal(thrownRuntime.terminalHistory.at(-1).invalidationReason, "canonical-attack-callback-threw");
console.log("tactical action invalidation tests passed");

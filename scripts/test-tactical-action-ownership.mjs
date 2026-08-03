import assert from "node:assert/strict";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";
import {
  auditTacticalActionOwnership,
  cancelTacticalAction,
  claimTacticalExecution,
  cleanupTacticalActionRuntime,
  createTacticalActionRuntime,
  registerTacticalAction,
  requestTacticalActionRelease,
} from "../src/utils/combat/tacticalActionRuntime.js";

const runtime = createTacticalActionRuntime({ generationId: 5, combatSession: 6 });
const input = (id, generationId = 5, combatSession = 6) => createTacticalActionIntent({ actionIntentId: id, generationId, combatSession, actorId: "a", targetActorId: "b", weaponId: "sword" }).intent;
assert.equal(registerTacticalAction(runtime, input("one")).accepted, true);
assert.equal(registerTacticalAction(runtime, input("two")).reason, "duplicate-action-ownership");
assert.equal(registerTacticalAction(createTacticalActionRuntime({ generationId: 5, combatSession: 6 }), input("stale-generation", 4, 6)).reason, "stale-generation");
assert.equal(registerTacticalAction(createTacticalActionRuntime({ generationId: 5, combatSession: 6 }), input("stale-session", 5, 7)).reason, "stale-combat-session");
assert.equal(auditTacticalActionOwnership(runtime).matches, true);
assert.equal(requestTacticalActionRelease(runtime, "a", { actionIntentId: "replacement" }).reason, "stale-tactical-action-intent");
assert.equal(cancelTacticalAction(runtime, "a", "stale", { generationId: 4 }).reason, "stale-generation");
assert.equal(runtime.activeActions.get("a").actionIntentId, "one");
assert.equal(cancelTacticalAction(runtime, "a", "manual-cancel", { actionIntentId: "one", generationId: 5, combatSession: 6 }).accepted, true);
assert.equal(auditTacticalActionOwnership(runtime).activeActionCount, 0);
assert.equal(claimTacticalExecution(runtime, "one-key").accepted, true);
assert.equal(claimTacticalExecution(runtime, "one-key").reason, "duplicate-tactical-attack-execution");
cleanupTacticalActionRuntime(runtime, "combat-ended");
assert.equal(registerTacticalAction(runtime, input("post-terminal")).reason, "tactical-action-runtime-closed");
console.log("tactical action ownership tests passed");

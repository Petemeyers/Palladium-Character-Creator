import assert from "node:assert/strict";
import {
  advanceTacticalActionRuntime,
  claimTacticalExecution,
  claimTacticalProjectileRelease,
  cleanupTacticalActionRuntime,
  createTacticalActionRuntime,
  registerTacticalAction,
  resetTacticalActionCoordinates,
} from "../src/utils/combat/tacticalActionRuntime.js";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";

const runtime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
const intent = createTacticalActionIntent({ actionIntentId: "pending", generationId: 1, combatSession: 1, actorId: "a", targetActorId: "b", weaponId: "bow", actionType: "ranged-attack", timingKey: "longbowAimedShot" }).intent;
registerTacticalAction(runtime, intent);
claimTacticalProjectileRelease(runtime, "released-projectile");
const cleanup = cleanupTacticalActionRuntime(runtime, "combat-ended");
assert.equal(cleanup.accepted, true);
assert.equal(cleanup.data.pendingActionCount, 1);
assert.equal(cleanup.data.matches, true);
assert.equal(cleanup.data.preparingActionCount, 1);
assert.equal(cleanup.data.readyActionCount, 0);
assert.equal(cleanup.data.resolvingActionCount, 0);
assert.equal(cleanup.data.recoveryCount, 0);
assert.equal(cleanup.data.releaseRequestCount, 1);
assert.equal(cleanup.data.projectileClaimCount, 1);
assert.equal(runtime.activeActions.size, 0);
assert.equal(runtime.recoveryByActor.size, 0);
assert.equal(runtime.closed, true);
assert.equal(claimTacticalExecution(runtime, "stale-callback").reason, "tactical-action-runtime-closed");
assert.equal(claimTacticalProjectileRelease(runtime, "stale-projectile").reason, "tactical-action-runtime-closed");
assert.equal(runtime.postCombatMutationsBlocked, 2);
assert.equal(cleanupTacticalActionRuntime(runtime, "duplicate-cleanup").reason, "tactical-action-cleanup-already-completed");
let released = 0;
const staleAdvance = await advanceTacticalActionRuntime({ runtime, pulseIndex: 10, fighters: [{ id: "a", team: "party" }, { id: "b", team: "enemy" }], combatActive: false, spendCanonicalAmmunition: () => { released += 1; }, executeCanonicalAttack: () => { released += 1; } });
assert.equal(staleAdvance.reason, "tactical-action-runtime-closed");
assert.equal(released, 0);

const reset = resetTacticalActionCoordinates(runtime, { generationId: 2, combatSession: 3 });
assert.equal(reset.reason, "tactical-action-cleanup-already-completed");
assert.equal(runtime.closed, false);
assert.equal(runtime.generationId, 2);
assert.equal(runtime.combatSession, 3);
console.log("tactical terminal cleanup tests passed");

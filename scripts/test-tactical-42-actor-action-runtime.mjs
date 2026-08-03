import assert from "node:assert/strict";
import {
  advanceTacticalActionRuntime,
  auditTacticalActionOwnership,
  claimTacticalExecution,
  claimTacticalProjectileRelease,
  createTacticalActionRuntime,
  registerTacticalAction,
} from "../src/utils/combat/tacticalActionRuntime.js";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";

const runtime = createTacticalActionRuntime({ generationId: 1, combatSession: 1, maxTerminalHistory: 42 });
const fighters = Array.from({ length: 42 }, (_, index) => ({ id: `actor-${index}`, team: index < 21 ? "party" : "enemy" }));
for (let index = 0; index < 42; index += 1) {
  const targetIndex = index < 21 ? 21 + index : index - 21;
  const intent = createTacticalActionIntent({ actionIntentId: `intent-${index}`, generationId: 1, combatSession: 1, actorId: `actor-${index}`, targetActorId: `actor-${targetIndex}`, weaponId: "sword", timingKey: index % 2 ? "heavyMeleeAttack" : "daggerAttack" }).intent;
  assert.equal(registerTacticalAction(runtime, intent).accepted, true);
}
assert.equal(auditTacticalActionOwnership(runtime).activeActionCount, 42);
await advanceTacticalActionRuntime({ runtime, pulseIndex: 1, fighters, executeCanonicalAttack: () => ({ accepted: true }) });
assert.equal(auditTacticalActionOwnership(runtime).matches, true);
await advanceTacticalActionRuntime({ runtime, pulseIndex: 2, fighters, executeCanonicalAttack: () => ({ accepted: true }) });
assert.equal(auditTacticalActionOwnership(runtime).matches, true);
assert.ok(runtime.terminalHistory.length <= 42);
for (let index = 0; index < 400; index += 1) {
  claimTacticalExecution(runtime, `execution-${index}`);
  claimTacticalProjectileRelease(runtime, `projectile-${index}`);
}
assert.ok(runtime.executionKeys.size <= runtime.maxClaimHistory);
assert.ok(runtime.ammunitionReleaseKeys.size <= runtime.maxClaimHistory);
assert.equal(runtime.executionKeyOrder.length, runtime.executionKeys.size);
assert.equal(runtime.ammunitionReleaseKeyOrder.length, runtime.ammunitionReleaseKeys.size);
console.log("tactical 42-actor action runtime tests passed");

import assert from "node:assert/strict";
import { advanceTacticalActionRuntime, createTacticalActionRuntime, registerTacticalAction } from "../src/utils/combat/tacticalActionRuntime.js";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";

const fighters = [{ id: "a", team: "party" }, { id: "b", team: "enemy", hp: 10 }];
const runtime = createTacticalActionRuntime({ generationId: 8, combatSession: 9 });
const intent = createTacticalActionIntent({ actionIntentId: "canonical", generationId: 8, combatSession: 9, actorId: "a", targetActorId: "b", weaponId: "sword", timingKey: "longswordThrust", createdAtPulse: 0 }).intent;
registerTacticalAction(runtime, intent);
let canonicalCalls = 0;
let hpMutations = 0;
let sequentialAdvances = 0;
const canonicalResult = { accepted: true, attackAudit: { d20: 14, modifier: 5, total: 19 }, damageMetadata: { damageType: "piercing", location: "torso" } };
const execute = (admission) => {
  canonicalCalls += 1;
  assert.equal(admission.suppressSequentialTurnAdvance, true);
  assert.match(admission.executionKey, /^tactical-attack:8:9:1:a:b:canonical:1$/);
  hpMutations += 1;
  return canonicalResult;
};
await advanceTacticalActionRuntime({ runtime, pulseIndex: 1, fighters, executeCanonicalAttack: execute });
await advanceTacticalActionRuntime({ runtime, pulseIndex: 2, fighters, executeCanonicalAttack: execute });
await advanceTacticalActionRuntime({ runtime, pulseIndex: 2, fighters, executeCanonicalAttack: () => { canonicalCalls += 1; hpMutations += 1; } });
assert.equal(canonicalCalls, 1);
assert.equal(hpMutations, 1);
assert.equal(sequentialAdvances, 0);
const recovery = runtime.recoveryByActor.get("a");
assert.deepEqual(recovery.result.attackAudit, canonicalResult.attackAudit);
assert.deepEqual(recovery.result.damageMetadata, canonicalResult.damageMetadata);
console.log("tactical canonical attack integration tests passed");

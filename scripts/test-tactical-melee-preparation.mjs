import assert from "node:assert/strict";
import { createTacticalActionRuntime, advanceTacticalActionRuntime, registerTacticalAction } from "../src/utils/combat/tacticalActionRuntime.js";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";
import { planDefaultTacticalAction } from "../src/utils/combat/tacticalActionPlanning.js";

const fighters = [{ id: "a", team: "party" }, { id: "b", team: "enemy" }];
const make = (timingKey, id) => createTacticalActionIntent({ actionIntentId: id, generationId: 1, combatSession: 1, actorId: "a", targetActorId: "b", weaponId: id, timingKey, createdAtPulse: 0 }).intent;

for (const [timingKey, releasePulse] of [["daggerAttack", 1], ["heavyMeleeAttack", 2]]) {
  const runtime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
  let rolls = 0;
  registerTacticalAction(runtime, make(timingKey, timingKey));
  const first = await advanceTacticalActionRuntime({ runtime, pulseIndex: 0, fighters, executeCanonicalAttack: () => { rolls += 1; return { accepted: true }; } });
  assert.equal(first.accepted, true);
  assert.equal(rolls, 0, "new attack must not resolve in planning pulse");
  for (let pulse = 1; pulse <= releasePulse; pulse += 1) {
    await advanceTacticalActionRuntime({ runtime, pulseIndex: pulse, fighters, executeCanonicalAttack: () => { rolls += 1; return { accepted: true }; } });
  }
  await advanceTacticalActionRuntime({ runtime, pulseIndex: releasePulse + 1, fighters, executeCanonicalAttack: () => { rolls += 1; return { accepted: true }; } });
  assert.equal(rolls, 1);
}

const invalidRuntime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
registerTacticalAction(invalidRuntime, make("spearThrust", "spear"));
await advanceTacticalActionRuntime({ runtime: invalidRuntime, pulseIndex: 1, fighters, validateAction: () => ({ valid: false, reason: "target-left-reach" }), executeCanonicalAttack: () => assert.fail("invalid melee action rolled") });
assert.equal(invalidRuntime.terminalHistory.at(-1).invalidationReason, "target-left-reach");

const reachRuntime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
registerTacticalAction(reachRuntime, make("spearThrust", "extended-spear"));
let extendedReachRolls = 0;
await advanceTacticalActionRuntime({ runtime: reachRuntime, pulseIndex: 1, fighters, validateAction: () => ({ valid: true, reachFeet: 10 }), executeCanonicalAttack: () => { extendedReachRolls += 1; return { accepted: true }; } });
await advanceTacticalActionRuntime({ runtime: reachRuntime, pulseIndex: 2, fighters, validateAction: () => ({ valid: true, reachFeet: 10 }), executeCanonicalAttack: () => { extendedReachRolls += 1; return { accepted: true }; } });
assert.equal(extendedReachRolls, 1);

const armoredPlan = planDefaultTacticalAction({
  actor: { id: "a", team: "party", attacks: [{ id: "weapon.long-sword", name: "Long Sword", type: "melee", reach: 5 }] },
  fighters: [
    { id: "a", team: "party" },
    { id: "b", team: "enemy", armor: { name: "Plate Harness" } },
  ],
  positions: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
  pulseIndex: 4,
  generationId: 1,
  combatSession: 1,
  selectAttackTechnique: ({ attack, target, distance }) => {
    assert.equal(attack.id, "weapon.long-sword");
    assert.equal(target.id, "b");
    assert.equal(distance, 5);
    return { selectedTechnique: "half-sword-thrust" };
  },
});
assert.equal(armoredPlan.accepted, true);
assert.equal(armoredPlan.intent.techniqueId, "half-sword-thrust");
assert.equal(armoredPlan.intent.timingKey, "halfSwordThrust");
assert.equal(armoredPlan.intent.readyAtPulse, 6);
console.log("tactical melee preparation tests passed");

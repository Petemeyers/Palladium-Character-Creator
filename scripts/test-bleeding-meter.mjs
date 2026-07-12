import assert from "node:assert/strict";

import { applyBleedingMeterForNewMeleeRound } from "../src/utils/combat/bleedingMeter.js";

function bleedingFighter(ratePerMelee) {
  return {
    name: "Test Fighter",
    currentHP: 10,
    hp: 10,
    conditions: [{
      type: "BLEEDING",
      location: "torso",
      severity: "test",
      ratePerMelee,
      bleedMeter: 0,
      untilTreated: true,
    }],
  };
}

let fighter = bleedingFighter(0.25);
for (let round = 1; round <= 3; round += 1) {
  const result = applyBleedingMeterForNewMeleeRound(fighter, { meleeRound: round });
  fighter = result.fighter;
  assert.equal(result.hpLoss, 0);
  assert.equal(fighter.currentHP, 10);
}
let result = applyBleedingMeterForNewMeleeRound(fighter, { meleeRound: 4 });
fighter = result.fighter;
assert.equal(result.hpLoss, 1);
assert.equal(fighter.currentHP, 9);
assert.equal(fighter.conditions[0].bleedMeter, 0);

fighter = bleedingFighter(0.5);
result = applyBleedingMeterForNewMeleeRound(fighter, { meleeRound: 1 });
assert.equal(result.hpLoss, 0);
result = applyBleedingMeterForNewMeleeRound(result.fighter, { meleeRound: 2 });
assert.equal(result.hpLoss, 1);
assert.equal(result.fighter.currentHP, 9);

fighter = bleedingFighter(1);
result = applyBleedingMeterForNewMeleeRound(fighter, { meleeRound: 1 });
assert.equal(result.hpLoss, 1);
assert.equal(result.fighter.currentHP, 9);
result = applyBleedingMeterForNewMeleeRound(result.fighter, { meleeRound: 2 });
assert.equal(result.hpLoss, 1);
assert.equal(result.fighter.currentHP, 8);

fighter = bleedingFighter(0.6);
result = applyBleedingMeterForNewMeleeRound(fighter, { meleeRound: 1 });
assert.equal(result.hpLoss, 0);
assert.equal(result.fighter.conditions[0].bleedMeter, 0.6);
result = applyBleedingMeterForNewMeleeRound(result.fighter, { meleeRound: 2 });
assert.equal(result.hpLoss, 1);
assert.ok(Math.abs(result.fighter.conditions[0].bleedMeter - 0.2) < 0.0001);

console.log("bleeding meter tests passed");

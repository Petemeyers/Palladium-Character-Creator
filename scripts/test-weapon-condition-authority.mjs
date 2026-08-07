import assert from "node:assert/strict";
import {
  createWeaponCondition,
  getActiveWeaponConditionPenalties,
  pruneExpiredWeaponConditions,
  WEAPON_CONDITION_TYPES,
} from "../src/utils/combat/weaponConditionAuthority.js";

const condition = createWeaponCondition({
  type: WEAPON_CONDITION_TYPES.OFF_BALANCE,
  sourceActorId: "halberdier",
  targetActorId: "swordsman",
  currentRound: 4,
  durationRounds: 1,
});
const actor = { statusEffects: [condition] };
assert.equal(getActiveWeaponConditionPenalties(actor, 4).defense, -1);
assert.equal(getActiveWeaponConditionPenalties(actor, 5).entry, -1);
assert.equal(getActiveWeaponConditionPenalties(actor, 6).defense, 0);
assert.equal(pruneExpiredWeaponConditions(actor, 6).statusEffects.length, 0);

const stacked = {
  statusEffects: [
    condition,
    createWeaponCondition({ type: WEAPON_CONDITION_TYPES.GUARD_DISRUPTED, currentRound: 4, durationRounds: 1 }),
  ],
};
const penalties = getActiveWeaponConditionPenalties(stacked, 4);
assert.equal(penalties.defense, -2);
assert.equal(penalties.entry, -1);
assert.equal(penalties.control, -1);
console.log("weapon condition authority test passed");

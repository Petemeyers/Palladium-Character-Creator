import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  applyRangedAttackRangeModifierToBonus,
  getRangedAttackRangeModifier,
} from "../src/utils/rangedAttackRangeModifier.js";

const longbow = { name: "Longbow Shot", type: "ranged", range: 150 };
const archer = {
  id: "longbowman-1",
  originalActorMetadata: { attributes: { deftness: 15, awareness: 13 } },
};

const close = applyRangedAttackRangeModifierToBonus({
  actor: archer,
  attack: longbow,
  distanceFt: 30,
  baseAttackBonus: 4,
});
assert.equal(close.band, "close");
assert.equal(close.rangeModifier, 1);
assert.equal(close.modifiedAttackBonus, 5);

const effective = applyRangedAttackRangeModifierToBonus({
  actor: archer,
  attack: longbow,
  distanceFt: 75,
  baseAttackBonus: 4,
});
assert.equal(effective.band, "effective");
assert.equal(effective.rangeModifier, 0);
assert.equal(effective.modifiedAttackBonus, 4);

const long = applyRangedAttackRangeModifierToBonus({
  actor: archer,
  attack: longbow,
  distanceFt: 120,
  baseAttackBonus: 4,
});
assert.equal(long.band, "long");
assert.equal(long.controlModifier, 1);
assert.equal(long.rangeModifier, -1);
assert.equal(long.modifiedAttackBonus, 3);

const outOfRange = applyRangedAttackRangeModifierToBonus({
  actor: archer,
  attack: longbow,
  distanceFt: 151,
  baseAttackBonus: 4,
});
assert.equal(outOfRange.blocked, true);
assert.equal(outOfRange.canAttack, false);

const melee = applyRangedAttackRangeModifierToBonus({
  actor: archer,
  attack: { name: "Longsword", type: "melee", reach: 5 },
  distanceFt: 5,
  baseAttackBonus: 4,
});
assert.equal(melee.isRanged, false);
assert.equal(melee.rangeModifier, 0);
assert.equal(melee.modifiedAttackBonus, 4);

const knife = applyRangedAttackRangeModifierToBonus({
  actor: archer,
  attack: { name: "Knife Attack", attackType: "melee/ranged", range: 60, reach: 5 },
  distanceFt: 20,
  baseAttackBonus: 4,
});
assert.equal(knife.isRanged, false);
const thrownKnife = applyRangedAttackRangeModifierToBonus({
  actor: archer,
  attack: { name: "Throw Knife", attackType: "thrown", range: 20 },
  distanceFt: 20,
  baseAttackBonus: 4,
});
assert.equal(thrownKnife.isRanged, true);

const normalProfile = getRangedAttackRangeModifier({ actor: archer, attack: longbow, distanceFt: 120 });
assert.equal(long.rangeModifier, normalProfile.finalModifier, "normal and overwatch profiles have modifier parity");

const combatPageSource = readFileSync("src/pages/CombatPage.jsx", "utf8");
assert.match(combatPageSource, /applyRangedAttackRangeModifierToBonus/);
assert.match(combatPageSource, /rangeModifierApplied/);
assert.match(combatPageSource, /cannot make an overwatch shot/);

console.log("overwatch range modifier tests passed");

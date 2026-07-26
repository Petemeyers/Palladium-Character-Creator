import assert from "node:assert/strict";

import {
  getRangedAttackRangeModifier,
  getRangedControlModifier,
  isExplicitRangedAttack,
} from "../src/utils/rangedAttackRangeModifier.js";

const longbow = { name: "Longbow Shot", type: "ranged", range: 150 };
assert.equal(getRangedAttackRangeModifier({ attack: longbow, distanceFt: 30 }).band, "close");
assert.equal(getRangedAttackRangeModifier({ attack: longbow, distanceFt: 30 }).finalModifier, 1);
assert.equal(getRangedAttackRangeModifier({ attack: longbow, distanceFt: 75 }).band, "standard");
assert.equal(getRangedAttackRangeModifier({ attack: longbow, distanceFt: 120 }).band, "long");
assert.equal(getRangedAttackRangeModifier({ attack: longbow, distanceFt: 120 }).finalModifier, -2);
assert.equal(getRangedAttackRangeModifier({ attack: longbow, distanceFt: 151 }).canAttack, false);

const practicedArcher = {
  originalActorMetadata: { attributes: { deftness: 15, awareness: 13 } },
};
assert.equal(getRangedControlModifier(practicedArcher), 1);
assert.equal(
  getRangedAttackRangeModifier({ actor: practicedArcher, attack: longbow, distanceFt: 120 }).finalModifier,
  -2,
);
const poorArcher = {
  originalActorMetadata: { attributes: { deftness: 7, awareness: 7 } },
};
assert.equal(getRangedControlModifier(poorArcher), -2);
assert.equal(
  getRangedAttackRangeModifier({ actor: poorArcher, attack: longbow, distanceFt: 120 }).finalModifier,
  -2,
);

assert.equal(isExplicitRangedAttack({ name: "Knife Attack", attackType: "melee/ranged", range: "20/60 ft" }), false);
assert.equal(isExplicitRangedAttack({ name: "Throw Knife", attackType: "thrown", range: 20 }), true);
assert.equal(isExplicitRangedAttack({ name: "Fire Breath", range: 30 }), true);
assert.equal(isExplicitRangedAttack({ name: "Knife Attack", type: "melee", range: 60 }), false);
assert.equal(
  getRangedAttackRangeModifier({ attack: { name: "Knife Attack", type: "melee", range: 60 }, distanceFt: 20 }).isRanged,
  false,
);
assert.doesNotThrow(() => getRangedAttackRangeModifier({ actor: null, attack: null, distanceFt: {} }));

console.log("ranged attack range modifier tests passed");

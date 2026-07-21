import assert from "node:assert/strict";
import { createCanonicalUnarmedAttack } from "../src/utils/combat/unarmedAttackSanitization.js";

const unarmed = createCanonicalUnarmedAttack({
  name: "Long Sword",
  damage: "1d8 + 2",
  damageDice: "1d8 + 2",
  damageType: "slashing",
  sourceWeaponId: "long-sword",
  sourceWeaponName: "Long Sword",
  selectedTechnique: "longsword-cut",
  armoredActionPlan: { sourceWeaponId: "long-sword" },
});
assert.equal(unarmed.name, "Unarmed Attack");
assert.equal(unarmed.damage, "1d3");
assert.equal(unarmed.damageDice, "1d3");
assert.equal(unarmed.damageType, "blunt");
assert.equal(unarmed.sourceWeaponId, "Unarmed Attack");
assert.equal(unarmed.sourceWeapon, null);
assert.equal(unarmed.armoredActionPlan, null);
assert.equal(unarmed.selectedTechnique, null);
console.log("unarmed cannot inherit sword damage test passed");

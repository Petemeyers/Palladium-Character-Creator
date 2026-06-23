import assert from "node:assert/strict";
import {
  applyArmorMitigation,
  getArmorProfile,
  getArmorReduction,
} from "../src/utils/combatArmor.js";
import { applyPublicCombatDamage } from "../src/utils/publicCombatHp.js";

const target = {
  id: "armored-1",
  name: "Armored Fighter",
  HP: 12,
  armorReduction: 2,
};
const attack = { name: "Spear Thrust", damageType: "piercing" };
const targetSnapshot = JSON.stringify(target);
const attackSnapshot = JSON.stringify(attack);

const explicit = applyArmorMitigation({ target, attack, rawDamage: 7 });
assert.equal(explicit.rawDamage, 7, "Raw damage should be preserved");
assert.equal(explicit.armorReduction, 2, "Explicit armor reduction should be used");
assert.equal(explicit.finalDamage, 5, "Reduction 2 should reduce raw damage 7 to final damage 5");
assert.equal(explicit.armorSource, "explicit", "Explicit source should be reported");

const publicArmor = applyArmorMitigation({
  target: { publicArmor: { reduction: 3 } },
  attack,
  rawDamage: 7,
});
assert.equal(publicArmor.armorReduction, 3, "publicArmor.reduction should be used");
assert.equal(publicArmor.finalDamage, 4, "publicArmor reduction should affect final damage");
assert.equal(publicArmor.armorSource, "publicArmor", "publicArmor source should be reported");

const armorObject = applyArmorMitigation({
  target: { armor: { reduction: 4 } },
  attack,
  rawDamage: 7,
});
assert.equal(armorObject.armorReduction, 4, "armor.reduction should be used");
assert.equal(armorObject.finalDamage, 3, "armor object reduction should affect final damage");
assert.equal(armorObject.armorSource, "armor", "armor source should be reported");

assert.deepEqual(getArmorProfile({ armorClass: 12 }), {
  reduction: 0,
  source: "AC fallback",
}, "AC 10-12 should fall back to 0 reduction");
assert.equal(getArmorReduction({ guardRating: 15 }), 1, "AC/Guard 13-15 should fall back to 1 reduction");
assert.equal(getArmorReduction({ guardRating: 18 }), 2, "AC/Guard 16-18 should fall back to 2 reduction");
assert.equal(getArmorReduction({ guardRating: 19 }), 3, "AC/Guard 19+ should fall back to 3 reduction");

const absorbed = applyArmorMitigation({
  target: { armorReduction: 10 },
  attack,
  rawDamage: 4,
});
assert.equal(absorbed.finalDamage, 0, "Armor should not make final damage negative");
assert.equal(absorbed.message, "Armor absorbed the blow.", "0 final damage should report absorption");

const malformed = applyArmorMitigation({
  target: { armorReduction: true, publicArmor: { reduction: "bad" } },
  attack,
  rawDamage: "bad",
});
assert.equal(malformed.rawDamage, 0, "Malformed raw damage should default safely");
assert.equal(malformed.armorReduction, 0, "Malformed armor fields should default safely");
assert.equal(malformed.finalDamage, 0, "Malformed values should not throw");

const hpResult = applyPublicCombatDamage(target, explicit.finalDamage);
assert.equal(hpResult.ok, true, "Final damage should apply through HP helper");
assert.equal(hpResult.newHp, 7, "HP should decrease by final damage, not raw damage");

const zeroHpResult = applyPublicCombatDamage(target, absorbed.finalDamage);
assert.equal(zeroHpResult.ok, true, "0 final damage should apply safely");
assert.equal(zeroHpResult.newHp, 12, "0 final damage should not change HP");

assert.equal(JSON.stringify(target), targetSnapshot, "Armor helper should not mutate target");
assert.equal(JSON.stringify(attack), attackSnapshot, "Armor helper should not mutate attack");

console.log("Combat armor tests passed.");

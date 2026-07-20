import assert from "node:assert/strict";

import {
  getGapDefense,
  resolveArmorContact,
} from "../src/utils/combat/armorContactResolver.js";
import {
  ARMOR_CONTACT_TYPES,
  LONGSWORD_ATTACK_MODES,
  normalizeArmorProfile,
} from "../src/utils/combat/weaponArmorProfiles.js";

const knight = {
  id: "knight-a",
  name: "Knight",
  equistaminadArmor: { name: "Plate Mail", type: "heavy", guardRating: 18 },
  guardRating: 16,
};
const attacker = { id: "knight-b", name: "Knight", guardRating: 16 };
const longSword = { name: "Long Sword", damage: "1d8", damageType: "slashing" };
const plate = normalizeArmorProfile(knight);

const torsoCut = resolveArmorContact({
  attacker,
  defender: knight,
  weapon: longSword,
  attackMode: LONGSWORD_ATTACK_MODES.CUT,
  attackRoll: 14,
  attackTotal: 18,
  critical: false,
  hitLocation: "torso",
  armor: plate,
  normalDefense: 16,
});
assert.equal(torsoCut.contactType, ARMOR_CONTACT_TYPES.SOLID_PLATE);
assert.equal(torsoCut.damageAllowed, false, "ordinary longsword cut to plate torso should not allow HP damage");
assert.equal(torsoCut.damagePrevented, true);
assert.equal(torsoCut.mayBleed, false, "solid plate cut cannot cause bleeding");
assert.equal(torsoCut.mayCauseUnconsciousness, false, "solid plate cut cannot cause unconsciousness");

const legCut = resolveArmorContact({
  attacker,
  defender: knight,
  weapon: longSword,
  attackMode: LONGSWORD_ATTACK_MODES.CUT,
  attackTotal: 19,
  critical: false,
  hitLocation: "legs",
  armor: plate,
  normalDefense: 16,
});
assert.equal(legCut.contactType, ARMOR_CONTACT_TYPES.SOLID_PLATE);
assert.equal(legCut.damageAllowed, false, "ordinary longsword cut to plate leg should not allow HP damage");
assert.equal(legCut.mayCauseUnconsciousness, false, "leg plate impact should not become head-trauma unconsciousness");

const criticalLegCut = resolveArmorContact({
  attacker,
  defender: knight,
  weapon: longSword,
  attackMode: LONGSWORD_ATTACK_MODES.CUT,
  attackRoll: 20,
  attackTotal: 24,
  critical: true,
  hitLocation: "legs",
  armor: plate,
  normalDefense: 16,
});
assert.equal(criticalLegCut.damageAllowed, false, "critical edge cut still cannot bypass solid plate");
assert.equal(criticalLegCut.criticalArmorImpact, true);
assert.equal(criticalLegCut.mayKnockDown, true, "critical leg plate impact may favor knockdown");
assert.equal(criticalLegCut.mayCauseUnconsciousness, false);

const unarmoredCut = resolveArmorContact({
  attacker,
  defender: { id: "unarmored", name: "Unarmored", guardRating: 12 },
  weapon: longSword,
  attackMode: LONGSWORD_ATTACK_MODES.CUT,
  attackTotal: 14,
  critical: false,
  hitLocation: "torso",
  normalDefense: 12,
});
assert.equal(unarmoredCut.damageAllowed, true, "longsword cut should still damage unarmored targets");
assert.equal(unarmoredCut.bodilyDamageMultiplier, 1);

console.log("✅ longsword solid-plate armor contact tests passed");

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

const defender = {
  id: "plate-knight",
  name: "Plate Knight",
  equistaminadArmor: { name: "Field Plate", type: "heavy" },
  guardRating: 16,
};
const armor = normalizeArmorProfile(defender);
const weapon = { name: "Long Sword", damage: "1d8", damageType: "slashing" };

assert.equal(
  getGapDefense({
    normalDefense: 16,
    armor,
    attackMode: LONGSWORD_ATTACK_MODES.HALF_SWORD_THRUST,
  }),
  21,
  "base plate gap Defense should be normal Defense + 5",
);
assert.equal(
  getGapDefense({
    normalDefense: 16,
    armor,
    attackMode: LONGSWORD_ATTACK_MODES.THRUST,
  }),
  23,
  "ordinary longsword thrust should have +2 extra gap difficulty",
);
assert.equal(
  getGapDefense({
    normalDefense: 16,
    armor,
    attackMode: LONGSWORD_ATTACK_MODES.HALF_SWORD_THRUST,
    targetState: { grappled: true, prone: true, pinned: true },
  }),
  10,
  "grappled/prone/pinned modifiers should lower gap Defense centrally",
);

const ordinaryThrustBelowGap = resolveArmorContact({
  defender,
  weapon,
  attackMode: LONGSWORD_ATTACK_MODES.THRUST,
  attackTotal: 20,
  hitLocation: "legs",
  armor,
  normalDefense: 16,
});
assert.equal(ordinaryThrustBelowGap.contactType, ARMOR_CONTACT_TYPES.SOLID_PLATE);
assert.equal(ordinaryThrustBelowGap.gapCapable, true);
assert.equal(ordinaryThrustBelowGap.gapReached, false);
assert.equal(ordinaryThrustBelowGap.damageAllowed, false, "thrust below gap Defense should contact armor but cause 0 HP");

const halfSwordGap = resolveArmorContact({
  defender,
  weapon,
  attackMode: LONGSWORD_ATTACK_MODES.HALF_SWORD_THRUST,
  attackTotal: 21,
  hitLocation: "legs",
  armor,
  normalDefense: 16,
});
assert.equal(halfSwordGap.contactType, ARMOR_CONTACT_TYPES.ARMOR_GAP);
assert.equal(halfSwordGap.gapReached, true);
assert.equal(halfSwordGap.damageAllowed, true, "half-sword gap hit should allow bodily piercing damage");
assert.equal(halfSwordGap.convertedDamageType, "piercing");
assert.equal(halfSwordGap.mayBleed, true);
assert.equal(halfSwordGap.gapLocation, "back of knee");

const naturalTwentyHalfSword = resolveArmorContact({
  defender,
  weapon,
  attackMode: LONGSWORD_ATTACK_MODES.HALF_SWORD_THRUST,
  attackRoll: 20,
  attackTotal: 20,
  critical: true,
  hitLocation: "torso",
  armor,
  normalDefense: 16,
});
assert.equal(naturalTwentyHalfSword.contactType, ARMOR_CONTACT_TYPES.ARMOR_GAP);
assert.equal(naturalTwentyHalfSword.damageAllowed, true, "natural 20 half-sword thrust should become a gap critical opportunity");

console.log("✅ armor gap Defense tests passed");

import assert from "node:assert/strict";

import { resolveArmorContact } from "../src/utils/combat/armorContactResolver.js";
import { resolveArmorImpactEffect } from "../src/utils/combat/armorImpactResolver.js";
import { formatHitLocationForPlayer } from "../src/utils/combat/hitLocationDisplay.js";
import {
  ARMORED_TECHNIQUES,
  buildArmoredTechniqueAttack,
} from "../src/utils/ai/selectArmoredCombatTechnique.js";

const attacker = { id: "a", name: "Knight" };
const defender = {
  id: "b",
  name: "Knight",
  armor: { armorClass: "plate", rigidCoverage: true, armorName: "Plate Harness" },
};
const longSword = { name: "Long Sword", damage: "1d8", type: "melee", range: 5 };

const halfSword = buildArmoredTechniqueAttack(longSword, ARMORED_TECHNIQUES.HALF_SWORD_THRUST);
const halfSwordContact = resolveArmorContact({
  attacker,
  defender,
  weapon: halfSword,
  attackData: halfSword,
  attackMode: halfSword.attackMode,
  attackRoll: 20,
  attackTotal: 25,
  critical: true,
  hitLocation: "torso",
  armor: defender.armor,
  targetState: {},
  normalDefense: 16,
});

assert.equal(halfSwordContact.attackMode, ARMORED_TECHNIQUES.HALF_SWORD_THRUST, "half-sword mode should reach armor resolver unchanged");
assert.equal(halfSwordContact.gapCapable, true, "half-sword thrust should be gap-capable");

const pommel = buildArmoredTechniqueAttack(longSword, ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD);
const pommelContact = resolveArmorContact({
  attacker,
  defender,
  weapon: pommel,
  attackData: pommel,
  attackMode: pommel.attackMode,
  attackRoll: 19,
  attackTotal: 24,
  critical: true,
  hitLocation: "head",
  armor: defender.armor,
  targetState: {},
  normalDefense: 16,
});
assert.equal(pommelContact.attackMode, ARMORED_TECHNIQUES.POMMEL_OR_CROSSGUARD, "pommel mode should reach resolver unchanged");
assert.equal(pommelContact.convertedDamageType, "blunt", "pommel strike should resolve as blunt contact");

const failedImpact = resolveArmorImpactEffect({
  attackMode: pommel.attackMode,
  hitLocation: "head",
  critical: true,
  attackMargin: 8,
  contactResult: { ...pommelContact, damageAllowed: false },
  rng: () => 1,
});
assert.equal(failedImpact.checkRequired, true, "critical helmet pommel should require an impact check");
assert.equal(failedImpact.statusApplied, null, "failed impact check should not apply status");

const successfulImpact = resolveArmorImpactEffect({
  attackMode: pommel.attackMode,
  hitLocation: "legs",
  critical: true,
  attackMargin: 8,
  contactResult: { ...pommelContact, hitLocation: "legs", damageAllowed: false },
  rng: () => 20,
});
assert.equal(successfulImpact.effectType, "knockdown", "leg impact should favor knockdown/stagger, not head trauma");
assert.equal(successfulImpact.statusApplied, "OFF_BALANCE", "successful leg impact should apply one off-balance status");

assert.equal(formatHitLocationForPlayer("weaponArm", { armorClass: "plate" }), "weapon arm plate");
assert.equal(formatHitLocationForPlayer("head", { armorClass: "plate" }), "helmet");

console.log("✅ Phase 3B1 mode propagation and armor impact tests passed");

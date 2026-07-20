import assert from "node:assert/strict";

import {
  CLINCH_ATTACK_MODES,
  createClinchWeaponProfile,
  stripStandingAttackFieldsForClinch,
  validateClinchWeaponProfile,
} from "../src/utils/combat/clinchWeaponProfiles.js";
import { resolveArmorContact } from "../src/utils/combat/armorContactResolver.js";

const actor = {
  id: "knight-a",
  name: "Knight A",
  unarmedDamage: "1d4",
  selectedAttack: {
    id: "longsword",
    name: "Long Sword",
    damage: "1d8",
    selectedTechnique: "longsword-cut",
    armorTechnique: "longsword-cut",
  },
};
const defender = {
  id: "knight-b",
  name: "Knight B",
  guardRating: 12,
  armorProfile: { armorClass: "plate", rigidCoverage: true },
  grappleState: { state: "clinch", opponent: "knight-a" },
};

const dagger = createClinchWeaponProfile({ id: "dagger", name: "Dagger", damage: "1d4" }, actor);
assert.equal(dagger.weaponId, "dagger");
assert.equal(dagger.sourceWeaponId, "dagger");
assert.equal(dagger.damage, "1d4");
assert.equal(dagger.attackMode, CLINCH_ATTACK_MODES.DAGGER_GAP_ATTACK);
assert.equal(dagger.sourceWeapon, null);
assert.equal(dagger.selectedTechnique, null);
assert.equal(validateClinchWeaponProfile(dagger).ok, true);

const unarmed = createClinchWeaponProfile(null, actor);
assert.equal(unarmed.name, "Unarmed Attack");
assert.equal(unarmed.sourceWeaponId, "Unarmed Attack");
assert.notEqual(unarmed.damage, "1d8", "Unarmed Attack must not inherit Long Sword damage");
assert.equal(unarmed.attackMode, CLINCH_ATTACK_MODES.UNARMED_ATTACK);
assert.equal(validateClinchWeaponProfile(unarmed).ok, true);

const stripped = stripStandingAttackFieldsForClinch(actor, dagger);
assert.equal(stripped.selectedAttack.name, "Dagger");
assert.equal(stripped.selectedAttack.damage, "1d4");
assert.equal(stripped.armorTechnique, undefined);
assert.equal(stripped.sourceWeapon, undefined);

const invalidLongSwordClinch = {
  name: "Long Sword",
  sourceWeaponId: "Long Sword",
  damage: "1d8",
  attackMode: CLINCH_ATTACK_MODES.DAGGER_GAP_ATTACK,
};
assert.equal(validateClinchWeaponProfile(invalidLongSwordClinch).ok, false);

const solidPlate = resolveArmorContact({
  attacker: actor,
  defender,
  weapon: dagger,
  attackData: dagger,
  attackMode: dagger.attackMode,
  attackRoll: 13,
  hitLocation: "torso",
  targetState: { grappled: true },
  normalDefense: 12,
});
assert.equal(solidPlate.contactType, "solid-plate");
assert.equal(solidPlate.damageAllowed, false);

const gap = resolveArmorContact({
  attacker: actor,
  defender,
  weapon: dagger,
  attackData: dagger,
  attackMode: dagger.attackMode,
  attackRoll: 20,
  hitLocation: "torso",
  targetState: { grappled: true },
  normalDefense: 12,
});
assert.equal(gap.contactType, "armor-gap");
assert.equal(gap.damageAllowed, true);
assert.equal(gap.gapReached, true);

const unarmedPlate = resolveArmorContact({
  attacker: actor,
  defender,
  weapon: unarmed,
  attackData: unarmed,
  attackMode: unarmed.attackMode,
  attackRoll: 20,
  hitLocation: "torso",
  targetState: { grappled: true },
  normalDefense: 12,
});
assert.equal(unarmedPlate.damageAllowed, false);
assert.notEqual(unarmed.damage, "1d8");

console.log("✅ Phase 3B1 clinch weapon identity and armor-contact tests passed");

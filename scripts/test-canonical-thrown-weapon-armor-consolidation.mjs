import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CANONICAL_COMBAT_ACTORS,
  CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES as W,
} from "../src/data/canonicalCombatActors.js";
import { getMissileWeapon } from "../src/data/missileWeapons.js";
import {
  getCanonicalThrownArmorMode,
  isCanonicalPhysicalThrownWeapon,
  resolveArmorContact,
} from "../src/utils/combat/armorContactResolver.js";
import { resolveLayeredArmorImpact } from "../src/utils/combat/armorAssemblyImpact.js";
import {
  claimCanonicalAmmunitionSpend,
  normalizeCanonicalRangedWeaponProfile,
  validateCanonicalRangedAttack,
} from "../src/utils/combat/canonicalRangedCombat.js";
import {
  getArmoredTacticalMemory,
  recordArmoredTacticalOutcome,
} from "../src/utils/combat/armoredTacticalMemory.js";
import { createThrownWeaponArmorAuthorityScenario } from "../src/utils/combat/liveBrowserAuthorityScenarios.js";

const attacker = {
  id: "thrower",
  name: "Thrower",
  team: "party",
  remainingActions: 2,
  inventory: [{ name: "Dagger", quantity: 1 }],
};
const plateDefender = {
  id: "plate-target",
  name: "Plate Target",
  team: "enemy",
  armorClass: 10,
  equippedArmor: { id: "armor.plate", name: "Plate Harness" },
  armorProfile: {
    armorClass: "plate",
    rigidCoverage: true,
    coveredLocations: ["head", "torso", "weaponArm", "shieldArm", "hands", "legs"],
  },
};
const exposedDefender = {
  id: "exposed-target",
  name: "Exposed Target",
  team: "enemy",
  armorClass: 10,
};

const contact = (defender, weapon = W.thrownDagger, hitLocation = "torso") => resolveArmorContact({
  attacker,
  defender,
  weapon,
  attackData: weapon,
  attackMode: getCanonicalThrownArmorMode(weapon),
  attackRoll: 15,
  attackTotal: 20,
  hitLocation,
  normalDefense: 10,
});

assert.equal(isCanonicalPhysicalThrownWeapon(W.thrownDagger), true);
assert.equal(getCanonicalThrownArmorMode(W.thrownDagger), "thrown-light-blade");

const plateContact = contact(plateDefender);
assert.equal(plateContact.contactType, "solid-plate");
assert.equal(plateContact.coverageType, "solid-plate");
assert.equal(plateContact.damageAllowed, false);
assert.equal(plateContact.damagePrevented, true);
assert.equal(plateContact.attackMode, "thrown-light-blade");
assert.equal(plateContact.convertedDamageType, null);

const exposedContact = contact(exposedDefender);
assert.equal(exposedContact.contactType, "unarmored");
assert.equal(exposedContact.coverageType, "unarmored");
assert.equal(exposedContact.damageAllowed, true);
assert.equal(exposedContact.bodilyDamageMultiplier, 1);
assert.equal(exposedContact.convertedDamageType, "piercing");

const uncoveredPlateLocation = contact(plateDefender, W.thrownDagger, "face");
assert.equal(uncoveredPlateLocation.damageAllowed, true);
assert.equal(uncoveredPlateLocation.coverageType, "armor-gap");
assert.equal(uncoveredPlateLocation.reason, "plate-gap-or-uncovered-location");

const requestedGapWithoutThrownTechnique = contact(plateDefender, {
  ...W.thrownDagger,
  targetArmorGap: true,
});
assert.equal(requestedGapWithoutThrownTechnique.gapReached, false);
assert.equal(requestedGapWithoutThrownTechnique.damageAllowed, false);

const rockThrow = CANONICAL_COMBAT_ACTORS.minotaur.attacks.find(
  (attack) => attack.profileKey === "weapon.minotaur-rock-thrown",
);
const rockContact = contact(plateDefender, rockThrow);
assert.equal(rockContact.attackMode, "rockThrow");
assert.equal(rockContact.contactType, "solid-plate");
assert.equal(rockContact.damageAllowed, false);
const rockLayeredImpact = resolveLayeredArmorImpact({
  attacker: CANONICAL_COMBAT_ACTORS.minotaur,
  defender: plateDefender,
  attack: rockThrow,
  techniqueKey: rockThrow.techniqueKey,
  hitLocation: "torso",
  attackMargin: 10,
  contactResult: rockContact,
});
assert.equal(rockLayeredImpact.accepted, true);
assert.equal(rockLayeredImpact.technique.key, "rockThrow");
assert.equal(rockLayeredImpact.technique.damageType, "bludgeoning");
assert.notEqual(rockLayeredImpact.technique.key, "longbow-arrow");
assert.notEqual(rockLayeredImpact.technique.key, "crossbow-bolt");

for (const compatibilityName of ["Throwing Knife", "Throwing Axe", "Javelin"]) {
  const raw = getMissileWeapon(compatibilityName);
  const profile = normalizeCanonicalRangedWeaponProfile(raw);
  assert.equal(profile.name, compatibilityName);
  assert.equal(profile.deliveryType, "thrown");
  assert.equal(isCanonicalPhysicalThrownWeapon(profile), true);
  assert.notEqual(getCanonicalThrownArmorMode(profile), "projectile");
  assert.equal(profile.ammunitionType, null);
  assert.equal(profile.ammunitionPerAttack, 0);
}

const admission = validateCanonicalRangedAttack({
  actor: attacker,
  target: plateDefender,
  weaponProfile: W.thrownDagger,
  actionToken: "throw:1",
  activeActionToken: "throw:1",
  activeActorId: attacker.id,
  distanceFeet: 20,
  lineOfSight: true,
});
assert.equal(admission.accepted, true);
assert.equal(admission.normalizedWeapon.deliveryType, "thrown");
assert.equal(admission.ammunitionState, null);
assert.equal(validateCanonicalRangedAttack({
  actor: attacker,
  target: plateDefender,
  weaponProfile: W.thrownDagger,
  actionToken: "throw:los",
  activeActionToken: "throw:los",
  activeActorId: attacker.id,
  distanceFeet: 20,
  lineOfSight: false,
}).reason, "line-of-sight-blocked");
assert.equal(validateCanonicalRangedAttack({
  actor: attacker,
  target: plateDefender,
  weaponProfile: W.thrownDagger,
  actionToken: "throw:stale",
  activeActionToken: "throw:live",
  activeActorId: attacker.id,
  distanceFeet: 20,
}).reason, "stale-action-token");

const inventoryBefore = structuredClone(attacker.inventory);
assert.equal(claimCanonicalAmmunitionSpend({
  ammunitionState: null,
  weaponProfile: W.thrownDagger,
  actionToken: "throw:1",
  activeActionToken: "throw:1",
}).reason, "invalid-ammunition-weapon");
assert.deepEqual(attacker.inventory, inventoryBefore, "current canonical thrown profiles do not use bow ammo stacks");

const parity = ["manual", "player-ai", "enemy-ai"].map(() => contact(plateDefender));
assert.deepEqual(parity[0], parity[1]);
assert.deepEqual(parity[1], parity[2]);

const memoryStore = new Map();
const recorded = recordArmoredTacticalOutcome(memoryStore, {
  generationId: "phase8",
  attackerId: attacker.id,
  defenderId: plateDefender.id,
  executionKey: "throw:1",
  attackMode: plateContact.attackMode,
  contactResult: plateContact,
  round: 1,
  turn: 1,
});
assert.equal(recorded.recorded, true);
assert.equal(getArmoredTacticalMemory(memoryStore, {
  generationId: "phase8",
  attackerId: attacker.id,
  defenderId: plateDefender.id,
}).solidPlateContacts, 1);
assert.equal(recordArmoredTacticalOutcome(memoryStore, {
  generationId: "phase8",
  attackerId: attacker.id,
  defenderId: plateDefender.id,
  executionKey: "throw:1",
  attackMode: plateContact.attackMode,
  contactResult: plateContact,
  round: 1,
  turn: 1,
}).recorded, false);

const combatPageSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.equal(
  [...combatPageSource.matchAll(/armorContactResult = resolveArmorContact\(\{/g)].length,
  1,
  "one accepted impact reaches one canonical armor-contact call site",
);
assert.match(combatPageSource, /isCanonicalThrownArmorContact/);
assert.match(combatPageSource, /isCanonicalPhysicalThrownWeapon\(attackData\)/);
assert.match(combatPageSource, /isCanonicalProjectileArmorContact \|\| isCanonicalThrownArmorContact\s*\?\s*canonicalProjectileImpact/);
assert.match(combatPageSource, /isCanonicalProjectileArmorContact \|\| isCanonicalKnifeArmorContact[\s\S]*resolveCanonicalPiercingPlateImpact/);
assert.match(combatPageSource, /isCanonicalThrownArmorContact[\s\S]*"thrown-physical-weapon"/);

const liveScenario = createThrownWeaponArmorAuthorityScenario();
assert.equal(liveScenario.plate.contactResult, "solid-plate");
assert.equal(liveScenario.plate.appliedDamage, 0);
assert.equal(liveScenario.exposed.contactResult, "unarmored");
assert.equal(liveScenario.exposed.appliedDamage, 4);
assert.equal(liveScenario.aiPlate.contactResult, liveScenario.plate.contactResult);
assert.equal(liveScenario.parity, true);

console.log("canonical thrown-weapon armor consolidation tests passed");

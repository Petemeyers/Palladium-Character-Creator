import assert from "node:assert/strict";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { createCanonicalUnarmedAttack } from "../src/utils/combat/unarmedAttackSanitization.js";
import { findEligibleClinchWeapon, resolveGrappleWeaponDisposition, restoreRetainedWeaponAfterGrapple } from "../src/utils/combat/grappleWeaponTransitions.js";
import { validateCombatActor } from "../src/utils/combat/validateCombatActor.js";

const withRuntime = (actorKey) => ({
  ...structuredClone(getCanonicalCombatActorDefinition(actorKey)), id: `live:${actorKey}`, team: "party", side: "party", battleSide: "party", position: { x: 2, y: 2 }, remainingActions: 2,
});

const squire = withRuntime("squire");
const swordDisposition = resolveGrappleWeaponDisposition({ fighter: squire, readyWeapon: squire.weaponProfiles[0], position: squire.position, initiativeTurnId: "turn:squire", actionToken: "turn:squire:1" });
assert.equal(swordDisposition.disposition, "retained-unusable-in-clinch");
assert.equal(swordDisposition.retainedWeaponId, "weapon.arming-sword");
const restoredSword = restoreRetainedWeaponAfterGrapple({ ...squire, combatWeaponState: swordDisposition.combatWeaponState });
assert.equal(restoredSword.combatWeaponState.readyWeaponId, "weapon.arming-sword");

for (const actorKey of ["spearman", "orc"]) {
  const actor = withRuntime(actorKey);
  const disposition = resolveGrappleWeaponDisposition({ fighter: actor, readyWeapon: actor.weaponProfiles[0], position: actor.position, initiativeTurnId: `turn:${actorKey}`, actionToken: `turn:${actorKey}:1` });
  assert.equal(disposition.disposition, "dropped-two-handed");
  assert.ok(disposition.droppedItemRecord);
  const afterCleanup = restoreRetainedWeaponAfterGrapple({ ...actor, combatWeaponState: disposition.combatWeaponState });
  assert.equal(afterCleanup.combatWeaponState.readyWeaponId, null, "dropped weapon is not silently restored");
  assert.equal(afterCleanup.combatWeaponState.droppedWeaponIds.includes(actor.weaponProfiles[0].profileKey), true);
  assert.equal(findEligibleClinchWeapon({ ...actor, combatWeaponState: disposition.combatWeaponState }), null, "no sidearm is invented");
}

const veteran = withRuntime("veteran-knight");
assert.equal(findEligibleClinchWeapon(veteran)?.profileKey, "weapon.dagger", "explicit inventory dagger is available");
for (const actorKey of ["squire", "man-at-arms", "spearman", "brigand", "bandit", "guard", "orc", "cultist"]) {
  assert.equal(findEligibleClinchWeapon(withRuntime(actorKey)), null, `${actorKey} receives no synthetic sidearm`);
}

const unarmed = createCanonicalUnarmedAttack({ ...squire.weaponProfiles[0], armoredActionPlan: { actionType: "sword-cut" } }, squire);
assert.equal(unarmed.damage, "1d3");
assert.equal(unarmed.damageType, "blunt");
assert.equal(unarmed.naturalWeapon, true);
assert.equal(unarmed.manufacturedWeapon, false);
assert.equal(unarmed.handsRequired, 0);
assert.equal(unarmed.handedness, "unarmed");
assert.deepEqual(unarmed.armorTechniqueCompatibility, []);
assert.equal(unarmed.sourceWeaponSnapshot, null);
assert.equal(unarmed.armoredActionPlan, null);

const shieldContradiction = withRuntime("spearman");
shieldContradiction.equippedShield = { id: "shield.invalid", profileKey: "shield.invalid", name: "Invalid Shield", type: "shield", active: true };
shieldContradiction.heldItems.offHand = "shield.invalid";
const shieldValidation = validateCombatActor(shieldContradiction, { normalize: false });
assert.ok(shieldValidation.errors.some((error) => error.code === "two-handed-weapon-with-active-shield"));

const sidearmContradiction = withRuntime("guard");
sidearmContradiction.heldItems.sidearm = "weapon.synthetic-dagger";
const sidearmValidation = validateCombatActor(sidearmContradiction, { normalize: false });
assert.ok(sidearmValidation.errors.some((error) => error.code === "sidearm-without-inventory-source"));

const missingLoadoutItem = withRuntime("squire");
missingLoadoutItem.loadouts.default.weaponProfileKeys.push("weapon.absent");
const loadoutValidation = validateCombatActor(missingLoadoutItem, { normalize: false });
assert.ok(loadoutValidation.errors.some((error) => error.code === "loadout-reference-missing-item"));

for (const actorKey of ["squire", "man-at-arms", "spearman", "brigand", "bandit", "guard", "veteran-knight", "orc", "cultist"]) {
  const actor = withRuntime(actorKey);
  assert.equal(actor.equippedArmor.profileKey, actor.armorProfile.profileKey);
  assert.equal(actor.equippedArmor.guardRating, actor.derivedStats.armorClass);
}

console.log("Phase 3C1A grapple, loadout, armor, and weapon validation tests passed");

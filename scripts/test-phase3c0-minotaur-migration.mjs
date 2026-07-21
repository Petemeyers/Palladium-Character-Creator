import assert from "node:assert/strict";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { resolveGrappleWeaponDisposition } from "../src/utils/combat/grappleWeaponTransitions.js";
import { assessGrappleSizeOutcome } from "../src/utils/sizeStrengthModifiers.js";

const canonical = getCanonicalCombatActorDefinition("minotaur");
const adapted = adaptSelectableActorToCombatant(getSelectableActorById("minotaur"));
assert.equal(adapted.ok, true);
const minotaur = { ...adapted.combatant, id: "minotaur-live" };
assert.equal(minotaur.species, "minotaur");
assert.equal(minotaur.creatureType, "monstrosity");
assert.equal(minotaur.size, "large");
assert.equal(minotaur.movement.ground, 40);
assert.equal(minotaur.derivedStats.hp, 52);
assert.equal(minotaur.grappleProfile.sizeProfile, "large");
const axe = minotaur.weaponProfiles.find((weapon) => weapon.profileKey === "weapon.minotaur-heavy-axe");
assert.equal(axe.handedness, "two-handed");
assert.equal(axe.handsRequired, 2);
assert.equal(axe.damage, "2d8+4");
const disposition = resolveGrappleWeaponDisposition({ fighter: minotaur, readyWeapon: axe, position: { x: 5, y: 5 }, actionToken: "minotaur:1" });
assert.equal(disposition.disposition, "dropped-two-handed");
assert.equal(disposition.droppedWeaponId, axe.profileKey);
const naturalAttacks = minotaur.attacks.filter((attack) => attack.isNaturalAttack);
assert.ok(naturalAttacks.length >= 3);
for (const attack of naturalAttacks) {
  assert.equal(attack.manufacturedWeapon, false);
  assert.equal(attack.sourceWeaponId, undefined);
  assert.notEqual(attack.profileKey, axe.profileKey);
}
const smaller = { ...getCanonicalCombatActorDefinition("goblin-warrior"), size: "small" };
assert.equal(assessGrappleSizeOutcome(smaller, minotaur).outcome, "blocked");
assert.equal(assessGrappleSizeOutcome(minotaur, smaller).outcome, "normal");
console.log("Phase 3C0 Minotaur migration passed");

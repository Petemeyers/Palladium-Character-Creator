import assert from "node:assert/strict";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { humanFighters } from "../src/data/humanFighters.js";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { createCanonicalUnarmedAttack } from "../src/utils/combat/unarmedAttackSanitization.js";
import {
  findEligibleClinchWeapon,
  getPhase3B2GrappleActions,
  resolveGrappleWeaponDisposition,
  restoreRetainedWeaponAfterGrapple,
} from "../src/utils/combat/grappleWeaponTransitions.js";

const canonical = getCanonicalCombatActorDefinition("knight");
const selectable = getSelectableActorById("knight");
const human = humanFighters.find((actor) => actor.id === "knight");
const adapted = adaptSelectableActorToCombatant(selectable, { team: "party", controlMode: "ai" });
assert.equal(adapted.ok, true);
for (const actor of [canonical, selectable, human, adapted.combatant]) {
  assert.equal(actor.combatActorSchemaVersion, 1);
  assert.equal(actor.species, "human");
  assert.equal(actor.creatureType, "humanoid");
  assert.equal(actor.size, "medium");
  assert.equal(actor.derivedStats.hp, 24);
  assert.equal(actor.derivedStats.armorClass, 16);
  assert.equal(actor.movement.ground, 25);
}
assert.deepEqual(selectable.weaponProfiles, canonical.weaponProfiles);
assert.deepEqual(human.weaponProfiles, canonical.weaponProfiles);
assert.deepEqual(adapted.combatant.weaponProfiles, canonical.weaponProfiles);

const sword = canonical.weaponProfiles.find((weapon) => weapon.profileKey === "weapon.long-sword");
const disposition = resolveGrappleWeaponDisposition({
  fighter: { ...adapted.combatant, id: "knight-live" }, readyWeapon: sword,
  position: { x: 2, y: 3 }, initiativeTurnId: "round:1:knight", actionToken: "round:1:knight:1",
});
assert.equal(disposition.disposition, "retained-unusable-in-clinch");
assert.equal(disposition.retainedWeaponId, sword.profileKey);
const restored = restoreRetainedWeaponAfterGrapple({ ...adapted.combatant, combatWeaponState: disposition.combatWeaponState });
assert.equal(restored.combatWeaponState.readyWeaponId, sword.profileKey);
assert.equal(restored.attacks[0].profileKey, sword.profileKey);

const dagger = findEligibleClinchWeapon(adapted.combatant);
assert.equal(dagger.profileKey, "weapon.dagger");
const actor = {
  ...adapted.combatant, id: "knight-live", remainingActions: 1,
  grappleState: { state: "grapple_ground", positionState: "ground", opponent: "minotaur-live", groundControl: { state: "dominant", controllerId: "knight-live", controlledId: "minotaur-live" } },
  combatWeaponState: { ...disposition.combatWeaponState, readyWeaponId: dagger.profileKey, clinchWeaponId: dagger.profileKey, clinchWeaponReady: true },
};
const opponent = { id: "minotaur-live", grappleState: { state: "grapple_ground", positionState: "ground", opponent: actor.id, groundControl: actor.grappleState.groundControl } };
assert.ok(getPhase3B2GrappleActions(actor, opponent).includes("groundedArmorGapStrike"));

const unarmed = createCanonicalUnarmedAttack({ ...sword, armoredActionPlan: { actionType: "longsword-thrust" } }, actor);
assert.equal(unarmed.damage, "1d3");
assert.equal(unarmed.sourceWeaponSnapshot, null);
assert.equal(unarmed.armoredActionPlan, null);
assert.equal(unarmed.sourceWeaponName, "Unarmed Attack");
console.log("Phase 3C0 Knight migration passed");

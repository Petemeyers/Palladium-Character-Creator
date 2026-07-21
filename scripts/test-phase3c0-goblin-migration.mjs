import assert from "node:assert/strict";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { PUBLIC_ENEMIES } from "../src/data/publicEnemies.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { adaptPublicEnemyToCombatant } from "../src/utils/publicEnemyCombatAdapter.js";

const canonical = getCanonicalCombatActorDefinition("goblin-warrior");
const selectable = getSelectableActorById("goblin-warrior");
const publicEnemy = PUBLIC_ENEMIES.find((actor) => actor.id === "goblin-warrior");
const selectableResult = adaptSelectableActorToCombatant(selectable);
const publicResult = adaptPublicEnemyToCombatant(publicEnemy);
assert.equal(selectableResult.ok, true);
assert.equal(publicResult.ok, true);
for (const actor of [canonical, selectable, publicEnemy, selectableResult.combatant, publicResult.combatant]) {
  assert.equal(actor.species, "goblin");
  assert.notEqual(actor.species, "human");
  assert.equal(String(actor.creatureType).toLowerCase(), "humanoid");
  assert.equal(String(actor.size).toLowerCase(), "small");
  assert.equal(actor.grappleProfile.sizeProfile, "small");
  assert.equal(actor.grappleProfile.standingArmoredSoloPreference, "disfavored");
  assert.equal(actor.grappleProfile.prefersAssist, true);
  assert.equal(actor.grappleProfile.canUseSwarmTakedown, true);
}
assert.deepEqual(selectableResult.combatant.weaponProfiles, canonical.weaponProfiles);
assert.deepEqual(publicResult.combatant.weaponProfiles, canonical.weaponProfiles);
assert.equal(canonical.weaponProfiles[0].profileKey, "weapon.short-sword");
assert.equal(canonical.weaponProfiles[0].damage, "1d6+2");
console.log("Phase 3C0 Goblin migration passed");

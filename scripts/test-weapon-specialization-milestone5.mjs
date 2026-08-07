import assert from "node:assert/strict";
import {
  getSpecializedWeaponActionOptions,
  resolveSpecializedWeaponEffectOnHit,
  SPECIALIZED_WEAPON_ACTIONS,
} from "../src/utils/combat/weaponSpecializationAuthority.js";

const swordOpponent = { id: "sword", name: "Swordsman", equippedShield: { name: "Heater Shield" }, statusEffects: [] };
const axeOptions = getSpecializedWeaponActionOptions({
  actor: { id: "axe", fatigueState: { currentStamina: 20 } },
  weapon: { id: "weapon.battle-axe", name: "Battle Axe", reachFeet: 5 },
  opponent: swordOpponent,
  opponentWeapon: { id: "weapon.arming-sword", name: "Arming Sword", reachFeet: 5 },
  distanceFt: 5,
});
assert.ok(axeOptions.some((option) => option.id === SPECIALIZED_WEAPON_ACTIONS.AXE_HOOK_GUARD));

const maceOptions = getSpecializedWeaponActionOptions({
  actor: { id: "mace", fatigueState: { currentStamina: 20 } },
  weapon: { id: "weapon.mace", name: "Mace", reachFeet: 5 },
  opponent: { ...swordOpponent, armorRating: 3 },
  opponentWeapon: { id: "weapon.arming-sword", name: "Arming Sword", reachFeet: 5 },
  distanceFt: 5,
});
assert.ok(maceOptions.some((option) => option.id === SPECIALIZED_WEAPON_ACTIONS.MACE_CRUSH_ARMOR));
assert.ok(maceOptions.some((option) => option.id === SPECIALIZED_WEAPON_ACTIONS.MACE_BREAK_GUARD));

const daggerOptions = getSpecializedWeaponActionOptions({
  actor: { id: "dagger", fatigueState: { currentStamina: 20 }, grappleState: { state: "clinch", opponent: "sword" } },
  weapon: { id: "weapon.dagger", name: "Dagger", reachFeet: 3 },
  opponent: swordOpponent,
  opponentWeapon: { id: "weapon.arming-sword", name: "Arming Sword", reachFeet: 5 },
  distanceFt: 5,
});
assert.ok(daggerOptions.some((option) => option.id === SPECIALIZED_WEAPON_ACTIONS.DAGGER_CLOSE_THRUST));
assert.ok(daggerOptions.some((option) => option.id === SPECIALIZED_WEAPON_ACTIONS.DAGGER_GRAPPLE_POINT));

const effect = resolveSpecializedWeaponEffectOnHit({
  actionId: SPECIALIZED_WEAPON_ACTIONS.MACE_BREAK_GUARD,
  attacker: { id: "mace" },
  defender: { id: "sword", statusEffects: [] },
  currentRound: 3,
});
assert.equal(effect.applied, true);
assert.equal(effect.defenderPatch.statusEffects[0].type, "guard-disrupted");
console.log("weapon specialization milestone 5 test passed");

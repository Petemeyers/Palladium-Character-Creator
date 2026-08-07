import assert from "node:assert/strict";
import { getCombatStatusBadges } from "../src/utils/combat/combatStatusBadgeAuthority.js";
import { createWeaponCondition, WEAPON_CONDITION_TYPES } from "../src/utils/combat/weaponConditionAuthority.js";

const actor = {
  equippedShield: { name: "Heater Shield", currentDurability: 4, maxDurability: 18 },
  statusEffects: [
    createWeaponCondition({ type: WEAPON_CONDITION_TYPES.OFF_BALANCE, currentRound: 2 }),
    createWeaponCondition({ type: WEAPON_CONDITION_TYPES.FORMATION_DISRUPTED, currentRound: 2 }),
  ],
};
const badges = getCombatStatusBadges({
  actor,
  currentRound: 2,
  formationState: { state: "ordered-line", supportBonus: 2 },
  weaponBindState: { active: true, role: "controlled" },
  maxBadges: 6,
});
const keys = new Set(badges.map((badge) => badge.key));
assert.ok(keys.has("off-balance"));
assert.ok(keys.has("formation-disrupted"));
assert.ok(keys.has("weapon-bound"));
assert.ok(keys.has("shield-battered"));
assert.ok(!keys.has("ordered-line"), "disrupted formation must not also show ordered-line");
console.log("combat status badge authority test passed");

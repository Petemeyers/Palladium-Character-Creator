import assert from "node:assert/strict";
import {
  applyShieldImpactToActor,
  getShieldIntegrity,
  resolveShieldImpact,
  SHIELD_INTEGRITY_STATES,
} from "../src/utils/combat/shieldIntegrityAuthority.js";

const defender = {
  id: "shieldman",
  defenseRating: 13,
  guardRating: 13,
  armorClass: 13,
  ac: 13,
  equippedShield: { id: "shield.heater", name: "Heater Shield" },
  equipped: { shield: { id: "shield.heater", name: "Heater Shield" } },
  equipmentSelection: { shield: "Heater Shield" },
};
const axe = { id: "weapon.battle-axe", name: "Battle Axe", reachFeet: 5, handsRequired: 1 };
const dagger = { id: "weapon.dagger", name: "Dagger", reachFeet: 3, handsRequired: 1 };
const initial = getShieldIntegrity(defender);
assert.equal(initial.maxDurability, 18);
assert.equal(initial.state, SHIELD_INTEGRITY_STATES.PRISTINE);

const impact = resolveShieldImpact({ defender, attackWeapon: axe, attackNaturalRoll: 12, attackTotal: 17, defenseTotal: 17 });
assert.equal(impact.applied, true);
assert.equal(impact.damage, 3);
let updated = applyShieldImpactToActor(defender, impact);
assert.equal(getShieldIntegrity(updated).currentDurability, 15);

const daggerImpact = resolveShieldImpact({ defender: updated, attackWeapon: dagger, attackNaturalRoll: 10, attackTotal: 14, defenseTotal: 14 });
assert.equal(daggerImpact.applied, false);
assert.equal(daggerImpact.damage, 0);

while (getShieldIntegrity(updated)?.currentDurability > 0) {
  const heavy = resolveShieldImpact({ defender: updated, attackWeapon: axe, attackNaturalRoll: 20, attackTotal: 24, defenseTotal: 15 });
  updated = applyShieldImpactToActor(updated, heavy);
}
assert.equal(updated.shieldBroken, true);
assert.equal(updated.equippedShield, null);
assert.equal(updated.equipmentSelection.shield, "None");
assert.equal(updated.defenseRating, 12);
console.log("shield integrity authority test passed");

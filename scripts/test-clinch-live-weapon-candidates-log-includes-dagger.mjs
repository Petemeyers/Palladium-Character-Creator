import assert from "node:assert/strict";
import { getCombatWeaponAvailability, formatCombatWeaponAvailability } from "../src/utils/combatWeaponAvailability.js";

const actor = {
  name: "Knight",
  equistaminadWeapons: [{ name: "Long Sword", lengthFt: 3 }],
  inventory: [{ name: "Dagger", type: "weapon", lengthFt: 1 }],
};
const availability = getCombatWeaponAvailability(actor);
const log = formatCombatWeaponAvailability(actor);

assert.deepEqual(availability.equipped, ["Long Sword"]);
assert.deepEqual(availability.inventory, ["Dagger"]);
assert.deepEqual(availability.clinch, ["Dagger", "Unarmed Attack"]);
assert.match(log, /equipped=Long Sword inventory=Dagger clinch=Dagger, Unarmed Attack/);

console.log("Live clinch weapon diagnostic tests passed");

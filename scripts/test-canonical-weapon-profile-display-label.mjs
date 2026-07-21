import assert from "node:assert/strict";
import { getCombatDisplayLabel } from "../src/utils/presentation/getCombatDisplayLabel.js";

const weapon = { id: "weapon.long-sword", weaponId: "weapon.long-sword", profileKey: "weapon.long-sword", name: "Long Sword", damage: "1d8" };
assert.equal(getCombatDisplayLabel(weapon), "Long Sword");
assert.equal(getCombatDisplayLabel({ profileKey: "natural.minotaur-gore" }), "natural.minotaur-gore");
assert.equal(getCombatDisplayLabel([weapon, { name: "Dagger" }]), "Long Sword, Dagger");
assert.equal(getCombatDisplayLabel(null, "Unarmed"), "Unarmed");
assert.notEqual(getCombatDisplayLabel(weapon), "[object Object]");
console.log("Canonical weapon profiles resolve to stable display labels");

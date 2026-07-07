import assert from "node:assert/strict";
import { getWeaponByName } from "../src/data/weapons.js";
import { getWeaponLength, getWeaponType } from "../src/utils/combatEnvironmentLogic.js";

assert.equal(getWeaponType({ name: "Long Sword" }), "MEDIUM");
assert.equal(getWeaponType(getWeaponByName("Long Sword")), "MEDIUM");
assert.ok(getWeaponLength({ name: "Long Sword" }) >= 3);
assert.ok(getWeaponLength(getWeaponByName("Long Sword")) >= 3);
console.log("Long Sword ordinary-melee metadata tests passed");

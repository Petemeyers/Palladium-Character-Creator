import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const equipment = fs.readFileSync(new URL("../src/utils/combat/equipmentAuthority.js", import.meta.url), "utf8");

assert.match(page, /normalizeCanonicalCombatWeapon/);
assert.match(page, /resolvePolearmCombatMatchup/);
assert.match(page, /weaponMatchupBonus/);
assert.match(page, /eventType: "polearm-matchup-resolved"/);
assert.match(page, /vs Defense \$\{targetGuardRating\}/);
assert.doesNotMatch(page, /Defense &amp; Armor: \{sheetDisplay\.armor\.name\}/);
assert.match(page, /getWeaponRange: getCanonicalCombatWeaponRange/);
assert.match(equipment, /Math\.max\(10, explicitReachFeet\)/);
assert.match(equipment, /guardRating: armorProfile\.defenseRating/);
assert.match(equipment, /armorClass: armorProfile\.defenseRating/);
assert.match(equipment, /calculateCanonicalDefenseRating/);

console.log("defense and spear source contract passed");

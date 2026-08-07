import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const authority = fs.readFileSync(new URL("../src/utils/combat/equipmentAuthority.js", import.meta.url), "utf8");

assert.match(source, /eventType: "explicit-weapon-replacement-audit"/);
assert.match(source, /const selectableWeaponOptions = weapons;/);
assert.match(source, /Active attacks rebuilt from equipped weapons/);
assert.match(source, /enforceExplicitEquipmentAuthority\(\s*normalizeCombatantForBattle/);
assert.match(source, /fighter\.equippedWeapons/);
assert.match(source, /combatRosterSnapshotRef\.current = combatRosterSnapshotRef\.current\.map/);
assert.doesNotMatch(source, /originalWeapon = fighter\.inventory/);
assert.match(authority, /loadoutKey: "explicit-equipment-selection"/);
assert.match(authority, /equistaminadWeapon: resolvedRight\?\.name/);
assert.match(authority, /reapplyExplicitEquipmentSelection/);

console.log("weapon replacement source contract passed");

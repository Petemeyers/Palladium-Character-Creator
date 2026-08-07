import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const formation = fs.readFileSync(new URL("../src/utils/combat/formationCommandAuthority.js", import.meta.url), "utf8");
const terrain = fs.readFileSync(new URL("../src/utils/combat/terrainFormationAuthority.js", import.meta.url), "utf8");
const bind = fs.readFileSync(new URL("../src/utils/combat/weaponBindCounterplayAuthority.js", import.meta.url), "utf8");
const aftermath = fs.readFileSync(new URL("../src/utils/aftermath/shieldAftermathAuthority.js", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../src/components/aftermath/AftermathDashboard.jsx", import.meta.url), "utf8");

for (const token of [
  "Formation Command",
  "formation-command-resolved",
  "automated-formation-command-resolved",
  "weapon-bind-counterplay-choice-offered",
  "weapon-bind-counterplay-resolved",
  "getFormationTerrainAt",
  "applyAftermathLootAction",
]) assert.ok(combatPage.includes(token), `CombatPage missing ${token}`);

for (const token of ["reform-line", "rally-formation", "close-ranks", "anchor-position", "withdraw-in-order"]) {
  assert.ok(formation.includes(token), `formation authority missing ${token}`);
}
for (const token of ["forest", "rubble", "rearPressure", "elevatedAgainstLower"]) assert.ok(terrain.includes(token));
for (const token of ["break-bind", "reverse-bind", "strike-from-bind", "grapple-from-bind", "yield-and-withdraw", "release-weapon"]) assert.ok(bind.includes(token));
for (const token of ["field-repair-shield", "workshop-repair-shield", "salvage-shield"]) assert.ok(aftermath.includes(token));
assert.ok(dashboard.includes("getShieldAftermathOptions"));
assert.ok(dashboard.includes("repairMaterials") || dashboard.includes("currentDurability"));
console.log("milestone 7 source contract passed");

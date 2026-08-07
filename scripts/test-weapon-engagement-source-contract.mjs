import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const authority = fs.readFileSync(new URL("../src/utils/combat/weaponEngagementAuthority.js", import.meta.url), "utf8");

assert.match(combatPage, /weaponEngagementAuthority\.js/);
assert.match(combatPage, /weapon-entry-(?:contest|exchange)-resolved/);
assert.match(combatPage, /weapon-measure-movement-clamped/);
assert.match(combatPage, /weapon-engagement-measure-resolved/);
assert.match(combatPage, /engagementMeasure:\s*engagementMeasureBonus/);
assert.match(combatPage, /calculateHybridWeaponAttackStaminaCost/);
assert.match(combatPage, /passive-round-stamina-recovery/);
assert.match(authority, /long-weapon-measure/);
assert.match(authority, /entry-contested/);
assert.match(authority, /inside-the-point/);
assert.match(authority, /manufactured-basic/);
assert.doesNotMatch(authority, /weapon\?\.staminaCost\s*\?\?/);

console.log("weapon engagement source contract passed");

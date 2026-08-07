import assert from "node:assert/strict";
import fs from "node:fs";

const combat = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const map = fs.readFileSync(new URL("../src/components/TacticalMap.jsx", import.meta.url), "utf8");
const arena3d = fs.readFileSync(new URL("../src/components/HexArena3D.jsx", import.meta.url), "utf8");
const formation = fs.readFileSync(new URL("../src/utils/combat/formationCohesionAuthority.js", import.meta.url), "utf8");
const shield = fs.readFileSync(new URL("../src/utils/combat/shieldIntegrityAuthority.js", import.meta.url), "utf8");
const bind = fs.readFileSync(new URL("../src/utils/combat/weaponBindAuthority.js", import.meta.url), "utf8");

for (const token of [
  "resolveSpatialFormationSupport",
  "formationCohesionPresentation",
  "resolveShieldImpact",
  "weaponBindRegistryRef",
  "persistent-weapon-bind-modifier-applied",
  "weaponBindThreatLines",
  "showConditionBadges",
]) assert.ok(combat.includes(token), `CombatPage missing ${token}`);
for (const token of [
  "formation-cohesion-links",
  "combat-condition-badges",
  "shield-break",
  "formation-disruption",
]) assert.ok(map.includes(token), `TacticalMap missing ${token}`);
for (const token of ["weaponAnimationCues", "playWeaponInteractionAnimation", "syncWeaponAnimationCues"]) {
  assert.ok(arena3d.includes(token), `HexArena3D missing ${token}`);
}
assert.ok(formation.includes("supporter-not-adjacent"));
assert.ok(formation.includes("ordered-line"));
assert.ok(shield.includes("SHIELD_INTEGRITY_STATES"));
assert.ok(bind.includes("attacking-away-from-active-bind"));
console.log("milestone 6 source contract passed");

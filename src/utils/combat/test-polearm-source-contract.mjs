import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const traits = fs.readFileSync(new URL("../src/utils/combat/canonicalWeaponTraits.js", import.meta.url), "utf8");
const authority = fs.readFileSync(new URL("../src/utils/combat/polearmCombatAuthority.js", import.meta.url), "utf8");

for (const required of [
  "resolvePolearmCombatMatchup",
  "selectAutomatedPolearmAction",
  "applyPolearmSpecialActionOnHit",
  "polearm-matchup-resolved",
  "polearm-special-action-selected",
  "weapon-matchup-advantage",
]) {
  assert.ok(combatPage.includes(required), `CombatPage must integrate ${required}`);
}
for (const required of [
  "isCanonicalPike",
  "isCanonicalHalberd",
  "isCanonicalGreatsword",
  "isCanonicalOneHandedSpear",
  "getCanonicalWeaponTraitProfile",
  "shaftIntegrity",
]) {
  assert.ok(traits.includes(required), `canonical weapon traits must include ${required}`);
}
for (const required of [
  'ratio: "9:3"',
  'ratio: "4:2"',
  'ratio: "7:6"',
  '"shaft-cut"',
  '"polearm-beat-entry"',
  '"half-sword-thrust"',
  '"halberd-hook"',
  '"set-pike"',
]) {
  assert.ok(authority.includes(required), `polearm authority must include ${required}`);
}

console.log("polearm source contract regression: passed");

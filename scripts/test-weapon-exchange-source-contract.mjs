import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const combatPage = await readFile(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const authority = await readFile(new URL("../src/utils/combat/weaponExchangeAuthority.js", import.meta.url), "utf8");
const engagement = await readFile(new URL("../src/utils/combat/weaponEngagementAuthority.js", import.meta.url), "utf8");

for (const token of [
  "weaponExchangeAuthority.js",
  "weapon-entry-choice-offered",
  "weapon-entry-exchange-resolved",
  "weapon-control-response-executed",
  "multi-opponent-weapon-measure-resolved",
  "long-weapon-close-choice-offered",
  "long-weapon-close-action-resolved",
  "Cross the Weapon Point",
  "Long Weapon at Close Measure",
  "manual-long-weapon-close-choice",
  "withdraw-to-measure",
  "draw-sidearm",
  "LONG_WEAPON_CLOSE_ACTIONS.SHORTEN_GRIP",
]) {
  assert.ok(combatPage.includes(token), `CombatPage missing ${token}`);
}

for (const token of [
  "WEAPON_ENTRY_TECHNIQUES",
  "LONG_WEAPON_CONTROL_RESPONSES",
  "LONG_WEAPON_CLOSE_ACTIONS",
  "resolveWeaponEntryExchange",
  "buildLongWeaponReactionAttack",
  "resolveMultiOpponentMeasurePressure",
  "findSidearmCandidate",
  "simulateWeaponEntryExchanges",
]) {
  assert.ok(authority.includes(token), `weapon exchange authority missing ${token}`);
}

assert.ok(engagement.includes("long-weapon-shortened-grip-inside-point"));
assert.ok(combatPage.includes('reactionType: "weapon-measure-control"'));
assert.ok(!combatPage.includes('source: "milestone-3-opportunity-attack"'));

console.log("weapon exchange source contract passed");

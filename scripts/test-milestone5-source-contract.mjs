import assert from "node:assert/strict";
import fs from "node:fs";

const combat = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const map = fs.readFileSync(new URL("../src/components/TacticalMap.jsx", import.meta.url), "utf8");
const specialization = fs.readFileSync(new URL("../src/utils/combat/weaponSpecializationAuthority.js", import.meta.url), "utf8");
const exchange = fs.readFileSync(new URL("../src/utils/combat/weaponExchangeAuthority.js", import.meta.url), "utf8");

for (const token of [
  "weaponOverlaySettings",
  "weaponInteractionAnimations",
  "weapon-condition-defense-applied",
  "pruneExpiredWeaponConditions",
  "emitWeaponInteractionAnimation",
]) assert.ok(combat.includes(token), `CombatPage missing ${token}`);
for (const token of [
  "weapon-interaction-animations",
  "showMeasureRings",
  "showThreatLines",
  "showInteractionAnimations",
]) assert.ok(map.includes(token), `TacticalMap missing ${token}`);
for (const token of [
  "axe-hook-guard",
  "mace-crush-armor",
  "dagger-close-thrust",
  "shield-bind-and-strike",
]) assert.ok(specialization.includes(token), `specialization missing ${token}`);
assert.ok(exchange.includes("getActiveWeaponConditionPenalties"));
assert.ok(exchange.includes("getWeaponEntryBalanceAdjustment"));
console.log("milestone 5 source contract passed");

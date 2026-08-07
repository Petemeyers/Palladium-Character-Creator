import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const tacticalMap = fs.readFileSync(new URL("../src/components/TacticalMap.jsx", import.meta.url), "utf8");
const exchange = fs.readFileSync(new URL("../src/utils/combat/weaponExchangeAuthority.js", import.meta.url), "utf8");

for (const token of [
  "weaponSpecializationAuthority.js",
  "pendingSpecializedWeaponChoice",
  "specialized-weapon-choice-offered",
  "specialized-weapon-modifier-resolved",
  "weaponMeasureOverlays={weaponMeasurePresentation.overlays}",
  "weaponThreatLines={[...weaponMeasurePresentation.threatLines, ...weaponBindThreatLines]}",
  "formatWeaponEntryExchangeNarration",
  "weaponControlStateRegistryRef",
]) {
  assert.ok(combatPage.includes(token), `CombatPage must include ${token}`);
}

for (const token of [
  "weaponMeasureOverlays",
  "weaponThreatLines",
  "weapon-measure-overlays",
  "weapon-threat-lines",
]) {
  assert.ok(tacticalMap.includes(token), `TacticalMap must include ${token}`);
}

assert.ok(exchange.includes('HALF_SWORD_ENTRY: "half-sword-entry"'));
assert.ok(exchange.includes('label: "Half-Sword Entry"'));
assert.equal(combatPage.includes("data/bestiary.json"), false);

console.log("weapon specialization source contract passed");

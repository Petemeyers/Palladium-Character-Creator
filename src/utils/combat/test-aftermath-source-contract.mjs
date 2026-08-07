import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../src/components/aftermath/AftermathDashboard.jsx", import.meta.url), "utf8");

for (const required of [
  "createAftermathEncounter",
  "saveAftermathCampaign",
  "postCombatPositionSnapshotRef.current",
  "<Tab>Aftermath</Tab>",
  "<Tab>Prisoners</Tab>",
  "<Tab>Loot</Tab>",
  "<Tab>Infirmary</Tab>",
  "handleAftermathAction",
  "handleAdvanceAftermathDay",
]) {
  assert.ok(combatPage.includes(required), `CombatPage missing aftermath source contract: ${required}`);
}

for (const required of [
  "Stop Bleeding",
  "Splint",
  "Carry to Infirmary",
  "Bind Prisoner",
  "Confiscate Equipment",
  "Coup de Grâce",
  "Advance Recovery Day",
]) {
  assert.ok(dashboard.includes(required), `AftermathDashboard missing action: ${required}`);
}

console.log("aftermath source contract regression: passed");

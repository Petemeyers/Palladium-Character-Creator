import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const phase0 = read("src/components/Phase0PreCombatModal.jsx");
const selector = read("src/components/maps/SceneBattlefieldMapSelector.jsx");
const combat = read("src/pages/CombatPage.jsx");

const checks = [
  ["Phase0 renders canonical map selector", phase0.includes("<SceneBattlefieldMapSelector")],
  ["Phase0 owns selectedBattlefieldMap", phase0.includes("selectedBattlefieldMap")],
  ["Phase0 emits battlefieldMap", phase0.includes("battlefieldMap,")],
  ["Phase0 preserves exact authored map", phase0.includes("The legacy terrain generator below will not replace it.")],
  ["Selector requires parent acknowledgement", selector.includes('typeof onMapChange !== "function"')],
  ["Selector marks Test Battle applied", selector.includes("markBattlefieldTestBattleApplied(request)")],
  ["Combat auto-opens battlefield Test Battle Scene Setup", combat.includes('params.get("battlefieldTest") === "1"')],
  ["Combat adopts canonical battlefield mapDefinition", combat.includes("setMapDefinition(selectedBattlefieldMap)")],
  ["Combat prevents legacy saved-map override", combat.includes('setSelectedBattleMapId("default")')],
  ["Combat promotes canonical combatTerrain to mapDefinition", combat.includes("setMapDefinition(combatTerrain)")],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exit(1);
console.log("PASS Map Maker -> Scene Setup -> Combat battlefield handoff source contract");

import assert from "node:assert/strict";
import fs from "node:fs";

const combat = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const tacticalMap = fs.readFileSync(new URL("../src/components/TacticalMap.jsx", import.meta.url), "utf8");

for (const expected of [
  "arenaRoster.js",
  "selectableActors.js",
  "initiativeActionTiming.js",
  "postCombatPositionAuthority.js",
  "movementLogAuthority.js",
  "aftermathAuthority.js",
  "equipmentAuthority.js",
  "canonicalWeaponTraits.js",
  "polearmCombatAuthority.js",
  "damageMoraleAuthority.js",
]) {
  assert.match(combat, new RegExp(expected.replaceAll(".", "\\.")), `missing ${expected}`);
}

assert.doesNotMatch(combat, /data\/bestiary\.json/);
assert.doesNotMatch(combat, /pulseEvent\.eventType\.includes\(/);
assert.doesNotMatch(combat, /pulseEvent\.eventType\.startsWith\(/);
assert.match(combat, /const eventType = typeof safePulseEvent\.eventType/);
assert.match(combat, /createInitiativeTurnSlotKey\(\{/);
assert.match(combat, /applyEquipmentSelection/);
assert.match(combat, /evaluateDamageMoraleTrigger/);
assert.match(combat, /createAftermathEncounter/);
assert.match(combat, /snapshotBattlefieldPositions/);
assert.match(tacticalMap, /data-morale-shock-dash="center"/);

const importedLocalNames = [];
const importPattern = /import\s+([\s\S]*?)\s+from\s+["'][^"']+["'];/g;
for (const match of combat.matchAll(importPattern)) {
  const clause = match[1].trim();
  if (clause.startsWith("{")) {
    for (const part of clause.slice(1, -1).split(",")) {
      const item = part.trim();
      if (item) importedLocalNames.push(item.split(" as ").at(-1).trim());
    }
  } else if (clause.startsWith("* as ")) {
    importedLocalNames.push(clause.slice(5).trim());
  } else {
    importedLocalNames.push(clause.split(",")[0].trim());
  }
}
const duplicateImports = importedLocalNames.filter((name, index) => importedLocalNames.indexOf(name) !== index);
assert.deepEqual([...new Set(duplicateImports)], [], `duplicate imports: ${duplicateImports.join(", ")}`);

console.log("authoritative baseline source contract passed");

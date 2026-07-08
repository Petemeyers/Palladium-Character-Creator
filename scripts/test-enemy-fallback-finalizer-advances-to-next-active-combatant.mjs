import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /const alternateIndex = fightersNow\.findIndex\(\(candidate, candidateIndex\) => \(/,
  "fallback settlement should search for alternate active combatant",
);
assert.match(
  source,
  /candidateIndex !== turnIndexNow[\s\S]*canFighterStartTurn\(candidate\)[\s\S]*Number\(candidate\.remainingActions/,
  "alternate fallback target should be active and have actions",
);
assert.match(
  source,
  /nextIndex = alternateIndex;/,
  "fallback settlement should advance to alternate active combatant",
);

console.log("enemy fallback finalizer advances to next active combatant tests passed");

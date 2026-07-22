import assert from "node:assert/strict";
import fs from "node:fs";

const initiative = fs.readFileSync(new URL("../src/components/InitiativeTracker.jsx", import.meta.url), "utf8");
const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const oldArena = fs.readFileSync(new URL("../src/utils/HexArena.js", import.meta.url), "utf8");

assert.match(initiative, /getCombatIconAppearance/);
assert.match(initiative, /getInitiativeAppearance/);
assert.match(initiative, /\.allegiance\.baseColor/);
assert.match(initiative, /\.accessibleLabel/);
assert.match(combatPage, /const appearance = getCombatIconAppearance/);
assert.match(combatPage, /appearance\.status\.color/);
assert.match(combatPage, /appearance\.status\.marker/);
assert.match(combatPage, /appearance\.accessibleLabel/);
assert.match(combatPage, /combatIconSurrenderRecordsByFighterId/);
assert.doesNotMatch(oldArena, /getCombatIconAppearance/, "disconnected legacy arena remains visibly separate, not a second canonical authority");

console.log("combat icon roster and initiative integration passed");

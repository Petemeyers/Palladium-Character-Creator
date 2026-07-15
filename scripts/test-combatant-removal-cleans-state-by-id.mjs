import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /function removeFighter\(fighterId\) \{[\s\S]*const stableId = String\(fighterId \|\| ""\)/);
assert.match(source, /Remove \$\{removedFighter\.name \|\| "this fighter"\} from this combat\?/);
assert.match(source, /delete next\[stableId\];[\s\S]*positionsRef\.current = next/);
assert.match(source, /delete committedNext\[stableId\]/);
assert.match(source, /delete lastMoveNext\[stableId\]/);
assert.match(source, /selectionBySide:[\s\S]*filter\(\(id\) => String\(id \|\| ""\) !== stableId\)/);
assert.match(source, /selectedFighterBySide:[\s\S]*String\(id \|\| ""\) === stableId \? null : id/);
assert.match(source, /if \(String\(selectedTarget\?\.id \|\| ""\) === stableId\) setSelectedTarget\(null\)/);
assert.match(source, /if \(String\(selectedMovementFighter \|\| ""\) === stableId\) setSelectedMovementFighter\(null\)/);
assert.match(source, /grappleState: null/);
assert.match(source, /enemyActionLockRef\.current = null/);
assert.match(source, /scheduleEndTurn\(0, "combatant-removed-current-turn"\)/);

console.log("combatant removal stable-id cleanup tests passed");

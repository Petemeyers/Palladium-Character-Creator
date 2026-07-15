import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /const COMBAT_ROUND_SECONDS = 6/);
assert.match(source, /Round 1 · approximately \$\{COMBAT_ROUND_SECONDS\} seconds begins/);
assert.match(source, /Round \{meleeRound\} · approximately \{COMBAT_ROUND_SECONDS\} seconds -/);
assert.match(source, /Round \{meleeRound\} · approximately \{COMBAT_ROUND_SECONDS\} seconds \| Nearest threat/);
assert.doesNotMatch(source, /Combat Round \{meleeRound\} -/);
assert.doesNotMatch(source, /1 action \(15s\)/);

console.log("combat round six-second display tests passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCombatTimingMode } from "../src/utils/combat/tacticalPulseClock.js";

assert.equal(normalizeCombatTimingMode(), "sequential");
assert.equal(normalizeCombatTimingMode(null), "sequential");
const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /useState\(COMBAT_TIMING_MODES\.SEQUENTIAL\)/);
assert.match(source, /combatTimingMode === COMBAT_TIMING_MODES\.TACTICAL_PULSE/);
assert.match(source, /startTurnOnce\(/);
console.log("sequential timing remains default tests passed");

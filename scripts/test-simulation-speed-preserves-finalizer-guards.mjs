import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /isCurrentCombatSession\(scheduledCombatSession/);
assert.match(source, /endTurnScheduleIdRef\.current !== scheduledEndTurnId/);
assert.match(source, /if \(isActionBusy\(\) \|\| turnActionResolvingRef\.current\) return/);
assert.match(source, /getSimulationDelay\(32, simulationSpeed/);
console.log("simulation speed finalizer guard preservation test passed");

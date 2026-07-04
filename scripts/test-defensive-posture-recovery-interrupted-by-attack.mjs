import assert from "node:assert/strict";
import fs from "node:fs";
import { applyCombatPosture, applyDefensiveReserve, clearExpiredPostures, createDefensivePosture, interruptDefensiveRecovery } from "../src/utils/combatPosture.js";

const fighter = { id: "guard", currentStamina: 4, maxStamina: 10 };
const posture = createDefensivePosture({ round: 1, turnIndex: 0 });
const defending = applyDefensiveReserve(applyCombatPosture(fighter, posture), "defend", 1);
const interrupted = interruptDefensiveRecovery(defending);
const resolved = clearExpiredPostures(interrupted, 2, 0);
assert.equal(resolved.currentStamina, 4);
assert.equal(resolved.lastDefensiveRecovery.recovered, 0);
assert.equal(resolved.lastDefensiveRecovery.interrupted, true);
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /interruptDefensiveRecovery\(updated\[defenderIndex\]\)/);
console.log("interrupted defensive posture recovery tests passed");

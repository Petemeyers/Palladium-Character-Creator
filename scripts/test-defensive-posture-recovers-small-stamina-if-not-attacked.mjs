import assert from "node:assert/strict";
import { applyCombatPosture, applyDefensiveReserve, clearExpiredPostures, createDefensivePosture } from "../src/utils/combatPosture.js";

const fighter = { id: "guard", currentStamina: 4, maxStamina: 10 };
const posture = createDefensivePosture({ round: 1, turnIndex: 0 });
const defending = applyDefensiveReserve(applyCombatPosture(fighter, posture), "defend", 1);
const resolved = clearExpiredPostures(defending, 2, 0);
assert.equal(resolved.currentStamina, 5);
assert.equal(resolved.lastDefensiveRecovery.recovered, 1);
assert.equal(resolved.lastDefensiveRecovery.interrupted, false);
console.log("uninterrupted defensive posture recovery tests passed");

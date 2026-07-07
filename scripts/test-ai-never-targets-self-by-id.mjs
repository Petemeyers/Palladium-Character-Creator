import assert from "node:assert/strict";
import fs from "node:fs";
import { canTargetForAction } from "../src/utils/factionDisposition.js";
import { prioritizeEnemyCombatTargets } from "../src/utils/ai/routedTargetPriority.js";

const actor = { id: "knight-2", name: "Knight #2", team: "party", type: "player", currentHP: 10 };
assert.equal(canTargetForAction(actor, { ...actor }, "attack", { sceneType: "combat" }), false);
assert.equal(canTargetForAction(actor, { id: "party-ally", name: "Knight #2", team: "party", type: "player" }, "attack"), false);
assert.equal(canTargetForAction(actor, { id: "enemy-knight", name: "Knight #2", team: "enemy", type: "enemy" }, "attack"), true);
assert.deepEqual(prioritizeEnemyCombatTargets({ attacker: actor, candidates: [{ ...actor }] }), []);

const playerAI = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
const enemyAI = fs.readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");
assert.match(playerAI, /if \(!target \|\| isSameCombatActor\(player, target\)\) return false/);
assert.match(enemyAI, /!isSameCombatActor\(enemy, target\)/);
console.log("AI self-target exclusion tests passed");

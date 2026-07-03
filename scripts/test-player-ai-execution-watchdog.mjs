import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createPlayerAiExecutionOwnership,
  doesPlayerAiExecutionOwnTurn,
  shouldPlayerAiExecutionWatchdogFire,
} from "../src/utils/playerAiExecution.js";

const current = {
  fighterId: "knight-3",
  turnIndex: 2,
  meleeRound: 1,
  turnCounter: 7,
  turnToken: "knight-3-turn",
  playerAiToken: 4,
};
const execution = createPlayerAiExecutionOwnership({
  ...current,
  combatSession: 1,
  generation: 3,
  reason: "ai-toggle-resume",
  startedAt: 1000,
  timeoutMs: 8000,
});
assert.equal(doesPlayerAiExecutionOwnTurn(execution, current), true);
assert.equal(shouldPlayerAiExecutionWatchdogFire(execution, current, 8999), false);
assert.equal(shouldPlayerAiExecutionWatchdogFire(execution, current, 9000), true);
assert.equal(shouldPlayerAiExecutionWatchdogFire(execution, { ...current, turnCounter: 8 }, 9000), false);

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /Promise\.race\(\[/);
assert.match(source, /player AI execution watchdog fired fighter=/);
assert.match(source, /schedulePlayerAIEndTurn\(0, "player-ai-execution-timeout"\)/);
assert.match(source, /stale player AI execution ignored fighter=/);

console.log("player AI execution-watchdog tests passed");

import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
const attackAwait = source.indexOf("const attackOutcome = await attack");
const resolvedLog = source.indexOf("flanking continuation attack resolved attacker=", attackAwait);
const resolvedFinalizer = source.indexOf('scheduleEndTurn(16, "player-ai-flanking-continuation-resolved")', resolvedLog);
const catchStart = source.indexOf("} catch (err) {", resolvedFinalizer);
const successSlice = source.slice(resolvedLog, catchStart);

assert.ok(attackAwait >= 0 && resolvedLog > attackAwait);
assert.ok(resolvedFinalizer > resolvedLog);
assert.doesNotMatch(successSlice, /aborted safely|player-ai-flanking-continuation-abort/,
  "successful continuation uses resolved cleanup/finalization language only");
assert.match(source, /if \(flankingContinuationStarted\) return;/,
  "the continuation has a one-shot launch latch");
const launchSlice = source.slice(
  source.indexOf("let flankingContinuationStarted = false"),
  source.indexOf('return createPlayerAiActionResult("pending-continuation"', attackAwait),
);
assert.doesNotMatch(launchSlice, /setPositions\(\(currentPositions\) =>/,
  "continuation side effects are not launched from a replayable React state updater");

console.log("flanking continuation success-log tests passed");

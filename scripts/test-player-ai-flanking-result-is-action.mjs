import assert from "node:assert/strict";
import fs from "node:fs";

import {
  awaitPlayerAiTurnResult,
  createPlayerAiActionResult,
} from "../src/utils/playerAiTurnResult.js";

let actionScheduled = false;
let fallbackPasses = 0;
let continuationRuns = 0;
let attacks = 0;
let turnAdvances = 0;
const positions = {
  longbowman: { x: 0, y: 0 },
  knight: { x: 4, y: 0 },
};

const outcome = await awaitPlayerAiTurnResult(() => {
  positions.longbowman = { x: 3, y: 0 };
  actionScheduled = true;
  setTimeout(() => {
    continuationRuns += 1;
    attacks += 1;
    turnAdvances += 1;
  }, 0);
  return createPlayerAiActionResult("pending-continuation", {
    pendingContinuation: true,
    movement: "flank",
  });
}, () => actionScheduled);

if (!outcome.acted) fallbackPasses += 1;
assert.deepEqual(positions.longbowman, { x: 3, y: 0 }, "flanking movement updates position");
assert.equal(outcome.acted, true, "scheduled flanking continuation is action-positive");
assert.equal(outcome.summary, "pending-continuation");
assert.equal(outcome.result.pendingContinuation, true);
assert.equal(fallbackPasses, 0, "no no-action fallback runs while continuation owns the turn");

await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(continuationRuns, 1, "post-move continuation runs exactly once");
assert.equal(attacks, 1, "post-move attack is preserved");
assert.equal(turnAdvances, 1, "continuation advances the turn exactly once");

const source = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
const flankClaim = source.indexOf("// Claim this turn before yielding to the post-move continuation.");
const flankTimer = source.indexOf("setTimeout(() => {", flankClaim);
const flankResult = source.indexOf('createPlayerAiActionResult("pending-continuation"', flankTimer);
assert.ok(flankClaim >= 0 && flankTimer > flankClaim,
  "flanking claims action ownership before scheduling continuation");
assert.ok(flankResult > flankTimer,
  "flanking returns an explicit action-positive continuation result");
assert.match(source, /finalizeApproachMoveOnly\("player-ai-approach-move-only"\);\s*return createPlayerAiActionResult\("move"/,
  "approach move-only completion reports movement as an action");
assert.ok((source.match(/movement: "approach"/g) || []).length >= 3,
  "approach move-only, validation-fallback, and queued-attack exits are action-positive");
assert.match(source, /const blockedReason = getPlayerAiContinuationBlockReason\(attackOutcome\)/,
  "pending continuation handles an explicitly rejected attack executor");

console.log("player AI flanking result-is-action tests passed");

import assert from "node:assert/strict";
import fs from "node:fs";

import {
  awaitPlayerAiTurnResult,
  createPlayerAiActionResult,
} from "../src/utils/playerAiTurnResult.js";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

const pendingAction = deferred();
let actionFallbacks = 0;
let actionSettled = false;
const awaitedAction = awaitPlayerAiTurnResult(
  () => pendingAction.promise,
  () => false,
).then((outcome) => {
  actionSettled = true;
  if (!outcome.acted) actionFallbacks += 1;
  return outcome;
});
await Promise.resolve();
assert.equal(actionSettled, false, "player AI result remains pending until its Promise resolves");
assert.equal(actionFallbacks, 0, "fallback does not run while player AI is unresolved");

pendingAction.resolve({ actionTaken: true, action: "move" });
const acted = await awaitedAction;
assert.equal(acted.acted, true);
assert.equal(acted.summary, "move");
assert.equal(actionFallbacks, 0, "resolved action suppresses fallback pass/end-turn");

const pendingContinuation = await awaitPlayerAiTurnResult(
  () => createPlayerAiActionResult("pending-continuation", { pendingContinuation: true }),
  () => true,
);
assert.equal(pendingContinuation.acted, true);
assert.equal(pendingContinuation.summary, "pending-continuation");
assert.equal(pendingContinuation.result.pendingContinuation, true);

const pendingNoAction = deferred();
let noActionFallbacks = 0;
let processing = true;
const awaitedNoAction = (async () => {
  try {
    const outcome = await awaitPlayerAiTurnResult(() => pendingNoAction.promise, () => false);
    if (!outcome.acted) noActionFallbacks += 1;
    return outcome;
  } finally {
    processing = false;
  }
})();
await Promise.resolve();
assert.equal(noActionFallbacks, 0);
assert.equal(processing, true, "processing ownership remains held while async work is pending");
pendingNoAction.resolve(undefined);
const noAction = await awaitedNoAction;
assert.equal(noAction.summary, "no-action");
assert.equal(noActionFallbacks, 1, "resolved no-action triggers fallback exactly once");
assert.equal(processing, false, "processing ownership clears after async work settles");

const combatPageSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPageSource, /const handlePlayerAITurn = useCallback\(async/);
assert.match(combatPageSource, /await Promise\.race\(\[[\s\S]{0,300}awaitPlayerAiTurnResult\(/,
  "player AI result remains awaited alongside the bounded execution watchdog");
assert.match(combatPageSource, /if \(!resolvedPlayerAi\.acted\) setTimeout/);
assert.equal(combatPageSource.includes("result=[object Promise]"), false);
assert.equal(combatPageSource.includes("error=occText is not defined"), false);
assert.equal(combatPageSource.includes("AI made no action fraidering endTurn()."), false);
assert.match(combatPageSource, /\.finally\(releaseStartedTurn\)/,
  "turn-start ownership releases after the awaited player AI handler settles");

console.log("player AI awaited-result tests passed");

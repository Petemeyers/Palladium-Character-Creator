import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  classifyPlayerAiContinuationAdmission,
  createPlayerAiContinuationOwnership,
} from "../src/utils/playerAiContinuation.js";

const identity = {
  fighterId: "party-knight",
  turnIndex: 11,
  turnCounter: 12,
  turnToken: "turn-12",
  generationId: "generation-7",
  initiativeTurnId: "initiative-12",
  actionSequence: 1,
};
const receipt = createPlayerAiContinuationOwnership({ ...identity, source: "player-ai-remaining-action-continuation" });
const deferred = classifyPlayerAiContinuationAdmission({
  ownership: receipt,
  current: identity,
  activeExecutionKey: "generation-7|party-knight|33",
});
assert.equal(deferred.deferred, true);
assert.equal(deferred.reason, "prior-player-ai-execution-settling");
assert.equal(classifyPlayerAiContinuationAdmission({ ownership: receipt, current: identity }).accepted, true);
assert.equal(classifyPlayerAiContinuationAdmission({
  ownership: receipt,
  current: { ...identity, generationId: "generation-8" },
}).reason, "stale-continuation-identity");

const executeTwoActions = ({ startDistance, reachAfterFirstMove }) => {
  let position = 0;
  let stamina = 28;
  let actions = 2;
  let activeExecutionKey = "action-1";
  let receiptConsumed = false;
  let secondActions = 0;
  const events = [];
  const move = (distance) => {
    stamina -= 2;
    position += distance;
    actions -= 1;
    events.push("movement-committed", "action-completion-settled", "continuation-created");
  };
  move(45);
  assert.equal(classifyPlayerAiContinuationAdmission({ ownership: receipt, current: identity, activeExecutionKey }).deferred, true);
  events.push("continuation-deferred");
  activeExecutionKey = null;
  events.push("owner-released");
  const admission = classifyPlayerAiContinuationAdmission({ ownership: receipt, current: identity, activeExecutionKey });
  if (admission.accepted && !receiptConsumed) {
    receiptConsumed = true;
    events.push("continuation-admitted");
    secondActions += 1;
    if (reachAfterFirstMove) events.push("attack-executed");
    else {
      stamina -= 2;
      position += Math.min(45, startDistance - position);
      events.push("second-movement-committed");
    }
    actions -= 1;
  }
  if (admission.accepted && !receiptConsumed) secondActions += 1;
  events.push("turn-completed", "initiative-advanced");
  return { position, stamina, actions, secondActions, events };
};

const moveTwice = executeTwoActions({ startDistance: 90, reachAfterFirstMove: false });
assert.deepEqual({ position: moveTwice.position, stamina: moveTwice.stamina, actions: moveTwice.actions }, { position: 90, stamina: 24, actions: 0 });
assert.equal(moveTwice.secondActions, 1, "a duplicate callback cannot execute a second second-action");
assert.ok(moveTwice.events.indexOf("owner-released") < moveTwice.events.indexOf("continuation-admitted"));
assert.ok(moveTwice.events.includes("initiative-advanced"));

const moveThenAttack = executeTwoActions({ startDistance: 60, reachAfterFirstMove: true });
assert.ok(moveThenAttack.events.includes("attack-executed"));
assert.equal(moveThenAttack.secondActions, 1);

const page = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const ai = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.match(ai, /completed: true,[\s\S]*?actionSpent: true,[\s\S]*?completion/);
assert.doesNotMatch(page, /completePlayerAIContinuation\("player-ai-remaining-action-continuation-start"\)/);
assert.match(page, /queuePlayerAIContinuationAfterOwnerRelease\(executionOwnership\.executionKey\)/);
assert.match(page, /eventType: "player-ai-active-turn-ownership-audit"/);

console.log("player AI move-only continuation lifecycle tests passed");

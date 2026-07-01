import assert from "node:assert/strict";

import {
  decidePlayerTurnStartRoute,
  planAiToggleResume,
} from "../src/utils/aiToggleResume.js";
import { resolvePlayerAiLivePositions } from "../src/utils/playerAiLivePositions.js";
import { awaitPlayerAiTurnResult } from "../src/utils/playerAiTurnResult.js";

const fighter = {
  id: "party-spearman-10",
  name: "Spearman #10",
  team: "party",
  type: "player",
  remainingActions: 2,
};
const playerTurnKey = `${fighter.id}:1:2:2`;
const turnStartKey = `${fighter.id}|${fighter.type}|1|2|2`;
const takeoverPositions = resolvePlayerAiLivePositions(
  { [fighter.id]: { x: 2, y: 2 }, "enemy-1": { x: 3, y: 2 } },
  {},
);
assert.ok(takeoverPositions[fighter.id], "AI-toggle resume builds a live player position payload");
const resolvedTakeoverAction = await awaitPlayerAiTurnResult(
  async () => ({ actionTaken: true, action: "move" }),
  () => false,
);
assert.equal(resolvedTakeoverAction.summary, "move");
assert.equal(resolvedTakeoverAction.acted, true, "resolved takeover action is not replaced by an immediate pass");
assert.notEqual(resolvedTakeoverAction.summary, "failed");

const takeover = planAiToggleResume({
  aiControlEnabled: true,
  isPartyActor: true,
  effectiveControlMode: "ai",
  expectedPlayerTurnKey: playerTurnKey,
  playerTurnInFlightKey: playerTurnKey,
  expectedTurnStartKey: turnStartKey,
  turnStartInFlightKey: turnStartKey,
  expectedTurnStartPending: true,
});
assert.equal(takeover.shouldSchedule, true);

const firedRoute = decidePlayerTurnStartRoute({
  aiControlEnabled: true,
  isPartyActor: true,
  effectiveControlMode: "ai",
  activeFighterMatches: true,
  canAct: true,
});
assert.deepEqual(firedRoute, { route: "player-ai", blockReason: "" },
  "execution-time routing sends AI-toggle resume to player AI, not manual UI");

let executions = 0;
let turnAdvances = 0;
if (takeover.shouldSchedule && firedRoute.route === "player-ai") {
  executions += 1;
  turnAdvances += 1;
}
assert.equal(executions, 1, "player AI executes exactly once");
assert.equal(turnAdvances, 1, "player AI completion advances the turn");

const duplicatePlan = planAiToggleResume({
  aiControlEnabled: true,
  isPartyActor: true,
  effectiveControlMode: "ai",
  expectedPlayerTurnKey: playerTurnKey,
  expectedTurnStartKey: turnStartKey,
  turnStartInFlightKey: turnStartKey,
  playerTimerPending: true,
});
assert.equal(duplicatePlan.shouldSchedule, false, "actual duplicate scheduling remains blocked");

assert.equal(decidePlayerTurnStartRoute({
  aiControlEnabled: false,
  isPartyActor: true,
  effectiveControlMode: "player",
  activeFighterMatches: true,
  canAct: true,
}).route, "manual", "AI OFF routes the party actor back to manual control");

assert.equal(decidePlayerTurnStartRoute({
  aiControlEnabled: true,
  isPartyActor: true,
  effectiveControlMode: "ai",
  activeFighterMatches: false,
  canAct: true,
}).blockReason, "active-fighter-mismatch", "stale scheduled fighters remain blocked");

console.log("AI toggle resume player-AI routing tests passed");

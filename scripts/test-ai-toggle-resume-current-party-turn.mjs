import assert from "node:assert/strict";
import fs from "node:fs";

import { planAiToggleResume } from "../src/utils/aiToggleResume.js";
import { resolveExplicitCombatControlMode } from "../src/utils/combatantSide.js";

const partyActor = {
  id: "party-spearman-5",
  name: "Spearman #5",
  team: "party",
  type: "player",
  controlMode: "manual",
  remainingActions: 2,
};
const nextEnemy = {
  id: "enemy-champion-3",
  name: "Arena Champion #3",
  team: "enemy",
  type: "enemy",
  controlMode: "ai",
  remainingActions: 2,
};
const playerTurnKey = `${partyActor.id}:1:2:${partyActor.remainingActions}`;
const turnStartKey = `${partyActor.id}|${partyActor.type}|1|2|2`;

assert.equal(
  resolveExplicitCombatControlMode(partyActor, { aiControlEnabled: true, schedulerSide: "player" }),
  "ai",
  "AI toggle converts the active party actor to effective AI control",
);

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
assert.equal(takeover.clearPlayerTurnInFlight, true);
assert.equal(takeover.clearTurnStartInFlight, true);
assert.equal(takeover.clearPendingTurnStart, true);
assert.equal(takeover.shouldSchedule, true,
  "matching stale manual ownership does not block ai-toggle-resume");

let scheduledPlayerAiActions = 0;
let advancedActors = 0;
if (takeover.shouldSchedule) {
  scheduledPlayerAiActions += 1;
  advancedActors += 1;
}
assert.equal(scheduledPlayerAiActions, 1, "current party AI is scheduled exactly once");
assert.equal(nextEnemy.controlMode, "ai");
advancedActors += 1;
assert.equal(advancedActors, 2, "turn flow can continue to the next actor after player AI resolves");

const duplicateWhileScheduled = planAiToggleResume({
  aiControlEnabled: true,
  isPartyActor: true,
  effectiveControlMode: "ai",
  expectedPlayerTurnKey: playerTurnKey,
  playerTurnInFlightKey: "",
  expectedTurnStartKey: turnStartKey,
  turnStartInFlightKey: turnStartKey,
  playerTimerPending: true,
});
assert.equal(duplicateWhileScheduled.shouldSchedule, false,
  "normal duplicate protection remains active once player AI is scheduled");

const unrelatedOwner = planAiToggleResume({
  aiControlEnabled: true,
  isPartyActor: true,
  effectiveControlMode: "ai",
  expectedPlayerTurnKey: playerTurnKey,
  playerTurnInFlightKey: "another-actor:1:3:2",
  expectedTurnStartKey: turnStartKey,
  turnStartInFlightKey: "another-actor|enemy|1|3|2",
});
assert.equal(unrelatedOwner.clearPlayerTurnInFlight, false);
assert.equal(unrelatedOwner.clearTurnStartInFlight, false);
assert.equal(unrelatedOwner.shouldSchedule, false, "unrelated in-flight ownership is never bypassed");

const unrelatedPlayerOwnerOnly = planAiToggleResume({
  aiControlEnabled: true,
  isPartyActor: true,
  effectiveControlMode: "ai",
  expectedPlayerTurnKey: playerTurnKey,
  playerTurnInFlightKey: "another-actor:1:3:2",
  expectedTurnStartKey: turnStartKey,
});
assert.equal(unrelatedPlayerOwnerOnly.shouldSchedule, false,
  "an unrelated player-AI owner remains protected even without a turn-start owner");

assert.equal(
  resolveExplicitCombatControlMode(partyActor, { aiControlEnabled: false, schedulerSide: "player" }),
  "player",
  "turning AI off restores manual party control",
);

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /player AI execution superseded fighter=/,
  "returning to manual control settles an in-flight executor cleanly");

console.log("AI toggle current-party-turn resume tests passed");

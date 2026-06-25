import assert from "node:assert/strict";

import {
  buildCombatCommandTurnBridge,
  selectedActionMatchesCommandTurn,
} from "../src/utils/combatCommandTurnBridge.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const livePlayer = {
  id: "sorulwen",
  name: "Sorulwen",
  type: "player",
  remainingActions: 2,
  actionsPerRound: 2,
  currentStamina: 5,
  maxStamina: 6,
  helper: () => "ignored",
};
const liveEnemy = {
  id: "arena-champion",
  name: "Arena Champion",
  type: "enemy",
  remainingActions: 1,
  actionsPerRound: 2,
};
const manualTurn = {
  id: "mimi",
  name: "Mimi",
  side: "player",
  remainingActions: 1,
  maxActions: 2,
};
const snapshot = JSON.stringify({
  livePlayer: { id: livePlayer.id, name: livePlayer.name, remainingActions: livePlayer.remainingActions },
  manualTurn,
});

const livePlayerBridge = buildCombatCommandTurnBridge({
  combatActive: true,
  liveActor: livePlayer,
  liveInitiativeIndex: 1,
  liveRound: 3,
  manualTurnEntry: manualTurn,
  manualTurnOrderActive: true,
});

assert.equal(livePlayerBridge.source, "live-initiative", "live initiative is preferred");
assert.equal(livePlayerBridge.activeActorId, "sorulwen");
assert.equal(livePlayerBridge.activeActorName, "Sorulwen");
assert.equal(livePlayerBridge.round, 3);
assert.equal(livePlayerBridge.initiativeIndex, 1);
assert.equal(livePlayerBridge.remainingActions, 2);
assert.equal(livePlayerBridge.maxActions, 2);
assert.equal(livePlayerBridge.isPlayerControlled, true);
assert.equal(livePlayerBridge.isEnemyControlled, false);

const liveEnemyBridge = buildCombatCommandTurnBridge({
  combatActive: true,
  liveActor: liveEnemy,
  liveInitiativeIndex: 0,
});
assert.equal(liveEnemyBridge.source, "live-initiative", "live enemy still uses live initiative");
assert.equal(liveEnemyBridge.isEnemyControlled, true, "enemy live actor is enemy controlled");
assert.equal(liveEnemyBridge.isPlayerControlled, false, "enemy live actor is not player controlled");

const fallbackBridge = buildCombatCommandTurnBridge({
  combatActive: false,
  manualTurnEntry: manualTurn,
  manualTurnOrderActive: true,
  manualRound: 2,
});
assert.equal(fallbackBridge.source, "manual-public-turn-order", "manual turn order is fallback");
assert.equal(fallbackBridge.activeActorId, "mimi");
assert.equal(fallbackBridge.round, 2);
assert.equal(fallbackBridge.remainingActions, 1);

assert.equal(
  selectedActionMatchesCommandTurn({ metadata: { actorId: "mimi" } }, livePlayerBridge).ok,
  false,
  "selected action actor mismatch is detected"
);
assert.equal(
  selectedActionMatchesCommandTurn({ metadata: { actorId: "sorulwen" } }, livePlayerBridge).ok,
  true,
  "selected action actor match is accepted"
);

const noneBridge = buildCombatCommandTurnBridge();
assert.equal(noneBridge.source, "none");
assert.equal(noneBridge.warning, "No active combatant.");
assert.equal(noneBridge.activeActorId, "");

assert.doesNotThrow(() => buildCombatCommandTurnBridge({ liveActor: "bad", manualTurnEntry: null }));
assert.equal(hasFunction(livePlayerBridge), false, "bridge output contains no functions");
assert.equal(JSON.stringify({
  livePlayer: { id: livePlayer.id, name: livePlayer.name, remainingActions: livePlayer.remainingActions },
  manualTurn,
}), snapshot, "bridge does not mutate inputs");

console.log("combat command turn bridge tests passed");

import assert from "node:assert/strict";

import { buildCombatTurnStatus } from "../src/utils/combatTurnStatus.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const hasRawObjectString = (value) => JSON.stringify(value).includes("[object Object]");

const playerTurn = {
  activeActorId: "fighter-1",
  activeActorName: "Kara",
  activeActorTeam: "player",
  remainingActions: 2,
  maxActions: 2,
  isPlayerControlled: true,
  isEnemyControlled: false,
  source: "live-initiative",
  warning: "",
};

const actor = {
  id: "fighter-1",
  name: "Kara",
  type: "player",
  inventory: [{ id: "item-1", name: "Bandage" }],
};
const snapshot = JSON.stringify({ playerTurn, actor });

const fullActions = buildCombatTurnStatus({ commandTurn: playerTurn, activeActor: actor });
assert.equal(fullActions.currentTurnName, "Kara");
assert.equal(fullActions.sourceLabel, "Live initiative");
assert.equal(fullActions.teamLabel, "Player");
assert.equal(fullActions.actionsRemaining, 2);
assert.equal(fullActions.maxActions, 2);
assert.equal(fullActions.postureLabel, "None");
assert.equal(fullActions.nextStepMessage, "Choose a command.");

const partialActions = buildCombatTurnStatus({
  commandTurn: { ...playerTurn, remainingActions: 1 },
  activeActor: actor,
});
assert.equal(partialActions.nextStepMessage, "Choose another action or End Turn.");

const noActions = buildCombatTurnStatus({
  commandTurn: { ...playerTurn, remainingActions: 0 },
  activeActor: actor,
});
assert.equal(noActions.nextStepMessage, "No actions remaining. End Turn.");

const enemyTurn = buildCombatTurnStatus({
  commandTurn: {
    ...playerTurn,
    activeActorName: "Arena Champion",
    activeActorTeam: "enemy",
    isPlayerControlled: false,
    isEnemyControlled: true,
  },
  activeActor: { id: "enemy-1", name: "Arena Champion", type: "enemy" },
});
assert.equal(enemyTurn.teamLabel, "Enemy");
assert.equal(enemyTurn.nextStepMessage, "Waiting for enemy action.");

const blocking = buildCombatTurnStatus({
  commandTurn: playerTurn,
  activeActor: {
    ...actor,
    combatPosture: {
      type: "blocking",
      label: "Blocking",
      createdRound: 1,
      createdTurnIndex: 0,
      expires: "next-turn",
    },
  },
});
assert.equal(blocking.postureLabel, "Blocking");

const legacyEvade = buildCombatTurnStatus({
  commandTurn: playerTurn,
  activeActor: { ...actor, legacyDefensivePosture: "Evade" },
});
assert.equal(legacyEvade.postureLabel, "Evading");

const missingActor = buildCombatTurnStatus({ commandTurn: { source: "none" }, activeActor: null });
assert.equal(missingActor.warning, "No active combatant.");
assert.equal(missingActor.nextStepMessage, "No active combatant.");

const malformed = buildCombatTurnStatus({
  commandTurn: { activeActorName: { raw: true }, activeActorTeam: () => "bad", remainingActions: "bad", maxActions: false },
  activeActor: { name: { raw: true }, combatPosture: { type: {}, label: () => "bad" } },
  selectedCombatAction: { handler: () => "bad" },
});
assert.equal(hasFunction(malformed), false, "helper output contains no functions");
assert.equal(hasRawObjectString(malformed), false, "helper output contains no raw object strings");
assert.equal(JSON.stringify({ playerTurn, actor }), snapshot, "helper does not mutate inputs");

console.log("combat turn status tests passed");

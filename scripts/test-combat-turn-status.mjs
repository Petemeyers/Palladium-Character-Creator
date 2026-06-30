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
assert.equal(fullActions.showEndTurnButton, true);
assert.equal(fullActions.endTurnAvailable, true);
assert.equal(fullActions.endCurrentActionAvailable, true);
assert.equal(fullActions.endCurrentActionButtonLabel, "End Current Action");
assert.equal(fullActions.endTurnButtonLabel, "End All Actions");

const partialActions = buildCombatTurnStatus({
  commandTurn: { ...playerTurn, remainingActions: 1 },
  activeActor: actor,
});
assert.equal(partialActions.nextStepMessage, "Choose another action or end the current action.");

const noActions = buildCombatTurnStatus({
  commandTurn: { ...playerTurn, remainingActions: 0 },
  activeActor: actor,
});
assert.equal(noActions.nextStepMessage, "No actions remaining. End All Actions to advance.");
assert.equal(noActions.showEndTurnButton, true);
assert.equal(noActions.endTurnAvailable, true);
assert.equal(noActions.endCurrentActionAvailable, false);
assert.equal(noActions.endCurrentActionDisabledReason, "No actions remaining.");

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
assert.equal(enemyTurn.showEndTurnButton, false);
assert.equal(enemyTurn.endTurnAvailable, false);

const enemyTeamPlayerType = buildCombatTurnStatus({
  commandTurn: {
    ...playerTurn,
    activeActorTeam: "enemy",
    isPlayerControlled: false,
    isEnemyControlled: true,
  },
  activeActor: { id: "playable-champion", team: "enemy", type: "player" },
});
assert.equal(enemyTeamPlayerType.teamLabel, "Enemy");
assert.equal(enemyTeamPlayerType.showEndTurnButton, false);

const busyEndTurn = buildCombatTurnStatus({
  commandTurn: playerTurn,
  activeActor: actor,
  endTurnUnavailableReason: "End Turn unavailable while action resolves.",
});
assert.equal(busyEndTurn.showEndTurnButton, true);
assert.equal(busyEndTurn.endTurnAvailable, false);
assert.equal(busyEndTurn.endTurnDisabledReason, "End Turn unavailable while action resolves.");

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
assert.equal(missingActor.showEndTurnButton, false);
assert.equal(missingActor.endTurnAvailable, false);

const malformed = buildCombatTurnStatus({
  commandTurn: { activeActorName: { raw: true }, activeActorTeam: () => "bad", remainingActions: "bad", maxActions: false },
  activeActor: { name: { raw: true }, combatPosture: { type: {}, label: () => "bad" } },
  selectedCombatAction: { handler: () => "bad" },
  endTurnUnavailableReason: { raw: true },
});
assert.equal(hasFunction(malformed), false, "helper output contains no functions");
assert.equal(hasRawObjectString(malformed), false, "helper output contains no raw object strings");
assert.equal(JSON.stringify({ playerTurn, actor }), snapshot, "helper does not mutate inputs");

console.log("combat turn status tests passed");

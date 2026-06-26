import assert from "node:assert/strict";

import {
  canUseManualEndTurn,
  endManualTurnActions,
  isExplicitManualEndTurnSource,
} from "../src/utils/combatCommandStateCleanup.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};
const hasRawObjectString = (value) => JSON.stringify(value).includes("[object Object]");

const player = {
  id: "fighter-1",
  name: "Kara",
  type: "player",
  remainingActions: 2,
};
const ally = {
  id: "fighter-2",
  name: "Danirden",
  type: "player",
  remainingActions: 1,
};
const enemy = {
  id: "enemy-1",
  name: "Arena Champion",
  type: "enemy",
  remainingActions: 2,
};
const fighters = [player, ally, enemy];
const snapshot = JSON.stringify(fighters);

assert.equal(isExplicitManualEndTurnSource("command-center-end-turn"), true);
assert.equal(isExplicitManualEndTurnSource("legacy-compatibility-end-turn"), true);
assert.equal(isExplicitManualEndTurnSource("manual-attack-finalized"), false);

assert.equal(
  canUseManualEndTurn({
    source: "command-center-end-turn",
    currentFighter: player,
    commandTurn: {
      activeActorTeam: "player",
      isPlayerControlled: true,
      isEnemyControlled: false,
    },
    aiControlEnabled: false,
  }),
  true,
  "command center End Turn is allowed during manual player control"
);

assert.equal(
  canUseManualEndTurn({
    source: "legacy-compatibility-end-turn",
    currentFighter: player,
    aiControlEnabled: false,
  }),
  true,
  "compatibility End Turn is allowed during manual player control"
);

assert.equal(
  canUseManualEndTurn({
    source: "command-center-end-turn",
    currentFighter: enemy,
    commandTurn: {
      activeActorTeam: "enemy",
      isPlayerControlled: false,
      isEnemyControlled: true,
    },
    aiControlEnabled: false,
  }),
  false,
  "enemy turns do not get manual End Turn permission"
);

assert.equal(
  canUseManualEndTurn({
    source: "command-center-end-turn",
    currentFighter: player,
    commandTurn: {
      activeActorTeam: "player",
      isPlayerControlled: true,
      isEnemyControlled: false,
    },
    aiControlEnabled: true,
  }),
  false,
  "AI-controlled player turns do not get manual End Turn permission"
);

const ended = endManualTurnActions(fighters, player);
assert.notEqual(ended, fighters, "ending manual actions returns a new fighter list");
assert.equal(ended[0].remainingActions, 0, "current fighter remaining actions are ended");
assert.equal(ended[1].remainingActions, 1, "other player actions are unchanged");
assert.equal(ended[2].remainingActions, 2, "enemy actions are unchanged");
assert.equal(hasFunction(ended), false, "manual end-turn helper output contains no functions");
assert.equal(hasRawObjectString(ended), false, "manual end-turn helper output contains no raw object strings");
assert.equal(JSON.stringify(fighters), snapshot, "manual end-turn helper does not mutate inputs");

assert.doesNotThrow(() => canUseManualEndTurn(null));
assert.doesNotThrow(() => endManualTurnActions(null, player));

console.log("manual player end turn tests passed");

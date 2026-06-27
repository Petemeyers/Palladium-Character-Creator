import assert from "node:assert/strict";

import {
  getCombatantSide,
  isEnemyCombatant,
  isManualPlayerCombatant,
  isPartyCombatant,
} from "../src/utils/combatantSide.js";
import { buildCombatCommandTurnBridge } from "../src/utils/combatCommandTurnBridge.js";
import { canUseManualEndTurn } from "../src/utils/combatCommandStateCleanup.js";
import { buildCombatTurnStatus } from "../src/utils/combatTurnStatus.js";

const enemyPlayable = {
  id: "playable-arena-champion",
  name: "Arena Champion",
  team: "enemy",
  type: "player",
  remainingActions: 1,
};
const snapshot = JSON.stringify(enemyPlayable);

assert.equal(getCombatantSide(enemyPlayable), "enemy");
assert.equal(isEnemyCombatant(enemyPlayable), true);
assert.equal(isPartyCombatant(enemyPlayable), false);
assert.equal(isManualPlayerCombatant(enemyPlayable), false);

const enemyBridge = buildCombatCommandTurnBridge({
  combatActive: true,
  liveActor: enemyPlayable,
});
assert.equal(enemyBridge.isEnemyControlled, true);
assert.equal(enemyBridge.isPlayerControlled, false);
assert.equal(enemyBridge.activeActorTeam, "enemy");

assert.equal(canUseManualEndTurn({
  source: "command-center-end-turn",
  currentFighter: enemyPlayable,
  commandTurn: enemyBridge,
}), false, "enemy-team playable combatant cannot use manual End Turn");

const enemyStatus = buildCombatTurnStatus({
  commandTurn: enemyBridge,
  activeActor: enemyPlayable,
});
assert.equal(enemyStatus.teamLabel, "Enemy");
assert.equal(enemyStatus.showEndTurnButton, false);

const manualEnemy = { ...enemyPlayable, controlMode: "manual", playable: true };
const manualEnemyBridge = buildCombatCommandTurnBridge({
  combatActive: true,
  liveActor: manualEnemy,
});
assert.equal(getCombatantSide(manualEnemy), "enemy", "manual control does not change allegiance");
assert.equal(isManualPlayerCombatant(manualEnemy), true, "playable enemy may be manually controlled");
assert.equal(isManualPlayerCombatant(manualEnemy, { aiControlEnabled: true }), true, "explicit manual control remains authoritative");
assert.equal(manualEnemyBridge.isPlayerControlled, true);
assert.equal(manualEnemyBridge.isEnemyControlled, false);
assert.equal(canUseManualEndTurn({
  source: "command-center-end-turn",
  currentFighter: manualEnemy,
  commandTurn: manualEnemyBridge,
}), true);

const partyPlayer = {
  id: "playable-party-scout",
  name: "Party Scout",
  team: "party",
  type: "player",
  remainingActions: 1,
};
assert.equal(getCombatantSide(partyPlayer), "player");
assert.equal(isManualPlayerCombatant(partyPlayer), true);

const aiPartyPlayer = { ...partyPlayer, controlMode: "ai" };
const aiPartyBridge = buildCombatCommandTurnBridge({ combatActive: true, liveActor: aiPartyPlayer });
assert.equal(getCombatantSide(aiPartyPlayer), "player", "AI control does not change party allegiance");
assert.equal(aiPartyBridge.isPlayerControlled, false);
assert.equal(aiPartyBridge.isEnemyControlled, true);

const battleSideEnemy = { id: "fighter-3", battleSide: "enemy", type: "player" };
assert.equal(getCombatantSide(battleSideEnemy), "enemy");
assert.equal(isManualPlayerCombatant(battleSideEnemy), false);

assert.equal(
  isManualPlayerCombatant(enemyPlayable),
  false,
  "enemy no-target handoff is not blocked as a waiting manual player"
);
assert.equal(JSON.stringify(enemyPlayable), snapshot, "ownership helpers do not mutate combatants");

console.log("team-side turn classification tests passed");

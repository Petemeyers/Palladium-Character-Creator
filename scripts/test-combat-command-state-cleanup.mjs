import assert from "node:assert/strict";

import {
  buildClearedAttackAbortState,
  buildClearedLegacyDefensiveActionState,
  buildClearedMovementState,
  canStartManualMovementTargeting,
  canUseManualEndTurn,
  endManualTurnActions,
  isExplicitManualEndTurnSource,
  isLegacyDefensiveAction,
  sanitizeBusyStateAfterAbort,
  shouldClearLegacySelectedAction,
} from "../src/utils/combatCommandStateCleanup.js";

const movementState = {
  movementMode: { active: true, isRunning: true },
  selectedMovementMode: "move",
  selectedMovementFighter: "fighter-1",
  selectedMovementHex: { x: 2, y: 3 },
  selectedHex: { x: 2, y: 3 },
  showMovementSelection: true,
  validMoves: [{ x: 2, y: 3 }],
  engineValidMoves: [{ x: 2, y: 3 }],
  pendingMoveCosts: { "2,3": 1 },
  moveCostsByHex: { "2,3": 1 },
  selectedCombatAction: { id: "move", type: "move" },
};
const movementSnapshot = JSON.stringify(movementState);
const clearedMovement = buildClearedMovementState(movementState);

assert.deepEqual(clearedMovement.movementMode, { active: false, isRunning: false });
assert.equal(clearedMovement.selectedMovementMode, null);
assert.equal(clearedMovement.selectedMovementFighter, null);
assert.equal(clearedMovement.selectedMovementHex, null);
assert.equal(clearedMovement.selectedHex, null);
assert.equal(clearedMovement.showMovementSelection, false);
assert.deepEqual(clearedMovement.validMoves, []);
assert.deepEqual(clearedMovement.engineValidMoves, []);
assert.deepEqual(clearedMovement.pendingMoveCosts, {});
assert.deepEqual(clearedMovement.moveCostsByHex, {});
assert.equal(clearedMovement.explicitMovementRequest, false);
assert.equal(clearedMovement.manualMovementRequestActive, false);
assert.deepEqual(clearedMovement.selectedCombatAction, movementState.selectedCombatAction, "selected combat action is preserved");
assert.equal(JSON.stringify(movementState), movementSnapshot, "movement cleanup does not mutate input");

const playerFighter = { id: "fighter-1", name: "Mimi", type: "player" };
const playerTurn = { id: "fighter-1", side: "player" };
assert.equal(isExplicitManualEndTurnSource("command-center-end-turn"), true, "command center End Turn source is explicit");
assert.equal(isExplicitManualEndTurnSource("legacy-compatibility-end-turn"), true, "compatibility End Turn source is explicit");
assert.equal(
  canUseManualEndTurn({
    source: "command-center-end-turn",
    currentFighter: playerFighter,
    commandTurn: { activeActorTeam: "player", isPlayerControlled: true },
  }),
  true,
  "manual player can explicitly end turn"
);
assert.equal(
  canUseManualEndTurn({
    source: "command-center-end-turn",
    currentFighter: { id: "enemy-1", name: "Goblin", type: "enemy" },
    commandTurn: { activeActorTeam: "enemy", isEnemyControlled: true },
  }),
  false,
  "enemy cannot explicitly use manual End Turn"
);
assert.equal(
  endManualTurnActions([{ ...playerFighter, remainingActions: 2 }], playerFighter)[0].remainingActions,
  0,
  "manual End Turn ends remaining actions for the active fighter"
);
assert.equal(
  canStartManualMovementTargeting({
    combatActive: true,
    currentFighter: playerFighter,
    currentTurnEntry: playerTurn,
    selectedMovementFighter: "fighter-1",
    selectedMovementMode: "move",
    selectedAction: { type: "move", name: "Move" },
    explicitMovementRequest: true,
  }),
  true,
  "player current turn with explicit request can start movement"
);
assert.equal(
  canStartManualMovementTargeting({
    combatActive: true,
    currentFighter: { id: "enemy-1", name: "Goblin", type: "enemy" },
    currentTurnEntry: { id: "enemy-1", side: "enemy" },
    selectedMovementFighter: "enemy-1",
    selectedMovementMode: "move",
    selectedAction: { type: "move", name: "Move" },
    explicitMovementRequest: true,
  }),
  false,
  "enemy current turn cannot start manual movement"
);
assert.equal(
  canStartManualMovementTargeting({
    combatActive: true,
    combatOver: true,
    currentFighter: playerFighter,
    currentTurnEntry: playerTurn,
    selectedMovementFighter: "fighter-1",
    selectedMovementMode: "move",
    selectedAction: { type: "move", name: "Move" },
    explicitMovementRequest: true,
  }),
  false,
  "combat-over state cannot start manual movement"
);
assert.equal(
  canStartManualMovementTargeting({
    combatActive: true,
    currentFighter: playerFighter,
    currentTurnEntry: playerTurn,
    selectedMovementMode: "move",
    selectedAction: { type: "move", name: "Move" },
    explicitMovementRequest: true,
  }),
  false,
  "missing selected movement fighter cannot start movement"
);
assert.equal(
  canStartManualMovementTargeting({
    combatActive: true,
    currentFighter: playerFighter,
    currentTurnEntry: playerTurn,
    selectedMovementFighter: "fighter-1",
    selectedMovementMode: "move",
    selectedAction: { name: "Evade" },
    explicitMovementRequest: true,
  }),
  false,
  "stale Evade action cannot start movement"
);
assert.equal(
  canStartManualMovementTargeting({
    combatActive: true,
    currentFighter: playerFighter,
    currentTurnEntry: playerTurn,
    selectedMovementFighter: "fighter-1",
    selectedMovementMode: "move",
    selectedAction: { name: "Defend/Hold" },
    explicitMovementRequest: true,
  }),
  false,
  "stale Defend/Hold action cannot start movement"
);
assert.equal(
  canStartManualMovementTargeting({
    combatActive: true,
    currentFighter: playerFighter,
    currentTurnEntry: playerTurn,
    selectedMovementFighter: "fighter-1",
    selectedMovementMode: "move",
    selectedAction: { type: "move", name: "Move" },
    explicitMovementRequest: false,
  }),
  false,
  "stale movement mode without explicit request is ignored"
);

const attackState = {
  activeAttack: "attack-1",
  activeAttackActionId: "attack-1",
  turnActionResolving: true,
  executingAction: true,
  pendingTurnAdvance: true,
  selectedAction: { name: "Attack" },
  selectedTarget: { id: "target-1" },
  selectedWeapon: "Shortsword",
  selectedAttackWeapon: { name: "Shortsword" },
  selectedManeuver: "strike",
  selectedCombatAction: { id: "catalog-attack", type: "attack" },
};
const attackSnapshot = JSON.stringify(attackState);
const clearedAttack = buildClearedAttackAbortState(attackState);

assert.equal(clearedAttack.activeAttack, null);
assert.equal(clearedAttack.activeAttackActionId, null);
assert.equal(clearedAttack.turnActionResolving, false);
assert.equal(clearedAttack.executingAction, false);
assert.equal(clearedAttack.pendingTurnAdvance, false);
assert.equal(clearedAttack.selectedAction, null);
assert.equal(clearedAttack.selectedWeapon, null);
assert.equal(clearedAttack.selectedAttackWeapon, null);
assert.equal(clearedAttack.selectedManeuver, null);
assert.deepEqual(clearedAttack.selectedTarget, attackState.selectedTarget, "selected target is preserved by default");
assert.deepEqual(clearedAttack.selectedCombatAction, attackState.selectedCombatAction, "manual command selection is preserved by default");

const clearedTarget = buildClearedAttackAbortState(attackState, { clearSelectedTarget: true });
assert.equal(clearedTarget.selectedTarget, null);
const clearedCommand = buildClearedAttackAbortState(attackState, { clearSelectedCombatAction: true });
assert.equal(clearedCommand.selectedCombatAction, null);

const defensiveState = {
  selectedAction: { name: "Defend/Hold" },
  selectedTarget: { id: "target-1" },
  selectedWeapon: { name: "Shield" },
  selectedAttackWeapon: { name: "Shortsword" },
  selectedCombatAction: { id: "catalog-defend", type: "defend" },
  turnActionResolving: true,
  executingAction: true,
  pendingTurnAdvance: true,
  activeAttack: "attack-1",
  activeAttackActionId: "attack-1",
  movementMode: { active: true, isRunning: false },
  selectedMovementMode: "move",
  selectedMovementFighter: "fighter-1",
  selectedMovementHex: { x: 1, y: 2 },
  showMovementSelection: true,
  explicitMovementRequest: true,
  manualMovementRequestActive: true,
};
const defensiveSnapshot = JSON.stringify(defensiveState);
const clearedDefensive = buildClearedLegacyDefensiveActionState(defensiveState);

assert.equal(isLegacyDefensiveAction("Defend/Hold"), true, "Defend/Hold is a legacy defensive action");
assert.equal(isLegacyDefensiveAction({ name: "Evade" }), true, "Evade object is a legacy defensive action");
assert.equal(isLegacyDefensiveAction("Attack"), false, "Attack is not a defensive action");
assert.equal(shouldClearLegacySelectedAction("Block"), true, "Block selected action should be cleared");
assert.equal(clearedDefensive.selectedAction, null, "legacy Defend/Hold selected action is cleared");
assert.equal(clearedDefensive.selectedTarget, null, "defensive cleanup clears selected target");
assert.equal(clearedDefensive.selectedWeapon, null, "defensive cleanup clears selected weapon");
assert.equal(clearedDefensive.selectedAttackWeapon, null, "defensive cleanup clears selected attack weapon");
assert.deepEqual(clearedDefensive.selectedCombatAction, defensiveState.selectedCombatAction, "selected combat action is preserved by default");
assert.equal(clearedDefensive.turnActionResolving, false, "defensive cleanup clears resolving latch");
assert.equal(clearedDefensive.executingAction, false, "defensive cleanup clears executing latch");
assert.equal(clearedDefensive.pendingTurnAdvance, false, "defensive cleanup clears pending turn advance latch");
assert.deepEqual(clearedDefensive.movementMode, { active: false, isRunning: false }, "defensive cleanup clears movement mode");
assert.equal(clearedDefensive.selectedMovementMode, null, "defensive cleanup clears selected movement mode");
assert.equal(clearedDefensive.selectedMovementFighter, null, "defensive cleanup clears selected movement fighter");
assert.equal(clearedDefensive.selectedMovementHex, null, "defensive cleanup clears selected movement hex");
assert.equal(clearedDefensive.showMovementSelection, false, "defensive cleanup hides movement selection");
assert.equal(clearedDefensive.explicitMovementRequest, false, "defensive cleanup clears explicit movement request");
assert.equal(clearedDefensive.manualMovementRequestActive, false, "defensive cleanup clears manual movement request");

const clearedEvade = buildClearedLegacyDefensiveActionState({
  selectedAction: { name: "Evade" },
  turnActionResolving: true,
  executingAction: true,
});
assert.equal(clearedEvade.selectedAction, null, "legacy Evade selected action is cleared");
assert.equal(clearedEvade.turnActionResolving, false, "legacy Evade cleanup clears resolving latch");
assert.equal(clearedEvade.executingAction, false, "legacy Evade cleanup clears executing latch");

const preservedCombatAction = buildClearedLegacyDefensiveActionState(defensiveState, {
  clearSelectedCombatAction: false,
});
assert.deepEqual(preservedCombatAction.selectedCombatAction, defensiveState.selectedCombatAction, "defensive cleanup does not clear selectedCombatAction unless requested");
const clearedCombatAction = buildClearedLegacyDefensiveActionState(defensiveState, {
  clearSelectedCombatAction: true,
});
assert.equal(clearedCombatAction.selectedCombatAction, null, "defensive cleanup can explicitly clear selectedCombatAction");
assert.doesNotThrow(() => buildClearedLegacyDefensiveActionState(null), "malformed defensive cleanup input does not throw");
assert.doesNotThrow(() => isLegacyDefensiveAction(null), "malformed defensive action input does not throw");
assert.equal(JSON.stringify(defensiveState), defensiveSnapshot, "defensive cleanup does not mutate input");

const busy = sanitizeBusyStateAfterAbort({
  activeAttack: "attack-2",
  activeAttackActionId: "attack-2",
  turnActionResolving: true,
  executingAction: true,
  pendingTurnAdvance: true,
  selectedCombatAction: attackState.selectedCombatAction,
});
assert.equal(busy.activeAttack, null);
assert.equal(busy.activeAttackActionId, null);
assert.equal(busy.turnActionResolving, false);
assert.equal(busy.executingAction, false);
assert.equal(busy.pendingTurnAdvance, false);
assert.deepEqual(busy.selectedCombatAction, attackState.selectedCombatAction);

assert.doesNotThrow(() => buildClearedMovementState(null));
assert.doesNotThrow(() => buildClearedAttackAbortState(null));
assert.doesNotThrow(() => sanitizeBusyStateAfterAbort(null));
assert.equal(JSON.stringify(attackState), attackSnapshot, "attack cleanup does not mutate input");

console.log("combat command state cleanup tests passed");

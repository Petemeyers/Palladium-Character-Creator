import assert from "node:assert/strict";

import {
  buildClearedAttackAbortState,
  buildClearedMovementState,
  canStartManualMovementTargeting,
  sanitizeBusyStateAfterAbort,
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

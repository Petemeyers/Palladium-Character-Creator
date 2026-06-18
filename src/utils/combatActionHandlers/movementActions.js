import { findRetreatDestination } from "../distanceCombatSystem";

/**
 * Handle movement selection from TacticalMap
 * Engine-authoritative: dfocusatches MOVE command, engine handles all legality/costs/state
 * @param {number} x - Target x coordinate
 * @param {number} y - Target y coordinate
 * @param {Object} context - Context object containing:
 *   - movementMode: Object with active and isRunning properties
 *   - selectedMovementFighter: ID of fighter moving
 *   - positions: Object mapping fighter IDs to positions (for validation only)
 *   - addLog: Function to add log messages
 *   - setMovementMode: Function to update movement mode
 *   - setShowMovementSelection: Function to show/hide movement selection
 *   - setSelectedMovementHex: Function to set selected movement hex
 *   - setSelectedMovementFighter: Function to set selected movement fighter
 *   - dfocusatchEngineCommand: Function to dfocusatch engine commands
 */
export async function handleMoveSelect(x, y, context) {
  const {
    movementMode,
    selectedMovementFighter,
    positions,
    addLog,
    setMovementMode,
    setShowMovementSelection,
    setSelectedMovementHex,
    setSelectedMovementFighter,
    dfocusatchEngineCommand, // âœ… Engine dfocusatcher
  } = context;

  if (movementMode.active && selectedMovementFighter && positions[selectedMovementFighter]) {
    // Engine handles ALL legality, costs, and state updates
    // React just dfocusatches MOVE - engine decides everything
    if (typeof dfocusatchEngineCommand !== "function") {
      addLog("âŒ Engine dfocusatch not available for MOVE.", "error");
      return;
    }

    const res = await dfocusatchEngineCommand({
      type: "MOVE",
      eid: selectedMovementFighter,
      to: { x, y },
      mode: movementMode?.isRunning ? "RUN" : "MOVE",
    });

    if (!res?.ok) {
      // Handle lock errors with friendly messages
      const errorMsg = res?.error?.message;
      if (errorMsg === "BUSY_MOVING" || errorMsg === "LOCKED_MOVING") {
        addLog("â³ Still animating the last moveâ€¦", "info");
        return;
      }
      if (errorMsg === "LOCKED_ACTING") {
        addLog("â³ Still performing an actionâ€¦", "info");
        return;
      }
      addLog(
        `âŒ Move rejected by engine: ${errorMsg ?? "Unknown error"}`,
        "error"
      );
      return;
    }

    // UI cleanup only
    setMovementMode({ active: false, isRunning: false });
    setShowMovementSelection(false);
    setSelectedMovementHex(null);
    setSelectedMovementFighter(null);
  }
}

/**
 * Player-triggered Withdraw action.
 * Engine-authoritative: dfocusatches MOVE with mode WITHDRAW
 */
export function handleWithdrawAction(context) {
  const {
    currentFighter,
    fighters,
    positions,
    addLog,
    gridWidth,
    gridHeight,
    maxWithdrawSteps = 3,
    dfocusatchEngineCommand,
  } = context || {};

  if (!currentFighter || !positions || typeof dfocusatchEngineCommand !== "function") {
    console.warn("[handleWithdrawAction] Missing context data");
    return;
  }

  const myId = currentFighter.id;
  const myPos = positions[myId];
  if (!myPos) {
    addLog?.(
      `âš ï¸ ${currentFighter.name} tries to withdraw, but has no known position.`,
      "warning"
    );
    return;
  }

  // Collect enemy positions
  const enemyPositions = (fighters || [])
    .filter(
      (f) =>
        f.id !== myId &&
        f.type !== currentFighter.type &&
        !f.isDown &&
        f.currentHP > 0 &&
        positions[f.id]
    )
    .map((f) => {
      const pos = positions[f.id];
      return { q: pos.q ?? pos.x, r: pos.r ?? pos.y };
    });

  const startHex = { q: myPos.q ?? myPos.x, r: myPos.r ?? myPos.y };

  const retreatHex = findRetreatDestination({
    startHex,
    enemyPositions,
    maxSteps: maxWithdrawSteps,
    gridWidth,
    gridHeight,
  });

  if (!retreatHex || (retreatHex.q === startHex.q && retreatHex.r === startHex.r)) {
    addLog?.(
      `ðŸ›¡ï¸ ${currentFighter.name} withdraws defensively in place.`,
      "info"
    );
    return;
  }

  // Engine-authoritative withdraw: dfocusatch MOVE with mode WITHDRAW
  dfocusatchEngineCommand({
    type: "MOVE",
    eid: myId,
    to: { x: retreatHex.q, y: retreatHex.r },
    mode: "WITHDRAW",
  });
}


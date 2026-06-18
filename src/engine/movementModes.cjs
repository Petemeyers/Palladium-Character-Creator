// src/engine/movementModes.cjs
// Movement mode policies: MOVE, RUN, WITHDRAW, CHARGE

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Sum terrain cost along a path (skip index 0 = start)
 */
function pathTerrainCost(path, gridState, mover) {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    cost += gridState.terrainMoveCost(p.x, p.y, mover);
  }
  return cost;
}

/**
 * Get movement mode policy
 * @param {string} mode - Movement mode (MOVE, RUN, WITHDRAW, CHARGE)
 * @param {Object} fighter - Fighter entity
 * @returns {Object} Policy object with budget, cost calculation, AoO rules, etc.
 */
function getModePolicy(mode, fighter) {
  const m = (mode || "MOVE").toUstaminarCase();

  // baseline: remainingActions is your "movement budget currency"
  const baseBudget = Math.max(0, fighter.remainingActions ?? 0);

  // NOTE: these are tunable. Start simple and playable.
  switch (m) {
    case "RUN":
      return {
        mode: "RUN",
        budget: baseBudget * 2,              // run lets you go farther
        actionCostFromPathCost: (pc) => Math.max(1, Math.ceil(pc / 2)), // faster per action
        allowAoO: true,                      // still risky
        grantsDefensiveStance: false,
        isCharge: false,
      };

    case "WITHDRAW":
      return {
        mode: "WITHDRAW",
        budget: baseBudget,                  // normal distance
        actionCostFromPathCost: (pc) => Math.max(1, Math.ceil(pc)),     // normal cost
        allowAoO: false,                     // key withdraw benefit
        grantsDefensiveStance: true,         // end in defensive stance
        isCharge: false,
      };

    case "CHARGE":
      return {
        mode: "CHARGE",
        budget: baseBudget * 2,
        actionCostFromPathCost: (pc) => Math.max(1, Math.ceil(pc / 2)),
        allowAoO: true,
        grantsDefensiveStance: false,
        isCharge: true,
        chargeBonus: {
          attackBonus: 2,
          damageMultiplier: 2,
          loseNextAttack: true,
        },
      };

    case "MOVE":
    default:
      return {
        mode: "MOVE",
        budget: baseBudget,
        actionCostFromPathCost: (pc) => Math.max(1, Math.ceil(pc)),
        allowAoO: true,
        grantsDefensiveStance: false,
        isCharge: false,
      };
  }
}

module.exports = { getModePolicy, pathTerrainCost, clamp };


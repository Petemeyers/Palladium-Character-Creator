// src/engine/systems/rangeEngine.cjs
// Computes effective distance (horizontal + vertical) for flight time calculations

const { hexDistanceAxial } = require("../utils/hexDistance.cjs");
const { getAltitude } = require("../utils/getAltitude.cjs");

/**
 * Compute effective distance from state (horizontal + vertical weighted).
 *
 * @param {Object} params
 * @param {Object} params.state - Engine state (fighters, positions)
 * @param {string} params.fromId - Attacker/source entity ID
 * @param {string} params.toId - Target entity ID
 * @param {Object} params.fromHex - Optional override hex (if not in state.positions)
 * @param {Object} params.toHex - Optional override hex (if not in state.positions)
 * @param {number} params.horizWeight - Weight for horizontal distance (default: 1)
 * @param {number} params.vertWeight - Weight for vertical/altitude delta (default: 1)
 * @returns {number} Effective distance in hex-equivalent units
 */
function effectiveDistanceFromState({
  state,
  fromId,
  toId,
  fromHex,
  toHex,
  horizWeight = 1,
  vertWeight = 1,
}) {
  // Get hexes from state if not provided
  const from = fromHex || state.positions?.[fromId];
  const to = toHex || state.positions?.[toId];

  if (!from || !to) {
    return 0;
  }

  // Horizontal distance
  const horiz = hexDistanceAxial(from, to);

  // Vertical distance (altitude delta)
  const fromAlt = getAltitude(state, fromId);
  const toAlt = getAltitude(state, toId);
  const vert = Math.abs(fromAlt - toAlt);

  // Effective distance = weighted sum
  return horiz * horizWeight + vert * vertWeight;
}

module.exports = { effectiveDistanceFromState };


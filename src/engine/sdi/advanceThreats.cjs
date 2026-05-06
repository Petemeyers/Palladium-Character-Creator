// src/engine/sdi/advanceThreats.cjs
// SDI threat advancement: moves missiles/warheads toward targets each tick

const { hexDistanceAxial } = require("../utils/hexDistance.cjs");

/**
 * Simple greedy step toward target (replace with pathfinder later if needed)
 */
function stepToward(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Simple axial step (can be improved with proper hex pathfinding)
  const step = {
    x: from.x + (dx !== 0 ? Math.sign(dx) : 0),
    y: from.y + (dy !== 0 ? Math.sign(dy) : 0),
  };
  return step;
}

/**
 * Advance threats (missiles/warheads) toward their targets
 * @param {Object} params
 * @param {Object} params.state - Engine state (fighters, positions)
 * @param {Object} params.ruleset - Ruleset (for threat detection)
 * @returns {Object} { ok: boolean, events: Array }
 */
module.exports = function advanceThreats({ state, ruleset }) {
  const events = [];

  for (const t of state.fighters || []) {
    // Detect threats (missiles, warheads, etc.)
    const kind = String(t?.kind || "").toLowerCase();
    if (kind !== "missile" && kind !== "warhead" && kind !== "threat" && kind !== "decoy") {
      continue;
    }

    const pos = state.positions?.[t.id];
    if (!pos || !t.targetHex) continue;

    // Get speed (hexes per tick)
    const speed = t.speedHexPerTick ?? 2;
    let cur = { x: pos.x, y: pos.y };

    // Move up to speed hexes toward target
    for (let i = 0; i < speed; i++) {
      const dist = hexDistanceAxial(cur, t.targetHex);
      if (dist === 0) break; // Reached target
      cur = stepToward(cur, t.targetHex);
    }

    // Emit movement event
    events.push({
      type: "HEX_MOVED",
      eid: t.id,
      x: cur.x,
      y: cur.y,
    });

    // Terminal impact check
    const finalDist = hexDistanceAxial(cur, t.targetHex);
    if (finalDist === 0) {
      events.push({
        type: "IMPACT_OCCURRED",
        threatId: t.id,
        at: cur,
        targetHex: t.targetHex,
      });
    }
  }

  return { ok: true, events };
};


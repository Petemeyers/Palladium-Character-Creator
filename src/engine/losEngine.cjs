// src/engine/losEngine.cjs
const { hexLine } = require("./utils/hexLine.cjs");

function keyOf(h) {
  return `${h.x},${h.y}`;
}

// Flexible: decide if a hex blocks LOS
function isOpaqueHex(state, h) {
  const k = keyOf(h);

  // Common shapes:
  // 1) state.opaqueHexes: Set or object map
  if (state.opaqueHexes instanceof Set) return state.opaqueHexes.has(k);
  if (state.opaqueHexes && state.opaqueHexes[k]) return true;

  // 2) state.map.cells[k] -> { blocksLos: true }
  const cell = state.map?.cells?.[k] || state.cells?.[k];
  if (cell && (cell.blocksLos || cell.opaque)) return true;

  // 3) terrain dictionary
  const t = state.terrain?.[k];
  if (t && (t.blocksLos || t.opaque)) return true;

  return false;
}

// Flexible: cover sources (trees/walls/rocks). Can be opaque or just cover.
function coverValue(state, h) {
  const k = keyOf(h);

  // explicit cover map
  if (state.coverHexes) {
    if (typeof state.coverHexes[k] === "number") return state.coverHexes[k]; // 1..3
    if (state.coverHexes[k]) return 2;
  }

  const cell = state.map?.cells?.[k] || state.cells?.[k];
  if (cell && typeof cell.cover === "number") return cell.cover;
  if (cell && cell.cover) return 2;

  const t = state.terrain?.[k];
  if (t && typeof t.cover === "number") return t.cover;
  if (t && t.cover) return 2;

  // opaque terrain counts as heavy cover at minimum
  if (isOpaqueHex(state, h)) return 3;

  return 0;
}

/**
 * LOS: true if no opaque hex exists on the line excluding endpoints.
 */
function hasLineOfSight(state, from, to) {
  const line = hexLine(from, to);
  if (line.length <= 2) return true;

  // exclude start+end hex
  for (let i = 1; i < line.length - 1; i++) {
    if (isOpaqueHex(state, line[i])) return false;
  }
  return true;
}

/**
 * Cover model (simple, stable, good enough):
 * Look at the last 2 hexes before the target along the LOS line.
 * If either has cover/opaque, apply cover penalty level.
 *
 * Returns:
 * { level: 0|1|2|3, penalty: 0|1|2|4, samples:[...] }
 */
function computeCover(state, from, to) {
  const line = hexLine(from, to);
  if (line.length <= 2) return { level: 0, penalty: 0, samples: [] };

  // last hex before target
  const a = line[line.length - 2];
  // second last before target
  const b = line.length >= 3 ? line[line.length - 3] : null;

  const aCover = coverValue(state, a);
  const bCover = b ? coverValue(state, b) : 0;

  // pick strongest cover signal near target
  const level = Math.max(aCover, bCover);

  // translate level to Medieval Combat Simulator-ish penalty
  // tweak as desired:
  // 1 = light (-1), 2 = medium (-2), 3 = heavy (-4)
  const penalty = level === 1 ? 1 : level === 2 ? 2 : level >= 3 ? 4 : 0;

  return {
    level,
    penalty,
    samples: [
      { hex: a, cover: aCover },
      b ? { hex: b, cover: bCover } : null,
    ].filter(Boolean),
  };
}

module.exports = {
  hasLineOfSight,
  computeCover,
};


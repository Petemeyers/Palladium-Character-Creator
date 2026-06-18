// src/engine/losElevationEngine.cjs
const { hexLine, hexDistance } = require("./utils/hexLine.cjs");
const { getAltitude } = require("./utils/getAltitude.cjs");

// ---- Ground elevation ----

function getHexGroundHeight(state, h) {
  const k = `${h.x},${h.y}`;

  // Priority: explicit heights map
  if (state.heights && typeof state.heights[k] === "number") {
    return Math.floor(state.heights[k]);
  }

  // Or inside cells
  const cell = state.map?.cells?.[k] || state.cells?.[k];
  if (cell && typeof cell.height === "number") {
    return Math.floor(cell.height);
  }

  // Or terrain
  const t = state.terrain?.[k];
  if (t && typeof t.height === "number") {
    return Math.floor(t.height);
  }

  return 0; // default flat
}

// ---- Block height (vertical objects) ----

function getHexBlockHeight(state, h) {
  const k = `${h.x},${h.y}`;

  // Priority: explicit blocksLosHeight map
  if (state.blocksLosHeight && typeof state.blocksLosHeight[k] === "number") {
    return Math.floor(state.blocksLosHeight[k]);
  }

  // Or inside cells
  const cell = state.map?.cells?.[k] || state.cells?.[k];
  if (cell) {
    if (typeof cell.blocksLosHeight === "number") return Math.floor(cell.blocksLosHeight);
    if (cell.blocksLos || cell.opaque) return 2; // default opaque
    if (typeof cell.cover === "number") return cell.cover;
  }

  // Or terrain
  const t = state.terrain?.[k];
  if (t) {
    if (typeof t.blocksLosHeight === "number") return Math.floor(t.blocksLosHeight);
    if (t.blocksLos || t.opaque) return 2;
    if (typeof t.cover === "number") return t.cover;
  }

  // If using old opaqueHexes
  if (state.opaqueHexes instanceof Set && state.opaqueHexes.has(k)) return 3;
  if (state.opaqueHexes && state.opaqueHexes[k]) return 3;

  return 0;
}

function getUnitBaseHeight(state, entityId) {
  const f = state.fighters?.find(x => x.id === entityId);
  // "height" is the combatant height in "levels" (not feet) for LOS purposes
  // Defaults: man-sized = 1, large = 2, heavy = 3+
  return (f?.sizeHeight ?? f?.losHeight ?? 1);
}

// Eye height = ground + unit base height + altitude (flying units)
function getEyeHeight(state, entityId, pos) {
  const ground = getHexGroundHeight(state, pos);
  const body = getUnitBaseHeight(state, entityId);
  const alt = getAltitude(state, entityId); // 0 if not flying
  return ground + body + alt;
}

// ---- Core math ----

// Linear interpolation helper
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Elevation-aware LOS:
 * - Build hex line from fromHex to toHex
 * - Ray goes from shooter's eye height to target's eye height
 * - Any intervening hex blocks if (groundHeight + blockHeight) > rayHeightAtThatHex
 *
 * Returns { los:boolean, blockedAt?:{x,y}, trace:[...] }
 */
function hasLineOfSightElevation(state, { fromHex, toHex, fromId, toId, extra = {} }) {
  const line = hexLine(fromHex, toHex);
  const dist = Math.max(1, hexDistance(fromHex, toHex));

  // endpoints
  const fromEye = extra.fromEyeHeight ?? getEyeHeight(state, fromId, fromHex);
  const toEye = extra.toEyeHeight ?? getEyeHeight(state, toId, toHex);

  // If adjacent, always LOS (you can still change this if you want walls to block adjacent)
  if (line.length <= 2) return { los: true, trace: [] };

  const trace = [];

  // Check each intervening hex
  for (let i = 1; i < line.length - 1; i++) {
    const h = line[i];
    const t = i / dist; // how far along the ray [0..1]

    const rayH = lerp(fromEye, toEye, t);

    const ground = getHexGroundHeight(state, h);
    const block = getHexBlockHeight(state, h);

    const top = ground + block;

    trace.push({
      hex: h,
      t,
      rayH,
      ground,
      block,
      top,
      blocks: top > rayH,
    });

    if (top > rayH) {
      return { los: false, blockedAt: h, trace };
    }
  }

  return { los: true, trace };
}

/**
 * Optional: elevation-aware cover near target.
 * If hex before target has block height >= ray height near end, treat as heavy cover.
 */
function computeCoverElevation(state, { fromHex, toHex, fromId, toId, extra = {} }) {
  const line = hexLine(fromHex, toHex);
  const dist = Math.max(1, hexDistance(fromHex, toHex));

  if (line.length <= 2) return { level: 0, penalty: 0, samples: [] };

  const fromEye = extra.fromEyeHeight ?? getEyeHeight(state, fromId, fromHex);
  const toEye = extra.toEyeHeight ?? getEyeHeight(state, toId, toHex);

  const a = line[line.length - 2]; // last before target
  const b = line.length >= 3 ? line[line.length - 3] : null;

  function sample(hex, iIndex) {
    const t = iIndex / dist;
    const rayH = lerp(fromEye, toEye, t);
    const ground = getHexGroundHeight(state, hex);
    const block = getHexBlockHeight(state, hex);
    const top = ground + block;
    return { hex, rayH, ground, block, top };
  }

  const aIdx = line.length - 2;
  const bIdx = line.length - 3;

  const sa = sample(a, aIdx);
  const sb = b ? sample(b, bIdx) : null;

  // Convert "how much it intrudes" into 0..3
  function levelFor(s) {
    if (!s) return 0;
    const intrude = s.top - s.rayH;
    if (intrude <= 0) return 0;
    if (intrude < 0.5) return 1;   // light
    if (intrude < 1.5) return 2;   // medium
    return 3;                      // heavy
  }

  const lvl = Math.max(levelFor(sa), levelFor(sb));

  const targetAlt = getAltitude(state, toId);

  // If target is elevated, cover near them matters less.
  // Simple rule: if altitude >= 2, reduce cover one step.
  let adjLevel = lvl;
  if (targetAlt >= 2 && adjLevel > 0) adjLevel -= 1;

  const penalty = adjLevel === 1 ? 1 : adjLevel === 2 ? 2 : adjLevel === 3 ? 4 : 0;

  return { level: adjLevel, penalty, samples: [sa, sb].filter(Boolean), rawLevel: lvl };
}

module.exports = {
  hasLineOfSightElevation,
  computeCoverElevation,
};


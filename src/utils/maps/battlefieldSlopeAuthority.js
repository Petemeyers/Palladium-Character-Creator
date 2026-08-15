const toFinite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const normalizeText = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

export const BATTLEFIELD_SLOPE_TRANSITIONS = Object.freeze({
  FLAT: "flat",
  SLOPE: "slope",
  STEEP_SLOPE: "steep-slope",
  CLIFF: "cliff",
  WALL: "wall",
  BOUNDARY: "boundary",
});

export const BATTLEFIELD_HEX_DIRECTIONS = Object.freeze([
  Object.freeze({ index: 0, key: "E", label: "East", dq: 1, dr: 0, opposite: 3 }),
  Object.freeze({ index: 1, key: "SE", label: "Southeast", dq: 0, dr: 1, opposite: 4 }),
  Object.freeze({ index: 2, key: "SW", label: "Southwest", dq: -1, dr: 1, opposite: 5 }),
  Object.freeze({ index: 3, key: "W", label: "West", dq: -1, dr: 0, opposite: 0 }),
  Object.freeze({ index: 4, key: "NW", label: "Northwest", dq: 0, dr: -1, opposite: 1 }),
  Object.freeze({ index: 5, key: "NE", label: "Northeast", dq: 1, dr: -1, opposite: 2 }),
]);

const TERRAIN_SLOPE_PROFILES = Object.freeze({
  grass: Object.freeze({ allowSlope: true, allowSteepSlope: true }),
  dirt: Object.freeze({ allowSlope: true, allowSteepSlope: true }),
  mud: Object.freeze({ allowSlope: true, allowSteepSlope: false }),
  rubble: Object.freeze({ allowSlope: true, allowSteepSlope: true }),
  forest: Object.freeze({ allowSlope: true, allowSteepSlope: true }),
  rock: Object.freeze({ allowSlope: true, allowSteepSlope: true }),
  sand: Object.freeze({ allowSlope: true, allowSteepSlope: false }),
  road: Object.freeze({ allowSlope: true, allowSteepSlope: false }),
  hill: Object.freeze({ allowSlope: true, allowSteepSlope: true }),
  water: Object.freeze({ allowSlope: false, allowSteepSlope: false }),
});

export const SLOPE_MOVEMENT_PROFILE = Object.freeze({
  [BATTLEFIELD_SLOPE_TRANSITIONS.FLAT]: Object.freeze({
    extraUphillFeet: 0,
    extraDownhillFeet: 0,
    staminaCost: 0,
    blocksCharge: false,
  }),
  [BATTLEFIELD_SLOPE_TRANSITIONS.SLOPE]: Object.freeze({
    extraUphillFeet: 2.5,
    extraDownhillFeet: 0,
    staminaCost: 0,
    blocksCharge: false,
  }),
  [BATTLEFIELD_SLOPE_TRANSITIONS.STEEP_SLOPE]: Object.freeze({
    extraUphillFeet: 5,
    extraDownhillFeet: 2.5,
    staminaCost: 1,
    blocksCharge: true,
  }),
  [BATTLEFIELD_SLOPE_TRANSITIONS.CLIFF]: Object.freeze({
    extraUphillFeet: 10,
    extraDownhillFeet: 5,
    staminaCost: 2,
    blocksCharge: true,
  }),
  [BATTLEFIELD_SLOPE_TRANSITIONS.WALL]: Object.freeze({
    extraUphillFeet: 10,
    extraDownhillFeet: 5,
    staminaCost: 2,
    blocksCharge: true,
  }),
  [BATTLEFIELD_SLOPE_TRANSITIONS.BOUNDARY]: Object.freeze({
    extraUphillFeet: 0,
    extraDownhillFeet: 0,
    staminaCost: 0,
    blocksCharge: true,
  }),
});

export function getBattlefieldCellHeightUnits(cell = {}) {
  return toFinite(cell.height ?? cell.elevation ?? cell.elev, 0);
}

export function getBattlefieldCellTerrainKey(cell = {}) {
  return normalizeText(
    cell.visualTerrain ||
    cell.terrainType ||
    cell.terrain ||
    cell.type ||
    "grass"
  ) || "grass";
}

export function offsetToSlopeAxial(col = 0, row = 0) {
  const normalizedCol = toFinite(col, 0);
  const normalizedRow = toFinite(row, 0);
  return {
    q: normalizedCol - (normalizedRow - (normalizedRow & 1)) / 2,
    r: normalizedRow,
  };
}

export function slopeAxialToOffset(q = 0, r = 0) {
  const normalizedQ = toFinite(q, 0);
  const normalizedR = toFinite(r, 0);
  return {
    x: normalizedQ + (normalizedR - (normalizedR & 1)) / 2,
    y: normalizedR,
  };
}

export function getBattlefieldDirection(direction) {
  if (direction && typeof direction === "object") {
    if (Number.isInteger(direction.index)) {
      return BATTLEFIELD_HEX_DIRECTIONS[((direction.index % 6) + 6) % 6];
    }
    if (direction.key) {
      const key = String(direction.key).trim().toUpperCase();
      return BATTLEFIELD_HEX_DIRECTIONS.find((entry) => entry.key === key) || null;
    }
  }
  if (typeof direction === "number" && Number.isInteger(direction)) {
    return BATTLEFIELD_HEX_DIRECTIONS[((direction % 6) + 6) % 6];
  }
  const key = String(direction || "").trim().toUpperCase();
  return BATTLEFIELD_HEX_DIRECTIONS.find((entry) => entry.key === key) || null;
}

export function getBattlefieldAxialNeighbor(position = {}, direction = 0) {
  const dir = getBattlefieldDirection(direction);
  if (!dir) return null;
  return {
    q: toFinite(position.q, 0) + dir.dq,
    r: toFinite(position.r, 0) + dir.dr,
  };
}

export function getBattlefieldNeighborOffset(position = {}, direction = 0) {
  const dir = getBattlefieldDirection(direction);
  if (!dir) return null;
  const axial = Number.isFinite(Number(position.q)) && Number.isFinite(Number(position.r))
    ? { q: Number(position.q), r: Number(position.r) }
    : offsetToSlopeAxial(position.x, position.y);
  return slopeAxialToOffset(axial.q + dir.dq, axial.r + dir.dr);
}

export function getBattlefieldDirectionBetween(from = {}, to = {}) {
  if (!from || !to) return null;
  const fromAxial = Number.isFinite(Number(from.q)) && Number.isFinite(Number(from.r))
    ? { q: Number(from.q), r: Number(from.r) }
    : offsetToSlopeAxial(from.x, from.y);
  const toAxial = Number.isFinite(Number(to.q)) && Number.isFinite(Number(to.r))
    ? { q: Number(to.q), r: Number(to.r) }
    : offsetToSlopeAxial(to.x, to.y);
  const dq = toAxial.q - fromAxial.q;
  const dr = toAxial.r - fromAxial.r;
  return BATTLEFIELD_HEX_DIRECTIONS.find((entry) => entry.dq === dq && entry.dr === dr) || null;
}

function normalizeTransitionType(value) {
  const key = normalizeText(typeof value === "object" ? value?.type : value);
  if (["flat", "level"].includes(key)) return BATTLEFIELD_SLOPE_TRANSITIONS.FLAT;
  if (["slope", "gentle-slope", "ramp"].includes(key)) return BATTLEFIELD_SLOPE_TRANSITIONS.SLOPE;
  if (["steep", "steep-slope", "rough-slope"].includes(key)) return BATTLEFIELD_SLOPE_TRANSITIONS.STEEP_SLOPE;
  if (["cliff", "drop", "ledge"].includes(key)) return BATTLEFIELD_SLOPE_TRANSITIONS.CLIFF;
  if (["wall", "vertical-wall"].includes(key)) return BATTLEFIELD_SLOPE_TRANSITIONS.WALL;
  if (["boundary", "edge"].includes(key)) return BATTLEFIELD_SLOPE_TRANSITIONS.BOUNDARY;
  return null;
}

function getExplicitTransition(cell = {}, direction) {
  const dir = getBattlefieldDirection(direction);
  if (!dir) return null;
  const source =
    cell.edgeTransitions ||
    cell.edgeTransitionOverrides ||
    cell.slopeEdges ||
    cell.edges ||
    cell.gridCell?.edgeTransitions ||
    cell.gridCell?.edgeTransitionOverrides ||
    cell.gridCell?.slopeEdges ||
    cell.gridCell?.edges ||
    null;
  if (!source || typeof source !== "object") return null;
  return normalizeTransitionType(
    source[dir.key] ??
    source[dir.key.toLowerCase()] ??
    source[dir.index] ??
    source[String(dir.index)]
  );
}

const transitionPriority = Object.freeze({
  [BATTLEFIELD_SLOPE_TRANSITIONS.FLAT]: 0,
  [BATTLEFIELD_SLOPE_TRANSITIONS.SLOPE]: 1,
  [BATTLEFIELD_SLOPE_TRANSITIONS.STEEP_SLOPE]: 2,
  [BATTLEFIELD_SLOPE_TRANSITIONS.CLIFF]: 3,
  [BATTLEFIELD_SLOPE_TRANSITIONS.WALL]: 4,
  [BATTLEFIELD_SLOPE_TRANSITIONS.BOUNDARY]: 5,
});

function strongerTransition(left, right) {
  if (!left) return right;
  if (!right) return left;
  return (transitionPriority[right] ?? -1) > (transitionPriority[left] ?? -1)
    ? right
    : left;
}

function terrainSlopeProfile(cell = {}) {
  const key = getBattlefieldCellTerrainKey(cell);
  return TERRAIN_SLOPE_PROFILES[key] || TERRAIN_SLOPE_PROFILES.grass;
}

export function classifyBattlefieldEdgeTransition({
  cell = {},
  neighbor = null,
  direction = 0,
} = {}) {
  const dir = getBattlefieldDirection(direction);
  if (!dir) {
    return {
      type: BATTLEFIELD_SLOPE_TRANSITIONS.FLAT,
      direction: null,
      deltaHeightUnits: 0,
      absoluteDeltaHeightUnits: 0,
      fromHeightUnits: getBattlefieldCellHeightUnits(cell),
      toHeightUnits: getBattlefieldCellHeightUnits(neighbor || cell),
      automatic: true,
    };
  }

  const fromHeightUnits = getBattlefieldCellHeightUnits(cell);
  if (!neighbor) {
    return {
      type: BATTLEFIELD_SLOPE_TRANSITIONS.BOUNDARY,
      direction: dir,
      deltaHeightUnits: 0,
      absoluteDeltaHeightUnits: 0,
      fromHeightUnits,
      toHeightUnits: null,
      automatic: true,
      boundary: true,
    };
  }

  const toHeightUnits = getBattlefieldCellHeightUnits(neighbor);
  const deltaHeightUnits = toHeightUnits - fromHeightUnits;
  const absoluteDeltaHeightUnits = Math.abs(deltaHeightUnits);

  const ownOverride = getExplicitTransition(cell, dir);
  const neighborOverride = getExplicitTransition(neighbor, dir.opposite);
  const explicitType = strongerTransition(ownOverride, neighborOverride);
  if (explicitType) {
    return {
      type: explicitType,
      direction: dir,
      deltaHeightUnits,
      absoluteDeltaHeightUnits,
      fromHeightUnits,
      toHeightUnits,
      automatic: false,
      explicitType,
    };
  }

  if (absoluteDeltaHeightUnits < 0.001) {
    return {
      type: BATTLEFIELD_SLOPE_TRANSITIONS.FLAT,
      direction: dir,
      deltaHeightUnits,
      absoluteDeltaHeightUnits,
      fromHeightUnits,
      toHeightUnits,
      automatic: true,
    };
  }

  const ownProfile = terrainSlopeProfile(cell);
  const neighborProfile = terrainSlopeProfile(neighbor);
  const bothSlope = ownProfile.allowSlope && neighborProfile.allowSlope;
  const bothSteep = ownProfile.allowSteepSlope && neighborProfile.allowSteepSlope;

  let type = BATTLEFIELD_SLOPE_TRANSITIONS.CLIFF;
  if (bothSlope && absoluteDeltaHeightUnits <= 1) {
    type = BATTLEFIELD_SLOPE_TRANSITIONS.SLOPE;
  } else if (bothSlope && bothSteep && absoluteDeltaHeightUnits <= 2) {
    type = BATTLEFIELD_SLOPE_TRANSITIONS.STEEP_SLOPE;
  }

  return {
    type,
    direction: dir,
    deltaHeightUnits,
    absoluteDeltaHeightUnits,
    fromHeightUnits,
    toHeightUnits,
    automatic: true,
  };
}

export function getBattlefieldMapCell(mapDefinition = {}, position = {}) {
  const grid = mapDefinition?.grid;
  if (!Array.isArray(grid)) return null;
  const offset = Number.isFinite(Number(position.x)) && Number.isFinite(Number(position.y))
    ? { x: Number(position.x), y: Number(position.y) }
    : slopeAxialToOffset(position.q, position.r);
  if (!Number.isInteger(offset.x) || !Number.isInteger(offset.y)) return null;
  return grid?.[offset.y]?.[offset.x] || null;
}

export function getBattlefieldEdgeTransition(mapDefinition = {}, from = {}, direction = 0) {
  const dir = getBattlefieldDirection(direction);
  if (!dir) return null;
  const cell = getBattlefieldMapCell(mapDefinition, from);
  if (!cell) return null;
  const neighborPosition = getBattlefieldNeighborOffset(from, dir);
  const neighbor = getBattlefieldMapCell(mapDefinition, neighborPosition);
  return classifyBattlefieldEdgeTransition({ cell, neighbor, direction: dir });
}

export function getBattlefieldCellEdgeTransitions(mapDefinition = {}, position = {}) {
  return BATTLEFIELD_HEX_DIRECTIONS.map((direction) =>
    getBattlefieldEdgeTransition(mapDefinition, position, direction)
  );
}

export function resolveTileEdgeTransitions(tile = {}, neighborData = new Map()) {
  return BATTLEFIELD_HEX_DIRECTIONS.map((direction) => {
    const neighborKey = `${toFinite(tile.q, 0) + direction.dq},${toFinite(tile.r, 0) + direction.dr}`;
    const neighbor = neighborData?.get?.(neighborKey) || null;
    return classifyBattlefieldEdgeTransition({
      cell: tile,
      neighbor,
      direction,
    });
  });
}

export function resolveBattlefieldSlopeTraversal({
  mapDefinition = null,
  from = null,
  to = null,
  movementMode = "walk",
  climbAuthorized = false,
} = {}) {
  const direction = getBattlefieldDirectionBetween(from, to);
  if (!direction || !mapDefinition) {
    return {
      accepted: true,
      type: BATTLEFIELD_SLOPE_TRANSITIONS.FLAT,
      direction,
      extraDistanceFeet: 0,
      staminaCost: 0,
      requiresClimb: false,
      blocksCharge: false,
      uphill: false,
      downhill: false,
    };
  }

  const transition = getBattlefieldEdgeTransition(mapDefinition, from, direction);
  if (!transition) {
    return {
      accepted: true,
      type: BATTLEFIELD_SLOPE_TRANSITIONS.FLAT,
      direction,
      extraDistanceFeet: 0,
      staminaCost: 0,
      requiresClimb: false,
      blocksCharge: false,
      uphill: false,
      downhill: false,
    };
  }

  const type = transition.type;
  const profile = SLOPE_MOVEMENT_PROFILE[type] || SLOPE_MOVEMENT_PROFILE.flat;
  const mode = normalizeText(movementMode || "walk");
  const flying = /fly|flight/.test(mode);
  const uphill = transition.deltaHeightUnits > 0;
  const downhill = transition.deltaHeightUnits < 0;
  const requiresClimb = [
    BATTLEFIELD_SLOPE_TRANSITIONS.CLIFF,
    BATTLEFIELD_SLOPE_TRANSITIONS.WALL,
  ].includes(type);

  if (type === BATTLEFIELD_SLOPE_TRANSITIONS.BOUNDARY) {
    return {
      accepted: false,
      reason: "battlefield-boundary",
      ...transition,
      extraDistanceFeet: 0,
      staminaCost: 0,
      requiresClimb: false,
      blocksCharge: true,
      uphill,
      downhill,
    };
  }

  if (flying) {
    return {
      accepted: true,
      ...transition,
      extraDistanceFeet: 0,
      staminaCost: 0,
      requiresClimb: false,
      blocksCharge: false,
      uphill,
      downhill,
    };
  }

  if (requiresClimb && !climbAuthorized) {
    return {
      accepted: false,
      reason: type === BATTLEFIELD_SLOPE_TRANSITIONS.WALL
        ? "wall-requires-climb"
        : "cliff-requires-climb",
      ...transition,
      extraDistanceFeet: 0,
      staminaCost: 0,
      requiresClimb: true,
      blocksCharge: true,
      uphill,
      downhill,
    };
  }

  const extraDistanceFeet = uphill
    ? profile.extraUphillFeet
    : downhill
      ? profile.extraDownhillFeet
      : 0;

  return {
    accepted: true,
    ...transition,
    extraDistanceFeet,
    staminaCost: requiresClimb && climbAuthorized
      ? profile.staminaCost
      : type === BATTLEFIELD_SLOPE_TRANSITIONS.STEEP_SLOPE
        ? profile.staminaCost
        : 0,
    requiresClimb,
    blocksCharge: profile.blocksCharge,
    uphill,
    downhill,
  };
}

export default classifyBattlefieldEdgeTransition;

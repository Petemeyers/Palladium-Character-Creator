export const GRID_STRUCTURE_VERSION = 2;

export const GRID_STRUCTURE_MAP_TYPES = Object.freeze({
  HEX: "hex",
  SQUARE: "square",
});

export const GRID_STRUCTURE_KINDS = Object.freeze({
  WALL: "wall",
  DOOR: "door",
  WINDOW: "window",
  ARCHWAY: "archway",
  GATE: "gate",
  PALISADE: "palisade",
  FENCE: "fence",
});

export const GRID_STRUCTURE_MATERIALS = Object.freeze({
  STONE: "stone",
  DUNGEON_STONE: "dungeon-stone",
  WOOD: "wood",
  PLASTER: "plaster",
  BRICK: "brick",
  TIMBER: "timber",
});

export const SQUARE_STRUCTURE_DIRECTIONS = Object.freeze([
  Object.freeze({ key: "N", dx: 0, dy: -1, opposite: "S", label: "North" }),
  Object.freeze({ key: "E", dx: 1, dy: 0, opposite: "W", label: "East" }),
  Object.freeze({ key: "S", dx: 0, dy: 1, opposite: "N", label: "South" }),
  Object.freeze({ key: "W", dx: -1, dy: 0, opposite: "E", label: "West" }),
]);

// Canonical axial/Map Maker hex directions. These match the terrain slope
// authority and mapBuilder3D direction order.
export const HEX_STRUCTURE_DIRECTIONS = Object.freeze([
  Object.freeze({ key: "E", dx: 1, dy: 0, opposite: "W", label: "East", angleDeg: 0 }),
  Object.freeze({ key: "SE", dx: 0, dy: 1, opposite: "NW", label: "South East", angleDeg: 60 }),
  Object.freeze({ key: "SW", dx: -1, dy: 1, opposite: "NE", label: "South West", angleDeg: 120 }),
  Object.freeze({ key: "W", dx: -1, dy: 0, opposite: "E", label: "West", angleDeg: 180 }),
  Object.freeze({ key: "NW", dx: 0, dy: -1, opposite: "SE", label: "North West", angleDeg: 240 }),
  Object.freeze({ key: "NE", dx: 1, dy: -1, opposite: "SW", label: "North East", angleDeg: 300 }),
]);

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

export function normalizeGridStructureMapType(value) {
  return normalizeText(value) === GRID_STRUCTURE_MAP_TYPES.SQUARE
    ? GRID_STRUCTURE_MAP_TYPES.SQUARE
    : GRID_STRUCTURE_MAP_TYPES.HEX;
}

export function getGridStructureDirections(mapType) {
  return normalizeGridStructureMapType(mapType) === GRID_STRUCTURE_MAP_TYPES.SQUARE
    ? SQUARE_STRUCTURE_DIRECTIONS
    : HEX_STRUCTURE_DIRECTIONS;
}

export function getGridStructureDirection(mapType, value) {
  const key = String(value ?? "").trim().toUpperCase();
  return getGridStructureDirections(mapType).find((entry) => entry.key === key) || null;
}

export function getOppositeGridStructureDirection(mapType, value) {
  return getGridStructureDirection(mapType, value)?.opposite || null;
}

export function normalizeGridStructureKind(value) {
  const key = normalizeText(value || GRID_STRUCTURE_KINDS.WALL);
  return Object.values(GRID_STRUCTURE_KINDS).includes(key)
    ? key
    : GRID_STRUCTURE_KINDS.WALL;
}

export function normalizeGridStructureMaterial(value) {
  const key = normalizeText(value || GRID_STRUCTURE_MATERIALS.STONE);
  return Object.values(GRID_STRUCTURE_MATERIALS).includes(key)
    ? key
    : GRID_STRUCTURE_MATERIALS.STONE;
}

export function normalizeGridStructureEdge(edge = {}, mapType = "hex") {
  if (!edge || edge.enabled === false) return null;
  const kind = normalizeGridStructureKind(edge.kind || edge.type);
  const material = normalizeGridStructureMaterial(edge.material);
  const heightFeet = clamp(finite(edge.heightFeet, kind === "fence" ? 4 : kind === "palisade" ? 8 : 10), 2, 80);
  const thicknessFeet = clamp(finite(edge.thicknessFeet, kind === "fence" ? 0.25 : 0.5), 0.15, 4);
  const open = [GRID_STRUCTURE_KINDS.DOOR, GRID_STRUCTURE_KINDS.GATE].includes(kind)
    ? edge.open === true || edge.doorOpen === true || edge.gateOpen === true
    : false;

  const blocksMovement =
    kind === GRID_STRUCTURE_KINDS.ARCHWAY
      ? false
      : [GRID_STRUCTURE_KINDS.DOOR, GRID_STRUCTURE_KINDS.GATE].includes(kind)
        ? !open
        : true;

  const blocksLineOfSight =
    kind === GRID_STRUCTURE_KINDS.ARCHWAY ||
    kind === GRID_STRUCTURE_KINDS.WINDOW ||
    kind === GRID_STRUCTURE_KINDS.FENCE
      ? false
      : [GRID_STRUCTURE_KINDS.DOOR, GRID_STRUCTURE_KINDS.GATE].includes(kind)
        ? !open
        : true;

  return {
    ...edge,
    kind,
    type: kind,
    material,
    heightFeet,
    thicknessFeet,
    open,
    doorOpen: kind === GRID_STRUCTURE_KINDS.DOOR ? open : false,
    gateOpen: kind === GRID_STRUCTURE_KINDS.GATE ? open : false,
    blocksMovement,
    blocksLineOfSight,
    providesCover:
      kind === GRID_STRUCTURE_KINDS.FENCE
        ? "partial"
        : blocksLineOfSight
          ? "total"
          : "substantial",
    climbable:
      edge.climbable == null
        ? ![GRID_STRUCTURE_KINDS.DOOR, GRID_STRUCTURE_KINDS.GATE, GRID_STRUCTURE_KINDS.ARCHWAY].includes(kind)
        : edge.climbable === true,
    mapType: normalizeGridStructureMapType(mapType),
    gameplay: {
      ...(edge.gameplay || {}),
      structural: true,
      destructible: edge.gameplay?.destructible !== false,
      blocksMovement,
      blocksLineOfSight,
      material,
    },
    visual: {
      ...(edge.visual || {}),
      assetId: edge.visual?.assetId || edge.assetId || null,
      assetUrl: edge.visual?.assetUrl || edge.assetUrl || null,
      useProceduralFallback: edge.visual?.useProceduralFallback !== false,
    },
    metadata: {
      ...(edge.metadata || {}),
      structuralAuthority: "grid-edge-v2",
    },
  };
}

function cloneGrid(grid = []) {
  return (Array.isArray(grid) ? grid : []).map((row) =>
    Array.isArray(row)
      ? row.map((cell) => ({
          ...(cell || {}),
          walls: { ...(cell?.walls || {}) },
        }))
      : []
  );
}

function writeEdge(cell = {}, direction, edge, mapType) {
  const walls = { ...(cell.walls || {}) };
  if (edge) walls[direction] = normalizeGridStructureEdge(edge, mapType);
  else delete walls[direction];
  return {
    ...cell,
    walls,
    structureVersion: GRID_STRUCTURE_VERSION,
  };
}

export function getGridCellStructureEdge(cell = {}, direction, mapType = "hex") {
  const dir = getGridStructureDirection(mapType, direction);
  if (!dir) return null;
  return normalizeGridStructureEdge(cell?.walls?.[dir.key] || null, mapType);
}

export function getGridCellStructureEdges(cell = {}, mapType = "hex") {
  return Object.fromEntries(
    getGridStructureDirections(mapType).map(({ key }) => [
      key,
      getGridCellStructureEdge(cell, key, mapType),
    ])
  );
}

export function applyGridStructureEdgeEdit({
  grid,
  mapType = "hex",
  x,
  y,
  direction,
  edge = null,
  remove = false,
} = {}) {
  const normalizedMapType = normalizeGridStructureMapType(mapType);
  const dir = getGridStructureDirection(normalizedMapType, direction);
  const col = Number(x);
  const row = Number(y);
  if (
    !dir ||
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    !grid?.[row]?.[col]
  ) {
    return {
      accepted: false,
      reason: "invalid-grid-structure-edge",
      grid,
      changes: [],
    };
  }

  const next = cloneGrid(grid);
  const normalizedEdge = remove ? null : normalizeGridStructureEdge(edge || {}, normalizedMapType);
  next[row][col] = writeEdge(next[row][col], dir.key, normalizedEdge, normalizedMapType);
  const changes = [{ x: col, y: row, cell: next[row][col] }];

  const neighborX = col + dir.dx;
  const neighborY = row + dir.dy;
  if (next?.[neighborY]?.[neighborX]) {
    next[neighborY][neighborX] = writeEdge(
      next[neighborY][neighborX],
      dir.opposite,
      normalizedEdge,
      normalizedMapType
    );
    changes.push({ x: neighborX, y: neighborY, cell: next[neighborY][neighborX] });
  }

  return {
    accepted: true,
    reason: null,
    grid: next,
    changes,
    edge: normalizedEdge,
    direction: dir.key,
    neighborDirection: dir.opposite,
    mapType: normalizedMapType,
  };
}

export function deleteGridCellStructures({ grid, mapType = "hex", x, y } = {}) {
  const cell = grid?.[Number(y)]?.[Number(x)];
  if (!cell) return { accepted: false, reason: "grid-cell-not-found", grid, changes: [] };
  const directions = getGridStructureDirections(mapType)
    .map((entry) => entry.key)
    .filter((direction) => cell?.walls?.[direction]);
  if (!directions.length) return { accepted: false, reason: "no-structure-edges", grid, changes: [] };

  let nextGrid = grid;
  const changes = [];
  directions.forEach((direction) => {
    const result = applyGridStructureEdgeEdit({
      grid: nextGrid,
      mapType,
      x,
      y,
      direction,
      remove: true,
    });
    if (!result.accepted) return;
    nextGrid = result.grid;
    changes.push(...result.changes);
  });
  const byCell = new Map();
  changes.forEach((change) => byCell.set(`${change.x},${change.y}`, change));
  return { accepted: true, grid: nextGrid, changes: [...byCell.values()] };
}

export function gridStructureBlocksMovement(cell, direction, mapType = "hex") {
  return getGridCellStructureEdge(cell, direction, mapType)?.blocksMovement === true;
}

export function gridStructureBlocksLineOfSight(cell, direction, mapType = "hex") {
  return getGridCellStructureEdge(cell, direction, mapType)?.blocksLineOfSight === true;
}

export function shouldRenderGridStructureEdge({ mapType = "hex", direction, x, y, grid } = {}) {
  const normalizedMapType = normalizeGridStructureMapType(mapType);
  const dir = getGridStructureDirection(normalizedMapType, direction);
  if (!dir) return false;

  // One owner per shared edge. Positive half-directions own internal edges;
  // opposite directions render only when the neighbor lies outside the grid.
  const owners = normalizedMapType === "square"
    ? new Set(["E", "S"])
    : new Set(["E", "SE", "SW"]);
  if (owners.has(dir.key)) return true;

  const neighborX = Number(x) + dir.dx;
  const neighborY = Number(y) + dir.dy;
  return !grid?.[neighborY]?.[neighborX];
}

export function getGridStructure2DStyle(edge = null, mapType = "hex") {
  const normalized = normalizeGridStructureEdge(edge, mapType);
  if (!normalized) return null;
  switch (normalized.kind) {
    case GRID_STRUCTURE_KINDS.DOOR:
    case GRID_STRUCTURE_KINDS.GATE:
      return {
        stroke: normalized.open ? "#16a34a" : normalized.kind === GRID_STRUCTURE_KINDS.GATE ? "#7c2d12" : "#92400e",
        strokeWidth: 5,
        strokeDasharray: normalized.open ? "5 3" : null,
      };
    case GRID_STRUCTURE_KINDS.WINDOW:
      return { stroke: "#0284c7", strokeWidth: 4, strokeDasharray: "3 2" };
    case GRID_STRUCTURE_KINDS.ARCHWAY:
      return { stroke: "#ca8a04", strokeWidth: 4, strokeDasharray: "7 3" };
    case GRID_STRUCTURE_KINDS.PALISADE:
      return { stroke: "#6b3e22", strokeWidth: 6, strokeDasharray: "2 1" };
    case GRID_STRUCTURE_KINDS.FENCE:
      return { stroke: "#8b5a2b", strokeWidth: 3, strokeDasharray: "5 3" };
    case GRID_STRUCTURE_KINDS.WALL:
    default:
      return { stroke: "#1f2937", strokeWidth: 5, strokeDasharray: null };
  }
}

export default {
  applyGridStructureEdgeEdit,
  deleteGridCellStructures,
  getGridCellStructureEdge,
  getGridCellStructureEdges,
  getGridStructure2DStyle,
  getGridStructureDirection,
  getGridStructureDirections,
  getOppositeGridStructureDirection,
  gridStructureBlocksLineOfSight,
  gridStructureBlocksMovement,
  normalizeGridStructureEdge,
  normalizeGridStructureMapType,
  shouldRenderGridStructureEdge,
};

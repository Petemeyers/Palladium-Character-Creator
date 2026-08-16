export const SQUARE_STRUCTURE_DIRECTIONS = Object.freeze([
  Object.freeze({ key: "N", dx: 0, dy: -1, opposite: "S", label: "North" }),
  Object.freeze({ key: "E", dx: 1, dy: 0, opposite: "W", label: "East" }),
  Object.freeze({ key: "S", dx: 0, dy: 1, opposite: "N", label: "South" }),
  Object.freeze({ key: "W", dx: -1, dy: 0, opposite: "E", label: "West" }),
]);

export const SQUARE_STRUCTURE_KINDS = Object.freeze({
  WALL: "wall",
  DOOR: "door",
  WINDOW: "window",
  ARCHWAY: "archway",
});

export const SQUARE_STRUCTURE_MATERIALS = Object.freeze({
  STONE: "stone",
  DUNGEON_STONE: "dungeon-stone",
  WOOD: "wood",
  PLASTER: "plaster",
  BRICK: "brick",
});

export const SQUARE_WINDOW_STYLES = Object.freeze({
  OPEN: "open",
  SHUTTERED: "shuttered",
  LEADED: "leaded",
  STAINED: "stained",
});

export const DEFAULT_SQUARE_WALL_HEIGHT_FEET = 10;
export const DEFAULT_SQUARE_WALL_THICKNESS_FEET = 0.5;

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

export function normalizeSquareStructureDirection(value) {
  const key = String(value ?? "").trim().toUpperCase();
  return SQUARE_STRUCTURE_DIRECTIONS.some((entry) => entry.key === key)
    ? key
    : null;
}

export function getOppositeSquareStructureDirection(value) {
  const key = normalizeSquareStructureDirection(value);
  return SQUARE_STRUCTURE_DIRECTIONS.find((entry) => entry.key === key)?.opposite || null;
}

export function getSquareStructureDirection(value) {
  const key = normalizeSquareStructureDirection(value);
  return SQUARE_STRUCTURE_DIRECTIONS.find((entry) => entry.key === key) || null;
}

export function normalizeSquareStructureKind(value) {
  const key = String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return Object.values(SQUARE_STRUCTURE_KINDS).includes(key)
    ? key
    : SQUARE_STRUCTURE_KINDS.WALL;
}

export function normalizeSquareStructureMaterial(value) {
  const key = String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return Object.values(SQUARE_STRUCTURE_MATERIALS).includes(key)
    ? key
    : SQUARE_STRUCTURE_MATERIALS.STONE;
}

export function normalizeSquareWindowStyle(value) {
  const key = String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return Object.values(SQUARE_WINDOW_STYLES).includes(key)
    ? key
    : SQUARE_WINDOW_STYLES.OPEN;
}

export function normalizeSquareStructureEdge(edge = {}) {
  if (!edge || edge.enabled === false) return null;

  const kind = normalizeSquareStructureKind(edge.kind || edge.type);
  const material = normalizeSquareStructureMaterial(edge.material);
  const heightFeet = clamp(
    finite(edge.heightFeet, DEFAULT_SQUARE_WALL_HEIGHT_FEET),
    3,
    60
  );
  const thicknessFeet = clamp(
    finite(edge.thicknessFeet, DEFAULT_SQUARE_WALL_THICKNESS_FEET),
    0.25,
    3
  );

  const doorOpen = kind === SQUARE_STRUCTURE_KINDS.DOOR
    ? edge.open === true || edge.doorOpen === true
    : false;

  const blocksMovement =
    kind === SQUARE_STRUCTURE_KINDS.ARCHWAY
      ? false
      : kind === SQUARE_STRUCTURE_KINDS.DOOR
        ? !doorOpen
        : true;

  const blocksLineOfSight =
    kind === SQUARE_STRUCTURE_KINDS.ARCHWAY ||
    kind === SQUARE_STRUCTURE_KINDS.WINDOW
      ? false
      : kind === SQUARE_STRUCTURE_KINDS.DOOR
        ? !doorOpen
        : true;

  const windowStyle = kind === SQUARE_STRUCTURE_KINDS.WINDOW
    ? normalizeSquareWindowStyle(edge.windowStyle || edge.visual?.windowStyle)
    : null;

  const visual = {
    ...(edge.visual || {}),
    assetId: edge.visual?.assetId || edge.assetId || null,
    assetUrl: edge.visual?.assetUrl || edge.assetUrl || null,
    assetScale: clamp(finite(edge.visual?.assetScale ?? edge.assetScale, 1), 0.05, 20),
    useProceduralFallback: edge.visual?.useProceduralFallback !== false,
    ...(windowStyle ? {
      windowStyle,
      glass:
        edge.visual?.glass == null
          ? [SQUARE_WINDOW_STYLES.LEADED, SQUARE_WINDOW_STYLES.STAINED].includes(windowStyle)
          : edge.visual.glass === true,
      shutters:
        edge.visual?.shutters == null
          ? windowStyle === SQUARE_WINDOW_STYLES.SHUTTERED
          : edge.visual.shutters === true,
    } : {}),
  };

  return {
    kind,
    type: kind,
    material,
    heightFeet,
    thicknessFeet,
    open: doorOpen,
    doorOpen,
    blocksMovement,
    blocksLineOfSight,
    providesCover:
      kind === SQUARE_STRUCTURE_KINDS.WINDOW
        ? "substantial"
        : blocksLineOfSight
          ? "total"
          : "partial",
    doorWidthFeet: clamp(finite(edge.doorWidthFeet, 3), 2, 4.5),
    doorHeightFeet: clamp(
      finite(edge.doorHeightFeet, Math.min(7, heightFeet - 0.5)),
      5,
      Math.max(5, heightFeet)
    ),
    windowWidthFeet: clamp(finite(edge.windowWidthFeet, 2.5), 1, 4),
    windowHeightFeet: clamp(finite(edge.windowHeightFeet, 3), 1, 5),
    windowSillFeet: clamp(finite(edge.windowSillFeet, 3), 1, Math.max(1, heightFeet - 2)),
    windowStyle,
    visual,
    gameplay: {
      ...(edge.gameplay || {}),
      destructible: edge.gameplay?.destructible !== false,
      material,
      structural: true,
    },
    metadata: {
      ...(edge.metadata || {}),
      structuralAuthority: "square-edge-v1",
    },
  };
}

export function getSquareCellStructureEdge(cell = {}, direction) {
  const key = normalizeSquareStructureDirection(direction);
  if (!key) return null;
  return normalizeSquareStructureEdge(cell?.walls?.[key] || null);
}

export function getSquareCellStructureEdges(cell = {}) {
  return Object.fromEntries(
    SQUARE_STRUCTURE_DIRECTIONS.map(({ key }) => [
      key,
      getSquareCellStructureEdge(cell, key),
    ])
  );
}

function cloneGrid(grid = []) {
  return (Array.isArray(grid) ? grid : []).map((row) =>
    Array.isArray(row) ? row.map((cell) => ({
      ...(cell || {}),
      walls: { ...(cell?.walls || {}) },
    })) : []
  );
}

function writeCellEdge(cell = {}, direction, edge) {
  const key = normalizeSquareStructureDirection(direction);
  if (!key) return cell;
  const walls = { ...(cell.walls || {}) };
  if (edge) walls[key] = normalizeSquareStructureEdge(edge);
  else delete walls[key];

  return {
    ...cell,
    walls,
    structureVersion: 1,
  };
}

export function applySquareStructureEdgeEdit({
  grid,
  x,
  y,
  direction,
  edge = null,
  remove = false,
} = {}) {
  const dir = getSquareStructureDirection(direction);
  const col = Number(x);
  const row = Number(y);

  if (
    !dir ||
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    !Array.isArray(grid?.[row]) ||
    !grid[row][col]
  ) {
    return {
      accepted: false,
      reason: "invalid-square-structure-edge",
      grid,
      changes: [],
    };
  }

  const next = cloneGrid(grid);
  const normalizedEdge = remove ? null : normalizeSquareStructureEdge(edge || {});
  next[row][col] = writeCellEdge(next[row][col], dir.key, normalizedEdge);

  const neighborX = col + dir.dx;
  const neighborY = row + dir.dy;
  const changes = [
    { x: col, y: row, cell: next[row][col] },
  ];

  if (next?.[neighborY]?.[neighborX]) {
    next[neighborY][neighborX] = writeCellEdge(
      next[neighborY][neighborX],
      dir.opposite,
      normalizedEdge
    );
    changes.push({
      x: neighborX,
      y: neighborY,
      cell: next[neighborY][neighborX],
    });
  }

  return {
    accepted: true,
    reason: null,
    grid: next,
    changes,
    edge: normalizedEdge,
    direction: dir.key,
    neighborDirection: dir.opposite,
  };
}

export function squareStructureBlocksMovement(cell, direction) {
  return getSquareCellStructureEdge(cell, direction)?.blocksMovement === true;
}

export function squareStructureBlocksLineOfSight(cell, direction) {
  return getSquareCellStructureEdge(cell, direction)?.blocksLineOfSight === true;
}

export function isSquareStructureDoor(cell, direction) {
  return getSquareCellStructureEdge(cell, direction)?.kind === SQUARE_STRUCTURE_KINDS.DOOR;
}

export function isSquareStructureDoorOpen(cell, direction) {
  const edge = getSquareCellStructureEdge(cell, direction);
  return edge?.kind === SQUARE_STRUCTURE_KINDS.DOOR && edge.open === true;
}

export function shouldRenderSquareStructureEdge({
  direction,
  x,
  y,
} = {}) {
  const key = normalizeSquareStructureDirection(direction);
  if (!key) return false;

  // Internal edge ownership:
  // E and S own their shared edge. N and W render only at the map boundary.
  if (key === "E" || key === "S") return true;
  if (key === "N") return Number(y) === 0;
  if (key === "W") return Number(x) === 0;
  return false;
}

export function getSquareStructure2DStyle(edge = null) {
  const normalized = normalizeSquareStructureEdge(edge);
  if (!normalized) return null;

  switch (normalized.kind) {
    case SQUARE_STRUCTURE_KINDS.DOOR:
      return {
        stroke: normalized.open ? "#16a34a" : "#92400e",
        strokeWidth: 4,
        strokeDasharray: normalized.open ? "4 3" : null,
      };
    case SQUARE_STRUCTURE_KINDS.WINDOW:
      return {
        stroke:
          normalized.windowStyle === SQUARE_WINDOW_STYLES.STAINED
            ? "#7c3aed"
            : normalized.windowStyle === SQUARE_WINDOW_STYLES.SHUTTERED
              ? "#78350f"
              : "#0284c7",
        strokeWidth: 4,
        strokeDasharray:
          normalized.windowStyle === SQUARE_WINDOW_STYLES.SHUTTERED
            ? null
            : "3 2",
      };
    case SQUARE_STRUCTURE_KINDS.ARCHWAY:
      return {
        stroke: "#ca8a04",
        strokeWidth: 4,
        strokeDasharray: "7 3",
      };
    case SQUARE_STRUCTURE_KINDS.WALL:
    default:
      return {
        stroke: "#1f2937",
        strokeWidth: 5,
        strokeDasharray: null,
      };
  }
}

export default {
  applySquareStructureEdgeEdit,
  getOppositeSquareStructureDirection,
  getSquareCellStructureEdge,
  getSquareCellStructureEdges,
  getSquareStructure2DStyle,
  normalizeSquareStructureDirection,
  normalizeSquareStructureEdge,
  normalizeSquareWindowStyle,
  shouldRenderSquareStructureEdge,
  squareStructureBlocksLineOfSight,
  squareStructureBlocksMovement,
};

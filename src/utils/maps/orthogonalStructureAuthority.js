import {
  cellToCanonicalMapPoint,
  projectCanonicalMapSegmentToOwner2D,
  MAP_COORDINATE_AUTHORITY_ID,
} from "./mapCoordinateAuthority.js";

export const ORTHOGONAL_STRUCTURE_VERSION = 1;
export const ORTHOGONAL_STRUCTURE_ROOT_KEY = "orthogonalSegments";
export const ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY = "orthogonalStructureSegments";

export const ORTHOGONAL_STRUCTURE_KINDS = Object.freeze({
  WALL: "wall",
  GATE: "gate",
  PALISADE: "palisade",
  FENCE: "fence",
});

export const ORTHOGONAL_CORNER_MODES = Object.freeze({
  HORIZONTAL_FIRST: "horizontal-first",
  VERTICAL_FIRST: "vertical-first",
});

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
const roundTo = (value, step = 1) => {
  const s = Math.max(0.0001, Math.abs(finite(step, 1)));
  return Math.round(finite(value, 0) / s) * s;
};
const samePoint = (a, b, eps = 1e-8) =>
  Math.abs(finite(a?.x) - finite(b?.x)) <= eps && Math.abs(finite(a?.z) - finite(b?.z)) <= eps;

export function normalizeOrthogonalCornerMode(value) {
  return normalizeText(value) === ORTHOGONAL_CORNER_MODES.VERTICAL_FIRST
    ? ORTHOGONAL_CORNER_MODES.VERTICAL_FIRST
    : ORTHOGONAL_CORNER_MODES.HORIZONTAL_FIRST;
}

export function normalizeOrthogonalStructureKind(value) {
  const key = normalizeText(value || ORTHOGONAL_STRUCTURE_KINDS.WALL);
  return Object.values(ORTHOGONAL_STRUCTURE_KINDS).includes(key)
    ? key
    : ORTHOGONAL_STRUCTURE_KINDS.WALL;
}

export function snapOrthogonalStructurePoint(point = {}, step = 1) {
  return {
    x: roundTo(point.x, step),
    z: roundTo(point.z ?? point.y, step),
  };
}

/**
 * Converts a map cell to normalized construction-space coordinates.
 * One normalized unit equals one terrain hex radius / half a square cell span.
 * The returned point is then snapped to the independent orthogonal lattice.
 */
export function cellToOrthogonalStructurePoint(cell = {}, mapType = "hex", step = 1) {
  // R4: construction coordinates delegate to the one canonical map coordinate
  // authority shared by 2D, 3D, future spatial queries, and AI-GM commands.
  return snapOrthogonalStructurePoint(cellToCanonicalMapPoint(cell, mapType), step);
}

export function normalizeOrthogonalStructureSegment(segment = {}, options = {}) {
  const step = Math.max(0.25, finite(options.step ?? segment.step, 1));
  let a = snapOrthogonalStructurePoint(segment.a || segment.start || {}, step);
  let b = snapOrthogonalStructurePoint(segment.b || segment.end || {}, step);

  if (samePoint(a, b)) return null;

  // Never permit diagonal canonical wall geometry.
  if (Math.abs(a.x - b.x) > 1e-8 && Math.abs(a.z - b.z) > 1e-8) {
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(a.z - b.z);
    if (dx >= dz) b = { x: b.x, z: a.z };
    else b = { x: a.x, z: b.z };
  }
  if (samePoint(a, b)) return null;

  const kind = normalizeOrthogonalStructureKind(segment.kind || segment.type);
  const open = kind === ORTHOGONAL_STRUCTURE_KINDS.GATE
    ? segment.open === true || segment.gateOpen === true
    : false;
  const blocksMovement = kind === ORTHOGONAL_STRUCTURE_KINDS.GATE ? !open : true;
  const blocksLineOfSight =
    kind === ORTHOGONAL_STRUCTURE_KINDS.FENCE
      ? false
      : kind === ORTHOGONAL_STRUCTURE_KINDS.GATE
        ? !open
        : true;
  const orientation = Math.abs(a.z - b.z) <= 1e-8 ? "horizontal" : "vertical";
  const material = normalizeText(segment.material || (kind === "wall" ? "stone" : "wood"));
  const heightFeet = clamp(
    finite(segment.heightFeet, kind === "fence" ? 4 : kind === "palisade" ? 8 : 10),
    2,
    80
  );
  const thicknessFeet = clamp(finite(segment.thicknessFeet, kind === "fence" ? 0.25 : 0.5), 0.15, 4);

  return {
    ...segment,
    id: String(segment.id || "").trim() || null,
    runId: String(segment.runId || "").trim() || null,
    version: ORTHOGONAL_STRUCTURE_VERSION,
    latticeStep: step,
    a,
    b,
    start: a,
    end: b,
    orientation,
    kind,
    type: kind,
    material,
    heightFeet,
    thicknessFeet,
    open,
    gateOpen: kind === ORTHOGONAL_STRUCTURE_KINDS.GATE ? open : false,
    blocksMovement,
    blocksLineOfSight,
    providesCover: kind === "fence" ? "partial" : blocksLineOfSight ? "total" : "substantial",
    climbable:
      segment.climbable == null
        ? kind !== ORTHOGONAL_STRUCTURE_KINDS.GATE
        : segment.climbable === true,
    ownerCell: segment.ownerCell
      ? {
          x: Math.round(finite(segment.ownerCell.x ?? segment.ownerCell.q, 0)),
          y: Math.round(finite(segment.ownerCell.y ?? segment.ownerCell.r, 0)),
        }
      : null,
    gameplay: {
      ...(segment.gameplay || {}),
      structural: true,
      destructible: segment.gameplay?.destructible !== false,
      blocksMovement,
      blocksLineOfSight,
      geometryAuthority: "orthogonal-segment-v1",
      mapCoordinateAuthority: MAP_COORDINATE_AUTHORITY_ID,
    },
    visual: {
      ...(segment.visual || {}),
      assetId: segment.visual?.assetId || segment.assetId || null,
      assetUrl: segment.visual?.assetUrl || segment.assetUrl || null,
      useProceduralFallback: segment.visual?.useProceduralFallback !== false,
    },
    metadata: {
      ...(segment.metadata || {}),
      structuralAuthority: "orthogonal-segment-v1",
      mapCoordinateAuthority: MAP_COORDINATE_AUTHORITY_ID,
    },
  };
}

export function getOrthogonalStructureSegments(structures = {}) {
  const latticeStep = Math.max(0.25, finite(structures?.orthogonal?.latticeStep, 1));
  const source = Array.isArray(structures?.[ORTHOGONAL_STRUCTURE_ROOT_KEY])
    ? structures[ORTHOGONAL_STRUCTURE_ROOT_KEY]
    : Array.isArray(structures?.orthogonal?.segments)
      ? structures.orthogonal.segments
      : [];
  return source.map((segment) => normalizeOrthogonalStructureSegment(segment, { step: segment?.latticeStep || latticeStep })).filter(Boolean);
}

export function getOrthogonalStructureSegmentsFromGrid(grid = []) {
  const byKey = new Map();
  for (const row of Array.isArray(grid) ? grid : []) {
    for (const cell of Array.isArray(row) ? row : []) {
      for (const segment of getCellOrthogonalStructureSegments(cell)) {
        const key = segment.id || `${segment.runId || "runless"}|${normalizedUndirectedSegmentKey(segment)}`;
        if (!byKey.has(key)) byKey.set(key, segment);
      }
    }
  }
  return [...byKey.values()];
}

export function resolveOrthogonalStructureSegments({ structures = {}, grid = [] } = {}) {
  const topLevel = getOrthogonalStructureSegments(structures);
  if (topLevel.length) return topLevel;
  return getOrthogonalStructureSegmentsFromGrid(grid);
}

export function withOrthogonalStructureSegments(structures = {}, segments = [], latticeStep = 1) {
  const normalized = (Array.isArray(segments) ? segments : [])
    .map((segment) => normalizeOrthogonalStructureSegment(segment, { step: latticeStep }))
    .filter(Boolean);
  return {
    ...(structures || {}),
    version: Math.max(2, Number(structures?.version) || 0),
    [ORTHOGONAL_STRUCTURE_ROOT_KEY]: normalized,
    orthogonal: {
      ...(structures?.orthogonal || {}),
      version: ORTHOGONAL_STRUCTURE_VERSION,
      lattice: "square-first",
      latticeStep: Math.max(0.25, finite(latticeStep, 1)),
      segments: normalized,
    },
  };
}

function pointKey(point) {
  return `${finite(point?.x).toFixed(6)},${finite(point?.z).toFixed(6)}`;
}

function normalizedUndirectedSegmentKey(segment) {
  const a = pointKey(segment.a);
  const b = pointKey(segment.b);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function makeRunId(existingCount, start, end) {
  const clean = (value) => String(value).replace(/[^0-9A-Za-z.-]+/g, "_");
  return `orth-run-${existingCount + 1}-${clean(start.x)}-${clean(start.z)}-${clean(end.x)}-${clean(end.z)}`;
}

export function buildOrthogonalStructureRoute({
  start,
  end,
  step = 1,
  cornerMode = ORTHOGONAL_CORNER_MODES.HORIZONTAL_FIRST,
} = {}) {
  const a = snapOrthogonalStructurePoint(start || {}, step);
  const b = snapOrthogonalStructurePoint(end || {}, step);
  if (samePoint(a, b)) return { accepted: false, reason: "zero-length-structure-route", points: [], segments: [] };

  const horizontalFirst = normalizeOrthogonalCornerMode(cornerMode) === ORTHOGONAL_CORNER_MODES.HORIZONTAL_FIRST;
  let points;
  if (Math.abs(a.x - b.x) <= 1e-8 || Math.abs(a.z - b.z) <= 1e-8) {
    points = [a, b];
  } else {
    const corner = horizontalFirst ? { x: b.x, z: a.z } : { x: a.x, z: b.z };
    points = [a, corner, b];
  }

  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const segment = normalizeOrthogonalStructureSegment({ a: points[i], b: points[i + 1] }, { step });
    if (segment) segments.push(segment);
  }
  return { accepted: segments.length > 0, reason: segments.length ? null : "zero-length-structure-route", points, segments };
}

/**
 * R5 single-drag wall/box route.
 *
 * - Drag on one orthogonal axis => one straight wall.
 * - Drag across both axes => a CLOSED rectangular wall box.
 *
 * This removes the need to choose "horizontal first" vs "vertical first".
 * The drag start and release cells are simply opposite corners of the box.
 */
export function buildOrthogonalStructureBoxRoute({
  start,
  end,
  step = 1,
} = {}) {
  const a = snapOrthogonalStructurePoint(start || {}, step);
  const b = snapOrthogonalStructurePoint(end || {}, step);
  if (samePoint(a, b)) {
    return { accepted: false, reason: "zero-length-structure-route", points: [], segments: [], closed: false };
  }

  // Preserve the useful straight-wall gesture when the drag is already aligned.
  if (Math.abs(a.x - b.x) <= 1e-8 || Math.abs(a.z - b.z) <= 1e-8) {
    const segment = normalizeOrthogonalStructureSegment({ a, b }, { step });
    return {
      accepted: !!segment,
      reason: segment ? null : "zero-length-structure-route",
      points: segment ? [a, b] : [],
      segments: segment ? [segment] : [],
      closed: false,
    };
  }

  const p1 = a;
  const p2 = { x: b.x, z: a.z };
  const p3 = b;
  const p4 = { x: a.x, z: b.z };
  const points = [p1, p2, p3, p4, p1];

  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const segment = normalizeOrthogonalStructureSegment(
      { a: points[i], b: points[i + 1] },
      { step }
    );
    if (segment) segments.push(segment);
  }

  return {
    accepted: segments.length === 4,
    reason: segments.length === 4 ? null : "invalid-orthogonal-wall-box",
    points,
    segments,
    closed: segments.length === 4,
  };
}


function cloneGrid(grid = []) {
  return (Array.isArray(grid) ? grid : []).map((row) =>
    Array.isArray(row)
      ? row.map((cell) => ({
          ...(cell || {}),
          [ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY]: Array.isArray(cell?.[ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY])
            ? cell[ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY].map((segment) => ({ ...segment }))
            : [],
        }))
      : []
  );
}

export function applyOrthogonalStructureWallDrag({
  grid = [],
  structures = {},
  mapType = "hex",
  startCell,
  endCell,
  edge = {},
  cornerMode = ORTHOGONAL_CORNER_MODES.HORIZONTAL_FIRST,
  step = 1,
} = {}) {
  const sx = Math.round(finite(startCell?.x ?? startCell?.q, NaN));
  const sy = Math.round(finite(startCell?.y ?? startCell?.r, NaN));
  const ex = Math.round(finite(endCell?.x ?? endCell?.q, NaN));
  const ey = Math.round(finite(endCell?.y ?? endCell?.r, NaN));
  if (![sx, sy, ex, ey].every(Number.isFinite) || !grid?.[sy]?.[sx] || !grid?.[ey]?.[ex]) {
    return { accepted: false, reason: "invalid-structure-drag-cells", grid, structures, segments: [] };
  }

  const start = cellToOrthogonalStructurePoint({ x: sx, y: sy }, mapType, step);
  const end = cellToOrthogonalStructurePoint({ x: ex, y: ey }, mapType, step);
  const route = buildOrthogonalStructureRoute({ start, end, step, cornerMode });
  if (!route.accepted) return { accepted: false, reason: route.reason, grid, structures, segments: [] };

  const existing = resolveOrthogonalStructureSegments({ structures, grid });
  const runId = makeRunId(existing.length, start, end);
  const ownerCell = { x: sx, y: sy };
  const nextSegments = route.segments.map((segment, index) =>
    normalizeOrthogonalStructureSegment({
      ...segment,
      ...edge,
      id: `${runId}-s${index + 1}`,
      runId,
      ownerCell,
      cornerMode: normalizeOrthogonalCornerMode(cornerMode),
      latticeStep: step,
      mapType: normalizeText(mapType) === "square" ? "square" : "hex",
    }, { step })
  ).filter(Boolean);

  const existingKeys = new Set(existing.map(normalizedUndirectedSegmentKey));
  const appended = nextSegments.filter((segment) => !existingKeys.has(normalizedUndirectedSegmentKey(segment)));
  if (!appended.length) {
    return { accepted: false, reason: "duplicate-orthogonal-structure-route", grid, structures, segments: [] };
  }

  const nextGrid = cloneGrid(grid);
  const owner = nextGrid[sy][sx];
  owner[ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY] = [
    ...(owner[ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY] || []),
    ...appended,
  ];
  owner.orthogonalStructureVersion = ORTHOGONAL_STRUCTURE_VERSION;

  return {
    accepted: true,
    reason: null,
    grid: nextGrid,
    structures: withOrthogonalStructureSegments(structures, [...existing, ...appended], step),
    segments: appended,
    runId,
    routePoints: route.points,
    ownerCell,
    cornerMode: normalizeOrthogonalCornerMode(cornerMode),
    latticeStep: step,
    changes: [{ x: sx, y: sy, cell: owner }],
  };
}

/**
 * Apply the R5 single-drag wall/box gesture to map state.
 * Uses the same canonical segment/cache format as existing orthogonal runs.
 */
export function applyOrthogonalStructureBoxDrag({
  grid = [],
  structures = {},
  mapType = "hex",
  startCell,
  endCell,
  edge = {},
  step = 1,
} = {}) {
  const sx = Math.round(finite(startCell?.x ?? startCell?.q, NaN));
  const sy = Math.round(finite(startCell?.y ?? startCell?.r, NaN));
  const ex = Math.round(finite(endCell?.x ?? endCell?.q, NaN));
  const ey = Math.round(finite(endCell?.y ?? endCell?.r, NaN));
  if (![sx, sy, ex, ey].every(Number.isFinite) || !grid?.[sy]?.[sx] || !grid?.[ey]?.[ex]) {
    return { accepted: false, reason: "invalid-structure-drag-cells", grid, structures, segments: [] };
  }

  const start = cellToOrthogonalStructurePoint({ x: sx, y: sy }, mapType, step);
  const end = cellToOrthogonalStructurePoint({ x: ex, y: ey }, mapType, step);
  const route = buildOrthogonalStructureBoxRoute({ start, end, step });
  if (!route.accepted) {
    return { accepted: false, reason: route.reason, grid, structures, segments: [] };
  }

  const existing = resolveOrthogonalStructureSegments({ structures, grid });
  const runId = makeRunId(existing.length, start, end);
  const ownerCell = { x: sx, y: sy };
  const nextSegments = route.segments.map((segment, index) =>
    normalizeOrthogonalStructureSegment({
      ...segment,
      ...edge,
      id: `${runId}-s${index + 1}`,
      runId,
      ownerCell,
      authoringGesture: route.closed ? "drag-box" : "drag-line",
      latticeStep: step,
      mapType: normalizeText(mapType) === "square" ? "square" : "hex",
    }, { step })
  ).filter(Boolean);

  const existingKeys = new Set(existing.map(normalizedUndirectedSegmentKey));
  const appended = nextSegments.filter((segment) => !existingKeys.has(normalizedUndirectedSegmentKey(segment)));
  if (!appended.length) {
    return { accepted: false, reason: "duplicate-orthogonal-structure-route", grid, structures, segments: [] };
  }

  const nextGrid = cloneGrid(grid);
  const owner = nextGrid[sy][sx];
  owner[ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY] = [
    ...(owner[ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY] || []),
    ...appended,
  ];
  owner.orthogonalStructureVersion = ORTHOGONAL_STRUCTURE_VERSION;

  return {
    accepted: true,
    reason: null,
    grid: nextGrid,
    structures: withOrthogonalStructureSegments(structures, [...existing, ...appended], step),
    segments: appended,
    runId,
    routePoints: route.points,
    ownerCell,
    closed: route.closed,
    authoringGesture: route.closed ? "drag-box" : "drag-line",
    latticeStep: step,
    changes: [{ x: sx, y: sy, cell: owner }],
  };
}


export function getCellOrthogonalStructureSegments(cell = {}) {
  return (Array.isArray(cell?.[ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY])
    ? cell[ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY]
    : [])
    .map((segment) => normalizeOrthogonalStructureSegment(segment, { step: segment?.latticeStep || 1 }))
    .filter(Boolean);
}

export function getOrthogonalStructureJunctions(segments = []) {
  const normalized = (Array.isArray(segments) ? segments : [])
    .map((segment) => normalizeOrthogonalStructureSegment(segment))
    .filter(Boolean);
  const nodes = new Map();
  for (const segment of normalized) {
    for (const endpoint of [segment.a, segment.b]) {
      const key = pointKey(endpoint);
      const entry = nodes.get(key) || { point: endpoint, segments: [] };
      entry.segments.push(segment);
      nodes.set(key, entry);
    }
  }
  return [...nodes.values()].map((entry) => {
    const orientations = new Set(entry.segments.map((segment) => segment.orientation));
    let type = "endpoint";
    if (entry.segments.length >= 4) type = "cross";
    else if (entry.segments.length === 3) type = "tee";
    else if (entry.segments.length === 2 && orientations.size === 2) type = "corner";
    else if (entry.segments.length === 2) type = "straight";
    return { ...entry, type, degree: entry.segments.length };
  });
}

export function removeOrthogonalStructureRun({ grid = [], structures = {}, runId } = {}) {
  const id = String(runId || "").trim();
  if (!id) return { accepted: false, reason: "missing-run-id", grid, structures, changes: [] };
  const existing = resolveOrthogonalStructureSegments({ structures, grid });
  const removed = existing.filter((segment) => segment.runId === id);
  if (!removed.length) return { accepted: false, reason: "orthogonal-run-not-found", grid, structures, changes: [] };

  const nextSegments = existing.filter((segment) => segment.runId !== id);
  const nextGrid = cloneGrid(grid);
  const changes = [];
  for (let y = 0; y < nextGrid.length; y += 1) {
    for (let x = 0; x < (nextGrid[y]?.length || 0); x += 1) {
      const cell = nextGrid[y][x];
      const before = getCellOrthogonalStructureSegments(cell);
      const after = before.filter((segment) => segment.runId !== id);
      if (after.length !== before.length) {
        cell[ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY] = after;
        changes.push({ x, y, cell });
      }
    }
  }

  return {
    accepted: true,
    reason: null,
    grid: nextGrid,
    structures: withOrthogonalStructureSegments(structures, nextSegments, structures?.orthogonal?.latticeStep || 1),
    removed,
    changes,
  };
}


export function removeOrthogonalStructureRunsOwnedByCell({
  grid = [],
  structures = {},
  x,
  y,
} = {}) {
  const col = Math.round(finite(x, NaN));
  const row = Math.round(finite(y, NaN));
  if (!Number.isFinite(col) || !Number.isFinite(row) || !grid?.[row]?.[col]) {
    return { accepted: false, reason: "invalid-owner-cell", grid, structures, changes: [], removed: [] };
  }
  const runIds = [...new Set(
    getCellOrthogonalStructureSegments(grid[row][col])
      .map((segment) => segment.runId)
      .filter(Boolean)
  )];
  if (!runIds.length) {
    return { accepted: false, reason: "no-orthogonal-runs-on-cell", grid, structures, changes: [], removed: [] };
  }

  let nextGrid = grid;
  let nextStructures = structures;
  const changes = [];
  const removed = [];
  for (const runId of runIds) {
    const result = removeOrthogonalStructureRun({ grid: nextGrid, structures: nextStructures, runId });
    if (!result.accepted) continue;
    nextGrid = result.grid;
    nextStructures = result.structures;
    removed.push(...result.removed);
    changes.push(...result.changes);
  }
  const byCell = new Map();
  changes.forEach((change) => byCell.set(`${change.x},${change.y}`, change));
  return {
    accepted: removed.length > 0,
    reason: removed.length ? null : "orthogonal-runs-not-removed",
    grid: nextGrid,
    structures: nextStructures,
    changes: [...byCell.values()],
    removed,
    runIds,
  };
}

export function setOrthogonalStructureRunOpen({ grid = [], structures = {}, runId, open = true } = {}) {
  const id = String(runId || "").trim();
  const existing = resolveOrthogonalStructureSegments({ structures, grid });
  let changed = false;
  const update = (segment) => {
    if (segment.runId !== id || segment.kind !== ORTHOGONAL_STRUCTURE_KINDS.GATE) return segment;
    changed = true;
    return normalizeOrthogonalStructureSegment({ ...segment, open: open === true, gateOpen: open === true });
  };
  const nextSegments = existing.map(update);
  if (!changed) return { accepted: false, reason: "orthogonal-gate-run-not-found", grid, structures, changes: [] };

  const nextGrid = cloneGrid(grid);
  const changes = [];
  for (let y = 0; y < nextGrid.length; y += 1) {
    for (let x = 0; x < (nextGrid[y]?.length || 0); x += 1) {
      const cell = nextGrid[y][x];
      const before = getCellOrthogonalStructureSegments(cell);
      const after = before.map(update);
      if (after.some((segment, index) => segment !== before[index])) {
        cell[ORTHOGONAL_STRUCTURE_CELL_CACHE_KEY] = after;
        changes.push({ x, y, cell });
      }
    }
  }
  return {
    accepted: true,
    grid: nextGrid,
    structures: withOrthogonalStructureSegments(structures, nextSegments, structures?.orthogonal?.latticeStep || 1),
    changes,
  };
}

export function orthogonalStructureSegmentLength(segment = {}) {
  const normalized = normalizeOrthogonalStructureSegment(segment);
  if (!normalized) return 0;
  return Math.hypot(normalized.b.x - normalized.a.x, normalized.b.z - normalized.a.z);
}

export function orthogonalStructureSegmentToOwnerSvgLine({
  segment,
  ownerCell,
  mapType = "hex",
  ownerCenterX = 0,
  ownerCenterY = 0,
  hexSize = 1,
  step = 1,
} = {}) {
  const normalized = normalizeOrthogonalStructureSegment(segment, { step });
  if (!normalized) return null;
  const ownerPoint = cellToOrthogonalStructurePoint(ownerCell || normalized.ownerCell || {}, mapType, step);
  return projectCanonicalMapSegmentToOwner2D({
    a: normalized.a,
    b: normalized.b,
    ownerPoint,
    ownerCenterX: finite(ownerCenterX),
    ownerCenterY: finite(ownerCenterY),
    unitsPerMapUnit: Math.max(0.0001, finite(hexSize, 1)),
  });
}

export function getOrthogonalStructure2DStyle(segment = {}) {
  const edge = normalizeOrthogonalStructureSegment(segment);
  if (!edge) return null;
  if (edge.kind === "gate") {
    return { stroke: edge.open ? "#15803d" : "#78350f", strokeWidth: 6, strokeDasharray: edge.open ? "8 5" : null };
  }
  if (edge.kind === "palisade") return { stroke: "#713f12", strokeWidth: 7, strokeDasharray: "3 3" };
  if (edge.kind === "fence") return { stroke: "#a16207", strokeWidth: 4, strokeDasharray: "7 5" };
  return { stroke: "#292524", strokeWidth: 7, strokeDasharray: null };
}

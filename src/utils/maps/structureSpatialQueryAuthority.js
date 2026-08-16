/**
 * Milestone 8C-8C.3A — Structure Spatial Query Authority
 *
 * Renderer-independent combat queries for authored structures.
 *
 * Authority order:
 *   map structure data -> canonical map coordinates -> spatial query
 *
 * The module deliberately does not inspect Three.js meshes or SVG output.
 * It consumes both:
 *   1) square-first orthogonal structure segments (8C-8C.2), and
 *   2) precision grid-edge structures (8C-8C.1 compatibility).
 *
 * Live combat positions (CombatPage/TacticalMap fighter cells) use the same
 * odd-r offset {x:col,y:row} space as Map Maker grid cells on hex maps, and
 * direct grid coordinates on square maps. The combat adapters below therefore
 * query in OFFSET space by default; a caller that genuinely holds axial data
 * must state `coordinateSpace: "axial"` explicitly.
 */
import {
  resolveOrthogonalStructureSegments,
  normalizeOrthogonalStructureSegment,
} from "./orthogonalStructureAuthority.js";
import {
  getGridCellStructureEdge,
  getGridStructureDirections,
  normalizeGridStructureMapType,
} from "./gridStructureAuthority.js";
import {
  cellToCanonicalMapPoint,
  normalizeCanonicalMapType,
  MAP_COORDINATE_AUTHORITY_ID,
} from "./mapCoordinateAuthority.js";

export const STRUCTURE_SPATIAL_QUERY_VERSION = 1;
export const STRUCTURE_SPATIAL_QUERY_ID = "structure-spatial-query-v1";
export const DEFAULT_STRUCTURE_SPATIAL_BUCKET_SIZE = 4;
export const DEFAULT_MAP_ELEVATION_UNIT_FEET = 2.5;

const EPS = 1e-7;
const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

const COVER_RANK = Object.freeze({ none: 0, partial: 1, substantial: 2, total: 3 });

export const STRUCTURE_QUERY_PURPOSES = Object.freeze({
  MOVEMENT: "movement",
  LINE_OF_SIGHT: "line-of-sight",
  PROJECTILE: "projectile",
  COVER: "cover",
  GENERIC: "generic",
});

export const MAP_POSITION_SPACES = Object.freeze({
  OFFSET: "offset",
  AXIAL: "axial",
  CANONICAL: "canonical",
});

/**
 * Canonical coordinate contract for live combat structure queries.
 *
 * CombatPage stores fighter positions as odd-r offset cells (see
 * movementRules.getHexNeighbors parity handling); square maps use direct grid
 * coordinates. Both are OFFSET in this module's terms. Forcing AXIAL here
 * previously displaced hex queries by floor(row / 2) columns from row 2 on,
 * which made walls miss movement and LOS blocks mid-map.
 */
export const COMBAT_STRUCTURE_POSITION_SPACE = MAP_POSITION_SPACES.OFFSET;

function normalizePositionSpace(value) {
  const key = normalizeText(value || MAP_POSITION_SPACES.OFFSET);
  if (key === MAP_POSITION_SPACES.AXIAL) return MAP_POSITION_SPACES.AXIAL;
  if (key === MAP_POSITION_SPACES.CANONICAL) return MAP_POSITION_SPACES.CANONICAL;
  return MAP_POSITION_SPACES.OFFSET;
}

/** Standard odd-r conversion used by the Map Maker hex grid. */
export function axialToOddROffset(position = {}) {
  const q = Math.round(finite(position.q ?? position.x, 0));
  const r = Math.round(finite(position.r ?? position.y, 0));
  return {
    x: q + (r - (r & 1)) / 2,
    y: r,
  };
}

export function mapPositionToCanonicalPoint(
  position = {},
  mapType = "hex",
  coordinateSpace = MAP_POSITION_SPACES.OFFSET,
) {
  const type = normalizeCanonicalMapType(mapType);
  const space = normalizePositionSpace(coordinateSpace);

  if (space === MAP_POSITION_SPACES.CANONICAL) {
    return {
      x: finite(position.x, 0),
      z: finite(position.z ?? position.y, 0),
    };
  }

  if (type === "hex" && space === MAP_POSITION_SPACES.AXIAL) {
    return cellToCanonicalMapPoint(axialToOddROffset(position), type);
  }

  return cellToCanonicalMapPoint(
    { x: position.x ?? position.q, y: position.y ?? position.r },
    type,
  );
}

function pointKey(point = {}) {
  return `${finite(point.x).toFixed(6)},${finite(point.z).toFixed(6)}`;
}

function undirectedSegmentKey(a = {}, b = {}) {
  const ka = pointKey(a);
  const kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function canonicalHexEdgeEndpoints(center, direction) {
  const angleByDirection = {
    E: 0,
    SE: 60,
    SW: 120,
    W: 180,
    NW: 240,
    NE: 300,
  };
  const normalDeg = angleByDirection[String(direction || "").toUpperCase()];
  if (!Number.isFinite(normalDeg)) return null;
  const toPoint = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: center.x + Math.cos(rad),
      z: center.z + Math.sin(rad),
    };
  };
  return {
    a: toPoint(normalDeg - 30),
    b: toPoint(normalDeg + 30),
  };
}

function canonicalSquareEdgeEndpoints(center, direction) {
  switch (String(direction || "").toUpperCase()) {
    case "N":
      return { a: { x: center.x - 1, z: center.z - 1 }, b: { x: center.x + 1, z: center.z - 1 } };
    case "E":
      return { a: { x: center.x + 1, z: center.z - 1 }, b: { x: center.x + 1, z: center.z + 1 } };
    case "S":
      return { a: { x: center.x - 1, z: center.z + 1 }, b: { x: center.x + 1, z: center.z + 1 } };
    case "W":
      return { a: { x: center.x - 1, z: center.z - 1 }, b: { x: center.x - 1, z: center.z + 1 } };
    default:
      return null;
  }
}

function resolveCellBaseElevationFeet(cell = {}, elevationUnitFeet = DEFAULT_MAP_ELEVATION_UNIT_FEET) {
  const units = Number.isFinite(Number(cell?.height))
    ? Number(cell.height)
    : Number.isFinite(Number(cell?.elevation))
      ? Number(cell.elevation)
      : 0;
  return units * finite(elevationUnitFeet, DEFAULT_MAP_ELEVATION_UNIT_FEET);
}

function normalizeSpatialSegment(segment = {}, extras = {}) {
  const a = {
    x: finite(segment.a?.x ?? segment.start?.x),
    z: finite(segment.a?.z ?? segment.start?.z ?? segment.start?.y),
  };
  const b = {
    x: finite(segment.b?.x ?? segment.end?.x),
    z: finite(segment.b?.z ?? segment.end?.z ?? segment.end?.y),
  };
  if (Math.hypot(b.x - a.x, b.z - a.z) <= EPS) return null;

  const kind = normalizeText(segment.kind || segment.type || "wall");
  const open = segment.open === true || segment.gateOpen === true || segment.doorOpen === true;
  const blocksMovement = segment.blocksMovement === true;
  const blocksLineOfSight = segment.blocksLineOfSight === true;
  const blocksProjectiles = segment.blocksProjectiles != null
    ? segment.blocksProjectiles === true
    : segment.gameplay?.blocksProjectiles != null
      ? segment.gameplay.blocksProjectiles === true
      : blocksLineOfSight;
  const heightFeet = Math.max(0, finite(segment.heightFeet, 10));
  const baseElevationFeet = finite(extras.baseElevationFeet ?? segment.baseElevationFeet, 0);

  return {
    ...segment,
    ...extras,
    a,
    b,
    start: a,
    end: b,
    kind,
    type: kind,
    open,
    blocksMovement,
    blocksLineOfSight,
    blocksProjectiles,
    heightFeet,
    baseElevationFeet,
    topElevationFeet: baseElevationFeet + heightFeet,
    climbable: segment.climbable === true,
    providesCover: normalizeText(segment.providesCover || (blocksLineOfSight ? "total" : "none")),
    spatialAuthority: STRUCTURE_SPATIAL_QUERY_ID,
    mapCoordinateAuthority: MAP_COORDINATE_AUTHORITY_ID,
  };
}

export function getPrecisionGridStructureSegments(mapDefinition = {}, options = {}) {
  const grid = Array.isArray(mapDefinition?.grid) ? mapDefinition.grid : [];
  const mapType = normalizeGridStructureMapType(mapDefinition?.mapType || options.mapType || "hex");
  const elevationUnitFeet = finite(options.elevationUnitFeet, DEFAULT_MAP_ELEVATION_UNIT_FEET);
  const seen = new Set();
  const segments = [];

  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    if (!Array.isArray(row)) continue;
    for (let x = 0; x < row.length; x += 1) {
      const cell = row[x] || {};
      const center = cellToCanonicalMapPoint({ x, y }, mapType);
      for (const direction of getGridStructureDirections(mapType)) {
        const edge = getGridCellStructureEdge(cell, direction.key, mapType);
        if (!edge) continue;
        const endpoints = mapType === "square"
          ? canonicalSquareEdgeEndpoints(center, direction.key)
          : canonicalHexEdgeEndpoints(center, direction.key);
        if (!endpoints) continue;
        const geometryKey = undirectedSegmentKey(endpoints.a, endpoints.b);
        if (seen.has(geometryKey)) continue;
        seen.add(geometryKey);
        const spatial = normalizeSpatialSegment(
          {
            ...edge,
            id: edge.id || `grid-edge-${x}-${y}-${direction.key}`,
            a: endpoints.a,
            b: endpoints.b,
          },
          {
            sourceAuthority: "grid-edge-v2",
            ownerCell: { x, y },
            direction: direction.key,
            baseElevationFeet: resolveCellBaseElevationFeet(cell, elevationUnitFeet),
          },
        );
        if (spatial) segments.push(spatial);
      }
    }
  }

  return segments;
}

export function getAllCanonicalStructureSegments(mapDefinition = {}, options = {}) {
  const grid = Array.isArray(mapDefinition?.grid) ? mapDefinition.grid : [];
  const structures = mapDefinition?.structures || {};
  const elevationUnitFeet = finite(options.elevationUnitFeet, DEFAULT_MAP_ELEVATION_UNIT_FEET);
  const orthogonal = resolveOrthogonalStructureSegments({ structures, grid })
    .map((segment) => normalizeOrthogonalStructureSegment(segment, { step: segment?.latticeStep || 1 }))
    .filter(Boolean)
    .map((segment) => {
      const owner = segment.ownerCell;
      const ownerCell = owner ? grid?.[owner.y]?.[owner.x] : null;
      return normalizeSpatialSegment(segment, {
        sourceAuthority: "orthogonal-segment-v1",
        baseElevationFeet: resolveCellBaseElevationFeet(ownerCell || {}, elevationUnitFeet),
      });
    })
    .filter(Boolean);

  const precision = getPrecisionGridStructureSegments(mapDefinition, options);
  const byKey = new Map();
  for (const segment of [...orthogonal, ...precision]) {
    const key = `${undirectedSegmentKey(segment.a, segment.b)}|${segment.kind}|${segment.sourceAuthority}`;
    if (!byKey.has(key)) byKey.set(key, segment);
  }
  return [...byKey.values()];
}

function segmentBounds(segment) {
  return {
    minX: Math.min(segment.a.x, segment.b.x),
    maxX: Math.max(segment.a.x, segment.b.x),
    minZ: Math.min(segment.a.z, segment.b.z),
    maxZ: Math.max(segment.a.z, segment.b.z),
  };
}

function bucketKey(ix, iz) {
  return `${ix},${iz}`;
}

function bucketRange(bounds, cellSize) {
  return {
    minX: Math.floor(bounds.minX / cellSize),
    maxX: Math.floor(bounds.maxX / cellSize),
    minZ: Math.floor(bounds.minZ / cellSize),
    maxZ: Math.floor(bounds.maxZ / cellSize),
  };
}

export function createStructureSpatialIndex(mapDefinition = {}, options = {}) {
  const cellSize = Math.max(1, finite(options.bucketSize, DEFAULT_STRUCTURE_SPATIAL_BUCKET_SIZE));
  const segments = getAllCanonicalStructureSegments(mapDefinition, options);
  const buckets = new Map();

  segments.forEach((segment, index) => {
    const range = bucketRange(segmentBounds(segment), cellSize);
    for (let ix = range.minX; ix <= range.maxX; ix += 1) {
      for (let iz = range.minZ; iz <= range.maxZ; iz += 1) {
        const key = bucketKey(ix, iz);
        const list = buckets.get(key) || [];
        list.push(index);
        buckets.set(key, list);
      }
    }
  });

  return {
    id: STRUCTURE_SPATIAL_QUERY_ID,
    version: STRUCTURE_SPATIAL_QUERY_VERSION,
    mapType: normalizeCanonicalMapType(mapDefinition?.mapType || options.mapType || "hex"),
    mapDefinition,
    cellSize,
    segments,
    buckets,
    stats: {
      segmentCount: segments.length,
      bucketCount: buckets.size,
      orthogonalCount: segments.filter((segment) => segment.sourceAuthority === "orthogonal-segment-v1").length,
      precisionEdgeCount: segments.filter((segment) => segment.sourceAuthority === "grid-edge-v2").length,
    },
  };
}

function cross(a, b) {
  return a.x * b.z - a.z * b.x;
}

function subtract(a, b) {
  return { x: a.x - b.x, z: a.z - b.z };
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/**
 * Robust 2D segment intersection in canonical map X/Z.
 * Returns path parameter t and structure parameter u when available.
 */
export function intersectCanonicalSegments(pathA, pathB, wallA, wallB, epsilon = EPS) {
  const p = pathA;
  const r = subtract(pathB, pathA);
  const q = wallA;
  const s = subtract(wallB, wallA);
  const rxs = cross(r, s);
  const qmp = subtract(q, p);
  const qmpxr = cross(qmp, r);

  if (Math.abs(rxs) <= epsilon && Math.abs(qmpxr) <= epsilon) {
    const rr = r.x * r.x + r.z * r.z;
    if (rr <= epsilon) return { intersects: false, reason: "zero-length-path" };
    const t0 = (qmp.x * r.x + qmp.z * r.z) / rr;
    const q2mp = subtract(wallB, p);
    const t1 = (q2mp.x * r.x + q2mp.z * r.z) / rr;
    const low = Math.max(0, Math.min(t0, t1));
    const high = Math.min(1, Math.max(t0, t1));
    if (high < low - epsilon) return { intersects: false, collinear: true };
    const t = clamp(low, 0, 1);
    return {
      intersects: true,
      collinear: true,
      overlap: true,
      t,
      u: null,
      point: lerpPoint(pathA, pathB, t),
      tRange: [clamp(low, 0, 1), clamp(high, 0, 1)],
    };
  }

  if (Math.abs(rxs) <= epsilon) {
    return { intersects: false, parallel: true };
  }

  const t = cross(qmp, s) / rxs;
  const u = cross(qmp, r) / rxs;
  if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) {
    return { intersects: false, t, u };
  }

  const ct = clamp(t, 0, 1);
  const cu = clamp(u, 0, 1);
  return {
    intersects: true,
    collinear: false,
    overlap: false,
    t: ct,
    u: cu,
    point: lerpPoint(pathA, pathB, ct),
  };
}

function getCandidateSegments(index, from, to) {
  if (!index?.segments?.length) return [];
  if (!(index.buckets instanceof Map) || !index.buckets.size) return index.segments;
  const bounds = {
    minX: Math.min(from.x, to.x),
    maxX: Math.max(from.x, to.x),
    minZ: Math.min(from.z, to.z),
    maxZ: Math.max(from.z, to.z),
  };
  const range = bucketRange(bounds, index.cellSize || DEFAULT_STRUCTURE_SPATIAL_BUCKET_SIZE);
  const ids = new Set();
  for (let ix = range.minX; ix <= range.maxX; ix += 1) {
    for (let iz = range.minZ; iz <= range.maxZ; iz += 1) {
      const list = index.buckets.get(bucketKey(ix, iz));
      if (!list) continue;
      list.forEach((id) => ids.add(id));
    }
  }
  return [...ids].map((id) => index.segments[id]).filter(Boolean);
}

function structureBlocksPurpose(segment, purpose) {
  switch (purpose) {
    case STRUCTURE_QUERY_PURPOSES.MOVEMENT:
      return segment.blocksMovement === true;
    case STRUCTURE_QUERY_PURPOSES.LINE_OF_SIGHT:
      return segment.blocksLineOfSight === true;
    case STRUCTURE_QUERY_PURPOSES.PROJECTILE:
      return segment.blocksProjectiles === true;
    case STRUCTURE_QUERY_PURPOSES.COVER:
      return COVER_RANK[segment.providesCover] > 0;
    case STRUCTURE_QUERY_PURPOSES.GENERIC:
    default:
      return true;
  }
}

function rayHeightAtT(fromHeightFeet, toHeightFeet, t) {
  return finite(fromHeightFeet, 0) + (finite(toHeightFeet, fromHeightFeet) - finite(fromHeightFeet, 0)) * clamp(t, 0, 1);
}

function structureVerticallyIntersectsRay(segment, purpose, hitT, options = {}) {
  if (![STRUCTURE_QUERY_PURPOSES.LINE_OF_SIGHT, STRUCTURE_QUERY_PURPOSES.PROJECTILE, STRUCTURE_QUERY_PURPOSES.COVER].includes(purpose)) {
    return true;
  }
  const defaultHeightFeet = purpose === STRUCTURE_QUERY_PURPOSES.PROJECTILE
    ? 4
    : purpose === STRUCTURE_QUERY_PURPOSES.COVER
      ? 3
      : 5.5;
  const fromHeightFeet = finite(options.fromHeightFeet, defaultHeightFeet);
  const toHeightFeet = finite(options.toHeightFeet, fromHeightFeet);
  const rayHeight = rayHeightAtT(fromHeightFeet, toHeightFeet, hitT);
  return rayHeight <= segment.topElevationFeet + finite(options.heightEpsilonFeet, 0.05) &&
    rayHeight >= segment.baseElevationFeet - finite(options.heightEpsilonFeet, 0.05);
}

export function queryStructureIntersections({
  index = null,
  mapDefinition = null,
  from,
  to,
  mapType = null,
  coordinateSpace = MAP_POSITION_SPACES.OFFSET,
  purpose = STRUCTURE_QUERY_PURPOSES.GENERIC,
  fromHeightFeet,
  toHeightFeet,
  ignorePathStart = true,
  ignorePathEnd = false,
  includeNonBlocking = false,
  elevationUnitFeet = DEFAULT_MAP_ELEVATION_UNIT_FEET,
} = {}) {
  const spatialIndex = index || createStructureSpatialIndex(mapDefinition || {}, { elevationUnitFeet });
  const type = normalizeCanonicalMapType(mapType || spatialIndex.mapType || mapDefinition?.mapType || "hex");
  const a = mapPositionToCanonicalPoint(from || {}, type, coordinateSpace);
  const b = mapPositionToCanonicalPoint(to || {}, type, coordinateSpace);
  if (Math.hypot(b.x - a.x, b.z - a.z) <= EPS) {
    return { accepted: false, reason: "zero-length-query", hits: [], from: a, to: b, index: spatialIndex };
  }

  const hits = [];
  for (const segment of getCandidateSegments(spatialIndex, a, b)) {
    const blockingForPurpose = structureBlocksPurpose(segment, purpose);
    if (!blockingForPurpose && !includeNonBlocking) continue;
    const intersection = intersectCanonicalSegments(a, b, segment.a, segment.b);
    if (!intersection.intersects) continue;
    if (ignorePathStart && intersection.t <= EPS) continue;
    if (ignorePathEnd && intersection.t >= 1 - EPS) continue;
    if (!structureVerticallyIntersectsRay(segment, purpose, intersection.t, { fromHeightFeet, toHeightFeet })) continue;
    hits.push({
      segment,
      intersection,
      t: intersection.t,
      point: intersection.point,
      blockingForPurpose,
      rayHeightFeet: [STRUCTURE_QUERY_PURPOSES.LINE_OF_SIGHT, STRUCTURE_QUERY_PURPOSES.PROJECTILE, STRUCTURE_QUERY_PURPOSES.COVER].includes(purpose)
        ? rayHeightAtT(fromHeightFeet ?? (purpose === STRUCTURE_QUERY_PURPOSES.PROJECTILE ? 4 : purpose === STRUCTURE_QUERY_PURPOSES.COVER ? 3 : 5.5), toHeightFeet ?? fromHeightFeet ?? (purpose === STRUCTURE_QUERY_PURPOSES.PROJECTILE ? 4 : purpose === STRUCTURE_QUERY_PURPOSES.COVER ? 3 : 5.5), intersection.t)
        : null,
    });
  }

  hits.sort((left, right) => left.t - right.t);
  return {
    accepted: true,
    reason: null,
    purpose,
    from: a,
    to: b,
    hits,
    firstHit: hits[0] || null,
    blocked: hits.some((hit) => hit.blockingForPurpose),
    index: spatialIndex,
  };
}

export function getMovementStructureBlock(options = {}) {
  const result = queryStructureIntersections({
    ...options,
    purpose: STRUCTURE_QUERY_PURPOSES.MOVEMENT,
    ignorePathStart: options.ignorePathStart !== false,
    ignorePathEnd: options.ignorePathEnd === true,
  });
  const first = result.hits.find((hit) => hit.blockingForPurpose) || null;
  const actorCanClimb = options.actorCanClimb === true;
  return {
    ...result,
    blocked: !!first,
    blocker: first,
    canTraverseWithClimb: !!first && actorCanClimb && first.segment.climbable === true,
    requiresClimb: !!first && first.segment.climbable === true,
    requiredClimbHeightFeet: first?.segment?.heightFeet ?? 0,
  };
}

export function isPathBlockedByStructures({ path = [], ...options } = {}) {
  if (!Array.isArray(path) || path.length < 2) {
    return { blocked: false, blocker: null, segmentIndex: -1, checks: [] };
  }
  const checks = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const result = getMovementStructureBlock({
      ...options,
      from: path[index],
      to: path[index + 1],
      ignorePathStart: true,
      ignorePathEnd: false,
    });
    checks.push(result);
    if (result.blocked) {
      return {
        blocked: true,
        blocker: result.blocker,
        segmentIndex: index,
        from: path[index],
        to: path[index + 1],
        checks,
        canTraverseWithClimb: result.canTraverseWithClimb,
        requiresClimb: result.requiresClimb,
      };
    }
  }
  return { blocked: false, blocker: null, segmentIndex: -1, checks };
}

export function hasStructureLineOfSight(options = {}) {
  const result = queryStructureIntersections({
    ...options,
    purpose: STRUCTURE_QUERY_PURPOSES.LINE_OF_SIGHT,
    ignorePathStart: options.ignorePathStart !== false,
    ignorePathEnd: options.ignorePathEnd !== false,
  });
  const blockers = result.hits.filter((hit) => hit.blockingForPurpose);
  return {
    ...result,
    clear: blockers.length === 0,
    blocked: blockers.length > 0,
    blockers,
    blocker: blockers[0] || null,
  };
}

export function getFirstProjectileStructureImpact(options = {}) {
  const result = queryStructureIntersections({
    ...options,
    purpose: STRUCTURE_QUERY_PURPOSES.PROJECTILE,
    ignorePathStart: options.ignorePathStart !== false,
    ignorePathEnd: options.ignorePathEnd === true,
  });
  const impact = result.hits.find((hit) => hit.blockingForPurpose) || null;
  return {
    ...result,
    impacted: !!impact,
    impact,
    structure: impact?.segment || null,
  };
}

export function getStructureCoverAlongLine(options = {}) {
  const result = queryStructureIntersections({
    ...options,
    purpose: STRUCTURE_QUERY_PURPOSES.COVER,
    includeNonBlocking: true,
    ignorePathStart: options.ignorePathStart !== false,
    ignorePathEnd: options.ignorePathEnd !== false,
  });
  let cover = "none";
  let source = null;
  for (const hit of result.hits) {
    const candidate = normalizeText(hit.segment.providesCover || "none");
    if ((COVER_RANK[candidate] || 0) > (COVER_RANK[cover] || 0)) {
      cover = candidate;
      source = hit;
    }
  }
  return {
    ...result,
    cover,
    coverRank: COVER_RANK[cover] || 0,
    source,
  };
}

/**
 * Thin combat adapters: live CombatPage positions are odd-r offset cells on
 * hex maps and direct grid coordinates on square maps — the same OFFSET space
 * Map Maker uses. Conversion to canonical map points happens only inside
 * mapPositionToCanonicalPoint; callers never convert ad hoc. Callers holding
 * axial data may override with an explicit `coordinateSpace`.
 */
export function getCombatMovementStructureBlock({ mapDefinition, from, to, index, ...options } = {}) {
  const mapType = normalizeCanonicalMapType(mapDefinition?.mapType || index?.mapType || options.mapType || "hex");
  return getMovementStructureBlock({
    ...options,
    index,
    mapDefinition,
    mapType,
    coordinateSpace: options.coordinateSpace || COMBAT_STRUCTURE_POSITION_SPACE,
    from,
    to,
  });
}

export function hasCombatStructureLineOfSight({ mapDefinition, from, to, index, ...options } = {}) {
  const mapType = normalizeCanonicalMapType(mapDefinition?.mapType || index?.mapType || options.mapType || "hex");
  return hasStructureLineOfSight({
    ...options,
    index,
    mapDefinition,
    mapType,
    coordinateSpace: options.coordinateSpace || COMBAT_STRUCTURE_POSITION_SPACE,
    from,
    to,
  });
}

export function getCombatProjectileStructureImpact({ mapDefinition, from, to, index, ...options } = {}) {
  const mapType = normalizeCanonicalMapType(mapDefinition?.mapType || index?.mapType || options.mapType || "hex");
  return getFirstProjectileStructureImpact({
    ...options,
    index,
    mapDefinition,
    mapType,
    coordinateSpace: options.coordinateSpace || COMBAT_STRUCTURE_POSITION_SPACE,
    from,
    to,
  });
}

export function getCombatStructureCover({ mapDefinition, from, to, index, ...options } = {}) {
  const mapType = normalizeCanonicalMapType(mapDefinition?.mapType || index?.mapType || options.mapType || "hex");
  return getStructureCoverAlongLine({
    ...options,
    index,
    mapDefinition,
    mapType,
    coordinateSpace: options.coordinateSpace || COMBAT_STRUCTURE_POSITION_SPACE,
    from,
    to,
  });
}

export function describeStructureSpatialBlock(block = null) {
  const segment = block?.segment || block?.blocker?.segment || block?.structure || null;
  if (!segment) return "structure";
  const kind = String(segment.kind || segment.type || "structure").replace(/-/g, " ");
  const material = String(segment.material || "").replace(/-/g, " ");
  if (segment.open) return `open ${kind}`;
  return material ? `${material} ${kind}` : kind;
}

export default {
  STRUCTURE_SPATIAL_QUERY_VERSION,
  STRUCTURE_SPATIAL_QUERY_ID,
  STRUCTURE_QUERY_PURPOSES,
  MAP_POSITION_SPACES,
  COMBAT_STRUCTURE_POSITION_SPACE,
  axialToOddROffset,
  mapPositionToCanonicalPoint,
  getPrecisionGridStructureSegments,
  getAllCanonicalStructureSegments,
  createStructureSpatialIndex,
  intersectCanonicalSegments,
  queryStructureIntersections,
  getMovementStructureBlock,
  isPathBlockedByStructures,
  hasStructureLineOfSight,
  getFirstProjectileStructureImpact,
  getStructureCoverAlongLine,
  getCombatMovementStructureBlock,
  hasCombatStructureLineOfSight,
  getCombatProjectileStructureImpact,
  getCombatStructureCover,
  describeStructureSpatialBlock,
};

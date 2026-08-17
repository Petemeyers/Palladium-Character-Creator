export const TERRAIN_GEOMETRY_MODES = Object.freeze({
  TERRACED: "terraced",
  SLOPE_AWARE: "slope-aware",
});

export const DEFAULT_TERRAIN_GEOMETRY_MODE = TERRAIN_GEOMETRY_MODES.TERRACED;
export const DEFAULT_TERRAIN_BOUNDARY_SKIRT_DEPTH_WORLD = 0.5;

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeTerrainGeometryMode(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  if (
    normalized === TERRAIN_GEOMETRY_MODES.SLOPE_AWARE ||
    normalized === "slope" ||
    normalized === "sloped" ||
    normalized === "natural" ||
    normalized === "hybrid"
  ) {
    return TERRAIN_GEOMETRY_MODES.SLOPE_AWARE;
  }

  return TERRAIN_GEOMETRY_MODES.TERRACED;
}

export function computeTerrainBoundaryBottomY(
  surfaceYs = [],
  depthWorld = DEFAULT_TERRAIN_BOUNDARY_SKIRT_DEPTH_WORLD,
  fallbackTopY = 0,
) {
  const valid = (Array.isArray(surfaceYs) ? surfaceYs : [])
    .map((value) => Number(value))
    .filter(Number.isFinite);

  const minSurfaceY = valid.length > 0
    ? Math.min(...valid)
    : finite(fallbackTopY, 0);

  return minSurfaceY - Math.max(0.05, finite(depthWorld, DEFAULT_TERRAIN_BOUNDARY_SKIRT_DEPTH_WORLD));
}

export function resolveTerracedEdgeWall({
  ownTopY,
  neighborTopY = null,
  hasNeighbor = true,
  boundaryBottomY = 0,
  epsilon = 0.001,
} = {}) {
  const own = finite(ownTopY, 0);
  const tolerance = Math.max(0, finite(epsilon, 0.001));

  if (!hasNeighbor || !Number.isFinite(Number(neighborTopY))) {
    return {
      draw: true,
      kind: "boundary",
      upperY: own,
      lowerY: Math.min(own - tolerance, finite(boundaryBottomY, own - 0.5)),
    };
  }

  const neighbor = finite(neighborTopY, own);

  if (own <= neighbor + tolerance) {
    return {
      draw: false,
      kind: Math.abs(own - neighbor) <= tolerance ? "shared-flat" : "neighbor-higher",
      upperY: own,
      lowerY: own,
    };
  }

  return {
    draw: true,
    kind: "interior-step",
    upperY: own,
    lowerY: neighbor,
  };
}

export default {
  TERRAIN_GEOMETRY_MODES,
  DEFAULT_TERRAIN_GEOMETRY_MODE,
  DEFAULT_TERRAIN_BOUNDARY_SKIRT_DEPTH_WORLD,
  computeTerrainBoundaryBottomY,
  normalizeTerrainGeometryMode,
  resolveTerracedEdgeWall,
};

/**
 * Milestone 8C-8C.2 R4 — Unified Map Coordinate Authority
 *
 * This module is deliberately renderer-agnostic. 2D, 3D, combat spatial
 * queries, and the future headless/AI-GM map command API must convert map
 * cells through the same canonical map-space formulas before projecting into
 * their own presentation spaces.
 *
 * Canonical map units:
 * - hex: one unit = one hex radius
 * - square: one unit = half one square cell span
 */
export const MAP_COORDINATE_AUTHORITY_VERSION = 1;
export const MAP_COORDINATE_AUTHORITY_ID = "canonical-map-coordinate-v1";

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeCanonicalMapType(value) {
  return String(value ?? "hex").trim().toLowerCase() === "square" ? "square" : "hex";
}

/**
 * Return the canonical map-space center of a terrain cell.
 *
 * Hex maps use the same odd-r offset geometry as TacticalMap:
 *   X = sqrt(3) * (column + 0.5 * (row & 1))
 *   Z = 1.5 * row
 */
export function cellToCanonicalMapPoint(cell = {}, mapType = "hex") {
  const col = finite(cell.x ?? cell.q, 0);
  const rowValue = finite(cell.y ?? cell.r, 0);
  const type = normalizeCanonicalMapType(mapType);

  if (type === "square") {
    return { x: col * 2, z: rowValue * 2 };
  }

  const row = Math.round(rowValue);
  return {
    x: Math.sqrt(3) * (col + 0.5 * (row & 1)),
    z: 1.5 * rowValue,
  };
}

export function canonicalMapPointDelta(point = {}, origin = {}) {
  return {
    x: finite(point.x, 0) - finite(origin.x, 0),
    z: finite(point.z ?? point.y, 0) - finite(origin.z ?? origin.y, 0),
  };
}

export function projectCanonicalMapPointToOwner2D({
  point,
  ownerPoint,
  ownerCenterX = 0,
  ownerCenterY = 0,
  unitsPerMapUnit = 1,
} = {}) {
  const delta = canonicalMapPointDelta(point, ownerPoint);
  const scale = Math.max(0.0001, Math.abs(finite(unitsPerMapUnit, 1)));
  return {
    x: finite(ownerCenterX, 0) + delta.x * scale,
    y: finite(ownerCenterY, 0) + delta.z * scale,
  };
}

export function projectCanonicalMapSegmentToOwner2D({
  a,
  b,
  ownerPoint,
  ownerCenterX = 0,
  ownerCenterY = 0,
  unitsPerMapUnit = 1,
} = {}) {
  const pa = projectCanonicalMapPointToOwner2D({
    point: a,
    ownerPoint,
    ownerCenterX,
    ownerCenterY,
    unitsPerMapUnit,
  });
  const pb = projectCanonicalMapPointToOwner2D({
    point: b,
    ownerPoint,
    ownerCenterX,
    ownerCenterY,
    unitsPerMapUnit,
  });
  return { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y };
}

export function canonicalMapSegmentLength(a = {}, b = {}) {
  const delta = canonicalMapPointDelta(b, a);
  return Math.hypot(delta.x, delta.z);
}

export default {
  MAP_COORDINATE_AUTHORITY_VERSION,
  MAP_COORDINATE_AUTHORITY_ID,
  normalizeCanonicalMapType,
  cellToCanonicalMapPoint,
  canonicalMapPointDelta,
  projectCanonicalMapPointToOwner2D,
  projectCanonicalMapSegmentToOwner2D,
  canonicalMapSegmentLength,
};

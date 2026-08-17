import * as THREE from "three";
import { TILE_HEIGHT_UNIT_TO_WORLD_Y } from "../hexGridMath.js";
import {
  cellToOrthogonalStructurePoint,
  getCellOrthogonalStructureSegments,
  getOrthogonalStructureJunctions,
  normalizeOrthogonalStructureSegment,
} from "../maps/orthogonalStructureAuthority.js";
import {
  canonicalMapPointDelta,
  cellToCanonicalMapPoint,
  MAP_COORDINATE_AUTHORITY_ID,
} from "../maps/mapCoordinateAuthority.js";

const WORLD_PER_FOOT = TILE_HEIGHT_UNIT_TO_WORLD_Y / 2.5;
const MAP_SPACE_AUTHORITY = "orthogonal-registered-map-basis-v5";
const COLORS = Object.freeze({
  stone: 0x787878,
  "dungeon-stone": 0x4b5563,
  wood: 0x765033,
  timber: 0x765033,
  plaster: 0xd8d1c4,
  brick: 0x9a4f3d,
});

// Runtime-only calibration keyed by the actual Three.js terrain/map parent.
// This lets the structure renderer learn how the real 3D terrain maps
// canonical X/Z into parent-local X/Z instead of assuming axis/sign/layout.
const MAP_PARENT_CALIBRATION = new WeakMap();

function materialFor(edge, role = "wall") {
  let color = COLORS[edge.material] ?? COLORS.stone;
  if (edge.kind === "palisade" || edge.kind === "fence") color = COLORS.wood;
  if (role === "gate") color = 0x5f3a22;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    flatShading: edge.kind === "palisade",
  });
}

function disposeCollection(group) {
  if (!group) return;
  const materials = new Set();
  group.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((m) => m && materials.add(m));
    else if (child.material) materials.add(child.material);
  });
  materials.forEach((material) => material?.dispose?.());
}

function removeExistingCollections(tileMesh, structureParent, ownerKey) {
  const parents = new Set([tileMesh, structureParent].filter(Boolean));
  for (const parent of parents) {
    const matches = parent.children.filter((child) =>
      child?.userData?.orthogonalStructureCollection === true &&
      (
        child?.userData?.orthogonalStructureOwnerKey === ownerKey ||
        (parent === tileMesh && !child?.userData?.orthogonalStructureOwnerKey)
      )
    );
    matches.forEach((child) => {
      parent.remove(child);
      disposeCollection(child);
    });
  }
}

function addBox(group, size, position, rotationY, material, userData = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    ...userData,
    orthogonalStructureSegment: true,
    mapSpaceAuthority: MAP_SPACE_AUTHORITY,
    mapCoordinateAuthority: MAP_COORDINATE_AUTHORITY_ID,
  };
  group.add(mesh);
  return mesh;
}

function getTileSurfaceAnchorInMapParent(tileMesh, structureParent, surfaceY = 0) {
  tileMesh.updateWorldMatrix?.(true, false);
  structureParent.updateWorldMatrix?.(true, false);
  const world = tileMesh.localToWorld(new THREE.Vector3(0, Number(surfaceY) || 0, 0));
  return structureParent.worldToLocal(world.clone());
}

function getCalibrationState(structureParent) {
  let state = MAP_PARENT_CALIBRATION.get(structureParent);
  if (!state) {
    state = {
      anchors: new Map(),
      entries: new Map(),
      basis: null,
      calibratedAtAnchorCount: 0,
    };
    MAP_PARENT_CALIBRATION.set(structureParent, state);
  }
  return state;
}

function mapCellKey(mapType, col, row) {
  return `${String(mapType || "hex")}:${Number(col)},${Number(row)}`;
}

function registerCalibrationAnchor(state, { mapType, col, row, parentPoint }) {
  const key = mapCellKey(mapType, col, row);
  state.anchors.set(key, {
    key,
    canonical: cellToCanonicalMapPoint({ x: col, y: row }, mapType),
    parent: { x: parentPoint.x, z: parentPoint.z },
  });
}

/**
 * Solve the real 3D parent-local basis from any three non-collinear terrain
 * cell centers already registered. This is the R5 fix for the screenshot
 * mismatch: 3D no longer assumes canonical +X == parent +X or canonical +Z ==
 * parent +Z. Swapped axes, negative Z, rotation and scale are learned from the
 * terrain itself.
 */
function deriveRegisteredMapBasis(state) {
  const anchors = [...state.anchors.values()];
  if (anchors.length < 3) return null;

  for (let i = 0; i < anchors.length - 2; i += 1) {
    const a = anchors[i];
    for (let j = i + 1; j < anchors.length - 1; j += 1) {
      const b = anchors[j];
      const c1x = b.canonical.x - a.canonical.x;
      const c1z = b.canonical.z - a.canonical.z;
      const p1x = b.parent.x - a.parent.x;
      const p1z = b.parent.z - a.parent.z;

      for (let k = j + 1; k < anchors.length; k += 1) {
        const c = anchors[k];
        const c2x = c.canonical.x - a.canonical.x;
        const c2z = c.canonical.z - a.canonical.z;
        const det = c1x * c2z - c2x * c1z;
        if (Math.abs(det) <= 1e-8) continue;

        const p2x = c.parent.x - a.parent.x;
        const p2z = c.parent.z - a.parent.z;

        const xAxis = {
          x: (p1x * c2z - p2x * c1z) / det,
          z: (p1z * c2z - p2z * c1z) / det,
        };
        const zAxis = {
          x: (c1x * p2x - c2x * p1x) / det,
          z: (c1x * p2z - c2x * p1z) / det,
        };

        const xLen = Math.hypot(xAxis.x, xAxis.z);
        const zLen = Math.hypot(zAxis.x, zAxis.z);
        if (xLen <= 1e-6 || zLen <= 1e-6) continue;

        return {
          xAxis,
          zAxis,
          sourceKeys: [a.key, b.key, c.key],
        };
      }
    }
  }
  return null;
}

function structurePointInMapParent(
  point,
  ownerPoint,
  mapUnitsToParentUnits,
  ownerSurfaceParent,
  mapBasis = null
) {
  // Keep this canonical delta as the shared 2D/3D structure authority.
  const delta = canonicalMapPointDelta(point, ownerPoint);

  if (mapBasis?.xAxis && mapBasis?.zAxis) {
    return new THREE.Vector3(
      ownerSurfaceParent.x + delta.x * mapBasis.xAxis.x + delta.z * mapBasis.zAxis.x,
      ownerSurfaceParent.y,
      ownerSurfaceParent.z + delta.x * mapBasis.xAxis.z + delta.z * mapBasis.zAxis.z
    );
  }

  // Conservative fallback used only until enough terrain cells have registered
  // to solve the real parent-local map basis.
  return new THREE.Vector3(
    ownerSurfaceParent.x + delta.x * mapUnitsToParentUnits,
    ownerSurfaceParent.y,
    ownerSurfaceParent.z + delta.z * mapUnitsToParentUnits
  );
}

function segmentTransformInMapParent(a, b) {
  const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.max(0.04, Math.hypot(dx, dz));
  const rotationY = Math.atan2(dz, dx);
  return { center, length, rotationY };
}

function addPalisade(group, edge, length, thickness, height, center, rotationY, userData) {
  const postCount = Math.max(3, Math.ceil(length / Math.max(0.12, thickness * 1.6)));
  const postWidth = Math.max(0.055, thickness * 0.75);
  for (let i = 0; i < postCount; i += 1) {
    const t = postCount === 1 ? 0 : i / (postCount - 1);
    const offset = (t - 0.5) * (length - postWidth);
    const dx = Math.cos(rotationY) * offset;
    const dz = Math.sin(rotationY) * offset;
    addBox(
      group,
      [postWidth, height, postWidth],
      [center.x + dx, center.y + height / 2, center.z + dz],
      rotationY,
      materialFor(edge),
      { ...userData, structureSegment: "palisade-post" }
    );
  }
}

function addFence(group, edge, length, thickness, height, center, rotationY, userData) {
  const postWidth = Math.max(0.05, thickness * 0.8);
  for (const offset of [-length * 0.42, length * 0.42]) {
    const dx = Math.cos(rotationY) * offset;
    const dz = Math.sin(rotationY) * offset;
    addBox(
      group,
      [postWidth, height, postWidth],
      [center.x + dx, center.y + height / 2, center.z + dz],
      rotationY,
      materialFor(edge),
      userData
    );
  }
  for (const yFraction of [0.38, 0.72]) {
    addBox(
      group,
      [length, Math.max(0.045, thickness * 0.38), thickness * 0.55],
      [center.x, center.y + height * yFraction, center.z],
      rotationY,
      materialFor(edge),
      userData
    );
  }
}

function addGate(group, edge, length, thickness, height, center, rotationY, userData) {
  const frameWidth = Math.max(0.07, thickness * 0.9);
  const opening = Math.min(length * 0.72, 4 * WORLD_PER_FOOT);
  const side = Math.max(frameWidth, (length - opening) / 2);
  for (const sign of [-1, 1]) {
    const offset = sign * (opening / 2 + side / 2);
    const dx = Math.cos(rotationY) * offset;
    const dz = Math.sin(rotationY) * offset;
    addBox(
      group,
      [side, height, thickness],
      [center.x + dx, center.y + height / 2, center.z + dz],
      rotationY,
      materialFor(edge),
      userData
    );
  }
  addBox(
    group,
    [opening, Math.max(0.1, height * 0.18), thickness],
    [center.x, center.y + height * 0.91, center.z],
    rotationY,
    materialFor(edge),
    userData
  );
  if (!edge.open) {
    addBox(
      group,
      [opening * 0.94, height * 0.78, thickness * 0.7],
      [center.x, center.y + height * 0.39, center.z],
      rotationY,
      materialFor(edge, "gate"),
      { ...userData, structureSegment: "gate-leaf" }
    );
  }
}

function renderSegment(
  group,
  segment,
  ownerPoint,
  mapUnitsToParentUnits,
  ownerSurfaceParent,
  mapBasis,
  userData
) {
  const edge = normalizeOrthogonalStructureSegment(segment);
  if (!edge) return;

  const a = structurePointInMapParent(
    edge.a,
    ownerPoint,
    mapUnitsToParentUnits,
    ownerSurfaceParent,
    mapBasis
  );
  const b = structurePointInMapParent(
    edge.b,
    ownerPoint,
    mapUnitsToParentUnits,
    ownerSurfaceParent,
    mapBasis
  );
  const { center, length, rotationY } = segmentTransformInMapParent(a, b);
  const thickness = Math.max(0.025, Number(edge.thicknessFeet || 0.5) * WORLD_PER_FOOT);
  const height = Math.max(0.08, Number(edge.heightFeet || 10) * WORLD_PER_FOOT);
  const payload = {
    ...userData,
    mapOrientation: edge.orientation,
    mapParentA: { x: a.x, y: a.y, z: a.z },
    mapParentB: { x: b.x, y: b.y, z: b.z },
  };

  if (edge.kind === "palisade") {
    return addPalisade(group, edge, length, thickness, height, center, rotationY, payload);
  }
  if (edge.kind === "fence") {
    return addFence(group, edge, length, thickness, height, center, rotationY, payload);
  }
  if (edge.kind === "gate") {
    return addGate(group, edge, length, thickness, height, center, rotationY, payload);
  }
  return addBox(
    group,
    [length, height, thickness],
    [center.x, center.y + height / 2, center.z],
    rotationY,
    materialFor(edge),
    payload
  );
}

function renderCornerPosts(
  group,
  segments,
  ownerPoint,
  mapUnitsToParentUnits,
  ownerSurfaceParent,
  mapBasis
) {
  const junctions = getOrthogonalStructureJunctions(segments)
    .filter((junction) => ["corner", "tee", "cross"].includes(junction.type));

  for (const junction of junctions) {
    const exemplar = junction.segments[0];
    const p = structurePointInMapParent(
      junction.point,
      ownerPoint,
      mapUnitsToParentUnits,
      ownerSurfaceParent,
      mapBasis
    );
    const thickness = Math.max(0.035, Number(exemplar.thicknessFeet || 0.5) * WORLD_PER_FOOT * 1.15);
    const height = Math.max(0.08, Number(exemplar.heightFeet || 10) * WORLD_PER_FOOT);
    addBox(
      group,
      [thickness, height, thickness],
      [p.x, p.y + height / 2, p.z],
      0,
      materialFor(exemplar),
      {
        structureSegment: `${junction.type}-join`,
        junctionType: junction.type,
        mapParentPoint: { x: p.x, y: p.y, z: p.z },
      }
    );
  }
}

function renderEntry(entry, mapBasis = null) {
  const {
    tileMesh,
    cell,
    mapType,
    col,
    row,
    hexRadius,
    structureParent,
    ownerKey,
  } = entry;

  removeExistingCollections(tileMesh, structureParent, ownerKey);

  const segments = getCellOrthogonalStructureSegments(cell);
  if (!segments.length) return null;

  const latticeStep = Number(segments[0]?.latticeStep || 1);
  const ownerPoint = cellToOrthogonalStructurePoint({ x: col, y: row }, mapType, latticeStep);
  const surfaceY = Number.isFinite(Number(tileMesh.userData?.surfaceY))
    ? Number(tileMesh.userData.surfaceY)
    : 0;
  const ownerSurfaceParent = getTileSurfaceAnchorInMapParent(tileMesh, structureParent, surfaceY);
  const mapUnitsToParentUnits = Math.max(0.0001, Math.abs(Number(hexRadius) || 1));

  const collection = new THREE.Group();
  collection.name = `orthogonal-structure-runs-${col}-${row}`;
  collection.userData = {
    orthogonalStructureCollection: true,
    orthogonalStructureOwnerKey: ownerKey,
    mapSpaceAuthority: MAP_SPACE_AUTHORITY,
    mapCoordinateAuthority: MAP_COORDINATE_AUTHORITY_ID,
    mapType,
    ownerCell: { x: col, y: row },
    ownerMapPoint: { x: ownerPoint.x, z: ownerPoint.z },
    ownerSurfaceParent: {
      x: ownerSurfaceParent.x,
      y: ownerSurfaceParent.y,
      z: ownerSurfaceParent.z,
    },
    mapUnitsToParentUnits,
    registeredMapBasis: mapBasis
      ? {
          xAxis: { ...mapBasis.xAxis },
          zAxis: { ...mapBasis.zAxis },
          sourceKeys: [...(mapBasis.sourceKeys || [])],
        }
      : null,
    segmentCount: segments.length,
  };

  segments.forEach((segment) => renderSegment(
    collection,
    segment,
    ownerPoint,
    mapUnitsToParentUnits,
    ownerSurfaceParent,
    mapBasis,
    {
      runId: segment.runId,
      segmentId: segment.id,
      structureKind: segment.kind,
      blocksMovement: segment.blocksMovement,
      blocksLineOfSight: segment.blocksLineOfSight,
    }
  ));
  renderCornerPosts(
    collection,
    segments,
    ownerPoint,
    mapUnitsToParentUnits,
    ownerSurfaceParent,
    mapBasis
  );

  structureParent.add(collection);
  return collection;
}

/**
 * R5 — registered terrain-basis 3D authority.
 *
 * Every terrain tile call registers its ACTUAL rendered center in parent-local
 * space. As soon as three non-collinear cells are known, the renderer solves
 * the affine X/Z basis used by the real terrain. Orthogonal structure points
 * are then projected through that basis.
 *
 * This fixes the remaining 2D/3D mismatch when the Three.js terrain uses a
 * different axis order, Z sign, rotation, or scale than the canonical map
 * formulas. The owner tile remains the vertical/surface anchor only.
 */
export function replaceOrthogonalStructureLayerGroup({
  tileMesh,
  cell,
  mapType = "hex",
  x = null,
  y = null,
  hexRadius = 1,
} = {}) {
  if (!tileMesh) return null;

  const col = Number(x ?? cell?.x ?? cell?.q ?? tileMesh.userData?.q ?? 0);
  const row = Number(y ?? cell?.y ?? cell?.r ?? tileMesh.userData?.r ?? 0);
  const ownerKey = mapCellKey(mapType, col, row);
  const structureParent = tileMesh.parent || tileMesh;
  const state = getCalibrationState(structureParent);

  const surfaceY = Number.isFinite(Number(tileMesh.userData?.surfaceY))
    ? Number(tileMesh.userData.surfaceY)
    : 0;
  const ownerSurfaceParent = getTileSurfaceAnchorInMapParent(tileMesh, structureParent, surfaceY);

  registerCalibrationAnchor(state, {
    mapType,
    col,
    row,
    parentPoint: ownerSurfaceParent,
  });

  state.entries.set(ownerKey, {
    tileMesh,
    cell,
    mapType,
    col,
    row,
    hexRadius,
    structureParent,
    ownerKey,
  });

  const previouslyCalibrated = !!state.basis;
  if (!state.basis) {
    state.basis = deriveRegisteredMapBasis(state);
    if (state.basis) state.calibratedAtAnchorCount = state.anchors.size;
  }

  // If calibration just became possible, repair any wall collection rendered
  // earlier using the temporary fallback. This makes build order irrelevant.
  if (!previouslyCalibrated && state.basis) {
    let current = null;
    for (const [key, entry] of state.entries.entries()) {
      const rendered = renderEntry(entry, state.basis);
      if (key === ownerKey) current = rendered;
    }
    return current;
  }

  return renderEntry(state.entries.get(ownerKey), state.basis);
}

export default replaceOrthogonalStructureLayerGroup;

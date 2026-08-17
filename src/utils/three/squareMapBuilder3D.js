import { replaceBridgeDeckLayerGroup } from "./bridgeDeck3D.js";
import { replaceSquareStructureGroup } from "./squareStructure3D.js";
import * as THREE from "three";
import {
  HEX_RADIUS,
  HEX_TILE_THICKNESS,
  TILE_HEIGHT_UNIT_TO_WORLD_Y,
} from "../hexGridMath.js";
import {
  createTerrainTexture,
  normalizeTerrainName,
  terrainColor,
} from "./mapBuilder3D.js";
import {
  DEFAULT_TERRAIN_BOUNDARY_SKIRT_DEPTH_WORLD,
  computeTerrainBoundaryBottomY,
  resolveTerracedEdgeWall,
} from "../maps/terrainMeshAuthority.js";

export const SQUARE_TILE_SIZE = Math.sqrt(3) * HEX_RADIUS;

const SQUARE_DIRECTIONS = Object.freeze([
  Object.freeze({ key: "E", dx: 1, dy: 0 }),
  Object.freeze({ key: "S", dx: 0, dy: 1 }),
  Object.freeze({ key: "W", dx: -1, dy: 0 }),
  Object.freeze({ key: "N", dx: 0, dy: -1 }),
]);

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

function squareSurfaceWorldY(heightUnits = 0) {
  const height = Number(heightUnits);
  if (!Number.isFinite(height) || height === 0) return HEX_TILE_THICKNESS;
  return height * TILE_HEIGHT_UNIT_TO_WORLD_Y;
}

function cellHeight(cell = {}) {
  if (Number.isFinite(Number(cell?.height))) return Number(cell.height);
  if (Number.isFinite(Number(cell?.elevation))) return Number(cell.elevation);
  return 0;
}

function cellTerrain(cell = {}) {
  return normalizeTerrainName(
    cell?.textureId ||
    cell?.terrain ||
    cell?.terrainType ||
    "grass"
  );
}

function sideTerrain(cell = {}) {
  if (cell?.wallTextureId) return normalizeTerrainName(cell.wallTextureId);
  if (cell?.wallTerrainType) return normalizeTerrainName(cell.wallTerrainType);
  const height = Math.abs(cellHeight(cell));
  return height > 2 ? "dirt" : cellTerrain(cell);
}

export function makeSquareTileKey(col, row) {
  return `${Number(col)},${Number(row)}`;
}

export function squareWorldPosition(col, row, tileSize = SQUARE_TILE_SIZE) {
  const size = Math.max(0.1, finite(tileSize, SQUARE_TILE_SIZE));
  return new THREE.Vector3(Number(col) * size, 0, Number(row) * size);
}

function buildChangedCellOverlay(changedCells = []) {
  const overlay = new Map();
  (Array.isArray(changedCells) ? changedCells : []).forEach((change) => {
    const col = Number(change?.col);
    const row = Number(change?.row);
    if (!Number.isInteger(col) || !Number.isInteger(row)) return;
    overlay.set(makeSquareTileKey(col, row), change?.cell || {});
  });
  return overlay;
}

function makeGridAccessor(grid = [], changedCells = []) {
  const overlay = buildChangedCellOverlay(changedCells);
  const rows = Array.isArray(grid) ? grid : [];

  const getCell = (col, row) => {
    const key = makeSquareTileKey(col, row);
    if (overlay.has(key)) return overlay.get(key);
    return rows?.[row]?.[col] ?? null;
  };

  return {
    getCell,
    width: rows.reduce(
      (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
      0
    ),
    height: rows.length,
    overlay,
  };
}

function computeSquareBoundaryBottomY(accessor) {
  const surfaceYs = [];
  for (let row = 0; row < accessor.height; row += 1) {
    for (let col = 0; col < accessor.width; col += 1) {
      const cell = accessor.getCell(col, row);
      if (!cell) continue;
      surfaceYs.push(squareSurfaceWorldY(cellHeight(cell)));
    }
  }

  const skirtDepth = Math.max(
    DEFAULT_TERRAIN_BOUNDARY_SKIRT_DEPTH_WORLD,
    HEX_TILE_THICKNESS * 2,
    TILE_HEIGHT_UNIT_TO_WORLD_Y
  );

  return computeTerrainBoundaryBottomY(
    surfaceYs,
    skirtDepth,
    HEX_TILE_THICKNESS
  );
}

function pushVertex(vertices, uvs, x, y, z, u, v) {
  vertices.push(x, y, z);
  uvs.push(u, v);
  return vertices.length / 3 - 1;
}

function pushWall(vertices, uvs, indices, topA, topB, lowerA, lowerB) {
  const a = pushVertex(vertices, uvs, ...topA, 0, 0);
  const b = pushVertex(vertices, uvs, ...topB, 1, 0);
  const c = pushVertex(vertices, uvs, ...lowerA, 0, 1);
  const d = pushVertex(vertices, uvs, ...lowerB, 1, 1);
  indices.push(a, c, d, a, d, b);
}

function squareEdgePoints(directionKey, half, upperY, lowerY) {
  switch (directionKey) {
    case "E":
      return {
        topA: [half, upperY, -half],
        topB: [half, upperY, half],
        lowerA: [half, lowerY, -half],
        lowerB: [half, lowerY, half],
      };
    case "S":
      return {
        topA: [half, upperY, half],
        topB: [-half, upperY, half],
        lowerA: [half, lowerY, half],
        lowerB: [-half, lowerY, half],
      };
    case "W":
      return {
        topA: [-half, upperY, half],
        topB: [-half, upperY, -half],
        lowerA: [-half, lowerY, half],
        lowerB: [-half, lowerY, -half],
      };
    case "N":
    default:
      return {
        topA: [-half, upperY, -half],
        topB: [half, upperY, -half],
        lowerA: [-half, lowerY, -half],
        lowerB: [half, lowerY, -half],
      };
  }
}

export function createSquareTerrainGeometry({
  cell = {},
  col,
  row,
  accessor,
  tileSize = SQUARE_TILE_SIZE,
  boundaryBottomY,
} = {}) {
  const size = Math.max(0.1, finite(tileSize, SQUARE_TILE_SIZE));
  const half = size / 2;
  const topY = squareSurfaceWorldY(cellHeight(cell));
  const bottomY = Number.isFinite(Number(boundaryBottomY))
    ? Number(boundaryBottomY)
    : topY - TILE_HEIGHT_UNIT_TO_WORLD_Y;

  const vertices = [];
  const uvs = [];
  const indices = [];

  // Top face, wound upward.
  const topStart = indices.length;
  const nw = pushVertex(vertices, uvs, -half, topY, -half, 0, 0);
  const ne = pushVertex(vertices, uvs, half, topY, -half, 1, 0);
  const se = pushVertex(vertices, uvs, half, topY, half, 1, 1);
  const sw = pushVertex(vertices, uvs, -half, topY, half, 0, 1);
  indices.push(nw, se, ne, nw, sw, se);
  const topCount = indices.length - topStart;

  const wallStart = indices.length;
  let interiorWallCount = 0;
  let boundaryWallCount = 0;

  for (const direction of SQUARE_DIRECTIONS) {
    const neighbor = accessor?.getCell?.(
      Number(col) + direction.dx,
      Number(row) + direction.dy
    );
    const neighborTopY = neighbor
      ? squareSurfaceWorldY(cellHeight(neighbor))
      : null;

    const plan = resolveTerracedEdgeWall({
      ownTopY: topY,
      neighborTopY,
      hasNeighbor: Boolean(neighbor),
      boundaryBottomY: bottomY,
      epsilon: 0.001,
    });

    if (!plan.draw) continue;

    const points = squareEdgePoints(
      direction.key,
      half,
      plan.upperY + 0.001,
      plan.lowerY - 0.001
    );
    pushWall(
      vertices,
      uvs,
      indices,
      points.topA,
      points.topB,
      points.lowerA,
      points.lowerB
    );

    if (plan.kind === "boundary") boundaryWallCount += 1;
    else interiorWallCount += 1;
  }

  const wallCount = indices.length - wallStart;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );
  geometry.setIndex(indices);
  geometry.clearGroups();
  geometry.addGroup(topStart, topCount, 0);
  if (wallCount > 0) geometry.addGroup(wallStart, wallCount, 1);
  geometry.computeVertexNormals();

  geometry.userData = {
    mapType: "square",
    hasBottomCap: false,
    interiorWallCount,
    boundaryWallCount,
    surfaceY: topY,
  };

  return geometry;
}

function createSquareMaterials(cell = {}) {
  const terrain = cellTerrain(cell);
  const topTexture = createTerrainTexture(terrain);
  if (topTexture) topTexture.colorSpace = THREE.SRGBColorSpace;

  const wallTerrain = sideTerrain(cell);
  const wallTexture = createTerrainTexture(wallTerrain);
  if (wallTexture) wallTexture.colorSpace = THREE.SRGBColorSpace;

  return [
    new THREE.MeshStandardMaterial({
      map: topTexture,
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      map: wallTexture,
      color: wallTexture ? 0xffffff : terrainColor(wallTerrain),
      roughness: 0.92,
      metalness: 0,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
  ];
}

function disposeSquareMesh(mesh) {
  if (!mesh) return;
  mesh.geometry?.dispose?.();
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  materials.forEach((material) => {
    // Terrain textures are cached/shared by mapBuilder3D; do not dispose maps.
    material?.dispose?.();
  });
}

export function createSquareTerrainMesh({
  cell = {},
  col,
  row,
  accessor,
  tileSize = SQUARE_TILE_SIZE,
  boundaryBottomY,
} = {}) {
  const geometry = createSquareTerrainGeometry({
    cell,
    col,
    row,
    accessor,
    tileSize,
    boundaryBottomY,
  });
  const mesh = new THREE.Mesh(geometry, createSquareMaterials(cell));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.copy(squareWorldPosition(col, row, tileSize));

  const height = cellHeight(cell);
  mesh.userData = {
    ...cell,
    q: Number(col),
    r: Number(row),
    height,
    elevation: height,
    terrain: cellTerrain(cell),
    terrainType: cellTerrain(cell),
    gridCell: cell,
    gridPosition: { col: Number(col), row: Number(row) },
    mapType: "square",
    surfaceY: squareSurfaceWorldY(height),
  };


  replaceBridgeDeckLayerGroup({
    tileMesh: mesh,
    cell,
    tileSpan: tileSize,
    mapType: "square",
    parentRotationY: 0,
  });
  return mesh;
}

export function buildSquare3DFromGrid(
  grid = [],
  tileSize = SQUARE_TILE_SIZE
) {
  const group = new THREE.Group();
  group.name = "square-terrain-grid";
  group.userData.mapType = "square";
  const tileMeshLookup = new Map();

  const accessor = makeGridAccessor(grid);
  const boundaryBottomY = computeSquareBoundaryBottomY(accessor);
  group.userData.boundaryBottomY = boundaryBottomY;
  group.userData.tileSize = tileSize;

  for (let row = 0; row < accessor.height; row += 1) {
    for (let col = 0; col < accessor.width; col += 1) {
      const cell = accessor.getCell(col, row);
      if (!cell) continue;
      const mesh = createSquareTerrainMesh({
        cell,
        col,
        row,
        accessor,
        tileSize,
        boundaryBottomY,
      });
      group.add(mesh);
      tileMeshLookup.set(makeSquareTileKey(col, row), mesh);
    }
  }

  replaceSquareStructureGroup({
    group,
    grid,
    tileSize,
  });

  return { group, tileMeshLookup };
}

export function syncSquareGridDiffToGroup({
  group,
  tileMeshLookup,
  grid = [],
  changedCells = [],
  tileSize = SQUARE_TILE_SIZE,
  createIfMissing = true,
} = {}) {
  if (!group || !tileMeshLookup || !Array.isArray(changedCells)) {
    return { updated: 0, added: 0, missing: 0 };
  }

  const accessor = makeGridAccessor(grid, changedCells);
  const boundaryBottomY = computeSquareBoundaryBottomY(accessor);
  group.userData.mapType = "square";
  group.userData.boundaryBottomY = boundaryBottomY;
  group.userData.tileSize = tileSize;

  const affected = new Set();
  changedCells.forEach((change) => {
    const col = Number(change?.col);
    const row = Number(change?.row);
    if (!Number.isInteger(col) || !Number.isInteger(row)) return;
    affected.add(makeSquareTileKey(col, row));
    SQUARE_DIRECTIONS.forEach((direction) => {
      const nextCol = col + direction.dx;
      const nextRow = row + direction.dy;
      if (
        nextCol >= 0 &&
        nextRow >= 0 &&
        nextCol < accessor.width &&
        nextRow < accessor.height
      ) {
        affected.add(makeSquareTileKey(nextCol, nextRow));
      }
    });
  });

  let updated = 0;
  let added = 0;
  let missing = 0;

  for (const key of affected) {
    const [colText, rowText] = key.split(",");
    const col = Number(colText);
    const row = Number(rowText);
    const cell = accessor.getCell(col, row);
    if (!cell) {
      missing += 1;
      continue;
    }

    const previous = tileMeshLookup.get(key);
    if (!previous && !createIfMissing) {
      missing += 1;
      continue;
    }

    const replacement = createSquareTerrainMesh({
      cell,
      col,
      row,
      accessor,
      tileSize,
      boundaryBottomY,
    });

    if (previous) {
      group.remove(previous);
      disposeSquareMesh(previous);
      updated += 1;
    } else {
      added += 1;
    }

    group.add(replacement);
    tileMeshLookup.set(key, replacement);
  }

  const effectiveStructureGrid = Array.from(
    { length: accessor.height },
    (_, row) => Array.from(
      { length: accessor.width },
      (_, col) => accessor.getCell(col, row)
    )
  );
  replaceSquareStructureGroup({
    group,
    grid: effectiveStructureGrid,
    tileSize,
  });

  return { updated, added, missing };
}

export default {
  SQUARE_TILE_SIZE,
  buildSquare3DFromGrid,
  createSquareTerrainGeometry,
  createSquareTerrainMesh,
  makeSquareTileKey,
  squareWorldPosition,
  syncSquareGridDiffToGroup,
};

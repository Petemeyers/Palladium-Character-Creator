import * as THREE from "three";
import { HexStackManager } from "./hexStackManager.js";
import {
  worldVectorFromAxial,
  axialToOffset,
  offsetToAxial,
} from "../hexGridMath.js";

const TERRAIN_TYPES = [
  "grass",
  "forest",
  "rock",
  "water",
  "sand",
  "hill",
  "road",
];
const TERRAIN_COLOR = {
  grass: "#3A8D4F",
  forest: "#2E5B3B",
  rock: "#5A5A5A",
  water: "#2A4EA0",
  sand: "#D8B56E",
  hill: "#6E8C3A",
  road: "#B2A07A",
};

export function randomTerrain(weights = {}) {
  const defaultWeights = {
    water: 0.08,
    sand: 0.12,
    grass: 0.3,
    forest: 0.22,
    hill: 0.12,
    rock: 0.1,
    road: 0.06,
  };

  const merged = { ...defaultWeights, ...weights };
  const totalWeight = TERRAIN_TYPES.reduce(
    (acc, type) => acc + Math.max(merged[type] || 0, 0),
    0
  );
  if (totalWeight <= 0) {
    return "grass";
  }

  let threshold = Math.random() * totalWeight;
  for (const type of TERRAIN_TYPES) {
    threshold -= Math.max(merged[type] || 0, 0);
    if (threshold <= 0) {
      return type;
    }
  }
  return TERRAIN_TYPES[TERRAIN_TYPES.length - 1];
}

export function buildFeaturesForTerrain(terrain) {
  if (terrain === "forest") {
    const trees = Math.floor(Math.random() * 2) + 1;
    return Array.from({ length: trees }, () => ({
      type: "tree",
      offsetX: (Math.random() - 0.5) * 0.5,
      offsetZ: (Math.random() - 0.5) * 0.5,
      scale: 0.6 + Math.random() * 0.25,
    }));
  }
  if (terrain === "rock" && Math.random() < 0.25) {
    return [{ type: "boulder" }];
  }
  if (terrain === "water" && Math.random() < 0.15) {
    return [{ type: "reeds" }];
  }
  if (terrain === "road") {
    return [{ type: "road" }];
  }
  return [];
}

export function buildRandom3DMap(radius = 5, maxHeight = 3, options = {}) {
  const manager = new HexStackManager();
  const {
    weights,
    heightByTerrain,
    uniformTerrain = true,
    baseTerrain = "grass",
  } = options;

  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) > radius) continue;
      const terrain = uniformTerrain ? baseTerrain : randomTerrain(weights);

      const terrainHeight = heightByTerrain?.[terrain];
      const height =
        typeof terrainHeight === "number"
          ? terrainHeight
          : terrain === "hill"
          ? Math.floor(Math.random() * Math.max(1, maxHeight)) + 1
          : 0;

      const tile = manager.addTile(
        q,
        r,
        height,
        terrain,
        buildFeaturesForTerrain(terrain)
      );
      const { col, row } = axialToOffset(q, r);
      tile.gridPosition = { col, row };
    }
  }

  return manager;
}

export function buildRectangular3DMap(rows = 12, cols = 12, options = {}) {
  const {
    weights,
    maxHeight = 3,
    heightResolver,
    uniformTerrain = true,
    baseTerrain = "grass",
  } = options;
  const manager = new HexStackManager();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { q, r } = offsetToAxial(col, row);
      const terrain = uniformTerrain ? baseTerrain : randomTerrain(weights);
      const height =
        typeof heightResolver === "function"
          ? heightResolver(terrain, row, col)
          : terrain === "hill"
          ? Math.floor(Math.random() * Math.max(1, maxHeight)) + 1
          : 0;

      const tile = manager.addTile(
        q,
        r,
        height,
        terrain,
        buildFeaturesForTerrain(terrain)
      );
      tile.gridPosition = { row, col };
    }
  }

  manager.metadata = {
    rows,
    cols,
  };

  return manager;
}

export function createHexMesh(tile, size = 1, heightScale = 0.6) {
  const geometry = new THREE.CylinderGeometry(
    size,
    size,
    Math.max(heightScale, heightScale + tile.height * 0.4),
    6
  );
  const material = new THREE.MeshStandardMaterial({
    color: TERRAIN_COLOR[tile.terrain] || "#888888",
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const pos = worldVectorFromAxial(
    tile.q ?? 0,
    tile.r ?? 0,
    geometry.parameters.height / 2,
    size
  );
  mesh.position.copy(pos);
  mesh.userData = tile;
  return mesh;
}

export function createForestTree() {
  const tree = new THREE.Group();

  const trunkGeometry = new THREE.CylinderGeometry(0.06, 0.1, 1.6, 6);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#8B5A2B" });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.name = "trunk";
  trunk.castShadow = true;
  trunk.receiveShadow = true;

  const leavesGeometry = new THREE.ConeGeometry(0.35, 1.4, 10);
  const leavesMaterial = new THREE.MeshStandardMaterial({
    color: "#0F3D0F",
    flatShading: true,
  });
  const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
  leaves.name = "leaves";
  leaves.position.y = 1;
  leaves.castShadow = true;
  leaves.receiveShadow = true;

  trunk.position.y = trunkGeometry.parameters.height / 2;

  tree.add(trunk);
  tree.add(leaves);
  return tree;
}

export function terrainColor(terrain) {
  return TERRAIN_COLOR[terrain] || "#888888";
}

/**
 * Build a 3D hexagon group from a grid array
 * @param {Array} grid - Array of grid cells/rows
 * @param {number} hexRadius - Radius of hex tiles
 * @returns {Object} Object with group (THREE.Group) and tileMeshLookup (Map)
 */
export function buildHexagon3DFromGrid(grid = [], hexRadius = 1) {
  const group = new THREE.Group();
  const tileMeshLookup = new Map();

  if (!Array.isArray(grid) || grid.length === 0) {
    return { group, tileMeshLookup };
  }

  // Handle grid as array of rows (2D array) or flat array of cells
  const is2D = Array.isArray(grid[0]) && typeof grid[0][0] === 'object';
  
  if (is2D) {
    // 2D grid: array of rows
    grid.forEach((row = [], rowIndex) => {
      row.forEach((cell = {}, colIndex) => {
        const { q, r } = offsetToAxial(colIndex, rowIndex);
        const terrain = cell.terrain || cell.terrainType || "grass";
        const height = Number.isFinite(cell.height) ? cell.height : (Number.isFinite(cell.elevation) ? cell.elevation : 0);
        
        const tile = {
          q,
          r,
          height,
          terrain: terrain.toLowerCase(),
          features: cell.features || (cell.feature ? [cell.feature] : []),
        };

        const mesh = createHexMesh(tile, hexRadius, 0.6);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { ...tile, gridCell: cell, gridPosition: { row: rowIndex, col: colIndex } };
        
        group.add(mesh);
        const key = `${q},${r}`;
        tileMeshLookup.set(key, mesh);
      });
    });
  } else {
    // Flat array of cells with q, r coordinates
    grid.forEach((cell = {}) => {
      const q = cell.q ?? 0;
      const r = cell.r ?? 0;
      const terrain = cell.terrain || cell.terrainType || "grass";
      const height = Number.isFinite(cell.height) ? cell.height : (Number.isFinite(cell.elevation) ? cell.elevation : 0);
      
      const tile = {
        q,
        r,
        height,
        terrain: terrain.toLowerCase(),
        features: cell.features || (cell.feature ? [cell.feature] : []),
      };

      const mesh = createHexMesh(tile, hexRadius, 0.6);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { ...tile, gridCell: cell };
      
      group.add(mesh);
      const key = `${q},${r}`;
      tileMeshLookup.set(key, mesh);
    });
  }

  return { group, tileMeshLookup };
}

export { TERRAIN_TYPES };

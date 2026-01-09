import * as THREE from "three";
import { HexStackManager } from "./hexStackManager.js";
import {
  worldVectorFromAxial,
  axialToOffset,
  offsetToAxial,
} from "../hexGridMath.js";
import { tileSurfaceWorldY } from "../hexGridMath.js";

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
      tile.gridPosition = { col, row };
    }
  }

  manager.metadata = {
    rows,
    cols,
  };

  return manager;
}

// Texture cache for terrain types
const textureCache = new Map();

function createTerrainTexture(terrainType) {
  if (textureCache.has(terrainType)) {
    return textureCache.get(terrainType);
  }

  // Create procedural texture based on terrain type
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const baseColor = TERRAIN_COLOR[terrainType] || "#888888";

  // Fill base color
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);

  // Add texture pattern based on terrain
  if (terrainType === "grass") {
    // Grass texture: add small random dots
    ctx.fillStyle = "#2d6b3f";
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillRect(x, y, 2, 2);
    }
  } else if (terrainType === "forest") {
    // Forest: darker with some variation
    ctx.fillStyle = "#1a3d26";
    for (let i = 0; i < 150; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillRect(x, y, 3, 3);
    }
  } else if (terrainType === "rock") {
    // Rock: grayscale noise
    const imageData = ctx.createImageData(256, 256);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = Math.random() * 30 - 15;
      const r = Math.max(
        0,
        Math.min(255, parseInt(baseColor.slice(1, 3), 16) + noise)
      );
      const g = Math.max(
        0,
        Math.min(255, parseInt(baseColor.slice(3, 5), 16) + noise)
      );
      const b = Math.max(
        0,
        Math.min(255, parseInt(baseColor.slice(5, 7), 16) + noise)
      );
      imageData.data[i] = r;
      imageData.data[i + 1] = g;
      imageData.data[i + 2] = b;
      imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  } else if (terrainType === "water") {
    // Water: wave-like pattern
    ctx.fillStyle = "#1e3d6b";
    for (let y = 0; y < 256; y += 4) {
      for (let x = 0; x < 256; x++) {
        const wave = Math.sin((x + y) * 0.1) * 10;
        if (Math.random() > 0.7) {
          ctx.fillRect(x, y + wave, 1, 2);
        }
      }
    }
  } else if (terrainType === "sand") {
    // Sand: fine grain
    ctx.fillStyle = "#c9a86b";
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillRect(x, y, 1, 1);
    }
  } else if (terrainType === "road") {
    // Road: uniform with slight variation
    ctx.fillStyle = "#9b8a6a";
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2); // Repeat texture for better coverage
  textureCache.set(terrainType, texture);

  return texture;
}

export function createHexMesh(tile, size = 1) {
  const tileHeightUnits = Number.isFinite(tile?.height)
    ? tile.height
    : Number.isFinite(tile?.elevation)
    ? tile.elevation
    : 0;

  // Solid cliffs: tile is a column from y=0 up to its top surface.
  const topY = tileSurfaceWorldY(tileHeightUnits);
  const geomHeight = Math.max(0.01, topY);

  const geometry = new THREE.CylinderGeometry(size, size, geomHeight, 6);

  // Create material with texture
  const texture = createTerrainTexture(tile.terrain || "grass");
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: TERRAIN_COLOR[tile.terrain] || "#888888", // Keep color as fallback/tint
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const pos = worldVectorFromAxial(
    tile.q ?? 0,
    tile.r ?? 0,
    geometry.parameters.height / 2, // bottom at y=0
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
 * Normalize terrain names from various sources (hexGridGenerator, TacticalMap, etc.)
 * to the simple terrain keys expected by the 3D builder (grass, forest, rock, etc.)
 */
function normalizeTerrainName(raw) {
  const t = String(raw || "grass").toLowerCase();

  // Already compatible
  if (["grass", "forest", "rock", "water", "sand", "hill", "road"].includes(t))
    return t;

  // terrainKey-style inputs from hexGridGenerator (and similar)
  if (t.includes("forest")) return "forest";
  if (t.includes("rock") || t.includes("mountain") || t.includes("ruins"))
    return "rock";
  if (t.includes("swamp") || t.includes("marsh") || t.includes("water"))
    return "water";
  if (t.includes("desert") || t.includes("sand")) return "sand";
  if (t.includes("hill")) return "hill";
  if (t.includes("road")) return "road";

  return "grass";
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
  // If the first element is an array, treat it as a 2D grid (rows/cols),
  // even if the first row happens to be empty.
  const is2D = Array.isArray(grid[0]);

  if (is2D) {
    // 2D grid: array of rows
    grid.forEach((row = [], rowIndex) => {
      row.forEach((cell = {}, colIndex) => {
        const { q, r } = offsetToAxial(colIndex, rowIndex);
        const terrain = normalizeTerrainName(
          cell.terrain || cell.terrainType || "grass"
        );
        const height = Number.isFinite(cell.height)
          ? cell.height
          : Number.isFinite(cell.elevation)
          ? cell.elevation
          : 0;

        const tile = {
          q,
          r,
          height,
          terrain,
          features: cell.features || (cell.feature ? [cell.feature] : []),
        };

        const mesh = createHexMesh(tile, hexRadius, 0.6);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          ...tile,
          gridCell: cell,
          gridPosition: { col: colIndex, row: rowIndex },
        };

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
      const terrain = normalizeTerrainName(
        cell.terrain || cell.terrainType || "grass"
      );
      const height = Number.isFinite(cell.height)
        ? cell.height
        : Number.isFinite(cell.elevation)
        ? cell.elevation
        : 0;

      const tile = {
        q,
        r,
        height,
        terrain,
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

// ---------- Incremental sync helpers (MAP_EDITOR live updates) ----------

export function makeTileKey(q, r) {
  return `${q},${r}`;
}

export function cellToTile(col, row, cell = {}) {
  const { q, r } = offsetToAxial(col, row);
  const terrain = normalizeTerrainName(
    cell.terrain || cell.terrainType || "grass"
  );
  const height = Number.isFinite(cell.height)
    ? cell.height
    : Number.isFinite(cell.elevation)
    ? cell.elevation
    : 0;

  return {
    q,
    r,
    height,
    terrain,
    features: cell.features || (cell.feature ? [cell.feature] : []),
    gridCell: cell,
    gridPosition: { col, row },
  };
}

/**
 * Update an existing hex mesh to match a grid cell (terrain/elevation).
 * Rebuilds geometry only if height changed.
 */
export function updateHexMeshFromCell(mesh, col, row, cell, hexRadius = 1) {
  if (!mesh) return false;

  const tile = cellToTile(col, row, cell);

  // Terrain color/material with texture
  const nextColor = terrainColor(tile.terrain);
  const texture = createTerrainTexture(tile.terrain || "grass");
  if (mesh.material) {
    if (mesh.material.map) {
      mesh.material.map.dispose();
    }
    mesh.material.map = texture;
    mesh.material.needsUpdate = true;
    if (mesh.material.color) {
      mesh.material.color.set(nextColor);
    }
  }

  // Height (elevation) is represented by column height (solid cliffs).
  const currentHeight = mesh.userData?.height ?? 0;
  if (currentHeight !== tile.height) {
    const topY = tileSurfaceWorldY(tile.height);
    const geomHeight = Math.max(0.01, topY);

    // Rebuild geometry so the tile fills down to y=0.
    if (mesh.geometry) mesh.geometry.dispose();
    mesh.geometry = new THREE.CylinderGeometry(
      hexRadius,
      hexRadius,
      geomHeight,
      6
    );

    const pos = worldVectorFromAxial(tile.q, tile.r, geomHeight / 2, hexRadius);
    mesh.position.copy(pos);
  }

  // Update userData
  mesh.userData = {
    ...(mesh.userData || {}),
    ...tile,
  };

  return true;
}

/**
 * Apply a minimal diff to an existing 3D group.
 * changedCells items: { col, row, cell }
 * @param {Object} options
 * @param {THREE.Group} options.group - The group to add new meshes to (required if createIfMissing is true)
 * @param {Map} options.tileMeshLookup - Map of existing meshes by tile key
 * @param {Array} options.changedCells - Array of { col, row, cell } changes
 * @param {number} options.hexRadius - Hex radius for mesh creation
 * @param {boolean} options.createIfMissing - If true, create meshes for missing tiles
 */
export function syncGridDiffToGroup({
  group,
  tileMeshLookup,
  changedCells = [],
  hexRadius = 1,
  createIfMissing = false,
}) {
  if (!tileMeshLookup || !changedCells?.length)
    return { updated: 0, added: 0, missing: 0 };

  let updated = 0;
  let added = 0;
  let missing = 0;

  for (const change of changedCells) {
    const col = change?.col;
    const row = change?.row;
    const cell = change?.cell ?? {};

    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;

    const { q, r } = offsetToAxial(col, row);
    const key = makeTileKey(q, r);

    let mesh = tileMeshLookup.get(key);

    if (!mesh) {
      if (createIfMissing && group) {
        // Create new mesh on demand
        const tile = cellToTile(col, row, cell);
        mesh = createHexMesh(tile, hexRadius, 0.6);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          ...tile,
          gridCell: cell,
          gridPosition: { col, row },
        };

        group.add(mesh);
        tileMeshLookup.set(key, mesh);
        added++;
      } else {
        missing++;
        continue;
      }
    } else {
      // Update existing mesh
      if (updateHexMeshFromCell(mesh, col, row, cell, hexRadius, 0.6)) {
        updated++;
      }
    }
  }

  return { updated, added, missing };
}

export { TERRAIN_TYPES };

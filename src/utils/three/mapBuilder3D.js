import { replaceOrthogonalStructureLayerGroup } from "./orthogonalStructure3D.js";
import { replaceHexStructureLayerGroup } from "./hexStructure3D.js";
import { replaceBridgeDeckLayerGroup } from "./bridgeDeck3D.js";
import {
  DEFAULT_TERRAIN_BOUNDARY_SKIRT_DEPTH_WORLD,
  DEFAULT_TERRAIN_GEOMETRY_MODE,
  TERRAIN_GEOMETRY_MODES,
  computeTerrainBoundaryBottomY,
  normalizeTerrainGeometryMode,
  resolveTerracedEdgeWall,
} from "../maps/terrainMeshAuthority.js";
import * as THREE from "three";
import { HexStackManager } from "./hexStackManager.js";
import {
  worldVectorFromAxial,
  axialToOffset,
  offsetToAxial,
} from "../hexGridMath.js";
import {
  HEX_TILE_THICKNESS,
  TILE_HEIGHT_UNIT_TO_WORLD_Y,
} from "../hexGridMath.js";
import { MAP_MIN_HEIGHT } from "../mapHeightConstants.js";
import {
  BATTLEFIELD_HEX_DIRECTIONS,
  BATTLEFIELD_SLOPE_TRANSITIONS,
  resolveTileEdgeTransitions,
} from "../maps/battlefieldSlopeAuthority.js";

const textureLoader = new THREE.TextureLoader();

const TERRAIN_TYPES = [
  "grass",
  "forest",
  "rock",
  "water",
  "sand",
  "hill",
  "road",
  "mud",
  "rubble",
];
const TERRAIN_COLOR = {
  grass: "#3A8D4F",
  forest: "#2E5B3B",
  rock: "#5A5A5A",
  water: "#2A4EA0",
  sand: "#D8B56E",
  hill: "#6E8C3A",
  road: "#B2A07A",
  dirt: "#7a5230",
  stone: "#5A5A5A",
  mud: "#6f4d32",
  rubble: "#686868",
};

const WALL_KIND_COLOR = {
  earthBank: "#7a5532",
  shoreBank: "#8b6d45",
  rockCliff: "#62666d",
  waterfall: "#2f8fc7",
};

const TERRAIN_COLUMN_BOTTOM = MAP_MIN_HEIGHT;
const TALL_COLUMN_SIDE_THRESHOLD_UNITS = 2; // 5ft at 2.5ft per height unit.

const WALL_VERTICAL_EPSILON = 0.001;
const DEBUG_TERRAIN_WALLS = false;

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
      scale: 0.95 + Math.random() * 0.35,
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

export function createTerrainTexture(terrainType) {
  if (textureCache.has(terrainType)) {
    return textureCache.get(terrainType);
  }

  const directTexturePaths = {
    mud: "/assets/textures/terrain/terrain-mud.svg",
    rubble: "/assets/textures/terrain/terrain-rubble.svg",
  };
  if (directTexturePaths[terrainType]) {
    const texture = textureLoader.load(directTexturePaths[terrainType]);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    textureCache.set(terrainType, texture);
    return texture;
  }

  // âœ… Load actual texture file for grass/grassland terrain
  if (terrainType === "grass") {
    const texture = textureLoader.load(
      "/assets/textures/terrain/grass_tile.png"
    );

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // 1x1 means "fit one tile across the hex top".
    // If you want more detail, try 2,2 or 3,3 later.
    texture.repeat.set(0.5, 0.5);

    texture.center.set(0.5, 0.5);
    texture.rotation = 0;

    // quality
    texture.anisotropy = 8;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    textureCache.set(terrainType, texture);
    return texture;
  }

  // Create procedural texture based on terrain type (for other terrain types)
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const baseColor = TERRAIN_COLOR[terrainType] || "#888888";

  // Fill base color
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);

  // Add texture pattern based on terrain
  if (terrainType === "forest") {
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
  texture.repeat.set(1, 1); // Fit texture to hex (don't tile)
  texture.center.set(0.5, 0.5);
  texture.rotation = 0;
  textureCache.set(terrainType, texture);

  return texture;
}

function editorTileSurfaceWorldY(tileHeightUnits = 0) {
  const height = Number(tileHeightUnits);
  if (!Number.isFinite(height) || height === 0) return HEX_TILE_THICKNESS;
  return height * TILE_HEIGHT_UNIT_TO_WORLD_Y;
}

function getHexHeight(cell = {}) {
  const height = Number(cell.height);
  if (Number.isFinite(height)) return height;
  const elevation = Number(cell.elevation);
  if (Number.isFinite(elevation)) return elevation;
  return 0;
}

function getTerrainKey(cellOrTerrainKey) {
  if (typeof cellOrTerrainKey === "string") {
    return normalizeTerrainName(cellOrTerrainKey);
  }
  return normalizeTerrainName(
    cellOrTerrainKey?.terrain ||
    cellOrTerrainKey?.terrainType ||
    "grass"
  );
}

function isWaterTerrain(cellOrTerrainKey) {
  return getTerrainKey(cellOrTerrainKey) === "water";
}

function getHexTopTerrainType(cell = {}) {
  return getTerrainKey(
    cell?.textureId ||
    cell?.terrain ||
    cell?.terrainType ||
    cell?.gridCell?.textureId ||
    cell?.gridCell?.terrain ||
    cell?.gridCell?.terrainType ||
    "grass"
  );
}

function getHexSideTerrainType(cell = {}) {
  const wallTextureId = cell?.wallTextureId || cell?.gridCell?.wallTextureId;
  const wallTerrainType = cell?.wallTerrainType || cell?.gridCell?.wallTerrainType;
  if (wallTextureId) return getTerrainKey(wallTextureId);
  if (wallTerrainType) return getTerrainKey(wallTerrainType);

  const height = getHexHeight(cell);
  if (height > TALL_COLUMN_SIDE_THRESHOLD_UNITS) return "dirt";
  return getHexTopTerrainType(cell);
}

function getHexCornerPoint(radius, index, y) {
  const angle = (Math.PI / 3) * index;
  return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
}

function getHexCornerPoints(radius, y) {
  return Array.from({ length: 6 }, (_, index) => getHexCornerPoint(radius, index, y));
}

function addVertex(vertices, uvs, x, y, z, u = 0, v = 0) {
  vertices.push(x, y, z);
  uvs.push(u, v);
  return vertices.length / 3 - 1;
}

function addWallQuad(vertices, uvs, indices, topA, topB, bottomA, bottomB) {
  const indexStart = indices.length;
  const heightSpan = Math.max(0.001, Math.abs(topA[1] - bottomA[1]));
  const topAIndex = addVertex(vertices, uvs, ...topA, 0, 0);
  const topBIndex = addVertex(vertices, uvs, ...topB, 1, 0);
  const bottomAIndex = addVertex(vertices, uvs, ...bottomA, 0, heightSpan);
  const bottomBIndex = addVertex(vertices, uvs, ...bottomB, 1, heightSpan);

  indices.push(topAIndex, bottomAIndex, bottomBIndex);
  indices.push(topAIndex, bottomBIndex, topBIndex);
  return { start: indexStart, count: indices.length - indexStart };
}

function addBottomFace(vertices, uvs, indices, radius, bottomY) {
  const bottomCenterIndex = vertices.length / 3;
  vertices.push(0, bottomY, 0);
  uvs.push(0.5, 0.5);

  const bottomRingStart = vertices.length / 3;
  const bottomCorners = getHexCornerPoints(radius, bottomY);
  for (let i = 0; i < 6; i++) {
    const [x, , z] = bottomCorners[i];
    vertices.push(x, bottomY, z);
    uvs.push((x / radius + 1) / 2, (z / radius + 1) / 2);
  }

  const indexStart = indices.length;
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(bottomCenterIndex, bottomRingStart + i, bottomRingStart + next);
  }
  return { start: indexStart, count: indices.length - indexStart };
}

function getHexWallKind(cell = {}) {
  if (cell?.wallTerrainType || cell?.wallTextureId) return "earthBank";
  if (Math.abs(getHexHeight(cell)) <= TALL_COLUMN_SIDE_THRESHOLD_UNITS) return "earthBank";
  if (isWaterTerrain(cell)) return "shoreBank";
  const terrain = getHexSideTerrainType(cell);
  return terrain === "rock" || terrain === "stone" || terrain === "rubble" ? "rockCliff" : "earthBank";
}

// Future wall painting can resolve cell.wallTextureId or cell.wallTerrainType here.
function getHexWallMaterial(cell = {}) {
  const wallTerrain = getHexSideTerrainType(cell);
  return getTerrainWallMaterial(getHexWallKind(cell), wallTerrain);
}

function getTerrainGeometryMode(tile = {}) {
  return normalizeTerrainGeometryMode(
    tile?.terrainGeometryMode ||
    tile?.geometryMode ||
    tile?.gridCell?.terrainGeometryMode ||
    tile?.gridCell?.geometryMode ||
    DEFAULT_TERRAIN_GEOMETRY_MODE
  );
}

function getTerrainBoundaryBottomY(neighborData = new Map(), fallbackTopY = 0) {
  const surfaceYs = [];
  if (neighborData?.forEach) {
    neighborData.forEach((neighbor) => {
      surfaceYs.push(editorTileSurfaceWorldY(getHexHeight(neighbor)));
    });
  }
  if (surfaceYs.length === 0) surfaceYs.push(fallbackTopY);

  const skirtDepth = Math.max(
    DEFAULT_TERRAIN_BOUNDARY_SKIRT_DEPTH_WORLD,
    Number(HEX_TILE_THICKNESS) * 2,
    Number(TILE_HEIGHT_UNIT_TO_WORLD_Y) || 0
  );

  return computeTerrainBoundaryBottomY(surfaceYs, skirtDepth, fallbackTopY);
}


// Build a closed editor terrain prism. The top uses terrain paint; every side
// uses the current automatic wall material until per-edge wall painting exists.
function isSlopeTransition(type) {
  return type === BATTLEFIELD_SLOPE_TRANSITIONS.SLOPE ||
    type === BATTLEFIELD_SLOPE_TRANSITIONS.STEEP_SLOPE;
}

// Flat, gentle-slope, and steep-slope edges all belong to one continuous
// terrain surface. A shared corner must therefore use the same three-cell
// sample on every participating hex. Excluding a flat neighbor makes the
// same physical vertex resolve to different Y values on adjacent meshes,
// producing visible open wedges/cracks when raised hexes touch.
function isContinuousTerrainTransition(type) {
  return type === BATTLEFIELD_SLOPE_TRANSITIONS.FLAT ||
    isSlopeTransition(type);
}

function getNeighborTile(tile, neighborData, directionIndex) {
  const direction = BATTLEFIELD_HEX_DIRECTIONS[directionIndex];
  if (!direction || !neighborData?.get) return null;
  return neighborData.get(`${Number(tile?.q || 0) + direction.dq},${Number(tile?.r || 0) + direction.dr}`) || null;
}

function getSlopeCornerTopY(tile, cornerIndex, edgeTransitions, neighborData) {
  const ownY = editorTileSurfaceWorldY(getHexHeight(tile));
  const samples = [ownY];

  // After the mesh's 30-degree rotation, geometric corner i lies between
  // axial directions i and i+1. Average every continuous terrain neighbor
  // (flat, gentle slope, steep slope) so all meshes sharing this physical
  // corner calculate the same Y. Cliff/wall edges retain a hard break.
  const adjacentDirectionIndices = [
    ((cornerIndex - 1) % 6 + 6) % 6,
    ((cornerIndex % 6) + 6) % 6,
  ];

  adjacentDirectionIndices.forEach((directionIndex) => {
    const transition = edgeTransitions?.[directionIndex];
    if (!transition || !isContinuousTerrainTransition(transition.type)) return;
    const neighbor = getNeighborTile(tile, neighborData, directionIndex);
    if (!neighbor) return;
    samples.push(editorTileSurfaceWorldY(getHexHeight(neighbor)));
  });

  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

function getSlopeCornerPoints(radius, tile, edgeTransitions, neighborData) {
  return Array.from({ length: 6 }, (_, cornerIndex) => {
    const y = getSlopeCornerTopY(tile, cornerIndex, edgeTransitions, neighborData);
    return getHexCornerPoint(radius, cornerIndex, y);
  });
}

function getGeometryEdgeDirectionIndex(edgeIndex) {
  // The local hex mesh is rotated +30 degrees around Three.js Y.
  // In the project's X/Z angle convention, geometry edge i then faces
  // battlefield direction i exactly:
  // 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE.
  return ((edgeIndex % 6) + 6) % 6;
}

export function getHexSlopeSurfaceProfile(tile, neighborData = new Map(), radius = 1) {
  const centerY = editorTileSurfaceWorldY(getHexHeight(tile));
  const edgeTransitions = resolveTileEdgeTransitions(tile, neighborData);
  const cornerPoints = getSlopeCornerPoints(radius, tile, edgeTransitions, neighborData);
  return {
    centerY,
    cornerTopY: cornerPoints.map((point) => point[1]),
    cornerPoints,
    edgeTransitions,
  };
}

// Build a closed terrain tile with a slope-aware top surface. One/two height
// unit changes become continuous terrain facets where allowed by the slope
// authority. Cliff/wall edges keep a vertical face, preserving tactical
// readability and a clear non-walkable boundary.

function createTerracedHexColumnGeometry(radius, tile, neighborData = new Map()) {
  const topY = editorTileSurfaceWorldY(getHexHeight(tile));
  const boundaryBottomY = getTerrainBoundaryBottomY(neighborData, topY);
  const edgeTransitions = resolveTileEdgeTransitions(tile, neighborData);
  const topCorners = getHexCornerPoints(radius, topY);
  const vertices = [];
  const uvs = [];
  const indices = [];

  const topCenterIndex = addVertex(vertices, uvs, 0, topY, 0, 0.5, 0.5);
  const topRingStart = vertices.length / 3;
  topCorners.forEach(([x, y, z]) => {
    addVertex(vertices, uvs, x, y, z, (x / radius + 1) / 2, (z / radius + 1) / 2);
  });

  const topIndexStart = indices.length;
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenterIndex, topRingStart + next, topRingStart + i);
  }
  const topIndexCount = indices.length - topIndexStart;

  const wallIndexStart = indices.length;
  let boundaryWallCount = 0;
  let interiorWallCount = 0;

  for (let edgeIndex = 0; edgeIndex < 6; edgeIndex++) {
    const nextCorner = (edgeIndex + 1) % 6;
    const directionIndex = getGeometryEdgeDirectionIndex(edgeIndex);
    const neighbor = getNeighborTile(tile, neighborData, directionIndex);
    const neighborTopY = neighbor
      ? editorTileSurfaceWorldY(getHexHeight(neighbor))
      : null;

    const plan = resolveTerracedEdgeWall({
      ownTopY: topY,
      neighborTopY,
      hasNeighbor: Boolean(neighbor),
      boundaryBottomY,
      epsilon: WALL_VERTICAL_EPSILON,
    });
    if (!plan.draw) continue;

    const upperA = [
      topCorners[edgeIndex][0],
      plan.upperY + WALL_VERTICAL_EPSILON,
      topCorners[edgeIndex][2],
    ];
    const upperB = [
      topCorners[nextCorner][0],
      plan.upperY + WALL_VERTICAL_EPSILON,
      topCorners[nextCorner][2],
    ];
    const lowerA = [upperA[0], plan.lowerY - WALL_VERTICAL_EPSILON, upperA[2]];
    const lowerB = [upperB[0], plan.lowerY - WALL_VERTICAL_EPSILON, upperB[2]];
    addWallQuad(vertices, uvs, indices, upperA, upperB, lowerA, lowerB);

    if (plan.kind === "boundary") boundaryWallCount += 1;
    else interiorWallCount += 1;
  }

  const wallIndexCount = indices.length - wallIndexStart;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.clearGroups();
  geometry.addGroup(topIndexStart, topIndexCount, 0);
  if (wallIndexCount > 0) geometry.addGroup(wallIndexStart, wallIndexCount, 1);
  geometry.computeVertexNormals();
  geometry.userData = {
    ...(geometry.userData || {}),
    terrainGeometryMode: TERRAIN_GEOMETRY_MODES.TERRACED,
    boundaryBottomY,
    boundaryWallCount,
    interiorWallCount,
    hasBottomCap: false,
    slopeTransitions: edgeTransitions.map(
      (edge) => edge?.type || BATTLEFIELD_SLOPE_TRANSITIONS.FLAT
    ),
  };
  return geometry;
}

function createSlopeAwareHexColumnGeometry(radius, tile, neighborData = new Map()) {
  const topY = editorTileSurfaceWorldY(getHexHeight(tile));
  const boundaryBottomY = getTerrainBoundaryBottomY(neighborData, topY);
  const slopeProfile = getHexSlopeSurfaceProfile(tile, neighborData, radius);
  const edgeTransitions = slopeProfile.edgeTransitions;
  const topCorners = slopeProfile.cornerPoints;
  const vertices = [];
  const uvs = [];
  const indices = [];

  const topCenterIndex = addVertex(vertices, uvs, 0, topY, 0, 0.5, 0.5);
  const topRingStart = vertices.length / 3;
  topCorners.forEach(([x, y, z]) => {
    addVertex(vertices, uvs, x, y, z, (x / radius + 1) / 2, (z / radius + 1) / 2);
  });

  const topIndexStart = indices.length;
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    indices.push(topCenterIndex, topRingStart + next, topRingStart + i);
  }
  const topIndexCount = indices.length - topIndexStart;
  const wallIndexStart = indices.length;
  let boundaryWallCount = 0;
  let interiorWallCount = 0;

  for (let edgeIndex = 0; edgeIndex < 6; edgeIndex++) {
    const nextCorner = (edgeIndex + 1) % 6;
    const directionIndex = getGeometryEdgeDirectionIndex(edgeIndex);
    const transition = edgeTransitions?.[directionIndex];
    const neighbor = getNeighborTile(tile, neighborData, directionIndex);
    const upperA = [
      topCorners[edgeIndex][0],
      topCorners[edgeIndex][1] + WALL_VERTICAL_EPSILON,
      topCorners[edgeIndex][2],
    ];
    const upperB = [
      topCorners[nextCorner][0],
      topCorners[nextCorner][1] + WALL_VERTICAL_EPSILON,
      topCorners[nextCorner][2],
    ];

    if (!neighbor || transition?.type === BATTLEFIELD_SLOPE_TRANSITIONS.BOUNDARY) {
      const lowerA = [upperA[0], boundaryBottomY, upperA[2]];
      const lowerB = [upperB[0], boundaryBottomY, upperB[2]];
      addWallQuad(vertices, uvs, indices, upperA, upperB, lowerA, lowerB);
      boundaryWallCount += 1;
      continue;
    }

    if (
      isSlopeTransition(transition?.type) ||
      transition?.type === BATTLEFIELD_SLOPE_TRANSITIONS.FLAT
    ) {
      continue;
    }

    const neighborTopY = editorTileSurfaceWorldY(getHexHeight(neighbor));
    if (topY <= neighborTopY + WALL_VERTICAL_EPSILON) continue;

    const lowerA = [upperA[0], neighborTopY - WALL_VERTICAL_EPSILON, upperA[2]];
    const lowerB = [upperB[0], neighborTopY - WALL_VERTICAL_EPSILON, upperB[2]];
    addWallQuad(vertices, uvs, indices, upperA, upperB, lowerA, lowerB);
    interiorWallCount += 1;
  }

  const wallIndexCount = indices.length - wallIndexStart;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.clearGroups();
  geometry.addGroup(topIndexStart, topIndexCount, 0);
  if (wallIndexCount > 0) geometry.addGroup(wallIndexStart, wallIndexCount, 1);
  geometry.computeVertexNormals();
  geometry.userData = {
    ...(geometry.userData || {}),
    terrainGeometryMode: TERRAIN_GEOMETRY_MODES.SLOPE_AWARE,
    boundaryBottomY,
    boundaryWallCount,
    interiorWallCount,
    hasBottomCap: false,
    slopeTransitions: edgeTransitions.map(
      (edge) => edge?.type || BATTLEFIELD_SLOPE_TRANSITIONS.FLAT
    ),
  };
  return geometry;
}

function createHexColumnGeometry(radius, tile, neighborData = new Map()) {
  const mode = getTerrainGeometryMode(tile);
  if (mode === TERRAIN_GEOMETRY_MODES.SLOPE_AWARE) {
    return createSlopeAwareHexColumnGeometry(radius, tile, neighborData);
  }
  return createTerracedHexColumnGeometry(radius, tile, neighborData);
}

export function createHexMesh(tile, size = 1, neighborData = new Map()) {
  const tileHeightUnits = Number.isFinite(tile?.height)
    ? tile.height
    : Number.isFinite(tile?.elevation)
    ? tile.elevation
    : 0;

  const surfaceY = editorTileSurfaceWorldY(tileHeightUnits);

  const geometry = createHexColumnGeometry(size, tile, neighborData);

  // Top material = terrain surface; side material = automatic cliff/soil wall.
  const texture = createTerrainTexture(getHexTopTerrainType(tile));
  const topMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff, // No fake tint - let lighting do the work
    roughness: 0.85, // Grass feels sunlit
    metalness: 0.0,
    flatShading: true,
  });
  const materials = [
    topMaterial,
    getHexWallMaterial(tile),
  ];

  // Physically correct texture color space
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // âœ… Match mapScene3D flat-top orientation
  mesh.rotation.y = Math.PI / 6; // 30 degrees

  const pos = worldVectorFromAxial(
    tile.q ?? 0,
    tile.r ?? 0,
    0,
    size
  );
  mesh.position.copy(pos);
  mesh.userData = { ...tile, surfaceY };
  replaceBridgeDeckLayerGroup({
    tileMesh: mesh,
    cell: tile?.gridCell || tile,
    tileSpan: size * Math.sqrt(3),
    mapType: "hex",
    parentRotationY: Math.PI / 6,
  });
  replaceHexStructureLayerGroup({
    tileMesh: mesh,
    cell: tile?.gridCell || tile,
    hexRadius: size,
    x: tile.q ?? 0,
    y: tile.r ?? 0,
    neighborData,
  });
  // Milestone 8C-8C.2 R5.2:
  // Orthogonal structures MUST be registered after this terrain tile has a
  // map parent. Rendering them here synchronously made structureParent equal
  // to tileMesh itself, so every cell had an isolated calibration state and
  // initial builds used axial q/r as if they were editor offset coordinates.
  // That is why wall boxes could jump after a 3D rebuild/view toggle.
  const renderOrthogonalStructuresAfterParenting = () => {
    if (!mesh.parent) return;
    const gridPosition = tile?.gridPosition || mesh.userData?.gridPosition || axialToOffset(tile.q ?? 0, tile.r ?? 0);
    const col = Number(gridPosition?.col);
    const row = Number(gridPosition?.row);
    replaceOrthogonalStructureLayerGroup({
      tileMesh: mesh,
      cell: tile?.gridCell || tile,
      mapType: "hex",
      hexRadius: size,
      x: Number.isFinite(col) ? col : 0,
      y: Number.isFinite(row) ? row : 0,
    });
    mesh.removeEventListener?.("added", renderOrthogonalStructuresAfterParenting);
  };
  mesh.addEventListener?.("added", renderOrthogonalStructuresAfterParenting);
  return mesh;
}

export function createForestTree() {
  const tree = new THREE.Group();

  const trunkGeometry = new THREE.CylinderGeometry(0.07, 0.10, 3.4, 8);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#8B5A2B" });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.name = "trunk";
  trunk.castShadow = true;
  trunk.receiveShadow = true;

  const leavesGeometry = new THREE.ConeGeometry(0.62, 4.0, 12);
  const leavesMaterial = new THREE.MeshStandardMaterial({
    color: "#0F3D0F",
    flatShading: true,
  });
  const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
  leaves.name = "leaves";
  leaves.position.y = 3.35;
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

function getTerrainWallMaterial(wallKind, terrainType = null) {
  const color = WALL_KIND_COLOR[wallKind] || WALL_KIND_COLOR.earthBank;
  const texture = terrainType ? createTerrainTexture(terrainType) : null;
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  const isWaterfall = wallKind === "waterfall";
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: texture ? 0xffffff : color,
    roughness: isWaterfall ? 0.45 : 0.92,
    metalness: 0.0,
    emissive: color,
    emissiveIntensity: texture ? 0.02 : isWaterfall ? 0.12 : 0.08,
    flatShading: true,
    side: THREE.DoubleSide,
  });
}

/**
 * Normalize terrain names from various sources (hexGridGenerator, TacticalMap, etc.)
 * to the simple terrain keys expected by the 3D builder (grass, forest, rock, etc.)
 */
export function normalizeTerrainName(raw) {
  const t = String(raw || "grass").toLowerCase();

  // Already compatible
  if (["grass", "forest", "rock", "stone", "water", "sand", "dirt", "hill", "road", "mud", "rubble"].includes(t))
    return t;

  // terrainKey-style inputs from hexGridGenerator (and similar)
  if (t.includes("forest")) return "forest";
  if (t.includes("rubble") || t.includes("ruins") || t.includes("debris")) return "rubble";
  if (t.includes("rock") || t.includes("mountain"))
    return "rock";
  if (t.includes("swamp") || t.includes("marsh") || t.includes("water"))
    return "water";
  if (t.includes("desert") || t.includes("sand")) return "sand";
  if (t.includes("mud") || t.includes("bog")) return "mud";
  if (t.includes("dirt")) return "dirt";
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
  // even if the first row hastaminans to be empty.
  const is2D = Array.isArray(grid[0]);
  const tileSpecs = [];

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

        tileSpecs.push({
          q,
          r,
          height,
          terrain,
          textureId: cell.textureId,
          wallTerrainType: cell.wallTerrainType,
          wallTextureId: cell.wallTextureId,
          edgeTransitions: cell.edgeTransitions,
        terrainGeometryMode: cell.terrainGeometryMode || cell.geometryMode,
          terrainGeometryMode: cell.terrainGeometryMode || cell.geometryMode,
          features: cell.features || (cell.feature ? [cell.feature] : []),
          gridCell: cell,
          gridPosition: { col: colIndex, row: rowIndex },
        });
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

      tileSpecs.push({
        q,
        r,
        height,
        terrain,
        textureId: cell.textureId,
        wallTerrainType: cell.wallTerrainType,
        wallTextureId: cell.wallTextureId,
        edgeTransitions: cell.edgeTransitions,
        terrainGeometryMode: cell.terrainGeometryMode || cell.geometryMode,
        features: cell.features || (cell.feature ? [cell.feature] : []),
        gridCell: cell,
      });
    });
  }

  const tileByKey = new Map(
    tileSpecs.map((tile) => [makeTileKey(tile.q, tile.r), tile])
  );

  tileSpecs.forEach((tile) => {
    const mesh = createHexMesh(tile, hexRadius, tileByKey);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { ...tile, surfaceY: editorTileSurfaceWorldY(tile.height) };

    group.add(mesh);
    tileMeshLookup.set(makeTileKey(tile.q, tile.r), mesh);
  });

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
    textureId: cell.textureId,
    wallTerrainType: cell.wallTerrainType,
    wallTextureId: cell.wallTextureId,
    edgeTransitions: cell.edgeTransitions,
    features: cell.features || (cell.feature ? [cell.feature] : []),
    gridCell: cell,
    gridPosition: { col, row },
  };
}

/**
 * Update an existing hex mesh to match a grid cell (terrain/elevation).
 * Rebuilds the solid column geometry after editor terrain or height changes.
 */
export function updateHexMeshFromCell(
  mesh,
  col,
  row,
  cell,
  hexRadius = 1,
  neighborData = new Map()
) {
  if (!mesh) return false;

  const tile = cellToTile(col, row, cell);

  // Terrain color/material with texture
  const nextColor = terrainColor(tile.terrain);
  const texture = createTerrainTexture(getHexTopTerrainType(tile));
  if (mesh.material) {
    // Don't dispose cached textures (they're shared across tiles)
    if (Array.isArray(mesh.material)) {
      const [topMaterial, previousWallMaterial] = mesh.material;
      if (topMaterial) {
        topMaterial.map = texture;
        topMaterial.color?.set(0xffffff);
        topMaterial.needsUpdate = true;
      }
      previousWallMaterial?.dispose?.();
      mesh.material = [
        topMaterial,
        getHexWallMaterial(tile),
      ];
    } else {
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
      if (mesh.material.color) {
        mesh.material.color.set(nextColor);
      }
    }
  }

  // Height (elevation) is represented by a signed solid terrain column.
  const currentHeight = mesh.userData?.height ?? 0;
  const surfaceY = editorTileSurfaceWorldY(tile.height);

  // Rebuild this tile's closed prism after height or terrain edits.
  if (mesh.geometry) mesh.geometry.dispose?.();
  mesh.geometry = createHexColumnGeometry(hexRadius, tile, neighborData);

  // âœ… Keep the same orientation after rebuild
  mesh.rotation.y = Math.PI / 6; // 30 degrees

  const pos = worldVectorFromAxial(tile.q, tile.r, 0, hexRadius);
  mesh.position.copy(pos);

  // Update userData
  mesh.userData = {
    ...(mesh.userData || {}),
    ...tile,
    previousHeight: currentHeight,
    surfaceY,
  };

  replaceBridgeDeckLayerGroup({
    tileMesh: mesh,
    cell,
    tileSpan: hexRadius * Math.sqrt(3),
    mapType: "hex",
    parentRotationY: Math.PI / 6,
  });

  replaceHexStructureLayerGroup({
    tileMesh: mesh,
    cell,
    hexRadius,
    x: col,
    y: row,
    neighborData,
  });

  replaceOrthogonalStructureLayerGroup({
    tileMesh: mesh,
    cell,
    mapType: "hex",
    hexRadius,
    x: col,
    y: row,
  });

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
  const changedByKey = new Map();
  const tileByKey = new Map();
  const affectedKeys = new Set();

  tileMeshLookup.forEach((mesh, key) => {
    tileByKey.set(key, mesh?.userData || {});
  });

  for (const change of changedCells) {
    const col = change?.col;
    const row = change?.row;
    const cell = change?.cell ?? {};

    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;

    const { q, r } = offsetToAxial(col, row);
    const key = makeTileKey(q, r);
    const tile = cellToTile(col, row, cell);
    changedByKey.set(key, { col, row, cell, tile });
    tileByKey.set(key, tile);
    affectedKeys.add(key);
    BATTLEFIELD_HEX_DIRECTIONS.forEach((direction) => {
      const neighborKey = makeTileKey(q + direction.dq, r + direction.dr);
      if (tileByKey.has(neighborKey) || tileMeshLookup.has(neighborKey)) {
        affectedKeys.add(neighborKey);
      }
    });
  }

  for (const key of affectedKeys) {
    let mesh = tileMeshLookup.get(key);
    const changed = changedByKey.get(key);
    const tile = changed?.tile || mesh?.userData;
    const gridPosition = changed
      ? { col: changed.col, row: changed.row }
      : mesh?.userData?.gridPosition;
    const cell = changed?.cell || mesh?.userData?.gridCell || {};

    if (!mesh) {
      if (createIfMissing && group && changed) {
        // Create new mesh on demand
        mesh = createHexMesh(tile, hexRadius, tileByKey);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          ...tile,
          gridCell: cell,
          gridPosition,
          surfaceY: editorTileSurfaceWorldY(tile.height),
        };

        group.add(mesh);
        tileMeshLookup.set(key, mesh);
        added++;
      } else {
        missing++;
        continue;
      }
    } else {
      if (!gridPosition || !Number.isFinite(gridPosition.col) || !Number.isFinite(gridPosition.row)) {
        missing++;
        continue;
      }
      // Update existing mesh
      if (updateHexMeshFromCell(mesh, gridPosition.col, gridPosition.row, cell, hexRadius, tileByKey)) {
        updated++;
      }
    }
  }

  return { updated, added, missing };
}

export { TERRAIN_TYPES };

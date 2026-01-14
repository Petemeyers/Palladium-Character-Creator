import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildRandom3DMap,
  buildRectangular3DMap,
  createHexMesh,
  createForestTree,
  offsetToAxial,
} from "../utils/three/mapBuilder3D.js";
import { HexStackManager } from "../utils/three/hexStackManager.js";
import { GRID_CONFIG } from "../data/movementRules.js";
import { MovementRangeSystem } from "../utils/movementRangeSystem.js";
import { findPath } from "../utils/hexPathfinding.js";
import {
  createCharacterIcon,
  updateCharacterBillboards,
} from "../utils/characterPlaceholders.js";
import { VisionSystem } from "../utils/VisionSystem.js";
import { VisionVisualizer } from "../utils/VisionVisualizer.js";
import { AIVisibilitySystem } from "../utils/AIVisibilitySystem.js";
import { PartyVisibilitySystem } from "../utils/PartyVisibilitySystem.js";
import { SpottedAlertSystem } from "../utils/SpottedAlertSystem.js";
import { TeamAwarenessSystem } from "../utils/TeamAwarenessSystem.js";
import { MemorySilhouetteSystem } from "../utils/MemorySilhouetteSystem.js";
import {
  initCombat,
  resolveAttack as resolveCombatAttack,
  resolveSpellAttack,
  getTerrainHazards,
  getAIEnvironmentSystem,
  getLeadershipAuras,
} from "../utils/combatEngine.js";
import {
  HEX_RADIUS,
  HEX_TILE_THICKNESS,
  createFlatHexGeometry,
  worldVectorFromTile,
  worldVectorFromAxial,
  worldVectorFromEntity,
} from "../utils/hexGridMath.js";
import { getHexInfo, formatHexInfo } from "../utils/hexSelectionUtils.js";
import { COMBAT_ACTION } from "../game/combatState.js";
import {
  canReachTile,
  canPerformRangedAttack,
  setLineOfSightResolver,
} from "../game/rules/combatRules.js";

const HEX_DIRECTIONS = [
  { q: +1, r: 0 },
  { q: +1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: +1 },
  { q: 0, r: +1 },
];

const TERRAIN_COVER = {
  grass: 0,
  sand: 0,
  hill: 0.3,
  forest: 0.5,
  rock: 0.8,
  water: 0,
};
const TREE_COVER = 0.5;

const TERRAIN_TEXTURES = {
  DEFAULT: "/assets/textures/terrain/grassland.png",
  OPEN_GROUND: "/assets/textures/terrain/grassland.png",
  LIGHT_FOREST: "/assets/textures/terrain/light_forest.png",
  DENSE_FOREST: "/assets/textures/terrain/dense_forest.png",
  FOREST: "/assets/textures/terrain/light_forest.png",
  ROCKY_TERRAIN: "/assets/textures/terrain/rocky.png",
  ROCK: "/assets/textures/terrain/rocky.png",
  HILL: "/assets/textures/terrain/rocky.png",
  URBAN: "/assets/textures/terrain/urban.png",
  SWAMP_MARSH: "/assets/textures/terrain/swamp.png",
  WATER: "/assets/textures/terrain/water.png",
  CAVE_INTERIOR: "/assets/textures/terrain/cave.png",
  INTERIOR: "/assets/textures/terrain/interior.png",
  SAND: "/assets/textures/terrain/grassland.png",
};

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

function normalizeTerrainKey(key = "") {
  return key
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function loadTerrainTexture(key) {
  const normalized = normalizeTerrainKey(key);
  const path = TERRAIN_TEXTURES[normalized] || TERRAIN_TEXTURES.DEFAULT;
  if (!path) return null;
  if (textureCache.has(path)) return textureCache.get(path);
  const texture = textureLoader.load(path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.center.set(0.5, 0.5);
  texture.rotation = 0;
  if (texture.encoding !== THREE.sRGBEncoding) {
    texture.encoding = THREE.sRGBEncoding;
  }
  textureCache.set(path, texture);
  return texture;
}

const ENVIRONMENT_PRESETS = {
  open_field: {
    weights: { grass: 1 },
    maxHeight: 0,
    heightByTerrain: { grass: 0 },
    heightResolver: () => 0,
    tree: { min: 0, max: 0, scale: [1, 1], leafColor: "#0F3D0F" },
    groundColor: "#6ba562",
  },
  forest_light: {
    weights: { grass: 0.4, forest: 0.45, hill: 0.1, rock: 0.05 },
    maxHeight: 1,
    heightByTerrain: { hill: 1, forest: 0, grass: 0 },
    heightResolver: (terrain) => (terrain === "hill" ? 1 : 0),
    tree: { min: 1, max: 3, scale: [0.8, 1.0], leafColor: "#1A4F1A" },
    groundColor: "#466d42",
  },
  forest_dense: {
    weights: { forest: 0.75, grass: 0.15, hill: 0.05, rock: 0.05 },
    maxHeight: 2,
    heightByTerrain: { hill: 2, forest: 0, grass: 0 },
    heightResolver: (terrain) => (terrain === "hill" ? 2 : 0),
    tree: { min: 4, max: 7, scale: [0.9, 1.2], leafColor: "#0C330C" },
    groundColor: "#335033",
  },
};

const LIGHTING_PRESETS = {
  BRIGHT_DAYLIGHT: {
    background: "#87CEEB",
    ambient: 0.5,
    sunIntensity: 1.1,
    sunColor: "#ffffff",
  },
  MOONLIGHT: {
    background: "#0c1d3f",
    ambient: 0.25,
    sunIntensity: 0.55,
    sunColor: "#88aaff",
  },
  TORCHLIGHT: {
    background: "#2f1205",
    ambient: 0.18,
    sunIntensity: 0.35,
    sunColor: "#ffb347",
  },
  DUSK: {
    background: "#443143",
    ambient: 0.3,
    sunIntensity: 0.6,
    sunColor: "#ff9966",
  },
  DAWN: {
    background: "#4c4a6a",
    ambient: 0.35,
    sunIntensity: 0.7,
    sunColor: "#ffd1a9",
  },
  DARKNESS: {
    background: "#010203",
    ambient: 0.08,
    sunIntensity: 0.25,
    sunColor: "#223355",
  },
};

const TERRAIN_FLAT_COLORS = {
  OPEN_GROUND: "#9dd66b",
  LIGHT_FOREST: "#58a65c",
  DENSE_FOREST: "#4e6b4d",
  ROCKY_TERRAIN: "#7d7d7d",
  URBAN: "#b9a57f",
  SWAMP_MARSH: "#476a4d",
  CAVE_INTERIOR: "#3b3b3b",
  WATER: "#3ba4ff",
  INTERIOR: "#666666",
};

function toTitleCase(str = "") {
  return str
    .toString()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveEnvironmentConfig(dataset = {}, overrideKey) {
  const themeValue =
    overrideKey ||
    dataset.mapTheme ||
    dataset.environment ||
    dataset.biome ||
    dataset.mapBiome;
  const theme = (themeValue || "open_field").toString().toLowerCase();
  const normalized = theme.replace(/[-\s]+/g, "_");
  if (["forest", "forest_standard", "light_forest"].includes(normalized)) {
    return ENVIRONMENT_PRESETS.forest_light;
  }
  if (["dense_forest", "forest_dense"].includes(normalized)) {
    return ENVIRONMENT_PRESETS.forest_dense;
  }
  return ENVIRONMENT_PRESETS[normalized] || ENVIRONMENT_PRESETS.open_field;
}

function resolveMapDimensions(container, override = {}) {
  const dataset = container?.dataset || {};
  const shape = (
    override.shape ||
    dataset.mapShape ||
    dataset.gridShape ||
    "rect"
  )
    .toString()
    .toLowerCase();
  const rowsAttr =
    override.rows ?? dataset.mapRows ?? dataset.gridRows ?? dataset.rows;
  const colsAttr =
    override.cols ?? dataset.mapCols ?? dataset.gridCols ?? dataset.cols;
  const radiusAttr =
    override.radius ??
    dataset.mapRadius ??
    dataset.gridRadius ??
    dataset.radius;
  const rows = parseNumber(rowsAttr, GRID_CONFIG?.GRID_HEIGHT || 50);
  const cols = parseNumber(colsAttr, GRID_CONFIG?.GRID_WIDTH || 50);
  const radius = parseNumber(radiusAttr, Math.max(rows, cols) / 2);
  return { shape, rows, cols, radius };
}

function lightingPresetFor(key) {
  if (!key) return LIGHTING_PRESETS.BRIGHT_DAYLIGHT;
  const normalized = key.toString().toUpperCase();
  return (
    LIGHTING_PRESETS[normalized] ||
    LIGHTING_PRESETS[normalized.replace(/\s+/g, "_")] ||
    LIGHTING_PRESETS.BRIGHT_DAYLIGHT
  );
}

function mapTerrainKey(cell, fallbackTerrain) {
  const terrainKey = cell?.terrainType || cell?.terrain || fallbackTerrain;
  if (!terrainKey) return "grass";
  const normalized = terrainKey.toString().toUpperCase();
  switch (normalized) {
    case "LIGHT_FOREST":
    case "FOREST":
    case "WOODLAND":
      return "forest";
    case "DENSE_FOREST":
      return "forest";
    case "ROCKY_TERRAIN":
    case "CLIFF":
    case "CAVE_INTERIOR":
      return "rock";
    case "SWAMP_MARSH":
      return "sand";
    case "WATER":
    case "DEEP_WATER":
      return "water";
    case "URBAN":
      return "sand";
    case "HILL":
      return "hill";
    case "SAND":
      return "sand";
    case "OPEN_GROUND":
    case "PLAINS":
    case "FIELD":
    default:
      return "grass";
  }
}

function buildManagerFromGrid(
  grid = [],
  fallbackTerrain = "OPEN_GROUND",
  forceTerrainKey = null,
  includeFeatures = true
) {
  const manager = new HexStackManager();
  grid.forEach((row = [], rowIndex) => {
    row.forEach((cell = {}, colIndex) => {
      const { q, r } = offsetToAxial(colIndex, rowIndex);
      const terrain3D = forceTerrainKey || mapTerrainKey(cell, fallbackTerrain);
      const height = Number.isFinite(cell.elevation) ? cell.elevation : 0;
      const features = includeFeatures
        ? [
            ...(cell.feature ? [cell.feature] : []),
            ...(Array.isArray(cell.features) ? cell.features : []),
          ]
        : [];
      const tile = manager.addTile(q, r, height, terrain3D, features);
      tile.gridCell = cell;
      tile.gridPosition = { row: rowIndex, col: colIndex };
    });
  });
  manager.metadata = {
    rows: grid.length,
    cols: grid[0]?.length || 0,
    source: "environment-grid",
  };
  return manager;
}

// buildUniformMap removed - now using buildRandom3DMap for hexagonal maps

function colorForTerrain(baseTerrainKey = "OPEN_GROUND") {
  return (
    TERRAIN_FLAT_COLORS[baseTerrainKey] ||
    TERRAIN_FLAT_COLORS[baseTerrainKey.replace(/[-\s]+/g, "_").toUpperCase()] ||
    "#3A8D4F"
  );
}

function applyLighting(scene, ambientLight, sun, lightingKey) {
  const preset = lightingPresetFor(lightingKey);
  if (scene && preset.background) {
    scene.background = new THREE.Color(preset.background);
  }
  if (ambientLight && typeof preset.ambient === "number") {
    ambientLight.intensity = preset.ambient;
  }
  if (sun) {
    if (typeof preset.sunIntensity === "number") {
      sun.intensity = preset.sunIntensity;
    }
    if (preset.sunColor) {
      sun.color.set(preset.sunColor);
    }
  }
}

/**
 * Apply a lighting preset to a scene (new modular system)
 * @param {THREE.Scene} scene - Three.js scene
 * @param {THREE.WebGLRenderer} renderer - Three.js renderer
 * @param {string} presetKey - Preset key from LIGHTING_PRESETS
 */
export function applyLightingPreset(scene, renderer, presetKey) {
  // Dynamic import to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LIGHTING_PRESETS } = require("../data/lightingPresets");
  const preset = LIGHTING_PRESETS[presetKey];
  if (!preset) {
    console.warn(`[mapScene3D] Unknown lighting preset: ${presetKey}`);
    return;
  }

  // Remove old lights
  scene.children
    .filter((obj) => obj.isLight)
    .forEach((light) => scene.remove(light));

  // ☀️ Sun (DirectionalLight)
  const sun = new THREE.DirectionalLight(
    preset.sun.color,
    preset.sun.intensity
  );
  sun.position.set(...preset.sun.position);
  sun.castShadow = preset.sun.castShadow;

  if (preset.sun.castShadow) {
    sun.shadow.mapSize.width = preset.sun.shadow.mapSize;
    sun.shadow.mapSize.height = preset.sun.shadow.mapSize;
    sun.shadow.bias = preset.sun.shadow.bias;
    sun.shadow.radius = 4; // Soft shadows

    // Configure shadow camera
    const shadowCam = preset.sun.shadow.camera;
    sun.shadow.camera.near = shadowCam.near;
    sun.shadow.camera.far = shadowCam.far;
    sun.shadow.camera.left = shadowCam.left;
    sun.shadow.camera.right = shadowCam.right;
    sun.shadow.camera.top = shadowCam.top;
    sun.shadow.camera.bottom = shadowCam.bottom;
  }

  scene.add(sun);

  // 🌤 Ambient Light
  scene.add(
    new THREE.AmbientLight(preset.ambient.color, preset.ambient.intensity)
  );

  // 🌍 Hemisphere Light (sky bounce)
  scene.add(
    new THREE.HemisphereLight(
      preset.hemisphere.skyColor,
      preset.hemisphere.groundColor,
      preset.hemisphere.intensity
    )
  );

  // 🎥 Renderer tone mapping
  if (preset.environment.toneMapping === "ACES") {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  renderer.toneMappingExposure = preset.environment.exposure;
  
  // Enable physically correct lights
  renderer.physicallyCorrectLights = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function create3DMapScene(container, maybeOptions = {}, maybeOnAction) {
  if (!container) {
    throw new Error("create3DMapScene requires a container element.");
  }

  let options = {};
  let onSelect = () => {};
  let onAction = () => {};

  if (typeof maybeOptions === "function") {
    onSelect = maybeOptions;
    onAction = typeof maybeOnAction === "function" ? maybeOnAction : () => {};
  } else {
    options = maybeOptions || {};
    onSelect =
      typeof options.onSelect === "function" ? options.onSelect : () => {};
    if (typeof options.onAction === "function") {
      onAction = options.onAction;
    } else if (typeof maybeOnAction === "function") {
      onAction = maybeOnAction;
    }
  }

  const {
    environment: envOverride = null,
    grid: externalGrid = null,
    fighters: initialFighters = [],
    mapTheme: explicitTheme,
    mapShape: explicitShape,
    rows: explicitRows,
    cols: explicitCols,
    radius: explicitRadius,
  } = options;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#87CEEB");

  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight || 1,
    0.1,
    1000
  );
  camera.position.set(10, 15, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(20, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);

  const tileSize = HEX_RADIUS;
  const heightScale = HEX_TILE_THICKNESS;

  const effectiveEnvironment = envOverride || {};
  const environmentGrid =
    Array.isArray(externalGrid) && externalGrid.length > 0
      ? externalGrid
      : Array.isArray(effectiveEnvironment.grid) &&
        effectiveEnvironment.grid.length > 0
      ? effectiveEnvironment.grid
      : null;

  const baseTerrainKey = (
    effectiveEnvironment.terrain ||
    environmentGrid?.[0]?.[0]?.terrainType ||
    "OPEN_GROUND"
  )
    .toString()
    .toUpperCase();
  const flatColor = colorForTerrain(baseTerrainKey);
  const enforceFlat = true;
  const tileTexture = loadTerrainTexture(baseTerrainKey);
  if (tileTexture && renderer?.capabilities?.getMaxAnisotropy) {
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    if (maxAniso && tileTexture.anisotropy !== maxAniso) {
      tileTexture.anisotropy = maxAniso;
    }
  }

  const disposableTextures = [];

  const mapDimensions = resolveMapDimensions(container, {
    shape: explicitShape,
    rows:
      explicitRows ?? environmentGrid?.length ?? effectiveEnvironment.height,
    cols:
      explicitCols ??
      environmentGrid?.[0]?.length ??
      effectiveEnvironment.width,
    radius: explicitRadius,
  });

  const themeKey =
    explicitTheme || effectiveEnvironment.mapTheme || baseTerrainKey;
  const envConfig = resolveEnvironmentConfig(container.dataset, themeKey);

  const base3DTerrain = mapTerrainKey(
    { terrainType: baseTerrainKey },
    baseTerrainKey
  );

  // Calculate hexagonal radius from grid dimensions
  const hexRadius =
    mapDimensions.radius ||
    Math.max(GRID_CONFIG?.GRID_WIDTH || 50, GRID_CONFIG?.GRID_HEIGHT || 50) / 2;

  const mapManager = environmentGrid
    ? buildManagerFromGrid(
        environmentGrid,
        baseTerrainKey,
        enforceFlat ? base3DTerrain : null,
        !enforceFlat
      )
    : enforceFlat
    ? buildRandom3DMap(
        hexRadius,
        0, // maxHeight = 0 for flat
        {
          uniformTerrain: true,
          baseTerrain: base3DTerrain,
        }
      )
    : mapDimensions.shape === "rect"
    ? buildRectangular3DMap(
        mapDimensions.rows || GRID_CONFIG?.GRID_HEIGHT || 50,
        mapDimensions.cols || GRID_CONFIG?.GRID_WIDTH || 50,
        {
          weights: envConfig.weights,
          maxHeight: envConfig.maxHeight,
          heightResolver: envConfig.heightResolver,
        }
      )
    : buildRandom3DMap(hexRadius, envConfig.maxHeight, {
        weights: envConfig.weights,
        heightByTerrain: envConfig.heightByTerrain,
      });

  const tiles = mapManager.getAllTiles();
  const clickable = [];
  const tileMeshMap = new Map();
  const obstacles = [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const treeConfig = envConfig.tree || { min: 0, max: 0, scale: [1, 1] };
  const useGridFeatures = Boolean(environmentGrid) && !enforceFlat;

  tiles.forEach((tile) => {
    if (enforceFlat) {
      tile.height = 0;
    }
    const perTileTerrainKey = (
      tile.gridCell?.terrainType ||
      tile.terrain ||
      baseTerrainKey
    ).toUpperCase();
    const perTileTexture = loadTerrainTexture(perTileTerrainKey);
    const perTileColor = colorForTerrain(perTileTerrainKey);

    let mesh;
    if (enforceFlat || perTileTexture || tile.height) {
      const geometry = createFlatHexGeometry(HEX_RADIUS, HEX_TILE_THICKNESS);
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff, // No fake tint - let lighting do the work
        roughness: 0.85, // Grass feels sunlit
        metalness: 0.0,
        map: perTileTexture || null,
      });
      
      // Physically correct texture color space
      if (perTileTexture) {
        perTileTexture.colorSpace = THREE.SRGBColorSpace;
      }
      mesh = new THREE.Mesh(geometry, material);
      // Rotate hex to flat-top orientation (CylinderGeometry creates point-top by default)
      mesh.rotation.y = Math.PI / 6; // 30 degrees
    } else {
      mesh = createHexMesh(tile, tileSize, heightScale);
    }
      // Terrain meshes: receive shadows but don't cast (keeps hexes readable)
      mesh.castShadow = false;
      mesh.receiveShadow = true;
    const coverFromGrid = tile.gridCell?.cover;
    mesh.userData = {
      ...tile,
      terrain: enforceFlat ? perTileTerrainKey.toLowerCase() : tile.terrain,
      height: enforceFlat ? 0 : tile.height,
      type: "tile",
      cover: Number.isFinite(coverFromGrid)
        ? coverFromGrid
        : TERRAIN_COVER[tile.terrain] ?? 0,
      gridPosition: tile.gridPosition,
    };
    clickable.push(mesh);
    scene.add(mesh);
    tileMeshMap.set(`${tile.q},${tile.r}`, mesh);

    const worldPos = worldVectorFromTile(tile, HEX_RADIUS, HEX_TILE_THICKNESS);
    mesh.position.copy(worldPos);
    minX = Math.min(minX, mesh.position.x);
    maxX = Math.max(maxX, mesh.position.x);
    minZ = Math.min(minZ, mesh.position.z);
    maxZ = Math.max(maxZ, mesh.position.z);
    mesh.userData.worldPosition = worldPos.clone();

    if (useGridFeatures) {
      const feature = tile.gridCell?.feature;
      if (feature && feature.toUpperCase().includes("TREE")) {
        const treeCount =
          tile.gridCell?.treeCount || (feature === "TREE_LARGE" ? 3 : 1);
        for (let i = 0; i < treeCount; i += 1) {
          const tree = createForestTree();
          const scaleMin = treeConfig.scale?.[0] ?? 0.9;
          const scaleMax = treeConfig.scale?.[1] ?? 1.1;
          const scale =
            scaleMin + Math.random() * Math.max(0, scaleMax - scaleMin);
          tree.scale.setScalar(scale);
          tree.castShadow = true;
          tree.rotation.y = Math.random() * Math.PI * 2;
          tree.position.copy(mesh.position);
          tree.position.y += mesh.geometry.parameters.height / 2 + 0.6;
          tree.position.x += (Math.random() - 0.5) * 0.7;
          tree.position.z += (Math.random() - 0.5) * 0.7;
          tree.userData = {
            type: "tree",
            parentTile: tile,
            cover: TREE_COVER,
          };
          clickable.push(tree);
          scene.add(tree);
          obstacles.push(tree);
        }
      }
    } else if (tile.terrain === "forest" && treeConfig.max > 0) {
      const countRange = Math.max(0, treeConfig.max - treeConfig.min + 1);
      const treeCount =
        treeConfig.min +
        (countRange > 0 ? Math.floor(Math.random() * countRange) : 0);
      for (let i = 0; i < treeCount; i += 1) {
        const tree = createForestTree();
        const scaleMin = treeConfig.scale?.[0] ?? 0.9;
        const scaleMax = treeConfig.scale?.[1] ?? 1.1;
        const scale =
          scaleMin + Math.random() * Math.max(0, scaleMax - scaleMin);
        if (treeConfig.leafColor) {
          const leavesMesh = tree.children.find(
            (child) => child.name === "leaves"
          );
          if (leavesMesh?.material?.color) {
            leavesMesh.material = leavesMesh.material.clone();
            leavesMesh.material.color.set(treeConfig.leafColor);
          }
        }
        tree.scale.setScalar(scale);
        tree.castShadow = true;
        tree.rotation.y = Math.random() * Math.PI * 2;
        tree.position.copy(mesh.position);
        tree.position.y += mesh.geometry.parameters.height / 2 + 0.6;
        tree.position.x += (Math.random() - 0.5) * 0.7;
        tree.position.z += (Math.random() - 0.5) * 0.7;
        tree.userData = {
          type: "tree",
          parentTile: tile,
          cover: TREE_COVER,
        };
        clickable.push(tree);
        scene.add(tree);
        obstacles.push(tree);
      }
    }
  });

  const mapSpanX = Math.max(1, maxX - minX + tileSize * 2);
  const mapSpanZ = Math.max(1, maxZ - minZ + tileSize * 2);
  const boundingRadius = Math.max(mapSpanX, mapSpanZ) / 2 || 20;
  const mapCenter = new THREE.Vector3(
    Number.isFinite(minX) && Number.isFinite(maxX) ? (minX + maxX) / 2 : 0,
    0,
    Number.isFinite(minZ) && Number.isFinite(maxZ) ? (minZ + maxZ) / 2 : 0
  );

  const groundWidth = mapSpanX * 1.4;
  const groundDepth = mapSpanZ * 1.4;
  let groundTexture = null;
  if (tileTexture) {
    groundTexture = tileTexture.clone();
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(
      Math.max(1, groundWidth / (tileSize * 2)),
      Math.max(1, groundDepth / (tileSize * 2))
    );
    groundTexture.needsUpdate = true;
    disposableTextures.push(groundTexture);
  }

  const groundMaterial = new THREE.MeshStandardMaterial({
    color: tileTexture ? 0xffffff : flatColor,
    roughness: 0.8,
    metalness: 0,
    map: groundTexture,
  });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundWidth, groundDepth),
    groundMaterial
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.position.set(mapCenter.x, 0, mapCenter.z);
  ground.renderOrder = -1;
  scene.add(ground);

  // Increase zoom distance by 10x as requested
  const defaultZoomDistance = Math.max(boundingRadius * 25, 500);
  const defaultCameraHeight = Math.max(boundingRadius * 20, 400);
  camera.position.set(
    mapCenter.x,
    defaultCameraHeight,
    mapCenter.z + defaultZoomDistance
  );
  camera.far = Math.max(20000, boundingRadius * 300);
  camera.updateProjectionMatrix();
  camera.lookAt(mapCenter);
  sun.target.position.copy(mapCenter);
  sun.target.updateMatrixWorld();
  scene.add(sun.target);

  const defaultCameraPosition = camera.position.clone();
  const defaultCameraTarget = mapCenter.clone();

  applyLighting(scene, ambientLight, sun, effectiveEnvironment.lighting);

  const axialToWorld = (q = 0, r = 0, height = 0) => {
    const base = worldVectorFromAxial(
      q,
      r,
      HEX_TILE_THICKNESS / 2 + height * 0.3,
      HEX_RADIUS
    );
    return base;
  };

  const addFacingArrow = (character) => {
    const arrowGeometry = new THREE.ConeGeometry(0.15, 0.35, 12);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: "#ffff00",
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.y = 0.12;
    scene.add(arrow);
    character._arrow = arrow;
    return arrow;
  };

  const demoCharacters = initialFighters.length
    ? initialFighters
    : [
        { id: "Alaidor", name: "Alaidor", alignment: "good", q: 0, r: 0 },
        { id: "Vininmar", name: "Vininmar", alignment: "good", q: 2, r: -1 },
        { id: "Minotaur", name: "Minotaur", alignment: "evil", q: -2, r: 1 },
      ];
  const characterIcons = [];
  const charactersById = new Map();

  demoCharacters.forEach((char) => {
    char.direction = Math.random() * 360;
    const icon = createCharacterIcon(char);
    clickable.push(icon);
    scene.add(icon);
    characterIcons.push(icon);
    char._iconGroup = icon;
    addFacingArrow(char);
    charactersById.set(char.id, char);
  });

  const visionSystem = new VisionSystem(scene, mapManager);
  const visionVisualizer = new VisionVisualizer(scene);
  const aiVisibility = new AIVisibilitySystem(scene, visionSystem);
  const partyVision = new PartyVisibilitySystem(visionSystem);
  const spottedAlerts = new SpottedAlertSystem(scene);
  const teamAwareness = new TeamAwarenessSystem(visionSystem);
  const memorySilhouettes = new MemorySilhouetteSystem(scene);
  initCombat(scene, visionSystem, visionVisualizer);
  const terrainHazards = getTerrainHazards();
  const aiEnvironment = getAIEnvironmentSystem();
  const leadershipAuras = getLeadershipAuras();

  setLineOfSightResolver((state, fromId, toId) => {
    const attacker = charactersById.get(fromId);
    const target = charactersById.get(toId);
    if (!attacker || !target) return true;
    const visibleTiles =
      visionSystem.getVisibleTiles(attacker, tiles, obstacles) || [];
    return visibleTiles.some(
      (tile) => tile.q === target.q && tile.r === target.r
    );
  });

  terrainHazards?.setWeather({
    windDir: 45,
    windSpeed: 1,
    rain: 0,
    humidity: 0.35,
  });

  demoCharacters.forEach((char) => {
    visionSystem.createVisionCone(char);
    visionSystem.updateCone(char, char.direction || 0);
  });

  let activeChar = demoCharacters[0];
  const visionUpdateInterval = 200;
  let lastVisionUpdate = 0;
  let needsVisionRefresh = true;
  let prevVisibleEnemies = new Set();
  const hazardInterval = 1000;
  let lastHazardUpdate = 0;
  const aiInterval = 1400;
  let lastAIUpdate = 0;

  const initialPartyMembers = demoCharacters.filter(
    (char) => char.alignment !== "evil"
  );
  const initialVisible =
    partyVision.getCombinedVisibleTiles(
      initialPartyMembers,
      tiles,
      obstacles
    ) || [];
  if (initialVisible.length) {
    visionVisualizer.showFogOfWar(tiles, initialVisible);
  } else {
    visionVisualizer.showFogOfWar(
      tiles,
      visionSystem.getVisibleTiles(activeChar, tiles, obstacles)
    );
  }

  let isRotating = false;
  let lastMouseX = 0;
  let rotatedDuringDrag = false;

  const handleKeyDown = (event) => {
    if (!activeChar) return;
    if (event.key === "ArrowLeft") {
      activeChar.direction = (activeChar.direction || 0) - 5;
      needsVisionRefresh = true;
    }
    if (event.key === "ArrowRight") {
      activeChar.direction = (activeChar.direction || 0) + 5;
      needsVisionRefresh = true;
    }
  };

  const handleMouseDown = (event) => {
    if (event.button === 2 && activeChar) {
      isRotating = true;
      lastMouseX = event.clientX;
      rotatedDuringDrag = false;
    }
  };

  const handleMouseMoveRotation = (event) => {
    if (isRotating && activeChar) {
      const delta = event.clientX - lastMouseX;
      lastMouseX = event.clientX;
      activeChar.direction = (activeChar.direction || 0) + delta * 0.3;
      needsVisionRefresh = true;
      if (Math.abs(delta) > 0.0001) {
        rotatedDuringDrag = true;
      }
    }
  };

  const handleMouseUp = () => {
    isRotating = false;
    rotatedDuringDrag = false;
  };

  window.addEventListener("keydown", handleKeyDown);
  renderer.domElement.addEventListener("mousedown", handleMouseDown);
  renderer.domElement.addEventListener("mousemove", handleMouseMoveRotation);
  window.addEventListener("mouseup", handleMouseUp);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI / 2.2;
  // Increase zoom range by 10x
  controls.minDistance = Math.max(50, boundingRadius * 1.5);
  controls.maxDistance = Math.max(2000, boundingRadius * 150);
  controls.target.copy(mapCenter);
  controls.update();

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selected = null;

  const tooltip = document.createElement("div");
  Object.assign(tooltip.style, {
    position: "fixed",
    pointerEvents: "none",
    background: "rgba(10, 10, 10, 0.85)",
    color: "#fff",
    padding: "4px 8px",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "12px",
    zIndex: 1000,
    display: "none",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
  });
  document.body.appendChild(tooltip);

  function hideTooltip() {
    tooltip.style.display = "none";
  }

  function getTooltipInfo(object) {
    if (!object) return null;
    const data = object.userData || {};

    // Use shared hex selection utilities for consistent info display
    const context = {
      positions: {},
      combatants: demoCharacters,
      terrain: effectiveEnvironment,
    };

    if (data.type === "tile") {
      const hexInfo = getHexInfo(data, context);
      if (!hexInfo) return null;

      // Get selected hex for distance calculation
      const selectedHex = selected?.userData;
      const fromHex =
        selectedHex && selectedHex.type === "tile"
          ? { q: selectedHex.q, r: selectedHex.r }
          : null;

      const info = formatHexInfo(hexInfo, fromHex);
      if (data.height) {
        return [...info.split(" | "), `Height: ${data.height}`];
      }
      return info.split(" | ");
    }

    if (data.type === "character") {
      const hexInfo = getHexInfo(data, context);
      if (!hexInfo) return null;

      const alignment = data.alignment
        ? ` (${toTitleCase(data.alignment)})`
        : "";

      // Get selected hex for distance calculation
      const selectedHex = selected?.userData;
      const fromHex =
        selectedHex && selectedHex.type === "tile"
          ? { q: selectedHex.q, r: selectedHex.r }
          : null;

      const info = formatHexInfo(hexInfo, fromHex);
      return [`${data.name || "Unknown"}${alignment}`, ...info.split(" | ")];
    }

    if (object.parent?.userData?.type === "characterGroup") {
      const parentData = object.parent.userData;
      const hexInfo = getHexInfo(parentData, context);
      if (!hexInfo) return null;

      const alignment = parentData.alignment
        ? ` (${toTitleCase(parentData.alignment)})`
        : "";

      const info = formatHexInfo(hexInfo);
      return [
        `${parentData.name || "Unknown"}${alignment}`,
        ...info.split(" | "),
      ];
    }

    if (data.type === "tree" && data.parentTile) {
      const hexInfo = getHexInfo(data.parentTile, context);
      if (!hexInfo) return null;

      const info = formatHexInfo(hexInfo);
      return ["Obstacle: Tree", ...info.split(" | ")];
    }

    return null;
  }

  function updateTooltip(intersects, event) {
    if (!intersects || intersects.length === 0) {
      hideTooltip();
      return;
    }

    const obj = intersects[0].object;
    const info = getTooltipInfo(obj);
    if (!info) {
      hideTooltip();
      return;
    }

    tooltip.innerHTML = info.join("<br/>");
    tooltip.style.display = "block";
    tooltip.style.left = `${event.clientX + 12}px`;
    tooltip.style.top = `${event.clientY + 12}px`;
  }

  const hoverRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.03, 6),
    new THREE.MeshBasicMaterial({
      color: "#00ffff",
      transparent: true,
      opacity: 0.35,
    })
  );
  hoverRing.visible = false;
  scene.add(hoverRing);

  const activeRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 0.05, 6),
    new THREE.MeshBasicMaterial({
      color: "#3cff4a",
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })
  );
  activeRing.visible = false;
  scene.add(activeRing);

  const selectRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.05, 6),
    new THREE.MeshBasicMaterial({
      color: "#ffff00",
      transparent: true,
      opacity: 0.4,
    })
  );
  selectRing.visible = false;
  scene.add(selectRing);

  const moveVisualizer = new MovementRangeSystem(scene, {
    tileSize,
    heightScale,
  });

  const contextMenu = document.createElement("div");
  contextMenu.style.position = "absolute";
  contextMenu.style.display = "none";
  contextMenu.style.background = "rgba(20, 20, 20, 0.92)";
  contextMenu.style.border = "1px solid #ccc";
  contextMenu.style.borderRadius = "6px";
  contextMenu.style.padding = "6px";
  contextMenu.style.color = "#fff";
  contextMenu.style.fontFamily = "monospace";
  contextMenu.style.fontSize = "12px";
  contextMenu.style.zIndex = "10";
  contextMenu.innerHTML = `
    <div class="map-menu-option" data-action="move">Move</div>
    <div class="map-menu-option" data-action="attack">Attack</div>
    <div class="map-menu-option" data-action="cast">Cast</div>
    <div class="map-menu-option" data-action="inspect">Inspect</div>
  `;
  contextMenu.querySelectorAll(".map-menu-option").forEach((option) => {
    option.style.padding = "4px 8px";
    option.style.cursor = "pointer";
    option.addEventListener("mouseenter", () => {
      option.style.background = "rgba(255,255,255,0.1)";
    });
    option.addEventListener("mouseleave", () => {
      option.style.background = "transparent";
    });
  });

  container.style.position = container.style.position || "relative";
  container.appendChild(contextMenu);

  function hideMenu() {
    contextMenu.style.display = "none";
    delete contextMenu.dataset.context;
  }

  function showMenu(x, y, data) {
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.display = "block";
    contextMenu.dataset.context = JSON.stringify(data || {});
  }

  function setMouseFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function intersectObjects(event) {
    setMouseFromEvent(event);
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(clickable, true);
  }

  function updateHover(intersects) {
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      hoverRing.position.copy(obj.position);
      hoverRing.position.y += 0.05;
      hoverRing.visible = true;
    } else {
      hoverRing.visible = false;
    }
  }

  function centerCameraOnPosition(targetPos, smooth = true) {
    if (!targetPos) return;
    const target = new THREE.Vector3(
      targetPos.x,
      targetPos.y || 0,
      targetPos.z
    );
    const distance = Math.max(boundingRadius * 0.8, 15);
    const height = Math.max(boundingRadius * 0.6, 20);
    const newPos = new THREE.Vector3(target.x, height, target.z + distance);
    if (smooth) {
      const duration = 500;
      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      const startTime = performance.now();
      function animateCamera() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / duration);
        const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        camera.position.lerpVectors(startPos, newPos, easeT);
        controls.target.lerpVectors(startTarget, target, easeT);
        controls.update();
        if (t < 1) {
          requestAnimationFrame(animateCamera);
        }
      }
      requestAnimationFrame(animateCamera);
    } else {
      camera.position.copy(newPos);
      controls.target.copy(target);
      controls.update();
    }
  }

  function resetCameraToDefault(smooth = true) {
    if (smooth) {
      const duration = 600;
      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      const startTime = performance.now();
      function animateCamera() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / duration);
        const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        camera.position.lerpVectors(startPos, defaultCameraPosition, easeT);
        controls.target.lerpVectors(startTarget, defaultCameraTarget, easeT);
        controls.update();
        if (t < 1) {
          requestAnimationFrame(animateCamera);
        }
      }
      requestAnimationFrame(animateCamera);
    } else {
      camera.position.copy(defaultCameraPosition);
      controls.target.copy(defaultCameraTarget);
      controls.update();
    }
  }

  function applySelection(obj, fireCallback = true) {
    if (obj) {
      selected = obj;
      selectRing.position.copy(obj.position);
      selectRing.position.y += 0.05;
      selectRing.visible = true;
      centerCameraOnPosition(obj.position, true);
      if (fireCallback && typeof onSelect === "function") {
        onSelect(obj.userData);
      }
    } else {
      selected = null;
      selectRing.visible = false;
      resetCameraToDefault(true);
      if (fireCallback && typeof onSelect === "function") {
        onSelect(null);
      }
    }
  }

  function updateSelection(obj) {
    applySelection(obj, true);
  }

  function updateActiveRing(activeId) {
    if (!activeId) {
      activeRing.visible = false;
      return;
    }
    const activeChar = charactersById.get(activeId);
    const mesh = activeChar?._iconGroup;
    if (mesh) {
      activeRing.position.copy(mesh.position);
      activeRing.position.y += 0.05;
      activeRing.visible = true;
    } else {
      activeRing.visible = false;
    }
  }

  function applySelectionFromState(selectedData) {
    if (!selectedData) {
      applySelection(null, false);
      return;
    }

    if (selectedData.type === "tile") {
      const mesh = tileMeshMap.get(`${selectedData.q},${selectedData.r}`);
      if (mesh) {
        applySelection(mesh, false);
      } else {
        applySelection(null, false);
      }
      return;
    }

    if (selectedData.type === "character") {
      const char = charactersById.get(selectedData.id);
      if (char?._iconGroup) {
        applySelection(char._iconGroup, false);
      } else {
        applySelection(null, false);
      }
      return;
    }

    applySelection(null, false);
  }

  function updateCharacterPositions(positions = {}) {
    Object.entries(positions).forEach(([id, pos]) => {
      if (!pos || typeof pos.q !== "number" || typeof pos.r !== "number") {
        return;
      }
      const character = charactersById.get(id);
      if (!character) return;
      character.q = pos.q;
      character.r = pos.r;
      const icon = character._iconGroup;
      if (icon) {
        const worldPos = worldVectorFromEntity(
          { ...character, q: pos.q, r: pos.r },
          HEX_RADIUS,
          HEX_TILE_THICKNESS
        );
        icon.position.copy(worldPos);
        if (character._arrow) {
          character._arrow.position.set(
            worldPos.x,
            worldPos.y + 0.12,
            worldPos.z
          );
        }
      }
    });
  }

  const moveHighlightMaterial = new THREE.MeshBasicMaterial({
    color: "#00ff00",
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });

  const targetHighlightMaterial = new THREE.MeshBasicMaterial({
    color: "#ff0000",
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });

  const moveHighlights = [];
  const targetHighlights = [];

  function clearActionHighlights() {
    [...moveHighlights, ...targetHighlights].forEach((mesh) => {
      if (!mesh) return;
      scene.remove(mesh);
      mesh.geometry?.dispose?.();
      if (
        mesh.material &&
        mesh.material !== moveHighlightMaterial &&
        mesh.material !== targetHighlightMaterial
      ) {
        mesh.material?.dispose?.();
      }
    });
    moveHighlights.length = 0;
    targetHighlights.length = 0;
  }

  function addTileHighlight(tileMesh, material, storeArray) {
    if (!tileMesh) return;
    const radius = tileMesh.geometry?.parameters?.radius || HEX_RADIUS;
    const highlight = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.95, radius * 0.95, 0.05, 6),
      material.clone()
    );
    highlight.position.copy(tileMesh.position);
    highlight.position.y += 0.06;
    highlight.rotation.y = tileMesh.rotation.y;
    highlight.renderOrder = 10;
    scene.add(highlight);
    storeArray.push(highlight);
  }

  function spawnFloatingText(characterId, text, options = {}) {
    if (!characterId || !text) return null;
    const character = charactersById.get(characterId);
    const iconGroup = character?._iconGroup;
    if (!iconGroup) return null;

    const { color = "#ffffff", duration = 1000, fontSize = 48 } = options;

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.6, 0.8, 1);
    sprite.position.copy(iconGroup.position);
    sprite.position.y += 1.2;
    scene.add(sprite);

    const start = performance.now();
    const startY = sprite.position.y;

    function animateFloating() {
      const now = performance.now();
      const t = (now - start) / duration;
      if (t >= 1) {
        scene.remove(sprite);
        texture.dispose();
        material.dispose();
        return;
      }
      sprite.position.y = startY + t * 0.6;
      sprite.material.opacity = 1 - t;
      requestAnimationFrame(animateFloating);
    }

    requestAnimationFrame(animateFloating);
    return sprite;
  }

  function updateFromState(combatState = {}) {
    const {
      positions: statePositions = {},
      activeCombatantId: stateActiveId = null,
      selectedObject: stateSelected = null,
      pendingAction: statePendingAction = null,
      grid: stateGrid = {},
      combatantsById: stateCombatantsById = {},
    } = combatState;

    updateCharacterPositions(statePositions);
    updateActiveRing(stateActiveId);
    applySelectionFromState(stateSelected);

    if (statePendingAction !== COMBAT_ACTION.MOVE) {
      moveVisualizer.clearRanges();
      moveVisualizer.clearPath();
    }

    clearActionHighlights();

    if (statePendingAction === COMBAT_ACTION.MOVE && stateActiveId) {
      Object.values(stateGrid).forEach((cell) => {
        if (!cell || typeof cell.q !== "number" || typeof cell.r !== "number")
          return;
        const dest = { q: cell.q, r: cell.r };
        if (!canReachTile(combatState, stateActiveId, dest)) return;
        const tileMesh = tileMeshMap.get(`${cell.q},${cell.r}`);
        if (tileMesh) {
          addTileHighlight(tileMesh, moveHighlightMaterial, moveHighlights);
        }
      });
    }

    if (
      (statePendingAction === COMBAT_ACTION.ATTACK ||
        statePendingAction === COMBAT_ACTION.CAST) &&
      stateActiveId
    ) {
      Object.keys(stateCombatantsById).forEach((id) => {
        if (id === stateActiveId) return;
        if (!canPerformRangedAttack(combatState, stateActiveId, id)) return;
        const character = charactersById.get(id);
        const iconGroup = character?._iconGroup;
        if (!iconGroup) return;
        const pos = combatState.positions?.[id];
        if (!pos) return;
        const tileMesh = tileMeshMap.get(`${pos.q},${pos.r}`);
        if (tileMesh) {
          addTileHighlight(tileMesh, targetHighlightMaterial, targetHighlights);
        }
      });
    }
  }

  const handleMouseMove = (event) => {
    hideMenu();
    const intersects = intersectObjects(event);
    updateHover(intersects);
    updateTooltip(intersects, event);
  };

  const handleClick = (event) => {
    hideMenu();
    const intersects = intersectObjects(event);
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      updateSelection(obj);

      const characterData =
        obj.userData?.type === "character"
          ? obj.userData
          : obj.parent?.userData?.type === "characterGroup"
          ? obj.parent.userData
          : null;
      if (characterData) {
        const found = demoCharacters.find(
          (char) => char.id === characterData.id
        );
        if (found) {
          activeChar = found;
          needsVisionRefresh = true;
        }
      }

      if (
        moveVisualizer.rangeRings.length > 0 &&
        obj.userData?.type === "tile"
      ) {
        const clickedTile = obj.userData;
        const startTile = selected?.userData || clickedTile;
        const pathTiles = findPath(startTile, clickedTile, mapManager);
        moveVisualizer.showPath(pathTiles);
      }
    } else {
      updateSelection(null);
      moveVisualizer.clearAll();
    }
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    if (rotatedDuringDrag) {
      rotatedDuringDrag = false;
      return;
    }
    const intersects = intersectObjects(event);
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      hideTooltip();
      showMenu(event.offsetX, event.offsetY, obj.userData);
    } else {
      hideMenu();
    }
  };

  const handleMenuClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    if (!action) return;
    const contextDataRaw = contextMenu.dataset.context;
    const contextData = contextDataRaw ? JSON.parse(contextDataRaw) : {};

    hideMenu();

    if (action === "move" && contextData?.type === "tile" && activeChar) {
      const fromTile = tiles.find(
        (tile) => tile.q === activeChar.q && tile.r === activeChar.r
      );
      if (fromTile) {
        const path = findPath(fromTile, contextData, mapManager);
        moveVisualizer.showPath(path);
        onAction("move", {
          path,
          character: activeChar,
          destination: contextData,
        });
      }
      return;
    }

    const attacker = activeChar;
    const targetCharacter = demoCharacters.find(
      (char) => char.id === contextData.id
    );
    if (action === "attack" && attacker && targetCharacter) {
      const result = resolveCombatAttack({
        attacker,
        target: targetCharacter,
        obstacles,
      });
      onAction(action, {
        attackerId: attacker.id,
        targetId: targetCharacter.id,
        ...result,
      });
      return;
    }

    if (action === "cast" && attacker) {
      const spell = {
        name: "Fire Bolt",
        requiresLoS: true,
        blockedByTerrain: true,
        affectedByFog: true,
        subtype: "direct",
        range: 120,
      };
      const targetTile = contextData?.type === "tile" ? contextData : null;
      const spellResult = resolveSpellAttack({
        caster: attacker,
        targetTile,
        target: targetCharacter ?? null,
        spell,
        obstacles,
        fogTiles: visionVisualizer.getFogTiles?.() || [],
        mapInstance: mapManager,
        characters: demoCharacters,
      });
      console.log(spellResult.log);
      needsVisionRefresh = true;
      onAction(action, {
        attackerId: attacker.id,
        targetId: targetCharacter?.id,
        spellName: spell.name,
        ...spellResult,
      });
      return;
    }

    moveVisualizer.clearAll();
    onAction(action, contextData);
  };

  const handleContainerLeave = () => {
    hoverRing.visible = false;
    hideTooltip();
    hideMenu();
    moveVisualizer.clearAll();
  };

  container.addEventListener("mousemove", handleMouseMove);
  container.addEventListener("click", handleClick);
  container.addEventListener("contextmenu", handleContextMenu);
  container.addEventListener("mouseleave", handleContainerLeave);
  contextMenu.addEventListener("click", handleMenuClick);

  const handleResize = () => {
    const width = container.clientWidth || renderer.domElement.width;
    const height = container.clientHeight || renderer.domElement.height;
    camera.aspect = width / (height || 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  window.addEventListener("resize", handleResize);

  const enemyNpcs = demoCharacters.filter((char) => char.alignment === "evil");

  function getNeighborTiles(q, r) {
    return HEX_DIRECTIONS.map((dir) => ({ q: q + dir.q, r: r + dir.r }))
      .map((pos) => tiles.find((t) => t.q === pos.q && t.r === pos.r))
      .filter(Boolean);
  }

  function moveNpcToTile(npc, tile) {
    if (!tile || !npc) return false;
    const worldPos = worldVectorFromTile(tile, HEX_RADIUS, HEX_TILE_THICKNESS);
    npc.q = tile.q;
    npc.r = tile.r;
    npc.height = tile.height || 0;
    npc.position = { x: worldPos.x, y: worldPos.y, z: worldPos.z };
    if (npc._iconGroup) {
      npc._iconGroup.position.copy(worldPos);
    }
    if (npc._arrow) {
      npc._arrow.position.copy(worldPos);
    }
    needsVisionRefresh = true;
    return true;
  }

  function findSafeNeighbor(npc) {
    const neighbors = getNeighborTiles(npc.q, npc.r);
    return neighbors.find(
      (tile) =>
        tile &&
        !terrainHazards?.hasHazard(tile.q, tile.r) &&
        tile.terrain !== "water" &&
        !demoCharacters.some(
          (other) =>
            other !== npc &&
            other.q === tile.q &&
            other.r === tile.r &&
            other.alive !== false
        )
    );
  }

  function computeVisibleEnemies(npc) {
    const potentialTargets = demoCharacters.filter(
      (char) =>
        char !== npc && char.alignment !== npc.alignment && char.alive !== false
    );
    const visibleTiles =
      visionSystem.getVisibleTiles(npc, tiles, obstacles) || [];
    return potentialTargets.filter((target) =>
      visibleTiles.some((t) => t.q === target.q && t.r === target.r)
    );
  }

  function handleAIIntent({ npc, intent, reason }) {
    if (!npc) return;
    npc.intent = intent;
    npc.intentReason = reason;
    switch (intent) {
      case "flee":
      case "retreat":
      case "move_out": {
        const safeTile = findSafeNeighbor(npc);
        if (safeTile) {
          moveNpcToTile(npc, safeTile);
        }
        break;
      }
      case "flank": {
        const safeTile = findSafeNeighbor(npc);
        if (safeTile) moveNpcToTile(npc, safeTile);
        break;
      }
      case "hide":
        npc.status = "hidden";
        break;
      case "panic": {
        const neighbors = getNeighborTiles(npc.q, npc.r);
        const randomTile =
          neighbors[Math.floor(Math.random() * neighbors.length)];
        if (randomTile) moveNpcToTile(npc, randomTile);
        break;
      }
      default:
        break;
    }
  }

  let animationFrameId = null;
  const animate = (time = 0) => {
    controls.update();
    updateCharacterBillboards(characterIcons, camera);
    demoCharacters.forEach((char) => {
      visionSystem.updateCone(char, char.direction || 0);
      if (char._arrow) {
        const pos = axialToWorld(char.q, char.r, char.height || 0);
        char._arrow.position.copy(pos);
        char._arrow.rotation.y = THREE.MathUtils.degToRad(char.direction || 0);
      }
    });

    if (terrainHazards && time - lastHazardUpdate > hazardInterval) {
      terrainHazards.applyHazardEffects(demoCharacters, visionSystem);
      terrainHazards.tick(tiles);
      lastHazardUpdate = time;
      needsVisionRefresh = true;
    }

    if (aiEnvironment && time - lastAIUpdate > aiInterval) {
      const livingEnemies = enemyNpcs.filter((npc) => npc.alive !== false);
      livingEnemies.forEach((npc) => {
        npc.visibleEnemies = computeVisibleEnemies(npc);
      });
      const intents = aiEnvironment.evaluate(livingEnemies, tiles) || [];
      intents.forEach(handleAIIntent);

      const moraleSystem =
        aiEnvironment.getMoraleSystem?.() || aiEnvironment.moraleSystem;
      if (moraleSystem) {
        demoCharacters.forEach((char) => {
          if (char) char.moraleBonus = 0;
        });
        const leaders = demoCharacters.filter(
          (char) => char?.leader && char.alive !== false
        );
        const chainLogs =
          moraleSystem.propagateChainOfCommand(leaders, demoCharacters) || [];
        chainLogs.forEach((msg) => console.log(msg));
        const auraLogs =
          moraleSystem.applyFearAndCommandAuras(demoCharacters) || [];
        auraLogs.forEach((msg) => console.log(msg));
        const conflictLogs =
          moraleSystem.resolveAuraConflicts(demoCharacters) || [];
        conflictLogs.forEach((msg) => console.log(msg));
        if (leadershipAuras) {
          leadershipAuras.clear();
          leadershipAuras.showLeadershipAuras(leaders, moraleSystem);
          leadershipAuras.showFearAndCommandAuras(demoCharacters, moraleSystem);
        }
      }

      lastAIUpdate = time;
    }

    if (leadershipAuras) {
      leadershipAuras.update(time);
    }

    if (needsVisionRefresh || time - lastVisionUpdate > visionUpdateInterval) {
      const partyMembers = demoCharacters.filter(
        (char) => char.alignment !== "evil"
      );
      const enemies = demoCharacters.filter(
        (char) => char.alignment === "evil"
      );

      const effectiveRange = teamAwareness.computeEffectiveRange(
        partyMembers,
        6,
        0.75,
        1,
        obstacles
      );
      visionSystem.setRangeAndFov(effectiveRange, visionSystem.fovAngle);

      const visibleTiles = partyVision.getCombinedVisibleTiles(
        partyMembers,
        tiles,
        obstacles
      );
      visionVisualizer.showFogOfWar(tiles, visibleTiles);

      const visibleEnemies = partyVision.getCombinedVisibleEnemies(
        partyMembers,
        enemies,
        tiles,
        obstacles
      );
      const visibleEnemyIds = visibleEnemies.map((enemy) => enemy.id);
      aiVisibility.updateSceneVisibility(demoCharacters, visibleEnemyIds);
      visibleEnemies.forEach((enemy) => {
        if (!prevVisibleEnemies.has(enemy.id)) {
          spottedAlerts.showAlert(enemy);
        }
      });
      memorySilhouettes.updateMemory(enemies, visibleEnemyIds);
      prevVisibleEnemies = new Set(visibleEnemyIds);

      lastVisionUpdate = time;
      needsVisionRefresh = false;
    }

    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(animate);
  };
  animate();

  const dispose = () => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("keydown", handleKeyDown);
    renderer.domElement.removeEventListener("mousedown", handleMouseDown);
    renderer.domElement.removeEventListener(
      "mousemove",
      handleMouseMoveRotation
    );
    window.removeEventListener("mouseup", handleMouseUp);
    container.removeEventListener("mousemove", handleMouseMove);
    container.removeEventListener("click", handleClick);
    container.removeEventListener("contextmenu", handleContextMenu);
    container.removeEventListener("mouseleave", handleContainerLeave);
    contextMenu.removeEventListener("click", handleMenuClick);
    if (contextMenu.parentElement === container) {
      container.removeChild(contextMenu);
    }
    hideTooltip();
    tooltip.remove();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
    controls.dispose();
    clearActionHighlights();
    moveHighlightMaterial.dispose();
    targetHighlightMaterial.dispose();
    setLineOfSightResolver(null);
    renderer.forceContextLoss?.();
    renderer.dispose();
    selectRing.geometry.dispose();
    hoverRing.geometry.dispose();
    activeRing.geometry.dispose();
    visionSystem.dispose();
    visionVisualizer.dispose();
    spottedAlerts.dispose();
    memorySilhouettes.dispose();
    leadershipAuras?.clear();
    obstacles.length = 0;
    demoCharacters.forEach((char) => {
      if (char._arrow) {
        scene.remove(char._arrow);
        char._arrow.geometry?.dispose?.();
        char._arrow.material?.dispose?.();
        char._arrow = null;
      }
    });
    moveVisualizer.clearAll();
    clickable.forEach((obj) => {
      obj.traverse?.((child) => {
        if (child.isMesh) {
          child.geometry?.dispose?.();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose?.());
            } else {
              child.material.dispose?.();
            }
          }
        }
      });
    });
    scene.remove(ground);
    ground.geometry?.dispose?.();
    ground.material?.dispose?.();
    disposableTextures.forEach((tex) => tex.dispose?.());
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    map: mapManager,
    clickable,
    aiVisibility,
    partyVision,
    spottedAlerts,
    teamAwareness,
    memorySilhouettes,
    getSelected: () => selected,
    hideMenu,
    updateFromState,
    spawnFloatingText,
    dispose,
  };
}

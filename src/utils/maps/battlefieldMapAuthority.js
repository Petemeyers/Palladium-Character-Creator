import { normalizeBattlefieldProp } from "./battlefieldPropCatalog.js";
const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const BATTLEFIELD_MAP_SCHEMA_VERSION = 2;
export const BATTLEFIELD_GENERATOR_VERSION = 1;

export const BATTLEFIELD_MAP_SOURCES = Object.freeze({
  BUILT_IN: "built-in",
  SAVED: "saved",
  GENERATED: "generated",
  IMPORTED: "imported",
});

export const BATTLEFIELD_LIGHTING = Object.freeze({
  BRIGHT_DAYLIGHT: "BRIGHT_DAYLIGHT",
  DAYLIGHT: "DAYLIGHT",
  DUSK: "DUSK",
  MOONLIGHT: "MOONLIGHT",
  TORCHLIGHT: "TORCHLIGHT",
  DARKNESS: "DARKNESS",
});

export const BATTLEFIELD_FOG = Object.freeze({
  CLEAR: "CLEAR",
  MIST: "MIST",
  FOG: "FOG",
  DENSE_FOG: "DENSE_FOG",
});

export const ENVIRONMENTAL_FOG_PROFILES = Object.freeze({
  [BATTLEFIELD_FOG.CLEAR]: Object.freeze({
    label: "Clear",
    visibilityMultiplier: 1,
    maximumVisualRangeFeet: null,
    concealment: 0,
  }),
  [BATTLEFIELD_FOG.MIST]: Object.freeze({
    label: "Light mist",
    visibilityMultiplier: 0.8,
    maximumVisualRangeFeet: 180,
    concealment: 1,
  }),
  [BATTLEFIELD_FOG.FOG]: Object.freeze({
    label: "Fog",
    visibilityMultiplier: 0.55,
    maximumVisualRangeFeet: 90,
    concealment: 2,
  }),
  [BATTLEFIELD_FOG.DENSE_FOG]: Object.freeze({
    label: "Dense fog",
    visibilityMultiplier: 0.3,
    maximumVisualRangeFeet: 45,
    concealment: 3,
  }),
});

const VISUAL_TERRAIN_ALIASES = Object.freeze({
  "open-ground": "grass",
  open: "grass",
  grass: "grass",
  meadow: "grass",
  field: "grass",
  plain: "grass",
  road: "road",
  dirt: "sand",
  sand: "sand",
  forest: "forest",
  "light-forest": "forest",
  "dense-forest": "forest",
  woods: "forest",
  woodland: "forest",
  rock: "rock",
  rocky: "rock",
  "rocky-terrain": "rock",
  rubble: "rubble",
  ruins: "rubble",
  debris: "rubble",
  mud: "mud",
  marsh: "mud",
  swamp: "mud",
  bog: "mud",
  water: "water",
  river: "water",
  lake: "water",
  pond: "water",
  "narrow-passage": "road",
  corridor: "road",
  bridge: "road",
  "elevated-ground": "hill",
  hill: "hill",
  ridge: "hill",
});

const FORMATION_TERRAIN_ALIASES = Object.freeze({
  "open-ground": "open-ground",
  open: "open-ground",
  grass: "open-ground",
  meadow: "open-ground",
  field: "open-ground",
  plain: "open-ground",
  road: "open-ground",
  dirt: "open-ground",
  sand: "uneven-ground",
  forest: "forest",
  "light-forest": "forest",
  "dense-forest": "forest",
  woods: "forest",
  woodland: "forest",
  rock: "uneven-ground",
  rocky: "uneven-ground",
  "rocky-terrain": "uneven-ground",
  rubble: "rubble",
  ruins: "rubble",
  debris: "rubble",
  mud: "mud",
  marsh: "mud",
  swamp: "mud",
  bog: "mud",
  water: "deep-water",
  river: "deep-water",
  lake: "deep-water",
  pond: "deep-water",
  "deep-water": "deep-water",
  "narrow-passage": "narrow-passage",
  corridor: "narrow-passage",
  bridge: "narrow-passage",
  gate: "narrow-passage",
  doorway: "narrow-passage",
  "elevated-ground": "elevated-ground",
  hill: "elevated-ground",
  ridge: "elevated-ground",
  "high-ground": "elevated-ground",
});

const LEGACY_TERRAIN_ALIASES = Object.freeze({
  "open-ground": "open-ground",
  "dense-forest": "dense-forest",
  "light-forest": "light-forest",
  "rocky-terrain": "rocky-terrain",
  "swamp-marsh": "swamp",
  "cave-interior": "rock",
  urban: "road",
  normal: "open-ground",
  difficult: "uneven-ground",
  rough: "uneven-ground",
  water: "water",
  road: "road",
  forest: "forest",
  grass: "grass",
  rock: "rock",
  sand: "sand",
  hill: "hill",
});

export function normalizeBattlefieldLighting(value = BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT) {
  const key = normalizeText(value);
  if (!key) return BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT;
  if (/bright.*day|full.*day|sunlight/.test(key)) return BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT;
  if (key === "daylight" || key === "day") return BATTLEFIELD_LIGHTING.DAYLIGHT;
  if (/dusk|dawn|twilight/.test(key)) return BATTLEFIELD_LIGHTING.DUSK;
  if (/moon/.test(key)) return BATTLEFIELD_LIGHTING.MOONLIGHT;
  // Hidden compatibility alias for the older misspelled lighting key.
  if (/torch|firelight|lantern|traiderh/.test(key)) return BATTLEFIELD_LIGHTING.TORCHLIGHT;
  if (/dark|night/.test(key)) return BATTLEFIELD_LIGHTING.DARKNESS;
  return BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT;
}

export function normalizeEnvironmentalFog(value = BATTLEFIELD_FOG.CLEAR) {
  const key = normalizeText(typeof value === "string" ? value : value?.type || value?.preset || value?.name);
  if (!key || /clear|none|off/.test(key)) return BATTLEFIELD_FOG.CLEAR;
  if (/dense|heavy|thick/.test(key)) return BATTLEFIELD_FOG.DENSE_FOG;
  if (/mist|haze/.test(key)) return BATTLEFIELD_FOG.MIST;
  if (/fog/.test(key)) return BATTLEFIELD_FOG.FOG;
  return BATTLEFIELD_FOG.CLEAR;
}

export function normalizeVisualTerrainKey(value = "grass") {
  const key = normalizeText(value);
  const compatibility = LEGACY_TERRAIN_ALIASES[key] || key;
  return VISUAL_TERRAIN_ALIASES[compatibility] || VISUAL_TERRAIN_ALIASES[key] || "grass";
}

export function normalizeFormationTerrainKey(value = "open-ground") {
  const key = normalizeText(value);
  const compatibility = LEGACY_TERRAIN_ALIASES[key] || key;
  return FORMATION_TERRAIN_ALIASES[compatibility] || FORMATION_TERRAIN_ALIASES[key] || "open-ground";
}

export function getCombatTerrainAtCell(cell = null) {
  if (!cell) return "open-ground";
  return cell.formationType || cell.combatTerrainType || normalizeFormationTerrainKey(
    cell.terrainType || cell.terrain || cell.type || cell.name,
  );
}

export function normalizeBattlefieldCell(cell = {}, x = null, y = null, fallbackTerrain = "grass") {
  const visualTerrain = normalizeVisualTerrainKey(
    cell.terrainType || cell.terrain || cell.visualTerrain || fallbackTerrain,
  );
  const formationType = cell.formationType || cell.combatTerrainType || normalizeFormationTerrainKey(
    cell.terrainType || cell.terrain || visualTerrain,
  );
  const elevation = toFinite(
    cell.elevation ?? cell.height ?? cell.elev,
    0,
  );
  const explicitWalkable = cell.walkable ?? cell.isWalkable;
  const deepWater = formationType === "deep-water";
  const walkable = explicitWalkable == null ? !deepWater : Boolean(explicitWalkable);

  return {
    ...cell,
    ...(Number.isFinite(Number(x)) ? { x: Number(x) } : {}),
    ...(Number.isFinite(Number(y)) ? { y: Number(y) } : {}),
    terrain: visualTerrain,
    terrainType: visualTerrain,
    visualTerrain,
    formationType,
    combatTerrainType: formationType,
    elevation,
    height: elevation,
    walkable,
    isWalkable: walkable,
    moveCost: toFinite(cell.moveCost ?? cell.movementCost, 1),
    cover: toFinite(cell.cover, 0),
    blocksLineOfSight: cell.blocksLineOfSight === true,
  };
}

function inferSize(map = {}) {
  const gridHeight = Array.isArray(map.grid) ? map.grid.length : 0;
  const gridWidth = gridHeight > 0 && Array.isArray(map.grid[0]) ? map.grid[0].length : 0;
  const width = Math.max(1, Math.floor(toFinite(
    map.size?.width ?? map.mapSize?.width ?? map.width,
    gridWidth || 40,
  )));
  const height = Math.max(1, Math.floor(toFinite(
    map.size?.height ?? map.mapSize?.height ?? map.height,
    gridHeight || 30,
  )));
  return { width, height };
}

function normalizeGrid(map = {}, size, fallbackTerrain) {
  const source = Array.isArray(map.grid) ? map.grid : [];
  return Array.from({ length: size.height }, (_, y) => (
    Array.from({ length: size.width }, (_, x) => normalizeBattlefieldCell(
      source?.[y]?.[x] || {},
      x,
      y,
      fallbackTerrain,
    ))
  ));
}

// coordinateSpace remains canonical prop metadata; the prop catalog resolves legacy axial/offset saves.
function normalizeProps(props = []) {
  if (!Array.isArray(props)) return [];
  return props
    .filter((prop) => prop && Number.isFinite(Number(prop.q ?? prop.x)) && Number.isFinite(Number(prop.r ?? prop.y)))
    .map((prop, index) => normalizeBattlefieldProp(prop, { id: prop.id || `map-prop-${index}` }));
}

export function createBattlefieldEnvironment(environment = {}, map = {}) {
  const lighting = normalizeBattlefieldLighting(
    environment.lighting || map.lighting || BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT,
  );
  const fogType = normalizeEnvironmentalFog(
    environment.environmentalFog || environment.fog || map.environmentalFog || map.fog,
  );
  const fogProfile = ENVIRONMENTAL_FOG_PROFILES[fogType];
  const fogDensity = Math.max(0, Math.min(1, toFinite(
    environment.fogDensity ?? map.fogDensity,
    fogType === BATTLEFIELD_FOG.CLEAR ? 0 : fogType === BATTLEFIELD_FOG.MIST ? 0.3 : fogType === BATTLEFIELD_FOG.FOG ? 0.6 : 0.9,
  )));
  const fogOfWarSource = environment.fogOfWar || map.fogOfWar || {};

  return {
    lighting,
    environmentalFog: {
      type: fogType,
      density: fogDensity,
      visibilityMultiplier: fogProfile.visibilityMultiplier,
      maximumVisualRangeFeet: fogProfile.maximumVisualRangeFeet,
      concealment: fogProfile.concealment,
    },
    fogOfWar: {
      enabled: Boolean(fogOfWarSource.enabled ?? map.fogOfWarEnabled ?? false),
      teamScoped: fogOfWarSource.teamScoped !== false,
      rememberExplored: fogOfWarSource.rememberExplored !== false,
      rememberLastKnownEnemies: fogOfWarSource.rememberLastKnownEnemies !== false,
    },
    weather: {
      precipitation: normalizeText(environment.weather?.precipitation || environment.precipitation || "none") || "none",
      wind: normalizeText(environment.weather?.wind || environment.wind || "calm") || "calm",
    },
  };
}

export function normalizeBattlefieldMap(map = {}, options = {}) {
  const source = options.source || map.source || BATTLEFIELD_MAP_SOURCES.SAVED;
  const size = inferSize(map);
  const baseTerrainRaw = map.baseTerrain || map.terrain || map.theme?.defaultTerrain || "OPEN_GROUND";
  const baseTerrain = normalizeVisualTerrainKey(baseTerrainRaw);
  const formationType = normalizeFormationTerrainKey(baseTerrainRaw);
  const grid = normalizeGrid(map, size, baseTerrain);
  const environment = createBattlefieldEnvironment(map.environment || {}, map);
  const generator = map.generator && typeof map.generator === "object"
    ? {
        version: Math.max(1, Math.floor(toFinite(map.generator.version ?? map.generator.generatorVersion, BATTLEFIELD_GENERATOR_VERSION))),
        seed: String(map.generator.seed ?? ""),
        environmentSeed: String(map.generator.environmentSeed ?? map.generator.seed ?? ""),
        preset: String(map.generator.preset || "custom"),
        balanceMode: String(map.generator.balanceMode || "natural"),
        settings: { ...(map.generator.settings || {}) },
      }
    : null;

  const id = String(map.id || options.id || `battlefield-${Date.now()}`);
  const name = String(map.name || map.description || options.name || "Untitled Battlefield");

  return {
    ...map,
    id,
    name,
    description: String(map.description || name),
    schemaVersion: BATTLEFIELD_MAP_SCHEMA_VERSION,
    version: Math.max(1, Math.floor(toFinite(map.version, 1))),
    source,
    mapType: normalizeText(map.mapType) === "square" ? "square" : "hex",
    baseTerrain,
    formationType,
    terrain: baseTerrain,
    size,
    mapSize: { ...size },
    width: size.width,
    height: size.height,
    grid,
    props: normalizeProps(map.props),
    spawnZones: Array.isArray(map.spawnZones) ? map.spawnZones.map((zone) => ({ ...zone })) : [],
    environment,
    // Compatibility mirrors used by existing Scene Setup / CombatPage readers.
    lighting: environment.lighting,
    environmentalFog: environment.environmentalFog,
    fogOfWar: environment.fogOfWar,
    fogOfWarEnabled: environment.fogOfWar.enabled,
    generator,
    metadata: {
      ...(map.metadata || {}),
      migratedFromSchemaVersion: Number(map.schemaVersion) || 1,
      normalizedAt: options.normalizedAt || null,
    },
  };
}

export function validateBattlefieldMap(map = {}) {
  const normalized = normalizeBattlefieldMap(map);
  const failures = [];
  if (!normalized.id) failures.push("missing-id");
  if (!normalized.name) failures.push("missing-name");
  if (!Array.isArray(normalized.grid) || normalized.grid.length !== normalized.height) failures.push("grid-height-mismatch");
  if (normalized.grid.some((row) => !Array.isArray(row) || row.length !== normalized.width)) failures.push("grid-width-mismatch");
  if (!["hex", "square"].includes(normalized.mapType)) failures.push("invalid-map-type");
  if (!Object.values(BATTLEFIELD_LIGHTING).includes(normalized.environment.lighting)) failures.push("invalid-lighting");
  if (!Object.values(BATTLEFIELD_FOG).includes(normalized.environment.environmentalFog.type)) failures.push("invalid-environmental-fog");
  return {
    valid: failures.length === 0,
    failures,
    map: normalized,
  };
}

export function getBattlefieldVisibilityEnvironment(map = {}) {
  const normalized = normalizeBattlefieldMap(map);
  return {
    lighting: normalized.environment.lighting,
    environmentalFog: { ...normalized.environment.environmentalFog },
    fogOfWar: { ...normalized.environment.fogOfWar },
  };
}

export default normalizeBattlefieldMap;

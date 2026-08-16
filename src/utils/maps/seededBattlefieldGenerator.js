import {
  BATTLEFIELD_PRESET_ART_VERSION,
  applyBattlefieldPresetArtPass,
} from "./battlefieldPresetArtPass.js";
import {
  BATTLEFIELD_FOG,
  BATTLEFIELD_GENERATOR_VERSION,
  BATTLEFIELD_LIGHTING,
  BATTLEFIELD_MAP_SOURCES,
  normalizeBattlefieldMap,
} from "./battlefieldMapAuthority.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

export const BATTLEFIELD_GENERATOR_PRESETS = Object.freeze({
  "open-field": Object.freeze({ label: "Open Field", forest: 0.08, mud: 0.05, rough: 0.08, water: 0, elevation: 0.25, rubble: 0.01 }),
  "mixed-wilderness": Object.freeze({ label: "Mixed Wilderness", forest: 0.32, mud: 0.13, rough: 0.18, water: 0.03, elevation: 0.45, rubble: 0.03 }),
  "dense-forest": Object.freeze({ label: "Dense Forest", forest: 0.68, mud: 0.09, rough: 0.12, water: 0.02, elevation: 0.35, rubble: 0.01 }),
  "rocky-highlands": Object.freeze({ label: "Rocky Highlands", forest: 0.12, mud: 0.03, rough: 0.58, water: 0.01, elevation: 0.78, rubble: 0.12 }),
  marsh: Object.freeze({ label: "Marsh", forest: 0.18, mud: 0.58, rough: 0.06, water: 0.16, elevation: 0.12, rubble: 0.01 }),
  "river-crossing": Object.freeze({ label: "River Crossing", forest: 0.22, mud: 0.16, rough: 0.12, water: 0.08, elevation: 0.28, rubble: 0.02, river: true }),
  "mountain-pass": Object.freeze({ label: "Mountain Pass", forest: 0.1, mud: 0.03, rough: 0.62, water: 0, elevation: 0.9, rubble: 0.16, pass: true }),
  "ruined-village": Object.freeze({ label: "Ruined Village", forest: 0.08, mud: 0.08, rough: 0.12, water: 0, elevation: 0.18, rubble: 0.35, ruins: true }),
  "rolling-hills": Object.freeze({ label: "Rolling Hills", forest: 0.18, mud: 0.05, rough: 0.15, water: 0, elevation: 0.68, rubble: 0.02 }),
  "hilltop-defense": Object.freeze({ label: "Hilltop Defense", forest: 0.08, mud: 0.03, rough: 0.24, water: 0, elevation: 0.78, rubble: 0.05 }),
  "muddy-battlefield": Object.freeze({ label: "Muddy Battlefield", forest: 0.05, mud: 0.52, rough: 0.18, water: 0.03, elevation: 0.2, rubble: 0.12 }),
});

function fnv1a32(value) {
  const text = String(value ?? "");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mix32(value) {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function hashCoordinate(seed32, x, y, channel = 0) {
  let hash = seed32 ^ Math.imul((x + 0x9e3779b9) | 0, 0x85ebca6b);
  hash ^= Math.imul((y + 0x7f4a7c15) | 0, 0xc2b2ae35);
  hash ^= Math.imul(channel + 1, 0x27d4eb2d);
  return mix32(hash >>> 0) / 0xffffffff;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(seed32, x, y, scale, channel) {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const tx = smoothstep(sx - x0);
  const ty = smoothstep(sy - y0);
  const a = hashCoordinate(seed32, x0, y0, channel);
  const b = hashCoordinate(seed32, x0 + 1, y0, channel);
  const c = hashCoordinate(seed32, x0, y0 + 1, channel);
  const d = hashCoordinate(seed32, x0 + 1, y0 + 1, channel);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

function fbm(seed32, x, y, channel) {
  const scales = [18, 9, 4.5, 2.25];
  const weights = [0.5, 0.27, 0.15, 0.08];
  return scales.reduce((sum, scale, index) => sum + valueNoise(seed32, x, y, scale, channel + index * 17) * weights[index], 0);
}

export function createSeededRandom(seed) {
  let state = fnv1a32(seed) || 0x6d2b79f5;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      const lower = Math.ceil(Math.min(min, max));
      const upper = Math.floor(Math.max(min, max));
      return lower + Math.floor(this.next() * (upper - lower + 1));
    },
    pick(items) {
      if (!Array.isArray(items) || items.length === 0) return null;
      return items[Math.floor(this.next() * items.length)];
    },
  };
}

export function createRandomBattlefieldSeed() {
  const cryptoObject = globalThis?.crypto;
  if (cryptoObject?.getRandomValues) {
    const values = new Uint32Array(2);
    cryptoObject.getRandomValues(values);
    return `${values[0].toString(36)}-${values[1].toString(36)}`;
  }
  return `seed-${Date.now().toString(36)}`;
}

function oddRNeighbors(x, y, width, height) {
  const odd = y & 1;
  const offsets = odd
    ? [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]]
    : [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
  return offsets
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .filter((point) => point.x >= 0 && point.x < width && point.y >= 0 && point.y < height);
}

function cellWalkable(cell) {
  return cell?.walkable !== false && cell?.isWalkable !== false && cell?.formationType !== "deep-water";
}

function terrainForNoise({ profile, elevation, moisture, roughness, detail, x, y, width, height }) {
  const edgeBias = Math.min(x, width - 1 - x) / Math.max(1, width * 0.15);
  const safeEdge = clamp(edgeBias, 0, 1);

  const waterDetailThreshold = clamp(0.04 + profile.water * 2.2, 0.04, 0.65);
  if (profile.water > 0 && moisture > 0.76 - profile.water * 0.4 && elevation < 0.42 && detail < waterDetailThreshold) return "water";
  const mudDetailThreshold = clamp(0.02 + profile.mud * 1.5, 0.02, 0.9);
  if (profile.mud > 0 && moisture > 0.62 - profile.mud * 0.35 && elevation < 0.62 && detail < mudDetailThreshold) return "mud";
  if (profile.rubble > 0 && roughness > 0.72 - profile.rubble * 0.35 && detail > 0.92 - profile.rubble * 0.7) return "rubble";
  if (profile.rough > 0 && roughness > 0.62 - profile.rough * 0.38 && detail > 0.9 - profile.rough * 0.75) return "rock";
  const forestDetailThreshold = clamp(0.04 + profile.forest * 1.3, 0.04, 0.95);
  if (profile.forest > 0 && moisture > 0.56 - profile.forest * 0.25 && detail < forestDetailThreshold && safeEdge > 0.15) return "forest";
  if (profile.elevation > 0 && elevation > 0.66 - profile.elevation * 0.28 && detail > 0.6 - profile.elevation * 0.2) return "hill";
  return "grass";
}

function formationTypeForVisual(terrain, elevation) {
  if (terrain === "water") return "deep-water";
  if (terrain === "mud") return "mud";
  if (terrain === "rubble") return "rubble";
  if (terrain === "rock") return "uneven-ground";
  if (terrain === "forest") return "forest";
  if (terrain === "narrow-passage") return "narrow-passage";
  if (terrain === "hill") return "elevated-ground";
  if (elevation >= 2) return "elevated-ground";
  return "open-ground";
}

function createCell(seed32, x, y, width, height, profile) {
  const elevationNoise = fbm(seed32, x, y, 100);
  const moistureNoise = fbm(seed32, x + 73, y - 31, 300);
  const roughnessNoise = fbm(seed32, x - 57, y + 91, 500);
  const detail = hashCoordinate(seed32, x, y, 900);
  const terrain = terrainForNoise({
    profile,
    elevation: elevationNoise,
    moisture: moistureNoise,
    roughness: roughnessNoise,
    detail,
    x,
    y,
    width,
    height,
  });
  const elevationScale = profile.elevation || 0;
  const elevation = clamp(Math.round((elevationNoise - 0.45) * 5 * elevationScale), -1, 3);
  const formationType = formationTypeForVisual(terrain, elevation);
  const walkable = formationType !== "deep-water";
  return {
    x,
    y,
    terrain,
    terrainType: terrain,
    visualTerrain: terrain,
    formationType,
    combatTerrainType: formationType,
    elevation,
    height: elevation,
    walkable,
    isWalkable: walkable,
    cover: terrain === "forest" ? 1 : terrain === "rubble" || terrain === "rock" ? 1 : 0,
    blocksLineOfSight: false,
  };
}

function addRiverCrossing(grid, seed32) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  if (!height || !width) return;
  const rng = createSeededRandom(`${seed32}:river`);
  const horizontal = width >= height;
  const bridgeIndex = horizontal ? rng.int(Math.floor(width * 0.35), Math.floor(width * 0.65)) : rng.int(Math.floor(height * 0.35), Math.floor(height * 0.65));
  if (horizontal) {
    let y = rng.int(Math.floor(height * 0.3), Math.floor(height * 0.7));
    for (let x = 0; x < width; x += 1) {
      y = clamp(y + rng.pick([-1, 0, 0, 0, 1]), 1, height - 2);
      grid[y][x] = {
        ...grid[y][x],
        terrain: x === bridgeIndex ? "road" : "water",
        terrainType: x === bridgeIndex ? "road" : "water",
        formationType: x === bridgeIndex ? "narrow-passage" : "deep-water",
        combatTerrainType: x === bridgeIndex ? "narrow-passage" : "deep-water",
        walkable: x === bridgeIndex,
        isWalkable: x === bridgeIndex,
      };
    }
  } else {
    let x = rng.int(Math.floor(width * 0.3), Math.floor(width * 0.7));
    for (let y = 0; y < height; y += 1) {
      x = clamp(x + rng.pick([-1, 0, 0, 0, 1]), 1, width - 2);
      grid[y][x] = {
        ...grid[y][x],
        terrain: y === bridgeIndex ? "road" : "water",
        terrainType: y === bridgeIndex ? "road" : "water",
        formationType: y === bridgeIndex ? "narrow-passage" : "deep-water",
        combatTerrainType: y === bridgeIndex ? "narrow-passage" : "deep-water",
        walkable: y === bridgeIndex,
        isWalkable: y === bridgeIndex,
      };
    }
  }
}

function addMountainPass(grid, seed32) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  if (!height || !width) return;
  const rng = createSeededRandom(`${seed32}:pass`);
  let center = Math.floor(height / 2);
  for (let x = 0; x < width; x += 1) {
    center = clamp(center + rng.pick([-1, 0, 0, 1]), 2, height - 3);
    for (let y = 0; y < height; y += 1) {
      const distance = Math.abs(y - center);
      if (distance <= 1) {
        grid[y][x] = {
          ...grid[y][x],
          terrain: "road",
          terrainType: "road",
          formationType: distance === 0 ? "narrow-passage" : "uneven-ground",
          combatTerrainType: distance === 0 ? "narrow-passage" : "uneven-ground",
          walkable: true,
          isWalkable: true,
          elevation: Math.min(grid[y][x].elevation, 1),
          height: Math.min(grid[y][x].height, 1),
        };
      } else if (distance >= 4) {
        grid[y][x] = {
          ...grid[y][x],
          terrain: "rock",
          terrainType: "rock",
          formationType: "stone-wall",
          combatTerrainType: "stone-wall",
          walkable: false,
          isWalkable: false,
          elevation: Math.max(2, grid[y][x].elevation),
          height: Math.max(2, grid[y][x].height),
        };
      }
    }
  }
}

function addRuinedVillage(grid, seed32, props) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const rng = createSeededRandom(`${seed32}:ruins`);
  const centerY = Math.floor(height / 2);
  for (let x = 0; x < width; x += 1) {
    const roadY = clamp(centerY + Math.round(Math.sin(x / 5) * 1.5), 0, height - 1);
    grid[roadY][x] = {
      ...grid[roadY][x],
      terrain: "road",
      terrainType: "road",
      formationType: "open-ground",
      combatTerrainType: "open-ground",
      walkable: true,
      isWalkable: true,
    };
  }
  const ruinCount = clamp(Math.floor((width * height) / 140), 4, 18);
  for (let index = 0; index < ruinCount; index += 1) {
    const x = rng.int(4, Math.max(4, width - 5));
    const y = rng.int(3, Math.max(3, height - 4));
    if (Math.abs(y - centerY) <= 2) continue;
    grid[y][x] = {
      ...grid[y][x],
      terrain: "rubble",
      terrainType: "rubble",
      formationType: "rubble",
      combatTerrainType: "rubble",
      walkable: true,
      isWalkable: true,
      cover: 1,
    };
    props.push({
      id: `ruin-${index}`,
      type: "ruin",
      name: "Ruined wall",
      q: x,
      r: y,
      x,
      y,
      coordinateSpace: "offset",
      rotation: rng.int(0, 5) * 60,
      scale: 1,
      blocksMovement: rng.next() > 0.55,
      blocksLineOfSight: true,
    });
  }
}

function addTerrainProps(grid, seed32, props) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = grid[y][x];
      if (cell?.suppressGenericTerrainProp === true) continue;
      const roll = hashCoordinate(seed32, x, y, 1300);
      if (cell.terrain === "forest" && roll > 0.76) {
        props.push({ id: `tree-${x}-${y}`, type: "tree", name: "Tree", q: x, r: y, x, y, coordinateSpace: "offset", rotation: Math.floor(roll * 6) * 60, scale: 0.9 + roll * 0.3, blocksMovement: roll > 0.93, blocksLineOfSight: true });
      } else if ((cell.terrain === "rock" || cell.terrain === "rubble") && roll > 0.91) {
        props.push({ id: `boulder-${x}-${y}`, type: "boulder", name: "Boulder", q: x, r: y, x, y, coordinateSpace: "offset", rotation: Math.floor(roll * 6) * 60, scale: 0.8 + roll * 0.4, blocksMovement: true, blocksLineOfSight: true });
      }
    }
  }
}

function mirrorGrid(grid) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < Math.floor(width / 2); x += 1) {
      const mirrorX = width - 1 - x;
      grid[y][mirrorX] = { ...grid[y][x], x: mirrorX, y };
    }
  }
}

function deploymentZones(width, height) {
  return [
    {
      id: "party-deployment",
      team: "party",
      label: "Party Deployment",
      cells: Array.from({ length: height }, (_, y) => Array.from({ length: Math.min(3, width) }, (_, x) => ({ x, y }))).flat(),
    },
    {
      id: "enemy-deployment",
      team: "enemy",
      label: "Enemy Deployment",
      cells: Array.from({ length: height }, (_, y) => Array.from({ length: Math.min(3, width) }, (_, offset) => ({ x: width - 1 - offset, y }))).flat(),
    },
  ];
}

function ensureDeploymentEdges(grid) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  for (let y = 0; y < height; y += 1) {
    for (const x of [0, 1, 2, width - 3, width - 2, width - 1]) {
      if (x < 0 || x >= width) continue;
      if (!cellWalkable(grid[y][x])) {
        grid[y][x] = {
          ...grid[y][x],
          terrain: "grass",
          terrainType: "grass",
          formationType: "open-ground",
          combatTerrainType: "open-ground",
          walkable: true,
          isWalkable: true,
        };
      }
    }
  }
}

function hasCrossMapRoute(grid) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  if (!height || !width) return false;
  const queue = [];
  const visited = new Set();
  for (let y = 0; y < height; y += 1) {
    if (cellWalkable(grid[y][0])) {
      queue.push({ x: 0, y });
      visited.add(`0,${y}`);
    }
  }
  while (queue.length) {
    const current = queue.shift();
    if (current.x === width - 1) return true;
    for (const next of oddRNeighbors(current.x, current.y, width, height)) {
      const key = `${next.x},${next.y}`;
      if (visited.has(key) || !cellWalkable(grid[next.y][next.x])) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

function carveFallbackRoute(grid) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  let y = Math.floor(height / 2);
  for (let x = 0; x < width; x += 1) {
    grid[y][x] = {
      ...grid[y][x],
      terrain: "road",
      terrainType: "road",
      formationType: "open-ground",
      combatTerrainType: "open-ground",
      walkable: true,
      isWalkable: true,
      cover: 0,
    };
  }
}

function resolveGeneratedEnvironment(seed, options = {}) {
  const rng = createSeededRandom(options.environmentSeed || `${seed}:environment`);
  const randomize = options.randomizeEnvironment === true;
  const lighting = options.lighting || (randomize
    ? rng.pick([
        BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT,
        BATTLEFIELD_LIGHTING.DAYLIGHT,
        BATTLEFIELD_LIGHTING.DUSK,
        BATTLEFIELD_LIGHTING.MOONLIGHT,
        BATTLEFIELD_LIGHTING.DARKNESS,
      ])
    : BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT);
  const fogType = options.environmentalFog || (randomize
    ? rng.pick([BATTLEFIELD_FOG.CLEAR, BATTLEFIELD_FOG.CLEAR, BATTLEFIELD_FOG.MIST, BATTLEFIELD_FOG.FOG])
    : BATTLEFIELD_FOG.CLEAR);
  return {
    lighting,
    environmentalFog: {
      type: fogType,
      density: fogType === BATTLEFIELD_FOG.CLEAR ? 0 : fogType === BATTLEFIELD_FOG.MIST ? 0.3 : fogType === BATTLEFIELD_FOG.FOG ? 0.6 : 0.9,
    },
    fogOfWar: {
      enabled: options.fogOfWarEnabled === true,
      teamScoped: true,
      rememberExplored: true,
      rememberLastKnownEnemies: true,
    },
    weather: {
      precipitation: randomize ? rng.pick(["none", "none", "light-rain", "rain"]) : "none",
      wind: randomize ? rng.pick(["calm", "light", "moderate"]) : "calm",
    },
  };
}

export function generateSeededBattlefield(options = {}) {
  const seed = String(options.seed || createRandomBattlefieldSeed());
  const presetKey = normalizeText(options.preset || "mixed-wilderness");
  const profile = BATTLEFIELD_GENERATOR_PRESETS[presetKey] || BATTLEFIELD_GENERATOR_PRESETS["mixed-wilderness"];
  const width = clamp(Math.floor(Number(options.width) || 40), 10, 200);
  const height = clamp(Math.floor(Number(options.height) || 30), 10, 200);
  const mapType = normalizeText(options.mapType) === "square" ? "square" : "hex";
  const balanceMode = normalizeText(options.balanceMode || "natural");
  const seed32 = fnv1a32(seed);
  const grid = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => createCell(seed32, x, y, width, height, profile)));
  const props = [];

  if (profile.river) addRiverCrossing(grid, seed32);
  if (profile.pass) addMountainPass(grid, seed32);
  if (profile.ruins) addRuinedVillage(grid, seed32, props);

  const presetArt = applyBattlefieldPresetArtPass({
    presetKey,
    grid,
    props,
    seed,
  });
  if (balanceMode === "mirrored") mirrorGrid(grid);

  ensureDeploymentEdges(grid);
  if (!hasCrossMapRoute(grid)) carveFallbackRoute(grid);
  addTerrainProps(grid, seed32, props);

  const environmentSeed = String(options.environmentSeed || `${seed}:environment`);
  const environment = resolveGeneratedEnvironment(seed, { ...options, environmentSeed });

  return normalizeBattlefieldMap({
    id: options.id || `generated-${fnv1a32(`${seed}:${presetKey}:${width}x${height}`).toString(36)}`,
    name: options.name || `${profile.label} — ${seed}`,
    description: options.description || `Seeded ${profile.label.toLowerCase()} battlefield`,
    source: BATTLEFIELD_MAP_SOURCES.GENERATED,
    mapType,
    baseTerrain: "grass",
    terrain: "grass",
    size: { width, height },
    mapSize: { width, height },
    width,
    height,
    grid,
    props,
    spawnZones: deploymentZones(width, height),
    environment,
    generator: {
      version: BATTLEFIELD_GENERATOR_VERSION,
      generatorVersion: BATTLEFIELD_GENERATOR_VERSION,
      seed,
      environmentSeed,
      preset: presetKey,
      balanceMode,
      presetArtVersion: BATTLEFIELD_PRESET_ART_VERSION,
      presetArt: presetArt || null,
      settings: {
        width,
        height,
        mapType,
        randomizeEnvironment: options.randomizeEnvironment === true,
      },
    },
  }, { source: BATTLEFIELD_MAP_SOURCES.GENERATED });
}

export function validateSeededBattlefield(map = {}) {
  const width = Number(map.width || map.size?.width || 0);
  const height = Number(map.height || map.size?.height || 0);
  const grid = map.grid;
  const failures = [];
  if (!Array.isArray(grid) || grid.length !== height) failures.push("grid-height-mismatch");
  if (Array.isArray(grid) && grid.some((row) => !Array.isArray(row) || row.length !== width)) failures.push("grid-width-mismatch");
  if (Array.isArray(grid) && !hasCrossMapRoute(grid)) failures.push("no-cross-map-route");
  const partyZone = map.spawnZones?.find((zone) => zone.team === "party");
  const enemyZone = map.spawnZones?.find((zone) => zone.team === "enemy");
  if (!partyZone?.cells?.length) failures.push("missing-party-deployment");
  if (!enemyZone?.cells?.length) failures.push("missing-enemy-deployment");
  return { valid: failures.length === 0, failures };
}

export default generateSeededBattlefield;

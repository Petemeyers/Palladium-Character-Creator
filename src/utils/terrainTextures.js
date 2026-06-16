export const TERRAIN_TEXTURE_REGISTRY = {
  grass: {
    texturePath: "/assets/textures/terrain/grass_tile.png",
    fallbackTexturePath: "/assets/textures/terrain/terrain-grass.svg",
    fallbackColor: "#62b947",
  },
  grassland: {
    texturePath: "/assets/textures/terrain/grass_tile.png",
    fallbackTexturePath: "/assets/textures/terrain/terrain-grass.svg",
    fallbackColor: "#62b947",
  },
  forest: {
    texturePath: "/assets/textures/terrain/terrain-forest.svg",
    fallbackColor: "#2f7d45",
  },
  water: {
    texturePath: "/assets/textures/terrain/terrain-water.svg",
    fallbackColor: "#1597d3",
  },
  rock: {
    texturePath: "/assets/textures/terrain/terrain-rock.svg",
    fallbackColor: "#737373",
  },
  stone: {
    texturePath: "/assets/textures/terrain/terrain-stone.svg",
    fallbackColor: "#8a8f98",
  },
  sand: {
    texturePath: "/assets/textures/terrain/terrain-sand.svg",
    fallbackColor: "#d8b866",
  },
  dirt: {
    texturePath: "/assets/textures/terrain/terrain-dirt.svg",
    fallbackColor: "#9a6a3a",
  },
  road: {
    texturePath: "/assets/textures/terrain/terrain-road.svg",
    fallbackColor: "#8a6a45",
  },
};

const TERRAIN_ALIASES = {
  default: "grass",
  open: "grass",
  open_ground: "grass",
  light_forest: "forest",
  dense_forest: "forest",
  forest_light: "forest",
  forest_dense: "forest",
  rocky_terrain: "rock",
  rocky: "rock",
  mountain: "rock",
  cave: "stone",
  cave_interior: "stone",
  interior: "stone",
  urban: "road",
  city: "road",
  swamp: "water",
  swamp_marsh: "water",
  marsh: "water",
  deep_water: "water",
  desert: "sand",
  mud: "dirt",
  hill: "rock",
};

export function normalizeTerrainTextureKey(raw = "grass") {
  const key = String(raw || "grass")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (TERRAIN_TEXTURE_REGISTRY[key]) return key;
  if (TERRAIN_ALIASES[key]) return TERRAIN_ALIASES[key];
  if (key.includes("forest")) return "forest";
  if (key.includes("water") || key.includes("swamp") || key.includes("marsh")) return "water";
  if (key.includes("stone") || key.includes("cave") || key.includes("interior")) return "stone";
  if (key.includes("rock") || key.includes("mountain") || key.includes("ruins")) return "rock";
  if (key.includes("sand") || key.includes("desert")) return "sand";
  if (key.includes("dirt") || key.includes("mud")) return "dirt";
  if (key.includes("road") || key.includes("urban") || key.includes("city")) return "road";
  return "grass";
}

export function getTerrainTextureEntry(raw) {
  const key = normalizeTerrainTextureKey(raw);
  return TERRAIN_TEXTURE_REGISTRY[key] || TERRAIN_TEXTURE_REGISTRY.grass;
}

export function getTerrainTexturePath(raw) {
  return getTerrainTextureEntry(raw).texturePath;
}

export function getTerrainFallbackColor(raw) {
  return getTerrainTextureEntry(raw).fallbackColor;
}

export function getTerrainTextureMap() {
  return Object.fromEntries(
    Object.entries(TERRAIN_TEXTURE_REGISTRY).map(([key, entry]) => [key, entry.texturePath])
  );
}

export function getTerrainColorMap() {
  return Object.fromEntries(
    Object.entries(TERRAIN_TEXTURE_REGISTRY).map(([key, entry]) => [key, entry.fallbackColor])
  );
}

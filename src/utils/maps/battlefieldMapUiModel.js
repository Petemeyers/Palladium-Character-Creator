import {
  BATTLEFIELD_FOG,
  BATTLEFIELD_LIGHTING,
  BATTLEFIELD_MAP_SOURCES,
  normalizeBattlefieldLighting,
  normalizeBattlefieldMap,
  normalizeEnvironmentalFog,
} from "./battlefieldMapAuthority.js";

const SOURCE_LABELS = Object.freeze({
  [BATTLEFIELD_MAP_SOURCES.BUILT_IN]: "Built-in",
  [BATTLEFIELD_MAP_SOURCES.SAVED]: "Saved",
  [BATTLEFIELD_MAP_SOURCES.GENERATED]: "Generated",
  [BATTLEFIELD_MAP_SOURCES.IMPORTED]: "Imported",
});

export const LIGHTING_LABELS = Object.freeze({
  [BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT]: "Bright Daylight",
  [BATTLEFIELD_LIGHTING.DAYLIGHT]: "Daylight",
  [BATTLEFIELD_LIGHTING.DUSK]: "Dusk / Dawn",
  [BATTLEFIELD_LIGHTING.MOONLIGHT]: "Moonlight",
  [BATTLEFIELD_LIGHTING.TORCHLIGHT]: "Torchlight",
  [BATTLEFIELD_LIGHTING.DARKNESS]: "Darkness",
});

export const FOG_LABELS = Object.freeze({
  [BATTLEFIELD_FOG.CLEAR]: "Clear",
  [BATTLEFIELD_FOG.MIST]: "Light Mist",
  [BATTLEFIELD_FOG.FOG]: "Fog",
  [BATTLEFIELD_FOG.DENSE_FOG]: "Dense Fog",
});

export function describeBattlefieldMap(map) {
  const normalized = normalizeBattlefieldMap(map);
  const fog = normalized.environment?.environmentalFog?.type || BATTLEFIELD_FOG.CLEAR;
  const generator = normalized.generator;
  return {
    id: normalized.id,
    name: normalized.name,
    source: normalized.source,
    sourceLabel: SOURCE_LABELS[normalized.source] || "Map",
    sizeLabel: `${normalized.width} × ${normalized.height}`,
    mapTypeLabel: normalized.mapType === "square" ? "Square" : "Hex",
    lighting: normalized.environment.lighting,
    lightingLabel: LIGHTING_LABELS[normalized.environment.lighting] || normalized.environment.lighting,
    fog,
    fogLabel: FOG_LABELS[fog] || fog,
    fogOfWarEnabled: normalized.environment?.fogOfWar?.enabled === true,
    seed: generator?.seed || null,
    preset: generator?.preset || null,
    generated: normalized.source === BATTLEFIELD_MAP_SOURCES.GENERATED || Boolean(generator),
  };
}

export function groupBattlefieldLibraryEntries(entries = []) {
  const groups = {
    builtIn: [],
    saved: [],
    generated: [],
    imported: [],
  };
  for (const entry of Array.isArray(entries) ? entries : []) {
    const map = entry?.mapDefinition || entry;
    if (!map) continue;
    const normalized = normalizeBattlefieldMap(map);
    const card = {
      entryId: String(entry?.id || normalized.id),
      savedAt: entry?.savedAt || null,
      thumbnail: entry?.thumbnail || null,
      map: normalized,
      ...describeBattlefieldMap(normalized),
    };
    if (normalized.source === BATTLEFIELD_MAP_SOURCES.BUILT_IN) groups.builtIn.push(card);
    else if (normalized.source === BATTLEFIELD_MAP_SOURCES.GENERATED) groups.generated.push(card);
    else if (normalized.source === BATTLEFIELD_MAP_SOURCES.IMPORTED) groups.imported.push(card);
    else groups.saved.push(card);
  }
  for (const group of Object.values(groups)) {
    group.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }
  return groups;
}

export function applyBattlefieldEnvironmentOverrides(map, overrides = {}) {
  const normalized = normalizeBattlefieldMap(map);
  const lighting = overrides.useMapLighting === false
    ? normalizeBattlefieldLighting(overrides.lighting)
    : normalizeBattlefieldLighting(overrides.lighting || normalized.environment.lighting);
  const fogType = overrides.useMapFog === false
    ? normalizeEnvironmentalFog(overrides.environmentalFog)
    : normalizeEnvironmentalFog(overrides.environmentalFog || normalized.environment.environmentalFog);
  const fogOfWarEnabled = overrides.fogOfWarEnabled == null
    ? normalized.environment.fogOfWar.enabled
    : Boolean(overrides.fogOfWarEnabled);

  return normalizeBattlefieldMap({
    ...normalized,
    environment: {
      ...normalized.environment,
      lighting,
      environmentalFog: {
        ...normalized.environment.environmentalFog,
        type: fogType,
      },
      fogOfWar: {
        ...normalized.environment.fogOfWar,
        enabled: fogOfWarEnabled,
      },
    },
    lighting,
    environmentalFog: fogType,
    fogOfWarEnabled,
  }, { source: normalized.source });
}

export function createSceneBattlefieldSelection({
  map = null,
  fallbackTerrain = "OPEN_GROUND",
  fallbackLighting = BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT,
  fallbackMapType = "hex",
  environmentalFog = BATTLEFIELD_FOG.CLEAR,
  fogOfWarEnabled = false,
} = {}) {
  if (!map) {
    return {
      mode: "default-arena",
      map: null,
      terrain: fallbackTerrain,
      lighting: normalizeBattlefieldLighting(fallbackLighting),
      mapType: fallbackMapType === "square" ? "square" : "hex",
      environmentalFog: normalizeEnvironmentalFog(environmentalFog),
      fogOfWarEnabled: Boolean(fogOfWarEnabled),
    };
  }
  const normalized = applyBattlefieldEnvironmentOverrides(map, {
    lighting: fallbackLighting || map?.environment?.lighting,
    environmentalFog: environmentalFog || map?.environment?.environmentalFog,
    fogOfWarEnabled,
  });
  return {
    mode: "saved-map",
    map: normalized,
    terrain: normalized.baseTerrain,
    lighting: normalized.environment.lighting,
    mapType: normalized.mapType,
    environmentalFog: normalized.environment.environmentalFog.type,
    fogOfWarEnabled: normalized.environment.fogOfWar.enabled,
  };
}

export function getLegacySceneTerrainKey(mapOrTerrain) {
  const raw = typeof mapOrTerrain === "string"
    ? mapOrTerrain
    : mapOrTerrain?.baseTerrain || mapOrTerrain?.terrain || mapOrTerrain?.formationType || "grass";
  const key = String(raw || "grass").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (/dense.*forest/.test(key)) return "DENSE_FOREST";
  if (/forest|wood/.test(key)) return "LIGHT_FOREST";
  if (/mud|marsh|swamp|bog|water/.test(key)) return "SWAMP_MARSH";
  if (/rock|rubble|hill|uneven|elevated|ridge/.test(key)) return "ROCKY_TERRAIN";
  if (/road|urban|village|city/.test(key)) return "URBAN";
  if (/cave/.test(key)) return "CAVE_INTERIOR";
  return "OPEN_GROUND";
}

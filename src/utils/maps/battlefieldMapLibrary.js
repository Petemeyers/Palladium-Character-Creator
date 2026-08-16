import { createBattlefieldThumbnailDataUri } from "./battlefieldThumbnail.js";
import {
  BATTLEFIELD_MAP_SCHEMA_VERSION,
  BATTLEFIELD_MAP_SOURCES,
  normalizeBattlefieldMap,
} from "./battlefieldMapAuthority.js";

export const BATTLEFIELD_MAP_LIBRARY_KEY = "battlefieldMaps.v2";
export const LEGACY_MAP_MAKER_KEY = "mapMaker.savedMaps.v1";

const safeParse = (value, fallback = []) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const storageOrNull = (storage) => storage || globalThis?.localStorage || null;

const isBuiltInIdentity = (entryOrMap = {}) => {
  const id = String(entryOrMap?.id || entryOrMap?.mapDefinition?.id || "");
  const source = String(entryOrMap?.source || entryOrMap?.mapDefinition?.source || "");
  return source === BATTLEFIELD_MAP_SOURCES.BUILT_IN || id.startsWith("builtin-");
};

function stableSavedForkId(map = {}, suffix = "") {
  const raw = String(map?.id || "battlefield")
    .replace(/^builtin-/, "")
    .replace(/[^a-z0-9-]+/gi, "-");
  const stamp = String(map?.metadata?.savedForkId || map?.savedAt || suffix || Date.now())
    .replace(/[^a-z0-9]+/gi, "")
    .slice(-18);
  return `saved-${raw || "battlefield"}-${stamp || "copy"}`;
}

export function prepareBattlefieldMapForSave(map = {}, options = {}) {
  const normalized = normalizeBattlefieldMap(map, {
    source: BATTLEFIELD_MAP_SOURCES.SAVED,
  });
  if (!isBuiltInIdentity(map) && !String(normalized.id).startsWith("builtin-")) {
    return normalizeBattlefieldMap(
      { ...normalized, source: BATTLEFIELD_MAP_SOURCES.SAVED },
      { source: BATTLEFIELD_MAP_SOURCES.SAVED },
    );
  }
  const id = stableSavedForkId(map, options.suffix);
  return normalizeBattlefieldMap({
    ...normalized,
    id,
    name: String(options.name || normalized.name || "Battlefield"),
    source: BATTLEFIELD_MAP_SOURCES.SAVED,
    metadata: {
      ...(normalized.metadata || {}),
      forkedFromBuiltInId: String(map?.id || normalized.id || ""),
      savedForkId: id,
    },
  }, { source: BATTLEFIELD_MAP_SOURCES.SAVED });
}


export function createBattlefieldMapLibraryEntry(map, options = {}) {
  const normalized = normalizeBattlefieldMap(map, {
    source: options.source || map?.source || BATTLEFIELD_MAP_SOURCES.SAVED,
  });
  return {
    id: String(options.entryId || normalized.id),
    name: normalized.name,
    savedAt: options.savedAt || new Date().toISOString(),
    schemaVersion: BATTLEFIELD_MAP_SCHEMA_VERSION,
    source: normalized.source,
    thumbnail: options.thumbnail || map?.thumbnail || createBattlefieldThumbnailDataUri(normalized),
    mapDefinition: normalized,
  };
}

function migrateLegacyEntry(entry, index = 0, options = {}) {
  const map = entry?.mapDefinition || entry?.map || entry;
  if (!map || typeof map !== "object") return null;
  // MapMaker v1 stored prop q/r in axial coordinates. Mark that explicitly
  // during migration so live LOS does not confuse them with generated offset q/r.
  const generatedCoordinateCompatibility = Boolean(map.generator) || ["generated", "built-in"].includes(String(map.source || "").toLowerCase());
  const mapMakerCoordinateCompatibility = options.legacyMapMaker || (String(map.source || "").toLowerCase() === "saved" && !map.generator);
  const preparedMap = {
    ...map,
    props: Array.isArray(map.props)
      ? map.props.map((prop) => ({
          ...prop,
          coordinateSpace: prop?.coordinateSpace || (generatedCoordinateCompatibility ? "offset" : mapMakerCoordinateCompatibility ? "axial" : "compatibility"),
        }))
      : map.props,
  };
  const normalized = normalizeBattlefieldMap(preparedMap, {
    id: entry?.id || map.id || `legacy-map-${index}`,
    name: entry?.name || map.name || map.description || `Legacy Map ${index + 1}`,
    source: BATTLEFIELD_MAP_SOURCES.SAVED,
  });
  return createBattlefieldMapLibraryEntry(normalized, {
    entryId: entry?.id || normalized.id,
    savedAt: entry?.savedAt || null,
    thumbnail: entry?.thumbnail || null,
  });
}

export function loadBattlefieldMapLibrary({ storage = null, builtInMaps = [] } = {}) {
  const store = storageOrNull(storage);
  const currentRaw = store?.getItem?.(BATTLEFIELD_MAP_LIBRARY_KEY);
  const legacyRaw = store?.getItem?.(LEGACY_MAP_MAKER_KEY);
  const current = safeParse(currentRaw, []);
  const legacy = safeParse(legacyRaw, []);

  const builtIn = (Array.isArray(builtInMaps) ? builtInMaps : []).map((map, index) => createBattlefieldMapLibraryEntry(
    normalizeBattlefieldMap(map, {
      id: map.id || `built-in-${index}`,
      source: BATTLEFIELD_MAP_SOURCES.BUILT_IN,
    }),
    { source: BATTLEFIELD_MAP_SOURCES.BUILT_IN, savedAt: null },
  ));
  const builtInIds = new Set(builtIn.map((entry) => String(entry.id)));

  const migratedCurrent = (Array.isArray(current) ? current : [])
    .map((entry, index) => migrateLegacyEntry(entry, index))
    .filter(Boolean)
    .map((entry, index) => {
      if (!builtInIds.has(String(entry.id))) return entry;
      if (entry.source === BATTLEFIELD_MAP_SOURCES.BUILT_IN) return null;
      const forked = prepareBattlefieldMapForSave(entry.mapDefinition, {
        suffix: entry.savedAt || `legacy-${index}`,
        name: entry.name,
      });
      return createBattlefieldMapLibraryEntry(forked, {
        entryId: forked.id,
        savedAt: entry.savedAt || null,
        thumbnail: entry.thumbnail || null,
      });
    })
    .filter(Boolean);

  const currentIds = new Set(migratedCurrent.map((entry) => String(entry.id)));
  const migratedLegacy = (Array.isArray(legacy) ? legacy : [])
    .map((entry, index) => migrateLegacyEntry(entry, index, { legacyMapMaker: true }))
    .filter(Boolean)
    .map((entry, index) => {
      if (builtInIds.has(String(entry.id))) {
        const forked = prepareBattlefieldMapForSave(entry.mapDefinition, {
          suffix: entry.savedAt || `legacy-v1-${index}`,
          name: entry.name,
        });
        return createBattlefieldMapLibraryEntry(forked, {
          entryId: forked.id,
          savedAt: entry.savedAt || null,
          thumbnail: entry.thumbnail || null,
        });
      }
      return entry;
    })
    .filter((entry) => entry && !currentIds.has(String(entry.id)));

  const result = [];
  const seen = new Set();
  for (const entry of [...builtIn, ...migratedCurrent, ...migratedLegacy]) {
    const id = String(entry?.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(entry);
  }
  return result;
}

export function persistBattlefieldMapLibrary(entries, { storage = null } = {}) {
  const store = storageOrNull(storage);
  if (!store?.setItem) return { accepted: false, reason: "storage-unavailable", entries: [] };
  const normalized = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.source !== BATTLEFIELD_MAP_SOURCES.BUILT_IN)
    .map((entry, index) => migrateLegacyEntry(entry, index))
    .filter(Boolean);
  store.setItem(BATTLEFIELD_MAP_LIBRARY_KEY, JSON.stringify(normalized));
  return { accepted: true, entries: normalized };
}

export function saveBattlefieldMapToLibrary(map, { storage = null, existingEntries = null, thumbnail = null } = {}) {
  const entries = Array.isArray(existingEntries)
    ? existingEntries
    : loadBattlefieldMapLibrary({ storage }).filter((entry) => entry.source !== BATTLEFIELD_MAP_SOURCES.BUILT_IN);
  const normalized = prepareBattlefieldMapForSave(map);
  const entry = createBattlefieldMapLibraryEntry(normalized, { thumbnail });
  const next = [entry, ...entries.filter((candidate) => String(candidate.id) !== String(entry.id))];
  const persisted = persistBattlefieldMapLibrary(next, { storage });
  return { ...persisted, entry, entries: persisted.accepted ? persisted.entries : next };
}

export function deleteBattlefieldMapFromLibrary(id, { storage = null, existingEntries = null } = {}) {
  const entries = Array.isArray(existingEntries)
    ? existingEntries
    : loadBattlefieldMapLibrary({ storage }).filter((entry) => entry.source !== BATTLEFIELD_MAP_SOURCES.BUILT_IN);
  const next = entries.filter((entry) => entry.id !== id);
  return persistBattlefieldMapLibrary(next, { storage });
}

export function duplicateBattlefieldMap(map, { name = null } = {}) {
  const source = normalizeBattlefieldMap(map);
  const id = `battlefield-${Date.now()}`;
  return normalizeBattlefieldMap({
    ...source,
    id,
    name: name || `${source.name} Copy`,
    source: BATTLEFIELD_MAP_SOURCES.SAVED,
    generator: source.generator ? { ...source.generator, duplicatedFrom: source.id } : null,
  });
}

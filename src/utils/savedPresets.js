/**
 * Canonical saved combat presets.
 *
 * Presets are setup snapshots only. Active combat state is deliberately stored
 * elsewhere and is never touched by the preset-schema migration.
 */
import { normalizeReferenceCombatActor } from "./combat/normalizeCombatActorSchema.js";
import { validateCombatActor } from "./combat/validateCombatActor.js";

export const CANONICAL_PRESET_SCHEMA_VERSION = 2;
export const SAVED_PRESET_STORAGE_KEY = "charcreat_saved_presets";
export const QUARANTINED_PRESET_STORAGE_KEY = "charcreat_quarantined_presets";
export const PRESET_MIGRATION_MARKER_KEY = `charcreat_preset_schema_migrated_v${CANONICAL_PRESET_SCHEMA_VERSION}`;
export const LEGACY_PRESET_STORAGE_KEYS = Object.freeze([
  SAVED_PRESET_STORAGE_KEY,
  "savedPresets",
  "combatPresets",
  "savedCombatPresets",
  "encounterPresets",
  "charcreat_combat_presets",
]);

const browserStorage = () => globalThis.localStorage;
const parseArray = (value) => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function migrateLegacyPresetStorage({
  storage = browserStorage(),
  emitDeveloperEvent = null,
} = {}) {
  if (!storage || storage.getItem(PRESET_MIGRATION_MARKER_KEY) === "complete") {
    return { migrated: false, removedCount: 0, removedKeys: [] };
  }
  let removedCount = 0;
  const removedKeys = [];
  for (const storageKey of LEGACY_PRESET_STORAGE_KEYS) {
    const raw = storage.getItem(storageKey);
    if (raw == null) continue;
    removedCount += parseArray(raw).length;
    storage.removeItem(storageKey);
    removedKeys.push(storageKey);
  }
  storage.setItem(PRESET_MIGRATION_MARKER_KEY, "complete");
  const event = {
    eventType: "obsolete-combat-presets-removed",
    level: "info",
    data: { removedCount, removedKeys, presetSchemaVersion: CANONICAL_PRESET_SCHEMA_VERSION },
  };
  emitDeveloperEvent?.(event);
  return { migrated: true, removedCount, removedKeys, event };
}

function sanitizeFighter(fighter) {
  if (!fighter) return null;
  const copy = { ...fighter };
  delete copy.ref;
  delete copy._ref;
  return copy;
}

function normalizePresetFighters(fighters = []) {
  const normalized = [];
  const diagnostics = [];
  for (const fighter of fighters) {
    const result = normalizeReferenceCombatActor(sanitizeFighter(fighter), {
      source: "canonical-preset",
      lifecyclePhase: "combat-start",
    });
    const validation = validateCombatActor(result.normalizedActor, { normalize: false });
    if (!result.normalizedActor?.actorKey || !validation.valid) {
      diagnostics.push(...(result.diagnostics || []), ...validation.errors);
      return { accepted: false, fighters: [], diagnostics };
    }
    normalized.push(result.normalizedActor);
  }
  return { accepted: normalized.length > 0, fighters: normalized, diagnostics };
}

function quarantinePreset(preset, reason, storage) {
  const quarantined = parseArray(storage.getItem(QUARANTINED_PRESET_STORAGE_KEY));
  quarantined.push({ preset, reason, quarantinedAt: new Date().toISOString() });
  storage.setItem(QUARANTINED_PRESET_STORAGE_KEY, JSON.stringify(quarantined));
}

export function getSavedPresets({ storage = browserStorage(), emitDeveloperEvent = null } = {}) {
  if (!storage) return [];
  migrateLegacyPresetStorage({ storage, emitDeveloperEvent });
  const parsed = parseArray(storage.getItem(SAVED_PRESET_STORAGE_KEY));
  const accepted = [];
  for (const preset of parsed) {
    if (preset?.presetSchemaVersion !== CANONICAL_PRESET_SCHEMA_VERSION) {
      quarantinePreset(preset, "preset-schema-version-mismatch", storage);
      continue;
    }
    const normalized = normalizePresetFighters(preset.fighters);
    if (!normalized.accepted) {
      quarantinePreset(preset, "actor-schema-normalization-failed", storage);
      continue;
    }
    accepted.push({ ...preset, fighters: normalized.fighters });
  }
  if (accepted.length !== parsed.length) {
    storage.setItem(SAVED_PRESET_STORAGE_KEY, JSON.stringify(accepted));
  }
  return accepted;
}

export function savePreset({ name, fighters, positions }, { storage = browserStorage() } = {}) {
  if (!storage) throw new Error("Preset storage is unavailable.");
  migrateLegacyPresetStorage({ storage });
  const normalized = normalizePresetFighters(fighters);
  if (!normalized.accepted) {
    const rejected = { name, fighters, positions };
    quarantinePreset(rejected, "actor-schema-normalization-failed", storage);
    throw new Error("Preset contains actors that cannot normalize to the canonical combat schema.");
  }
  const preset = {
    id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    presetSchemaVersion: CANONICAL_PRESET_SCHEMA_VERSION,
    name: String(name || "Unnamed preset").trim() || "Unnamed preset",
    savedAt: new Date().toISOString(),
    fighters: normalized.fighters,
    positions: positions && typeof positions === "object" ? { ...positions } : {},
  };
  const all = getSavedPresets({ storage });
  storage.setItem(SAVED_PRESET_STORAGE_KEY, JSON.stringify([preset, ...all]));
  return preset.id;
}

export function loadSavedPreset(id, { storage = browserStorage() } = {}) {
  const preset = getSavedPresets({ storage }).find((entry) => entry.id === id);
  return preset ? { ...preset, positions: preset.positions || {} } : null;
}

export function deleteSavedPreset(id, { storage = browserStorage() } = {}) {
  const before = getSavedPresets({ storage });
  const after = before.filter((preset) => preset.id !== id);
  storage.setItem(SAVED_PRESET_STORAGE_KEY, JSON.stringify(after));
  return { deleted: after.length !== before.length, deletedCount: before.length - after.length };
}

export function deleteAllSavedPresets({ storage = browserStorage() } = {}) {
  const deletedCount = getSavedPresets({ storage }).length;
  storage.setItem(SAVED_PRESET_STORAGE_KEY, "[]");
  return { deleted: deletedCount > 0, deletedCount };
}

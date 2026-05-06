/**
 * Saved combat presets - store current fighters + positions in localStorage.
 * Loaded presets appear alongside built-in quick-start prescenes.
 */
import { migratePPEStateForCollection } from "./spellUtils.js";

const STORAGE_KEY = "charcreat_saved_presets";

/**
 * Sanitize fighter for JSON storage (strip non-serializable fields)
 */
function sanitizeFighter(f) {
  if (!f) return null;
  const copy = { ...f };
  // Remove refs, functions, DOM refs
  delete copy.ref;
  delete copy._ref;
  return copy;
}

/**
 * @returns {Array<{ id: string, name: string, savedAt: string, fighters: Array, positions: Object }>}
 */
export function getSavedPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const migrated = parsed.map((preset) => ({
      ...preset,
      fighters: migratePPEStateForCollection(preset?.fighters || []),
    }));
    const migratedRaw = JSON.stringify(migrated);
    if (migratedRaw !== raw) {
      localStorage.setItem(STORAGE_KEY, migratedRaw);
    }
    return migrated;
  } catch (e) {
    console.warn("[savedPresets] Failed to load:", e);
    return [];
  }
}

/**
 * Save a preset
 * @param {Object} opts
 * @param {string} opts.name - Display name
 * @param {Array} opts.fighters - Current fighters
 * @param {Object} opts.positions - Fighter positions { [id]: { x, y } }
 * @returns {string} id of saved preset
 */
export function savePreset({ name, fighters, positions }) {
  const id = `saved-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const savedAt = new Date().toISOString();
  const sanitized = migratePPEStateForCollection(
    (fighters || []).map(sanitizeFighter).filter(Boolean)
  );
  const preset = {
    id,
    name: String(name || "Unnamed preset").trim() || "Unnamed preset",
    savedAt,
    fighters: sanitized,
    positions: positions && typeof positions === "object" ? { ...positions } : {},
  };

  const all = getSavedPresets();
  all.unshift(preset);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("[savedPresets] Failed to save:", e);
    throw e;
  }
  return id;
}

/**
 * Load a preset by id
 * @param {string} id
 * @returns {Object|null} { fighters, positions } or null
 */
export function loadSavedPreset(id) {
  const all = getSavedPresets();
  const preset = all.find((p) => p.id === id);
  if (!preset) return null;
  return {
    name: preset.name,
    fighters: migratePPEStateForCollection(preset.fighters || []),
    positions: preset.positions || {},
  };
}

/**
 * Delete a saved preset
 * @param {string} id
 */
export function deleteSavedPreset(id) {
  const all = getSavedPresets().filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("[savedPresets] Failed to delete:", e);
  }
}

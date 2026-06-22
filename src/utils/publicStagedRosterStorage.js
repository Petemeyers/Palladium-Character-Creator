export const PUBLIC_ARENA_ROSTER_STORAGE_KEY = "publicArenaRosterEntries";

const getStorage = () => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
};

export function loadPublicArenaRosterEntries() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const stored = storage.getItem(PUBLIC_ARENA_ROSTER_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

export function savePublicArenaRosterEntries(entries = []) {
  const storage = getStorage();
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (!storage) return safeEntries;

  try {
    storage.setItem(PUBLIC_ARENA_ROSTER_STORAGE_KEY, JSON.stringify(safeEntries));
  } catch (_error) {
    return safeEntries;
  }

  return safeEntries;
}

export function clearPublicArenaRosterEntries() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    storage.removeItem(PUBLIC_ARENA_ROSTER_STORAGE_KEY);
  } catch (_error) {
    return [];
  }

  return [];
}

export function upsertPublicArenaRosterEntry(entry) {
  if (!entry?.id) return loadPublicArenaRosterEntries();
  const entries = loadPublicArenaRosterEntries();
  const nextEntries = [
    entry,
    ...entries.filter((existing) => existing.id !== entry.id || existing.side !== entry.side),
  ];
  return savePublicArenaRosterEntries(nextEntries);
}

export default {
  PUBLIC_ARENA_ROSTER_STORAGE_KEY,
  clearPublicArenaRosterEntries,
  loadPublicArenaRosterEntries,
  savePublicArenaRosterEntries,
  upsertPublicArenaRosterEntry,
};

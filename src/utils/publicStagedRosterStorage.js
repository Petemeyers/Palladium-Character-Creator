export const PUBLIC_ARENA_ROSTER_STORAGE_KEY = "publicArenaRosterEntries";

const getStorage = () => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
};

const toSafeEntries = (entries = []) => {
  if (!Array.isArray(entries)) return [];
  try {
    return JSON.parse(JSON.stringify(entries));
  } catch (_error) {
    return [];
  }
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

export const getStagedRosterEntries = loadPublicArenaRosterEntries;

export function savePublicArenaRosterEntries(entries = []) {
  const storage = getStorage();
  const safeEntries = toSafeEntries(entries);
  if (!storage) return safeEntries;

  try {
    storage.setItem(PUBLIC_ARENA_ROSTER_STORAGE_KEY, JSON.stringify(safeEntries));
  } catch (_error) {
    return safeEntries;
  }

  return safeEntries;
}

export const saveStagedRosterEntries = savePublicArenaRosterEntries;

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

export const clearStagedRosterEntries = clearPublicArenaRosterEntries;

const getEntryId = (entry) =>
  String(entry?.stagedEntryId || entry?.entryId || entry?.id || "");

const getCharacterId = (entry) =>
  String(entry?.characterId || entry?.savedCharacterId || entry?.sourceCharacterId || entry?.id || "");

const getSavedCharacterId = (character) =>
  String(character?.id || character?._id || character?.characterId || "");

const isSavedCharacterEntry = (entry) =>
  entry?.source === "saved-character" || entry?.side === "player" && Boolean(entry?.autoRollCharacter);

export function removeStagedRosterEntry(entryId) {
  const targetId = String(entryId || "");
  if (!targetId) return loadPublicArenaRosterEntries();
  const entries = loadPublicArenaRosterEntries();
  const nextEntries = entries.filter((entry) => getEntryId(entry) !== targetId);
  return savePublicArenaRosterEntries(nextEntries);
}

export function removeStagedRosterEntriesByCharacterId(characterId) {
  const targetId = String(characterId || "");
  if (!targetId) return loadPublicArenaRosterEntries();
  const entries = loadPublicArenaRosterEntries();
  const nextEntries = entries.filter((entry) =>
    !isSavedCharacterEntry(entry) || getCharacterId(entry) !== targetId
  );
  return savePublicArenaRosterEntries(nextEntries);
}

export function pruneStagedRosterEntriesAgainstSavedCharacters(savedCharacters = []) {
  const entries = loadPublicArenaRosterEntries();
  const savedIds = new Set(
    (Array.isArray(savedCharacters) ? savedCharacters : [])
      .map(getSavedCharacterId)
      .filter(Boolean)
  );
  if (savedIds.size === 0) {
    return savePublicArenaRosterEntries(entries.filter((entry) => !isSavedCharacterEntry(entry)));
  }
  const nextEntries = entries.filter((entry) =>
    !isSavedCharacterEntry(entry) || savedIds.has(getCharacterId(entry))
  );
  return savePublicArenaRosterEntries(nextEntries);
}

export function getMissingSavedCharacterStagedEntries(entries = [], savedCharacters = []) {
  const savedIds = new Set(
    (Array.isArray(savedCharacters) ? savedCharacters : [])
      .map(getSavedCharacterId)
      .filter(Boolean)
  );
  if (savedIds.size === 0) return [];
  return (Array.isArray(entries) ? entries : []).filter((entry) =>
    isSavedCharacterEntry(entry) && !savedIds.has(getCharacterId(entry))
  );
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
  clearStagedRosterEntries,
  getMissingSavedCharacterStagedEntries,
  getStagedRosterEntries,
  loadPublicArenaRosterEntries,
  pruneStagedRosterEntriesAgainstSavedCharacters,
  removeStagedRosterEntriesByCharacterId,
  removeStagedRosterEntry,
  savePublicArenaRosterEntries,
  saveStagedRosterEntries,
  upsertPublicArenaRosterEntry,
};

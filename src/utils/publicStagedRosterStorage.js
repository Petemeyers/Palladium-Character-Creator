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

const getEntryIdentity = (entry) => {
  const savedCharacterId = getStagedSavedCharacterId(entry);
  if (savedCharacterId) return `saved-character:${savedCharacterId}`;
  const source = String(entry?.source || "staged-entry");
  const side = String(entry?.side || entry?.team || "unknown");
  const id = String(entry?.selectableActorId || entry?.sourceEnemyId || entry?.id || entry?.name || "");
  return id ? `${source}:${side}:${id}` : "";
};

const getCharacterId = (entry) =>
  String(entry?.characterId || entry?.savedCharacterId || entry?.sourceCharacterId || entry?.id || "");

const getSavedCharacterId = (character) =>
  String(character?.id || character?._id || character?.characterId || "");

const isSavedCharacterEntry = (entry) =>
  entry?.source === "saved-character" || (
    entry?.side === "player" &&
    entry?.generated !== true &&
    Boolean(entry?.autoRollCharacter)
  );

export const getStagedSavedCharacterId = (entry) =>
  isSavedCharacterEntry(entry) ? getCharacterId(entry) : "";

export function hasStagedSavedCharacter(entries = [], characterId = "") {
  const targetId = String(characterId || "");
  if (!targetId || !Array.isArray(entries)) return false;
  return entries.some((entry) => getStagedSavedCharacterId(entry) === targetId);
}

export function getDuplicateStagedSavedCharacters(entries = []) {
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  const duplicates = [];

  entries.forEach((entry) => {
    const characterId = getStagedSavedCharacterId(entry);
    if (!characterId) return;
    if (seen.has(characterId)) {
      duplicates.push({ ...toSafeEntries([entry])[0], duplicateCharacterId: characterId });
      return;
    }
    seen.add(characterId);
  });

  return duplicates;
}

export function removeDuplicateSavedCharacterEntries(entries = []) {
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  const nextEntries = [];

  entries.forEach((entry) => {
    const characterId = getStagedSavedCharacterId(entry);
    if (!characterId) {
      nextEntries.push(entry);
      return;
    }
    if (seen.has(characterId)) return;
    seen.add(characterId);
    nextEntries.push(entry);
  });

  return toSafeEntries(nextEntries);
}

export function removeDuplicateSavedCharacterEntriesFromStorage() {
  const entries = loadPublicArenaRosterEntries();
  return savePublicArenaRosterEntries(removeDuplicateSavedCharacterEntries(entries));
}

export function getDuplicateStagedRosterEntries(entries = []) {
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  return entries.filter((entry) => {
    const identity = getEntryIdentity(entry);
    if (!identity) return false;
    if (seen.has(identity)) return true;
    seen.add(identity);
    return false;
  });
}

export function removeDuplicateStagedRosterEntries(entries = []) {
  if (!Array.isArray(entries)) return [];
  const duplicateEntries = new Set(getDuplicateStagedRosterEntries(entries));
  return toSafeEntries(entries.filter((entry) => !duplicateEntries.has(entry)));
}

export function removeDuplicateStagedRosterEntriesFromStorage() {
  return savePublicArenaRosterEntries(removeDuplicateStagedRosterEntries(loadPublicArenaRosterEntries()));
}

export function removeStagedRosterEntry(entryOrId) {
  const targetId = typeof entryOrId === "object" ? getEntryId(entryOrId) : String(entryOrId || "");
  if (!targetId) return loadPublicArenaRosterEntries();
  const entries = loadPublicArenaRosterEntries();
  const targetSide = typeof entryOrId === "object" ? String(entryOrId?.side || entryOrId?.team || "") : "";
  const targetSource = typeof entryOrId === "object" ? String(entryOrId?.source || "") : "";
  const removeIndex = entries.findIndex((entry) => (
    getEntryId(entry) === targetId &&
    (!targetSide || String(entry?.side || entry?.team || "") === targetSide) &&
    (!targetSource || String(entry?.source || "") === targetSource)
  ));
  if (removeIndex < 0) return entries;
  const nextEntries = entries.filter((_entry, index) => index !== removeIndex);
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
  return (Array.isArray(entries) ? entries : []).filter((entry) =>
    isSavedCharacterEntry(entry) && !savedIds.has(getCharacterId(entry))
  );
}

export function upsertPublicArenaRosterEntry(entry) {
  if (!entry?.id) return loadPublicArenaRosterEntries();
  const entries = loadPublicArenaRosterEntries();
  const characterId = getStagedSavedCharacterId(entry);
  if (characterId && hasStagedSavedCharacter(entries, characterId)) {
    return entries;
  }
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
  getDuplicateStagedSavedCharacters,
  getDuplicateStagedRosterEntries,
  getMissingSavedCharacterStagedEntries,
  getStagedSavedCharacterId,
  getStagedRosterEntries,
  hasStagedSavedCharacter,
  loadPublicArenaRosterEntries,
  pruneStagedRosterEntriesAgainstSavedCharacters,
  removeDuplicateSavedCharacterEntries,
  removeDuplicateSavedCharacterEntriesFromStorage,
  removeDuplicateStagedRosterEntries,
  removeDuplicateStagedRosterEntriesFromStorage,
  removeStagedRosterEntriesByCharacterId,
  removeStagedRosterEntry,
  savePublicArenaRosterEntries,
  saveStagedRosterEntries,
  upsertPublicArenaRosterEntry,
};

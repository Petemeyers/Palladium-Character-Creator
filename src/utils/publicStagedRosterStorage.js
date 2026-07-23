import { buildOriginalActorMetadata } from "./originalActorMetadata.js";
import { ensureKnightCloseWeaponLoadout } from "./knightLoadout.js";

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
    return Array.isArray(parsed)
      ? parsed.map((entry) => ensureKnightCloseWeaponLoadout(entry))
      : [];
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

const cleanId = (value) => value === undefined || value === null ? "" : String(value).trim();

const getCharacterId = (entry) =>
  cleanId(entry?.sourceCharacterId || entry?.savedCharacterId || entry?.characterId || entry?._id || entry?.id);

export const getSavedCharacterStableId = (character) =>
  cleanId(
    character?._id ||
    character?.sourceCharacterId ||
    character?.savedCharacterId ||
    character?.characterId ||
    character?.id
  );

const isSavedCharacterEntry = (entry) =>
  entry?.source === "saved-character" || (
    entry?.side === "player" &&
    entry?.generated !== true &&
    Boolean(entry?.autoRollCharacter)
  );

export const getStagedSavedCharacterId = (entry) =>
  isSavedCharacterEntry(entry) ? getCharacterId(entry) : "";

const getIdentityIds = (value, includeLegacyId = true) => {
  const ids = [
    value?.sourceCharacterId,
    value?.savedCharacterId,
    value?.characterId,
    value?._id,
    includeLegacyId ? value?.id : "",
  ].map(cleanId).filter(Boolean);
  return [...new Set(ids)];
};

const normalizeIdentityText = (value) => {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
};

const firstIdentityText = (value, fields) => {
  for (const field of fields) {
    const direct = normalizeIdentityText(value?.[field]);
    if (direct) return direct;
    const snapshot = normalizeIdentityText(value?.autoRollCharacter?.[field]);
    if (snapshot) return snapshot;
  }
  return "";
};

const SAVED_CHARACTER_IDENTITY_FIELDS = {
  className: ["publicClassName", "class", "profession"],
  species: ["publicSpeciesName", "species", "race", "category"],
  background: ["publicBackgroundName", "background", "socialBackground"],
};

const matchesSafeIdentity = (entry, character) => {
  if (firstIdentityText(entry, ["name"]) !== firstIdentityText(character, ["name"])) return false;
  return Object.values(SAVED_CHARACTER_IDENTITY_FIELDS).every((fields) => {
    const stagedValue = firstIdentityText(entry, fields);
    return !stagedValue || stagedValue === firstIdentityText(character, fields);
  });
};

const buildStagedEntryId = (entry, stableId) => cleanId(
  entry?.stagedEntryId ||
  entry?.entryId ||
  (entry?.id ? `staged-saved:${entry.id}` : `staged-saved:${stableId}`)
);

const getExplicitCombatActorMigrationAlias = (entry = {}, savedCharacter = {}) => {
  const explicit = cleanId(
    savedCharacter.actorKey || savedCharacter.canonicalActorKey || savedCharacter.sourceActorKey ||
    entry.actorKey || entry.canonicalActorKey || entry.sourceActorKey || entry.combatActorMigrationAlias
  ).toLowerCase();
  if (explicit) return explicit;
  const classKey = normalizeIdentityText(
    savedCharacter.publicClassName || savedCharacter.class || savedCharacter.profession || entry.publicClassName
  );
  const explicitClassAliases = {
    knight: "knight",
    "veteran knight": "veteran-knight",
    squire: "squire",
    "man at arms": "man-at-arms",
    "man-at-arms": "man-at-arms",
    spearman: "spearman",
    brigand: "brigand",
    bandit: "bandit",
    guard: "guard",
    cultist: "cultist",
  };
  return explicitClassAliases[classKey] || "";
};

export function repairStagedSavedCharacterEntry(entry = {}, savedCharacter = {}) {
  const stableId = getSavedCharacterStableId(savedCharacter);
  if (!stableId) return toSafeEntries([entry])[0] || {};
  const savedMetadata = buildOriginalActorMetadata(savedCharacter);
  const originalActorMetadata = buildOriginalActorMetadata({
    ...savedCharacter,
    attributes: savedMetadata.attributes,
    training: savedMetadata.training,
    traits: savedMetadata.traits,
    state: savedMetadata.state,
    reputation: savedMetadata.reputation,
    favor: savedMetadata.favor,
    behavior: savedMetadata.behavior,
    movement: savedMetadata.movement,
    originalActorMetadata: entry?.originalActorMetadata || savedCharacter?.originalActorMetadata,
  });
  const combatActorMigrationAlias = getExplicitCombatActorMigrationAlias(entry, savedCharacter);
  return toSafeEntries([{
    ...entry,
    stagedEntryId: buildStagedEntryId(entry, stableId),
    id: stableId,
    name: savedCharacter?.name || entry?.name || "Saved character",
    source: "saved-character",
    sourceLabel: entry?.sourceLabel || "Saved Character",
    sourceCharacterId: stableId,
    savedCharacterId: stableId,
    characterId: stableId,
    publicClassName: savedCharacter?.publicClassName || savedCharacter?.class || savedCharacter?.profession || entry?.publicClassName,
    publicSpeciesName: savedCharacter?.publicSpeciesName || savedCharacter?.species || savedCharacter?.race || savedCharacter?.category || entry?.publicSpeciesName,
    publicBackgroundName: savedCharacter?.publicBackgroundName || savedCharacter?.background || savedCharacter?.socialBackground || entry?.publicBackgroundName,
    originalActorMetadata,
    ...(combatActorMigrationAlias ? {
      combatActorMigrationAlias,
      autoRollCharacter: {
        ...(entry.autoRollCharacter || savedCharacter.autoRollCharacter || savedCharacter),
        combatActorMigrationAlias,
        sourceActorKey: combatActorMigrationAlias,
      },
    } : {}),
  }])[0];
}

export function resolveSavedCharacterForStagedEntry(entry = {}, savedCharacters = []) {
  if (!isSavedCharacterEntry(entry)) {
    return { status: "not-saved-character", entry: toSafeEntries([entry])[0] || {}, character: null };
  }

  const characters = Array.isArray(savedCharacters) ? savedCharacters.filter(Boolean) : [];
  const stagedIds = new Set(getIdentityIds(entry));
  const exactMatches = characters.filter((character) =>
    getIdentityIds(character).some((id) => stagedIds.has(id))
  );

  let matches = exactMatches;
  let matchType = "exact";
  if (matches.length === 0) {
    matches = characters.filter((character) => matchesSafeIdentity(entry, character));
    matchType = "identity";
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous",
      entry: toSafeEntries([entry])[0] || {},
      character: null,
      candidates: matches.map((character) => ({
        id: getSavedCharacterStableId(character),
        name: character?.name || "Saved character",
      })),
    };
  }
  if (matches.length === 0) {
    return { status: "missing", entry: toSafeEntries([entry])[0] || {}, character: null, candidates: [] };
  }

  const character = matches[0];
  const stableId = getSavedCharacterStableId(character);
  const repairedEntry = repairStagedSavedCharacterEntry(entry, character);
  const alreadyCurrent =
    cleanId(entry?.sourceCharacterId) === stableId &&
    cleanId(entry?.savedCharacterId) === stableId &&
    cleanId(entry?.characterId) === stableId &&
    cleanId(entry?.id) === stableId &&
    Boolean(entry?.stagedEntryId);

  return {
    status: matchType === "exact" && alreadyCurrent ? "exact" : "repaired",
    matchType,
    entry: repairedEntry,
    character,
    stableId,
    candidates: [],
  };
}

export function repairStagedSavedCharacterEntries(entries = [], savedCharacters = []) {
  const resolutions = (Array.isArray(entries) ? entries : []).map((entry) =>
    resolveSavedCharacterForStagedEntry(entry, savedCharacters)
  );
  const repairedEntries = resolutions.map((resolution) => resolution.entry);
  return {
    entries: repairedEntries,
    resolutions,
    changed: JSON.stringify(repairedEntries) !== JSON.stringify(Array.isArray(entries) ? entries : []),
  };
}

export function repairStagedSavedCharacterEntriesInStorage(savedCharacters = []) {
  const result = repairStagedSavedCharacterEntries(loadPublicArenaRosterEntries(), savedCharacters);
  return {
    ...result,
    entries: result.changed ? savePublicArenaRosterEntries(result.entries) : result.entries,
  };
}

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
  const nextEntries = entries.flatMap((entry) => {
    const resolution = resolveSavedCharacterForStagedEntry(entry, savedCharacters);
    return resolution.status === "missing" ? [] : [resolution.entry];
  });
  return savePublicArenaRosterEntries(nextEntries);
}

export function getMissingSavedCharacterStagedEntries(entries = [], savedCharacters = []) {
  return (Array.isArray(entries) ? entries : []).filter((entry) =>
    resolveSavedCharacterForStagedEntry(entry, savedCharacters).status === "missing"
  );
}

export function getAmbiguousSavedCharacterStagedEntries(entries = [], savedCharacters = []) {
  return (Array.isArray(entries) ? entries : []).filter((entry) =>
    resolveSavedCharacterForStagedEntry(entry, savedCharacters).status === "ambiguous"
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
  getAmbiguousSavedCharacterStagedEntries,
  getMissingSavedCharacterStagedEntries,
  getSavedCharacterStableId,
  getStagedSavedCharacterId,
  getStagedRosterEntries,
  hasStagedSavedCharacter,
  loadPublicArenaRosterEntries,
  pruneStagedRosterEntriesAgainstSavedCharacters,
  repairStagedSavedCharacterEntries,
  repairStagedSavedCharacterEntriesInStorage,
  repairStagedSavedCharacterEntry,
  resolveSavedCharacterForStagedEntry,
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

import { adaptPublicCharacterForAutoRoll } from "./publicCharacterCombatAdapter.js";
import { getStagedSavedCharacterId } from "./publicStagedRosterStorage.js";
export {
  PUBLIC_ARENA_ROSTER_STORAGE_KEY,
  clearPublicArenaRosterEntries,
  clearStagedRosterEntries,
  getDuplicateStagedSavedCharacters,
  getMissingSavedCharacterStagedEntries,
  getStagedSavedCharacterId,
  getStagedRosterEntries,
  hasStagedSavedCharacter,
  loadPublicArenaRosterEntries,
  pruneStagedRosterEntriesAgainstSavedCharacters,
  removeDuplicateSavedCharacterEntries,
  removeDuplicateSavedCharacterEntriesFromStorage,
  removeStagedRosterEntriesByCharacterId,
  removeStagedRosterEntry,
  savePublicArenaRosterEntries,
  saveStagedRosterEntries,
  upsertPublicArenaRosterEntry,
} from "./publicStagedRosterStorage.js";

const clonePlain = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

export function adaptPublicCharacterToRosterEntry(character = {}) {
  const adaptation = adaptPublicCharacterForAutoRoll(character);
  const combatCharacter = adaptation.combatCharacter;
  const sourceCharacterId = character.id || character._id || character.characterId || `saved-${character.name || "character"}`;
  const publicAbilityScores = character.finalAbilityScores || character.publicAbilityScores || character.abilityScores;
  const publicAbilityModifiers = character.abilityModifiers || character.publicAbilityModifiers;

  return {
    id: sourceCharacterId,
    name: character.name || "Saved Character",
    side: "player",
    source: "saved-character",
    sourceCharacterId,
    generated: false,
    publicClassName: character.publicClassName || combatCharacter?.publicClassName,
    publicSpeciesName: character.publicSpeciesName || combatCharacter?.publicSpeciesName,
    publicBackgroundName: character.publicBackgroundName || combatCharacter?.publicBackgroundName,
    finalAbilityScores: clonePlain(publicAbilityScores),
    abilityModifiers: clonePlain(publicAbilityModifiers),
    publicAbilityScores: clonePlain(publicAbilityScores),
    publicAbilityModifiers: clonePlain(publicAbilityModifiers),
    publicDerivedStats: clonePlain(character.publicDerivedStats || character.derivedStats || combatCharacter?.publicDerivedStats),
    compatibilityAttributes: clonePlain(combatCharacter?.attributes),
    attribute_dice: clonePlain(combatCharacter?.attribute_dice),
    autoRollReady: adaptation.ready,
    autoRollMissingFields: [...adaptation.missingRequiredFields],
    autoRollCharacter: combatCharacter ? clonePlain(combatCharacter) : null,
  };
}

export function findSavedCharacterForStagedEntry(entry = {}, savedCharacters = []) {
  const stagedCharacterId = getStagedSavedCharacterId(entry);
  if (!stagedCharacterId || !Array.isArray(savedCharacters)) return null;
  return savedCharacters.find((character) =>
    String(character?.id || character?._id || character?.characterId || "") === stagedCharacterId
  ) || null;
}

export function resolveStagedSavedCharacterForImport(entry = {}, savedCharacters = []) {
  if (entry?.source !== "saved-character") {
    return {
      ok: true,
      entry: clonePlain(entry),
      source: entry?.source || "staged-entry",
    };
  }

  const savedCharacterId = getStagedSavedCharacterId(entry);
  if (!savedCharacterId) {
    return {
      ok: false,
      reason: "missing saved character id",
      entryName: entry?.name || "Staged character",
    };
  }

  const savedCharacter = findSavedCharacterForStagedEntry(entry, savedCharacters);
  if (!savedCharacter) {
    return {
      ok: false,
      reason: "saved character no longer exists",
      entryName: entry?.name || "Staged character",
      savedCharacterId,
    };
  }

  return {
    ok: true,
    entry: adaptPublicCharacterToRosterEntry(savedCharacter),
    source: "saved-character",
    savedCharacterId,
  };
}

export default {
  adaptPublicCharacterToRosterEntry,
  findSavedCharacterForStagedEntry,
  resolveStagedSavedCharacterForImport,
};

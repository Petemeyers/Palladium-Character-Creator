import { adaptPublicCharacterForAutoRoll } from "./publicCharacterCombatAdapter.js";
import { addOriginalActorMetadata } from "./originalActorMetadata.js";
import { ensureKnightCloseWeaponLoadout } from "./knightLoadout.js";
import {
  getSavedCharacterStableId,
  getStagedSavedCharacterId,
  resolveSavedCharacterForStagedEntry,
} from "./publicStagedRosterStorage.js";
export {
  PUBLIC_ARENA_ROSTER_STORAGE_KEY,
  clearPublicArenaRosterEntries,
  clearStagedRosterEntries,
  getAmbiguousSavedCharacterStagedEntries,
  getDuplicateStagedSavedCharacters,
  getDuplicateStagedRosterEntries,
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
  removeDuplicateSavedCharacterEntries,
  removeDuplicateSavedCharacterEntriesFromStorage,
  removeDuplicateStagedRosterEntries,
  removeDuplicateStagedRosterEntriesFromStorage,
  removeStagedRosterEntriesByCharacterId,
  removeStagedRosterEntry,
  savePublicArenaRosterEntries,
  saveStagedRosterEntries,
  resolveSavedCharacterForStagedEntry,
  upsertPublicArenaRosterEntry,
} from "./publicStagedRosterStorage.js";

const clonePlain = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

export function adaptPublicCharacterToRosterEntry(character = {}) {
  const adaptation = adaptPublicCharacterForAutoRoll(character);
  const combatCharacter = ensureKnightCloseWeaponLoadout(adaptation.combatCharacter);
  const sourceCharacterId = getSavedCharacterStableId(character) || `saved-${character.name || "character"}`;
  const stagedEntryId = character.stagedEntryId || `staged-saved:${sourceCharacterId}`;
  const publicAbilityScores = character.finalAbilityScores || character.publicAbilityScores || character.abilityScores;
  const publicAbilityModifiers = character.abilityModifiers || character.publicAbilityModifiers;

  return ensureKnightCloseWeaponLoadout(addOriginalActorMetadata({
    id: sourceCharacterId,
    stagedEntryId,
    name: character.name || "Saved Character",
    side: character.side || "player",
    team: character.team || "party",
    battleSide: character.battleSide || character.team || "party",
    controlMode: character.controlMode || "manual",
    source: "saved-character",
    sourceLabel: "Saved Character",
    sourceCharacterId,
    savedCharacterId: sourceCharacterId,
    characterId: sourceCharacterId,
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
    autoRollCharacter: combatCharacter ? {
      ...clonePlain(combatCharacter),
      sourceCharacterId,
      savedCharacterId: sourceCharacterId,
    } : null,
    originalActorMetadata: clonePlain(combatCharacter?.originalActorMetadata || character.originalActorMetadata),
  }));
}

export function findSavedCharacterForStagedEntry(entry = {}, savedCharacters = []) {
  return resolveSavedCharacterForStagedEntry(entry, savedCharacters).character || null;
}

export function resolveStagedSavedCharacterForImport(entry = {}, savedCharacters = []) {
  if (entry?.source !== "saved-character") {
    return {
      ok: true,
      entry: clonePlain(entry),
      source: entry?.source || "staged-entry",
    };
  }

  const resolution = resolveSavedCharacterForStagedEntry(entry, savedCharacters);
  if (resolution.status === "ambiguous") {
    return {
      ok: false,
      reason: "saved character link is ambiguous",
      entryName: entry?.name || "Staged character",
      candidates: resolution.candidates,
    };
  }
  if (resolution.status === "missing") {
    return {
      ok: false,
      reason: "saved character no longer exists",
      entryName: entry?.name || "Staged character",
      savedCharacterId: getStagedSavedCharacterId(entry),
    };
  }

  const savedCharacter = resolution.character;
  const adaptedEntry = adaptPublicCharacterToRosterEntry(savedCharacter);
  const originalActorMetadata = clonePlain(
    resolution.entry.originalActorMetadata || adaptedEntry.originalActorMetadata
  );
  const importEntry = addOriginalActorMetadata({
    ...adaptedEntry,
    stagedEntryId: resolution.entry.stagedEntryId,
    side: resolution.entry.side || adaptedEntry.side,
    team: resolution.entry.team || adaptedEntry.team,
    battleSide: resolution.entry.battleSide || resolution.entry.team || adaptedEntry.battleSide,
    controlMode: resolution.entry.controlMode || adaptedEntry.controlMode,
    originalActorMetadata,
    autoRollCharacter: adaptedEntry.autoRollCharacter
      ? addOriginalActorMetadata({
          ...adaptedEntry.autoRollCharacter,
          originalActorMetadata,
        })
      : null,
  });
  return {
    ok: true,
    entry: importEntry,
    source: "saved-character",
    savedCharacterId: resolution.stableId,
    linkStatus: resolution.status,
    repairedStagedEntry: resolution.entry,
  };
}

export default {
  adaptPublicCharacterToRosterEntry,
  findSavedCharacterForStagedEntry,
  resolveStagedSavedCharacterForImport,
};

import { adaptPublicCharacterForAutoRoll } from "./publicCharacterCombatAdapter.js";
export {
  PUBLIC_ARENA_ROSTER_STORAGE_KEY,
  clearPublicArenaRosterEntries,
  loadPublicArenaRosterEntries,
  savePublicArenaRosterEntries,
  upsertPublicArenaRosterEntry,
} from "./publicStagedRosterStorage.js";

const clonePlain = (value) => {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
};

export function adaptPublicCharacterToRosterEntry(character = {}) {
  const adaptation = adaptPublicCharacterForAutoRoll(character);
  const combatCharacter = adaptation.combatCharacter;
  const publicAbilityScores = character.publicAbilityScores || character.finalAbilityScores;
  const publicAbilityModifiers = character.publicAbilityModifiers || character.abilityModifiers;

  return {
    id: character.id || character._id || `saved-${character.name || "character"}`,
    name: character.name || "Saved Character",
    side: "player",
    source: "saved-character",
    publicClassName: character.publicClassName || combatCharacter?.publicClassName,
    publicSpeciesName: character.publicSpeciesName || combatCharacter?.publicSpeciesName,
    publicBackgroundName: character.publicBackgroundName || combatCharacter?.publicBackgroundName,
    finalAbilityScores: clonePlain(character.finalAbilityScores),
    abilityModifiers: clonePlain(character.abilityModifiers),
    publicAbilityScores: clonePlain(publicAbilityScores),
    publicAbilityModifiers: clonePlain(publicAbilityModifiers),
    publicDerivedStats: clonePlain(character.publicDerivedStats || combatCharacter?.publicDerivedStats),
    compatibilityAttributes: clonePlain(combatCharacter?.attributes),
    attribute_dice: clonePlain(combatCharacter?.attribute_dice),
    autoRollReady: adaptation.ready,
    autoRollMissingFields: [...adaptation.missingRequiredFields],
    autoRollCharacter: combatCharacter ? clonePlain(combatCharacter) : null,
  };
}

export default {
  adaptPublicCharacterToRosterEntry,
};

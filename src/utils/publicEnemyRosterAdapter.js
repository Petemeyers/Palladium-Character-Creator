import { addOriginalActorMetadata } from "./originalActorMetadata.js";

export function adaptPublicEnemyToRosterEntry(enemy = {}) {
  const rosterEntry = addOriginalActorMetadata({
    id: enemy.id,
    name: enemy.name,
    side: "enemy",
    creatureType: enemy.creatureType,
    size: enemy.size,
    armorClass: enemy.armorClass,
    hitPoints: enemy.hitPoints,
    speed: enemy.speed,
    abilityScores: enemy.abilityScores ? { ...enemy.abilityScores } : undefined,
    savingThrows: enemy.savingThrows ? { ...enemy.savingThrows } : undefined,
    skills: enemy.skills ? { ...enemy.skills } : undefined,
    senses: Array.isArray(enemy.senses) ? [...enemy.senses] : undefined,
    languages: Array.isArray(enemy.languages) ? [...enemy.languages] : undefined,
    challengeRating: enemy.challengeRating,
    proficiencyBonus: enemy.proficiencyBonus,
    actions: Array.isArray(enemy.actions) ? enemy.actions.map((action) => ({ ...action })) : [],
    source: "public-enemy",
    ruleset: enemy.ruleset || "core-d20",
    originalSource: enemy.source,
    originalActorMetadata: enemy.originalActorMetadata,
  });

  return rosterEntry;
}

export default {
  adaptPublicEnemyToRosterEntry,
};

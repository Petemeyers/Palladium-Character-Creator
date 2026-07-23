import { addOriginalActorMetadata } from "./originalActorMetadata.js";
import { normalizeReferenceCombatActor } from "./combat/normalizeCombatActorSchema.js";

export function adaptPublicEnemyToRosterEntry(enemy = {}) {
  const rosterEntry = addOriginalActorMetadata({
    id: enemy.id,
    actorKey: enemy.actorKey,
    canonicalActorKey: enemy.canonicalActorKey,
    sourceActorKey: enemy.sourceActorKey || enemy.actorKey,
    pickerId: enemy.pickerId || enemy.id,
    compatibilityId: enemy.compatibilityId,
    sourceEnemyId: enemy.id,
    modelKey: enemy.modelKey,
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
    equipment: Array.isArray(enemy.equipment) ? enemy.equipment.map((item) => ({ ...item })) : [],
    inventory: Array.isArray(enemy.inventory) ? enemy.inventory.map((item) => ({ ...item })) : [],
    weaponProfiles: Array.isArray(enemy.weaponProfiles) ? enemy.weaponProfiles.map((item) => ({ ...item })) : [],
    equippedArmor: enemy.equippedArmor ? { ...enemy.equippedArmor } : undefined,
    equippedShield: enemy.equippedShield ? { ...enemy.equippedShield } : undefined,
    armorProfile: enemy.armorProfile ? { ...enemy.armorProfile } : undefined,
    heldItems: enemy.heldItems ? { ...enemy.heldItems } : undefined,
    alignment: enemy.alignment,
    alignmentName: enemy.alignmentName,
    behavior: enemy.behavior ? { ...enemy.behavior } : undefined,
    grappleProfile: enemy.grappleProfile ? { ...enemy.grappleProfile } : undefined,
    surrenderProfile: enemy.surrenderProfile ? { ...enemy.surrenderProfile } : undefined,
    source: "public-enemy",
    ruleset: enemy.ruleset || "core-d20",
    originalSource: enemy.source,
    originalActorMetadata: enemy.originalActorMetadata,
  });

  return normalizeReferenceCombatActor(rosterEntry, { source: "public-enemy-roster-adapter" }).normalizedActor;
}

export default {
  adaptPublicEnemyToRosterEntry,
};

const weapon = (profileKey, name, damage, damageType, extra = {}) => Object.freeze({
  id: profileKey,
  weaponId: profileKey,
  profileKey,
  name,
  type: "weapon",
  kind: "melee",
  attackType: "melee",
  damage,
  damageDice: damage,
  damageType,
  reach: 5,
  reachFeet: 5,
  naturalWeapon: false,
  isNaturalAttack: false,
  ...extra,
});

const natural = (profileKey, name, damage, damageType, extra = {}) => Object.freeze({
  id: profileKey,
  weaponId: profileKey,
  profileKey,
  name,
  type: "melee",
  kind: "melee",
  attackType: "melee",
  damage,
  damageDice: damage,
  damageType,
  reach: 5,
  reachFeet: 5,
  naturalWeapon: true,
  isNaturalAttack: true,
  manufacturedWeapon: false,
  ...extra,
});

const knightSword = weapon("weapon.long-sword", "Long Sword", "1d8", "slashing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, lengthFt: 3, attackBonus: 3, armorTechniqueCompatibility: ["longsword-cut", "longsword-thrust", "half-sword-thrust", "pommel-or-crossguard-strike"], retainedInClinch: true, usableInClinch: false });
const knightDagger = weapon("weapon.dagger", "Dagger", "1d4", "piercing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, lengthFt: 1, reach: 1, reachFeet: 1, usableInClinch: true, groundedCompatible: true, armorGapCapable: true });
const goblinSword = weapon("weapon.short-sword", "Short Sword", "1d6+2", "slashing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, attackBonus: 4 });
const goblinDagger = weapon("weapon.goblin-dagger", "Dagger", "1d4", "piercing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, reach: 1, reachFeet: 1, usableInClinch: true, groundedCompatible: true });
const minotaurAxe = weapon("weapon.minotaur-heavy-axe", "Heavy Axe", "2d8+4", "slashing", { category: "two-handed", handedness: "two-handed", handsRequired: 2, twoHanded: true, requiresTwoHands: true, reach: 10, reachFeet: 10, lengthFt: 6, attackBonus: 6, usableInClinch: false });
const minotaurGore = natural("natural.minotaur-gore", "Minotaur Gore", "2d6+4", "piercing", { attackMode: "gore", attackBonus: 6, usableInClose: true, usableInClinch: true, groundedCompatible: true });
const minotaurBodySlam = natural("natural.minotaur-body-slam", "Minotaur Body Slam", "2d6+4", "bludgeoning", { attackMode: "body-slam", attackBonus: 6, usableInClose: true, usableInClinch: true, groundedCompatible: true });
const minotaurCharge = natural("natural.minotaur-horn-charge", "Horn Charge", "2d6+4", "piercing", { attackMode: "charge", attackBonus: 6, chargeOnly: true, requiresOpenMelee: true });
const minotaurHeadbutt = natural("natural.minotaur-headbutt", "Headbutt", "2d6+4", "bludgeoning", { attackMode: "headbutt", attackBonus: 6, usableInClose: true, usableInClinch: true });
const minotaurHornHook = natural("natural.minotaur-horn-hook", "Horn Hook", "2d6+4", "piercing", { attackMode: "horn-hook", attackBonus: 6, usableInClose: true, usableInClinch: true });
const minotaurCrush = natural("natural.minotaur-crush", "Crush", "2d6+4", "bludgeoning", { attackMode: "crush", attackBonus: 6, usableInClose: true, usableInClinch: true });

const common = (definition) => Object.freeze({
  combatActorSchemaVersion: 1,
  movementModes: ["ground"],
  playable: true,
  defaultControlMode: "ai",
  ...definition,
  wornArmor: definition.equippedArmor,
  combatWeaponState: {
    readyWeaponId: definition.heldItems?.mainHand ?? null,
    retainedWeaponId: null,
    retainedWeaponDisposition: null,
    clinchWeaponId: null,
    clinchWeaponReady: false,
    droppedWeaponIds: [],
    lastTransitionReason: "canonical-combat-start",
  },
});

export const CANONICAL_COMBAT_ACTORS = Object.freeze({
  knight: common({
    actorKey: "knight", id: "knight", name: "Knight", species: "human", creatureType: "humanoid", category: "human", size: "medium", role: "armored-martial-fighter", modelKey: "knight", source: "public-actor", sourceLabel: "Public Actor", teamDefault: "enemy",
    factionTags: ["human-realms"], cultureTags: ["knightly-retinue"], tags: ["human", "humanoid", "soldier", "knight", "heavy armor"], traitKeys: ["armored_training", "shield_drill", "grapple_capable"], traits: ["armored_training", "shield_drill", "grapple_capable"],
    attributes: { might: 15, deftness: 11, vigor: 12, endurance: 14, mobility: 9, intellect: 10, awareness: 11, cunning: 10, resolve: 13, discipline: 14, presence: 12, renown: 1, favor: 0 }, abilityScores: { strength: 15, dexterity: 11, constitution: 14, intelligence: 10, wisdom: 13, charisma: 12 },
    derivedStats: { hp: 24, maxHp: 24, armorClass: 16, movement: 25 }, movement: { ground: 25, groundPace: 25, burst: 50, runDistance: 50, recoveryStep: 5, terrainMobility: {} }, currentStamina: 28, combatStamina: { authority: "canonical", maximum: 28, current: 28 }, fatigueState: "ready", actionsPerRound: 2, bonuses: { attack: 3, block: 3, evade: 1, damage: 2 },
    alignment: "neutral-good", alignmentName: "Neutral Good", alignmentBehaviorMappingKey: "neutral-good", behaviorProfileKey: "knight-neutral-good", behavior: { aggression: 55, caution: 60, loyalty: 75, instinct: 35, mercy: 82, cruelty: 8, greed: 22, honor: 80, pride: 48, discipline: 72 },
    moraleProfile: { state: "steady", routBehavior: "organized-withdrawal", surrenderEligible: true, terminalEscapeBehavior: "map-boundary" }, surrenderProfile: { mayOfferSurrender: true, mayAcceptSurrender: true, behaviorProfile: "neutral-good", prisonerPreference: "take-prisoner", executionPreference: "avoid", alignmentBehaviorMappingKey: "neutral-good" },
    equipment: [knightSword, knightDagger, { id: "shield.heater", profileKey: "shield.heater", name: "Heater Shield", type: "shield", category: "shield", weight: 8 }, { id: "armor.plate-harness", profileKey: "armor.plate-harness", name: "Plate Harness", type: "armor", category: "heavy", weightClass: "heavy", guardRating: 16, weight: 45 }], inventory: [knightSword, knightDagger],
    equippedArmor: { id: "armor.plate-harness", profileKey: "armor.plate-harness", name: "Plate Harness", type: "armor", category: "heavy", weightClass: "heavy", guardRating: 16, weight: 45 }, equippedShield: { id: "shield.heater", profileKey: "shield.heater", name: "Heater Shield", type: "shield", category: "shield", weight: 8 }, armorProfile: { profileKey: "armor.plate-harness", armorClass: "plate", category: "heavy", weightClass: "heavy", rigidCoverage: true }, heldItems: { mainHand: "weapon.long-sword", offHand: "shield.heater" }, attacks: [knightSword], weaponProfiles: [knightSword, knightDagger],
    grappleProfile: { sizeProfile: "medium", preferredInitiator: true, prefersAssist: false, prefersProneTargets: false, sizeRulesApply: true, canUseSwarmTakedown: false, takedownCompatible: true, groundControlCompatible: true, mayDemandSurrender: true }, aiRole: "melee",
  }),
  "goblin-warrior": common({
    actorKey: "goblin-warrior", id: "goblin-warrior", name: "Goblin Warrior", species: "goblin", creatureType: "humanoid", category: "humanoid", size: "small", role: "opportunistic-skirmisher", modelKey: "goblin-warrior", source: "public-actor", sourceLabel: "Public Actor", teamDefault: "enemy",
    factionTags: ["goblin-warband"], cultureTags: ["warband"], tags: ["goblin", "humanoid", "small", "warband"], traitKeys: ["opportunistic", "pack_fighter", "self_preserving"], traits: ["opportunistic", "pack_fighter", "self_preserving"],
    attributes: { might: 8, deftness: 14, vigor: 10, endurance: 10, mobility: 14, intellect: 10, awareness: 8, cunning: 13, resolve: 8, discipline: 8, presence: 8, renown: 0, favor: 0 }, abilityScores: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
    derivedStats: { hp: 7, maxHp: 7, armorClass: 15, movement: 30 }, movement: { ground: 30, groundPace: 30, burst: 60, runDistance: 60, recoveryStep: 5, terrainMobility: { cramped: 1 } }, currentStamina: 20, combatStamina: { authority: "canonical", maximum: 20, current: 20 }, fatigueState: "ready", actionsPerRound: 2,
    alignment: "chaotic-neutral", alignmentName: "Chaotic Neutral", alignmentBehaviorMappingKey: "chaotic-neutral", behaviorProfileKey: "goblin-chaotic-neutral", behavior: { aggression: 48, caution: 70, loyalty: 42, instinct: 65, mercy: 38, cruelty: 34, greed: 68, honor: 28, pride: 38, discipline: 34, prefersFlanking: true, prefersAssistance: true },
    moraleProfile: { state: "steady", routBehavior: "flee-or-bargain", surrenderEligible: true, terminalEscapeBehavior: "map-boundary" }, surrenderProfile: { mayOfferSurrender: true, mayAcceptSurrender: true, behaviorProfile: "chaotic-neutral", prisonerPreference: "ransom-or-confiscate", executionPreference: "circumstantial", alignmentBehaviorMappingKey: "chaotic-neutral" },
    equipment: [goblinSword, goblinDagger, { id: "shield.small", profileKey: "shield.small", name: "Small Shield", type: "shield" }, { id: "armor.goblin-light", profileKey: "armor.goblin-light", name: "Light Armor", type: "armor", category: "light", guardRating: 15 }], inventory: [goblinSword, goblinDagger], equippedArmor: { id: "armor.goblin-light", profileKey: "armor.goblin-light", name: "Light Armor", type: "armor", category: "light", guardRating: 15 }, equippedShield: { id: "shield.small", profileKey: "shield.small", name: "Small Shield", type: "shield" }, armorProfile: { profileKey: "armor.goblin-light", armorClass: "light", category: "light", rigidCoverage: false }, heldItems: { mainHand: "weapon.short-sword", offHand: "shield.small" }, attacks: [goblinSword], weaponProfiles: [goblinSword, goblinDagger],
    grappleProfile: { sizeProfile: "small", preferredInitiator: false, prefersAssist: true, prefersProneTargets: true, sizeRulesApply: true, canUseSwarmTakedown: true, takedownCompatible: true, groundControlCompatible: true, standingArmoredSoloPreference: "disfavored" }, aiRole: "skirmisher",
  }),
  minotaur: common({
    actorKey: "minotaur", id: "minotaur", name: "Minotaur", species: "minotaur", creatureType: "monstrosity", category: "mythic", size: "large", role: "mythic-brute", modelKey: "minotaur", source: "normalized-legacy-actor", sourceLabel: "Normalized Legacy Actor", teamDefault: "enemy",
    factionTags: ["mythic"], cultureTags: ["labyrinth-born"], tags: ["minotaur", "monstrosity", "mythic", "brute", "grappler", "natural armor"], traitKeys: ["horns", "powerful_build", "terrifying_presence"], traits: ["Terrifying Presence", "horns", "powerful_build"],
    attributes: { might: 19, deftness: 11, vigor: 16, endurance: 16, mobility: 11, intellect: 7, awareness: 12, cunning: 10, resolve: 14, discipline: 10, presence: 15, renown: 2, favor: 0 }, abilityScores: { strength: 19, dexterity: 11, constitution: 16, intelligence: 7, wisdom: 12, charisma: 15 },
    derivedStats: { hp: 52, maxHp: 52, armorClass: 14, movement: 40 }, movement: { ground: 40, groundPace: 40, burst: 80, runDistance: 80, recoveryStep: 5, terrainMobility: {} }, currentStamina: 32, combatStamina: { authority: "canonical", maximum: 32, current: 32 }, fatigueState: "ready", actionsPerRound: 2,
    alignment: "true-neutral", alignmentName: "True Neutral", alignmentBehaviorMappingKey: "true-neutral", behaviorProfileKey: "minotaur-true-neutral", behavior: { aggression: 82, caution: 28, loyalty: 45, instinct: 72, mercy: 34, cruelty: 38, greed: 30, honor: 42, pride: 82, discipline: 50 },
    moraleProfile: { state: "steady", routBehavior: "proud-withdrawal", surrenderEligible: true, terminalEscapeBehavior: "map-boundary" }, surrenderProfile: { mayOfferSurrender: true, mayAcceptSurrender: true, behaviorProfile: "true-neutral", prisonerPreference: "circumstantial", executionPreference: "circumstantial", alignmentBehaviorMappingKey: "true-neutral" },
    equipment: [minotaurAxe], inventory: [minotaurAxe], equippedArmor: { id: "armor.minotaur-hide", profileKey: "armor.minotaur-hide", name: "Natural Hide", type: "natural armor", category: "medium natural armor", weightClass: "medium", lootable: false }, armorProfile: { profileKey: "armor.minotaur-hide", armorClass: "natural", category: "medium natural armor", weightClass: "medium", rigidCoverage: false }, heldItems: { mainHand: "weapon.minotaur-heavy-axe", offHand: null }, attacks: [minotaurAxe, minotaurCharge, minotaurGore, minotaurBodySlam, minotaurHeadbutt, minotaurHornHook, minotaurCrush], weaponProfiles: [minotaurAxe, minotaurCharge, minotaurGore, minotaurBodySlam, minotaurHeadbutt, minotaurHornHook, minotaurCrush],
    grappleProfile: { sizeProfile: "large", preferredInitiator: true, prefersAssist: false, prefersProneTargets: true, sizeRulesApply: true, canUseSwarmTakedown: false, powerfulBuild: true, takedownCompatible: true, groundControlCompatible: true, liftRequiresExplicitAction: true, throwRequiresExplicitAction: true }, aiRole: "brute",
  }),
});

export function getCanonicalCombatActorDefinition(actorKey) {
  return CANONICAL_COMBAT_ACTORS[String(actorKey || "").toLowerCase()] || null;
}

export default CANONICAL_COMBAT_ACTORS;

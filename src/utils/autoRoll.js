/**
 * Auto-roll utilities for playable characters in combat
 */

import {
  rollDice,
  rollDiceDetailed,
  rollHP as rollHPFromDice,
} from "./dice.js";

/**
 * Roll attributes for a playable character using their attribute_dice
 * @param {Object} character - Character data with attribute_dice
 * @returns {Object} - Rolled attribute values
 */
export function rollCharacterAttributes(character) {
  if (!character.attribute_dice) {
    return {};
  }

  const attributes = {};
  const attributeNames = ["IQ", "ME", "MA", "PS", "PP", "PE", "PB", "Spd"];

  attributeNames.forEach((attr) => {
    if (character.attribute_dice[attr]) {
      attributes[attr] = rollDice(character.attribute_dice[attr]);
    }
  });

  return attributes;
}

/**
 * Calculate combat bonuses based on rolled attributes
 * @param {Object} attributes - Rolled attribute values
 * @param {Object} character - Character data
 * @returns {Object} - Combat bonuses
 */
export function calculateCombatBonuses(attributes, character) {
  const bonuses = character.bonuses ? { ...character.bonuses } : {};

  // Calculate bonuses based on attributes
  if (attributes.PS) {
    // Physical Strength bonuses
    if (attributes.PS >= 16) bonuses.damage = (bonuses.damage || 0) + 2;
    if (attributes.PS >= 20) bonuses.damage = (bonuses.damage || 0) + 1;
    if (attributes.PS >= 24) bonuses.damage = (bonuses.damage || 0) + 1;
  }

  if (attributes.PP) {
    // Physical Prowess bonuses
    if (attributes.PP >= 16) bonuses.strike = (bonuses.strike || 0) + 1;
    if (attributes.PP >= 20) bonuses.parry = (bonuses.parry || 0) + 1;
    if (attributes.PP >= 24) bonuses.dodge = (bonuses.dodge || 0) + 1;
  }

  return bonuses;
}

/**
 * Roll HP for a playable character
 * @param {Object} character - Character data
 * @param {Object} attributes - Rolled attribute values
 * @returns {number} - Rolled HP
 */
export function rollPlayableCharacterHP(character, attributes) {
  if (character.HP && character.HP !== "Variable") {
    // Use rollHP which handles both dice notation (2d6) and ranges (2-12)
    return rollHPFromDice(character.HP);
  }

  // Calculate HP based on PE (Physical Endurance)
  const baseHP = attributes.PE || 10;
  const classBonus = getClassHPBonus(character.occ);

  return Math.max(1, baseHP + classBonus);
}

/**
 * Get HP bonus based on character class
 * @param {string} occ - Occupational Character Class
 * @returns {number} - HP bonus
 */
function getClassHPBonus(occ) {
  const classBonuses = {
    "Mercenary Fighter": 8,
    Soldier: 10,
    Knight: 12,
    Paladin: 14,
    "Long Bowman": 8,
    Ranger: 10,
    Thief: 6,
    Assassin: 8,
    Wizard: 4,
    Witch: 6,
    Warlock: 8,
    Diabolist: 6,
    Summoner: 8,
    "Mind Mage": 6,
    Priest: 10,
    Druid: 8,
    Shaman: 12,
    Healer: 8,
    Merchant: 6,
    Scholar: 4,
  };

  return classBonuses[occ] || 6;
}

/**
 * Convert a playable character to a combat-ready fighter
 * @param {Object} character - Character data from bestiary
 * @param {string} customName - Optional custom name
 * @returns {Object} - Combat-ready fighter object
 */
export function createPlayableCharacterFighter(character, customName = null) {
  // Roll attributes
  const attributes = rollCharacterAttributes(character);

  // Calculate bonuses
  const bonuses = calculateCombatBonuses(attributes, character);

  // Roll HP
  const rolledHP = rollPlayableCharacterHP(character, attributes);

  // Calculate AR (Armor Rating) - default if not specified
  const ar = character.AR || calculateDefaultAR(character, attributes);

  // Calculate Speed
  const speed =
    character.Spd || character.spd || attributes.Spd || attributes.spd || 18;

  const processedAttacks =
    (character.attacks || []).length > 0
      ? (character.attacks || []).map((attack) => {
          if (
            attack.damage &&
            (attack.damage.includes("by weapon") ||
              attack.damage === "by spell" ||
              attack.damage === "variable")
          ) {
            const defaultDamage = getDefaultWeaponDamage(
              character.preferred_weapons
            );

            if (attack.damage === "by spell") {
              return { ...attack, damage: "2d6" };
            }

            return { ...attack, damage: defaultDamage };
          } else if (!attack.damage) {
            return { ...attack, damage: "1d6" };
          }
          return attack;
        })
      : [{ name: "Unarmed Strike", damage: "1d4", count: 1 }];

  const derivedWeapons = processedAttacks
    .filter(
      (attack) =>
        typeof attack.damage === "string" &&
        attack.damage.toLowerCase() !== "by spell" &&
        attack.name
    )
    .map((attack, index) => {
      const attackName = attack.name.toLowerCase();
      const isRanged =
        (typeof attack.range === "number" && attack.range > 10) ||
        attackName.includes("bow") ||
        attackName.includes("arrow") ||
        attackName.includes("sling") ||
        attackName.includes("crossbow") ||
        attackName.includes("bolt");

      return {
        name: attack.name,
        damage: attack.damage,
        slot: index === 0 ? "Right Hand" : `Slot ${index + 1}`,
        type: isRanged ? "ranged" : "melee",
        category: isRanged ? "ranged" : "melee",
        range: typeof attack.range === "number" ? attack.range : undefined,
        reach: attack.reach,
      };
    });

  if (derivedWeapons.length === 0) {
    derivedWeapons.push({
      name: "Unarmed Strike",
      damage: "1d4",
      slot: "Right Hand",
      type: "melee",
      category: "unarmed",
      range: 5.5,
      reach: 5.5,
    });
  }

  derivedWeapons.primary = derivedWeapons[0];
  derivedWeapons.secondary = derivedWeapons[1] || null;

  // Create fighter object
  const fighter = {
    id: `playable-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    name: customName || character.name,
    type: "enemy", // Treat as enemy for combat purposes
    category: character.category,
    playable: true,
    race: character.race,
    occ: character.occ,
    alignment: character.alignment_options?.[0] || "unaligned",
    size: character.size,

    // Combat stats
    HP: character.HP,
    currentHP: rolledHP,
    maxHP: rolledHP,
    AR: ar,
    spd: speed,

    // Attributes (for reference)
    attributes: attributes,

    // Combat bonuses
    bonuses: bonuses,

    // Attacks - convert "by weapon" to default weapon damage
    attacks: processedAttacks,

    // Special abilities
    abilities: character.special_abilities || [],
    magic: character.magic || [],
    psionics: character.psionics,
    psionicPowers: character.psionicPowers || [],
    ISP: character.ISP || 0,
    PPE: character.PPE || 0,

    // Combat state
    initiative: 0,
    status: "active",

    equippedWeapons: derivedWeapons,
    equipped: {
      weaponPrimary: derivedWeapons[0],
      weaponSecondary: derivedWeapons[1] || null,
    },

    // Metadata
    description: character.description,
    lifeSpan: character.lifeSpan,
  };

  return fighter;
}

/**
 * Get default weapon damage based on preferred weapons
 * @param {string} preferredWeapons - Preferred weapons description
 * @returns {string} - Damage dice notation
 */
function getDefaultWeaponDamage(preferredWeapons) {
  if (!preferredWeapons) return "1d6";

  const weapons = preferredWeapons.toLowerCase();

  // Heavy two-handed weapons
  if (
    weapons.includes("two-handed") ||
    weapons.includes("battle axe") ||
    weapons.includes("polearm") ||
    weapons.includes("pole arm")
  ) {
    return "2d6";
  }

  // Large swords
  if (weapons.includes("large sword")) {
    return "2d6";
  }

  // Long bows
  if (weapons.includes("long bow")) {
    return "2d6";
  }

  // Short swords, knives, standard weapons
  if (weapons.includes("short sword") || weapons.includes("sword")) {
    return "2d4";
  }

  // Small weapons (knives, daggers)
  if (weapons.includes("knife") || weapons.includes("dagger")) {
    return "1d4";
  }

  // Blunt weapons
  if (
    weapons.includes("blunt") ||
    weapons.includes("mace") ||
    weapons.includes("hammer")
  ) {
    return "1d6";
  }

  // Bows
  if (weapons.includes("bow")) {
    return "1d6";
  }

  // Default
  return "1d6";
}

/**
 * Calculate default AR based on character attributes and class
 * @param {Object} character - Character data
 * @param {Object} attributes - Rolled attribute values
 * @returns {number} - Default AR
 */
function calculateDefaultAR(character, attributes) {
  let baseAR = 8; // Default AR

  // Adjust based on class
  if (character.occ) {
    const classARBonuses = {
      Knight: 4,
      Paladin: 4,
      Soldier: 3,
      "Mercenary Fighter": 2,
      Ranger: 2,
      Thief: 1,
      Assassin: 1,
      Wizard: -1,
      Priest: 2,
      Healer: 1,
    };

    baseAR += classARBonuses[character.occ] || 0;
  }

  // Adjust based on PE (Physical Endurance)
  if (attributes.PE) {
    if (attributes.PE >= 16) baseAR += 1;
    if (attributes.PE >= 20) baseAR += 1;
  }

  return Math.max(1, baseAR);
}

/**
 * Auto-roll initiative for a playable character
 * @param {Object} fighter - Combat fighter object
 * @returns {number} - Initiative roll
 */
export function rollPlayableCharacterInitiative(fighter) {
  const speedBonus = fighter.bonuses?.initiative || 0;
  const initiativeRoll = rollDice(`1d20+${speedBonus}`);
  return (
    initiativeRoll +
    (fighter.Spd ||
      fighter.spd ||
      fighter.attributes?.Spd ||
      fighter.attributes?.spd ||
      18)
  );
}

/**
 * Get detailed roll information for logging
 * @param {Object} character - Character data
 * @param {Object} attributes - Rolled attributes
 * @returns {Object} - Detailed roll information
 */
export function getPlayableCharacterRollDetails(character, attributes) {
  const details = {
    character: character.name,
    category: character.category,
    attributes: {},
    combatStats: {},
  };

  // Attribute rolls
  Object.keys(character.attribute_dice || {}).forEach((attr) => {
    const dice = character.attribute_dice[attr];
    const roll = rollDiceDetailed(dice);
    details.attributes[attr] = {
      dice: dice,
      roll: roll,
      value: attributes[attr],
    };
  });

  // Combat stats
  details.combatStats.HP = rollPlayableCharacterHP(character, attributes);
  details.combatStats.AR =
    character.AR || calculateDefaultAR(character, attributes);
  details.combatStats.bonuses = calculateCombatBonuses(attributes, character);

  return details;
}

export default {
  rollCharacterAttributes,
  calculateCombatBonuses,
  rollPlayableCharacterHP,
  createPlayableCharacterFighter,
  rollPlayableCharacterInitiative,
  getPlayableCharacterRollDetails,
};

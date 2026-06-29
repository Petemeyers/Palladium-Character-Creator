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
  const attributeRolls = {}; // Store detailed roll info for logging
  const attributeNames = ["IQ", "ME", "MA", "PS", "PP", "PE", "PB", "Spd"];

  attributeNames.forEach((attr) => {
    if (character.attribute_dice[attr]) {
      const diceNotation = character.attribute_dice[attr];
      const rollResult = rollDiceDetailed(diceNotation);
      attributes[attr] = rollResult.total; // rollDiceDetailed returns 'total', not 'totalWithBonus'
      attributeRolls[attr] = rollResult; // Store for later use
      
      // Debug logging for attribute rolls
      // rollDiceDetailed returns { total, rolls: number[], notation }
      const rollBreakdown = rollResult.rolls?.join(' + ') || rollResult.total;
      const bonus = rollResult.bonus ? ` + ${rollResult.bonus}` : '';
      console.log(`ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â² ${character.name || 'Character'} ${attr}: ${diceNotation} = [${rollBreakdown}]${bonus} = ${attributes[attr]}`);
    }
  });

  // Store roll details on attributes object for getPlayableCharacterRollDetails
  attributes._rollDetails = attributeRolls;

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
    if (attributes.PP >= 16) bonuses.attack = (bonuses.attack || 0) + 1;
    if (attributes.PP >= 20) bonuses.block = (bonuses.block || 0) + 1;
    if (attributes.PP >= 24) bonuses.evade = (bonuses.evade || 0) + 1;
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
  const classBonus = getClassHPBonus(character.profession);

  return Math.max(1, baseHP + classBonus);
}

/**
 * Get HP bonus based on character class
 * @param {string} profession - profession
 * @returns {number} - HP bonus
 */
function getClassHPBonus(profession) {
  const classBonuses = {
    "Mercenary Fighter": 8,
    Soldier: 10,
    Knight: 12,
    Paladin: 14,
    "Long Bowman": 8,
    Ranger: 10,
    Thief: 6,
    Assassin: 8,
    Duelist: 4,
    Witch: 6,
    Mercenary: 8,
    Diabolist: 6,
    Summoner: 8,
    "Tactician": 6,
    Priest: 10,
    Druid: 8,
    Shaman: 12,
    Healer: 8,
    Merchant: 6,
    Scholar: 4,
  };

  return classBonuses[profession] || 6;
}

/**
 * Convert a playable character to a combat-ready fighter
 * @param {Object} character - Character data from arenaRoster
 * @param {string} customName - Optional custom name
 * @returns {Object} - Combat-ready fighter object
 */
import { assignRandomWeaponToEnemy } from './enemyWeaponAssigner.js';
import shopItems from '../data/shopItems.js';
import armorShopData from '../data/armorShopData.js';
import {
  createEmptyLayeredEquipment,
  equipLayer,
  normalizeEquipmentItem,
  syncLegacyArmorFields,
} from './equipmentManager.js';
import { getUnifiedAbilities } from './unifiedAbilities.js';
import { convertTechniqueToCombatTechnique } from './getFighterTechniques.js';
import { getAllTechniquesFromDB } from '../data/combatTechniques.js';
import {
  isDuelistClassName,
  buildDuelistTechniqueBookForLevel,
  createDeterministicRng,
  normalizestaminaState,
} from './techniqueUtils.js';
import { addOriginalActorMetadata } from './originalActorMetadata.js';

export function createPlayableCharacterFighter(character, customName = null) {
  // Roll attributes
  const attributes = rollCharacterAttributes(character);

  // Calculate bonuses
  const bonuses = calculateCombatBonuses(attributes, character);

  // Roll HP
  const rolledHP = rollPlayableCharacterHP(character, attributes);

  // Calculate guardRating (Armor Rating) - default if not specified
  let guardRating = character.guardRating || calculateDefaultAR(character, attributes);
  let assignedArmor = null;
  
  // Knightly playable fighters should have real visible plate armor, not an guardRating-only value.
  const professionLabel = String(character.profession || character.PROFESSION || character.className || "").toLowerCase();
  const nameLabel = String(character.name || "").toLowerCase();
  const isKnightlyPlayable =
    professionLabel.includes("knight") ||
    professionLabel.includes("paladin") ||
    nameLabel.includes("knight") ||
    nameLabel.includes("paladin");
  if (isKnightlyPlayable) {
    const heavyArmors = armorShopData?.heavyArmor || [];
    const selectedArmor =
      heavyArmors.find((armor) => armor.name === "Plate Mail") ||
      heavyArmors.find((armor) => armor.name === "Field Plate") ||
      heavyArmors.find((armor) => String(armor.name || "").toLowerCase().includes("plate")) ||
      { name: "Plate Mail", type: "heavy", guardRating: 16, armorDurability: 80, weight: 50 };
    assignedArmor = {
      name: selectedArmor.name,
      type: "armor",
      category: selectedArmor.type || "heavy",
      guardRating: Number(selectedArmor.guardRating ?? selectedArmor.guardRating ?? 16) || 16,
      guardRating: Number(selectedArmor.guardRating ?? selectedArmor.guardRating ?? 16) || 16,
      armorDurability: Number(selectedArmor.armorDurability ?? selectedArmor.armorDurability ?? 80) || 80,
      currentarmorDurability: Number(selectedArmor.currentarmorDurability ?? selectedArmor.armorDurability ?? selectedArmor.armorDurability ?? 80) || 80,
      maxarmorDurability: Number(selectedArmor.armorDurability ?? selectedArmor.armorDurability ?? 80) || 80,
      weight: selectedArmor.weight,
      cost: selectedArmor.cost,
      equistaminad: true,
    };
    guardRating = Math.max(guardRating, assignedArmor.guardRating);
    console.log(`${character.name || 'Knight'} equistaminad with ${assignedArmor.name} (guardRating: ${guardRating})`);
  }

  // Calculate Speed
  const speed =
    character.Spd || character.spd || attributes.Spd || attributes.spd || 18;

  // Assign weapons from rulebook/preferred_weapons
  let assignedWeapons = [];
  if (character.preferred_weapons) {
    const tempFighter = { name: character.name, race: character.race, species: character.race, profession: character.profession };
    const weaponAssigned = assignRandomWeaponToEnemy(tempFighter, character.preferred_weapons);
    if (weaponAssigned.equistaminadWeapons && weaponAssigned.equistaminadWeapons.length > 0) {
      assignedWeapons = weaponAssigned.equistaminadWeapons.filter(w => w.name !== "Unarmed");
      console.log(`ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â ${character.name || 'Character'} assigned weapon: ${assignedWeapons.map(w => w.name).join(', ')}`);
    }
  }

  const normalizeName = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ""); // strips spaces, slashes, dashes, etc.

  const processedAttacks =
    (character.attacks || []).length > 0
      ? (character.attacks || []).map((attack) => {
          if (
            attack.damage &&
            (String(attack.damage).includes("by weapon") ||
              attack.damage === "by technique" ||
              attack.damage === "variable")
          ) {
            const attackName = String(attack.name || "");
            const attackNorm = normalizeName(attackName);

            // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Prefer an assigned weapon for "by weapon" attacks.
            // Handle name mismatches like "Longbow" vs "Long Bow" and "Bow/Long Bow" slashes.
            let assignedWeapon =
              assignedWeapons.find((w) => {
                const wn = normalizeName(w?.name);
                if (!wn) return false;
                return attackNorm.includes(wn) || wn.includes(attackNorm);
              }) || null;

            // Special-case: "Weapon (preferred)" should inherit the primary assigned weapon.
            if (!assignedWeapon && attackNorm.includes("weaponpreferred")) {
              assignedWeapon = assignedWeapons[0] || null;
            }

            // Special-case: bow attacks should inherit the first assigned bow/longbow/etc.
            if (!assignedWeapon && attackNorm.includes("bow")) {
              assignedWeapon =
                assignedWeapons.find((w) => normalizeName(w?.name).includes("bow")) ||
                assignedWeapons[0] ||
                null;
            }

            if (assignedWeapon && assignedWeapon.damage) {
              return { ...attack, damage: assignedWeapon.damage };
            }

            const defaultDamage = getDefaultWeaponDamage(character.preferred_weapons);

            if (attack.damage === "by technique") {
              return { ...attack, damage: "2d6" };
            }

            return { ...attack, damage: defaultDamage };
          } else if (!attack.damage) {
            return { ...attack, damage: "1d6" };
          }
          return attack;
        })
      : assignedWeapons.length > 0
      ? assignedWeapons.map((w) => ({
          name: w.name,
          damage: w.damage || "1d6",
          count: 1,
        }))
      : [{ name: "Unarmed Attack", damage: "1d4", count: 1 }];

  // Use assigned weapons if available, otherwise derive from attacks
  let derivedWeapons = [];
  if (assignedWeapons.length > 0) {
    derivedWeapons = assignedWeapons.map((weapon, index) => {
      const attackName = weapon.name.toLowerCase();
      const isRanged =
        (typeof weapon.range === "number" && weapon.range > 10) ||
        attackName.includes("bow") ||
        attackName.includes("arrow") ||
        attackName.includes("sling") ||
        attackName.includes("crossbow") ||
        attackName.includes("bolt");

      return {
        name: weapon.name,
        damage: weapon.damage || "1d6",
        slot: index === 0 ? "Right Hand" : `Slot ${index + 1}`,
        type: isRanged ? "ranged" : "melee",
        category: isRanged ? "ranged" : "melee",
        range: weapon.range,
        reach: weapon.reach,
      };
    });
  } else {
    derivedWeapons = processedAttacks
      .filter(
        (attack) =>
          typeof attack.damage === "string" &&
          attack.damage.toLowerCase() !== "by technique" &&
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
  }

  if (derivedWeapons.length === 0) {
    derivedWeapons.push({
      name: "Unarmed Attack",
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
  const layeredEquipment = createEmptyLayeredEquipment();
  layeredEquipment.held.mainHand = derivedWeapons[0] || null;
  layeredEquipment.held.offHand = derivedWeapons[1] || null;
  if (assignedArmor) {
    const normalizedArmor = normalizeEquipmentItem({ ...assignedArmor, slot: "torso" });
    const result = equipLayer(layeredEquipment.worn, normalizedArmor);
    if (result.equistaminad) layeredEquipment.worn = result.worn;
  }

  // Determine size category based on race (default to MEDIUM for humans/standard races)
  let sizeCategory = "MEDIUM";
  const raceLower = (character.race || "").toLowerCase();
  if (raceLower.includes("heavy") || raceLower.includes("champion") || raceLower.includes("heavy fighter")) {
    sizeCategory = "LARGE";
  } else if (raceLower.includes("human") || raceLower.includes("halfling") || raceLower.includes("gnome")) {
    sizeCategory = "SMALL";
  } else if (raceLower.includes("human") || raceLower.includes("human") || raceLower.includes("knight")) {
    sizeCategory = "MEDIUM";
  }
  
  // Set height/weight defaults based on race for size calculation
  const height = character.height || (sizeCategory === "LARGE" ? 8 : sizeCategory === "SMALL" ? 3.5 : 5.5);
  const weight = character.weight || (sizeCategory === "LARGE" ? 300 : sizeCategory === "SMALL" ? 80 : 150);

  // Create fighter object
  const fighter = {
    id: `playable-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    name: customName || character.name,
    type: "enemy", // Treat as enemy for combat purposes
    category: character.category,
    playable: true,
    race: character.race,
    profession: character.profession,
    alignment: character.alignment_options?.[0] || "unaligned",
    size: character.size || sizeCategory,
    sizeCategory: sizeCategory,
    height: height,
    weight: weight,

    // Combat stats
    HP: character.HP,
    currentHP: rolledHP,
    maxHP: rolledHP,
    guardRating: guardRating,
    equistaminadArmor: assignedArmor?.name || character.equistaminadArmor || character.armorName || null,
    armor: assignedArmor || character.armor || null,
    spd: speed,

    // Attributes (for reference)
    attributes: attributes,

    // Combat bonuses
    bonuses: bonuses,

    // Attacks - convert "by weapon" to default weapon damage
    attacks: processedAttacks,

    // Special abilities
    abilities: character.special_abilities || [],
    training: character.training || [],
    tactics: character.tactics,
    tacticalOptions: character.tacticalOptions || [],
    focus: character.focus || 0,
    currentfocus: typeof character.currentfocus === "number" ? character.currentfocus : (character.focus || 0), // Initialize currentfocus from focus
    stamina: character.stamina || 0,

    // Combat state
    initiative: 0,
    status: "active",

    equistaminadWeapons: derivedWeapons,
    equipment: layeredEquipment,
    equistaminad: {
      weaponPrimary: derivedWeapons[0],
      weaponSecondary: derivedWeapons[1] || null,
      ...(assignedArmor ? { chest: assignedArmor } : {}),
    },

    // Metadata
    description: character.description,
    lifeSpan: character.lifeSpan,
    
    // Initialize altitude for flying combatants (starts at 0 = grounded)
    // Altitude is tracked in 5ft increments, similar to hex distances
    altitude: 0,
    altitudeFeet: 0,

    // Preserve visual and footprint for 3D rendering (explicit copy so nested arenaRoster shape is kept)
    visual: character.visual
      ? {
          ...character.visual,
          modelUrl: character.visual.modelUrl,
          desiredHeightFt: character.visual.desiredHeightFt ?? character.visual.baseHeightFt,
          baseHeightFt: character.visual.baseHeightFt ?? character.visual.desiredHeightFt,
          yawOffsetDeg: character.visual.yawOffsetDeg ?? 0,
        }
      : {},
    footprint: character.footprint
      ? {
          ...character.footprint,
          feet: character.footprint.feet,
          radiusHex: character.footprint.radiusHex ?? 0,
        }
      : {},
  };

  // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Normalize techniques into a consistent combat-ready shape.
  Object.assign(fighter, syncLegacyArmorFields(fighter));

  // Some flows (e.g. arenaRoster/autoRoll fighters) won't have techniques in the same place as party fighters.
  try {
    const unified = getUnifiedAbilities(character);
    const unifiedTechniques =
      unified?.techniques ||
      unified?.training?.techniques ||
      unified?.training ||
      character?.knownTechniques ||
      character?.techniqueBook ||
      character?.techniques ||
      [];
    const rawCombatTechniques = Array.isArray(unifiedTechniques)
      ? unifiedTechniques.map(convertTechniqueToCombatTechnique).filter(Boolean)
      : [];

    const professionOrClass = character?.profession || character?.class || fighter?.profession || "";
    const fighterLevel = Number(character?.level ?? character?.Level ?? 1) || 1;
    let combatTechniques = rawCombatTechniques;

    // Enfraidere duelist progression for playable duelist PCs so level 1 does not get endgame techniqueBooks.
    if (isDuelistClassName(professionOrClass)) {
      const techniquePool = combatTechniques.length > 0 ? combatTechniques : getAllTechniquesFromDB();
      const bounded = buildDuelistTechniqueBookForLevel({
        allTechniques: techniquePool,
        level: fighterLevel,
      });
      combatTechniques = bounded.techniqueBook.map(convertTechniqueToCombatTechnique).filter(Boolean);
    }

    fighter.knownTechniques = combatTechniques;
    fighter.techniques = combatTechniques;
    // keep a simple "has training" signal for AI heuristics
    fighter.training = (combatTechniques.length > 0) ? true : fighter.training;
    fighter.abilities = fighter.abilities || {};
    if (combatTechniques.length > 0) fighter.abilities.training = combatTechniques;
  } catch (_err) {
    // fail silently; techniques are optional for many fighters
  }

  const normalizedstamina = normalizestaminaState(
    {
      ...fighter,
      level: Number(character?.level ?? character?.Level ?? 1) || 1,
    },
    {
      rollMissingLevelGains: true,
      rng: createDeterministicRng(
        `${fighter.id || fighter.name || "auto-roll"}|auto-roll|${fighter.level || 1}`
      ),
    }
  );
  fighter.stamina = normalizedstamina.stamina;
  fighter.maxstamina = normalizedstamina.maxstamina;
  fighter.currentstamina = normalizedstamina.currentstamina;
  fighter.staminaType = normalizedstamina.staminaType;
  fighter.staminaBase = normalizedstamina.staminaBase;
  fighter.staminaLevelGainsTotal = normalizedstamina.staminaLevelGainsTotal;
  fighter.staminaLevelGainRolls = normalizedstamina.staminaLevelGainRolls;

  return addOriginalActorMetadata({
    ...fighter,
    originalActorMetadata: character.originalActorMetadata,
  });
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
 * Calculate default guardRating based on character attributes and class
 * @param {Object} character - Character data
 * @param {Object} attributes - Rolled attribute values
 * @returns {number} - Default guardRating
 */
function calculateDefaultAR(character, attributes) {
  let baseGuardRating = 8; // Default guardRating

  // Adjust based on class
  if (character.profession) {
    const classARBonuses = {
      Knight: 4,
      Paladin: 4,
      Soldier: 3,
      "Mercenary Fighter": 2,
      Ranger: 2,
      Thief: 1,
      Assassin: 1,
      Duelist: -1,
      Priest: 2,
      Healer: 1,
    };

    baseGuardRating += classARBonuses[character.profession] || 0;
  }

  // Adjust based on PE (Physical Endurance)
  if (attributes.PE) {
    if (attributes.PE >= 16) baseGuardRating += 1;
    if (attributes.PE >= 20) baseGuardRating += 1;
  }

  return Math.max(1, baseGuardRating);
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

  // Attribute rolls - use stored roll details if available, otherwise roll again
  Object.keys(character.attribute_dice || {}).forEach((attr) => {
    const dice = character.attribute_dice[attr];
    // Use stored roll details if available (from rollCharacterAttributes)
    const roll = attributes._rollDetails?.[attr] || rollDiceDetailed(dice);
    details.attributes[attr] = {
      dice: dice,
      roll: roll,
      value: attributes[attr],
    };
  });

  // Combat stats
  details.combatStats.HP = rollPlayableCharacterHP(character, attributes);
  details.combatStats.guardRating =
    character.guardRating || calculateDefaultAR(character, attributes);
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

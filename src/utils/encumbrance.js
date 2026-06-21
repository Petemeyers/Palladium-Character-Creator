// Encumbrance calculation utilities for Medieval Combat Simulator
import movementData from "../data/movement.json";
import {
  getNeutralWeaponWeight,
  getCreatureSize,
  getLegacyWeaponSizeCompatibility,
} from "./publicRulesAdapter.js";

function getEncumbranceSizeContext(character) {
  const creatureSize = getCreatureSize(character);
  const legacySizeContext = getLegacyWeaponSizeCompatibility(character);

  return {
    creatureSize,
    legacySizeContext,
  };
}

// Calculate total weight of character's inventory
// @param {Array} inventory - Character's inventory array
// @param {Object} character - Character object (optional, for size-based weight adjustments)
export function calculateEncumbrance(inventory, character = null) {
  if (!inventory || !Array.isArray(inventory)) return 0;

  return inventory.reduce((total, item) => {
    let itemWeight = item.weight || 0;
    
    // Apply size-based weight adjustments for weapons if character provided
    if (character && item.type && (item.type.toLowerCase() === 'weapon' || item.damage)) {
      if (character.sizePolicy === "neutral-size") {
        itemWeight = getNeutralWeaponWeight(itemWeight, character);
        return total + itemWeight;
      }

      try {
        const { getAdjustedWeaponWeight } = require('./weaponSizeSystem.js');
        const race = character.species || character.race;
        if (race) {
          itemWeight = getAdjustedWeaponWeight(itemWeight, race, character);
        }
      } catch (e) {
        // If weaponSizeSystem not available, use base weight
      }
    }
    
    return total + itemWeight;
  }, 0);
}

// Calculate maximum carry capacity based on Physical Strength (PS) and race
export function calculateMaxCarry(ps, race = "Human") {
  const multiplier = movementData.movement.carryingCapacity[race] || 10;
  return Math.max(ps * multiplier, 10); // Minimum 10 pounds
}

// Get encumbrance penalties based on weight ratio (Medieval Combat Simulator rules)
export function getEncumbrancePenalty(carryWeight, maxCarry) {
  const ratio = carryWeight / maxCarry;

  if (ratio <= 0.4) {
    return {
      initiative: 0,
      speed: 0,
      skill: 0,
      attack: 0,
      evade: 0,
      description: "Light load",
    };
  } else if (ratio <= 0.7) {
    return {
      initiative: 0,
      speed: -10,
      skill: -5,
      attack: -1,
      evade: -1,
      description: "Medium load",
    };
  } else if (ratio <= 1.0) {
    return {
      initiative: 0,
      speed: -30,
      skill: -10,
      attack: -2,
      evade: -2,
      description: "Heavy load",
    };
  } else {
    return {
      initiative: -4,
      speed: -50,
      skill: -20,
      attack: -3,
      evade: -3,
      description: "Overloaded",
    };
  }
}

// Get encumbrance status color for UI
export function getEncumbranceColor(ratio) {
  if (ratio <= 0.5) return "green";
  if (ratio <= 0.75) return "yellow";
  if (ratio <= 1.0) return "orange";
  return "red";
}

// Get armor penalties based on equistaminad armor
export function getArmorPenalty(character) {
  if (!character.equistaminadArmor || !character.inventory) {
    return { spdPenalty: 0, skillPenalty: 0, fatigueRate: 1 };
  }

  const armor = character.inventory.find(
    (item) => item.name === character.equistaminadArmor && item.type === "armor"
  );

  if (!armor) {
    return { spdPenalty: 0, skillPenalty: 0, fatigueRate: 1 };
  }

  // Determine armor type based on name
  const armorName = armor.name.toLowerCase();

  if (
    armorName.includes("cloth") ||
    armorName.includes("padding") ||
    armorName.includes("leather")
  ) {
    return movementData.movement.armorPenalties.lightArmor;
  } else if (
    armorName.includes("chain") ||
    armorName.includes("scale") ||
    armorName.includes("splint")
  ) {
    return movementData.movement.armorPenalties.heavyArmor;
  } else if (armorName.includes("plate")) {
    return movementData.movement.armorPenalties.fullPlate;
  } else {
    return movementData.movement.armorPenalties.lightArmor;
  }
}

// Calculate encumbrance info for a character
export function getEncumbranceInfo(character) {
  const sizeContext = getEncumbranceSizeContext(character);
  const currentWeight = calculateEncumbrance(character.inventory, character);
  const maxWeight =
    character.carryWeight?.maxWeight ||
    calculateMaxCarry(character.attributes?.PS || 10, character.species);
  const ratio = currentWeight / maxWeight;
  const penalty = getEncumbrancePenalty(currentWeight, maxWeight);
  const armorPenalty = getArmorPenalty(character);

  return {
    currentWeight,
    maxWeight,
    ratio,
    penalty,
    armorPenalty,
    color: getEncumbranceColor(ratio),
    isOverloaded: ratio > 1.0,
    totalSpeedPenalty: penalty.speed + armorPenalty.spdPenalty,
    totalSkillPenalty: penalty.skill + armorPenalty.skillPenalty,
    creatureSize: sizeContext.creatureSize,
    sizeRank: sizeContext.legacySizeContext.sizeRank,
  };
}

// Format encumbrance display text
export function formatEncumbranceDisplay(character) {
  const info = getEncumbranceInfo(character);
  const penalties = [];

  if (info.penalty.speed !== 0)
    penalties.push(`Spd-${Math.abs(info.penalty.speed)}%`);
  if (info.armorPenalty.spdPenalty !== 0)
    penalties.push(`Armor-${Math.abs(info.armorPenalty.spdPenalty)}%`);
  if (info.penalty.skill !== 0)
    penalties.push(`Skills-${Math.abs(info.penalty.skill)}%`);

  const penaltyText = penalties.length > 0 ? ` (${penalties.join(", ")})` : "";

  return `${info.currentWeight}/${info.maxWeight} lbs${penaltyText}`;
}

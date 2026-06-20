/**
 * Weapon Bonus AI System
 * Evaluates weapons for bonuses and recommends optimal weapon selection and positioning
 * Prioritizes weapons with bonuses and closing distance for close-range bonuses
 */

import { getWeaponLength, getWeaponType } from './combatEnvironmentLogic.js';
import { calculateReachAdvantage } from './weaponSystem.js';
import { compareWeaponReach } from './reachCombatRules.js';
import { getReachAttackModifiers, needsToCloseDistance, attemptCloseDistance } from './reachCombatRules.js';
import { getWeaponBonuses } from './weaponSlotManager.js';
import { getAdjustedWeaponDamage, getWeaponSizeForRace, WEAPON_SIZE } from './weaponSizeSystem.js';
import {
  getCreatureSize5e,
  getCreatureSizeRank5e,
  getLegacyWeaponSizeCompatibility,
} from "./size5eAdapter.js";
import { getSizeCategory, SIZE_CATEGORIES } from './sizeStrengthModifiers.js';

export function getWeaponBonusAISizeContext(combatant) {
  return {
    creatureSize: getCreatureSize5e(combatant),
    sizeRank: getCreatureSizeRank5e(combatant),
    legacySizeContext: getLegacyWeaponSizeCompatibility(combatant),
  };
}

/**
 * Evaluate all bonuses for a weapon in a combat situation
 * @param {Object} weapon - Weapon to evaluate
 * @param {Object} attacker - Attacker character
 * @param {Object} defender - Defender character
 * @param {Object} defenderWeapon - Defender's weapon
 * @param {Object} combatState - Combat state (terrain, distance, round, etc.)
 * @returns {Object} Bonus evaluation with total score and breakdown
 */
export function evaluateWeaponBonuses(weapon, attacker, defender, defenderWeapon, combatState = {}) {
  if (!weapon || !attacker) {
    return {
      totalBonus: 0,
      attackBonus: 0,
      blockBonus: 0,
      damageBonus: 0,
      reachBonus: 0,
      closeRangeBonus: 0,
      firstAttackBonus: 0,
      twoHandedBonus: 0,
      weaponSizeBonus: 0,
      sizeCategoryBonus: 0,
      weaponSpecificBonus: 0,
      bonuses: [],
      penalties: [],
      score: 0,
      reasoning: "No weapon or attacker",
    };
  }

  const {
    terrain = "open",
    terrainWidth = 10,
    terrainHeight = 10,
    terrainDensity = 0,
    hasObstructions = false,
    isFirstMeleeRound = false,
    combatDistance = 5,
    hasClosedDistance = true,
  } = combatState;

  const evaluation = {
    totalBonus: 0,
    attackBonus: 0,
    blockBonus: 0,
    damageBonus: 0,
    reachBonus: 0,
    closeRangeBonus: 0,
    firstAttackBonus: 0,
    twoHandedBonus: 0,
    weaponSizeBonus: 0,
    sizeCategoryBonus: 0,
    weaponSpecificBonus: 0,
    bonuses: [],
    penalties: [],
    score: 0,
    reasoning: "",
  };

  // 1. Weapon-specific bonuses (from weapon.bonuses property)
  if (weapon.bonuses) {
    evaluation.weaponSpecificBonus += weapon.bonuses.attack || 0;
    evaluation.attackBonus += weapon.bonuses.attack || 0;
    evaluation.blockBonus += weapon.bonuses.block || 0;
    evaluation.damageBonus += weapon.bonuses.damage || 0;
    
    if (weapon.bonuses.attack) {
      evaluation.bonuses.push(`Weapon-specific attack bonus: +${weapon.bonuses.attack}`);
    }
    if (weapon.bonuses.block) {
      evaluation.bonuses.push(`Weapon-specific block bonus: +${weapon.bonuses.block}`);
    }
    if (weapon.bonuses.damage) {
      evaluation.bonuses.push(`Weapon-specific damage bonus: +${weapon.bonuses.damage}`);
    }
  }

  // 2. Two-handed grip bonus
  const attackerSlots = attacker.equistaminadWeapons || [];
  const isTwoHanded = weapon.twoHanded || (attackerSlots.length > 0 && attackerSlots[0]?.name === weapon.name && attackerSlots[0]?.usingTwoHanded);
  if (isTwoHanded) {
    evaluation.twoHandedBonus += 1; // +1 attack
    evaluation.attackBonus += 1;
    evaluation.damageBonus += 2; // +2 damage
    evaluation.bonuses.push("Two-handed grip: +1 attack, +2 damage");
  }

  // 3. Reach advantage bonus (if defender has weapon)
  if (defenderWeapon && defender) {
    const reachAdvantage = calculateReachAdvantage(weapon, defenderWeapon);
    if (reachAdvantage.hasAdvantage) {
      evaluation.reachBonus = reachAdvantage.bonus;
      evaluation.attackBonus += reachAdvantage.bonus;
      evaluation.bonuses.push(`Reach advantage: +${reachAdvantage.bonus} attack`);
    } else if (defenderWeapon.reach > (weapon.reach || 0)) {
      evaluation.penalties.push(`Reach disadvantage: -${Math.min(defenderWeapon.reach - (weapon.reach || 0), 3)} attack`);
    }
  }

  // 4. First attack bonus (longer weapons on first round)
  if (isFirstMeleeRound && defenderWeapon) {
    const firstAttackAdvantage = calculateReachAdvantage(weapon, defenderWeapon);
    if (firstAttackAdvantage.hasAdvantage && firstAttackAdvantage.advantage >= 2) {
      evaluation.firstAttackBonus = 1;
      evaluation.attackBonus += 1;
      evaluation.bonuses.push("First attack advantage: +1 attack");
    }
  }

  // 5. Close range bonuses (short weapons in grapple range)
  const weaponLength = getWeaponLength(weapon, attacker);
  const weaponType = getWeaponType(weapon);
  
  if (combatDistance < 3) {
    // Grapple range - short weapons excel
    if (weaponType === "SHORT" || weaponLength <= 2) {
      evaluation.closeRangeBonus = 2;
      evaluation.attackBonus += 2;
      evaluation.bonuses.push("Close range: +2 attack (short weapon excels)");
    } else if (weaponType === "LONG" || weaponLength >= 6) {
      evaluation.attackBonus -= 3;
      evaluation.penalties.push("Close range: -3 attack (long weapon ineffective)");
    }
  } else if (combatDistance < 5 && hasClosedDistance) {
    // Close combat - short weapons get bonus
    if (weaponType === "SHORT" || weaponLength <= 2) {
      evaluation.closeRangeBonus = 1;
      evaluation.attackBonus += 1;
      evaluation.bonuses.push("Close combat: +1 attack");
    }
  }

  // 6. Weapon size bonus (heavy races get +1 die)
  const race = attacker.species || attacker.race;
  getWeaponBonusAISizeContext(attacker);
  if (race) {
    const weaponSize = getWeaponSizeForRace(race);
    if (weaponSize === WEAPON_SIZE.LARGE_HEAVY) {
      evaluation.weaponSizeBonus = 1; // +1 die is significant
      evaluation.damageBonus += 1; // Counted as damage bonus
      evaluation.bonuses.push("Heavy weapon: +1 die damage");
    }
  }

  // 7. Size category bonus (combatant size affects attack)
  if (defender) {
    const attackerSize = getSizeCategory(attacker);
    const defenderSize = getSizeCategory(defender);
    
    if (attackerSize === SIZE_CATEGORIES.LARGE && defenderSize === SIZE_CATEGORIES.MEDIUM) {
      evaluation.sizeCategoryBonus = 1;
      evaluation.attackBonus += 1;
      evaluation.bonuses.push("Size advantage: +1 attack");
    } else if (attackerSize === SIZE_CATEGORIES.HUGE && defenderSize !== SIZE_CATEGORIES.HUGE) {
      evaluation.sizeCategoryBonus = 2;
      evaluation.attackBonus += 2;
      evaluation.bonuses.push("Size advantage: +2 attack");
    } else if (attackerSize === SIZE_CATEGORIES.LARGE_HEAVY) {
      evaluation.sizeCategoryBonus = 3;
      evaluation.attackBonus += 3;
      evaluation.bonuses.push("Size advantage: +3 attack");
    }
  }

  // Calculate total bonus (weighted)
  evaluation.totalBonus = 
    (evaluation.attackBonus * 2) + // Attack bonuses are most valuable
    (evaluation.damageBonus * 1.5) + // Damage bonuses are valuable
    (evaluation.blockBonus * 1) + // Block bonuses are defensive
    (evaluation.reachBonus * 1.5) + // Reach is tactical advantage
    (evaluation.closeRangeBonus * 2) + // Close range is situational
    (evaluation.firstAttackBonus * 1) + // First attack is one-time
    (evaluation.weaponSizeBonus * 2) + // Weapon size is significant
    (evaluation.sizeCategoryBonus * 1); // Size is inherent

  // Calculate score (bonus minus penalties)
  const penaltyScore = evaluation.penalties.length * 0.5; // Each penalty reduces score
  evaluation.score = evaluation.totalBonus - penaltyScore;

  // Generate reasoning
  const bonusCount = evaluation.bonuses.length;
  const penaltyCount = evaluation.penalties.length;
  
  if (bonusCount > 0) {
    evaluation.reasoning = `Weapon has ${bonusCount} bonus${bonusCount > 1 ? 'es' : ''}: ${evaluation.bonuses.join(', ')}`;
  } else if (penaltyCount > 0) {
    evaluation.reasoning = `Weapon has ${penaltyCount} penalty${penaltyCount > 1 ? 'ies' : ''}: ${evaluation.penalties.join(', ')}`;
  } else {
    evaluation.reasoning = "No significant bonuses or penalties";
  }

  return evaluation;
}

/**
 * Evaluate all available weapons and rank them by bonus score
 * @param {Array} availableWeapons - Array of available weapons
 * @param {Object} attacker - Attacker character
 * @param {Object} defender - Defender character
 * @param {Object} combatState - Combat state
 * @returns {Array} Ranked weapons with evaluations
 */
export function rankWeaponsByBonuses(availableWeapons, attacker, defender, combatState = {}) {
  if (!availableWeapons || availableWeapons.length === 0) {
    return [];
  }

  const defenderWeapon = defender?.equistaminadWeapons?.[0] || defender?.equistaminadWeapon || null;

  const ranked = availableWeapons.map(weapon => {
    const evaluation = evaluateWeaponBonuses(weapon, attacker, defender, defenderWeapon, combatState);
    return {
      weapon,
      evaluation,
      score: evaluation.score,
      totalBonus: evaluation.totalBonus,
      attackBonus: evaluation.attackBonus,
      damageBonus: evaluation.damageBonus,
    };
  });

  // Sort by score (highest first)
  ranked.sort((a, b) => b.score - a.score);

  return ranked;
}

/**
 * Determine if closing distance would provide bonuses
 * @param {Object} attacker - Attacker character
 * @param {Object} defender - Defender character
 * @param {Object} attackerWeapon - Attacker's weapon
 * @param {Object} combatState - Combat state
 * @returns {Object} Analysis of closing distance benefits
 */
export function analyzeClosingDistance(attacker, defender, attackerWeapon, combatState = {}) {
  const {
    combatDistance = 5,
    hasClosedDistance = false,
  } = combatState;

  const analysis = {
    shouldClose: false,
    benefit: 0,
    reason: "",
    bonuses: [],
    penalties: [],
  };

  if (!attackerWeapon) {
    return analysis;
  }

  const weaponLength = getWeaponLength(attackerWeapon, attacker);
  const weaponType = getWeaponType(attackerWeapon);
  const defenderWeapon = defender?.equistaminadWeapons?.[0] || defender?.equistaminadWeapon || null;
  const defenderWeaponLength = defenderWeapon ? getWeaponLength(defenderWeapon, defender) : 0;

  // Check if weapon would benefit from closing
  const isShortWeapon = weaponType === "SHORT" || weaponLength <= 2;
  const isLongWeapon = weaponType === "LONG" || weaponLength >= 6;
  const defenderIsLongWeapon = defenderWeapon && (getWeaponType(defenderWeapon) === "LONG" || defenderWeaponLength >= 6);

  // Short weapons benefit from closing distance
  if (isShortWeapon && combatDistance >= 3) {
    if (combatDistance >= 5) {
      // Would get +2 attack bonus in grapple range
      analysis.shouldClose = true;
      analysis.benefit = 2;
      analysis.bonuses.push("Close range: +2 attack (short weapon excels)");
      analysis.reason = "Short weapon would gain +2 attack bonus in close range";
    } else if (combatDistance >= 3) {
      // Would get +1 attack bonus in close combat
      analysis.shouldClose = true;
      analysis.benefit = 1;
      analysis.bonuses.push("Close combat: +1 attack");
      analysis.reason = "Short weapon would gain +1 attack bonus in close combat";
    }
  }

  // Long weapons are penalized when too close
  if (isLongWeapon && combatDistance < 5 && defenderIsLongWeapon) {
    // Already close, but could benefit from backing up
    analysis.penalties.push("Long weapon penalized at close range");
  }

  // Check if defender's long weapon would be neutralized
  if (defenderIsLongWeapon && combatDistance >= 5 && isShortWeapon) {
    analysis.benefit += 2; // Defender loses reach advantage
    analysis.bonuses.push("Neutralize defender's reach advantage");
    analysis.shouldClose = true;
    analysis.reason = "Closing would neutralize defender's long weapon advantage";
  }

  return analysis;
}

/**
 * Get optimal weapon and action recommendation
 * @param {Array} availableWeapons - Available weapons
 * @param {Object} attacker - Attacker character
 * @param {Object} defender - Defender character
 * @param {Object} combatState - Combat state
 * @returns {Object} Recommendation with weapon, action, and reasoning
 */
export function getOptimalWeaponRecommendation(availableWeapons, attacker, defender, combatState = {}) {
  if (!availableWeapons || availableWeapons.length === 0) {
    return {
      weapon: null,
      action: "defend",
      reasoning: "No weapons available",
      score: 0,
    };
  }

  // Rank weapons by bonuses
  const rankedWeapons = rankWeaponsByBonuses(availableWeapons, attacker, defender, combatState);

  if (rankedWeapons.length === 0) {
    return {
      weapon: null,
      action: "defend",
      reasoning: "No weapons to evaluate",
      score: 0,
    };
  }

  const bestWeapon = rankedWeapons[0];
  const bestWeaponObj = bestWeapon.weapon;

  // Check if closing distance would help
  const closeAnalysis = analyzeClosingDistance(attacker, defender, bestWeaponObj, combatState);

  // If best weapon has no bonuses but closing would help, recommend closing
  if (bestWeapon.score <= 0 && closeAnalysis.shouldClose && closeAnalysis.benefit > 0) {
    return {
      weapon: bestWeaponObj,
      action: "close_distance",
      reasoning: `No weapon bonuses available. ${closeAnalysis.reason}. Closing distance would provide: ${closeAnalysis.bonuses.join(', ')}`,
      score: closeAnalysis.benefit,
      closeAnalysis,
    };
  }

  // If best weapon has bonuses, use it
  if (bestWeapon.score > 0) {
    return {
      weapon: bestWeaponObj,
      action: "attack",
      reasoning: bestWeapon.evaluation.reasoning,
      score: bestWeapon.score,
      evaluation: bestWeapon.evaluation,
      rankedWeapons: rankedWeapons.slice(0, 3), // Top 3 options
    };
  }

  // If closing would help more than current weapon, recommend closing
  if (closeAnalysis.shouldClose && closeAnalysis.benefit > Math.abs(bestWeapon.score)) {
    return {
      weapon: bestWeaponObj,
      action: "close_distance",
      reasoning: `Current weapon has penalties. ${closeAnalysis.reason}`,
      score: closeAnalysis.benefit,
      closeAnalysis,
    };
  }

  // Default: use best available weapon
  return {
    weapon: bestWeaponObj,
    action: "attack",
    reasoning: bestWeapon.evaluation.reasoning || "Using best available weapon",
    score: bestWeapon.score,
    evaluation: bestWeapon.evaluation,
  };
}

/**
 * AI decision maker that prefers weapons with bonuses
 * @param {Object} character - Character making decision
 * @param {Array} targets - Available targets
 * @param {Object} combatState - Combat state
 * @returns {Object} AI decision with weapon, action, and reasoning
 */
export function makeWeaponBonusAIDecision(character, targets, combatState = {}) {
  if (!character || !targets || targets.length === 0) {
    return {
      weapon: null,
      action: "defend",
      target: null,
      reasoning: "No character or targets",
    };
  }

  // Get available weapons
  const availableWeapons = [];
  
  // Check equistaminad weapons
  if (character.equistaminadWeapons && character.equistaminadWeapons.length > 0) {
    character.equistaminadWeapons.forEach(w => {
      if (w && w.name && w.name !== "Unarmed") {
        availableWeapons.push(w);
      }
    });
  }
  
  // Check inventory for weapons
  if (character.inventory) {
    character.inventory.forEach(item => {
      if (item.type && (item.type.toLowerCase() === 'weapon' || item.damage)) {
        if (!availableWeapons.find(w => w.name === item.name)) {
          availableWeapons.push(item);
        }
      }
    });
  }

  // If no weapons, use unarmed
  if (availableWeapons.length === 0) {
    return {
      weapon: { name: "Unarmed", damage: "1d3", type: "unarmed" },
      action: "attack",
      target: targets[0],
      reasoning: "No weapons available, using unarmed",
    };
  }

  // Get primary target (closest or most dangerous)
  const primaryTarget = targets[0]; // Could be enhanced to select best target

  // Get recommendation
  const recommendation = getOptimalWeaponRecommendation(
    availableWeapons,
    character,
    primaryTarget,
    {
      ...combatState,
      combatDistance: combatState.combatDistance || 5,
    }
  );

  return {
    weapon: recommendation.weapon,
    action: recommendation.action,
    target: primaryTarget,
    reasoning: recommendation.reasoning,
    score: recommendation.score,
    evaluation: recommendation.evaluation,
    closeAnalysis: recommendation.closeAnalysis,
  };
}

export default {
  getWeaponBonusAISizeContext,
  evaluateWeaponBonuses,
  rankWeaponsByBonuses,
  analyzeClosingDistance,
  getOptimalWeaponRecommendation,
  makeWeaponBonusAIDecision,
};


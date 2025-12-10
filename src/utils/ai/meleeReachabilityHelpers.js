/**
 * Melee Reachability Helpers
 * 
 * Centralized logic for determining if a fighter can threaten a target with melee attacks,
 * accounting for altitude, flight, and weapon reach.
 */

import { canFly, isFlying, getAltitude } from "../abilitySystem";
import { getWeaponLength } from "../combatEnvironmentLogic";

/**
 * Check if a fighter is a flying hunter (hawk, falcon, eagle, etc.)
 * @param {Object} fighter - Fighter object
 * @returns {boolean} True if fighter is a flying hunter
 */
function isFlyingHunter(fighter) {
  if (!fighter) return false;
  const name = (fighter.name || "").toLowerCase();
  const species = (fighter.species || "").toLowerCase();
  const hunterKeywords = ["hawk", "falcon", "eagle", "vulture", "owl"];
  const isBirdOfPrey =
    hunterKeywords.some((k) => name.includes(k)) ||
    hunterKeywords.some((k) => species.includes(k));
  return isFlying(fighter) && isBirdOfPrey;
}

/**
 * Check if a fighter is a prey animal (mice, rats, rabbits, etc.)
 * @param {Object} fighter - Fighter object
 * @returns {boolean} True if fighter is a prey animal
 */
function isPreyAnimal(fighter) {
  if (!fighter) return false;
  const name = (fighter.name || "").toLowerCase();
  const size = (fighter.sizeCategory || fighter.size || "").toLowerCase();
  const isSmallBody = ["tiny", "small"].includes(size);
  const preyKeywords = ["mouse", "rat", "rabbit", "squirrel", "songbird"];
  const isNamedPrey = preyKeywords.some((k) => name.includes(k));
  return isSmallBody || isNamedPrey;
}

/**
 * Check if attacker can threaten target with melee attacks
 * Accounts for altitude, flight capability, and weapon reach
 * @param {Object} attacker - Attacking fighter
 * @param {Object} target - Target fighter
 * @param {Object} weapon - Optional: specific weapon to check (if not provided, uses max reach from all weapons)
 * @returns {boolean} True if attacker can reach target with melee
 */
export function canThreatenWithMelee(attacker, target, weapon = null) {
  if (!attacker || !target) return false;

  const attackerCanFly = !!canFly(attacker);
  const attackerIsFlying = !!isFlying(attacker);
  const targetIsFlying = !!isFlying(target);
  const targetAltitude = getAltitude(target) || 0;
  const attackerAltitude = getAltitude(attacker) || 0;

  // If attacker is a flying hunter and target is prey on the ground,
  // treat them as *reachable* because we can dive.
  if (isFlyingHunter(attacker) && isPreyAnimal(target) && !targetIsFlying) {
    return true; // we will dive as part of the attack action
  }

  // If attacker can fly, they can adjust altitude to match target
  // (assuming they're not already too high/low to dive/climb)
  if (attackerCanFly || attackerIsFlying) {
    // Flying attacker can generally reach targets by adjusting altitude
    // Exception: if target is on ground and attacker is very high, they'd need to dive
    // But for simplicity, if attacker can fly, assume they can reach
    return true;
  }

  // Ground attacker vs ground target: always reachable
  if (!targetIsFlying || targetAltitude <= 5) {
    return true;
  }

  // Ground attacker vs flying target: need weapon reach >= target altitude
  // Get max melee reach in feet
  let maxReachFeet = 2; // Default: knife/short sword (2ft)

  if (weapon) {
    // Check specific weapon
    maxReachFeet = getWeaponLength(weapon, attacker) || 2;
  } else {
    // Check all equipped weapons and attacks for max reach
    const weapons = [
      attacker.equippedWeapons?.primary,
      attacker.equippedWeapons?.secondary,
      ...(attacker.attacks || []),
    ].filter(Boolean);

    if (weapons.length > 0) {
      maxReachFeet = Math.max(
        ...weapons.map((w) => getWeaponLength(w, attacker) || 2)
      );
    }
  }

  // Add body reach (arm extension, ~3ft)
  const totalReach = maxReachFeet + 3;

  // If target altitude is above total reach, it's unreachable
  return totalReach >= targetAltitude;
}

/**
 * Check if attacker can threaten target with a specific weapon
 * @param {Object} attacker - Attacking fighter
 * @param {Object} target - Target fighter
 * @param {Object} weapon - Weapon to check
 * @returns {boolean} True if weapon can reach target
 */
export function canThreatenWithMeleeWithWeapon(attacker, target, weapon) {
  return canThreatenWithMelee(attacker, target, weapon);
}

/**
 * Mark a target as unreachable for a fighter
 * @param {Object} fighter - Fighter who cannot reach the target
 * @param {Object} target - Target that is unreachable
 */
export function markTargetUnreachable(fighter, target) {
  if (!fighter || !target || !target.id) return;
  
  fighter.unreachableTargets = fighter.unreachableTargets || new Set();
  fighter.unreachableTargets.add(target.id);
}

/**
 * Check if a target is marked as unreachable
 * @param {Object} fighter - Fighter to check
 * @param {Object} target - Target to check
 * @returns {boolean} True if target is marked unreachable
 */
export function isTargetUnreachable(fighter, target) {
  if (!fighter || !target || !target.id) return false;
  return fighter.unreachableTargets?.has(target.id) || false;
}

/**
 * Clear unreachable targets (useful when conditions change, e.g., target lands)
 * @param {Object} fighter - Fighter whose unreachable targets to clear
 * @param {string} targetId - Optional: specific target ID to clear, or clear all if not provided
 */
export function clearUnreachableTarget(fighter, targetId = null) {
  if (!fighter) return;
  
  if (targetId) {
    fighter.unreachableTargets?.delete(targetId);
  } else {
    fighter.unreachableTargets = new Set();
  }
}

/**
 * Get all reachable enemies for a fighter
 * Filters out unreachable targets and checks melee reachability
 * @param {Object} fighter - Fighter to check
 * @param {Array} enemies - Array of enemy fighters
 * @param {Object} options - Options
 * @param {boolean} options.requireMelee - If true, only return enemies reachable with melee
 * @param {boolean} options.checkRanged - If true, include enemies reachable with ranged weapons
 * @returns {Array} Filtered array of reachable enemies
 */
export function getReachableEnemies(fighter, enemies, options = {}) {
  const {
    requireMelee = false,
    checkRanged = true,
  } = options;

  return enemies.filter((enemy) => {
    // Skip if marked as unreachable
    if (isTargetUnreachable(fighter, enemy)) {
      return false;
    }

    // If requiring melee, check melee reachability
    if (requireMelee) {
      return canThreatenWithMelee(fighter, enemy);
    }

    // Otherwise, include all enemies (ranged can hit them)
    return true;
  });
}

/**
 * Check if fighter has any valid offensive options against enemies
 * This is a basic check that doesn't verify range/resources - use hasAnyRangedOptionAgainstFlying for detailed checks
 * @param {Object} fighter - Fighter to check
 * @param {Array} enemies - Array of enemy fighters
 * @returns {boolean} True if fighter has at least one way to attack enemies
 */
export function hasAnyValidOffensiveOption(fighter, enemies) {
  if (!fighter || !enemies || enemies.length === 0) return false;

  // Check if any enemy is reachable with melee
  const meleeReachable = enemies.some((enemy) => 
    canThreatenWithMelee(fighter, enemy)
  );

  if (meleeReachable) return true;

  // Check if fighter has ranged weapons/spells/psionics
  const hasRangedWeapon = fighter.equippedWeapons?.primary ||
    fighter.equippedWeapons?.secondary ||
    fighter.attacks?.some((a) => {
      const name = (a.name || "").toLowerCase();
      return (
        name.includes("bow") ||
        name.includes("crossbow") ||
        name.includes("sling") ||
        name.includes("thrown") ||
        (a.range && a.range > 10)
      );
    });

  if (hasRangedWeapon) return true;

  // Check for spells (if fighter has spellcasting)
  const hasSpells = fighter.spells?.length > 0 || 
    fighter.knownSpells?.length > 0 ||
    fighter.spellSlots?.length > 0;

  if (hasSpells) return true;

  // Check for psionics (if fighter has ISP)
  const hasPsionics = (fighter.currentISP ?? fighter.ISP ?? fighter.isp ?? 0) > 0 &&
    (fighter.psionics?.length > 0 || fighter.knownPsionics?.length > 0);

  if (hasPsionics) return true;

  return false;
}

/**
 * Check if fighter has any ranged option (weapons, spells, psionics) that can hit flying enemies
 * This checks range, resources (PPE/ISP), and whether options are actually usable
 * @param {Object} fighter - Fighter to check
 * @param {Array} enemies - Array of enemy fighters
 * @param {Object} options - Options object
 * @param {Function} options.getFighterSpells - Function to get fighter's spells
 * @param {Function} options.getFighterPsionicPowers - Function to get fighter's psionic powers
 * @param {Function} options.getFighterPPE - Function to get fighter's current PPE
 * @param {Function} options.getFighterISP - Function to get fighter's current ISP
 * @param {Function} options.getSpellCost - Function to get spell cost
 * @param {Function} options.getPsionicCost - Function to get psionic cost
 * @param {Function} options.getSpellRangeInFeet - Function to get spell range in feet
 * @param {Function} options.parseRangeToFeet - Function to parse range string to feet
 * @param {Function} options.isOffensiveSpell - Function to check if spell is offensive
 * @param {Function} options.calculateDistance - Function to calculate distance between positions
 * @param {Object} options.positions - Positions map
 * @returns {boolean} True if fighter has at least one usable ranged option
 */
export function hasAnyRangedOptionAgainstFlying(fighter, enemies, options = {}) {
  if (!fighter || !enemies || enemies.length === 0) return false;

  const {
    getFighterSpells,
    getFighterPsionicPowers,
    getFighterPPE,
    getFighterISP,
    getSpellCost,
    getPsionicCost,
    getSpellRangeInFeet,
    parseRangeToFeet,
    isOffensiveSpell,
    calculateDistance,
    positions,
  } = options;

  // Filter to living enemies
  const livingEnemies = enemies.filter(e => 
    !e.isDead && 
    (e.currentHP ?? 0) > -21 && 
    e.status !== "defeated"
  );

  if (!livingEnemies.length) return false;

  // Calculate distances to enemies
  const enemyDistances = livingEnemies.map(enemy => {
    if (!positions || !positions[fighter.id] || !positions[enemy.id]) {
      return Infinity;
    }
    return calculateDistance ? calculateDistance(positions[fighter.id], positions[enemy.id]) : Infinity;
  });

  const minEnemyDistance = Math.min(...enemyDistances);
  const maxEnemyDistance = Math.max(...enemyDistances);

  // 1) Check ranged weapons
  const hasRangedWeaponInRange = fighter.equippedWeapons?.primary ||
    fighter.equippedWeapons?.secondary ||
    fighter.attacks?.some((a) => {
      const name = (a.name || "").toLowerCase();
      const isRanged = name.includes("bow") ||
        name.includes("crossbow") ||
        name.includes("sling") ||
        name.includes("thrown") ||
        (a.range && a.range > 10);
      
      if (!isRanged) return false;
      
      // Check if weapon range can reach at least the closest enemy
      const weaponRange = a.range || 0;
      return weaponRange >= minEnemyDistance;
    });

  if (hasRangedWeaponInRange) return true;

  // 2) Check spells (if functions provided)
  if (getFighterSpells && getFighterPPE && getSpellCost && getSpellRangeInFeet && isOffensiveSpell) {
    const spells = getFighterSpells(fighter) || [];
    const ppeAvailable = getFighterPPE(fighter) || 0;
    
    const hasSpellInRange = spells.some(spell => {
      if (!isOffensiveSpell(spell)) return false;
      
      const spellCost = getSpellCost(spell) || 0;
      if (spellCost > ppeAvailable) return false;
      
      const spellRange = getSpellRangeInFeet(spell) || 0;
      if (spellRange <= 0) return false;
      
      return spellRange >= minEnemyDistance;
    });

    if (hasSpellInRange) return true;
  }

  // 3) Check psionics (if functions provided)
  if (getFighterPsionicPowers && getFighterISP && getPsionicCost) {
    const psionics = getFighterPsionicPowers(fighter) || [];
    const ispAvailable = getFighterISP(fighter) || 0;
    
    const hasPsionicInRange = psionics.some(power => {
      const cost = getPsionicCost(power) || 0;
      if (cost > ispAvailable) return false;
      
      // Check if psionic is offensive
      const category = power.targetCategory || power.category || "";
      if (category.toLowerCase() !== "enemy") return false;
      
      // Check range (many psionics have range, some are touch/self)
      const powerRange = parseRangeToFeet ? parseRangeToFeet(power.range || "0ft") : 0;
      if (powerRange <= 0) {
        // Some psionics might be touch range but still usable if we can get close
        // For now, require explicit range
        return false;
      }
      
      return powerRange >= minEnemyDistance;
    });

    if (hasPsionicInRange) return true;
  }

  return false;
}


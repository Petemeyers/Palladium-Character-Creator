/**
 * Reach-Based Combat Rules for Palladium Fantasy
 * House rules for tactical depth based on weapon reach
 *
 * REVISED VERSION: Distinguishes overhead swings from lateral swings
 * and incorporates charge/momentum rules for large creatures in tight spaces
 */

import { getWeaponType, getWeaponLength } from "./combatEnvironmentLogic.js";
import { getDynamicWidth, getDynamicHeight } from "./environmentMetrics.js";

/**
 * Determine if attack is overhead (vertical) or lateral (horizontal)
 * @param {Object} weapon - Weapon object
 * @param {string} attackType - Type of attack ("overhead", "thrust", "lateral", "auto")
 * @returns {string} Attack type: "overhead", "thrust", "lateral"
 */
export function getAttackType(weapon, attackType = "auto") {
  if (attackType !== "auto") return attackType;

  const weaponType = getWeaponType(weapon);
  const name = (weapon.name || "").toLowerCase();

  // Thrusting weapons (spears, rapiers) prefer thrusts
  if (
    name.includes("spear") ||
    name.includes("pike") ||
    name.includes("rapier") ||
    name.includes("javelin") ||
    name.includes("lance")
  ) {
    return "thrust";
  }

  // Heavy weapons (axes, mauls) prefer overhead chops
  if (
    weaponType === "HEAVY" ||
    name.includes("axe") ||
    name.includes("maul") ||
    name.includes("hammer") ||
    name.includes("mace")
  ) {
    return "overhead";
  }

  // Flexible weapons are lateral by nature
  if (
    name.includes("whip") ||
    name.includes("flail") ||
    name.includes("chain")
  ) {
    return "lateral";
  }

  // Default: can use overhead or lateral
  return "overhead"; // Default to overhead for maximum flexibility
}

/**
 * Check if overhead swings are possible in current environment
 * @param {number} height - Ceiling height in feet
 * @returns {boolean} True if overhead swings are possible
 */
export function canUseOverhead(height) {
  return height > 6; // Overhead swings possible if ceiling > 6ft
}

/**
 * Check if lateral swings are possible in current environment
 * @param {number} width - Available width in feet
 * @returns {boolean} True if lateral swings are possible
 */
export function canUseLateral(width) {
  return width >= 6; // Lateral swings need at least 6ft width
}

/**
 * Get environmental clearance category (expanded)
 * @param {number} width - Width in feet
 * @param {number} height - Height in feet
 * @param {number} density - Terrain density (0.0-1.0)
 * @param {boolean} hasObstructions - Are there trees/rocks/rubble?
 * @returns {string} Category: "OPEN", "TIGHT_CORRIDOR", "CONFINED_CAVE", "DENSE_FOREST", "NARROW_TRAIL", "CLUTTERED"
 */
export function getEnvironmentCategory(
  width,
  height,
  density = 0,
  hasObstructions = false
) {
  if (height <= 5) return "CONFINED_CAVE";
  if (width <= 6 && height > 6) return "TIGHT_CORRIDOR";
  if (width <= 4 && height > 6) return "NARROW_TRAIL"; // Very narrow path
  if (density >= 0.7 && hasObstructions) return "DENSE_FOREST"; // Dense trees/ruins
  if (width < 10 || density >= 0.5) return "CLUTTERED";
  return "OPEN";
}

/**
 * Compare weapon reach categories
 * @param {Object} weapon1 - First weapon
 * @param {Object} weapon2 - Second weapon
 * @returns {Object} Comparison result {longer: weapon, shorter: weapon, difference: number}
 */
export function compareWeaponReach(weapon1, weapon2) {
  const length1 = getWeaponLength(weapon1);
  const length2 = getWeaponLength(weapon2);

  if (length1 > length2) {
    return {
      longer: weapon1,
      shorter: weapon2,
      longerLength: length1,
      shorterLength: length2,
      difference: length1 - length2,
    };
  } else if (length2 > length1) {
    return {
      longer: weapon2,
      shorter: weapon1,
      longerLength: length2,
      shorterLength: length1,
      difference: length2 - length1,
    };
  } else {
    return {
      longer: null,
      shorter: null,
      longerLength: length1,
      shorterLength: length2,
      difference: 0,
    };
  }
}

/**
 * Check if weapon is significantly longer (difference >= 2 feet)
 * @param {Object} weapon1 - First weapon
 * @param {Object} weapon2 - Second weapon
 * @returns {boolean} True if one weapon is significantly longer
 */
export function hasReachAdvantage(weapon1, weapon2) {
  const comparison = compareWeaponReach(weapon1, weapon2);
  return comparison.difference >= 2 && comparison.longer !== null;
}

/**
 * Get first strike advantage bonus for longer weapons
 * @param {Object} attackerWeapon - Attacker's weapon
 * @param {Object} defenderWeapon - Defender's weapon
 * @param {boolean} isFirstMeleeRound - Is this the first melee round?
 * @returns {number} Strike bonus (0 or +1)
 */
export function getFirstStrikeAdvantage(
  attackerWeapon,
  defenderWeapon,
  isFirstMeleeRound = false
) {
  if (!isFirstMeleeRound) return 0;

  const comparison = compareWeaponReach(attackerWeapon, defenderWeapon);

  // Longer weapon gets +1 strike on first melee round
  if (comparison.longer === attackerWeapon && comparison.difference >= 2) {
    return 1;
  }

  return 0;
}

/**
 * Check if short weapon user needs to close distance
 * @param {Object} shortWeapon - Shorter weapon
 * @param {Object} longWeapon - Longer weapon
 * @returns {boolean} True if short weapon user needs to close
 */
export function needsToCloseDistance(shortWeapon, longWeapon) {
  const comparison = compareWeaponReach(shortWeapon, longWeapon);
  return comparison.shorter === shortWeapon && comparison.difference >= 2;
}

/**
 * Calculate closing distance check
 * @param {Object} character - Character attempting to close
 * @param {Object} options - Options {useProwl: boolean, useDodge: boolean}
 * @returns {Object} {success: boolean, actionCost: number, reason: string}
 */
export function attemptCloseDistance(character, options = {}) {
  const useProwl = options.useProwl || false;
  const useDodge = options.useDodge || false;

  // Option 1: Spend 1 attack action (automatic but costs action)
  if (!useProwl && !useDodge) {
    return {
      success: true,
      actionCost: 1,
      reason: "Spends 1 attack action to close distance",
    };
  }

  // Option 2: Pass Prowl roll (no action cost but requires skill)
  if (useProwl) {
    const prowlSkill = character.skills?.find((s) => s.name === "Prowl") || {
      percentage: 0,
    };
    const prowlRoll = Math.floor(Math.random() * 100) + 1;
    const success = prowlRoll <= prowlSkill.percentage;

    return {
      success: success,
      actionCost: success ? 0 : 1,
      reason: success
        ? `Prowl roll succeeds (${prowlRoll} <= ${prowlSkill.percentage}) - closes distance without action cost`
        : `Prowl roll fails (${prowlRoll} > ${prowlSkill.percentage}) - must spend action to close`,
    };
  }

  // Option 3: Pass Dodge roll (no action cost but requires skill)
  if (useDodge) {
    const dodgeBonus = character.bonuses?.dodge || 0;
    const dodgeRoll = Math.floor(Math.random() * 20) + 1 + dodgeBonus;
    const success = dodgeRoll >= 10; // DC 10 for basic dodge

    return {
      success: success,
      actionCost: success ? 0 : 1,
      reason: success
        ? `Dodge roll succeeds (${dodgeRoll} >= 10) - closes distance without action cost`
        : `Dodge roll fails (${dodgeRoll} < 10) - must spend action to close`,
    };
  }

  return {
    success: false,
    actionCost: 1,
    reason: "Unknown closing method",
  };
}

/**
 * Get refined reach-based strike modifiers with overhead/lateral distinction
 * @param {Object} attackerWeapon - Attacker's weapon
 * @param {Object} defenderWeapon - Defender's weapon
 * @param {string} terrain - Terrain type
 * @param {number} terrainWidth - Dynamic terrain width
 * @param {number} terrainHeight - Ceiling height
 * @param {number} terrainDensity - Terrain density (0.0-1.0)
 * @param {boolean} hasObstructions - Are there trees/rocks/rubble?
 * @param {boolean} isFirstMeleeRound - Is this the first melee round?
 * @param {boolean} hasClosedDistance - Has short weapon user closed distance?
 * @param {number} combatDistance - Distance between combatants in feet
 * @param {string} attackType - Attack type: "overhead", "thrust", "lateral", "auto"
 * @returns {Object} Modifiers {strike: number, notes: string[]}
 */
export function getReachStrikeModifiers(
  attackerWeapon,
  defenderWeapon,
  terrain,
  terrainWidth,
  terrainHeight = 10,
  terrainDensity = 0,
  hasObstructions = false,
  isFirstMeleeRound = false,
  hasClosedDistance = true,
  combatDistance = 5,
  attackType = "auto"
) {
  const modifiers = { strike: 0, notes: [] };
  const weaponType = getWeaponType(attackerWeapon);
  const weaponLength = getWeaponLength(attackerWeapon);
  const resolvedAttackType = getAttackType(attackerWeapon, attackType);
  const envCategory = getEnvironmentCategory(
    terrainWidth,
    terrainHeight,
    terrainDensity,
    hasObstructions
  );

  // First Strike Advantage (longer weapons on first round)
  if (isFirstMeleeRound) {
    const firstStrikeBonus = getFirstStrikeAdvantage(
      attackerWeapon,
      defenderWeapon,
      true
    );
    if (firstStrikeBonus > 0) {
      modifiers.strike += firstStrikeBonus;
      modifiers.notes.push("Longer weapon gains +1 first strike advantage");
    }
  }

  // Grapple Range (<3ft) - long weapons severely penalized
  if (combatDistance < 3) {
    if (weaponType === "LONG" || weaponLength >= 6) {
      modifiers.strike -= 3;
      modifiers.notes.push(
        "Grapple range - long weapon ineffective (-3 strike)"
      );
    }
    if (weaponType === "SHORT" || weaponLength <= 2) {
      modifiers.strike += 2;
      modifiers.notes.push("Grapple range - short weapon excels (+2 strike)");
    }
  }

  // Environmental clearance modifiers based on weapon type and attack type
  if (envCategory === "CONFINED_CAVE") {
    // Confined cave (≤5ft tall) - must crouch
    if (weaponType === "SHORT" || weaponLength <= 2) {
      modifiers.strike += 1;
      modifiers.notes.push(
        "Short weapon favored in confined space (+1 strike)"
      );
    }
    if (weaponType === "LONG" || weaponLength >= 6) {
      modifiers.strike -= 2;
      modifiers.notes.push(
        "Long weapon severely restricted in confined cave (-2 strike)"
      );
    }
    if (weaponType === "HEAVY") {
      modifiers.strike -= 2;
      modifiers.notes.push(
        "Heavy weapon too cumbersome in confined cave (-2 strike)"
      );
    }
    // Flexible weapons unusable
    const name = (attackerWeapon.name || "").toLowerCase();
    if (
      name.includes("whip") ||
      name.includes("flail") ||
      name.includes("chain")
    ) {
      modifiers.strike -= 3;
      modifiers.notes.push("Flexible weapon unusable in confined cave");
    }
  } else if (envCategory === "TIGHT_CORRIDOR") {
    // Tight corridor (≤6ft wide, 6-8ft tall) - overhead ok, lateral restricted
    if (resolvedAttackType === "overhead" || resolvedAttackType === "thrust") {
      // Overhead swings and thrusts allowed - minimal penalty
      if (weaponType === "LONG" || weaponLength >= 6) {
        modifiers.strike -= 1;
        modifiers.notes.push(
          "Long weapon lateral arc restricted (-1 strike, overhead/thrust still possible)"
        );
      }
    } else if (resolvedAttackType === "lateral") {
      // Lateral swings penalized
      if (weaponType === "LONG" || weaponLength >= 6) {
        modifiers.strike -= 1;
        modifiers.notes.push(
          "Lateral swing restricted in tight corridor (-1 strike)"
        );
      }
      if (weaponType === "HEAVY") {
        modifiers.strike -= 1;
        modifiers.notes.push("Heavy weapon lateral arc restricted (-1 strike)");
      }
    }

    // Flexible weapons severely penalized
    const name = (attackerWeapon.name || "").toLowerCase();
    if (
      name.includes("whip") ||
      name.includes("flail") ||
      name.includes("chain")
    ) {
      modifiers.strike -= 3;
      modifiers.notes.push(
        "Flexible weapon needs full clearance (-3 strike in tight corridor)"
      );
    }
  } else if (envCategory === "NARROW_TRAIL") {
    // Narrow trail/canyon path - limited lateral space
    if (weaponType === "SHORT" || weaponLength <= 2) {
      modifiers.notes.push("Short weapon agile in narrow trail");
    }
    if (weaponType === "LONG" || weaponLength >= 6) {
      modifiers.strike -= 1;
      modifiers.notes.push(
        "Long weapon restricted in narrow trail (-1 strike)"
      );
    }
    if (weaponType === "HEAVY") {
      modifiers.strike -= 1;
      modifiers.notes.push(
        "Heavy weapon restricted in narrow trail (-1 strike)"
      );
    }
  } else if (envCategory === "DENSE_FOREST") {
    // Dense forest/overgrown ruins - trees/rubble every 5-8ft
    if (resolvedAttackType === "overhead" || resolvedAttackType === "thrust") {
      // Overhead swings still possible
      if (weaponType === "LONG" || weaponLength >= 6) {
        modifiers.strike -= 1;
        modifiers.notes.push(
          "Long weapon arcs restricted by trees (-1 strike)"
        );
      }
      if (weaponType === "HEAVY") {
        modifiers.strike -= 1;
        modifiers.notes.push(
          "Heavy weapon arcs restricted by trees (-1 strike)"
        );
      }
    } else if (resolvedAttackType === "lateral") {
      // Lateral swings hit trees
      if (weaponType === "LONG" || weaponLength >= 6) {
        modifiers.strike -= 2;
        modifiers.notes.push(
          "Lateral swing likely to hit trees (-2 strike, fumble on 1-2)"
        );
      }
      if (weaponType === "HEAVY") {
        modifiers.strike -= 2;
        modifiers.notes.push(
          "Lateral swing likely to hit trees (-2 strike, fumble on 1-2)"
        );
      }
    }

    // Flexible weapons catch on trees
    const name = (attackerWeapon.name || "").toLowerCase();
    if (
      name.includes("whip") ||
      name.includes("flail") ||
      name.includes("chain")
    ) {
      modifiers.strike -= 2;
      modifiers.notes.push(
        "Flexible weapon catches on trees (-2 strike, fumble on 1-2)"
      );
    }

    // Short weapons advantage
    if (weaponType === "SHORT" || weaponLength <= 2) {
      modifiers.notes.push("Short weapon agile in dense forest");
    }
  } else if (envCategory === "CLUTTERED") {
    // Cluttered/forested - obstacles restrict follow-through
    if (weaponType === "HEAVY") {
      modifiers.strike -= 2;
      modifiers.notes.push(
        "Heavy weapon swing restricted by obstacles (-2 strike)"
      );
    }
    if (
      weaponType === "FLEXIBLE" ||
      (attackerWeapon.name || "").toLowerCase().includes("flail")
    ) {
      modifiers.strike -= 2;
      modifiers.notes.push("Flexible weapon catches on obstacles (-2 strike)");
    }
  }

  // Low branches (≤8ft height) - overhead limited
  if (
    terrainHeight <= 8 &&
    terrainHeight > 6 &&
    (weaponType === "LONG" || weaponLength >= 6)
  ) {
    if (resolvedAttackType === "overhead") {
      modifiers.strike -= 1;
      modifiers.notes.push("Low branches limit overhead swing (-1 strike)");
    }
  }

  // Short weapon advantages
  if (weaponType === "SHORT" || weaponLength <= 2) {
    if (envCategory === "CONFINED_CAVE") {
      modifiers.notes.push("Short weapon excels in tight spaces");
    } else if (
      envCategory === "TIGHT_CORRIDOR" ||
      envCategory === "DENSE_FOREST"
    ) {
      modifiers.notes.push("Short weapon agile in tight/dense terrain");
    }
  }

  // Closing Distance Penalty (short weapons haven't closed yet)
  if (
    !hasClosedDistance &&
    needsToCloseDistance(attackerWeapon, defenderWeapon)
  ) {
    modifiers.strike -= 2;
    modifiers.notes.push(
      "Short weapon user hasn't closed distance (-2 strike penalty)"
    );
  }

  // First Round Long Weapon Bonus
  if (isFirstMeleeRound && (weaponType === "LONG" || weaponLength >= 6)) {
    modifiers.strike += 1;
    modifiers.notes.push("Long weapon +1 strike on first round");
  }

  // Close combat penalty (long weapons when pressed <5ft)
  if (
    hasClosedDistance &&
    combatDistance < 5 &&
    defenderWeapon &&
    compareWeaponReach(attackerWeapon, defenderWeapon).longer === attackerWeapon
  ) {
    modifiers.strike -= 2;
    modifiers.notes.push("Long weapon too close for full leverage (-2 strike)");
  }

  return modifiers;
}

/**
 * Get reach-based parry modifiers
 * @param {Object} parryingWeapon - Weapon used for parry
 * @param {Object} attackingWeapon - Attacking weapon
 * @param {boolean} hasClosedDistance - Has short weapon user closed distance?
 * @param {boolean} isFlanking - Is attack from side/rear?
 * @returns {Object} Modifiers {parry: number, notes: string[]}
 */
export function getReachParryModifiers(
  parryingWeapon,
  attackingWeapon,
  hasClosedDistance = true,
  isFlanking = false
) {
  const modifiers = { parry: 0, notes: [] };
  const weaponType = getWeaponType(parryingWeapon);
  const weaponLength = getWeaponLength(parryingWeapon);

  // Short weapon parrying long weapon before closing distance
  if (
    !hasClosedDistance &&
    needsToCloseDistance(parryingWeapon, attackingWeapon)
  ) {
    modifiers.parry -= 2;
    modifiers.notes.push(
      "Short weapon cannot effectively parry long weapon until distance is closed (-2 parry)"
    );
  }

  // Long weapon parrying from side/rear (slower turning)
  if (isFlanking && (weaponType === "LONG" || weaponLength >= 6)) {
    modifiers.parry -= 2;
    modifiers.notes.push(
      "Long weapon slower to turn for flanking attacks (-2 parry)"
    );
  }

  return modifiers;
}

/**
 * Get reach-based dodge modifiers
 * @param {Object} weapon - Weapon wielder's weapon
 * @param {number} terrainWidth - Dynamic terrain width
 * @param {boolean} isTightCombat - Is combat in tight quarters?
 * @returns {Object} Modifiers {dodge: number, notes: string[]}
 */
export function getReachDodgeModifiers(
  weapon,
  terrainWidth,
  isTightCombat = false
) {
  const modifiers = { dodge: 0, notes: [] };
  const weaponType = getWeaponType(weapon);
  const weaponLength = getWeaponLength(weapon);

  // Short weapons grant +1 Dodge (faster reaction)
  if (weaponType === "SHORT" || weaponLength <= 2) {
    modifiers.dodge += 1;
    modifiers.notes.push("Short weapon grants +1 Dodge (faster reaction)");
  }

  // Long weapons -1 Dodge in tight combat
  if (isTightCombat && (weaponType === "LONG" || weaponLength >= 6)) {
    modifiers.dodge -= 1;
    modifiers.notes.push("Long weapon -1 Dodge in tight combat");
  }

  return modifiers;
}

/**
 * Get reach-based initiative modifier
 * @param {Object} weapon - Weapon
 * @returns {number} Initiative modifier (+1 for short, 0 for others)
 */
export function getReachInitiativeModifier(weapon) {
  const weaponType = getWeaponType(weapon);
  const weaponLength = getWeaponLength(weapon);

  // Short weapons grant +1 Initiative
  if (weaponType === "SHORT" || weaponLength <= 2) {
    return 1;
  }

  return 0;
}

/**
 * Check if called shot is possible with weapon
 * @param {Object} weapon - Weapon attempting called shot
 * @param {number} distance - Distance to target in feet
 * @returns {Object} {canUse: boolean, reason: string, strikePenalty: number, damageMultiplier: number}
 */
export function canUseCalledShot(weapon, distance) {
  const weaponType = getWeaponType(weapon);
  const weaponLength = getWeaponLength(weapon);

  // Short weapons can use called shots (target weak points)
  if (weaponType === "SHORT" || weaponLength <= 2) {
    return {
      canUse: true,
      reason: "Short weapon can target weak points",
      strikePenalty: -3,
      damageMultiplier: 2,
    };
  }

  // Long weapons cannot use called shots within 5ft (too close)
  if (distance <= 5) {
    return {
      canUse: false,
      reason: "Long weapon too close (within 5ft) for called shot precision",
      strikePenalty: 0,
      damageMultiplier: 1,
    };
  }

  // Long weapons can use called shots at range (but with penalty)
  return {
    canUse: true,
    reason: "Long weapon can attempt called shot at range",
    strikePenalty: -4, // Higher penalty for long weapons
    damageMultiplier: 2,
  };
}

/**
 * Check if character has closed distance to opponent
 * @param {Object} character - Character with shorter weapon
 * @param {Object} opponent - Opponent with longer weapon
 * @param {Object} combatState - Combat state tracking {closedDistances: Map}
 * @returns {boolean} True if distance has been closed
 */
export function hasClosedDistance(character, opponent, combatState = {}) {
  const closedDistances = combatState.closedDistances || new Map();
  const key = `${character.id}-${opponent.id}`;
  return closedDistances.has(key) && closedDistances.get(key) === true;
}

/**
 * Mark distance as closed between two combatants
 * @param {Object} character - Character who closed
 * @param {Object} opponent - Opponent
 * @param {Object} combatState - Combat state tracking
 */
export function markDistanceClosed(character, opponent, combatState = {}) {
  if (!combatState.closedDistances) {
    combatState.closedDistances = new Map();
  }
  const key = `${character.id}-${opponent.id}`;
  combatState.closedDistances.set(key, true);
}

/**
 * Reset closed distances for new combat round
 * @param {Object} combatState - Combat state tracking
 */
export function resetClosedDistances(combatState = {}) {
  combatState.closedDistances = new Map();
}

/**
 * CHARGE & MOMENTUM RULES
 * For large/dense creatures charging in tight spaces
 */

/**
 * Check if defender can dodge a charge attack
 * @param {Object} defender - Defending character
 * @param {Object} attacker - Charging attacker
 * @param {number} tunnelWidth - Width of tunnel/corridor
 * @returns {Object} {canDodge: boolean, reason: string}
 */
export function canDodgeCharge(defender, attacker, tunnelWidth) {
  // Estimate attacker shoulder width (rough approximation)
  const attackerSize = attacker.size || "MEDIUM";
  let shoulderWidth = 2; // Default medium creature

  if (attackerSize === "LARGE" || attacker.weight > 300) {
    shoulderWidth = 4;
  } else if (attackerSize === "HUGE" || attacker.weight > 500) {
    shoulderWidth = 6;
  }

  // Cannot dodge if tunnel width < attacker shoulder width × 2
  if (tunnelWidth < shoulderWidth * 2) {
    return {
      canDodge: false,
      reason: `Tunnel too narrow (${tunnelWidth}ft) - attacker (${
        shoulderWidth * 2
      }ft clearance needed) blocks escape path`,
    };
  }

  return {
    canDodge: true,
    reason: "Sufficient space to dodge",
  };
}

/**
 * Get charge momentum modifiers (expanded for all terrain types)
 * @param {Object} attacker - Charging attacker
 * @param {Object} defender - Defender
 * @param {number} distance - Distance charged
 * @param {number} tunnelWidth - Width of tunnel/corridor
 * @param {number} terrainDensity - Terrain density (for forest/ruins)
 * @param {boolean} hasObstructions - Are there trees/rocks?
 * @param {boolean} isBrace - Is defender braced (polearm, shield)?
 * @param {boolean} isMounted - Is attacker mounted?
 * @returns {Object} Modifiers {strike: number, damageMultiplier: number, notes: string[]}
 */
export function getChargeMomentumModifiers(
  attacker,
  defender,
  distance,
  tunnelWidth,
  terrainDensity = 0,
  hasObstructions = false,
  isBrace = false,
  isMounted = false
) {
  const modifiers = {
    strike: 2, // Base charge bonus
    damageMultiplier: 2, // Base charge damage multiplier
    notes: [],
  };

  // Mounted charge bonuses
  if (isMounted) {
    modifiers.strike += 2; // +2 total (+4 combined)
    modifiers.damageMultiplier = 3; // Triple damage with lance/polearm
    modifiers.notes.push(
      "Mounted charge: +2 strike, triple damage (critical on 19-20)"
    );
  }

  // Check if defender can dodge
  const envCategory = getEnvironmentCategory(
    tunnelWidth,
    10,
    terrainDensity,
    hasObstructions
  );
  const dodgeCheck = canDodgeCharge(defender, attacker, tunnelWidth);

  if (!dodgeCheck.canDodge || envCategory === "NARROW_TRAIL") {
    modifiers.notes.push(`⚠️ ${dodgeCheck.reason} - Defender cannot Dodge`);
    modifiers.notes.push(
      "Defender may only Parry (at -2) or Brace (if available)"
    );
  }

  // Dense forest/overgrown ruins - no mounted charges
  if (hasObstructions && terrainDensity >= 0.7) {
    if (isMounted) {
      modifiers.notes.push("⚠️ Dense forest prevents mounted charge");
      modifiers.strike = 0;
      modifiers.damageMultiplier = 1;
    } else {
      modifiers.notes.push(
        "⚠️ Dense terrain may cause large creatures to hit trees on natural 1-2"
      );
    }
  }

  // Narrow trail/canyon - large enemies gain advantage
  if (envCategory === "NARROW_TRAIL") {
    const attackerSize = attacker.size || "MEDIUM";
    if (
      attackerSize === "LARGE" ||
      attackerSize === "HUGE" ||
      attacker.weight > 300
    ) {
      modifiers.strike += 2; // Total +4 strike
      modifiers.notes.push(
        "Large creature gains advantage in narrow trail (+2 additional strike)"
      );
    }
  }

  // Brace bonus (polearm set against charge)
  if (isBrace) {
    modifiers.strike += 2; // +2 total strike bonus
    modifiers.damageMultiplier = 3; // Triple damage if braced
    modifiers.notes.push(
      "Defender is braced - +2 strike, triple damage, attacker takes damage on natural 18-20"
    );
  }

  // Wall crush damage (if walls behind defender)
  if (tunnelWidth <= 6 || envCategory === "NARROW_TRAIL") {
    modifiers.notes.push(
      "⚠️ Narrow passage - if attack hits, add +1d6 damage (crushed against wall/tree)"
    );
  }

  // Weight comparison (attacker 2x defender weight = knockdown)
  const attackerWeight = attacker.weight || 150;
  const defenderWeight = defender.weight || 150;
  if (attackerWeight >= defenderWeight * 2) {
    modifiers.notes.push(
      "⚠️ Massive attacker - failed Parry/Brace results in Knockdown check (roll vs P.E. or fall prone, lose 1 action)"
    );
  }

  // Failed charge (miss by >5) - attacker loses balance
  modifiers.notes.push(
    "⚠️ If charge misses by >5, attacker loses balance (-2 to next melee)"
  );

  return modifiers;
}

/**
 * Check if collision momentum damage applies (expanded)
 * @param {Object} attacker1 - First attacker
 * @param {Object} attacker2 - Second attacker (if both charging)
 * @param {number} distance1 - Distance attacker1 moved
 * @param {number} distance2 - Distance attacker2 moved
 * @param {boolean} isImmovableObject - Did attacker hit wall/tree/rock?
 * @returns {Object} {applies: boolean, damage1: number, damage2: number, knockback: number, notes: string[]}
 */
export function getCollisionMomentumDamage(
  attacker1,
  attacker2,
  distance1,
  distance2,
  isImmovableObject = false
) {
  // Collision damage: 1d6 per 10ft of movement
  const damage1 = Math.floor(distance1 / 10);
  const damage2 = attacker2 ? Math.floor(distance2 / 10) : 0;

  // Knockback distance = 1ft per point of damage
  const knockback1 = damage1;
  const knockback2 = damage2;

  const notes = [];

  if (isImmovableObject) {
    // Hit wall/tree/rock
    notes.push(
      `Impact! ${attacker1.name} hits immovable object - takes ${damage1}d6 damage`
    );
    notes.push(`Knockback: ${knockback1}ft`);
    notes.push(
      "Critical failure (natural 1-2) results in stumble/prone, losing next melee"
    );
  } else if (attacker2) {
    // Head-on collision
    notes.push(
      `Collision! ${attacker1.name} takes ${damage1}d6 damage (knockback ${knockback1}ft)`
    );
    notes.push(
      `${attacker2.name} takes ${damage2}d6 damage (knockback ${knockback2}ft)`
    );
    notes.push(
      "Critical failure (natural 1-2) results in stumble/prone, losing next melee"
    );
  }

  return {
    applies: true,
    damage1: damage1,
    damage2: damage2,
    knockback1: knockback1,
    knockback2: knockback2,
    notes: notes,
  };
}

/**
 * Check if terrain prevents charge
 * @param {number} terrainDensity - Terrain density (0.0-1.0)
 * @param {boolean} hasObstructions - Are there trees/rocks/rubble?
 * @param {boolean} isMounted - Is charge mounted?
 * @returns {Object} {canCharge: boolean, reason: string}
 */
export function canChargeInTerrain(
  terrainDensity,
  hasObstructions,
  isMounted = false
) {
  // Dense brush/roots - no running or charging
  if (terrainDensity >= 0.8) {
    return {
      canCharge: false,
      reason: "Dense brush/roots prevent charging (movement halved)",
    };
  }

  // Dense forest - no mounted charges
  if (hasObstructions && terrainDensity >= 0.7 && isMounted) {
    return {
      canCharge: false,
      reason: "Dense forest prevents mounted charges",
    };
  }

  // Rocky slopes - risk of slipping
  if (terrainDensity >= 0.6 && hasObstructions) {
    return {
      canCharge: true,
      reason:
        "Rocky terrain - P.P. roll required on charge failure or fall prone",
    };
  }

  return {
    canCharge: true,
    reason: "Terrain allows charge",
  };
}

/**
 * Check if heavy weapon recovery applies
 * @param {Object} weapon - Weapon that missed
 * @param {number} missMargin - By how much did the attack miss (attackRoll - targetAR)
 * @returns {Object} {requiresRecovery: boolean, actionCost: number, notes: string[]}
 */
export function getHeavyWeaponRecovery(weapon, missMargin) {
  const weaponType = getWeaponType(weapon);
  const name = (weapon.name || "").toLowerCase();
  const isHeavy =
    weaponType === "HEAVY" ||
    name.includes("axe") ||
    name.includes("maul") ||
    name.includes("warhammer");

  if (!isHeavy) {
    return {
      requiresRecovery: false,
      actionCost: 0,
      notes: [],
    };
  }

  // Heavy weapons that miss by 5+ require recovery
  if (missMargin <= -5) {
    return {
      requiresRecovery: true,
      actionCost: 1,
      notes: [
        "Heavy weapon missed by 5+ - requires 1 melee action to recover stance",
        "If surrounded, suffers -1 Dodge until recovered",
      ],
    };
  }

  return {
    requiresRecovery: false,
    actionCost: 0,
    notes: [],
  };
}

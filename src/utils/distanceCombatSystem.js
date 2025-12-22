/**
 * Distance-Based Combat System
 * Implements Palladium Fantasy RPG distance mechanics for tactical combat
 *
 * OFFICIAL 1994 PALLADIUM FANTASY RULES:
 * - One melee round = 15 seconds
 * - Speed (Spd) × 6 = yards per melee (running speed)
 * - Walking speed = ~half of running speed
 * - Movement per action = (Speed × 6) ÷ Attacks per Melee
 * - Convert yards to feet: yards × 3 = feet
 *
 * Key Rules:
 * - Must be within weapon range to attack
 * - Can move and attack in same action (reduced movement)
 * - Charge attacks: +2 strike, double damage, lose next attack
 */

import { calculateDistance } from "../data/movementRules.js";
import { MOVEMENT_RATES, ENGAGEMENT_RANGES } from "../data/movementRules.js";
import { getDynamicWidth, isTightTerrain } from "./environmentMetrics.js";
import { canUseWeapon } from "./combatEnvironmentLogic.js";
import {
  isWithinWhipReach,
  validateFlexibleWeaponReach,
} from "./whipReachSystem.js";
import {
  canFly,
  isFlying,
  getAltitude,
  calculateFlightMovement,
} from "./abilitySystem.js";
import { getWeaponLength } from "./combatEnvironmentLogic.js";

/**
 * Calculate movement per action based on Speed and attacks per melee
 * OFFICIAL 1994 PALLADIUM FANTASY FORMULA:
 * - Speed × 18 = feet per melee (running speed)
 * - Movement per action = (Speed × 18) ÷ Attacks per Melee
 * - Walking speed = ~half of running speed
 * - Flight speed = Speed × multiplier × 18 feet per melee (e.g., Spd ×8)
 *
 * @param {number} speed - Character's Speed attribute
 * @param {number} attacksPerMelee - Number of attacks per melee round
 * @param {Object} fighter - Optional fighter object (for flight speed calculation)
 * @returns {Object} Movement calculations
 */
export function calculateMovementPerAction(
  speed,
  attacksPerMelee,
  fighter = null
) {
  // Check if fighter is flying and has flight speed multiplier
  const isCurrentlyFlying = fighter && isFlying(fighter);
  if (isCurrentlyFlying) {
    const flightMovement = calculateFlightMovement(fighter, attacksPerMelee);
    if (flightMovement) {
      return {
        ...flightMovement,
        display: {
          feetPerAction: Math.round(flightMovement.feetPerAction),
          feetPerMelee: Math.round(flightMovement.feetPerMelee),
        },
        isFlight: true,
      };
    }
  }

  // Ground movement: OFFICIAL 1994 PALLADIUM FORMULA: Speed × 18 = feet per melee (running)
  const feetPerMelee = speed * 18;
  const feetPerAction = feetPerMelee / attacksPerMelee;

  // Walking speed is ~half of running speed (Palladium rule)
  const walkingFeetPerAction = Math.floor(feetPerAction * 0.5);

  return {
    // Feet (for tactical map)
    feetPerMelee,
    feetPerAction,

    // Combat movement (when taking actions, reduced speed)
    combatMovementPerAction: walkingFeetPerAction, // Walking speed when fighting
    fullMovementPerAction: feetPerAction, // Full running speed

    // Display values
    display: {
      feetPerAction: Math.round(feetPerAction),
      feetPerMelee: Math.round(feetPerMelee),
    },
    isFlight: false,
  };
}

/**
 * Determine if character can reach target and attack in same action
 * @param {Object} attacker - Attacking character
 * @param {Object} target - Target character
 * @param {Object} attackerPos - Attacker's position {x, y}
 * @param {Object} targetPos - Target's position {x, y}
 * @param {Object} weapon - Weapon being used
 * @returns {Object} Analysis of movement and attack options
 */
export function analyzeMovementAndAttack(
  attacker,
  target,
  attackerPos,
  targetPos,
  weapon
) {
  const distance = calculateDistance(attackerPos, targetPos);
  const speed =
    attacker.Spd ||
    attacker.spd ||
    attacker.attributes?.Spd ||
    attacker.attributes?.spd ||
    10;
  const attacksPerMelee = attacker.attacksPerMelee || 1;

  const movement = calculateMovementPerAction(speed, attacksPerMelee, attacker);
  const weaponRange = getWeaponRange(weapon);

  // Check if already in range
  const inRange = distance <= weaponRange;

  // Calculate if can reach and attack in one action
  // Use walking speed (combat movement) when taking actions
  const canReachAndAttack =
    distance <= movement.combatMovementPerAction + weaponRange;

  // Calculate if can charge (20-60 feet for charge attacks)
  const canCharge = distance >= 20 && distance <= 60 && weaponRange <= 5; // Melee weapons only

  // Calculate actions needed to reach target
  const actionsToReach = Math.ceil(
    (distance - weaponRange) / movement.combatMovementPerAction
  );

  return {
    distance: Math.round(distance),
    inRange,
    canReachAndAttack,
    canCharge,
    actionsToReach: Math.max(0, actionsToReach),
    weaponRange,
    movementPerAction: movement.combatMovementPerAction,
    fullMovementPerAction: movement.fullMovementPerAction,
    recommendations: generateMovementRecommendations(
      distance,
      weaponRange,
      movement,
      canCharge
    ),
  };
}

/**
 * Get weapon range based on weapon type
 * @param {Object} weapon - Weapon object
 * @returns {number} Range in feet
 */
export function getWeaponRange(weapon) {
  if (!weapon) return 5.5; // Unarmed - default to adjacent hex range

  // Ranged weapons
  if (weapon.range && weapon.range > 0) {
    return weapon.range;
  }

  // Melee weapons: In hex-based combat, all melee weapons can reach adjacent hexes (5ft)
  // The weapon.reach property is for reach weapons that can attack BEYOND adjacent hexes
  // For adjacent hexes (5ft), ALL melee weapons should work
  if (weapon.reach && weapon.reach > 0) {
    // Use weapon reach, but ensure minimum of 5ft for adjacent hex combat
    return Math.max(weapon.reach, 5.5);
  }

  // Default melee range (with tolerance for hex grid precision)
  return 5.5; // Allow slight tolerance for hex grid calculations
}

/**
 * Generate movement recommendations based on situation
 * @param {number} distance - Distance to target
 * @param {number} weaponRange - Weapon range
 * @param {Object} movement - Movement calculations
 * @param {boolean} canCharge - Whether charge is possible
 * @returns {Array} Array of recommendation objects
 */
function generateMovementRecommendations(
  distance,
  weaponRange,
  movement,
  canCharge
) {
  const recommendations = [];

  if (distance <= weaponRange) {
    recommendations.push({
      action: "Attack immediately",
      description: "You're already in range to attack",
      priority: "high",
    });
  } else if (distance <= movement.combatMovementPerAction + weaponRange) {
    recommendations.push({
      action: "Move and attack",
      description: `Move ${Math.round(
        distance - weaponRange
      )}ft and attack in same action`,
      priority: "high",
    });
  } else if (canCharge) {
    recommendations.push({
      action: "Charge attack",
      description: "Charge for +2 strike, double damage, but lose next attack",
      priority: "medium",
    });
  } else if (distance <= movement.fullMovementPerAction + weaponRange) {
    recommendations.push({
      action: "Run and attack",
      description: `Run ${Math.round(
        distance - weaponRange
      )}ft and attack (uses full movement)`,
      priority: "medium",
    });
  } else {
    const actionsNeeded = Math.ceil(
      (distance - weaponRange) / movement.combatMovementPerAction
    );
    recommendations.push({
      action: "Move closer",
      description: `Need ${actionsNeeded} action(s) to reach target`,
      priority: "low",
    });
  }

  return recommendations;
}

/**
 * Execute a charge attack
 * @param {Object} attacker - Attacking character
 * @param {Object} target - Target character
 * @param {Object} attackerPos - Attacker's position
 * @param {Object} targetPos - Target's position
 * @param {Object} weapon - Weapon being used
 * @param {Object} options - Additional options (terrain, actors, positions)
 * @returns {Object} Charge attack result
 */
export function executeChargeAttack(
  attacker,
  target,
  attackerPos,
  targetPos,
  weapon,
  options = {}
) {
  const distance = calculateDistance(attackerPos, targetPos);
  const speed =
    attacker.Spd ||
    attacker.spd ||
    attacker.attributes?.Spd ||
    attacker.attributes?.spd ||
    10;
  const attacksPerMelee = attacker.attacksPerMelee || 1;

  const movement = calculateMovementPerAction(speed, attacksPerMelee, attacker);
  const weaponRange = getWeaponRange(weapon);

  // Charge requirements
  const canCharge = distance >= 20 && distance <= 60 && weaponRange <= 5;

  if (!canCharge) {
    return {
      success: false,
      reason: "Cannot charge: must be 20-60 feet away and using melee weapon",
    };
  }

  // Check terrain-based charge feasibility
  const terrain = options.terrain || "OPEN_GROUND";
  const actors = options.actors || [];
  const positions = options.positions || {};

  // Get dynamic width along charge path
  const chargeWidth = getDynamicWidth(terrain, actors, {
    attackerPos,
    positions,
  });

  // Check if path is wide enough for charge
  const attackerWidth = options.attackerWidth || 2; // Default medium creature width
  const openPath = distance >= 20 && chargeWidth >= attackerWidth * 2;

  if (!openPath) {
    return {
      success: false,
      reason: `Path too narrow (${chargeWidth.toFixed(
        1
      )}ft) for charge maneuver`,
    };
  }

  // Check terrain stability for charge
  const terrainData = options.terrainData || {};
  const movementModifier = terrainData.movementModifier || 1.0;

  // Unstable terrain (swamp, dense forest) reduces charge success
  if (movementModifier < 0.6) {
    const chargeSuccess = Math.random() < 0.7; // 70% success in unstable terrain
    if (!chargeSuccess) {
      return {
        success: false,
        reason: "Unstable footing prevents charge",
      };
    }
  }

  // Tight terrain reduces charge effectiveness
  const isTight = isTightTerrain(terrain, actors, {
    attackerPos,
    positions,
  });

  let strikeBonus = 2; // Base charge bonus
  let damageMultiplier = 2; // Base charge damage multiplier

  if (isTight) {
    strikeBonus = 1; // Reduced bonus in tight spaces
    damageMultiplier = 1.5; // Reduced damage multiplier
  }

  // Calculate new position (move to adjacent to target)
  const moveDistance = distance - weaponRange;
  const newX = Math.round(
    attackerPos.x + (targetPos.x - attackerPos.x) * (moveDistance / distance)
  );
  const newY = Math.round(
    attackerPos.y + (targetPos.y - attackerPos.y) * (moveDistance / distance)
  );

  return {
    success: true,
    newPosition: { x: newX, y: newY },
    bonuses: {
      strike: strikeBonus, // Dynamic based on terrain
      damage: damageMultiplier, // Dynamic based on terrain
    },
    penalties: {
      loseNextAttack: true, // Lose next attack due to recovery
    },
    description: `Charge attack: +${strikeBonus} strike, ${damageMultiplier}x damage, lose next attack`,
    terrainModifiers: isTight
      ? "Tight terrain reduces charge effectiveness"
      : null,
  };
}

/**
 * Calculate hold action (ready attack)
 * @param {Object} character - Character holding action
 * @param {string} trigger - Trigger condition
 * @returns {Object} Hold action result
 */
export function executeHoldAction(character, trigger = "enemy enters range") {
  return {
    action: "Hold",
    trigger,
    description: `Ready to attack when ${trigger}`,
    interrupts: true, // Can interrupt other actions
    priority: "immediate", // Acts immediately when trigger occurs
  };
}

/**
 * Get engagement range for distance
 * @param {number} distance - Distance in feet
 * @returns {Object} Engagement range info
 */
export function getEngagementRange(distance) {
  if (distance <= ENGAGEMENT_RANGES.MELEE.distance) {
    return ENGAGEMENT_RANGES.MELEE;
  } else if (distance <= ENGAGEMENT_RANGES.CLOSE.distance) {
    return ENGAGEMENT_RANGES.CLOSE;
  } else if (distance <= ENGAGEMENT_RANGES.MEDIUM.distance) {
    return ENGAGEMENT_RANGES.MEDIUM;
  } else if (distance <= ENGAGEMENT_RANGES.LONG.distance) {
    return ENGAGEMENT_RANGES.LONG;
  } else {
    return ENGAGEMENT_RANGES.EXTREME;
  }
}

/**
 * Validate if attack is possible at current distance
 * @param {Object} attacker - Attacking character
 * @param {Object} target - Target character
 * @param {Object} attackerPos - Attacker's position
 * @param {Object} targetPos - Target's position
 * @param {Object} weapon - Weapon being used
 * @returns {Object} Attack validation result
 */
export function validateAttackRange(
  attacker,
  target,
  attackerPos,
  targetPos,
  weapon,
  overrideDistance = null
) {
  const weaponRange = getWeaponRange(weapon);

  const weaponNameLower = (weapon?.name || "").toLowerCase();
  const isNameRanged =
    weaponNameLower.includes("bow") ||
    weaponNameLower.includes("crossbow") ||
    weaponNameLower.includes("sling") ||
    weaponNameLower.includes("thrown");

  const horizontalDistance =
    typeof overrideDistance === "number" && !Number.isNaN(overrideDistance)
      ? overrideDistance
      : calculateDistance(attackerPos, targetPos);

  const verticalDistance = Math.abs(
    (getAltitude(attacker) || 0) - (getAltitude(target) || 0)
  );

  // ✅ Use 3D distance for ranged attacks so planner/AI/executor agree.
  const distance =
    isNameRanged || (weapon?.range && weapon.range > 10)
      ? Math.hypot(horizontalDistance, verticalDistance)
      : horizontalDistance;

  const engagementRange = getEngagementRange(distance);

  // Check if target is currently flying (airborne) vs just having flight capability
  const targetIsFlying = isFlying(target);
  const attackerCanFly = canFly(attacker);
  const attackerIsFlying = isFlying(attacker);
  const targetAltitude = getAltitude(target) || 0;
  const attackerAltitude = getAltitude(attacker) || 0;

  // Check if this is a melee attack (weapon range <= 10 feet typically)
  // Treat name-ranged weapons as non-melee even if their range metadata is missing (prevents melee altitude gating for bows).
  const isMeleeAttack = weaponRange <= 10 && !isNameRanged;

  // Check if attacker has ranged weapons
  const weaponName = weaponNameLower;
  const hasRangedWeapon =
    weaponName.includes("bow") ||
    weaponName.includes("crossbow") ||
    weaponName.includes("sling") ||
    weaponName.includes("thrown") ||
    (weapon?.range && weapon.range > 10);

  // For melee attacks, check vertical reach in both directions:
  // - Ground attacker vs flying target (existing check)
  // - Flying attacker vs ground target (NEW: must dive to melee altitude)
  // - Special handling for flexible reach weapons (whips) with 3D reach calculation
  let isUnreachable = false;
  if (isMeleeAttack && !hasRangedWeapon) {
    // Check if this is a flexible reach weapon (like Fire Whip)
    const weaponName = (weapon?.name || "").toLowerCase();
    const isFlexibleReach =
      weapon?.weaponType === "flexible" ||
      weapon?.properties?.flexible === true ||
      weapon?.properties?.entangleCapable === true ||
      weaponName.includes("whip");

    if (isFlexibleReach && weapon?.reach && weapon.reach > 5) {
      // Use 3D reach calculation for flexible weapons
      const withinReach = isWithinWhipReach(
        attackerPos,
        targetPos,
        attackerAltitude,
        targetAltitude,
        weapon.reach
      );

      if (!withinReach) {
        isUnreachable = true;
      }
    } else {
      // Standard melee reach calculation
      const verticalSeparation = Math.abs(attackerAltitude - targetAltitude);
      const weaponReach = getWeaponLength(weapon, attacker) || weaponRange;
      // Rough estimate: weapon reach + body reach (3ft for arm/neck extension)
      const maxMeleeVertical = weaponReach + 3;

      // Check if vertical separation exceeds melee reach
      if (verticalSeparation > maxMeleeVertical) {
        // Determine which direction the problem is
        if (targetIsFlying && !attackerIsFlying) {
          // Ground attacker trying to hit high-flying target
          if (targetAltitude > 15) {
            isUnreachable = true;
          } else if (weaponReach < targetAltitude || weaponReach < 10) {
            // Short weapon can't reach even low-flying target
            isUnreachable = true;
          }
        } else if (attackerIsFlying && !targetIsFlying) {
          // Flying attacker trying to hit ground target from high altitude
          // Attacker must dive to melee altitude (0-5ft) to attack
          if (attackerAltitude > maxMeleeVertical) {
            isUnreachable = true;
          }
        } else if (attackerIsFlying && targetIsFlying) {
          // Both flying - check if they're at similar altitudes
          if (verticalSeparation > maxMeleeVertical) {
            isUnreachable = true;
          }
        }
      }
    }
  }

  let canAttack = distance <= weaponRange && !isUnreachable;

  let reason;
  if (isUnreachable) {
    const verticalSeparation = Math.abs(attackerAltitude - targetAltitude);
    if (targetIsFlying && !attackerIsFlying) {
      if (targetAltitude > 15) {
        reason = `${
          target.name || "Target"
        } is flying too high (${targetAltitude}ft) to be reached by melee attacks from ground`;
      } else {
        reason = `${
          target.name || "Target"
        } is flying and cannot be reached by melee attacks from ground`;
      }
    } else if (attackerIsFlying && !targetIsFlying) {
      reason = `${
        attacker.name || "Attacker"
      } is flying too high (${attackerAltitude}ft) to reach ${
        target.name || "target"
      } on the ground with melee attacks`;
    } else if (attackerIsFlying && targetIsFlying) {
      reason = `${attacker.name || "Attacker"} and ${
        target.name || "target"
      } are at different altitudes (${verticalSeparation}ft apart) and cannot reach each other with melee attacks`;
    } else {
      reason = `Target is too high/low for melee attacks`;
    }
    canAttack = false;
  } else if (distance <= weaponRange) {
    reason = `Within range (${Math.round(distance)}ft ≤ ${weaponRange}ft)`;
  } else {
    reason = `Out of range (${Math.round(distance)}ft > ${weaponRange}ft)`;
  }

  return {
    canAttack,
    distance: Math.round(distance),
    weaponRange,
    engagementRange,
    reason,
    suggestions: canAttack
      ? []
      : generateMovementSuggestions(distance, weaponRange, attacker),
    isUnreachable: isUnreachable || false,
  };
}

/**
 * Generate movement suggestions when out of range
 * @param {number} distance - Current distance
 * @param {number} weaponRange - Weapon range
 * @param {Object} attacker - Attacking character
 * @returns {Array} Movement suggestions
 */
function generateMovementSuggestions(distance, weaponRange, attacker) {
  const speed =
    attacker.Spd ||
    attacker.spd ||
    attacker.attributes?.Spd ||
    attacker.attributes?.spd ||
    10;
  const attacksPerMelee = attacker.attacksPerMelee || 1;
  const movement = calculateMovementPerAction(speed, attacksPerMelee, attacker);

  const suggestions = [];

  if (distance <= movement.combatMovementPerAction + weaponRange) {
    suggestions.push("Move closer and attack in same action");
  } else if (distance >= 20 && distance <= 60 && weaponRange <= 5) {
    suggestions.push("Use charge attack for +2 strike and double damage");
  } else if (distance <= movement.fullMovementPerAction + weaponRange) {
    suggestions.push("Run closer and attack (uses full movement)");
  } else {
    suggestions.push("Spend actions moving closer");
  }

  // Add ranged weapon suggestions
  suggestions.push("Switch to ranged weapon if available");
  suggestions.push("Cast ranged spell if possible");
  suggestions.push("Hold action and wait for enemy to approach");

  return suggestions;
}

/**
 * Calculate movement options for enemy AI
 * @param {Object} enemy - Enemy character
 * @param {Object} target - Target character
 * @param {Object} enemyPos - Enemy's position
 * @param {Object} targetPos - Target's position
 * @param {Array} availableAttacks - Available attack options
 * @returns {Object} AI movement decision
 */
export function calculateEnemyMovementAI(
  enemy,
  target,
  enemyPos,
  targetPos,
  availableAttacks
) {
  const analysis = analyzeMovementAndAttack(
    enemy,
    target,
    enemyPos,
    targetPos,
    availableAttacks[0]
  );

  // Find best attack option
  const bestAttack = availableAttacks.reduce((best, attack) => {
    const attackAnalysis = analyzeMovementAndAttack(
      enemy,
      target,
      enemyPos,
      targetPos,
      attack
    );
    if (attackAnalysis.inRange && !best.inRange) return attack;
    if (attackAnalysis.canReachAndAttack && !best.canReachAndAttack)
      return attack;
    return best;
  }, availableAttacks[0]);

  const bestAnalysis = analyzeMovementAndAttack(
    enemy,
    target,
    enemyPos,
    targetPos,
    bestAttack
  );

  // AI decision logic
  let decision = "attack";
  let movementType = "none";
  let reason = "";

  if (bestAnalysis.inRange) {
    decision = "attack";
    reason = "Already in range";
  } else if (bestAnalysis.canCharge && bestAttack.reach <= 5) {
    decision = "charge";
    movementType = "charge";
    reason = "Charge attack available";
  } else if (bestAnalysis.canReachAndAttack) {
    decision = "move_and_attack";
    movementType = "move";
    reason = "Can reach and attack";
  } else if (bestAnalysis.actionsToReach <= 2) {
    decision = "move_closer";
    movementType = "run";
    reason = "Close enough to reach soon";
  } else {
    decision = "use_ranged";
    reason = "Too far, use ranged attack";
  }

  return {
    decision,
    movementType,
    reason,
    analysis: bestAnalysis,
    selectedAttack: bestAttack,
  };
}

/**
 * Simple axial hex distance helper (q,r with implied s = -q-r)
 * @param {Object} a - First hex position {q, r}
 * @param {Object} b - Second hex position {q, r}
 * @returns {number} Hex distance between the two positions
 */
function hexAxialDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

/**
 * Finds a retreat hex for a fleeing unit.
 *
 * - Considers hexes within `maxSteps` of startHex.
 * - Scores each by "minimum distance to any enemy".
 * - Returns the hex that maximizes that score.
 *
 * If gridWidth/gridHeight are omitted, it just ignores bounds.
 *
 * @param {Object} params - Parameters object
 * @param {Object} params.startHex - Starting hex position {q, r}
 * @param {Array<Object>} params.enemyPositions - Array of enemy hex positions [{q, r}, ...]
 * @param {number} params.maxSteps - Maximum steps to retreat (default: 3)
 * @param {number} [params.gridWidth] - Optional grid width for bounds checking
 * @param {number} [params.gridHeight] - Optional grid height for bounds checking
 * @returns {Object|null} Best retreat hex {q, r} or null if none found
 */
export function findRetreatDestination({
  startHex,
  enemyPositions,
  maxSteps = 3,
  gridWidth,
  gridHeight,
}) {
  if (!startHex || !enemyPositions || enemyPositions.length === 0) {
    return null;
  }

  const inBounds = (q, r) => {
    if (typeof gridWidth === "number" && typeof gridHeight === "number") {
      return q >= 0 && r >= 0 && q < gridWidth && r < gridHeight;
    }
    // If bounds are not provided, assume all candidates are valid
    return true;
  };

  let bestHex = null;
  let bestScore = -Infinity;

  for (let dq = -maxSteps; dq <= maxSteps; dq++) {
    for (let dr = -maxSteps; dr <= maxSteps; dr++) {
      const candidate = { q: startHex.q + dq, r: startHex.r + dr };

      // Skip staying in place
      const stepDist = hexAxialDistance(startHex, candidate);
      if (stepDist === 0 || stepDist > maxSteps) continue;

      if (!inBounds(candidate.q, candidate.r)) continue;

      let minEnemyDist = Infinity;
      for (const enemyPos of enemyPositions) {
        const d = hexAxialDistance(candidate, enemyPos);
        if (d < minEnemyDist) minEnemyDist = d;
      }

      // Maximize minimum distance to any enemy
      if (minEnemyDist > bestScore) {
        bestScore = minEnemyDist;
        bestHex = candidate;
      }
    }
  }

  return bestHex;
}

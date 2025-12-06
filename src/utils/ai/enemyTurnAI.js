/**
 * Enemy Turn AI Module
 *
 * Handles AI decision-making for enemy characters during combat.
 * This is a pure function module - no React hooks or state management.
 * All state updates are done via callbacks passed in the context.
 */

import CryptoSecureDice from "../cryptoDice";
import { getRandomCombatSpell } from "../../data/combatSpells";
import {
  decayAwareness,
  updateAwareness,
  getAwareness,
  AWARENESS_STATES,
} from "../aiVisibilityFilter";
import { hasSpecialSenses } from "../stealthSystem";
import { calculatePerceptionCheck } from "../terrainSystem";
import { getWeaponRange } from "../distanceCombatSystem";
import { canFly, isFlying, getAltitude } from "../abilitySystem";
import { getSizeCategory, SIZE_CATEGORIES } from "../sizeStrengthModifiers";
import { getWeaponSizeForRace, WEAPON_SIZE } from "../weaponSizeSystem";
import speciesBehaviorData from "../../data/speciesBehavior.json";
import {
  spendFlyingStamina,
  shouldLandToRest,
  recoverStamina,
} from "../combatFatigueSystem";
import {
  isScavenger,
  findNearbyCorpse,
  scavengeCorpse,
} from "../scavengingSystem";
import { findFoodItem, consumeItem } from "../consumptionSystem";
import { runFlyingTurn } from "./flyingBehaviorSystem";

/**
 * Hawk AI Helper Functions
 * Determines if a creature is a hawk and identifies preferred prey (tiny/small creatures)
 */

const SIZE_ORDER = [
  SIZE_CATEGORIES.TINY,
  SIZE_CATEGORIES.SMALL,
  SIZE_CATEGORIES.MEDIUM,
  SIZE_CATEGORIES.LARGE,
  SIZE_CATEGORIES.HUGE,
  SIZE_CATEGORIES.GIANT,
];

/**
 * Check if a creature is a hawk
 * @param {Object} creature - Creature object
 * @returns {boolean} True if creature is a hawk
 */
function isHawk(creature) {
  if (!creature) return false;
  const id = (
    creature.id ||
    creature.type ||
    creature.name ||
    creature.species ||
    ""
  ).toLowerCase();
  return id.includes("hawk");
}

/**
 * Check if target is an animal
 * @param {Object} target - Target creature
 * @returns {boolean} True if target is an animal
 */
function isAnimal(target) {
  if (!target) return false;
  const cat = (target.category || target.type || "").toLowerCase();
  return (
    cat === "animal" ||
    target.tags?.includes("animal") ||
    target.tags?.includes("Animal")
  );
}

/**
 * Check if target is a tiny or small animal (prey for hawks)
 * @param {Object} target - Target creature
 * @returns {boolean} True if target is tiny/small animal
 */
function isTinyOrSmallAnimal(target) {
  if (!isAnimal(target)) return false;

  const sizeCat = getSizeCategory(target);
  return sizeCat === SIZE_CATEGORIES.TINY || sizeCat === SIZE_CATEGORIES.SMALL;
}

/**
 * Check if target is faerie-sized (Fairy, Pixie, Sprite, etc.)
 * @param {Object} target - Target creature
 * @returns {boolean} True if target is faerie-sized
 */
function isFaerieSizedTarget(target) {
  if (!target) return false;

  const race =
    target.race || target.species || target.type || target.name || "";
  if (!race) return false;

  const weaponSize = getWeaponSizeForRace(race);
  return weaponSize === WEAPON_SIZE.FAERIE;
}

/**
 * Check if target is preferred hawk prey (tiny/small animals or faerie folk)
 * @param {Object} attacker - Attacking creature (should be hawk)
 * @param {Object} target - Target creature
 * @returns {boolean} True if target is preferred prey
 */
function isPreferredHawkPrey(attacker, target) {
  if (!isHawk(attacker)) return false;
  if (!target) return false;

  // Tiny/small animals: mice, small birds, etc.
  if (isTinyOrSmallAnimal(target)) return true;

  // Tiny faerie folk: Fairy, Pixie, Sprite, Brownie, etc.
  if (isFaerieSizedTarget(target)) return true;

  // Also check if target is explicitly TINY by size category
  const targetSize = getSizeCategory(target);
  if (targetSize === SIZE_CATEGORIES.TINY) return true;

  return false;
}

/**
 * Check if target is bigger and dangerous to hawk
 * @param {Object} attacker - Attacking creature (should be hawk)
 * @param {Object} target - Target creature
 * @returns {boolean} True if target is larger and threatening
 */
function isBiggerThreat(attacker, target) {
  if (!attacker || !target) return true; // Assume threat if unknown

  const attackerSize = getSizeCategory(attacker);
  const targetSize = getSizeCategory(target);

  const aIndex = SIZE_ORDER.indexOf(attackerSize);
  const tIndex = SIZE_ORDER.indexOf(targetSize);

  // If we don't know sizes, assume threat
  if (aIndex === -1 || tIndex === -1) return true;

  return tIndex > aIndex; // Target is strictly larger than the hawk
}

/**
 * Get species behavior profile for a creature
 * @param {Object} creature - Creature object
 * @returns {Object} Behavior profile or null
 */
function getSpeciesBehaviorProfile(creature) {
  if (!creature) return null;

  const species = creature.species || creature.race || creature.type || "";
  const speciesMap = speciesBehaviorData.species || {};

  // Try exact match first
  if (speciesMap[species]) {
    return speciesMap[species];
  }

  // Try case-insensitive match
  const speciesLower = species.toLowerCase();
  const matchingKey = Object.keys(speciesMap).find(
    (key) => key.toLowerCase() === speciesLower
  );
  if (matchingKey) {
    return speciesMap[matchingKey];
  }

  // Try partial match (e.g., "hawk" in "Hawk" or "Hawk (Giant)")
  for (const [key, profile] of Object.entries(speciesMap)) {
    if (
      speciesLower.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(speciesLower)
    ) {
      return profile;
    }
  }

  return null;
}

/**
 * Get flight style for a creature
 * @param {Object} creature - Creature object
 * @returns {string} Flight style: "circling", "hover", or "none"
 */
function getFlightStyle(creature) {
  if (!creature) return "none";
  const profile = getSpeciesBehaviorProfile(creature);
  return profile?.flightStyle || "none";
}

/**
 * Get cruise fraction (glide speed as fraction of full speed)
 * @param {Object} creature - Creature object
 * @returns {number} Cruise fraction (default 0.25 = 25%)
 */
function getCruiseFraction(creature) {
  if (!creature) return 0.25;
  const profile = getSpeciesBehaviorProfile(creature);
  return profile?.cruiseFraction ?? 0.25;
}

/**
 * Get circle preferences for a flying creature
 * @param {Object} creature - Creature object
 * @returns {Object} Circle preferences with radiusFt and toleranceFt
 */
function getCirclePrefs(creature) {
  if (!creature) return { radiusFt: 30, toleranceFt: 10 };
  const profile = getSpeciesBehaviorProfile(creature);
  return {
    radiusFt: profile?.circleRadiusFeet ?? 30,
    toleranceFt: profile?.circleRadiusToleranceFeet ?? 10,
  };
}

/**
 * Get full speed per action for a creature
 * @param {Object} creature - Creature object
 * @param {number} actionsPerMelee - Actions per melee round
 * @returns {number} Full speed per action in feet
 */
function getFullSpeedPerAction(creature, actionsPerMelee) {
  if (!creature || !actionsPerMelee || actionsPerMelee <= 0) return 5;

  // Use flying speed if available, otherwise use ground speed
  const speed =
    creature.flySpeedFt ||
    creature.Spd ||
    creature.spd ||
    creature.attributes?.Spd ||
    creature.attributes?.spd ||
    10;

  // Convert speed to feet per melee (Palladium: Speed × 18 = feet per melee)
  const speedFtPerMelee = speed * 18;
  return speedFtPerMelee / Math.max(actionsPerMelee, 1);
}

/**
 * Get flight focus point (target or enemy cluster center)
 * @param {Object} flier - Flying creature
 * @param {Object} context - AI context
 * @returns {Object} Focus point {x, y} or null
 */
function getFlightFocusPoint(flier, context) {
  const { positions, fighters, calculateDistance } = context;

  if (!positions[flier.id]) return null;

  // Find primary target (closest enemy)
  const enemies = fighters.filter(
    (f) =>
      f.type !== flier.type &&
      f.id !== flier.id &&
      f.currentHP > -21 &&
      positions[f.id]
  );

  if (enemies.length === 0) return positions[flier.id];

  // Find closest enemy
  const flierPos = positions[flier.id];
  let closestEnemy = null;
  let closestDist = Infinity;

  enemies.forEach((enemy) => {
    const dist = calculateDistance(flierPos, positions[enemy.id]);
    if (dist < closestDist) {
      closestDist = dist;
      closestEnemy = enemy;
    }
  });

  if (closestEnemy && positions[closestEnemy.id]) {
    return positions[closestEnemy.id];
  }

  // Fallback: use flier's current position
  return flierPos;
}

/**
 * Pick a circling hex for a flying creature
 * @param {Object} flier - Flying creature
 * @param {Object} focusPoint - Focus point to circle around
 * @param {Object} context - AI context
 * @returns {Object} Next hex position {x, y} or null
 */
function pickCirclingHex(flier, focusPoint, context) {
  const { positions, calculateDistance, isHexOccupied, GRID_CONFIG } = context;

  if (!positions[flier.id] || !focusPoint) return null;

  const currentPos = positions[flier.id];
  const { radiusFt, toleranceFt } = getCirclePrefs(flier);

  const minRadius = Math.max(radiusFt - toleranceFt, 5);
  const maxRadius = radiusFt + toleranceFt;

  // Generate candidate hexes in a ring around current position
  const candidates = [];
  const searchRadius = 3; // Search up to 3 hexes away

  for (let dx = -searchRadius; dx <= searchRadius; dx++) {
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      if (dx === 0 && dy === 0) continue; // Don't stay in same hex

      const candidate = {
        x: currentPos.x + dx,
        y: currentPos.y + dy,
      };

      // Check if hex is valid and not occupied
      if (isHexOccupied(candidate.x, candidate.y, flier.id)) continue;

      // Check distance from focus point
      const distFromFocus = calculateDistance(candidate, focusPoint);
      if (distFromFocus < minRadius || distFromFocus > maxRadius) continue;

      // Calculate distance from current position (prefer closer moves for smooth circling)
      const distFromCurrent = calculateDistance(currentPos, candidate);
      candidates.push({
        pos: candidate,
        distFromFocus,
        distFromCurrent,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by distance from current (prefer smooth gliding motion)
  candidates.sort((a, b) => a.distFromCurrent - b.distFromCurrent);

  // Prefer candidates that maintain similar distance to focus (smooth arc)
  const currentDistFromFocus = calculateDistance(currentPos, focusPoint);
  candidates.sort((a, b) => {
    const aDiff = Math.abs(a.distFromFocus - currentDistFromFocus);
    const bDiff = Math.abs(b.distFromFocus - currentDistFromFocus);
    if (Math.abs(aDiff - bDiff) < 2) {
      // If similar, prefer closer to current position
      return a.distFromCurrent - b.distFromCurrent;
    }
    return aDiff - bDiff;
  });

  return candidates[0].pos;
}

/**
 * Handle flying idle or harass action - circling behavior
 * @param {Object} flier - Flying creature
 * @param {Object} context - AI context
 * @returns {boolean} True if movement was performed
 */
function handleFlyingIdleOrHarassAction(flier, context) {
  const {
    positions,
    calculateDistance,
    setPositions,
    positionsRef,
    setFighters,
    addLog,
    GRID_CONFIG,
  } = context;

  if (!isFlying(flier)) return false;

  const flightStyle = getFlightStyle(flier);

  // Hovering creatures can stay put (magical flight, hummingbirds, etc.)
  if (flightStyle === "hover") return false;

  // Must be circling style
  if (flightStyle !== "circling") return false;

  const actionsPerMelee = flier.attacksPerMelee || flier.remainingAttacks || 4;
  const fullPerAction = getFullSpeedPerAction(flier, actionsPerMelee);
  const cruiseFraction = getCruiseFraction(flier);
  const glideFt = Math.max(5, fullPerAction * cruiseFraction); // At least 1 hex (5ft)

  // Get focus point (target or enemy cluster)
  const focusPoint = getFlightFocusPoint(flier, context);
  if (!focusPoint) return false;

  // Pick next circling hex
  const nextHex = pickCirclingHex(flier, focusPoint, context);
  if (!nextHex) {
    // Fallback: move one hex in a safe direction
    const currentPos = positions[flier.id];
    if (!currentPos) return false;

    // Try moving in a direction away from focus (if too close) or toward it (if too far)
    const currentDist = calculateDistance(currentPos, focusPoint);
    const { radiusFt } = getCirclePrefs(flier);
    const dx = focusPoint.x - currentPos.x;
    const dy = focusPoint.y - currentPos.y;
    const angle = Math.atan2(dy, dx);

    // If too close, move away; if too far, move closer
    const moveDirection = currentDist < radiusFt ? -1 : 1;
    const fallbackHex = {
      x: Math.round(currentPos.x + Math.cos(angle) * moveDirection),
      y: Math.round(currentPos.y + Math.sin(angle) * moveDirection),
    };

    // Update position
    setPositions((prev) => {
      const updated = { ...prev, [flier.id]: fallbackHex };
      positionsRef.current = updated;
      return updated;
    });

    addLog(
      `🦅 ${flier.name} drifts to maintain circling pattern (${fallbackHex.x}, ${fallbackHex.y})`,
      "info"
    );
    return true;
  }

  // Check distance to next hex
  const currentPos = positions[flier.id];
  const distanceToNext = calculateDistance(currentPos, nextHex);

  // Cap movement to glide distance
  if (distanceToNext > glideFt) {
    // Move partway towards nextHex
    const moveRatio = glideFt / distanceToNext;
    const partialHex = {
      x: Math.round(currentPos.x + (nextHex.x - currentPos.x) * moveRatio),
      y: Math.round(currentPos.y + (nextHex.y - currentPos.y) * moveRatio),
    };

    setPositions((prev) => {
      const updated = { ...prev, [flier.id]: partialHex };
      positionsRef.current = updated;
      return updated;
    });

    // Drain stamina for circling movement
    spendFlyingStamina(flier, "FLY_HOVER", 1);

    addLog(
      `🦅 ${flier.name} circles overhead, gliding to maintain position (${partialHex.x}, ${partialHex.y})`,
      "info"
    );
    return true;
  }

  // Full glide to chosen hex
  // Drain stamina for circling movement
  spendFlyingStamina(flier, "FLY_HOVER", 1);

  setPositions((prev) => {
    const updated = { ...prev, [flier.id]: nextHex };
    positionsRef.current = updated;
    return updated;
  });

  const distFromFocus = calculateDistance(nextHex, focusPoint);
  addLog(
    `🦅 ${flier.name} circles overhead, gliding to new position (${
      nextHex.x
    }, ${nextHex.y}) - maintaining ~${Math.round(distFromFocus)}ft radius`,
    "info"
  );

  // Deduct one action for movement
  setFighters((prev) =>
    prev.map((f) =>
      f.id === flier.id
        ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
        : f
    )
  );

  return true;
}

/**
 * Check if creature has skittish_flying_predator AI profile
 * @param {Object} creature - Creature object
 * @returns {boolean} True if creature has this profile
 */
function hasSkittishFlyingPredatorProfile(creature) {
  const profile = getSpeciesBehaviorProfile(creature);
  return profile?.aiProfile === "skittish_flying_predator";
}

/**
 * Check if target has weapons (armed threat)
 * @param {Object} target - Target creature
 * @returns {boolean} True if target is armed
 */
function isArmedThreat(target) {
  if (!target) return false;

  // Check for equipped weapons
  if (target.equippedWeapons?.primary || target.equippedWeapons?.secondary) {
    return true;
  }

  // Check for weapon in attacks
  const attacks = target.attacks || [];
  const hasWeaponAttack = attacks.some((a) => {
    const name = (a.name || "").toLowerCase();
    return (
      name.includes("sword") ||
      name.includes("axe") ||
      name.includes("mace") ||
      name.includes("spear") ||
      name.includes("dagger") ||
      name.includes("bow")
    );
  });

  return hasWeaponAttack;
}

/**
 * Count how many armed enemies are threatening the creature
 * @param {Object} creature - Creature to check
 * @param {Array} allFighters - All fighters in combat
 * @param {Object} positions - Position map
 * @param {Function} calculateDistance - Distance calculation function
 * @param {Function} canFighterAct - Function to check if fighter can act
 * @returns {number} Count of armed threats within 30ft
 */
function countArmedThreats(
  creature,
  allFighters,
  positions,
  calculateDistance,
  canFighterAct
) {
  if (!creature || !positions[creature.id]) return 0;

  const creaturePos = positions[creature.id];
  let threatCount = 0;

  allFighters.forEach((fighter) => {
    // Only count enemies (opposite type)
    if (fighter.type === creature.type || fighter.id === creature.id) return;
    if (!canFighterAct(fighter)) return;

    // Check if armed
    if (!isArmedThreat(fighter)) return;

    // Check if within threat range (30ft)
    if (positions[fighter.id]) {
      const dist = calculateDistance(creaturePos, positions[fighter.id]);
      if (dist <= 30) {
        threatCount++;
      }
    }
  });

  return threatCount;
}

/**
 * Run enemy turn AI
 * @param {Object} enemy - The enemy fighter object
 * @param {Object} context - Context object containing all necessary dependencies
 */
export function runEnemyTurnAI(enemy, context) {
  const {
    fighters,
    positions,
    combatTerrain,
    arenaEnvironment,
    meleeRound,
    turnIndex,
    turnCounter,
    combatActive,
    // Core helpers
    canFighterAct,
    getHPStatus,
    addLog,
    scheduleEndTurn,
    endTurn,
    // Distance & movement
    calculateDistance,
    isTargetBlocked,
    getBlockingCombatant,
    calculateTargetPriority,
    calculateEnemyMovementAI,
    analyzeMovementAndAttack,
    findFlankingPositions,
    calculateFlankingBonus,
    validateWeaponRange,
    handlePositionChange,
    isHexOccupied,
    findRetreatDestination,
    // Healing / support
    getAvailableSkills,
    isEvilAlignment,
    healerAbility,
    clericalHealingTouch,
    medicalTreatment,
    // AI engine
    createAIActionSelector,
    GRID_CONFIG,
    calculateMovementPerAction,
    MOVEMENT_RATES,
    MOVEMENT_ACTIONS,
    // Fog of war
    fogEnabled,
    visibleCells,
    canAISeeTarget,
    // State setters
    setPositions,
    setFighters,
    setDefensiveStance,
    setTemporaryHexSharing,
    setCombatActive,
    // Attack & combat
    attack,
    // Refs
    positionsRef,
    processingEnemyTurnRef,
    attackRef,
    combatEndCheckRef,
    // Other
    getTargetsInLine,
  } = context;

  // ✅ CRITICAL: Check if enemy can act (conscious, not dying/dead/unconscious)
  if (!canFighterAct(enemy)) {
    const hpStatus = getHPStatus(enemy.currentHP);
    addLog(
      `⏭️ ${enemy.name} cannot act (${hpStatus.description}), skipping turn`,
      "info"
    );
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }

  // Check if combat is still active
  if (!combatActive) {
    addLog(`⚠️ Combat ended, ${enemy.name} skips turn`, "info");
    processingEnemyTurnRef.current = false;
    return;
  }

  // Check if enemy has actions remaining
  if (enemy.remainingAttacks <= 0) {
    addLog(
      `⏭️ ${enemy.name} has no actions remaining - passing to next fighter in initiative order`,
      "info"
    );
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }

  // ✅ FIX: Filter players by visibility AND exclude unconscious/dying/dead targets
  // Only target conscious players (HP > 0) - unconscious/dying players are already defeated
  const allPlayers = fighters.filter(
    (f) =>
      f.type === "player" &&
      canFighterAct(f) &&
      f.currentHP > 0 && // Only conscious players
      f.currentHP > -21 // Not dead
  );

  // Decay awareness for each player target
  allPlayers.forEach((target) => {
    decayAwareness(enemy, target);
  });

  // 🦅 Flying Enemy Behavior Integration
  const enemyCanFly = canFly(enemy);
  const enemyIsFlying = isFlying(enemy);

  // If the enemy is airborne, ALWAYS delegate to the flying behavior system.
  // We never want flying creatures (like the hawk) to use ground flanking logic
  // while in the air.
  // Note: We check enemyIsFlying first (must be actually flying), then enemyCanFly (must have flight ability)
  if (enemyIsFlying && enemyCanFly) {
    addLog(
      `🦅 ${enemy.name} is airborne at ${
        enemy.altitudeFeet ?? enemy.altitude ?? 0
      }ft - using flying behavior`,
      "info"
    );

    runFlyingTurn(enemy, {
      fighters,
      positions,
      setPositions,
      enemyIndex: fighters.findIndex((f) => f.id === enemy.id),
      movementMap: null, // Not used in runFlyingTurn currently
      addLog,
      updateFighter: (id, updates) => {
        setFighters((prev) =>
          prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
        );
      },
      applyDamage: null, // Not used in runFlyingTurn currently
      endTurn,
      scheduleEndTurn,
      canFighterAct,
      selectBestAttackForEnemy: null, // Not used in runFlyingTurn currently
      isEnemyFlying: (id) => {
        const fighter = fighters.find((f) => f.id === id);
        return fighter ? isFlying(fighter) : false;
      },
      canFlyFn: canFly,
      getBestRangedAttack: null, // Not used in runFlyingTurn currently
      syncCombinedPositions: null, // Not used in runFlyingTurn currently
      applyFallDamage: null, // Not used in runFlyingTurn currently
      getEnemyAwarenessState: null, // Not used in runFlyingTurn currently
      setEnemyAwarenessState: null, // Not used in runFlyingTurn currently
      calculateDistanceFn: calculateDistance,
      importMetaEnv: import.meta.env,
    });

    // ✅ Do NOT fall through to ground AI when flying
    processingEnemyTurnRef.current = false;
    // Use setTimeout to ensure turn actually ends (scheduleEndTurn may have delays)
    setTimeout(() => {
      endTurn();
    }, 1500);
    return;
  }

  // 🕊️ FLIGHT AI: If enemy can fly but is currently grounded, check if threatened by melee-only enemies
  if (enemyCanFly && !enemyIsFlying && allPlayers.length > 0) {
    // Check if any nearby players are melee-only threats
    const threateningMeleeEnemies = allPlayers.filter((player) => {
      if (!positions[enemy.id] || !positions[player.id]) return false;
      const dist = calculateDistance(positions[enemy.id], positions[player.id]);
      if (dist > 30) return false; // Too far to be immediate threat

      // Check if player has ranged weapons
      const playerHasRanged =
        player.equippedWeapons?.primary ||
        player.equippedWeapons?.secondary ||
        player.attacks?.some((a) => {
          const name = a.name?.toLowerCase() || "";
          return (
            name.includes("bow") ||
            name.includes("crossbow") ||
            name.includes("sling") ||
            name.includes("thrown") ||
            (a.range && a.range > 10)
          );
        });

      // If player is close and has no ranged weapons, they're a melee threat
      return !playerHasRanged && dist <= 20;
    });

    if (threateningMeleeEnemies.length > 0) {
      // Take off to escape melee threats!
      // Altitude is tracked in 5ft increments (similar to hex distances)
      // Default take-off altitude: 30ft (6 hexes of altitude)
      const newAltitude = 30;
      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? { ...f, altitude: newAltitude, altitudeFeet: newAltitude }
            : f
        )
      );
      addLog(
        `🕊️ ${enemy.name} takes to the air (altitude: ${newAltitude}ft) to escape melee attackers!`,
        "info"
      );
      // Deduct one action for taking off
      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
            : f
        )
      );
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
  }

  // Filter visible targets and get awareness states
  const visiblePlayers = [];
  allPlayers.forEach((target) => {
    const isVisible = canAISeeTarget(enemy, target, positions, combatTerrain, {
      useFogOfWar: fogEnabled,
      fogOfWarVisibleCells: visibleCells,
    });

    if (isVisible) {
      visiblePlayers.push(target);
      // Update awareness to Alert when enemy can see target
      updateAwareness(enemy, target, AWARENESS_STATES.ALERT);
    } else {
      // Use calculatePerceptionCheck to determine if enemy can detect hidden target
      const perceptionCheck = calculatePerceptionCheck(enemy, target, {
        terrain: combatTerrain?.terrain,
        lighting: combatTerrain?.lighting || "BRIGHT_DAYLIGHT",
        distance:
          positions[enemy.id] && positions[target.id]
            ? calculateDistance(positions[enemy.id], positions[target.id])
            : 0,
      });

      // Check if enemy can still target Searching players (lost track but actively looking)
      const awareness = getAwareness(enemy, target);
      if (
        awareness === AWARENESS_STATES.SEARCHING ||
        hasSpecialSenses(enemy) ||
        perceptionCheck.success
      ) {
        visiblePlayers.push(target);
        // Keep awareness at Searching if enemy is actively looking
        if (awareness !== AWARENESS_STATES.SEARCHING) {
          updateAwareness(enemy, target, AWARENESS_STATES.SEARCHING);
        }
      } else {
        // Target is hidden - update awareness to Unaware if not already
        if (awareness !== AWARENESS_STATES.UNAWARE) {
          updateAwareness(enemy, target, AWARENESS_STATES.UNAWARE);
        }
      }
    }
  });

  // AI Skill Usage: Check if enemy should use healing/support skills before attacking
  const availableSkills = getAvailableSkills(enemy);
  const healingSkills = availableSkills.filter(
    (skill) =>
      skill.type === "healer_ability" ||
      skill.type === "clerical_ability" ||
      skill.type === "medical_skill"
  );

  // Check for allies that need healing (only for non-evil alignments)
  const enemyAlignment = enemy.alignment || enemy.attributes?.alignment || "";
  const isEvil = isEvilAlignment(enemyAlignment);

  if (healingSkills.length > 0 && !isEvil) {
    // Find injured allies (same type as enemy)
    const allies = fighters.filter(
      (f) =>
        f.type === enemy.type &&
        f.id !== enemy.id &&
        f.currentHP > -21 &&
        (f.currentHP < f.maxHP * 0.5 || f.currentHP <= 0) // Injured or dying
    );

    if (allies.length > 0) {
      // Prioritize dying allies (HP <= 0)
      const dyingAllies = allies.filter((a) => a.currentHP <= 0);
      const targetAlly = dyingAllies.length > 0 ? dyingAllies[0] : allies[0];

      // Check if enemy is adjacent to target (for touch skills)
      const enemyPos = positions[enemy.id];
      const allyPos = positions[targetAlly.id];
      const isAdjacent =
        enemyPos && allyPos && calculateDistance(enemyPos, allyPos) <= 5.5;

      if (isAdjacent) {
        // Select appropriate healing skill
        let selectedHealingSkill = null;

        // Prioritize Lust for Life for dying allies
        if (targetAlly.currentHP <= 0) {
          selectedHealingSkill = healingSkills.find(
            (s) => s.name === "Lust for Life"
          );
        }

        // Fallback to Healing Touch or First Aid
        if (!selectedHealingSkill) {
          selectedHealingSkill = healingSkills.find(
            (s) => s.name.includes("Healing Touch") || s.name === "First Aid"
          );
        }

        if (selectedHealingSkill) {
          // Check if enemy has enough resources
          let canUse = true;
          if (selectedHealingSkill.costType === "ISP") {
            const currentISP =
              enemy.currentISP || enemy.currentIsp || enemy.ISP || 0;
            canUse = currentISP >= selectedHealingSkill.cost;
          }

          if (canUse) {
            addLog(
              `🤖 ${enemy.name} uses ${selectedHealingSkill.name} on ${targetAlly.name}!`,
              "info"
            );

            // Execute the healing skill
            let skillResult = null;

            if (selectedHealingSkill.type === "healer_ability") {
              const powerName = selectedHealingSkill.name.replace(
                " (Healer)",
                ""
              );
              skillResult = healerAbility(enemy, targetAlly, powerName);

              if (!skillResult.error) {
                // Update enemy ISP
                setFighters((prev) =>
                  prev.map((f) =>
                    f.id === enemy.id
                      ? {
                          ...f,
                          currentISP: skillResult.ispRemaining,
                          ISP: skillResult.ispRemaining,
                        }
                      : f
                  )
                );

                // Update ally HP
                if (skillResult.healed !== undefined) {
                  setFighters((prev) =>
                    prev.map((f) =>
                      f.id === targetAlly.id
                        ? { ...f, currentHP: skillResult.currentHp }
                        : f
                    )
                  );
                }

                addLog(
                  skillResult.message,
                  skillResult.success === false ? "error" : "success"
                );
              }
            } else if (selectedHealingSkill.type === "clerical_ability") {
              skillResult = clericalHealingTouch(enemy, targetAlly);

              if (!skillResult.error) {
                setFighters((prev) =>
                  prev.map((f) =>
                    f.id === targetAlly.id
                      ? { ...f, currentHP: skillResult.currentHp }
                      : f
                  )
                );
                addLog(skillResult.message, "success");
              }
            } else if (selectedHealingSkill.type === "medical_skill") {
              const skillPercent = selectedHealingSkill.skillPercent || 50;
              skillResult = medicalTreatment(enemy, targetAlly, skillPercent);

              if (skillResult.healed > 0) {
                setFighters((prev) =>
                  prev.map((f) =>
                    f.id === targetAlly.id
                      ? { ...f, currentHP: skillResult.currentHp }
                      : f
                  )
                );
              }
              addLog(
                skillResult.message,
                skillResult.success ? "success" : "error"
              );
            }

            // Deduct action and end turn
            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id
                  ? {
                      ...f,
                      remainingAttacks: Math.max(
                        0,
                        f.remainingAttacks - selectedHealingSkill.cost
                      ),
                    }
                  : f
              )
            );

            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        }
      }
    }
  }

  const playerTargets = visiblePlayers;
  if (playerTargets.length === 0) {
    // Check if there are players but they're just not visible
    if (allPlayers.length > 0) {
      addLog(
        `👁️ ${enemy.name} cannot see any players (hidden/obscured).`,
        "info"
      );
    } else {
      addLog(`${enemy.name} has no targets and defends.`, "info");
    }
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }

  const normalizeLabel = (value) => {
    if (!value) return null;
    if (typeof value === "string") return value.toLowerCase();
    if (typeof value === "object") {
      const nested =
        value.key ??
        value.id ??
        value.slug ??
        value.type ??
        value.terrain ??
        value.name;
      if (typeof nested === "string") {
        return nested.toLowerCase();
      }
    }
    return null;
  };

  const engineTerrain =
    normalizeLabel(combatTerrain?.terrainData?.terrain) ??
    normalizeLabel(combatTerrain?.terrainData) ??
    normalizeLabel(combatTerrain?.terrain) ??
    normalizeLabel(arenaEnvironment?.terrainData?.terrain) ??
    normalizeLabel(arenaEnvironment?.terrainData) ??
    normalizeLabel(arenaEnvironment?.terrain) ??
    "plains";

  const engineLighting =
    normalizeLabel(combatTerrain?.lightingData?.lighting) ??
    normalizeLabel(combatTerrain?.lightingData) ??
    normalizeLabel(combatTerrain?.lighting) ??
    normalizeLabel(arenaEnvironment?.lightingData?.lighting) ??
    normalizeLabel(arenaEnvironment?.lightingData) ??
    normalizeLabel(arenaEnvironment?.lighting) ??
    "daylight";

  const engineContext = {
    combatants: fighters,
    environment: {
      terrain: engineTerrain,
      lighting: engineLighting,
    },
    positions: positionsRef.current || positions,
    logCallback: (message, type = "ai") => {
      addLog(message, type);
    },
  };

  let actionPlan = null;
  try {
    const selector = createAIActionSelector(engineContext);
    actionPlan = selector(enemy, playerTargets, fighters);
  } catch (error) {
    console.error("[AI] Failed to evaluate layered combat action", error);
    addLog(`⚠️ ${enemy.name} hesitates (AI error: ${error.message})`, "error");
  }

  if (actionPlan && !actionPlan.target && playerTargets.length > 0) {
    actionPlan.target = playerTargets[0];
  }

  if (actionPlan) {
    const aiType = (actionPlan.type || "").toLowerCase();
    if (aiType === "hold") {
      addLog(
        `[AI] ${enemy.name} holds position (${actionPlan.aiAction || "Hold"})`,
        "ai"
      );
      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? {
                ...f,
                remainingAttacks: Math.max(
                  0,
                  (f.remainingAttacks ?? enemy.remainingAttacks ?? 1) - 1
                ),
              }
            : f
        )
      );
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }

    if (aiType === "defend" || aiType === "dodge") {
      const stance =
        actionPlan.stance === "retreat"
          ? "Retreat"
          : actionPlan.defend === "parry"
          ? "Parry"
          : "Dodge";

      if (stance === "Retreat") {
        const currentPositions = positionsRef.current || positions;
        const currentPos = currentPositions?.[enemy.id];
        const threatPositions = playerTargets
          .map((target) => currentPositions?.[target.id])
          .filter(Boolean);

        const speed =
          enemy.Spd ||
          enemy.spd ||
          enemy.attributes?.Spd ||
          enemy.attributes?.spd ||
          10;
        const attacksPerMelee =
          enemy.attacksPerMelee || enemy.remainingAttacks || 1;
        const movementStats = calculateMovementPerAction(
          speed,
          Math.max(1, attacksPerMelee),
          enemy
        );
        const fullFeetPerAction =
          movementStats.fullMovementPerAction ||
          movementStats.feetPerAction ||
          (speed * 18) / Math.max(1, attacksPerMelee);
        const retreatSteps = Math.max(
          1,
          Math.min(Math.floor(fullFeetPerAction / GRID_CONFIG.CELL_SIZE), 5)
        );

        let retreatDestination = null;
        if (currentPos && threatPositions.length > 0) {
          retreatDestination = findRetreatDestination({
            currentPos,
            threatPositions,
            maxSteps: retreatSteps,
            enemyId: enemy.id,
            isHexOccupied,
          });
        }

        if (retreatDestination) {
          const retreatInfo = {
            action: "RETREAT",
            actionCost: 0,
            description: `Withdraw ${Math.round(
              retreatDestination.distanceFeet
            )}ft`,
          };
          handlePositionChange(
            enemy.id,
            retreatDestination.position,
            retreatInfo
          );
          addLog(
            `[AI] ${enemy.name} withdraws ${Math.round(
              retreatDestination.distanceFeet
            )}ft to (${retreatDestination.position.x}, ${
              retreatDestination.position.y
            }).`,
            "ai"
          );
        } else if (!currentPos) {
          addLog(
            `[AI] ${enemy.name} tries to withdraw but has no recorded position.`,
            "ai"
          );
        } else if (threatPositions.length === 0) {
          addLog(
            `[AI] ${enemy.name} looks for an escape path but no enemies are visible.`,
            "ai"
          );
        } else {
          addLog(
            `[AI] ${enemy.name} tries to withdraw but finds no safe space!`,
            "ai"
          );
        }

        setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Retreat" }));

        const currentEnemyState = fighters.find((f) => f.id === enemy.id);
        const remainingBefore =
          currentEnemyState?.remainingAttacks ?? enemy.remainingAttacks ?? 1;
        const remainingAfter = Math.max(0, remainingBefore - 1);

        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? {
                  ...f,
                  remainingAttacks: Math.max(
                    0,
                    (f.remainingAttacks ?? remainingBefore) - 1
                  ),
                }
              : f
          )
        );
        addLog(
          `⏭️ ${enemy.name} has ${remainingAfter} action(s) remaining this melee`,
          "info"
        );

        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      } else {
        addLog(
          `[AI] ${enemy.name} prepares to ${stance.toLowerCase()} (+defense).`,
          "ai"
        );
        if (stance === "Parry" || stance === "Dodge") {
          setDefensiveStance((prev) => ({ ...prev, [enemy.id]: stance }));
        }
      }

      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? {
                ...f,
                remainingAttacks: Math.max(
                  0,
                  (f.remainingAttacks ?? enemy.remainingAttacks ?? 1) - 1
                ),
              }
            : f
        )
      );
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
  }

  // Enhanced enemy AI with strategic reasoning (fallback/augment for strikes and specials)
  let target = actionPlan?.target || null;
  let reasoning = actionPlan?.aiAction
    ? `layered AI preference: ${actionPlan.aiAction}`
    : "";

  if (!target) {
    // Strategy 1: Target the weakest player (lowest HP percentage)
    const weakestTarget = playerTargets.reduce((weakest, current) => {
      const currentHPPct = current.currentHP / current.maxHP;
      const weakestHPPct = weakest.currentHP / weakest.maxHP;
      return currentHPPct < weakestHPPct ? current : weakest;
    });

    // Strategy 2: Target players with lowest AR (easiest to hit)
    const easyTarget = playerTargets.reduce((easiest, current) => {
      const currentAR = current.AR || current.ar || 10;
      const easiestAR = easiest.AR || easiest.ar || 10;
      return currentAR < easiestAR ? current : easiest;
    });

    // Strategy 3: Target players who are currently taking their turn (aggressive)
    const currentPlayerTarget = playerTargets.find(
      (f) => f.id === fighters[turnIndex]?.id
    );

    // Enhanced AI LOGIC: Smart target selection with pathfinding consideration

    // Calculate distances to all targets and check if they're reachable
    // Note: enemyCanFly and enemyIsFlying are declared earlier in function (line 684-685)
    const enemyHasRangedWeapon =
      enemy.equippedWeapons?.primary ||
      enemy.equippedWeapons?.secondary ||
      enemy.attacks?.some((a) => {
        const name = a.name?.toLowerCase() || "";
        return (
          name.includes("bow") ||
          name.includes("crossbow") ||
          name.includes("sling") ||
          name.includes("thrown") ||
          (a.range && a.range > 10)
        );
      });

    const targetsWithDistance = playerTargets
      .map((t) => {
        const dist =
          positions[enemy.id] && positions[t.id]
            ? calculateDistance(positions[enemy.id], positions[t.id])
            : Infinity;

        // Check if target is blocked by another combatant
        const isBlocked = isTargetBlocked(enemy.id, t.id, positions);

        // Check if target is currently flying and enemy cannot reach it
        const targetIsFlying = isFlying(t);
        const targetAltitude = getAltitude(t);

        // Target is unreachable if:
        // - Target is flying AND
        // - Enemy cannot fly (not airborne) AND
        // - Enemy has no ranged weapons AND
        // - Target altitude is too high for melee reach
        let isUnreachable = false;
        if (targetIsFlying && !enemyIsFlying && !enemyHasRangedWeapon) {
          // Check if enemy has long-reach melee weapons that could hit low-flying targets
          const hasLongReachWeapon =
            enemy.equippedWeapons?.primary ||
            enemy.equippedWeapons?.secondary ||
            enemy.attacks?.some((a) => {
              const name = a.name?.toLowerCase() || "";
              return (
                (name.includes("pike") ||
                  name.includes("lance") ||
                  name.includes("polearm") ||
                  name.includes("halberd")) &&
                targetAltitude <= 15
              );
            });
          isUnreachable = !hasLongReachWeapon;
        }

        return {
          target: t,
          distance: dist,
          hpPercent: t.currentHP / t.maxHP,
          isWounded: t.currentHP < t.maxHP,
          isBlocked: isBlocked,
          isUnreachable: isUnreachable,
          priority: calculateTargetPriority(t, dist, isBlocked),
        };
      })
      .sort((a, b) => a.priority - b.priority); // Sort by priority (lower = better)

    // Filter to only targets in reasonable range (within 100 ft to consider) and reachable
    const targetsInRange = targetsWithDistance.filter(
      (t) => t.distance <= 100 && !t.isUnreachable
    );

    // 🦅 HAWK AI: Special behaviors (landing, scavenging, hunting, circling, eating)
    // Note: enemyCanFly and enemyIsFlying are declared earlier in function (line 684-685)
    const isSkittishFlyingPredator =
      isHawk(enemy) || hasSkittishFlyingPredatorProfile(enemy);

    // 1. LANDING WHEN TIRED: If flying and low on stamina, find safe spot and land (HIGHEST PRIORITY)
    if (
      enemyIsFlying &&
      shouldLandToRest(enemy) &&
      enemy.remainingAttacks > 0
    ) {
      // Find safe landing hex (away from enemies)
      const myPos = positions[enemy.id];
      if (myPos) {
        // Find enemies nearby
        const nearbyEnemies = fighters
          .filter(
            (f) => f.type === "player" && canFighterAct(f) && f.currentHP > 0
          )
          .map((f) => ({
            fighter: f,
            pos: positions[f.id],
            dist: positions[f.id]
              ? calculateDistance(myPos, positions[f.id])
              : Infinity,
          }))
          .filter((e) => e.dist < 50); // Within 50ft

        // Try to find a hex away from enemies (simplified: move away from nearest threat)
        if (nearbyEnemies.length > 0) {
          const nearestThreat = nearbyEnemies.sort(
            (a, b) => a.dist - b.dist
          )[0];
          const threatPos = nearestThreat.pos;

          // Move away from threat
          const dx = myPos.x - threatPos.x;
          const dy = myPos.y - threatPos.y;
          const angle = Math.atan2(dy, dx);
          const retreatDistance = 20; // Move 20ft away
          const newPos = {
            x: myPos.x + Math.cos(angle) * (retreatDistance / 5),
            y: myPos.y + Math.sin(angle) * (retreatDistance / 5),
          };

          setPositions((prev) => {
            const updated = { ...prev, [enemy.id]: newPos };
            positionsRef.current = updated;
            return updated;
          });

          // Use sprint stamina for fleeing
          spendFlyingStamina(enemy, "FLY_SPRINT", 1);

          addLog(
            `🦅 ${enemy.name} is exhausted and flies to a safer location to rest.`,
            "info"
          );
        }

        // Land: set altitude to 0
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id ? { ...f, altitude: 0, altitudeFeet: 0 } : f
          )
        );

        addLog(
          `🦅 ${enemy.name} lands and perches to rest, recovering stamina.`,
          "info"
        );

        // Rest this action (recover stamina)
        recoverStamina(enemy, "FULL_REST", 1);

        // Deduct action
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
              : f
          )
        );

        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    // 2. SCAVENGING: If hawk is a scavenger and there's a corpse nearby, go eat it
    if (isScavenger(enemy) && enemy.remainingAttacks > 0) {
      const corpse = findNearbyCorpse(enemy, fighters, positions, 8); // 8 hex radius
      if (corpse) {
        const myPos = positions[enemy.id];
        const corpsePos = positions[corpse.id];

        if (myPos && corpsePos) {
          const distToCorpse = calculateDistance(myPos, corpsePos);

          // Move to corpse if not adjacent
          if (distToCorpse > 5) {
            // Move closer to corpse (simplified movement)
            const dx = corpsePos.x - myPos.x;
            const dy = corpsePos.y - myPos.y;
            const moveDistance = Math.min(5, distToCorpse - 5);
            const angle = Math.atan2(dy, dx);
            const newPos = {
              x: myPos.x + Math.cos(angle) * (moveDistance / 5),
              y: myPos.y + Math.sin(angle) * (moveDistance / 5),
            };

            setPositions((prev) => {
              const updated = { ...prev, [enemy.id]: newPos };
              positionsRef.current = updated;
              return updated;
            });

            // Drain stamina for movement
            if (enemyIsFlying) {
              spendFlyingStamina(enemy, "FLY_HOVER", 1);
            }

            addLog(
              `🦅 ${enemy.name} moves toward ${
                corpse.name || "a corpse"
              } to scavenge.`,
              "info"
            );

            // Deduct action
            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id
                  ? {
                      ...f,
                      remainingAttacks: Math.max(0, f.remainingAttacks - 1),
                    }
                  : f
              )
            );

            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          } else {
            // Adjacent to corpse - scavenge it
            scavengeCorpse(enemy, corpse, addLog);

            // Deduct action
            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id
                  ? {
                      ...f,
                      remainingAttacks: Math.max(0, f.remainingAttacks - 1),
                    }
                  : f
              )
            );

            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        }
      }
    }

    // 3. EATING: If grounded and has food, eat it (only when grounded, not flying)
    if (!enemyIsFlying && enemy.remainingAttacks > 0) {
      const foodItem = findFoodItem(enemy);
      if (foodItem) {
        consumeItem(enemy, foodItem, { log: addLog });

        // Deduct action
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
              : f
          )
        );

        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    if (isSkittishFlyingPredator) {
      const profile = getSpeciesBehaviorProfile(enemy);
      const stayAtRangeFeet = profile?.stayAtRangeFeet || 30;
      const fleeIfOutnumberedBy = profile?.fleeIfOutnumberedBy || 2;
      const fleeAtHpPercent = profile?.fleeAtHpPercent || 0.5;

      // Check flee conditions: hurt or outnumbered
      const hpPercent = enemy.currentHP / enemy.maxHP;
      const armedThreatCount = countArmedThreats(
        enemy,
        fighters,
        positions,
        calculateDistance,
        canFighterAct
      );
      const shouldFlee =
        hpPercent < fleeAtHpPercent || armedThreatCount >= fleeIfOutnumberedBy;

      if (shouldFlee) {
        addLog(
          `🦅 ${enemy.name} is ${
            hpPercent < fleeAtHpPercent ? "badly hurt" : "outnumbered"
          } and breaks off to escape!`,
          "info"
        );
        // Maintain altitude and move away from threats
        if (!enemyIsFlying) {
          const newAltitude = 20;
          setFighters((prev) =>
            prev.map((f) =>
              f.id === enemy.id
                ? { ...f, altitude: newAltitude, altitudeFeet: newAltitude }
                : f
            )
          );
          addLog(
            `🦅 ${enemy.name} takes to the air (altitude: ${newAltitude}ft)`,
            "info"
          );
        }
        // Move away from closest threat
        if (targetsInRange.length > 0) {
          const closestThreat = targetsInRange[0];
          const currentPos = positions[enemy.id];
          const threatPos = positions[closestThreat.target.id];
          if (currentPos && threatPos) {
            // Calculate direction away from threat
            const dx = currentPos.x - threatPos.x;
            const dy = currentPos.y - threatPos.y;
            const angle = Math.atan2(dy, dx);
            const fleeDistance = 10; // Move 10ft away
            const newPos = {
              x: currentPos.x + Math.cos(angle) * (fleeDistance / 5),
              y: currentPos.y + Math.sin(angle) * (fleeDistance / 5),
            };
            setPositions((prev) => {
              const updated = { ...prev, [enemy.id]: newPos };
              positionsRef.current = updated;
              return updated;
            });
            addLog(`🦅 ${enemy.name} flees to safety`, "info");
          }
        }
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      // 1) Prefer tiny prey (faeries + tiny/small animals)
      const preyTargets = targetsInRange.filter((t) =>
        isPreferredHawkPrey(enemy, t.target)
      );

      if (preyTargets.length > 0) {
        // Sort by distance and pick closest prey
        preyTargets.sort((a, b) => a.distance - b.distance);
        const bestPrey = preyTargets[0];
        target = bestPrey.target;
        const preyType = isFaerieSizedTarget(bestPrey.target)
          ? "faerie"
          : "small animal";
        reasoning = `🦅 ${
          enemy.name
        } spots ${preyType} prey and dives to attack (${Math.round(
          bestPrey.distance
        )}ft away)`;
      } else {
        // 2) No good prey — check for larger armed enemies
        const dangerousArmed = targetsInRange.filter(
          (t) => isBiggerThreat(enemy, t.target) && isArmedThreat(t.target)
        );

        if (dangerousArmed.length > 0) {
          // Stay at range - circle and maintain distance
          const currentPos = positions[enemy.id];
          const closestThreat = dangerousArmed[0];
          const threatPos = positions[closestThreat.target.id];
          const currentDist = closestThreat.distance;

          // If too close, move away to maintain stayAtRangeFeet
          if (currentDist < stayAtRangeFeet && currentPos && threatPos) {
            const dx = currentPos.x - threatPos.x;
            const dy = currentPos.y - threatPos.y;
            const angle = Math.atan2(dy, dx);
            const moveAwayDistance = Math.min(
              10,
              stayAtRangeFeet - currentDist
            );
            const newPos = {
              x: currentPos.x + Math.cos(angle) * (moveAwayDistance / 5),
              y: currentPos.y + Math.sin(angle) * (moveAwayDistance / 5),
            };
            setPositions((prev) => {
              const updated = { ...prev, [enemy.id]: newPos };
              positionsRef.current = updated;
              return updated;
            });
            addLog(
              `🦅 ${enemy.name} maintains distance from larger threats (staying ${stayAtRangeFeet}ft away)`,
              "info"
            );
            // Ensure flying
            if (!enemyIsFlying) {
              const newAltitude = 20;
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id
                    ? { ...f, altitude: newAltitude, altitudeFeet: newAltitude }
                    : f
                )
              );
            }
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          } else {
            // Already at safe distance - circle overhead
            addLog(
              `🦅 ${enemy.name} circles overhead, avoiding larger armed threats`,
              "info"
            );
            if (!enemyIsFlying) {
              const newAltitude = 20;
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id
                    ? { ...f, altitude: newAltitude, altitudeFeet: newAltitude }
                    : f
                )
              );
              addLog(
                `🦅 ${enemy.name} takes to the air (altitude: ${newAltitude}ft)`,
                "info"
              );
            }
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        } else if (targetsInRange.length > 0) {
          // Some targets are same size or smaller but not prey-type
          // Pick the smallest/closest non-dangerous target
          const safeTargets = targetsInRange.filter(
            (t) => !isBiggerThreat(enemy, t.target)
          );
          if (safeTargets.length > 0) {
            safeTargets.sort((a, b) => a.distance - b.distance);
            target = safeTargets[0].target;
            reasoning = `🦅 ${
              enemy.name
            } targets closest manageable foe (${Math.round(
              safeTargets[0].distance
            )}ft away)`;
          } else {
            // Fallback to closest
            target = targetsInRange[0].target;
            reasoning = `🦅 ${
              enemy.name
            } cautiously approaches closest target (${Math.round(
              targetsInRange[0].distance
            )}ft away)`;
          }
        } else {
          // No targets in range
          addLog(
            `🦅 ${enemy.name} circles overhead, no suitable targets in range`,
            "info"
          );
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }
    } else {
      // Normal AI target selection (non-hawk)
      // If no reachable targets, provide fallback behavior
      if (targetsInRange.length === 0 && targetsWithDistance.length > 0) {
        const allUnreachable = targetsWithDistance.every(
          (t) => t.isUnreachable
        );
        if (allUnreachable) {
          addLog(
            `🚫 ${enemy.name} cannot reach any targets - all enemies are flying and ${enemy.name} has no ranged weapons!`,
            "warning"
          );
          addLog(
            `😤 ${enemy.name} snorts in frustration and holds position.`,
            "info"
          );
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }

      if (targetsInRange.length === 0) {
        // No one in range, use fallback strategies
        if (weakestTarget && weakestTarget.currentHP < weakestTarget.maxHP) {
          target = weakestTarget;
          reasoning = `targeting the weakest foe (${Math.round(
            (weakestTarget.currentHP / weakestTarget.maxHP) * 100
          )}% HP)`;
        } else if (easyTarget && (easyTarget.AR || easyTarget.ar) < 10) {
          target = easyTarget;
          reasoning = `targeting easiest to hit (AR ${
            easyTarget.AR || easyTarget.ar
          })`;
        } else if (currentPlayerTarget) {
          target = currentPlayerTarget;
          reasoning = `targeting player currently taking turn (aggressive)`;
        } else {
          // Fallback to closest
          target = targetsWithDistance[0]?.target || playerTargets[0];
          reasoning = `targeting the closest reachable foe`;
        }
      } else {
        // Find best target considering reachability
        const reachableTargets = targetsInRange.filter((t) => !t.isBlocked);
        const blockedTargets = targetsInRange.filter((t) => t.isBlocked);

        if (reachableTargets.length > 0) {
          // Prefer reachable targets
          const bestReachable = reachableTargets[0];
          target = bestReachable.target;
          reasoning = `attacking closest reachable target (${Math.round(
            bestReachable.distance
          )}ft away)`;
        } else if (blockedTargets.length > 0) {
          // All targets blocked - try area attack or choose alternative
          const bestBlocked = blockedTargets[0];
          target = bestBlocked.target;
          reasoning = `target blocked by ${
            getBlockingCombatant(enemy.id, target.id, positions)?.name ||
            "another combatant"
          }, considering area attack`;
        } else {
          // Fallback
          target = targetsInRange[0].target;
          const dist = Math.round(targetsInRange[0].distance);
          reasoning = `attacking closest target (${dist}ft away)`;
        }
      }
    }
  } // <-- closes the `if (!target) {` block

  if (!reasoning) {
    reasoning = `following layered AI plan: ${
      actionPlan?.aiAction || "Strike"
    }`;
  }

  // Check if enemy needs to move closer to attack
  let needsToMoveCloser = false;
  let currentDistance = Infinity;

  // Select which attack to use (if creature has multiple attacks)
  const availableAttacks = enemy.attacks || [
    { name: "Claw", damage: "1d6", count: 1 },
  ];
  let selectedAttack = availableAttacks[0]; // Default to first attack
  let isChargingAttack = false; // Track if this will be a charge attack

  if (availableAttacks.length > 1) {
    // Check if creature has charge-type attacks (Horn Charge, Gore, Ram, etc.)
    const chargeAttacks = availableAttacks.filter(
      (a) =>
        a.name.toLowerCase().includes("charge") ||
        a.name.toLowerCase().includes("gore") ||
        a.name.toLowerCase().includes("ram") ||
        a.name.toLowerCase().includes("trample")
    );

    // Choose attack strategically from available
    if (chargeAttacks.length > 0) {
      // Has charge attack - choose randomly between charge and other attacks
      const allAttacks = [
        ...chargeAttacks,
        ...availableAttacks.filter((a) => !chargeAttacks.includes(a)),
      ];
      try {
        const attackRoll = CryptoSecureDice.parseAndRoll(
          `1d${allAttacks.length}`
        );
        selectedAttack = allAttacks[attackRoll.totalWithBonus - 1];
      } catch (error) {
        const isDev =
          import.meta.env.DEV || import.meta.env.MODE === "development";
        if (isDev) {
          console.warn(
            "[runEnemyTurnAI] Error rolling for attack selection:",
            error
          );
        }
        selectedAttack = allAttacks[0];
      }
    } else {
      // Choose attack strategically from available
      try {
        const attackRoll = CryptoSecureDice.parseAndRoll(
          `1d${availableAttacks.length}`
        );
        selectedAttack = availableAttacks[attackRoll.totalWithBonus - 1];
      } catch (error) {
        const isDev =
          import.meta.env.DEV || import.meta.env.MODE === "development";
        if (isDev) {
          console.warn(
            "[runEnemyTurnAI] Error rolling for available attack selection:",
            error
          );
        }
        selectedAttack = availableAttacks[0];
      }
    }
  }

  if (actionPlan?.aiAction && selectedAttack) {
    const aiActionName = actionPlan.aiAction.toLowerCase();
    const directMatch = availableAttacks.find(
      (attack) => (attack.name || "").toLowerCase() === aiActionName
    );
    if (directMatch) {
      selectedAttack = directMatch;
    } else if (aiActionName.includes("spell") && actionPlan.spell) {
      const spellAttack = {
        name: actionPlan.spell.name,
        damage: actionPlan.spell.damage || "by spell",
        type: "spell",
        spell: actionPlan.spell,
      };
      enemy.selectedAttack = spellAttack;
      selectedAttack = spellAttack;
    }
  }

  // If attack is Spellcasting, choose a specific spell
  let attackName = selectedAttack.name;
  if (
    selectedAttack.name === "Spellcasting" ||
    selectedAttack.damage === "by spell"
  ) {
    const spell = getRandomCombatSpell(enemy.level || 3);
    attackName = `${spell.name} (${spell.damageType})`;
    // Update the attack damage to use the spell's damage
    selectedAttack = {
      ...selectedAttack,
      damage: spell.damage,
      name: attackName,
    };
  }

  // Check weapon range for enemy attacks
  if (positions && positions[enemy.id] && positions[target.id]) {
    // Check if enemy just arrived from pending movement - use CURRENT position
    const enemyCurrentPos = positions[enemy.id];
    const targetCurrentPos = positions[target.id];

    // Recalculate distance with current positions using proper hex distance
    currentDistance = calculateDistance(enemyCurrentPos, targetCurrentPos);

    addLog(
      `📍 ${enemy.name} is at (${enemyCurrentPos.x}, ${enemyCurrentPos.y}), ${
        target.name
      } is at (${targetCurrentPos.x}, ${
        targetCurrentPos.y
      }), distance: ${Math.round(currentDistance)}ft`,
      "info"
    );

    // Use proper weapon range validation
    const rangeValidation = validateWeaponRange(
      enemy,
      target,
      selectedAttack,
      currentDistance
    );

    // Check if target is unreachable (flying target for ground creature)
    if (rangeValidation.isUnreachable) {
      addLog(
        `🚫 ${enemy.name} cannot reach ${target.name} - ${target.name} is flying and ${enemy.name} cannot fly!`,
        "warning"
      );
      // Skip this target and try another one, or do nothing this turn
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }

    if (!rangeValidation.canAttack) {
      needsToMoveCloser = true;
      addLog(
        `📍 ${enemy.name} is ${Math.round(currentDistance)}ft from ${
          target.name
        } (${rangeValidation.reason})`,
        "info"
      );
    } else {
      addLog(
        `✅ ${enemy.name} is in range (${rangeValidation.reason})`,
        "info"
      );
      if (rangeValidation.rangeInfo) {
        addLog(
          `📍 ${enemy.name} attacking at ${rangeValidation.rangeInfo}`,
          "info"
        );
      }
    }
  }

  // 🦅 FLYING CIRCLING BEHAVIOR: If flying creature is not actively attacking, make it circle
  // This happens BEFORE dive attacks or other movement, but only if no immediate action is needed
  const flightStyle = getFlightStyle(enemy);
  const isSkittishFlyingPredatorCheck =
    isHawk(enemy) || hasSkittishFlyingPredatorProfile(enemy);

  // Check if we should circle (flying, not attacking this action, not diving/fleeing)
  // Note: enemyIsFlying and enemyCanFly are declared later in the function, so we check isFlying here
  if (
    isFlying(enemy) &&
    flightStyle === "circling" &&
    enemy.remainingAttacks > 0
  ) {
    // Only circle if:
    // 1. No target selected, OR
    // 2. Target is out of range and we're not actively moving to attack, OR
    // 3. We're maintaining distance (skittish predator behavior)
    const shouldCircle =
      !target ||
      (target && currentDistance > 30 && !needsToMoveCloser) ||
      (isSkittishFlyingPredatorCheck &&
        target &&
        !isPreferredHawkPrey(enemy, target));

    if (shouldCircle) {
      const circled = handleFlyingIdleOrHarassAction(enemy, context);
      if (circled) {
        // Circling movement was performed, end turn
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }
  }

  // 🦅 HAWK DIVE ATTACK: If hawk is hunting prey, perform dive attack
  if (
    isHawk(enemy) &&
    target &&
    isPreferredHawkPrey(enemy, target) &&
    positions[enemy.id] &&
    positions[target.id]
  ) {
    const currentPos = positions[enemy.id];
    const targetPos = positions[target.id];
    const currentDist = calculateDistance(currentPos, targetPos);
    const enemyIsFlying = isFlying(enemy);
    const currentAltitude = getAltitude(enemy);

    // If hawk is flying high and prey is in range, dive to attack
    if (enemyIsFlying && currentAltitude >= 15 && currentDist <= 30) {
      // Dive attack: drop altitude to 0-5ft and move toward target
      const diveAltitude = Math.min(5, currentAltitude - 15); // Drop to low altitude

      // Move horizontally toward target if needed
      let newPos = currentPos;
      if (currentDist > 5) {
        // Move closer to target (simplified - just move in direction of target)
        const dx = targetPos.x - currentPos.x;
        const dy = targetPos.y - currentPos.y;
        const moveDistance = Math.min(5, currentDist - 5); // Move to get within 5ft
        const angle = Math.atan2(dy, dx);
        newPos = {
          x: currentPos.x + Math.cos(angle) * (moveDistance / 5),
          y: currentPos.y + Math.sin(angle) * (moveDistance / 5),
        };
      }

      // Update position and altitude
      setPositions((prev) => {
        const updated = { ...prev, [enemy.id]: newPos };
        positionsRef.current = updated;
        return updated;
      });

      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? { ...f, altitude: diveAltitude, altitudeFeet: diveAltitude }
            : f
        )
      );

      // Drain stamina for dive attack (sprint)
      spendFlyingStamina(enemy, "FLY_SPRINT", 1);

      addLog(
        `🦅 ${enemy.name} dives from ${currentAltitude}ft to ${diveAltitude}ft to strike ${target.name}!`,
        "info"
      );

      // Deduct movement action
      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
            : f
        )
      );

      // Attack immediately after dive
      setTimeout(() => {
        const newDistance = calculateDistance(newPos, targetPos);
        const rangeValidation = validateWeaponRange(
          enemy,
          target,
          selectedAttack,
          newDistance
        );

        if (rangeValidation.canAttack) {
          addLog(`🦅 ${enemy.name} strikes with talons!`, "info");
          if (attackRef.current) {
            attackRef.current(enemy, target.id, {});
          }

          // After attack, immediately fly back up and away (hit-and-run)
          setTimeout(() => {
            const currentPos = positions[enemy.id];
            const targetPos = positions[target.id];

            // Fly up to 20ft altitude
            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id ? { ...f, altitude: 20, altitudeFeet: 20 } : f
              )
            );
            addLog(`🦅 ${enemy.name} climbs back to 20ft altitude`, "info");

            // Move away from target (hit-and-run pattern)
            if (currentPos && targetPos) {
              const dx = currentPos.x - targetPos.x;
              const dy = currentPos.y - targetPos.y;
              const angle = Math.atan2(dy, dx);
              const moveAwayDistance = 10; // Move 10ft away
              const newPos = {
                x: currentPos.x + Math.cos(angle) * (moveAwayDistance / 5),
                y: currentPos.y + Math.sin(angle) * (moveAwayDistance / 5),
              };
              setPositions((prev) => {
                const updated = { ...prev, [enemy.id]: newPos };
                positionsRef.current = updated;
                return updated;
              });
              addLog(
                `🦅 ${enemy.name} breaks away after the attack (hit-and-run)`,
                "info"
              );
            }
          }, 500);
        } else {
          addLog(`🦅 ${enemy.name} misses the dive attack`, "info");
          // Still fly back up
          setFighters((prev) =>
            prev.map((f) =>
              f.id === enemy.id ? { ...f, altitude: 20, altitudeFeet: 20 } : f
            )
          );
        }

        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
      }, 1000);

      return;
    } else if (!enemyIsFlying && currentDist <= 30) {
      // Hawk on ground, take off and dive
      const takeOffAltitude = 20;
      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? { ...f, altitude: takeOffAltitude, altitudeFeet: takeOffAltitude }
            : f
        )
      );
      addLog(
        `🦅 ${enemy.name} takes to the air (altitude: ${takeOffAltitude}ft) to hunt ${target.name}`,
        "info"
      );

      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
            : f
        )
      );

      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
  }

  // 4. CIRCLING: If flying and no other action, circle overhead (default flying behavior)
  // Check if this is a skittish flying predator (may be declared earlier in function scope)
  const isSkittishFlyingPredatorForCircling =
    isHawk(enemy) || hasSkittishFlyingPredatorProfile(enemy);
  if (
    enemyIsFlying &&
    enemy.remainingAttacks > 0 &&
    isSkittishFlyingPredatorForCircling
  ) {
    const flightStyle = getFlightStyle(enemy);
    if (flightStyle === "circling") {
      // Only circle if:
      // 1. No target selected, OR
      // 2. Target is out of range and we're not actively moving to attack, OR
      // 3. We're maintaining distance (skittish predator behavior)
      const shouldCircle =
        !target ||
        (target && currentDistance > 30 && !needsToMoveCloser) ||
        (target && !isPreferredHawkPrey(enemy, target));

      if (shouldCircle) {
        const circled = handleFlyingIdleOrHarassAction(enemy, context);
        if (circled) {
          // Circling movement was performed, end turn
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }
    }
  }

  // 5. EATING: If grounded and has food, eat it (lowest priority)
  const isSkittishFlyingPredatorForEating =
    isHawk(enemy) || hasSkittishFlyingPredatorProfile(enemy);
  if (
    !enemyIsFlying &&
    enemy.remainingAttacks > 0 &&
    isSkittishFlyingPredatorForEating
  ) {
    const foodItem = findFoodItem(enemy);
    if (foodItem) {
      consumeItem(enemy, foodItem, { log: addLog });

      // Deduct action
      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
            : f
        )
      );

      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
  }

  // Enhanced enemy AI using distance-based combat system
  if (
    needsToMoveCloser &&
    target &&
    positions[enemy.id] &&
    positions[target.id]
  ) {
    const currentPos = positions[enemy.id];
    const targetPos = positions[target.id];

    // Check if target is unreachable (flying target for ground creature without ranged weapons)
    const targetIsFlying = isFlying(target);
    const targetAltitude = getAltitude(target);
    const enemyCanFly = canFly(enemy);
    const enemyIsFlying = isFlying(enemy);
    const enemyHasRangedWeapon =
      enemy.equippedWeapons?.primary ||
      enemy.equippedWeapons?.secondary ||
      enemy.attacks?.some((a) => {
        const name = a.name?.toLowerCase() || "";
        return (
          name.includes("bow") ||
          name.includes("crossbow") ||
          name.includes("sling") ||
          name.includes("thrown") ||
          (a.range && a.range > 10)
        );
      });

    if (targetIsFlying && !enemyIsFlying && !enemyHasRangedWeapon) {
      // Check if enemy has long-reach melee weapons that could hit low-flying targets
      const hasLongReachWeapon =
        enemy.equippedWeapons?.primary ||
        enemy.equippedWeapons?.secondary ||
        enemy.attacks?.some((a) => {
          const name = a.name?.toLowerCase() || "";
          return (
            (name.includes("pike") ||
              name.includes("lance") ||
              name.includes("polearm") ||
              name.includes("halberd")) &&
            targetAltitude <= 15
          );
        });

      if (!hasLongReachWeapon) {
        addLog(
          `🚫 ${enemy.name} cannot reach ${target.name} - ${target.name} is flying (${targetAltitude}ft) and ${enemy.name} has no ranged weapons!`,
          "warning"
        );
        // Skip this target - don't waste actions trying to reach an unreachable target
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    // Use analyzeMovementAndAttack to determine best movement strategy
    const equippedWeapon =
      enemy.equippedWeapons?.primary ||
      enemy.equippedWeapons?.secondary ||
      enemy.attacks?.[0] ||
      null;
    if (equippedWeapon) {
      const movementAnalysis = analyzeMovementAndAttack(
        enemy,
        target,
        currentPos,
        targetPos,
        equippedWeapon
      );
      if (
        movementAnalysis.recommendations &&
        movementAnalysis.recommendations.length > 0
      ) {
        addLog(
          `🔍 ${enemy.name} analyzes movement: ${
            movementAnalysis.distance
          }ft away, ${movementAnalysis.inRange ? "in range" : "needs to move"}`,
          "info"
        );
      }
    }

    // Use new AI system for movement decisions with flanking consideration
    const aiDecision = calculateEnemyMovementAI(
      enemy,
      target,
      currentPos,
      targetPos,
      availableAttacks
    );

    // Check for flanking opportunities
    const flankingPositions = findFlankingPositions(
      targetPos,
      positions,
      enemy.id
    );
    const currentFlankingBonus = calculateFlankingBonus(
      currentPos,
      targetPos,
      positions,
      enemy.id
    );

    // If we can flank, prioritize flanking positions
    if (flankingPositions.length > 0 && currentFlankingBonus === 0) {
      addLog(`🎯 ${enemy.name} considers flanking ${target.name}`, "info");

      // Find the best flanking position (closest to current position)
      const bestFlankPos = flankingPositions.reduce((best, current) => {
        const bestDist = calculateDistance(currentPos, best);
        const currentDist = calculateDistance(currentPos, current);
        return currentDist < bestDist ? current : best;
      });

      // Check if we can reach the flanking position
      const flankDistance = calculateDistance(currentPos, bestFlankPos);
      const speed =
        enemy.Spd ||
        enemy.spd ||
        enemy.attributes?.Spd ||
        enemy.attributes?.spd ||
        10;
      const maxMoveDistance = speed * 5; // 5 feet per hex

      if (flankDistance <= maxMoveDistance) {
        addLog(`🎯 ${enemy.name} attempts to flank ${target.name}`, "info");

        // Move to flanking position
        setPositions((prev) => {
          const updated = {
            ...prev,
            [enemy.id]: bestFlankPos,
          };
          positionsRef.current = updated;
          return updated;
        });

        // Deduct movement action cost
        const movementCost = Math.ceil(flankDistance / (speed * 5));
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? {
                  ...f,
                  remainingAttacks: Math.max(
                    0,
                    f.remainingAttacks - movementCost
                  ),
                }
              : f
          )
        );

        addLog(
          `🎯 ${enemy.name} moves to flanking position (${bestFlankPos.x}, ${bestFlankPos.y})`,
          "info"
        );

        // Continue with attack after movement
        setTimeout(() => {
          const newDistance = calculateDistance(bestFlankPos, targetPos);
          const rangeValidation = validateWeaponRange(
            enemy,
            target,
            selectedAttack,
            newDistance
          );

          if (rangeValidation.canAttack) {
            const flankingBonus = calculateFlankingBonus(
              bestFlankPos,
              targetPos,
              positions,
              enemy.id
            );
            if (flankingBonus > 0) {
              addLog(
                `🎯 ${enemy.name} gains flanking bonus (+${flankingBonus} to hit)!`,
                "info"
              );
            }

            // Execute attack with flanking bonus
            const updatedEnemy = { ...enemy, selectedAttack: selectedAttack };
            const bonuses = flankingBonus > 0 ? { flankingBonus } : {};
            attack(updatedEnemy, target.id, bonuses);

            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
          } else {
            addLog(
              `❌ ${enemy.name} cannot reach ${target.name} from flanking position`,
              "error"
            );
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
          }
        }, 1000);
        return;
      }
    }

    // Get enemy speed for movement calculations
    const speed =
      enemy.Spd ||
      enemy.spd ||
      enemy.attributes?.Spd ||
      enemy.attributes?.spd ||
      10;

    let movementType = "MOVE";
    let movementDescription = "moves";
    let hexesToMove = 1;
    let isChargingAttack = false;

    switch (aiDecision.decision) {
      case "charge":
        movementType = "CHARGE";
        movementDescription = "charges";
        hexesToMove = Math.min(
          Math.round(currentDistance / GRID_CONFIG.CELL_SIZE) - 1,
          3
        );
        isChargingAttack = true;
        addLog(
          `⚡ ${enemy.name} decides to charge! (${aiDecision.reason})`,
          "info"
        );
        break;

      case "move_and_attack":
        movementType = "MOVE";
        movementDescription = "moves closer";
        // Use Palladium movement calculation: Speed × 18 ÷ attacks per melee = feet per action
        const moveAndAttackFeetPerAction =
          (speed * 18) / (enemy.attacksPerMelee || 1);
        const moveAndAttackWalkingSpeed = Math.floor(
          moveAndAttackFeetPerAction * 0.5
        ); // Walking speed
        hexesToMove = Math.floor(
          moveAndAttackWalkingSpeed / GRID_CONFIG.CELL_SIZE
        );
        addLog(
          `🏃 ${enemy.name} moves closer to attack (${aiDecision.reason})`,
          "info"
        );
        break;

      case "move_closer": {
        movementType = "RUN";
        movementDescription = "runs closer";
        // Use Palladium movement calculation: Speed × 18 ÷ attacks per melee = feet per action
        const moveCloserFeetPerAction =
          (speed * 18) / (enemy.attacksPerMelee || 1);
        hexesToMove = Math.floor(
          moveCloserFeetPerAction / GRID_CONFIG.CELL_SIZE
        );
        addLog(`🏃 ${enemy.name} runs closer (${aiDecision.reason})`, "info");
        break;
      }

      case "use_ranged": {
        // Try to use ranged attack instead of moving
        const rangedAttack = availableAttacks.find(
          (a) => a.range && a.range > 0
        );
        if (rangedAttack) {
          addLog(
            `🏹 ${enemy.name} uses ranged attack instead of moving (${aiDecision.reason})`,
            "info"
          );
          setTimeout(() => {
            const flankingBonus = calculateFlankingBonus(
              positions[enemy.id],
              positions[target.id],
              positions,
              enemy.id
            );
            const bonuses = flankingBonus > 0 ? { flankingBonus } : {};
            attack(enemy, target.id, bonuses);
          }, 1000);
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
        // Fall back to movement if no ranged attack
        movementType = MOVEMENT_ACTIONS.RUN.name;
        movementDescription = "runs closer";
        // Use MOVEMENT_RATES for Palladium movement calculation
        const movementRates = MOVEMENT_RATES.calculateMovement(speed);
        const fallbackFeetPerAction =
          movementRates.running / (enemy.attacksPerMelee || 1);
        hexesToMove = Math.floor(fallbackFeetPerAction / GRID_CONFIG.CELL_SIZE);
        break;
      }

      default:
        movementType = MOVEMENT_ACTIONS.MOVE.name;
        movementDescription = "moves";
        hexesToMove = 1;
    }

    // Legacy fallback for very far distances - use Palladium movement
    if (currentDistance > 20 * GRID_CONFIG.CELL_SIZE) {
      // Far away - RUN (move at full speed using Palladium formula)
      movementType = MOVEMENT_ACTIONS.RUN.name;
      movementDescription = "runs";

      // Use MOVEMENT_RATES for official Palladium movement
      const movementRates = MOVEMENT_RATES.calculateMovement(speed);
      const maxMovementFeet =
        movementRates.running / (enemy.attacksPerMelee || 1); // Use feet per action
      hexesToMove = Math.floor(maxMovementFeet / GRID_CONFIG.CELL_SIZE);

      addLog(
        `🏃 ${enemy.name} is very far away, ${movementDescription} at full speed (${maxMovementFeet}ft/action)`,
        "info"
      );
    }
    // else: close distance (1-3 hexes) - use default MOVE (1 hex)

    // If we decided to CHARGE, make sure we're using a charge-type attack!
    if (movementType === "CHARGE" && isChargingAttack) {
      const chargeAttacks = availableAttacks.filter(
        (a) =>
          a.name.toLowerCase().includes("charge") ||
          a.name.toLowerCase().includes("gore") ||
          a.name.toLowerCase().includes("ram")
      );

      if (chargeAttacks.length > 0) {
        selectedAttack = chargeAttacks[0]; // Use Horn Charge, Gore, etc.
        addLog(
          `⚡ ${enemy.name} selects ${selectedAttack.name} for the charge!`,
          "combat"
        );
      }
    }

    // Calculate new position
    const dx = targetPos.x - currentPos.x;
    const dy = targetPos.y - currentPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // FIX: Check for zero or very small distance to prevent NaN
    if (distance < 0.01) {
      // Already at target position, no movement needed
      addLog(
        `📍 ${enemy.name} is already at target position, skipping movement`,
        "info"
      );
      // Continue to attack if in range
      const distanceFromCurrentPos = calculateDistance(currentPos, targetPos);
      const rangeValidation = validateWeaponRange(
        enemy,
        target,
        selectedAttack,
        distanceFromCurrentPos
      );

      if (rangeValidation.canAttack) {
        addLog(
          `⚔️ ${enemy.name} attacks from current position (${rangeValidation.reason})`,
          "info"
        );
        // Continue to attack below (don't return)
      } else {
        addLog(
          `⚔️ ${enemy.name} cannot reach target (${rangeValidation.reason}) and ends turn`,
          "info"
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    // Calculate distance in hexes for movement calculations
    const hexDistance = Math.round(currentDistance / GRID_CONFIG.CELL_SIZE);

    addLog(
      `🔍 ${enemy.name} movement debug: distance=${Math.round(
        currentDistance
      )}ft, hexDistance=${hexDistance}, hexesToMove=${hexesToMove}, movementType=${movementType}`,
      "info"
    );

    // Determine actual hexes to move (don't overshoot, but ensure at least 1 hex if far away)
    // Fix: Ensure we always make progress toward the target
    let actualHexesToMove;

    if (currentDistance > 100) {
      // For very far distances, move more aggressively to prevent infinite loops
      actualHexesToMove = Math.min(
        hexesToMove * 3,
        Math.floor(hexDistance / 3)
      );
      actualHexesToMove = Math.max(5, actualHexesToMove); // Minimum 5 hexes for far distances
      addLog(
        `🔍 ${enemy.name} far away (${Math.round(
          currentDistance
        )}ft), using aggressive movement: ${actualHexesToMove} hexes`,
        "info"
      );
    } else {
      // Normal movement calculation
      actualHexesToMove = Math.max(1, Math.min(hexesToMove, hexDistance - 1)); // At least 1 hex, stop 1 hex away
    }
    const moveRatio =
      (actualHexesToMove * GRID_CONFIG.CELL_SIZE) /
      (distance * GRID_CONFIG.CELL_SIZE);

    // Log movement ratio for debugging (if significant movement)
    const isDev = import.meta.env.DEV || import.meta.env.MODE === "development";
    if (isDev && moveRatio > 0.1) {
      console.debug(
        `[runEnemyTurnAI] Movement ratio: ${(moveRatio * 100).toFixed(
          1
        )}% of distance`
      );
    }

    let newX, newY, movementInfo;

    if (
      movementType === MOVEMENT_ACTIONS.MOVE.name ||
      movementType === MOVEMENT_ACTIONS.CHARGE.name
    ) {
      // MOVE: move calculated hexes immediately
      // CHARGE: move multiple hexes immediately and attack with bonuses
      const hexesThisTurn = actualHexesToMove; // Use the calculated movement distance

      // FIX: Prevent NaN by ensuring distance is valid
      if (distance < 0.01) {
        newX = currentPos.x;
        newY = currentPos.y;
      } else {
        newX = Math.round(currentPos.x + (dx / distance) * hexesThisTurn);
        newY = Math.round(currentPos.y + (dy / distance) * hexesThisTurn);
      }

      // Ensure valid numbers
      newX = isNaN(newX) ? currentPos.x : newX;
      newY = isNaN(newY) ? currentPos.y : newY;

      addLog(
        `🔍 ${enemy.name} calculated movement: from (${currentPos.x}, ${currentPos.y}) to (${newX}, ${newY}), hexesThisTurn=${hexesThisTurn}`,
        "info"
      );

      // Check if destination is occupied
      const occupant = isHexOccupied(newX, newY, enemy.id);
      if (occupant) {
        addLog(
          `🚫 ${enemy.name} cannot move to (${newX}, ${newY}) - occupied by ${occupant.name}`,
          "info"
        );

        // Recalculate distance from CURRENT position (not the blocked destination)
        const distanceFromCurrentPos = calculateDistance(currentPos, targetPos);

        // Check if within weapon range
        const rangeValidation = validateWeaponRange(
          enemy,
          target,
          selectedAttack,
          distanceFromCurrentPos
        );

        if (rangeValidation.canAttack) {
          addLog(
            `⚔️ ${enemy.name} is within range (${rangeValidation.reason}) and attacks`,
            "info"
          );
          // Don't end turn, continue to attack below
        } else {
          addLog(
            `⚔️ ${enemy.name} cannot reach target (${rangeValidation.reason}) and ends turn`,
            "info"
          );
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      } else {
        // Not occupied, safe to move
        const currentMovementAction =
          movementType === MOVEMENT_ACTIONS.CHARGE.name
            ? MOVEMENT_ACTIONS.CHARGE
            : MOVEMENT_ACTIONS.MOVE;
        movementInfo = {
          action: movementType,
          actionCost: currentMovementAction.actionCost,
          description:
            movementType === MOVEMENT_ACTIONS.CHARGE.name
              ? `Charge to position (${newX}, ${newY}) - ${MOVEMENT_ACTIONS.CHARGE.description}`
              : `Move to position (${newX}, ${newY}) - ${MOVEMENT_ACTIONS.MOVE.description}`,
        };

        // Update position immediately for MOVE or CHARGE
        handlePositionChange(enemy.id, { x: newX, y: newY }, movementInfo);

        const distanceMoved = hexesThisTurn * GRID_CONFIG.CELL_SIZE;
        const actionVerb =
          movementType === MOVEMENT_ACTIONS.CHARGE.name ? "charges" : "moves";

        // Use MOVEMENT_RATES for 1994 Palladium format
        const movementRates = MOVEMENT_RATES.calculateMovement(speed);
        const runAction = MOVEMENT_ACTIONS.RUN;
        addLog(
          `🏃 ${enemy.name} uses ${runAction.actionCost} action(s) to ${runAction.name} (Speed ${speed} → ${movementRates.running}ft/melee)`,
          "info"
        );
        addLog(
          `📍 ${enemy.name} ${actionVerb} ${Math.round(
            distanceMoved
          )}ft toward ${target.name} → new position (${newX},${newY})`,
          "info"
        );

        // Deduct 1 action for movement
        setFighters((prev) =>
          prev.map((f) => {
            if (f.id === enemy.id) {
              const updatedEnemy = {
                ...f,
                remainingAttacks: Math.max(0, f.remainingAttacks - 1),
              };
              addLog(
                `⏭️ ${enemy.name} has ${updatedEnemy.remainingAttacks} action(s) remaining this melee`,
                "info"
              );
              return updatedEnemy;
            }
            return f;
          })
        );

        if (movementType === MOVEMENT_ACTIONS.CHARGE.name) {
          // CHARGE continues to attack on same turn (don't end turn yet!)
          const chargeAction = MOVEMENT_ACTIONS.CHARGE;
          addLog(
            `⚡ Now within melee range! Charge attack: ${chargeAction.description}`,
            "combat"
          );
          // Continue to attack section below (don't return)
        } else {
          // After movement, check if we're now in range
          const newDistanceAfterMove = calculateDistance(
            { x: newX, y: newY },
            targetPos
          );
          const rangeValidation = validateWeaponRange(
            enemy,
            target,
            selectedAttack,
            newDistanceAfterMove
          );

          const updatedEnemy = fighters.find((f) => f.id === enemy.id);
          const hasActionsRemaining =
            updatedEnemy && updatedEnemy.remainingAttacks > 0;

          if (rangeValidation.canAttack && hasActionsRemaining) {
            // In range - perform a single attack, then end turn
            const updatedEnemyForAttack = {
              ...enemy,
              selectedAttack: selectedAttack,
            };
            attack(updatedEnemyForAttack, target.id, {});
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          } else {
            // Not in range or no actions - end turn
            const remainingDistance = Math.round(newDistanceAfterMove);
            if (remainingDistance > 5) {
              addLog(
                `📍 ${enemy.name} still ${remainingDistance}ft out of melee range - ending turn`,
                "info"
              );
            } else if (!hasActionsRemaining) {
              addLog(
                `⏭️ ${enemy.name} has no actions remaining after movement - passing to next fighter`,
                "info"
              );
            }
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        }
      }
    } else {
      // RUN/SPRINT: Move immediately (Palladium 1994 - no future movement)
      const moveDistance = actualHexesToMove;

      // FIX: Prevent NaN by checking distance is valid
      if (distance < 0.01) {
        // Already at target, don't move
        newX = currentPos.x;
        newY = currentPos.y;
      } else {
        newX = Math.round(currentPos.x + (dx / distance) * moveDistance);
        newY = Math.round(currentPos.y + (dy / distance) * moveDistance);
      }

      // Clamp to grid bounds and ensure valid numbers
      newX = Math.max(
        0,
        Math.min(GRID_CONFIG.GRID_WIDTH - 1, isNaN(newX) ? currentPos.x : newX)
      );
      newY = Math.max(
        0,
        Math.min(GRID_CONFIG.GRID_HEIGHT - 1, isNaN(newY) ? currentPos.y : newY)
      );

      // Check if destination is occupied
      const occupant = isHexOccupied(newX, newY, enemy.id);
      let targetX = newX;
      let targetY = newY;
      let closingIntoOpponent = false;
      let attackOfOpportunityAttacker = null;
      if (occupant) {
        const occupantIsAlly = occupant.type === enemy.type;

        if (occupantIsAlly) {
          addLog(
            `🏃 ${enemy.name} weaves past ${occupant.name} while running full tilt`,
            "info"
          );
        } else {
          let attackRange = 5.5;
          if (typeof selectedAttack?.range === "number") {
            attackRange = selectedAttack.range;
          } else if (selectedAttack?.weapon) {
            const derivedRange = getWeaponRange(selectedAttack.weapon);
            if (
              typeof derivedRange === "number" &&
              !Number.isNaN(derivedRange)
            ) {
              attackRange = derivedRange;
            }
          }

          if (attackRange <= 5.5) {
            closingIntoOpponent = true;
            attackOfOpportunityAttacker = occupant;
            addLog(
              `⚔️ ${enemy.name} barrels through to engage ${occupant.name}!`,
              "info"
            );
          } else {
            // Find nearest unoccupied hex toward target
            let foundAlternative = false;
            for (let offset = 1; offset <= 3 && !foundAlternative; offset++) {
              // Try hexes around the target at increasing distances
              const testPositions = [
                { x: newX - offset, y: newY },
                { x: newX + offset, y: newY },
                { x: newX, y: newY - offset },
                { x: newX, y: newY + offset },
                { x: newX - offset, y: newY - offset },
                { x: newX + offset, y: newY + offset },
              ];

              for (const testPos of testPositions) {
                if (
                  testPos.x >= 0 &&
                  testPos.x < GRID_CONFIG.GRID_WIDTH &&
                  testPos.y >= 0 &&
                  testPos.y < GRID_CONFIG.GRID_HEIGHT
                ) {
                  if (!isHexOccupied(testPos.x, testPos.y, enemy.id)) {
                    targetX = testPos.x;
                    targetY = testPos.y;
                    foundAlternative = true;
                    addLog(
                      `📍 ${enemy.name} adjusts path to avoid ${occupant.name}, moving to (${targetX}, ${targetY})`,
                      "info"
                    );
                    break;
                  }
                }
              }
            }

            if (!foundAlternative) {
              addLog(
                `🚫 ${enemy.name} cannot find path to target - all hexes occupied`,
                "info"
              );
              addLog(`⏭️ ${enemy.name} ends turn (blocked)`, "info");
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          }
        }
      }

      if (closingIntoOpponent) {
        setTemporaryHexSharing((prev) => ({
          ...prev,
          [enemy.id]: {
            originalPos: { ...currentPos },
            targetHex: { x: targetX, y: targetY },
            targetCharId: attackOfOpportunityAttacker?.id,
            turnCreated: turnCounter,
          },
        }));
      }

      // Update position immediately (no pending movement)
      setPositions((prev) => {
        const updated = {
          ...prev,
          [enemy.id]: { x: targetX, y: targetY },
        };
        positionsRef.current = updated;
        return updated;
      });

      if (closingIntoOpponent && attackOfOpportunityAttacker) {
        addLog(
          `⚠️ ${attackOfOpportunityAttacker.name} gets an attack of opportunity against ${enemy.name}!`,
          "warning"
        );
        const attackerForAoO = attackOfOpportunityAttacker;
        const targetForAoO = enemy.id;

        setTimeout(() => {
          if (attackRef.current) {
            attackRef.current(attackerForAoO, targetForAoO, {});
          } else {
            addLog(
              `⚠️ Attack of opportunity delayed - attack system not ready`,
              "info"
            );
            setTimeout(() => {
              if (attackRef.current) {
                attackRef.current(attackerForAoO, targetForAoO, {});
              }
            }, 1000);
          }
        }, 500);
      }

      const distanceMoved = calculateDistance(currentPos, {
        x: targetX,
        y: targetY,
      });

      // 1994 Palladium format: RUN/SPRINT uses one action
      const feetPerMelee = speed * 18; // Official formula
      addLog(
        `🏃 ${enemy.name} uses one action to RUN (Speed ${speed} → ${feetPerMelee}ft/melee)`,
        "info"
      );
      addLog(
        `📍 Moves ${Math.round(distanceMoved)}ft toward ${
          target.name
        } → new position (${targetX},${targetY})`,
        "info"
      );

      // Deduct 1 action for movement
      setFighters((prev) =>
        prev.map((f) => {
          if (f.id === enemy.id) {
            const updatedEnemy = {
              ...f,
              remainingAttacks: Math.max(0, f.remainingAttacks - 1),
            };
            addLog(
              `⏭️ ${enemy.name} has ${updatedEnemy.remainingAttacks} action(s) remaining this melee`,
              "info"
            );
            return updatedEnemy;
          }
          return f;
        })
      );

      // After RUN/SPRINT movement, check if we're now in range and can attack
      setTimeout(() => {
        setPositions((currentPositions) => {
          positionsRef.current = currentPositions;
          const latestEnemyPos = currentPositions[enemy.id] || {
            x: targetX,
            y: targetY,
          };
          const latestTargetPos = currentPositions[target.id] || targetPos;
          const finalDistance = calculateDistance(
            latestEnemyPos,
            latestTargetPos
          );
          const rangeValidation = validateWeaponRange(
            enemy,
            target,
            selectedAttack,
            finalDistance
          );

          const updatedEnemy = fighters.find((f) => f.id === enemy.id);
          const hasActionsRemaining =
            updatedEnemy && updatedEnemy.remainingAttacks > 0;

          // ✅ FIX: Check combat status and target validity before attacking
          if (!combatActive) {
            addLog(`⚠️ Combat ended, ${enemy.name} stops moving`, "info");
            processingEnemyTurnRef.current = false;
            return currentPositions;
          }

          // Check if target is still valid
          const updatedTarget = fighters.find((f) => f.id === target.id);
          if (
            !updatedTarget ||
            updatedTarget.currentHP <= 0 ||
            updatedTarget.currentHP <= -21
          ) {
            addLog(
              `⚠️ ${enemy.name}'s target is no longer valid, ending turn`,
              "info"
            );
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return currentPositions;
          }

          if (rangeValidation.canAttack && hasActionsRemaining) {
            addLog(
              `⚔️ ${enemy.name} is now in range (${rangeValidation.reason})!`,
              "info"
            );
            const updatedEnemyForAttack = {
              ...enemy,
              selectedAttack: selectedAttack,
            };
            attack(updatedEnemyForAttack, target.id, {
              attackerPosOverride: latestEnemyPos,
              defenderPosOverride: latestTargetPos,
              distanceOverride: finalDistance,
            });
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
          } else {
            if (finalDistance > 5) {
              addLog(
                `📍 ${enemy.name} still ${Math.round(
                  finalDistance
                )}ft out of melee range - ending turn`,
                "info"
              );
            } else if (!hasActionsRemaining) {
              addLog(
                `⏭️ ${enemy.name} has no actions remaining - passing to next fighter`,
                "info"
              );
            }
            processingEnemyTurnRef.current = false;
            setTimeout(() => {
              endTurn();
            }, 1500);
          }

          return currentPositions;
        });
      }, 800);
      return;
    }
  }

  // ✅ FIX: Final validation: make sure target can still be attacked and combat is active
  if (!combatActive) {
    addLog(`⚠️ Combat ended, ${enemy.name} stops attacking`, "info");
    processingEnemyTurnRef.current = false;
    return;
  }

  if (!target || target.currentHP <= -21) {
    addLog(`⚠️ ${enemy.name}'s target is dead, ending turn`, "info");
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }

  // ✅ FIX: Don't allow attacking unconscious/dying targets if all players are already defeated
  // Exception: Evil alignments may finish off dying players (coup de grâce)
  if (target && target.currentHP <= 0 && target.currentHP > -21) {
    // Check if there are any conscious players remaining
    const consciousPlayers = fighters.filter(
      (f) => f.type === "player" && canFighterAct(f) && f.currentHP > 0
    );
    const enemyAlignment = enemy.alignment || enemy.attributes?.alignment || "";
    const isEvil = isEvilAlignment(enemyAlignment);

    if (consciousPlayers.length === 0) {
      // All players are defeated
      if (isEvil) {
        // Evil alignments may finish off dying players (coup de grâce)
        const hpStatus = getHPStatus(target.currentHP);
        addLog(
          `😈 ${enemy.name} (${enemyAlignment}) finishes off dying ${target.name} (${hpStatus.description})!`,
          "warning"
        );
      } else {
        // Good/neutral alignments show mercy - don't attack unconscious players
        addLog(
          `⚠️ All players are defeated! ${enemy.name} shows mercy and stops attacking.`,
          "info"
        );
        if (!combatEndCheckRef.current) {
          combatEndCheckRef.current = true;
          addLog("💀 All players are defeated! Enemies win!", "defeat");
          setCombatActive(false);
        }
        processingEnemyTurnRef.current = false;
        return;
      }
    } else {
      // Still conscious players remaining - allow attacking dying ones
      const hpStatus = getHPStatus(target.currentHP);
      if (isEvil) {
        addLog(
          `😈 ${enemy.name} (${enemyAlignment}) attacks dying ${target.name} (${hpStatus.description})!`,
          "warning"
        );
      } else {
        addLog(
          `⚠️ ${enemy.name} targeting ${target.name} who is ${hpStatus.description}`,
          "warning"
        );
      }
    }
  }

  // Check if this is an area attack (Horn Charge, etc.)
  const isAreaAttack =
    selectedAttack.name.toLowerCase().includes("charge") ||
    selectedAttack.name.toLowerCase().includes("gore") ||
    selectedAttack.name.toLowerCase().includes("ram");

  if (isAreaAttack && isTargetBlocked(enemy.id, target.id, positions)) {
    // Area attack - can hit multiple targets in line
    const targetsInLine = getTargetsInLine(enemy.id, target.id, positions);

    if (targetsInLine.length > 0) {
      addLog(
        `⚡ ${enemy.name} uses ${attackName} - area attack hitting ${targetsInLine.length} target(s)!`,
        "info"
      );

      // Execute area attack on all targets in line (one action, multiple targets)
      const chargeBonus = isChargingAttack ? { strikeBonus: +2 } : {};

      // Attack all targets in line, but this is still ONE action
      targetsInLine.forEach((lineTarget) => {
        attack(enemy, lineTarget.id, {
          ...chargeBonus,
          flankingBonus: calculateFlankingBonus(
            positions[enemy.id],
            positions[lineTarget.id],
            positions,
            enemy.id
          ),
        });
      });
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
  }

  addLog(
    `🤖 ${enemy.name} ${reasoning} and attacks ${target.name} with ${attackName}!`,
    "info"
  );

  // Create updated enemy with selected attack (don't update state yet to prevent re-render loop)
  const updatedEnemy = { ...enemy, selectedAttack: selectedAttack };

  // Get the number of attacks for this attack type
  const attackCount = selectedAttack.count || 1;

  // Determine if this is a charging attack (for bonuses)
  const chargeBonus = isChargingAttack ? { strikeBonus: +2 } : {};

  // Check for flanking bonus
  const currentFlankingBonus = calculateFlankingBonus(
    positions[enemy.id],
    positions[target.id],
    positions,
    enemy.id
  );
  const flankingBonus =
    currentFlankingBonus > 0 ? { flankingBonus: currentFlankingBonus } : {};

  // Combine all bonuses
  const allBonuses = { ...chargeBonus, ...flankingBonus };

  if (flankingBonus.flankingBonus > 0) {
    addLog(
      `🎯 ${enemy.name} gains +${flankingBonus.flankingBonus} flanking bonus!`,
      "info"
    );
  }

  // Execute attack - handle attack count for multi-strike attacks
  // The count property is for attacks that hit multiple times in ONE action (like dual wield)
  setTimeout(() => {
    // If attackCount > 1, this represents a multi-strike attack (all in one action)
    // The attack function should handle this internally, but we log it for clarity
    if (attackCount > 1) {
      addLog(`⚔️ ${enemy.name} performs ${attackCount}-strike attack!`, "info");
    }
    attack(updatedEnemy, target.id, allBonuses);

    // End turn after attack
    processingEnemyTurnRef.current = false;
    setTimeout(() => {
      endTurn();
    }, 1500); // Reduced delay for faster turn progression
  }, 1500);
}

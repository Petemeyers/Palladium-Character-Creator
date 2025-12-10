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
import {
  canThreatenWithMelee,
  canThreatenWithMeleeWithWeapon,
  markTargetUnreachable,
  isTargetUnreachable,
  getReachableEnemies,
  hasAnyValidOffensiveOption,
} from "./meleeReachabilityHelpers";

const UNDEAD_KEYWORDS = [
  "vampire",
  "mummy",
  "skeleton",
  "zombie",
  "ghoul",
  "wraith",
  "wight",
  "lich",
  "spectre",
  "ghost",
];

function isUndeadUnit(unit) {
  const label = (
    unit?.species ||
    unit?.race ||
    unit?.type ||
    unit?.name ||
    ""
  ).toLowerCase();

  if (!label) return false;
  return UNDEAD_KEYWORDS.some((w) => label.includes(w));
}

// Undead creature detection for routing immunity
function isUndeadCreature(fighter) {
  const name = (fighter.name || fighter.displayName || "").toLowerCase();
  const type = (fighter.type || fighter.creatureType || "").toLowerCase();

  const undeadKeywords = [
    "undead",
    "vampire",
    "mummy",
    "zombie",
    "skeleton",
    "ghoul",
    "wight",
    "wraith",
    "lich",
    "ghost",
    "spectre",
  ];

  return undeadKeywords.some((k) => name.includes(k) || type.includes(k));
}

// Healer OCC detection based on rulebook OCC list (Clergy)
function isHealerOccForAI(fighter) {
  if (!fighter) return false;

  const occText = [
    fighter.OCC,
    fighter.occ,
    fighter.class,
    fighter.occName,
    fighter.rcc,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Map directly to OCCs you defined in occData.js (category: "Clergy")
  // Priest, PriestOfLight, PriestOfDarkness, Healer, Druid, Shaman
  const healerPatterns = [
    "priest of light",
    "priest of darkness",
    "priest",   // generic priest OCC
    "healer",
    "druid",
    "shaman",
  ];

  return healerPatterns.some((pattern) => occText.includes(pattern));
}

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
 * Check if a fighter is a prey animal (mice, rats, rabbits, etc.)
 * @param {Object} fighter - Fighter object
 * @returns {boolean} True if fighter is a prey animal
 */
function isPreyAnimal(fighter) {
  if (!fighter) return false;

  const name = (fighter.baseName || fighter.name || "").toLowerCase();
  const size = (fighter.sizeCategory || fighter.size || "").toLowerCase();

  // Tiny / Small animals are fair game by default
  const isSmallBody = ["tiny", "small"].includes(size);

  // Specific species tags
  const preyKeywords = ["mouse", "rat", "rabbit", "squirrel", "songbird"];
  const isNamedPrey = preyKeywords.some((k) => name.includes(k));

  return isSmallBody || isNamedPrey;
}

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
 * Find nearby hiding spots (burrow, bush, rock, ruins, etc.)
 * @param {Object} fighter - Fighter object
 * @param {Object} positions - Positions map
 * @param {Object} terrain - Terrain data (optional)
 * @param {Array} objects - Map objects array (optional)
 * @param {number} maxRadiusHexes - Maximum search radius in hexes
 * @returns {Object|null} Nearest hiding spot object or null
 */
function findNearbyHidingSpot(
  fighter,
  positions,
  terrain,
  objects,
  maxRadiusHexes = 6
) {
  if (!fighter || !positions || !objects) return null;

  const myPos = positions[fighter.id];
  if (!myPos) return null;

  // objects: expected shape: [{ id, position: {x,y}, tags: ['cover','burrow'] }, ...]
  const hidingCandidates = objects.filter((obj) => {
    const tags = obj.tags || [];
    const hasHideTag =
      tags.includes("cover") ||
      tags.includes("burrow") ||
      tags.includes("hideout") ||
      tags.includes("foliage");

    if (!hasHideTag || !obj.position) return false;

    const dx = obj.position.x - myPos.x;
    const dy = obj.position.y - myPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= maxRadiusHexes; // radius in hexes
  });

  if (!hidingCandidates.length) return null;

  // Simple "closest hiding spot"
  hidingCandidates.sort((a, b) => {
    const da =
      (a.position.x - myPos.x) * (a.position.x - myPos.x) +
      (a.position.y - myPos.y) * (a.position.y - myPos.y);
    const db =
      (b.position.x - myPos.x) * (b.position.x - myPos.x) +
      (b.position.y - myPos.y) * (b.position.y - myPos.y);
    return da - db;
  });

  return hidingCandidates[0];
}

// Altitude bands for flying hunters (hawks, etc.)
const HAWK_SCOUT_ALT_MIN_FT = 60; // cruising high when no prey
const HAWK_SCOUT_ALT_MAX_FT = 100; // max climb when no prey
const HAWK_HUNT_ALT_MIN_FT = 25; // lower band when actively hunting
const HAWK_HUNT_ALT_MAX_FT = 60; // don't stay higher than this when prey is known
const HAWK_CLIMB_STEP_FT = 20; // per idle turn
const HAWK_DESCENT_STEP_FT = 20;

/**
 * Adjust a flying hunter's altitude while it's circling.
 * - If there is NO visible prey: climb toward a random high scouting altitude (60–100ft).
 * - If there IS visible prey: stay in a lower hunting band (25–60ft).
 * @param {Object} flier - Flying creature
 * @param {boolean} hasVisiblePrey - Whether there are visible ground targets
 * @param {Function} addLog - Logging function
 * @param {Function} setFighters - Function to update fighters state
 * @param {Array} fighters - Array of all fighters (to get latest flier state)
 */
function updateCirclingHunterAltitude(
  flier,
  hasVisiblePrey,
  addLog,
  setFighters,
  fighters
) {
  if (!flier) return;

  // Get latest flier state from fighters array
  const latestFlier = fighters?.find((f) => f.id === flier.id) || flier;

  const currentAlt =
    typeof latestFlier.altitudeFeet === "number"
      ? latestFlier.altitudeFeet
      : typeof latestFlier.altitude === "number"
      ? latestFlier.altitude
      : 0;

  // When no prey is visible: climb up into scouting band and just hang there
  if (!hasVisiblePrey) {
    let targetAlt = latestFlier.scoutingAltitudeFeet;

    if (!targetAlt) {
      const rand =
        HAWK_SCOUT_ALT_MIN_FT +
        Math.floor(
          Math.random() * (HAWK_SCOUT_ALT_MAX_FT - HAWK_SCOUT_ALT_MIN_FT + 1)
        );

      // Store the target scouting altitude on the fighter
      setFighters((prev) =>
        prev.map((f) =>
          f.id === flier.id ? { ...f, scoutingAltitudeFeet: rand } : f
        )
      );

      targetAlt = rand;

      // If we're already at or above the target, no need to climb
      if (currentAlt >= targetAlt) {
        return;
      }
    }

    if (targetAlt && currentAlt < targetAlt) {
      const nextAlt = Math.min(targetAlt, currentAlt + HAWK_CLIMB_STEP_FT);

      setFighters((prev) =>
        prev.map((f) =>
          f.id === flier.id
            ? {
                ...f,
                altitude: nextAlt,
                altitudeFeet: nextAlt,
              }
            : f
        )
      );

      addLog(
        `🦅 ${flier.name} climbs to ${nextAlt}ft, scanning for prey.`,
        "info"
      );
    }

    // If already at/above target, just glide; no log spam needed.
    return;
  }

  // If there IS visible prey: stay in a lower hunting band
  // (don't sit forever at 80–100ft when there are targets on the ground)
  let targetAlt = currentAlt;

  if (currentAlt < HAWK_HUNT_ALT_MIN_FT) {
    targetAlt = HAWK_HUNT_ALT_MIN_FT;
  } else if (currentAlt > HAWK_HUNT_ALT_MAX_FT) {
    targetAlt = HAWK_HUNT_ALT_MAX_FT;
  }

  if (targetAlt !== currentAlt) {
    const dir = Math.sign(targetAlt - currentAlt);
    const step = dir > 0 ? HAWK_CLIMB_STEP_FT : HAWK_DESCENT_STEP_FT;
    const nextAlt =
      dir > 0
        ? Math.min(targetAlt, currentAlt + step)
        : Math.max(targetAlt, currentAlt - step);

    setFighters((prev) =>
      prev.map((f) =>
        f.id === flier.id
          ? {
              ...f,
              altitude: nextAlt,
              altitudeFeet: nextAlt,
            }
          : f
      )
    );

    addLog(
      `🦅 ${flier.name} adjusts altitude to ${nextAlt}ft while circling above prey.`,
      "info"
    );
  }
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
    fighters,
    GRID_CONFIG,
  } = context;

  if (!isFlying(flier)) return false;

  const flightStyle = getFlightStyle(flier);

  // Hovering creatures can stay put (magical flight, hummingbirds, etc.)
  if (flightStyle === "hover") return false;

  // Must be circling style
  if (flightStyle !== "circling") return false;

  // Check for visible ground prey (only stuff on the ground counts as hawk prey)
  const groundPrey = fighters.filter(
    (f) =>
      !f.isDead &&
      f.type === "player" &&
      !isFlying(f) && // only stuff on the ground counts as hawk prey
      f.currentHP > 0 &&
      f.currentHP > -21
  );

  const hasVisiblePrey = groundPrey.length > 0;

  // Adjust altitude based on whether prey is visible
  updateCirclingHunterAltitude(
    flier,
    hasVisiblePrey,
    addLog,
    setFighters,
    fighters
  );

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
 * Attempt tactical withdraw when enemy has no valid offensive options
 * Actually moves the enemy away from threats, or falls back to defending in place.
 * @param {Object} params - Parameters object
 * @param {Object} params.enemy - The enemy fighter
 * @param {Array} params.fighters - All fighters
 * @param {Object} params.positions - Position map
 * @param {Function} params.addLog - Logging function
 * @param {Function} params.findRetreatDestination - Retreat destination finder
 * @param {Function} params.isHexOccupied - Hex occupation checker
 * @param {Function} params.handlePositionChange - Function to move fighter
 * @param {Function} params.setDefensiveStance - Function to set defensive stance
 * @param {Function} params.scheduleEndTurn - Turn end scheduler
 * @param {Function} params.canFighterAct - Function to check if fighter can act
 * @param {Object} params.GRID_CONFIG - Grid configuration
 * @returns {boolean} True if withdrawal move was made, false if just defending
 */
function attemptTacticalWithdraw({
  enemy,
  fighters,
  positions,
  addLog,
  findRetreatDestination,
  isHexOccupied,
  handlePositionChange,
  setDefensiveStance,
  scheduleEndTurn,
  canFighterAct,
  GRID_CONFIG,
}) {
  try {
    const currentPos = positions[enemy.id];
    if (!currentPos) {
      addLog(
        `⚠️ ${enemy.name} cannot withdraw (no position data). Holding position defensively.`,
        "warning"
      );
      setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Defend" }));
      scheduleEndTurn();
      return false;
    }

    // Get active player fighters as threats
    const playerFighters = fighters.filter(
      (f) =>
        f.type === "player" &&
        canFighterAct(f) &&
        f.currentHP > 0 &&
        f.currentHP > -21
    );

    // If no active enemies, just end turn
    if (playerFighters.length === 0) {
      addLog(
        `⚠️ ${enemy.name} finds no active foes and cautiously lowers their guard.`,
        "info"
      );
      setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Defend" }));
      scheduleEndTurn();
      return false;
    }

    // Calculate threat positions
    const threatPositions = playerFighters
      .map((f) => positions[f.id])
      .filter(Boolean);

    if (threatPositions.length === 0) {
      addLog(
        `🛡️ ${enemy.name} cannot see any threats. Holding position defensively.`,
        "info"
      );
      setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Defend" }));
      scheduleEndTurn();
      return false;
    }

    // Calculate max retreat steps based on movement
    const speed =
      enemy.Spd ||
      enemy.spd ||
      enemy.attributes?.Spd ||
      enemy.attributes?.spd ||
      10;
    const attacksPerMelee = enemy.attacksPerMelee || 2;
    const fullFeetPerAction = (speed * 18) / Math.max(1, attacksPerMelee);
    const maxSteps = Math.max(
      1,
      Math.min(Math.floor(fullFeetPerAction / GRID_CONFIG.CELL_SIZE), 5)
    );

    // Try to find retreat destination
    const retreatDestination = findRetreatDestination({
      currentPos,
      threatPositions,
      maxSteps,
      enemyId: enemy.id,
      isHexOccupied,
    });

    if (retreatDestination && retreatDestination.position) {
      addLog(
        `🚶 ${enemy.name} withdraws from unreachable foes to (${retreatDestination.position.x}, ${retreatDestination.position.y}).`,
        "info"
      );

      // Actually move the enemy using handlePositionChange
      handlePositionChange(enemy.id, retreatDestination.position, {
        movementType: "withdraw",
        source: "AI_WITHDRAW",
        threatPositions: threatPositions,
      });

      // Set defensive stance to "Retreat"
      setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Retreat" }));

      scheduleEndTurn();
      return true;
    }

    // No safe retreat hex found → defend in place
    addLog(
      `⚠️ ${enemy.name} looks for a safe place to withdraw but finds none; defending in place.`,
      "warning"
    );

    setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Defend" }));
    scheduleEndTurn();
    return false;
  } catch (err) {
    console.error("Error during tactical withdraw:", err);
    addLog(
      `⚠️ ${enemy.name} tries to withdraw but something goes wrong; they hold position defensively.`,
      "warning"
    );
    setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Defend" }));
    scheduleEndTurn();
    return false;
  }
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

  // 🔴 NEW: Check if paralyzed
  const isParalyzed = enemy.statusEffects?.some(
    (e) =>
      (typeof e === "string" && e === "PARALYZED") ||
      (typeof e === "object" && e.type === "PARALYZED")
  );
  if (isParalyzed) {
    addLog(`⏭️ ${enemy.name} is paralyzed and cannot act this round!`, "info");
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }

  // ✅ Define allPlayers early so ROUTED logic and rest of AI can use it
  const allPlayers = fighters.filter(
    (f) =>
      f.type === "player" &&
      canFighterAct(f) &&
      f.currentHP > 0 && // conscious only
      f.currentHP > -21 // not dead
  );

  // 🔴 NEW: Check if routed - if so, attempt to flee instead of fighting
  if (
    enemy.moraleState?.status === "ROUTED" ||
    enemy.statusEffects?.includes("ROUTED")
  ) {
    if (isUndeadCreature(enemy)) {
      // 🧟 Undead: clear ROUTED and stand ground
      addLog(
        `💀 ${enemy.name} is undead and refuses to flee (ignoring ROUTED).`,
        "info"
      );

      enemy.moraleState = {
        ...(enemy.moraleState || {}),
        status: "STEADFAST",
      };

      if (Array.isArray(enemy.statusEffects)) {
        enemy.statusEffects = enemy.statusEffects.filter(
          (s) => s !== "ROUTED"
        );
      }

      // fall through to normal action selection instead of flee
    } else if (!isUndeadCreature(enemy)) {
      addLog(`🏃 ${enemy.name} is ROUTED and attempts to flee!`, "warning");

    // Use the same tactical withdraw logic as "no way to hit" fallback
    const didWithdraw = attemptTacticalWithdraw({
      enemy,
      fighters,
      positions,
      addLog,
      findRetreatDestination,
      isHexOccupied,
      handlePositionChange,
      setDefensiveStance,
      scheduleEndTurn,
      canFighterAct,
      GRID_CONFIG,
    });

    // If withdrawal failed, end turn (withdraw function already handled logging)
    if (!didWithdraw) {
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }

    // Withdrawal succeeded and already scheduled move + endTurn
    processingEnemyTurnRef.current = false;
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

  // allPlayers is already defined above (after paralyzed check) for use in ROUTED logic

  // Decay awareness for each player target
  allPlayers.forEach((target) => {
    decayAwareness(enemy, target);
  });

  // 🦅 Flying Enemy Behavior Integration
  const enemyCanFly = canFly(enemy);
  const enemyIsFlying = isFlying(enemy);

  // If the enemy is airborne, delegate to the flying behavior system.
  // EXCEPTION: Flying hunters (hawks, etc.) use the inline diving/circling logic below
  // instead of the generic runFlyingTurn, so they can actively hunt prey.
  // Note: We check enemyIsFlying first (must be actually flying), then enemyCanFly (must have flight ability)
  if (enemyIsFlying && enemyCanFly && !isFlyingHunter(enemy)) {
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
    scheduleEndTurn();
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
      // For hawks: use 100ft altitude (realistic soaring/circling height)
      const newAltitude = isHawk(enemy) ? 100 : 30;
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

  // Healer archetype = Clergy OCCs (Priest, Healer, Druid, Shaman, etc.) OR explicit healer skills
  const hasHealerSkills =
    Array.isArray(enemy.skills) &&
    enemy.skills.some((s) =>
      ["Healer OCC R.C.C. Skill", "Holistic Medicine"].includes(s.name)
    );

  const isHealer = isHealerOccForAI(enemy) || hasHealerSkills;

  // Check for allies that need healing (only for non-evil alignments)
  const enemyAlignment = enemy.alignment || enemy.attributes?.alignment || "";
  const isEvil = isEvilAlignment(enemyAlignment);
  const isGood = !isEvil && (
    (enemyAlignment || "").toLowerCase().includes("good") ||
    (enemyAlignment || "").toLowerCase().includes("principled") ||
    (enemyAlignment || "").toLowerCase().includes("scrupulous")
  );

  // Good-aligned healers prioritize healing allies
  if (isHealer && isGood && (healingSkills.length > 0 || hasHealerSkills)) {
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

  /**
   * Prey idle brain:
   * - If scary enemy nearby => run/hide (retreat)
   * - Else if safe and food/loot nearby => scavenge/forage
   * - Else => wander / sniff around (flavor)
   */
  function runPreyIdleTurn({
    fighter,
    enemies,
    allies,
    positions,
    terrain,
    objects,
    log,
    setFighters,
    scheduleEndTurn,
    processingEnemyTurnRef,
    setPositions,
    positionsRef,
    calculateDistance,
    findRetreatDestination,
    handlePositionChange,
    isHexOccupied,
  }) {
    if (!fighter || !positions) return;

    const myPos = positions[fighter.id];
    if (!myPos) {
      scheduleEndTurn();
      if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
      return;
    }

    // 1) THREAT DETECTION: any hostile within "fear radius"
    const FEAR_RADIUS_HEXES = 12; // ~60 ft on 5ft hexes
    let nearestThreat = null;
    let nearestThreatDistSq = Infinity;

    for (const enemy of enemies) {
      if (!enemy || enemy.isDead || enemy.isDying || enemy.currentHP <= 0)
        continue;

      const enemyPos = positions[enemy.id];
      if (!enemyPos) continue;

      const dx = enemyPos.x - myPos.x;
      const dy = enemyPos.y - myPos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= FEAR_RADIUS_HEXES * FEAR_RADIUS_HEXES) {
        // You could add extra logic here: only count predators, flying hunters, etc.
        if (distSq < nearestThreatDistSq) {
          nearestThreatDistSq = distSq;
          nearestThreat = enemy;
        }
      }
    }

    // 1a) If there is a threat: run/hide using existing retreat logic
    if (nearestThreat) {
      const threatPos = positions[nearestThreat.id];

      // Prefer to flee *away* from threat, using existing retreat code
      const threatPositions = threatPos ? [threatPos] : [];
      const retreatDestination = findRetreatDestination({
        currentPos: myPos,
        threatPositions,
        maxSteps: 5,
        enemyId: fighter.id,
        isHexOccupied,
      });

      if (retreatDestination) {
        log(
          `🐭 ${fighter.name} panics at the sight of ${nearestThreat.name} and scurries away!`,
          "info"
        );

        // Move toward retreat destination
        if (handlePositionChange && retreatDestination.position) {
          handlePositionChange(fighter.id, retreatDestination.position, {
            action: "RETREAT",
            actionCost: 0,
            description: "Flee from threat",
          });
        } else if (setPositions) {
          setPositions((prev) => {
            const updated = {
              ...prev,
              [fighter.id]: retreatDestination.position,
            };
            if (positionsRef) positionsRef.current = updated;
            return updated;
          });
        }

        setFighters((prev) =>
          prev.map((f) =>
            f.id === fighter.id
              ? {
                  ...f,
                  defensiveStance: "Retreat",
                  remainingAttacks: Math.max(0, f.remainingAttacks - 1),
                }
              : f
          )
        );

        scheduleEndTurn();
        if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
        return;
      }

      // If no retreat destination found, just cower / defend
      log(
        `🐭 ${fighter.name} freezes in fear, unable to find a way to flee from ${nearestThreat.name}.`,
        "info"
      );

      setFighters((prev) =>
        prev.map((f) =>
          f.id === fighter.id
            ? {
                ...f,
                remainingAttacks: Math.max(0, f.remainingAttacks - 1),
                defensiveStance: "Cower",
              }
            : f
        )
      );

      scheduleEndTurn();
      if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
      return;
    }

    // 2) SAFE: SCAVENGE / FORAGE
    // Reuse existing scavenging helpers for small prey
    const SCAVENGE_RADIUS = 6; // 6-hex "forage" radius

    // First, look for corpses
    const allFighters = [...(allies || []), ...(enemies || [])];
    const corpse = findNearbyCorpse(
      fighter,
      allFighters,
      positions,
      SCAVENGE_RADIUS
    );
    if (corpse) {
      const corpsePos = positions[corpse.id];
      if (corpsePos) {
        const dist = calculateDistance
          ? calculateDistance(myPos, corpsePos)
          : Math.sqrt(
              (corpsePos.x - myPos.x) ** 2 + (corpsePos.y - myPos.y) ** 2
            ) * 5; // Convert hexes to feet

        if (dist > 5) {
          // Move partway toward corpse (simple 1-hex step)
          const dx = corpsePos.x - myPos.x;
          const dy = corpsePos.y - myPos.y;
          const step = {
            x: myPos.x + Math.sign(dx),
            y: myPos.y + Math.sign(dy),
          };

          log(
            `🐭 ${fighter.name} cautiously noses toward a nearby corpse to scavenge.`,
            "info"
          );

          if (setPositions) {
            setPositions((prev) => {
              const updated = { ...prev, [fighter.id]: step };
              if (positionsRef) positionsRef.current = updated;
              return updated;
            });
          }

          setFighters((prev) =>
            prev.map((f) =>
              f.id === fighter.id
                ? {
                    ...f,
                    remainingAttacks: Math.max(0, f.remainingAttacks - 1),
                  }
                : f
            )
          );

          scheduleEndTurn();
          if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
          return;
        }

        // Already adjacent: actually scavenge/eat
        log(`${fighter.name} scavenges from the corpse.`, "info");
        scavengeCorpse(fighter, corpse, log);

        setFighters((prev) =>
          prev.map((f) =>
            f.id === fighter.id
              ? {
                  ...f,
                  remainingAttacks: Math.max(0, f.remainingAttacks - 1),
                  defensiveStance: "Idle/Forage",
                }
              : f
          )
        );

        scheduleEndTurn();
        if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
        return;
      }
    }

    // 2b) Optional: forage items (grain, crumbs, berries) via consumptionSystem
    const foodItem = findFoodItem(fighter);
    if (foodItem) {
      log(`${fighter.name} snacks on ${foodItem.name}.`, "info");
      consumeItem(fighter, foodItem, { log });

      setFighters((prev) =>
        prev.map((f) =>
          f.id === fighter.id
            ? {
                ...f,
                remainingAttacks: Math.max(0, f.remainingAttacks - 1),
                defensiveStance: "Idle/Forage",
              }
            : f
        )
      );

      scheduleEndTurn();
      if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
      return;
    }

    // 3) WANDER / IDLE: sniff around a bit, maybe toward a future hiding spot
    const hideSpot = findNearbyHidingSpot(
      fighter,
      positions,
      terrain,
      objects || [],
      12
    );

    if (hideSpot) {
      const hx = hideSpot.position.x - myPos.x;
      const hy = hideSpot.position.y - myPos.y;
      const step = {
        x: myPos.x + Math.sign(hx),
        y: myPos.y + Math.sign(hy),
      };

      log(`${fighter.name} creeps cautiously toward a hiding place.`, "info");

      if (setPositions) {
        setPositions((prev) => {
          const updated = { ...prev, [fighter.id]: step };
          if (positionsRef) positionsRef.current = updated;
          return updated;
        });
      }

      setFighters((prev) =>
        prev.map((f) =>
          f.id === fighter.id
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
            : f
        )
      );

      scheduleEndTurn();
      if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
      return;
    }

    // No threats, no food, no clear hiding spot: pure idle flavor
    const idleLines = [
      `${fighter.name} sniffs the air nervously.`,
      `${fighter.name} grooms itself and twitches its whiskers.`,
      `${fighter.name} pauses, listening for danger.`,
    ];
    const line = idleLines[Math.floor(Math.random() * idleLines.length)];
    log(line, "info");

    setFighters((prev) =>
      prev.map((f) =>
        f.id === fighter.id
          ? {
              ...f,
              remainingAttacks: Math.max(0, f.remainingAttacks - 1),
              defensiveStance: "Idle/Alert",
            }
          : f
      )
    );

    scheduleEndTurn();
    if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
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
      // Check if this is a prey animal - if so, use idle/forage behavior instead of just defending
      if (isPreyAnimal(enemy)) {
        const playerEnemies = fighters.filter(
          (f) => f.type === "player" && canFighterAct(f)
        );
        const enemyAllies = fighters.filter(
          (f) => f.type === "enemy" && f.id !== enemy.id
        );
        runPreyIdleTurn({
          fighter: enemy,
          enemies: playerEnemies,
          allies: enemyAllies,
          positions,
          terrain: combatTerrain,
          objects: arenaEnvironment?.objects || [],
          log: addLog,
          setFighters,
          scheduleEndTurn,
          processingEnemyTurnRef,
          setPositions,
          positionsRef,
          calculateDistance,
          findRetreatDestination,
          handlePositionChange,
          isHexOccupied,
        });
        return;
      }
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

        // Check if target is unreachable using centralized helper
        // First check if already marked as unreachable
        let isUnreachable = isTargetUnreachable(enemy, t);

        // If not marked, check actual reachability
        if (!isUnreachable) {
          // For melee-focused enemies without ranged weapons, check melee reachability
          if (!enemyHasRangedWeapon) {
            isUnreachable = !canThreatenWithMelee(enemy, t);
            if (isUnreachable) {
              markTargetUnreachable(enemy, t);
            }
          }
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

    // 3. EATING: Removed generic eating block - only scavengers/prey/hawks eat mid-fight
    // (See hawk/skittish-specific eating block further down)

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
          const newAltitude = isHawk(enemy) ? 100 : 20;
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
              const newAltitude = isHawk(enemy) ? 100 : 20;
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
              const newAltitude = isHawk(enemy) ? 100 : 20;
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
      // If no reachable targets, check if enemy has any valid offensive options
      if (targetsInRange.length === 0 && targetsWithDistance.length > 0) {
        const allUnreachable = targetsWithDistance.every(
          (t) => t.isUnreachable
        );
        if (allUnreachable) {
          // Check if enemy has any way to attack (ranged, spells, psionics)
          if (!hasAnyValidOffensiveOption(enemy, playerTargets)) {
            // Does this enemy behave like a flying predator and are there any prey at all?
            const hasPreyTargets =
              isFlyingHunter(enemy) && playerTargets.some(isPreyAnimal);

            // If this is a prey animal, use prey idle behavior instead of withdraw
            if (isPreyAnimal(enemy)) {
              const playerEnemies = fighters.filter(
                (f) => f.type === "player" && canFighterAct(f)
              );
              const enemyAllies = fighters.filter(
                (f) => f.type === "enemy" && f.id !== enemy.id
              );
              runPreyIdleTurn({
                fighter: enemy,
                enemies: playerEnemies,
                allies: enemyAllies,
                positions,
                terrain: combatTerrain,
                objects: arenaEnvironment?.objects || [],
                log: addLog,
                setFighters,
                scheduleEndTurn,
                processingEnemyTurnRef,
                setPositions,
                positionsRef,
                calculateDistance,
                findRetreatDestination,
                handlePositionChange,
                isHexOccupied,
              });
              return;
            }

            // Flying hunters with prey targets should keep hunting, not withdraw
            if (hasPreyTargets) {
              // Continue circling/hunting instead of withdrawing
              // The hawk will dive on prey in subsequent turns
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }

            // Non-prey fallback: defend/withdraw as before
            // Only log this once per combat for this fighter (spam control)
            if (!enemy._noOffenseLogged) {
              addLog(
                `⚠️ ${enemy.name} has no way to hit any enemies (flight/range). Attempting to withdraw to safety.`,
                "warning"
              );
              // Mark that we've logged this for this fighter
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id ? { ...f, _noOffenseLogged: true } : f
                )
              );
            }
            processingEnemyTurnRef.current = false;

            // Attempt tactical withdraw instead of just ending turn
            const didWithdraw = attemptTacticalWithdraw({
              enemy,
              fighters,
              positions,
              addLog,
              findRetreatDestination,
              isHexOccupied,
              handlePositionChange,
              setDefensiveStance,
              scheduleEndTurn,
              canFighterAct,
              GRID_CONFIG,
            });

            // If withdrawal failed, end turn (withdraw function already handled logging)
            if (!didWithdraw) {
              return;
            }

            // Withdrawal succeeded and already scheduled move + endTurn
            return;
          } else {
            addLog(
              `🚫 ${enemy.name} cannot reach any targets with melee - all enemies are flying!`,
              "warning"
            );
            // Enemy has ranged options, so continue (they'll use ranged attacks)
          }
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

            // Fly up to cruising altitude (100ft for hawks, 20ft for others)
            const cruiseAltitude = isHawk(enemy) ? 100 : 20;
            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id
                  ? {
                      ...f,
                      altitude: cruiseAltitude,
                      altitudeFeet: cruiseAltitude,
                    }
                  : f
              )
            );
            addLog(
              `🦅 ${enemy.name} climbs back to ${cruiseAltitude}ft altitude`,
              "info"
            );

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
      const takeOffAltitude = isHawk(enemy) ? 100 : 20;
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

    // Check if target is unreachable using centralized helper
    if (!canThreatenWithMelee(enemy, target)) {
      // Check if enemy has ranged weapons - if so, they can still attack
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

      if (!enemyHasRangedWeapon) {
        const targetAltitude = getAltitude(target) || 0;
        addLog(
          `🚫 ${enemy.name} cannot reach ${target.name} with melee - ${target.name} is flying (${targetAltitude}ft) and ${enemy.name} has no ranged weapons!`,
          "warning"
        );
        markTargetUnreachable(enemy, target);
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
      // NEW: Double-check with full range logic (including altitude) before trusting inRange
      const currentDistance = calculateDistance(currentPos, targetPos);
      const rangeValidation = validateWeaponRange(
        enemy,
        target,
        equippedWeapon,
        currentDistance
      );

      // Only trust movementAnalysis.inRange if altitude-aware range check also says canAttack
      const actuallyInRange =
        movementAnalysis.inRange && rangeValidation.canAttack;

      if (
        movementAnalysis.recommendations &&
        movementAnalysis.recommendations.length > 0
      ) {
        if (movementAnalysis.inRange && !rangeValidation.canAttack) {
          // Movement analysis says "in range" but altitude check says "unreachable"
          addLog(
            `🔍 ${enemy.name} analyzes movement: ${movementAnalysis.distance}ft away, but ${rangeValidation.reason}`,
            "info"
          );
        } else {
          addLog(
            `🔍 ${enemy.name} analyzes movement: ${
              movementAnalysis.distance
            }ft away, ${actuallyInRange ? "in range" : "needs to move"}`,
            "info"
          );
        }
      }

      // If target is unreachable due to altitude, mark it and skip movement
      if (
        !rangeValidation.canAttack &&
        (rangeValidation.reason?.includes("flying too high") ||
          rangeValidation.reason?.includes(
            "cannot be reached by melee attacks from ground"
          ))
      ) {
        markTargetUnreachable(enemy, target);
        addLog(
          `❌ ${enemy.name} realizes ${target.name} is unreachable (${rangeValidation.reason}).`,
          "warning"
        );
        // Mark target as unreachable for this round to prevent spam
        if (!enemy.meta) enemy.meta = {};
        if (!enemy.meta.unreachableTargetsThisRound) {
          enemy.meta.unreachableTargetsThisRound = [];
        }
        if (!enemy.meta.unreachableTargetsThisRound.includes(target.id)) {
          enemy.meta.unreachableTargetsThisRound.push(target.id);
        }
        setFighters((prev) =>
          prev.map((f) => (f.id === enemy.id ? { ...f, meta: enemy.meta } : f))
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
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
    // BUT: Check if target is reachable with melee first
    if (flankingPositions.length > 0 && currentFlankingBonus === 0) {
      // Check if target is reachable with melee before attempting to flank
      if (!canThreatenWithMelee(enemy, target)) {
        addLog(
          `❌ ${enemy.name} skips flanking ${target.name} (target unreachable in melee)`,
          "warning"
        );
        markTargetUnreachable(enemy, target);
        // Don't attempt flanking if target is unreachable - skip to next action
      } else {
        addLog(`🎯 ${enemy.name} considers flanking ${target.name}`, "info");

        // Find the best flanking position (closest to current position AND within attack range)
        const speed =
          enemy.Spd ||
          enemy.spd ||
          enemy.attributes?.Spd ||
          enemy.attributes?.spd ||
          10;

        // For flying creatures, movement is not limited by ground speed
        // They can use flight movement which may allow longer distances
        // For now, we'll use a more generous movement allowance for fliers
        const enemyIsFlying = isFlying(enemy);
        const enemyCanFly = canFly(enemy);
        const maxMoveDistance =
          enemyCanFly || enemyIsFlying
            ? speed * 10 // Flying creatures can move further (10ft per speed point)
            : speed * 5; // Ground movement: 5 feet per hex

        // Log movement type for debugging
        if (enemyCanFly || enemyIsFlying) {
          addLog(
            `🦅 ${enemy.name} uses flight movement (max ${maxMoveDistance}ft)`,
            "info"
          );
        }

        // Filter flanking positions to only those that are:
        // 1. Within movement range
        // 2. Within attack range after moving
        const validFlankingPositions = flankingPositions.filter((flankPos) => {
          const flankDistance = calculateDistance(currentPos, flankPos);
          if (flankDistance > maxMoveDistance) return false; // Can't reach it

          // Check if this flanking position is within attack range
          const distanceFromFlankToTarget = calculateDistance(
            flankPos,
            targetPos
          );
          const rangeValidation = validateWeaponRange(
            enemy,
            target,
            selectedAttack,
            distanceFromFlankToTarget
          );
          return rangeValidation.canAttack;
        });

        if (validFlankingPositions.length > 0) {
          // Find the best valid flanking position (closest to current position)
          const bestFlankPos = validFlankingPositions.reduce(
            (best, current) => {
              const bestDist = calculateDistance(currentPos, best);
              const currentDist = calculateDistance(currentPos, current);
              return currentDist < bestDist ? current : best;
            }
          );

          const flankDistance = calculateDistance(currentPos, bestFlankPos);

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
        } else {
          // No valid flanking positions (either can't reach them or they're out of attack range)
          // Fall through to normal movement logic
          addLog(
            `🎯 ${enemy.name} cannot reach a valid flanking position - will move directly toward ${target.name}`,
            "info"
          );
        }
      } // Close the else block for reachable target check
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
          // Check if target is unreachable due to altitude (flying too high)
          const isFlyingTooHigh =
            rangeValidation.reason?.includes("flying too high") ||
            rangeValidation.reason?.includes(
              "cannot be reached by melee attacks from ground"
            );

          if (isFlyingTooHigh) {
            // Target is flying too high - mark as unreachable and end turn immediately
            markTargetUnreachable(enemy, target);
            addLog(
              `❌ ${enemy.name} realizes ${target.name} is unreachable (${rangeValidation.reason}).`,
              "warning"
            );
            // Mark target as unreachable for this round to prevent spam
            if (!enemy.meta) enemy.meta = {};
            if (!enemy.meta.unreachableTargetsThisRound) {
              enemy.meta.unreachableTargetsThisRound = [];
            }
            if (!enemy.meta.unreachableTargetsThisRound.includes(target.id)) {
              enemy.meta.unreachableTargetsThisRound.push(target.id);
            }
            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id ? { ...f, meta: enemy.meta } : f
              )
            );
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }

          // Cannot attack from current position - try to find alternative path
          // If no alternative found, end turn
          addLog(
            `⚠️ ${enemy.name} cannot get any closer to ${target.name} and is out of melee range (path blocked).`,
            "warning"
          );

          // Try to find alternative path (same logic as RUN/SPRINT section)
          let foundAlternative = false;
          for (let offset = 1; offset <= 3 && !foundAlternative; offset++) {
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
                  const testDistance = calculateDistance(testPos, targetPos);
                  const testRangeValidation = validateWeaponRange(
                    enemy,
                    target,
                    selectedAttack,
                    testDistance
                  );
                  if (testRangeValidation.canAttack) {
                    newX = testPos.x;
                    newY = testPos.y;
                    foundAlternative = true;
                    addLog(
                      `📍 ${enemy.name} adjusts path to avoid ${occupant.name}, moving to (${newX}, ${newY})`,
                      "info"
                    );
                    break;
                  }
                }
              }
            }
          }

          if (!foundAlternative) {
            addLog(
              `⚔️ ${enemy.name} cannot reach target (${rangeValidation.reason}) and ends turn`,
              "info"
            );
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
          // Found alternative - continue with movement
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
            // Check if occupant (target) is actually reachable (altitude check)
            const distanceFromCurrentPos = calculateDistance(
              currentPos,
              targetPos
            );
            const rangeValidation = validateWeaponRange(
              enemy,
              occupant, // occupant is the target in this case
              selectedAttack,
              distanceFromCurrentPos
            );

            // Check if target is unreachable due to altitude (flying too high)
            const isFlyingTooHigh =
              rangeValidation.reason?.includes("flying too high") ||
              rangeValidation.reason?.includes(
                "cannot be reached by melee attacks from ground"
              );

            if (isFlyingTooHigh) {
              // Target is flying too high - mark as unreachable and end turn immediately
              markTargetUnreachable(enemy, occupant);
              addLog(
                `❌ ${enemy.name} realizes ${occupant.name} is unreachable (${rangeValidation.reason}).`,
                "warning"
              );
              // Mark target as unreachable for this round to prevent spam
              if (!enemy.meta) enemy.meta = {};
              if (!enemy.meta.unreachableTargetsThisRound) {
                enemy.meta.unreachableTargetsThisRound = [];
              }
              if (
                !enemy.meta.unreachableTargetsThisRound.includes(occupant.id)
              ) {
                enemy.meta.unreachableTargetsThisRound.push(occupant.id);
              }
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id ? { ...f, meta: enemy.meta } : f
                )
              );
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }

            // Target is reachable - proceed with closing into opponent
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

              // Check if enemy can still attack from current position despite being blocked
              const distanceFromCurrentPos = calculateDistance(
                currentPos,
                targetPos
              );
              const rangeValidation = validateWeaponRange(
                enemy,
                target,
                selectedAttack,
                distanceFromCurrentPos
              );

              // Check if target is unreachable due to altitude (flying too high)
              const isFlyingTooHigh =
                rangeValidation.reason?.includes("flying too high") ||
                rangeValidation.reason?.includes(
                  "cannot be reached by melee attacks from ground"
                );

              if (isFlyingTooHigh) {
                // Target is flying too high - mark as unreachable and end turn immediately
                markTargetUnreachable(enemy, target);
                addLog(
                  `❌ ${enemy.name} realizes ${target.name} is unreachable (${rangeValidation.reason}).`,
                  "warning"
                );
                // Mark target as unreachable for this round to prevent spam
                if (!enemy.meta) enemy.meta = {};
                if (!enemy.meta.unreachableTargetsThisRound) {
                  enemy.meta.unreachableTargetsThisRound = [];
                }
                if (
                  !enemy.meta.unreachableTargetsThisRound.includes(target.id)
                ) {
                  enemy.meta.unreachableTargetsThisRound.push(target.id);
                }
                setFighters((prev) =>
                  prev.map((f) =>
                    f.id === enemy.id ? { ...f, meta: enemy.meta } : f
                  )
                );
                processingEnemyTurnRef.current = false;
                scheduleEndTurn();
                return;
              }

              if (!rangeValidation.canAttack) {
                addLog(
                  `⚠️ ${enemy.name} cannot get any closer to ${target.name} and is out of melee range (path blocked). Ending turn.`,
                  "warning"
                );
                processingEnemyTurnRef.current = false;
                scheduleEndTurn();
                return;
              }

              // Can attack from current position - continue to attack below
              addLog(
                `⚔️ ${enemy.name} is within range from current position (${rangeValidation.reason}) and attacks`,
                "info"
              );
              // Don't end turn, continue to attack section below
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
            scheduleEndTurn();
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
    scheduleEndTurn();
  }, 1500);
}
}

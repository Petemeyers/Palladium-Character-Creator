// Ã°Å¸â€œÅ“ src/utils/aiVisibilityFilter.js
// Medieval Combat Simulator 1994 True-Vision System for AI
//
// Handles all perception logic for AI and players alike.
//  Ã¢Å“â€¦ Line-of-Sight (terrainSystem)
//  Ã¢Å“â€¦ Lighting & Nightvision (visibilityCalculator)
//  Ã¢Å“â€¦ Stealth / Prowl / Invisibility (stealthSystem)
//  Ã¢Å“â€¦ Heavy-Armor noise penalties
//  Ã¢Å“â€¦ Intelligence-based awareness decay (Medieval Combat Simulator 1994 RAI)
//     - intellect governs "ability to learn, reason, and remember" (Core Rulebook)
//     - High IQ (16+): Never forget, stays at Searching minimum
//     - Average IQ (10-15): Forgets after extended time (30s+)
//     - Low IQ (6-9): Forgets quickly (20s+)
//     - Very Low IQ (<6): Forget easily (15s+)
//  Ã¢Å“â€¦ Optional variance (Ã‚Â±3s) simulates attention lapses (GM-style perception)
//
// Integrated by CombatPage.jsx (lines ~2199 / ~2926)
// Used by Player AI and Enemy AI targeting.
//
// Canonical Interpretation (1994 RAI):
// - Memory/reasoning: Based on intellect Ã¢Å“â€¦
// - Animal instinct vs. intellect: "Low intellect = instinctive behavior" Ã¢Å“â€¦
// - Tactical recall: "High intellect = analytical planning" Ã¢Å“â€¦
// - GM discretion: Automated, data-driven via intellect Ã¢Å“â€¦

import { calculateLineOfSight, applyLightingEffects } from "./terrainSystem.js";
import {
  calculateDetection,
  hasSpecialSenses,
} from "./stealthSystem.js";
import {
  getVisibilityRange,
} from "./visibilityCalculator.js";
import CryptoSecureDice from "./cryptoDice.js";
import { calculateDistance } from "../data/movementRules.js";

/**
 * Track awareness levels per observer Ã¢â€ â€™ target
 * Possible states: "Unaware", "Searching", "Alert"
 */
const awarenessMap = new Map();

// Global visibility log for deduplication (prevents spam)
let globalVisibilityLog = null;

/**
 * Returns key string for awareness map
 */
function awarenessKey(observerId, targetId) {
  return `${observerId}_${targetId}`;
}

function revealTargetConcealment(target, reason = "detected") {
  if (!target) return;
  const wasHidden = !!(target.hidden || target.isProwling || target.prowlState?.hidden);
  if (!wasHidden) return;

  target.hidden = false;
  target.isProwling = false;
  target.prowlState = {
    ...(target.prowlState || {}),
    hidden: false,
    prowlSuccess: false,
    brokenBy: reason,
  };
}

/**
 * Updates awareness state progression
 */
export function updateAwareness(observer, target, state) {
  const key = awarenessKey(observer.id, target.id);
  awarenessMap.set(key, {
    state,
    lastSeenRound: performance.now(),
  });
}

/**
 * Retrieves current awareness state
 */
export function getAwareness(observer, target) {
  const key = awarenessKey(observer.id, target.id);
  return awarenessMap.get(key)?.state || "Unaware";
}

/**
 * Time-based fading of awareness (approximate melee timing)
 * Medieval Combat Simulator: Alert Ã¢â€ â€™ Searching (10s) Ã¢â€ â€™ Unaware (20s+)
 *
 * Intelligence-based decay (Medieval Combat Simulator 1994 RAI):
 * - High IQ (16+): Never completely forget, stays at Searching minimum
 *   "Analytical, logical; retains info, plans tactics"
 * - Average IQ (10-15): Can forget after extended time (30s+)
 *   "Reasonable; can forget with distraction/time"
 * - Low IQ (6-9): Can forget after moderate time
 *   "Instinctive; poor reasoning"
 * - Very low IQ (<6) - Forget easily
 *   "Bestial; acts on reflex"
 *
 * Optional Enhancement: Random variance (Ã‚Â±3 seconds) simulates attention lapses/distractions,
 * matching GM-style perception checks and making encounters feel more organic.
 */
export function decayAwareness(observer, target, options = {}) {
  const { useVariance = true } = options; // Enable random variance by default

  const key = awarenessKey(observer.id, target.id);
  const entry = awarenessMap.get(key);
  if (!entry) return;

  // Get observer's Intelligence (IQ)
  // Medieval Combat Simulator: intellect determines "ability to learn, reason, and remember"
  const iq =
    observer.Int ||
    observer.int ||
    observer.attributes?.Int ||
    observer.attributes?.int ||
    observer.IQ ||
    observer.iq ||
    10;

  const elapsed = (performance.now() - entry.lastSeenRound) / 1000; // seconds

  // Base thresholds by IQ tier (Medieval Combat Simulator RAI)
  let alertToSearchingThreshold = 10; // Alert Ã¢â€ â€™ Searching
  let searchingToUnawareThreshold = Infinity; // Searching Ã¢â€ â€™ Unaware (default: never)

  // High intelligence (16+) - Never completely forget, minimum Searching
  // "Analytical, logical; retains info, plans tactics"
  if (iq >= 16) {
    alertToSearchingThreshold = 10;
    searchingToUnawareThreshold = Infinity; // Never drops below Searching
  }
  // Average intelligence (10-15) - Can forget after extended time
  // "Reasonable; can forget with distraction/time"
  else if (iq >= 10) {
    alertToSearchingThreshold = 10;
    searchingToUnawareThreshold = 30; // Forgets after extended time
  }
  // Low intelligence (6-9) - Can forget after moderate time
  // "Instinctive; poor reasoning"
  else if (iq >= 6) {
    alertToSearchingThreshold = 10;
    searchingToUnawareThreshold = 20; // Forgets after moderate time
  }
  // Very low intelligence (<6) - Forget easily
  // "Bestial; acts on reflex"
  else {
    alertToSearchingThreshold = 8; // Drops to Searching faster
    searchingToUnawareThreshold = 15; // Forgets easily
  }

  // Optional Enhancement: Add random variance (Ã‚Â±3 seconds) to simulate attention lapses
  // This mimics GM-style perception checks and makes encounters feel more organic
  if (useVariance && searchingToUnawareThreshold !== Infinity) {
    // Generate variance once per entry (store it to avoid flickering)
    if (!entry.variance) {
      entry.variance = Math.random() * 6 - 3; // Ã‚Â±3 seconds variance
    }
    searchingToUnawareThreshold = searchingToUnawareThreshold + entry.variance;

    // Also add smaller variance to Alert Ã¢â€ â€™ Searching transition
    if (!entry.alertVariance) {
      entry.alertVariance = Math.random() * 4 - 2; // Ã‚Â±2 seconds variance
    }
    alertToSearchingThreshold = alertToSearchingThreshold + entry.alertVariance;
  }

  // Apply decay thresholds
  if (entry.state === "Alert") {
    if (elapsed > alertToSearchingThreshold) {
      entry.state = "Searching";
    }
  } else if (entry.state === "Searching") {
    if (elapsed > searchingToUnawareThreshold) {
      entry.state = "Unaware";
    }
  }

  awarenessMap.set(key, entry);
}

/**
 * Get visibility at position (wrastaminar for visibilityCalculator integration)
 * Checks distance, lighting, and range limits
 */
function getVisibilityAtPosition(observer, target, positions, combatTerrain) {
  // Handle both id and _id for fighter identification
  const observerId = observer.id || observer._id;
  const targetId = target.id || target._id;

  if (!positions || !observerId || !targetId) {
    return { visible: false, reason: "Missing IDs or positions" };
  }

  const observerPos = positions[observerId];
  const targetPos = positions[targetId];

  if (!observerPos || !targetPos) {
    return {
      visible: false,
      reason: `Invalid positions - observer: ${observerId}, target: ${targetId}`,
    };
  }
  const distanceInFeet = calculateDistance(observerPos, targetPos);

  const lighting =
    combatTerrain?.lighting ||
    combatTerrain?.lightingData?.name ||
    "BRIGHT_DAYLIGHT";
  const hasInfravision = observer.hasInfravision || false;

  // Get visibility range based on lighting
  const visibilityRange = getVisibilityRange(
    lighting,
    hasInfravision,
    observer
  );

  // Check if target is within visibility range
  if (distanceInFeet > visibilityRange) {
    return {
      visible: false,
      reason: `Beyond visibility range (${distanceInFeet}ft > ${visibilityRange}ft)`,
    };
  }

  // Apply lighting effects
  const lightingResult = applyLightingEffects(
    distanceInFeet,
    lighting,
    hasInfravision,
    observer // For nightvision check
  );

  return {
    visible: lightingResult.canSee,
    reason: lightingResult.reason,
    penalty: lightingResult.penalty || 0,
    distance: distanceInFeet,
  };
}

/**
 * Core visibility check for AI perception.
 * Returns true if observer can see target according to Medieval Combat Simulator logic.
 *
 * @param {Object} observer - The AI character (player or enemy)
 * @param {Object} target - Target to check visibility for
 * @param {Object} positions - All combatant positions {id: {x, y}}
 * @param {Object} combatTerrain - Terrain data with lighting, obstacles
 * @param {Object} options - Additional options
 * @param {boolean} options.useFogOfWar - Whether to check fog of war
 * @param {Array} options.fogOfWarVisibleCells - Pre-computed visible cells
 * @returns {boolean} True if observer can see target
 */
export function canAISeeTarget(
  observer,
  target,
  positions,
  combatTerrain,
  options = {}
) {
  const { useFogOfWar = false, fogOfWarVisibleCells = null } = options;

  // --- Base sanity checks
  // Check if fighters are alive - use currentHP > -21 (dead threshold) or status !== "defeated"
  // Also check for explicit .alive property for backward compatibility
  const observerAlive =
    observer?.alive !== false &&
    (observer?.currentHP === undefined || observer?.currentHP > -21) &&
    observer?.status !== "defeated";
  const targetAlive =
    target?.alive !== false &&
    (target?.currentHP === undefined || target?.currentHP > -21) &&
    target?.status !== "defeated";

  if (!observerAlive || !targetAlive) {
    if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
      console.log(
        `[Visibility] ${observer?.name || "Unknown"} cannot see ${
          target?.name || "Unknown"
        } - not alive`,
        {
          observerAlive,
          targetAlive,
          observerHP: observer?.currentHP,
          targetHP: target?.currentHP,
          observerStatus: observer?.status,
          targetStatus: target?.status,
        }
      );
    }
    updateAwareness(observer, target, "Searching");
    return false;
  }

  if (target.id === observer.id) return false;

  // --- Special senses override
  if (observer.senses?.omnivision || hasSpecialSenses(observer)) {
    updateAwareness(observer, target, "Alert");
    return true;
  }

  // --- Invisibility
  if (target.invisible && !hasSpecialSenses(observer)) {
    if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
      console.log(
        `[Visibility] ${observer?.name || "Unknown"} cannot see ${
          target?.name || "Unknown"
        } - target invisible`
      );
    }
    updateAwareness(observer, target, "Searching");
    return false;
  }

  // --- Quick bypass for bright daylight on open ground (common scenario)
  // If it's bright daylight and open ground, skip complex checks if positions exist
  // Handle both id and _id for fighter identification (declare once, reuse later)
  const observerId = observer.id || observer._id;
  const targetId = target.id || target._id;

  // Get lighting and terrain - check multiple possible property paths
  const lighting =
    combatTerrain?.lighting ||
    combatTerrain?.lightingData?.name ||
    (typeof combatTerrain?.lightingData === "string"
      ? combatTerrain.lightingData
      : null) ||
    "BRIGHT_DAYLIGHT";
  const terrain =
    combatTerrain?.terrain ||
    combatTerrain?.terrainData?.name ||
    (typeof combatTerrain?.terrainData === "string"
      ? combatTerrain.terrainData
      : null) ||
    "OPEN_GROUND";

  // Normalize lighting/terrain values for comparison (case-insensitive, handle variations)
  const normalizedLighting = String(lighting).toUpperCase().trim();
  const normalizedTerrain = String(terrain).toUpperCase().trim();

  // Check if positions exist
  const hasValidPositions =
    positions && positions[observerId] && positions[targetId];

  // Debug: ALWAYS log bypass check in development
  if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
    console.log(
      `[Visibility Bypass Check] ${observer.name || observerId} -> ${
        target.name || targetId
      }:`,
      {
        lighting,
        normalizedLighting,
        terrain,
        normalizedTerrain,
        hasValidPositions,
        observerPos: positions?.[observerId],
        targetPos: positions?.[targetId],
        observerId,
        targetId,
        useFogOfWar,
        targetHidden: !!(target.prowlState?.hidden || target.hidden),
        combatTerrainKeys: combatTerrain ? Object.keys(combatTerrain) : "null",
        combatTerrain,
        positionsKeys: positions ? Object.keys(positions) : "null",
      }
    );
  }

  const isBrightDaylight =
    normalizedLighting.includes("BRIGHT") &&
    normalizedLighting.includes("DAYLIGHT");
  const isOpenGround =
    normalizedTerrain.includes("OPEN") || normalizedTerrain.includes("GRASS");

  if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
    console.log(
      `[Visibility Bypass Conditions] ${observer.name || observerId} -> ${
        target.name || targetId
      }:`,
      {
        isBrightDaylight,
        isOpenGround,
        hasValidPositions,
        useFogOfWar,
        targetHidden: !!(target.prowlState?.hidden || target.hidden),
        allConditionsMet:
          isBrightDaylight &&
          isOpenGround &&
          hasValidPositions &&
          !useFogOfWar &&
          !target.prowlState?.hidden &&
          !target.hidden,
      }
    );
  }

  if (
    isBrightDaylight &&
    isOpenGround &&
    hasValidPositions &&
    !useFogOfWar &&
    !target.prowlState?.hidden &&
    !target.hidden
  ) {
    // Simple distance check - bright daylight on open ground = very long visibility
    const distanceInFeet = calculateDistance(
      positions[observerId],
      positions[targetId]
    );

    if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
      console.log(
        `[Visibility Bypass] ${observer.name || observerId} -> ${
          target.name || targetId
        }: distance=${distanceInFeet}ft, checking LOS...`
      );
    }

    if (distanceInFeet < 1000) {
      const terrainObstacles = combatTerrain?.obstacles || [];
      const losResult = calculateLineOfSight(
        positions[observerId],
        positions[targetId],
        { obstacles: terrainObstacles }
      );
      if (losResult.hasLineOfSight) {
        if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
          console.log(
            `[Visibility Bypass] Ã¢Å“â€¦ ${observer.name || observerId} CAN see ${
              target.name || targetId
            } (bright daylight bypass)`
          );
        }
        updateAwareness(observer, target, "Alert");
        return true;
      } else {
        if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
          console.log(
            `[Visibility Bypass] Ã¢ÂÅ’ ${observer.name || observerId} cannot see ${
              target.name || targetId
            } - line of sight blocked`
          );
        }
      }
    } else {
      if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
        console.log(
          `[Visibility Bypass] Ã¢Å¡Â Ã¯Â¸Â ${observer.name || observerId} -> ${
            target.name || targetId
          }: distance ${distanceInFeet}ft exceeds 1000ft limit`
        );
      }
    }
  } else {
    if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
      console.log(
        `[Visibility Bypass] Ã¢ÂÂ­Ã¯Â¸Â ${observer.name || observerId} -> ${
          target.name || targetId
        }: bypass conditions not met, using full visibility check`
      );
    }
  }

  // --- Lighting / range (visibilityCalculator integration)
  const visibility = getVisibilityAtPosition(
    observer,
    target,
    positions,
    combatTerrain
  );
  if (!visibility.visible) {
    if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
      const logKey = `vis_${observerId}_${targetId}`;
      if (!globalVisibilityLog || !globalVisibilityLog.has(logKey)) {
        console.log(
          `[Visibility] ${observer.name || observerId} cannot see ${
            target.name || targetId
          }: ${visibility.reason || "Unknown"}`,
          {
            observerPos: positions[observerId],
            targetPos: positions[targetId],
            combatTerrain: combatTerrain?.terrain || combatTerrain?.lighting,
          }
        );
        if (!globalVisibilityLog) globalVisibilityLog = new Set();
        globalVisibilityLog.add(logKey);
        setTimeout(() => {
          if (globalVisibilityLog) globalVisibilityLog.delete(logKey);
        }, 5000);
      }
    }
    updateAwareness(observer, target, "Searching");
    return false;
  }

  // --- Line of Sight & Obstructions (terrainSystem integration)
  if (!observerId || !targetId) {
    updateAwareness(observer, target, "Searching");
    return false;
  }

  const observerPos = positions[observerId];
  const targetPos = positions[targetId];

  if (!observerPos || !targetPos) {
    updateAwareness(observer, target, "Searching");
    return false;
  }

  const terrainObstacles = combatTerrain?.obstacles || [];
  const losResult = calculateLineOfSight(observerPos, targetPos, {
    obstacles: terrainObstacles,
  });
  if (!losResult.hasLineOfSight) {
    updateAwareness(observer, target, "Searching");
    return false;
  }

  // --- Stealth / Prowl (stealthSystem integration)
  if (target.prowlState?.hidden || target.hidden) {
    const lighting =
      combatTerrain?.lighting ||
      combatTerrain?.lightingData?.name ||
      "BRIGHT_DAYLIGHT";
    const detectionResult = calculateDetection(
      observer,
      {
        invisible: target.invisible || false,
        cover: target.cover || "none",
        x: targetPos.x,
        y: targetPos.y,
      },
      {
        lighting: lighting,
        visibility: "clear",
        distance: visibility.distance,
      }
    );

    if (!detectionResult.detected) {
      updateAwareness(observer, target, "Searching");
      return false;
    }

    revealTargetConcealment(target, "detected");
  }

  // --- Heavy-Armor noise (penalizes stealth only)
  // Medieval Combat Simulator: "Heavy armor makes plenty of noise, which makes prowling difficult"
  const armorWeight = calculateArmorWeight(target);
  if (
    armorWeight > 30 &&
    (target.skills?.prowl || target.skills?.Prowl || target.prowlSkill) &&
    target.prowlState?.hidden
  ) {
    const noiseRoll = CryptoSecureDice.rollD100();
    const chanceToBeHeard = 10 + Math.floor(armorWeight / 5); // e.g., 40 lbs Ã¢â€ â€™ 18%

    if (noiseRoll <= chanceToBeHeard) {
      revealTargetConcealment(target, "noise");
      updateAwareness(observer, target, "Alert");
      return true; // Heavy armor made noise - detected!
    }
  }

  // --- Fog of War integration (optional)
  if (
    useFogOfWar &&
    fogOfWarVisibleCells &&
    Array.isArray(fogOfWarVisibleCells) &&
    fogOfWarVisibleCells.length > 0 &&
    targetPos
  ) {
    const targetCellKey = `${targetPos.x}-${targetPos.y}`;
    const isInFogOfWar = fogOfWarVisibleCells.some(
      (cell) => cell && `${cell.x}-${cell.y}` === targetCellKey
    );

    if (!isInFogOfWar) {
      if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
        const obsId = observer.id || observer._id;
        const tgtId = target.id || target._id;
        const logKey = `fog_${obsId}_${tgtId}`;
        if (!globalVisibilityLog || !globalVisibilityLog.has(logKey)) {
          console.log(
            `[Fog of War] ${observer.name || obsId} cannot see ${
              target.name || tgtId
            } - cell ${targetCellKey} not in visible cells`,
            {
              visibleCellsCount: fogOfWarVisibleCells.length,
              sampleCells: fogOfWarVisibleCells.slice(0, 3),
            }
          );
          if (!globalVisibilityLog) globalVisibilityLog = new Set();
          globalVisibilityLog.add(logKey);
          setTimeout(() => {
            if (globalVisibilityLog) globalVisibilityLog.delete(logKey);
          }, 5000);
        }
      }
      updateAwareness(observer, target, "Searching");
      return false;
    }
  }

  // --- If all checks passed, target is visible
  revealTargetConcealment(target, "spotted");
  updateAwareness(observer, target, "Alert");

  if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
    const awareness = getAwareness(observer, target);
    if (awareness !== "Alert") {
      console.log(
        `[Awareness] ${observer.name} becomes Alert of ${target.name}`
      );
    }
  }

  return true;
}

/**
 * Calculate total armor weight for noise penalty
 */
function calculateArmorWeight(character) {
  if (!character.equistaminad && !character.equistaminadArmor) return 0;

  let weight = 0;

  if (character.equistaminad) {
    for (const slot in character.equistaminad) {
      const item = character.equistaminad[slot];
      if (item && item.weight) {
        weight += parseFloat(item.weight) || 0;
      }
    }
  }

  if (character.equistaminadArmor) {
    Object.values(character.equistaminadArmor).forEach((armor) => {
      if (armor && armor.weight) {
        weight += parseFloat(armor.weight) || 0;
      }
    });
  }

  return weight;
}

/**
 * Utility for UI buttons/actions
 * Hide / re-enter stealth mid-combat
 *
 * Medieval Combat Simulator: If a thief breaks line of sight, remains silent, and passes a new
 *            Prowl check, they may perform another sneak/ambush attack from concealment
 *
 * @param {Object} player - Character attempting to hide
 * @param {Object} positions - All positions
 * @param {Object} combatTerrain - Terrain data
 * @param {Array} allEnemies - Array of all enemies
 * @returns {Object} { success: boolean, reason: string, log: string }
 */
export function attemptMidCombatHide(
  player,
  positions,
  combatTerrain,
  allEnemies
) {
  const prowlSkill =
    player.skills?.prowl ||
    player.skills?.Prowl ||
    player.prowlSkill ||
    0;

  if (!prowlSkill) {
    return {
      success: false,
      reason: "No prowl skill.",
      log: `${player.name} has no Prowl skill.`,
    };
  }
  const lighting =
    combatTerrain?.lighting ||
    combatTerrain?.lightingData?.name ||
    "BRIGHT_DAYLIGHT";

  const characterPos = positions[player.id];
  if (!characterPos) {
    return {
      success: false,
      reason: "Invalid position",
      log: `${player.name} has invalid position.`,
    };
  }

  const hasCover = player.cover && player.cover !== "none";
  const isDark = lighting.includes("DARK") || lighting.includes("darkness");

  if (!hasCover && !isDark) {
    return {
      success: false,
      reason: "No cover or darkness",
      log: `${player.name} needs cover or darkness to hide.`,
    };
  }

  const armorWeight = calculateArmorWeight(player);
  const armorPenalty = Math.floor((armorWeight / 20) * -5);

  const coverBonus = hasCover ? 10 : 0;
  const darknessBonus = isDark ? 15 : 0;

  const roll = CryptoSecureDice.rollD100();
  const total = prowlSkill + coverBonus + darknessBonus + armorPenalty;
  const success = roll <= total;

  if (success) {
    player.prowlState = {
      hidden: true,
      prowlSuccess: true,
      roll,
      total,
    };

    resetSneakAttackBonus(player);

    allEnemies.forEach((enemy) => {
      if (enemy && positions[enemy.id]) {
        updateAwareness(enemy, player, "Searching");
      }
    });

    return {
      success: true,
      reason: "Successfully hidden",
      log: `${player.name} vanishes into ${
        hasCover ? "cover" : "darkness"
      } (${roll}/${total}). Sneak attack bonus reset.`,
    };
  } else {
    player.prowlState = { hidden: false, prowlSuccess: false };
    return {
      success: false,
      reason: "Prowl failed",
      log: `${player.name} fails to hide (${roll}/${total}).`,
    };
  }
}

// --- Sneak Attack constants based on Medieval Combat Simulator 1994 rules ---
// "An ambush or attack from behind gives the attacker a +2 bonus to attack
//  and inflicts double damage on the first melee attack only."
// Ã¢â‚¬â€ Medieval Combat Simulator (1994), Combat Rules Section

const SNEAK_ATTACK_BONUS = {
  attack: +2,
  damageMultiplier: 2,
};

const BACKSTAB_BONUS = {
  attack: +4,
  damageMultiplier: 2,
};

/**
 * Determine PROFESSION (class) if available for backstab bonus
 * Assassin, Thief, and Ranger classes get enhanced backstab (+4 attack instead of +2)
 */
function getPROFESSIONAttackBonus(attacker) {
  const profession = attacker.profession?.toLowerCase() || attacker.PROFESSION?.toLowerCase() || "";
  if (["thief", "assassin", "ranger"].some((c) => profession.includes(c))) {
    return BACKSTAB_BONUS;
  }
  return SNEAK_ATTACK_BONUS;
}

/**
 * Determines if a sneak attack bonus applies and returns correct attack/damage modifiers
 *
 * Medieval Combat Simulator 1994 Rules:
 * - "An ambush or attack from behind gives the attacker a +2 bonus to attack
 *    and inflicts double damage on the first melee attack only."
 * - Works only if target is unaware or searching (not alert)
 * - Assassin/Thief/Ranger PROFESSIONs get +4 attack bonus (backstab)
 * - Critical attacks can still occur on natural 20s (apply after doubling)
 *
 * @param {Object} attacker - Attacking character
 * @param {Object} target - Defending character
 * @param {Object} options - Additional options
 * @param {boolean} options.firstAttackOnly - If true, checks if attacker already used sneak bonus
 * @returns {Object} { allowed: boolean, attackBonus: number, damageMultiplier: number, log: string }
 */
export function canPerformSneakAttack(attacker, target, options = {}) {
  const { firstAttackOnly = true } = options;

  if (firstAttackOnly && attacker.hasUsedSneakBonus) {
    return {
      allowed: false,
      attackBonus: 0,
      damageMultiplier: 1,
      log: `${attacker.name} already used their sneak attack bonus this encounter.`,
    };
  }

  const awareness = getAwareness(target, attacker);
  const canAmbush = awareness === "Unaware" || awareness === "Searching";

  if (!canAmbush) {
    return {
      allowed: false,
      attackBonus: 0,
      damageMultiplier: 1,
      log: `${target.name} is too alert for a sneak attack.`,
    };
  }

  const bonus = getPROFESSIONAttackBonus(attacker);

  if (firstAttackOnly) {
    attacker.hasUsedSneakBonus = true;
  }

  return {
    allowed: true,
    attackBonus: bonus.attack,
    damageMultiplier: bonus.damageMultiplier,
    log: `${attacker.name} launches a surprise attack! (+${bonus.attack} Attack, Ãƒâ€”${bonus.damageMultiplier} Damage)`,
    awareness,
  };
}

/**
 * Reset sneak attack bonus flag (useful when combat ends or new encounter starts)
 * Call this when combat begins or when a character successfully re-hides
 */
export function resetSneakAttackBonus(attacker) {
  if (attacker) {
    attacker.hasUsedSneakBonus = false;
  }
}

/**
 * Enemy Awareness States (exported for use in CombatPage.jsx)
 */
export const AWARENESS_STATES = {
  UNAWARE: "Unaware",
  SEARCHING: "Searching",
  ALERT: "Alert",
};

/**
 * Clear awareness map (useful when combat ends or resets)
 */
export function clearAwareness() {
  awarenessMap.clear();
}

/**
 * Get all awareness states (for debugging/UI display)
 */
export function getAllAwarenessStates() {
  const states = {};
  awarenessMap.forEach((value, key) => {
    states[key] = value.state;
  });
  return states;
}

export default {
  canAISeeTarget,
  updateAwareness,
  getAwareness,
  decayAwareness,
  canPerformSneakAttack,
  resetSneakAttackBonus,
  attemptMidCombatHide,
  clearAwareness,
  getAllAwarenessStates,
  AWARENESS_STATES,
};

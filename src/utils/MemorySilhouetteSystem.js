/**
 * Memory Silhouette System
 * Creates and maintains visual silhouettes/shapes of previously seen enemies
 * Shows approximate location and movement patterns even when not currently visible
 *
 * Similar to games like XCOM, where you see enemy silhouettes in fog of war
 *
 * Integrates with:
 * - fogMemorySystem.js (explored areas)
 * - TeamAwarenessSystem.js (awareness levels)
 * - SpottedAlertSystem.js (spotting events)
 */

/**
 * Silhouette types based on detection quality
 */
export const SILHOUETTE_TYPES = {
  EXACT: "exact", // Exact position known (currently visible)
  RECENT: "recent", // Recent position, high confidence
  APPROXIMATE: "approximate", // Approximate area, low confidence
  FADING: "fading", // Old information, fading out
};

/**
 * Create a silhouette from awareness data
 * @param {Object} awarenessData - Awareness information about target
 * @param {Object} options - Options for silhouette creation
 * @returns {Object} Silhouette object
 */
export function createSilhouette(awarenessData = {}, options = {}) {
  // TODO: Create silhouette based on awareness level and quality

  if (!awarenessData || !awarenessData.targetId) {
    return null;
  }

  const {
    level = "unknown",
    lastPosition = null,
    lastSeen = null,
    confidence = 0.5,
  } = awarenessData;

  // Determine silhouette type based on awareness level
  let silhouetteType = SILHOUETTE_TYPES.APPROXIMATE;

  // TODO: Map awareness levels to silhouette types
  // if (level === AWARENESS_LEVELS.VISIBLE) {
  //   silhouetteType = SILHOUETTE_TYPES.EXACT;
  // } else if (level === AWARENESS_LEVELS.TRACKED) {
  //   silhouetteType = SILHOUETTE_TYPES.RECENT;
  // } else if (level === AWARENESS_LEVELS.DETECTED) {
  //   silhouetteType = SILHOUETTE_TYPES.APPROXIMATE;
  // }

  // Calculate fade based on time since last seen
  const now = Date.now();
  const timeSinceSeen = lastSeen ? now - lastSeen : Infinity;
  const fadeAmount = Math.min(1.0, timeSinceSeen / 30000); // Fade over 30 seconds

  return {
    targetId: awarenessData.targetId,
    type: silhouetteType,
    position: lastPosition,
    confidence: confidence * (1 - fadeAmount),
    lastSeen: lastSeen,
    fadeAmount: fadeAmount,
    size: calculateSilhouetteSize(awarenessData),
  };
}

/**
 * Calculate silhouette size based on detection quality
 * @param {Object} awarenessData - Awareness information
 * @returns {Object} Size information {width, height, radius}
 */
function calculateSilhouetteSize(awarenessData) {
  // TODO: Calculate size based on confidence and awareness level
  // Lower confidence = larger, blurrier silhouette

  const baseSize = 1; // Base cell size
  const confidence = awarenessData.confidence || 0.5;

  // Lower confidence = larger uncertainty radius
  const uncertaintyRadius = (1 - confidence) * 2;

  return {
    width: baseSize + uncertaintyRadius,
    height: baseSize + uncertaintyRadius,
    radius: uncertaintyRadius,
  };
}

/**
 * Generate silhouettes for all known enemies
 * @param {Object} teamAwareness - Team awareness data
 * @param {Array} currentlyVisible - Array of currently visible target IDs
 * @returns {Array} Array of silhouette objects
 */
export function generateSilhouettes(teamAwareness = {}, currentlyVisible = []) {
  // TODO: Create silhouettes for all known but not visible enemies

  const silhouettes = [];
  const visibleSet = new Set(currentlyVisible);

  // TODO: Iterate through team awareness
  // Object.keys(teamAwareness).forEach(targetId => {
  //   if (!visibleSet.has(targetId)) {
  //     const silhouette = createSilhouette(teamAwareness[targetId]);
  //     if (silhouette) {
  //       silhouettes.push(silhouette);
  //     }
  //   }
  // });

  return silhouettes;
}

/**
 * Update silhouette based on new information
 * @param {Object} existingSilhouette - Current silhouette
 * @param {Object} newAwareness - New awareness data
 * @returns {Object} Updated silhouette
 */
export function updateSilhouette(existingSilhouette = {}, newAwareness = {}) {
  // TODO: Update silhouette with new information
  // Improve confidence, update position, etc.

  if (!existingSilhouette || !newAwareness) {
    return existingSilhouette;
  }

  // TODO: Merge new information
  // - Update position if more recent
  // - Increase confidence if better detection
  // - Update silhouette type if awareness level changed

  return {
    ...existingSilhouette,
    // Updated fields from newAwareness
  };
}

/**
 * Fade out old silhouettes
 * @param {Array} silhouettes - Array of silhouette objects
 * @param {number} fadeTime - Time in ms before silhouette fades completely
 * @returns {Array} Updated silhouettes with fade applied
 */
export function fadeSilhouettes(silhouettes = [], fadeTime = 30000) {
  // TODO: Apply fade to old silhouettes
  // Remove completely faded silhouettes

  const now = Date.now();

  return silhouettes
    .map((silhouette) => {
      if (!silhouette.lastSeen) {
        return null;
      }

      const timeSinceSeen = now - silhouette.lastSeen;
      const fadeAmount = Math.min(1.0, timeSinceSeen / fadeTime);

      return {
        ...silhouette,
        fadeAmount: fadeAmount,
        confidence: (silhouette.confidence || 0.5) * (1 - fadeAmount),
      };
    })
    .filter((silhouette) => {
      // Remove completely faded silhouettes
      return silhouette && silhouette.fadeAmount < 1.0;
    });
}

/**
 * Get silhouette rendering data for UI
 * @param {Object} silhouette - Silhouette object
 * @returns {Object} Rendering data (position, opacity, size, etc.)
 */
export function getSilhouetteRenderData(silhouette = {}) {
  // TODO: Convert silhouette to renderable data
  // Position, opacity, color, size, etc.

  if (!silhouette) {
    return null;
  }

  return {
    position: silhouette.position,
    opacity: 1 - (silhouette.fadeAmount || 0),
    size: silhouette.size || { width: 1, height: 1 },
    type: silhouette.type,
    color: getSilhouetteColor(silhouette.type),
  };
}

/**
 * Get color for silhouette type
 * @param {string} silhouetteType - Type of silhouette
 * @returns {string} Color hex code
 */
function getSilhouetteColor(silhouetteType) {
  const colors = {
    [SILHOUETTE_TYPES.EXACT]: "#ff0000", // Red - exact
    [SILHOUETTE_TYPES.RECENT]: "#ff8800", // Orange - recent
    [SILHOUETTE_TYPES.APPROXIMATE]: "#888888", // Gray - approximate
    [SILHOUETTE_TYPES.FADING]: "#444444", // Dark gray - fading
  };

  return colors[silhouetteType] || "#888888";
}

export default {
  SILHOUETTE_TYPES,
  createSilhouette,
  generateSilhouettes,
  updateSilhouette,
  fadeSilhouettes,
  getSilhouetteRenderData,
};

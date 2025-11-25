/**
 * Protection Circle System
 * Manages magical protection circles and their effects
 * Handles circle creation, activation, and effect application
 * 
 * TODO: Implement protection circle system
 */

/**
 * Protection circle types
 */
export const CIRCLE_TYPES = {
  PROTECTION_FROM_EVIL: "protection_from_evil",
  PROTECTION_FROM_GOOD: "protection_from_good",
  PROTECTION_FROM_MAGIC: "protection_from_magic",
  PROTECTION_FROM_PSIONICS: "protection_from_psionics",
  WARDING: "warding",
};

/**
 * Create a protection circle
 * @param {Object} creator - Character creating the circle
 * @param {string} circleType - Type of protection circle
 * @param {Object} position - Position {x, y} or {q, r}
 * @param {number} radius - Radius of circle
 * @returns {Object} Protection circle object
 */
export function createProtectionCircle(creator, circleType, position, radius = 1) {
  // TODO: Create protection circle with appropriate properties
  if (!creator || !circleType || !position) {
    return null;
  }

  return {
    id: `circle-${Date.now()}`,
    type: circleType,
    creator: creator.id || creator.name,
    position: position,
    radius: radius,
    active: true,
    createdAt: Date.now(),
    duration: getCircleDuration(circleType),
  };
}

/**
 * Get duration for protection circle type
 * @param {string} circleType - Type of circle
 * @returns {number} Duration in rounds or hours
 */
function getCircleDuration(circleType) {
  // TODO: Return appropriate duration based on circle type
  const durations = {
    [CIRCLE_TYPES.PROTECTION_FROM_EVIL]: 24, // hours
    [CIRCLE_TYPES.PROTECTION_FROM_GOOD]: 24,
    [CIRCLE_TYPES.PROTECTION_FROM_MAGIC]: 12,
    [CIRCLE_TYPES.PROTECTION_FROM_PSIONICS]: 12,
    [CIRCLE_TYPES.WARDING]: 48,
  };
  
  return durations[circleType] || 24;
}

/**
 * Check if a spell name or object is a protection circle spell
 * @param {string|Object} spell - Spell name or spell object
 * @returns {boolean} True if spell is a protection circle
 */
export function isProtectionCircle(spell) {
  if (!spell) return false;
  
  const spellName = typeof spell === "string" ? spell : (spell.name || "");
  const nameLower = spellName.toLowerCase();
  
  return (
    nameLower.includes("protection circle") ||
    nameLower.includes("circle of protection") ||
    nameLower.includes("ward") ||
    nameLower.includes("warding") ||
    Object.values(CIRCLE_TYPES).some(type => nameLower.includes(type.toLowerCase().replace(/_/g, " ")))
  );
}

/**
 * Check if position is within protection circle
 * @param {Object} position - Position to check
 * @param {Object} circle - Protection circle object
 * @returns {boolean} True if position is within circle
 */
export function isInProtectionCircle(position, circle) {
  // TODO: Check if position is within circle radius
  if (!position || !circle || !circle.active) {
    return false;
  }

  // TODO: Calculate distance from position to circle center
  // const distance = calculateDistance(position, circle.position);
  // return distance <= circle.radius;
  
  return false; // Placeholder
}

/**
 * Apply protection circle effects
 * @param {Object} entity - Entity to check
 * @param {Array} circles - Array of protection circles
 * @returns {Object} Protection effects applied
 */
export function applyProtectionEffects(entity, circles = []) {
  // TODO: Apply protection effects from overlapping circles
  const effects = {
    protectedFromEvil: false,
    protectedFromGood: false,
    protectedFromMagic: false,
    protectedFromPsionics: false,
    warded: false,
  };

  circles.forEach((circle) => {
    if (isInProtectionCircle(entity.position, circle)) {
      // TODO: Apply circle-specific effects
      // switch (circle.type) {
      //   case CIRCLE_TYPES.PROTECTION_FROM_EVIL:
      //     effects.protectedFromEvil = true;
      //     break;
      // }
    }
  });

  return effects;
}

/**
 * Process protection circles (check expiration, apply effects, etc.)
 * @param {Array} circles - Array of protection circles
 * @param {Array} combatants - Array of combatants to check
 * @param {Object} positions - Map of combatant positions
 * @param {number} currentRound - Current melee round
 * @param {Function} logCallback - Logging callback
 * @returns {Array} Updated array of active circles
 */
export function processProtectionCircles(circles = [], combatants = [], positions = {}, currentRound = 1, logCallback = () => {}) {
  if (!Array.isArray(circles)) {
    return [];
  }

  const activeCircles = [];
  const currentTime = Date.now();

  circles.forEach((circle) => {
    if (!circle || !circle.active) {
      return;
    }

    // Check if circle has expired
    if (circle.createdAt && circle.duration) {
      const elapsedHours = (currentTime - circle.createdAt) / (1000 * 60 * 60);
      if (elapsedHours >= circle.duration) {
        logCallback(
          `Protection circle (${circle.type || "unknown"}) has expired`,
          "circle"
        );
        return; // Skip expired circle
      }
    }

    // Check combatants within circle and apply effects
    combatants.forEach((combatant) => {
      if (!combatant) return;

      const combatantPosition = positions[combatant.id] || combatant.position;
      if (!combatantPosition) return;

      if (isInProtectionCircle(combatantPosition, circle)) {
        // Apply protection effects
        const effects = applyProtectionEffects(combatant, [circle]);
        
        // Update combatant with protection status
        if (!combatant.protectionEffects) {
          combatant.protectionEffects = {};
        }
        Object.assign(combatant.protectionEffects, effects);
      } else {
        // Remove protection if combatant left circle
        if (combatant.protectionEffects) {
          // Only remove if it was from this specific circle
          // This is simplified - in a full implementation, you'd track which circle provided which effect
        }
      }
    });

    activeCircles.push(circle);
  });

  return activeCircles;
}

export default {
  CIRCLE_TYPES,
  createProtectionCircle,
  isProtectionCircle,
  isInProtectionCircle,
  applyProtectionEffects,
  processProtectionCircles,
};


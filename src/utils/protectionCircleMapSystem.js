/**
 * Protection Circle Map System
 * Manages protection circles on the tactical map
 * Handles rendering, updates, and visual representation
 *
 * TODO: Implement protection circle map system
 */

/**
 * Add protection circle to map
 * @param {Object} map - Map object
 * @param {Object} circle - Protection circle object
 * @returns {Object} Updated map with circle added
 */
export function addCircleToMap(map, circle) {
  // TODO: Add protection circle to map data
  if (!map || !circle) return map;

  const updatedMap = {
    ...map,
    protectionCircles: [...(map.protectionCircles || []), circle],
  };

  return updatedMap;
}

/**
 * Remove protection circle from map
 * @param {Object} map - Map object
 * @param {string} circleId - ID of circle to remove
 * @returns {Object} Updated map with circle removed
 */
export function removeCircleFromMap(map, circleId) {
  // TODO: Remove protection circle from map
  if (!map || !circleId) return map;

  return {
    ...map,
    protectionCircles: (map.protectionCircles || []).filter(
      (circle) => circle.id !== circleId
    ),
  };
}

/**
 * Update protection circles (check expiration, etc.)
 * @param {Object} map - Map object
 * @param {number} currentTime - Current game time
 * @returns {Object} Updated map with expired circles removed
 */
export function updateProtectionCircles(map, currentTime = Date.now()) {
  // TODO: Update circles, remove expired ones
  if (!map) return map;

  const circles = (map.protectionCircles || []).filter((circle) => {
    if (!circle.active) return false;

    // TODO: Check if circle has expired
    // const elapsed = currentTime - circle.createdAt;
    // const durationMs = circle.duration * 3600000; // Convert hours to ms
    // return elapsed < durationMs;

    return true; // Placeholder
  });

  return {
    ...map,
    protectionCircles: circles,
  };
}

/**
 * Get protection circles at position
 * @param {Object} map - Map object
 * @param {Object} position - Position to check
 * @returns {Array} Array of protection circles at position
 */
export function getCirclesAtPosition(map, position) {
  // TODO: Find all circles that contain this position
  if (!map || !position) return [];

  return (map.protectionCircles || []).filter((circle) => {
    // TODO: Check if position is within circle
    // return isInProtectionCircle(position, circle);
    return false; // Placeholder
  });
}

/**
 * Get circle render data for map rendering
 * @param {Object} map - Map object
 * @param {Object} options - Rendering options {scale, offset}
 * @returns {Array} Array of circle render data objects
 */
export function getCircleRenderData(map, options = {}) {
  const { scale = 1, offset = { x: 0, y: 0 } } = options;

  if (!map || !map.protectionCircles) return [];

  return map.protectionCircles
    .filter((circle) => circle && circle.active)
    .map((circle) => ({
      id: circle.id,
      position: {
        x: (circle.position?.x || 0) * scale + offset.x,
        y: (circle.position?.y || 0) * scale + offset.y,
      },
      radius: (circle.radius || 5) * scale,
      type: circle.type || "protection",
      color: circle.color || "#4A90E2",
      opacity: circle.opacity || 0.3,
    }));
}

/**
 * Update protection circles on map (with combatant and position awareness)
 * @param {Object} options - Options {circles, combatants, positions, log}
 * @returns {Array} Updated array of active circles
 */
export function updateProtectionCirclesOnMap(options = {}) {
  const { circles = [], combatants = [], positions = {}, log = () => {} } = options;
  
  // Filter out expired circles
  const activeCircles = circles.filter(circle => {
    if (!circle || !circle.active) return false;
    
    // TODO: Check expiration based on duration and createdAt
    // For now, just return active circles
    return true;
  });
  
  // TODO: Check combatant entry/exit from circles and apply effects
  // TODO: Log circle effects when combatants enter/exit
  
  return activeCircles;
}

/**
 * Check if a combatant enters or exits a protection circle
 * @param {Object} combatant - Combatant object
 * @param {Object} oldPosition - Previous position {x, y} or {q, r}
 * @param {Object} newPosition - New position {x, y} or {q, r}
 * @param {Array} circles - Array of protection circles
 * @param {Function} log - Logging function
 * @returns {Object} Result with entered/exited circles
 */
export function checkCircleEntryExit(combatant, oldPosition, newPosition, circles = [], log = () => {}) {
  if (!combatant || !oldPosition || !newPosition || !Array.isArray(circles)) {
    return { entered: [], exited: [] };
  }

  const entered = [];
  const exited = [];

  circles.forEach((circle) => {
    if (!circle || !circle.active) return;

    const wasInOld = isPositionInCircle(oldPosition, circle);
    const isInNew = isPositionInCircle(newPosition, circle);

    if (!wasInOld && isInNew) {
      // Entered circle
      entered.push(circle);
      log(`${combatant.name || "Combatant"} entered ${circle.type || "protection"} circle`, "circle");
    } else if (wasInOld && !isInNew) {
      // Exited circle
      exited.push(circle);
      log(`${combatant.name || "Combatant"} exited ${circle.type || "protection"} circle`, "circle");
    }
  });

  return { entered, exited };
}

/**
 * Check if movement is blocked by a protection circle
 * @param {Object} fromPosition - Starting position {x, y} or {q, r}
 * @param {Object} toPosition - Destination position {x, y} or {q, r}
 * @param {Array} circles - Array of protection circles
 * @param {Object} combatant - Combatant attempting to move (optional)
 * @returns {Object} Result with blocked boolean and reason string
 */
export function checkMovementBlockedByCircle(fromPosition, toPosition, circles = [], combatant = null) {
  if (!fromPosition || !toPosition || !Array.isArray(circles)) {
    return { blocked: false, reason: "" };
  }

  // Check if destination is blocked by any circle
  for (const circle of circles) {
    if (!circle || !circle.active) continue;

    // Some circles block entry (e.g., enemy protection circles)
    if (circle.blocksEntry && isPositionInCircle(toPosition, circle)) {
      // Check if combatant is allowed (e.g., caster of the circle)
      if (combatant && circle.casterId === combatant.id) {
        // Caster can enter their own circle
        continue;
      }

      const circleType = circle.type || "protection";
      const reason = `Movement blocked by ${circleType} circle`;
      return { blocked: true, reason };
    }
  }

  return { blocked: false, reason: "" };
}

/**
 * Helper function to check if a position is within a circle
 * @param {Object} position - Position {x, y} or {q, r}
 * @param {Object} circle - Protection circle object
 * @returns {boolean} True if position is within circle
 */
function isPositionInCircle(position, circle) {
  if (!position || !circle || !circle.position) return false;

  const circlePos = circle.position;
  const radius = circle.radius || 5;

  // Handle both cartesian (x, y) and hex (q, r) coordinates
  if (typeof position.x === 'number' && typeof position.y === 'number') {
    // Cartesian coordinates
    const dx = position.x - (circlePos.x || 0);
    const dy = position.y - (circlePos.y || 0);
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= radius;
  } else if (typeof position.q === 'number' && typeof position.r === 'number') {
    // Hex coordinates - convert to distance
    const dq = position.q - (circlePos.q || 0);
    const dr = position.r - (circlePos.r || 0);
    // Hex distance formula
    const distance = (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
    return distance <= radius;
  }

  return false;
}

export default {
  addCircleToMap,
  removeCircleFromMap,
  updateProtectionCircles,
  updateProtectionCirclesOnMap,
  getCirclesAtPosition,
  checkCircleEntryExit,
  checkMovementBlockedByCircle,
};

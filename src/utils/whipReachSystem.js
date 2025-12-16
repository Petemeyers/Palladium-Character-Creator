/**
 * Fire Whip Reach System
 * 
 * Implements 3D reach calculation for flexible weapons like the Baal-Rog Fire Whip.
 * Based on Palladium Fantasy RPG 2nd Edition (1994) - 15ft reach with 3D space calculation.
 */

/**
 * Calculate 3D distance between two points (horizontal + vertical)
 * Uses true distance: sqrt(horizontal² + vertical²)
 * 
 * @param {Object} attackerPos - Attacker position {x, y}
 * @param {Object} targetPos - Target position {x, y}
 * @param {number} attackerAltitude - Attacker altitude in feet
 * @param {number} targetAltitude - Target altitude in feet
 * @returns {number} Effective 3D distance in feet
 */
export function calculate3DDistance(attackerPos, targetPos, attackerAltitude = 0, targetAltitude = 0) {
  if (!attackerPos || !targetPos) return Infinity;
  
  // Calculate horizontal distance
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;
  const horizontalFt = Math.sqrt(dx * dx + dy * dy) * 5.5; // Convert hexes to feet (5.5ft per hex)
  
  // Calculate vertical separation
  const verticalFt = Math.abs(targetAltitude - attackerAltitude);
  
  // Calculate 3D distance
  const effectiveDistance = Math.sqrt(horizontalFt ** 2 + verticalFt ** 2);
  
  return effectiveDistance;
}

/**
 * Simplified Palladium-style reach check
 * Uses separate horizontal and vertical limits (GM-friendly)
 * 
 * @param {Object} attackerPos - Attacker position
 * @param {Object} targetPos - Target position
 * @param {number} attackerAltitude - Attacker altitude
 * @param {number} targetAltitude - Target altitude
 * @param {number} maxReachFt - Maximum reach in feet (default 15 for Fire Whip)
 * @returns {boolean} True if target is within reach
 */
export function isWithinWhipReach(attackerPos, targetPos, attackerAltitude = 0, targetAltitude = 0, maxReachFt = 15) {
  if (!attackerPos || !targetPos) return false;
  
  // Calculate horizontal distance
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;
  const horizontalFt = Math.sqrt(dx * dx + dy * dy) * 5.5;
  
  // Calculate vertical separation
  const verticalFt = Math.abs(targetAltitude - attackerAltitude);
  
  // Simplified check: both horizontal AND vertical must be within reach
  // This matches Palladium's "reach weapon in 3D space" intent
  return horizontalFt <= maxReachFt && verticalFt <= maxReachFt;
}

/**
 * Check if a weapon is a flexible reach weapon (like Fire Whip)
 * 
 * @param {Object} weapon - Weapon object
 * @returns {boolean} True if weapon is flexible with extended reach
 */
export function isFlexibleReachWeapon(weapon) {
  if (!weapon) return false;
  
  const weaponName = (weapon.name || "").toLowerCase();
  const isWhip = weaponName.includes("whip") || weaponName.includes("fire whip");
  const hasReach = (weapon.reach && weapon.reach > 5) || (weapon.lengthFt && weapon.lengthFt > 5);
  const isFlexible = weapon.weaponType === "flexible" || 
                     weapon.properties?.flexible === true ||
                     weapon.properties?.entangleCapable === true;
  
  return (isWhip || (hasReach && isFlexible));
}

/**
 * Validate if target is within reach for a flexible weapon
 * Uses 3D distance calculation for accurate reach validation
 * 
 * @param {Object} attacker - Attacking fighter
 * @param {Object} target - Target fighter
 * @param {Object} weapon - Weapon being used
 * @param {Object} attackerPos - Attacker position
 * @param {Object} targetPos - Target position
 * @returns {Object} Validation result { withinReach, effectiveDistance, horizontalFt, verticalFt, reason }
 */
export function validateFlexibleWeaponReach(attacker, target, weapon, attackerPos, targetPos) {
  if (!attacker || !target || !weapon || !attackerPos || !targetPos) {
    return {
      withinReach: false,
      effectiveDistance: Infinity,
      horizontalFt: Infinity,
      verticalFt: Infinity,
      reason: "Missing required parameters"
    };
  }
  
  // Get weapon reach
  const maxReachFt = weapon.reach || weapon.lengthFt || 15;
  
  // Get altitudes
  const attackerAltitude = attacker.altitude || attacker.altitudeFeet || 0;
  const targetAltitude = target.altitude || target.altitudeFeet || 0;
  
  // Calculate distances
  const horizontalFt = Math.sqrt(
    Math.pow((targetPos.x - attackerPos.x) * 5.5, 2) + 
    Math.pow((targetPos.y - attackerPos.y) * 5.5, 2)
  );
  const verticalFt = Math.abs(targetAltitude - attackerAltitude);
  const effectiveDistance = calculate3DDistance(attackerPos, targetPos, attackerAltitude, targetAltitude);
  
  // Check if within reach (using simplified Palladium-style check)
  const withinReach = horizontalFt <= maxReachFt && verticalFt <= maxReachFt;
  
  let reason;
  if (withinReach) {
    reason = `Within whip reach (${Math.round(horizontalFt)}ft horizontal, ${Math.round(verticalFt)}ft vertical, ${Math.round(effectiveDistance)}ft effective)`;
  } else {
    if (horizontalFt > maxReachFt && verticalFt > maxReachFt) {
      reason = `Out of whip reach (${Math.round(horizontalFt)}ft horizontal > ${maxReachFt}ft, ${Math.round(verticalFt)}ft vertical > ${maxReachFt}ft)`;
    } else if (horizontalFt > maxReachFt) {
      reason = `Out of whip reach (${Math.round(horizontalFt)}ft horizontal > ${maxReachFt}ft)`;
    } else {
      reason = `Out of whip reach (${Math.round(verticalFt)}ft vertical > ${maxReachFt}ft)`;
    }
  }
  
  return {
    withinReach,
    effectiveDistance: Math.round(effectiveDistance),
    horizontalFt: Math.round(horizontalFt),
    verticalFt: Math.round(verticalFt),
    reason
  };
}


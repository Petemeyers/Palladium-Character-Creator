/**
 * Bleeding System
 * 
 * Handles bleeding status and Stop Bleeding psionic power logic.
 * Prevents spam by enforcing "one attempt per round per target" rule.
 */

/**
 * Check if a fighter is currently bleeding
 * @param {Object} fighter - Fighter object
 * @returns {boolean} True if fighter is bleeding
 */
export function isBleeding(fighter) {
  if (!fighter) return false;
  
  // Check statusEffects array
  if (Array.isArray(fighter.statusEffects)) {
    return fighter.statusEffects.includes("BLEEDING");
  }
  
  // Check conditions object
  if (fighter.conditions?.bleeding) {
    return true;
  }
  
  // Check activeEffects array
  if (Array.isArray(fighter.activeEffects)) {
    return fighter.activeEffects.some(
      effect => effect.type === "BLEEDING" && !effect.expired
    );
  }
  
  return false;
}

/**
 * Mark that bleeding has been stopped for a target
 * @param {Object} target - Target fighter object (will be mutated)
 * @param {number} round - Current combat round
 * @returns {Object} Updated target fighter
 */
export function markBleedingStopped(target, round) {
  if (!target) return target;
  
  // Remove BLEEDING flag from statusEffects
  if (Array.isArray(target.statusEffects)) {
    target.statusEffects = target.statusEffects.filter(s => s !== "BLEEDING");
    // Add STABILIZED status to prevent re-casting
    if (!target.statusEffects.includes("STABILIZED")) {
      target.statusEffects.push("STABILIZED");
    }
  } else {
    target.statusEffects = ["STABILIZED"];
  }
  
  // Remove from conditions
  if (target.conditions) {
    target.conditions = { ...target.conditions };
    delete target.conditions.bleeding;
  }
  
  // Remove from activeEffects
  if (Array.isArray(target.activeEffects)) {
    target.activeEffects = target.activeEffects.map(effect => {
      if (effect.type === "BLEEDING") {
        return { ...effect, expired: true };
      }
      return effect;
    });
  }
  
  // Mark that we've already used Stop Bleeding on them this round
  target.meta = {
    ...(target.meta || {}),
    lastStopBleedingRound: round,
    stabilizedByPsionics: true,
  };
  
  // Clear isBleeding flag if it exists
  target.isBleeding = false;
  
  return target;
}

/**
 * Check if Stop Bleeding can be attempted on a target this round
 * @param {Object} caster - Caster fighter object
 * @param {Object} target - Target fighter object
 * @param {Object} combatState - Combat state object with currentRound or meleeRound
 * @returns {Object} { ok: boolean, reason?: string, round?: number }
 */
export function canAttemptStopBleeding(caster, target, combatState) {
  if (!caster || !target) {
    return { ok: false, reason: "invalid_target" };
  }
  
  const round = combatState?.currentRound ?? combatState?.meleeRound ?? 1;
  
  // Check if target is already stabilized
  if (target.statusEffects?.includes("STABILIZED") || target.meta?.stabilizedByPsionics) {
    return { ok: false, reason: "already_stabilized" };
  }
  
  // Check if target is bleeding
  if (!isBleeding(target)) {
    return { ok: false, reason: "not_bleeding" };
  }
  
  // Check if we've already attempted Stop Bleeding on this target this round
  const lastRound = target.meta?.lastStopBleedingRound ?? -1;
  if (lastRound >= round) {
    return { ok: false, reason: "already_attempted_this_round" };
  }
  
  // ISP gate - Stop Bleeding costs 2 ISP
  const cost = 2;
  const currentISP = caster.currentISP ?? caster.ISP ?? caster.isp ?? 0;
  if (currentISP < cost) {
    return { ok: false, reason: "insufficient_isp" };
  }
  
  return { ok: true, round };
}


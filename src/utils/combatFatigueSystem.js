/**
 * Palladium Fantasy RPG - Combat Fatigue System
 *
 * Comprehensive stamina-based fatigue tracking for combat encounters.
 * Based on P.E. (Physical Endurance) attribute and action types.
 *
 * Key Rules:
 * - Base Stamina = P.E. × 2 (melee rounds before fatigue)
 * - Different actions drain different amounts of stamina
 * - When stamina ≤ 0, fatigue penalties apply
 * - Recovery through rest, sleep, or magical healing
 */

/**
 * Action types and their stamina costs per melee round
 */
export const STAMINA_COSTS = {
  LIGHT_MOVEMENT: 0.5, // Guard stance, cautious movement
  NORMAL_COMBAT: 1.0, // Standard sword/shield/brawling
  GRAPPLING: 2.0, // Wrestling, clinch, ground fighting
  SPRINTING: 1.5, // Sprinting, charging, repeated dodging
  SPELLCASTING: 1.0, // Casting spells under duress
  MOUNTED_COMBAT: 0.5, // Reduced strain if experienced rider
  // New: flying movement
  FLY_HOVER: 0.5, // Slow circling / gliding (your "menace" behavior)
  FLY_CRUISE: 1.0, // Normal sustained flight
  FLY_SPRINT: 1.5, // Fast climb / dive / high-speed reposition
};

/**
 * Encumbrance modifiers (stacks with action costs)
 */
export const ENCUMBRANCE_MODIFIERS = {
  HEAVY_ARMOR: 0.5, // +0.5 SP per round if wearing >40 lbs armor
  OVERLOADED: 0.5, // +0.5 SP per round if carrying >60 lbs
};

/**
 * Fatigue penalty levels (when stamina ≤ 0)
 */
export const FATIGUE_LEVELS = {
  MINOR: {
    threshold: -5,
    penalty: { strike: -1, parry: -1, dodge: -1, ps: 0 },
    description: "Breathing heavy, minor fatigue",
  },
  MODERATE: {
    threshold: -10,
    penalty: { strike: -2, parry: -2, dodge: -2, ps: -2 },
    description: "Sluggish, sweating, armor feels heavy",
  },
  SEVERE: {
    threshold: -15,
    penalty: { strike: -3, parry: -3, dodge: -3, speed: 0.5 },
    description: "Muscle strain, reduced awareness, speed halved",
  },
  COLLAPSE: {
    threshold: -16,
    penalty: {
      strike: -4,
      parry: -4,
      dodge: -4,
      speed: 0,
      collapseCheck: true,
    },
    description: "Risk of collapse from exhaustion",
  },
};

/**
 * Recovery rates per melee round
 */
export const RECOVERY_RATES = {
  LIGHT_REST: 1.0, // Pause, guard stance, leaning (no active fighting)
  FULL_REST: 2.0, // Sit, eat, breathe deeply (no attacks, no dodges)
  SLEEP: null, // Full SP restoration per hour (handled separately)
  MAGICAL_HEALING: null, // +1d6 SP from divine aid (handled separately)
};

/**
 * Initialize combat fatigue state for a character
 * @param {Object} character - Character object with attributes
 * @returns {Object} Fatigue state object
 */
export function initializeCombatFatigue(character) {
  // Get P.E. from various possible locations
  const PE =
    character.PE ||
    character.pe ||
    character.attributes?.PE ||
    character.attributes?.pe ||
    character.stats?.PE ||
    character.stats?.pe ||
    10; // Default to 10 if not found

  const baseStamina = PE * 2;

  return {
    maxStamina: baseStamina,
    currentStamina: baseStamina,
    fatigueLevel: 0, // Current fatigue level (0 = none)
    penalties: {
      // Current penalties applied
      strike: 0,
      parry: 0,
      dodge: 0,
      ps: 0, // Physical Strength penalty
      speed: 1.0, // Speed multiplier (1.0 = normal, 0.5 = halved)
    },
    status: "ready", // ready, fatigued, exhausted, collapse_risk, collapsed
    lastActionType: null, // Track last action for UI feedback
    totalRoundsActive: 0, // Total melee rounds spent in combat
    collapseRoundsRemaining: 0, // Melees remaining unconscious from collapse
  };
}

/**
 * Get stamina cost for an action type
 * @param {string} actionType - Type of action (from STAMINA_COSTS)
 * @param {Object} character - Character object (for encumbrance check)
 * @returns {number} Stamina cost per melee round
 */
export function getStaminaCost(actionType, character = {}) {
  let cost;

  // Allow passing a numeric cost directly (backwards compatible)
  if (typeof actionType === "number") {
    cost = actionType;
  } else {
    cost = STAMINA_COSTS[actionType] ?? STAMINA_COSTS.NORMAL_COMBAT;
  }

  // Add encumbrance modifiers
  const armorWeight =
    character.equippedArmor?.weight ||
    character.armor?.weight ||
    character.equipped?.armor?.weight ||
    0;

  const totalWeight =
    character.totalWeight ||
    character.carryWeight?.currentWeight ||
    armorWeight ||
    0;

  if (armorWeight > 40) {
    cost += ENCUMBRANCE_MODIFIERS.HEAVY_ARMOR;
  }

  if (totalWeight > 60) {
    cost += ENCUMBRANCE_MODIFIERS.OVERLOADED;
  }

  // Men of Arms classes ignore heavy armor fatigue penalty
  const occ = character.OCC || character.occ || "";
  if (occ && typeof occ === "string") {
    const menOfArmsClasses = [
      "Knight",
      "Paladin",
      "Soldier",
      "Mercenary",
      "Men-at-Arms",
    ];
    if (menOfArmsClasses.some((cls) => occ.includes(cls))) {
      // Reduce armor penalty by 0.5 (effectively canceling it)
      if (armorWeight > 40) {
        cost -= 0.25; // Partial reduction (they're trained but still feel it)
      }
    }
  }

  return cost;
}

/**
 * Drain stamina based on action type
 * @param {Object} character - Character object with fatigueState
 * @param {string} actionType - Type of action performed
 * @param {number} rounds - Number of melee rounds (default 1)
 * @returns {Object} Updated fatigue state
 */
export function drainStamina(character, actionType, rounds = 1) {
  if (!character.fatigueState) {
    character.fatigueState = initializeCombatFatigue(character);
  }

  const state = character.fatigueState;
  const cost = getStaminaCost(actionType, character) * rounds;

  state.currentStamina -= cost;
  state.lastActionType = actionType;
  state.totalRoundsActive += rounds;

  // Update fatigue level and penalties
  updateFatiguePenalties(character);

  return state;
}

/**
 * Resolve collapse-from-exhaustion check when in collapse_risk band.
 *
 * @param {Object} fighter - The fighter/character object.
 * @param {number} staminaOverride - Optional current stamina value; if omitted,
 *   uses fighter.fatigueState.currentStamina.
 * @returns {{collapsed: boolean, roll: number, target: number, durationMelees: number, newStamina: number}}
 */
export function resolveCollapseFromExhaustion(fighter, staminaOverride) {
  if (!fighter) {
    return {
      collapsed: false,
      roll: 0,
      target: 0,
      durationMelees: 0,
      newStamina: 0,
    };
  }

  const fatigueState = fighter.fatigueState || initializeCombatFatigue(fighter);

  // 1) Figure out current stamina
  const stamina =
    typeof staminaOverride === "number"
      ? staminaOverride
      : fatigueState.currentStamina ?? 0;

  // 2) Get base P.E. (same pattern you already use elsewhere)
  const basePE =
    fighter.PE ||
    fighter.pe ||
    fighter.attributes?.PE ||
    fighter.attributes?.pe ||
    fighter.stats?.PE ||
    fighter.stats?.pe ||
    10;

  // 3) Exhaustion penalty based on how far below zero we are
  //    (keeps things simple and uses your existing bands)
  let exhaustionPenalty = 0;
  if (stamina <= FATIGUE_LEVELS.MINOR.threshold) {
    exhaustionPenalty = 0; // just crossed into negative
  }
  if (stamina <= FATIGUE_LEVELS.MODERATE.threshold) {
    exhaustionPenalty = -1;
  }
  if (stamina <= FATIGUE_LEVELS.SEVERE.threshold) {
    exhaustionPenalty = -2;
  }
  if (stamina <= FATIGUE_LEVELS.COLLAPSE.threshold) {
    exhaustionPenalty = -3;
  }

  const effectivePE = Math.max(1, basePE + exhaustionPenalty);

  // 4) Roll the collapse check — classic "roll under P.E." style
  const roll = Math.floor(Math.random() * 20) + 1; // 1d20
  const target = effectivePE;

  // Default values if the fighter manages to stay up
  let collapsed = false;
  let durationMelees = 0;
  let newStamina = stamina;

  // 5) Resolve result
  if (roll > target) {
    // FAIL = collapse from exhaustion
    collapsed = true;

    // 1d4 melees unconscious from exhaustion
    durationMelees = Math.floor(Math.random() * 4) + 1;

    // Optional: bump stamina up to a safer floor so they don't sit at -30 forever
    // Use your own taste here; this keeps them in "severe" territory.
    const collapseFloor = FATIGUE_LEVELS.SEVERE.threshold; // e.g. -15
    newStamina = Math.max(stamina, collapseFloor);
  } else {
    // SUCCESS = they stay on their feet, but still exhausted and miserable
    collapsed = false;
    durationMelees = 0;
    newStamina = stamina; // unchanged; they're just grit-and-bear-it
  }

  return {
    collapsed,
    roll,
    target,
    durationMelees,
    newStamina,
  };
}

/**
 * Update fatigue penalties based on current stamina
 * @param {Object} character - Character object with fatigueState
 */
export function updateFatiguePenalties(character) {
  if (!character.fatigueState) {
    return;
  }

  const state = character.fatigueState;
  const stamina = state.currentStamina;

  // Don't update status if already collapsed (let the turn-start effect handle recovery)
  if (state.status === "collapsed") {
    return;
  }

  // Reset penalties
  state.penalties = {
    strike: 0,
    parry: 0,
    dodge: 0,
    ps: 0,
    speed: 1.0,
  };
  state.fatigueLevel = 0;
  state.status = "ready";

  // Apply penalties if stamina is below zero
  if (stamina <= 0) {
    const fatigueAmount = Math.abs(stamina);

    if (fatigueAmount <= Math.abs(FATIGUE_LEVELS.MINOR.threshold)) {
      // Minor fatigue (-1 to -5 SP)
      state.penalties = { ...FATIGUE_LEVELS.MINOR.penalty };
      state.penalties.speed = 1.0;
      state.fatigueLevel = 1;
      state.status = "fatigued";
    } else if (fatigueAmount <= Math.abs(FATIGUE_LEVELS.MODERATE.threshold)) {
      // Moderate fatigue (-6 to -10 SP)
      state.penalties = { ...FATIGUE_LEVELS.MODERATE.penalty };
      state.penalties.speed = 1.0;
      state.fatigueLevel = 2;
      state.status = "fatigued";
    } else if (fatigueAmount <= Math.abs(FATIGUE_LEVELS.SEVERE.threshold)) {
      // Severe fatigue (-11 to -15 SP)
      state.penalties = { ...FATIGUE_LEVELS.SEVERE.penalty };
      state.penalties.speed = 0.5; // Speed halved
      state.fatigueLevel = 3;
      state.status = "exhausted";
    } else {
      // Collapse risk (-16+ SP)
      // Note: Actual collapse check happens at start of turn via resolveCollapseFromExhaustion
      state.penalties = { ...FATIGUE_LEVELS.COLLAPSE.penalty };
      state.penalties.speed = 0;
      state.fatigueLevel = 4;
      state.status = "collapse_risk";
    }
  }
}

/**
 * Recover stamina through rest
 * @param {Object} character - Character object with fatigueState
 * @param {string} restType - Type of rest (LIGHT_REST, FULL_REST)
 * @param {number} rounds - Number of melee rounds resting
 * @returns {Object} Updated fatigue state
 */
export function recoverStamina(character, restType = "LIGHT_REST", rounds = 1) {
  if (!character.fatigueState) {
    character.fatigueState = initializeCombatFatigue(character);
  }

  const state = character.fatigueState;
  const recoveryRate = RECOVERY_RATES[restType] || RECOVERY_RATES.LIGHT_REST;
  const recoveryAmount = recoveryRate * rounds;

  state.currentStamina = Math.min(
    state.maxStamina,
    state.currentStamina + recoveryAmount
  );

  // Update penalties if stamina recovered above zero
  updateFatiguePenalties(character);

  return state;
}

/**
 * Magical/clerical healing restores stamina
 * @param {Object} character - Character object with fatigueState
 * @param {number} amount - Amount of stamina to restore (default 1d6)
 * @returns {Object} Updated fatigue state
 */
export function magicalStaminaRecovery(character, amount = null) {
  if (!character.fatigueState) {
    character.fatigueState = initializeCombatFatigue(character);
  }

  const state = character.fatigueState;

  // Roll 1d6 if amount not specified
  if (amount === null) {
    amount = Math.floor(Math.random() * 6) + 1;
  }

  state.currentStamina = Math.min(
    state.maxStamina,
    state.currentStamina + amount
  );

  updateFatiguePenalties(character);

  return { state, recovered: amount };
}

/**
 * Short rest recovery (between combat)
 * After combat, if the party sits/leans and does nothing strenuous:
 * - Each minute = 4 melee rounds
 * - With FULL_REST = 2 SP per round, that's 8 SP per minute
 * - Most characters go from "totally empty" to "full" in about 3-5 minutes
 * 
 * @param {Object} character - Character object with fatigueState
 * @param {number} minutes - Number of minutes resting (default 5 for full recovery)
 * @returns {Object} Updated fatigue state and recovery info
 */
export function shortRestRecovery(character, minutes = 5) {
  if (!character.fatigueState) {
    character.fatigueState = initializeCombatFatigue(character);
  }

  const state = character.fatigueState;
  
  // Each minute = 4 melee rounds, FULL_REST = 2 SP per round = 8 SP per minute
  const roundsPerMinute = 4;
  const totalRounds = minutes * roundsPerMinute;
  const recoveryPerRound = RECOVERY_RATES.FULL_REST; // 2.0 SP per round
  const totalRecovery = totalRounds * recoveryPerRound;

  const oldStamina = state.currentStamina;
  state.currentStamina = Math.min(
    state.maxStamina,
    state.currentStamina + totalRecovery
  );
  
  const actualRecovery = state.currentStamina - oldStamina;

  // Update penalties
  updateFatiguePenalties(character);

  return { 
    state, 
    recovered: actualRecovery,
    minutes,
    rounds: totalRounds,
    isFullRecovery: state.currentStamina >= state.maxStamina
  };
}

/**
 * Sleep recovery (overnight rest)
 * At the end of each continuous hour of sleep, stamina is fully restored.
 * 
 * @param {Object} character - Character object with fatigueState
 * @param {number} hours - Number of hours slept (default 1, minimum 1 for full recovery)
 * @returns {Object} Updated fatigue state
 */
export function sleepRecovery(character, hours = 1) {
  if (!character.fatigueState) {
    character.fatigueState = initializeCombatFatigue(character);
  }

  const state = character.fatigueState;
  const oldStamina = state.currentStamina;

  // Sleep = full stamina restoration after 1 hour
  if (hours >= 1) {
    state.currentStamina = state.maxStamina;
  } else {
    // Partial sleep: recover proportionally (though typically you'd sleep at least 1 hour)
    const recoveryPercent = Math.min(1, hours);
    const recoveryAmount = (state.maxStamina - state.currentStamina) * recoveryPercent;
    state.currentStamina = Math.min(
      state.maxStamina,
      state.currentStamina + recoveryAmount
    );
  }

  // Reset all fatigue state
  state.fatigueLevel = 0;
  state.penalties = {
    strike: 0,
    parry: 0,
    dodge: 0,
    ps: 0,
    speed: 1.0,
  };
  state.status = "ready";
  state.totalRoundsActive = 0;
  state.lastActionType = null;
  state.collapseRoundsRemaining = 0;

  updateFatiguePenalties(character);

  return { 
    state, 
    recovered: state.currentStamina - oldStamina,
    hours,
    isFullRecovery: state.currentStamina >= state.maxStamina
  };
}

/**
 * Apply post-combat recovery to all fighters in a party
 * This is a convenience function that applies short rest recovery to all fighters
 * 
 * @param {Array} fighters - Array of fighter objects
 * @param {number} minutes - Number of minutes resting (default 5 for full recovery)
 * @param {Function} logCallback - Optional callback to log recovery messages
 * @returns {Array} Updated fighters array
 */
export function applyPostCombatRecovery(fighters, minutes = 5, logCallback = null) {
  if (!Array.isArray(fighters)) {
    return fighters;
  }

  return fighters.map(fighter => {
    if (!fighter || !fighter.fatigueState) {
      return fighter;
    }

    const result = shortRestRecovery(fighter, minutes);
    
    if (logCallback && typeof logCallback === 'function') {
      if (result.isFullRecovery) {
        logCallback(`💪 ${fighter.name} fully recovered stamina after ${minutes} minutes of rest.`, "info");
      } else {
        logCallback(`💪 ${fighter.name} recovered ${result.recovered.toFixed(1)} stamina (${fighter.fatigueState.currentStamina.toFixed(1)}/${fighter.fatigueState.maxStamina} SP) after ${minutes} minutes of rest.`, "info");
      }
    }

    return fighter;
  });
}

/**
 * Apply fatigue penalties to character's combat bonuses
 * @param {Object} character - Character object with fatigueState
 * @returns {Object} Modified character with penalties applied
 */
export function applyFatiguePenalties(character) {
  if (!character.fatigueState || character.fatigueState.status === "ready") {
    return character;
  }

  const penalties = character.fatigueState.penalties;
  const modified = { ...character };

  // Apply penalties to bonuses
  if (character.bonuses) {
    modified.bonuses = {
      ...character.bonuses,
      strike: (character.bonuses.strike || 0) + penalties.strike,
      parry: (character.bonuses.parry || 0) + penalties.parry,
      dodge: (character.bonuses.dodge || 0) + penalties.dodge,
    };
  } else {
    modified.bonuses = {
      strike: penalties.strike,
      parry: penalties.parry,
      dodge: penalties.dodge,
    };
  }

  // Apply speed modifier
  if (penalties.speed !== 1.0 && character.Spd) {
    modified.Spd = Math.floor(character.Spd * penalties.speed);
  }

  // Apply PS penalty
  if (penalties.ps !== 0 && character.PS) {
    modified.PS = Math.max(1, character.PS + penalties.ps);
  }

  // Cannot act if collapsed
  if (character.fatigueState.status === "collapsed") {
    modified.canAct = false;
  }

  return modified;
}

/**
 * Get fatigue status description for UI
 * @param {Object} character - Character object with fatigueState
 * @returns {Object} Status object with description, color, and penalties
 */
export function getFatigueStatus(character) {
  if (!character.fatigueState) {
    return {
      status: "ready",
      description: "Fresh",
      color: "green",
      stamina: null,
      maxStamina: null,
      penalties: {},
    };
  }

  const state = character.fatigueState;
  const staminaPercent = (state.currentStamina / state.maxStamina) * 100;

  let color = "green";
  let description = "Fresh";

  if (state.status === "ready") {
    color =
      staminaPercent > 75 ? "green" : staminaPercent > 50 ? "yellow" : "orange";
    description =
      staminaPercent > 75 ? "Fresh" : staminaPercent > 50 ? "Alert" : "Tiring";
  } else if (state.status === "fatigued") {
    color = "yellow";
    description = `Fatigued (${
      state.fatigueLevel === 1 ? "Minor" : "Moderate"
    })`;
  } else if (state.status === "exhausted") {
    color = "orange";
    description = "Exhausted";
  } else if (state.status === "collapse_risk") {
    color = "red";
    description = "Risk of Collapse";
  } else if (state.status === "collapsed") {
    color = "red";
    description = "Collapsed";
  }

  return {
    status: state.status,
    description,
    color,
    stamina: Math.round(state.currentStamina * 10) / 10,
    maxStamina: state.maxStamina,
    staminaPercent: Math.round(staminaPercent),
    penalties: { ...state.penalties },
    fatigueLevel: state.fatigueLevel,
    totalRoundsActive: state.totalRoundsActive,
  };
}

/**
 * Check if character can perform an action based on fatigue
 * @param {Object} character - Character object with fatigueState
 * @param {string} actionType - Type of action to check
 * @returns {Object} { canPerform: boolean, reason: string }
 */
export function canPerformAction(character, actionType) {
  if (!character.fatigueState) {
    return { canPerform: true, reason: "" };
  }

  const state = character.fatigueState;

  if (state.status === "collapsed") {
    return {
      canPerform: false,
      reason: "Character has collapsed from exhaustion and cannot act.",
    };
  }

  if (state.status === "collapse_risk" && actionType === "GRAPPLING") {
    return {
      canPerform: false,
      reason: "Too exhausted for grappling. Risk of collapse.",
    };
  }

  // Check if stamina is sufficient for action
  const cost = getStaminaCost(actionType, character);
  if (state.currentStamina - cost < -20) {
    return {
      canPerform: false,
      reason: "Insufficient stamina. Character must rest.",
    };
  }

  return { canPerform: true, reason: "" };
}

/**
 * Reset fatigue state (start of new combat or after full rest)
 * @param {Object} character - Character object with fatigueState
 */
export function resetFatigue(character) {
  if (character.fatigueState) {
    const PE =
      character.PE ||
      character.pe ||
      character.attributes?.PE ||
      character.attributes?.pe ||
      10;

    character.fatigueState.currentStamina = PE * 2;
    character.fatigueState.fatigueLevel = 0;
    character.fatigueState.penalties = {
      strike: 0,
      parry: 0,
      dodge: 0,
      ps: 0,
      speed: 1.0,
    };
    character.fatigueState.status = "ready";
    character.fatigueState.totalRoundsActive = 0;
    character.fatigueState.lastActionType = null;
    character.fatigueState.collapseRoundsRemaining = 0;
  }
}

/**
 * Drain stamina for flying movement
 * @param {Object} fighter - Fighter object
 * @param {string} mode - Flight mode: "FLY_HOVER", "FLY_CRUISE", or "FLY_SPRINT"
 * @param {number} rounds - Number of rounds (default 1)
 * @returns {Object} Updated fighter object
 */
export function spendFlyingStamina(fighter, mode = "FLY_CRUISE", rounds = 1) {
  if (!fighter) return fighter;

  // Initialize fatigue state if needed
  if (!fighter.fatigueState) {
    fighter.fatigueState = initializeCombatFatigue(fighter);
  }

  const cost = (STAMINA_COSTS[mode] || STAMINA_COSTS.FLY_CRUISE) * rounds;
  const state = fighter.fatigueState;

  state.currentStamina = Math.max(0, state.currentStamina - cost);
  state.lastActionType = mode;

  // Update fatigue penalties
  updateFatiguePenalties(fighter);

  // Also sync to legacy SP field if it exists
  if (fighter.SP !== undefined) {
    fighter.SP = state.currentStamina;
  }
  if (fighter.currentStamina !== undefined) {
    fighter.currentStamina = state.currentStamina;
  }

  return fighter;
}

/**
 * Should a flying creature land to rest based on current stamina?
 * Used by flying AI (hawks, eagles, etc.) to decide when to peel off.
 */
export function shouldLandToRest(character) {
  if (!character) return false;

  if (!character.fatigueState) {
    character.fatigueState = initializeCombatFatigue(character);
  }

  const { currentStamina, maxStamina } = character.fatigueState;
  if (maxStamina == null) return false;

  // Land when ≤ 20% of max stamina, with a minimum threshold of 4 SP
  const threshold = Math.max(4, maxStamina * 0.2);
  return currentStamina <= threshold;
}

export default {
  initializeCombatFatigue,
  getStaminaCost,
  drainStamina,
  updateFatiguePenalties,
  resolveCollapseFromExhaustion,
  recoverStamina,
  magicalStaminaRecovery,
  shortRestRecovery,
  sleepRecovery,
  applyPostCombatRecovery,
  applyFatiguePenalties,
  getFatigueStatus,
  canPerformAction,
  resetFatigue,
  spendFlyingStamina,
  shouldLandToRest,
  STAMINA_COSTS,
  ENCUMBRANCE_MODIFIERS,
  FATIGUE_LEVELS,
  RECOVERY_RATES,
};

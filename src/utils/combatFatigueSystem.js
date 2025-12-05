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
    status: "ready", // ready, fatigued, exhausted, collapsed
    lastActionType: null, // Track last action for UI feedback
    totalRoundsActive: 0, // Total melee rounds spent in combat
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
 * Update fatigue penalties based on current stamina
 * @param {Object} character - Character object with fatigueState
 */
export function updateFatiguePenalties(character) {
  if (!character.fatigueState) {
    return;
  }

  const state = character.fatigueState;
  const stamina = state.currentStamina;

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
      state.penalties = { ...FATIGUE_LEVELS.COLLAPSE.penalty };
      state.penalties.speed = 0;
      state.fatigueLevel = 4;
      state.status = "collapse_risk";

      // Check for collapse (roll under P.E. on D20)
      const PE =
        character.PE ||
        character.pe ||
        character.attributes?.PE ||
        character.attributes?.pe ||
        10;

      const collapseRoll = Math.floor(Math.random() * 20) + 1;
      if (collapseRoll > PE) {
        state.status = "collapsed";
        state.penalties.strike = -5;
        state.penalties.parry = -5;
        state.penalties.dodge = -5;
      }
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
  recoverStamina,
  magicalStaminaRecovery,
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

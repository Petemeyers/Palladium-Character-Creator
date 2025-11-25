/**
 * Palladium Fantasy RPG - Fatigue & Stamina System
 *
 * Based on official rules:
 * - Characters can sprint at SPD × 20 yards per melee for P.E. minutes
 * - After P.E. limit, penalties apply: -1 SPD, -1 Strike/Parry/Dodge per minute over
 * - At +5 minutes over P.E., character collapses
 * - Recovery requires rest for half the sprint duration
 */

/**
 * Initialize fatigue state for a character/creature
 */
export function initializeFatigueState(character) {
  return {
    sprintTimer: 0, // Minutes spent sprinting
    restTimer: 0, // Minutes spent resting
    fatigueLevel: 0, // How many minutes over P.E. limit
    baseSPD:
      character.Spd ||
      character.spd ||
      character.attributes?.Spd ||
      character.attributes?.spd ||
      10,
    basePE: character.PE || character.pe || 10,
    status: "ready", // ready, fatigued, collapsed
    combatPenalty: 0, // Penalty to Strike/Parry/Dodge
  };
}

/**
 * Update fatigue when character sprints for deltaMinutes
 */
export function updateSprintFatigue(character, deltaMinutes = 1) {
  if (!character.fatigueState) {
    character.fatigueState = initializeFatigueState(character);
  }

  const state = character.fatigueState;
  state.sprintTimer += deltaMinutes;
  state.restTimer = 0; // Reset rest timer when sprinting

  // Check if over P.E. limit
  if (state.sprintTimer > state.basePE) {
    state.fatigueLevel = Math.floor(state.sprintTimer - state.basePE);

    // Apply penalties based on fatigue level
    if (state.fatigueLevel >= 1 && state.fatigueLevel < 4) {
      // -1 SPD, -1 combat per minute over
      character.spd = Math.max(state.baseSPD - state.fatigueLevel, 1);
      state.combatPenalty = -state.fatigueLevel;
      state.status = "fatigued";
    } else if (state.fatigueLevel === 4) {
      // SPD halved, cannot dodge ranged
      character.spd = Math.max(Math.floor(state.baseSPD / 2), 1);
      state.combatPenalty = -4;
      state.status = "gasping";
    } else if (state.fatigueLevel >= 5) {
      // Collapsed
      character.spd = 0;
      state.combatPenalty = -5;
      state.status = "collapsed";
    }
  } else {
    // Within P.E. limit, no penalties
    character.spd = state.baseSPD;
    state.combatPenalty = 0;
    state.fatigueLevel = 0;
    state.status = "ready";
  }

  return state;
}

/**
 * Rest and recover from fatigue
 */
export function restAndRecover(character, restMinutes = 1) {
  if (!character.fatigueState) {
    character.fatigueState = initializeFatigueState(character);
  }

  const state = character.fatigueState;
  state.restTimer += restMinutes;

  // Required rest = half the time spent sprinting (minimum 1 minute)
  const requiredRest = Math.max(Math.ceil(state.sprintTimer / 2), 1);

  if (state.restTimer >= requiredRest) {
    // Full recovery
    character.spd = state.baseSPD;
    state.combatPenalty = 0;
    state.sprintTimer = 0;
    state.restTimer = 0;
    state.fatigueLevel = 0;
    state.status = "ready";
  } else {
    // Partial recovery - reduce penalties gradually
    const recoveryPercent = state.restTimer / requiredRest;
    const penaltyReduction = Math.floor(state.fatigueLevel * recoveryPercent);

    state.combatPenalty = Math.min(
      -1,
      -(state.fatigueLevel - penaltyReduction)
    );

    if (state.status === "collapsed" && state.restTimer >= 1) {
      // After 1 minute rest, can move again (but still fatigued)
      state.status = "fatigued";
      character.spd = Math.max(Math.floor(state.baseSPD / 2), 1);
    }
  }

  return state;
}

/**
 * Check if character can sprint (not collapsed)
 */
export function canSprint(character) {
  if (!character.fatigueState) {
    return true;
  }
  return character.fatigueState.status !== "collapsed";
}

/**
 * Get fatigue status description
 */
export function getFatigueStatus(character) {
  if (!character.fatigueState) {
    return { status: "ready", description: "Fresh", color: "green" };
  }

  const state = character.fatigueState;

  switch (state.status) {
    case "ready":
      return {
        status: "ready",
        description: "Fresh",
        color: "green",
        penalty: 0,
      };
    case "fatigued":
      return {
        status: "fatigued",
        description: `Fatigued (${state.fatigueLevel} min over)`,
        color: "yellow",
        penalty: state.combatPenalty,
      };
    case "gasping":
      return {
        status: "gasping",
        description: "Gasping for air",
        color: "orange",
        penalty: state.combatPenalty,
      };
    case "collapsed":
      return {
        status: "collapsed",
        description: "Collapsed from exhaustion",
        color: "red",
        penalty: -5,
      };
    default:
      return {
        status: "unknown",
        description: "Unknown",
        color: "gray",
        penalty: 0,
      };
  }
}

/**
 * Calculate sprint distance in feet based on SPD
 */
export function getSprintDistanceFeet(speedAttribute) {
  // Official Palladium: SPD × 20 yards per melee
  // Convert to feet: 1 yard = 3 feet
  return speedAttribute * 20 * 3; // SPD × 60 feet
}

/**
 * Calculate sprint distance in grid cells (5 feet per cell)
 */
export function getSprintDistanceCells(speedAttribute) {
  const feet = getSprintDistanceFeet(speedAttribute);
  return Math.floor(feet / 5);
}

/**
 * Get maximum sustainable sprint distance before fatigue
 */
export function getMaxSprintDistance(speedAttribute, peAttribute) {
  // SPD × 20 yards per minute × P.E. minutes
  const yardsPerMinute = speedAttribute * 20;
  const totalYards = yardsPerMinute * peAttribute;
  return {
    yards: totalYards,
    feet: totalYards * 3,
    cells: Math.floor((totalYards * 3) / 5),
    minutes: peAttribute,
  };
}

/**
 * Apply fatigue penalties to combat bonuses
 */
export function applyFatiguePenalties(character) {
  if (!character.fatigueState || character.fatigueState.status === "ready") {
    return character;
  }

  const penalty = character.fatigueState.combatPenalty;

  // Create modified character with penalties
  const modified = { ...character };

  if (character.bonuses) {
    modified.bonuses = {
      ...character.bonuses,
      strike: (character.bonuses.strike || 0) + penalty,
      parry: (character.bonuses.parry || 0) + penalty,
      dodge: (character.bonuses.dodge || 0) + penalty,
    };
  } else {
    modified.bonuses = {
      strike: penalty,
      parry: penalty,
      dodge: penalty,
    };
  }

  // At "gasping" level, cannot dodge ranged attacks
  if (character.fatigueState.status === "gasping") {
    modified.canDodgeRanged = false;
  }

  // At "collapsed", cannot take actions
  if (character.fatigueState.status === "collapsed") {
    modified.canAct = false;
  }

  return modified;
}

export default {
  initializeFatigueState,
  updateSprintFatigue,
  restAndRecover,
  canSprint,
  getFatigueStatus,
  getSprintDistanceFeet,
  getSprintDistanceCells,
  getMaxSprintDistance,
  applyFatiguePenalties,
};

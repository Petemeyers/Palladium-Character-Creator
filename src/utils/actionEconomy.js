/**
 * Action Economy System
 * Manages attacks per combat round based on Medieval Combat Simulator rules
 */

export function create5eActionEconomy(overrides = {}) {
  return {
    action: overrides.action ?? true,
    bonusAction: overrides.bonusAction ?? true,
    reaction: overrides.reaction ?? true,
    movement: overrides.movement ?? 30,
  };
}

export function getActionsPerTurn(combatant = {}) {
  const explicitActions = Number(combatant.actions ?? combatant.actionCount);
  if (Number.isFinite(explicitActions) && explicitActions > 0) return explicitActions;
  return 1;
}

export function hasAction(actionEconomy = {}) {
  return Boolean(actionEconomy.action);
}

export function hasBonusAction(actionEconomy = {}) {
  return Boolean(actionEconomy.bonusAction);
}

export function hasReaction(actionEconomy = {}) {
  return Boolean(actionEconomy.reaction);
}

export function spendAction(actionEconomy = {}) {
  return { ...create5eActionEconomy(actionEconomy), action: false };
}

export function spendBonusAction(actionEconomy = {}) {
  return { ...create5eActionEconomy(actionEconomy), bonusAction: false };
}

export function spendReaction(actionEconomy = {}) {
  return { ...create5eActionEconomy(actionEconomy), reaction: false };
}

export function resetTurnActions(actionEconomy = {}) {
  return create5eActionEconomy(actionEconomy);
}

/**
 * Get number of attacks per combat round based on level and class
 * @param {number} level - Character level
 * @param {string} profession - profession
 * @returns {number} - Number of attacks per combat round
 */
export function getAttacksPerMelee(level = 1, profession = "") {
  const professionLower = (profession || "").toLowerCase();

  // Men of Arms (Soldier, Mercenary, Knight, Paladin, Long Bowman, Ranger)
  const menOfArms = [
    "soldier",
    "mercenary",
    "knight",
    "paladin",
    "long bowman",
    "ranger",
    "assassin",
    "thief",
  ];

  // Men of Training (Duelist, Diabolist, Alchemist, Mercenary)
  const menOfTraining = [
    "duelist",
    "diabolist",
    "alchemist",
    "mercenary",
    "summoner",
    "necromancer",
    "illusionist",
  ];

  // Clergy (Priest, Druid, Shaman)
  const clergy = ["priest", "druid", "shaman", "cleric", "healer"];

  const isMenOfArms = menOfArms.some((c) => professionLower.includes(c));
  const isMenOfTraining = menOfTraining.some((c) => professionLower.includes(c));
  const isClergy = clergy.some((c) => professionLower.includes(c));

  // Men of Arms - Most attacks
  if (isMenOfArms) {
    if (level <= 3) return 3;
    if (level <= 5) return 4;
    if (level <= 7) return 5;
    if (level <= 10) return 6;
    if (level <= 13) return 7;
    return 8; // Level 14+
  }

  // Men of Training - Fewer attacks
  if (isMenOfTraining) {
    if (level <= 3) return 2;
    if (level <= 7) return 3;
    if (level <= 12) return 4;
    return 5; // Level 13+
  }

  // Clergy - Moderate attacks
  if (isClergy) {
    if (level <= 3) return 2;
    if (level <= 6) return 3;
    if (level <= 10) return 4;
    return 5; // Level 11+
  }

  // Default (for classes not specified or NPCs)
  if (level <= 3) return 2;
  if (level <= 6) return 3;
  if (level <= 10) return 4;
  return 5; // Level 11+
}

/**
 * Get actions per round for opponents/combatants
 * @param {object} combatant - Combatant data from arenaRoster
 * @returns {number} - Number of attacks per combat round
 */
export function getCombatantAttacksPerMelee(combatant) {
  // If explicitly defined in combatant data
  if (combatant.actionsPerRound) {
    return combatant.actionsPerRound;
  }

  // Calculate based on total attack counts
  if (combatant.attacks && Array.isArray(combatant.attacks)) {
    // Sum up all attack counts
    const totalAttacks = combatant.attacks.reduce((sum, attack) => {
      return sum + (attack.count || 1);
    }, 0);

    // Opponents typically get their attack count as actions per round
    // But clamp to reasonable range (2-8)
    return Math.max(2, Math.min(8, totalAttacks));
  }

  // Default for unknown combatants
  return 2;
}

/**
 * Check if an action costs attacks
 * @param {string} actionType - Type of action
 * @returns {number} - Cost in attacks (0 = free, 1 = costs 1 attack, 'all' = costs all)
 */
export function getActionCost(actionType) {
  const costs = {
    // No cost (part of another action)
    NONE: 0,

    // Standard actions (cost 1 attack)
    STRIKE: 1,
    PARRY: 1,
    DODGE: 1,
    MOVE: 1,
    RUN: 1,
    CHARGE: 1,
    WITHDRAW: 1,
    DRAW: 1,
    AIM: 1,
    HOLD: 1,
    DISARM: 1,
    TRIP: 1,
    GRAPPLE: 1,
    USE_SKILL: 1,
    USE_ITEM: 1,
    OVERWATCH_SHOT: 1,

    // Variable cost actions
    USE_TECHNIQUE: 1, // Minimum, varies by technique
    INVOKE_POWER: 1, // Minimum, varies by power

    // Special actions
    SPRINT: "all", // Costs all attacks
    FULL_DEFENSE: "all", // Use all attacks for defense
  };

  return costs[actionType] || 1;
}

/**
 * Format attacks remaining display
 * @param {number} remaining - Attacks remaining
 * @param {number} total - Total actions per round
 * @returns {string} - Formatted string
 */
export function formatAttacksRemaining(remaining, total) {
  if (remaining <= 0) {
    return `0/${total} actions (OUT OF ACTIONS!)`;
  }

  if (remaining === total) {
    return `${remaining}/${total} actions (Full)`;
  }

  if (remaining === 1) {
    return `${remaining}/${total} actions (Last action!)`;
  }

  return `${remaining}/${total} actions`;
}

export default {
  create5eActionEconomy,
  getActionsPerTurn,
  hasAction,
  hasBonusAction,
  hasReaction,
  spendAction,
  spendBonusAction,
  spendReaction,
  resetTurnActions,
  getAttacksPerMelee,
  getCombatantAttacksPerMelee,
  getActionCost,
  formatAttacksRemaining,
};


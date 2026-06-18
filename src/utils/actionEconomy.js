/**
 * Action Economy System
 * Manages attacks per combat round based on Medieval Combat Simulator rules
 */

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
 * Get attacks per melee for opponents/combatants
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

    // Opponents typically get their attack count as attacks per melee
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
 * @param {number} total - Total attacks per melee
 * @returns {string} - Formatted string
 */
export function formatAttacksRemaining(remaining, total) {
  if (remaining <= 0) {
    return `ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â 0/${total} attacks (OUT OF ACTIONS!)`;
  }

  if (remaining === total) {
    return `ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â ${remaining}/${total} attacks (Full)`;
  }

  if (remaining === 1) {
    return `ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â ${remaining}/${total} attacks (Last action!)`;
  }

  return `ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â ${remaining}/${total} attacks`;
}

export default {
  getAttacksPerMelee,
  getCombatantAttacksPerMelee,
  getActionCost,
  formatAttacksRemaining,
};

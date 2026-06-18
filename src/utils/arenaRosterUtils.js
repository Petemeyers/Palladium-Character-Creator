/**
 * Utility helpers for working with arena roster data structures.
 */

export function getAllArenaRosterEntries(arenaRosterData) {
  if (!arenaRosterData) return [];
  if (Array.isArray(arenaRosterData.combatants)) return arenaRosterData.combatants;
  if (arenaRosterData.arenaRoster && Array.isArray(arenaRosterData.arenaRoster.combatants)) {
    return arenaRosterData.arenaRoster.combatants;
  }
  return [];
}

export function getCombatantEntries(arenaRosterData) {
  return getAllArenaRosterEntries(arenaRosterData);
}

export default {
  getAllArenaRosterEntries,
  getCombatantEntries,
};

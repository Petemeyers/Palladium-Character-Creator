/**
 * Utility helpers for working with arenaRoster data structures.
 */

/**
 * Returns all arenaRoster entries that should be available for encounters.
 * Combines core opponents with special combatant groupings (e.g., animals).
 *
 * @param {Object} arenaRosterData - Imported arenaRoster JSON.
 * @returns {Array} Array of combatant entries.
 */
export function getAllArenaRosterEntries(arenaRosterData) {
  if (!arenaRosterData || !arenaRosterData.arenaRoster) {
    return [];
  }

  const opponents = Array.isArray(arenaRosterData.arenaRoster.opponents)
    ? arenaRosterData.arenaRoster.opponents
    : [];

  const animals = Array.isArray(arenaRosterData.arenaRoster.animals)
    ? arenaRosterData.arenaRoster.animals
    : [];

  return [...opponents, ...animals];
}

/**
 * Convenience helper for accessing only the core opponent list.
 * Useful for validators or exports that should exclude specialised groups.
 *
 * @param {Object} arenaRosterData - Imported arenaRoster JSON.
 * @returns {Array} Array of opponent entries.
 */
export function getCombatantEntries(arenaRosterData) {
  if (!arenaRosterData || !arenaRosterData.arenaRoster) {
    return [];
  }

  return Array.isArray(arenaRosterData.arenaRoster.opponents)
    ? arenaRosterData.arenaRoster.opponents
    : [];
}

export default {
  getAllArenaRosterEntries,
  getCombatantEntries,
};

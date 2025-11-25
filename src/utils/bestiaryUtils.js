/**
 * Utility helpers for working with bestiary data structures.
 */

/**
 * Returns all bestiary entries that should be available for encounters.
 * Combines core monsters with special creature groupings (e.g., dragons).
 *
 * @param {Object} bestiaryData - Imported bestiary JSON.
 * @returns {Array} Array of creature entries.
 */
export function getAllBestiaryEntries(bestiaryData) {
  if (!bestiaryData || !bestiaryData.bestiary) {
    return [];
  }

  const monsters = Array.isArray(bestiaryData.bestiary.monsters)
    ? bestiaryData.bestiary.monsters
    : [];

  const dragons = Array.isArray(bestiaryData.bestiary.dragons)
    ? bestiaryData.bestiary.dragons
    : [];

  return [...monsters, ...dragons];
}

/**
 * Convenience helper for accessing only the core monster list.
 * Useful for validators or exports that should exclude specialised groups.
 *
 * @param {Object} bestiaryData - Imported bestiary JSON.
 * @returns {Array} Array of monster entries.
 */
export function getMonsterEntries(bestiaryData) {
  if (!bestiaryData || !bestiaryData.bestiary) {
    return [];
  }

  return Array.isArray(bestiaryData.bestiary.monsters)
    ? bestiaryData.bestiary.monsters
    : [];
}

export default {
  getAllBestiaryEntries,
  getMonsterEntries,
};

/**
 * Production helper for braced-counter weapon discovery.
 * Prefers canonical equipped-weapon identity, then array-shaped compatibility
 * slots, then primary/secondary object slots.
 */

export function resolveBracedCounterDefenderWeapon(fighter = {}) {
  const equipped = fighter?.equistaminadWeapons;
  if (Array.isArray(equipped)) {
    return equipped.find((weapon) => weapon?.name && !/unarmed/i.test(String(weapon.name))) || null;
  }
  return equipped?.primary || equipped?.secondary || null;
}

export default resolveBracedCounterDefenderWeapon;

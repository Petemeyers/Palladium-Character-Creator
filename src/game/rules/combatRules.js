// src/game/rules/combatRules.js

let lineOfSightResolver = null;

export function setLineOfSightResolver(resolver) {
  lineOfSightResolver = typeof resolver === "function" ? resolver : null;
}

// --- Hex math helpers ----------------------------------------------------

/**
 * Computes axial hex distance between two coordinates.
 * Accepts objects with q/r properties.
 */
export function hexDistance(a, b) {
  if (!a || !b) return Infinity;
  const dq = (a.q ?? 0) - (b.q ?? 0);
  const dr = (a.r ?? 0) - (b.r ?? 0);
  const ds = -((a.q ?? 0) + (a.r ?? 0)) - (-(b.q ?? 0) - (b.r ?? 0));
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

/**
 * Estimate the per-action move range (in hexes) for a fighter.
 * This is a simplified rule you can refine with Palladium specifics later.
 */
export function getMoveRangeHex(fighter = {}) {
  const SPD = fighter.SPD ?? fighter.speed ?? 10;
  const attacks = fighter.attacksPerMelee ?? fighter.actions ?? 4;

  const feetPerMelee = SPD;
  const feetPerAction = feetPerMelee / Math.max(attacks, 1);
  const feetPerHex = 5; // 1 hex ≈ 5 ft – tweak if your table differs

  return Math.max(1, Math.floor(feetPerAction / feetPerHex));
}

/**
 * Simple range-based reach check. Replace with path-cost validation later.
 */
export function canReachTile(state, fighterId, destination) {
  if (!state || !fighterId || !destination) return false;
  const fighter = state.combatantsById?.[fighterId];
  if (!fighter) return false;

  const current = state.positions?.[fighterId];
  if (!current) return false;

  const range = getMoveRangeHex(fighter);
  const dist = hexDistance(current, destination);
  return dist <= range;
}

/**
 * Derive attack range in hexes from the fighter's weapon data.
 */
export function getAttackRangeHex(attacker = {}) {
  const weapon = attacker.equippedWeapon || attacker.weapon || null;

  if (weapon?.rangeHex != null) {
    return weapon.rangeHex;
  }

  if (weapon?.rangeFeet != null) {
    return Math.max(1, Math.floor(weapon.rangeFeet / 5));
  }

  return 6; // default fallback (~30 ft)
}

/**
 * Simple distance-based range check for attacks.
 */
export function canAttackTarget(state, attackerId, targetId) {
  if (!state || !attackerId || !targetId) return false;
  const attacker = state.combatantsById?.[attackerId];
  const target = state.combatantsById?.[targetId];
  if (!attacker || !target) return false;

  const attackerPos = state.positions?.[attackerId];
  const targetPos = state.positions?.[targetId];
  if (!attackerPos || !targetPos) return false;

  const dist = hexDistance(attackerPos, targetPos);
  const range = getAttackRangeHex(attacker);
  return dist <= range;
}

/**
 * Placeholder for a full LoS check. Hook into VisionSystem later.
 */
export function hasLineOfSight(state, fromId, toId) {
  if (lineOfSightResolver) {
    try {
      return !!lineOfSightResolver(state, fromId, toId);
    } catch (err) {
      console.warn("LoS resolver error", err);
      return true;
    }
  }
  return true;
}

/**
 * Combined ranged attack validation.
 */
export function canPerformRangedAttack(state, attackerId, targetId) {
  if (!canAttackTarget(state, attackerId, targetId)) return false;
  if (!hasLineOfSight(state, attackerId, targetId)) return false;
  return true;
}

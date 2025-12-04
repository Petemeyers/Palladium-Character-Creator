// src/utils/painSystem.js
import { ensureMentalState } from "./horrorSystem";

/**
 * Check if a weapon should count as "heavy blunt" for pain stagger.
 */
export function isHeavyBluntWeapon(weapon) {
  if (!weapon) return false;

  const type = (weapon.type || weapon.category || "").toUpperCase();
  const name = (weapon.name || "").toLowerCase();

  if (type.includes("BLUNT")) return true;

  return /mace|hammer|maul|club|flail|morning star|warhammer|tetsubo/.test(name);
}

/**
 * Rough armor check: treat AR < 10 or no armor as "effectively unarmored"
 */
export function isEffectivelyUnarmored(defender) {
  if (!defender) return true;

  const armor =
    defender.equippedArmor ||
    defender.armor ||
    defender.equipment?.armor ||
    null;

  const AR =
    armor?.AR ??
    armor?.ar ??
    defender.AR ??
    defender.ar ??
    0;

  // You can tune this threshold (10 is common for no/very light armor)
  return !armor || AR < 10;
}

/**
 * Compute a pain threshold based on P.E. and a floor.
 */
export function getPainThreshold(defender) {
  if (!defender) return 4;
  const PE =
    defender.attributes?.PE ||
    defender.PE ||
    defender.stats?.PE ||
    10;
  return Math.max(4, Math.floor(PE / 2));
}

/**
 * Apply pain stagger for a single damaging hit.
 *
 * Params:
 *   defender: fighter object before pain
 *   damageDealt: numeric damage that actually got through
 *   weapon: weapon/attack used
 *   addLog: optional logger(message, level)
 *
 * Returns:
 *   {
 *     updatedDefender,
 *     painTriggered: boolean,
 *     actionsLost: number,
 *     insanityGain: number
 *   }
 */
export function applyPainStagger({ defender, damageDealt, weapon, addLog }) {
  if (!defender || !weapon || damageDealt <= 0) {
    return {
      updatedDefender: defender,
      painTriggered: false,
      actionsLost: 0,
      insanityGain: 0,
    };
  }

  const heavyBlunt = isHeavyBluntWeapon(weapon);
  if (!heavyBlunt) {
    return {
      updatedDefender: defender,
      painTriggered: false,
      actionsLost: 0,
      insanityGain: 0,
    };
  }

  const unarmored = isEffectivelyUnarmored(defender);
  if (!unarmored) {
    // Armor soaks the worst of the pain – no stagger, but you could
    // still add tiny insanity gain later if you want.
    return {
      updatedDefender: defender,
      painTriggered: false,
      actionsLost: 0,
      insanityGain: 0,
    };
  }

  const threshold = getPainThreshold(defender);
  if (damageDealt < threshold) {
    // Too light to stagger
    return {
      updatedDefender: defender,
      painTriggered: false,
      actionsLost: 0,
      insanityGain: 0,
    };
  }

  // At this point: heavy blunt, unarmored, and painful enough
  const beforeAttacks =
    defender.remainingAttacks ??
    defender.attacksPerMelee ??
    1;

  const actionsLost = Math.min(1, beforeAttacks); // simple: lose 1 action
  const afterAttacks = Math.max(0, beforeAttacks - actionsLost);

  const insanityGain = damageDealt >= threshold * 2 ? 2 : 1;
  const mentalState = ensureMentalState(defender);
  mentalState.insanityPoints += insanityGain;

  if (addLog) {
    addLog(
      `😖 ${defender.name} reels from the crushing blow and loses ${actionsLost} action${actionsLost !== 1 ? "s" : ""} to pain!`,
      "warning"
    );
  }

  const updatedDefender = {
    ...defender,
    remainingAttacks: afterAttacks,
    mentalState,
  };

  return {
    updatedDefender,
    painTriggered: true,
    actionsLost,
    insanityGain,
  };
}


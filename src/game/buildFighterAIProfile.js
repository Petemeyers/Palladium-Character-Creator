// src/game/buildFighterAIProfile.js

import { lookupWeaponStatsByName } from "../data/weaponStats";

/**
 * Produces an AI profile for a fighter based on manual overrides or weapon tags.
 * @param {Object} fighter
 * @returns {{isMeleeOnly:boolean, preferredRangeHex:number, maxRangedRangeHex:number}}
 */
function getPrimaryWeapon(fighter = {}) {
  if (fighter.equippedWeapon) return fighter.equippedWeapon;
  if (Array.isArray(fighter.weapons) && fighter.weapons.length > 0) {
    const flagged = fighter.weapons.find((w) => w.isEquipped || w.primary);
    return flagged || fighter.weapons[0];
  }
  return null;
}

export function buildFighterAIProfile(fighter = {}) {
  if (fighter.aiProfile) {
    return {
      isMeleeOnly: !!fighter.aiProfile.isMeleeOnly,
      preferredRangeHex:
        fighter.aiProfile.preferredRangeHex ??
        (fighter.aiProfile.isMeleeOnly ? 1 : 3),
      maxRangedRangeHex: fighter.aiProfile.maxRangedRangeHex ?? 8,
    };
  }

  const weapon = getPrimaryWeapon(fighter);

  if (!weapon) {
    return {
      isMeleeOnly: true,
      preferredRangeHex: 1,
      maxRangedRangeHex: 0,
    };
  }

  const type = String(weapon.type || "").toLowerCase();
  const tags = Array.isArray(weapon.tags)
    ? weapon.tags.map((tag) => String(tag).toLowerCase())
    : [];
  const rangeFeet = weapon.rangeFeet ?? weapon.range ?? null;
  const computedRangeHex =
    typeof weapon.rangeHex === "number"
      ? weapon.rangeHex
      : rangeFeet != null
      ? Math.max(1, Math.floor(rangeFeet / 5))
      : null;

  const rangedTokens = ["ranged", "bow", "crossbow", "gun", "rifle", "pistol", "thrown"];
  const hasRangedTag = tags.some((tag) => rangedTokens.includes(tag));
  const isRangedType =
    rangedTokens.includes(type) ||
    hasRangedTag ||
    (computedRangeHex != null && computedRangeHex > 1);

  if (!isRangedType) {
    return {
      isMeleeOnly: true,
      preferredRangeHex: 1,
      maxRangedRangeHex: 0,
    };
  }

  const effectiveRange = Math.max(2, computedRangeHex ?? 8);
  const preferred = Math.min(4, Math.max(2, Math.floor(effectiveRange / 3)));

  return {
    isMeleeOnly: false,
    preferredRangeHex: preferred,
    maxRangedRangeHex: effectiveRange,
  };
}

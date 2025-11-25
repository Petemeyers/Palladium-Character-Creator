/**
 * Combat Environment Logic
 * Applies terrain-based combat modifiers based on dynamic width and clearance
 */

import { TERRAIN_TYPES } from "./terrainSystem.js";
import {
  getDynamicWidth,
  getDynamicHeight,
  isTightTerrain,
  isVeryTightTerrain,
  getWidthCategory,
  getActorsInProximity,
} from "./environmentMetrics.js";
import {
  getReachStrikeModifiers,
  getReachParryModifiers,
  getReachDodgeModifiers,
  getReachInitiativeModifier,
  canUseCalledShot,
  hasClosedDistance,
} from "./reachCombatRules.js";

/**
 * Get weapon type category
 * @param {Object} weapon - Weapon object
 * @returns {string} Weapon type: "SHORT", "MEDIUM", "LONG", "HEAVY"
 */
export function getWeaponType(weapon) {
  if (!weapon) return "MEDIUM";

  // Check weapon name for keywords
  const name = (weapon.name || "").toLowerCase();

  if (
    name.includes("dagger") ||
    name.includes("knife") ||
    name.includes("short sword") ||
    name.includes("punch") ||
    name.includes("fist") ||
    name.includes("claw")
  ) {
    return "SHORT";
  }
  if (
    name.includes("greatsword") ||
    name.includes("two-handed") ||
    name.includes("polearm") ||
    name.includes("halberd") ||
    name.includes("pike") ||
    name.includes("spear") ||
    name.includes("lance") ||
    name.includes("staff")
  ) {
    return "LONG";
  }
  if (
    name.includes("heavy") ||
    name.includes("maul") ||
    name.includes("warhammer") ||
    name.includes("mace") ||
    name.includes("flail")
  ) {
    return "HEAVY";
  }

  // Check weapon reach
  const reach = weapon.reach || 0;
  if (reach <= 1) return "SHORT";
  if (reach >= 8) return "LONG";

  // Check weapon length property if available
  const length = weapon.length || 0;
  if (length <= 2) return "SHORT";
  if (length >= 6) return "LONG";

  return "MEDIUM";
}

/**
 * Get weapon length in feet
 * @param {Object} weapon - Weapon object
 * @returns {number} Length in feet
 */
export function getWeaponLength(weapon) {
  if (!weapon) return 3; // Default medium weapon

  // Check explicit length property
  if (weapon.length && typeof weapon.length === "number") {
    return weapon.length;
  }

  // Infer from reach
  if (weapon.reach && typeof weapon.reach === "number") {
    return weapon.reach;
  }

  // Infer from weapon type
  const weaponType = getWeaponType(weapon);
  switch (weaponType) {
    case "SHORT":
      return 2;
    case "MEDIUM":
      return 3;
    case "LONG":
      return 6;
    case "HEAVY":
      return 5;
    default:
      return 3;
  }
}

/**
 * Get combat modifiers based on terrain, weapon, and environment
 * @param {Object} weapon - Weapon object
 * @param {Object} attacker - Attacking character
 * @param {Object} defender - Defending character
 * @param {string} terrain - Terrain type key
 * @param {Array} actors - All combatants in the area
 * @param {Object} options - Additional options
 * @param {Object} attackerPos - Attacker's position {x, y}
 * @param {Object} positions - Position map {actorId: {x, y}}
 * @returns {Object} Combat modifiers {strike, dodge, parry, damage, notes}
 */
export function getCombatModifiers(
  weapon,
  attacker,
  defender,
  terrain,
  actors = [],
  options = {}
) {
  const mods = {
    strike: 0,
    dodge: 0,
    parry: 0,
    damage: 0,
    notes: [],
  };

  const terrainData = TERRAIN_TYPES[terrain];
  if (!terrainData) return mods;

  // Get dynamic width and height
  const width = getDynamicWidth(terrain, actors, options);
  const height = getDynamicHeight(terrain, actors);
  const dense = terrainData.density >= 0.7;
  const weaponType = getWeaponType(weapon);
  const weaponLength = getWeaponLength(weapon);

  // Check if attacker is in tight proximity to other combatants
  let nearbyActors = [];
  if (options.attackerPos && options.positions) {
    nearbyActors = getActorsInProximity(
      options.attackerPos,
      actors,
      options.positions,
      2
    );
    // Exclude the attacker from nearby count (they don't crowd themselves)
    nearbyActors = nearbyActors.filter((a) => a.id !== attacker.id);
  }

  // Restrict swing space - weapon too long for available width
  if (weaponLength > width - 1) {
    mods.strike -= 1;
    mods.notes.push(`Limited clearance (${width.toFixed(1)}ft width)`);
  }

  // Tight corridor / cave logic
  if (width <= 6) {
    // Short weapons gain advantage in tight spaces
    if (weaponType === "SHORT") {
      mods.dodge += 1;
      mods.notes.push("Tight space favors short weapons");
    }

    // Long/heavy weapons penalized
    if (weaponType === "LONG" || weaponType === "HEAVY") {
      mods.strike -= 1;
      mods.notes.push("Long weapon restricted in tight space");
    }

    // Very tight spaces (width <= 4)
    if (width <= 4) {
      if (weaponType === "LONG") {
        mods.strike -= 2;
        mods.notes.push("Very tight space severely restricts long weapons");
      }
      // Dodge becomes nearly impossible in very tight spaces
      mods.dodge -= 1;
      mods.notes.push("Very tight space limits dodging");
    }
  }

  // Vertical clearance for overhead attacks
  if (height <= 6 && weaponType !== "SHORT") {
    mods.strike -= 1;
    mods.notes.push("Ceiling too low for full swing");
  }

  // Very low ceilings (height <= 4)
  if (height <= 4) {
    if (weaponType === "LONG" || weaponType === "HEAVY") {
      mods.strike -= 2;
      mods.notes.push("Very low ceiling prevents overhead attacks");
    }
    // Cannot dodge while crouching
    mods.dodge -= 2;
    mods.notes.push("Must crouch - dodge severely limited");
  }

  // Dense outdoor obstacles (trees, ruins)
  if (dense && weaponType === "HEAVY") {
    mods.strike -= 2;
    mods.notes.push("Dense terrain restricts heavy swing");
  }

  // Crowded conditions (many nearby actors - excludes attacker)
  // Triggers when 3+ OTHER combatants are within 2 hexes (radius)
  if (nearbyActors.length >= 3) {
    mods.strike -= 1;
    mods.dodge -= 1;
    mods.notes.push(
      `🌲 Crowded conditions (${nearbyActors.length} nearby combatants)`
    );
  }

  // Urban narrow alleys
  if (terrain === "URBAN" && width <= 5) {
    mods.strike -= 1;
    mods.notes.push("Narrow alley restricts movement");
  }

  // Cave interior restrictions
  if (terrain === "CAVE_INTERIOR") {
    if (width <= 5 && weaponType === "LONG") {
      mods.strike -= 2;
      mods.notes.push("Tunnel too narrow for long weapons");
    }
  }

  return mods;
}

/**
 * Check if a weapon can be used effectively in current terrain
 * @param {Object} weapon - Weapon object
 * @param {string} terrain - Terrain type
 * @param {Array} actors - Combatants in area
 * @param {Object} options - Additional options
 * @returns {Object} {canUse: boolean, reason: string}
 */
export function canUseWeapon(weapon, terrain, actors = [], options = {}) {
  const width = getDynamicWidth(terrain, actors, options);
  const height = getDynamicHeight(terrain, actors);
  const weaponType = getWeaponType(weapon);
  const weaponLength = getWeaponLength(weapon);

  // Check width restriction
  if (weaponLength > width) {
    return {
      canUse: false,
      reason: `Weapon too long (${weaponLength}ft) for available width (${width.toFixed(
        1
      )}ft)`,
    };
  }

  // Check height restriction for overhead weapons
  if (weaponType === "LONG" && height < 7) {
    return {
      canUse: false,
      reason: `Ceiling too low (${height.toFixed(1)}ft) for overhead attacks`,
    };
  }

  // Very tight spaces disable long weapons
  if (width <= 3 && weaponType === "LONG") {
    return {
      canUse: false,
      reason: `Space too narrow (${width.toFixed(1)}ft) for long weapons`,
    };
  }

  return {
    canUse: true,
    reason: "Weapon usable in current terrain",
  };
}

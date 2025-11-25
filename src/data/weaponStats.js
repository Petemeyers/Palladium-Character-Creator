export const PALLADIUM_WEAPON_STATS = {
  "Short Bow": {
    type: "ranged",
    category: "bow",
    minEffectiveFeet: 20,
    maxEffectiveFeet: 120,
    hardMaxFeet: 300,
  },
  "Long Bow": {
    type: "ranged",
    category: "bow",
    minEffectiveFeet: 30,
    maxEffectiveFeet: 180,
    hardMaxFeet: 400,
  },
  Crossbow: {
    type: "ranged",
    category: "crossbow",
    minEffectiveFeet: 0,
    maxEffectiveFeet: 140,
    hardMaxFeet: 300,
  },
  "Throwing Knife": {
    type: "thrown",
    category: "knife",
    minEffectiveFeet: 0,
    maxEffectiveFeet: 20,
    hardMaxFeet: 40,
  },
  "Throwing Axe": {
    type: "thrown",
    category: "axe",
    minEffectiveFeet: 0,
    maxEffectiveFeet: 15,
    hardMaxFeet: 30,
  },
  "Short Sword": {
    type: "melee",
    category: "sword",
  },
  "Long Sword": {
    type: "melee",
    category: "sword",
  },
  "Battle Axe": {
    type: "melee",
    category: "axe",
  },
  Pike: {
    type: "melee",
    category: "polearm",
    reachFeet: 10,
  },
};

export function lookupWeaponStatsByName(name) {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  const entry = Object.entries(PALLADIUM_WEAPON_STATS).find(
    ([weaponName]) => weaponName.toLowerCase() === normalized
  );
  return entry ? entry[1] : null;
}

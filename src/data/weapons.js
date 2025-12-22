// Palladium Fantasy weapon data with damage dice, range, and reach
export const weapons = [
  // One-handed melee weapons
  {
    name: "Dagger",
    damage: "1d4",
    type: "weapon",
    category: "one-handed",
    weight: 2,
    price: 15,
    reach: 1, // feet - very short reach
    range: null, // not a ranged weapon
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 6,
    notes: "Can be thrown up to 30ft with -2 penalty",
  },
  {
    name: "Short Sword",
    damage: "2d4",
    type: "weapon",
    category: "one-handed",
    weight: 6,
    price: 35,
    reach: 2, // feet - short reach
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 8,
    notes: "Balanced for quick strikes",
  },
  {
    name: "Long Sword",
    damage: "2d6",
    type: "weapon",
    category: "one-handed",
    weight: 10,
    price: 60,
    reach: 3, // feet - medium reach
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 10,
    notes: "Versatile weapon with good reach",
  },
  {
    name: "Broadsword",
    damage: "2d6",
    type: "weapon",
    category: "one-handed",
    weight: 8,
    price: 50,
    reach: 3, // feet - medium reach
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 10,
    notes: "Heavy blade, good for cleaving",
  },
  {
    name: "Club",
    damage: "1d6",
    type: "weapon",
    category: "one-handed",
    weight: 4,
    price: 5,
    reach: 2, // feet
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 8,
    notes: "Simple but effective",
  },
  {
    name: "Mace",
    damage: "1d6",
    type: "weapon",
    category: "one-handed",
    weight: 6,
    price: 20,
    reach: 2, // feet
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 10,
    notes: "Good against armor",
  },
  {
    name: "War Hammer",
    damage: "1d6",
    type: "weapon",
    category: "one-handed",
    weight: 8,
    price: 25,
    reach: 2, // feet
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 12,
    notes: "Devastating against plate armor",
  },

  // Two-handed melee weapons
  {
    name: "Spear",
    damage: "1d6",
    type: "weapon",
    category: "two-handed",
    weight: 5,
    price: 15,
    reach: 6, // feet - long reach
    range: 30, // can be thrown
    rateOfFire: 1,
    ammunition: "self",
    strengthRequired: 8,
    notes: "Can be thrown or used in melee",
  },
  {
    name: "Long Spear",
    damage: "2d4",
    type: "weapon",
    category: "two-handed",
    weight: 8,
    price: 20,
    reach: 8, // feet - very long reach
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 10,
    notes: "Excellent reach advantage",
  },
  {
    name: "Two-Handed Sword",
    damage: "3d6",
    type: "weapon",
    category: "two-handed",
    weight: 15,
    price: 100,
    reach: 4, // feet - long reach
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 14,
    notes: "Devastating damage, requires strength",
  },
  {
    name: "Battle Axe",
    damage: "2d6",
    type: "weapon",
    category: "two-handed",
    weight: 12,
    price: 40,
    reach: 3, // feet - medium reach
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 12,
    notes: "Heavy chopping weapon",
  },
  {
    name: "Halberd",
    damage: "2d6",
    type: "weapon",
    category: "two-handed",
    weight: 10,
    price: 35,
    reach: 7, // feet - very long reach
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 12,
    notes: "Versatile polearm with excellent reach",
  },
  {
    name: "Lance",
    damage: "2d6",
    type: "weapon",
    category: "two-handed",
    weight: 10,
    price: 40,
    reach: 10, // feet - very long reach (cavalry weapon)
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 12,
    notes: "Cavalry weapon with excellent reach, +2 damage when charging",
  },
  {
    name: "Staff",
    damage: "1d4",
    type: "weapon",
    category: "two-handed",
    weight: 6,
    price: 10,
    reach: 5, // feet - good reach
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 8,
    notes: "Versatile defensive weapon",
  },

  // Ranged weapons
  {
    name: "Short Bow",
    damage: "2d6",
    type: "weapon",
    category: "bow",
    weight: 4,
    price: 30,
    reach: null,
    range: 360, // feet
    rateOfFire: 2, // attacks per melee
    ammunition: "arrows",
    strengthRequired: 10,
    notes: "Quick to draw and fire",
  },
  {
    name: "Long Bow",
    damage: "3d6",
    type: "weapon",
    category: "bow",
    weight: 6,
    price: 50,
    reach: null,
    range: 640, // feet
    rateOfFire: 2,
    ammunition: "arrows",
    strengthRequired: 12,
    notes: "Powerful and accurate",
  },
  {
    name: "Crossbow",
    damage: "3d6",
    type: "weapon",
    category: "crossbow",
    weight: 8,
    price: 75,
    reach: null,
    range: 480, // feet
    rateOfFire: 1, // slow reload
    ammunition: "bolts",
    strengthRequired: 8,
    notes: "High accuracy, slow reload",
  },
  {
    name: "Throwing Knife",
    damage: "1d4",
    type: "weapon",
    category: "thrown",
    weight: 1,
    price: 8,
    reach: 1, // can be used in melee
    range: 30, // feet
    rateOfFire: 3,
    ammunition: "self",
    strengthRequired: 6,
    notes: "Can be used in melee or thrown",
  },
  {
    name: "Throwing Axe",
    damage: "1d6",
    type: "weapon",
    category: "thrown",
    weight: 3,
    price: 15,
    reach: 2, // can be used in melee
    range: 30, // feet
    rateOfFire: 2,
    ammunition: "self",
    strengthRequired: 8,
    notes: "Can be used in melee or thrown",
  },
  {
    name: "Sling",
    damage: "1d6",
    type: "weapon",
    category: "ranged",
    weight: 1,
    price: 5,
    reach: null,
    range: 180, // feet
    rateOfFire: 2,
    ammunition: "sling stones",
    strengthRequired: 6,
    notes: "Simple but effective",
  },
  {
    name: "Stone Axe",
    damage: "1d6",
    type: "weapon",
    category: "one-handed",
    weight: 4,
    price: 8,
    reach: 2, // feet
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 8,
    notes: "Primitive but effective",
  },
  {
    name: "Meat Cleaver",
    damage: "1d4",
    type: "weapon",
    category: "one-handed",
    weight: 3,
    price: 6,
    reach: 1, // feet
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 6,
    notes: "Improvised weapon",
  },
  {
    name: "Shovel",
    damage: "1d4",
    type: "weapon",
    category: "two-handed",
    weight: 8,
    price: 4,
    reach: 4, // feet
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 8,
    notes: "Improvised weapon with good reach",
  },

  // Exotic weapons
  {
    name: "Whip",
    damage: "1d4",
    type: "weapon",
    category: "exotic",
    weight: 2,
    price: 12,
    reach: 8, // feet - very long reach
    range: null,
    rateOfFire: null,
    ammunition: null,
    strengthRequired: 8,
    notes: "Can disarm opponents, requires skill",
  },
  {
    name: "Net",
    damage: "0",
    type: "weapon",
    category: "exotic",
    weight: 3,
    price: 10,
    reach: 5, // feet
    range: 10, // can be thrown
    rateOfFire: 1,
    ammunition: "self",
    strengthRequired: 6,
    notes: "Entangles opponents, no damage",
  },
  {
    name: "Blowgun",
    damage: "1d3",
    type: "weapon",
    category: "exotic",
    weight: 1,
    price: 8,
    reach: null,
    range: 40, // feet
    rateOfFire: 2,
    ammunition: "darts",
    strengthRequired: 5,
    notes: "Silent, often poisoned",
  },
  // Special/Unique Weapons (not available in shops)
  {
    id: "baal_rog_fire_whip",
    name: "Fire Whip",
    damage: "4d6",
    type: "weapon",
    category: "melee",
    weaponType: "flexible",
    lengthFt: 15,
    reach: 15, // 15 feet = 3 hexes
    reachHexes: 3,
    weight: 5,
    price: 0, // Not purchasable - supernatural weapon
    strengthRequired: 20, // Requires supernatural strength
    isMagical: true,
    isSupernatural: true,
    isSpecial: true, // Flag to exclude from shop
    purchasable: false, // Explicitly not purchasable
    
    properties: {
      reach: true,
      flexible: true,
      entangleCapable: true,
      disarmCapable: true,
      tripCapable: true,
      pullCapable: true,
      antiAir: true,
      fireDamage: true, // Fire-based damage
    },
    
    specialAttacks: [
      "entangle",
      "disarm",
      "trip",
      "pull"
    ],
    
    counters: {
      parryPenalty: -2,      // Hard to parry flexible weapons
      dodgeAllowed: true,
      shieldBlock: false     // Whips are difficult to block with shields
    },
    
    restrictions: {
      requiresSupernaturalStrength: true,
      nonDemonicPenalty: -4  // Non-demons have difficulty using it
    },
    
    notes: "15 ft supernatural whip used by Baal-Rog demons; designed for control, entanglement, and extended reach combat. Can strike targets up to 15ft away horizontally and vertically (3D reach). Special weapon - not available for purchase."
  }
];

// Helper function to find weapon by name
export const getWeaponByName = (name) => {
  return weapons.find((weapon) => weapon.name === name);
};

// Helper function to get weapons by category
export const getWeaponsByCategory = (category) => {
  return weapons.filter((weapon) => weapon.category === category);
};

// Helper function to get weapons by type
export const getWeaponsByType = (type) => {
  return weapons.filter((weapon) => weapon.type === type);
};

// Helper function to get weapons by reach
export const getWeaponsByReach = (minReach, maxReach = null) => {
  return weapons.filter((weapon) => {
    if (!weapon.reach) return false;
    if (maxReach) {
      return weapon.reach >= minReach && weapon.reach <= maxReach;
    }
    return weapon.reach >= minReach;
  });
};

// Helper function to get ranged weapons
export const getRangedWeapons = () => {
  return weapons.filter((weapon) => weapon.range && weapon.range > 0);
};

// Helper function to get melee weapons
export const getMeleeWeapons = () => {
  return weapons.filter((weapon) => !weapon.range || weapon.range === null);
};

// Helper function to calculate reach advantage
export const calculateReachAdvantage = (attackerWeapon, defenderWeapon) => {
  const attackerReach = attackerWeapon?.reach || 0;
  const defenderReach = defenderWeapon?.reach || 0;

  if (attackerReach > defenderReach) {
    const advantage = attackerReach - defenderReach;
    return {
      hasAdvantage: true,
      bonus: Math.min(advantage, 3), // Max +3 bonus
      description: `+${Math.min(advantage, 3)} to Strike (reach advantage)`,
    };
  }

  return { hasAdvantage: false, bonus: 0, description: "No reach advantage" };
};

// Helper function to calculate range penalties
export const calculateRangePenalty = (distance, weapon) => {
  if (!weapon.range) return { penalty: 0, category: "melee" };

  const maxRange = weapon.range;
  const pointBlank = 10; // feet
  const shortRange = maxRange * 0.33;
  const mediumRange = maxRange * 0.66;

  if (distance <= pointBlank) {
    return {
      penalty: 2,
      category: "point-blank",
      description: "+2 to Strike (point-blank)",
    };
  } else if (distance <= shortRange) {
    return { penalty: 0, category: "short", description: "No penalty" };
  } else if (distance <= mediumRange) {
    return { penalty: -1, category: "medium", description: "-1 to Strike" };
  } else if (distance <= maxRange) {
    return { penalty: -3, category: "long", description: "-3 to Strike" };
  } else {
    return {
      penalty: -10,
      category: "out-of-range",
      description: "Cannot attack (out of range)",
    };
  }
};

// Helper function to check if weapon can be used at range
export const canUseAtRange = (weapon, distance) => {
  if (!weapon.range) return false;
  return distance <= weapon.range;
};

// Helper function to get weapons by strength requirement
export const getWeaponsByStrength = (characterPS) => {
  return weapons.filter(
    (weapon) => characterPS >= (weapon.strengthRequired || 0)
  );
};

// Baal-Rog Fire Whip - Special supernatural weapon with 15ft reach
// Export reference to the Fire Whip from the weapons array for backward compatibility
export const baalRogFireWhip = getWeaponByName("Fire Whip") || {
  id: "baal_rog_fire_whip",
  name: "Fire Whip",
  damage: "4d6",
  type: "weapon",
  category: "melee",
  weaponType: "flexible",
  lengthFt: 15,
  reach: 15, // 15 feet = 3 hexes
  reachHexes: 3,
  weight: 5,
  price: 0, // Not purchasable - supernatural weapon
  strengthRequired: 20, // Requires supernatural strength
  isMagical: true,
  isSupernatural: true,
  isSpecial: true,
  purchasable: false,
  
  properties: {
    reach: true,
    flexible: true,
    entangleCapable: true,
    disarmCapable: true,
    tripCapable: true,
    pullCapable: true,
    antiAir: true,
    fireDamage: true, // Fire-based damage
  },
  
  specialAttacks: [
    "entangle",
    "disarm",
    "trip",
    "pull"
  ],
  
  counters: {
    parryPenalty: -2,      // Hard to parry flexible weapons
    dodgeAllowed: true,
    shieldBlock: false     // Whips are difficult to block with shields
  },
  
  restrictions: {
    requiresSupernaturalStrength: true,
    nonDemonicPenalty: -4  // Non-demons have difficulty using it
  },
  
  notes: "15 ft supernatural whip used by Baal-Rog demons; designed for control, entanglement, and extended reach combat. Can strike targets up to 15ft away horizontally and vertically (3D reach). Special weapon - not available for purchase."
};
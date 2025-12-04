/**
 * Enemy Weapon Assignment System
 * Assigns random weapons to enemies based on their preferences
 * Serves as placeholder for looting dynamic - weapons are added to inventory
 */

import shopItems from '../data/shopItems.js';

/**
 * Map weapon categories/types to search terms
 */
const WEAPON_CATEGORY_MAP = {
  'blade': ['sword', 'blade', 'saber', 'rapier', 'scimitar', 'cutlass'],
  'blunt': ['mace', 'hammer', 'club', 'flail', 'morning star', 'warhammer'],
  'large sword': ['long sword', 'broadsword', 'greatsword', 'claymore', 'bastard sword'],
  'short sword': ['short sword', 'gladius', 'wakizashi'],
  'knife': ['knife', 'dagger', 'stiletto', 'dirk'],
  'bow': ['bow', 'longbow', 'shortbow', 'composite bow'],
  'crossbow': ['crossbow', 'arbalest'],
  'spear': ['spear', 'lance', 'pike', 'halberd'],
  'axe': ['axe', 'battle axe', 'hand axe', 'tomahawk'],
  'polearm': ['polearm', 'pole arm', 'halberd', 'glaive', 'guisarme'],
  'two-handed': ['two-handed', 'two handed', 'greatsword', 'claymore', 'maul'],
  'ranged': ['bow', 'crossbow', 'sling', 'throwing'],
  'giant-sized': ['giant', 'large', 'huge'], // For giant races
};

/**
 * Parse favorite weapons string/array into searchable terms
 * @param {string|Array} favoriteWeapons - Favorite weapons description or array
 * @returns {Array} Array of search terms
 */
function parseFavoriteWeapons(favoriteWeapons) {
  if (!favoriteWeapons) return [];
  
  if (Array.isArray(favoriteWeapons)) {
    return favoriteWeapons.map(w => w.toLowerCase());
  }
  
  if (typeof favoriteWeapons === 'string') {
    // Split by commas, "and", "or", etc.
    return favoriteWeapons
      .toLowerCase()
      .split(/[,;]| and | or /)
      .map(w => w.trim())
      .filter(w => w.length > 0);
  }
  
  return [];
}

/**
 * Find weapons matching favorite weapon preferences
 * @param {Array} searchTerms - Search terms from favorite weapons
 * @param {Object} enemy - Enemy character (for race/size filtering)
 * @returns {Array} Matching weapons from shopItems
 */
function findMatchingWeapons(searchTerms, enemy = {}) {
  const matchingWeapons = [];
  const race = (enemy.species || enemy.race || '').toLowerCase();
  const isGiant = race.includes('giant') || race.includes('troll') || race.includes('ogre') || race.includes('wolfen');
  
  // Get all weapons from shopItems
  const allWeapons = shopItems.filter(item => 
    item.type === 'weapon' || item.damage || item.category === 'weapon'
  );
  
  for (const weapon of allWeapons) {
    const weaponName = (weapon.name || '').toLowerCase();
    const weaponCategory = (weapon.category || '').toLowerCase();
    const weaponType = (weapon.type || '').toLowerCase();
    
    // Check each search term
    for (const term of searchTerms) {
      const termLower = term.toLowerCase();
      
      // Direct name match
      if (weaponName.includes(termLower)) {
        matchingWeapons.push(weapon);
        break;
      }
      
      // Category map match
      if (WEAPON_CATEGORY_MAP[termLower]) {
        const categoryTerms = WEAPON_CATEGORY_MAP[termLower];
        if (categoryTerms.some(catTerm => 
          weaponName.includes(catTerm) || 
          weaponCategory.includes(catTerm) ||
          weaponType.includes(catTerm)
        )) {
          matchingWeapons.push(weapon);
          break;
        }
      }
      
      // Generic term match (blade, blunt, etc.)
      if (termLower === 'blade' && (weaponCategory.includes('sword') || weaponCategory.includes('blade'))) {
        matchingWeapons.push(weapon);
        break;
      }
      
      if (termLower === 'blunt' && (weaponCategory.includes('mace') || weaponCategory.includes('hammer') || weaponCategory.includes('club'))) {
        matchingWeapons.push(weapon);
        break;
      }
      
      if (termLower === 'bow' && (weaponName.includes('bow') || weaponCategory.includes('bow'))) {
        matchingWeapons.push(weapon);
        break;
      }
      
      // Giant-sized weapons (for giant races)
      if (isGiant && termLower.includes('giant')) {
        // Prefer larger weapons for giant races
        const weaponWeight = parseFloat(weapon.weight) || 0;
        if (weaponWeight > 5) { // Heavier weapons
          matchingWeapons.push(weapon);
          break;
        }
      }
    }
  }
  
  // Remove duplicates
  const uniqueWeapons = [];
  const seenNames = new Set();
  for (const weapon of matchingWeapons) {
    if (!seenNames.has(weapon.name)) {
      seenNames.add(weapon.name);
      uniqueWeapons.push(weapon);
    }
  }
  
  return uniqueWeapons;
}

/**
 * Select a random weapon from matching weapons
 * @param {Array} matchingWeapons - Array of matching weapons
 * @param {Object} enemy - Enemy character
 * @returns {Object|null} Selected weapon or null
 */
function selectRandomWeapon(matchingWeapons, enemy = {}) {
  if (!matchingWeapons || matchingWeapons.length === 0) {
    return null;
  }
  
  // If only one weapon, return it
  if (matchingWeapons.length === 1) {
    return matchingWeapons[0];
  }
  
  // Random selection
  const randomIndex = Math.floor(Math.random() * matchingWeapons.length);
  return matchingWeapons[randomIndex];
}

/**
 * Create weapon object for enemy inventory/equipment
 * @param {Object} weapon - Weapon from shopItems
 * @returns {Object} Formatted weapon object
 */
function formatWeaponForEnemy(weapon) {
  const weaponName = (weapon.name || '').toLowerCase();
  
  // Detect if weapon is ranged based on name, category, or range property
  const isRanged = weapon.range > 0 || 
                   weapon.category === 'bow' || 
                   weapon.category === 'crossbow' ||
                   weapon.category === 'ranged' ||
                   weapon.type === 'ranged' ||
                   weapon.type === 'missile' ||
                   weaponName.includes('bow') ||
                   weaponName.includes('crossbow') ||
                   weaponName.includes('sling') ||
                   weaponName.includes('thrown');
  
  // Detect if weapon is melee
  const isMelee = !isRanged && (
    weapon.reach > 0 ||
    weapon.category === 'sword' ||
    weapon.category === 'axe' ||
    weapon.category === 'blunt' ||
    weapon.category === 'melee' ||
    weapon.type === 'melee'
  );
  
  // Set proper type
  let weaponType = 'weapon';
  if (isRanged) {
    weaponType = 'ranged';
  } else if (isMelee) {
    weaponType = 'melee';
  }
  
  // Set default range for bows if not specified
  let weaponRange = weapon.range;
  if (isRanged && !weaponRange) {
    if (weaponName.includes('long bow') || weaponName === 'longbow') {
      weaponRange = 640; // Long bow range
    } else if (weaponName.includes('short bow') || weaponName === 'shortbow') {
      weaponRange = 360; // Short bow range
    } else if (weaponName.includes('bow')) {
      weaponRange = 360; // Default bow range
    } else if (weaponName.includes('crossbow')) {
      weaponRange = 480; // Crossbow range
    }
  }
  
  return {
    name: weapon.name,
    type: weaponType,
    category: weapon.category || (isRanged ? 'ranged' : 'melee'),
    damage: weapon.damage || '1d6',
    weight: weapon.weight || 0,
    price: weapon.price || 0,
    description: weapon.description || '',
    reach: weapon.reach || weapon.length || null,
    range: weaponRange,
    twoHanded: weapon.twoHanded || weapon.handed === 'two-handed' || isRanged,
    bonuses: weapon.bonuses || null,
    ammunition: isRanged && weaponName.includes('bow') ? 'arrows' : 
                (isRanged && weaponName.includes('crossbow') ? 'bolts' : null),
  };
}

/**
 * Equip weapon to enemy
 * @param {Object} enemy - Enemy character
 * @param {Object} weapon - Weapon to equip
 * @returns {Object} Updated enemy with weapon equipped
 */
function equipWeaponToEnemy(enemy, weapon) {
  const formattedWeapon = formatWeaponForEnemy(weapon);
  
  // Initialize equippedWeapons if needed
  if (!enemy.equippedWeapons || !Array.isArray(enemy.equippedWeapons)) {
    enemy.equippedWeapons = [
      {
        name: "Unarmed",
        damage: "1d3",
        type: "unarmed",
        category: "unarmed",
        slot: "Right Hand",
      },
      {
        name: "Unarmed",
        damage: "1d3",
        type: "unarmed",
        category: "unarmed",
        slot: "Left Hand",
      },
    ];
  }
  
  // Equip to right hand (primary)
  enemy.equippedWeapons[0] = {
    ...formattedWeapon,
    slot: "Right Hand",
  };
  
  // Update legacy equippedWeapon
  enemy.equippedWeapon = formattedWeapon.name;
  
  // Initialize equipped object if needed
  if (!enemy.equipped) {
    enemy.equipped = {};
  }
  
  enemy.equipped.weaponPrimary = formattedWeapon;
  
  return enemy;
}

/**
 * Add weapon to enemy inventory (for looting)
 * @param {Object} enemy - Enemy character
 * @param {Object} weapon - Weapon to add
 * @returns {Object} Updated enemy with weapon in inventory
 */
function addWeaponToInventory(enemy, weapon) {
  const formattedWeapon = formatWeaponForEnemy(weapon);
  
  // Initialize inventory if needed
  if (!enemy.inventory || !Array.isArray(enemy.inventory)) {
    enemy.inventory = [];
  }
  
  // Check if weapon already in inventory
  const existingIndex = enemy.inventory.findIndex(item => item.name === formattedWeapon.name);
  if (existingIndex >= 0) {
    // Already have it, don't duplicate
    return enemy;
  }
  
  // Add to inventory
  enemy.inventory.push(formattedWeapon);
  
  return enemy;
}

/**
 * Assign random weapon to enemy based on preferences
 * @param {Object} enemy - Enemy character
 * @param {string|Array} favoriteWeapons - Favorite weapons (from bestiary data)
 * @returns {Object} Updated enemy with weapon assigned and equipped
 */
export function assignRandomWeaponToEnemy(enemy, favoriteWeapons) {
  if (!enemy) {
    console.warn('assignRandomWeaponToEnemy: No enemy provided');
    return enemy;
  }
  
  // Parse favorite weapons
  const searchTerms = parseFavoriteWeapons(favoriteWeapons);
  
  // If no favorite weapons specified, use default weapon
  if (searchTerms.length === 0) {
    console.log(`No favorite weapons for ${enemy.name}, using default`);
    // Could assign a basic weapon here if desired
    return enemy;
  }
  
  // Find matching weapons
  const matchingWeapons = findMatchingWeapons(searchTerms, enemy);
  
  if (matchingWeapons.length === 0) {
    console.warn(`No matching weapons found for ${enemy.name} with preferences: ${searchTerms.join(', ')}`);
    // Fallback: try to find any weapon
    const allWeapons = shopItems.filter(item => 
      item.type === 'weapon' || item.damage || item.category === 'weapon'
    );
    if (allWeapons.length > 0) {
      const fallbackWeapon = allWeapons[Math.floor(Math.random() * allWeapons.length)];
      const formattedWeapon = formatWeaponForEnemy(fallbackWeapon);
      enemy = equipWeaponToEnemy(enemy, fallbackWeapon);
      enemy = addWeaponToInventory(enemy, fallbackWeapon);
      console.log(`Using fallback weapon for ${enemy.name}: ${formattedWeapon.name}`);
    }
    return enemy;
  }
  
  // Select random weapon
  const selectedWeapon = selectRandomWeapon(matchingWeapons, enemy);
  
  if (!selectedWeapon) {
    console.warn(`Failed to select weapon for ${enemy.name}`);
    return enemy;
  }
  
  // Equip weapon
  enemy = equipWeaponToEnemy(enemy, selectedWeapon);
  
  // Add to inventory (for looting)
  enemy = addWeaponToInventory(enemy, selectedWeapon);
  
  console.log(`Assigned weapon to ${enemy.name}: ${selectedWeapon.name} (from preferences: ${searchTerms.join(', ')})`);
  
  return enemy;
}

/**
 * Assign random weapons to multiple enemies
 * @param {Array} enemies - Array of enemy characters
 * @returns {Array} Updated enemies with weapons assigned
 */
export function assignRandomWeaponsToEnemies(enemies) {
  if (!enemies || !Array.isArray(enemies)) {
    return enemies || [];
  }
  
  return enemies.map(enemy => {
    // Get favorite weapons from enemy data
    const favoriteWeapons = enemy.favorite_weapons || enemy.preferred_weapons || enemy.favoriteWeapons;
    
    return assignRandomWeaponToEnemy(enemy, favoriteWeapons);
  });
}

/**
 * Get default weapon for enemy (fallback)
 * @param {Object} enemy - Enemy character
 * @returns {Object} Default weapon
 */
export function getDefaultWeaponForEnemy(enemy) {
  const race = (enemy.species || enemy.race || '').toLowerCase();
  const isGiant = race.includes('giant') || race.includes('troll') || race.includes('ogre') || race.includes('wolfen');
  
  // Find a basic weapon
  const basicWeapons = shopItems.filter(item => {
    if (item.type !== 'weapon' && !item.damage) return false;
    
    const name = (item.name || '').toLowerCase();
    
    // For giants, prefer larger weapons
    if (isGiant) {
      return name.includes('sword') || name.includes('axe') || name.includes('mace');
    }
    
    // For others, prefer common weapons
    return name.includes('sword') || name.includes('dagger') || name.includes('mace');
  });
  
  if (basicWeapons.length > 0) {
    return basicWeapons[Math.floor(Math.random() * basicWeapons.length)];
  }
  
  // Ultimate fallback: unarmed
  return {
    name: "Unarmed",
    damage: "1d3",
    type: "unarmed",
    category: "unarmed",
    weight: 0,
    price: 0,
  };
}

export default {
  assignRandomWeaponToEnemy,
  assignRandomWeaponsToEnemies,
  getDefaultWeaponForEnemy,
  parseFavoriteWeapons,
  findMatchingWeapons,
  selectRandomWeapon,
};


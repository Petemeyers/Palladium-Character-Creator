# Enemy Weapon Assignment System

## Overview

The Enemy Weapon Assignment System automatically assigns random weapons to enemies in the combat arena based on their weapon preferences. This serves as a placeholder for the looting dynamic - weapons are added to enemy inventory and equipped, making them available for looting when enemies are defeated.

---

## Features

### 1. **Preference-Based Weapon Selection**
- Reads `favorite_weapons` or `preferred_weapons` from enemy data
- Matches preferences to actual weapons in `shopItems`
- Randomly selects one matching weapon

### 2. **Smart Weapon Matching**
- Supports multiple preference formats:
  - Arrays: `["blade", "blunt"]`
  - Strings: `"Large swords, short swords, long bows"`
  - Category keywords: `"blade"`, `"blunt"`, `"bow"`, etc.

### 3. **Race-Aware Selection**
- Giant races (Troll, Ogre, Wolfen, etc.) prefer heavier weapons
- Normal races get standard weapons
- Small races get appropriately sized weapons

### 4. **Automatic Equipping**
- Weapon is equipped to enemy's right hand (primary slot)
- Added to enemy inventory for looting
- Updates `equippedWeapons` array
- Updates legacy `equippedWeapon` property

---

## How It Works

### Step 1: Parse Preferences

```javascript
const searchTerms = parseFavoriteWeapons(favoriteWeapons);
// ["blade", "blunt (giant-sized)"]
```

### Step 2: Find Matching Weapons

```javascript
const matchingWeapons = findMatchingWeapons(searchTerms, enemy);
// Returns all weapons matching the preferences
```

### Step 3: Select Random Weapon

```javascript
const selectedWeapon = selectRandomWeapon(matchingWeapons, enemy);
// Randomly selects one from matching weapons
```

### Step 4: Equip and Add to Inventory

```javascript
enemy = equipWeaponToEnemy(enemy, selectedWeapon);
enemy = addWeaponToInventory(enemy, selectedWeapon);
```

---

## Weapon Category Mapping

The system maps preference keywords to weapon types:

| Preference | Matches |
|------------|---------|
| `blade` | swords, sabers, rapiers, scimitars |
| `blunt` | maces, hammers, clubs, flails |
| `large sword` | long swords, broadswords, greatswords |
| `short sword` | short swords, gladius, wakizashi |
| `knife` | knives, daggers, stilettos |
| `bow` | bows, longbows, shortbows |
| `crossbow` | crossbows, arbalests |
| `spear` | spears, lances, pikes |
| `axe` | axes, battle axes, hand axes |
| `polearm` | polearms, halberds, glaives |
| `two-handed` | two-handed weapons, greatswords |
| `giant-sized` | heavier weapons (for giant races) |

---

## Integration Points

### 1. **CombatPage.jsx** (`addEnemyToCombat`)
- Regular enemies get weapons assigned when added to combat
- Uses `favorite_weapons` or `preferred_weapons` from bestiary data
- Logs weapon assignment to combat log

### 2. **autoRoll.js** (`createPlayableCharacterFighter`)
- Playable character enemies get weapons assigned
- Preserves `favorite_weapons` from character data
- Assigns weapon after fighter creation

---

## Example Usage

### Example 1: Troll with Favorite Weapons

**Bestiary Data**:
```json
{
  "name": "Troll",
  "favorite_weapons": ["blade", "blunt (giant-sized)"]
}
```

**Result**:
- System finds all blade and blunt weapons
- Filters for heavier weapons (giant preference)
- Randomly selects: "Long Sword" or "Warhammer"
- Equips weapon and adds to inventory

### Example 2: Goblin with Preferred Weapons

**Bestiary Data**:
```json
{
  "name": "Goblin",
  "preferred_weapons": "Short swords, knives, and short bows"
}
```

**Result**:
- System parses: ["short swords", "knives", "short bows"]
- Finds matching weapons: Short Sword, Dagger, Shortbow
- Randomly selects: "Dagger"
- Equips weapon and adds to inventory

### Example 3: Enemy Without Preferences

**Bestiary Data**:
```json
{
  "name": "Spectre",
  "attacks": [{"name": "Touch", "damage": "1d6"}]
}
```

**Result**:
- No favorite weapons specified
- Uses default weapon or keeps unarmed
- No weapon assigned (uses natural attacks)

---

## Weapon Format

Assigned weapons are formatted as:

```javascript
{
  name: "Long Sword",
  type: "weapon",
  category: "weapon",
  damage: "2d6",
  weight: 10,
  price: 50,
  description: "",
  reach: 3,
  range: null,
  twoHanded: false,
  bonuses: null,
}
```

---

## Looting Integration

Weapons are added to enemy inventory, making them available for looting:

```javascript
enemy.inventory = [
  {
    name: "Long Sword",
    type: "weapon",
    damage: "2d6",
    weight: 10,
    price: 50,
    // ... other properties
  }
];
```

When enemy is defeated, players can loot the weapon from inventory.

---

## Files

- **`src/utils/enemyWeaponAssigner.js`**: Core weapon assignment system
- **`src/pages/CombatPage.jsx`**: Integration for regular enemies
- **`src/utils/autoRoll.js`**: Integration for playable character enemies
- **`ENEMY_WEAPON_ASSIGNMENT.md`**: This documentation

---

## Functions

### `assignRandomWeaponToEnemy(enemy, favoriteWeapons)`
Main function to assign weapon to single enemy.

**Parameters**:
- `enemy`: Enemy character object
- `favoriteWeapons`: String or array of weapon preferences

**Returns**: Updated enemy with weapon equipped and in inventory

### `assignRandomWeaponsToEnemies(enemies)`
Assigns weapons to multiple enemies.

**Parameters**:
- `enemies`: Array of enemy characters

**Returns**: Array of updated enemies

### `getDefaultWeaponForEnemy(enemy)`
Gets fallback weapon if no preferences match.

**Parameters**:
- `enemy`: Enemy character object

**Returns**: Default weapon object

---

## Future Enhancements

### Planned Features:
1. **Weapon Quality Variation**: Assign different quality levels (poor, normal, good, excellent)
2. **Weapon Condition**: Random wear/condition affecting effectiveness
3. **Enchanted Weapons**: Rare chance for magical weapons
4. **Weapon Durability**: Track weapon condition/durability
5. **Weapon Upgrades**: Allow enemies to have upgraded/modified weapons

---

## Summary

The Enemy Weapon Assignment System:
- ✅ Assigns random weapons based on enemy preferences
- ✅ Matches preferences to actual shop items
- ✅ Equips weapons automatically
- ✅ Adds weapons to inventory for looting
- ✅ Supports multiple preference formats
- ✅ Race-aware weapon selection
- ✅ Integrated into combat arena

Enemies now spawn with varied, preference-based weapons that can be looted!


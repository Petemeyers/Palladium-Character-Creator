# Small and Tiny Races: Weapon Length and Weight Handling

## Overview
This document explains how small and tiny races handle weapon length and weight when using normal-sized weapons.

---

## Current System

### 1. **Weapon Size Categories** (Damage Only)
- **SMALL**: Gnome (reduced damage dice)
- **NORMAL**: Human, Elf, Dwarf, Goblin, Kobold, etc.
- **GIANT**: Troll, Ogre, Wolfen, Giants (+1 die damage)
- **FAERIE**: Pixie, Sprite, Faerie, etc. (use creature-specific damage)

### 2. **Size Categories** (Combat Bonuses)
- **TINY**: Under 2ft (Pixie, Sprite, Brownie, etc.)
- **SMALL**: 2-4ft (Gnome, Kobold, Goblin)
- **MEDIUM**: 4-7ft (Human, Elf, Dwarf)
- **LARGE+**: 7ft+ (Troll, Ogre, etc.)

---

## New Functions Added

### `getAdjustedWeaponLength(baseLength, race, character)`
**Purpose**: Adjusts weapon reach/length for small/tiny races using normal-sized weapons

**How it works**:
- **Tiny races** (Pixie, Sprite): Weapons reduced to ~35% of base length
  - Example: 3ft sword → 1ft effective reach
- **Small races** (Gnome, Kobold, Goblin): Weapons reduced to ~55% of base length
  - Example: 3ft sword → 1.65ft effective reach
- **Normal races**: No change (use base length)
- **Giant races**: No change (they use giant-sized weapons)

**Rationale**: A 3ft sword for a 6ft human is proportionally equivalent to a 1.5ft sword for a 3ft gnome.

### `getAdjustedWeaponWeight(baseWeight, race, character)`
**Purpose**: Adjusts effective weapon weight for encumbrance calculations

**How it works**:
- **Tiny races**: Weight feels 2.5x heavier (for encumbrance)
  - Example: 5lb sword counts as 12.5lbs for encumbrance
- **Small races**: Weight feels 1.75x heavier
  - Example: 5lb sword counts as 8.75lbs for encumbrance
- **Normal races**: No change
- **Giant races**: 2.5x heavier (they use giant weapons)
- **Gnome**: 0.6x lighter (they use gnome-sized weapons)

**Rationale**: A 10lb sword is much harder for a 2ft pixie to wield than a 6ft human, even though the actual weight is the same.

### `canRaceUseWeapon(weapon, race, character)`
**Purpose**: Checks if a race can effectively use a weapon

**Restrictions**:
- **Tiny races**:
  - Maximum weapon length: **2ft**
  - Maximum weapon weight: **3lbs**
- **Small races**:
  - Maximum weapon length: **6ft**
  - Maximum weapon weight: **15lbs**
- **Normal races**: No restrictions

**Returns**: `{canUse: boolean, reason: string, effectiveLength: number, effectiveWeight: number}`

---

## Examples

### Example 1: Pixie (Tiny) with Long Sword
- **Base weapon**: Long Sword (3ft reach, 10lbs)
- **Adjusted length**: 3ft × 0.35 = **1.05ft** (effectively a very short sword)
- **Adjusted weight**: 10lbs × 2.5 = **25lbs** (for encumbrance)
- **Can use?**: ❌ **NO** - Too long (3ft > 2ft max) and too heavy (10lbs > 3lbs max)

### Example 2: Pixie (Tiny) with Dagger
- **Base weapon**: Dagger (1ft reach, 2lbs)
- **Adjusted length**: 1ft × 0.35 = **0.35ft** (very short)
- **Adjusted weight**: 2lbs × 2.5 = **5lbs** (for encumbrance)
- **Can use?**: ✅ **YES** - Within limits

### Example 3: Gnome (Small) with Long Sword
- **Base weapon**: Long Sword (3ft reach, 10lbs)
- **Adjusted length**: 3ft × 0.55 = **1.65ft** (short sword reach)
- **Adjusted weight**: 10lbs × 1.75 = **17.5lbs** (for encumbrance)
- **Can use?**: ✅ **YES** - Within limits (3ft < 6ft, 10lbs < 15lbs)
- **Damage**: 2d6 → **1d6** (gnome weapon size reduction)

### Example 4: Kobold (Small) with Short Sword
- **Base weapon**: Short Sword (2ft reach, 6lbs)
- **Adjusted length**: 2ft × 0.55 = **1.1ft** (reduced reach)
- **Adjusted weight**: 6lbs × 1.75 = **10.5lbs** (for encumbrance)
- **Can use?**: ✅ **YES** - Within limits

---

## Integration Points

### Where to Apply

1. **Weapon Length Adjustments**:
   - `getWeaponLength()` in `combatEnvironmentLogic.js` - Should use adjusted length
   - `calculateReachAdvantage()` in `weaponSystem.js` - Should use adjusted length
   - `getReachStrikeModifiers()` in `reachCombatRules.js` - Should use adjusted length

2. **Weapon Weight Adjustments**:
   - Inventory weight calculations
   - Encumbrance calculations
   - Carrying capacity checks

3. **Weapon Usage Restrictions**:
   - Before equipping weapons
   - In weapon selection UI
   - In combat when selecting attacks

---

## Current Status

### ✅ Implemented
- `getAdjustedWeaponLength()` - Function created
- `getAdjustedWeaponWeight()` - Function created
- `canRaceUseWeapon()` - Function created

### ⚠️ Not Yet Integrated
- Weapon length adjustments not applied in combat calculations
- Weapon weight adjustments not applied to inventory/encumbrance
- Weapon usage restrictions not enforced in UI

---

## Recommendations

### 1. **Integrate Length Adjustments**
Update `getWeaponLength()` to use adjusted length:
```javascript
export function getWeaponLength(weapon, character = null) {
  const baseLength = weapon.reach || weapon.length || 3;
  if (character) {
    const { getAdjustedWeaponLength } = require('./weaponSizeSystem.js');
    return getAdjustedWeaponLength(baseLength, character.species || character.race, character);
  }
  return baseLength;
}
```

### 2. **Integrate Weight Adjustments**
Apply weight multiplier when calculating inventory weight:
```javascript
const adjustedWeight = getAdjustedWeaponWeight(weapon.weight, character.species, character);
```

### 3. **Enforce Usage Restrictions**
Check `canRaceUseWeapon()` before allowing weapon equipping:
```javascript
const canUse = canRaceUseWeapon(weapon, character.species, character);
if (!canUse.canUse) {
  alert(canUse.reason);
  return;
}
```

---

## Summary

**Small/Tiny Races Weapon Handling**:
- ✅ Length/reach is reduced proportionally (tiny: 35%, small: 55%)
- ✅ Weight feels heavier for encumbrance (tiny: 2.5x, small: 1.75x)
- ✅ Usage restrictions exist (tiny: max 2ft/3lbs, small: max 6ft/15lbs)
- ⚠️ Not yet integrated into combat calculations
- ⚠️ Not yet enforced in UI

**Next Steps**: Integrate these functions into the combat and inventory systems.


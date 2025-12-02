# Small and Tiny Races: Weapon Length and Weight Summary

## Quick Answer

**Small and tiny races have special handling for weapon length and weight:**

### Weapon Length/Reach Adjustments
- **Tiny races** (Pixie, Sprite, etc.): Weapons reduced to **35% of base length**
  - Example: 3ft sword → 1.05ft effective reach
- **Small races** (Gnome, Kobold, Goblin): Weapons reduced to **55% of base length**
  - Example: 3ft sword → 1.65ft effective reach
- **Normal races**: No change

### Weapon Weight Adjustments
- **Tiny races**: Weight counts as **2.5x heavier** for encumbrance
  - Example: 5lb sword = 12.5lbs encumbrance
- **Small races**: Weight counts as **1.75x heavier** for encumbrance
  - Example: 5lb sword = 8.75lbs encumbrance
- **Normal races**: No change

### Usage Restrictions
- **Tiny races**: Max 2ft length, 3lbs weight
- **Small races**: Max 6ft length, 15lbs weight
- **Normal races**: No restrictions

---

## Detailed Breakdown

### 1. Race Classifications

#### Tiny Races (under 2ft)
- Pixie, Sprite, Faerie, Brownie, Leprechaun, Bogies, etc.
- **Weapon Size**: FAERIE (use creature-specific damage)
- **Size Category**: TINY
- **Weapon Length**: 35% of base
- **Weapon Weight**: 2.5x for encumbrance
- **Max Weapon**: 2ft length, 3lbs weight

#### Small Races (2-4ft)
- Gnome, Kobold, Goblin
- **Weapon Size**: 
  - Gnome: SMALL (reduced damage)
  - Kobold/Goblin: NORMAL (but length/weight adjusted)
- **Size Category**: SMALL
- **Weapon Length**: 55% of base
- **Weapon Weight**: 1.75x for encumbrance (Gnome: 0.6x if using gnome-sized weapons)
- **Max Weapon**: 6ft length, 15lbs weight

#### Normal Races (4-7ft)
- Human, Elf, Dwarf, Orc, etc.
- **Weapon Size**: NORMAL
- **Size Category**: MEDIUM
- **Weapon Length**: 100% of base (no adjustment)
- **Weapon Weight**: 100% of base (no adjustment)
- **Max Weapon**: No restrictions

---

## Functions Added

### `getAdjustedWeaponLength(baseLength, race, character)`
Returns adjusted weapon length for small/tiny races.

**Parameters**:
- `baseLength`: Base weapon length in feet
- `race`: Race/species name
- `character`: Character object (optional, for size category lookup)

**Returns**: Adjusted length in feet

**Examples**:
```javascript
// Pixie with 3ft sword
getAdjustedWeaponLength(3, "Pixie", pixieCharacter) // Returns ~1.05ft

// Gnome with 3ft sword
getAdjustedWeaponLength(3, "Gnome", gnomeCharacter) // Returns ~1.65ft

// Human with 3ft sword
getAdjustedWeaponLength(3, "Human", humanCharacter) // Returns 3ft
```

### `getAdjustedWeaponWeight(baseWeight, race, character)`
Returns adjusted weapon weight for encumbrance calculations.

**Parameters**:
- `baseWeight`: Base weapon weight in lbs
- `race`: Race/species name
- `character`: Character object (optional)

**Returns**: Adjusted weight in lbs (for encumbrance)

**Examples**:
```javascript
// Pixie with 5lb sword
getAdjustedWeaponWeight(5, "Pixie", pixieCharacter) // Returns 12.5lbs

// Gnome with 5lb sword (using normal weapon)
getAdjustedWeaponWeight(5, "Gnome", gnomeCharacter) // Returns 8.75lbs

// Gnome with gnome-sized weapon
getAdjustedWeaponWeight(5, "Gnome", gnomeCharacter) // Returns 3lbs (0.6x multiplier)
```

### `canRaceUseWeapon(weapon, race, character)`
Checks if a race can effectively use a weapon.

**Returns**: `{canUse: boolean, reason: string, effectiveLength: number, effectiveWeight: number}`

**Examples**:
```javascript
// Pixie trying to use Long Sword (3ft, 10lbs)
canRaceUseWeapon(longSword, "Pixie", pixieCharacter)
// Returns: {canUse: false, reason: "Weapon too long (3ft) for tiny race - maximum 2ft", ...}

// Pixie trying to use Dagger (1ft, 2lbs)
canRaceUseWeapon(dagger, "Pixie", pixieCharacter)
// Returns: {canUse: true, reason: "Weapon usable by race", effectiveLength: 0.35ft, effectiveWeight: 5lbs}
```

---

## Integration Status

### ✅ Implemented
- Functions created in `weaponSizeSystem.js`
- `getWeaponLength()` updated to accept character parameter
- `getReachStrikeModifiers()` updated to accept attacker parameter
- `compareWeaponReach()` updated to accept character parameters

### ⚠️ Partially Integrated
- Length adjustments applied in `getWeaponLength()` when character provided
- Strike modifiers use adjusted length when attacker provided
- Weight adjustments **not yet applied** to inventory/encumbrance calculations
- Usage restrictions **not yet enforced** in UI

### ❌ Not Integrated
- Weight adjustments in inventory weight calculations
- Weight adjustments in encumbrance system
- Usage restrictions in weapon selection UI
- Usage restrictions in weapon equipping

---

## How It Works in Combat

### Example: Pixie vs Human

**Pixie with Dagger**:
- Base: 1ft reach, 2lbs
- Adjusted: 0.35ft reach, 5lbs encumbrance
- Damage: Uses creature-specific damage (from stats)
- Strike: -2 (tiny size penalty) + reach modifiers

**Human with Long Sword**:
- Base: 3ft reach, 10lbs
- Adjusted: 3ft reach, 10lbs
- Damage: 2d6
- Strike: +0 (normal size) + reach modifiers

**Reach Comparison**:
- Human has massive reach advantage (3ft vs 0.35ft)
- Human gets +2 strike (reach advantage)
- Pixie gets -2 strike (reach disadvantage)

---

## Recommendations

### 1. **Apply Weight to Inventory**
Update inventory weight calculations to use `getAdjustedWeaponWeight()`:
```javascript
const adjustedWeight = getAdjustedWeaponWeight(weapon.weight, character.species, character);
totalWeight += adjustedWeight;
```

### 2. **Enforce Usage Restrictions**
Check `canRaceUseWeapon()` before equipping:
```javascript
const canUse = canRaceUseWeapon(weapon, character.species, character);
if (!canUse.canUse) {
  showError(canUse.reason);
  return;
}
```

### 3. **Update UI**
Show adjusted values in weapon tooltips:
- "Effective Reach: 1.05ft (Pixie-sized)"
- "Encumbrance Weight: 12.5lbs (2.5x for tiny race)"

---

## Summary

**Small/Tiny Races**:
- ✅ Length/reach reduced proportionally
- ✅ Weight feels heavier for encumbrance
- ✅ Usage restrictions defined
- ⚠️ Partially integrated into combat
- ❌ Not yet integrated into inventory/UI

The system is **functional but needs full integration** into inventory and UI systems.


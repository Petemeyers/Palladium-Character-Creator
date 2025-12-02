# Races with Giant Weapon Bonus (+1 Die of Damage)

## Overview

These races receive the **giant weapon bonus**, which adds **+1 extra die** to weapon damage (e.g., Long Sword 2d6 → 3d6).

**Bonus Effect**: All weapons deal +1 extra die of damage
**Weight Multiplier**: Weapons are 2.5x heavier for encumbrance

---

## Complete List

### 1. **Ogre**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 2. **Troll**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 3. **Wolfen**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 4. **Algor Giant**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 5. **Cyclops Giant**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 6. **Jotan Giant**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 7. **Gigantes Giant**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 8. **Nimro Giant**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 9. **Titan Giant**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 10. **Giant** (generic)

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 11. **Sea Giant**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

### 12. **Titan**

- Giant weapon bonus: ✅
- Example: Long Sword 2d6 → **3d6**

---

## Summary

**Total Races with Giant Weapon Bonus: 12**

### Categories:

- **Common Giant Races**: Ogre, Troll, Wolfen (3)
- **Specific Giant Types**: Algor, Cyclops, Jotan, Gigantes, Nimro, Titan, Sea Giant (7)
- **Generic**: Giant, Titan (2)

---

## How It Works

### Damage Calculation

1. Base weapon damage: `2d6` (Long Sword)
2. Giant weapon bonus applied: `2d6` → `3d6` (+1 die)
3. Final damage: `3d6`

### Weight Calculation

1. Base weapon weight: `10 lbs` (Long Sword)
2. Giant weapon multiplier: `10 × 2.5 = 25 lbs` (for encumbrance)
3. Final encumbrance weight: `25 lbs`

---

## Code Reference

**File**: `src/utils/weaponSizeSystem.js`

```javascript
export const RACE_WEAPON_SIZE = {
  // Giant-weapon races (+1 die of damage)
  Ogre: WEAPON_SIZE.GIANT,
  Troll: WEAPON_SIZE.GIANT,
  Wolfen: WEAPON_SIZE.GIANT,
  "Algor Giant": WEAPON_SIZE.GIANT,
  "Cyclops Giant": WEAPON_SIZE.GIANT,
  "Jotan Giant": WEAPON_SIZE.GIANT,
  "Gigantes Giant": WEAPON_SIZE.GIANT,
  "Nimro Giant": WEAPON_SIZE.GIANT,
  "Titan Giant": WEAPON_SIZE.GIANT,
  Giant: WEAPON_SIZE.GIANT,
  "Sea Giant": WEAPON_SIZE.GIANT,
  Titan: WEAPON_SIZE.GIANT,
  // ...
};
```

---

## Examples

### Example 1: Troll with Long Sword

- **Base Damage**: 2d6
- **Giant Bonus**: +1 die
- **Final Damage**: **3d6**
- **Weight**: 10lbs → 25lbs (encumbrance)

### Example 2: Ogre with Short Sword

- **Base Damage**: 1d6
- **Giant Bonus**: +1 die
- **Final Damage**: **2d6**
- **Weight**: 6lbs → 15lbs (encumbrance)

### Example 3: Wolfen with Dagger

- **Base Damage**: 1d4
- **Giant Bonus**: +1 die
- **Final Damage**: **2d4**
- **Weight**: 2lbs → 5lbs (encumbrance)

---

## Notes

- The bonus applies to **all weapons**, not just melee weapons
- The bonus is **+1 die**, not +1 to damage
- Weight multiplier affects **encumbrance calculations**, not actual item weight
- Based on **1994 Palladium Fantasy RPG** official rules

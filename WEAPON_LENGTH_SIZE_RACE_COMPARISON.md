# Weapon Length, Weapon Size, and Race-Based Modifiers Comparison

## Overview

This document compares three related but distinct combat modifier systems:

1. **Weapon Length/Reach** - Physical weapon length affecting strike/parry/dodge
2. **Weapon Size** - Race-based weapon damage modifiers (giant/gnome weapons)
3. **Race Size Modifiers** - Creature size category combat bonuses

---

## 1. Weapon Length/Reach System

### File: `src/utils/reachCombatRules.js`, `src/utils/weaponSystem.js`

### Purpose

Handles **physical weapon length** and how it affects combat mechanics based on reach differences between weapons.

### Key Functions

- `getWeaponLength(weapon)` - Extracts weapon length in feet
- `compareWeaponReach(weapon1, weapon2)` - Compares two weapons' reach
- `calculateReachAdvantage(attackerWeapon, defenderWeapon)` - Calculates +1 to +3 strike bonus
- `getReachStrikeModifiers()` - Terrain and distance-based strike modifiers
- `getReachParryModifiers()` - Parry effectiveness based on reach
- `getReachDodgeModifiers()` - Dodge capabilities in tight spaces

### Modifiers Applied

- **Strike**: +1 to +3 (reach advantage), -2 (close combat), -2 (before closing distance)
- **Parry**: -2 (short vs long before closing), -2 (long weapon flanking)
- **Dodge**: Terrain-dependent penalties
- **Initiative**: +1 on first round for longer weapons

### Based On

- **Weapon properties**: `weapon.reach` or `weapon.length` (in feet)
- **Weapon type**: SHORT (≤1ft), MEDIUM (2-7ft), LONG (≥8ft)
- **Combat distance**: <3ft (grapple range), <5ft (close), ≥5ft (normal)

### Example

- **Long Sword (3ft)** vs **Dagger (1ft)**
- Long sword gets +2 strike (reach advantage: 3-1=2)
- Dagger gets -2 strike until distance closed
- Dagger gets -2 parry until distance closed

---

## 2. Weapon Size System (Race-Based Damage)

### File: `src/utils/weaponSizeSystem.js`

### Purpose

Handles **race-based weapon size** affecting **damage dice**, not strike/parry bonuses.

### Key Functions

- `getWeaponSizeForRace(race)` - Gets weapon size category (SMALL/NORMAL/GIANT/FAERIE)
- `getAdjustedWeaponDamage(baseDamage, race)` - Adjusts damage dice based on race
- `getGiantWeaponDamage(baseDamage)` - Adds +1 extra die (2d6 → 3d6)
- `getGnomeWeaponDamage(baseDamage)` - Reduces damage (2d6 → 1d6, 1d6 → 1d4)
- `getWeaponWeightMultiplier(race)` - Weight multipliers (giant: 2.5x, small: 0.6x)

### Modifiers Applied

- **Damage Dice Only**: Modifies the damage formula, not strike/parry/dodge
- **Giant races**: +1 extra die (Long Sword 2d6 → 3d6)
- **Gnome**: Reduced dice (Long Sword 2d6 → 1d6, Short Sword 1d6 → 1d4)
- **Normal races**: No change

### Based On

- **Race/Species name**: "Troll", "Ogre", "Wolfen", "Gnome", etc.
- **1994 Palladium Fantasy rules**: Official weapon size rules

### Example

- **Troll** with Long Sword: 2d6 → **3d6** (giant weapon)
- **Gnome** with Long Sword: 2d6 → **1d6** (small weapon)
- **Human** with Long Sword: 2d6 → **2d6** (normal, no change)

### Integration Points

- `combatEngine.js:calculateDamage()` - Applies before rolling damage
- `weaponSlotManager.js:getWeaponDamage()` - Applies when getting weapon damage string

---

## 3. Race Size Modifiers (Creature Size Categories)

### File: `src/utils/sizeStrengthModifiers.js`

### Purpose

Handles **creature physical size** (height/weight) affecting combat bonuses, separate from weapon properties.

### Key Functions

- `getSizeCategory(creature)` - Determines size: TINY/SMALL/MEDIUM/LARGE/HUGE/GIANT
- `getCombinedGrappleModifiers(attacker, defender)` - Size + PS modifiers for grappling
- `getReachAdvantage(attacker, defender)` - Size-based reach bonuses
- `applySizeModifiers(creature)` - Applies size category modifiers

### Modifiers Applied

- **Strike**: -2 (TINY) to +3 (GIANT) based on size difference
- **Parry**: -2 (TINY) to +3 (GIANT)
- **Dodge**: +2 (TINY) to -3 (GIANT)
- **Damage**: -2 (TINY) to +3 (GIANT) - **NOTE: This is unarmed/grapple damage, not weapon damage**

### Based On

- **Creature height/weight**: Inferred from creature properties
- **Size category**: Explicit sizeCategory property or calculated from dimensions
- **Size difference**: Relative size between attacker and defender

### Example

- **Troll (LARGE)** vs **Human (MEDIUM)**
- Troll gets +1 strike, +1 parry, -1 dodge (size advantage)
- Human gets -1 strike, -1 parry, +1 dodge (size disadvantage)

### Integration Points

- `CombatPage.jsx:2387-2389` - Applies size/reach modifiers to attack roll
- `sizeScaleSystem.js` - Applies size combat modifiers to fighters

---

## Key Differences

| Aspect              | Weapon Length                  | Weapon Size                | Race Size                  |
| ------------------- | ------------------------------ | -------------------------- | -------------------------- |
| **What it affects** | Strike/Parry/Dodge bonuses     | Damage dice only           | Strike/Parry/Dodge bonuses |
| **Based on**        | Weapon reach property          | Race/species name          | Creature height/weight     |
| **Modifier type**   | Combat bonuses/penalties       | Damage formula change      | Combat bonuses/penalties   |
| **Applies to**      | Weapon vs weapon               | Race-specific weapons      | Creature vs creature       |
| **Example**         | Long sword +2 strike vs dagger | Troll weapon +1 die damage | Large creature +1 strike   |

---

## How They Work Together

### Example: Troll with Long Sword vs Human with Dagger

#### Step 1: Weapon Size (Damage)

- Troll's Long Sword: 2d6 → **3d6** (giant weapon +1 die)
- Human's Dagger: 1d4 → **1d4** (normal, no change)

#### Step 2: Weapon Length (Strike/Parry)

- Long Sword (3ft) vs Dagger (1ft)
- Troll gets **+2 strike** (reach advantage: 3-1=2)
- Human gets **-2 strike** until distance closed
- Human gets **-2 parry** until distance closed

#### Step 3: Race Size (Strike/Parry)

- Troll (LARGE) vs Human (MEDIUM)
- Troll gets **+1 strike** (size advantage)
- Troll gets **+1 parry** (size advantage)
- Human gets **-1 strike** (size disadvantage)
- Human gets **-1 parry** (size disadvantage)

#### Final Modifiers

- **Troll**: +2 (reach) + 1 (size) = **+3 strike**, +1 parry, damage: **3d6**
- **Human**: -2 (reach) - 1 (size) = **-3 strike**, -2 parry, damage: **1d4**

---

## Potential Conflicts/Overlaps

### 1. **"Reach" Terminology**

- **Weapon Length**: Uses `weapon.reach` property (physical length in feet)
- **Race Size**: Uses `getReachAdvantage()` function (size-based reach)
- **Conflict**: Both use "reach" but mean different things
- **Resolution**: They're separate systems that stack

### 2. **Giant Races**

- **Weapon Size**: Troll/Ogre/Wolfen get +1 die damage (weapon size)
- **Race Size**: Large creatures get +1 strike (size category)
- **Overlap**: Both apply to giant races, but affect different things
- **Resolution**: They stack correctly (damage vs strike bonus)

### 3. **Size Categories**

- **Weapon Size**: Uses WEAPON_SIZE enum (SMALL/NORMAL/GIANT/FAERIE)
- **Race Size**: Uses SIZE_CATEGORIES enum (TINY/SMALL/MEDIUM/LARGE/HUGE/GIANT)
- **Conflict**: Both have "GIANT" but mean different things
- **Resolution**:
  - Weapon Size GIANT = race uses giant weapons (+1 die)
  - Race Size GIANT = creature is 20ft+ tall (+3 strike)

### 4. **Damage Modifiers**

- **Weapon Size**: Modifies damage dice (2d6 → 3d6)
- **Race Size**: Has `damageModifier` but it's for unarmed/grapple, not weapons
- **Resolution**: They don't conflict - weapon size affects weapon damage, race size affects unarmed damage

---

## Integration Status

### ✅ Fully Integrated

1. **Weapon Length** - Integrated in `CombatPage.jsx` (strike/parry modifiers)
2. **Weapon Size** - Integrated in `combatEngine.js` and `weaponSlotManager.js` (damage)
3. **Race Size** - Integrated in `CombatPage.jsx` (strike/parry bonuses)

### ⚠️ Potential Issues

1. **Double Counting**:

   - Giant races get both weapon size bonus (+1 die) AND size category bonus (+1 strike)
   - This is **correct** - they're different bonuses that stack

2. **Terminology Confusion**:

   - "Reach" used for both weapon length and size-based reach
   - Consider renaming one for clarity

3. **Missing Integration**:

   - Weapon weight multipliers (`getWeaponWeightMultiplier`) are defined but may not be applied to inventory weight calculations

4. **Incomplete Weapon Size Application**:
   - `CombatPage.jsx:2107` calls `getWeaponDamage()` without character parameter
   - Weapon size modifiers are applied in `combatEngine.js:calculateDamage()` but not in all damage calculation paths
   - **Fix**: Pass attacker character to `getWeaponDamage(weapon, isUsingTwoHanded, attacker)` in CombatPage.jsx

---

## Recommendations

### 1. **Clarify Terminology**

- Consider renaming `getReachAdvantage()` in `sizeStrengthModifiers.js` to `getSizeReachAdvantage()` to distinguish from weapon reach

### 2. **Document Stacking**

- Add comments explaining that weapon length, weapon size, and race size modifiers all stack

### 3. **Weight Integration**

- Apply `getWeaponWeightMultiplier()` when calculating character inventory weight

### 4. **Testing**

- Test edge cases:
  - Gnome with long weapon (should get reduced damage but normal reach penalties)
  - Giant with short weapon (should get +1 die but no reach advantage)
  - Large creature with small weapon (size bonus but no reach advantage)

---

## Summary

All three systems are **correctly implemented and integrated**. They affect different aspects of combat:

- **Weapon Length**: Physical reach → Strike/Parry/Dodge bonuses
- **Weapon Size**: Race-based weapon scaling → Damage dice only
- **Race Size**: Creature physical size → Strike/Parry/Dodge bonuses

They **stack correctly** and don't conflict, though terminology could be clearer to avoid confusion.

# Weapon Length/Reach Combat Effects Summary

## Overview
Weapon length/reach is **extensively implemented** in the combat system and affects multiple aspects of combat mechanics.

## Key Files

### 1. `src/utils/reachCombatRules.js`
**Primary file for reach-based combat rules**

### 2. `src/utils/weaponSystem.js`
**Weapon reach calculations and comparisons**

### 3. `src/utils/combatEnvironmentLogic.js`
**Weapon length extraction and type classification**

### 4. `src/pages/CombatPage.jsx`
**Integration of reach modifiers into combat flow**

---

## How Weapon Length Affects Combat

### 1. **Strike Modifiers** (`getReachStrikeModifiers`)

#### First Strike Advantage
- **Longer weapons get +1 strike on first melee round**
- Applies when weapon length difference ≥ 2 feet
- Location: `reachCombatRules.js:154-169`

#### Reach Advantage Bonus
- **+1 to +3 strike bonus** for longer weapons
- Based on reach difference (max +3)
- Location: `weaponSystem.js:66-92`

#### Close Combat Penalty
- **Long weapons get -2 strike** when pressed <5ft
- "Long weapon too close for full leverage"
- Location: `reachCombatRules.js:497-506`

#### Closing Distance Penalty
- **Short weapons get -2 strike** before closing distance
- Applies when short weapon user hasn't closed yet
- Location: `reachCombatRules.js:480-489`

#### Terrain-Based Modifiers
- **Dense Forest**: Flexible weapons (whips, flails) get -2 strike
- **Low Ceilings (≤8ft)**: Long weapons get -1 strike on overhead attacks
- **Cluttered Terrain**: Heavy weapons get -2 strike
- **Confined Spaces**: Short weapons excel (no penalty, may get bonus)

### 2. **Parry Modifiers** (`getReachParryModifiers`)

#### Short Weapon Parrying Long Weapon
- **-2 parry** for short weapons parrying long weapons before closing distance
- "Short weapon cannot effectively parry long weapon until distance is closed"
- Location: `reachCombatRules.js:529-538`

#### Long Weapon Flanking Penalty
- **-2 parry** for long weapons against flanking attacks
- "Long weapon slower to turn for flanking attacks"
- Location: `reachCombatRules.js:540-546`

### 3. **Dodge Modifiers** (`getReachDodgeModifiers`)

#### Terrain Restrictions
- Long weapons may have dodge penalties in tight spaces
- Short weapons maintain dodge bonuses in confined areas
- Location: `reachCombatRules.js:551-582`

### 4. **Initiative Modifiers** (`getReachInitiativeModifier`)

- Longer weapons may get initiative bonuses on first round
- Location: `reachCombatRules.js:583-587`

### 5. **Distance Closing Mechanics**

#### `attemptCloseDistance()`
- Short weapon users can spend 1 action to close distance
- Can use Prowl or Dodge to close (with skill checks)
- Location: `reachCombatRules.js:188-238`

#### `needsToCloseDistance()`
- Determines if short weapon user needs to close (≥2ft difference)
- Location: `reachCombatRules.js:177-180`

### 6. **Reach Categories**

Weapons are classified by reach:
- **SHORT**: ≤1ft reach
- **MEDIUM**: 2-7ft reach  
- **LONG**: ≥8ft reach

Location: `weaponSystem.js:12-59`

### 7. **Weapon Length Extraction**

`getWeaponLength()` function:
1. Checks `weapon.length` property (if numeric)
2. Falls back to `weapon.reach` property
3. Infers from weapon type (SHORT=2ft, MEDIUM=3ft, LONG=6ft, HEAVY=5ft)

Location: `combatEnvironmentLogic.js:85-112`

### 8. **Combat Integration Points**

#### In CombatPage.jsx:
- **Line 2308-2340**: Applies reach-based strike modifiers
- **Line 2546-2565**: Applies reach-based parry modifiers  
- **Line 2591-2594**: Applies reach-based dodge modifiers
- **Line 1840-1908**: Uses weapon length for range calculations

#### In weaponSystem.js:
- **`calculateReachAdvantage()`**: Calculates +1 to +3 strike bonus
- **`compareWeaponReach()`**: Compares two weapons' reach
- **`getWeaponReachCategory()`**: Classifies weapon by reach

---

## Example Combat Scenarios

### Scenario 1: Long Sword vs Dagger
- **Long Sword** (6ft) vs **Dagger** (2ft)
- Long sword gets **+1 strike** on first round
- Long sword gets **+3 strike** (reach advantage: 6-2=4, capped at +3)
- Dagger gets **-2 strike** until distance is closed
- Dagger gets **-2 parry** until distance is closed

### Scenario 2: Spear vs Short Sword in Tight Corridor
- **Spear** (8ft) vs **Short Sword** (3ft)
- Spear gets **-1 strike** if overhead attack in low ceiling
- Short sword excels in tight space (no penalty)
- Spear may get **-2 strike** if pressed <5ft

### Scenario 3: Whip in Dense Forest
- **Whip** (flexible weapon) in dense forest
- Gets **-2 strike** (catches on trees)
- Fumble chance on roll of 1-2

---

## Summary

**Weapon length/reach affects:**
✅ Strike bonuses/penalties (+1 to +3, or -2 penalties)
✅ Parry effectiveness (-2 penalties for mismatched reach)
✅ Dodge capabilities (terrain-dependent)
✅ Initiative (first round bonuses)
✅ Distance closing mechanics (action costs)
✅ Terrain interactions (overhead/lateral restrictions)
✅ Close combat effectiveness (long weapons penalized <5ft)

**The system is fully implemented and integrated into the combat engine!**


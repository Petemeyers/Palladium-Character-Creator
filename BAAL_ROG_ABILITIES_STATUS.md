# Baal-Rog Abilities Implementation Status

## Summary

This document tracks the implementation status of Baal-Rog's abilities from `bestiary.json` (lines 5614-5671).

---

## ✅ IMPLEMENTED

### 1. **Flight (Fly 30 mph)**

- **Status**: ✅ Fully implemented
- **Location**: `src/utils/abilitySystem.js` lines 158-187
- **How it works**: Parses "Fly 30 mph" and sets `movement.flight.mphSpeed = 30`
- **Notes**: Baal-Rog can fly in combat

### 2. **Night Vision (90 ft)**

- **Status**: ✅ Fully implemented
- **Location**: `src/utils/abilitySystem.js` lines 39-47
- **How it works**: Parses "Night vision 90 ft" and sets `senses.nightvision.range = 90`

### 3. **See and Turn Invisible**

- **Status**: ✅ Partially implemented
- **Location**: `src/utils/abilitySystem.js` lines 198-208
- **How it works**:
  - "See invisible" → `senses.seeInvisible = true`
  - "Turn invisible" → `senses.invisibility = true`
- **Notes**: Parsing works, but invisibility mechanics may need verification

### 4. **Impervious to Fire (no damage)**

- **Status**: ✅ Fully implemented
- **Location**: `src/utils/abilitySystem.js` lines 137-156
- **How it works**: Parses "Impervious to fire" and adds "fire" to `impervious_to` array
- **Damage Resistance**: `src/utils/abilitySystem.js` lines 440-515 checks `impervious_to` and returns `multiplier: 0` for fire damage
- **Notes**: Baal-Rog should take 0 damage from fire attacks

### 5. **Bio-Regeneration (1d8 per melee)**

- **Status**: ✅ Fully implemented
- **Location**:
  - Parsing: `src/utils/abilitySystem.js` lines 49-65
  - Application: `src/utils/abilitySystem.js` lines 386-431
  - Combat integration: `src/pages/CombatPage.jsx` (applied at start of each melee round)
- **How it works**: Heals 1d8 HP every melee round
- **Notes**: Working correctly

---

## ⚠️ PARTIALLY IMPLEMENTED / NEEDS WORK

### 6. **Magic Abilities: "All fire elemental spells (levels 1-4) plus Fire Whip (level 7)"**

- **Status**: ⚠️ Partially implemented
- **Current Implementation**: `src/pages/CombatPage.jsx` lines 8255-8287
- **Problems**:
  1. ❌ Only handles simple "levels 1-5" pattern, not "levels 1-4 plus Fire Whip (level 7)"
  2. ❌ Does NOT filter for "fire elemental" spells specifically (loads all spells)
  3. ❌ Does NOT include the specific "Fire Whip" spell mentioned
  4. ❌ Does NOT respect "at 5th-level proficiency" (proficiency level not used)
- **What needs to be done**:
  - Parse complex magicAbilities strings with multiple level ranges
  - Filter spells by element type (fire, earth, air, water)
  - Add specific spell names mentioned (e.g., "Fire Whip")
  - Consider proficiency level for spell selection

### 7. **Clerical Abilities**

- **Status**: ⚠️ Partially implemented
- **Current Implementation**:
  - `clericalHealingTouch` exists in `src/utils/healingSystem.js` lines 163-229
  - But `clericalAbilities` array from bestiary is NOT parsed or connected
- **Missing Abilities**:
  - ❌ "Animate/control 2-12 dead (61%)" - NOT implemented
  - ❌ "Turn dead 61%" - NOT implemented
  - ❌ "Exorcism 29%" - NOT implemented
  - ❌ "Remove curse 28%" - NOT implemented
  - ⚠️ "Healing touch 1-8" - Function exists but not connected to bestiary data
- **What needs to be done**:
  - Parse `clericalAbilities` array from bestiary entries
  - Create functions for animate dead, turn dead, exorcism, remove curse
  - Connect healing touch to bestiary data (currently only works for OCC-based clerics)
  - Add these abilities to AI decision-making for Baal-Rog

---

## ❌ NOT IMPLEMENTED

### 8. **Dimensional Teleport (57% at 70)**

- **Status**: ❌ NOT implemented
- **Evidence**: No parsing in `abilitySystem.js`, no teleport mechanics found
- **What needs to be done**:
  - Parse "Dimensional teleport X%" from abilities
  - Create teleport action/ability
  - Add skill check (57% base, +13% at level 70 = 70% total)
  - Integrate into combat actions (escape, repositioning)

### 9. **I.Q. 14**

- **Status**: ❌ NOT implemented
- **Notes**: Intelligence stat not used in combat system
- **Priority**: Low (mostly flavor/roleplay stat)

### 10. **Knows All Languages**

- **Status**: ❌ NOT implemented
- **Notes**: Language system not implemented
- **Priority**: Low (mostly flavor/roleplay)

---

## Recommendations

### High Priority Fixes:

1. **Fix Magic Abilities Parsing** - Baal-Rog should have fire elemental spells, not random spells
2. **Implement Dimensional Teleport** - Important tactical ability for a powerful demon
3. **Connect Clerical Abilities** - Baal-Rog should be able to use its clerical powers

### Medium Priority:

4. **Add Fire Whip Spell** - Specific spell mentioned in magicAbilities
5. **Filter Spells by Element** - Support "fire elemental", "earth elemental", etc.

### Low Priority:

6. **I.Q. and Languages** - Flavor stats, not critical for combat

---

## Code Locations Reference

- **Ability Parsing**: `src/utils/abilitySystem.js`
- **Spell Loading**: `src/pages/CombatPage.jsx` lines 8255-8287
- **Damage Resistance**: `src/utils/abilitySystem.js` lines 440-515
- **Bio-Regeneration**: `src/utils/abilitySystem.js` lines 386-431
- **Clerical Healing**: `src/utils/healingSystem.js` lines 163-229
- **Bestiary Entry**: `src/data/bestiary.json` lines 5614-5671

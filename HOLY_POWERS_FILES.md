# Holy Powers, Cleric, and Priest Files

## Core Holy Power Implementation Files

### 1. **`src/utils/healingSystem.js`**
   - **Function**: `clericalHealingTouch(healer, target)`
   - **Purpose**: Divine healing for Clerics, Priests, Shamans
   - **Effect**: Restores 2D6+2 HP, touch only
   - **Limitations**: Cannot heal self, undead, or artificial beings
   - **Classes**: Cleric, Priest, Shaman

### 2. **`src/utils/courageAuraSystem.js`**
   - **Purpose**: Holy/Courage Aura system for divine characters
   - **Features**:
     - `hasCourageAura(character)` - Checks if character has courage aura
     - `getCourageAuraPreset(character)` - Gets aura preset
     - `processCourageAuras(combatants, positions, log)` - Applies aura effects
     - `clearCourageBonuses(combatants)` - Cleans up after melee
   - **Presets**:
     - Priest of Light: 60ft radius, +4 bonus, dispels fear
     - Cleric: 40ft radius, +3 bonus, dispels fear
     - Priest: 40ft radius, +3 bonus, dispels fear
     - Paladin: 50ft radius, +2 bonus, dispels fear
     - Priest of Darkness: 40ft radius, +2 bonus, no fear dispel
   - **Effects**: Horror Factor save bonuses, fear dispelling

### 3. **`src/utils/protectionCircleSystem.js`**
   - **Purpose**: Protection circle creation and management
   - **Circle Types**:
     - Protection from Evil
     - Protection from Good
     - Protection from Magic
     - Protection from Psionics
     - Warding
   - **Status**: TODO - Implementation incomplete

### 4. **`src/utils/protectionCircleMapSystem.js`**
   - **Purpose**: Map integration for protection circles
   - **Functions**:
     - `addCircleToMap(map, circle)`
     - `removeCircleFromMap(map, circleId)`
     - `updateProtectionCirclesOnMap()`
   - **Status**: TODO - Implementation incomplete

### 5. **`src/components/ProtectionCircle.jsx`**
   - **Purpose**: React component for visualizing protection circles on tactical map
   - **Features**: SVG rendering, animations, tooltips
   - **Integration**: Works with hex and square grids

## Data Files

### 6. **`src/data/occData.js`**
   - **OCCs Defined**:
     - `PriestOfLight` - Category: Clergy, "Holy healer and protector against evil"
     - `PriestOfDarkness` - Category: Clergy, "Dark priest with destructive powers"
   - **Skills**: "Clerical abilities and prayers" listed in occSkills

### 7. **`src/data/palladium_dataset.json`**
   - Contains PriestOfLight and PriestOfDarkness OCC definitions
   - References "Clerical abilities and prayers"

### 8. **`src/data/bestiary.json`**
   - Contains `clericalAbilities` field for some creatures
   - Examples:
     - "Remove curse 33%"
     - "Turn dead 61%" (for Baal-Rog)
     - "None" (for creatures without clerical abilities)

### 9. **`src/data/combatActions.json`**
   - **Clergy Section** (lines 193-214):
     - Classes: Priest, Shaman, Healer
     - Bonuses:
       - Healing and Buffs
       - Protective Actions
       - **Turning**: "Turn/banish undead or demons"
   - **Status**: Describes mechanics but implementation may be incomplete

### 10. **`src/components/data.jsx`**
   - **Priest Abilities** (lines 1440-1461):
     - "Spell: Heal" - Heal 3d6+3 HP, 4 uses/day
     - "Spell: Turn Undead" - Force undead to flee, 3 uses/day
     - "Divine Protection" - +2 to all defense rolls

## Integration Files

### 11. **`src/pages/CombatPage.jsx`**
   - Uses `clericalHealingTouch()` from healingSystem.js
   - Uses `courageAuraSystem.js` for holy auras
   - References protection circles in spell casting
   - Has "holy" log type for holy power messages

### 12. **`src/utils/unifiedAbilities.js`**
   - `getAvailableAbilities(character)` - May include priest abilities
   - `getUnifiedAbilities(character)` - Unified ability system

## Missing Implementations

### Not Found (Referenced but not implemented):
- **Turn Undead** - Referenced in data files but no dedicated implementation
- **Banish Demon** - Referenced in combatActions.json but not implemented
- **Exorcism** - Not found in codebase
- **Clerical Abilities System** - Bestiary has `clericalAbilities` field but no system to use it

## Summary

**Implemented:**
- ✅ Divine Healing Touch (`healingSystem.js`)
- ✅ Courage/Holy Aura System (`courageAuraSystem.js`)
- ✅ Protection Circle Framework (`protectionCircleSystem.js`, `ProtectionCircle.jsx`)
- ✅ OCC Definitions (`occData.js`, `palladium_dataset.json`)
- ✅ Data Structures (`bestiary.json`, `combatActions.json`, `data.jsx`)

**Partially Implemented:**
- ⚠️ Protection Circles (framework exists, implementation incomplete)
- ⚠️ Turn Undead (referenced in data, no implementation)

**Not Implemented:**
- ❌ Turn Undead mechanics
- ❌ Banish Demon mechanics
- ❌ Exorcism mechanics
- ❌ Clerical Abilities system (to use `clericalAbilities` from bestiary)


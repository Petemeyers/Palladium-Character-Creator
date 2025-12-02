# CombatPage.jsx Refactoring Plan

## Overview
CombatPage.jsx is over 500KB, causing Babel to disable optimizations. This plan outlines a concrete split into smaller, maintainable modules.

## Current Structure Analysis

### File Size: ~500KB+ (~10,990+ lines)
### Major Sections:
1. **Imports** (lines 1-172) - 53 imports
2. **Helper Functions** (lines 174-680) - Spell/power parsing, AI utilities
3. **Component Definition** (lines 681-8892) - Main component with:
   - State declarations (50+ useState hooks)
   - Callbacks/handlers (100+ useCallback functions)
   - Effects (20+ useEffect hooks)
   - Large handler functions (attack, movement, AI, etc.)
4. **Render/JSX** (lines 8893-10990) - Massive JSX tree

---

## Refactoring Strategy

### Phase 1: Extract Utility Functions (No breaking changes)

#### 1.1 Spell/Power Parsing Utilities
**New File**: `src/utils/spellParsingUtils.js`
- `parseRangeToFeet()` (line ~300)
- `getSpellCost()` (line ~320)
- `getPsionicCost()` (line ~347)
- `extractHealingFormulaFromText()` (line ~364)
- `extractDamageFormulaFromText()` (line ~412)
- `findSpellInUnifiedAbilities()` (line ~464)
- `getSpellRangeInFeet()` (line ~485)
- `getPsionicRangeInFeet()` (line ~501)
- Constants: `HEAL_KEYWORDS`, `TOUCH_RANGE_HINTS`, `SUPPORT_KEYWORDS`, `HARMFUL_KEYWORDS`

**Impact**: ~200 lines moved, pure functions, easy to test

---

#### 1.2 Combat Calculation Utilities
**New File**: `src/utils/combatCalculations.js`
- `getCasterSpellDC()` (line ~581)
- `calculateSpellSave()` (line ~598)
- `gatherSavingThrowBonuses()` (line ~552)
- `getPEMagicBonus()` / `getMEMagicBonus()` (if exists inline)
- `parseDamageRoll()` - extract damage parsing logic
- `parseHealingRoll()` - extract healing parsing logic

**Impact**: ~150 lines moved

---

#### 1.3 AI Movement Utilities
**New File**: `src/utils/aiMovementUtils.js`
- `minDistanceToThreats()` (line ~174)
- `findRetreatDestination()` (line ~186)
- Movement pathfinding helpers
- Threat assessment functions

**Impact**: ~100 lines moved

---

### Phase 2: Extract Custom Hooks (State Management)

#### 2.1 Combat State Hook
**New File**: `src/hooks/useCombatState.js`
**Extract**:
- Core combat state: `fighters`, `turnIndex`, `meleeRound`, `turnCounter`, `combatActive`
- Initiative tracking
- Turn management logic
- `currentFighter` derived state

**Exports**:
```javascript
{
  fighters,
  setFighters,
  turnIndex,
  setTurnIndex,
  currentFighter,
  meleeRound,
  turnCounter,
  combatActive,
  setCombatActive,
  nextTurn,
  // ... etc
}
```

**Impact**: ~300 lines moved, cleaner state management

---

#### 2.2 Combat UI State Hook
**New File**: `src/hooks/useCombatUIState.js`
**Extract**:
- UI toggles: `showTacticalMap`, `show3DView`, `showPhase0Modal`, etc.
- Modal states
- Selection states: `selectedTarget`, `selectedWeaponSlot`, `selectedSpell`, etc.
- Mode states: `mode`, `mapViewMode`, `movementMode`, etc.

**Impact**: ~200 lines moved

---

#### 2.3 Combat Log Hook
**New File**: `src/hooks/useCombatLog.js`
**Extract**:
- `log` state and `setLog`
- `addLog()` function
- `logFilterType`, `logSortOrder`
- Log filtering/sorting logic
- Auto-scroll logic

**Exports**:
```javascript
{
  log,
  addLog,
  logFilterType,
  setLogFilterType,
  logSortOrder,
  setLogSortOrder,
  clearLog,
  filteredAndSortedLog
}
```

**Impact**: ~150 lines moved

---

#### 2.4 Position Management Hook
**New File**: `src/hooks/useCombatPositions.js`
**Extract**:
- `positions` state
- `positionsRef`
- `handlePositionChange()` (line ~4096)
- Position validation logic
- Hex sharing logic

**Impact**: ~200 lines moved

---

### Phase 3: Extract Action Handlers (Large Functions)

#### 3.1 Attack Actions
**New File**: `src/utils/combatActionHandlers/attackActions.js`
**Extract**:
- `handleChargeAttack()` (line ~3853)
- `handleStrikeWithMovement()` (line ~3985)
- Attack resolution logic
- Damage calculation flow

**Impact**: ~500 lines moved

---

#### 3.2 Maneuver Actions
**New File**: `src/utils/combatActionHandlers/maneuverActions.js`
**Extract**:
- `executeTripManeuver()` (line ~2013)
- `executeShoveManeuver()` (line ~2133)
- `executeDisarmManeuver()` (line ~2257)
- Maneuver resolution logic

**Impact**: ~400 lines moved

---

#### 3.3 Grapple Actions
**New File**: `src/utils/combatActionHandlers/grappleActions.js`
**Extract**:
- `handleGrappleAction()` (line ~2431) - **This is huge, ~1400 lines**
- Grapple state management
- Grapple action resolution

**Impact**: ~1400 lines moved - **BIGGEST SINGLE EXTRACTION**

---

#### 3.4 Movement Actions
**New File**: `src/utils/combatActionHandlers/movementActions.js`
**Extract**:
- `handleMoveSelect()` (line ~1775)
- Movement validation
- Movement range calculations
- Run/Sprint/Charge movement logic
- `handleRunActionUpdate()` (line ~4014)

**Impact**: ~400 lines moved

---

#### 3.5 AI Turn Handler
**New File**: `src/utils/combatActionHandlers/aiTurnHandler.js`
**Extract**:
- `handleEnemyTurn()` (line ~5655) - **Very large function**
- `handlePlayerAITurn()` (line ~4447)
- AI decision logic
- Target selection
- Action prioritization

**Impact**: ~1500 lines moved - **SECOND BIGGEST**

---

### Phase 4: Extract UI Components

#### 4.1 Combat Log Component
**New File**: `src/components/combat/CombatLogPanel.jsx`
**Extract JSX** (lines ~10977-11150):
- Log display tabs
- Log filtering UI
- Log sorting controls
- Dice details toggle
- Auto-scroll logic

**Props**:
```javascript
{
  log,
  logFilterType,
  setLogFilterType,
  logSortOrder,
  setLogSortOrder,
  showRollDetails,
  setShowRollDetails,
  diceRolls
}
```

**Impact**: ~200 lines JSX moved

---

#### 4.2 Fighter Status Panel
**New File**: `src/components/combat/FighterStatusPanel.jsx`
**Extract JSX** (lines ~11171-11450):
- HP/SDC display
- Stamina/Fatigue display
- Status effects display
- Initiative display
- Fighter info tabs

**Props**:
```javascript
{
  fighters,
  currentFighter,
  getHPStatus,
  getFatigueStatus
}
```

**Impact**: ~300 lines JSX moved

---

#### 4.3 Combat Action Buttons
**New File**: `src/components/combat/CombatActionButtons.jsx`
**Extract JSX** (lines ~10571-10800):
- Attack buttons
- Maneuver buttons (Trip, Shove, Disarm, Grapple)
- Grapple action buttons
- Movement buttons
- Action selection UI

**Props**:
```javascript
{
  currentFighter,
  selectedAction,
  setSelectedAction,
  selectedManeuver,
  setSelectedManeuver,
  selectedGrappleAction,
  setSelectedGrappleAction,
  executeSelectedAction,
  getAvailableGrappleActions,
  // ... etc
}
```

**Impact**: ~250 lines JSX moved

---

#### 4.4 Turn Display Panel
**New File**: `src/components/combat/TurnDisplayPanel.jsx`
**Extract JSX** (lines ~10543-10570):
- Melee round display
- Current fighter name
- Actions remaining
- Initiative order info

**Props**:
```javascript
{
  meleeRound,
  currentFighter,
  formatAttacksRemaining,
  aiControlEnabled
}
```

**Impact**: ~100 lines JSX moved

---

#### 4.5 Target Selection UI
**New File**: `src/components/combat/TargetSelectionUI.jsx`
**Extract JSX**:
- Target list rendering
- Target filtering
- Target selection buttons
- Range indicators

**Props**:
```javascript
{
  fighters,
  currentFighter,
  selectedTarget,
  setSelectedTarget,
  getTargetOptionsForAction,
  positions
}
```

**Impact**: ~150 lines JSX moved

---

#### 4.6 Spell/Psionic Selection UI
**New File**: `src/components/combat/AbilitySelectionUI.jsx`
**Extract JSX**:
- Spell selection modal/panel
- Psionic power selection
- Ability cost display
- Range indicators

**Props**:
```javascript
{
  getFighterSpells,
  getFighterPsionicPowers,
  selectedSpell,
  setSelectedSpell,
  selectedPsionicPower,
  setSelectedPsionicPower,
  executeSpellCast,
  executePsionicUse
}
```

**Impact**: ~200 lines JSX moved

---

#### 4.7 Position Display Panel
**New File**: `src/components/combat/PositionDisplayPanel.jsx`
**Extract JSX** (around line 11171):
- Fighter positions table
- Distance calculations
- Position editing (if any)

**Props**:
```javascript
{
  fighters,
  positions,
  calculateDistance
}
```

**Impact**: ~100 lines JSX moved

---

### Phase 5: Extract Data/Constants

#### 5.1 Combat Constants
**New File**: `src/data/combatConstants.js`
**Extract**:
- `MIN_COMBAT_HP` (line ~861)
- Action cost constants
- Status effect definitions
- Combat state enums

**Impact**: ~50 lines moved

---

#### 5.2 Spell/Power Keywords
**New File**: `src/data/magicKeywords.js`
**Extract** (already identified in Phase 1.1):
- `HEAL_KEYWORDS`
- `SUPPORT_KEYWORDS`
- `HARMFUL_KEYWORDS`
- `TOUCH_RANGE_HINTS`
- `SELF_ONLY_HINTS`

**Impact**: ~30 lines moved

---

### Phase 6: Create Action Selector Utilities

#### 6.1 Action Options Builder
**New File**: `src/utils/combatActionHandlers/actionOptionsBuilder.js`
**Extract**:
- `getTargetOptionsForAction()` (line ~1320)
- `getAvailableSkills()` (line ~1030)
- `getAvailableGrappleActions()` (line ~1430)
- `getFighterSpells()` (line ~1181)
- `getFighterPsionicPowers()` (line ~1176)
- `getEquippedWeapons()` (line ~4380)

**Impact**: ~400 lines moved

---

## File Size Estimates After Refactoring

### CombatPage.jsx (After All Phases)
- **Before**: ~10,990 lines (~500KB)
- **After**: ~3,000-4,000 lines (~150-200KB)
- **Reduction**: ~65-70%

### New Files Created

#### Utils (Pure Functions):
1. `spellParsingUtils.js` - ~200 lines
2. `combatCalculations.js` - ~150 lines
3. `aiMovementUtils.js` - ~100 lines
4. `combatActionHandlers/attackActions.js` - ~500 lines
5. `combatActionHandlers/maneuverActions.js` - ~400 lines
6. `combatActionHandlers/grappleActions.js` - ~1400 lines ⭐
7. `combatActionHandlers/movementActions.js` - ~400 lines
8. `combatActionHandlers/aiTurnHandler.js` - ~1500 lines ⭐
9. `combatActionHandlers/actionOptionsBuilder.js` - ~400 lines

#### Hooks:
10. `hooks/useCombatState.js` - ~300 lines
11. `hooks/useCombatUIState.js` - ~200 lines
12. `hooks/useCombatLog.js` - ~150 lines
13. `hooks/useCombatPositions.js` - ~200 lines

#### Components:
14. `components/combat/CombatLogPanel.jsx` - ~200 lines
15. `components/combat/FighterStatusPanel.jsx` - ~300 lines
16. `components/combat/CombatActionButtons.jsx` - ~250 lines
17. `components/combat/TurnDisplayPanel.jsx` - ~100 lines
18. `components/combat/TargetSelectionUI.jsx` - ~150 lines
19. `components/combat/AbilitySelectionUI.jsx` - ~200 lines
20. `components/combat/PositionDisplayPanel.jsx` - ~100 lines

#### Data:
21. `data/combatConstants.js` - ~50 lines
22. `data/magicKeywords.js` - ~30 lines

---

## Implementation Order (Recommended)

### Week 1: Utilities & Constants (Low Risk)
1. ✅ Extract spell/power parsing utils (Phase 1.1)
2. ✅ Extract combat calculation utils (Phase 1.2)
3. ✅ Extract AI movement utils (Phase 1.3)
4. ✅ Extract constants (Phase 5)

**Result**: CombatPage.jsx down to ~10,500 lines

---

### Week 2: Custom Hooks (Medium Risk)
5. ✅ Extract combat log hook (Phase 2.3)
6. ✅ Extract position management hook (Phase 2.4)
7. ✅ Extract combat state hook (Phase 2.1)
8. ✅ Extract UI state hook (Phase 2.2)

**Result**: CombatPage.jsx down to ~9,500 lines

---

### Week 3: Action Handlers (Higher Risk - Test Thoroughly)
9. ✅ Extract maneuver actions (Phase 3.2) - **Start here, smallest**
10. ✅ Extract movement actions (Phase 3.4)
11. ✅ Extract attack actions (Phase 3.1)
12. ✅ Extract grapple actions (Phase 3.3) - **Biggest, most complex**
13. ✅ Extract AI turn handler (Phase 3.5) - **Second biggest**

**Result**: CombatPage.jsx down to ~6,000 lines

---

### Week 4: UI Components (Lower Risk - Mostly Presentation)
14. ✅ Extract turn display panel (Phase 4.4)
15. ✅ Extract combat action buttons (Phase 4.3)
16. ✅ Extract target selection UI (Phase 4.5)
17. ✅ Extract ability selection UI (Phase 4.6)
18. ✅ Extract position display panel (Phase 4.7)
19. ✅ Extract fighter status panel (Phase 4.2)
20. ✅ Extract combat log panel (Phase 4.1)
21. ✅ Extract action options builder (Phase 6.1)

**Result**: CombatPage.jsx down to ~3,500 lines ✅

---

## Testing Strategy

### After Each Phase:
1. Run full combat simulation
2. Test all action types (attack, maneuver, grapple, movement)
3. Test AI turns (enemy and player AI)
4. Test spell/psionic casting
5. Test position updates
6. Verify log messages
7. Check for console errors/warnings

### Critical Test Cases:
- ✅ Grapple system (all actions)
- ✅ Maneuvers (trip, shove, disarm)
- ✅ Movement + attack combinations
- ✅ Charge attacks
- ✅ AI decision making
- ✅ Position synchronization
- ✅ Spell/psionic targeting
- ✅ Turn order and initiative

---

## Benefits

### Immediate:
- ✅ Babel warnings eliminated
- ✅ Faster build times
- ✅ Better code organization

### Long-term:
- ✅ Easier to test individual pieces
- ✅ Easier to add new features
- ✅ Better developer experience
- ✅ Smaller bundle chunks (can code-split)
- ✅ Easier code reviews
- ✅ Reduced merge conflicts

---

## Migration Notes

### Dependencies Between Modules:
- Action handlers depend on combat state hook
- UI components depend on hooks and action handlers
- Utils are pure functions (no dependencies)

### Breaking Changes:
- **None** - All exports maintain same function signatures
- Only internal organization changes
- Import paths will change in CombatPage.jsx

### Rollback Plan:
- Keep old CombatPage.jsx in git history
- Each phase is independently reversible
- Test thoroughly before moving to next phase

---

## Quick Start Commands

After refactoring, verify file sizes:

```bash
# Check CombatPage.jsx size
Get-Item src/pages/CombatPage.jsx | Select-Object Length, @{Name="KB";Expression={[math]::Round($_.Length/1KB,2)}}

# List new file sizes
Get-ChildItem -Recurse src/utils/combatActionHandlers, src/hooks, src/components/combat | Select-Object Name, @{Name="KB";Expression={[math]::Round($_.Length/1KB,2)}} | Format-Table -AutoSize
```

---

## Priority Actions (If Time-Limited)

**Must Do** (Biggest impact):
1. Extract grapple actions handler (~1400 lines) ⭐⭐⭐
2. Extract AI turn handler (~1500 lines) ⭐⭐⭐
3. Extract combat log hook (~150 lines) ⭐⭐
4. Extract position management hook (~200 lines) ⭐⭐

**Should Do**:
5. Extract maneuver actions (~400 lines)
6. Extract UI components (~1000 lines total)

**Nice to Have**:
7. Extract utility functions (~450 lines)
8. Extract constants (~80 lines)

---

## Notes

- All function signatures remain the same
- Props interfaces should be documented with JSDoc
- Consider using TypeScript interfaces in the future
- Some handlers may need to be split further if they exceed 300-400 lines
- Action handlers can share a common context object to reduce prop drilling

---

**Last Updated**: [Current Date]
**Target Completion**: 4 weeks (1 phase per week)
**Estimated Effort**: 20-30 hours total


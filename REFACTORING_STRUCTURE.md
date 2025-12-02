# CombatPage.jsx Refactoring - File Structure

## Before Refactoring

```
src/
├── pages/
│   └── CombatPage.jsx (10,990 lines, ~500KB) ❌
└── utils/
    ├── grapplingSystem.js
    ├── combatEngine.js
    └── ... (other utils)
```

---

## After Refactoring

```
src/
├── pages/
│   └── CombatPage.jsx (3,500 lines, ~150KB) ✅
│
├── components/
│   └── combat/
│       ├── CombatLogPanel.jsx (~200 lines)
│       ├── FighterStatusPanel.jsx (~300 lines)
│       ├── CombatActionButtons.jsx (~250 lines)
│       ├── TurnDisplayPanel.jsx (~100 lines)
│       ├── TargetSelectionUI.jsx (~150 lines)
│       ├── AbilitySelectionUI.jsx (~200 lines)
│       └── PositionDisplayPanel.jsx (~100 lines)
│
├── hooks/
│   ├── useCombatState.js (~300 lines)
│   ├── useCombatUIState.js (~200 lines)
│   ├── useCombatLog.js (~150 lines)
│   └── useCombatPositions.js (~200 lines)
│
├── utils/
│   ├── combatActionHandlers/
│   │   ├── attackActions.js (~500 lines)
│   │   ├── maneuverActions.js (~400 lines)
│   │   ├── grappleActions.js (~1400 lines) ⭐
│   │   ├── movementActions.js (~400 lines)
│   │   ├── aiTurnHandler.js (~1500 lines) ⭐
│   │   └── actionOptionsBuilder.js (~400 lines)
│   │
│   ├── spellParsingUtils.js (~200 lines)
│   ├── combatCalculations.js (~150 lines)
│   └── aiMovementUtils.js (~100 lines)
│
└── data/
    ├── combatConstants.js (~50 lines)
    └── magicKeywords.js (~30 lines)
```

---

## Size Breakdown

### CombatPage.jsx Reduction:

| Section | Before | After | Moved To |
|---------|--------|-------|----------|
| Helper Functions | ~500 lines | 0 | `utils/` files |
| State Management | ~800 lines | 0 | `hooks/` files |
| Action Handlers | ~4,200 lines | 0 | `utils/combatActionHandlers/` |
| UI Components | ~1,300 lines | 0 | `components/combat/` |
| Constants | ~80 lines | 0 | `data/` files |
| Core Component | ~4,110 lines | ~3,500 lines | (Streamlined) |
| **TOTAL** | **~10,990 lines** | **~3,500 lines** | **~7,490 lines extracted** |

### New Files Created:

- **22 new files** total
- **7 UI components** (~1,300 lines)
- **4 custom hooks** (~850 lines)
- **6 action handlers** (~4,600 lines)
- **3 utility modules** (~450 lines)
- **2 data files** (~80 lines)

---

## Module Dependency Graph

```
CombatPage.jsx
├── hooks/
│   ├── useCombatState.js ──────┐
│   ├── useCombatUIState.js ────┤
│   ├── useCombatLog.js ────────┼─► CombatPage.jsx
│   └── useCombatPositions.js ──┘
│
├── components/combat/
│   ├── CombatLogPanel.jsx ──────► uses useCombatLog
│   ├── FighterStatusPanel.jsx ──► uses useCombatState
│   ├── CombatActionButtons.jsx ─► uses action handlers
│   └── ...
│
├── utils/combatActionHandlers/
│   ├── grappleActions.js ───────► uses grapplingSystem.js
│   ├── aiTurnHandler.js ────────► uses combatEngine.js
│   └── ... ─────────────────────► use hooks via props
│
└── utils/
    ├── spellParsingUtils.js ────► pure functions
    └── ...
```

---

## Import Structure After Refactoring

### CombatPage.jsx imports:

```javascript
// React & UI
import React, { useState, useEffect, ... } from "react";
import { Box, Button, ... } from "@chakra-ui/react";

// Custom Hooks
import { useCombatState } from "../hooks/useCombatState";
import { useCombatUIState } from "../hooks/useCombatUIState";
import { useCombatLog } from "../hooks/useCombatLog";
import { useCombatPositions } from "../hooks/useCombatPositions";

// Components
import CombatLogPanel from "../components/combat/CombatLogPanel";
import FighterStatusPanel from "../components/combat/FighterStatusPanel";
import CombatActionButtons from "../components/combat/CombatActionButtons";
import TurnDisplayPanel from "../components/combat/TurnDisplayPanel";
// ... etc

// Action Handlers
import { executeTripManeuver, executeShoveManeuver, executeDisarmManeuver } 
  from "../utils/combatActionHandlers/maneuverActions";
import { handleGrappleAction } from "../utils/combatActionHandlers/grappleActions";
import { handleChargeAttack, handleStrikeWithMovement } 
  from "../utils/combatActionHandlers/attackActions";
import { handleMoveSelect, handleRunActionUpdate } 
  from "../utils/combatActionHandlers/movementActions";
import { handleEnemyTurn, handlePlayerAITurn } 
  from "../utils/combatActionHandlers/aiTurnHandler";

// Utilities
import { parseRangeToFeet, getSpellCost, ... } from "../utils/spellParsingUtils";
import { getCasterSpellDC, calculateSpellSave, ... } from "../utils/combatCalculations";

// Constants
import { MIN_COMBAT_HP, ... } from "../data/combatConstants";

// Existing utils (unchanged)
import { attemptGrapple, ... } from "../utils/grapplingSystem";
import { createAIActionSelector } from "../utils/combatEngine";
// ... etc
```

---

## File Size Comparison

### Before:
```
CombatPage.jsx: ████████████████████████████████████████████████████ 500KB
```

### After:
```
CombatPage.jsx:        ████████████ 150KB
├── grappleActions.js: ████████████ 70KB
├── aiTurnHandler.js:  ███████████ 75KB
├── UI Components:     ███████ 65KB
├── Hooks:             ████ 42KB
├── Other Handlers:    ██████ 65KB
└── Utils/Data:        ████ 38KB
────────────────────────────────────────
Total:                 ████████████████████████████████████ 505KB
(But split into 23 files!)
```

---

## Key Benefits Visualized

### Build Time:
- **Before**: Babel disables optimizations ❌
- **After**: Full Babel optimization ✅

### Code Navigation:
- **Before**: Scroll through 10,990 lines 😵
- **After**: Navigate focused 150-1500 line files 🎯

### Testing:
- **Before**: Test entire CombatPage.jsx as one unit 🧪
- **After**: Test individual handlers/components independently ✅

### Development:
- **Before**: High merge conflict risk 🔴
- **After**: Low conflict risk (work on separate files) 🟢

---

## Quick Reference: What Goes Where?

| Content Type | Destination | Example |
|--------------|-------------|---------|
| Pure functions (no state) | `utils/` | `parseRangeToFeet()` |
| React state + logic | `hooks/` | `useCombatState()` |
| Large handler functions | `utils/combatActionHandlers/` | `handleGrappleAction()` |
| UI rendering blocks | `components/combat/` | `CombatLogPanel` |
| Constants/enums | `data/` | `MIN_COMBAT_HP` |
| Core component logic | `CombatPage.jsx` | Component wiring |

---

## Migration Checklist

### Phase 1: Utils & Constants ✅
- [ ] Create `utils/spellParsingUtils.js`
- [ ] Create `utils/combatCalculations.js`
- [ ] Create `utils/aiMovementUtils.js`
- [ ] Create `data/combatConstants.js`
- [ ] Create `data/magicKeywords.js`
- [ ] Update imports in `CombatPage.jsx`

### Phase 2: Hooks ✅
- [ ] Create `hooks/useCombatLog.js`
- [ ] Create `hooks/useCombatPositions.js`
- [ ] Create `hooks/useCombatState.js`
- [ ] Create `hooks/useCombatUIState.js`
- [ ] Update `CombatPage.jsx` to use hooks

### Phase 3: Action Handlers ✅
- [ ] Create `utils/combatActionHandlers/maneuverActions.js`
- [ ] Create `utils/combatActionHandlers/movementActions.js`
- [ ] Create `utils/combatActionHandlers/attackActions.js`
- [ ] Create `utils/combatActionHandlers/grappleActions.js`
- [ ] Create `utils/combatActionHandlers/aiTurnHandler.js`
- [ ] Create `utils/combatActionHandlers/actionOptionsBuilder.js`

### Phase 4: UI Components ✅
- [ ] Create `components/combat/TurnDisplayPanel.jsx`
- [ ] Create `components/combat/CombatActionButtons.jsx`
- [ ] Create `components/combat/TargetSelectionUI.jsx`
- [ ] Create `components/combat/AbilitySelectionUI.jsx`
- [ ] Create `components/combat/PositionDisplayPanel.jsx`
- [ ] Create `components/combat/FighterStatusPanel.jsx`
- [ ] Create `components/combat/CombatLogPanel.jsx`

### Final: Verification ✅
- [ ] All tests pass
- [ ] Combat simulation works
- [ ] File size under 200KB
- [ ] No Babel warnings
- [ ] No console errors
- [ ] Code review complete

---

**Estimated Total Lines Extracted**: ~7,490 lines  
**Estimated Files Created**: 22 files  
**Estimated Size Reduction**: 65-70%  
**Target File Size**: ~150-200KB ✅


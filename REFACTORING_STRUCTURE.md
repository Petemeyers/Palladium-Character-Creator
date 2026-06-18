# CombatPage.jsx Refactoring - File Structure

## Before Refactoring

```
src/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ pages/
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ CombatPage.jsx (10,990 lines, ~500KB) Ã¢ÂÅ’
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ utils/
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ grapplingSystem.js
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ combatEngine.js
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ... (other utils)
```

---

## After Refactoring

```
src/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ pages/
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ CombatPage.jsx (3,500 lines, ~150KB) Ã¢Å“â€¦
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ components/
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ combat/
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ CombatLogPanel.jsx (~200 lines)
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ FighterStatusPanel.jsx (~300 lines)
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ CombatActionButtons.jsx (~250 lines)
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ TurnDisplayPanel.jsx (~100 lines)
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ TargetSelectionUI.jsx (~150 lines)
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ AbilitySelectionUI.jsx (~200 lines)
Ã¢â€â€š       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ PositionDisplayPanel.jsx (~100 lines)
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ hooks/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ useCombatState.js (~300 lines)
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ useCombatUIState.js (~200 lines)
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ useCombatLog.js (~150 lines)
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ useCombatPositions.js (~200 lines)
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ utils/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ combatActionHandlers/
Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ attackActions.js (~500 lines)
Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ maneuverActions.js (~400 lines)
Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ grappleActions.js (~1400 lines) Ã¢Â­Â
Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ movementActions.js (~400 lines)
Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ aiTurnHandler.js (~1500 lines) Ã¢Â­Â
Ã¢â€â€š   Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ actionOptionsBuilder.js (~400 lines)
Ã¢â€â€š   Ã¢â€â€š
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ techniqueParsingUtils.js (~200 lines)
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ combatCalculations.js (~150 lines)
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ aiMovementUtils.js (~100 lines)
Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ data/
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ combatConstants.js (~50 lines)
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ trainingKeywords.js (~30 lines)
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
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ hooks/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ useCombatState.js Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ useCombatUIState.js Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â¤
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ useCombatLog.js Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â¼Ã¢â€â‚¬Ã¢â€“Âº CombatPage.jsx
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ useCombatPositions.js Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ components/combat/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ CombatLogPanel.jsx Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº uses useCombatLog
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ FighterStatusPanel.jsx Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº uses useCombatState
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ CombatActionButtons.jsx Ã¢â€â‚¬Ã¢â€“Âº uses action handlers
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ...
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ utils/combatActionHandlers/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ grappleActions.js Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº uses grapplingSystem.js
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ aiTurnHandler.js Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº uses combatEngine.js
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ... Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº use hooks via props
Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ utils/
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ techniqueParsingUtils.js Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº pure functions
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ...
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
import { handleChargeAttack, handleAttackWithMovement } 
  from "../utils/combatActionHandlers/attackActions";
import { handleMoveSelect, handleRunActionUpdate } 
  from "../utils/combatActionHandlers/movementActions";
import { handleEnemyTurn, handlePlayerAITurn } 
  from "../utils/combatActionHandlers/aiTurnHandler";

// Utilities
import { parseRangeToFeet, getTechniqueCost, ... } from "../utils/techniqueParsingUtils";
import { getCasterTechniqueDC, calculateTechniqueSave, ... } from "../utils/combatCalculations";

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
CombatPage.jsx: Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 500KB
```

### After:
```
CombatPage.jsx:        Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 150KB
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ grappleActions.js: Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 70KB
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ aiTurnHandler.js:  Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 75KB
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ UI Components:     Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 65KB
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Hooks:             Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 42KB
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Other Handlers:    Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 65KB
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Utils/Data:        Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 38KB
Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
Total:                 Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 505KB
(But split into 23 files!)
```

---

## Key Benefits Visualized

### Build Time:
- **Before**: Babel disables optimizations Ã¢ÂÅ’
- **After**: Full Babel optimization Ã¢Å“â€¦

### Code Navigation:
- **Before**: Scroll through 10,990 lines Ã°Å¸ËœÂµ
- **After**: Navigate focused 150-1500 line files Ã°Å¸Å½Â¯

### Testing:
- **Before**: Test entire CombatPage.jsx as one unit Ã°Å¸Â§Âª
- **After**: Test individual handlers/components independently Ã¢Å“â€¦

### Development:
- **Before**: High merge conflict risk Ã°Å¸â€Â´
- **After**: Low conflict risk (work on separate files) Ã°Å¸Å¸Â¢

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

### Phase 1: Utils & Constants Ã¢Å“â€¦
- [ ] Create `utils/techniqueParsingUtils.js`
- [ ] Create `utils/combatCalculations.js`
- [ ] Create `utils/aiMovementUtils.js`
- [ ] Create `data/combatConstants.js`
- [ ] Create `data/trainingKeywords.js`
- [ ] Update imports in `CombatPage.jsx`

### Phase 2: Hooks Ã¢Å“â€¦
- [ ] Create `hooks/useCombatLog.js`
- [ ] Create `hooks/useCombatPositions.js`
- [ ] Create `hooks/useCombatState.js`
- [ ] Create `hooks/useCombatUIState.js`
- [ ] Update `CombatPage.jsx` to use hooks

### Phase 3: Action Handlers Ã¢Å“â€¦
- [ ] Create `utils/combatActionHandlers/maneuverActions.js`
- [ ] Create `utils/combatActionHandlers/movementActions.js`
- [ ] Create `utils/combatActionHandlers/attackActions.js`
- [ ] Create `utils/combatActionHandlers/grappleActions.js`
- [ ] Create `utils/combatActionHandlers/aiTurnHandler.js`
- [ ] Create `utils/combatActionHandlers/actionOptionsBuilder.js`

### Phase 4: UI Components Ã¢Å“â€¦
- [ ] Create `components/combat/TurnDisplayPanel.jsx`
- [ ] Create `components/combat/CombatActionButtons.jsx`
- [ ] Create `components/combat/TargetSelectionUI.jsx`
- [ ] Create `components/combat/AbilitySelectionUI.jsx`
- [ ] Create `components/combat/PositionDisplayPanel.jsx`
- [ ] Create `components/combat/FighterStatusPanel.jsx`
- [ ] Create `components/combat/CombatLogPanel.jsx`

### Final: Verification Ã¢Å“â€¦
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
**Target File Size**: ~150-200KB Ã¢Å“â€¦


# Functions Defined But Not Fully Used in CombatPage.jsx

## Summary
These functions are defined in CombatPage.jsx but are either:
1. Not called at all
2. Only called in limited contexts where they should be used more broadly
3. Should be integrated into game logic but aren't

---

## 1. `convertTechniqueToCombatTechnique` (Line 618)
**Status:** Defined but underutilized

**Current Usage:**
- Only called once at line 7150 when converting unified techniques from `getUnifiedAbilities()` during party selection

**Should Be Used:**
- When techniques are retrieved from unified abilities system (`getUnifiedAbilities`)
- Before passing techniques to `executeTechnique()` if they come from unified abilities
- When techniques are selected from the technique dropdown if they're unified techniques
- Currently `executeTechnique()` expects combat technique format, but unified techniques may have different structure

**Integration Points:**
- Line ~1083: `getFighterTechniques()` - should convert unified techniques here
- Line ~3732: Technique selection in AI - should convert if unified
- Line ~6378: `executeTechnique()` - should convert unified techniques before execution
- Line ~6766: Technique execution in action handler - should convert if unified

---

## 2. `getTechniqueCost()` (Line 308)
**Status:** Used but could be better integrated

**Current Usage:**
- Used in technique filtering (line 3536, 3540)
- Used in technique cost display (line 1102)

**Should Also Be Used:**
- Line 6379: `executeTechnique()` currently uses `technique.cost ?? technique.stamina ?? technique.stamina ?? 0`
- Should use `getTechniqueCost(technique)` for consistent cost extraction
- This would handle unified techniques better

---

## 3. `getTechniqueRangeInFeet()` (Line 427)
**Status:** Used but could be better integrated

**Current Usage:**
- Used in AI technique selection (line 3736, 3745)
- Used in tactical power range (line 3602, 3754, 3760)

**Should Also Be Used:**
- Technique range validation before casting
- Target selection filtering based on range
- Currently range checking may be inconsistent

---

## 4. `techniqueCanAffectTarget()` (Line 483)
**Status:** Used but could be better integrated

**Current Usage:**
- Used in AI technique selection (line 3581, 3732)

**Should Also Be Used:**
- Line 6392: Before executing technique, validate target compatibility
- Line 6759: Target validation in action handler
- Currently only checks `techniqueRequiresTarget()`, but doesn't validate if technique CAN affect the target
- Should check friendly/enemy restrictions, shuman-only techniques, etc.

---

## 5. `isHealingTechnique()`, `isOffensiveTechnique()`, `isSupportTechnique()` (Lines 432, 443, 447)
**Status:** Used internally but could be used more broadly

**Current Usage:**
- Used in `techniqueCanAffectTarget()` (line 499-500)
- Used in AI technique selection (line 3540)

**Should Also Be Used:**
- Technique categorization in UI (healing vs offensive vs support)
- Technique filtering in dropdowns
- Visual indicators for technique types
- Better technique organization

---

## 6. `doesTechniqueRequireTarget()` (Line 470)
**Status:** Used via alias `techniqueRequiresTarget`

**Current Usage:**
- Wrastaminad as `techniqueRequiresTarget` callback (line 1192)
- Used in target validation (lines 1244, 1299, 6392, 6759)

**Note:** This is properly used, but the alias pattern could be simplified

---

## 7. `getCasterTechniqueDC()`, `resolveTrainingSave()`, `gatherSavingThrowBonuses()` (Lines 568, 581, 539)
**Status:** Used but could be enhanced

**Current Usage:**
- Used in `resolveTrainingSave()` (lines 587, 600-601)
- Used in technique execution (line 6450)

**Should Also Be Used:**
- Display technique DC in UI before casting
- Show saving throw bonuses in target selection
- Better integration with technique save system

---

## 8. `getPETrainingBonus()`, `getMETrainingBonus()` (Lines 513, 523)
**Status:** Used internally

**Current Usage:**
- Used in `resolveTrainingSave()` (line 600)

**Note:** Properly used, but could be displayed in character stats UI

---

## 9. `getValueOrZero()` (Line 530)
**Status:** Used internally

**Current Usage:**
- Used in `gatherSavingThrowBonuses()` (line 551, 563, 570)
- Used in `resolveTrainingSave()` (lines 589, 594)

**Note:** Properly used as utility function

---

## 10. `getTechniqueHealingFormula()` (Line 370)
**Status:** Used but could be enhanced

**Current Usage:**
- Used in `isHealingTechnique()` (line 440)
- Used in `executeTechnique()` (line 6384)

**Should Also Be Used:**
- Display healing amount in technique tooltip/description
- Show expected healing in technique selection UI
- Better healing technique identification

---

## 11. `hasTechniqueDamage()` (Line 397)
**Status:** Used internally

**Current Usage:**
- Used in `isOffensiveTechnique()` (line 444)
- Used in `isSupportTechnique()` (line 450)
- Used in `doesTechniqueRequireTarget()` (line 472)
- Used in `executeTechnique()` (line 6449)

**Note:** Properly used

---

## 12. `extractHealingFormulaFromText()` (Line 352)
**Status:** Used internally

**Current Usage:**
- Used in `getTechniqueHealingFormula()` (line 390)

**Note:** Properly used as helper function

---

## 13. `parseRangeToFeet()` (Line 288)
**Status:** Used internally

**Current Usage:**
- Used in `getTechniqueRangeInFeet()` (line 429)
- Used in tactical power range (lines 3602, 3754, 3760)

**Note:** Properly used

---

## Priority Integration Recommendations

### High Priority:
1. **`convertTechniqueToCombatTechnique`** - Critical for unified abilities integration
2. **`getTechniqueCost`** - Should replace manual cost extraction in `executeTechnique`
3. **`techniqueCanAffectTarget`** - Should validate targets before technique execution

### Medium Priority:
4. **`getTechniqueRangeInFeet`** - Better range validation
5. **Technique type functions** - Better UI categorization
6. **`getCasterTechniqueDC`** - Display in UI

### Low Priority:
7. **Utility functions** - Already properly used, just documentation

---

## Integration Checklist

- [ ] Use `convertTechniqueToCombatTechnique()` when techniques come from unified abilities
- [ ] Replace manual cost extraction with `getTechniqueCost()` in `executeTechnique()`
- [ ] Add `techniqueCanAffectTarget()` validation before technique execution
- [ ] Use `getTechniqueRangeInFeet()` for range validation
- [ ] Display technique types (healing/offensive/support) in UI
- [ ] Show technique DC and saving throw info in UI
- [ ] Display healing formula in technique tooltips


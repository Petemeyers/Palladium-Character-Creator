# Functions Defined But Not Fully Used in CombatPage.jsx

## Summary
These functions are defined in CombatPage.jsx but are either:
1. Not called at all
2. Only called in limited contexts where they should be used more broadly
3. Should be integrated into game logic but aren't

---

## 1. `convertUnifiedSpellToCombatSpell` (Line 618)
**Status:** Defined but underutilized

**Current Usage:**
- Only called once at line 7150 when converting unified spells from `getUnifiedAbilities()` during party selection

**Should Be Used:**
- When spells are retrieved from unified abilities system (`getUnifiedAbilities`)
- Before passing spells to `executeSpell()` if they come from unified abilities
- When spells are selected from the spell dropdown if they're unified spells
- Currently `executeSpell()` expects combat spell format, but unified spells may have different structure

**Integration Points:**
- Line ~1083: `getFighterSpells()` - should convert unified spells here
- Line ~3732: Spell selection in AI - should convert if unified
- Line ~6378: `executeSpell()` - should convert unified spells before execution
- Line ~6766: Spell execution in action handler - should convert if unified

---

## 2. `getSpellCost()` (Line 308)
**Status:** Used but could be better integrated

**Current Usage:**
- Used in spell filtering (line 3536, 3540)
- Used in spell cost display (line 1102)

**Should Also Be Used:**
- Line 6379: `executeSpell()` currently uses `spell.cost ?? spell.ppe ?? spell.PPE ?? 0`
- Should use `getSpellCost(spell)` for consistent cost extraction
- This would handle unified spells better

---

## 3. `getSpellRangeInFeet()` (Line 427)
**Status:** Used but could be better integrated

**Current Usage:**
- Used in AI spell selection (line 3736, 3745)
- Used in psionic power range (line 3602, 3754, 3760)

**Should Also Be Used:**
- Spell range validation before casting
- Target selection filtering based on range
- Currently range checking may be inconsistent

---

## 4. `spellCanAffectTarget()` (Line 483)
**Status:** Used but could be better integrated

**Current Usage:**
- Used in AI spell selection (line 3581, 3732)

**Should Also Be Used:**
- Line 6392: Before executing spell, validate target compatibility
- Line 6759: Target validation in action handler
- Currently only checks `spellRequiresTarget()`, but doesn't validate if spell CAN affect the target
- Should check friendly/enemy restrictions, self-only spells, etc.

---

## 5. `isHealingSpell()`, `isOffensiveSpell()`, `isSupportSpell()` (Lines 432, 443, 447)
**Status:** Used internally but could be used more broadly

**Current Usage:**
- Used in `spellCanAffectTarget()` (line 499-500)
- Used in AI spell selection (line 3540)

**Should Also Be Used:**
- Spell categorization in UI (healing vs offensive vs support)
- Spell filtering in dropdowns
- Visual indicators for spell types
- Better spell organization

---

## 6. `doesSpellRequireTarget()` (Line 470)
**Status:** Used via alias `spellRequiresTarget`

**Current Usage:**
- Wrapped as `spellRequiresTarget` callback (line 1192)
- Used in target validation (lines 1244, 1299, 6392, 6759)

**Note:** This is properly used, but the alias pattern could be simplified

---

## 7. `getCasterSpellDC()`, `resolveMagicSave()`, `gatherSavingThrowBonuses()` (Lines 568, 581, 539)
**Status:** Used but could be enhanced

**Current Usage:**
- Used in `resolveMagicSave()` (lines 587, 600-601)
- Used in spell execution (line 6450)

**Should Also Be Used:**
- Display spell DC in UI before casting
- Show saving throw bonuses in target selection
- Better integration with spell save system

---

## 8. `getPEMagicBonus()`, `getMEMagicBonus()` (Lines 513, 523)
**Status:** Used internally

**Current Usage:**
- Used in `resolveMagicSave()` (line 600)

**Note:** Properly used, but could be displayed in character stats UI

---

## 9. `getValueOrZero()` (Line 530)
**Status:** Used internally

**Current Usage:**
- Used in `gatherSavingThrowBonuses()` (line 551, 563, 570)
- Used in `resolveMagicSave()` (lines 589, 594)

**Note:** Properly used as utility function

---

## 10. `getSpellHealingFormula()` (Line 370)
**Status:** Used but could be enhanced

**Current Usage:**
- Used in `isHealingSpell()` (line 440)
- Used in `executeSpell()` (line 6384)

**Should Also Be Used:**
- Display healing amount in spell tooltip/description
- Show expected healing in spell selection UI
- Better healing spell identification

---

## 11. `hasSpellDamage()` (Line 397)
**Status:** Used internally

**Current Usage:**
- Used in `isOffensiveSpell()` (line 444)
- Used in `isSupportSpell()` (line 450)
- Used in `doesSpellRequireTarget()` (line 472)
- Used in `executeSpell()` (line 6449)

**Note:** Properly used

---

## 12. `extractHealingFormulaFromText()` (Line 352)
**Status:** Used internally

**Current Usage:**
- Used in `getSpellHealingFormula()` (line 390)

**Note:** Properly used as helper function

---

## 13. `parseRangeToFeet()` (Line 288)
**Status:** Used internally

**Current Usage:**
- Used in `getSpellRangeInFeet()` (line 429)
- Used in psionic power range (lines 3602, 3754, 3760)

**Note:** Properly used

---

## Priority Integration Recommendations

### High Priority:
1. **`convertUnifiedSpellToCombatSpell`** - Critical for unified abilities integration
2. **`getSpellCost`** - Should replace manual cost extraction in `executeSpell`
3. **`spellCanAffectTarget`** - Should validate targets before spell execution

### Medium Priority:
4. **`getSpellRangeInFeet`** - Better range validation
5. **Spell type functions** - Better UI categorization
6. **`getCasterSpellDC`** - Display in UI

### Low Priority:
7. **Utility functions** - Already properly used, just documentation

---

## Integration Checklist

- [ ] Use `convertUnifiedSpellToCombatSpell()` when spells come from unified abilities
- [ ] Replace manual cost extraction with `getSpellCost()` in `executeSpell()`
- [ ] Add `spellCanAffectTarget()` validation before spell execution
- [ ] Use `getSpellRangeInFeet()` for range validation
- [ ] Display spell types (healing/offensive/support) in UI
- [ ] Show spell DC and saving throw info in UI
- [ ] Display healing formula in spell tooltips


# Next Steps for Baal-Rog Abilities Implementation

## ✅ Completed (All Core Systems)

1. ✅ **Magic Abilities Parser** - Handles complex strings, element filtering, specific spells
2. ✅ **Dimensional Teleport** - Full implementation with skill checks
3. ✅ **Clerical Abilities System** - All 5 abilities implemented and parsed
4. ✅ **Fixed Import Error** - Removed duplicate `clericalHealingTouch` import

---

## 🎯 Immediate Next Steps (Priority Order)

### 1. **Add Clerical Abilities Submenu** (High Priority)
**Status**: Partially done - action exists but no submenu

**What's needed**:
- Add `clericalAbilitiesMode` state (similar to `spellsMode` and `psionicsMode`)
- Create submenu UI in CombatActionsPanel showing available clerical abilities
- Add ability selection state (`selectedClericalAbility`)
- Wire up selection to show available abilities when "Clerical Abilities" is clicked

**Files to modify**:
- `src/pages/CombatPage.jsx` - Add state and mode handling
- `src/components/CombatActionsPanel.jsx` - Add submenu UI (or add to CombatPage if it's inline)

**Reference**: Look at how `spellsMode` and `psionicsMode` work (lines 11956-12368 in CombatPage.jsx)

---

### 2. **Implement Clerical Ability Execution Handlers** (High Priority)
**Status**: Functions exist but not wired to combat execution

**What's needed**:
- Complete the "Clerical Abilities" case in `executeSelectedAction()`
- Add handlers for each ability:
  - **Animate Dead**: Find dead characters on map, execute `animateDead()`, create animated undead fighters
  - **Turn Dead**: Find undead targets, execute `turnDead()`, apply flee/destroy effects
  - **Exorcism**: Execute `performExorcism()` on selected target
  - **Remove Curse**: Execute `removeCurse()` on selected target
  - **Healing Touch**: Execute `clericalHealingTouch()` on selected target (already partially working)

**Files to modify**:
- `src/pages/CombatPage.jsx` - Complete the case handler around line 9740

---

### 3. **Add Dead Character Detection & Display** (Medium Priority)
**Status**: Detection exists but may need UI feedback

**What's needed**:
- Ensure dead characters (HP <= -21) remain visible on map
- Add visual indicator for dead characters (different color, icon, etc.)
- Make dead characters selectable as targets for Animate Dead
- Update `getTargetOptionsForAction()` to include dead characters when appropriate

**Files to modify**:
- `src/pages/CombatPage.jsx` - Update target selection logic
- `src/components/TacticalMap.jsx` - Add visual indicators for dead characters

---

### 4. **Add AI Decision-Making for Clerical Abilities** (Medium Priority)
**Status**: Not implemented

**What's needed**:
- Add clerical ability usage to enemy AI decision tree
- Baal-Rog should:
  - Use Healing Touch on injured allies
  - Use Animate Dead when dead bodies are available
  - Use Turn Dead against undead enemies
  - Use Exorcism against demons/spirits
  - Use Remove Curse when allies are cursed

**Files to modify**:
- `src/utils/ai/enemyTurnAI.js` - Add clerical ability decision logic
- Consider adding to `runEnemyTurnAI()` around healing/utility actions

---

### 5. **Test & Verify All Abilities** (High Priority)
**Status**: Needs testing

**What's needed**:
- Test magic abilities loading (verify fire spells are loaded for Baal-Rog)
- Test dimensional teleport (skill check, movement)
- Test each clerical ability:
  - Animate Dead with dead characters on map
  - Turn Dead with undead enemies
  - Exorcism with demon/spirit targets
  - Remove Curse with cursed characters
  - Healing Touch with injured allies
- Verify Baal-Rog's fire immunity works
- Verify bio-regeneration works

---

### 6. **Update Status Document** (Low Priority)
**Status**: Needs updating

**What's needed**:
- Update `BAAL_ROG_ABILITIES_STATUS.md` to reflect completed work
- Mark all implemented abilities as ✅
- Update code locations

---

## 🔧 Technical Implementation Details

### Clerical Abilities Submenu Pattern

Follow the Spells/Psionics pattern:

```javascript
// State
const [clericalAbilitiesMode, setClericalAbilitiesMode] = useState(false);
const [selectedClericalAbility, setSelectedClericalAbility] = useState(null);

// When "Clerical Abilities" is clicked
if (actionName === "Clerical Abilities") {
  setClericalAbilitiesMode(true);
  setSelectedClericalAbility(null);
}

// In UI (similar to spells/psionics)
{selectedAction?.name === "Clerical Abilities" && clericalAbilitiesMode && (
  <Box>
    <Text>Select Clerical Ability:</Text>
    {getAvailableClericalAbilities(currentFighter).map(ability => (
      <Button onClick={() => setSelectedClericalAbility(ability)}>
        {ability.name} ({ability.description})
      </Button>
    ))}
  </Box>
)}
```

### Execution Handler Pattern

```javascript
case "Clerical Abilities": {
  if (!selectedClericalAbility) {
    addLog("Must select a clerical ability first!", "error");
    return;
  }
  
  switch (selectedClericalAbility.name) {
    case "Animate Dead":
      const deadBodies = fighters.filter(f => isDead(f));
      const result = animateDead(currentFighter, deadBodies, { log: addLog });
      if (result.success) {
        // Create animated undead fighters
        // Update state
      }
      break;
    // ... other abilities
  }
}
```

---

## 📋 Quick Start Checklist

- [ ] Add `clericalAbilitiesMode` state
- [ ] Add `selectedClericalAbility` state  
- [ ] Create submenu UI for ability selection
- [ ] Complete execution handler for each ability
- [ ] Add dead character visual indicators
- [ ] Update target selection to include dead characters
- [ ] Add AI decision-making for clerical abilities
- [ ] Test all abilities
- [ ] Update documentation

---

## 🎯 Recommended Order

1. **Start with #1 (Submenu)** - Gets the UI working
2. **Then #2 (Execution Handlers)** - Makes abilities actually work
3. **Then #5 (Testing)** - Verify everything works
4. **Then #3 (Dead Character Display)** - Polish the UX
5. **Then #4 (AI)** - Make Baal-Rog use abilities intelligently
6. **Finally #6 (Documentation)** - Update status doc

This order ensures core functionality works first, then adds polish and intelligence.


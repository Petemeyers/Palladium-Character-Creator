# Unused Imports in CombatPage.jsx That Should Be Integrated

## Summary
These imports are present in CombatPage.jsx but not currently used in the JSX. They should be integrated into the UI but are not yet implemented.

---

## Chakra UI Components (from @chakra-ui/react)

### 1. `Grid` and `GridItem` (Lines 10-11)
**Status:** Imported but not used
**Should Be Used For:**
- Grid-based layout for combat arena display
- Organizing fighter cards in a grid layout
- Creating responsive grid layouts for combat options
- Displaying multiple panels side-by-side

**Example Usage:**
```jsx
<Grid templateColumns="repeat(3, 1fr)" gap={4}>
  <GridItem>Party Members</GridItem>
  <GridItem>Combat Arena</GridItem>
  <GridItem>Enemies</GridItem>
</Grid>
```

---

### 2. `Collapse` (Line 33)
**Status:** Imported but not used
**Should Be Used For:**
- Collapsible combat options panels
- Expandable/collapsible sections for combat actions
- Animated show/hide for combat choices
- Collapsible help sections

**Note:** Used in `InitiativeTracker.jsx` with `CombatActionsPanel` - should be integrated similarly in CombatPage

**Example Usage:**
```jsx
<Collapse in={showCombatChoices} animateOpacity>
  <CombatActionsPanel character={currentFighter} />
</Collapse>
```

---

### 3. `Drawer` Components (Lines 39-45)
**Status:** Imported but not used
**Components:**
- `Drawer`
- `DrawerBody`
- `DrawerFooter`
- `DrawerHeader`
- `DrawerOverlay`
- `DrawerContent`
- `DrawerCloseButton`

**Should Be Used For:**
- Mobile-friendly side drawer for combat options
- Slide-out panels for character details
- Drawer menu for combat actions on smaller screens
- Alternative to FloatingPanel for mobile devices

**Example Usage:**
```jsx
<Drawer isOpen={isOpen} placement="right" onClose={onClose}>
  <DrawerOverlay />
  <DrawerContent>
    <DrawerCloseButton />
    <DrawerHeader>Combat Options</DrawerHeader>
    <DrawerBody>
      {/* Combat actions */}
    </DrawerBody>
    <DrawerFooter>
      <Button variant="outline" onClick={onClose}>Close</Button>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

---

## Component Imports

### 4. `CombatActionsPanel` (Line 56)
**Status:** Imported but not used
**File:** `src/components/CombatActionsPanel.jsx` (exists)

**Should Be Used For:**
- Replacing the inline combat options UI (currently custom-built)
- Providing a reusable combat actions interface
- Consistent combat action selection across the app
- Used in `InitiativeTracker.jsx` - should be integrated in CombatPage

**Current State:**
- CombatPage has custom-built combat options UI (lines ~8000-8800)
- Should be replaced with `<CombatActionsPanel>` component
- Would simplify code and provide consistency

**Integration Point:**
- Line ~8000: Replace custom combat options VStack with `<CombatActionsPanel>`
- Wrap in `<Collapse>` for animated show/hide
- Pass `currentFighter`, `onActionSelect`, `selectedAction`, `selectedTarget`, etc.

---

## Integration Recommendations

### High Priority:
1. **`CombatActionsPanel`** - Replace custom combat options UI
2. **`Collapse`** - Add animated show/hide for combat choices

### Medium Priority:
3. **`Grid`/`GridItem`** - Improve layout organization
4. **`Drawer`** - Add mobile-friendly side drawer

---

## Integration Checklist

- [ ] Replace custom combat options UI with `<CombatActionsPanel>` component
- [ ] Wrap combat options in `<Collapse>` for animated transitions
- [ ] Add `<Grid>` layout for better organization
- [ ] Implement `<Drawer>` for mobile-friendly combat interface
- [ ] Test responsive behavior with Grid and Drawer

---

## Notes

- All these components/files exist and are valid
- They're imported but not yet integrated into the JSX
- `CombatActionsPanel` is already used in `InitiativeTracker.jsx` - should follow similar pattern
- These should be integrated to improve code reusability and UI consistency


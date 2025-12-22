# Loot System - File Locations and Usage

## Summary
A loot window system has been created that opens when clicking on defeated characters in the combat arena. This system is designed to be reusable for future quest scenes.

## Files Created/Modified

### 1. **`src/components/LootWindow.jsx`** (NEW)
- **Purpose**: Reusable loot window component
- **Features**:
  - Displays inventory, weapons, and armor from defeated characters
  - Allows selecting individual items or taking all items
  - Shows item details (damage, AR, weight, effects, etc.)
  - Color-coded item types (weapons=red, armor=blue, consumables=green)
  - Toast notifications when items are taken
  - Auto-closes when all loot is taken
  - Reusable for combat arena and quest scenes

- **Props**:
  - `isOpen` (boolean) - Whether modal is open
  - `onClose` (function) - Function to close modal
  - `loot` (object) - Loot object with { inventory, weapons, armor }
  - `sourceName` (string) - Name of loot source (default: "Defeated Enemy")
  - `onTakeItem` (function) - Callback when item is taken (item, type)
  - `onTakeAll` (function) - Callback when "Take All" is clicked
  - `allowSelection` (boolean) - Whether to allow selecting items (default: true)

### 2. **`src/pages/CombatPage.jsx`** (MODIFIED)
- **Line 72**: Added import for `LootWindow`
- **Line 1157-1160**: Added state variables:
  - `lootWindowOpen` - Controls loot window visibility
  - `selectedLootSource` - Fighter being looted
  - `lootData` - Loot data to display

- **Line 2220-2250**: Added `useEffect` hook to detect clicking on defeated combatants:
  - Monitors `selectedCombatantId` changes
  - Checks if fighter is defeated (dead, KO, HP <= 0, status="defeated")
  - Generates loot using `lootPrisoner()` function
  - Opens loot window if loot exists
  - Logs message if no loot

- **Line 15297-15400**: Added `LootWindow` component:
  - Integrated with combat arena
  - Handles taking individual items
  - Handles taking all items
  - Updates fighter state to remove looted items
  - Logs loot actions to combat log

### 3. **`src/utils/captureSystem.js`** (EXISTING)
- **Line 64-99**: `lootPrisoner()` function
  - Extracts inventory, weapons, and armor from fighter
  - Includes equipped weapons (like Fire Whip)
  - Returns loot object and updated fighter
  - Used by both loot button and loot window

## How It Works

### In Combat Arena:
1. **Click on Defeated Character**: When a player clicks on a defeated character on the tactical map, `selectedCombatantId` is set
2. **Detection**: The `useEffect` hook detects the selection and checks if the fighter is defeated
3. **Loot Generation**: If defeated, `lootPrisoner()` is called to extract loot
4. **Window Display**: If loot exists, the `LootWindow` modal opens showing all available items
5. **Taking Items**: Player can:
   - Select individual items and click "Take Selected"
   - Click "Take All" to take everything at once
   - Click "Take" on individual items
6. **State Updates**: When items are taken:
   - Items are removed from the defeated fighter's inventory/equipment
   - Combat log shows what was taken
   - Loot window updates or closes if empty

### For Future Quest Usage:
The `LootWindow` component can be used in quest scenes by:
```jsx
<LootWindow
  isOpen={showLoot}
  onClose={() => setShowLoot(false)}
  loot={questLoot}
  sourceName="Chest" // or "Defeated Bandit", etc.
  onTakeItem={(item, type) => {
    // Add to player/party inventory
    addItemToInventory(item);
  }}
  onTakeAll={(allItems) => {
    // Add all items to inventory
    allItems.forEach(item => addItemToInventory(item));
  }}
/>
```

## Related Files

### Loot Generation:
- **`src/components/util.jsx`** (Line 320-363): `rollLoot()` function for random loot generation
- **`src/components/PartyInventory.jsx`**: Party inventory management (for distributing loot)
- **`backend/routes/loot.js`**: Backend loot routes (currently stubs)

### Loot Display:
- **`src/components/InitiativeTracker.jsx`** (Line 328-343): `handleLoot()` function for loot generation
- **`src/utils/scavengingSystem.js`**: Scavenging system (may be related)

## Current Status

✅ **Loot Window Component Created** (`src/components/LootWindow.jsx`)
✅ **Integrated into Combat Arena** (`src/pages/CombatPage.jsx`)
✅ **Click Detection for Defeated Characters** (useEffect hook)
✅ **Loot Extraction** (uses existing `lootPrisoner()` function)
✅ **Item Selection and Taking** (individual and bulk)
✅ **State Management** (removes items from defeated fighters)
✅ **Combat Log Integration** (logs loot actions)

## Future Enhancements

- [ ] Add items to player/party inventory when taken
- [ ] Support for gold/currency in loot
- [ ] Weight limits when taking items
- [ ] Item stacking/quantity management
- [ ] Quest-specific loot tables
- [ ] Loot quality/rarity indicators
- [ ] Item comparison (show player's current equipment vs loot)

## Testing Checklist

- [ ] Defeat an enemy in combat
- [ ] Click on the defeated enemy on the tactical map
- [ ] Verify loot window opens showing all items
- [ ] Test taking individual items
- [ ] Test "Take Selected" with multiple items
- [ ] Test "Take All" button
- [ ] Verify items are removed from defeated fighter
- [ ] Verify combat log shows loot actions
- [ ] Test with enemy that has no loot (should show message)
- [ ] Test closing window without taking items


# MOVE Command Usage - UI Entry Points

## Summary
The MOVE command is now **engine-authoritative** (when engine is available). The modular handler path (`movementActions.js`) dfocusatches MOVE commands to the engine, which emits events that update React state. The flow is:

1. **UI Button** â†’ `activateMovementMode()` â†’ Sets movement mode active
2. **User clicks hex** â†’ `onMoveSelect` callback â†’ `handleMoveSelect()` or `handleMoveSelectAction()`
3. **Modular handler** â†’ Dfocusatches `{type: "MOVE", eid, to, meta}` to engine via `dfocusatchEngineCommand()`
4. **Engine processes** â†’ Validates move, calculates cost, emits events
5. **React state updates** â†’ Engine events trigger `setPositions()`, `setFighters()`, `endTurn()` via event bridge

**Fallback**: If engine is not available, falls back to UI-authoritative path (direct state updates).

## UI Entry Points

### 1. Move Button (Multiple Locations)

#### Location 1: Mobile Drawer Button
**File:** `src/pages/CombatPage.jsx`  
**Line:** 20279-20288
```jsx
<Button
  colorScheme="blue"
  onClick={() => {
    activateMovementMode();
    onMobileDrawerClose();
  }}
  isDisabled={!currentFighter || currentFighter.type !== "player" || !showTacticalMap}
>
  ðŸš¶ Move
</Button>
```

#### Location 2: Dedicated Move Button
**File:** `src/pages/CombatPage.jsx`  
**Line:** 17464
```jsx
onClick={activateMovementMode}
```

#### Location 3: Another Move Button Location
**File:** `src/pages/CombatPage.jsx`  
**Line:** 18747
```jsx
onClick={activateMovementMode}
```

### 2. Movement Mode Activation

**File:** `src/pages/CombatPage.jsx`  
**Line:** 3766-3773
```javascript
const activateMovementMode = useCallback(() => {
  if (currentFighter && currentFighter.type === "player") {
    setMovementMode({ active: true, isRunning: false });
    setSelectedMovementFighter(currentFighter.id);
    setShowMovementSelection(true); // Show movement selection UI
    addLog(`ðŸš¶ Select a highlighted hex to move ${currentFighter.name}`, "info");
  }
}, [currentFighter, addLog]);
```

### 3. Hex Selection Handler (TacticalMap)

**File:** `src/pages/CombatPage.jsx`  
**Line:** 18266-18276
```javascript
onMoveSelect={(x, y) => {
  // If circle placement tool is active, set selected position
  if (showCirclePlacementTool) {
    setSelectedCirclePosition({ x, y });
  } else if (settings?.useModularMovementHandlers && currentFighter) {
    handleMoveSelectAction(currentFighter, { x, y });
  } else {
    // Normal movement selection
    handleMoveSelect(x, y);
  }
}}
```

### 4. Movement Handlers

#### Option A: Modular Handler (if `useModularMovementHandlers` is enabled)
**File:** `src/pages/CombatPage.jsx`  
**Line:** 8094-8134
```javascript
const handleMoveSelectAction = useCallback((attacker, destinationHex) => {
  if (!attacker || !destinationHex) return;
  handleMoveSelectHandler(destinationHex.x, destinationHex.y, {
    movementMode,
    selectedMovementFighter: attacker.id,
    positions,
    currentFighter: attacker,
    addLog,
    fighters,
    isHexOccupied,
    getWeaponRange,
    turnCounter,
    endTurn,
    setPositions,
    setFighters,
    setMovementMode,
    setShowMovementSelection,
    setSelectedMovementHex,
    setSelectedMovementFighter,
    setTemporaryHexSharing,
    positionsRef,
    attackRef,
  });
}, [/* dependencies */]);
```

**Handler Implementation:** `src/utils/combatActionHandlers/movementActions.js`  
**Line:** 29-193
- Function: `handleMoveSelect(x, y, context)`
- Updates positions directly via `setPositions()`
- Deducts action points via `setFighters()`
- Calls `endTurn()` after movement

#### Option B: Direct Handler (default)
**File:** `src/pages/CombatPage.jsx`  
**Line:** 5145-5293
```javascript
const handleMoveSelect = useCallback((x, y) => {
  if (movementMode.active && selectedMovementFighter && positions[selectedMovementFighter]) {
    const oldPos = positions[selectedMovementFighter];
    // ... validation and movement logic ...
    // Updates positions directly:
    setPositions(prev => ({
      ...prev,
      [selectedMovementFighter]: { x, y }
    }));
    // ... action cost deduction and turn ending ...
  }
}, [/* dependencies */]);
```

## Key Files

1. **`src/pages/CombatPage.jsx`**
   - `activateMovementMode()` - Line 3766
   - `handleMoveSelect()` - Line 5145
   - `handleMoveSelectAction()` - Line 8094
   - Move buttons - Lines 17464, 18747, 20282

2. **`src/utils/combatActionHandlers/movementActions.js`**
   - `handleMoveSelect()` - Line 29 (modular version)
   - `handleWithdrawAction()` - Line 302

3. **`src/components/TacticalMap.jsx`**
   - `onMoveSelect` prop - Triggers movement when hex is clicked

## Notes

- **Engine-authoritative**: Movement dfocusatches `MOVE` commands to engine (when available)
- **Event-driven updates**: Engine emits events that update React state (`positions`, `fighters`)
- **Action cost**: Engine calculates and emits `AP_SPENT` / `ATTACKS_CONSUMED` events
- **Turn ending**: Engine emits `TURN_ENDED` / `TURN_SHOULD_END` events
- **Two handler paths**: Uses modular handler if `settings.useModularMovementHandlers` is enabled, otherwise uses direct handler
- **Fallback**: If engine not available, falls back to UI-authoritative path

## Engine Integration (NEW)

### Step A: Engine Adapter in CombatPage.jsx

**Location:** `src/pages/CombatPage.jsx` (after refs section, ~line 1289)

- **Engine ref**: `engineRef` stores adapter instance
- **Event subscribers**: `engineEventSubscribersRef` tracks event callbacks
- **Adapter provides**:
  - `dfocusatch(cmd)` - Sends commands to engine worker
  - `onEvent(callback)` - Subscribes to engine events
- **Event bridge**: Processes engine events and updates React state:
  - `HEX_MOVED` / `MOVED` â†’ `setPositions()`
  - `AP_SPENT` / `ATTACKS_CONSUMED` â†’ `setFighters()`
  - `TURN_ENDED` / `TURN_SHOULD_END` â†’ `endTurn()`
  - `LOG` â†’ `addLog()`

### Step B: Modular Handler Dfocusatches MOVE

**Location:** `src/utils/combatActionHandlers/movementActions.js` (line ~147)

- **Before**: Directly called `setPositions()`, `setFighters()`, `endTurn()`
- **After**: Calls `dfocusatchEngineCommand({type: "MOVE", eid, to, meta})`
- **Fallback**: If `dfocusatchEngineCommand` not available, uses UI-authoritative path

### Step C: Required Engine Events

The engine worker must emit these events for MOVE commands to work:

#### 1. Movement Event
```javascript
{
  type: "HEX_MOVED" | "MOVED",
  eid: string,  // Entity ID (fighter ID)
  to: { x: number, y: number }  // Destination hex coordinates
}
```

#### 2. Action Point Consumption
```javascript
{
  type: "AP_SPENT" | "ATTACKS_CONSUMED",
  eid: string,  // Entity ID
  amount: number  // Number of action points/attacks consumed
}
```

#### 3. Turn End Signal
```javascript
{
  type: "TURN_ENDED" | "TURN_SHOULD_END",
  eid?: string  // Optional: Entity ID that ended turn
}
```

#### 4. Log Messages
```javascript
{
  type: "LOG",
  message: string,  // Log message text
  level?: "info" | "error" | "warning" | "combat"  // Log level
}
```

### Engine Worker Implementation

The engine worker needs a `move` method handler in `electron/engine.worker.cjs`:

```javascript
if (method === "move") {
  const result = await resolveMove(payload);
  parentPort.postMessage({ id, ok: true, result });
  return;
}
```

The `resolveMove` function (in `src/engine/resolveMove.cjs`) should:
1. Validate the move (check legality, range, action points)
2. Calculate movement cost
3. Update positions
4. Deduct action points
5. Return `{ events: [...] }` with:
   - `MOVED` / `HEX_MOVED` event
   - `AP_SPENT` / `ATTACKS_CONSUMED` event
   - `TURN_SHOULD_END` if no actions remaining
   - `LOG` events for user feedback

## Related Functions

- `handlePlayerFlightMove()` - Line 5062 (for flying combatants)
- `handleWithdrawAction()` - Line 302 (withdraw action)
- `handleAttackWithMovement()` - For move+attack combos


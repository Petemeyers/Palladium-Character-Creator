# Game Settings Integration Guide

This document shows how to use the Game Settings toggles in your combat logic.

## Files Created

1. **`src/context/GameSettingsContext.jsx`** - Context provider with localStorage persistence
2. **`src/components/GameSettingsPanel.jsx`** - Settings UI panel (Chakra UI)
3. **`src/main.jsx`** - Updated to include GameSettingsProvider
4. **`src/pages/CombatPage.jsx`** - Added settings button and modal

## Available Settings

- `usePainStagger` - Enable/disable pain stagger from heavy blunt weapons
- `useMoraleRouting` - Enable/disable morale checks and routing behavior
- `useInsanityTrauma` - Enable/disable horror factor checks and insanity accumulation

## Usage Examples

### 1. Pain Stagger (in attack resolution)

```javascript
import { useGameSettings } from "../context/GameSettingsContext";
import { applyPainStagger } from "../utils/painSystem";

function resolveAttack(attacker, defender, damage, weapon, addLog) {
  const { settings } = useGameSettings();
  
  // ... calculate finalDamage, etc.
  
  let defenderAfterHit = defender;
  let bigPainHit = false;
  
  if (settings.usePainStagger) {
    const painResult = applyPainStagger({
      defender: defenderAfterHit,
      damageDealt: finalDamage,
      weapon: weapon,
      addLog: addLog,
    });
    
    defenderAfterHit = painResult.updatedDefender || defenderAfterHit;
    bigPainHit = painResult.painTriggered;
  }
  
  // Continue with HP updates, morale checks, etc.
}
```

### 2. Morale & Routing (after damage)

```javascript
import { resolveMoraleCheck } from "../utils/moraleSystem";

if (settings.useMoraleRouting) {
  const hpPercent = defenderAfterHit.currentHP / 
    (defenderAfterHit.maxHP || defenderAfterHit.currentHP || 1);
  
  const alliesDownRatio = getAlliesDownRatio(fighters, defenderAfterHit);
  
  const moraleOutcome = resolveMoraleCheck(defenderAfterHit, {
    roundNumber: currentRound,
    reason: bigPainHit ? "pain_hit" : "damage",
    hpPercent: hpPercent,
    alliesDownRatio: alliesDownRatio,
    horrorFailed: false,
    bigPainHit: bigPainHit,
  });
  
  defenderAfterHit = {
    ...defenderAfterHit,
    moraleState: moraleOutcome.moraleState,
  };
  
  if (moraleOutcome.moraleState.status === "ROUTED") {
    addLog(`🏃 ${defenderAfterHit.name} breaks and ROUTES!`, "warning");
  }
}
```

### 3. Enemy AI Routing Behavior

```javascript
import {
  getThreatPositionsForFighter,
  makeIsHexOccupied,
  findBestRetreatHex,
  isAtMapEdge,
} from "../utils/routingSystem";

function handleEnemyTurn(enemy) {
  const { settings } = useGameSettings();
  
  // Check if enemy is routed and should flee
  if (settings.useMoraleRouting && 
      enemy.moraleState?.status === "ROUTED" && 
      !enemy.moraleState?.hasFled) {
    
    const positions = positionsRef.current;
    const fightersSnapshot = fighters;
    
    const threats = getThreatPositionsForFighter(enemy, fightersSnapshot, positions);
    const isHexOccupied = makeIsHexOccupied(positions, enemy.id);
    
    const dest = findBestRetreatHex({
      currentPos: positions[enemy.id],
      threatPositions: threats,
      maxSteps: 4,
      isHexOccupied: isHexOccupied,
      getHexNeighbors: getHexNeighbors,
      isValidPosition: isValidPosition,
      calculateDistance: calculateDistance,
    });
    
    if (dest) {
      setPositions((prev) => ({
        ...prev,
        [enemy.id]: dest.position,
      }));
      
      let hasFled = enemy.moraleState?.hasFled || false;
      if (isAtMapEdge(dest.position, GRID_CONFIG.GRID_WIDTH, GRID_CONFIG.GRID_HEIGHT)) {
        hasFled = true;
      }
      
      setFighters((prev) =>
        prev.map((f) =>
          f.id === enemy.id
            ? {
                ...f,
                remainingAttacks: 0,
                moraleState: {
                  ...f.moraleState,
                  hasFled: hasFled,
                },
              }
            : f
        )
      );
      
      addLog(`🏃‍♂️ ${enemy.name} flees in panic!`, "warning");
      return endTurn();
    }
  }
  
  // ... normal AI attack/move logic ...
}
```

### 4. Horror Factor & Insanity (on first sight)

```javascript
import { resolveHorrorCheck } from "../utils/horrorSystem";

function checkHorrorFactor(viewer, horrorSource) {
  const { settings } = useGameSettings();
  
  if (settings.useInsanityTrauma) {
    const horrorResult = resolveHorrorCheck(viewer, horrorSource);
    
    if (horrorResult.triggered && !horrorResult.success) {
      // Apply fear penalties, update viewer's mentalState
      const updatedViewer = horrorResult.updatedViewer;
      
      addLog(
        `😱 ${viewer.name} fails Horror Factor check vs ${horrorSource.name}! (+1 Insanity)`,
        "warning"
      );
      
      // Update viewer in fighters array
      setFighters((prev) =>
        prev.map((f) =>
          f.id === viewer.id ? updatedViewer : f
        )
      );
    }
  } else {
    // Optional: Simple save vs HF without insanity tracking
    // (if you want some horror effect even when insanity is disabled)
  }
}
```

## Notes

- Settings are automatically saved to localStorage
- Settings persist across page reloads
- All settings default to `true` (enabled)
- The settings panel is accessible via the "⚙️ Game Settings" button in CombatPage
- Settings can be reset to defaults via the "Reset to Defaults" button


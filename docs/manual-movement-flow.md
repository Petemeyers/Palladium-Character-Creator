# Manual Movement Flow

This document traces the current manual Walk/Run flow in combat and where it diverges between 2D and 3D.

## Current Walk/Move Flow

Manual movement is owned by `CombatPage.jsx`.

The normal Move/Walk activation path:

1. A button calls `activateMovementMode`.
2. `activateMovementMode` checks the current fighter is a player.
3. It sets:
   - `movementMode = { active: true, isRunning: false }`
   - `selectedMovementFighter = currentFighter.id`
   - `selectedActionType = "move"`
   - `showMovementSelection = true`
4. The reachable-hex effect runs when movement mode is active.
5. `TacticalMap` receives `movementMode` and `validMoves`.
6. The player clicks a highlighted 2D hex.
7. `CombatPage.jsx` calls `handleMoveSelect(x, y)` or the modular `handleMoveSelectAction(...)` path.
8. The handler commits `positions`, spends actions through `fighters`, clears movement mode, and schedules turn end.

Although the UI uses "Move" and sometimes "Walk", the direct movement resolver maps non-run movement to `"MOVE"`.

## Current Run Flow

Run is activated by buttons in `CombatPage.jsx`.

The common Run path sets:

- `movementMode = { active: true, isRunning: true }`
- `selectedMovementFighter = currentFighter.id`

Some run buttons also log that the fighter prepares to run. The action is not spent when Run is selected; action spend hastaminans when a destination is confirmed.

`resolveMoveMode(...)` maps `movementMode.isRunning` to `"RUN"`.

## Where Movement Type Is Selected

Movement type is selected in `CombatPage.jsx`, not inside `TacticalMap`.

Relevant state:

- `movementMode.active`
- `movementMode.isRunning`
- `selectedActionType`
- `playerMovementMode`
- `altitudeTargetFeet`

`resolveMoveMode(...)` maps UI state to movement modes:

- `selectedActionType === "withdraw"` -> `"WITHDRAW"`
- `selectedActionType === "charge"` -> `"CHARGE"`
- `movementMode.isRunning` -> `"RUN"`
- otherwise -> `"MOVE"`

Flight/ground selection is also handled in `CombatPage.jsx` through `playerMovementMode` and fighter flight capability checks.

## How Valid Movement Hexes Are Calculated

There are two current validation sources.

First, highlight calculation:

- `CombatPage.jsx` calls `fetchReachableHexes({ eid, mode })`.
- If the engine is available, it calls `engineRef.current.getReachableHexes(eid, mode)`.
- Returned hexes become `engineValidMoves`.
- `TacticalMap` receives those as `validMoves`.

Second, final direct commit validation:

- `handleMoveSelect(x, y)` re-calculates `validPositions` using `getMovementRange(oldPos, speed, actionsPerRound, {}, movementMode.isRunning)`.
- It rejects the move unless the clicked hex exists in that fallback range.

This means the UI can highlight engine-authoritative moves but then reject them through the older fallback validator. That is the main validation inconsistency to fix before expanding 3D interaction.

## 2D Versus 3D Movement Support

2D movement is the usable path today.

`TacticalMap.jsx` has a click pipeline for movement:

- checks `movementMode.active`
- checks clicked cell against `validMoves`
- calls selection callbacks
- lets `CombatPage.jsx` commit the move

The active 3D combat view does not currently provide equivalent combat movement selection callbacks. `HexArena3D.jsx` receives fighters and positions, but it does not accept `movementMode`, `validMoves`, `onMoveSelect`, or `onSelectedHexChange` props. The Three.js scene syncs the visual state but does not participate in the current manual Walk/Run click-to-move flow.

There is an older `CombatMap3D.jsx` / `mapScene3D.js` path that has selection and action callbacks, movement highlights, and pathfinding concepts, but that is not the active 3D map used by `CombatPage.jsx`.

## Code That Should Be Shared Later

The 2D and 3D maps should eventually share one interaction state and one validation source:

- selected/active fighter id
- current map interaction mode: none, move, run, charge, withdraw, target, deploy, editor paint
- reachable hexes with costs
- selected destination hex
- hovered hex
- commit callback

The movement validation should be centralized behind one function or hook owned by `CombatPage.jsx` or a small movement service. Both maps should receive the same `validMoves` and call the same destination commit path.

Recommended shared shape:

```js
{
  active: true,
  fighterId,
  actionType: "MOVE", // "MOVE" | "RUN" | "WITHDRAW" | "CHARGE"
  validMoves,
  costsByHex,
  hoveredHex,
  selectedHex,
  onHoverHex,
  onSelectHex
}
```

## Duplicated Or Inconsistent Areas

Known inconsistencies:

- `engineValidMoves` may come from engine reachability, but `handleMoveSelect` still validates with `getMovementRange`.
- Run buttons astaminaar in multiple places and do not all set exactly the same state. Some set `selectedActionType`, some only set `movementMode` and `selectedMovementFighter`.
- `handlePositionChange` and `handleMoveSelect` both commit positions, but they are separate code paths with different side effects.
- The 3D combat view receives visual positions but not manual movement interaction props.
- `mapViewMode` exists but does not currently govern the active 2D/3D render path.

The safest future movement patch is not to add new 3D movement logic first. It is to make the existing 2D movement state and validation path canonical, then let 3D call into that same path.


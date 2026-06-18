# Map System Overview

This document describes the current 2D and 3D combat map system as it exists now. It is a research snapshot, not an implementation plan.

## Active 2D Tactical Map

The active 2D combat map is rendered by `src/components/TacticalMap.jsx`.

`CombatPage.jsx` imports it at the top of the file and mounts it in the center combat column when `showTacticalMap` is true. The main render site passes:

- `combatants={fighters.map(...)}`
- `positions={tacticalMapPositions}`
- `dangerHexes={dangerHexes}`
- `movementMode={movementMode}`
- `validMoves={engineValidMoves.length > 0 ? engineValidMoves : undefined}`
- `onMoveSelect={...}`
- `onSelectedCombatantChange={setSelectedCombatantId}`
- `onHoveredCellChange={...}`
- `onSelectedHexChange={handleSelectedHexChange}`
- map-editor props such as `mode`, `mapDefinition`, `onMapCellEdit`, and `onMapCellsEdit`

`TacticalMap.jsx` renders an SVG grid. It owns internal display state such as selected combatant, hovered cell, valid move highlights, selected target hex, local editor brush state, and drag-paint tracking. It does not own the authoritative combat roster or authoritative fighter positions.

Related 2D/editor files:

- `src/components/TacticalMap.jsx`: active 2D grid renderer and in-map editor brush UI.
- `src/pages/CombatPage.jsx`: owns combat state and mounts `TacticalMap`.
- `src/pages/MapMakerPage.jsx`: standalone map maker page using the same `TacticalMap` editor mode.
- `src/data/movementRules.js`: grid config, distance helpers, movement range fallback.
- `src/utils/hexGridMath.js`: shared hex coordinate conversion helpers.

## Active 3D Map

The active 3D combat map is rendered through:

- `src/components/HexArena3D.jsx`: React wrastaminar.
- `src/utils/three/HexArena.js`: Three.js scene/conchampioner.
- `src/utils/three/mapBuilder3D.js`: 3D hex tile/map construction.
- `src/utils/three/hexTile.js`: tile mesh helpers.
- `src/utils/three/hexStackManager.js`: hex stack/tile manager.

`CombatPage.jsx` imports `HexArena3D` and mounts it inside a `FloatingPanel` when `show3DView` is true. `HexArena3D` lazily imports `../utils/three/HexArena.js`, calls `initHexArena(containerRef.current)`, and then syncs either editor state or combat state.

`src/utils/three/HexArena.js` owns the Three.js scene, renderer, camera, `OrbitControls`, grid meshes, character meshes, projectile meshes, embedded arrows, danger rings, lighting, and dfocusosal logic. It exposes a small API back to React:

- `syncMapEditorState(terrainDef, changedCells)`
- `syncCombatState({ fighters, positions, renderPositions, projectiles, embeddedArrows, impactReactions, dangerHexes, terrain })`
- `dfocusose()`

There is also an older/alternate 3D path:

- `src/components/CombatMap3D.jsx`
- `src/scene/mapScene3D.js`

`CombatMap3D` creates a `GameConchampioner` and `create3DMapScene`, but it is not imported by the active `CombatPage.jsx`. Treat it as dormant for current combat-map work unless a task explicitly asks to revive or consolidate it.

## Open/Closed State Ownership

`CombatPage.jsx` owns the active map visibility state:

- `showTacticalMap`: controls whether the 2D tactical map area is shown.
- `show3DView`: controls whether the floating 3D arena panel is mounted.
- `combat3DControlsCollapsed`: controls the bottom control strip inside the 3D floating panel.
- `mapViewMode`: exists as `"2D"` or `"3D"`, but the current combat render does not use it as the primary source of truth. The actual visibility is conchampioned by `showTacticalMap` and `show3DView`.

`FloatingPanel.jsx` provides a visible close icon, but its close button currently only logs `Close panel`. It does not call back into `CombatPage.jsx`, so it cannot clear `show3DView`.

## Selection And Movement State Ownership

`CombatPage.jsx` owns the authoritative combat interaction state:

- `selectedCombatantId`
- `hoveredCell`
- `selectedHex`
- `selectedMovementFighter`
- `movementMode`
- `selectedActionType`
- `playerMovementMode`
- `engineValidMoves`
- `moveCostsByHex`

`TacticalMap.jsx` mirrors local display state for selected combatant, hovered cell, valid move highlights, and selected target hex. It reports interactions to `CombatPage.jsx` through callbacks.

The 3D `HexArena3D` path currently receives rendered combat state but does not expose a normal combat click/move selection callback to `CombatPage.jsx`. It is primarily a viewer/editor preview in the active combat page.

## How 2D And 3D Receive Fighter Positions

`CombatPage.jsx` owns combat `positions` and `renderPositions`.

The 2D map receives `tacticalMapPositions`, which is derived in `CombatPage.jsx` and passed to `TacticalMap` as `positions`.

The 3D map receives:

- `fighters`
- `positions`
- `renderPositions`

In `src/utils/three/HexArena.js`, `syncCombatState` uses `(renderPositions || positions)[fighterId]` for each fighter. It accepts either axial `{ q, r }` positions or offset/grid `{ x, y }` positions. If it receives `{ x, y }`, it converts to axial with `offsetToAxial`.

## How Fighter Positions Are Committed

Manual map movement from the 2D map ultimately flows into `CombatPage.jsx`.

The main movement click path is:

1. `TacticalMap` cell click detects `movementMode.active`.
2. If the clicked hex is in `validMoves`, it calls `onSelectedHexChange({ x, y })`.
3. In the current `CombatPage.jsx` mount, `onMoveSelect` calls either `handleMoveSelectAction(...)` when modular movement handlers are enabled, or `handleMoveSelect(x, y)` for the existing direct path.
4. `handleMoveSelect` validates actions and reachability, updates `positions`/`positionsRef.current`, updates `fighters` for action spending and landing state, clears movement selection state, then schedules turn end.

There is also `handlePositionChange(combatantId, newPosition, movementInfo)`, used by map/AI movement flows. It commits to `positions`, syncs combined body positions, updates `positionsRef.current`, queues movement animation, and may schedule turn end depending on `movementInfo`.

Important inconsistency: the movement highlight effect can use engine-authoritative reachable hexes through `engineValidMoves`, but `handleMoveSelect` still revalidates using `getMovementRange(...)` from `movementRules.js`. That means highlight validation and final commit validation can diverge.


# Map Builder Mode Plan

This plan covers the first non-combat Map Builder / Map Editor direction. It is separate from active combat by design: "real time" means editor changes update the preview immediately while editing, not that terrain can be edited during a running battle.

## Recommended Location

The app already has a separate Map Maker entry point:

- `src/App.jsx` routes `/map-maker` to `MapMakerPage`.
- `src/components/Navbar.jsx` links to `/map-maker`.
- `src/components/HomePage.jsx` also links to Map Maker.
- `src/pages/MapMakerPage.jsx` renders a standalone editor outside combat.

That route should become the primary Map Builder mode. This is safer than adding terrain editing to `CombatPage.jsx`, because it avoids combat turn state, action spending, AI scheduling, attack resolution, and active fighter positions.

The first implementation pass should keep the existing `/map-maker` route and clarify it as a non-combat builder. A later UX pass can rename labels from "Map Maker" to "Map Builder" if desired, but the route does not need to change first.

## Existing Code To Reuse

The current Map Maker page already reuses the important rendering pieces:

- `src/pages/MapMakerPage.jsx`: non-combat page-level editor state.
- `src/components/TacticalMap.jsx`: 2D map editor mode through `mode="MAP_EDITOR"`.
- `src/components/HexArena3D.jsx`: React wrapper around the Three.js arena.
- `src/utils/three/HexArena.js`: exposes `syncMapEditorState(...)`.
- `src/utils/three/mapBuilder3D.js`: builds and incrementally updates 3D terrain tiles.

`MapMakerPage.jsx` currently passes empty combat state into the preview:

- `fighters={[]}`
- `positions={{}}`
- `mode="MAP_EDITOR"`
- `terrain={mapDefinition}`
- `mapDefinition={mapDefinition}`

That is the right direction. The page should stay independent from `CombatPage.jsx`.

## Combat-Only Props To Remove Or Make Optional

`HexArena3D` is shared by combat and map editing, so editor mode should not require combat-only concepts. These props should remain optional for preview-only mode:

- `fighters`
- `positions`
- `renderPositions`
- `currentTurn`
- `selectedCombatantId`
- `movementMode`
- `validMoves`
- `selectedMovementFighter`
- `dangerHexes`
- `projectiles`
- `embeddedArrows`
- `impactReactions`
- `onHexHover`
- `onHexSelect`

For Map Builder preview, the required shape should be much smaller:

- `mode="MAP_EDITOR"`
- `visible={true}`
- `terrain` or `mapDefinition`
- optional editor callbacks for selected hex and changed cells

If a future patch needs new preview-only behavior, add narrow optional props such as `editorSelection`, `onEditorHexSelect`, or `previewOnly`. Do not make `HexArena3D` depend on `CombatPage.jsx` state.

## Editor State Separation

Map Builder state should live in `MapMakerPage.jsx` or small editor helpers, not in combat state.

Current editor-owned state includes:

- map name
- map type
- base terrain
- lighting
- grid width and height
- map definition/grid
- selected terrain brush
- selected saved map id
- import/export JSON text
- 3D preview visibility

Future editor state should also be owned outside combat:

- selected hex
- selected edit tool
- selected texture id
- height/elevation control value
- walkable flag
- move cost
- cover
- line-of-sight blocking
- selected prop
- dragging prop id
- grabbed object state
- spawn zone editing state

No editor state should write to `fightersRef`, `positionsRef`, turn refs, combat action state, AI state, or attack state.

## Prop Placement And Grab/Drop Interaction

Map Builder props should use an editor-owned `mapProps` list, not combat fighters or deployment state:

```js
mapProps = [
  {
    id,
    type,
    name,
    modelUrl,
    q,
    r,
    rotation,
    scale,
    blocksMovement,
    blocksLineOfSight
  }
];
```

The first interaction model should be input-source agnostic:

- `beginPropGrab(...)`: select/grab a prop from mouse, touch, or future VR controller input.
- `updatePropGrabHover(...)`: raycast the map, update the hovered hex, and preview the prop over that hex.
- `completePropDrop(...)`: release the prop, snap it to a valid hex, or return it to the start hex.

Future VR mapping should reuse the same concept:

- VR trigger down = `beginPropGrab(...)`
- controller ray or hand movement = `updatePropGrabHover(...)`
- trigger release = `completePropDrop(...)`

For now, placed props are editor-only. They should not affect combat movement, line of sight, deployment, or targeting until saved-map combat integration deliberately consumes them.

## Live 3D Preview Flow

The existing live preview path is already close to the intended design:

1. The user edits cells in `TacticalMap` with `mode="MAP_EDITOR"`.
2. `TacticalMap` calls `onMapCellEdit` or `onMapCellsEdit`.
3. `MapMakerPage.jsx` updates `mapDefinition.grid`.
4. The page queues changed cells with `requestAnimationFrame`.
5. `arena3DRef.current.syncMapEditorState(latest, changes)` updates the Three.js preview.
6. `mapBuilder3D.js` updates terrain material and rebuilds geometry when height/elevation changes.

This is the desired meaning of real-time editing: every editor change should update the local 3D preview immediately.

Future height and texture controls should update the same `mapDefinition.grid[y][x]` cell shape, then call the same queued 3D sync path. Avoid a second live-preview mechanism.

## Saved Maps Feeding Combat Later

Saved maps should not be injected into active combat mid-battle. The safe path is:

1. Build or load a map in `/map-maker`.
2. Save/export the map JSON.
3. In a later pre-combat setup screen, choose a saved map before combat starts.
4. Convert the saved map into the terrain shape consumed by:
   - `TacticalMap`
   - `HexArena3D`
   - deployment/manual placement
   - movement validation
5. Start combat with that map as the initial arena definition.

Combat should treat the selected saved map as read-only terrain during a running fight. Any later "edit and replay" flow should leave combat, edit in Map Builder, then start a new combat from the updated map.

## Current Compatibility Notes

There are multiple map shapes in the app today:

- `MapMakerPage.jsx` stores a `grid[y][x]` map definition in localStorage under `mapMaker.savedMaps.v1`.
- `TacticalMap.jsx` consumes grid-based editor data.
- `HexArena.js` can generate or sync from grid-based terrain data.
- `backend/models/Map.js` stores maps as `width`, `height`, `terrainPreset`, `seed`, `version`, `hexes`, and `entities`.
- The backend hex shape currently uses `{ q, r, terrain, elev }`.

The first save/load schema patch should add conversion helpers rather than forcing every subsystem to change at once.

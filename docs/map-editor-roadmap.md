# Map Editor Roadmap

This roadmap is intentionally phased. The current combat page and turn flow are fragile, so the editor should grow only after the 2D/3D map controls and movement interaction are stable.

## Phase 1: Stable 2D/3D Toggle And Controls

Goals:

- Put `2D Map` and `3D Map` buttons side by side.
- Make the 3D panel close reliably from inside the panel.
- Keep the current 3D scene implementation.
- Avoid movement, combat turn timing, and AI changes.
- Make the visible UI state match `showTacticalMap` and `show3DView`.

Deliverable: users can open and close either map view without feeling trapped.

## Phase 2: Unified Map Interaction State

Goals:

- Move shared map interaction state into one narrow shape owned by `CombatPage.jsx`.
- Feed the same selected fighter, hovered hex, selected hex, movement mode, and valid moves to both 2D and 3D.
- Keep one destination commit function for Walk/Run/Charge/Withdraw.
- Remove the mismatch where engine-highlighted moves can be rejected by fallback validation.

Deliverable: manual Walk/Run works the same from the 2D map and the 3D view.

## Phase 3: Live Terrain Preview Controls

Goals:

- Keep using `TacticalMap` editor mode for initial paint/height controls.
- Use `HexArena3D.syncMapEditorState(...)` for live 3D preview.
- Add focused controls for:
  - terrain type
  - texture id
  - hex height/elevation
  - walkable flag
  - cover
  - line-of-sight blocking
- Do not create a new map format until the app can round-trip the current one safely.

Deliverable: editing a cell in 2D updates the 3D preview immediately.

## Phase 4: Map Save/Load JSON Schema

Goals:

- Define one app-level map JSON shape.
- Add import/export around that shape.
- Support both current `grid[y][x]` editor data and future normalized `hexes[]`.
- Keep conversion functions explicit and tested.

Proposed map JSON shape:

```json
{
  "id": "map-id",
  "name": "Map Name",
  "size": {
    "width": 40,
    "height": 30
  },
  "mapType": "hex",
  "hexes": [
    {
      "q": 0,
      "r": 0,
      "x": 0,
      "y": 0,
      "height": 0,
      "terrainType": "OPEN_GROUND",
      "textureId": "grass_tile",
      "walkable": true,
      "cover": 0,
      "blocksLineOfSight": false
    }
  ],
  "props": [],
  "spawnZones": [],
  "lighting": {
    "preset": "BRIGHT_DAYLIGHT"
  },
  "theme": "open_field"
}
```

Compatibility notes:

- Backend `Map` currently stores `hexes` as `{ q, r, terrain, elev }`.
- `MapMakerPage.jsx` currently stores local maps in `localStorage` under `mapMaker.savedMaps.v1`.
- `CombatPage.jsx` and `TacticalMap.jsx` often use `grid[y][x]`.
- `HexArena.js` accepts grid data and converts offset `{ x, y }` to axial `{ q, r }`.

Deliverable: maps can be exported and imported without losing terrain or height data.

## Phase 5: Playable Saved Maps

Goals:

- Start combat from a loaded map.
- Ensure deployment reads spawn zones or selected manual placements.
- Ensure `combatTerrain`, `mapDefinition`, `TacticalMap`, and `HexArena3D` all receive the same terrain data.
- Preserve manual deployment positions.
- Keep victory, AI, and turn timing out of scope except where they already consume positions.

Deliverable: a saved map can become the actual combat arena.

## Phase 6: Map Library And Import System

Goals:

- Add a larger in-app map library.
- Support local import/export and backend persistence.
- Add tags such as biome, size, encounter type, difficulty, indoor/outdoor, and lighting.
- Add migration/version handling for older saved map files.

Deliverable: users can build, save, load, organize, and play many maps.


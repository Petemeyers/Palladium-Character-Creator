# Map Builder First Patches

Each patch should be one narrow task. Do not combine these with combat movement, AI, attack, or turn-flow changes.

## A. Add Map Builder Entry Point Outside Combat

Status: mostly present.

The app already has `/map-maker`, `MapMakerPage.jsx`, navbar/home links, and a non-combat editor surface. The first safe patch should clarify this existing entry point as the Map Builder mode without changing combat.

Narrow task:

- Keep `/map-maker`.
- Confirm the page is accessible from navigation.
- Adjust labels/help text only if needed.
- Do not touch `CombatPage.jsx`.

## B. Render `HexArena3D` In Preview-Only Mode

Status: mostly present.

`MapMakerPage.jsx` already renders:

- `HexArena3D`
- `fighters={[]}`
- `positions={{}}`
- `mode="MAP_EDITOR"`
- `terrain={mapDefinition}`
- `mapDefinition={mapDefinition}`

Narrow task:

- Make any combat-only `HexArena3D` props optional if they are not already.
- Add a small `previewOnly` or editor-specific prop only if a concrete bug requires it.
- Do not change combat rendering.

## C. Add Editor Selection State For One Selected Hex

Status: next useful implementation patch.

Narrow task:

- Add `selectedHex` state to `MapMakerPage.jsx`.
- Wire 2D editor hex selection to update that state.
- If safe, wire 3D editor raycast selection to the same state.
- Display the selected hex coordinates in the editor controls.
- Do not change manual combat movement selection.

This should be the first new implementation patch because height and texture controls need a target hex.

## D. Add Live Preview Controls For Height And Terrain Texture

Status: after selected hex exists.

Narrow task:

- Add controls for the selected hex only:
  - height/elevation
  - terrain type
  - texture id if the renderer can consume it
- Update `mapDefinition.grid[y][x]`.
- Reuse the existing queued `syncMapEditorState(...)` path.
- Do not add terrain editing to active combat.

## E. Add In-Memory Map JSON Export/Import

Status: partly present.

`MapMakerPage.jsx` already has import/export for its current `mapDefinition` shape. The next safe version should export the normalized schema from `docs/map-save-load-schema.md` while still importing the current shape.

Narrow task:

- Add conversion helpers.
- Export the normalized saved-map shape.
- Import either normalized saved maps or legacy `mapDefinition` grids.
- Keep localStorage persistence unchanged in the first pass unless required.

## F. Add Save/Load Later

Status: localStorage exists, formal schema persistence later.

Narrow task:

- Store normalized saved maps under a versioned key.
- Migrate or read legacy `mapMaker.savedMaps.v1`.
- Validate map JSON before saving.
- Preserve unknown fields.
- Do not wire saved maps into active combat yet.

## G. Add Combat Map Selection Later

Status: future combat setup work.

Narrow task:

- Add a pre-combat map selection UI.
- Convert the selected saved map into the terrain shape used by `TacticalMap` and `HexArena3D`.
- Apply spawn zones during deployment.
- Start combat with the selected map as read-only terrain.
- Do not allow terrain editing once combat has started.

## Recommended First Implementation Patch

Patch C is the next concrete implementation step: add one selected-hex state in `MapMakerPage.jsx` and show the selected coordinates in the non-combat editor.

Why:

- The entry point and 3D preview already exist.
- Height and texture editing need a selected hex.
- It stays outside combat.
- It avoids turn timing, AI, attack code, and movement rules.
- It keeps `HexArena3D` changes optional until 3D editor selection is clearly needed.


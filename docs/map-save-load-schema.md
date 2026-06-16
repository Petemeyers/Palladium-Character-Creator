# Map Save/Load Schema

This document proposes the app-level map JSON shape for future save/load and playable map selection. It is not a request to migrate all existing map storage in one patch.

## Goals

- Represent terrain, height, walkability, cover, props, spawn zones, lighting, and camera defaults.
- Round-trip through import/export without losing editor data.
- Convert cleanly to the current `grid[y][x]` editor shape.
- Convert cleanly to the backend `hexes[]` shape.
- Feed combat only before combat starts, not during an active fight.

## Proposed JSON Shape

```json
{
  "id": "map-forest-road-001",
  "name": "Forest Road Ambush",
  "version": 1,
  "size": {
    "width": 40,
    "height": 30
  },
  "hexes": [
    {
      "q": 0,
      "r": 0,
      "height": 0,
      "terrainType": "OPEN_GROUND",
      "textureId": "grass_tile",
      "walkable": true,
      "moveCost": 1,
      "cover": 0,
      "blocksLineOfSight": false
    }
  ],
  "props": [
    {
      "id": "prop-oak-001",
      "type": "tree",
      "modelUrl": "/assets/props/oak.glb",
      "q": 5,
      "r": 8,
      "rotation": 0,
      "scale": 1,
      "blocksMovement": true,
      "blocksLineOfSight": true
    }
  ],
  "spawnZones": [
    {
      "id": "spawn-party",
      "name": "Player Start",
      "team": "player",
      "hexes": [
        {
          "q": 1,
          "r": 1
        }
      ]
    }
  ],
  "lighting": {
    "preset": "BRIGHT_DAYLIGHT",
    "sunIntensity": 1,
    "ambientIntensity": 0.7
  },
  "theme": {
    "id": "temperate_forest",
    "sky": "clear_day",
    "defaultTextureId": "grass_tile"
  },
  "cameraDefaults": {
    "position": {
      "x": 20,
      "y": 28,
      "z": 34
    },
    "target": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "zoom": 1
  }
}
```

## Field Notes

`id`: Stable map id for saved-map lists, imports, and future backend persistence.

`name`: User-facing map name.

`version`: Schema version for migrations.

`size`: Map dimensions. The current editor uses rectangular grid dimensions even when rendering hexes.

`hexes`: Normalized saved terrain. Each entry should identify one playable/editable hex.

`height`: Numeric elevation used by 3D column height and later movement/elevation rules. Current code also sees `elevation`; import/export should normalize both.

Map Builder height may be negative for sculpting below the base plane. Current editor bounds are `-10` to `20` with `0` as base terrain. Missing legacy height values should normalize to `0`; negative imported values should be preserved.

`terrainType`: Gameplay terrain key such as `OPEN_GROUND`, `LIGHT_FOREST`, or similar existing terrain-system values.

`textureId`: Visual material key. This should be allowed to differ from `terrainType` so a road, grass, mud, or stone texture can be previewed without changing movement semantics.

Current Map Builder terrain keys (`grass`, `forest`, `water`, `rock`, `stone`, `sand`, `dirt`, `road`) have lightweight placeholder texture assets for editor/shared map rendering. `terrainType` remains the semantic terrain choice; visual aliases such as `grass` and `grassland` can resolve to the same material. A later `textureId` may override only the visual material while preserving the terrain rules.

In the 3D Map Builder preview, each hex renders as a solid signed-height column. The saved terrain/texture fields drive the top face. Optional `wallTerrainType` or `wallTextureId` fields drive side faces independently; if both are missing, side textures resolve automatically from the top terrain for short/normal columns, with raised columns over 5ft defaulting to dirt/cliff sides.

`walkable`: Whether normal movement can enter this hex.

`moveCost`: Movement cost multiplier or additive cost, depending on the final movement rules.

`cover`: Numeric cover value for later combat rules. Keep this passive until combat consumes it deliberately.

`blocksLineOfSight`: Boolean LOS flag for future ranged/spell targeting and visibility.

`props`: Non-fighter objects placed on the map. Props should be separate from combat entities so the same saved map can be reused in multiple encounters.

Prop placement should persist the snapped hex position in `q`/`r`. Editor-only grab state such as `selectedPropId`, `draggingPropId`, `hoverHex`, or `grabbedObject` should not be saved.

Current first prototype behavior:

- `MapMakerPage.jsx` stores placed props in `mapProps` and mirrors that array to `mapDefinition.props`.
- Import/export round-trips the editor prop list with the existing map definition JSON.
- Current testing exports include both the editor `grid` shape and normalized `hexes[]` so edited terrain can be reloaded immediately while later schema helpers are still developed.
- Each prop stores `id`, `type`, `name`, `modelUrl`, `q`, `r`, `rotation`, `scale`, `blocksMovement`, and `blocksLineOfSight`.
- Mouse grab/drop state remains transient editor UI state and is not saved.

Future VR mapping should reuse the same editor actions:

- mouse down on prop = VR trigger down / grab
- mouse move raycast over map = controller ray or hand hover
- mouse up = trigger release / drop
- snap to hex = final placement written to `q`/`r`

`spawnZones`: Named sets of hexes available during deployment. Combat should use these before turn zero.

`lighting`: Preview and combat lighting settings.

`theme`: Visual defaults, biome, texture family, and optional sky/atmosphere metadata.

`cameraDefaults`: Preferred starting camera view for editor and combat preview.

## Current Shape Mapping

Current `MapMakerPage.jsx` shape:

```json
{
  "description": "Map Maker",
  "mapType": "hex",
  "terrain": "OPEN_GROUND",
  "lighting": "BRIGHT_DAYLIGHT",
  "grid": [
    [
      {
        "terrainType": "OPEN_GROUND",
        "terrain": "OPEN_GROUND",
        "height": 0,
        "elevation": 0
      }
    ]
  ],
  "mapSize": {
    "width": 40,
    "height": 30
  }
}
```

Backend `Map` model shape:

```json
{
  "kind": "HEX",
  "width": 40,
  "height": 30,
  "terrainPreset": "OPEN_GROUND",
  "seed": 0,
  "version": 1,
  "hexes": [
    {
      "q": 0,
      "r": 0,
      "terrain": "OPEN_GROUND",
      "elev": 0
    }
  ],
  "entities": []
}
```

The first implementation should add explicit conversion helpers:

- `gridToSavedMap(mapDefinition)`
- `savedMapToGrid(savedMap)`
- `savedMapToBackendMap(savedMap)`
- `backendMapToSavedMap(mapDoc)`

Keep these helpers small and tested before wiring saved maps into combat start.

## Save/Load Rules

- Saving from Map Builder should save editor data only, not combat fighters or turn state.
- Loading into Map Builder should update the editor state and rebuild/sync the 3D preview.
- Loading into combat should happen only before combat starts.
- Saved combat-ready maps should be treated as read-only during a running battle.
- Future migrations should preserve unknown fields when possible so older maps are not destroyed by newer editor versions.

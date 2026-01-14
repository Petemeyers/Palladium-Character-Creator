# Hex Texture Files - 2D and 3D

## 📁 Texture Files Location
**Directory:** `public/assets/textures/terrain/`

## ✅ Existing Texture Files (Physical Files)
1. **grassland.png** - Grassland/grass terrain texture
2. **dense_forest.png** - Dense forest terrain texture
3. **rocky.png** - Rocky terrain texture
4. **swamp.png** - Swamp/marsh terrain texture
5. **urban.png** - Urban/cobblestone terrain texture

## ⚠️ Referenced But Missing Texture Files
These are referenced in code but don't exist as physical files:
- **light_forest.png** - Referenced for LIGHT_FOREST terrain
- **water.png** - Referenced for WATER terrain
- **cave.png** - Referenced for CAVE_INTERIOR terrain
- **interior.png** - Referenced for INTERIOR terrain

---

## 🎨 2D Map Textures (TacticalMap.jsx)

### File: `src/components/TacticalMap.jsx`

**Texture Configuration:**
- **Lines 603-624:** `terrainTextures` object maps terrain types to texture paths
- **Lines 1414-1480:** `texturePatterns` useMemo hook generates SVG pattern definitions
- **Lines 1482-1495:** `getCellFill()` helper function returns texture pattern URL or fallback color
- **Lines 2476-2479:** SVG `<defs>` section renders texture patterns

**Texture Usage:**
- Textures are applied as SVG patterns using `<pattern>` and `<image>` elements
- Patterns are referenced via `url(#patternId)` in hex cell fills
- Fallback to solid colors if textures are disabled or unavailable

**Terrain Type Mappings:**
```javascript
OPEN_GROUND → grassland.png
LIGHT_FOREST → light_forest.png (missing)
DENSE_FOREST → dense_forest.png
ROCKY_TERRAIN → rocky.png
URBAN → urban.png
SWAMP_MARSH → swamp.png
CAVE_INTERIOR → cave.png (missing)
WATER → water.png (missing)
INTERIOR → interior.png (missing)
```

**Texture Cache:**
- No explicit cache in 2D (SVG patterns are defined once per render)
- Patterns are deduplicated by `patternId` to avoid duplicate definitions

---

## 🎮 3D Map Textures

### File 1: `src/utils/three/mapBuilder3D.js`

**Texture Loading:**
- **Line 10:** `textureLoader` - THREE.TextureLoader instance
- **Lines 160-161:** `textureCache` - Map for caching loaded textures
- **Lines 163-258:** `createTerrainTexture(terrainType)` function

**Texture Creation Strategy:**
1. **For "grass" terrain:** Loads actual `grassland.png` file
   - Uses `THREE.TextureLoader.load()`
   - Sets `RepeatWrapping` on both axes
   - Sets `repeat.set(2, 2)` for better coverage

2. **For other terrain types:** Creates procedural textures using Canvas
   - Generates 256x256 canvas textures
   - Creates patterns based on terrain type (forest, rock, water, sand, road)
   - Converts to `THREE.CanvasTexture`
   - Also uses `RepeatWrapping` and `repeat.set(2, 2)`

**Texture Usage:**
- **Line 274:** Used in `createHexMesh()` - applies texture to hex cylinder meshes
- **Line 482:** Used in `updateHexMeshFromCell()` - updates existing mesh textures
- Applied to `THREE.MeshStandardMaterial.map` property

**Terrain Type Handling:**
- Only "grass" loads actual PNG file (`grassland.png`)
- All other types use procedural canvas-generated textures

---

### File 2: `src/scene/mapScene3D.js`

**Texture Configuration:**
- **Lines 68-83:** `TERRAIN_TEXTURES` object maps terrain types to texture file paths
- **Line 85:** `textureLoader` - THREE.TextureLoader instance
- **Line 86:** `textureCache` - Map for caching loaded textures
- **Lines 95-111:** `loadTerrainTexture(key)` function loads and caches textures

**Texture Loading:**
- Uses `THREE.TextureLoader.load()` to load PNG files
- Sets `RepeatWrapping` on both axes
- Sets `repeat.set(1, 1)` (different from mapBuilder3D.js)
- Sets `center.set(0.5, 0.5)` and `rotation = 0`
- Configures `sRGBEncoding` for color accuracy
- Caches textures by path to avoid reloading

**Texture Usage:**
- **Line 527:** `loadTerrainTexture()` called for each tile
- **Lines 533-538:** Applied to `THREE.MeshStandardMaterial.map` property
- Used in flat hex geometry meshes

**Terrain Type Mappings:**
```javascript
DEFAULT → grassland.png
OPEN_GROUND → grassland.png
LIGHT_FOREST → light_forest.png (missing)
DENSE_FOREST → dense_forest.png
FOREST → light_forest.png (missing)
ROCKY_TERRAIN → rocky.png
ROCK → rocky.png
HILL → rocky.png
URBAN → urban.png
SWAMP_MARSH → swamp.png
WATER → water.png (missing)
CAVE_INTERIOR → cave.png (missing)
INTERIOR → interior.png (missing)
SAND → grassland.png
```

---

## 📊 Summary

### Files That Load/Use Textures:

**2D Map:**
- `src/components/TacticalMap.jsx` - SVG pattern-based textures for hex cells

**3D Map:**
- `src/utils/three/mapBuilder3D.js` - Texture loading for hex meshes (combat arena)
- `src/scene/mapScene3D.js` - Texture loading for 3D map scene

### Texture Loading Methods:

1. **2D (TacticalMap.jsx):**
   - SVG `<pattern>` elements with `<image>` references
   - Patterns defined in `<defs>` section
   - Applied via `url(#patternId)` in hex fills

2. **3D (mapBuilder3D.js):**
   - `THREE.TextureLoader` for "grass" terrain (actual PNG)
   - `THREE.CanvasTexture` for other terrain types (procedural)
   - Applied to `MeshStandardMaterial.map`

3. **3D (mapScene3D.js):**
   - `THREE.TextureLoader` for all terrain types (actual PNG files)
   - Applied to `MeshStandardMaterial.map`

### Texture Caching:

- **mapBuilder3D.js:** Caches by terrain type string
- **mapScene3D.js:** Caches by texture file path
- **TacticalMap.jsx:** No explicit cache (SVG patterns defined once per render)

### Missing Texture Files:

The following textures are referenced but don't exist:
- `light_forest.png`
- `water.png`
- `cave.png`
- `interior.png`

These will fall back to:
- **2D:** Solid colors defined in `terrainColors` object
- **3D (mapBuilder3D.js):** Procedural canvas textures
- **3D (mapScene3D.js):** Default `grassland.png` texture


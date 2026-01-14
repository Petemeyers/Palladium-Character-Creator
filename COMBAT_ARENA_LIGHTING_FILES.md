# Combat Arena Lighting Files

This document lists all files associated with lighting in the combat arena 3D scene.

## Primary Lighting Files

### 1. `src/utils/three/HexArena.js` ⭐ **MAIN FILE**
**Status:** Active - Contains the main combat arena lighting setup

**Lighting Components:**
- **HemisphereLight** - Sky/ground color (sky blue top, ground brown bottom)
  - Sky color: `0x87ceeb`
  - Ground color: `0x8b7355`
  - Intensity: `0.6`
- **AmbientLight** - Overall illumination
  - Color: `0xffffff`
  - Intensity: `0.3`
- **DirectionalLight (Sun)** - Main daylight source
  - Color: `0xfff4e6` (warm white/yellow)
  - Intensity: `1.2`
  - Position: `(30, 50, 20)`
  - Shadow settings: 4096x4096 map, soft shadows (radius: 4)
- **DirectionalLight (Fill)** - Reduces harsh shadows
  - Color: `0xffffff`
  - Intensity: `0.3`
  - Position: `(-20, 30, -15)`

**Renderer Settings:**
- Shadow map enabled: `true`
- Shadow type: `PCFSoftShadowMap`
- Tone mapping: `ACESFilmicToneMapping`
- Exposure: `1.0`

**Scene Background:**
- Color: `#87CEEB` (sky blue for daylight)

**Lines:** 386-423 (lighting setup), 331-347 (scene/renderer setup)

---

### 2. `src/utils/HexArena.js`
**Status:** Legacy/Alternative - Contains older lighting implementation

**Lighting Components:**
- **AmbientLight**
  - Color: `0xffffff`
  - Intensity: `0.6` (default), `0.2` (DARK mode)
- **DirectionalLight (Sun)**
  - Color: `0xffffff`
  - Intensity: `1.0` (default), `0.3` (DARK mode)
  - Position: `(20, 40, 20)`
  - Shadow casting: `true`

**Features:**
- `updateLighting(mode)` function for switching between lighting modes
- Supports "DARK" mode

**Lines:** 45-63

---

### 3. `src/scene/mapScene3D.js`
**Status:** Active - Used by CombatMap3D component

**Lighting Components:**
- **AmbientLight**
  - Color: `0xffffff`
  - Intensity: `0.45`
- **DirectionalLight (Sun)**
  - Color: `0xffffff`
  - Intensity: `1.0`
  - Position: `(20, 40, 20)`
  - Shadow settings: 2048x2048 map

**Features:**
- `applyLighting(scene, ambientLight, sun, lightingKey)` function
- Supports different lighting presets based on environment
- Used by `create3DMapScene()` function

**Lines:** 402-413 (lighting setup), 332-348 (applyLighting function)

---

### 4. `src/components/TacticalMap3DBackground.jsx`
**Status:** Active - 3D background for tactical map

**Lighting Components:**
- **AmbientLight**
  - Color: `0xffffff`
  - Intensity: `0.6`
- **DirectionalLight (Sun)**
  - Color: `0xffffff`
  - Intensity: `0.8`
  - Position: `(20, 40, 20)`
  - Shadow settings: 2048x2048 map

**Lines:** 72-87

---

## Supporting Files

### 5. `src/components/CombatMap3D.jsx`
**Status:** Active - React component that uses mapScene3D

**Role:** Wrapper component that initializes the 3D map scene (which includes lighting)
- Uses `create3DMapScene()` from `mapScene3D.js`
- Does not directly configure lighting, but uses the scene that has lighting

**Lines:** 24-28 (scene initialization)

---

### 6. `src/pages/CombatPage.jsx`
**Status:** Active - Main combat page

**Role:** Main page component that renders the combat arena
- Uses `HexArena3D` component (which uses `HexArena.js`)
- Does not directly configure lighting, but is the entry point for combat arena

**Note:** Contains references to lighting effects in spell/ability system, but not 3D scene lighting

---

## File Relationships

```
CombatPage.jsx
  └── HexArena3D.jsx
      └── src/utils/three/HexArena.js ⭐ (Main lighting setup)
          └── mapBuilder3D.js (Creates meshes with shadow properties)

CombatMap3D.jsx
  └── mapScene3D.js (Alternative lighting setup)
```

---

## Summary

**Primary Combat Arena Lighting:**
- **Main File:** `src/utils/three/HexArena.js` - Contains realistic daylight lighting
- **Alternative:** `src/utils/HexArena.js` - Older implementation with basic lighting
- **Alternative Scene:** `src/scene/mapScene3D.js` - Used by CombatMap3D component

**Total Files with Lighting Code:** 4
1. `src/utils/three/HexArena.js` ⭐ (Main - daylight lighting)
2. `src/utils/HexArena.js` (Legacy - basic lighting)
3. `src/scene/mapScene3D.js` (Alternative scene)
4. `src/components/TacticalMap3DBackground.jsx` (3D background)

**Files that Use Lighting (but don't define it):** 2
1. `src/components/CombatMap3D.jsx`
2. `src/pages/CombatPage.jsx`

---

## Notes

- The main combat arena uses `src/utils/three/HexArena.js` which has the most advanced daylight lighting setup
- Shadow properties are also set on meshes in `mapBuilder3D.js` (`castShadow`, `receiveShadow`)
- The lighting system supports different modes (daylight, dark) through the `updateLighting()` function in the legacy file


import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  buildHexagon3DFromGrid,
  buildRectangular3DMap,
  createHexMesh,
  syncGridDiffToGroup,
} from "./mapBuilder3D.js";
import {
  HEX_RADIUS,
  HEX_TILE_THICKNESS,
  worldVectorFromEntity,
  offsetToAxial,
  axialToOffset,
} from "../hexGridMath.js";
import { GRID_CONFIG } from "../../data/movementRules.js";
import {
  createCharacterIcon,
  updateCharacterBillboards,
} from "../characterPlaceholders.js";
import { hexDistance } from "../hexPathfinding.js";

// Map editor state
let editorActive = false;

/**
 * Open the map editor
 */
export function openMapEditor() {
  editorActive = true;
  console.log("[HexArena] Map editor opened");
}

/**
 * Close the map editor
 */
export function closeMapEditor() {
  editorActive = false;
  console.log("[HexArena] Map editor closed");
}

/**
 * Check if map editor is active
 * @returns {boolean} True if editor is active
 */
export function isEditorActive() {
  return editorActive;
}

/**
 * Calculate scale factor for a fighter based on footprint
 * Scales model proportionally to desired footprint size
 * @param {Object} fighter - Fighter object with visual and footprint data
 * @returns {number} Scale factor (clamped between 0.25 and 8)
 */
export function getScaleForFootprint(fighter) {
  const desiredFeet = fighter?.footprint?.feet ?? 5; // default 1 hex
  const baseHeightFt = fighter?.visual?.baseHeightFt ?? 6;

  // Simple tabletop rule: scale proportionally by "presence"
  // (It won't be physically perfect, but it will be consistent.)
  const targetPresenceFt = desiredFeet; // 20 ft for Ariel
  const scale = targetPresenceFt / baseHeightFt; // 20/6 = 3.33...

  // Clamp so nothing goes insane
  return Math.max(0.25, Math.min(8, scale));
}

/**
 * Get all hexes occupied by a large creature
 * @param {Object} centerHex - Center hex {q, r}
 * @param {number} radiusHex - Radius in hexes
 * @returns {Array<Object>} Array of occupied hexes {q, r}
 */
export function getOccupiedHexes(centerHex, radiusHex) {
  if (!centerHex || typeof radiusHex !== "number" || radiusHex < 0) {
    return centerHex ? [centerHex] : [];
  }

  if (radiusHex === 0) {
    return [centerHex];
  }

  const results = [];
  for (let dq = -radiusHex; dq <= radiusHex; dq++) {
    for (let dr = -radiusHex; dr <= radiusHex; dr++) {
      const hex = { q: centerHex.q + dq, r: centerHex.r + dr };
      if (hexDistance(centerHex, hex) <= radiusHex) {
        results.push(hex);
      }
    }
  }
  return results;
}

function degreesToRadians(deg) {
  const n = Number(deg);
  if (!Number.isFinite(n)) return 0;
  return (n * Math.PI) / 180;
}

/**
 * Compute hex center-to-center spacing in world space
 * Uses actual worldVectorFromEntity to stay consistent with grid positioning
 */
function getHexCenterSpacingWorld() {
  // Distance between (0,0) and neighbor (1,0)
  const a = worldVectorFromEntity(
    { q: 0, r: 0, altitude: 0, tileHeightUnits: 0 },
    HEX_RADIUS,
    HEX_TILE_THICKNESS
  );
  const b = worldVectorFromEntity(
    { q: 1, r: 0, altitude: 0, tileHeightUnits: 0 },
    HEX_RADIUS,
    HEX_TILE_THICKNESS
  );

  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Compute desired footprint radius in world units based on radiusHex
 * This matches the same world-space calculation used for the debug ring
 */
function getDesiredFootprintRadiusWorld(fighter) {
  const radiusHex = fighter?.footprint?.radiusHex ?? 0;
  if (radiusHex <= 0) return HEX_RADIUS * 0.6; // Default for small creatures

  const centerSpacing = getHexCenterSpacingWorld();
  // Radius in world space to the OUTER EDGE:
  // radiusHex steps to outer hex centers + one hex radius to reach the edge
  return radiusHex * centerSpacing + HEX_RADIUS;
}

// ===== DEBUG: Footprint base rings =====
const DEBUG_BASE_RINGS = true; // toggle off when done
const DEBUG_RING_Y = 0.03; // slight lift to prevent z-fighting
const DEBUG_RING_COLOR = 0x00ff66; // bright green

function makeHexOutlineGeometry(radius) {
  // Flat hex on XZ plane, then rotate line later so it's on the ground.
  const points = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i; // 60° steps
    points.push(
      new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)
    );
  }
  // LineLoop automatically closes the loop, so we don't need to duplicate the first point

  const geom = new THREE.BufferGeometry().setFromPoints(points);
  return geom;
}

function getDebugRingRadiusWorld(fighter, centerHex) {
  const radiusHex = fighter?.footprint?.radiusHex ?? 0;
  if (!centerHex || radiusHex <= 0) return HEX_RADIUS * 0.6;

  // Get the actual occupied hexes (same logic as blocking)
  const occupied = getOccupiedHexes(centerHex, radiusHex);

  // Compute the maximum world distance from center to any occupied hex center,
  // then add one hex radius so the ring reaches the outer edge.
  const centerWorld = worldVectorFromEntity(
    { q: centerHex.q, r: centerHex.r, altitude: 0, tileHeightUnits: 0 },
    HEX_RADIUS,
    HEX_TILE_THICKNESS
  );

  let maxCenterDist = 0;
  for (const h of occupied) {
    const p = worldVectorFromEntity(
      { q: h.q, r: h.r, altitude: 0, tileHeightUnits: 0 },
      HEX_RADIUS,
      HEX_TILE_THICKNESS
    );
    const dx = p.x - centerWorld.x;
    const dz = p.z - centerWorld.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > maxCenterDist) maxCenterDist = d;
  }

  // Add hex radius to cover the OUTER EDGE of the outermost hex
  return maxCenterDist + HEX_RADIUS;
}

function ensureDebugBaseRing(characterMesh, fighter, centerHex) {
  if (!characterMesh) return;

  // Remove if debug is off
  if (!DEBUG_BASE_RINGS) {
    const existing = characterMesh.userData?.debugBaseRing;
    if (existing) {
      characterMesh.remove(existing);
      existing.geometry?.dispose?.();
      existing.material?.dispose?.();
      characterMesh.userData.debugBaseRing = null;
    }
    return;
  }

  const desiredRadius = getDebugRingRadiusWorld(fighter, centerHex);
  const existing = characterMesh.userData?.debugBaseRing;

  // If ring exists and radius hasn't changed much, just keep it
  if (
    existing &&
    Math.abs((existing.userData?.radius ?? 0) - desiredRadius) < 0.01
  ) {
    return;
  }

  // Replace old ring if present
  if (existing) {
    characterMesh.remove(existing);
    existing.geometry?.dispose?.();
    existing.material?.dispose?.();
  }

  const geom = makeHexOutlineGeometry(desiredRadius);
  const mat = new THREE.LineBasicMaterial({
    color: DEBUG_RING_COLOR,
    transparent: true,
    opacity: 0.85,
  });

  const ring = new THREE.LineLoop(geom, mat);
  ring.name = "debugBaseRing";
  ring.rotation.x = -Math.PI / 2; // lay it flat on the ground (XZ plane)
  ring.position.y = DEBUG_RING_Y;

  ring.userData.radius = desiredRadius;

  characterMesh.add(ring);
  characterMesh.userData.debugBaseRing = ring;
}

/**
 * Create or update water effects for a character in water
 * @param {THREE.Group} characterMesh - The character mesh group
 * @param {boolean} isInWater - Whether the character is in water
 */
function updateWaterEffects(characterMesh, isInWater) {
  if (!characterMesh) return;

  // Find or create water effects group
  let waterEffects = characterMesh.userData.waterEffects;

  if (isInWater && !waterEffects) {
    // Create water ripple effect
    waterEffects = new THREE.Group();
    waterEffects.name = "waterEffects";

    // Create circular ripple geometry (ring)
    const rippleGeometry = new THREE.RingGeometry(0.3, 0.8, 32);
    const rippleMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      emissive: 0x2a4ea0,
      emissiveIntensity: 0.3,
    });

    // Create multiple ripple rings for animation
    for (let i = 0; i < 3; i++) {
      const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial.clone());
      ripple.rotation.x = -Math.PI / 2; // Lay flat on ground
      ripple.position.y = 0.01; // Just above water surface
      ripple.userData.rippleIndex = i;
      ripple.userData.startTime = Date.now() + i * 500; // Stagger animations
      waterEffects.add(ripple);
    }

    // Create water splash particles (simple small spheres)
    const particleCount = 8;
    const particles = new THREE.Group();
    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0x4a90e2,
          transparent: true,
          opacity: 0.6,
          emissive: 0x2a4ea0,
          emissiveIntensity: 0.5,
        })
      );
      const angle = (i / particleCount) * Math.PI * 2;
      particle.position.set(
        Math.cos(angle) * 0.4,
        0.1 + Math.random() * 0.2,
        Math.sin(angle) * 0.4
      );
      particle.userData.angle = angle;
      particle.userData.startY = particle.position.y;
      particles.add(particle);
    }
    waterEffects.add(particles);

    characterMesh.add(waterEffects);
    characterMesh.userData.waterEffects = waterEffects;
  } else if (!isInWater && waterEffects) {
    // Remove water effects
    characterMesh.remove(waterEffects);
    waterEffects.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    characterMesh.userData.waterEffects = null;
  }
  // Note: Animation is handled in the animate() loop, not here
}

/**
 * Apply a lighting preset to the HexArena scene
 * @param {THREE.Scene} scene - Three.js scene
 * @param {THREE.WebGLRenderer} renderer - Three.js renderer
 * @param {string} presetKey - Preset key from LIGHTING_PRESETS
 */
function applyLightingPresetToArena(scene, renderer, presetKey) {
  // Dynamic import to avoid circular dependencies
  // eslint-disable-next-line no-undef
  const { LIGHTING_PRESETS } = require("../../data/lightingPresets");
  const preset = LIGHTING_PRESETS[presetKey];
  if (!preset) {
    console.warn(`[HexArena] Unknown lighting preset: ${presetKey}`);
    return;
  }

  // Remove old lights
  scene.children
    .filter((obj) => obj.isLight)
    .forEach((light) => scene.remove(light));

  // ☀️ Sun (DirectionalLight)
  const sun = new THREE.DirectionalLight(
    preset.sun.color,
    preset.sun.intensity
  );
  sun.position.set(...preset.sun.position);
  sun.castShadow = preset.sun.castShadow;

  if (preset.sun.castShadow) {
    sun.shadow.mapSize.width = preset.sun.shadow.mapSize;
    sun.shadow.mapSize.height = preset.sun.shadow.mapSize;
    sun.shadow.bias = preset.sun.shadow.bias;
    sun.shadow.radius = 4; // Soft shadows

    // Configure shadow camera
    const shadowCam = preset.sun.shadow.camera;
    sun.shadow.camera.near = shadowCam.near;
    sun.shadow.camera.far = shadowCam.far;
    sun.shadow.camera.left = shadowCam.left;
    sun.shadow.camera.right = shadowCam.right;
    sun.shadow.camera.top = shadowCam.top;
    sun.shadow.camera.bottom = shadowCam.bottom;
  }

  scene.add(sun);

  // 🌤 Ambient Light
  scene.add(
    new THREE.AmbientLight(preset.ambient.color, preset.ambient.intensity)
  );

  // 🌍 Hemisphere Light (sky bounce)
  scene.add(
    new THREE.HemisphereLight(
      preset.hemisphere.skyColor,
      preset.hemisphere.groundColor,
      preset.hemisphere.intensity
    )
  );

  // 🎥 Renderer tone mapping
  if (preset.environment.toneMapping === "ACES") {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  renderer.toneMappingExposure = preset.environment.exposure;

  // Update scene background if needed
  scene.background = new THREE.Color(preset.hemisphere.skyColor);
}

export function initHexArena(containerElement) {
  if (!containerElement) {
    console.error("HexArena: No container element provided.");
    return null;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#87CEEB"); // Sky blue for daylight

  const camera = new THREE.PerspectiveCamera(
    60,
    containerElement.clientWidth / containerElement.clientHeight,
    0.1,
    5000
  );
  camera.position.set(18, 28, 28);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows for better quality
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // Better color handling
  renderer.toneMappingExposure = 1.0;

  // Physically correct lighting and color space
  renderer.physicallyCorrectLights = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  containerElement.innerHTML = "";
  containerElement.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);

  // Feel
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Mouse bindings
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };

  // Speeds
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 1.25;
  controls.panSpeed = 1.0;
  controls.keyPanSpeed = 18;

  // Zoom limits (closer zoom!)
  controls.minDistance = 6; // <- allow close zoom
  controls.maxDistance = 400;

  // Prevent flipping under the ground
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;

  // Optional (supported in newer three versions)
  if (controls.zoomToCursor !== undefined) {
    controls.zoomToCursor = true;
  }

  // === Realistic Daylight Lighting ===

  // Hemisphere light for sky/ground color (realistic daylight)
  const hemisphereLight = new THREE.HemisphereLight(
    0x87ceeb, // Sky blue (top)
    0x8b7355, // Ground brown (bottom)
    0.6 // Intensity
  );
  scene.add(hemisphereLight);

  // Ambient light for overall illumination (reduced since hemisphere provides color)
  const ambient = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambient);

  // Main sun/directional light (warm daylight)
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.2); // Warm white/yellow sunlight
  sun.position.set(30, 50, 20); // Higher and more angled for realistic daylight
  sun.castShadow = true;

  // Enhanced shadow settings for better quality
  sun.shadow.mapSize.width = 4096;
  sun.shadow.mapSize.height = 4096;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  sun.shadow.bias = -0.0001;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4; // Soft shadows

  scene.add(sun);

  // Fill light from opposite side (subtle, reduces harsh shadows)
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-20, 30, -15);
  scene.add(fillLight);

  let gridRoot = null;
  let tileMeshLookup = new Map();
  let characterGroup = null;
  let characterMeshes = new Map(); // Map of fighter ID to character mesh/group
  let projectileGroup = null;
  let projectileMeshes = new Map(); // Map of projectile ID to mesh
  const gltfLoader = new GLTFLoader();
  let arrowTemplate = null; // THREE.Group
  let arrowTemplatePromise = null;
  let dangerRingGroup = null;
  let dangerRingMeshes = new Map(); // key: "x,y" -> mesh
  let disposed = false;
  let timeScale = 1;

  function setTimeScale(value) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    timeScale = Math.max(0.05, Math.min(5, next));
  }

  // Initialize character group
  characterGroup = new THREE.Group();
  characterGroup.name = "characters";
  scene.add(characterGroup);

  // Initialize projectile group
  projectileGroup = new THREE.Group();
  projectileGroup.name = "projectiles";
  scene.add(projectileGroup);

  // Initialize danger ring group
  dangerRingGroup = new THREE.Group();
  dangerRingGroup.name = "dangerRings";
  scene.add(dangerRingGroup);

  function animate() {
    if (disposed) return;
    requestAnimationFrame(animate);
    controls.update();

    // Update character billboards to face camera (name labels only)
    if (characterGroup && characterGroup.children.length > 0) {
      updateCharacterBillboards(characterGroup.children, camera);
    }

    // Update water effects animation (only animate, don't recreate)
    characterMeshes.forEach((mesh) => {
      const waterEffects = mesh.userData.waterEffects;
      if (mesh.userData.isWater && waterEffects) {
        // Animate existing water effects
        const time = Date.now();
        waterEffects.children.forEach((child) => {
          if (child.userData.rippleIndex !== undefined) {
            // Animate ripple rings expanding and fading
            const ripple = child;
            const elapsed = (time - ripple.userData.startTime) % 2000; // 2 second cycle
            const progress = elapsed / 2000;
            const scale = 1 + progress * 1.5; // Expand
            ripple.scale.set(scale, scale, scale);
            ripple.material.opacity = 0.4 * (1 - progress); // Fade out
            if (elapsed < 100) {
              ripple.userData.startTime = time; // Reset when cycle completes
            }
          } else if (child.isGroup) {
            // Animate splash particles (bobbing)
            child.children.forEach((particle) => {
              if (particle.userData.angle !== undefined) {
                const bobOffset =
                  Math.sin(time * 0.003 + particle.userData.angle * 2) * 0.05;
                particle.position.y = particle.userData.startY + bobOffset;
              }
            });
          }
        });
      }
    });

    // Update projectile positions
    const now = performance.now();
    projectileMeshes.forEach((mesh) => {
      const data = mesh.userData?.projectile;
      if (!data) return;
      const durationMs = Math.max(1, data.durationMs || 1);
      const elapsed = (now - (data.firedAtMs || now)) * timeScale;
      const tRaw = elapsed / durationMs;
      const t = Math.min(1, Math.max(0, tRaw));

      const fromWorld = worldFromGrid(data.from);
      const toWorld = worldFromGrid(data.to);
      if (!fromWorld || !toWorld) return;

      const pos = fromWorld.clone().lerp(toWorld, t);
      mesh.position.copy(pos);

      // Orient mesh along travel direction
      const dir = toWorld.clone().sub(fromWorld);
      if (dir.lengthSq() > 0.0001) {
        dir.normalize();
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      }

      if (t >= 1) {
        projectileGroup.remove(mesh);
        mesh.traverse?.((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        projectileMeshes.delete(data.id);
      }
    });

    // Pulse danger rings (subtle)
    if (dangerRingMeshes.size > 0) {
      const pulse = 0.65 + 0.25 * Math.sin(now * 0.006);
      dangerRingMeshes.forEach((mesh) => {
        if (mesh.material) mesh.material.opacity = pulse;
      });
    }

    renderer.render(scene, camera);
  }
  animate();

  function resize() {
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener("resize", resize);

  // Auto-center orbit target on the grid
  let hasFramedGridOnce = false;

  function frameGrid({ force = false } = {}) {
    if (!gridRoot) return;

    const box = new THREE.Box3().setFromObject(gridRoot);
    if (!isFinite(box.min.x) || box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z, 10);

    // Put orbit target at map center
    controls.target.copy(center);

    // Only "snap" camera the first time (or if forced),
    // so user navigation isn't constantly overridden
    if (!hasFramedGridOnce || force) {
      camera.position.set(
        center.x + radius * 0.75,
        center.y + radius * 0.95,
        center.z + radius * 0.75
      );
      hasFramedGridOnce = true;
    }

    controls.update();
  }

  // Helper to convert terrain keys to mapBuilder keys
  function mapTerrainKeyToBuilderKey(terrainKey) {
    if (!terrainKey) return "grass";
    const key = terrainKey.toString().toLowerCase();
    if (
      key.includes("open") ||
      key.includes("ground") ||
      key.includes("grassland") ||
      key.includes("plains")
    )
      return "grass";
    if (key.includes("forest")) return "forest";
    if (key.includes("rock")) return "rock";
    if (key.includes("water")) return "water";
    if (key.includes("sand") || key.includes("desert")) return "sand";
    if (key.includes("hill")) return "hill";
    if (key.includes("road") || key.includes("urban") || key.includes("city"))
      return "road";
    return "grass";
  }

  function rebuildGridFromEnvironment(terrain) {
    if (!terrain) {
      console.warn("[HexArena] Missing terrain object, using defaults.");
      // Generate default grid
      const defaultWidth = GRID_CONFIG?.GRID_WIDTH || 40;
      const defaultHeight = GRID_CONFIG?.GRID_HEIGHT || 30;
      const defaultTerrain = "OPEN_GROUND";
      const mapManager = buildRectangular3DMap(defaultHeight, defaultWidth, {
        uniformTerrain: true,
        baseTerrain: mapTerrainKeyToBuilderKey(defaultTerrain),
        maxHeight: 0,
      });

      if (gridRoot) {
        scene.remove(gridRoot);
        gridRoot.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        gridRoot = null;
      }

      const group = new THREE.Group();
      const lookup = new Map();
      const tiles = mapManager.getAllTiles();
      tiles.forEach((tile) => {
        const mesh = createHexMesh(tile, HEX_RADIUS, 0.6);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        const key = `${tile.q},${tile.r}`;
        lookup.set(key, mesh);
      });

      gridRoot = group;
      tileMeshLookup = lookup;
      scene.add(gridRoot);
      frameGrid();
      console.log(
        `[HexArena] Generated default grid: ${tiles.length} tiles (${defaultWidth}x${defaultHeight})`
      );
      return;
    }

    // Check if we have a grid array
    let grid = terrain.grid;
    let hexRadius = terrain.hexRadius || HEX_RADIUS;

    // If no grid, generate one from width/height or use defaults
    if (!grid || !Array.isArray(grid) || grid.length === 0) {
      const width =
        terrain.width || terrain.GRID_WIDTH || GRID_CONFIG?.GRID_WIDTH || 40;
      const height =
        terrain.height || terrain.GRID_HEIGHT || GRID_CONFIG?.GRID_HEIGHT || 30;
      const terrainKey =
        terrain.terrain ||
        terrain.terrainType ||
        terrain.baseTerrain ||
        "OPEN_GROUND";

      console.log(
        `[HexArena] No grid provided, generating ${width}x${height} grid for terrain: ${terrainKey}`
      );

      const mapManager = buildRectangular3DMap(height, width, {
        uniformTerrain: true,
        baseTerrain: mapTerrainKeyToBuilderKey(terrainKey),
        maxHeight: 0,
      });

      if (gridRoot) {
        scene.remove(gridRoot);
        gridRoot.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        gridRoot = null;
      }

      const group = new THREE.Group();
      const lookup = new Map();
      const tiles = mapManager.getAllTiles();
      tiles.forEach((tile) => {
        const mesh = createHexMesh(tile, HEX_RADIUS, 0.6);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        const key = `${tile.q},${tile.r}`;
        lookup.set(key, mesh);
      });

      gridRoot = group;
      tileMeshLookup = lookup;
      scene.add(gridRoot);
      frameGrid();
      console.log(
        `[HexArena] Generated grid: ${tiles.length} tiles (${width}x${height})`
      );
      return;
    }

    // We have a grid array - use it
    if (gridRoot) {
      scene.remove(gridRoot);
      gridRoot.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      gridRoot = null;
    }

    // Calculate radius if not provided (for logging)
    const radius =
      terrain.radius || Math.ceil(Math.sqrt(grid.length / Math.PI)) || 10;

    const { group, tileMeshLookup: lookup } = buildHexagon3DFromGrid(
      grid,
      hexRadius
    );
    gridRoot = group;
    tileMeshLookup = lookup;
    scene.add(gridRoot);
    frameGrid();
    console.log(
      `[HexArena] Grid synced: ${grid.length} tiles (radius ${radius})`
    );
  }

  function syncMapEditorState(terrain, changedCells = null) {
    // If we have changedCells and an existing grid, do incremental update
    if (
      changedCells &&
      Array.isArray(changedCells) &&
      changedCells.length > 0 &&
      tileMeshLookup &&
      gridRoot
    ) {
      const hexRadius = terrain?.hexRadius || HEX_RADIUS;
      const result = syncGridDiffToGroup({
        group: gridRoot,
        tileMeshLookup,
        changedCells,
        hexRadius,
        createIfMissing: true, // Allow creating tiles on demand (for resizing/fill operations)
      });
      if (result.updated > 0 || result.added > 0) {
        console.log(
          `[HexArena] Incrementally updated ${result.updated} tiles, added ${result.added} new tiles (${result.missing} missing)`
        );
      }
      return;
    }

    // Otherwise, do full rebuild
    rebuildGridFromEnvironment(terrain);
  }

  function disposeCharacterMesh(mesh) {
    if (!mesh) return;
    mesh.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat?.dispose?.());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }

  function syncCombatState({
    fighters = [],
    positions = {},
    renderPositions,
    projectiles = [],
    dangerHexes = [],
    terrain,
  }) {
    rebuildGridFromEnvironment(terrain);

    // Update character representations
    if (!characterGroup) {
      characterGroup = new THREE.Group();
      characterGroup.name = "characters";
      scene.add(characterGroup);
    }

    // Get current fighter IDs
    const currentFighterIds = new Set();

    // Map to store occupied hexes for each fighter (for pathfinding/blocking)
    const occupiedHexesMap = new Map();

    // Create or update character icons
    const axialPosById = new Map(); // fighterId -> {q, r}
    fighters.forEach((fighter) => {
      if (!fighter || !fighter.id) return;

      const fighterId = fighter.id;
      currentFighterIds.add(fighterId);
      const position = (renderPositions || positions)[fighterId];

      if (!position) {
        // Fighter has no position, skip
        return;
      }

      // Convert position to hex coordinates if needed
      let q,
        r,
        altitude = 0;
      if (position.q !== undefined && position.r !== undefined) {
        // Already in hex coordinates
        q = position.q;
        r = position.r;
      } else if (position.x !== undefined && position.y !== undefined) {
        // Convert from offset/rectangular to axial
        const axial = offsetToAxial(position.x, position.y);
        q = axial.q;
        r = axial.r;
      } else {
        // Invalid position
        return;
      }

      axialPosById.set(fighterId, { q, r });

      // Calculate occupied hexes based on footprint
      const radiusHex = fighter?.footprint?.radiusHex ?? 0;
      const centerHex = { q, r };
      const occupiedHexes = getOccupiedHexes(centerHex, radiusHex);
      occupiedHexesMap.set(fighterId, occupiedHexes);

      // Get altitude from fighter (for flying characters)
      altitude = fighter.altitude || fighter.altitudeFeet || 0;

      // Determine terrain height and type under this fighter (so units stand on cliffs/water)
      let tileHeightUnits = 0;
      let terrainType = null;
      let isWater = false;
      try {
        const grid = terrain?.grid;
        if (Array.isArray(grid)) {
          // Prefer offset coords if available (positions are usually x,y in TacticalMap space)
          let col = position?.x;
          let row = position?.y;
          if (!Number.isFinite(col) || !Number.isFinite(row)) {
            const off = axialToOffset(q, r);
            col = off.col;
            row = off.row;
          }
          const cell = grid?.[row]?.[col];
          const elev = Number.isFinite(cell?.elevation)
            ? cell.elevation
            : Number.isFinite(cell?.height)
            ? cell.height
            : 0;
          tileHeightUnits = Number(elev) || 0;

          // Detect terrain type (normalize to lowercase for consistency)
          terrainType = cell?.terrain || cell?.terrainType || null;
          if (terrainType) {
            const terrainLower = terrainType.toString().toLowerCase();
            isWater =
              terrainLower.includes("water") || terrainLower === "water";
          }
        }
      } catch {
        tileHeightUnits = 0;
      }

      // Resolve model URL based on flying state and perching state (if provided)
      const fighterVisual = fighter.visual || {};
      const isPerched = fighter.perchedOn && fighter.perchedOn.treeId;
      const isAirborne =
        fighter.isFlying || (fighter.altitudeFeet ?? fighter.altitude ?? 0) > 0;
      const baseModelUrl = fighterVisual.modelUrl;
      const groundedModelUrl =
        fighterVisual.groundedModelUrl ||
        fighterVisual.perchingModelUrl ||
        baseModelUrl;
      const flyingModelUrl =
        fighterVisual.flyingModelUrl || fighterVisual.flightModelUrl;
      const perchingModelUrl =
        fighterVisual.perchingModelUrl || fighterVisual.perchModelUrl;
      
      // Priority: perching > flying > grounded
      let desiredModelUrl;
      if (isPerched && perchingModelUrl) {
        desiredModelUrl = perchingModelUrl;
      } else if (isAirborne && flyingModelUrl) {
        desiredModelUrl = flyingModelUrl;
      } else {
        desiredModelUrl = groundedModelUrl;
      }

      // Check if character mesh already exists
      let characterMesh = characterMeshes.get(fighterId);
      const currentModelUrl = characterMesh?.userData?.visual?.modelUrl;
      const shouldSwapModel =
        characterMesh &&
        desiredModelUrl &&
        currentModelUrl &&
        desiredModelUrl !== currentModelUrl;

      if (shouldSwapModel) {
        characterGroup.remove(characterMesh);
        disposeCharacterMesh(characterMesh);
        characterMeshes.delete(fighterId);
        characterMesh = null;
      }

      if (!characterMesh) {
        // Create new character icon (5ft sphere placeholder or GLB model)
        // Preserve visual and footprint from fighter before spreading
        const fighterFootprint = fighter.footprint;
        const resolvedVisual = desiredModelUrl
          ? { ...fighterVisual, modelUrl: desiredModelUrl }
          : fighterVisual;

        // Compute desired footprint radius in world space (for model scaling)
        // This ensures the model matches the hex footprint regardless of GLB authoring scale
        const desiredRadiusWorld = getDesiredFootprintRadiusWorld(fighter);

        const characterData = {
          ...fighter, // Spread fighter first
          q,
          r,
          altitude: altitude || 0, // Use altitude for flying characters (feet)
          tileHeightUnits,
          terrainType,
          isWater,
          name: fighter.name || fighter.characterName || "Unknown",
          alignment: fighter.type === "enemy" ? "evil" : "good",
          // Explicitly preserve visual and footprint after spread to ensure they win
          visual: resolvedVisual,
          footprint: {
            ...fighterFootprint,
            desiredRadiusWorld, // Pass world-space radius for model scaling
          },
        };

        // Debug: Log if we have visual/footprint data
        if (characterData.visual || characterData.footprint) {
          console.log(
            `[HexArena] Creating character for ${characterData.name}:`,
            {
              hasVisual: !!characterData.visual,
              hasFootprint: !!characterData.footprint,
              modelUrl: characterData.visual?.modelUrl,
              footprintFeet: characterData.footprint?.feet,
              baseHeightFt: characterData.visual?.baseHeightFt,
              radiusHex: characterData.footprint?.radiusHex,
            }
          );
        } else {
          console.log(
            `[HexArena] Creating character for ${characterData.name}: NO visual/footprint data`
          );
        }

        characterMesh = createCharacterIcon(characterData);
        characterMesh.userData.fighterId = fighterId;
        characterMesh.userData.occupiedHexes = occupiedHexes;
        characterMesh.userData.yawOffsetRad = degreesToRadians(
          characterData?.visual?.yawOffsetDeg ?? 0
        );
        characterMesh.userData.isWater = isWater;
        characterMesh.userData.terrainType = terrainType;

        // Add water effects if in water
        if (isWater) {
          updateWaterEffects(characterMesh, true);
        }

        // Step 2: Apply foot offset positioning for new meshes (if model loaded)
        // This ensures models sit on hex tile top correctly
        const hasModel =
          characterMesh.userData.hasModel ||
          characterMesh.children.some(
            (child) => child.userData.type === "characterModel"
          );

        if (hasModel) {
          // Get cached foot offset (unscaled)
          const footOffsetUnscaled =
            characterMesh.userData?.modelFootOffset ?? 0;

          // Use the scale that was actually applied when the model loaded
          // This ensures consistency with the world-space footprint scaling
          // If scale hasn't been computed yet (model still loading), compute it the same way
          let scale = characterMesh.userData?.appliedScale;
          if (!scale || scale <= 0) {
            // Model hasn't loaded yet, compute scale using same method as characterPlaceholders
            const desiredRadiusWorld = fighter?.footprint?.desiredRadiusWorld;
            const modelRadiusUnscaled =
              characterMesh.userData?.modelRadiusUnscaled;
            if (
              desiredRadiusWorld &&
              modelRadiusUnscaled &&
              modelRadiusUnscaled > 0
            ) {
              scale = desiredRadiusWorld / modelRadiusUnscaled;
            } else {
              // Fallback to feet-based scaling
              const desiredFeet = fighter?.footprint?.feet ?? 5;
              const baseHeightFt = fighter?.visual?.baseHeightFt ?? 6;
              scale = Math.max(0.25, Math.min(8, desiredFeet / baseHeightFt));
            }
          }

          // Calculate proper position with foot offset
          const pos = worldVectorFromEntity(
            { q, r, altitude, tileHeightUnits },
            HEX_RADIUS,
            HEX_TILE_THICKNESS
          );

          // Apply foot offset with scale: anchors feet to hex surface
          const waterOffset = isWater ? 0.2 : 0;
          pos.y += footOffsetUnscaled * scale;
          pos.y += waterOffset;

          // Update position to correct location
          characterMesh.position.copy(pos);
        }

        characterMeshes.set(fighterId, characterMesh);
        characterGroup.add(characterMesh);

        // ✅ Add debug base ring to visualize footprint (pass center hex for accurate radius)
        ensureDebugBaseRing(characterMesh, fighter, { q, r });
      } else {
        // Update existing character position and occupied hexes
        const pos = worldVectorFromEntity(
          { q, r, altitude, tileHeightUnits },
          HEX_RADIUS,
          HEX_TILE_THICKNESS
        );

        // Adjust Y position: models have base at Y=0 in local space, placeholders need offset
        const hasModel =
          characterMesh.userData.hasModel ||
          characterMesh.children.some(
            (child) => child.userData.type === "characterModel"
          );
        const sphereRadius = 1.0;

        // For water, units float slightly above surface
        const waterOffset = isWater ? 0.2 : 0; // Float 0.2 units above water

        if (hasModel) {
          // Step 2: Apply the foot offset during positioning (GM-style, robust)
          // Get the cached foot offset (unscaled) and the scale that was applied to the model
          const footOffsetUnscaled =
            characterMesh.userData?.modelFootOffset ?? 0;

          // Use the scale that was actually applied when the model loaded
          // This ensures consistency with the world-space footprint scaling
          // If scale hasn't been computed yet (model still loading), fall back to feet-based
          let scale = characterMesh.userData?.appliedScale;
          if (!scale || scale <= 0) {
            // Model hasn't loaded yet, compute scale using same method as characterPlaceholders
            const desiredRadiusWorld = fighter?.footprint?.desiredRadiusWorld;
            const modelRadiusUnscaled =
              characterMesh.userData?.modelRadiusUnscaled;
            if (
              desiredRadiusWorld &&
              modelRadiusUnscaled &&
              modelRadiusUnscaled > 0
            ) {
              scale = desiredRadiusWorld / modelRadiusUnscaled;
            } else {
              // Fallback to feet-based scaling
              const desiredFeet = fighter?.footprint?.feet ?? 5;
              const baseHeightFt = fighter?.visual?.baseHeightFt ?? 6;
              scale = Math.max(0.25, Math.min(8, desiredFeet / baseHeightFt));
            }
          }

          // Apply foot offset with scale: anchors feet to hex surface
          // ✅ This works at any scale and for any GLB, not just Ariel
          pos.y += footOffsetUnscaled * scale;
          pos.y += waterOffset;
        } else {
          // Placeholder sphere needs radius offset
          pos.y += sphereRadius + waterOffset;
        }

        // 1. Update position FIRST
        characterMesh.position.copy(pos);

        // 2. Apply foot offset (already done above)
        // pos.y already has footOffsetUnscaled * scale applied

        // ⚠️ Facing will be applied LAST at the end of syncCombatState
        // Do NOT touch group.rotation.y here

        characterMesh.userData.occupiedHexes = occupiedHexes;
        characterMesh.userData.isWater = isWater;
        characterMesh.userData.terrainType = terrainType;

        // Update water effects if terrain changed
        updateWaterEffects(characterMesh, isWater);

        // Keep yaw offset in sync in case bestiary changed
        characterMesh.userData.yawOffsetRad = degreesToRadians(
          fighter?.visual?.yawOffsetDeg ??
            characterMesh.userData.yawOffsetRad ??
            0
        );

        // ✅ Update debug base ring if footprint changed (pass center hex for accurate radius)
        ensureDebugBaseRing(characterMesh, fighter, { q, r });
      }
    });

    // === Facing: rotate each unit toward nearest opposing unit (LAST, after all position updates) ===
    // Build a quick lookup of fighters by id and groups
    const fighterById = new Map();
    const groupsById = new Map();
    fighters.forEach((f) => {
      if (f?.id) {
        fighterById.set(f.id, f);
        const mesh = characterMeshes.get(f.id);
        if (mesh) groupsById.set(f.id, mesh);
      }
    });

    // Precompute candidate enemy lists by team
    const players = fighters.filter((f) => f?.type === "player");
    const enemies = fighters.filter((f) => f?.type === "enemy");

    const getNearestEnemy = (combatant, allCombatants) => {
      if (!combatant || !allCombatants) return null;
      const opponents = combatant.type === "player" ? enemies : players;
      if (opponents.length === 0) return null;

      const myGroup = groupsById.get(combatant.id);
      if (!myGroup) return null;

      let nearest = null;
      let nearestDist = Infinity;

      for (const opp of opponents) {
        const oppGroup = groupsById.get(opp.id);
        if (!oppGroup || opp.id === combatant.id) continue;

        const dx = oppGroup.position.x - myGroup.position.x;
        const dz = oppGroup.position.z - myGroup.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = opp;
        }
      }

      return nearest;
    };

    const faceWorldTarget = (group, targetWorldPos) => {
      if (!group || !targetWorldPos) return;
      const dx = targetWorldPos.x - group.position.x;
      const dz = targetWorldPos.z - group.position.z;
      const yaw = Math.atan2(dx, dz);
      const yawOffset = group.userData?.yawOffsetRad ?? 0;
      group.rotation.y = yaw + yawOffset;
    };

    // ✅ Apply facing LAST (after all position updates)
    fighters.forEach((fighter) => {
      const id = fighter?.id;
      if (!id) return;
      const mesh = characterMeshes.get(id);
      if (!mesh) return;

      // ✅ Use world-space facing ONLY for Thunder Lizard (megafauna)
      if (
        id.includes("thunder_lizard") ||
        fighter.name?.toLowerCase().includes("thunder")
      ) {
        const enemy = getNearestEnemy(fighter, fighters);
        if (enemy) {
          const enemyGroup = groupsById.get(enemy.id);
          if (enemyGroup) {
            faceWorldTarget(mesh, enemyGroup.position);
          }
        }
      } else {
        // Hex-direction facing for humanoids and other creatures
        const myAxial = axialPosById.get(id);
        if (!myAxial) return;

        const opponents = fighter.type === "player" ? enemies : players;
        let best = null;
        let bestDist = Infinity;
        for (const opp of opponents) {
          const oppId = opp?.id;
          if (!oppId || oppId === id) continue;
          const oppAxial = axialPosById.get(oppId);
          if (!oppAxial) continue;
          const d = hexDistance(myAxial, oppAxial);
          if (d < bestDist) {
            bestDist = d;
            best = oppId;
          }
        }

        if (!best || !Number.isFinite(bestDist)) return;
        const targetMesh = characterMeshes.get(best);
        if (!targetMesh) return;

        // Calculate direction to target (in world space)
        const dx = targetMesh.position.x - mesh.position.x;
        const dz = targetMesh.position.z - mesh.position.z;
        const yaw = Math.atan2(dx, dz);

        // Apply any model-specific yaw offset (for models with wrong forward direction)
        const yawOffset = mesh.userData?.yawOffsetRad ?? 0;
        mesh.rotation.y = yaw + yawOffset;
      }
    });

    // ✅ End-of-frame rotation log (to confirm overwrite) for Thunder Lizard
    if (import.meta.env.DEV) {
      fighters.forEach((fighter) => {
        if (
          fighter.id?.includes("thunder_lizard") ||
          fighter.name?.toLowerCase().includes("thunder")
        ) {
          const mesh = characterMeshes.get(fighter.id);
          if (mesh) {
            console.log("[HexArena Facing Final]", fighter.name, {
              rotationY: mesh.rotation.y.toFixed(3),
              rotationYDeg: ((mesh.rotation.y * 180) / Math.PI).toFixed(1),
              position: {
                x: mesh.position.x.toFixed(2),
                y: mesh.position.y.toFixed(2),
                z: mesh.position.z.toFixed(2),
              },
            });
          }
        }
      });
    }

    syncProjectiles(projectiles);
    syncDangerRings(dangerHexes);

    // Remove character meshes for fighters that no longer exist or have no position
    characterMeshes.forEach((mesh, fighterId) => {
      if (!currentFighterIds.has(fighterId) || !positions[fighterId]) {
        characterGroup.remove(mesh);
        // Dispose of mesh resources
        mesh.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        characterMeshes.delete(fighterId);
      }
    });

    // Log footprint information for large creatures
    occupiedHexesMap.forEach((hexes, fighterId) => {
      if (hexes.length > 1) {
        const fighter = fighters.find((f) => f.id === fighterId);
        const name = fighter?.name || fighterId;
        console.log(
          `[HexArena] ${name} occupies ${hexes.length} hexes (radius ${
            fighter?.footprint?.radiusHex ?? 0
          })`
        );
      }
    });

    console.log(`[HexArena] Synced ${characterMeshes.size} characters`);
  }

  function worldFromGrid(pos) {
    if (!pos) return null;
    const axial = offsetToAxial(pos.x, pos.y);
    return worldVectorFromEntity(
      {
        q: axial.q,
        r: axial.r,
        altitudeFeet: pos.altitudeFeet || 0,
        tileHeightUnits: 0,
      },
      HEX_RADIUS,
      HEX_TILE_THICKNESS
    );
  }

  function createDangerRingMesh() {
    const inner = HEX_RADIUS * 0.9;
    const outer = HEX_RADIUS * 1.05;
    const geom = new THREE.RingGeometry(inner, outer, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.03;
    mesh.renderOrder = 10;
    return mesh;
  }

  function ensureArrowTemplate() {
    if (arrowTemplate) return Promise.resolve(arrowTemplate);
    if (arrowTemplatePromise) return arrowTemplatePromise;

    arrowTemplatePromise = new Promise((resolve, reject) => {
      gltfLoader.load(
        "/assets/models/arrow.glb",
        (gltf) => {
          const root = gltf.scene || gltf.scenes?.[0];
          if (!root) {
            reject(new Error("arrow.glb loaded but scene was empty"));
            return;
          }

          arrowTemplate = root;
          arrowTemplate.name = "arrowTemplate";
          arrowTemplate.scale.setScalar(0.25);

          arrowTemplate.traverse((obj) => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = false;
            }
          });

          console.log("[HexArena] arrow.glb loaded");
          resolve(arrowTemplate);
        },
        undefined,
        reject
      );
    });

    return arrowTemplatePromise;
  }

  function syncDangerRings(dangerHexes = []) {
    if (!dangerRingGroup) return;
    const wanted = new Set(
      (dangerHexes || [])
        .filter((h) => h && Number.isFinite(h.x) && Number.isFinite(h.y))
        .map((h) => `${h.x},${h.y}`)
    );

    dangerRingMeshes.forEach((mesh, key) => {
      if (!wanted.has(key)) {
        dangerRingGroup.remove(mesh);
        mesh.geometry?.dispose?.();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m?.dispose?.());
        } else {
          mesh.material?.dispose?.();
        }
        dangerRingMeshes.delete(key);
      }
    });

    (dangerHexes || []).forEach((h) => {
      if (!h || !Number.isFinite(h.x) || !Number.isFinite(h.y)) return;
      const key = `${h.x},${h.y}`;
      if (dangerRingMeshes.has(key)) return;
      const mesh = createDangerRingMesh();
      const world = worldFromGrid(h);
      if (world) {
        mesh.position.x = world.x;
        mesh.position.z = world.z;
      }
      dangerRingGroup.add(mesh);
      dangerRingMeshes.set(key, mesh);
    });
  }

  function createProjectileMesh(projectile) {
    const kindRaw = String(projectile.kind || "");
    const kind = kindRaw.toLowerCase();
    const isArrowKind =
      kind === "arrow" ||
      kind === "bolt" ||
      kind.includes("arrow") ||
      kind.includes("bolt");

    // ALWAYS VISIBLE fallback first
    if (isArrowKind) {
      const group = new THREE.Group();
      group.name = `proj_${kindRaw}`;
      group.userData.projectile = projectile;

      // Visible fallback right away (so first-shot timing never hides it)
      const fallbackGeom = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8);
      const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xff00ff });
      const fallback = new THREE.Mesh(fallbackGeom, fallbackMat);
      fallback.castShadow = true;
      fallback.frustumCulled = false;
      group.add(fallback);

      const attachClone = (template) => {
        // remove fallback
        group.remove(fallback);
        fallbackGeom.dispose();
        fallbackMat.dispose();

        const clone = template.clone(true);
        clone.name = "arrowGLB";
        // Align +Z-forward GLB to +Y-forward, then flip to match travel direction.
        clone.rotation.x = Math.PI / 2;
        clone.rotation.z = Math.PI;
        clone.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = false;
            obj.frustumCulled = false;
          }
        });

        // TEMP: make it huge so you can’t miss it
        clone.scale.setScalar(2);

        group.add(clone);
      };

      if (arrowTemplate) {
        attachClone(arrowTemplate);
      } else {
        ensureArrowTemplate()
          .then(attachClone)
          .catch((e) => console.warn("[HexArena] arrow load failed:", e));
      }

      return group;
    }

    let geometry;
    let material;
    if (kind === "stone") {
      geometry = new THREE.SphereGeometry(0.06, 10, 10);
      material = new THREE.MeshStandardMaterial({ color: 0x777777 });
    } else {
      geometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6);
      material = new THREE.MeshStandardMaterial({ color: 0x9b6b3f });
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.userData.projectile = projectile;
    return mesh;
  }

  function syncProjectiles(projectiles) {
    console.log("[HexArena] syncProjectiles count:", (projectiles || []).length, projectiles?.[0]);
    const activeIds = new Set();
    (projectiles || []).forEach((projectile) => {
      if (!projectile?.id) return;
      activeIds.add(projectile.id);

      let mesh = projectileMeshes.get(projectile.id);
      if (!mesh) {
        mesh = createProjectileMesh(projectile);
        projectileGroup.add(mesh);
        projectileMeshes.set(projectile.id, mesh);
      }
      mesh.userData.projectile = projectile;
    });

    // Remove stale projectiles
    projectileMeshes.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        projectileGroup.remove(mesh);
        mesh.traverse?.((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        projectileMeshes.delete(id);
      }
    });
  }

  // Store occupied hexes map in arena API for pathfinding systems
  // Access via: arenaRef.current?.getOccupiedHexes?.(fighterId)
  function getOccupiedHexesForFighter(fighterId) {
    const mesh = characterMeshes.get(fighterId);
    return mesh?.userData?.occupiedHexes || [];
  }

  function dispose() {
    if (disposed) return; // Prevent double disposal
    disposed = true;

    window.removeEventListener("resize", resize);

    // Safely remove renderer DOM element
    if (renderer && renderer.domElement) {
      const parent = renderer.domElement.parentNode;
      if (parent && parent.contains(renderer.domElement)) {
        try {
          parent.removeChild(renderer.domElement);
        } catch (error) {
          // Element may have already been removed by React
          console.warn(
            "[HexArena] Could not remove renderer DOM element:",
            error
          );
        }
      }
    }

    // Dispose character meshes
    if (characterGroup) {
      characterMeshes.forEach((mesh) => {
        characterGroup.remove(mesh);
        mesh.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });
      characterMeshes.clear();
      if (scene) scene.remove(characterGroup);
      characterGroup = null;
    }

    // Dispose Three.js resources
    if (renderer) {
      try {
        renderer.dispose();
        renderer.forceContextLoss();
      } catch (error) {
        console.warn("[HexArena] Error disposing renderer:", error);
      }
    }

    if (controls) {
      try {
        controls.dispose();
      } catch (error) {
        console.warn("[HexArena] Error disposing controls:", error);
      }
    }

    // Clear container safely (React will handle DOM cleanup)
    if (containerElement && containerElement.parentNode) {
      try {
        // Only clear if React hasn't already removed it
        if (containerElement.parentNode.contains(containerElement)) {
          // Don't use innerHTML = "" as it conflicts with React
          // React will handle the cleanup
        }
      } catch (error) {
        console.warn("[HexArena] Error clearing container:", error);
      }
    }
  }

  return {
    syncMapEditorState,
    syncCombatState,
    dispose,
    setTimeScale,
    getOccupiedHexesForFighter,
    getOccupiedHexes, // Export for use in pathfinding/blocking logic
    getScaleForFootprint, // Export for use elsewhere if needed
    applyLighting: (presetKey) =>
      applyLightingPresetToArena(scene, renderer, presetKey), // Export lighting control
  };
}

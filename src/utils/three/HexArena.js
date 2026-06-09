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
import bestiaryData from "../../data/bestiary.json";
import { getAllBestiaryEntries } from "../bestiaryUtils.js";
import {
  createCharacterIcon,
  updateCharacterBillboards,
} from "../characterPlaceholders.js";
import { hexDistance } from "../hexPathfinding.js";

const DEBUG_COMBAT =
  typeof window !== "undefined" &&
  window.localStorage?.getItem("debugCombat") === "true";

// Map editor state
let editorActive = false;

/**
 * Open the map editor
 */
export function openMapEditor() {
  editorActive = true;
  if (DEBUG_COMBAT) console.log("[HexArena] Map editor opened");
}

/**
 * Close the map editor
 */
export function closeMapEditor() {
  editorActive = false;
  if (DEBUG_COMBAT) console.log("[HexArena] Map editor closed");
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
  const baseHeightFt =
    fighter?.visual?.baseHeightFt ?? fighter?.visual?.desiredHeightFt ?? 6;

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

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function sampleProjectilePosition(projectile, nowMs) {
  const durationMs = Math.max(1, Number(projectile?.durationMs) || 450);
  const rawT = clampNumber((nowMs - (projectile?.firedAtMs || nowMs)) / durationMs, 0, 1);
  const t = smoothstep(rawT);

  const from = projectile?.from || {};
  const to = projectile?.to || {};
  const fromX = Number(from.x) || 0;
  const fromY = Number(from.y) || 0;
  const toX = Number(to.x ?? fromX);
  const toY = Number(to.y ?? fromY);

  const x = fromX + (toX - fromX) * t;
  const y = fromY + (toY - fromY) * t;

  const fromAlt = Number(from.altitudeFeet ?? 0);
  const toAlt = Number(to.altitudeFeet ?? fromAlt);
  const gravityFeet = Number(projectile?.physics?.gravityFeet ?? 0);

  // Visual-only ballistic arc. Combat resolution has already decided the result.
  const z =
    fromAlt +
    ((toAlt - fromAlt) + 0.5 * gravityFeet) * t -
    0.5 * gravityFeet * t * t;

  return { x, y, z, t: rawT, easedT: t };
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
    HEX_TILE_THICKNESS,
  );
  const b = worldVectorFromEntity(
    { q: 1, r: 0, altitude: 0, tileHeightUnits: 0 },
    HEX_RADIUS,
    HEX_TILE_THICKNESS,
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

const BESTIARY_ENTRIES = getAllBestiaryEntries(bestiaryData);

function normalizeNameKey(value) {
  return String(value || "")
    .replace(/\s+#\d+$/i, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function buildLikelyBestiaryIds(fighter) {
  const raw = String(fighter?.id || "");
  const candidates = new Set([
    fighter?.bestiaryId,
    fighter?.templateId,
    raw,
    raw.replace(/^enemy-/, ""),
    raw.replace(/^player-/, ""),
    raw.replace(/^playable-/, ""),
  ]);
  return [...candidates].filter(Boolean);
}

function lookupBestiaryEntryForFighter(fighter) {
  if (!fighter) return null;
  const idCandidates = buildLikelyBestiaryIds(fighter);
  for (const id of idCandidates) {
    const hit = BESTIARY_ENTRIES.find((e) => e?.id === id);
    if (hit) return hit;
  }
  const fighterNameKey = normalizeNameKey(fighter?.name || fighter?.characterName);
  if (!fighterNameKey) return null;
  return (
    BESTIARY_ENTRIES.find((e) => normalizeNameKey(e?.name) === fighterNameKey) ||
    null
  );
}

/**
 * Normalize fighter visual/footprint from either nested (bestiary) or flat shape
 * so downstream always gets modelUrl, feet, baseHeightFt/desiredHeightFt.
 */
function normalizeFighterVisualAndFootprint(fighter) {
  if (!fighter) return { visual: {}, footprint: {} };
  const fallbackEntry = lookupBestiaryEntryForFighter(fighter);
  const vFallback = fallbackEntry?.visual || {};
  const fFallback = fallbackEntry?.footprint || {};
  const v = fighter.visual || {};
  const f = fighter.footprint || {};
  const modelUrl =
    v.modelUrl ?? fighter.modelUrl ?? vFallback.modelUrl ?? null;
  const desiredHeightFt = v.desiredHeightFt ?? v.baseHeightFt ?? fighter.baseHeightFt ?? 6;
  const footprintFeet = f.feet ?? fighter.footprintFeet ?? fFallback.feet ?? 5;
  const radiusHex = f.radiusHex ?? fighter.radiusHex ?? fFallback.radiusHex ?? 0;
  const yawOffsetDeg = v.yawOffsetDeg ?? fighter.yawOffsetDeg ?? 0;
  return {
    visual: {
      ...v,
      ...vFallback,
      modelUrl,
      desiredHeightFt,
      baseHeightFt: desiredHeightFt,
      yawOffsetDeg,
    },
    footprint: {
      ...f,
      ...fFallback,
      feet: footprintFeet,
      radiusHex,
    },
  };
}

// ===== DEBUG: Footprint base rings =====
const DEBUG_BASE_RINGS = true; // toggle off when done
const DEBUG_RING_Y = 0.03; // slight lift to prevent z-fighting
const DEBUG_RING_COLOR = 0x00ff66; // bright green
const BODY_IMPACT_FEET_TO_WORLD = 0.12;

function makeHexOutlineGeometry(radius) {
  // Flat hex on XZ plane, then rotate line later so it's on the ground.
  const points = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i; // 60° steps
    points.push(
      new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius),
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
    HEX_TILE_THICKNESS,
  );

  let maxCenterDist = 0;
  for (const h of occupied) {
    const p = worldVectorFromEntity(
      { q: h.q, r: h.r, altitude: 0, tileHeightUnits: 0 },
      HEX_RADIUS,
      HEX_TILE_THICKNESS,
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
        }),
      );
      const angle = (i / particleCount) * Math.PI * 2;
      particle.position.set(
        Math.cos(angle) * 0.4,
        0.1 + Math.random() * 0.2,
        Math.sin(angle) * 0.4,
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
    preset.sun.intensity,
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
    new THREE.AmbientLight(preset.ambient.color, preset.ambient.intensity),
  );

  // 🌍 Hemisphere Light (sky bounce)
  scene.add(
    new THREE.HemisphereLight(
      preset.hemisphere.skyColor,
      preset.hemisphere.groundColor,
      preset.hemisphere.intensity,
    ),
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
    5000,
  );
  camera.position.set(18, 28, 28);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
  renderer.shadowMap.enabled = false;
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
    0.6, // Intensity
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
  let lastTerrainSig = null; // Cache terrain signature to prevent unnecessary rebuilds
  let characterGroup = null;
  let characterMeshes = new Map(); // Map of fighter ID to character mesh/group
  let editorPropGroup = null;
  let editorPropMeshes = new Map(); // Map of editor prop ID to mesh/group
  let projectileGroup = null;
  let projectileMeshes = new Map(); // Map of projectile ID to mesh
  let embeddedArrowGroup = null;
  let embeddedArrowMeshes = new Map(); // Map of embedded arrow ID to mesh
  const gltfLoader = new GLTFLoader();
  let arrowTemplate = null; // THREE.Group
  let arrowTemplatePromise = null;
  let sharedArrowAssets = null;
  let dangerRingGroup = null;
  let dangerRingMeshes = new Map(); // key: "x,y" -> mesh
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownAt = null;
  let movementHighlightGroup = null;
  let mapInteractionState = {
    movementMode: { active: false, isRunning: false },
    validMoves: [],
    selectedMovementFighter: null,
    onHexHover: null,
    onHexSelect: null,
  };
  let editorPropInteractionState = {
    onPropGrab: null,
    onPropHover: null,
    onPropDrop: null,
  };
  let editorPropGrab = null;
  let disposed = false;
  let timeScale = 1;
  let impactReactionsById = {};

  function setTimeScale(value) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    timeScale = Math.max(0.05, Math.min(5, next));
  }

  // Initialize character group
  characterGroup = new THREE.Group();
  characterGroup.name = "characters";
  scene.add(characterGroup);

  editorPropGroup = new THREE.Group();
  editorPropGroup.name = "editorProps";
  scene.add(editorPropGroup);

  // Initialize projectile group
  projectileGroup = new THREE.Group();
  projectileGroup.name = "projectiles";
  scene.add(projectileGroup);

  embeddedArrowGroup = new THREE.Group();
  embeddedArrowGroup.name = "embeddedArrows";
  scene.add(embeddedArrowGroup);

  // Initialize danger ring group
  dangerRingGroup = new THREE.Group();
  dangerRingGroup.name = "dangerRings";
  scene.add(dangerRingGroup);

  movementHighlightGroup = new THREE.Group();
  movementHighlightGroup.name = "movementHighlights";
  scene.add(movementHighlightGroup);

  function animate() {
    if (disposed) return;
    requestAnimationFrame(animate);
    controls.update();
    const now = performance.now();

    // Update character billboards to face camera (name labels only)
    if (characterGroup && characterGroup.children.length > 0) {
      updateCharacterBillboards(characterGroup.children, camera);
    }

    characterMeshes.forEach((mesh) => {
      const fighterId = mesh?.userData?.fighterId;
      const basePosition = mesh?.userData?.basePosition;
      if (!fighterId || !basePosition) return;

      mesh.position.copy(basePosition);

      const reaction = impactReactionsById?.[fighterId];
      if (!reaction?.startedAtMs) return;

      const durationMs = Math.max(1, reaction.durationMs || 220);
      const elapsedMs = now - reaction.startedAtMs;
      if (elapsedMs < 0 || elapsedMs > durationMs) return;

      const progress = elapsedMs / durationMs;
      const decay = 1 - progress;
      const amplitude =
        reaction.intensity === "heavy"
          ? 1.05
          : reaction.intensity === "light"
            ? 0.4
            : 0.78;

      mesh.position.x += Math.sin(progress * Math.PI * 14) * amplitude * decay;
      mesh.position.z += Math.sin(progress * Math.PI * 18 + 0.8) * amplitude * 0.9 * decay;
      mesh.position.y += Math.abs(Math.sin(progress * Math.PI * 10)) * amplitude * 0.18 * decay;
    });

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
    projectileMeshes.forEach((mesh) => {
      const data = mesh.userData?.projectile;
      if (!data) return;
      const pos = sampleProjectilePosition(data, now);
      const worldPos = projectileSampleToWorld(data, pos);
      if (!worldPos) return;

      mesh.position.copy(worldPos);

      // Orient mesh along the local curve tangent instead of the straight endpoint line.
      const next = sampleProjectilePosition(data, now + 16);
      const nextWorld = projectileSampleToWorld(data, next);
      if (!nextWorld) return;

      const dir = nextWorld.clone().sub(worldPos);
      if (dir.lengthSq() > 0.0001) {
        dir.normalize();
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
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

  function getOffsetHexFromTile(tileData) {
    if (!tileData) return null;
    const gridPos = tileData.gridPosition;
    if (Number.isFinite(gridPos?.col) && Number.isFinite(gridPos?.row)) {
      return {
        x: gridPos.col,
        y: gridPos.row,
        q: tileData.q,
        r: tileData.r,
      };
    }
    if (Number.isFinite(tileData.q) && Number.isFinite(tileData.r)) {
      const offset = axialToOffset(tileData.q, tileData.r);
      return {
        x: offset.col,
        y: offset.row,
        q: tileData.q,
        r: tileData.r,
      };
    }
    return null;
  }

  function getTileFromPointerEvent(event) {
    if (!gridRoot || !renderer?.domElement) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(gridRoot.children, true);
    const hit = hits.find((entry) => entry?.object?.userData);
    return hit?.object?.userData || null;
  }

  function getPropRootFromObject(object) {
    let cursor = object;
    while (cursor) {
      if (cursor.userData?.editorPropId) return cursor;
      cursor = cursor.parent;
    }
    return null;
  }

  function getPropFromPointerEvent(event) {
    if (!editorPropGroup || !renderer?.domElement) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(editorPropGroup.children, true);
    const root = getPropRootFromObject(hits[0]?.object);
    if (!root) return null;
    return {
      id: root.userData.editorPropId,
      prop: root.userData.editorProp,
      mesh: root,
    };
  }

  function getTileSurfaceY(q, r) {
    const tileMesh = tileMeshLookup.get(`${q},${r}`);
    if (!tileMesh) return null;
    const box = new THREE.Box3().setFromObject(tileMesh);
    return Number.isFinite(box.max.y) ? box.max.y : tileMesh.position.y + HEX_TILE_THICKNESS;
  }

  function getPropWorldPosition(prop, hexOverride = null) {
    const q = hexOverride?.q ?? prop?.q;
    const r = hexOverride?.r ?? prop?.r;
    if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
    const surfaceY = getTileSurfaceY(q, r);
    if (!Number.isFinite(surfaceY)) return null;
    return worldVectorFromEntity({ q, r, height: 0 }, HEX_RADIUS, HEX_TILE_THICKNESS)
      .setY(surfaceY + 0.08);
  }

  function applyEditorPropSelection(mesh, selected) {
    if (!mesh) return;
    mesh.traverse((child) => {
      if (!child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        if (!mat?.emissive) return;
        mat.emissive.set(selected ? 0x3b82f6 : 0x000000);
        mat.emissiveIntensity = selected ? 0.45 : 0;
      });
    });
  }

  function createEditorPropMesh(prop) {
    const group = new THREE.Group();
    group.name = `editor-prop-${prop?.id || "unknown"}`;

    const type = prop?.type || "crate";
    const scale = Number(prop?.scale) || 1;

    if (type === "tree") {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.8 }),
      );
      trunk.position.y = 0.45;
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.48, 1.15, 10),
        new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.9 }),
      );
      crown.position.y = 1.25;
      group.add(trunk, crown);
    } else if (type === "boulder") {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.42, 0),
        new THREE.MeshStandardMaterial({ color: 0x737373, roughness: 0.95 }),
      );
      rock.position.y = 0.42;
      rock.scale.set(1.15, 0.8, 0.95);
      group.add(rock);
    } else {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.75, 0.75),
        new THREE.MeshStandardMaterial({ color: 0x9a6735, roughness: 0.85 }),
      );
      crate.position.y = 0.38;
      group.add(crate);
    }

    group.scale.setScalar(scale);
    group.rotation.y = degreesToRadians(prop?.rotation || 0);
    group.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.editorPropId = prop?.id;
    });
    group.userData.editorPropId = prop?.id;
    group.userData.editorProp = prop;
    return group;
  }

  function disposeObject3D(root) {
    if (!root) return;
    root.traverse((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat?.dispose?.());
      } else {
        child.material?.dispose?.();
      }
    });
  }

  function positionEditorPropMesh(mesh, prop, hexOverride = null) {
    const pos = getPropWorldPosition(prop, hexOverride);
    if (!pos) return false;
    mesh.position.copy(pos);
    mesh.userData.editorProp = prop;
    return true;
  }

  function syncEditorProps(props = [], options = {}) {
    if (!editorPropGroup) return;
    const nextProps = Array.isArray(props) ? props : [];
    const nextIds = new Set(nextProps.map((prop) => prop.id).filter(Boolean));

    editorPropMeshes.forEach((mesh, id) => {
      if (nextIds.has(id)) return;
      editorPropGroup.remove(mesh);
      disposeObject3D(mesh);
      editorPropMeshes.delete(id);
    });

    nextProps.forEach((prop) => {
      if (!prop?.id) return;
      let mesh = editorPropMeshes.get(prop.id);
      if (!mesh || mesh.userData?.editorProp?.type !== prop.type) {
        if (mesh) {
          editorPropGroup.remove(mesh);
          disposeObject3D(mesh);
        }
        mesh = createEditorPropMesh(prop);
        editorPropMeshes.set(prop.id, mesh);
        editorPropGroup.add(mesh);
      }
      mesh.userData.editorProp = prop;
      mesh.rotation.y = degreesToRadians(prop.rotation || 0);
      mesh.scale.setScalar(Number(prop.scale) || 1);
      if (editorPropGrab?.id !== prop.id) {
        positionEditorPropMesh(mesh, prop);
      }
      applyEditorPropSelection(mesh, options.selectedPropId === prop.id);
    });
  }

  function setEditorPropInteractionState(nextState = {}) {
    editorPropInteractionState = {
      ...editorPropInteractionState,
      ...nextState,
    };
  }

  function beginPropGrab(propHit, event) {
    if (!propHit?.id || !propHit?.mesh) return false;
    const prop = propHit.prop || propHit.mesh.userData.editorProp;
    const startHex = { q: prop.q, r: prop.r };
    editorPropGrab = {
      id: propHit.id,
      type: "prop",
      source: event?.pointerType || "mouse",
      startHex,
      currentHex: startHex,
    };
    controls.enabled = false;
    applyEditorPropSelection(propHit.mesh, true);
    if (typeof editorPropInteractionState.onPropGrab === "function") {
      editorPropInteractionState.onPropGrab({
        grabbedObject: editorPropGrab,
        prop,
      });
    }
    return true;
  }

  function updatePropGrabHover(event) {
    if (!editorPropGrab) return;
    const tileData = getTileFromPointerEvent(event);
    const hex = getOffsetHexFromTile(tileData);
    const mesh = editorPropMeshes.get(editorPropGrab.id);
    const prop = mesh?.userData?.editorProp;
    if (hex && mesh && prop) {
      editorPropGrab.currentHex = { q: hex.q, r: hex.r };
      positionEditorPropMesh(mesh, prop, editorPropGrab.currentHex);
    } else {
      editorPropGrab.currentHex = null;
    }
    if (typeof editorPropInteractionState.onPropHover === "function") {
      editorPropInteractionState.onPropHover({
        grabbedObject: editorPropGrab,
        hoverHex: hex ? { q: hex.q, r: hex.r } : null,
        prop,
      });
    }
  }

  function completePropDrop(event) {
    if (!editorPropGrab) return false;
    updatePropGrabHover(event);
    const mesh = editorPropMeshes.get(editorPropGrab.id);
    const prop = mesh?.userData?.editorProp;
    const dropHex = editorPropGrab.currentHex || null;
    const payload = {
      grabbedObject: editorPropGrab,
      prop,
      dropHex,
    };
    const accepted =
      typeof editorPropInteractionState.onPropDrop === "function"
        ? editorPropInteractionState.onPropDrop(payload) !== false
        : false;
    if (!accepted && mesh && prop) {
      positionEditorPropMesh(mesh, prop, editorPropGrab.startHex);
    }
    editorPropGrab = null;
    pointerDownAt = null;
    controls.enabled = true;
    return accepted;
  }

  function clearMovementHighlights() {
    if (!movementHighlightGroup) return;
    movementHighlightGroup.children.forEach((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat?.dispose?.());
      } else {
        child.material?.dispose?.();
      }
    });
    movementHighlightGroup.clear();
  }

  function syncMovementHighlights() {
    clearMovementHighlights();
    if (!movementHighlightGroup || !mapInteractionState?.movementMode?.active) {
      return;
    }

    const validMoves = Array.isArray(mapInteractionState.validMoves)
      ? mapInteractionState.validMoves
      : [];
    validMoves.forEach((move) => {
      if (!Number.isFinite(move?.x) || !Number.isFinite(move?.y)) return;
      const axial = offsetToAxial(move.x, move.y);
      const tileMesh = tileMeshLookup.get(`${axial.q},${axial.r}`);
      if (!tileMesh) return;

      const box = new THREE.Box3().setFromObject(tileMesh);
      const y = Number.isFinite(box.max.y)
        ? box.max.y + 0.045
        : tileMesh.position.y + 0.12;
      const geometry = new THREE.CylinderGeometry(
        HEX_RADIUS * 0.88,
        HEX_RADIUS * 0.88,
        0.035,
        6,
      );
      const material = new THREE.MeshBasicMaterial({
        color: mapInteractionState.movementMode?.isRunning ? 0xffb020 : 0x22c55e,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(tileMesh.position.x, y, tileMesh.position.z);
      marker.rotation.y = tileMesh.rotation?.y || Math.PI / 6;
      marker.renderOrder = 20;
      movementHighlightGroup.add(marker);
    });
  }

  function setMapInteractionState(nextState = {}) {
    mapInteractionState = {
      ...mapInteractionState,
      ...nextState,
      movementMode: nextState.movementMode || { active: false, isRunning: false },
      validMoves: Array.isArray(nextState.validMoves) ? nextState.validMoves : [],
    };
    syncMovementHighlights();
  }

  function handleArenaPointerDown(event) {
    pointerDownAt = { x: event.clientX, y: event.clientY };
    const propHit = getPropFromPointerEvent(event);
    if (beginPropGrab(propHit, event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleArenaMouseMove(event) {
    if (editorPropGrab) {
      updatePropGrabHover(event);
      return;
    }
    const hoverHandler = mapInteractionState?.onHexHover;
    if (typeof hoverHandler !== "function") return;
    const tileData = getTileFromPointerEvent(event);
    hoverHandler(getOffsetHexFromTile(tileData));
  }

  function handleArenaClick(event) {
    if (editorPropGrab) return;
    if (pointerDownAt) {
      const dx = event.clientX - pointerDownAt.x;
      const dy = event.clientY - pointerDownAt.y;
      pointerDownAt = null;
      if (Math.sqrt(dx * dx + dy * dy) > 6) return;
    }

    const selectHandler = mapInteractionState?.onHexSelect;
    if (typeof selectHandler !== "function") return;
    const tileData = getTileFromPointerEvent(event);
    const hex = getOffsetHexFromTile(tileData);
    if (!hex) return;
    selectHandler(hex);
  }

  renderer.domElement.addEventListener("mousedown", handleArenaPointerDown);
  renderer.domElement.addEventListener("mousemove", handleArenaMouseMove);
  renderer.domElement.addEventListener("mouseup", completePropDrop);
  renderer.domElement.addEventListener("click", handleArenaClick);

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
        center.z + radius * 0.75,
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

  /**
   * Compute a signature for terrain to detect when it actually changes
   * @param {Object} terrain - Terrain object
   * @returns {string} Signature string
   */
  function terrainSignature(terrain) {
    if (!terrain) return "DEFAULT";

    const hexRadius = terrain.hexRadius || HEX_RADIUS;

    // If a grid is provided, rebuild only when its size or a version changes
    const gridLen = Array.isArray(terrain.grid) ? terrain.grid.length : 0;

    const width =
      terrain.width || terrain.GRID_WIDTH || GRID_CONFIG?.GRID_WIDTH || 40;
    const height =
      terrain.height || terrain.GRID_HEIGHT || GRID_CONFIG?.GRID_HEIGHT || 30;

    const terrainKey =
      terrain.terrain ||
      terrain.terrainType ||
      terrain.baseTerrain ||
      "OPEN_GROUND";

    // If you have a revision / updatedAt / version field, include it here:
    const version =
      terrain.version ||
      terrain.updatedAt ||
      terrain.rev ||
      terrain.gridVersion ||
      "";

    return `${terrainKey}|${width}x${height}|hexR:${hexRadius}|grid:${gridLen}|v:${version}`;
  }

  function rebuildGridFromEnvironment(terrain) {
    // Check terrain signature - skip rebuild if unchanged
    const sig = terrainSignature(terrain);
    if (sig === lastTerrainSig && gridRoot) {
      // Terrain hasn't changed, skip rebuild
      return;
    }
    lastTerrainSig = sig;

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
      syncMovementHighlights();
      if (DEBUG_COMBAT) {
        console.log(
          `[HexArena] Generated default grid: ${tiles.length} tiles (${defaultWidth}x${defaultHeight})`,
        );
      }
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

      if (DEBUG_COMBAT) {
        console.log(
          `[HexArena] No grid provided, generating ${width}x${height} grid for terrain: ${terrainKey}`,
        );
      }

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
      syncMovementHighlights();
      if (DEBUG_COMBAT) {
        console.log(
          `[HexArena] Generated grid: ${tiles.length} tiles (${width}x${height})`,
        );
      }
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
      hexRadius,
    );
    gridRoot = group;
    tileMeshLookup = lookup;
    scene.add(gridRoot);
    frameGrid();
    syncMovementHighlights();
    if (DEBUG_COMBAT) {
      console.log(
        `[HexArena] Grid synced: ${grid.length} tiles (radius ${radius})`,
      );
    }
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
      if (DEBUG_COMBAT && (result.updated > 0 || result.added > 0)) {
        console.log(
          `[HexArena] Incrementally updated ${result.updated} tiles, added ${result.added} new tiles (${result.missing} missing)`,
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
    embeddedArrows = [],
    impactReactions = {},
    dangerHexes = [],
    terrain,
  }) {
    rebuildGridFromEnvironment(terrain);
    impactReactionsById = impactReactions || {};

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

      // Normalize visual/footprint from either nested (bestiary) or flat shape so modelUrl, feet, baseHeightFt are always set
      const normalized = normalizeFighterVisualAndFootprint(fighter);
      const fighterVisual = normalized.visual;
      const fighterFootprint = normalized.footprint;

      // Resolve model URL based on flying state and perching state (if provided)
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
        // Use normalized visual/footprint so modelUrl, feet, baseHeightFt are always present
        const resolvedVisual = desiredModelUrl
          ? { ...fighterVisual, modelUrl: desiredModelUrl }
          : fighterVisual;

        // Compute desired footprint radius in world space (for model scaling)
        // This ensures the model matches the hex footprint regardless of GLB authoring scale
        const desiredRadiusWorld = getDesiredFootprintRadiusWorld({ ...fighter, footprint: fighterFootprint });

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
        if (DEBUG_COMBAT && (characterData.visual || characterData.footprint)) {
          console.log(
            `[HexArena] Creating character for ${characterData.name}:`,
            {
              hasVisual: !!characterData.visual,
              hasFootprint: !!characterData.footprint,
              modelUrl: characterData.visual?.modelUrl,
              footprintFeet: characterData.footprint?.feet,
              baseHeightFt: characterData.visual?.baseHeightFt,
              radiusHex: characterData.footprint?.radiusHex,
            },
          );
        } else if (DEBUG_COMBAT) {
          console.log(
            `[HexArena] Creating character for ${characterData.name}: NO visual/footprint data`,
          );
        }

        characterMesh = createCharacterIcon(characterData);
        characterMesh.userData.fighterId = fighterId;
        characterMesh.userData.occupiedHexes = occupiedHexes;
        characterMesh.userData.yawOffsetRad = degreesToRadians(
          characterData?.visual?.yawOffsetDeg ?? 0,
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
            (child) => child.userData.type === "characterModel",
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
            HEX_TILE_THICKNESS,
          );

          // Apply foot offset with scale: anchors feet to hex surface
          const waterOffset = isWater ? 0.2 : 0;
          pos.y += footOffsetUnscaled * scale;
          pos.y += waterOffset;

          // Update position to correct location
          characterMesh.position.copy(pos);
          characterMesh.userData.basePosition = pos.clone();
        }

        if (!characterMesh.userData.basePosition) {
          characterMesh.userData.basePosition = characterMesh.position.clone();
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
          HEX_TILE_THICKNESS,
        );

        // Adjust Y position: models have base at Y=0 in local space, placeholders need offset
        const hasModel =
          characterMesh.userData.hasModel ||
          characterMesh.children.some(
            (child) => child.userData.type === "characterModel",
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
        characterMesh.userData.basePosition = pos.clone();

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
            0,
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
    if (DEBUG_COMBAT) {
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
    syncEmbeddedArrows(embeddedArrows);
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
    if (DEBUG_COMBAT) {
      occupiedHexesMap.forEach((hexes, fighterId) => {
        if (hexes.length > 1) {
          const fighter = fighters.find((f) => f.id === fighterId);
          const name = fighter?.name || fighterId;
          console.log(
            `[HexArena] ${name} occupies ${hexes.length} hexes (radius ${
              fighter?.footprint?.radiusHex ?? 0
            })`,
          );
        }
      });

      console.log(`[HexArena] Synced ${characterMeshes.size} characters`);
    }
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
      HEX_TILE_THICKNESS,
    );
  }

  function worldFromProjectileSample(projectile, sample) {
    if (!projectile || !sample) return null;
    const fromWorld = worldFromGrid({
      ...projectile.from,
      altitudeFeet: sample.z,
    });
    const toWorld = worldFromGrid({
      ...projectile.to,
      altitudeFeet: sample.z,
    });
    if (!fromWorld || !toWorld) return null;
    return fromWorld.clone().lerp(toWorld, sample.easedT);
  }

  function getProjectileImpactOffsetWorld(projectileOrArrow, t = 1) {
    const impact = projectileOrArrow?.impact || {};
    if (impact.surface !== "body") {
      return new THREE.Vector3(0, 0, 0);
    }

    const amount = Math.max(0, Math.min(1, Number(t) || 0));
    return new THREE.Vector3(
      Number(impact.lateralFeet || 0) * BODY_IMPACT_FEET_TO_WORLD * amount,
      0,
      Number(impact.forwardFeet || 0) * BODY_IMPACT_FEET_TO_WORLD * amount
    );
  }

  function projectileSampleToWorld(projectileOrArrow, sample) {
    const base = worldFromProjectileSample(projectileOrArrow, sample);
    if (!base) return null;
    return base.add(getProjectileImpactOffsetWorld(projectileOrArrow, sample?.t ?? 1));
  }

  function disposeProjectileMesh(mesh) {
    if (!mesh) return;
    mesh.traverse?.((child) => {
      if (child.userData?.skipDispose) return;
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  function getSharedArrowAssets() {
    if (sharedArrowAssets) return sharedArrowAssets;

    sharedArrowAssets = {
      shaftGeometry: new THREE.CylinderGeometry(0.025, 0.025, 0.85, 8),
      headGeometry: new THREE.ConeGeometry(0.08, 0.22, 10),
      featherGeometry: new THREE.PlaneGeometry(0.16, 0.08),
      shaftMaterial: new THREE.MeshStandardMaterial({
        color: 0x8b5a2b,
        roughness: 0.75,
        metalness: 0.05,
      }),
      headMaterial: new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.5,
        metalness: 0.35,
      }),
      featherMaterial: new THREE.MeshStandardMaterial({
        color: 0xd8d8d8,
        roughness: 0.8,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    };

    return sharedArrowAssets;
  }

  function disposeSharedArrowAssets() {
    if (!sharedArrowAssets) return;
    Object.values(sharedArrowAssets).forEach((asset) => asset?.dispose?.());
    sharedArrowAssets = null;
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

  function createArrowFallbackMesh(kind = "arrow") {
    const assets = getSharedArrowAssets();
    const group = new THREE.Group();
    group.name = `${kind}_fallback_arrow`;

    // Local +Y is the forward axis; projectile orientation maps +Y onto flight direction.
    const shaft = new THREE.Mesh(
      assets.shaftGeometry,
      assets.shaftMaterial
    );
    shaft.castShadow = false;
    shaft.frustumCulled = false;
    shaft.userData.skipDispose = true;
    group.add(shaft);

    const head = new THREE.Mesh(
      assets.headGeometry,
      assets.headMaterial
    );
    head.position.y = 0.52;
    head.castShadow = false;
    head.frustumCulled = false;
    head.userData.skipDispose = true;
    group.add(head);

    const featherA = new THREE.Mesh(
      assets.featherGeometry,
      assets.featherMaterial
    );
    featherA.position.y = -0.42;
    featherA.rotation.x = Math.PI / 2;
    featherA.frustumCulled = false;
    featherA.userData.skipDispose = true;
    group.add(featherA);

    const featherB = featherA.clone();
    featherB.rotation.y = Math.PI / 2;
    featherB.userData.skipDispose = true;
    group.add(featherB);

    if (kind === "bolt") {
      group.scale.setScalar(0.8);
    } else if (kind === "thrown") {
      group.scale.setScalar(1.25);
    }

    return group;
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

        if (DEBUG_COMBAT) console.log("[HexArena] arrow.glb loaded");
          resolve(arrowTemplate);
        },
        undefined,
        reject,
      );
    });

    return arrowTemplatePromise;
  }

  function syncDangerRings(dangerHexes = []) {
    if (!dangerRingGroup) return;
    const wanted = new Set(
      (dangerHexes || [])
        .filter((h) => h && Number.isFinite(h.x) && Number.isFinite(h.y))
        .map((h) => `${h.x},${h.y}`),
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

      // Visible fallback right away so first-shot timing never hides it.
      const fallback = createArrowFallbackMesh(kind);
      group.add(fallback);

      const attachClone = (template) => {
        // remove fallback
        group.remove(fallback);
        disposeProjectileMesh(fallback);

        const clone = template.clone(true);
        clone.name = "arrowGLB";
        // Align +Z-forward GLB to +Y-forward, then flip to match travel direction.
        clone.rotation.x = Math.PI / 2;
        clone.rotation.z = Math.PI;
        clone.traverse((obj) => {
          obj.userData.skipDispose = true;
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = false;
            obj.frustumCulled = false;
          }
        });

        clone.scale.setScalar(kind === "bolt" ? 0.8 : 1);

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
    } else if (kind === "fireball") {
      geometry = new THREE.SphereGeometry(0.12, 12, 12);
      material = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200 });
    } else if (kind === "icebolt") {
      geometry = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
      material = new THREE.MeshStandardMaterial({ color: 0x88ddff, emissive: 0x2288aa });
    } else if (kind === "lightning") {
      geometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
      material = new THREE.MeshStandardMaterial({ color: 0xffff88, emissive: 0xaaaa00 });
    } else if (kind === "magicmissile" || kind === "spell_generic") {
      geometry = new THREE.SphereGeometry(0.08, 8, 8);
      material = new THREE.MeshStandardMaterial({ color: 0xaa66ff, emissive: 0x4422aa });
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
    if (DEBUG_COMBAT) {
      console.log(
        "[HexArena] syncProjectiles count:",
        (projectiles || []).length,
        projectiles?.[0],
      );
    }
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

  function positionEmbeddedArrowMesh(mesh, arrow) {
    if (!mesh || !arrow) return;

    const impactTime = Number(arrow.firedAtMs || 0) + Number(arrow.durationMs || 450);
    const finalPoint = sampleProjectilePosition(arrow, impactTime);
    const beforePoint = sampleProjectilePosition(arrow, impactTime - 24);
    const finalWorld = projectileSampleToWorld(arrow, finalPoint);
    const beforeWorld = projectileSampleToWorld(arrow, beforePoint);
    if (!finalWorld || !beforeWorld) return;

    const dir = finalWorld.clone().sub(beforeWorld);
    if (dir.lengthSq() > 0.0001) {
      dir.normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      // Move back along the flight direction so the point reads as stuck in the impact surface.
      mesh.position.copy(finalWorld.clone().add(dir.clone().multiplyScalar(-0.18)));
    } else {
      mesh.position.copy(finalWorld);
    }

    if (arrow.impact?.surface === "ground") {
      mesh.rotation.x += -0.15;
    }

    mesh.userData.embedded = true;
    mesh.userData.impact = arrow.impact;

    if (arrow.impact?.isHeadShot) {
      mesh.userData.isHeadShot = true;
      if (DEBUG_COMBAT) {
        console.log("[HEADSHOT_ARROW]", {
          id: arrow.id,
          total: arrow.impact?.total,
          clock: arrow.impact?.clock,
          zone: arrow.impact?.zone,
        });
      }
    }
  }

  function createEmbeddedArrowMesh(arrow) {
    const mesh = createProjectileMesh(arrow);
    mesh.userData.embeddedArrow = arrow;
    positionEmbeddedArrowMesh(mesh, arrow);
    return mesh;
  }

  function syncEmbeddedArrows(embeddedArrows) {
    if (!embeddedArrowGroup) {
      embeddedArrowGroup = new THREE.Group();
      embeddedArrowGroup.name = "embeddedArrows";
      scene.add(embeddedArrowGroup);
    }

    const activeIds = new Set();
    (embeddedArrows || []).forEach((arrow) => {
      if (!arrow?.id) return;
      activeIds.add(arrow.id);

      let mesh = embeddedArrowMeshes.get(arrow.id);
      if (!mesh) {
        mesh = createEmbeddedArrowMesh(arrow);
        embeddedArrowGroup.add(mesh);
        embeddedArrowMeshes.set(arrow.id, mesh);
      }
      mesh.userData.embeddedArrow = arrow;
    });

    embeddedArrowMeshes.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        embeddedArrowGroup.remove(mesh);
        disposeProjectileMesh(mesh);
        embeddedArrowMeshes.delete(id);
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
    renderer.domElement.removeEventListener("mousedown", handleArenaPointerDown);
    renderer.domElement.removeEventListener("mousemove", handleArenaMouseMove);
    renderer.domElement.removeEventListener("mouseup", completePropDrop);
    renderer.domElement.removeEventListener("click", handleArenaClick);
    clearMovementHighlights();
    if (movementHighlightGroup) {
      scene.remove(movementHighlightGroup);
      movementHighlightGroup = null;
    }

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
            error,
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

    if (editorPropGroup) {
      editorPropMeshes.forEach((mesh) => {
        editorPropGroup.remove(mesh);
        disposeObject3D(mesh);
      });
      editorPropMeshes.clear();
      if (scene) scene.remove(editorPropGroup);
      editorPropGroup = null;
    }

    if (projectileGroup) {
      projectileMeshes.forEach((mesh) => {
        projectileGroup.remove(mesh);
        disposeProjectileMesh(mesh);
      });
      projectileMeshes.clear();
      if (scene) scene.remove(projectileGroup);
      projectileGroup = null;
    }

    if (embeddedArrowGroup) {
      embeddedArrowMeshes.forEach((mesh) => {
        embeddedArrowGroup.remove(mesh);
        disposeProjectileMesh(mesh);
      });
      embeddedArrowMeshes.clear();
      if (scene) scene.remove(embeddedArrowGroup);
      embeddedArrowGroup = null;
    }

    disposeSharedArrowAssets();

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
    setMapInteractionState,
    setEditorPropInteractionState,
    syncEditorProps,
    getOccupiedHexesForFighter,
    getOccupiedHexes, // Export for use in pathfinding/blocking logic
    getScaleForFootprint, // Export for use elsewhere if needed
    applyLighting: (presetKey) =>
      applyLightingPresetToArena(scene, renderer, presetKey), // Export lighting control
  };
}

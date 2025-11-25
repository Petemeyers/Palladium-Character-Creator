import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { HEX_RADIUS, worldVectorFromAxial } from "./hexGridMath.js";

import { buildRectangular3DMap, createHexMesh } from "./three/mapBuilder3D.js";
import { GRID_CONFIG } from "../../data/movementRules.js";

/**
 * MULTI-MODE ARENA (Editor + Combat)
 * Persistent instance for dual 2D/3D rendering.
 */
export function initHexArena(containerElement) {
  if (!containerElement) {
    console.error("HexArena: Missing container");
    return null;
  }

  // === Scene ===
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  // === Camera ===
  const camera = new THREE.PerspectiveCamera(
    60,
    containerElement.clientWidth / containerElement.clientHeight,
    0.1,
    20000
  );
  camera.position.set(40, 70, 90);

  // === Renderer ===
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
  renderer.shadowMap.enabled = true;

  containerElement.innerHTML = "";
  containerElement.appendChild(renderer.domElement);

  // === Controls ===
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // === Lights ===
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(20, 40, 20);
  sun.castShadow = true;
  scene.add(ambient, sun);

  function updateLighting(mode) {
    switch (mode) {
      case "DARK":
        ambient.intensity = 0.2;
        sun.intensity = 0.3;
        break;
      default:
        ambient.intensity = 0.6;
        sun.intensity = 1;
        break;
    }
  }

  // === Grid / Terrain ===
  let gridRoot = null;
  // tileMeshLookup: Map of tile meshes by key (for future map editor interactions)
  // eslint-disable-next-line no-unused-vars
  let tileMeshLookup = new Map();
  let lastGridSignature = null;

  function rebuildGrid(mapType, terrainDefinition) {
    if (gridRoot) {
      scene.remove(gridRoot);
      gridRoot.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      gridRoot = null;
    }

    const width =
      terrainDefinition.width ||
      terrainDefinition.GRID_WIDTH ||
      GRID_CONFIG.GRID_WIDTH ||
      20;
    const height =
      terrainDefinition.height ||
      terrainDefinition.GRID_HEIGHT ||
      GRID_CONFIG.GRID_HEIGHT ||
      20;
    // Convert terrain key (e.g., "OPEN_GROUND") to lowercase for mapBuilder (e.g., "grass")
    const terrainKey =
      terrainDefinition.terrain ||
      terrainDefinition.baseTerrain ||
      "OPEN_GROUND";
    const baseTerrain =
      terrainKey.toLowerCase().replace(/_/g, "") === "openground"
        ? "grass"
        : terrainKey.toLowerCase().includes("forest")
        ? "forest"
        : terrainKey.toLowerCase().includes("rock")
        ? "rock"
        : terrainKey.toLowerCase().includes("water")
        ? "water"
        : terrainKey.toLowerCase().includes("sand")
        ? "sand"
        : terrainKey.toLowerCase().includes("hill")
        ? "hill"
        : terrainKey.toLowerCase().includes("road")
        ? "road"
        : "grass";

    // Build rectangular map
    const mapManager = buildRectangular3DMap(height, width, {
      uniformTerrain: true,
      baseTerrain: baseTerrain,
      maxHeight: 0, // Flat map for now
    });

    // Create THREE.Group and meshes
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
  }

  // === Combatants ===
  const combatantGroup = new THREE.Group();
  scene.add(combatantGroup);
  const combatantMeshes = new Map();

  function syncCombatants(fighters, positions) {
    // Remove old fighters
    for (const [id, mesh] of combatantMeshes.entries()) {
      if (!fighters.find((f) => f.id === id)) {
        combatantGroup.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        combatantMeshes.delete(id);
      }
    }

    // Add / update fighters
    for (const fighter of fighters) {
      let mesh = combatantMeshes.get(fighter.id);

      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(1, 1, 2, 12),
          new THREE.MeshStandardMaterial({ color: fighter.color || 0x77ccff })
        );
        mesh.castShadow = true;
        combatantGroup.add(mesh);
        combatantMeshes.set(fighter.id, mesh);
      }

      const pos = positions[fighter.id];
      if (pos) {
        const world = worldVectorFromAxial(pos.q, pos.r, 0, HEX_RADIUS);
        mesh.position.set(world.x, 1, world.z);
      }
    }
  }

  // === Sync MAP EDITOR ===
  function syncMapEditorState(mapDefinition) {
    const signature = `editor-${mapDefinition.mapType}-${mapDefinition.terrain}`;
    if (signature !== lastGridSignature) {
      lastGridSignature = signature;
      rebuildGrid(mapDefinition.mapType, mapDefinition);
      updateLighting(mapDefinition.lighting || "BRIGHT_DAYLIGHT");
    }
  }

  // === Sync COMBAT ===
  function syncCombatState({ fighters, positions, terrain, mapType }) {
    const signature = `combat-${terrain?.terrain}-${mapType}`;
    if (signature !== lastGridSignature) {
      lastGridSignature = signature;
      rebuildGrid(mapType, terrain);
      updateLighting(terrain.lighting || "BRIGHT_DAYLIGHT");
    }
    syncCombatants(fighters, positions);
  }

  // === Resize ===
  function resize() {
    const w = containerElement.clientWidth;
    const h = containerElement.clientHeight;
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  }
  window.addEventListener("resize", resize);

  // === Animation Loop ===
  let disposed = false;
  function animate() {
    if (disposed) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // === Cleanup ===
  function dispose() {
    disposed = true;
    window.removeEventListener("resize", resize);
    renderer.dispose();
    renderer.forceContextLoss();
    containerElement.innerHTML = "";
  }

  // === Return API ===
  return {
    syncMapEditorState,
    syncCombatState,
    dispose,
    resize,
  };
}

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildHexagon3DFromGrid } from "./mapBuilder3D.js";

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

export function initHexArena(containerElement) {
  if (!containerElement) {
    console.error("HexArena: No container element provided.");
    return null;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#1a1e2e");

  const camera = new THREE.PerspectiveCamera(
    60,
    containerElement.clientWidth / containerElement.clientHeight,
    0.1,
    5000
  );
  camera.position.set(20, 40, 40);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
  renderer.shadowMap.enabled = true;

  containerElement.innerHTML = "";
  containerElement.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(20, 40, 20);
  sun.castShadow = true;
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(sun);
  scene.add(ambient);

  let gridRoot = null;
  // eslint-disable-next-line no-unused-vars
  let tileMeshLookup = new Map();
  let disposed = false;

  function animate() {
    if (disposed) return;
    requestAnimationFrame(animate);
    controls.update();
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

  function rebuildGridFromEnvironment(terrain) {
    if (!terrain) {
      console.error("HexArena: Missing terrain object.");
      return;
    }
    if (!terrain.grid || !terrain.grid.length) {
      console.error("HexArena: terrain.grid missing or empty.");
      return;
    }
    if (!terrain.radius) {
      console.error("HexArena: terrain.radius missing.");
      return;
    }

    if (gridRoot) {
      scene.remove(gridRoot);
      gridRoot.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      gridRoot = null;
    }

    const { group, tileMeshLookup: lookup } = buildHexagon3DFromGrid(
      terrain.grid,
      terrain.hexRadius || 1
    );
    gridRoot = group;
    tileMeshLookup = lookup;
    scene.add(gridRoot);
    console.log(
      `[HexArena] Grid synced: ${terrain.grid.length} tiles (radius ${terrain.radius})`
    );
  }

  function syncMapEditorState(terrain) {
    rebuildGridFromEnvironment(terrain);
  }

  function syncCombatState({ terrain }) {
    rebuildGridFromEnvironment(terrain);
    // TODO: render fighters/positions as meshes if desired
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
          console.warn("[HexArena] Could not remove renderer DOM element:", error);
        }
      }
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
  };
}

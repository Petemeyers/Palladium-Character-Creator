import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  HEX_RADIUS,
  HEX_TILE_THICKNESS,
  createFlatHexGeometry,
  worldVectorFromAxial,
  computeCenterFromAxial,
} from "../utils/hexGridMath.js";
import { offsetToAxial } from "../utils/hexGridMath.js";
import { GRID_CONFIG } from "../data/movementRules.js";

/**
 * TacticalMap3DBackground - Renders a 3D landscape background for the 2D TacticalMap
 * 
 * This component creates a 3D Three.js scene that mirrors the exact hex grid from TacticalMap.
 * It's designed to be rendered BEHIND the 2D map, providing visual depth while the 2D map
 * handles all interactions.
 * 
 * Features:
 * - Uses the same hex grid math as TacticalMap
 * - Renders terrain with proper tessellation
 * - Supports terrain types and features
 * - Top-down camera matching 2D view
 * - No interaction (pointer-events handled by 2D layer)
 */
export default function TacticalMap3DBackground({
  terrain = null,
  positions = {},
  combatants = [],
  mapType = "hex",
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#87CEEB");
    sceneRef.current = scene;

    // Camera - top-down view matching 2D map
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight || 1,
      0.1,
      1000
    );
    camera.position.set(0, 50, 0); // Top-down
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true, // Allow transparency for 2D overlay
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(20, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    scene.add(sun);

    // Controls - locked to top-down, matching 2D view
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false; // Lock rotation
    controls.maxPolarAngle = Math.PI / 2; // Top-down only
    controls.minDistance = 30;
    controls.maxDistance = 200;
    controls.enablePan = true;
    controls.enableZoom = true;
    controlsRef.current = controls;

    // Terrain colors matching TacticalMap
    const terrainColors = {
      OPEN_GROUND: 0x9dd66b,
      LIGHT_FOREST: 0x58a65c,
      DENSE_FOREST: 0xe5e5e5,
      ROCKY_TERRAIN: 0x7d7d7d,
      URBAN: 0xb9a57f,
      SWAMP_MARSH: 0x476a4d,
      CAVE_INTERIOR: 0x3b3b3b,
      WATER: 0x3ba4ff,
      INTERIOR: 0x666666,
    };

    // Build hex grid matching TacticalMap exactly
    const tileMeshes = new Map();
    const hexGroup = new THREE.Group();
    scene.add(hexGroup);

    // Helper to get terrain type for a cell
    const getCellTerrain = (col, row) => {
      if (!terrain?.grid) return terrain?.baseTerrain || "OPEN_GROUND";
      
      // Check if grid is array of arrays
      if (Array.isArray(terrain.grid)) {
        const rowData = terrain.grid[row];
        if (rowData && Array.isArray(rowData)) {
          const cell = rowData[col];
          if (cell?.terrainType) return cell.terrainType;
        }
      }
      
      // Check if grid is object with keys
      const cellKey = `${col},${row}`;
      if (terrain.grid[cellKey]?.terrainType) {
        return terrain.grid[cellKey].terrainType;
      }
      
      return terrain.baseTerrain || "OPEN_GROUND";
    };

    // Helper to check if hex is within boundary (matching TacticalMap)
    const isWithinHexBoundary = (col, row) => {
      if (mapType === "square") return true;
      const centerCol = Math.floor(GRID_CONFIG.GRID_WIDTH / 2);
      const centerRow = Math.floor(GRID_CONFIG.GRID_HEIGHT / 2);
      const hexRadius = Math.max(GRID_CONFIG.GRID_WIDTH, GRID_CONFIG.GRID_HEIGHT) / 2;
      
      const { q, r } = offsetToAxial(col, row);
      const centerAxial = offsetToAxial(centerCol, centerRow);
      
      const dq = q - centerAxial.q;
      const dr = r - centerAxial.r;
      const ds = -(q + r) - (-(centerAxial.q + centerAxial.r));
      const distance = (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
      
      return distance <= hexRadius * 0.85;
    };

    // Create hex tiles
    for (let row = 0; row < GRID_CONFIG.GRID_HEIGHT; row++) {
      for (let col = 0; col < GRID_CONFIG.GRID_WIDTH; col++) {
        // Skip hexes outside boundary for hex maps
        if (!isWithinHexBoundary(col, row)) continue;

        // Convert offset to axial (same as TacticalMap)
        const { q, r } = offsetToAxial(col, row);
        
        // Get terrain type
        const terrainType = getCellTerrain(col, row);
        const terrainColor = terrainColors[terrainType] || 0x9dd66b;
        
        // Create hex mesh
        const geometry = createFlatHexGeometry(HEX_RADIUS, HEX_TILE_THICKNESS);
        const material = new THREE.MeshStandardMaterial({
          color: terrainColor,
          roughness: 0.85,
          metalness: 0,
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.castShadow = false; // Ground doesn't cast shadows
        
        // Position using same math as TacticalMap
        const worldPos = worldVectorFromAxial(q, r, HEX_TILE_THICKNESS / 2, HEX_RADIUS);
        mesh.position.copy(worldPos);
        
        // Store reference
        mesh.userData = { col, row, q, r, terrainType };
        tileMeshes.set(`${col},${row}`, mesh);
        hexGroup.add(mesh);
      }
    }

    // Add simple character markers (optional, can be enhanced later)
    const characterGroup = new THREE.Group();
    scene.add(characterGroup);
    const characterMarkers = new Map(); // Track markers by ID

    // Initial character setup
    Object.entries(positions).forEach(([id, pos]) => {
      const combatant = combatants.find(c => (c._id || c.id) === id);
      if (!combatant) return;
      
      // Convert position to axial (same as TacticalMap)
      let q, r;
      if (pos.q !== undefined && pos.r !== undefined) {
        q = pos.q;
        r = pos.r;
      } else if (pos.x !== undefined && pos.y !== undefined) {
        const axial = offsetToAxial(pos.x, pos.y);
        q = axial.q;
        r = axial.r;
      } else {
        return;
      }
      
      // Create marker
      const markerGeometry = new THREE.ConeGeometry(0.3, 0.8, 6);
      const markerMaterial = new THREE.MeshStandardMaterial({
        color: combatant.isEnemy ? 0xff0000 : 0x00ff00,
        roughness: 0.5,
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.castShadow = true;
      marker.rotation.x = -Math.PI / 2;
      
      const worldPos = worldVectorFromAxial(q, r, 0.4, HEX_RADIUS);
      marker.position.copy(worldPos);
      
      marker.userData = { id, combatant };
      characterGroup.add(marker);
      characterMarkers.set(id, marker);
    });
    
    // Store references for updates
    sceneRef.current.characterGroup = characterGroup;
    sceneRef.current.characterMarkers = characterMarkers;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight, false);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      
      // Dispose of Three.js resources
      tileMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      characterMarkers.forEach((marker) => {
        marker.geometry.dispose();
        marker.material.dispose();
      });
      
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, [terrain, mapType]); // Only recreate on terrain/mapType change

  // Update characters when positions change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene?.characterGroup || !scene?.characterMarkers) return;
    
    const characterGroup = scene.characterGroup;
    const characterMarkers = scene.characterMarkers;
    
    // Remove markers for combatants that no longer exist
    const currentIds = new Set(Object.keys(positions));
    characterMarkers.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        characterGroup.remove(marker);
        marker.geometry.dispose();
        marker.material.dispose();
        characterMarkers.delete(id);
      }
    });
    
    // Add/update markers for combatants
    Object.entries(positions).forEach(([id, pos]) => {
      const combatant = combatants.find(c => (c._id || c.id) === id);
      if (!combatant) return;
      
      // Convert position to axial (same as TacticalMap)
      let q, r;
      if (pos.q !== undefined && pos.r !== undefined) {
        q = pos.q;
        r = pos.r;
      } else if (pos.x !== undefined && pos.y !== undefined) {
        const axial = offsetToAxial(pos.x, pos.y);
        q = axial.q;
        r = axial.r;
      } else {
        return;
      }
      
      // Update existing marker or create new one
      let marker = characterMarkers.get(id);
      if (!marker) {
        // Create new marker
        const markerGeometry = new THREE.ConeGeometry(0.3, 0.8, 6);
        const markerMaterial = new THREE.MeshStandardMaterial({
          color: combatant.isEnemy ? 0xff0000 : 0x00ff00,
          roughness: 0.5,
        });
        marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.castShadow = true;
        marker.rotation.x = -Math.PI / 2;
        marker.userData = { id, combatant };
        characterGroup.add(marker);
        characterMarkers.set(id, marker);
      }
      
      // Update position
      const worldPos = worldVectorFromAxial(q, r, 0.4, HEX_RADIUS);
      marker.position.copy(worldPos);
    });
  }, [positions, combatants]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none", // Let 2D map handle all interactions
        zIndex: 0, // Behind 2D map
      }}
    />
  );
}


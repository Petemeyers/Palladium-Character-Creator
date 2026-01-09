import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
// Lucide icons (for boulders, water)
import { Mountain, Droplet } from "lucide-react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Tooltip
} from "@chakra-ui/react";
import MovementInfoDisplay from "./MovementInfoDisplay.jsx";
import FogEffectsLayer from "./FogEffectsLayer.jsx";
import ProtectionCircle, { ProtectionCircleHUD } from "./ProtectionCircle.jsx";
import { getCircleRenderData } from "../utils/protectionCircleMapSystem.js";
import { 
  GRID_CONFIG, 
  calculateDistance, 
  getCreatureSize,
  getMovementRange
} from "../data/movementRules";
// Sound detection system - reserved for future full implementation
// import { detectBySound, awarenessCheck } from "../utils/soundDetectionSystem";
// Hex grid math - using direct flat-top hex formulas in getHexPixelPosition

/**
 * TacticalMap Component
 * Visual grid-based tactical combat map
 */
const TacticalMap = ({
  combatants = [],
  positions = {},
  currentTurn = null,
  flashingCombatants: externalFlashingCombatants = null,
  movementMode = { active: false, isRunning: false },
  terrain = null,
  mapType, // "hex" or "square" - no default to allow terrain.mapType fallback
  // Fog of War props
  visibleCells = [], // Array of visible cell positions [{x, y}, ...]
  exploredCells = [], // Array of explored (memory) cell positions [{x, y}, ...]
  fogEnabled = false, // Enable fog of war rendering
  playerPosition = null, // Player observer position {x, y}
  visibilityRange = 60, // Maximum visibility range in feet
  // Protection Circles
  activeCircles = [], // Array of active protection circles
  // Map height control
  mapHeight = 600, // Map height in pixels
  // Selected combatant callback
  onSelectedCombatantChange = null, // Callback when combatant is selected
  // Hex selection callbacks
  onHoveredCellChange = null, // Callback when cell is hovered
  onSelectedHexChange = null, // Callback when hex is selected for movement
  // Editor/Combat mode
  mode = "COMBAT", // "MAP_EDITOR" | "COMBAT"
  mapDefinition = null, // Map definition for editor mode
  // MAP_EDITOR paint palette
  selectedTerrainType = "grass", // Editor: currently selected paint terrain
  onSelectedTerrainTypeChange = null, // Editor: (terrainKey) => void
  onMapCellEdit = null, // Editor: (col,row,cell) -> parent handles state + 3D sync
  onMapCellsEdit = null, // Editor: (changes: Array<{x,y,cell}>) -> bulk edit for bucket fill
}) => {
  // Helper to normalize combatant ids from various sources
  const getCombatantId = (combatant) =>
    combatant?._id || combatant?.id || combatant?.fighterId || combatant?.characterId;

  // ✅ Use mapType from prop, fallback to terrain.mapType, then default to hex
  const effectiveMapType = mapType ?? terrain?.mapType ?? "hex";

  
  const [selectedCombatant, setSelectedCombatant] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [selectedTargetHex, setSelectedTargetHex] = useState(null);
  const [internalFlashingCombatants, setInternalFlashingCombatants] = useState(new Set());
  const mapScrollRef = useRef(null);
  const prevMovementModeRef = useRef(false);
  const prevCurrentTurnRef = useRef(null);

  // MAP_EDITOR: brush mode + drag-painting support
  const [editorBrushMode, setEditorBrushMode] = useState("terrain"); // "terrain" | "bucket" | "raise" | "lower"
  const [editorHeightStep, setEditorHeightStep] = useState(1);
  const isPointerPaintingRef = useRef(false);
  const lastPaintedCellKeyRef = useRef(null);

  function normalizeEditorTerrainKey(raw) {
    const t = String(raw || "grass").toLowerCase();
    if (["grass", "forest", "rock", "water", "sand", "hill", "road"].includes(t)) return t;
    if (t.includes("forest")) return "forest";
    if (t.includes("rock") || t.includes("mountain") || t.includes("ruins") || t.includes("cave")) return "rock";
    if (t.includes("water") || t.includes("swamp") || t.includes("marsh")) return "water";
    if (t.includes("sand") || t.includes("desert")) return "sand";
    if (t.includes("hill")) return "hill";
    if (t.includes("road") || t.includes("urban") || t.includes("city")) return "road";
    if (t.includes("open") || t.includes("field") || t.includes("plain") || t.includes("ground")) return "grass";
    return "grass";
  }
  
  // Use external flashing state if provided, otherwise use internal
  const flashingCombatants = externalFlashingCombatants || internalFlashingCombatants;

  // Hex grid constants for flat-top tessellation
  const HEX_RADIUS = GRID_CONFIG.HEX_SIZE / 2;
  const HEX_WIDTH = Math.sqrt(3) * HEX_RADIUS;
  const HEX_VERTICAL_SPACING = (3 / 2) * HEX_RADIUS;

  // Editor terrain palette
  const editorTerrainPalette = useMemo(
    () => [
      { key: "grass", label: "Grass", swatch: "#67a95b", icon: "🌿" },
      { key: "forest", label: "Forest", swatch: "#2f6b3c", icon: "🌲" },
      { key: "water", label: "Water", swatch: "#2b6cb0", icon: "💧" },
      { key: "rock", label: "Rock", swatch: "#718096", icon: "🪨" },
      { key: "sand", label: "Sand", swatch: "#d6b56b", icon: "🏜️" },
      { key: "road", label: "Road", swatch: "#6b4f3a", icon: "🛣️" },
    ],
    []
  );

  // Auto-position map: align with window edges (top and left)
  useEffect(() => {
    const el = mapScrollRef.current;
    if (!el) return;

    const timer = setTimeout(() => {
      el.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, 100);

    return () => clearTimeout(timer);
  }, []); // ⬅ no deps: run once when TacticalMap mounts

  // Get cell content (combatant at this position)
  const getCellContent = (x, y) => {
    for (const [id, pos] of Object.entries(positions)) {
      const combatant = combatants.find(c => getCombatantId(c) === id);
      if (combatant) {
        const creatureSize = getCreatureSize(combatant);
        
        // Check if this hex is occupied by this large creature (width only)
        if (x >= pos.x && x < pos.x + creatureSize.width &&
            y >= pos.y && y < pos.y + 1) { // Only 1 hex tall
          return combatant;
        }
      }
    }
    return null;
  };

  // Calculate valid movement cells when movement mode is active
  useEffect(() => {
    // Check if movement mode or current turn changed
    const movementModeChanged = prevMovementModeRef.current !== movementMode;
    const currentTurnChanged = prevCurrentTurnRef.current !== currentTurn;
    
    // Update refs
    prevMovementModeRef.current = movementMode;
    prevCurrentTurnRef.current = currentTurn;
    
    if (movementMode.active && currentTurn && positions[currentTurn]) {
      const combatant = combatants.find(c => getCombatantId(c) === currentTurn);
      if (combatant) {
        const speed = combatant.Spd || combatant.spd || combatant.attributes?.Spd || combatant.attributes?.spd || 10;
        const attacksPerMelee = combatant.attacksPerMelee || 1;
        const position = positions[currentTurn];
        const validPositions = getMovementRange(position, speed, attacksPerMelee, {}, movementMode.isRunning);
        
        // Filter out positions occupied by other combatants
        const filteredMoves = validPositions.filter(move => {
          const occupant = getCellContent(move.x, move.y);
          return !occupant || occupant._id === currentTurn;
        });
        
        setValidMoves(filteredMoves);
        
        // Only clear selection when movement mode is first activated or when turn changes
        if (movementModeChanged || currentTurnChanged) {
          console.log('🔄 Clearing selection due to mode/turn change');
          setSelectedTargetHex(null);
        } else if (selectedTargetHex && !filteredMoves.some(move => move.x === selectedTargetHex.x && move.y === selectedTargetHex.y)) {
          // Clear selection if the selected hex is no longer valid
          console.log('❌ Clearing selection - hex no longer valid');
          setSelectedTargetHex(null);
        }
      }
    } else {
      setValidMoves([]);
      // Only clear selection when movement mode is deactivated
      if (movementModeChanged && !movementMode.active) {
        setSelectedTargetHex(null);
      }
    }
  }, [movementMode, currentTurn, positions]);

  // Clear flashing state when turn changes (only if using internal state)
  useEffect(() => {
    if (currentTurn && !externalFlashingCombatants) {
      // Clear flashing for all combatants when turn changes
      // The new turn's combatant will start fresh (not flashing)
      setInternalFlashingCombatants(new Set());
    }
  }, [currentTurn, externalFlashingCombatants]);

  // Handle cell click with debouncing to prevent performance issues
  const applyMapEditorEdit = useCallback(
    (x, y) => {
      if (mode !== "MAP_EDITOR" || !mapDefinition) return false;

      const prevCell =
        (Array.isArray(mapDefinition.grid) &&
          Array.isArray(mapDefinition.grid?.[y]) &&
          mapDefinition.grid?.[y]?.[x]) ||
        {};

      const prevElevationRaw =
        Number.isFinite(prevCell.elevation)
          ? prevCell.elevation
          : Number.isFinite(prevCell.height)
          ? prevCell.height
          : 0;
      const prevElevation = Number(prevElevationRaw) || 0;

      let nextCell = { ...prevCell };

      if (editorBrushMode === "terrain") {
        const terrainKey = selectedTerrainType || "grass";
        nextCell = {
          ...nextCell,
          terrain: terrainKey,
          terrainType: terrainKey,
        };
      } else if (editorBrushMode === "bucket") {
        // Bucket is handled separately (flood fill) — do nothing here.
        return false;
      } else if (editorBrushMode === "raise" || editorBrushMode === "lower") {
        const step = Number(editorHeightStep) || 1;
        const delta = editorBrushMode === "raise" ? step : -step;
        const nextElevation = prevElevation + delta;
        nextCell = {
          ...nextCell,
          elevation: nextElevation,
          height: nextElevation, // keep 3D builder compatibility
        };
      }

      if (typeof onMapCellEdit === "function") {
        onMapCellEdit(x, y, nextCell);
        return true;
      }

      return false;
    },
    [
      editorBrushMode,
      editorHeightStep,
      mapDefinition,
      mode,
      onMapCellEdit,
      selectedTerrainType,
    ]
  );

  const floodFillTerrain = useCallback(
    (startX, startY) => {
      if (mode !== "MAP_EDITOR" || !mapDefinition) return;
      if (!Array.isArray(mapDefinition.grid)) return;

      const replacement = normalizeEditorTerrainKey(selectedTerrainType || "grass");
      const startCell = mapDefinition.grid?.[startY]?.[startX] || {};
      const target = normalizeEditorTerrainKey(startCell.terrainType || startCell.terrain || mapDefinition.baseTerrain);

      if (!replacement || replacement === target) return;

      const width = mapDefinition.grid?.[0]?.length ?? GRID_CONFIG.GRID_WIDTH;
      const height = mapDefinition.grid?.length ?? GRID_CONFIG.GRID_HEIGHT;

      const inBounds = (x, y) => x >= 0 && y >= 0 && x < width && y < height;

      const getNeighbors = (x, y) => {
        if (effectiveMapType === "square") {
          return [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 },
          ];
        }
        // Hex neighbors for odd-r layout (matches TacticalMap pixel staggering)
        const odd = y & 1;
        const dirs = odd
          ? [
              { dx: +1, dy: 0 },
              { dx: +1, dy: -1 },
              { dx: 0, dy: -1 },
              { dx: -1, dy: 0 },
              { dx: 0, dy: +1 },
              { dx: +1, dy: +1 },
            ]
          : [
              { dx: +1, dy: 0 },
              { dx: 0, dy: -1 },
              { dx: -1, dy: -1 },
              { dx: -1, dy: 0 },
              { dx: -1, dy: +1 },
              { dx: 0, dy: +1 },
            ];
        return dirs.map((d) => ({ x: x + d.dx, y: y + d.dy }));
      };

      const visited = new Set();
      const queue = [{ x: startX, y: startY }];
      const changes = [];

      while (queue.length) {
        const cur = queue.pop();
        if (!cur) break;
        const k = `${cur.x},${cur.y}`;
        if (visited.has(k)) continue;
        visited.add(k);
        if (!inBounds(cur.x, cur.y)) continue;

        const cell = mapDefinition.grid?.[cur.y]?.[cur.x] || {};
        const cellKey = normalizeEditorTerrainKey(cell.terrainType || cell.terrain || mapDefinition.baseTerrain);
        if (cellKey !== target) continue; // border

        changes.push({
          x: cur.x,
          y: cur.y,
          cell: {
            ...cell,
            terrain: replacement,
            terrainType: replacement,
          },
        });

        for (const n of getNeighbors(cur.x, cur.y)) {
          if (!inBounds(n.x, n.y)) continue;
          const nk = `${n.x},${n.y}`;
          if (!visited.has(nk)) queue.push(n);
        }
      }

      if (changes.length === 0) return;

      if (typeof onMapCellsEdit === "function") {
        onMapCellsEdit(changes);
        return;
      }

      if (typeof onMapCellEdit === "function") {
        // Fallback (slower): apply one-by-one
        changes.forEach((c) => onMapCellEdit(c.x, c.y, c.cell));
      }
    },
    [
      effectiveMapType,
      mapDefinition,
      mode,
      onMapCellEdit,
      onMapCellsEdit,
      selectedTerrainType,
    ]
  );

  const handleCellClick = useCallback(
    (x, y) => {
      // Use requestAnimationFrame to defer the execution and prevent blocking
      requestAnimationFrame(() => {
        // MAP_EDITOR mode: paint terrain/elevation and notify parent
        if (mode === "MAP_EDITOR" && mapDefinition) {
          applyMapEditorEdit(x, y);
          // Important: stop here—don't run movement/combatant selection logic in editor mode
          return;
        }

        const combatantAtCell = getCellContent(x, y);

        if (movementMode.active) {
          // In movement mode, check if this is a valid move
          const isValidMove = validMoves.some((move) => move.x === x && move.y === y);
          if (isValidMove) {
            console.log("🎯 Selecting hex:", x, y);
            setSelectedTargetHex({ x, y });
            if (onSelectedHexChange) {
              onSelectedHexChange({ x, y });
            }
          } else {
            console.log("❌ Invalid move to hex:", x, y);
          }
        } else if (combatantAtCell) {
          // Clicking on a combatant selects them for viewing
          const combatantId = getCombatantId(combatantAtCell);
          setSelectedCombatant(combatantId);
          // Notify parent component
          if (onSelectedCombatantChange) {
            onSelectedCombatantChange(combatantId);
          }
        } else {
          // Clicking on empty space clears selection
          setSelectedCombatant(null);
          if (onSelectedCombatantChange) {
            onSelectedCombatantChange(null);
          }
        }
      });
    },
    [
      applyMapEditorEdit,
      getCellContent,
      mapDefinition,
      mode,
      movementMode.active,
      onSelectedCombatantChange,
      onSelectedHexChange,
      validMoves,
    ]
  );

  // Global pointer-up handler so dragging stops even if pointer leaves the SVG
  useEffect(() => {
    const stopPainting = () => {
      isPointerPaintingRef.current = false;
      lastPaintedCellKeyRef.current = null;
    };
    window.addEventListener("pointerup", stopPainting);
    window.addEventListener("pointercancel", stopPainting);
    window.addEventListener("blur", stopPainting);
    return () => {
      window.removeEventListener("pointerup", stopPainting);
      window.removeEventListener("pointercancel", stopPainting);
      window.removeEventListener("blur", stopPainting);
    };
  }, []);

  const handleCellPointerDown = useCallback(
    (col, row, e) => {
      if (mode !== "MAP_EDITOR" || !mapDefinition) {
        // fall back to normal click behavior outside editor mode
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      // Bucket fill is click-only (no drag)
      if (editorBrushMode === "bucket") {
        floodFillTerrain(col, row);
        return;
      }

      isPointerPaintingRef.current = true;
      lastPaintedCellKeyRef.current = null;
      const key = `${col},${row}`;
      lastPaintedCellKeyRef.current = key;
      applyMapEditorEdit(col, row);
    },
    [applyMapEditorEdit, editorBrushMode, floodFillTerrain, mapDefinition, mode]
  );

  const handleCellPointerOver = useCallback(
    (col, row, e) => {
      if (mode !== "MAP_EDITOR" || !mapDefinition) return;
      if (!isPointerPaintingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const key = `${col},${row}`;
      if (lastPaintedCellKeyRef.current === key) return;
      lastPaintedCellKeyRef.current = key;
      applyMapEditorEdit(col, row);
    },
    [applyMapEditorEdit, mapDefinition, mode]
  );

  const handleCellPointerUp = useCallback(() => {
    isPointerPaintingRef.current = false;
    lastPaintedCellKeyRef.current = null;
  }, []);

  // Memoize combatants at position to avoid recalculating on every render
  // Keyed by "x,y" coordinates for efficient lookup
  const combatantsAtPosition = useMemo(() => {
    const map = new Map(); // key: "x,y", value: array of combatants

    // Build map directly from combatant positions (by coordinate)
    for (const c of combatants) {
      if (!c) continue;
      
      // Get position from positions object (keyed by combatant ID)
      const combatantId = getCombatantId(c);
      const pos = positions[combatantId] || c.position;
      
      if (!pos) continue;
      
      const key = `${pos.x},${pos.y}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(c);
    }

    
    return map;
  }, [combatants, positions, mode]);

  // Optimized function to get combatants at position
  const getCombatantsAtPosition = useCallback((x, y) => {
    const key = `${x},${y}`;
    const result = combatantsAtPosition.get(key) || [];
    return result;
  }, [combatantsAtPosition, mode]);

  // Get creature's primary position (top-left corner)
  const getCreaturePrimaryPosition = (combatant) => {
    const key = getCombatantId(combatant);
    if (positions[key]) {
      return positions[key];
    }
    return null;
  };

  // Terrain base colors (fallback when textures not available)
  const terrainColors = {
    OPEN_GROUND: "#9dd66b",      // bright green grass
    LIGHT_FOREST: "#58a65c",     // lighter forest green
    DENSE_FOREST: "#e5e5e5",     // ✅ Grayscale for dense forest (light gray - will be affected by lighting)
    ROCKY_TERRAIN: "#7d7d7d",    // gray rock
    URBAN: "#b9a57f",            // tan stone/brick
    SWAMP_MARSH: "#476a4d",      // murky green-brown
    CAVE_INTERIOR: "#3b3b3b",    // dark gray
    WATER: "#3ba4ff",            // light blue
    INTERIOR: "#666666",        // interior dungeon floor
    // Map-editor palette (lowercase) — keep in sync with editorTerrainPalette keys.
    grass: "#9dd66b",
    forest: "#58a65c",
    rock: "#7d7d7d",
    water: "#3ba4ff",
    sand: "#d6b56b",
    road: "#b9a57f",
    hill: "#7d7d7d",
  };

  // Terrain texture mapping (path to texture images in public/assets/textures/terrain/)
  // Set useTextures to true to enable texture rendering
  const useTextures = true;
  const terrainTextures = {
    OPEN_GROUND: "/assets/textures/terrain/grassland.png",      // Grassland texture
    LIGHT_FOREST: "/assets/textures/terrain/light_forest.png",  // Light forest texture
    DENSE_FOREST: "/assets/textures/terrain/dense_forest.png",  // Dense forest texture
    ROCKY_TERRAIN: "/assets/textures/terrain/rocky.png",       // Rocky terrain texture
    URBAN: "/assets/textures/terrain/urban.png",               // Urban/cobblestone texture
    SWAMP_MARSH: "/assets/textures/terrain/swamp.png",           // Swamp texture
    CAVE_INTERIOR: "/assets/textures/terrain/cave.png",         // Cave interior texture
    WATER: "/assets/textures/terrain/water.png",                // Water texture
    INTERIOR: "/assets/textures/terrain/interior.png",          // Interior floor texture
    // Map-editor palette (lowercase) — map to the closest available texture set.
    grass: "/assets/textures/terrain/grassland.png",
    forest: "/assets/textures/terrain/light_forest.png",
    rock: "/assets/textures/terrain/rocky.png",
    water: "/assets/textures/terrain/water.png",
    sand: "/assets/textures/terrain/grassland.png",
    road: "/assets/textures/terrain/urban.png",
    hill: "/assets/textures/terrain/rocky.png",
  };

  // Generate unique pattern ID for each terrain type to avoid conflicts
  const getTexturePatternId = (terrainType) => {
    return `terrain-pattern-${terrainType?.toLowerCase().replace(/_/g, '-') || 'default'}`;
  };

  // Feature overlay accent colors
  // ✅ For DENSE_FOREST, trees should NOT use feature colors (use terrain grayscale instead)
  const featureColors = {
    ROAD: "#d3c59b",
    TRAIL: "#a37a44",
    WATER: "#3ba4ff",
    WATERFALL: "#1a75ff",
    DEEP_WATER: "#0066cc",
    RIVER: "#1e90ff",
    CLIFF: "#888888",
    STRUCTURE: "#a61b1b",
    BRIDGE: "#8b7355",
    WALL: "#555555",
    TREE: "#1f5c2b",        // Green for light forest
    TREE_LARGE: "#2f5e2f",  // Will be overridden for dense forest
    BOULDER: "#777777",
    HILL: "#9a9a9a",
  };

  // Get cell data from generated scene grid if available
  const getCellDataFromScene = (x, y) => {
    if (terrain?.grid && Array.isArray(terrain.grid)) {
      if (terrain.grid[y] && terrain.grid[y][x]) {
        return terrain.grid[y][x];
      }
    }
    return null;
  };

  // Check if an enemy at a position is visible (fog of war)
  // Enemies are visible through:
  // 1. Visual line of sight (normal detection)
  // 2. Sound detection (in darkness, when close enough to be heard)
  const isEnemyVisible = (x, y, combatant) => {
    if (!combatant || !combatant.isEnemy) return false;
    if (!fogEnabled) return true; // If fog disabled, all enemies visible
    
    // Check if enemy is in visible cells first (visual detection - most accurate)
    if (isCellVisible(x, y)) {
      return true;
    }
    
    // Also check if enemy is within player visibility gradient range (visual fallback)
    if (isWithinPlayerVisibility(x, y)) {
      return true;
    }
    
    // ✅ In pure darkness, check sound detection
    // Get current lighting to determine if we're in pure darkness (no light source)
    const currentLighting = terrain?.lighting || terrain?.lightingData?.name || "";
    const lightingStr = currentLighting ? String(currentLighting).toLowerCase() : "";
    const isPureDarkness = (lightingStr.includes("darkness") || lightingStr.includes("dark")) && 
                           !lightingStr.includes("torchlight") && 
                           !lightingStr.includes("torch") &&
                           !lightingStr.includes("moonlight") && 
                           !lightingStr.includes("moon") &&
                           !lightingStr.includes("bright") && 
                           !lightingStr.includes("daylight");
    
    if (isPureDarkness && combatants && positions) {
      // Find all player positions
      const playerFighters = combatants.filter(c => {
        const key = getCombatantId(c);
        return !c.isEnemy && positions[key];
      });
      
      // Check if enemy is within sound detection range of any player
      for (const player of playerFighters) {
        const playerPos = positions[getCombatantId(player)];
        if (!playerPos) continue;
        
        // Calculate distance in hexes and convert to feet (1 hex = 5 feet typically)
        const hexDistance = calculateDistance(playerPos, { x, y });
        const distanceInFeet = hexDistance * (GRID_CONFIG?.CELL_SIZE || 5);
        
        // Sound detection range in darkness
        // Default: 30-60 feet depending on terrain (echoing caves amplify, muffling terrain reduces)
        // TODO: Use detectBySound() with actual sound detection rolls based on:
        // - Player's hearing ability
        // - Enemy's noise level (armor, movement, failed Prowl)
        // - Environmental modifiers (terrain, weather)
        // - Distance penalties
        // For now, use a simple range check that can be heard in darkness
        
        // Base sound detection range: 30-60 feet for most scenarios
        // Amplifying terrain (caves, stone) increases range
        // Muffling terrain (snow, moss) decreases range
        let baseSoundRange = 40; // Default 40 feet (8 hexes)
        
        // Adjust based on terrain type (simplified - can be enhanced with getSoundModifier)
        const terrainType = terrain?.terrain || terrain?.baseTerrain || "";
        const terrainUpper = terrainType.toUpperCase();
        if (terrainUpper.includes("CAVE") || terrainUpper.includes("STONE")) {
          baseSoundRange = 60; // Echoes amplify sound
        } else if (terrainUpper.includes("SNOW") || terrainUpper.includes("MOSS")) {
          baseSoundRange = 30; // Muffling terrain
        } else if (terrainUpper.includes("FOREST")) {
          baseSoundRange = 35; // Slight muffling
        }
        
        // If enemy is within sound detection range, they can be heard
        // In darkness, sound detection reveals the enemy icon but hex stays dark
        if (distanceInFeet <= baseSoundRange) {
          // TODO: Add actual sound detection roll here using detectBySound(player, enemy, terrain, { distance: distanceInFeet })
          // For now, if within range and in darkness, enemy is detected by sound
          return true; // Sound detection reveals enemy in darkness
        }
      }
    }
    
    // Not visible by any means
    return false;
  };

  // Calculate visibility gradient around a visible enemy
  // Returns a value from 0 (enemy position, white) to 1 (far away, grey)
  const getEnemyVisibilityGradient = (x, y, enemyX, enemyY, maxDistance = 3) => {
    const distance = Math.max(Math.abs(x - enemyX), Math.abs(y - enemyY));
    if (distance === 0) return 0; // Enemy position - fully white
    if (distance > maxDistance) return 1; // Beyond gradient - grey
    
    // Linear gradient from white (0) to grey (1)
    return Math.min(distance / maxDistance, 1);
  };

  // Get cell color based on state and scene data
  const getCellColor = (x, y, combatant) => {
      // Check for visible enemies nearby to apply gradient (even if this cell doesn't have an enemy)
      // Enemies must be within player visibility gradient range
      if (fogEnabled && combatants) {
        const visibleEnemies = combatants.filter(c => {
          const key = getCombatantId(c);
          return c.isEnemy && 
            positions[key] && 
            isWithinPlayerVisibility(positions[key].x, positions[key].y);
        });
      
      if (visibleEnemies.length > 0) {
        let minGradient = 1; // Start with grey
        
        // Calculate gradient from each visible enemy
          visibleEnemies.forEach(enemy => {
            const enemyPos = positions[getCombatantId(enemy)];
          if (enemyPos) {
            const gradient = getEnemyVisibilityGradient(x, y, enemyPos.x, enemyPos.y, 3);
            minGradient = Math.min(minGradient, gradient);
          }
        });
        
        // If we're within gradient range of a visible enemy, apply the gradient color
        // Note: This gradient is applied to empty cells near visible enemies (Priority 1.5)
        // Actual enemy cell coloring is handled in Priority 1 (combatant coloring)
        // The gradient calculation here is for empty cells only, not enemy cells themselves
      }
    }
    
    // Priority 1: Combatant coloring (highest priority)
    if (combatant) {
      // Check if character is defeated (HP <= 0)
      if (combatant.currentHP <= 0) {
        return "#ffffff"; // White for defeated characters
      }
      
      // Enemy visibility check
      if (combatant.isEnemy) {
        const enemyVisible = isEnemyVisible(x, y, combatant);
        
        // Get current lighting to determine if we're in pure darkness (no light source)
        const currentLighting = terrain?.lighting || terrain?.lightingData?.name || "";
        const lightingStr = currentLighting ? String(currentLighting).toLowerCase() : "";
        const isPureDarkness = (lightingStr.includes("darkness") || lightingStr.includes("dark")) && 
                               !lightingStr.includes("torchlight") && 
                               !lightingStr.includes("torch") &&
                               !lightingStr.includes("moonlight") && 
                               !lightingStr.includes("moon") &&
                               !lightingStr.includes("bright") && 
                               !lightingStr.includes("daylight");
        
        if (enemyVisible) {
          // ✅ In pure darkness, enemies detected by sound should keep dark grey hex color
          // The icon will still be rendered (handled in rendering code), but hex stays dark
          if (isPureDarkness) {
            const wasExplored = isCellExplored(x, y);
            // Keep dark grey color even for visible enemy in darkness (sound detection)
            return wasExplored ? "#6b7280" : "#4b5563";
          }
          
          // With light sources or daylight, enemy position cell is white
          return "#ffffff"; // White for visible enemy position (when not in pure darkness)
        } else {
          // Enemy is not visible - match fog of war color
          const wasExplored = isCellExplored(x, y);
          const isDaylight = lightingStr.includes("bright") || lightingStr.includes("daylight");
          
          // Match fog of war color based on lighting severity
          if (lightingStr.includes("darkness") || lightingStr.includes("dark")) {
            // Darkness: darker grey (same as fog Priority 7)
            return wasExplored ? "#6b7280" : "#4b5563";
          } else if (lightingStr.includes("torchlight") || lightingStr.includes("torch")) {
            // Torchlight: medium grey
            return wasExplored ? "#9ca3af" : "#6b7280";
          } else if (lightingStr.includes("moonlight") || lightingStr.includes("moon")) {
            // Moonlight: lighter grey
            return wasExplored ? "#d1d5db" : "#9ca3af";
          } else if (isDaylight) {
            // Bright daylight: very light grey (but NOT white)
            return wasExplored ? "#e5e7eb" : "#d1d5db";
          } else {
            // Default: medium grey
            return wasExplored ? "#9ca3af" : "#6b7280";
          }
        }
      }
      
      // Player characters
      if (getCombatantId(combatant) === selectedCombatant) {
        return "#60a5fa"; // Light blue
      }
      if (getCombatantId(combatant) === currentTurn) {
        return "#4ade80"; // Light green
      }
      return "#22d3ee"; // Light cyan for players
    }
    
    // Priority 1.5: Apply enemy visibility gradient to empty cells near visible enemies
    // Only enemies within player visibility gradient are considered
    // ✅ In pure darkness, don't apply gradient (enemies detected by sound keep dark hexes)
    if (fogEnabled && combatants) {
      // Get current lighting to check if we're in pure darkness
      const currentLighting = terrain?.lighting || terrain?.lightingData?.name || "";
      const lightingStr = currentLighting ? String(currentLighting).toLowerCase() : "";
      const isPureDarkness = (lightingStr.includes("darkness") || lightingStr.includes("dark")) && 
                             !lightingStr.includes("torchlight") && 
                             !lightingStr.includes("torch") &&
                             !lightingStr.includes("moonlight") && 
                             !lightingStr.includes("moon") &&
                             !lightingStr.includes("bright") && 
                             !lightingStr.includes("daylight");
      
      // Skip gradient in pure darkness (sound detection keeps hexes dark)
      if (!isPureDarkness) {
        const visibleEnemies = combatants.filter(c => {
          const key = getCombatantId(c);
          return c.isEnemy && 
            positions[key] && 
            isWithinPlayerVisibility(positions[key].x, positions[key].y);
        });
        
        if (visibleEnemies.length > 0) {
          let minGradient = 1;
          
          visibleEnemies.forEach(enemy => {
            const enemyPos = positions[getCombatantId(enemy)];
            if (enemyPos) {
              const gradient = getEnemyVisibilityGradient(x, y, enemyPos.x, enemyPos.y, 3);
              minGradient = Math.min(minGradient, gradient);
            }
          });
          
          // Apply gradient color to cells near visible enemies
          if (minGradient < 1) {
            const greyValue = Math.floor(229 + (minGradient * 26)); // 229 to 255
            return `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
          }
        }
      }
    }

    // Priority 2: Selected target hex (in movement mode)
    if (selectedTargetHex && selectedTargetHex.x === x && selectedTargetHex.y === y) {
      return "#86efac"; // Bright green for selected target
    }

    // Priority 3: Valid move (in movement mode) - use color-coded movement ranges
    const validMove = validMoves.find(move => move.x === x && move.y === y);
    if (validMove) {
      // Color-coded movement ranges based on action cost
      switch (validMove.color) {
        case 'green':
          return "#dcfce7"; // Light green - 1 action (15 seconds)
        case 'yellow':
          return "#fef3c7"; // Light yellow - 2 actions (30 seconds)
        case 'orange':
          return "#fed7aa"; // Light orange - 3 actions (45 seconds)
        case 'red':
          return "#fecaca"; // Light red - 4 actions (60 seconds)
        default:
          return "#dcfce7"; // Default to green
      }
    }

    // Priority 4: Check if hovered
    if (hoveredCell && hoveredCell.x === x && hoveredCell.y === y) {
      return "#f1f5f9"; // Light gray
    }

    // Priority 5: Use scene-generated terrain colors (if available)
    // But respect fog of war - visible cells show terrain, non-visible show fog colors
    const cellData = getCellDataFromScene(x, y);
    if (cellData) {
      // Get current lighting
      const currentLighting = terrain?.lighting || terrain?.lightingData?.name || "";
      const lightingStr = currentLighting ? String(currentLighting).toLowerCase() : "";
      const isDaylight = lightingStr.includes("bright") || lightingStr.includes("daylight");
      
      // In bright daylight with fog, visible cells show terrain colors, non-visible are white
      // In non-daylight with fog, non-visible cells should be greyed (handled in Priority 7)
      if (fogEnabled && !isCellVisible(x, y) && !isDaylight) {
        // Skip terrain colors for non-visible cells in non-daylight (let Priority 7 handle grey)
        // Fall through to Priority 7
      } else {
        // Visible cells or daylight: use terrain colors
        // ✅ For dense forest, NEVER use feature colors for trees (always use terrain grayscale)
        if (terrain?.baseTerrain === "DENSE_FOREST" && 
            (cellData.feature === "TREE" || cellData.feature === "TREE_LARGE")) {
          // Skip feature color, use terrain color for dense forest trees
          if (cellData.terrainType && terrainColors[cellData.terrainType]) {
            return terrainColors[cellData.terrainType];
          }
          return terrainColors[terrain?.baseTerrain] || "#e5e5e5";
        }
        // Normal logic: feature color > terrain type > base terrain
        if (cellData.feature && featureColors[cellData.feature]) {
          return featureColors[cellData.feature];
        }
        if (cellData.terrainType && terrainColors[cellData.terrainType]) {
          return terrainColors[cellData.terrainType];
        }
      }
    }

    // Priority 6: Use base terrain color if available
    // But respect fog of war - visible cells show terrain, non-visible show fog colors
    if (terrain?.baseTerrain && terrainColors[terrain.baseTerrain]) {
      // Get current lighting
      const currentLighting = terrain?.lighting || terrain?.lightingData?.name || "";
      const lightingStr = currentLighting ? String(currentLighting).toLowerCase() : "";
      const isDaylight = lightingStr.includes("bright") || lightingStr.includes("daylight");
      
      // In bright daylight with fog, visible cells show terrain colors, non-visible are white
      // In non-daylight with fog, non-visible cells should be greyed (handled in Priority 7)
      if (fogEnabled && !isCellVisible(x, y) && !isDaylight) {
        // Skip terrain colors for non-visible cells in non-daylight (let Priority 7 handle grey)
        // Fall through to Priority 7
      } else {
        // Visible cells or daylight: use base terrain color
        return terrainColors[terrain.baseTerrain];
      }
    }

    // ✅ Priority 7: Fog of War - Grey ALL non-visible cells (regardless of lighting)
    // ✅ CRITICAL: No white hexes beyond line of sight - ALL non-visible cells must be greyed
    // IMPORTANT: Uses isCellVisible() as source of truth (from LOS calculation)
    if (fogEnabled) {
      // ✅ Source of truth: isCellVisible uses visibleCells array from LOS calculation
      const isVisible = isCellVisible(x, y);
      if (!isVisible) {
        // ✅ CRITICAL: ALL non-visible cells must be greyed, regardless of lighting
        // Even in bright daylight, cells beyond LOS should NOT be white
        const currentLighting = terrain?.lighting || terrain?.lightingData?.name || "";
        const lightingStr = currentLighting ? String(currentLighting).toLowerCase() : "";
        const wasExplored = isCellExplored(x, y);
        const isDaylight = lightingStr.includes("bright") || lightingStr.includes("daylight");
        
        // Determine grey level based on lighting severity
        // In bright daylight, use very light grey (but still grey, NOT white)
        let greyColor;
        if (lightingStr.includes("darkness") || lightingStr.includes("dark")) {
          // Darkness: darker grey
          greyColor = wasExplored ? "#6b7280" : "#4b5563"; // Darker grey for darkness
        } else if (lightingStr.includes("torchlight") || lightingStr.includes("torch")) {
          // Torchlight: medium grey
          greyColor = wasExplored ? "#9ca3af" : "#6b7280";
        } else if (lightingStr.includes("moonlight") || lightingStr.includes("moon")) {
          // Moonlight: lighter grey
          greyColor = wasExplored ? "#d1d5db" : "#9ca3af";
        } else if (isDaylight) {
          // ✅ Bright daylight: very light grey (but NOT white) for non-visible cells
          greyColor = wasExplored ? "#e5e7eb" : "#d1d5db"; // Very light grey, but still grey
        } else {
          // Default: medium grey for other conditions
          greyColor = wasExplored ? "#9ca3af" : "#6b7280";
        }
        
        return greyColor;
      }
    }

    // Default: White background (ONLY for visible cells when fog enabled, or all cells when fog disabled)
    return "#ffffff";
  };

  // Get lighting filter color and opacity
  const getLightingFilter = (lighting) => {
    if (!lighting) return { color: "transparent", opacity: 0 };
    
    const lightingStr = String(lighting).toLowerCase();
    
    if (lightingStr.includes("moonlight") || lightingStr.includes("moon")) {
      return { color: "rgba(0,0,80,0.6)", opacity: 0.3 };
    }
    if (lightingStr.includes("torchlight") || lightingStr.includes("torch")) {
      return { color: "rgba(255,140,0,0.6)", opacity: 0.25 };
    }
    if (lightingStr.includes("darkness") || lightingStr.includes("dark")) {
      return { color: "rgba(0,0,0,0.8)", opacity: 0.6 };
    }
    
    return { color: "transparent", opacity: 0 };
  };

  // Calculate distance to hovered cell
  const getHoveredDistance = () => {
    if (hoveredCell && selectedCombatant && positions[selectedCombatant]) {
      const distance = calculateDistance(positions[selectedCombatant], hoveredCell);
      return Math.round(distance);
    }
    return null;
  };

  // Calculate hex pixel position (proper flat-top hex tessellation)
  // Uses correct 2D version matching 3D world space math
  function getHexPixelPosition(col, row) {
    const x = HEX_WIDTH * (col + 0.5 * (row & 1));
    const y = HEX_VERTICAL_SPACING * row;
    return { x, y };
  }

  // Generate hex points for SVG polygon (flat-top orientation)
  // Exact flat-top hex shape matching 3D geometry
  const hexPoints = (cx, cy) => {
    const r = HEX_RADIUS;
    const w = Math.sqrt(3) * r;

    return [
      [cx + w/2, cy + r/2],
      [cx,       cy + r],
      [cx - w/2, cy + r/2],
      [cx - w/2, cy - r/2],
      [cx,       cy - r],
      [cx + w/2, cy - r/2],
    ];
  };

  // Get hex points as formatted string for SVG polygon
  const getHexPoints = (centerX, centerY) => {
    return hexPoints(centerX, centerY).map(p => p.join(",")).join(" ");
  };

  // Get cell shape points based on map type
  // Returns string format for polygon points attribute
  const getCellShape = (centerX, centerY) => {
    if (effectiveMapType === "square") {
      // ✅ Square cells: use HEX_SIZE * 2 as the cell size (matches getCellPixelPosition)
      const squareCellSize = GRID_CONFIG.HEX_SIZE * 2;
      const halfSize = squareCellSize / 2;
      // Return as string: "x1,y1 x2,y2 x3,y3 x4,y4" (clockwise from top-left)
      return `${centerX - halfSize},${centerY - halfSize} ${centerX + halfSize},${centerY - halfSize} ${centerX + halfSize},${centerY + halfSize} ${centerX - halfSize},${centerY + halfSize}`;
    } else {
      // Return hex shape (already returns string)
      return getHexPoints(centerX, centerY);
    }
  };

  // Get pixel position based on map type
  const getCellPixelPosition = (col, row) => {
    if (effectiveMapType === "square") {
      const size = GRID_CONFIG.HEX_SIZE * 2;
      const x = col * size;
      const y = row * size;
      return { x, y };
    } else {
      return getHexPixelPosition(col, row);
    }
  };

  // Generate terrain obstacles for LOS calculations
  const terrainObstacles = useMemo(() => {
    if (!terrain || !terrain.terrain) return [];
    
    const obstacles = [];
    const terrainType = terrain.terrain;
    
    // Generate obstacles based on terrain type
    if (terrainType === 'DENSE_FOREST' || terrainType === 'LIGHT_FOREST') {
      // Place trees randomly (every 3-5 hexes)
      for (let row = 2; row < GRID_CONFIG.GRID_HEIGHT - 2; row += 4) {
        for (let col = 2; col < GRID_CONFIG.GRID_WIDTH - 2; col += 4) {
          if (Math.random() > 0.5) {
            obstacles.push({ 
              x: col + Math.floor(Math.random() * 2) - 1, 
              y: row + Math.floor(Math.random() * 2) - 1,
              type: 'tree',
              name: 'Tree'
            });
          }
        }
      }
    } else if (terrainType === 'ROCKY_TERRAIN') {
      // Place rocks
      for (let row = 2; row < GRID_CONFIG.GRID_HEIGHT - 2; row += 3) {
        for (let col = 2; col < GRID_CONFIG.GRID_WIDTH - 2; col += 3) {
          if (Math.random() > 0.5) {
            obstacles.push({ 
              x: col, 
              y: row,
              type: 'rock',
              name: 'Rock'
            });
          }
        }
      }
    }
    
    return obstacles;
  }, [terrain, GRID_CONFIG.GRID_WIDTH, GRID_CONFIG.GRID_HEIGHT]);

  // Get terrain icon for a hex
  const getTerrainIcon = (col, row) => {
    const obstacle = terrainObstacles.find(obs => obs.x === col && obs.y === row);
    if (!obstacle) return null;
    
    switch (obstacle.type) {
      case 'tree':
        return '🌲';
      case 'rock':
        return '🪨';
      default:
        return null;
    }
  };

  // Create fast lookup for visible cells (for fog of war)
  const visibleCellsLookup = useMemo(() => {
    if (!fogEnabled || !visibleCells || visibleCells.length === 0) {
      return new Set(); // All cells visible if fog disabled
    }
    return new Set(visibleCells.map(cell => `${cell.x}-${cell.y}`));
  }, [visibleCells, fogEnabled]);

  // Create fast lookup for explored cells (memory)
  const exploredCellsLookup = useMemo(() => {
    if (!fogEnabled || !exploredCells || exploredCells.length === 0) {
      return new Set();
    }
    return new Set(exploredCells.map(cell => `${cell.x}-${cell.y}`));
  }, [exploredCells, fogEnabled]);

  // Check if a cell is visible (for fog of war)
  const isCellVisible = (x, y) => {
    if (!fogEnabled) return true; // No fog = all visible
    return visibleCellsLookup.has(`${x}-${y}`);
  };

  // Check if a cell is explored (previously seen, memory)
  const isCellExplored = (x, y) => {
    if (!fogEnabled) return false;
    return exploredCellsLookup.has(`${x}-${y}`);
  };

  // Get visibility range in hexes based on lighting and scene setup
  const getVisibilityRangeHexes = () => {
    // If Phase0PreCombatModal passed a numeric range, use it directly
    if (visibilityRange && visibilityRange > 0 && !Number.isNaN(visibilityRange)) {
      // Each hex = 5 feet (GRID_CONFIG.CELL_SIZE)
      const cellSize = GRID_CONFIG?.CELL_SIZE || 5;
      return Math.max(1, Math.floor(visibilityRange / cellSize));
    }
    
    // Fallback to lighting keyword estimation
    const lightingStr = terrain?.lighting ? String(terrain.lighting).toLowerCase() : "";
    if (lightingStr.includes("darkness") || lightingStr.includes("dark")) return 1;
    if (lightingStr.includes("torchlight") || lightingStr.includes("torch")) return 6;
    if (lightingStr.includes("moonlight") || lightingStr.includes("moon")) return 9;
    if (lightingStr.includes("bright") || lightingStr.includes("daylight")) return 999;
    
    return 6; // Default visibility range
  };

  // Calculate player visibility gradient
  // Returns 0 (at player position, transparent) to 1 (far away, full fog)
  // Now uses lighting-based visibility range from scene setup
  const getPlayerVisibilityGradient = (x, y) => {
    if (!fogEnabled || !combatants || !positions) return 1;
    
    // Get visibility range based on current lighting and scene setup
    const maxDistance = getVisibilityRangeHexes();
    
    // Bright daylight = completely transparent everywhere
    if (maxDistance >= 999) {
      return 0; // Completely transparent in daylight
    }
    
    // Find all player positions
    const playerFighters = combatants.filter(c => {
      const key = getCombatantId(c);
      return !c.isEnemy && positions[key];
    });
    if (playerFighters.length === 0) return 1;
    
    let minDistance = Infinity;
    
    // Calculate distance to nearest player
    playerFighters.forEach(player => {
      const playerPos = positions[getCombatantId(player)];
      if (playerPos) {
        const distance = Math.max(Math.abs(x - playerPos.x), Math.abs(y - playerPos.y));
        minDistance = Math.min(minDistance, distance);
      }
    });
    
    if (minDistance === 0) return 0; // At player position - fully transparent
    if (minDistance > maxDistance) return 1; // Beyond gradient range - full fog
    
    // Linear gradient from transparent (0) to fog (1)
    // For darkness (maxDistance = 1), only adjacent hexes are visible
    return Math.min(minDistance / maxDistance, 1);
  };

  // Check if a cell is within player visibility range (for enemy visibility)
  const isWithinPlayerVisibility = (x, y) => {
    if (!fogEnabled) return true; // If fog disabled, all visible
    if (!combatants || !positions) return false;
    
    // Get visibility range based on current lighting and scene setup
    const maxDistance = getVisibilityRangeHexes();
    
    // Bright daylight = all visible
    const lightingStr = terrain?.lighting ? String(terrain.lighting).toLowerCase() : "";
    if (lightingStr.includes("bright") || lightingStr.includes("daylight") || maxDistance >= 999) {
      return true; // All enemies visible in daylight
    }
    
    // Find all player positions
    const playerFighters = combatants.filter(c => {
      const key = getCombatantId(c);
      return !c.isEnemy && positions[key];
    });
    if (playerFighters.length === 0) return false;
    
    // Check if cell is within range of any player
    for (const player of playerFighters) {
      const playerPos = positions[getCombatantId(player)];
      if (playerPos) {
        const distance = Math.max(Math.abs(x - playerPos.x), Math.abs(y - playerPos.y));
        if (distance <= maxDistance) {
          return true; // Within range of at least one player
        }
      }
    }
    
    return false; // Beyond all player visibility ranges
  };

  // Get lighting bonus/penalty from terrain system
  const getLightingModifier = (lighting) => {
    // Try to get from terrain.lightingData first
    if (terrain?.lightingData?.visibilityBonus !== undefined) {
      return terrain.lightingData.visibilityBonus;
    }
    
    // Fallback: try to get from LIGHTING_CONDITIONS if we have lighting name
    if (lighting || terrain?.lighting) {
      const lightingKey = String(lighting || terrain.lighting).toUpperCase().replace(/\s+/g, '_');
      // Import LIGHTING_CONDITIONS if available, otherwise use fallback values
      const lightingConditions = {
        BRIGHT_DAYLIGHT: { visibilityBonus: 0 },
        MOONLIGHT: { visibilityBonus: -10 },
        TORCHLIGHT: { visibilityBonus: -15 },
        DARKNESS: { visibilityBonus: -50 },
      };
      
      const lightingData = lightingConditions[lightingKey];
      if (lightingData) {
        return lightingData.visibilityBonus;
      }
    }
    
    return 0;
  };

  // Get fog opacity based on lighting, visibility, and exploration state
  // Now uses lighting bonuses/penalties from scene setup to control grey level
  // IMPORTANT: Uses isCellVisible() as source of truth (from LOS calculation), not gradient
  const getFogOpacity = (col, row, lighting) => {
    if (!fogEnabled) return 0;
    
    // ✅ Source of truth: isCellVisible uses visibleCells array from LOS calculation
    const isVisible = isCellVisible(col, row);
    if (isVisible) return 0; // No fog on visible cells (LOS confirmed)

    // Get lighting from terrain or parameter
    const currentLighting = lighting || terrain?.lighting || terrain?.lightingData?.name;
    const lightingStr = currentLighting ? String(currentLighting).toLowerCase() : "";
    
    // Bright daylight = completely transparent (no fog)
    if (lightingStr.includes("bright") || lightingStr.includes("daylight")) {
      return 0; // Completely transparent in daylight
    }

    // Calculate gradient based on distance from players (for gradual fog falloff)
    // Note: This is only for visual fog opacity, NOT for determining visibility
    // Visibility is determined by LOS (isCellVisible above)
    const playerGradient = getPlayerVisibilityGradient(col, row);
    
    // If in daylight mode (playerGradient is 0), return 0 (already handled above, but double-check)
    if (playerGradient === 0 && lightingStr.includes("bright")) {
      return 0;
    }
    
    // Get lighting modifier from scene setup (visibilityBonus percentage)
    const visibilityModifier = getLightingModifier(currentLighting);
    
    // Convert visibility bonus percentage to fog opacity percentage
    // visibilityBonus is shown in UI as percentage (e.g., -50% = -50)
    // Directly map visibility penalty to fog opacity:
    // -50% visibility = 50% fog opacity (0.5)
    // -15% visibility = 15% fog opacity (0.15)
    // -10% visibility = 10% fog opacity (0.10)
    // 0% visibility = 0% fog opacity (0) - completely transparent
    
    let baseOpacity = 0;
    
    if (visibilityModifier < 0) {
      // Convert negative visibility bonus percentage directly to fog opacity percentage
      // -50% visibility penalty = 50% fog opacity
      // -10% visibility penalty = 10% fog opacity
      const fogPercentage = Math.abs(visibilityModifier) / 100; // Convert percentage to 0-1 scale
      baseOpacity = Math.min(fogPercentage, 0.95); // Cap at 95% max fog
    } else {
      // Positive or zero bonus = no fog (completely transparent)
      baseOpacity = 0;
    }

    // Ensure baseOpacity is not zero for non-daylight conditions
    // If we have a lighting penalty but baseOpacity is still 0, set minimum fog
    if (baseOpacity === 0 && visibilityModifier < 0) {
      // Fallback: minimum fog based on lighting string detection
      if (lightingStr.includes("darkness") || lightingStr.includes("dark")) {
        baseOpacity = 0.5; // 50% fog for darkness
      } else if (lightingStr.includes("torchlight") || lightingStr.includes("torch")) {
        baseOpacity = 0.15; // 15% fog for torchlight
      } else if (lightingStr.includes("moonlight") || lightingStr.includes("moon")) {
        baseOpacity = 0.10; // 10% fog for moonlight
      }
    }

    // Apply terrain density and visibility modifiers (optional visual realism)
    // Higher density increases fog opacity, lower visibility modifier increases fog
    if (terrain?.terrainData) {
      const terrainVisibility = terrain.terrainData.visibilityModifier || 1.0;
      const density = terrain.terrainData.density || 0.5;
      
      // Higher density makes fog thicker, lower visibility makes fog thicker
      // Formula: fog gets thicker when density is high OR visibility is low
      const terrainFogMultiplier = Math.min(1.0, (density * 1.2) / Math.max(0.3, terrainVisibility));
      baseOpacity *= terrainFogMultiplier;
      
      // Clamp to reasonable range
      baseOpacity = Math.min(baseOpacity, 0.95);
    }

    // Check if cell is in explored memory
    const wasExplored = isCellExplored(col, row);
    if (wasExplored) {
      // Explored cells have reduced fog (half opacity), but still affected by player gradient
      const exploredOpacity = baseOpacity * 0.5;
      // For explored cells, ensure we still have some fog (don't multiply by gradient if it would eliminate fog)
      return Math.max(exploredOpacity * playerGradient, exploredOpacity * 0.3);
    }

    // Unexplored cell - apply gradient from players with base opacity
    // Ensure minimum fog is maintained for non-visible cells (don't let gradient remove all fog)
    const finalOpacity = baseOpacity * playerGradient;
    
    // For darkness, ensure we have fog even if gradient would reduce it too much
    if (lightingStr.includes("darkness") || lightingStr.includes("dark")) {
      return Math.max(finalOpacity, baseOpacity * 0.5); // Minimum 50% of base fog
    }
    
    return finalOpacity;
  };

  // Generate SVG pattern definitions for terrain textures
  const texturePatterns = useMemo(() => {
    if (!useTextures) return null;
    
    // Hex dimensions: width is 2 * size, height is size * sqrt(3) for flat-top hex
    // Pattern scaling uses GRID_CONFIG.HEX_SIZE internally
    
    // Pattern should extend significantly beyond hex bounding box to ensure full coverage of hex edges
    // Use patternContentUnits="objectBoundingBox" so each hex gets its own properly scaled texture
    // Extend pattern asymmetrically - much more on right side to cover the gap
    // Left side fits, but right side and bottom-right need significant extension
    const extendLeft = 0.05; // Small extension on left (already fits)
    const extendRight = 0.75; // Very large extension on right (covers the gap)
    const extendTop = 0.10; // Small extension on top
    const extendBottom = 0.30; // Larger extension on bottom (for bottom-right corner)
    const patternX = -extendLeft; // Start before left edge
    const patternY = -extendTop;
    const patternWidth = 1 + extendLeft + extendRight; // Extend more on right
    const patternHeight = 1 + extendTop + extendBottom; // Extend more on bottom
    
    // Use Map to deduplicate patterns by patternId (same texture path = same pattern)
    // This prevents duplicate keys when WATER and water both map to the same texture
    const patternMap = new Map();
    
    Object.entries(terrainTextures).forEach(([terrainType, texturePath]) => {
      const patternId = getTexturePatternId(terrainType);
      
      // Only create pattern if we haven't seen this patternId yet
      if (!patternMap.has(patternId)) {
        // Texture-specific adjustments
        // Dense forest needs to be shifted left
        let imageX = patternX;
        if (terrainType === "DENSE_FOREST") {
          imageX = patternX - 0.15; // Shift dense forest texture 15% further left
        }
        
        patternMap.set(patternId, {
          patternId,
          texturePath,
          imageX,
        });
      }
    });
    
    // Convert map to array of pattern elements with unique keys
    return Array.from(patternMap.entries()).map(([patternId, config]) => (
      <pattern
        key={patternId}
        id={patternId}
        patternUnits="objectBoundingBox"
        x={patternX}
        y={patternY}
        width={patternWidth}
        height={patternHeight}
        patternContentUnits="objectBoundingBox"
      >
        <image
          href={config.texturePath}
          x={config.imageX}
          y={patternY}
          width={patternWidth}
          height={patternHeight}
          preserveAspectRatio="none"
        />
      </pattern>
    ));
  }, [useTextures]);

  // Helper to get fill for cell (texture pattern or solid color)
  const getCellFill = (terrainType, fallbackColor) => {
    if (!useTextures || !terrainType) {
      return fallbackColor || "#ffffff";
    }
    
    const texturePath = terrainTextures[terrainType];
    if (texturePath) {
      // Return pattern URL - check if texture exists, fallback to color
      const patternId = getTexturePatternId(terrainType);
      return `url(#${patternId})`;
    }
    
    return fallbackColor || terrainColors[terrainType] || "#ffffff";
  };

  // Helper to check if a cell is inside map bounds (rectangular grid)
  const isWithinHexBoundary = (col, row) => {
    return (
      col >= 0 &&
      col < GRID_CONFIG.GRID_WIDTH &&
      row >= 0 &&
      row < GRID_CONFIG.GRID_HEIGHT
    );
  };

  // Memoize grid rendering to prevent unnecessary re-renders (supports both hex and square)
  const gridCells = useMemo(() => {
    const cells = [];
    const size = GRID_CONFIG.HEX_SIZE;
    
    for (let row = 0; row < GRID_CONFIG.GRID_HEIGHT; row++) {
      for (let col = 0; col < GRID_CONFIG.GRID_WIDTH; col++) {
        // Skip cells outside rectangular map bounds
        if (!isWithinHexBoundary(col, row)) continue;
        
        const combatantsAtPos = getCombatantsAtPosition(col, row);
        
        // ✅ Priority 0: Determine fill color from terrain grid data
        const cellData = getCellDataFromScene(col, row);
        let baseTerrainColor;
        if (cellData) {
          // ✅ For dense forest, skip feature colors for trees (use terrain color instead)
          if (terrain?.baseTerrain === "DENSE_FOREST" && 
              (cellData.feature === "TREE" || cellData.feature === "TREE_LARGE")) {
            // Use terrain color, not tree feature color (to avoid dark green)
            baseTerrainColor = terrainColors[cellData.terrainType] ||
                              terrainColors[terrain?.baseTerrain] ||
                              "#e5e5e5";
          } else {
            // Normal logic: feature color > terrain type > base terrain
            baseTerrainColor = featureColors[cellData.feature] ||
                              terrainColors[cellData.terrainType] ||
                              terrainColors[terrain?.baseTerrain] ||
                              "#cccccc";
          }
        } else {
          baseTerrainColor = terrainColors[terrain?.baseTerrain] || "#cccccc";
        }
        
        const { x, y } = getCellPixelPosition(col, row);
        // ✅ For squares: x,y is top-left corner, center is x + cellWidth/2, y + cellHeight/2
        // ✅ For hexes: x,y is already the center position (from getHexPixelPosition)
        const squareCellSize = GRID_CONFIG.HEX_SIZE * 2; // Square cells are HEX_SIZE * 2 pixels
        let centerX, centerY;
        if (effectiveMapType === "square") {
          centerX = x + squareCellSize / 2;
          centerY = y + squareCellSize / 2;
        } else {
          // Hex: x,y is already the center position from getHexPixelPosition
          centerX = x;
          centerY = y;
        }
        const terrainIcon = getTerrainIcon(col, row);
        const cellPoints = getCellShape(centerX, centerY);
        
        // Fog of war visibility check
        const cellVisible = isCellVisible(col, row);
        const fogOpacity = getFogOpacity(col, row, terrain?.lighting);
        
        // Determine terrain type for texture selection (cellData already defined above)
        const terrainType = cellData?.terrainType || terrain?.baseTerrain;
        
        // Check if this is a movement color cell (valid move)
        const validMove = validMoves.find(move => move.x === col && move.y === row);
        const isMovementColorCell = validMove || (selectedTargetHex && selectedTargetHex.x === col && selectedTargetHex.y === row);
        
        // Base fill color (texture or terrain color, without movement colors)
        const baseCellColor = getCellColor(col, row, combatantsAtPos[0]);
        // Remove movement colors from base color calculation for texture layer
        const baseFillColor = isMovementColorCell 
          ? getCellFill(terrainType, baseTerrainColor) // Use terrain color/texture for base
          : getCellFill(terrainType, baseCellColor);
        
        // Movement color overlay (will be rendered on top)
        let movementOverlayColor = null;
        if (isMovementColorCell) {
          if (selectedTargetHex && selectedTargetHex.x === col && selectedTargetHex.y === row) {
            movementOverlayColor = "#86efac"; // Bright green for selected target
          } else if (validMove) {
            switch (validMove.color) {
              case 'green':
                movementOverlayColor = "#dcfce7"; // Light green - 1 action
                break;
              case 'yellow':
                movementOverlayColor = "#fef3c7"; // Light yellow - 2 actions
                break;
              case 'orange':
                movementOverlayColor = "#fed7aa"; // Light orange - 3 actions
                break;
              case 'red':
                movementOverlayColor = "#fecaca"; // Light red - 4 actions
                break;
              default:
                movementOverlayColor = "#dcfce7"; // Default to green
            }
          }
        }
        
        cells.push(
          <g key={`${col}-${row}`}>
            {/* Cell shape (hex or square) - Base layer with texture */}
            <Tooltip
              label={
                combatantsAtPos.length > 0
                  ? combatantsAtPos
                      .filter(c => {
                        // Hide enemy names in tooltip if they're not visible (darkness/fog)
                        if (c.isEnemy && fogEnabled) {
                          return isEnemyVisible(col, row, c);
                        }
                        return true; // Always show player names
                      })
                      .map(c => `${c.name} ${c.isEnemy ? '(Enemy)' : '(Ally)'}`).join(', ') || 
                    (terrainIcon 
                      ? `${terrainIcon} Obstacle - Blocks Line of Sight` 
                      : `(${col}, ${row}) - ${col * GRID_CONFIG.CELL_SIZE}ft, ${row * GRID_CONFIG.CELL_SIZE}ft`)
                  : terrainIcon 
                    ? `${terrainIcon} Obstacle - Blocks Line of Sight` 
                    : `(${col}, ${row}) - ${col * GRID_CONFIG.CELL_SIZE}ft, ${row * GRID_CONFIG.CELL_SIZE}ft`
              }
              placement="top"
            >
              {/* ✅ Render cell based on mapType - Square uses rect, Hex uses polygon */}
              {effectiveMapType === "square" ? (
                <rect
                  x={x}
                  y={y}
                  width={GRID_CONFIG.HEX_SIZE * 2}
                  height={GRID_CONFIG.HEX_SIZE * 2}
                  fill={baseFillColor}
                  fillOpacity={0.4} // Semi-transparent to show 3D background
                  stroke={hoveredCell?.x === col && hoveredCell?.y === row ? "#2563eb" : "#64748b"}
                  strokeWidth={hoveredCell?.x === col && hoveredCell?.y === row ? "3" : "1.5"}
                  style={{ cursor: selectedCombatant ? "pointer" : "default" }}
                  onClick={() => handleCellClick(col, row)}
                  onPointerDown={(e) => handleCellPointerDown(col, row, e)}
                  onPointerOver={(e) => handleCellPointerOver(col, row, e)}
                  onPointerUp={handleCellPointerUp}
                  onMouseEnter={() => {
                    setHoveredCell({ x: col, y: row });
                    if (onHoveredCellChange) {
                      onHoveredCellChange({ x: col, y: row });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredCell(null);
                    if (onHoveredCellChange) {
                      onHoveredCellChange(null);
                    }
                  }}
                />
              ) : (
                <polygon
                  points={cellPoints}
                  fill={baseFillColor}
                  fillOpacity={0.4} // Semi-transparent to show 3D background
                  stroke={hoveredCell?.x === col && hoveredCell?.y === row ? "#2563eb" : "#64748b"}
                  strokeWidth={hoveredCell?.x === col && hoveredCell?.y === row ? "3" : "1.5"}
                  style={{ cursor: selectedCombatant ? "pointer" : "default" }}
                  onClick={() => handleCellClick(col, row)}
                  onPointerDown={(e) => handleCellPointerDown(col, row, e)}
                  onPointerOver={(e) => handleCellPointerOver(col, row, e)}
                  onPointerUp={handleCellPointerUp}
                  onMouseEnter={() => {
                    setHoveredCell({ x: col, y: row });
                    if (onHoveredCellChange) {
                      onHoveredCellChange({ x: col, y: row });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredCell(null);
                    if (onHoveredCellChange) {
                      onHoveredCellChange(null);
                    }
                  }}
                />
              )}
            </Tooltip>
            
            {/* Movement color overlay - rendered above texture layer */}
            {movementOverlayColor && (
              effectiveMapType === "square" ? (
                <rect
                  x={x}
                  y={y}
                  width={GRID_CONFIG.HEX_SIZE * 2}
                  height={GRID_CONFIG.HEX_SIZE * 2}
                  fill={movementOverlayColor}
                  fillOpacity={0.7} // More opaque to show movement colors clearly
                  style={{ pointerEvents: 'none' }} // Don't block clicks
                />
              ) : (
                <polygon
                  points={cellPoints}
                  fill={movementOverlayColor}
                  fillOpacity={0.7} // More opaque to show movement colors clearly
                  style={{ pointerEvents: 'none' }} // Don't block clicks
                />
              )
            )}
            
            {/* Animated Fog of War / Memory Layer */}
            {/* Fog overlay - RENDER ON TOP of everything except combatants */}
            {/* ✅ Render fog overlay for ALL non-visible cells (respects lighting opacity but always renders) */}
            {/* ✅ Uses isCellVisible() as source of truth (from LOS calculation in visibleCells array) */}
            {fogEnabled && !isCellVisible(col, row) && (() => {
              const wasExplored = isCellExplored(col, row);
              
              // Get current lighting
              const currentLighting = terrain?.lighting || terrain?.lightingData?.name || "";
              const lightingStr = currentLighting ? String(currentLighting).toLowerCase() : "";
              const isDaylight = lightingStr.includes("bright") || lightingStr.includes("daylight");
              
              // ✅ CRITICAL: Always render fog overlay for non-visible cells
              // In bright daylight, use very low opacity (but still render to ensure grey appearance)
              // In darkness, use higher opacity
              
              // Memory tint for explored but not visible cells (lighter gray)
              // Unexplored cells use solid black
              const fogFill = wasExplored 
                ? "rgba(60,60,60,0.8)" // Dimmed gray for explored memory
                : "#000000"; // Solid black for unexplored
              
              // Calculate effective opacity
              // In bright daylight, use minimal opacity (0.05-0.1) but still render
              // In darkness, use full opacity (0.3-0.7)
              let effectiveOpacity;
              if (isDaylight) {
                // Bright daylight: minimal fog overlay (just enough to darken slightly)
                effectiveOpacity = wasExplored ? 0.05 : 0.1; // Very light fog even in daylight
              } else {
                // Non-daylight: use calculated fogOpacity if available, otherwise use defaults
                effectiveOpacity = fogOpacity > 0 ? fogOpacity : (wasExplored ? 0.3 : 0.7);
              }
              
              // ✅ Render fog overlay with correct shape based on mapType
              if (effectiveMapType === "square") {
                return (
                  <motion.rect
                    key={`fog-${col}-${row}`}
                    x={x}
                    y={y}
                    width={GRID_CONFIG.HEX_SIZE * 2}
                    height={GRID_CONFIG.HEX_SIZE * 2}
                    fill={fogFill}
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: effectiveOpacity,
                    }}
                    transition={{ 
                      duration: 0.4, 
                      ease: "easeInOut",
                      type: "tween"
                    }}
                    style={{ 
                      pointerEvents: 'none',
                      mixBlendMode: 'multiply'
                    }}
                  />
                );
              } else {
                return (
                  <motion.polygon
                    key={`fog-${col}-${row}`}
                    points={cellPoints}
                    fill={fogFill}
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: effectiveOpacity,
                    }}
                    transition={{ 
                      duration: 0.4, 
                      ease: "easeInOut",
                      type: "tween"
                    }}
                    style={{ 
                      pointerEvents: 'none',
                      mixBlendMode: 'multiply'
                    }}
                  />
                );
              }
            })()}
            
            {/* Feature overlay (from generated scene) - rendered before combatants */}
            {/* ✅ Render terrain features with Lucide icons or emoji fallback */}
            {(() => {
              const cellData = getCellDataFromScene(col, row);
              const hasTreeFeature = cellData && (cellData.feature === "TREE_LARGE" || cellData.feature === "TREE");
              
              // Trees disabled - removed 2D tree rendering
              if (hasTreeFeature && !combatantsAtPos[0]) {
                const feature = cellData.feature;
                const size = GRID_CONFIG.HEX_SIZE;
                
                // 3D-like flat icons via Lucide or emoji fallback
                switch (feature) {
                  case "TREE_LARGE":
                  case "TREE": {
                    // Trees disabled - return null to hide 2D tree icons
                    return null;
                  }
                    
                  case "BOULDER":
                    return (
                      <foreignObject
                        key={`boulder-${col}-${row}`}
                        x={centerX - 10}
                        y={centerY - 10}
                        width="20"
                        height="20"
                        style={{ pointerEvents: "none", opacity: cellVisible ? 0.9 : 0.3 }}
                      >
                        <Mountain color="#4a5568" size={18} />
                      </foreignObject>
                    );
                    
                  case "WATER":
                  case "RIVER":
                  case "WATERFALL":
                  case "DEEP_WATER":
                    return (
                      <foreignObject
                        key={`water-${col}-${row}`}
                        x={centerX - 10}
                        y={centerY - 10}
                        width="20"
                        height="20"
                        style={{ pointerEvents: "none", opacity: cellVisible ? 0.9 : 0.3 }}
                      >
                        <Droplet color="#3182ce" size={18} />
                      </foreignObject>
                    );
                    
                  case "ROAD":
                  case "TRAIL":
                    return (
                      <rect
                        key={`path-${col}-${row}`}
                        x={centerX - size * 0.3}
                        y={centerY - size * 0.3}
                        width={size * 0.6}
                        height={size * 0.6}
                        fill={featureColors[feature]}
                        stroke="#8b6f47"
                        strokeWidth="1"
                        opacity={cellVisible ? 0.8 : 0.2}
                        style={{ pointerEvents: 'none' }}
                      />
                    );
                    
                  case "STRUCTURE":
                    return (
                      <rect
                        key={`structure-${col}-${row}`}
                        x={centerX - size * 0.5}
                        y={centerY - size * 0.5}
                        width={size}
                        height={size}
                        fill={featureColors.STRUCTURE}
                        stroke="#660000"
                        strokeWidth="2"
                        opacity={cellVisible ? 0.9 : 0.2}
                        style={{ pointerEvents: 'none' }}
                      />
                    );
                    
                  case "CLIFF":
                    return (
                      <polygon
                        key={`cliff-${col}-${row}`}
                        points={`${centerX},${centerY - size * 0.5} ${centerX + size * 0.5},${centerY} ${centerX},${centerY + size * 0.5} ${centerX - size * 0.5},${centerY}`}
                        fill={featureColors.CLIFF}
                        stroke="#555555"
                        strokeWidth="2"
                        opacity={cellVisible ? 0.7 : 0.2}
                        style={{ pointerEvents: 'none' }}
                      />
                    );
                    
                  case "BRIDGE":
                    return (
                      <rect
                        key={`bridge-${col}-${row}`}
                        x={centerX - size * 0.4}
                        y={centerY - size * 0.2}
                        width={size * 0.8}
                        height={size * 0.4}
                        fill={featureColors.BRIDGE}
                        stroke="#6b563d"
                        strokeWidth="1.5"
                        opacity={cellVisible ? 0.9 : 0.2}
                        style={{ pointerEvents: 'none' }}
                      />
                    );
                    
                  default: {
                    // ✅ Fallback emoji icons for any other features
                    const emojiMap = {
                      TREE_LARGE: "🌲",
                      TREE: "🌲",
                      BOULDER: "🪨",
                      WATER: "💧",
                      RIVER: "🌊",
                      WATERFALL: "🌊",
                    };
                    if (emojiMap[feature]) {
                      return (
                        <text
                          key={`emoji-${col}-${row}`}
                          x={centerX}
                          y={centerY + 6}
                          textAnchor="middle"
                          fontSize="18"
                          opacity={cellVisible ? 0.9 : 0.3}
                          style={{ 
                            pointerEvents: "none", 
                            userSelect: "none",
                            fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji, emoji, Arial, sans-serif'
                          }}
                        >
                          {emojiMap[feature]}
                        </text>
                      );
                    }
                    return null;
                  }
                }
              }
              return null;
            })()}
            
            {/* Terrain icon (rendered behind combatants) - fallback for non-AI terrain */}
            {terrainIcon && !combatantsAtPos[0] && !getCellDataFromScene(col, row)?.feature && (
              <text
                x={centerX}
                y={centerY + 6}
                textAnchor="middle"
                fontSize="16"
                opacity="0.6"
                style={{ 
                  pointerEvents: 'none', 
                  userSelect: 'none',
                  fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji, emoji, Arial, sans-serif'
                }}
              >
                {terrainIcon}
              </text>
            )}
            
            {/* Line of Sight indicator - only show visible hexes for selected party member (COMBAT mode only) */}
            {mode === "COMBAT" && (() => {
              // Show LOS indicators when a party member is selected
              if (selectedCombatant && positions[selectedCombatant]) {
                const selectedCombatantData = combatants.find(c => c._id === selectedCombatant);
                
                // Only show LOS for party members (not enemies)
                if (selectedCombatantData && !selectedCombatantData.isEnemy) {
                  const selectedPos = positions[selectedCombatant];
                  const distance = calculateDistance(selectedPos, { x: col, y: row });
                  
                  // Show LOS range indicator up to 60 feet (typical vision range)
                  // Only show on empty hexes (no terrain icon already)
                  if (distance > 0 && distance <= 60 && !terrainIcon && !combatantsAtPos[0]) {
                    return (
                      <circle
                        cx={centerX}
                        cy={centerY}
                        r={GRID_CONFIG.HEX_SIZE * 0.3}
                        fill="none"
                        stroke="rgba(34, 211, 238, 0.2)"
                        strokeWidth="1.5"
                        strokeDasharray="3,3"
                        style={{ pointerEvents: 'none' }}
                      />
                    );
                  }
                }
              }
              return null;
            })()}
            
            {/* Protection Circles - render after terrain but before combatants */}
            {activeCircles && activeCircles.length > 0 && activeCircles.map((circle) => {
              if (!circle.position || circle.remaining <= 0) return null;
              
              // Only render circle at its center position
              if (col !== circle.position.x || row !== circle.position.y) return null;
              
              // Get render data for this circle
              const renderData = getCircleRenderData(circle, effectiveMapType);
              if (!renderData) return null;
              
              return (
                <ProtectionCircle
                  key={circle.id}
                  id={circle.id}
                  position={circle.position}
                  radiusCells={renderData.radiusCells}
                  color={renderData.color}
                  opacity={renderData.opacity}
                  strokeOpacity={renderData.strokeOpacity}
                  name={renderData.name}
                  bonus={renderData.bonus}
                  remaining={renderData.remaining}
                  mapType={effectiveMapType}
                  getCellPixelPosition={getCellPixelPosition}
                />
              );
            })}
            
            {/* Combatant icons - show all combatants at this position (COMBAT mode only) */}
            {mode === "COMBAT" && combatantsAtPos && combatantsAtPos.length > 0 && (
              (() => {
                return combatantsAtPos
                  .sort((a, b) => {
                    // Sort so enemies appear on top of players
                    if (a.isEnemy && !b.isEnemy) return 1; // Enemy after player
                    if (!a.isEnemy && b.isEnemy) return -1; // Player before enemy
                    return 0; // Same type, maintain original order
                  })
                  .map((combatant, index) => {
                  // Get the combatant's primary position
                  const primaryPos = getCreaturePrimaryPosition(combatant);
                  if (!primaryPos) {
                    return null;
                  }
                  
                  // Only show icon on the primary position (top-left corner for large creatures)
                  // For single-cell creatures, this will be their exact position
                  const isPrimaryPosition = primaryPos.x === col && primaryPos.y === row;
                  if (!isPrimaryPosition) {
                    // Debug: log only for specific cells in development (to avoid spam)
                    if (import.meta.env.DEV && index === 0 && col === 15 && row === 14) {
                      console.log(`[TacticalMap] ${combatant.name} at primary pos (${primaryPos.x}, ${primaryPos.y}) but rendering cell (${col}, ${row}) - skipping`);
                    }
                    return null;
                  }
                  
                  // Debug: verify icon should render (only for specific cells in development)
                  if (import.meta.env.DEV && col === 15 && row === 14) {
                  console.log(`[TacticalMap] ✅ Rendering icon for ${combatant.name} at (${col}, ${row}), isEnemy: ${combatant.isEnemy}, fogEnabled: ${fogEnabled}`);
                  }

              // ✅ Check enemy visibility for rendering
              // In darkness/fog, enemies should be completely invisible if not visible
              const enemyVisible = combatant.isEnemy ? isEnemyVisible(col, row, combatant) : true;
              
              // ✅ In darkness, completely hide unseen enemies (opacity 0, or don't render)
              // If fog is enabled and enemy is not visible, don't render the icon at all
              // BUT always show player icons regardless of fog
              if (combatant.isEnemy && fogEnabled && !enemyVisible) {
                return null; // Don't render unseen enemies in fog of war
              }

              // Calculate offset for multiple combatants
              const offsetX = combatantsAtPos.length > 1 ? (index - (combatantsAtPos.length - 1) / 2) * 8 : 0;
              const offsetY = combatantsAtPos.length > 1 ? (index - (combatantsAtPos.length - 1) / 2) * 6 : 0;
              
              // Calculate altitude offset for flying creatures (0.4 pixels per foot for visual scale)
              // This makes altitude visible: 5ft = 2px up, 20ft = 8px up, 80ft = 32px up, 120ft = 48px up
              const altitude = combatant.altitudeFeet ?? combatant.altitude ?? 0;
              const altitudeOffsetY = altitude > 0 ? -(altitude * 0.4) : 0;
              
              // Base icon position (ground level)
              const baseIconY = centerY + 6 + offsetY;
              // Icon position with altitude offset (moves up for flying creatures)
              const iconX = centerX + offsetX;
              const iconY = baseIconY + altitudeOffsetY;

              return (
                <g key={getCombatantId(combatant)} opacity={1} style={{ pointerEvents: 'none' }}>
                  {/* Add background circle for enemy sword to make it more visible over player shield */}
                  {/* Only show background circle if enemy is visible */}
                  {combatant.isEnemy && enemyVisible && (
                    <circle
                      cx={iconX}
                      cy={iconY - 2}
                      r="12"
                      fill="rgba(255, 255, 255, 0.8)"
                      stroke="rgba(0, 0, 0, 0.2)"
                      strokeWidth="1"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  
                  {/* Fallback colored circle - always visible even if emoji doesn't render */}
                  <circle
                    cx={iconX}
                    cy={iconY - 2}
                    r="8"
                    fill={combatant.isEnemy ? "#dc2626" : "#2563eb"}
                    stroke={combatant.isEnemy ? "#991b1b" : "#1e40af"}
                    strokeWidth="2"
                    opacity="0.9"
                    style={{ pointerEvents: 'none' }}
                  />
                  
                  {/* Emoji icon on top of fallback circle */}
                  <text
                    x={iconX}
                    y={iconY}
                    textAnchor="middle"
                    fontSize="20"
                    fill={combatant.isEnemy ? "#ffffff" : "#ffffff"}
                    stroke={combatant.isEnemy ? "#991b1b" : "#1e40af"}
                    strokeWidth="0.5"
                    dominantBaseline="middle"
                    style={{ 
                      pointerEvents: 'none', 
                      userSelect: 'none',
                      opacity: flashingCombatants.has(getCombatantId(combatant)) ? undefined : 1,
                      animation: flashingCombatants.has(getCombatantId(combatant)) ? 'flash-slow 0.5s ease-in-out infinite' : 'none',
                      zIndex: 10, // Ensure icons are above other elements
                      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji, emoji, Arial, sans-serif', // Enhanced emoji font support
                      fontWeight: 'normal'
                    }}
                  >
                    {combatant.isEnemy ? "🗡️" : "🛡️"}
                  </text>
                  
                  {/* Altitude indicator for flying combatants */}
                  {(combatant.isFlying || (combatant.altitudeFeet ?? 0) > 0) && (() => {
                    const altitude = combatant.altitudeFeet ?? combatant.altitude ?? 0;
                    // Color coding by altitude bands: low (5-15ft), mid (20-40ft), high (45+ft)
                    let fillColor = "#2563eb"; // Default blue
                    if (altitude >= 5 && altitude <= 15) {
                      fillColor = "#22c55e"; // Green for low altitude (melee reach)
                    } else if (altitude >= 20 && altitude <= 40) {
                      fillColor = "#3b82f6"; // Blue for mid altitude
                    } else if (altitude >= 45) {
                      fillColor = "#8b5cf6"; // Purple for high altitude
                    }
                    
                    return (
                      <g>
                        {/* Background circle for better visibility - stays at ground level */}
                        <circle
                          cx={iconX}
                          cy={baseIconY + 18}
                          r="12"
                          fill="rgba(0, 0, 0, 0.6)"
                          stroke="rgba(255, 255, 255, 0.3)"
                          strokeWidth="1"
                          style={{ pointerEvents: 'none' }}
                        />
                        {/* Altitude text - stays at ground level to show how high the icon is */}
                        <text
                          x={iconX}
                          y={baseIconY + 18}
                          textAnchor="middle"
                          fontSize="9"
                          fill={fillColor}
                          stroke="white"
                          strokeWidth="2"
                          strokeLinejoin="round"
                          dominantBaseline="middle"
                          style={{ 
                            pointerEvents: 'none', 
                            userSelect: 'none',
                            fontWeight: 'bold',
                            zIndex: 11
                          }}
                        >
                          {altitude}ft
                        </text>
                      </g>
                    );
                  })()}
                  
                  {/* Current turn indicator */}
                  {getCombatantId(combatant) === currentTurn && (
                    <circle
                      cx={iconX + size * 0.4}
                      cy={iconY - size * 0.4}
                      r="4"
                      fill="#f6ad55"
                      stroke="white"
                      strokeWidth="1.5"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  
                  {/* Movement Info Display - only show for the first combatant to avoid clutter */}
                  {index === 0 && (
                    <foreignObject
                      x={centerX - 60}
                      y={centerY + 20}
                      width="120"
                      height="60"
                      style={{ pointerEvents: 'none' }}
                    >
                      <MovementInfoDisplay 
                        combatant={combatant} 
                        position={{ x: centerX, y: centerY }} 
                        scale={1}
                      />
                    </foreignObject>
                  )}
                  
                  {/* Large creature size indicator */}
                  {(() => {
                    const creatureSize = getCreatureSize(combatant);
                    if (creatureSize.width > 1) {
                      return (
                        <text
                          x={iconX}
                          y={iconY - 12}
                          textAnchor="middle"
                          fontSize="8"
                          fill="#666"
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                          {creatureSize.width}×1
                        </text>
                      );
                    }
                    return null;
                  })()}
                </g>
              );
                }).filter(Boolean) // Remove null entries
              })()
            )}
          </g>
        );
      }
    }
    
    return cells;
  }, [positions, combatants, hoveredCell, selectedCombatant, currentTurn, flashingCombatants, getCombatantsAtPosition, getCellColor, getCreaturePrimaryPosition, handleCellClick, terrain, terrainObstacles, effectiveMapType, getCellDataFromScene, fogEnabled, visibleCellsLookup, exploredCellsLookup, isCellVisible, isCellExplored, getFogOpacity, isEnemyVisible, getEnemyVisibilityGradient, getPlayerVisibilityGradient, getCellPixelPosition, getCellShape, GRID_CONFIG.GRID_WIDTH, GRID_CONFIG.GRID_HEIGHT]);

  // Render grid using SVG (supports both hex and square)
  const renderGrid = () => {
    return gridCells;
  };

  // Map aligns directly with window edges (no padding)
  
  // Calculate precise SVG dimensions for perfect tessellation (flat-top hex)
  const svgDimensions = useMemo(() => {
    if (effectiveMapType === "square") {
      return {
        width: GRID_CONFIG.GRID_WIDTH * GRID_CONFIG.HEX_SIZE * 2 * 2,
        height: GRID_CONFIG.GRID_HEIGHT * GRID_CONFIG.HEX_SIZE * 2 * 2,
      };
    }
    
    // Flat-top hex grid: correct hex-dimension logic
    // Uses hex constants defined at component level
    const cols = GRID_CONFIG.GRID_WIDTH;   // number of columns
    const rows = GRID_CONFIG.GRID_HEIGHT;  // number of rows
    
    // SVG width accounts for column staggering (odd-q offset)
    // Last column may be offset, so add half hex width
    const svgWidth = HEX_WIDTH * cols + HEX_WIDTH * 0.5;
    
    // SVG height: vertical spacing per row, plus final hex radius
    const svgHeight = HEX_VERTICAL_SPACING * rows + HEX_RADIUS;
    
    return { width: svgWidth, height: svgHeight };
  }, [effectiveMapType, GRID_CONFIG.GRID_WIDTH, GRID_CONFIG.GRID_HEIGHT, GRID_CONFIG.HEX_SIZE]);

  return (
    <Box position="relative" width="100%" height={`${mapHeight}px`} display="flex" flexDirection="column" minHeight={`${mapHeight}px`}>
      {/* Map Content Area - Resizable */}
      <Box flex="1" minHeight={0} position="relative" width="100%" height="100%">
        <VStack align="stretch" spacing={4}>
          {/* CSS Animation for flashing */}
          <style>
            {`
              @keyframes flash-slow {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
              }
            `}
          </style>
          
        </VStack>
      </Box>

      {/* Tactical Map Grid (Hex or Square) - Resizable */}
      <Box
        ref={mapScrollRef}
        borderWidth="2px"
        borderRadius="md"
        bg="transparent" // Transparent to show 3D background
        borderColor="gray.300"
        overflowX="scroll"
        overflowY="scroll"
        width="100%"
        height="100%"
        flex="1"
        position="absolute" // Overlay on 3D background
        inset={0} // Fill container
        zIndex={1} // Above 3D background
        pointerEvents="auto" // Handle all interactions
        sx={{
          // Smooth scrolling
          scrollBehavior: 'smooth',
          // Force scrollbars to always be visible
          '&::-webkit-scrollbar': {
            width: '16px',  // Increased from 12px for better visibility
            height: '16px', // Increased from 12px for better visibility
            display: 'block',
          },
          '&::-webkit-scrollbar-track': {
            background: '#e2e8f0',
            borderRadius: '8px',
            border: '1px solid #cbd5e0',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#4a5568',
            borderRadius: '8px',
            border: '2px solid #e2e8f0',
            '&:hover': {
              background: '#2d3748',
            },
            '&:active': {
              background: '#1a202c',
            },
          },
          // Firefox scrollbar styling
          scrollbarWidth: 'auto',
          scrollbarColor: '#4a5568 #e2e8f0',
        }}
      >
        {/* SVG content - aligns with window edges */}
        <Box
          as="div"
          boxSizing="border-box"
          minWidth={`${svgDimensions.width}px`}
          minHeight={`${svgDimensions.height}px`}
        >
          <svg
            width={svgDimensions.width}
            height={svgDimensions.height}
            viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
            style={{ 
              display: 'block', 
              backgroundColor: 'transparent', // Transparent to show 3D background
            }}
          >
          {/* Texture pattern definitions for terrain */}
          <defs>
            {texturePatterns}
          </defs>
          
          {/* Animated Lighting filter overlay (if terrain has lighting info) - rendered FIRST so icons appear on top */}
          {terrain?.lighting && (() => {
            const lightingFilter = getLightingFilter(terrain.lighting);
            if (lightingFilter.opacity > 0) {
              return (
                <motion.rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill={lightingFilter.color}
                  initial={{ opacity: lightingFilter.opacity }}
                  animate={{ opacity: lightingFilter.opacity }}
                  transition={{ 
                    duration: 1.5, 
                    ease: "easeInOut",
                    type: "tween"
                  }}
                  style={{ pointerEvents: 'none' }}
                />
              );
            }
            return null;
          })()}
          
          {/* Render grid cells with terrain, features, and combatant icons - rendered AFTER lighting so icons are visible */}
          {renderGrid()}
          
          {/* MAP_EDITOR mode: Editor overlay */}
          {mode === "MAP_EDITOR" && mapDefinition && (
            <g id="map-editor-overlay">
              <foreignObject x={12} y={12} width={180} height={300}>
                <div
                  style={{
                    pointerEvents: "auto",
                    userSelect: "none",
                    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                    background: "rgba(255,255,255,0.92)",
                    border: "1px solid rgba(0,0,0,0.2)",
                    borderRadius: 10,
                    padding: 10,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
                    Brush
                  </div>

                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    {[
                      { key: "terrain", label: "Terrain" },
                      { key: "bucket", label: "Bucket" },
                      { key: "raise", label: "Raise" },
                      { key: "lower", label: "Lower" },
                    ].map((b) => {
                      const active = editorBrushMode === b.key;
                      return (
                        <button
                          key={b.key}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditorBrushMode(b.key);
                          }}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: active ? "2px solid #2563eb" : "1px solid rgba(0,0,0,0.18)",
                            background: active ? "rgba(37,99,235,0.10)" : "white",
                            cursor: "pointer",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#111827",
                          }}
                        >
                          {b.label}
                        </button>
                      );
                    })}
                  </div>

                  {(editorBrushMode === "raise" || editorBrushMode === "lower") && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: "#111827" }}>
                        Height step
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[1, 2, 5].map((n) => {
                          const active = Number(editorHeightStep) === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditorHeightStep(n);
                              }}
                              style={{
                                padding: "6px 8px",
                                borderRadius: 8,
                                border: active ? "2px solid #16a34a" : "1px solid rgba(0,0,0,0.18)",
                                background: active ? "rgba(22,163,74,0.10)" : "white",
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: 800,
                                color: "#111827",
                                minWidth: 34,
                              }}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {editorBrushMode === "terrain" && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: 6,
                        overflowY: "auto",
                        flex: 1,
                        maxHeight: "170px",
                        paddingRight: 4,
                      }}
                    >
                      {editorTerrainPalette.map((t) => {
                        const active = (selectedTerrainType || "grass") === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation(); // don't click-through to the map
                              if (onSelectedTerrainTypeChange)
                                onSelectedTerrainTypeChange(t.key);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: 8,
                              border: active
                                ? "2px solid #2563eb"
                                : "1px solid rgba(0,0,0,0.18)",
                              background: active
                                ? "rgba(37,99,235,0.10)"
                                : "white",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <span
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 4,
                                background: t.swatch,
                                border: "1px solid rgba(0,0,0,0.25)",
                                display: "inline-block",
                                flex: "0 0 auto",
                              }}
                            />
                            <span style={{ width: 18, textAlign: "center" }}>
                              {t.icon}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#111827",
                              }}
                            >
                              {t.label}
                            </span>
                            {active && (
                              <span
                                style={{
                                  marginLeft: "auto",
                                  fontSize: 11,
                                  color: "#2563eb",
                                  fontWeight: 700,
                                }}
                              >
                                ACTIVE
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: 10, fontSize: 11, color: "#374151", opacity: 0.9 }}>
                    {editorBrushMode === "terrain"
                      ? "Click-drag to paint terrain."
                      : editorBrushMode === "bucket"
                      ? "Click a tile to fill a connected region (stops at different terrain)."
                      : editorBrushMode === "raise"
                      ? "Click-drag to raise tiles."
                      : "Click-drag to lower tiles."}
                  </div>
                </div>
              </foreignObject>
            </g>
          )}
          
          {/* COMBAT mode: Combat-specific overlays */}
          {mode === "COMBAT" && (
            <>
              {/* Fog drift effects layer - No vision cone, only fog animation */}
              {fogEnabled && terrain?.lighting && (
                <FogEffectsLayer
                  key="fog-drift"
                  mapWidth={svgDimensions.width}
                  mapHeight={svgDimensions.height}
                  playerPosition={playerPosition || { x: 0, y: 0 }} // ✅ Provide default object instead of null
                  lighting={terrain?.lighting || "Bright Daylight"}
                  enabled={fogEnabled}
                />
              )}
            </>
          )}
        </svg>
        </Box>
        
        {/* Protection Circle HUD - shows active circles */}
        {activeCircles && activeCircles.length > 0 && (
          <ProtectionCircleHUD circles={activeCircles} />
        )}
      </Box>

      {/* ✅ Terrain Legend Overlay (top-right corner) */}
      {terrain?.baseTerrain && (
        <Box
          position="absolute"
          top="20px"
          right="20px"
          bg="white"
          borderWidth="2px"
          borderColor="gray.300"
          borderRadius="md"
          p={3}
          boxShadow="lg"
          zIndex={1000}
          minW="200px"
        >
          <Text fontSize="xs" fontWeight="bold" mb={2} color="gray.700">
            Terrain Legend
          </Text>
          <VStack spacing={1} align="stretch">
            {Object.entries(terrainColors)
              .filter(([key]) => {
                // Only show terrains that are actually used
                return key === terrain.baseTerrain || 
                       (terrain.grid && terrain.grid.some(row => 
                         row && row.some(cell => cell?.terrainType === key || cell?.feature === key)
                       ));
              })
              .map(([key, color]) => {
                const terrainName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const icon = key.includes("FOREST") ? "🌲" : 
                            key.includes("ROCKY") ? "🪨" : 
                            key === "WATER" ? "💧" : 
                            key === "URBAN" ? "🏙️" : 
                            key === "SWAMP" ? "🌿" : 
                            key === "CAVE" ? "🕳️" : "🟩";
                return (
                  <HStack key={key} spacing={2}>
                    <Box
                      w="20px"
                      h="20px"
                      bg={color}
                      borderWidth="1px"
                      borderColor="gray.400"
                      borderRadius="sm"
                    />
                    <Text fontSize="xs" flex={1}>{icon} {terrainName}</Text>
                  </HStack>
                );
              })}
          </VStack>
        </Box>
      )}


      {/* Distance Info */}
      {hoveredCell && selectedCombatant && (
        <Box p={2} bg="yellow.100" borderRadius="md" fontSize="sm">
          <Text fontWeight="bold">
            Distance to hovered cell: {getHoveredDistance()} feet
          </Text>
        </Box>
      )}

    </Box>
  );
};

TacticalMap.propTypes = {
  combatants: PropTypes.array.isRequired,
  positions: PropTypes.object.isRequired,
  onPositionChange: PropTypes.func,
  currentTurn: PropTypes.string,
  highlightMovement: PropTypes.bool,
  flashingCombatants: PropTypes.instanceOf(Set),
  movementMode: PropTypes.shape({
    active: PropTypes.bool,
    isRunning: PropTypes.bool
  }),
  terrain: PropTypes.object, // Terrain data with grid, features, etc.
  mapType: PropTypes.string, // "hex" or "square"
  // Fog of War props
  visibleCells: PropTypes.array,
  exploredCells: PropTypes.array,
  fogEnabled: PropTypes.bool,
  playerPosition: PropTypes.object,
  visibilityRange: PropTypes.number,
  // Protection Circles
  activeCircles: PropTypes.array, // Array of active protection circles
  // Map height control
  mapHeight: PropTypes.number,
  // Selected combatant callback
  onSelectedCombatantChange: PropTypes.func,
  // Hex selection callbacks
  onHoveredCellChange: PropTypes.func,
  onSelectedHexChange: PropTypes.func,
  // Editor/Combat mode
  mode: PropTypes.oneOf(["MAP_EDITOR", "COMBAT"]),
  mapDefinition: PropTypes.object,
  selectedTerrainType: PropTypes.string,
  onSelectedTerrainTypeChange: PropTypes.func,
  onMapCellEdit: PropTypes.func,
};

export default TacticalMap;


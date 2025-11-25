/**
 * AI-Driven Map Scene Generator
 * Converts natural-language descriptions into structured map data
 * Compatible with TacticalMap.jsx, terrainSystem.js, and movementRules.js
 */

import { TERRAIN_TYPES, LIGHTING_CONDITIONS } from "./terrainSystem.js";
import { GRID_CONFIG, getMapPreset } from "../data/movementRules.js";

/**
 * Main entry point: builds a mapGrid object ready for TacticalMap.jsx
 * @param {string} description - Natural language scene description
 * @param {string} mapType - "hex" or "square"
 * @returns {Object} Scene object with grid, terrain, features, and metadata
 */
export function generateMapFromDescription(description = "", mapType = "hex") {
  const baseTerrain = detectBaseTerrain(description);
  const terrain = TERRAIN_TYPES[baseTerrain] || TERRAIN_TYPES.OPEN_GROUND;
  
  // ✅ Use map preset based on terrain and map type
  const preset = getMapPreset(baseTerrain, mapType);
  const width = preset.width;
  const height = preset.height;

  // Initialize grid with base terrain
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      x,
      y,
      terrainType: baseTerrain,
      elevation: 0,
      cover: terrain.cover || 0,
      isWalkable: true,
      feature: null,
      movementCost: terrain.movementModifier || 1.0,
      visibility: terrain.visibilityModifier || 1.0,
    }))
  );

  // Place features (roads, water, cliffs, trees, structures)
  const features = extractFeatures(description);
  features.forEach((feature) => applyFeatureToGrid(feature, grid, mapType, width, height));

  // ✅ AUTO-POPULATE BASE TERRAIN FEATURES (only if no custom features specified)
  // This ensures AI-generated maps always have terrain-specific visuals
  if (features.length === 0) {
    switch (baseTerrain) {
      case "DENSE_FOREST":
        // ✅ Dense forest: Place trees in ALMOST EVERY cell (95% coverage)
        // Systematic placement ensures maximum density
        for (let y = 4; y < height - 4; y++) {
          for (let x = 4; x < width - 4; x++) {
            if (grid[y] && grid[y][x]) {
              // 95% chance each cell gets trees (5% random gaps for variety)
              if (Math.random() < 0.95) {
                // Each cell gets 3-6 trees initially (will increase with overlapping placements)
                grid[y][x].feature = "TREE_LARGE";
                grid[y][x].cover = 2;
                grid[y][x].treeCount = randomBetween(3, 6);
              }
            }
          }
        }
        
        // Additional pass: add more trees to some cells for extra density clusters
        const extraTreePasses = Math.floor((width - 8) * (height - 8) * 0.3); // 30% more passes
        for (let i = 0; i < extraTreePasses; i++) {
          const x = randomBetween(4, width - 4);
          const y = randomBetween(4, height - 4);
          
          if (grid[y] && grid[y][x]) {
            // If cell already has trees, add more
            if (grid[y][x].feature === "TREE_LARGE") {
              if (grid[y][x].treeCount) {
                grid[y][x].treeCount += randomBetween(1, 3); // Add 1-3 more trees
              } else {
                grid[y][x].treeCount = randomBetween(4, 7);
              }
              grid[y][x].cover = Math.min(5, grid[y][x].cover + 1);
            }
          }
        }
        break;
        
      case "LIGHT_FOREST":
        for (let i = 0; i < 10; i++) {
          const x = randomBetween(4, width - 4);
          const y = randomBetween(4, height - 4);
          if (grid[y] && grid[y][x] && !grid[y][x].feature) {
            grid[y][x].feature = "TREE_LARGE";
            grid[y][x].cover = 1;
          }
        }
        break;
        
      case "ROCKY_TERRAIN":
        for (let i = 0; i < 15; i++) {
          const x = randomBetween(3, width - 3);
          const y = randomBetween(3, height - 3);
          if (grid[y] && grid[y][x] && !grid[y][x].feature) {
            grid[y][x].feature = "BOULDER";
            grid[y][x].cover = 1;
          }
        }
        break;
        
      case "SWAMP_MARSH":
        // Scatter small water pools
        for (let i = 0; i < 6; i++) {
          const center = { x: randomBetween(6, width - 6), y: randomBetween(6, height - 6) };
          drawCircle(center, randomBetween(2, 4), grid, {
            feature: "WATER",
            isWalkable: false,
            movementCost: 0.0,
            cover: 0,
          });
        }
        break;
        
      case "URBAN":
        // Grid roads handled below for square maps
        // Random structures between roads will be added below
        break;
        
      case "CAVE_INTERIOR":
        // Scatter rocks
        for (let i = 0; i < 12; i++) {
          const x = randomBetween(3, width - 3);
          const y = randomBetween(3, height - 3);
          if (grid[y] && grid[y][x] && !grid[y][x].feature) {
            grid[y][x].feature = "BOULDER";
            grid[y][x].cover = 2;
          }
        }
        break;
        
      default:
        break;
    }
  }

  // ✅ Add automatic urban layout for square maps
  if (mapType === "square" && baseTerrain === "URBAN") {
    // Place grid roads in a city-block pattern (every 10 cells)
    for (let y = 0; y < height; y++) {
      if (y % 10 === 0 && y > 0 && y < height - 1) {
        // Horizontal roads
        for (let x = 0; x < width; x++) {
          if (grid[y] && grid[y][x]) {
            grid[y][x].feature = "ROAD";
            grid[y][x].terrainType = "URBAN";
            grid[y][x].movementCost = 1.0;
            grid[y][x].isWalkable = true;
            grid[y][x].cover = 0;
          }
        }
      }
    }
    for (let x = 0; x < width; x++) {
      if (x % 10 === 0 && x > 0 && x < width - 1) {
        // Vertical roads
        for (let y = 0; y < height; y++) {
          if (grid[y] && grid[y][x]) {
            grid[y][x].feature = "ROAD";
            grid[y][x].terrainType = "URBAN";
            grid[y][x].movementCost = 1.0;
            grid[y][x].isWalkable = true;
            grid[y][x].cover = 0;
          }
        }
      }
    }
    
    // Random structures between roads (for urban terrain, even if features were specified)
    if (baseTerrain === "URBAN" && features.length === 0) {
      for (let i = 0; i < 8; i++) {
        const x = randomBetween(5, width - 5);
        const y = randomBetween(5, height - 5);
        drawRectangle({ x: x - 1, y: y - 1 }, 3, 3, grid, {
          feature: "STRUCTURE",
          isWalkable: false,
          cover: 3,
        });
      }
    }
  }

  // Lighting and density (affect movement/visibility)
  const lighting = getLighting(description);
  const density = getDensity(description);

  return {
    mapType,
    baseTerrain,
    terrain,
    lighting,
    density,
    grid,
    features,
    description,
    width,
    height,
    notes: [`Generated from: "${description}"`],
  };
}

/* --------------------- Terrain Detection ---------------------- */

/**
 * Detects base terrain type from description
 * @param {string} text - Scene description
 * @returns {string} Terrain type key
 */
function detectBaseTerrain(text) {
  if (!text) return "OPEN_GROUND";
  
  const t = text.toLowerCase();
  
  // Order matters - check more specific first
  if (t.includes("dense forest") || t.includes("thick forest") || t.includes("thick woods")) {
    return "DENSE_FOREST";
  }
  if (t.includes("forest") || t.includes("woods") || t.includes("wooded")) {
    return "LIGHT_FOREST";
  }
  if (t.includes("mountain") || t.includes("cliff") || t.includes("rocky") || t.includes("boulder")) {
    return "ROCKY_TERRAIN";
  }
  if (t.includes("swamp") || t.includes("marsh") || t.includes("bog")) {
    return "SWAMP_MARSH";
  }
  if (t.includes("village") || t.includes("town") || t.includes("road") || t.includes("city") || t.includes("urban")) {
    return "URBAN";
  }
  if (t.includes("cave") || t.includes("underground") || t.includes("tunnel") || t.includes("cavern")) {
    return "CAVE_INTERIOR";
  }
  if (t.includes("plains") || t.includes("grass") || t.includes("field") || t.includes("meadow")) {
    return "OPEN_GROUND";
  }
  
  // Default to open ground
  return "OPEN_GROUND";
}

/* --------------------- Feature Extraction ---------------------- */

/**
 * Extracts features from description
 * @param {string} text - Scene description
 * @returns {Array} Array of feature objects
 */
function extractFeatures(text) {
  const features = [];
  if (!text) return features;
  
  const t = text.toLowerCase();
  
  // Roads and trails
  if (t.includes("road") && !t.includes("trail")) {
    features.push({ 
      type: "ROAD", 
      path: t.includes("east") || t.includes("west") ? "horizontal" : "vertical",
      width: 2 
    });
  }
  if (t.includes("trail") || (t.includes("path") && !t.includes("road"))) {
    features.push({ 
      type: "TRAIL", 
      path: t.includes("winding") || t.includes("curved") ? "winding" : "straight",
      width: 1 
    });
  }
  
  // Water features
  if (t.includes("river") || t.includes("stream") || t.includes("brook")) {
    features.push({ 
      type: "WATER", 
      flow: t.includes("east") || t.includes("west") ? "horizontal" : "vertical",
      size: "large",
      isWalkable: false 
    });
  }
  if (t.includes("pond") || t.includes("pool")) {
    features.push({ 
      type: "WATER", 
      size: "small",
      isWalkable: false,
      shape: "circular"
    });
  }
  if (t.includes("lake")) {
    features.push({ 
      type: "WATER", 
      size: "large",
      isWalkable: false,
      shape: "large"
    });
  }
  if (t.includes("waterfall")) {
    features.push({ 
      type: "WATERFALL", 
      flow: "vertical",
      height: randomBetween(10, 50)
    });
  }
  
  // Elevation features
  if (t.includes("cliff") || t.includes("bluff")) {
    features.push({ 
      type: "CLIFF", 
      height: randomBetween(10, 40),
      direction: detectDirection(t, ["north", "south", "east", "west"])
    });
  }
  if (t.includes("hill") || t.includes("ridge")) {
    features.push({ 
      type: "HILL", 
      elevation: randomBetween(5, 15)
    });
  }
  
  // Structures
  if (t.includes("tower") || t.includes("ruin") || t.includes("ruined tower")) {
    features.push({ 
      type: "STRUCTURE", 
      style: t.includes("ruin") || t.includes("ruined") ? "ruin" : "tower",
      size: t.includes("small") ? "small" : "medium"
    });
  }
  if (t.includes("bridge")) {
    features.push({ 
      type: "BRIDGE", 
      direction: "horizontal",
      isWalkable: true
    });
  }
  if (t.includes("wall") || t.includes("ruins")) {
    features.push({ 
      type: "WALL", 
      style: "stone",
      cover: 3
    });
  }
  
  // Natural features
  if (t.includes("tree") && t.includes("large") || t.includes("ancient tree")) {
    features.push({ 
      type: "TREE_LARGE", 
      cover: 2
    });
  }
  if (t.includes("rock") && t.includes("large") || t.includes("boulder")) {
    features.push({ 
      type: "BOULDER", 
      cover: 1,
      isWalkable: false
    });
  }
  
  return features;
}

/**
 * Detects direction from text
 * @param {string} text - Description text
 * @param {Array} directions - Array of direction keywords
 * @returns {string} Direction or "random"
 */
function detectDirection(text, directions) {
  for (const dir of directions) {
    if (text.includes(dir)) return dir;
  }
  return "random";
}

/* --------------------- Environmental Properties ---------------------- */

/**
 * Detects lighting condition from description
 * @param {string} text - Scene description
 * @returns {string} Lighting condition key
 */
function getLighting(text) {
  if (!text) return "BRIGHT_DAYLIGHT";
  
  const t = text.toLowerCase();
  
  if (t.includes("night") || t.includes("dark") || t.includes("darkness")) {
    return "DARKNESS";
  }
  if (t.includes("moon") || t.includes("moonlight") || t.includes("dusk") || t.includes("dawn")) {
    return "MOONLIGHT";
  }
  if (t.includes("torch") || t.includes("torchlight") || t.includes("firelight")) {
    return "TORCHLIGHT";
  }
  if (t.includes("bright") || t.includes("daylight") || t.includes("sun")) {
    return "BRIGHT_DAYLIGHT";
  }
  
  return "BRIGHT_DAYLIGHT"; // Default
}

/**
 * Estimates terrain density from description
 * @param {string} text - Scene description
 * @returns {number} Density value (0.0-1.0)
 */
function getDensity(text) {
  if (!text) return 0.5;
  
  const t = text.toLowerCase();
  
  if (t.includes("dense") || t.includes("thick") || t.includes("crowded")) {
    return 0.8;
  }
  if (t.includes("sparse") || t.includes("open") || t.includes("wide") || t.includes("clear")) {
    return 0.3;
  }
  if (t.includes("narrow") || t.includes("tight") || t.includes("cramped")) {
    return 0.7;
  }
  
  return 0.5; // Default medium density
}

/* --------------------- Feature Placement ---------------------- */

/**
 * Applies a feature to the grid
 * @param {Object} feature - Feature object with type and properties
 * @param {Array} grid - 2D grid array
 * @param {string} mapType - "hex" or "square"
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 */
function applyFeatureToGrid(feature, grid, mapType, width, height) {
  switch (feature.type) {
    case "ROAD":
      drawLine({ x: 0, y: Math.floor(height / 2) }, { x: width - 1, y: Math.floor(height / 2) }, grid, {
        feature: "ROAD",
        terrainType: "URBAN",
        movementCost: 1.0,
        isWalkable: true,
        cover: 0
      }, feature.width || 2);
      break;
      
    case "TRAIL":
      if (feature.path === "winding") {
        drawWindingPath(grid, width, height, {
          feature: "TRAIL",
          terrainType: "LIGHT_FOREST",
          movementCost: 0.9,
          isWalkable: true,
          cover: 0
        });
      } else {
        drawLine({ x: 0, y: Math.floor(height / 2) }, { x: width - 1, y: Math.floor(height / 2) - 5 }, grid, {
          feature: "TRAIL",
          terrainType: "LIGHT_FOREST",
          movementCost: 0.9,
          isWalkable: true,
          cover: 0
        }, 1);
      }
      break;
      
    case "WATER":
      if (feature.flow === "horizontal") {
        drawLine({ x: 0, y: Math.floor(height / 3) }, { x: width - 1, y: Math.floor(height / 3) }, grid, {
          feature: "WATER",
          isWalkable: false,
          movementCost: 0.0,
          cover: 0
        }, feature.size === "large" ? 3 : 2);
      } else {
        drawLine({ x: Math.floor(width / 3), y: 0 }, { x: Math.floor(width / 3), y: height - 1 }, grid, {
          feature: "WATER",
          isWalkable: false,
          movementCost: 0.0,
          cover: 0
        }, feature.size === "large" ? 3 : 2);
      }
      break;
      
    case "WATERFALL":
      drawLine({ x: Math.floor(width / 2), y: 0 }, { x: Math.floor(width / 2), y: Math.floor(height / 2) }, grid, {
        feature: "WATERFALL",
        isWalkable: false,
        movementCost: 0.0,
        cover: 1,
        elevation: feature.height || 20
      }, 2);
      break;
      
    case "POND":
    case "WATER":
      if (feature.shape === "circular" || feature.size === "small") {
        drawCircle({ x: Math.floor(width / 3), y: Math.floor(height / 3) }, Math.min(5, Math.floor(width / 10)), grid, {
          feature: "WATER",
          isWalkable: false,
          movementCost: 0.0,
          cover: 0
        });
      }
      break;
      
    case "CLIFF":
      const cliffX = feature.direction === "east" ? width - 10 : 
                    feature.direction === "west" ? 10 : 
                    width - 10; // Default to east side
      drawLine({ x: cliffX, y: 0 }, { x: cliffX, y: height - 1 }, grid, {
        feature: "CLIFF",
        isWalkable: false,
        movementCost: 0.0,
        cover: 2,
        elevation: feature.height || 20
      }, 2);
      break;
      
    case "HILL":
      drawHill({ x: Math.floor(width / 2), y: Math.floor(height / 2) }, feature.elevation || 10, grid, width, height);
      break;
      
    case "STRUCTURE":
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      const structureSize = feature.size === "small" ? 2 : 3;
      drawRectangle({ x: centerX - structureSize, y: centerY - structureSize }, structureSize * 2, structureSize * 2, grid, {
        feature: "STRUCTURE",
        style: feature.style || "tower",
        isWalkable: false,
        movementCost: 0.0,
        cover: 3
      });
      break;
      
    case "BRIDGE":
      if (feature.direction === "horizontal") {
        drawLine({ x: Math.floor(width / 3), y: Math.floor(height / 2) }, 
                { x: Math.floor(width * 2 / 3), y: Math.floor(height / 2) }, grid, {
          feature: "BRIDGE",
          isWalkable: true,
          movementCost: 1.0,
          cover: 0
        }, 1);
      }
      break;
      
    case "WALL":
      drawLine({ x: Math.floor(width / 4), y: Math.floor(height / 4) }, 
              { x: Math.floor(width * 3 / 4), y: Math.floor(height / 4) }, grid, {
        feature: "WALL",
        isWalkable: false,
        movementCost: 0.0,
        cover: 3
      }, 1);
      break;
      
    case "TREE_LARGE":
    case "BOULDER":
      // Place a few random trees/boulders
      for (let i = 0; i < 5; i++) {
        const x = randomBetween(5, width - 5);
        const y = randomBetween(5, height - 5);
        if (grid[y] && grid[y][x] && !grid[y][x].feature) {
          grid[y][x].feature = feature.type;
          grid[y][x].cover = feature.cover || 1;
          grid[y][x].isWalkable = feature.type === "BOULDER" ? false : true;
        }
      }
      break;
      
    default:
      break;
  }
}

/* --------------------- Drawing Utilities ---------------------- */

/**
 * Draws a line from start to end on the grid
 */
function drawLine(start, end, grid, properties, width = 1) {
  const steps = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
  
  for (let i = 0; i <= steps; i++) {
    const x = Math.floor(start.x + (end.x - start.x) * (i / steps));
    const y = Math.floor(start.y + (end.y - start.y) * (i / steps));
    
    // Apply width (draw multiple cells perpendicular to line)
    for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
      const cellX = x;
      const cellY = y + w;
      
      if (grid[cellY] && grid[cellY][cellX]) {
        Object.assign(grid[cellY][cellX], properties);
      }
    }
  }
}

/**
 * Draws a winding path
 */
function drawWindingPath(grid, width, height, properties) {
  const startY = Math.floor(height / 2);
  let currentY = startY;
  
  for (let x = 0; x < width; x++) {
    // Add slight randomness to create winding effect
    if (Math.random() > 0.7) {
      currentY += Math.random() > 0.5 ? 1 : -1;
      currentY = Math.max(2, Math.min(height - 3, currentY)); // Keep in bounds
    }
    
    if (grid[currentY] && grid[currentY][x]) {
      Object.assign(grid[currentY][x], properties);
    }
  }
}

/**
 * Draws a circle
 */
function drawCircle(center, radius, grid, properties) {
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
      if (distance <= radius && grid[y] && grid[y][x]) {
        Object.assign(grid[y][x], properties);
      }
    }
  }
}

/**
 * Draws a rectangle
 */
function drawRectangle(topLeft, width, height, grid, properties) {
  for (let y = topLeft.y; y < topLeft.y + height; y++) {
    for (let x = topLeft.x; x < topLeft.x + width; x++) {
      if (grid[y] && grid[y][x]) {
        Object.assign(grid[y][x], properties);
      }
    }
  }
}

/**
 * Draws a hill with elevation gradient
 */
function drawHill(center, maxElevation, grid, mapWidth, mapHeight) {
  const radius = Math.min(mapWidth, mapHeight) / 4;
  
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
      if (distance <= radius && grid[y] && grid[y][x]) {
        const elevation = Math.floor(maxElevation * (1 - distance / radius));
        grid[y][x].elevation = elevation;
        grid[y][x].feature = elevation > 5 ? "HILL" : null;
      }
    }
  }
}

/**
 * Random number between a and b (inclusive)
 */
function randomBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

/**
 * Legacy function name for backwards compatibility
 */
export function generateSceneFromDescription(description, mapType = "hex") {
  return generateMapFromDescription(description, mapType);
}


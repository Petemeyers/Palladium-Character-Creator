/**
 * Palladium Fantasy Movement Rules
 * Based on OFFICIAL Palladium Fantasy RPG movement mechanics
 */

import { offsetToAxial } from "../utils/hexGridMath";

/**
 * OFFICIAL 1994 PALLADIUM FANTASY MOVEMENT SYSTEM:
 * - 1 melee round = 15 seconds
 * - Speed (SPD) × 6 = yards per melee round (running speed)
 * - Walking speed = ~half of running speed
 * - Movement per action = (Speed × 6) ÷ Attacks per Melee
 * - Physical Endurance (P.E.) determines how long character can sustain maximum speed
 * - Encumbrance and armor reduce effective SPD
 * - Movement can be combined with combat actions (uses walking speed)
 * - Charging = move + attack with bonuses/penalties
 *
 * For grid-based tactical combat (using 5-foot cells):
 * - Convert yards to feet: yards × 3 = feet
 * - When character takes combat actions, use walking speed (~half running speed)
 */

// Movement rates based on Speed attribute (OFFICIAL 1994 PALLADIUM RULES)
export const MOVEMENT_RATES = {
  calculateMovement: (speedAttribute) => {
    // OFFICIAL 1994 FORMULA: Speed × 18 = feet per melee (running speed)
    const feetPerMelee = speedAttribute * 18;

    return {
      // Running speed (official Palladium)
      running: feetPerMelee, // Speed × 18 feet per melee

      // Walking speed (~half of running speed)
      walking: Math.floor(feetPerMelee / 2), // Half speed when walking/fighting

      // Crawling/stealth (significantly slower)
      crawling: Math.floor(speedAttribute * 3), // ~1 yard per melee

      // Note: P.E. determines endurance, not listed here
      // Encumbrance penalties should reduce speedAttribute before calculation
    };
  },
};

// Engagement ranges (in feet)
export const ENGAGEMENT_RANGES = {
  MELEE: {
    name: "Melee Range",
    distance: 5, // Within 5 feet
    description: "Adjacent, can make melee attacks",
    canMeleeAttack: true,
    canMissileAttack: true, // Point-blank
  },
  CLOSE: {
    name: "Close Range",
    distance: 30, // 6-30 feet
    description: "Close quarters, can charge into melee",
    canMeleeAttack: false,
    canMissileAttack: true,
    canCharge: true,
  },
  MEDIUM: {
    name: "Medium Range",
    distance: 100, // 31-100 feet
    description: "Medium distance, missile weapons effective",
    canMeleeAttack: false,
    canMissileAttack: true,
    canCharge: false,
  },
  LONG: {
    name: "Long Range",
    distance: 300, // 101-300 feet
    description: "Long distance, only missile weapons",
    canMeleeAttack: false,
    canMissileAttack: true,
    canCharge: false,
  },
  EXTREME: {
    name: "Extreme Range",
    distance: 999, // 301+ feet
    description: "Very long distance, limited missile weapons",
    canMeleeAttack: false,
    canMissileAttack: true,
    canCharge: false,
  },
};

// Movement actions
export const MOVEMENT_ACTIONS = {
  MOVE: {
    name: "Move",
    actionCost: 1, // Costs 1 action during combat
    description: "Move up to combat speed (costs 1 action)",
    speedMultiplier: 1, // Uses combat speed
  },
  RUN: {
    name: "Run",
    actionCost: 1, // Costs 1 attack
    description: "Run up to running speed (costs 1 attack)",
    speedMultiplier: 2,
  },
  CHARGE: {
    name: "Charge",
    actionCost: 1, // Costs 1 attack
    description: "Move and attack with +2 strike, -2 parry/dodge",
    speedMultiplier: 2,
    bonuses: { strike: +2 },
    penalties: { parry: -2, dodge: -2 },
    requiresMinDistance: 10, // Must move at least 10 feet
  },
  WITHDRAW: {
    name: "Withdraw",
    actionCost: 1, // Costs 1 attack
    description: "Move away from melee without provoking attack",
    speedMultiplier: 1,
    special: "No opportunity attack",
  },
  DODGE: {
    name: "Dodge",
    actionCost: 1,
    description: "Move defensively (+bonus to dodge)",
    speedMultiplier: 0.5,
    bonuses: { dodge: +3 },
  },
  SPRINT: {
    name: "Sprint",
    actionCost: "all", // Uses all actions
    description: "Move at full sprint speed (no attacks)",
    speedMultiplier: 4,
    special: "Cannot attack this round",
  },
};

// Tactical zones for zone-based positioning
export const TACTICAL_ZONES = {
  FRONT_LINE: {
    name: "Front Line",
    description: "Melee combat zone",
    distance: 0,
    effects: "Can make melee attacks, target of melee attacks",
  },
  SKIRMISH: {
    name: "Skirmish Zone",
    description: "Close combat support",
    distance: 20,
    effects: "Can charge, short-range missiles",
  },
  SUPPORT: {
    name: "Support Zone",
    description: "Ranged support position",
    distance: 60,
    effects: "Missile weapons, spells, cannot be targeted by melee",
  },
  REAR: {
    name: "Rear Zone",
    description: "Back line position",
    distance: 100,
    effects: "Long-range support only, safe from most threats",
  },
};

// Grid system constants
// Map size presets based on physical tabletop norms (1" hexes)
export const MAP_PRESETS = {
  smallIndoor: { width: 20, height: 15 }, // Skirmish / dungeon room
  standard: { width: 30, height: 20 }, // Standard outdoor encounter
  largeOutdoor: { width: 40, height: 30 }, // Big set-piece battle (default)
};

// Get appropriate map preset based on terrain and map type
export function getMapPreset(terrain, mapType) {
  // Small indoor for dungeons/caves
  if (
    mapType === "square" ||
    terrain === "CAVE_INTERIOR" ||
    terrain === "URBAN"
  ) {
    return MAP_PRESETS.smallIndoor;
  }

  // Standard for most outdoor encounters
  if (
    terrain === "DENSE_FOREST" ||
    terrain === "LIGHT_FOREST" ||
    terrain === "ROCKY_TERRAIN"
  ) {
    return MAP_PRESETS.standard;
  }

  // Large outdoor for open ground, swamps, wilderness
  return MAP_PRESETS.largeOutdoor;
}

export const GRID_CONFIG = {
  CELL_SIZE: 5, // Each grid cell = 5 feet (1 hex = 5 feet across)
  GRID_WIDTH: 40, // Default: large outdoor (40 hexes wide = 200 feet)
  GRID_HEIGHT: 30, // Default: large outdoor (30 hexes tall = 150 feet)
  STARTING_DISTANCE: 60, // Start 60 feet apart (12 hexes)
  HEX_SIZE: 20, // Hex size in pixels (increased from 20px squares)
  USE_HEX_GRID: true, // Use hexagonal grid instead of square

  // Colors for different terrain/zones
  TERRAIN_COLORS: {
    normal: "#f0f0f0",
    difficult: "#d4a574", // Brown for difficult terrain
    blocked: "#666666", // Gray for blocked
    water: "#4da6ff", // Blue for water
    forest: "#5c8a5c", // Green for forest
  },
};

// Terrain types and movement modifiers
export const TERRAIN_TYPES = {
  NORMAL: {
    name: "Normal",
    movementMultiplier: 1.0,
    description: "Clear ground, no penalties",
  },
  DIFFICULT: {
    name: "Difficult Terrain",
    movementMultiplier: 0.5,
    description: "Rough ground, half movement",
  },
  FOREST: {
    name: "Forest",
    movementMultiplier: 0.75,
    description: "Trees and undergrowth, 3/4 movement",
  },
  WATER: {
    name: "Shallow Water",
    movementMultiplier: 0.5,
    description: "Shallow water, half movement",
  },
  BLOCKED: {
    name: "Blocked",
    movementMultiplier: 0,
    description: "Impassable terrain",
  },
};

// Hex grid utility functions
// Convert offset coordinates to cube coordinates for easier distance calculation
function offsetToCube(col, row) {
  // odd-r horizontal layout (flat-top) to cube
  // https://www.redblobgames.com/grids/hexagons/ (odd-r)
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

// Calculate distance between two hex positions
function hexDistance(pos1, pos2) {
  const cube1 = offsetToCube(pos1.x, pos1.y);
  const cube2 = offsetToCube(pos2.x, pos2.y);
  return (
    (Math.abs(cube1.x - cube2.x) +
      Math.abs(cube1.y - cube2.y) +
      Math.abs(cube1.z - cube2.z)) /
    2
  );
}

// Get all neighbors of a hex (6 directions)
export function getHexNeighbors(col, row) {
  const parity = row & 1; // 0 for even rows, 1 for odd rows

  // Neighbor offsets for odd-r horizontal layout (flat-top hexes)
  // Even rows are shifted left; odd rows are shifted right.
  const directions =
    parity === 0
      ? [
          [+1, 0],
          [0, -1],
          [-1, -1],
          [-1, 0],
          [-1, +1],
          [0, +1],
        ]
      : [
          [+1, 0],
          [+1, -1],
          [0, -1],
          [-1, 0],
          [0, +1],
          [+1, +1],
        ];

  return directions.map(([dx, dy]) => ({
    x: col + dx,
    y: row + dy,
  }));
}

// Calculate distance between two points (supports both hex and square grids)
export function calculateDistance(pos1, pos2) {
  if (GRID_CONFIG.USE_HEX_GRID) {
    // Use hex distance calculation
    return hexDistance(pos1, pos2) * GRID_CONFIG.CELL_SIZE;
  } else {
    // Use Pythagorean theorem for square grid
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy) * GRID_CONFIG.CELL_SIZE;
  }
}

// Get engagement range category
export function getEngagementRange(distance) {
  if (distance <= ENGAGEMENT_RANGES.MELEE.distance) {
    return ENGAGEMENT_RANGES.MELEE;
  } else if (distance <= ENGAGEMENT_RANGES.CLOSE.distance) {
    return ENGAGEMENT_RANGES.CLOSE;
  } else if (distance <= ENGAGEMENT_RANGES.MEDIUM.distance) {
    return ENGAGEMENT_RANGES.MEDIUM;
  } else if (distance <= ENGAGEMENT_RANGES.LONG.distance) {
    return ENGAGEMENT_RANGES.LONG;
  } else {
    return ENGAGEMENT_RANGES.EXTREME;
  }
}

// Check if position is valid
export function isValidPosition(
  x,
  y,
  gridWidth = GRID_CONFIG.GRID_WIDTH,
  gridHeight = GRID_CONFIG.GRID_HEIGHT
) {
  return x >= 0 && x < gridWidth && y >= 0 && y < gridHeight;
}

// Calculate movement range from a position using Palladium movement system
export function getMovementRange(
  position,
  speed,
  attacksPerMelee = 1,
  terrain = {},
  isRunning = false
) {
  // Use official 1994 Palladium movement: Speed × 18 feet per melee (running)
  const feetPerMelee = speed * 18;
  const feetPerAction = feetPerMelee / attacksPerMelee;

  // Use walking speed (combat movement) for movement range calculation
  // Unless running mode is enabled, then use full running speed
  // When running, can move at full speed (Speed × 18 feet per action)
  // When walking (combat movement), moves at half speed to allow attacking
  // Per Palladium rules:
  // - Walking (combat): ~1/2 speed (allows attacking while moving)
  // - Running: Full speed (Speed × 18 feet per action) = 2x walking
  const movementFeetPerAction = isRunning
    ? feetPerAction // Running: full speed per action (2x walking speed)
    : Math.floor(feetPerAction * 0.5); // Walking: half speed for combat movement
  const hexesCanMove = Math.max(
    1,
    Math.floor(movementFeetPerAction / GRID_CONFIG.CELL_SIZE)
  );

  // Debug logging to verify running mode
  console.log("🏃 Movement calculation:", {
    isRunning,
    speed,
    feetPerMelee,
    feetPerAction,
    movementFeetPerAction,
    hexesCanMove,
    movementMode: isRunning ? "RUNNING" : "WALKING",
  });

  const validPositions = [];
  const visited = new Set();

  // Color-coded movement ranges (4 colors for different action costs)
  // Each color represents 15 seconds of movement (2 attacks per 15 seconds)
  const movementRanges = {
    green: Math.floor(hexesCanMove), // 1 action (15 seconds)
    yellow: Math.floor(hexesCanMove * 2), // 2 actions (30 seconds)
    orange: Math.floor(hexesCanMove * 3), // 3 actions (45 seconds)
    red: Math.floor(hexesCanMove * 4), // 4 actions (60 seconds)
  };

  console.log("🎨 Movement ranges:", movementRanges);

  if (GRID_CONFIG.USE_HEX_GRID) {
    // Use flood-fill algorithm for hex grid
    const queue = [{ pos: position, distance: 0 }];
    visited.add(`${position.x},${position.y}`);

    while (queue.length > 0) {
      const { pos, distance } = queue.shift();

      if (distance < movementRanges.red) {
        const neighbors = getHexNeighbors(pos.x, pos.y);

        for (const neighbor of neighbors) {
          const key = `${neighbor.x},${neighbor.y}`;
          if (!visited.has(key) && isValidPosition(neighbor.x, neighbor.y)) {
            visited.add(key);
            const actualDistance = (distance + 1) * GRID_CONFIG.CELL_SIZE;
            const hexDistance = distance + 1;

            // Determine color and action cost based on distance
            let color = "green";
            let actionCost = 1;

            if (hexDistance <= movementRanges.green) {
              color = "green";
              actionCost = 1;
            } else if (hexDistance <= movementRanges.yellow) {
              color = "yellow";
              actionCost = 2;
            } else if (hexDistance <= movementRanges.orange) {
              color = "orange";
              actionCost = 3;
            } else if (hexDistance <= movementRanges.red) {
              color = "red";
              actionCost = 4;
            }

            validPositions.push({
              x: neighbor.x,
              y: neighbor.y,
              distance: actualDistance,
              hexDistance: hexDistance,
              color: color,
              actionCost: actionCost,
            });
            queue.push({ pos: neighbor, distance: distance + 1 });
          }
        }
      }
    }
  } else {
    // Square grid calculation
    for (let dx = -hexesCanMove; dx <= hexesCanMove; dx++) {
      for (let dy = -hexesCanMove; dy <= hexesCanMove; dy++) {
        const newX = position.x + dx;
        const newY = position.y + dy;

        // Check if within grid and movement range
        if (isValidPosition(newX, newY)) {
          const distance = Math.sqrt(dx * dx + dy * dy) * GRID_CONFIG.CELL_SIZE;
          const hexDistance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= movementFeetPerAction * 4) {
            // Allow up to 4 actions worth of movement
            // Determine color and action cost based on distance
            let color = "green";
            let actionCost = 1;

            if (hexDistance <= movementRanges.green) {
              color = "green";
              actionCost = 1;
            } else if (hexDistance <= movementRanges.yellow) {
              color = "yellow";
              actionCost = 2;
            } else if (hexDistance <= movementRanges.orange) {
              color = "orange";
              actionCost = 3;
            } else if (hexDistance <= movementRanges.red) {
              color = "red";
              actionCost = 4;
            }

            validPositions.push({
              x: newX,
              y: newY,
              distance,
              hexDistance: hexDistance,
              color: color,
              actionCost: actionCost,
            });
          }
        }
      }
    }
  }

  console.log(
    `✅ Generated ${validPositions.length} valid positions with colors:`,
    validPositions.map((p) => ({ x: p.x, y: p.y, color: p.color })).slice(0, 10)
  );

  return validPositions;
}

// ------------------------------------------------------------
// Creature sizing + segmented bodies (head/body/tail)
// ------------------------------------------------------------

function oppositeDir(dir) {
  const d = (dir || "").toUpperCase();
  const map = { E: "W", W: "E", NE: "SW", NW: "SE", SE: "NW", SW: "NE" };
  return map[d] || "W";
}

// Flat-top, odd-r offset neighbors (row-based offset)
function stepOddR(col, row, dir) {
  const odd = row % 2 === 1;
  switch ((dir || "W").toUpperCase()) {
    case "E":
      return { x: col + 1, y: row };
    case "W":
      return { x: col - 1, y: row };
    case "NE":
      return { x: col + (odd ? 1 : 0), y: row - 1 };
    case "NW":
      return { x: col + (odd ? 0 : -1), y: row - 1 };
    case "SE":
      return { x: col + (odd ? 1 : 0), y: row + 1 };
    case "SW":
      return { x: col + (odd ? 0 : -1), y: row + 1 };
    default:
      return { x: col - 1, y: row };
  }
}

function buildSegmentOffsets(totalHexes, tailDir) {
  // Returns offsets relative to head at (0,0)
  const offsets = [{ dx: 0, dy: 0, part: "head", index: 0 }];
  let cx = 0;
  let cy = 0;
  for (let i = 1; i < totalHexes; i++) {
    const next = stepOddR(cx, cy, tailDir);
    const dx = next.x - 0;
    const dy = next.y - 0;
    offsets.push({ dx, dy, part: "segment", index: i });
    cx = next.x;
    cy = next.y;
  }
  return offsets;
}

// Calculate creature size in hexes
export function getCreatureSize(creature) {
  if (!creature) return { width: 1, length: 1 };

  // ✅ Segmented body support (preferred if present)
  // Support both old format (segments array) and new format (headHexes/bodyHexes/tailHexes)
  if (creature.segmentedBody) {
    let headHexes = 1;
    let bodyHexes = 0;
    let tailHexes = 0;

    if (creature.segmentedBody.headHexes !== undefined) {
      // New format: headHexes, bodyHexes, tailHexes
      headHexes = creature.segmentedBody.headHexes ?? 1;
      bodyHexes = creature.segmentedBody.bodyHexes ?? 0;
      tailHexes = creature.segmentedBody.tailHexes ?? 0;
    } else if (
      creature.segmentedBody.segments &&
      Array.isArray(creature.segmentedBody.segments)
    ) {
      // Old format: segments array
      creature.segmentedBody.segments.forEach((seg) => {
        if (seg.type === "head") headHexes = seg.hexes ?? 1;
        else if (seg.type === "body") bodyHexes += seg.hexes ?? 0;
        else if (seg.type === "tail") tailHexes += seg.hexes ?? 0;
      });
    }

    const totalHexes = Math.max(1, headHexes + bodyHexes + tailHexes);

    const facing =
      creature.facingDirection ??
      creature.facing ??
      creature.direction ??
      creature.segmentedBody.defaultDirection ??
      "E";

    // Tail should extend BEHIND the head (opposite of facing)
    const tailDir = oppositeDir(facing);

    const offsets = buildSegmentOffsets(totalHexes, tailDir).map((o) => {
      // Mark which ones are "body" vs "tail" for icon choice
      if (o.index === 0) return { ...o, part: "head" };
      // indices: 1..bodyHexes => body, rest => tail
      const isTail = o.index > bodyHexes;
      return { ...o, part: isTail ? "tail" : "body" };
    });

    return {
      width: totalHexes,
      length: 1,
      segmented: true,
      facing,
      tailDir,
      segmentOffsets: offsets,
      totalHexes,
    };
  }

  // Fallback: legacy size parsing
  if (!creature.size) return { width: 1, length: 1 };

  const size = creature.size.toLowerCase();

  // Extract dimensions from size string
  let length = 0;

  // Common size patterns - only use length/width
  if (size.includes("45 ft long") || size.includes("45 feet long")) {
    length = 45;
  } else if (size.includes("10 feet long") || size.includes("10 ft long")) {
    length = 10;
  } else if (size.includes("8-10 feet long")) {
    length = 9; // Average
  } else if (size.includes("5 feet long")) {
    length = 5;
  } else if (size.includes("4 feet long")) {
    length = 4;
  }

  // Convert to hexes (1 hex = 5 feet)
  const widthInHexes = Math.ceil(length / 5);

  // Minimum 1 hex, maximum based on actual size
  return {
    width: Math.max(1, widthInHexes),
    length: 1,
  };
}

// Get initial starting positions for combat
// Positions are placed within the hexagonal map boundary and centered
export function getInitialPositions(playerCount, enemyCount) {
  const positions = {
    players: [],
    enemies: [],
  };

  const centerCol = Math.floor(GRID_CONFIG.GRID_WIDTH / 2);
  const centerRow = Math.floor(GRID_CONFIG.GRID_HEIGHT / 2);
  const hexRadius =
    Math.max(GRID_CONFIG.GRID_WIDTH, GRID_CONFIG.GRID_HEIGHT) / 2;

  // Helper to check if position is within hex boundary
  const isWithinHexBoundary = (col, row) => {
    // Simple check: ensure we're within the grid bounds
    if (
      col < 0 ||
      col >= GRID_CONFIG.GRID_WIDTH ||
      row < 0 ||
      row >= GRID_CONFIG.GRID_HEIGHT
    ) {
      return false;
    }

    // For hexagonal maps, check hex distance from center using axial coordinates
    const { q, r } = offsetToAxial(col, row);
    const centerAxial = offsetToAxial(centerCol, centerRow);

    // Calculate hex distance from center
    const dq = q - centerAxial.q;
    const dr = r - centerAxial.r;
    const ds = -(q + r) - -(centerAxial.q + centerAxial.r);
    const distance = (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;

    // Keep positions within ~85% of the radius to ensure they're well within the visible hex boundary
    return distance <= hexRadius * 0.85;
  };

  // Players start on the left-center side, within the hex boundary
  // Position them about 1/3 from the left edge, centered vertically
  const playerStartX = Math.max(5, Math.floor(centerCol * 0.4)); // ~20% from left, but at least 5 hexes in
  const playerStartY = centerRow;

  for (let i = 0; i < playerCount; i++) {
    let x = playerStartX + i;
    let y = playerStartY;

    // If position is outside hex boundary, adjust it
    let attempts = 0;
    while (!isWithinHexBoundary(x, y) && attempts < 10) {
      // Try moving closer to center
      if (x > centerCol) x--;
      if (y > centerRow) y--;
      if (y < centerRow) y++;
      attempts++;
    }

    // If still not valid, use a safe position near center-left
    if (!isWithinHexBoundary(x, y)) {
      x = Math.max(5, centerCol - 8);
      y = centerRow + (i - Math.floor(playerCount / 2));
    }

    positions.players.push({
      x: x,
      y: y,
      index: i,
    });
  }

  // Enemies start on the right-center side, within the hex boundary
  // Position them about 1/3 from the right edge, centered vertically
  const enemyStartX = Math.min(
    GRID_CONFIG.GRID_WIDTH - 5,
    Math.floor(centerCol * 1.6)
  ); // ~60% from left
  const enemyStartY = centerRow;

  for (let i = 0; i < enemyCount; i++) {
    let x = enemyStartX - i;
    let y = enemyStartY + (i - Math.floor(enemyCount / 2)); // Slight vertical spread

    // If position is outside hex boundary, adjust it
    let attempts = 0;
    while (!isWithinHexBoundary(x, y) && attempts < 10) {
      // Try moving closer to center
      if (x < centerCol) x++;
      if (y > centerRow) y--;
      if (y < centerRow) y++;
      attempts++;
    }

    // If still not valid, use a safe position near center-right
    if (!isWithinHexBoundary(x, y)) {
      x = Math.min(GRID_CONFIG.GRID_WIDTH - 5, centerCol + 8);
      y = centerRow + (i - Math.floor(enemyCount / 2));
    }

    positions.enemies.push({
      x: x,
      y: y,
      index: i,
    });
  }

  return positions;
}

// Check line of sight between two positions
export function hasLineOfSight(pos1, pos2, blockedCells = []) {
  // Bresenham's line algorithm to check for obstacles
  const dx = Math.abs(pos2.x - pos1.x);
  const dy = Math.abs(pos2.y - pos1.y);
  const sx = pos1.x < pos2.x ? 1 : -1;
  const sy = pos1.y < pos2.y ? 1 : -1;
  let err = dx - dy;

  let x = pos1.x;
  let y = pos1.y;

  while (x !== pos2.x || y !== pos2.y) {
    // Check if current cell is blocked
    if (blockedCells.some((cell) => cell.x === x && cell.y === y)) {
      return false;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return true;
}

// Get path between two positions (simple A* pathfinding)
export function findPath(start, end, blockedCells = []) {
  // Simple straight-line path for now
  // Can be enhanced with A* pathfinding later
  const path = [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(start.x + dx * t);
    const y = Math.round(start.y + dy * t);
    path.push({ x, y });
  }

  return path;
}

export default {
  MOVEMENT_RATES,
  ENGAGEMENT_RANGES,
  MOVEMENT_ACTIONS,
  TACTICAL_ZONES,
  GRID_CONFIG,
  TERRAIN_TYPES,
  calculateDistance,
  getEngagementRange,
  isValidPosition,
  getMovementRange,
  getCreatureSize,
  getInitialPositions,
  hasLineOfSight,
  findPath,
  getHexNeighbors,
};

/**
 * Tree Asset Helpers
 *
 * Utilities for working with tree assets and instances.
 * Tree assets are reusable definitions; tree instances are placed on the map.
 * Instances go in arenaEnvironment.objects and are automatically used by the AI.
 */

import treeAssetsData from "../data/treeAssets.json";

/**
 * Get a tree asset template by asset ID
 * @param {string} assetId - e.g., "spruce_dense", "oak_mature"
 * @returns {Object|null} Tree asset template or null
 */
export function getTreeAsset(assetId) {
  return treeAssetsData.treeAssets[assetId] || null;
}

/**
 * Create a tree instance from an asset template
 * This creates an object that can be added to arenaEnvironment.objects
 *
 * @param {string} assetId - Tree asset ID (e.g., "spruce_dense")
 * @param {Object} gridPosition - Grid position {x, y}
 * @param {Object} options - Optional overrides (id, yaw, scale, etc.)
 * @returns {Object} Tree instance ready for arenaEnvironment.objects
 */
export function createTreeInstance(assetId, gridPosition, options = {}) {
  const asset = getTreeAsset(assetId);
  if (!asset) {
    console.warn(`[TreeAsset] Unknown asset: ${assetId}`);
    return null;
  }

  // Generate unique instance ID
  const instanceId =
    options.id || `tree_${assetId}_${gridPosition.x}_${gridPosition.y}`;

  // Calculate yaw (random if asset specifies, or use provided)
  let yawRad = options.yawRad;
  if (yawRad === undefined && asset.model?.randomYaw) {
    yawRad = Math.random() * Math.PI * 2;
  } else if (yawRad === undefined) {
    yawRad = 0;
  }

  // Build the tree instance
  const instance = {
    id: instanceId,
    assetId: assetId,
    kind: "TREE", // For AI filtering

    // Grid placement (authoritative logic position)
    grid: { x: gridPosition.x, y: gridPosition.y },

    // World transform (for rendering; can be derived from grid)
    transform: {
      worldPos: { x: 0, y: 0, z: 0 }, // Will be calculated from grid in 3D renderer
      yawRad: yawRad,
      scale: options.scale ?? asset.model?.scale ?? 1.0,
    },

    // Runtime state
    state: {
      perchOccupants: {}, // keyed by perchId: creatureId
      destroyed: false,
      hp: null, // optional for future chop/burn mechanics
    },

    // Copy tags for AI compatibility
    tags: [...(asset.tags || [])],
  };

  return instance;
}

/**
 * Find available perches on a tree instance for a flying creature
 *
 * @param {Object} treeInstance - Tree instance from arenaEnvironment.objects
 * @param {Object} creature - Creature object with sizeCategory
 * @returns {Array} Array of available perches with world positions
 */
export function findAvailablePerches(treeInstance, creature) {
  if (!treeInstance?.assetId || treeInstance.kind !== "TREE") return [];

  const asset = getTreeAsset(treeInstance.assetId);
  if (!asset?.perches) return [];

  const creatureSize = creature.sizeCategory || "MEDIUM";
  const sizeOrder = {
    TINY: 0,
    SMALL: 1,
    MEDIUM: 2,
    LARGE: 3,
    HUGE: 4,
    GIANT: 5,
  };
  const creatureSizeValue = sizeOrder[creatureSize] ?? 2;

  // Get occupied perches
  const occupiedPerchIds = new Set(
    Object.keys(treeInstance.state?.perchOccupants || {})
  );

  return asset.perches
    .filter((perch) => {
      // Check if perch is already occupied
      if (occupiedPerchIds.has(perch.id)) return false;

      // Check size compatibility
      const perchMaxSize = sizeOrder[perch.maxCreatureSize] ?? 2;
      if (creatureSizeValue > perchMaxSize) return false;

      // For now, we only track one occupant per perch (by perch ID)
      // If you need multiple occupants, you'd need to track arrays
      // The occupancy check is already done above (occupiedPerchIds)

      return true;
    })
    .map((perch) => {
      // Convert local position (feet) to world position
      // Support both schemas:
      // - localPosFt: {x, y, z} (current format)
      // - localOffsetFeet: {dx, dy, dz} (alternative format)
      const lp = perch.localPosFt;
      const lo = perch.localOffsetFeet;

      // Compatibility layer: support both formats
      const local = lp
        ? { x: lp.x, y: lp.y, z: lp.z }
        : lo
        ? {
            x: lo.dx ?? 0,
            y: lo.dz ?? 0, // dz is height/altitude
            z: lo.dy ?? 0, // dy is sideways
          }
        : { x: 0, y: 0, z: 0 };

      return {
        ...perch,
        worldPosition: {
          // Grid position (hex coordinates)
          gridX: treeInstance.grid.x,
          gridY: treeInstance.grid.y,
          // Local offset in feet (x, z are horizontal, y is vertical/altitude)
          localOffsetFeet: {
            x: local.x,
            y: local.y, // This is the altitude in feet
            z: local.z,
          },
          // Absolute altitude for the creature
          altitudeFeet: local.y,
        },
      };
    });
}

/**
 * Reserve a perch for a creature
 *
 * @param {Object} treeInstance - Tree instance
 * @param {string} perchId - Perch ID to reserve
 * @param {string} creatureId - Creature ID reserving the perch
 * @returns {boolean} True if reservation succeeded
 */
export function reservePerch(treeInstance, perchId, creatureId) {
  if (!treeInstance?.state) return false;

  const asset = getTreeAsset(treeInstance.assetId);
  if (!asset) return false;

  const perch = asset.perches.find((p) => p.id === perchId);
  if (!perch) return false;

  // Check if already occupied
  if (treeInstance.state.perchOccupants[perchId]) {
    return false; // Already occupied
  }

  // Reserve it
  treeInstance.state.perchOccupants[perchId] = creatureId;
  return true;
}

/**
 * Release a perch reservation
 *
 * @param {Object} treeInstance - Tree instance
 * @param {string} perchId - Perch ID to release
 * @param {string} creatureId - Creature ID (for validation)
 * @returns {boolean} True if release succeeded
 */
export function releasePerch(treeInstance, perchId, creatureId) {
  if (!treeInstance?.state) return false;

  // Validate that this creature owns the perch
  if (treeInstance.state.perchOccupants[perchId] !== creatureId) {
    return false;
  }

  delete treeInstance.state.perchOccupants[perchId];
  return true;
}

/**
 * Find nearest tree with available perches for a flying creature
 * Searches through arenaEnvironment.objects
 *
 * @param {Object} creature - Flying creature
 * @param {Array} objects - Array from arenaEnvironment.objects
 * @param {Object} creaturePosition - Creature's current position {x, y}
 * @param {number} maxRadiusHexes - Maximum search radius
 * @returns {Object|null} Nearest tree with available perches, or null
 */
export function findNearestPerchableTree(
  creature,
  objects,
  creaturePosition,
  maxRadiusHexes = 10
) {
  if (!creature || !objects || !creaturePosition) return null;

  // Filter to trees with perchable tag
  const trees = objects.filter(
    (obj) =>
      obj.kind === "TREE" && obj.tags?.includes("perchable") && obj.assetId
  );

  if (!trees.length) return null;

  // Find trees with available perches
  const treesWithPerches = trees
    .map((tree) => {
      const perches = findAvailablePerches(tree, creature);
      if (!perches.length) return null;

      // Calculate distance
      const dx = tree.grid.x - creaturePosition.x;
      const dy = tree.grid.y - creaturePosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxRadiusHexes) return null;

      return {
        tree,
        perches,
        distance: dist,
      };
    })
    .filter(Boolean);

  if (!treesWithPerches.length) return null;

  // Return nearest
  treesWithPerches.sort((a, b) => a.distance - b.distance);
  return treesWithPerches[0];
}

/**
 * Convert tree instance to simple AI object shape
 * Trees already match the expected shape: { id, position: {x,y}, tags: [...] }
 * But we need to map grid -> position for AI compatibility
 *
 * @param {Object} treeInstance - Full tree instance
 * @returns {Object} Simple AI-compatible object
 */
export function toSimpleAIObject(treeInstance) {
  // AI expects { id, position: {x,y}, tags: [...] }
  // Tree instances use grid: {x,y}, so we map that to position
  return {
    id: treeInstance.id,
    position: { x: treeInstance.grid.x, y: treeInstance.grid.y },
    tags: treeInstance.tags || [],
  };
}

/**
 * Check if a tree blocks movement at a grid position
 *
 * @param {Object} treeInstance - Tree instance
 * @param {Object} position - Position to check {x, y}
 * @returns {boolean} True if movement is blocked
 */
export function treeBlocksMovement(treeInstance, position) {
  if (!treeInstance || treeInstance.kind !== "TREE") return false;
  if (treeInstance.state?.destroyed) return false;

  const asset = getTreeAsset(treeInstance.assetId);
  if (!asset?.interaction?.blocksMovement) return false;

  // Check if position matches tree's grid position
  return (
    position.x === treeInstance.grid.x && position.y === treeInstance.grid.y
  );
}

/**
 * Check if a tree provides cover at a given position
 *
 * @param {Object} treeInstance - Tree instance
 * @param {Object} position - Position to check {x, y}
 * @returns {Object|null} Cover info or null
 */
export function getTreeCover(treeInstance, position) {
  if (!treeInstance || treeInstance.kind !== "TREE") return null;
  if (!treeInstance.tags?.includes("cover")) return null;

  const asset = getTreeAsset(treeInstance.assetId);
  if (!asset?.interaction?.cover) return null;

  // Check if position is within tree's footprint
  const treePos = treeInstance.grid;
  const dx = position.x - treePos.x;
  const dy = position.y - treePos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Tree occupies 1 hex (5 ft diameter = 2.5 ft radius)
  if (dist > 0.5) return null;

  const cover = asset.interaction.cover;
  return {
    type: "soft",
    softBonus: cover.softCoverBonus || 0,
    hardBonus: cover.hardCoverBonus || 0,
    concealmentPct: cover.concealmentPct || 0,
    source: treeInstance.id,
  };
}

/**
 * Check if a tree blocks line of sight
 *
 * @param {Object} treeInstance - Tree instance
 * @param {Object} fromPos - Source position {x, y}
 * @param {Object} toPos - Target position {x, y}
 * @returns {boolean} True if LOS is blocked
 */
export function treeBlocksLOS(treeInstance, fromPos, toPos) {
  if (!treeInstance || treeInstance.kind !== "TREE") return false;
  if (treeInstance.state?.destroyed) return false;

  const asset = getTreeAsset(treeInstance.assetId);
  const losMode = asset?.interaction?.blocksLOS;
  if (!losMode || losMode === "none") return false;
  if (losMode === "full") return true; // Always blocks

  // For "partial", check if line passes through tree's cell
  const treePos = treeInstance.grid;
  const minX = Math.min(fromPos.x, toPos.x);
  const maxX = Math.max(fromPos.x, toPos.x);
  const minY = Math.min(fromPos.y, toPos.y);
  const maxY = Math.max(fromPos.y, toPos.y);

  return (
    treePos.x >= minX &&
    treePos.x <= maxX &&
    treePos.y >= minY &&
    treePos.y <= maxY
  );
}

/**
 * Get all tree asset IDs available
 * @returns {Array} Array of tree asset IDs
 */
export function getAllTreeAssets() {
  return Object.keys(treeAssetsData.treeAssets);
}

/**
 * Calculate hex distance between two grid positions
 * @param {Object} pos1 - Position {x, y}
 * @param {Object} pos2 - Position {x, y}
 * @returns {number} Distance in hexes
 */
function hexDistance(pos1, pos2) {
  // Convert offset coordinates to cube coordinates
  function offsetToCube(col, row) {
    const x = col - (row - (row & 1)) / 2;
    const z = row;
    const y = -x - z;
    return { x, y, z };
  }

  const cube1 = offsetToCube(pos1.x, pos1.y);
  const cube2 = offsetToCube(pos2.x, pos2.y);
  return (
    (Math.abs(cube1.x - cube2.x) +
      Math.abs(cube1.y - cube2.y) +
      Math.abs(cube1.z - cube2.z)) /
    2
  );
}

/**
 * Calculate angle in degrees from pos1 to pos2
 * @param {Object} pos1 - Source position {x, y}
 * @param {Object} pos2 - Target position {x, y}
 * @returns {number} Angle in degrees (0-360)
 */
function angleToDeg(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;
  return angleDeg < 0 ? angleDeg + 360 : angleDeg;
}

/**
 * Calculate smallest angle difference between two angles (in degrees)
 * @param {number} angle1 - First angle (0-360)
 * @param {number} angle2 - Second angle (0-360)
 * @returns {number} Smallest difference (0-180)
 */
// eslint-disable-next-line no-unused-vars
function smallestAngleDiffDeg(angle1, angle2) {
  let diff = Math.abs(angle1 - angle2);
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Pick the best perch for a flying creature based on intent and weighted factors
 *
 * @param {Object} params - Parameters
 * @param {Object} params.flyer - Flying creature object
 * @param {Object} params.flyerGrid - Flyer's current grid position {x, y}
 * @param {Object} params.targetGrid - Target's grid position {x, y} (optional)
 * @param {Object} params.arenaEnvironment - Arena environment with objects array
 * @param {Object} params.options - Options
 * @param {string} params.options.intent - "SCOUT" | "STALK" | "STRIKE"
 * @param {number} params.options.maxTreeSearchCells - Max search radius in hexes
 * @param {number} params.options.preferDistanceToTargetCells - Ideal distance to target
 * @returns {Object|null} Best perch choice or null
 */
export function pickBestPerchForFlyer({
  flyer,
  flyerGrid,
  targetGrid,
  arenaEnvironment,
  options = {},
}) {
  const {
    intent = "STALK",
    maxTreeSearchCells = 8,
    preferDistanceToTargetCells = 3,
  } = options;

  if (!flyer || !flyerGrid || !arenaEnvironment?.objects) {
    return null;
  }

  // Get all trees with available perches
  const objects = arenaEnvironment.objects || [];
  const trees = objects.filter(
    (obj) =>
      obj.kind === "TREE" && obj.tags?.includes("perchable") && obj.assetId
  );

  if (!trees.length) return null;

  // Collect all candidate perches
  const candidates = [];

  for (const tree of trees) {
    const treeDist = hexDistance(flyerGrid, tree.grid);
    if (treeDist > maxTreeSearchCells) continue;

    const perches = findAvailablePerches(tree, flyer);
    if (!perches.length) continue;

    for (const perch of perches) {
      const treeGrid = tree.grid;
      const altitudeFeet = perch.worldPosition.altitudeFeet;
      const localOffsetFeet = perch.worldPosition.localOffsetFeet;

      // Calculate distances
      const toFlyerDist = hexDistance(treeGrid, flyerGrid);
      const toTargetDist = targetGrid ? hexDistance(treeGrid, targetGrid) : 0;

      // Calculate approach angle (if target exists)
      let approachAzimuthDeg = 0;
      if (targetGrid) {
        approachAzimuthDeg = angleToDeg(treeGrid, targetGrid);
      }

      candidates.push({
        treeId: tree.id,
        treeGrid,
        perchId: perch.id,
        altitudeFeet,
        localOffsetFeet,
        toFlyerDist,
        toTargetDist,
        approachAzimuthDeg,
      });
    }
  }

  if (!candidates.length) return null;

  // Weight configuration based on intent
  const weights = {
    SCOUT: {
      height: 0.4, // Prefer high perches
      toFlyer: 0.2,
      toTarget: 0.1, // Don't care much about target distance
      idealTargetDist: 0.1,
      approach: 0.2,
    },
    STALK: {
      height: 0.2, // Moderate height
      toFlyer: 0.2,
      toTarget: 0.3, // Prefer closer to target
      idealTargetDist: 0.2,
      approach: 0.1,
    },
    STRIKE: {
      height: 0.1, // Prefer lower perches for quick strikes
      toFlyer: 0.2,
      toTarget: 0.4, // Very close to target
      idealTargetDist: 0.2,
      approach: 0.1,
    },
  };

  const W = weights[intent] || weights.STALK;

  // Height preferences by intent
  const heightPrefs = {
    SCOUT: { min: 40, ideal: 60, max: 100 },
    STALK: { min: 15, ideal: 25, max: 45 },
    STRIKE: { min: 5, ideal: 12, max: 25 },
  };

  const heightPref = heightPrefs[intent] || heightPrefs.STALK;

  // Find best perch
  let best = null;

  for (const c of candidates) {
    // Height score (prefer ideal height for intent)
    let heightScore = 0;
    if (c.altitudeFeet >= heightPref.min && c.altitudeFeet <= heightPref.max) {
      const distFromIdeal = Math.abs(c.altitudeFeet - heightPref.ideal);
      const maxDist = Math.max(
        heightPref.ideal - heightPref.min,
        heightPref.max - heightPref.ideal
      );
      heightScore = clamp(1 - distFromIdeal / maxDist, 0, 1);
    }

    // Distance to flyer (closer is better, normalized)
    const toFlyerScore = clamp(1 - c.toFlyerDist / maxTreeSearchCells, 0, 1);

    // Distance to target (closer is better for STRIKE, farther for SCOUT)
    let toTargetScore = 0;
    if (targetGrid) {
      if (intent === "SCOUT") {
        // For scouting, prefer farther from target
        toTargetScore = clamp(c.toTargetDist / maxTreeSearchCells, 0, 1);
      } else {
        // For stalking/striking, prefer closer
        toTargetScore = clamp(1 - c.toTargetDist / maxTreeSearchCells, 0, 1);
      }
    }

    // Ideal target distance score
    let idealTargetDistScore = 0;
    if (targetGrid) {
      const distFromIdeal = Math.abs(
        c.toTargetDist - preferDistanceToTargetCells
      );
      idealTargetDistScore = clamp(
        1 - distFromIdeal / maxTreeSearchCells,
        0,
        1
      );
    }

    // Approach angle score (prefer approaching from behind/above)
    let approachScore = 0.5; // Default neutral score
    if (targetGrid) {
      // For now, use neutral approach score
      // TODO: If perch has localFacingHint, calculate preferred approach angle
      // Example implementation:
      // const treeToTargetAz = angleToDeg(c.treeGrid, targetGrid);
      // const preferredAz = perch.localFacingHint ? angleFromVector(perch.localFacingHint) : treeToTargetAz;
      // const diff = smallestAngleDiffDeg(treeToTargetAz, preferredAz);
      // approachScore = clamp(1 - diff / 180, 0, 1);
    }

    // Calculate total score (lower is better, so we invert some scores)
    const score =
      W.height * (1 - heightScore) + // Invert: lower score = better
      W.toFlyer * (1 - toFlyerScore) + // Invert: closer = better
      W.toTarget * (1 - toTargetScore) + // Invert: closer/farther based on intent
      W.idealTargetDist * (1 - idealTargetDistScore) + // Invert: closer to ideal = better
      W.approach * (1 - approachScore); // Invert: better approach = better

    if (!best || score < best.score) {
      best = { ...c, score };
    }
  }

  if (!best) return null;

  return {
    treeId: best.treeId,
    treeGrid: best.treeGrid,
    perchId: best.perchId,
    altitudeFeet: best.altitudeFeet,
    localOffsetFeet: best.localOffsetFeet,
    score: best.score,
  };
}

/**
 * Generate a forest map with trees
 * Returns an array of tree instances ready for arenaEnvironment.objects
 *
 * @param {Object} options - Generation options
 * @returns {Array} Array of tree instances
 */
export function generateForestMap(options = {}) {
  const {
    assetId = "spruce_dense",
    startX = 5,
    endX = 20,
    startY = 5,
    endY = 20,
    spacing = 3,
    density = 0.7, // 70% chance per potential position
  } = options;

  const trees = [];

  for (let x = startX; x < endX; x += spacing) {
    for (let y = startY; y < endY; y += spacing) {
      if (Math.random() <= density) {
        const tree = createTreeInstance(assetId, { x, y });
        if (tree) {
          trees.push(tree);
        }
      }
    }
  }

  return trees;
}

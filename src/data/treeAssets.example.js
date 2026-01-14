/**
 * Tree Assets Usage Example
 * 
 * This file demonstrates how to use tree assets with arenaEnvironment.objects.
 * Tree assets are reusable definitions; tree instances are placed on the map.
 */

import {
  createTreeInstance,
  findNearestPerchableTree,
  findAvailablePerches,
  reservePerch,
  releasePerch,
  pickBestPerchForFlyer,
  generateForestMap,
  getAllTreeAssets,
} from "../utils/treeAssetHelpers";

/**
 * Example: Add trees to arenaEnvironment.objects
 * 
 * In your CombatPage.jsx or terrain setup:
 * 
 * ```javascript
 * import { generateForestMap } from "./utils/treeAssetHelpers";
 * 
 * // When setting up terrain:
 * const arenaEnvironment = {
 *   terrain: "DENSE_FOREST",
 *   lighting: "BRIGHT_DAYLIGHT",
 *   objects: generateForestMap({
 *     assetId: "spruce_dense",
 *     startX: 5,
 *     endX: 25,
 *     startY: 5,
 *     endY: 25,
 *     spacing: 3,
 *     density: 0.7,
 *   }),
 * };
 * 
 * // The AI automatically uses arenaEnvironment.objects for:
 * // - Finding hiding spots (trees have "cover" and "foliage" tags)
 * // - Finding perches (trees have "perchable" tag)
 * // - LOS blocking (trees have blocksLOS: "partial")
 * ```
 */

/**
 * Example: Create individual tree instances
 */
export function exampleCreateTrees() {
  const trees = [];

  // Create a single spruce tree
  const spruce = createTreeInstance("spruce_dense", { x: 12, y: 7 });
  if (spruce) {
    trees.push(spruce);
  }

  // Create an oak with custom rotation
  const oak = createTreeInstance("oak_mature", { x: 15, y: 10 }, {
    id: "oak_custom_001", // Optional custom ID
    yawRad: Math.PI / 4, // 45 degrees
    scale: 1.0,
  });
  if (oak) {
    trees.push(oak);
  }

  return trees;
}

/**
 * Example: Hawk landing on a tree perch (using pickBestPerchForFlyer)
 * 
 * This shows the recommended way to find the best perch for a flying creature
 * based on intent (SCOUT, STALK, or STRIKE).
 */
export function exampleHawkPerching(hawk, arenaEnvironment, hawkPosition, targetPosition) {
  // Use pickBestPerchForFlyer to find the optimal perch
  const perchChoice = pickBestPerchForFlyer({
    flyer: hawk,
    flyerGrid: hawkPosition,
    targetGrid: targetPosition, // Optional: for STALK/STRIKE intents
    arenaEnvironment,
    options: {
      intent: "STALK", // "SCOUT" | "STALK" | "STRIKE"
      maxTreeSearchCells: 8,
      preferDistanceToTargetCells: 3,
    },
  });

  if (!perchChoice) {
    console.log("No suitable perch found");
    return null;
  }

  // Get the tree instance
  const tree = arenaEnvironment.objects.find((o) => o.id === perchChoice.treeId);
  if (!tree) {
    console.log("Tree not found");
    return null;
  }

  // Reserve the perch (so other creatures can't use it)
  const reserved = reservePerch(tree, perchChoice.perchId, hawk.id);
  if (!reserved) {
    console.log("Failed to reserve perch (may be occupied)");
    return null;
  }

  // Set hawk's logical state instantly (render will animate later)
  hawk.isFlying = false;
  hawk.perchedOn = {
    treeId: perchChoice.treeId,
    perchId: perchChoice.perchId,
  };
  hawk.altitudeFeet = perchChoice.altitudeFeet;

  console.log(`Hawk perched on tree ${perchChoice.treeId}, perch ${perchChoice.perchId}`);
  console.log(`Altitude: ${perchChoice.altitudeFeet} ft`);

  return {
    tree,
    perchChoice,
    // When the hawk takes off, release the perch:
    // releasePerch(tree, perchChoice.perchId, hawk.id);
  };
}

/**
 * Example: Simple perch finding (alternative to pickBestPerchForFlyer)
 * 
 * This is the simpler approach if you don't need intent-based selection.
 */
export function exampleSimplePerchFinding(hawk, arenaEnvironment, hawkPosition) {
  // Get objects from arenaEnvironment
  const objects = arenaEnvironment?.objects || [];

  // Find nearest tree with available perches
  const nearestTree = findNearestPerchableTree(
    hawk,
    objects,
    hawkPosition,
    10 // max radius in hexes
  );

  if (!nearestTree) {
    console.log("No perchable trees nearby");
    return null;
  }

  console.log(`Found tree ${nearestTree.tree.id} at distance ${nearestTree.distance.toFixed(2)} hexes`);
  console.log(`Available perches: ${nearestTree.perches.length}`);

  // Get the first available perch
  const perch = nearestTree.perches[0];
  console.log(`Selected perch: ${perch.id} at altitude ${perch.worldPosition.altitudeFeet} ft`);

  // Reserve the perch
  const reserved = reservePerch(nearestTree.tree, perch.id, hawk.id);
  if (!reserved) {
    console.log("Failed to reserve perch (may be occupied)");
    return null;
  }

  return {
    tree: nearestTree.tree,
    perch: perch,
    targetPosition: {
      gridX: nearestTree.tree.grid.x,
      gridY: nearestTree.tree.grid.y,
      altitudeFeet: perch.worldPosition.altitudeFeet,
      localOffsetFeet: perch.worldPosition.localOffsetFeet,
    },
  };
}

/**
 * Example: Perch reservation system
 */
export function examplePerchReservation(treeInstance, creature) {
  // Find available perches
  const perches = findAvailablePerches(treeInstance, creature);
  
  if (perches.length === 0) {
    console.log("No available perches");
    return null;
  }

  // Select a perch
  const selectedPerch = perches[0];

  // Reserve it
  const reserved = reservePerch(treeInstance, selectedPerch.id, creature.id);
  if (reserved) {
    console.log(`Perch ${selectedPerch.id} reserved for ${creature.id}`);
    
    // Later, when creature leaves:
    // releasePerch(treeInstance, selectedPerch.id, creature.id);
    
    return selectedPerch;
  } else {
    console.log("Failed to reserve perch");
    return null;
  }
}

/**
 * Example: AI automatically finds trees for cover
 * 
 * The AI system already uses arenaEnvironment.objects for finding hiding spots.
 * Trees with "cover" or "foliage" tags are automatically detected.
 * 
 * No additional code needed - just populate arenaEnvironment.objects with trees!
 */
export function exampleAICoverIntegration() {
  // The AI's findNearbyHidingSpot function automatically:
  // 1. Reads from arenaEnvironment.objects (or terrain.objects)
  // 2. Filters objects with "cover", "foliage", "burrow", or "hideout" tags
  // 3. Returns the nearest hiding spot
  //
  // Since trees have ["tree", "conifer", "cover", "foliage", "perchable"] tags,
  // they're automatically included in hiding spot searches.
  
  return {
    note: "Trees are automatically used by AI - no additional integration needed!",
    tags: ["cover", "foliage"], // These tags make trees discoverable
  };
}

/**
 * Example: Generate a forest map
 */
export function exampleGenerateForest() {
  // Generate a dense spruce forest
  const denseSpruceForest = generateForestMap({
    assetId: "spruce_dense",
    startX: 5,
    endX: 25,
    startY: 5,
    endY: 25,
    spacing: 3,
    density: 0.8, // 80% density
  });

  // Generate a mixed forest
  const mixedForest = [
    ...generateForestMap({
      assetId: "spruce_dense",
      startX: 5,
      endX: 15,
      startY: 5,
      endY: 15,
      spacing: 4,
      density: 0.6,
    }),
    ...generateForestMap({
      assetId: "oak_mature",
      startX: 15,
      endX: 25,
      startY: 15,
      endY: 25,
      spacing: 5,
      density: 0.5,
    }),
  ];

  return {
    denseSpruceForest,
    mixedForest,
  };
}

/**
 * Example: Get all available tree assets
 */
export function exampleListTreeAssets() {
  const assets = getAllTreeAssets();
  console.log("Available tree assets:", assets);
  // Output: ["spruce_dense", "pine_tall", "oak_mature"]
  return assets;
}

/**
 * Example: Integration with CombatPage
 * 
 * In your CombatPage.jsx, you could add:
 * 
 * ```javascript
 * import { generateForestMap } from "./utils/treeAssetHelpers";
 * 
 * // In your component state or terrain setup:
 * const [arenaEnvironment, setArenaEnvironment] = useState({
 *   terrain: "DENSE_FOREST",
 *   lighting: "BRIGHT_DAYLIGHT",
 *   objects: [], // Start empty
 * });
 * 
 * // When terrain changes to forest:
 * useEffect(() => {
 *   if (arenaEnvironment.terrain === "DENSE_FOREST") {
 *     const trees = generateForestMap({
 *       assetId: "spruce_dense",
 *       startX: 5,
 *       endX: 25,
 *       startY: 5,
 *       endY: 25,
 *       spacing: 3,
 *       density: 0.7,
 *     });
 *     setArenaEnvironment(prev => ({
 *       ...prev,
 *       objects: trees,
 *     }));
 *   }
 * }, [arenaEnvironment.terrain]);
 * 
 * // The AI automatically uses arenaEnvironment.objects:
 * // - enemyTurnAI.js reads from arenaEnvironment?.objects || []
 * // - findNearbyHidingSpot() finds trees with "cover" or "foliage" tags
 * // - findNearestPerchableTree() finds trees with "perchable" tag
 * ```
 */

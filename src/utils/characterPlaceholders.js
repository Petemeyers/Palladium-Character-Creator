import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  worldVectorFromEntity,
  HEX_RADIUS,
  HEX_TILE_THICKNESS,
} from "./hexGridMath.js";

/**
 * Calculate scale factor for a character based on footprint
 * @param {Object} character - Character object with visual and footprint data
 * @returns {number} Scale factor (clamped between 0.25 and 8)
 */
function getScaleForFootprint(character) {
  const desiredFeet = character?.footprint?.feet ?? 5; // default 1 hex
  const baseHeightFt = character?.visual?.baseHeightFt ?? 6;

  // Simple tabletop rule: scale proportionally by "presence"
  const targetPresenceFt = desiredFeet; // 20 ft for Ariel
  const scale = targetPresenceFt / baseHeightFt; // 20/6 = 3.33...

  // Clamp so nothing goes insane
  return Math.max(0.25, Math.min(8, scale));
}

function degreesToRadians(deg) {
  const n = Number(deg);
  if (!Number.isFinite(n)) return 0;
  return (n * Math.PI) / 180;
}

export function createCharacterIcon(character = {}) {
  const {
    q = 0,
    r = 0,
    altitude = 0,
    name = "Unit",
    alignment = "neutral",
    visual = {},
    footprint = {},
  } = character;

  const group = new THREE.Group();
  const modelUrl = visual?.modelUrl;

  // Create placeholder (sphere) that will be replaced if model loads
  const sphereRadius = 1.0; // 5ft diameter = 2.5ft radius = 1 unit
  const geometry = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const material = new THREE.MeshStandardMaterial({
    color: alignment === "evil" ? "#AA0000" : "#00AAFF",
    transparent: true,
    opacity: 0.85,
    metalness: 0.3,
    roughness: 0.7,
  });

  const placeholder = new THREE.Mesh(geometry, material);
  placeholder.castShadow = true;
  placeholder.receiveShadow = true;
  placeholder.userData = {
    ...character,
    type: "characterPlaceholder",
  };
  group.add(placeholder);

  // Label above the character
  const label = makeTextSprite(name || "Unknown");
  label.position.y = sphereRadius + 0.5; // Position label above character
  group.add(label);

  // Store yaw offset for character facing
  const yawOffsetRad = degreesToRadians(visual?.yawOffsetDeg ?? 0);
  group.userData.yawOffsetRad = yawOffsetRad;

  // Debug logging (scale will be computed during GLB load based on world-space footprint)
  console.log(`[CharacterIcon] Creating icon for ${name}:`, {
    modelUrl,
    footprint: footprint?.feet,
    radiusHex: footprint?.radiusHex,
    desiredRadiusWorld: footprint?.desiredRadiusWorld,
    baseHeightFt: visual?.baseHeightFt,
  });

  // Try to load GLB model if URL is provided
  if (modelUrl) {
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        // Remove placeholder
        group.remove(placeholder);
        placeholder.geometry.dispose();
        placeholder.material.dispose();

        // Get the model scene - may need to clone if it's reused
        const model = gltf.scene.clone ? gltf.scene.clone() : gltf.scene;

        // Reset any existing transformations
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        model.scale.set(1, 1, 1);

        // Step 1: Compute model's foot offset and horizontal radius BEFORE any transformations
        // Measure the bounding box to find where the feet are relative to origin
        const originalBox = new THREE.Box3().setFromObject(model);
        const originalSize = originalBox.getSize(new THREE.Vector3());
        const originalMinY = originalBox.min.y;

        // Store how far the model's feet are below its origin
        // This will be used later to position the model correctly on the ground
        // Negative because minY is below origin (typically negative)
        const modelFootOffset = -originalMinY;

        // Tabletop-correct: scale by BODY radius, not wing span
        // On tabletop minis, wings/tails/weapons are overhang - base size is defined by body mass
        // Z is usually forward/back; X is wings. Use the smaller dimension (body width) for footprint
        const BODY_FOOTPRINT_RATIO = 0.72; // empirically good for winged creatures
        const modelRadiusUnscaled =
          (Math.min(originalSize.x, originalSize.z) * BODY_FOOTPRINT_RATIO) / 2;

        // Center the model horizontally (X and Z) but keep Y at origin
        // We'll apply the foot offset during positioning, not here
        const originalCenter = originalBox.getCenter(new THREE.Vector3());
        model.position.set(-originalCenter.x, 0, -originalCenter.z);

        // Step 2: Scale model to match desired footprint radius in world space
        // This is computed in HexArena.js based on radiusHex and hex spacing
        // Fallback to old feet-based scaling if desiredRadiusWorld not provided
        const desiredRadiusWorld = character?.footprint?.desiredRadiusWorld;
        let scale;
        if (desiredRadiusWorld && modelRadiusUnscaled > 0) {
          // Tabletop correction: model sits INSIDE base, not on the rim
          // On real minis, the sculpt sits inside the base rim, so we subtract half a hex
          const insetRadius = Math.max(
            0.001,
            desiredRadiusWorld - HEX_RADIUS * 0.5
          );
          scale = insetRadius / modelRadiusUnscaled;
          console.log(
            `[CharacterIcon] Scaling ${name} by world-space footprint (tabletop-correct):`,
            {
              modelRadiusUnscaled: modelRadiusUnscaled.toFixed(3),
              desiredRadiusWorld: desiredRadiusWorld.toFixed(3),
              insetRadius: insetRadius.toFixed(3),
              calculatedScale: scale.toFixed(3),
            }
          );
        } else {
          // Fallback to feet-based scaling if desiredRadiusWorld not available
          scale = getScaleForFootprint(character);
          console.log(
            `[CharacterIcon] Using fallback feet-based scaling for ${name}:`,
            {
              scale: scale.toFixed(3),
            }
          );
        }

        // Apply scaling - setScalar applies uniform scale
        model.scale.setScalar(scale);

        // Force update matrix to ensure scale is applied
        model.updateMatrixWorld(true);

        // Verify scale was applied by recalculating bounding box
        const verifyBox = new THREE.Box3().setFromObject(model);
        const verifySize = verifyBox.getSize(new THREE.Vector3());
        const scaledMinY = verifyBox.min.y;
        const scaledMaxY = verifyBox.max.y;

        // Calculate actual scale from dimensions (use largest dimension to avoid division by zero)
        const maxOriginalDim = Math.max(
          originalSize.x,
          originalSize.y,
          originalSize.z,
          0.001
        );
        const maxScaledDim = Math.max(
          verifySize.x,
          verifySize.y,
          verifySize.z,
          0.001
        );
        const actualScale = maxScaledDim / maxOriginalDim;

        // Enable shadows
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        model.userData = {
          ...character,
          type: "characterModel",
          originalSize,
          modelRadiusUnscaled, // Store for consistent scale calculation
          appliedScale: scale, // Store the scale that was applied
          scaledSize: {
            x: originalSize.x * scale,
            y: originalSize.y * scale,
            z: originalSize.z * scale,
          },
        };

        group.add(model);

        // Position label above the model's top
        label.position.y = Math.max(scaledMaxY + 1.0, sphereRadius + 0.5);

        // Store model height info and foot offset for positioning
        model.userData.modelHeight = scaledMaxY - scaledMinY;

        // Step 1: Store the foot offset and scale for consistent positioning
        // This is the critical piece: how far below origin the model's feet are
        group.userData.modelFootOffset = modelFootOffset; // Original offset (unscaled)
        group.userData.appliedScale = scale; // Store the scale that was actually applied to the model

        // Adjust group position: We'll apply the foot offset in syncCombatState with scale
        // For now, keep the placeholder offset - we'll fix it when positioning updates
        const isWaterTerrain =
          character.isWater ||
          character.terrainType?.toLowerCase().includes("water") ||
          false;

        // Store that model is loaded and cache metadata
        group.userData.hasModel = true;
        group.userData.isWater = isWaterTerrain;
        group.userData.terrainType = character.terrainType;

        // Step 2: Apply foot offset positioning immediately when model loads
        // Get current position (from worldVectorFromEntity in createCharacterIcon)
        // This uses the cached foot offset with scale to anchor feet to hex surface
        // Position will be fully corrected in syncCombatState, but we update here for immediate feedback
        const currentPos = group.position.clone();
        const waterOffset = isWaterTerrain ? 0.2 : 0;

        // Apply foot offset with scale: anchors feet to hex surface
        // Remove placeholder offset and apply correct foot offset
        const placeholderY = currentPos.y;
        currentPos.y = placeholderY - sphereRadius; // Remove placeholder offset
        currentPos.y += modelFootOffset * scale; // Apply foot offset with scale
        currentPos.y += waterOffset; // Add water offset if in water

        group.position.copy(currentPos);

        console.log(`[CharacterIcon] ✓ Loaded model: ${modelUrl}`);
        console.log(`[CharacterIcon]   Original size:`, originalSize);
        console.log(`[CharacterIcon]   Requested scale: ${scale.toFixed(2)}x`);
        console.log(
          `[CharacterIcon]   Actual scale applied: ${actualScale.toFixed(2)}x`
        );
        console.log(`[CharacterIcon]   Scaled size:`, verifySize);
        console.log(
          `[CharacterIcon]   Model foot offset (unscaled): ${modelFootOffset.toFixed(
            3
          )}`
        );
        console.log(
          `[CharacterIcon]   Applied foot offset (scaled): ${(
            modelFootOffset * scale
          ).toFixed(3)}`
        );
        console.log(
          `[CharacterIcon]   Model Y range (local after scale): ${scaledMinY.toFixed(
            3
          )} to ${scaledMaxY.toFixed(3)}`
        );
        console.log(
          `[CharacterIcon]   Position adjusted: ${placeholderY.toFixed(
            3
          )} -> ${currentPos.y.toFixed(3)}`
        );
        console.log(`[CharacterIcon]   Model scale vector:`, model.scale);
      },
      (progress) => {
        // Loading progress (optional)
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(
            `[CharacterIcon] Loading ${modelUrl}: ${percentComplete.toFixed(
              0
            )}%`
          );
        }
      },
      (error) => {
        // Loading failed, keep placeholder
        console.error(
          `[CharacterIcon] Failed to load model ${modelUrl}:`,
          error
        );
      }
    );
  }

  // Position the group above the hex tile
  // For models, the base is at Y=0 in local space, so position group at ground level
  // For placeholders, add sphere radius so it sits on top of the hex
  const isWater =
    character.isWater ||
    character.terrainType?.toLowerCase().includes("water") ||
    false;
  const waterOffset = isWater ? 0.2 : 0; // Float slightly above water

  const pos = worldVectorFromEntity(
    {
      q,
      r,
      altitudeFeet: altitude,
      tileHeightUnits: character.tileHeightUnits,
    },
    HEX_RADIUS,
    HEX_TILE_THICKNESS
  );

  // Store initial position - models will have base at Y=0, placeholders need offset
  // Add water offset for floating effect
  pos.y += sphereRadius + waterOffset; // Default for placeholder + water offset
  group.position.copy(pos);

  // Store flags (before merging to preserve them)
  group.userData.hasModel = !!modelUrl;
  group.userData.isWater = isWater;
  group.userData.terrainType = character.terrainType;

  // ✅ CRITICAL: Merge instead of overwrite to preserve modelFootOffset, yawOffsetRad, etc.
  group.userData = {
    ...group.userData, // ✅ Preserve prior cached values like modelFootOffset, hasModel, yawOffsetRad
    ...character,
    type: "characterGroup",
    footprint,
    occupiedHexes: null, // Will be set by syncCombatState
  };
  return group;
}

function makeTextSprite(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to obtain 2D context for character label.");
  }
  ctx.font = "Bold 22px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;
  ctx.strokeText(text, 4, 4);
  ctx.fillText(text, 4, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(1.6, 0.5, 1);
  return sprite;
}

export function updateCharacterBillboards(characters = [], camera) {
  if (!camera) return;
  characters.forEach((icon) => {
    // IMPORTANT:
    // We no longer rotate the entire character group toward the camera,
    // because that would override combat-facing (units should face opponents).
    // Only the text sprites should billboard toward the camera.
    icon.children.forEach((child) => {
      if (child.isSprite) {
        child.lookAt(camera.position);
      }
    });
  });
}

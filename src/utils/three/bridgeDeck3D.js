import * as THREE from "three";
import { TILE_HEIGHT_UNIT_TO_WORLD_Y } from "../hexGridMath.js";
import { BRIDGE_LAYER_TYPE } from "../maps/bridgeLayerAuthority.js";

const WORLD_PER_FOOT = TILE_HEIGHT_UNIT_TO_WORLD_Y / 2.5;
const materialCache = new Map();

function materialFor(key, role = "deck") {
  const cacheKey = `${key}:${role}`;
  if (materialCache.has(cacheKey)) return materialCache.get(cacheKey);
  const stone = key === "stone";
  const material = new THREE.MeshStandardMaterial({
    color:
      role === "rail"
        ? stone ? 0x696969 : 0x5b371f
        : role === "support"
          ? stone ? 0x777777 : 0x654126
          : stone ? 0x8a8a82 : 0x8b5a2b,
    roughness: stone ? 0.94 : 0.86,
    metalness: 0,
    flatShading: true,
  });
  materialCache.set(cacheKey, material);
  return material;
}

function disposeGroup(group) {
  if (!group) return;
  group.traverse((child) => child.geometry?.dispose?.());
}

function makeBox(size, position, material, userData = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    material
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { ...userData };
  return mesh;
}

function createDeckLayerMesh(layer, {
  tileSpan,
  mapType,
  parentRotationY = 0,
  terrainSurfaceY = 0,
} = {}) {
  const group = new THREE.Group();
  const deckThickness = Math.max(0.03, Number(layer.deckThicknessFeet || 0.75) * WORLD_PER_FOOT);
  const widthWorld = Math.max(tileSpan * 0.45, Number(layer.widthFeet || 8) * WORLD_PER_FOOT);
  const lengthWorld = Math.max(tileSpan * 1.12, widthWorld * 0.75);
  const deckY = Number(layer.deckElevationFeet || 0) * WORLD_PER_FOOT;
  const desiredWorldRotation = -(Number(layer.headingDegrees) || 0) * Math.PI / 180;
  group.rotation.y = desiredWorldRotation - Number(parentRotationY || 0);
  group.userData = {
    bridgeLayerRoot: true,
    bridgeId: layer.bridgeId,
    bridgeLayerId: layer.id,
    clearanceFeet: layer.clearanceFeet,
    lowerTraversalPreserved: true,
    underpassAllowed: layer.traversal?.underpassAllowed !== false,
  };

  const deck = makeBox(
    [lengthWorld, deckThickness, widthWorld],
    [0, deckY + deckThickness / 2, 0],
    materialFor(layer.material, "deck"),
    {
      bridgeDeck: true,
      bridgeId: layer.bridgeId,
      traversalLayer: "bridge-deck",
    }
  );
  group.add(deck);

  if (layer.railings !== false) {
    const railHeight = Math.max(0.08, Number(layer.railingHeightFeet || 3.5) * WORLD_PER_FOOT);
    const railThickness = Math.max(0.025, WORLD_PER_FOOT * 0.35);
    for (const side of [-1, 1]) {
      group.add(makeBox(
        [lengthWorld, railHeight, railThickness],
        [0, deckY + deckThickness + railHeight / 2, side * (widthWorld / 2 - railThickness / 2)],
        materialFor(layer.material, "rail"),
        { bridgeRailing: true, bridgeId: layer.bridgeId }
      ));
    }
  }

  if (layer.support) {
    const supportTop = deckY;
    const supportBottom = Number.isFinite(Number(terrainSurfaceY)) ? Number(terrainSurfaceY) : 0;
    const supportHeight = Math.max(0, supportTop - supportBottom);
    if (supportHeight > 0.04) {
      const thickness = layer.material === "stone" ? widthWorld * 0.28 : widthWorld * 0.12;
      for (const side of [-0.28, 0.28]) {
        group.add(makeBox(
          [thickness, supportHeight, thickness],
          [0, supportBottom + supportHeight / 2, side * widthWorld],
          materialFor(layer.material, "support"),
          {
            bridgeSupport: true,
            bridgeId: layer.bridgeId,
            blocksLowerTraversalLocally: true,
          }
        ));
      }
    }
  }

  return group;
}

export function replaceBridgeDeckLayerGroup({
  tileMesh,
  cell,
  tileSpan,
  mapType = "hex",
  parentRotationY = 0,
} = {}) {
  if (!tileMesh) return null;

  const previous = tileMesh.children.find((child) => child?.userData?.bridgeLayerCollection === true);
  if (previous) {
    tileMesh.remove(previous);
    disposeGroup(previous);
  }

  const layers = (Array.isArray(cell?.verticalLayers) ? cell.verticalLayers : [])
    .filter((layer) => layer?.type === BRIDGE_LAYER_TYPE || layer?.layer === "bridge-deck");
  if (!layers.length) return null;

  const collection = new THREE.Group();
  collection.name = "bridge-deck-layers";
  collection.userData = { bridgeLayerCollection: true, mapType };
  const terrainSurfaceY = Number.isFinite(Number(tileMesh.userData?.surfaceY))
    ? Number(tileMesh.userData.surfaceY)
    : 0;

  layers.forEach((layer) => {
    collection.add(createDeckLayerMesh(layer, {
      tileSpan,
      mapType,
      parentRotationY,
      terrainSurfaceY,
    }));
  });
  tileMesh.add(collection);
  return collection;
}

export default replaceBridgeDeckLayerGroup;

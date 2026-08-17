import * as THREE from "three";
import { TILE_HEIGHT_UNIT_TO_WORLD_Y } from "../hexGridMath.js";
import {
  getGridCellStructureEdge,
  getGridStructureDirections,
  shouldRenderGridStructureEdge,
} from "../maps/gridStructureAuthority.js";

const WORLD_PER_FOOT = TILE_HEIGHT_UNIT_TO_WORLD_Y / 2.5;
const COLORS = Object.freeze({
  stone: 0x787878,
  "dungeon-stone": 0x4b5563,
  wood: 0x765033,
  timber: 0x765033,
  plaster: 0xd8d1c4,
  brick: 0x9a4f3d,
});

function makeMaterial(edge, role = "wall") {
  let color = COLORS[edge.material] ?? COLORS.stone;
  if (edge.kind === "palisade" || edge.kind === "fence") color = COLORS.wood;
  if (role === "gate") color = 0x5f3a22;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: edge.material === "plaster" ? 0.78 : 0.92,
    metalness: 0,
    flatShading: edge.kind === "palisade",
  });
}

function disposeCollection(group) {
  if (!group) return;
  const materials = new Set();
  group.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((m) => m && materials.add(m));
    else if (child.material) materials.add(child.material);
  });
  materials.forEach((material) => material?.dispose?.());
}

function addBox(group, size, position, rotationY, material, userData) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { ...userData, gridStructureSegment: true };
  group.add(mesh);
  return mesh;
}

function addPalisade(group, edge, length, thickness, height, center, tangentRotation, userData) {
  const postCount = Math.max(3, Math.round(length / Math.max(0.12, thickness * 1.6)));
  const postWidth = Math.max(0.055, thickness * 0.75);
  for (let i = 0; i < postCount; i += 1) {
    const t = postCount === 1 ? 0 : i / (postCount - 1);
    const offset = (t - 0.5) * (length - postWidth);
    const dx = Math.cos(tangentRotation) * offset;
    const dz = Math.sin(tangentRotation) * offset;
    const post = addBox(
      group,
      [postWidth, height, postWidth],
      [center.x + dx, center.y + height / 2, center.z + dz],
      tangentRotation,
      makeMaterial(edge),
      { ...userData, structureSegment: "palisade-post" }
    );
    post.rotation.z = i % 2 === 0 ? 0.02 : -0.02;
  }
}

function addFence(group, edge, length, thickness, height, center, tangentRotation, userData) {
  const postHeight = height;
  const postWidth = Math.max(0.05, thickness * 0.8);
  for (const offset of [-length * 0.42, length * 0.42]) {
    const dx = Math.cos(tangentRotation) * offset;
    const dz = Math.sin(tangentRotation) * offset;
    addBox(group, [postWidth, postHeight, postWidth], [center.x + dx, center.y + postHeight / 2, center.z + dz], tangentRotation, makeMaterial(edge), userData);
  }
  for (const yFraction of [0.38, 0.72]) {
    addBox(group, [length, Math.max(0.045, thickness * 0.38), thickness * 0.55], [center.x, center.y + height * yFraction, center.z], tangentRotation, makeMaterial(edge), userData);
  }
}

function addGate(group, edge, length, thickness, height, center, tangentRotation, userData) {
  const frameWidth = Math.max(0.07, thickness * 0.9);
  const opening = Math.min(length * 0.72, 4 * WORLD_PER_FOOT);
  const side = Math.max(frameWidth, (length - opening) / 2);
  for (const sign of [-1, 1]) {
    const offset = sign * (opening / 2 + side / 2);
    const dx = Math.cos(tangentRotation) * offset;
    const dz = Math.sin(tangentRotation) * offset;
    addBox(group, [side, height, thickness], [center.x + dx, center.y + height / 2, center.z + dz], tangentRotation, makeMaterial(edge), userData);
  }
  addBox(group, [opening, Math.max(0.1, height * 0.18), thickness], [center.x, center.y + height * 0.91, center.z], tangentRotation, makeMaterial(edge), userData);
  if (!edge.open) {
    addBox(group, [opening * 0.94, height * 0.78, thickness * 0.7], [center.x, center.y + height * 0.39, center.z], tangentRotation, makeMaterial(edge, "gate"), { ...userData, structureSegment: "gate-leaf" });
  }
}

function renderEdge(group, edge, direction, hexRadius, surfaceY, userData) {
  const physicalAngle = (Number(direction.angleDeg) || 0) * Math.PI / 180;
  // The parent hex mesh is already rotated +30 degrees. Express edge geometry
  // in the parent's local coordinates so the final physical edge normal
  // matches E/SE/SW/W/NW/NE.
  const localNormal = physicalAngle - Math.PI / 6;
  const tangentRotation = localNormal + Math.PI / 2;
  const apothem = hexRadius * Math.sqrt(3) / 2;
  const center = {
    x: Math.cos(localNormal) * apothem,
    y: surfaceY,
    z: Math.sin(localNormal) * apothem,
  };
  const length = hexRadius;
  const thickness = Math.max(0.025, Number(edge.thicknessFeet || 0.5) * WORLD_PER_FOOT);
  const height = Math.max(0.08, Number(edge.heightFeet || 10) * WORLD_PER_FOOT);

  if (edge.kind === "palisade") {
    addPalisade(group, edge, length, thickness, height, center, tangentRotation, userData);
    return;
  }
  if (edge.kind === "fence") {
    addFence(group, edge, length, thickness, height, center, tangentRotation, userData);
    return;
  }
  if (edge.kind === "gate" || edge.kind === "door" || edge.kind === "archway") {
    addGate(group, { ...edge, open: edge.kind === "archway" ? true : edge.open }, length, thickness, height, center, tangentRotation, userData);
    return;
  }

  addBox(
    group,
    [length, height, thickness],
    [center.x, center.y + height / 2, center.z],
    tangentRotation,
    makeMaterial(edge),
    userData
  );
}

export function replaceHexStructureLayerGroup({
  tileMesh,
  cell,
  hexRadius = 1,
  x = null,
  y = null,
  grid = null,
  neighborData = null,
} = {}) {
  if (!tileMesh) return null;
  const previous = tileMesh.children.find((child) => child?.userData?.hexStructureCollection === true);
  if (previous) {
    tileMesh.remove(previous);
    disposeCollection(previous);
  }

  const col = Number(x ?? cell?.x ?? cell?.q ?? tileMesh.userData?.q ?? 0);
  const row = Number(y ?? cell?.y ?? cell?.r ?? tileMesh.userData?.r ?? 0);
  const collection = new THREE.Group();
  collection.name = "hex-structure-edges";
  collection.userData = { hexStructureCollection: true, mapType: "hex" };
  const surfaceY = Number.isFinite(Number(tileMesh.userData?.surfaceY))
    ? Number(tileMesh.userData.surfaceY)
    : 0;

  let count = 0;
  getGridStructureDirections("hex").forEach((direction) => {
    const edge = getGridCellStructureEdge(cell, direction.key, "hex");
    if (!edge) return;
    let shouldRender = shouldRenderGridStructureEdge({
      mapType: "hex",
      direction: direction.key,
      x: col,
      y: row,
      grid,
    });
    if (!grid && !["E", "SE", "SW"].includes(direction.key)) {
      const neighbor = neighborData?.get?.(`${col + direction.dx},${row + direction.dy}`) || null;
      shouldRender = !neighbor;
    }
    if (!shouldRender) return;

    renderEdge(collection, edge, direction, hexRadius, surfaceY, {
      mapType: "hex",
      structuralEdge: true,
      q: col,
      r: row,
      x: col,
      y: row,
      direction: direction.key,
      structureKind: edge.kind,
      structureMaterial: edge.material,
      blocksMovement: edge.blocksMovement,
      blocksLineOfSight: edge.blocksLineOfSight,
    });
    count += 1;
  });

  if (!count) return null;
  collection.userData.edgeCount = count;
  tileMesh.add(collection);
  return collection;
}

export default replaceHexStructureLayerGroup;

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  HEX_TILE_THICKNESS,
  TILE_HEIGHT_UNIT_TO_WORLD_Y,
} from "../hexGridMath.js";
import {
  getSquareCellStructureEdge,
  shouldRenderSquareStructureEdge,
} from "../maps/squareStructureAuthority.js";
import {
  resolveSquareStructureAsset,
} from "../maps/squareStructureAssetRegistry.js";

const MATERIAL_COLORS = Object.freeze({
  stone: 0x7c8085,
  "dungeon-stone": 0x4b5563,
  wood: 0x7a4d2a,
  plaster: 0xd8d1c4,
  brick: 0x9a4f3d,
});

const structureLoader = new GLTFLoader();
const structureAssetCache = new Map();

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

function surfaceWorldY(cell = {}) {
  const height = Number.isFinite(Number(cell?.height))
    ? Number(cell.height)
    : Number(cell?.elevation) || 0;
  if (height === 0) return HEX_TILE_THICKNESS;
  return height * TILE_HEIGHT_UNIT_TO_WORLD_Y;
}

function worldPerFoot(tileSize) {
  return Math.max(0.01, finite(tileSize, 1) / 5);
}

function getGridSize(grid = []) {
  return {
    height: Array.isArray(grid) ? grid.length : 0,
    width: (Array.isArray(grid) ? grid : []).reduce(
      (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
      0
    ),
  };
}

function edgeTransform(col, row, direction, tileSize) {
  const half = tileSize / 2;
  const x = col * tileSize;
  const z = row * tileSize;
  if (direction === "N") return { x, z: z - half, rotationY: 0 };
  if (direction === "S") return { x, z: z + half, rotationY: 0 };
  if (direction === "E") return { x: x + half, z, rotationY: Math.PI / 2 };
  return { x: x - half, z, rotationY: Math.PI / 2 };
}

function makeMaterial(materialKey = "stone", options = {}) {
  const key = String(materialKey || "stone");
  return new THREE.MeshStandardMaterial({
    color: options.color ?? MATERIAL_COLORS[key] ?? MATERIAL_COLORS.stone,
    roughness: options.roughness ?? (key === "plaster" ? 0.78 : 0.92),
    metalness: options.metalness ?? 0,
    transparent: options.transparent === true,
    opacity: options.opacity ?? 1,
    side: options.side || THREE.DoubleSide,
  });
}

function addLocalBox(group, {
  width,
  height,
  depth,
  x = 0,
  y = 0,
  z = 0,
  material,
  userData = {},
}) {
  if (width <= 0.001 || height <= 0.001 || depth <= 0.001) return null;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    ...userData,
    type: "squareStructureSegment",
  };
  group.add(mesh);
  return mesh;
}

function wallDimensions(edge, tileSize) {
  const perFoot = worldPerFoot(tileSize);
  return {
    wallLength: tileSize,
    wallHeight: edge.heightFeet * perFoot,
    thickness: edge.thicknessFeet * perFoot,
    perFoot,
  };
}

function structureBaseY(grid, x, y, direction) {
  const own = grid?.[y]?.[x];
  const ownY = surfaceWorldY(own);
  let neighbor = null;
  if (direction === "N") neighbor = grid?.[y - 1]?.[x];
  if (direction === "S") neighbor = grid?.[y + 1]?.[x];
  if (direction === "E") neighbor = grid?.[y]?.[x + 1];
  if (direction === "W") neighbor = grid?.[y]?.[x - 1];
  return Math.max(ownY, neighbor ? surfaceWorldY(neighbor) : ownY);
}

function addFullWall(group, edge, tileSize, userData) {
  const dims = wallDimensions(edge, tileSize);
  addLocalBox(group, {
    width: dims.wallLength,
    height: dims.wallHeight,
    depth: dims.thickness,
    y: dims.wallHeight / 2,
    material: makeMaterial(edge.material),
    userData,
  });
}

function addOpeningFrame(group, edge, tileSize, {
  openingWidthFeet,
  openingBottomFeet,
  openingHeightFeet,
  includeDoorSlab = false,
  windowStyle = null,
  userData = {},
}) {
  const dims = wallDimensions(edge, tileSize);
  const openingWidth = Math.min(
    dims.wallLength * 0.86,
    openingWidthFeet * dims.perFoot
  );
  const openingBottom = Math.max(0, openingBottomFeet * dims.perFoot);
  const openingHeight = Math.min(
    dims.wallHeight - openingBottom,
    openingHeightFeet * dims.perFoot
  );
  const openingTop = openingBottom + openingHeight;
  const sideWidth = Math.max(
    dims.perFoot * 0.35,
    (dims.wallLength - openingWidth) / 2
  );
  const wallMaterial = makeMaterial(edge.material);

  for (const sign of [-1, 1]) {
    const offset = sign * (openingWidth / 2 + sideWidth / 2);
    addLocalBox(group, {
      width: sideWidth,
      height: dims.wallHeight,
      depth: dims.thickness,
      x: offset,
      y: dims.wallHeight / 2,
      material: wallMaterial,
      userData,
    });
  }

  if (openingBottom > 0.01) {
    addLocalBox(group, {
      width: openingWidth,
      height: openingBottom,
      depth: dims.thickness,
      y: openingBottom / 2,
      material: wallMaterial,
      userData,
    });
  }

  const upperHeight = Math.max(0, dims.wallHeight - openingTop);
  if (upperHeight > 0.01) {
    addLocalBox(group, {
      width: openingWidth,
      height: upperHeight,
      depth: dims.thickness,
      y: openingTop + upperHeight / 2,
      material: wallMaterial,
      userData,
    });
  }

  if (includeDoorSlab && edge.open !== true) {
    addLocalBox(group, {
      width: openingWidth * 0.94,
      height: openingHeight,
      depth: Math.max(dims.thickness * 0.55, 0.025),
      y: openingBottom + openingHeight / 2,
      z: dims.thickness * 0.05,
      material: makeMaterial("wood"),
      userData: {
        ...userData,
        structureSegment: "door-slab",
      },
    });
  }

  if (windowStyle) {
    addWindowVisual(group, edge, dims, {
      openingWidth,
      openingBottom,
      openingHeight,
      windowStyle,
      userData,
    });
  }
}

function addWindowVisual(group, edge, dims, {
  openingWidth,
  openingBottom,
  openingHeight,
  windowStyle,
  userData,
}) {
  if (windowStyle === "open") return;

  if (windowStyle === "shuttered") {
    const shutterWidth = openingWidth * 0.44;
    for (const sign of [-1, 1]) {
      const shutter = addLocalBox(group, {
        width: shutterWidth,
        height: openingHeight * 0.92,
        depth: Math.max(dims.thickness * 0.18, 0.015),
        x: sign * (openingWidth * 0.56),
        y: openingBottom + openingHeight / 2,
        z: dims.thickness * 0.62,
        material: makeMaterial("wood"),
        userData: {
          ...userData,
          structureSegment: "window-shutter",
        },
      });
      if (shutter) shutter.rotation.y = sign * 0.55;
    }
    return;
  }

  const stained = windowStyle === "stained";
  addLocalBox(group, {
    width: openingWidth * 0.94,
    height: openingHeight * 0.94,
    depth: Math.max(dims.thickness * 0.10, 0.012),
    y: openingBottom + openingHeight / 2,
    z: dims.thickness * 0.1,
    material: makeMaterial("glass", {
      color: stained ? 0x7c3aed : 0x84c5c8,
      roughness: 0.24,
      transparent: true,
      opacity: stained ? 0.48 : 0.30,
    }),
    userData: {
      ...userData,
      structureSegment: stained ? "stained-window-pane" : "leaded-window-pane",
    },
  });

  const leadMaterial = makeMaterial("lead", {
    color: 0x374151,
    metalness: 0.25,
    roughness: 0.65,
  });
  for (const fraction of [-0.25, 0, 0.25]) {
    addLocalBox(group, {
      width: Math.max(0.012, openingWidth * 0.025),
      height: openingHeight * 0.94,
      depth: Math.max(dims.thickness * 0.13, 0.014),
      x: openingWidth * fraction,
      y: openingBottom + openingHeight / 2,
      z: dims.thickness * 0.17,
      material: leadMaterial,
      userData: {
        ...userData,
        structureSegment: "window-leading",
      },
    });
  }
  addLocalBox(group, {
    width: openingWidth * 0.94,
    height: Math.max(0.012, openingHeight * 0.025),
    depth: Math.max(dims.thickness * 0.13, 0.014),
    y: openingBottom + openingHeight / 2,
    z: dims.thickness * 0.17,
    material: leadMaterial,
    userData: {
      ...userData,
      structureSegment: "window-leading",
    },
  });
}

function createArchWallGeometry(edge, tileSize) {
  const dims = wallDimensions(edge, tileSize);
  const openingWidth = Math.min(
    dims.wallLength * 0.78,
    Math.max(edge.doorWidthFeet + 0.6, 3.4) * dims.perFoot
  );
  const radius = openingWidth / 2;
  const springHeight = Math.min(
    dims.wallHeight * 0.58,
    Math.max(3.8 * dims.perFoot, edge.doorHeightFeet * dims.perFoot - radius * 0.55)
  );
  const apex = springHeight + radius;

  const shape = new THREE.Shape();
  shape.moveTo(-dims.wallLength / 2, 0);
  shape.lineTo(dims.wallLength / 2, 0);
  shape.lineTo(dims.wallLength / 2, dims.wallHeight);
  shape.lineTo(-dims.wallLength / 2, dims.wallHeight);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-radius, 0);
  hole.lineTo(radius, 0);
  hole.lineTo(radius, springHeight);
  const segments = 18;
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    const angle = t * Math.PI;
    hole.lineTo(
      Math.cos(angle) * radius,
      springHeight + Math.sin(angle) * radius
    );
  }
  hole.lineTo(-radius, 0);
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: dims.thickness,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 18,
  });
  geometry.translate(0, 0, -dims.thickness / 2);
  geometry.computeVertexNormals();
  geometry.userData = {
    archOpeningWidth: openingWidth,
    archSpringHeight: springHeight,
    archApexHeight: apex,
    properCurvedArch: true,
  };
  return geometry;
}

function addCurvedArchWall(group, edge, tileSize, userData) {
  const geometry = createArchWallGeometry(edge, tileSize);
  const mesh = new THREE.Mesh(
    geometry,
    makeMaterial(edge.material)
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    ...userData,
    type: "squareStructureSegment",
    structureSegment: "curved-arch-wall",
  };
  group.add(mesh);
  return mesh;
}

function loadStructureAsset(url) {
  if (!url) return Promise.resolve(null);
  if (!structureAssetCache.has(url)) {
    structureAssetCache.set(
      url,
      new Promise((resolve) => {
        structureLoader.load(
          url,
          (gltf) => resolve(gltf?.scene || null),
          undefined,
          () => resolve(null)
        );
      })
    );
  }
  return structureAssetCache.get(url);
}

function attachAssetIfAvailable({
  edgeContainer,
  fallbackGroup,
  edge,
  tileSize,
}) {
  const descriptor = resolveSquareStructureAsset(edge);
  if (!descriptor?.url) return;

  const dims = wallDimensions(edge, tileSize);
  loadStructureAsset(descriptor.url).then((source) => {
    if (!source || !edgeContainer?.parent) return;
    const model = source.clone(true);
    model.name = `structure-asset-${edge.material}-${edge.kind}`;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    if (
      !Number.isFinite(size.x) ||
      !Number.isFinite(size.y) ||
      size.x <= 0.0001 ||
      size.y <= 0.0001
    ) {
      return;
    }

    const userScale = Number(edge?.visual?.assetScale) || 1;
    const fitScale = Math.min(
      dims.wallLength / size.x,
      dims.wallHeight / size.y
    ) * userScale;
    model.scale.setScalar(fitScale);

    const fittedBox = new THREE.Box3().setFromObject(model);
    const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
    model.position.x -= fittedCenter.x;
    model.position.z -= fittedCenter.z;
    model.position.y -= fittedBox.min.y;

    model.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData = {
        ...(child.userData || {}),
        structuralAsset: true,
        blocksMovement: edge.blocksMovement,
        blocksLineOfSight: edge.blocksLineOfSight,
      };
    });

    edgeContainer.add(model);
    fallbackGroup.visible = false;
    edgeContainer.userData.assetUrl = descriptor.url;
    edgeContainer.userData.assetLoaded = true;
  });
}

function addStructureEdge(group, {
  grid,
  x,
  y,
  direction,
  edge,
  tileSize,
}) {
  const transform = edgeTransform(x, y, direction, tileSize);
  const baseY = structureBaseY(grid, x, y, direction);
  const edgeContainer = new THREE.Group();
  edgeContainer.name = `square-structure-${x}-${y}-${direction}`;
  edgeContainer.position.set(transform.x, baseY, transform.z);
  edgeContainer.rotation.y = transform.rotationY;

  const commonUserData = {
    mapType: "square",
    structuralEdge: true,
    cellX: x,
    cellY: y,
    q: x,
    r: y,
    x,
    y,
    direction,
    structureKind: edge.kind,
    structureMaterial: edge.material,
    blocksMovement: edge.blocksMovement,
    blocksLineOfSight: edge.blocksLineOfSight,
  };
  edgeContainer.userData = { ...commonUserData };

  const fallbackGroup = new THREE.Group();
  fallbackGroup.name = "procedural-structure-fallback";
  fallbackGroup.userData = { ...commonUserData };
  edgeContainer.add(fallbackGroup);

  if (edge.kind === "door") {
    addOpeningFrame(fallbackGroup, edge, tileSize, {
      openingWidthFeet: edge.doorWidthFeet,
      openingBottomFeet: 0,
      openingHeightFeet: edge.doorHeightFeet,
      includeDoorSlab: true,
      userData: commonUserData,
    });
  } else if (edge.kind === "window") {
    addOpeningFrame(fallbackGroup, edge, tileSize, {
      openingWidthFeet: edge.windowWidthFeet,
      openingBottomFeet: edge.windowSillFeet,
      openingHeightFeet: edge.windowHeightFeet,
      windowStyle: edge.windowStyle || edge.visual?.windowStyle || "open",
      userData: commonUserData,
    });
  } else if (edge.kind === "archway") {
    addCurvedArchWall(
      fallbackGroup,
      edge,
      tileSize,
      commonUserData
    );
  } else {
    addFullWall(fallbackGroup, edge, tileSize, commonUserData);
  }

  group.add(edgeContainer);

  attachAssetIfAvailable({
    edgeContainer,
    fallbackGroup,
    edge,
    tileSize,
  });

  return edgeContainer;
}

export function buildSquareStructureGroup(
  grid = [],
  tileSize,
) {
  const group = new THREE.Group();
  group.name = "square-structural-walls";
  group.userData.mapType = "square";
  group.userData.structureAuthority = "square-edge-v1";

  const { width, height } = getGridSize(grid);
  let edgeCount = 0;
  let movementBlockingEdges = 0;
  let losBlockingEdges = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = grid?.[y]?.[x];
      if (!cell) continue;

      for (const direction of ["N", "E", "S", "W"]) {
        if (
          !shouldRenderSquareStructureEdge({
            direction,
            x,
            y,
            width,
            height,
          })
        ) {
          continue;
        }

        const edge = getSquareCellStructureEdge(cell, direction);
        if (!edge) continue;

        addStructureEdge(group, {
          grid,
          x,
          y,
          direction,
          edge,
          tileSize,
        });
        edgeCount += 1;
        if (edge.blocksMovement) movementBlockingEdges += 1;
        if (edge.blocksLineOfSight) losBlockingEdges += 1;
      }
    }
  }

  group.userData.edgeCount = edgeCount;
  group.userData.movementBlockingEdges = movementBlockingEdges;
  group.userData.losBlockingEdges = losBlockingEdges;

  return group;
}

export function disposeSquareStructureGroup(group) {
  if (!group) return;
  const materials = new Set();
  group.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material && materials.add(material));
    } else if (child.material) {
      materials.add(child.material);
    }
  });
  materials.forEach((material) => material?.dispose?.());
}

export function replaceSquareStructureGroup({
  group,
  grid,
  tileSize,
} = {}) {
  if (!group) return null;

  const previous = group.userData?.structureRoot || null;
  if (previous) {
    group.remove(previous);
    disposeSquareStructureGroup(previous);
  }

  const structureRoot = buildSquareStructureGroup(grid, tileSize);
  group.add(structureRoot);
  group.userData.structureRoot = structureRoot;
  group.userData.structureEdgeCount = structureRoot.userData.edgeCount || 0;
  return structureRoot;
}

export default {
  buildSquareStructureGroup,
  disposeSquareStructureGroup,
  replaceSquareStructureGroup,
};

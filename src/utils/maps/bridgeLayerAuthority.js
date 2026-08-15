export const BRIDGE_LAYER_TYPE = "bridge-deck";
export const BRIDGE_STRUCTURE_VERSION = 1;
export const TERRAIN_HEIGHT_STEP_FEET = 2.5;

export const BRIDGE_MATERIALS = Object.freeze({
  WOOD: "wood",
  STONE: "stone",
});

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function cloneGrid(grid = []) {
  return (Array.isArray(grid) ? grid : []).map((row) =>
    Array.isArray(row)
      ? row.map((cell) => ({
          ...(cell || {}),
          verticalLayers: Array.isArray(cell?.verticalLayers)
            ? cell.verticalLayers.map((layer) => ({ ...(layer || {}) }))
            : [],
        }))
      : []
  );
}

function normalizePoint(point = {}) {
  const x = Number(point.x ?? point.q);
  const y = Number(point.y ?? point.r);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
}

function inBounds(grid, point) {
  return Boolean(point && grid?.[point.y]?.[point.x]);
}

export function buildBridgeCellPath(start, end) {
  const a = normalizePoint(start);
  const b = normalizePoint(end);
  if (!a || !b) return [];

  let x0 = a.x;
  let y0 = a.y;
  const x1 = b.x;
  const y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  const path = [];

  while (true) {
    path.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y0 += sy;
    }
  }
  return path;
}

export function getTerrainSurfaceFeet(cell = {}) {
  const elevation = Number.isFinite(Number(cell?.height))
    ? Number(cell.height)
    : finite(cell?.elevation, 0);
  return elevation * TERRAIN_HEIGHT_STEP_FEET;
}

function headingDegrees(path, index) {
  const current = path[index];
  const reference = path[index + 1] || path[index - 1] || current;
  const dx = reference.x - current.x;
  const dy = reference.y - current.y;
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function makeBridgeId(seed, path) {
  const input = `${seed}:${path.map((point) => `${point.x},${point.y}`).join("|")}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `bridge-${(hash >>> 0).toString(36)}`;
}

export function normalizeBridgeDefinition(bridge = {}) {
  const material = String(bridge.material || BRIDGE_MATERIALS.WOOD).toLowerCase() === BRIDGE_MATERIALS.STONE
    ? BRIDGE_MATERIALS.STONE
    : BRIDGE_MATERIALS.WOOD;
  return {
    id: String(bridge.id || "bridge"),
    name: String(bridge.name || "Bridge"),
    type: "bridge",
    version: BRIDGE_STRUCTURE_VERSION,
    material,
    widthFeet: clamp(finite(bridge.widthFeet, 8), 3, 30),
    deckElevationFeet: finite(bridge.deckElevationFeet, 1),
    deckThicknessFeet: clamp(finite(bridge.deckThicknessFeet, material === "stone" ? 1.5 : 0.75), 0.35, 4),
    railings: bridge.railings !== false,
    railingHeightFeet: clamp(finite(bridge.railingHeightFeet, 3.5), 1, 6),
    supports: bridge.supports !== false,
    supportSpacingCells: clamp(Math.round(finite(bridge.supportSpacingCells, 3)), 1, 8),
    path: Array.isArray(bridge.path) ? bridge.path.map(normalizePoint).filter(Boolean) : [],
    mapType: String(bridge.mapType || "hex").toLowerCase() === "square" ? "square" : "hex",
    destructible: bridge.destructible !== false,
    traversal: {
      deckEnabled: true,
      lowerLayerPreserved: true,
      underpassAllowed: true,
      ...(bridge.traversal || {}),
    },
    visual: {
      assetId: bridge.visual?.assetId || null,
      assetUrl: bridge.visual?.assetUrl || null,
      useProceduralFallback: bridge.visual?.useProceduralFallback !== false,
      ...(bridge.visual || {}),
    },
  };
}

export function createBridgeOnMap({
  mapDefinition,
  start,
  end,
  material = BRIDGE_MATERIALS.WOOD,
  widthFeet = 8,
  deckRiseFeet = 0.75,
  railings = true,
  supports = true,
  supportSpacingCells = 3,
  seed = "bridge",
  name = "Bridge",
  assetUrl = null,
} = {}) {
  const grid = cloneGrid(mapDefinition?.grid || []);
  let path = buildBridgeCellPath(start, end).filter((point) => inBounds(grid, point));
  if (path.length < 2) {
    return {
      accepted: false,
      reason: "bridge-needs-at-least-two-cells",
      mapDefinition,
      changes: [],
    };
  }

  // Preserve order but remove duplicates caused by diagonal rasterization.
  const seen = new Set();
  path = path.filter((point) => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const terrainSurfaces = path.map((point) =>
    getTerrainSurfaceFeet(grid[point.y][point.x])
  );
  const endpointSurfaceFeet = Math.max(
    getTerrainSurfaceFeet(grid[path[0].y][path[0].x]),
    getTerrainSurfaceFeet(grid[path[path.length - 1].y][path[path.length - 1].x])
  );
  const highSurfaceFeet = Math.max(endpointSurfaceFeet, ...terrainSurfaces);
  const deckElevationFeet = highSurfaceFeet + clamp(finite(deckRiseFeet, 0.75), 0, 12);
  const bridgeId = makeBridgeId(seed, path);

  const bridge = normalizeBridgeDefinition({
    id: bridgeId,
    name,
    material,
    widthFeet,
    deckElevationFeet,
    railings,
    supports,
    supportSpacingCells,
    path,
    mapType: mapDefinition?.mapType,
    visual: { assetUrl, useProceduralFallback: true },
  });

  const changes = [];
  path.forEach((point, index) => {
    const cell = grid[point.y][point.x];
    const terrainSurfaceFeet = getTerrainSurfaceFeet(cell);
    const clearanceFeet = Math.max(
      0,
      bridge.deckElevationFeet - terrainSurfaceFeet - bridge.deckThicknessFeet
    );
    const existingLayers = Array.isArray(cell.verticalLayers)
      ? cell.verticalLayers.filter((layer) => layer?.bridgeId !== bridge.id)
      : [];
    const layer = {
      id: `${bridge.id}:deck:${index}`,
      type: BRIDGE_LAYER_TYPE,
      layer: "bridge-deck",
      bridgeId: bridge.id,
      bridgeIndex: index,
      x: point.x,
      y: point.y,
      headingDegrees: headingDegrees(path, index),
      material: bridge.material,
      widthFeet: bridge.widthFeet,
      deckElevationFeet: bridge.deckElevationFeet,
      deckThicknessFeet: bridge.deckThicknessFeet,
      clearanceFeet,
      railings: bridge.railings,
      railingHeightFeet: bridge.railingHeightFeet,
      support:
        bridge.supports &&
        index > 0 &&
        index < path.length - 1 &&
        index % bridge.supportSpacingCells === 0,
      traversal: {
        deckEnabled: true,
        lowerLayerPreserved: true,
        underpassAllowed: clearanceFeet > 0,
      },
      blocksLowerTraversal: false,
      destructible: bridge.destructible,
      visual: { ...bridge.visual },
    };
    const nextCell = {
      ...cell,
      verticalLayers: [...existingLayers, layer],
      verticalLayerVersion: BRIDGE_STRUCTURE_VERSION,
    };
    grid[point.y][point.x] = nextCell;
    changes.push({ x: point.x, y: point.y, cell: nextCell });
  });

  const existingStructures = mapDefinition?.structures || {};
  const existingBridges = Array.isArray(existingStructures.bridges)
    ? existingStructures.bridges.filter((item) => item?.id !== bridge.id)
    : [];
  const nextDefinition = {
    ...(mapDefinition || {}),
    grid,
    structures: {
      ...existingStructures,
      version: Math.max(Number(existingStructures.version) || 0, BRIDGE_STRUCTURE_VERSION),
      bridges: [...existingBridges, bridge],
    },
  };

  const clearances = changes.map((change) =>
    change.cell.verticalLayers.find((layer) => layer.bridgeId === bridge.id)?.clearanceFeet || 0
  );

  return {
    accepted: true,
    mapDefinition: nextDefinition,
    bridge,
    changes,
    minimumClearanceFeet: Math.min(...clearances),
    maximumClearanceFeet: Math.max(...clearances),
  };
}

export function deleteBridgeFromMap(mapDefinition, bridgeId) {
  const id = String(bridgeId || "");
  if (!id) return { accepted: false, reason: "bridge-id-required", mapDefinition, changes: [] };

  const grid = cloneGrid(mapDefinition?.grid || []);
  const changes = [];
  let removedLayers = 0;
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < (grid[y]?.length || 0); x += 1) {
      const cell = grid[y][x];
      const before = Array.isArray(cell?.verticalLayers) ? cell.verticalLayers : [];
      const after = before.filter((layer) => layer?.bridgeId !== id);
      if (after.length === before.length) continue;
      removedLayers += before.length - after.length;
      const nextCell = { ...cell, verticalLayers: after };
      grid[y][x] = nextCell;
      changes.push({ x, y, cell: nextCell });
    }
  }

  const structures = mapDefinition?.structures || {};
  const bridges = Array.isArray(structures.bridges)
    ? structures.bridges.filter((bridge) => bridge?.id !== id)
    : [];

  if (!removedLayers && bridges.length === (structures.bridges?.length || 0)) {
    return { accepted: false, reason: "bridge-not-found", mapDefinition, changes: [] };
  }

  return {
    accepted: true,
    removedLayers,
    changes,
    mapDefinition: {
      ...(mapDefinition || {}),
      grid,
      structures: {
        ...structures,
        bridges,
      },
    },
  };
}

export function getBridgeDeckLayersAt(mapDefinition, x, y) {
  const layers = mapDefinition?.grid?.[Number(y)]?.[Number(x)]?.verticalLayers;
  return (Array.isArray(layers) ? layers : []).filter(
    (layer) => layer?.type === BRIDGE_LAYER_TYPE || layer?.layer === "bridge-deck"
  );
}

export function getVerticalTraversalLayersAt(mapDefinition, x, y) {
  const cell = mapDefinition?.grid?.[Number(y)]?.[Number(x)] || null;
  if (!cell) return [];
  const ground = {
    id: `ground:${x},${y}`,
    type: "ground",
    layer: "ground",
    surfaceElevationFeet: getTerrainSurfaceFeet(cell),
    terrain: cell.terrain || cell.terrainType || "grass",
    walkable: cell.walkable !== false,
  };
  return [ground, ...getBridgeDeckLayersAt(mapDefinition, x, y)];
}

export default {
  BRIDGE_LAYER_TYPE,
  BRIDGE_MATERIALS,
  buildBridgeCellPath,
  createBridgeOnMap,
  deleteBridgeFromMap,
  getBridgeDeckLayersAt,
  getVerticalTraversalLayersAt,
  normalizeBridgeDefinition,
};

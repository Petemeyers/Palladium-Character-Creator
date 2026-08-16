import {
  applyGridStructureEdgeEdit,
  getGridStructureDirections,
  normalizeGridStructureEdge,
  normalizeGridStructureMapType,
} from "./gridStructureAuthority.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizePoint(point = {}) {
  const x = Number(point.x ?? point.q);
  const y = Number(point.y ?? point.r);
  return Number.isFinite(x) && Number.isFinite(y)
    ? { x: Math.round(x), y: Math.round(y) }
    : null;
}

function mergeChanges(changes = []) {
  const byKey = new Map();
  changes.forEach((change) => {
    if (change) byKey.set(`${change.x},${change.y}`, change);
  });
  return [...byKey.values()];
}

function axialToCube({ x, y }) {
  return { x, z: y, y: -x - y };
}

function cubeRound(cube) {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);
  const dx = Math.abs(rx - cube.x);
  const dy = Math.abs(ry - cube.y);
  const dz = Math.abs(rz - cube.z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: rz };
}

function hexDistance(a, b) {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(
    Math.abs(ac.x - bc.x),
    Math.abs(ac.y - bc.y),
    Math.abs(ac.z - bc.z)
  );
}

export function buildHexStructureCellPath(start, end) {
  const a = normalizePoint(start);
  const b = normalizePoint(end);
  if (!a || !b) return [];
  const distance = hexDistance(a, b);
  if (distance <= 0) return [a];
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  const result = [];
  for (let i = 0; i <= distance; i += 1) {
    const t = i / distance;
    result.push(cubeRound({
      x: ac.x + (bc.x - ac.x) * t,
      y: ac.y + (bc.y - ac.y) * t,
      z: ac.z + (bc.z - ac.z) * t,
    }));
  }
  return result.filter((point, index, list) =>
    index === 0 || point.x !== list[index - 1].x || point.y !== list[index - 1].y
  );
}

function squarePath(start, end) {
  const a = normalizePoint(start);
  const b = normalizePoint(end);
  if (!a || !b) return [];
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const result = [];
  if (horizontal) {
    const y = Math.round((a.y + b.y) / 2);
    const min = Math.min(a.x, b.x);
    const max = Math.max(a.x, b.x);
    for (let x = min; x <= max; x += 1) result.push({ x, y });
  } else {
    const x = Math.round((a.x + b.x) / 2);
    const min = Math.min(a.y, b.y);
    const max = Math.max(a.y, b.y);
    for (let y = min; y <= max; y += 1) result.push({ x, y });
  }
  return result;
}

function directionVector(direction) {
  return { x: Number(direction.dx) || 0, y: Number(direction.dy) || 0 };
}

function choosePerpendicularEdge(mapType, previous, current, next, side = "left") {
  const tangent = {
    x: Number(next?.x ?? current.x) - Number(previous?.x ?? current.x),
    y: Number(next?.y ?? current.y) - Number(previous?.y ?? current.y),
  };
  if (tangent.x === 0 && tangent.y === 0) {
    return getGridStructureDirections(mapType)[0]?.key || "E";
  }
  const normal = side === "right"
    ? { x: tangent.y, y: -tangent.x }
    : { x: -tangent.y, y: tangent.x };
  let best = null;
  getGridStructureDirections(mapType).forEach((direction) => {
    const vector = directionVector(direction);
    const score = normal.x * vector.x + normal.y * vector.y;
    if (!best || score > best.score) best = { key: direction.key, score };
  });
  return best?.key || "E";
}

export function applyGridStructureWallLine({
  grid,
  mapType = "hex",
  start,
  end,
  edge,
  side = "left",
} = {}) {
  const normalizedMapType = normalizeGridStructureMapType(mapType);
  const path = normalizedMapType === "square"
    ? squarePath(start, end)
    : buildHexStructureCellPath(start, end);
  const inBounds = path.filter((point) => grid?.[point.y]?.[point.x]);
  if (!inBounds.length) {
    return { accepted: false, reason: "wall-line-out-of-bounds", grid, changes: [], path: [] };
  }

  const normalizedEdge = normalizeGridStructureEdge(edge || {}, normalizedMapType);
  let nextGrid = grid;
  const changes = [];
  let appliedEdges = 0;

  inBounds.forEach((point, index) => {
    const previous = inBounds[index - 1] || point;
    const next = inBounds[index + 1] || point;
    let direction;
    if (normalizedMapType === "square") {
      const horizontal = Math.abs((end?.x ?? end?.q) - (start?.x ?? start?.q)) >=
        Math.abs((end?.y ?? end?.r) - (start?.y ?? start?.r));
      direction = horizontal
        ? (side === "right" ? "S" : "N")
        : (side === "right" ? "E" : "W");
    } else {
      direction = choosePerpendicularEdge(normalizedMapType, previous, point, next, side);
    }

    const result = applyGridStructureEdgeEdit({
      grid: nextGrid,
      mapType: normalizedMapType,
      x: point.x,
      y: point.y,
      direction,
      edge: normalizedEdge,
    });
    if (!result.accepted) return;
    nextGrid = result.grid;
    changes.push(...result.changes);
    appliedEdges += 1;
  });

  return {
    accepted: appliedEdges > 0,
    reason: appliedEdges > 0 ? null : "wall-line-no-valid-edges",
    grid: nextGrid,
    changes: mergeChanges(changes),
    path: inBounds,
    appliedEdges,
    mapType: normalizedMapType,
    side: side === "right" ? "right" : "left",
  };
}

export default {
  applyGridStructureWallLine,
  buildHexStructureCellPath,
};

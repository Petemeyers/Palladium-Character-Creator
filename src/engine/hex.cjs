// src/engine/hex.cjs
// Hex grid utilities for pathfinding

// Axial hex neighbors (stored as x,y in state)
const DIRS = [
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
];

function neighbors(pos) {
  return DIRS.map(d => ({ x: pos.x + d.x, y: pos.y + d.y }));
}

function distance(a, b) {
  // Axial hex distance
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = -(dx + dy);
  return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
}

function key(p) {
  return `${p.x},${p.y}`;
}

module.exports = { neighbors, distance, key };


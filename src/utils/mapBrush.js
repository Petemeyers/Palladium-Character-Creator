import { axialToOffset, offsetToAxial } from "./hexGridMath.js";

function inBounds(col, row, bounds = {}) {
  const width = Number(bounds.width);
  const height = Number(bounds.height);
  return (
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    col >= 0 &&
    row >= 0 &&
    col < width &&
    row < height
  );
}

export function getHexesInRadius(centerQ, centerR, radius = 0, bounds = {}) {
  const centerCol = Number(centerQ);
  const centerRow = Number(centerR);
  const brushRadius = Math.max(0, Math.floor(Number(radius) || 0));
  if (!Number.isInteger(centerCol) || !Number.isInteger(centerRow)) return [];

  const centerAxial = offsetToAxial(centerCol, centerRow);
  const hexes = [];
  const seen = new Set();

  for (let dq = -brushRadius; dq <= brushRadius; dq++) {
    const minDr = Math.max(-brushRadius, -dq - brushRadius);
    const maxDr = Math.min(brushRadius, -dq + brushRadius);
    for (let dr = minDr; dr <= maxDr; dr++) {
      const axialQ = centerAxial.q + dq;
      const axialR = centerAxial.r + dr;
      const offset = axialToOffset(axialQ, axialR);
      const col = Number(offset.col);
      const row = Number(offset.row);
      const key = `${col},${row}`;
      if (seen.has(key) || !inBounds(col, row, bounds)) continue;
      seen.add(key);
      hexes.push({
        q: col,
        r: row,
        x: col,
        y: row,
        axialQ,
        axialR,
      });
    }
  }

  return hexes;
}

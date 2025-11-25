const HEX_DIRECTIONS = [
  { q: +1, r: 0 },
  { q: +1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: +1 },
  { q: 0, r: +1 },
];

export function hexDistance(a, b) {
  return (
    (Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)) / 2
  );
}

function hexNeighbors(q, r) {
  return HEX_DIRECTIONS.map((dir) => ({ q: q + dir.q, r: r + dir.r }));
}

function terrainCost(tile) {
  switch (tile.terrain) {
    case "water":
      return 5;
    case "hill":
      return 2;
    case "rock":
      return 3;
    case "forest":
      return 1.5;
    case "sand":
      return 2;
    default:
      return 1;
  }
}

function tileKey(tile) {
  return `${tile.q},${tile.r}`;
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  let key = tileKey(current);
  while (cameFrom.has(key)) {
    current = cameFrom.get(key);
    key = tileKey(current);
    path.unshift(current);
  }
  return path;
}

export function findPath(startTile, endTile, hexManager, options = {}) {
  if (!startTile || !endTile || !hexManager) return [];
  const openSet = [startTile];
  const cameFrom = new Map();
  const gScore = new Map([[tileKey(startTile), 0]]);
  const fScore = new Map([[tileKey(startTile), hexDistance(startTile, endTile)]]);
  const ignoreWater = Boolean(options.ignoreWater);

  while (openSet.length > 0) {
    openSet.sort(
      (a, b) =>
        (fScore.get(tileKey(a)) ?? Number.POSITIVE_INFINITY) -
        (fScore.get(tileKey(b)) ?? Number.POSITIVE_INFINITY)
    );
    const current = openSet.shift();
    if (tileKey(current) === tileKey(endTile)) {
      return reconstructPath(cameFrom, current);
    }

    hexNeighbors(current.q, current.r).forEach(({ q, r }) => {
      const neighbor = hexManager.getTopTile(q, r);
      if (!neighbor) return;
      if (neighbor === current) return;
      if (!ignoreWater && neighbor.terrain === "water") return;

      const elevationPenalty = Math.abs(neighbor.height - current.height) * 0.5;
      const stepCost = terrainCost(neighbor) + elevationPenalty;
      const tentativeG =
        (gScore.get(tileKey(current)) ?? Number.POSITIVE_INFINITY) + stepCost;

      if (tentativeG < (gScore.get(tileKey(neighbor)) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(tileKey(neighbor), current);
        gScore.set(tileKey(neighbor), tentativeG);
        fScore.set(
          tileKey(neighbor),
          tentativeG + hexDistance(neighbor, endTile)
        );
        if (!openSet.some((candidate) => tileKey(candidate) === tileKey(neighbor))) {
          openSet.push(neighbor);
        }
      }
    });
  }

  return [];
}



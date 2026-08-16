import {
  applySquareStructureEdgeEdit,
  normalizeSquareStructureEdge,
  SQUARE_WINDOW_STYLES,
} from "./squareStructureAuthority.js";

export const SQUARE_STRUCTURE_DRAW_MODES = Object.freeze({
  EDGE: "edge",
  ROOM: "room",
  WALL_LINE: "wall-line",
  BUILDING: "building",
});

export const SQUARE_BUILDING_TEMPLATES = Object.freeze({
  TAVERN: "tavern",
  COTTAGE: "cottage",
  FARMHOUSE: "farmhouse",
  BARRACKS: "barracks",
  CHAPEL: "chapel",
  DUNGEON_CHAMBER: "dungeon-chamber",
  STOREHOUSE: "storehouse",
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

function hash32(value) {
  const text = String(value ?? "");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return hash >>> 0;
}

function random01(seed, channel = 0) {
  let value = hash32(`${seed}:${channel}`);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

function boundsFromPoints(start, end) {
  const sx = Number(start?.x ?? start?.q);
  const sy = Number(start?.y ?? start?.r);
  const ex = Number(end?.x ?? end?.q);
  const ey = Number(end?.y ?? end?.r);
  if (![sx, sy, ex, ey].every(Number.isFinite)) return null;

  return {
    minX: Math.min(Math.round(sx), Math.round(ex)),
    maxX: Math.max(Math.round(sx), Math.round(ex)),
    minY: Math.min(Math.round(sy), Math.round(ey)),
    maxY: Math.max(Math.round(sy), Math.round(ey)),
  };
}

function gridSize(grid = []) {
  return {
    height: Array.isArray(grid) ? grid.length : 0,
    width: (Array.isArray(grid) ? grid : []).reduce(
      (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
      0
    ),
  };
}

function clampBounds(bounds, grid = []) {
  if (!bounds) return null;
  const { width, height } = gridSize(grid);
  if (!width || !height) return null;
  return {
    minX: clamp(bounds.minX, 0, width - 1),
    maxX: clamp(bounds.maxX, 0, width - 1),
    minY: clamp(bounds.minY, 0, height - 1),
    maxY: clamp(bounds.maxY, 0, height - 1),
  };
}

function mergeChanges(changes = []) {
  const byKey = new Map();
  changes.forEach((change) => {
    if (!change) return;
    byKey.set(`${change.x},${change.y}`, change);
  });
  return Array.from(byKey.values());
}

function applyEdgeSequence(grid, edits = []) {
  let nextGrid = grid;
  const allChanges = [];
  let applied = 0;

  edits.forEach((edit) => {
    const result = applySquareStructureEdgeEdit({
      grid: nextGrid,
      ...edit,
    });
    if (!result.accepted) return;
    nextGrid = result.grid;
    allChanges.push(...result.changes);
    applied += 1;
  });

  return {
    accepted: applied > 0,
    grid: nextGrid,
    changes: mergeChanges(allChanges),
    appliedEdges: applied,
  };
}

function perimeterEdits(bounds, edge) {
  const edits = [];
  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    edits.push({ x, y: bounds.minY, direction: "N", edge });
    edits.push({ x, y: bounds.maxY, direction: "S", edge });
  }
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    edits.push({ x: bounds.minX, y, direction: "W", edge });
    edits.push({ x: bounds.maxX, y, direction: "E", edge });
  }
  return edits;
}

function decorateCells(grid, bounds, patch) {
  const next = grid.map((row) =>
    row.map((cell) => ({
      ...(cell || {}),
      walls: { ...(cell?.walls || {}) },
    }))
  );
  const changes = [];

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const cell = next?.[y]?.[x];
      if (!cell) continue;
      next[y][x] = {
        ...cell,
        ...patch,
      };
      changes.push({ x, y, cell: next[y][x] });
    }
  }

  return { grid: next, changes };
}

export function applySquareStructureRoom({
  grid,
  start,
  end,
  edge,
  buildingId = null,
} = {}) {
  const bounds = clampBounds(boundsFromPoints(start, end), grid);
  if (!bounds) {
    return { accepted: false, reason: "invalid-room-bounds", grid, changes: [] };
  }

  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  if (width < 1 || height < 1) {
    return { accepted: false, reason: "empty-room", grid, changes: [] };
  }

  const normalizedEdge = normalizeSquareStructureEdge(edge || {});
  const perimeter = applyEdgeSequence(
    grid,
    perimeterEdits(bounds, normalizedEdge)
  );

  if (!perimeter.accepted) return perimeter;

  const decorated = decorateCells(
    perimeter.grid,
    bounds,
    buildingId
      ? {
          buildingId,
          interiorStructure: true,
        }
      : { interiorStructure: true }
  );

  return {
    ...perimeter,
    grid: decorated.grid,
    changes: mergeChanges([...perimeter.changes, ...decorated.changes]),
    bounds,
    mode: SQUARE_STRUCTURE_DRAW_MODES.ROOM,
  };
}

export function applySquareStructureWallLine({
  grid,
  start,
  end,
  edge,
} = {}) {
  const bounds = clampBounds(boundsFromPoints(start, end), grid);
  if (!bounds) {
    return { accepted: false, reason: "invalid-wall-line", grid, changes: [] };
  }

  const sx = Number(start?.x ?? start?.q);
  const sy = Number(start?.y ?? start?.r);
  const ex = Number(end?.x ?? end?.q);
  const ey = Number(end?.y ?? end?.r);
  const horizontal = Math.abs(ex - sx) >= Math.abs(ey - sy);
  const normalizedEdge = normalizeSquareStructureEdge(edge || {});
  const edits = [];

  if (horizontal) {
    const y = clamp(Math.round((sy + ey) / 2), bounds.minY, bounds.maxY);
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      edits.push({
        x,
        y,
        direction: sy <= ey ? "N" : "S",
        edge: normalizedEdge,
      });
    }
  } else {
    const x = clamp(Math.round((sx + ex) / 2), bounds.minX, bounds.maxX);
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      edits.push({
        x,
        y,
        direction: sx <= ex ? "W" : "E",
        edge: normalizedEdge,
      });
    }
  }

  const result = applyEdgeSequence(grid, edits);
  return {
    ...result,
    bounds,
    orientation: horizontal ? "horizontal" : "vertical",
    mode: SQUARE_STRUCTURE_DRAW_MODES.WALL_LINE,
  };
}

function chooseEntrance(bounds, seed) {
  const sides = ["S", "E", "N", "W"];
  const side = sides[Math.floor(random01(seed, 1) * sides.length) % sides.length];

  if (side === "N" || side === "S") {
    const x = Math.round((bounds.minX + bounds.maxX) / 2);
    return { x, y: side === "N" ? bounds.minY : bounds.maxY, direction: side };
  }
  const y = Math.round((bounds.minY + bounds.maxY) / 2);
  return { x: side === "W" ? bounds.minX : bounds.maxX, y, direction: side };
}

function outerEdgeCells(bounds) {
  const result = [];
  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    result.push({ x, y: bounds.minY, direction: "N" });
    result.push({ x, y: bounds.maxY, direction: "S" });
  }
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    result.push({ x: bounds.minX, y, direction: "W" });
    result.push({ x: bounds.maxX, y, direction: "E" });
  }
  return result;
}

function sameEdge(a, b) {
  return a.x === b.x && a.y === b.y && a.direction === b.direction;
}

function windowStyleFor({ template, wealth, requested }) {
  if (requested && requested !== "auto") return requested;
  if (template === SQUARE_BUILDING_TEMPLATES.CHAPEL) {
    return wealth === "wealthy"
      ? SQUARE_WINDOW_STYLES.STAINED
      : SQUARE_WINDOW_STYLES.LEADED;
  }
  if (wealth === "wealthy") return SQUARE_WINDOW_STYLES.LEADED;
  if (wealth === "common" && [
    SQUARE_BUILDING_TEMPLATES.TAVERN,
    SQUARE_BUILDING_TEMPLATES.BARRACKS,
  ].includes(template)) {
    return SQUARE_WINDOW_STYLES.LEADED;
  }
  if (template === SQUARE_BUILDING_TEMPLATES.DUNGEON_CHAMBER) {
    return SQUARE_WINDOW_STYLES.OPEN;
  }
  return SQUARE_WINDOW_STYLES.SHUTTERED;
}

function pushSuggestedProp(list, {
  type,
  x,
  y,
  name,
  rotation = 0,
  scale = 1,
  socket = null,
} = {}) {
  list.push({
    id: `generated-${type}-${x}-${y}-${list.length}`,
    type,
    name: name || type,
    x,
    y,
    q: x,
    r: y,
    coordinateSpace: "offset",
    rotation,
    scale,
    generatedBy: "square-building-generator-v1",
    buildingSocket: socket,
  });
}

function furnishingPlan(template, bounds, seed) {
  const props = [];
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  const cx = Math.round((bounds.minX + bounds.maxX) / 2);
  const cy = Math.round((bounds.minY + bounds.maxY) / 2);
  const inside = (x, y) => (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY
  );
  const add = (type, x, y, socket = null, options = {}) => {
    if (!inside(x, y)) return;
    pushSuggestedProp(props, { type, x, y, socket, ...options });
  };

  if (template === SQUARE_BUILDING_TEMPLATES.TAVERN) {
    add("hearth", bounds.maxX - 1, bounds.minY + 1, "hearth");
    add("bar-counter", bounds.minX + 1, bounds.minY + 1, "service");
    const tableCount = clamp(Math.floor((width * height) / 12), 1, 5);
    for (let i = 0; i < tableCount; i += 1) {
      const x = clamp(
        bounds.minX + 1 + Math.floor(random01(seed, 20 + i) * Math.max(1, width - 2)),
        bounds.minX,
        bounds.maxX
      );
      const y = clamp(
        bounds.minY + 1 + Math.floor(random01(seed, 40 + i) * Math.max(1, height - 2)),
        bounds.minY,
        bounds.maxY
      );
      add("table", x, y, "seating");
      if (x + 1 <= bounds.maxX) add("chair", x + 1, y, "seating");
    }
    add("barrel", bounds.minX + 1, bounds.maxY - 1, "storage");
    add("keg", bounds.minX + 2, bounds.maxY - 1, "storage");
  } else if (template === SQUARE_BUILDING_TEMPLATES.COTTAGE) {
    add("bed", bounds.maxX - 1, bounds.minY + 1, "sleep");
    add("hearth", bounds.minX + 1, bounds.minY + 1, "hearth");
    add("table", cx, cy, "living");
    add("chest", bounds.maxX - 1, bounds.maxY - 1, "storage");
  } else if (template === SQUARE_BUILDING_TEMPLATES.FARMHOUSE) {
    add("bed", bounds.maxX - 1, bounds.minY + 1, "sleep");
    add("table", cx, cy, "living");
    add("grain-sack", bounds.minX + 1, bounds.maxY - 1, "storage");
    add("basket", bounds.minX + 2, bounds.maxY - 1, "storage");
    add("hearth", bounds.minX + 1, bounds.minY + 1, "hearth");
  } else if (template === SQUARE_BUILDING_TEMPLATES.BARRACKS) {
    for (let x = bounds.minX + 1; x <= bounds.maxX - 1; x += 2) {
      add("bed", x, bounds.minY + 1, "sleep");
      add("bed", x, bounds.maxY - 1, "sleep");
    }
    add("weapon-rack", bounds.maxX - 1, cy, "equipment");
    add("bench", cx, cy, "common");
  } else if (template === SQUARE_BUILDING_TEMPLATES.CHAPEL) {
    add("altar", cx, bounds.minY + 1, "altar");
    for (let y = bounds.minY + 3; y <= bounds.maxY - 1; y += 2) {
      add("bench", cx - 1, y, "congregation");
      add("bench", cx + 1, y, "congregation");
    }
    add("candle-stand", cx, bounds.minY + 2, "altar");
  } else if (template === SQUARE_BUILDING_TEMPLATES.DUNGEON_CHAMBER) {
    add("torch", bounds.minX, cy, "light");
    add("crate", bounds.maxX - 1, bounds.maxY - 1, "storage");
    add("barrel", bounds.maxX - 2, bounds.maxY - 1, "storage");
    if (width >= 5 && height >= 5) add("cage", bounds.minX + 1, bounds.minY + 1, "prison");
  } else if (template === SQUARE_BUILDING_TEMPLATES.STOREHOUSE) {
    for (let x = bounds.minX + 1; x <= bounds.maxX - 1; x += 2) {
      add("crate", x, bounds.minY + 1, "storage");
      add("barrel", x, bounds.maxY - 1, "storage");
    }
  }

  return props;
}

function internalPartitionEdits(template, bounds, wallEdge, seed) {
  const edits = [];
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;

  if (width < 5 || height < 4) return edits;

  const addVerticalDivider = (x, doorY) => {
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      edits.push({
        x,
        y,
        direction: "E",
        edge: y === doorY
          ? {
              ...wallEdge,
              kind: "door",
              type: "door",
              visual: {
                ...(wallEdge.visual || {}),
                assetUrl: null,
              },
              open: false,
              doorOpen: false,
            }
          : wallEdge,
      });
    }
  };

  const addHorizontalDivider = (y, doorX) => {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      edits.push({
        x,
        y,
        direction: "S",
        edge: x === doorX
          ? {
              ...wallEdge,
              kind: "door",
              type: "door",
              visual: {
                ...(wallEdge.visual || {}),
                assetUrl: null,
              },
              open: false,
              doorOpen: false,
            }
          : wallEdge,
      });
    }
  };

  if ([
    SQUARE_BUILDING_TEMPLATES.TAVERN,
    SQUARE_BUILDING_TEMPLATES.FARMHOUSE,
    SQUARE_BUILDING_TEMPLATES.STOREHOUSE,
  ].includes(template)) {
    if (width >= height) {
      const dividerX = clamp(
        bounds.maxX - Math.max(2, Math.floor(width * 0.28)),
        bounds.minX + 1,
        bounds.maxX - 1
      );
      addVerticalDivider(
        dividerX,
        clamp(
          bounds.minY + 1 + Math.floor(random01(seed, 70) * Math.max(1, height - 2)),
          bounds.minY,
          bounds.maxY
        )
      );
    } else {
      const dividerY = clamp(
        bounds.maxY - Math.max(2, Math.floor(height * 0.28)),
        bounds.minY + 1,
        bounds.maxY - 1
      );
      addHorizontalDivider(
        dividerY,
        clamp(
          bounds.minX + 1 + Math.floor(random01(seed, 71) * Math.max(1, width - 2)),
          bounds.minX,
          bounds.maxX
        )
      );
    }
  }

  if (
    template === SQUARE_BUILDING_TEMPLATES.DUNGEON_CHAMBER &&
    width >= 6 &&
    height >= 6
  ) {
    addVerticalDivider(
      Math.round((bounds.minX + bounds.maxX) / 2),
      Math.round((bounds.minY + bounds.maxY) / 2)
    );
  }

  return edits;
}

export function generateSquareBuilding({
  grid,
  start,
  end,
  seed = "building",
  template = SQUARE_BUILDING_TEMPLATES.TAVERN,
  material = "wood",
  heightFeet = 10,
  wealth = "common",
  windowStyle = "auto",
  furnish = true,
  assetUrl = null,
} = {}) {
  const bounds = clampBounds(boundsFromPoints(start, end), grid);
  if (!bounds) {
    return { accepted: false, reason: "invalid-building-bounds", grid, changes: [] };
  }

  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  if (width < 2 || height < 2) {
    return {
      accepted: false,
      reason: "building-footprint-too-small",
      grid,
      changes: [],
    };
  }

  const buildingId = `generated-building-${hash32(`${seed}:${bounds.minX}:${bounds.minY}`)}`;
  const resolvedWindowStyle = windowStyleFor({
    template,
    wealth,
    requested: windowStyle,
  });
  const baseWall = normalizeSquareStructureEdge({
    kind: "wall",
    material,
    heightFeet: finite(heightFeet, 10),
    visual: {
      assetUrl: assetUrl || null,
      useProceduralFallback: true,
    },
    metadata: {
      generatedBuildingId: buildingId,
      generatedTemplate: template,
    },
  });

  const room = applySquareStructureRoom({
    grid,
    start: { x: bounds.minX, y: bounds.minY },
    end: { x: bounds.maxX, y: bounds.maxY },
    edge: baseWall,
    buildingId,
  });
  if (!room.accepted) return room;

  let nextGrid = room.grid;
  const allChanges = [...room.changes];
  let appliedEdges = room.appliedEdges || 0;

  const entrance = chooseEntrance(bounds, seed);
  const door = applySquareStructureEdgeEdit({
    grid: nextGrid,
    ...entrance,
    edge: {
      ...baseWall,
      kind: "door",
      type: "door",
      visual: {
        ...(baseWall.visual || {}),
        assetUrl: null,
      },
      open: false,
      doorOpen: false,
      metadata: {
        ...(baseWall.metadata || {}),
        generatedRole: "main-entrance",
      },
    },
  });
  if (door.accepted) {
    nextGrid = door.grid;
    allChanges.push(...door.changes);
    appliedEdges += 1;
  }

  const perimeter = outerEdgeCells(bounds)
    .filter((candidate) => !sameEdge(candidate, entrance));

  const allowWindows = template !== SQUARE_BUILDING_TEMPLATES.STOREHOUSE;
  if (allowWindows) {
    const spacing =
      wealth === "wealthy" ? 2 :
      wealth === "common" ? 3 :
      4;
    perimeter.forEach((candidate, index) => {
      if (index % spacing !== Math.floor(random01(seed, 80) * spacing)) return;
      const windowEdge = {
        ...baseWall,
        kind: "window",
        type: "window",
        windowStyle: resolvedWindowStyle,
        visual: {
          ...(baseWall.visual || {}),
          assetUrl: null,
          windowStyle: resolvedWindowStyle,
          glass: [SQUARE_WINDOW_STYLES.LEADED, SQUARE_WINDOW_STYLES.STAINED]
            .includes(resolvedWindowStyle),
          shutters: resolvedWindowStyle === SQUARE_WINDOW_STYLES.SHUTTERED,
        },
        metadata: {
          ...(baseWall.metadata || {}),
          generatedRole: "window",
        },
      };
      const result = applySquareStructureEdgeEdit({
        grid: nextGrid,
        ...candidate,
        edge: windowEdge,
      });
      if (!result.accepted) return;
      nextGrid = result.grid;
      allChanges.push(...result.changes);
      appliedEdges += 1;
    });
  }

  const partitionEdits = internalPartitionEdits(
    template,
    bounds,
    baseWall,
    seed
  );
  if (partitionEdits.length) {
    const partitions = applyEdgeSequence(nextGrid, partitionEdits);
    if (partitions.accepted) {
      nextGrid = partitions.grid;
      allChanges.push(...partitions.changes);
      appliedEdges += partitions.appliedEdges;
    }
  }

  const propSuggestions = furnish
    ? furnishingPlan(template, bounds, seed)
    : [];

  return {
    accepted: true,
    grid: nextGrid,
    changes: mergeChanges(allChanges),
    appliedEdges,
    bounds,
    buildingId,
    template,
    seed,
    entrance,
    windowStyle: resolvedWindowStyle,
    propSuggestions,
    mode: SQUARE_STRUCTURE_DRAW_MODES.BUILDING,
  };
}

export function describeSquareBuildingTemplate(template) {
  switch (template) {
    case SQUARE_BUILDING_TEMPLATES.COTTAGE:
      return "Small dwelling with hearth, bed, storage, and historically modest window treatment.";
    case SQUARE_BUILDING_TEMPLATES.FARMHOUSE:
      return "Dwelling plus storage partition and agricultural household furnishings.";
    case SQUARE_BUILDING_TEMPLATES.BARRACKS:
      return "Open military sleeping hall with beds, benches, and weapon storage.";
    case SQUARE_BUILDING_TEMPLATES.CHAPEL:
      return "Open worship hall with altar zone, benches, and higher-status glazing options.";
    case SQUARE_BUILDING_TEMPLATES.DUNGEON_CHAMBER:
      return "Stone chamber with optional internal divider, sparse light, storage, and confinement props.";
    case SQUARE_BUILDING_TEMPLATES.STOREHOUSE:
      return "Simple secure storage building with few openings and dense storage sockets.";
    case SQUARE_BUILDING_TEMPLATES.TAVERN:
    default:
      return "Public room with entrance, windows, service/storage partition, hearth, tables, and drink storage.";
  }
}

export default {
  SQUARE_BUILDING_TEMPLATES,
  SQUARE_STRUCTURE_DRAW_MODES,
  applySquareStructureRoom,
  applySquareStructureWallLine,
  describeSquareBuildingTemplate,
  generateSquareBuilding,
};

function upsertEntity(entities, nextEntity) {
  const idx = entities.findIndex((entity) => entity.id === nextEntity.id);
  if (idx === -1) {
    entities.push(nextEntity);
    return;
  }

  entities[idx] = {
    ...entities[idx],
    ...nextEntity,
  };
}

function setTerrain(mapDoc, op) {
  const { q, r, terrain, elev } = op;
  if (
    !Number.isInteger(q) ||
    !Number.isInteger(r) ||
    typeof terrain !== "string" ||
    terrain.length === 0
  ) {
    throw new Error("SET_TERRAIN requires q, r, and terrain");
  }

  const idx = mapDoc.hexes.findIndex((hex) => hex.q === q && hex.r === r);
  if (idx === -1) throw new Error(`Hex not found at ${q},${r}`);

  mapDoc.hexes[idx].terrain = terrain;
  if (typeof elev === "number") mapDoc.hexes[idx].elev = elev;
}

function moveEntity(mapDoc, op) {
  const { id, q, r, facing } = op;
  if (
    typeof id !== "string" ||
    !Number.isInteger(q) ||
    !Number.isInteger(r)
  ) {
    throw new Error("MOVE_ENTITY requires id, q, and r");
  }

  const idx = mapDoc.entities.findIndex((entity) => entity.id === id);
  if (idx === -1) throw new Error(`Entity not found: ${id}`);

  mapDoc.entities[idx].q = q;
  mapDoc.entities[idx].r = r;
  if (typeof facing === "number") mapDoc.entities[idx].facing = facing;
}

function placeEntity(mapDoc, op) {
  const { id, kind, q, r, facing = 0, meta = {} } = op;
  if (
    typeof id !== "string" ||
    typeof kind !== "string" ||
    !Number.isInteger(q) ||
    !Number.isInteger(r)
  ) {
    throw new Error("PLACE_ENTITY requires id, kind, q, and r");
  }

  upsertEntity(mapDoc.entities, {
    id,
    kind,
    q,
    r,
    facing,
    meta,
  });
}

export function applyMapPatch(mapDoc, patch) {
  const operations = Array.isArray(patch)
    ? patch
    : patch?.operations || patch?.ops || [];

  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error("Patch must include at least one operation");
  }

  operations.forEach((op) => {
    const type = op?.type;
    if (type === "SET_TERRAIN") {
      setTerrain(mapDoc, op);
      return;
    }

    if (type === "MOVE_ENTITY") {
      moveEntity(mapDoc, op);
      return;
    }

    if (type === "PLACE_ENTITY" || type === "SPAWN_OBJECT") {
      placeEntity(mapDoc, op);
      return;
    }

    throw new Error(`Unsupported patch operation: ${type}`);
  });

  return operations;
}

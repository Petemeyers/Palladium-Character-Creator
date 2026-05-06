// src/engine/core/engineState.cjs

function createEngineState(seed = {}) {
  return {
    // simulation
    turnCounter: seed.turnCounter ?? 0,

    // entities
    fighters: seed.fighters ?? [],
    positions: seed.positions ?? {}, // { [eid]: {x,y} }

    // map/terrain (flexible)
    map: seed.map ?? { cells: {} }, // cells["x,y"] = { height, blocksLosHeight, cover, noFly, ... }

    // schedules
    schedules: seed.schedules ?? {}, // { [schedId]: schedule }

    // SDI tracking (optional)
    tracks: seed.tracks ?? {},

    // locks (optional if worker manages locks separately)
    locks: seed.locks ?? {}, // { "eid:acting": true }

    // terrain/height maps (for elevation LOS)
    heights: seed.heights ?? {}, // { "x,y": height }
    blocksLosHeight: seed.blocksLosHeight ?? {}, // { "x,y": blockHeight }
    opaqueHexes: seed.opaqueHexes ?? {}, // { "x,y": true }
    coverHexes: seed.coverHexes ?? {}, // { "x,y": coverLevel }
    terrain: seed.terrain ?? {}, // { "x,y": { height, blocksLosHeight, cover, noFly } }
  };
}

module.exports = { createEngineState };


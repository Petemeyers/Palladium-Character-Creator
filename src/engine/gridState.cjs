// src/engine/gridState.cjs
// Authoritative grid state: occupancy and blocking

class GridState {
  constructor() {
    this.tiles = new Map();      // key: "x,y" → { terrain, blocked }
    this.occupants = new Map();  // key: "x,y" → entityId

    // Default movement costs (tweak anytime, or override per ruleset)
    this.terrainCosts = {
      open: 1,
      normal: 1,
      road: 0.75,  // Roads feel faster (both movement cost and animation)
      forest: 2,
      swamp: 3,
      rubble: 2,
      water: 999,     // impassable unless special movement
      mountain: 999,
      wall: 999,
    };
  }

  key(x, y) {
    return `${x},${y}`;
  }

  // ----- Tiles -----
  setTile(x, y, tile) {
    this.tiles.set(this.key(x, y), tile);
  }

  getTile(x, y) {
    return this.tiles.get(this.key(x, y));
  }

  /**
   * Get or create a tile (defaults to "open" if not set)
   * Useful for ensuring tiles exist before querying
   */
  getOrCreateTile(x, y) {
    let tile = this.getTile(x, y);
    if (!tile) {
      tile = { terrain: "open", blocked: false };
      this.setTile(x, y, tile);
    }
    return tile;
  }

  /**
   * Check if a tile is blocked for a mover
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} mover - Optional mover entity with moveCaps
   * @returns {boolean} True if blocked
   */
  isBlocked(x, y, mover = null) {
    const tile = this.getTile(x, y);
    if (!tile) return true; // outside map = blocked

    // Phase can ignore blocked tiles (including walls), but still can't leave the map
    if (mover?.moveCaps?.canPhase) return false;

    if (tile.blocked) return true;

    const t = tile.terrain || "open";

    // Flying ignores terrain impassability (but you can still block with explicit "blocked" if you want)
    if (mover?.moveCaps?.canFly) return false;

    // Swimming allows water
    if (t === "water" && mover?.moveCaps?.canSwim) return false;

    // Climbing allows mountains (optional rule)
    if (t === "mountain" && mover?.moveCaps?.canClimb) return false;

    const cost = this.terrainCosts[t] ?? 1;
    return cost >= 999;
  }

  /**
   * Get movement cost for a tile
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} mover - Optional mover entity with moveCaps
   * @returns {number} Movement cost (999 = impassable)
   */
  terrainMoveCost(x, y, mover = null) {
    const tile = this.getTile(x, y);
    if (!tile) return 999; // outside map = impassable

    const t = tile.terrain || "open";

    // Phase: you can treat this as flat cost
    if (mover?.moveCaps?.canPhase) return 1;

    // Fly: ignore terrain difficulty (still respects occupancy)
    if (mover?.moveCaps?.canFly) return 1;

    // Swim: water becomes normal-ish
    if (t === "water" && mover?.moveCaps?.canSwim) return 2; // tweak if desired

    // Climb: mountains become expensive but possible
    if (t === "mountain" && mover?.moveCaps?.canClimb) return 4; // tweak

    // Optional "ignores difficult terrain"
    if (mover?.moveCaps?.ignoreDifficultTerrain) {
      // treat forest/swamp/rubble as open
      if (t === "forest" || t === "swamp" || t === "rubble") return 1;
    }

    // default table
    let cost = this.terrainCosts[t] ?? 1;

    // hard block via explicit flag (unless phase)
    if (tile.blocked && !mover?.moveCaps?.canPhase) cost = 999;

    return cost;
  }

  // ----- Occupancy -----
  getOccupant(x, y) {
    return this.occupants.get(this.key(x, y));
  }

  setOccupant(x, y, eid) {
    this.occupants.set(this.key(x, y), eid);
  }

  clearOccupant(x, y) {
    this.occupants.delete(this.key(x, y));
  }

  moveOccupant(fromX, fromY, toX, toY, eid) {
    const kFrom = this.key(fromX, fromY);
    const kTo = this.key(toX, toY);
    if (this.occupants.get(kFrom) === eid) {
      this.occupants.delete(kFrom);
    }
    this.occupants.set(kTo, eid);
  }

  // Initialize from positions map
  initializeFromPositions(positions) {
    this.occupants.clear();
    Object.entries(positions).forEach(([eid, pos]) => {
      if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
        this.setOccupant(pos.x, pos.y, eid);
      }
    });
  }

  // Initialize tiles from terrain data
  initializeFromTerrain(terrain) {
    // terrain can be a map definition or array of cells
    if (Array.isArray(terrain)) {
      terrain.forEach(cell => {
        if (cell.x !== undefined && cell.y !== undefined) {
          const terrainType = cell.terrain || cell.terrainType || "open";
          // Normalize terrain names to match terrainCosts keys
          const normalizedTerrain = this.normalizeTerrainName(terrainType);
          this.setTile(cell.x, cell.y, {
            terrain: normalizedTerrain,
            blocked: cell.blocked || false,
          });
        }
      });
    } else if (terrain && typeof terrain === "object") {
      // Assume it's a map definition with grid or cells
      if (terrain.grid && Array.isArray(terrain.grid)) {
        terrain.grid.forEach(cell => {
          if (cell.x !== undefined && cell.y !== undefined) {
            const terrainType = cell.terrain || cell.terrainType || "open";
            const normalizedTerrain = this.normalizeTerrainName(terrainType);
            this.setTile(cell.x, cell.y, {
              terrain: normalizedTerrain,
              blocked: cell.blocked || false,
            });
          }
        });
      }
    }
  }

  /**
   * Normalize terrain name to match terrainCosts keys
   * @param {string} terrainName - Raw terrain name from map data
   * @returns {string} Normalized terrain name
   */
  normalizeTerrainName(terrainName) {
    if (!terrainName) return "open";
    const normalized = terrainName.toLowerCase().trim();
    
    // Map common variations to standard names
    const mappings = {
      "normal": "open",
      "grass": "open",
      "dirt": "open",
      "stone": "open",
      "woods": "forest",
      "trees": "forest",
      "marsh": "swamp",
      "mud": "swamp",
      "debris": "rubble",
      "ruins": "rubble",
      "lake": "water",
      "river": "water",
      "sea": "water",
      "cliff": "mountain",
      "rock": "mountain",
    };
    
    return mappings[normalized] || normalized;
  }
}

module.exports = { GridState };


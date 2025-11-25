import { HexTile } from "./hexTile.js";

export class HexStackManager {
  constructor() {
    this.tiles = new Map();
    this.metadata = {};
  }

  static _key(q, r) {
    return `${q},${r}`;
  }

  addTile(q, r, height = 0, terrain = "grass", features = []) {
    const key = HexStackManager._key(q, r);
    const stack = this.tiles.get(key) ?? [];
    const newTile = new HexTile({ q, r, height, terrain, features });
    stack.push(newTile);
    stack.sort((a, b) => a.height - b.height);
    this.tiles.set(key, stack);
    return newTile;
  }

  removeTopTile(q, r) {
    const key = HexStackManager._key(q, r);
    const stack = this.tiles.get(key);
    if (!stack || stack.length === 0) return null;
    const removed = stack.pop();
    if (stack.length === 0) {
      this.tiles.delete(key);
    }
    return removed;
  }

  getStack(q, r) {
    const key = HexStackManager._key(q, r);
    const stack = this.tiles.get(key);
    return stack ? [...stack] : [];
  }

  getTopTile(q, r) {
    const stack = this.tiles.get(HexStackManager._key(q, r));
    return stack && stack.length ? stack[stack.length - 1] : null;
  }

  setTopTileHeight(q, r, height = 0) {
    const stack = this.tiles.get(HexStackManager._key(q, r));
    if (!stack || !stack.length) return null;
    const tile = stack[stack.length - 1];
    tile.height = height;
    return tile;
  }

  adjustTopTileHeight(q, r, delta = 0) {
    const stack = this.tiles.get(HexStackManager._key(q, r));
    if (!stack || !stack.length) return null;
    const tile = stack[stack.length - 1];
    tile.height = Math.max(0, tile.height + delta);
    return tile;
  }

  getAllTiles() {
    return Array.from(this.tiles.values()).flat();
  }

  clear() {
    this.tiles.clear();
    this.metadata = {};
  }
}


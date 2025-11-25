export class HexTile {
  constructor({ id, q, r, height = 0, terrain = "grass", features = [] }) {
    this.id = id || `${q},${r},${height}`;
    this.q = q;
    this.r = r;
    this.height = height;
    this.terrain = terrain;
    this.features = Array.isArray(features) ? features : [features];
    this.edges = new Map();
    this.vertices = new Map();
  }

  setEdge(direction, data) {
    this.edges.set(direction, data);
    return this;
  }

  getEdge(direction) {
    return this.edges.get(direction) ?? null;
  }

  setVertex(direction, data) {
    this.vertices.set(direction, data);
    return this;
  }

  getVertex(direction) {
    return this.vertices.get(direction) ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      q: this.q,
      r: this.r,
      height: this.height,
      terrain: this.terrain,
      features: [...this.features],
      edges: Object.fromEntries(this.edges),
      vertices: Object.fromEntries(this.vertices),
    };
  }
}


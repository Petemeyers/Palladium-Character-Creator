import { EXPANDED_BATTLEFIELD_PROP_DEFINITIONS } from "./expandedBattlefieldPropCatalog.js";
import { getPropGameplayProfile } from "./propCapabilityCatalog.js";
function axialToOddR(q, r) {
  return { col: Number(q) + ((Number(r) - (Number(r) & 1)) / 2), row: Number(r) };
}

const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const BATTLEFIELD_PROP_CATEGORIES = Object.freeze({
  NATURAL: "natural",
  STRUCTURE: "structure",
  FURNISHING: "furnishing",
  LIGHT: "light",
  ATMOSPHERE: "atmosphere",
});

export const BATTLEFIELD_PROP_CATALOG = Object.freeze({
  tree: Object.freeze({
    type: "tree", label: "Tree", category: BATTLEFIELD_PROP_CATEGORIES.NATURAL,
    blocksMovement: true, blocksLineOfSight: true, heightFeet: 30, cover: 2,
  }),
  boulder: Object.freeze({
    type: "boulder", label: "Boulder", category: BATTLEFIELD_PROP_CATEGORIES.NATURAL,
    blocksMovement: true, blocksLineOfSight: true, heightFeet: 6, cover: 2,
  }),
  wall: Object.freeze({
    type: "wall", label: "Stone Wall", category: BATTLEFIELD_PROP_CATEGORIES.STRUCTURE,
    blocksMovement: true, blocksLineOfSight: true, heightFeet: 10, cover: 3,
  }),
  fence: Object.freeze({
    type: "fence", label: "Fence", category: BATTLEFIELD_PROP_CATEGORIES.STRUCTURE,
    blocksMovement: true, blocksLineOfSight: false, heightFeet: 4, cover: 1,
  }),
  gate: Object.freeze({
    type: "gate", label: "Gate", category: BATTLEFIELD_PROP_CATEGORIES.STRUCTURE,
    blocksMovement: true, blocksLineOfSight: true, heightFeet: 10, cover: 3,
  }),
  ruin: Object.freeze({
    type: "ruin", label: "Ruined Wall", category: BATTLEFIELD_PROP_CATEGORIES.STRUCTURE,
    blocksMovement: false, blocksLineOfSight: true, heightFeet: 8, cover: 2,
  }),
  crate: Object.freeze({
    type: "crate", label: "Crate", category: BATTLEFIELD_PROP_CATEGORIES.FURNISHING,
    blocksMovement: true, blocksLineOfSight: false, heightFeet: 4, cover: 1,
  }),
  cart: Object.freeze({
    type: "cart", label: "Cart", category: BATTLEFIELD_PROP_CATEGORIES.FURNISHING,
    blocksMovement: true, blocksLineOfSight: false, heightFeet: 5, cover: 2,
  }),
  torch: Object.freeze({
    type: "torch", label: "Torch", category: BATTLEFIELD_PROP_CATEGORIES.LIGHT,
    blocksMovement: false, blocksLineOfSight: false, heightFeet: 6, cover: 0,
    lightSource: Object.freeze({ radiusFeet: 30, intensity: 0.72, color: "#ffad5a", flicker: true }),
  }),
  lantern: Object.freeze({
    type: "lantern", label: "Lantern", category: BATTLEFIELD_PROP_CATEGORIES.LIGHT,
    blocksMovement: false, blocksLineOfSight: false, heightFeet: 4, cover: 0,
    lightSource: Object.freeze({ radiusFeet: 40, intensity: 0.62, color: "#ffd28a", flicker: true }),
  }),
  campfire: Object.freeze({
    type: "campfire", label: "Campfire", category: BATTLEFIELD_PROP_CATEGORIES.LIGHT,
    blocksMovement: true, blocksLineOfSight: false, heightFeet: 2, cover: 0,
    lightSource: Object.freeze({ radiusFeet: 50, intensity: 0.86, color: "#ff8f3d", flicker: true }),
    localAtmosphere: Object.freeze({ type: "smoke", radiusFeet: 10, occlusion: 0.18 }),
  }),
  smoke: Object.freeze({
    type: "smoke", label: "Smoke Cloud", category: BATTLEFIELD_PROP_CATEGORIES.ATMOSPHERE,
    blocksMovement: false, blocksLineOfSight: false, heightFeet: 12, cover: 0,
    localAtmosphere: Object.freeze({ type: "smoke", radiusFeet: 15, occlusion: 0.55 }),
  }),
  ...EXPANDED_BATTLEFIELD_PROP_DEFINITIONS,
});

export function getBattlefieldPropDefinition(type = "crate") {
  const key = normalizeText(type);
  return BATTLEFIELD_PROP_CATALOG[key] || BATTLEFIELD_PROP_CATALOG.crate;
}

export function normalizeBattlefieldProp(prop = {}, options = {}) {
  const definition = getBattlefieldPropDefinition(prop.type || options.type || "crate");
  const coordinateSpace = normalizeText(prop.coordinateSpace || options.coordinateSpace || ((Number.isFinite(Number(prop.x)) && Number.isFinite(Number(prop.y))) ? "offset" : "compatibility"));
  return {
    ...definition,
    ...prop,
    id: String(prop.id || options.id || `map-prop-${Date.now()}`),
    type: definition.type,
    name: String(prop.name || definition.label),
    coordinateSpace,
    q: toFinite(prop.q ?? prop.x, 0),
    r: toFinite(prop.r ?? prop.y, 0),
    ...(Number.isFinite(Number(prop.x)) ? { x: Number(prop.x) } : {}),
    ...(Number.isFinite(Number(prop.y)) ? { y: Number(prop.y) } : {}),
    rotation: toFinite(prop.rotation, 0),
    scale: Math.max(0.1, toFinite(prop.scale, 1)),
    heightFeet: Math.max(0, toFinite(prop.heightFeet, definition.heightFeet || 0)),
    cover: Math.max(0, toFinite(prop.cover, definition.cover || 0)),
    blocksMovement: prop.blocksMovement == null ? definition.blocksMovement === true : prop.blocksMovement === true,
    blocksLineOfSight: prop.blocksLineOfSight == null ? definition.blocksLineOfSight === true : prop.blocksLineOfSight === true,
    lightSource: prop.lightSource === false ? null : (prop.lightSource || definition.lightSource || null),
    localAtmosphere: prop.localAtmosphere === false ? null : (prop.localAtmosphere || definition.localAtmosphere || null),
    gameplay: prop.gameplay || definition.gameplay || getPropGameplayProfile(definition.type),
  };
}

export function createBattlefieldProp(type, position = {}, options = {}) {
  const definition = getBattlefieldPropDefinition(type);
  return normalizeBattlefieldProp({
    ...definition,
    ...options,
    type: definition.type,
    q: position.q ?? position.x ?? 0,
    r: position.r ?? position.y ?? 0,
    ...(Number.isFinite(Number(position.x)) ? { x: Number(position.x) } : {}),
    ...(Number.isFinite(Number(position.y)) ? { y: Number(position.y) } : {}),
    coordinateSpace: position.coordinateSpace || options.coordinateSpace || ((Number.isFinite(Number(position.x)) && Number.isFinite(Number(position.y))) ? "offset" : "axial"),
  });
}

export function getBattlefieldPropOffset(prop = {}, map = {}) {
  const normalized = normalizeBattlefieldProp(prop);
  if (Number.isFinite(Number(normalized.x)) && Number.isFinite(Number(normalized.y))) {
    return { x: Number(normalized.x), y: Number(normalized.y) };
  }
  const q = Number(normalized.q);
  const r = Number(normalized.r);
  if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
  const space = normalizeText(normalized.coordinateSpace);
  if (space === "axial") {
    const offset = axialToOddR(q, r);
    return { x: Number(offset.col), y: Number(offset.row) };
  }
  if (space === "offset" || space === "odd-r" || space === "grid") return { x: q, y: r };
  const width = Number(map?.width || map?.mapSize?.width);
  const height = Number(map?.height || map?.mapSize?.height);
  if ((!Number.isFinite(width) || (q >= 0 && q < width)) && (!Number.isFinite(height) || (r >= 0 && r < height))) return { x: q, y: r };
  const offset = axialToOddR(q, r);
  return { x: Number(offset.col), y: Number(offset.row) };
}

export function listBattlefieldPropDefinitions() {
  return Object.values(BATTLEFIELD_PROP_CATALOG).map((entry) => ({ ...entry }));
}

export default BATTLEFIELD_PROP_CATALOG;

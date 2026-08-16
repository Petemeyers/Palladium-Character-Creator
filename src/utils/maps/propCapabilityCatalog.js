export const PROP_INTERACTION_CAPABILITIES = Object.freeze({
  INTERACTABLE: "interactable",
  MOVABLE: "movable",
  PUSHABLE: "pushable",
  THROWABLE: "throwable",
  ROLLABLE: "rollable",
  DESTRUCTIBLE: "destructible",
  FLAMMABLE: "flammable",
  LOOTABLE: "lootable",
  CONTAINER: "container",
  HARVESTABLE: "harvestable",
  CLIMBABLE: "climbable",
  READABLE: "readable",
  OPENABLE: "openable",
  LOCKABLE: "lockable",
  SITTABLE: "sittable",
  SLEEPABLE: "sleepable",
  LIGHTABLE: "lightable",
  QUEST: "quest",
  COVER: "cover",
  HAZARD: "hazard",
});

const C = PROP_INTERACTION_CAPABILITIES;

function profile(capabilities = [], details = {}) {
  return Object.freeze({
    capabilities: Object.freeze(Array.from(new Set(capabilities))),
    ...details,
  });
}

export const PROP_GAMEPLAY_PROFILES = Object.freeze({
  table: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.THROWABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.COVER],
    { massKg: 45, durability: { hp: 18, material: "wood" }, cover: 1 }
  ),
  chair: profile(
    [C.INTERACTABLE, C.MOVABLE, C.THROWABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.SITTABLE],
    { massKg: 8, durability: { hp: 8, material: "wood" } }
  ),
  bench: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.SITTABLE, C.COVER],
    { massKg: 28, durability: { hp: 14, material: "wood" }, cover: 1 }
  ),
  stool: profile(
    [C.INTERACTABLE, C.MOVABLE, C.THROWABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.SITTABLE],
    { massKg: 5, durability: { hp: 6, material: "wood" } }
  ),
  bed: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.SLEEPABLE],
    { massKg: 55, durability: { hp: 16, material: "wood" } }
  ),
  chest: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.LOOTABLE, C.CONTAINER, C.OPENABLE, C.LOCKABLE],
    { massKg: 32, durability: { hp: 16, material: "wood" }, container: { lootTable: "generic_chest" } }
  ),
  barrel: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.ROLLABLE, C.THROWABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.CONTAINER, C.LOOTABLE],
    { massKg: 35, durability: { hp: 12, material: "wood" }, container: { lootTable: "generic_barrel" } }
  ),
  keg: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.ROLLABLE, C.THROWABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.CONTAINER, C.LOOTABLE],
    { massKg: 22, durability: { hp: 10, material: "wood" }, container: { lootTable: "drink_keg" } }
  ),
  crate: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.THROWABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.CONTAINER, C.LOOTABLE, C.COVER],
    { massKg: 28, durability: { hp: 12, material: "wood" }, container: { lootTable: "generic_crate" }, cover: 1 }
  ),
  "grain-sack": profile(
    [C.INTERACTABLE, C.MOVABLE, C.THROWABLE, C.DESTRUCTIBLE, C.LOOTABLE, C.CONTAINER],
    { massKg: 25, durability: { hp: 4, material: "cloth" }, container: { lootTable: "grain_sack" } }
  ),
  basket: profile(
    [C.INTERACTABLE, C.MOVABLE, C.THROWABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.LOOTABLE, C.CONTAINER],
    { massKg: 4, durability: { hp: 4, material: "wicker" }, container: { lootTable: "basket" } }
  ),
  "bar-counter": profile(
    [C.INTERACTABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.COVER],
    { massKg: 140, durability: { hp: 32, material: "wood" }, cover: 2 }
  ),
  hearth: profile(
    [C.INTERACTABLE, C.LIGHTABLE, C.HAZARD, C.DESTRUCTIBLE],
    { massKg: 300, durability: { hp: 40, material: "stone" }, hazard: { type: "fire", activeWhenLit: true } }
  ),
  shelf: profile(
    [C.INTERACTABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.LOOTABLE, C.CONTAINER],
    { massKg: 35, durability: { hp: 12, material: "wood" }, container: { lootTable: "shelf" } }
  ),
  cupboard: profile(
    [C.INTERACTABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.LOOTABLE, C.CONTAINER, C.OPENABLE],
    { massKg: 55, durability: { hp: 16, material: "wood" }, container: { lootTable: "cupboard" } }
  ),
  "weapon-rack": profile(
    [C.INTERACTABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.LOOTABLE, C.CONTAINER],
    { massKg: 38, durability: { hp: 14, material: "wood" }, container: { lootTable: "weapon_rack" } }
  ),
  "armor-stand": profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.LOOTABLE],
    { massKg: 30, durability: { hp: 12, material: "wood" } }
  ),
  altar: profile(
    [C.INTERACTABLE, C.DESTRUCTIBLE, C.QUEST, C.COVER],
    { massKg: 260, durability: { hp: 45, material: "stone" }, cover: 2 }
  ),
  "candle-stand": profile(
    [C.INTERACTABLE, C.MOVABLE, C.THROWABLE, C.DESTRUCTIBLE, C.LIGHTABLE],
    { massKg: 6, durability: { hp: 6, material: "metal" } }
  ),
  cage: profile(
    [C.INTERACTABLE, C.DESTRUCTIBLE, C.OPENABLE, C.LOCKABLE, C.COVER],
    { massKg: 180, durability: { hp: 32, material: "iron" }, cover: 2 }
  ),
  chain: profile(
    [C.INTERACTABLE, C.MOVABLE, C.DESTRUCTIBLE],
    { massKg: 12, durability: { hp: 20, material: "iron" } }
  ),
  lever: profile(
    [C.INTERACTABLE],
    { massKg: 5, mechanism: { activator: true } }
  ),
  "pressure-plate": profile(
    [C.INTERACTABLE, C.HAZARD],
    { mechanism: { trigger: true } }
  ),
  trapdoor: profile(
    [C.INTERACTABLE, C.OPENABLE, C.LOCKABLE, C.DESTRUCTIBLE, C.HAZARD],
    { durability: { hp: 16, material: "wood" } }
  ),
  portcullis: profile(
    [C.INTERACTABLE, C.OPENABLE, C.DESTRUCTIBLE, C.COVER],
    { massKg: 500, durability: { hp: 65, material: "iron" }, cover: 3 }
  ),
  chandelier: profile(
    [C.INTERACTABLE, C.DESTRUCTIBLE, C.LIGHTABLE, C.HAZARD],
    { massKg: 22, hazard: { type: "falling-object" } }
  ),
  brazier: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.LIGHTABLE, C.HAZARD],
    { massKg: 35, hazard: { type: "fire", activeWhenLit: true } }
  ),
  well: profile(
    [C.INTERACTABLE, C.DESTRUCTIBLE, C.COVER],
    { massKg: 600, durability: { hp: 60, material: "stone" }, cover: 2 }
  ),
  "market-stall": profile(
    [C.INTERACTABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.LOOTABLE, C.CONTAINER, C.COVER],
    { massKg: 90, durability: { hp: 22, material: "wood" }, container: { lootTable: "market_stall" }, cover: 2 }
  ),
  signpost: profile(
    [C.INTERACTABLE, C.READABLE, C.DESTRUCTIBLE, C.FLAMMABLE],
    { massKg: 18, durability: { hp: 8, material: "wood" } }
  ),
  cart: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.ROLLABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.CONTAINER, C.LOOTABLE, C.COVER],
    { massKg: 180, durability: { hp: 28, material: "wood" }, cover: 2 }
  ),
  wagon: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.ROLLABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.CONTAINER, C.LOOTABLE, C.COVER],
    { massKg: 420, durability: { hp: 40, material: "wood" }, cover: 3 }
  ),
  "hay-bale": profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.THROWABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.COVER],
    { massKg: 18, durability: { hp: 8, material: "straw" }, cover: 1 }
  ),
  haystack: profile(
    [C.INTERACTABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.COVER],
    { massKg: 180, durability: { hp: 18, material: "straw" }, cover: 2 }
  ),
  wheat: profile(
    [C.INTERACTABLE, C.HARVESTABLE, C.FLAMMABLE],
    { harvest: { item: "wheat", yield: [1, 3] } }
  ),
  barley: profile(
    [C.INTERACTABLE, C.HARVESTABLE, C.FLAMMABLE],
    { harvest: { item: "barley", yield: [1, 3] } }
  ),
  cabbage: profile(
    [C.INTERACTABLE, C.HARVESTABLE],
    { harvest: { item: "cabbage", yield: [1, 1] } }
  ),
  vineyard: profile(
    [C.INTERACTABLE, C.HARVESTABLE, C.FLAMMABLE, C.COVER],
    { harvest: { item: "grapes", yield: [1, 4] }, cover: 1 }
  ),
  "apple-tree": profile(
    [C.INTERACTABLE, C.HARVESTABLE, C.CLIMBABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.COVER],
    { harvest: { item: "apple", yield: [1, 5] }, cover: 2 }
  ),
  tree: profile(
    [C.INTERACTABLE, C.CLIMBABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.COVER],
    { massKg: 1200, durability: { hp: 55, material: "wood" }, cover: 2 }
  ),
  stump: profile(
    [C.INTERACTABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.COVER],
    { massKg: 160, durability: { hp: 28, material: "wood" }, cover: 1 }
  ),
  "fallen-log": profile(
    [C.INTERACTABLE, C.PUSHABLE, C.CLIMBABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.COVER],
    { massKg: 400, durability: { hp: 36, material: "wood" }, cover: 2 }
  ),
  barricade: profile(
    [C.INTERACTABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.COVER],
    { massKg: 120, durability: { hp: 28, material: "wood" }, cover: 3 }
  ),
  mantlet: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.COVER],
    { massKg: 85, durability: { hp: 24, material: "wood" }, cover: 3 }
  ),
  stakes: profile(
    [C.INTERACTABLE, C.DESTRUCTIBLE, C.HAZARD, C.COVER],
    { durability: { hp: 18, material: "wood" }, hazard: { type: "impalement" }, cover: 1 }
  ),
  ladder: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.CLIMBABLE, C.DESTRUCTIBLE, C.FLAMMABLE],
    { massKg: 24, durability: { hp: 12, material: "wood" } }
  ),
  banner: profile(
    [C.INTERACTABLE, C.MOVABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.QUEST],
    { massKg: 10, durability: { hp: 6, material: "cloth-wood" } }
  ),
  "ammo-crate": profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.LOOTABLE, C.CONTAINER, C.COVER],
    { massKg: 35, durability: { hp: 12, material: "wood" }, container: { lootTable: "ammunition" }, cover: 1 }
  ),
  corpse: profile(
    [C.INTERACTABLE, C.MOVABLE, C.LOOTABLE, C.CONTAINER],
    { massKg: 75, container: { lootTable: "corpse" } }
  ),
  rowboat: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE, C.CONTAINER],
    { massKg: 110, durability: { hp: 28, material: "wood" }, vehicle: { medium: "water" } }
  ),
  raft: profile(
    [C.INTERACTABLE, C.MOVABLE, C.PUSHABLE, C.DESTRUCTIBLE, C.FLAMMABLE],
    { massKg: 95, durability: { hp: 20, material: "wood" }, vehicle: { medium: "water" } }
  ),
  dock: profile(
    [C.INTERACTABLE, C.DESTRUCTIBLE, C.FLAMMABLE],
    { massKg: 700, durability: { hp: 55, material: "wood" } }
  ),
  "mooring-post": profile(
    [C.INTERACTABLE, C.DESTRUCTIBLE],
    { massKg: 70, durability: { hp: 20, material: "wood" } }
  ),
  key: profile(
    [C.INTERACTABLE, C.MOVABLE, C.LOOTABLE, C.QUEST],
    { massKg: 0.1 }
  ),
  document: profile(
    [C.INTERACTABLE, C.MOVABLE, C.LOOTABLE, C.READABLE, C.FLAMMABLE, C.QUEST],
    { massKg: 0.1 }
  ),
  "coin-purse": profile(
    [C.INTERACTABLE, C.MOVABLE, C.LOOTABLE, C.CONTAINER],
    { massKg: 0.5, container: { lootTable: "coin_purse" } }
  ),
});

export function getPropGameplayProfile(type) {
  const key = String(type ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  const value = PROP_GAMEPLAY_PROFILES[key];
  return value
    ? {
        ...value,
        capabilities: [...value.capabilities],
      }
    : {
        capabilities: [],
      };
}

export function propHasCapability(typeOrProfile, capability) {
  const profileValue =
    typeof typeOrProfile === "string"
      ? getPropGameplayProfile(typeOrProfile)
      : typeOrProfile || {};
  return Array.isArray(profileValue.capabilities) &&
    profileValue.capabilities.includes(capability);
}

export default PROP_GAMEPLAY_PROFILES;

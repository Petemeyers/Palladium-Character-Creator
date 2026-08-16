import { BATTLEFIELD_MAP_SOURCES, normalizeBattlefieldMap } from "../utils/maps/battlefieldMapAuthority.js";
import { generateSeededBattlefield } from "../utils/maps/seededBattlefieldGenerator.js";
import { BATTLEFIELD_PRESET_ART_VERSION } from "../utils/maps/battlefieldPresetArtPass.js";

export const BUILT_IN_BATTLEFIELD_RECIPES = Object.freeze([
  Object.freeze({
    id: "builtin-open-field",
    name: "Open Field",
    seed: "mcs-open-field-1",
    preset: "open-field",
    balanceMode: "mirrored",
    description: "Open grassland with subtle rolling rises and sparse worn earth.",
    artDirection: "broad readable sightlines with gentle elevation variation",
  }),
  Object.freeze({
    id: "builtin-forest-road",
    name: "Forest Road",
    seed: "mcs-forest-road-1",
    preset: "mixed-wilderness",
    balanceMode: "natural",
    description: "A winding road cut through dense woodland with clear verges and flanking tree bands.",
    artDirection: "road corridor, wooded flanks, broken sightlines",
  }),
  Object.freeze({
    id: "builtin-river-crossing",
    name: "River Crossing",
    seed: "mcs-river-crossing-1",
    preset: "river-crossing",
    balanceMode: "natural",
    description: "A meandering river with muddy banks, depth variation, and a shallow tactical ford.",
    artDirection: "river valley, readable banks, future bridge and swimming hooks",
  }),
  Object.freeze({
    id: "builtin-mountain-pass",
    name: "Mountain Pass",
    seed: "mcs-mountain-pass-1",
    preset: "mountain-pass",
    balanceMode: "natural",
    description: "A carved mountain corridor between rising shoulders, rock ridges, high crowns, and ambush ledges.",
    artDirection: "strong mountain silhouette with a visibly lower pass floor",
  }),
  Object.freeze({
    id: "builtin-hilltop-defense",
    name: "Hilltop Defense",
    seed: "mcs-hilltop-defense-1",
    preset: "hilltop-defense",
    balanceMode: "natural",
    description: "A multi-tier hill with a high defensive crown and a deliberate approach road.",
    artDirection: "clear concentric elevation bands and dominant central high ground",
  }),
  Object.freeze({
    id: "builtin-ruined-village",
    name: "Ruined Village",
    seed: "mcs-ruined-village-1",
    preset: "ruined-village",
    balanceMode: "natural",
    description: "A damaged crossroads settlement with clustered ruin lots, rubble, and abandoned carts.",
    artDirection: "recognizable settlement plan instead of random rubble",
  }),
  Object.freeze({
    id: "builtin-muddy-battlefield",
    name: "Muddy Battlefield",
    seed: "mcs-muddy-field-1",
    preset: "muddy-battlefield",
    balanceMode: "mirrored",
    description: "Churned wet ground with shallow depressions, mud bands, and rubble islands.",
    artDirection: "battle-worn terrain with readable low ground and obstacles",
  }),
]);

export function createBuiltInBattlefieldMaps({ width = 40, height = 30 } = {}) {
  return BUILT_IN_BATTLEFIELD_RECIPES.map((recipe) => normalizeBattlefieldMap({
    ...generateSeededBattlefield({
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      seed: recipe.seed,
      preset: recipe.preset,
      balanceMode: recipe.balanceMode,
      width,
      height,
      randomizeEnvironment: false,
      fogOfWarEnabled: false,
    }),
    id: recipe.id,
    name: recipe.name,
    source: BATTLEFIELD_MAP_SOURCES.BUILT_IN,
    metadata: {
      builtIn: true,
      artVersion: BATTLEFIELD_PRESET_ART_VERSION,
      artDirection: recipe.artDirection,
      recipe: { ...recipe },
    },
  }, { source: BATTLEFIELD_MAP_SOURCES.BUILT_IN }));
}

export default createBuiltInBattlefieldMaps;

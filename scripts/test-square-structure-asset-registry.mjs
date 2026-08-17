import assert from "node:assert/strict";
import {
  clearSquareStructureAssetRegistry,
  listSquareStructureAssets,
  registerSquareStructureAsset,
  resolveSquareStructureAsset,
  SQUARE_STRUCTURE_ASSET_AUTHORING_GUIDE,
} from "../src/utils/maps/squareStructureAssetRegistry.js";

clearSquareStructureAssetRegistry();
registerSquareStructureAsset({
  id: "stone-wall-tripo-01",
  material: "stone",
  kind: "wall",
  url: "/assets/models/structures/stone_wall_5ft.glb",
  source: "tripo",
});

const byType = resolveSquareStructureAsset({
  kind: "wall",
  material: "stone",
  visual: {},
});
assert.equal(byType.url, "/assets/models/structures/stone_wall_5ft.glb");

const direct = resolveSquareStructureAsset({
  kind: "archway",
  material: "stone",
  visual: {
    assetUrl: "/assets/models/structures/custom_arch.glb",
  },
});
assert.equal(direct.source, "edge");
assert.equal(direct.url, "/assets/models/structures/custom_arch.glb");
assert.equal(listSquareStructureAssets().length, 1);
assert.equal(SQUARE_STRUCTURE_ASSET_AUTHORING_GUIDE.moduleWidthFeet, 5);
assert.equal(SQUARE_STRUCTURE_ASSET_AUTHORING_GUIDE.pivot, "bottom-center");

console.log("PASS square structure GLB asset registry");

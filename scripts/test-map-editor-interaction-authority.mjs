import fs from "node:fs";

const source = fs.readFileSync("src/utils/maps/mapEditorInteractionAuthority.js", "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const {
  MAP_EDITOR_TOOLS,
  deriveMapEditorInteractionState,
} = await import(moduleUrl);

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const terrain = deriveMapEditorInteractionState({
  activeTool: MAP_EDITOR_TOOLS.TERRAIN,
  editorBrushMode: "bucket",
  editor3DBrushMode: "wall-terrain",
});
expect(terrain.brushEnabled === true, "terrain tool should enable brush");
expect(terrain.propInteractionEnabled === false, "terrain tool should disable prop dragging");
expect(terrain.twoDBrushMode === "bucket", "terrain bucket mode should survive");
expect(terrain.threeDBrushMode === "wall-terrain", "terrain wall mode should survive");

const height = deriveMapEditorInteractionState({
  activeTool: MAP_EDITOR_TOOLS.HEIGHT,
  editorBrushMode: "lower",
  editor3DBrushMode: "height-lower",
});
expect(height.brushEnabled === true, "height tool should enable brush");
expect(height.propInteractionEnabled === false, "height tool should disable prop dragging");
expect(height.twoDBrushMode === "lower", "height tool should keep lower mode");
expect(height.threeDBrushMode === "height-lower", "3D height tool should keep lower mode");

const props = deriveMapEditorInteractionState({
  activeTool: MAP_EDITOR_TOOLS.PROPS,
  editorBrushMode: "raise",
  editor3DBrushMode: "height-raise",
});
expect(props.brushEnabled === false, "props must disable terrain/height brushes");
expect(props.propInteractionEnabled === true, "props must enable prop interaction");
expect(props.twoDBrushMode === "select", "props must put 2D map into selection mode");
expect(props.threeDBrushMode === "disabled", "props must disable 3D brush");

console.log("PASS exclusive Map Maker interaction authority");

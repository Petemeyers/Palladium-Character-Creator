export const MAP_EDITOR_TOOLS = Object.freeze({
  TERRAIN: "terrain",
  HEIGHT: "height",
  STRUCTURE: "structure",
  PROPS: "props",
  ENVIRONMENT: "environment",
  MAPS: "maps",
});

export const MAP_EDITOR_TOOL_ORDER = Object.freeze([
  MAP_EDITOR_TOOLS.TERRAIN,
  MAP_EDITOR_TOOLS.HEIGHT,
  MAP_EDITOR_TOOLS.STRUCTURE,
  MAP_EDITOR_TOOLS.PROPS,
  MAP_EDITOR_TOOLS.ENVIRONMENT,
  MAP_EDITOR_TOOLS.MAPS,
]);

export function normalizeMapEditorTool(value = MAP_EDITOR_TOOLS.TERRAIN) {
  const key = String(value || "").trim().toLowerCase();
  return MAP_EDITOR_TOOL_ORDER.includes(key) ? key : MAP_EDITOR_TOOLS.TERRAIN;
}

export function deriveMapEditorInteractionState({
  activeTool = MAP_EDITOR_TOOLS.TERRAIN,
  editorBrushMode = "terrain",
  editor3DBrushMode = "top-terrain",
} = {}) {
  const tool = normalizeMapEditorTool(activeTool);
  const terrainBrush = ["terrain", "bucket"].includes(editorBrushMode)
    ? editorBrushMode
    : "terrain";
  const heightBrush = ["raise", "lower", "flatten"].includes(editorBrushMode)
    ? editorBrushMode
    : "raise";
  const terrain3DBrush = ["top-terrain", "wall-terrain"].includes(editor3DBrushMode)
    ? editor3DBrushMode
    : "top-terrain";
  const height3DBrush = ["height-raise", "height-lower", "height-flatten"].includes(editor3DBrushMode)
    ? editor3DBrushMode
    : heightBrush === "lower"
      ? "height-lower"
      : heightBrush === "flatten"
        ? "height-flatten"
        : "height-raise";

  if (tool === MAP_EDITOR_TOOLS.TERRAIN) {
    return {
      activeTool: tool,
      brushEnabled: true,
      propInteractionEnabled: false,
      structureInteractionEnabled: false,
      twoDBrushMode: terrainBrush,
      threeDBrushMode: terrain3DBrush,
      cursorMode: "paint",
    };
  }

  if (tool === MAP_EDITOR_TOOLS.HEIGHT) {
    return {
      activeTool: tool,
      brushEnabled: true,
      propInteractionEnabled: false,
      structureInteractionEnabled: false,
      twoDBrushMode: heightBrush,
      threeDBrushMode: height3DBrush,
      cursorMode: "elevation",
    };
  }

  if (tool === MAP_EDITOR_TOOLS.STRUCTURE) {
    return {
      activeTool: tool,
      brushEnabled: false,
      propInteractionEnabled: false,
      structureInteractionEnabled: true,
      twoDBrushMode: "select",
      threeDBrushMode: "disabled",
      cursorMode: "structure",
    };
  }

  if (tool === MAP_EDITOR_TOOLS.PROPS) {
    return {
      activeTool: tool,
      brushEnabled: false,
      propInteractionEnabled: true,
      structureInteractionEnabled: false,
      twoDBrushMode: "select",
      threeDBrushMode: "disabled",
      cursorMode: "prop",
    };
  }

  return {
    activeTool: tool,
    brushEnabled: false,
    propInteractionEnabled: false,
    twoDBrushMode: "select",
    threeDBrushMode: "disabled",
    cursorMode: "select",
  };
}

export default deriveMapEditorInteractionState;

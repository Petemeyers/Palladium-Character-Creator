const runtimeRegistry = new Map();

const normalize = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

function makeRegistryKey({ material, kind, assetId } = {}) {
  if (assetId) return `id:${normalize(assetId)}`;
  return `${normalize(material || "stone")}:${normalize(kind || "wall")}`;
}

export function registerSquareStructureAsset(descriptor = {}) {
  if (!descriptor || typeof descriptor !== "object") return null;
  const url = String(descriptor.url || descriptor.assetUrl || "").trim();
  if (!url) return null;

  const normalized = {
    id: descriptor.id || descriptor.assetId || null,
    material: normalize(descriptor.material || "stone"),
    kind: normalize(descriptor.kind || "wall"),
    url,
    source: descriptor.source || "custom",
    authoringScaleFeet: Number(descriptor.authoringScaleFeet) || 5,
    forwardAxis: descriptor.forwardAxis || "+z",
    notes: descriptor.notes || null,
  };

  runtimeRegistry.set(makeRegistryKey(normalized), normalized);
  if (normalized.id) runtimeRegistry.set(makeRegistryKey({ assetId: normalized.id }), normalized);
  return { ...normalized };
}

export function unregisterSquareStructureAsset(query = {}) {
  const key = makeRegistryKey(query);
  return runtimeRegistry.delete(key);
}

export function clearSquareStructureAssetRegistry() {
  runtimeRegistry.clear();
}

export function listSquareStructureAssets() {
  const unique = new Map();
  runtimeRegistry.forEach((descriptor) => {
    unique.set(descriptor.url, descriptor);
  });
  return Array.from(unique.values()).map((descriptor) => ({ ...descriptor }));
}

export function resolveSquareStructureAsset(edge = {}) {
  const directUrl = String(edge?.visual?.assetUrl || edge?.assetUrl || "").trim();
  if (directUrl) {
    return {
      id: edge?.visual?.assetId || edge?.assetId || null,
      material: normalize(edge.material || "stone"),
      kind: normalize(edge.kind || edge.type || "wall"),
      url: directUrl,
      source: "edge",
      authoringScaleFeet: Number(edge?.visual?.authoringScaleFeet) || 5,
      forwardAxis: edge?.visual?.forwardAxis || "+z",
    };
  }

  const assetId = edge?.visual?.assetId || edge?.assetId;
  if (assetId) {
    const byId = runtimeRegistry.get(makeRegistryKey({ assetId }));
    if (byId) return { ...byId };
  }

  const byType = runtimeRegistry.get(makeRegistryKey({
    material: edge.material,
    kind: edge.kind || edge.type,
  }));
  return byType ? { ...byType } : null;
}

export const SQUARE_STRUCTURE_ASSET_AUTHORING_GUIDE = Object.freeze({
  moduleWidthFeet: 5,
  pivot: "bottom-center",
  lengthAxis: "x",
  upAxis: "y",
  depthAxis: "z",
  recommendedFormat: "glb",
  collisionSource: "canonical-structure-data",
  lineOfSightSource: "canonical-structure-data",
});

export default {
  clearSquareStructureAssetRegistry,
  listSquareStructureAssets,
  registerSquareStructureAsset,
  resolveSquareStructureAsset,
  unregisterSquareStructureAsset,
};

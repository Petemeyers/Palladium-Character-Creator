import { normalizeBattlefieldMap } from "./battlefieldMapAuthority.js";

const TERRAIN_COLORS = Object.freeze({
  grass: "#72a85f",
  forest: "#2f6b3c",
  water: "#2f83b8",
  rock: "#777c84",
  rubble: "#8b7d6b",
  mud: "#70563f",
  sand: "#c4a567",
  road: "#8a6a45",
  hill: "#7c845c",
});

const escapeXml = (value) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));

export function createBattlefieldThumbnailSvg(map, options = {}) {
  const normalized = normalizeBattlefieldMap(map || {});
  const width = Math.max(160, Number(options.width) || 320);
  const height = Math.max(90, Number(options.height) || 180);
  const sampleColumns = Math.min(20, normalized.width);
  const sampleRows = Math.min(15, normalized.height);
  const cellW = width / sampleColumns;
  const cellH = height / sampleRows;
  const rects = [];
  for (let sy = 0; sy < sampleRows; sy += 1) {
    const y = Math.min(normalized.height - 1, Math.floor((sy / sampleRows) * normalized.height));
    for (let sx = 0; sx < sampleColumns; sx += 1) {
      const x = Math.min(normalized.width - 1, Math.floor((sx / sampleColumns) * normalized.width));
      const cell = normalized.grid?.[y]?.[x] || {};
      const terrain = String(cell.visualTerrain || cell.terrainType || cell.terrain || normalized.baseTerrain || "grass").toLowerCase();
      const color = TERRAIN_COLORS[terrain] || TERRAIN_COLORS.grass;
      const elevation = Number(cell.elevation || 0);
      const opacity = Math.max(0.62, Math.min(1, 0.82 + elevation * 0.05));
      rects.push(`<rect x="${(sx * cellW).toFixed(2)}" y="${(sy * cellH).toFixed(2)}" width="${(cellW + 0.35).toFixed(2)}" height="${(cellH + 0.35).toFixed(2)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`);
    }
  }
  const label = escapeXml(normalized.name || "Battlefield");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#111827"/>${rects.join("")}<rect y="${height - 30}" width="100%" height="30" fill="rgba(15,23,42,0.82)"/><text x="10" y="${height - 10}" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#fff">${label}</text></svg>`;
}

export function createBattlefieldThumbnailDataUri(map, options = {}) {
  const svg = createBattlefieldThumbnailSvg(map, options);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default createBattlefieldThumbnailDataUri;

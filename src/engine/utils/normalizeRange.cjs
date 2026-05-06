// src/engine/utils/normalizeRange.cjs

// Your game: 1 hex = 5 feet (you've been using 5-ft hex scale)
const FEET_PER_HEX = 5;

function normalizeRange(range, context = {}) {
  if (range == null) return 0;

  const level = context.level ?? context.casterLevel ?? 1;

  // If already a number, assume FEET unless caller says it's hexes
  if (typeof range === "number") {
    if (context.units === "hex") return Math.max(0, Math.floor(range));
    return Math.max(0, Math.floor(range / FEET_PER_HEX));
  }

  const s = String(range).toLowerCase().trim();

  // special
  if (s === "self" || s === "touch") return 0;
  if (s === "line of sight" || s === "los") return Infinity;

  // "30 ft", "60 feet"
  let m = s.match(/^(\d+)\s*(ft|feet)$/);
  if (m) return Math.floor(parseInt(m[1], 10) / FEET_PER_HEX);

  // "10 yards"
  m = s.match(/^(\d+)\s*(yd|yard|yards)$/);
  if (m) return Math.floor((parseInt(m[1], 10) * 3) / FEET_PER_HEX);

  // "100 ft/level"
  m = s.match(/^(\d+)\s*(ft|feet)\/level$/);
  if (m) return Math.floor((parseInt(m[1], 10) * level) / FEET_PER_HEX);

  // "10 yards/level"
  m = s.match(/^(\d+)\s*(yd|yard|yards)\/level$/);
  if (m) return Math.floor((parseInt(m[1], 10) * 3 * level) / FEET_PER_HEX);

  // If it looks like a number but no unit: treat as feet
  m = s.match(/^(\d+)$/);
  if (m) return Math.floor(parseInt(m[1], 10) / FEET_PER_HEX);

  // Unknown format -> safest: 0
  return 0;
}

module.exports = { normalizeRange, FEET_PER_HEX };


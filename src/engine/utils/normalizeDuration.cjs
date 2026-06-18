// src/engine/utils/normalizeDuration.cjs

const MELEES_PER_MINUTE = 10;
const MELEES_PER_HOUR = 60 * MELEES_PER_MINUTE;

function normalizeDuration(duration, context = {}) {
  if (!duration) return 0;

  const level = context.level ?? context.casterLevel ?? 1;

  if (typeof duration === "number") {
    return Math.max(0, Math.floor(duration));
  }

  const d = String(duration).toLowerCase().trim();

  if (d === "instant" || d === "instantaneous") return 0;
  if (d === "permanent" || d === "permanent until ditechniqueed") return Infinity;

  // "1 melee", "2 melees"
  let m = d.match(/^(\d+)\s*melee(s)?$/);
  if (m) return parseInt(m[1], 10);

  // "2 melees/level"
  m = d.match(/^(\d+)\s*melee(s)?\/level$/);
  if (m) return parseInt(m[1], 10) * level;

  // "5 min", "10 minutes"
  m = d.match(/^(\d+)\s*(min|minute|minutes)$/);
  if (m) return parseInt(m[1], 10) * MELEES_PER_MINUTE;

  // "5 min/level"
  m = d.match(/^(\d+)\s*(min|minute|minutes)\/level$/);
  if (m) return parseInt(m[1], 10) * MELEES_PER_MINUTE * level;

  // "1 hour", "2 hours"
  m = d.match(/^(\d+)\s*(hour|hours)$/);
  if (m) return parseInt(m[1], 10) * MELEES_PER_HOUR;

  // "1 hour/level"
  m = d.match(/^(\d+)\s*(hour|hours)\/level$/);
  if (m) return parseInt(m[1], 10) * MELEES_PER_HOUR * level;

  // Fallback: unknown format â†’ log + treat as instant
  return 0;
}

module.exports = { normalizeDuration };


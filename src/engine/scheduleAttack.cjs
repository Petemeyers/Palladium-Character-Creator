// src/engine/scheduleAttack.cjs
// TimeScale-adaptive projectile stepping + optional parabolic arc height (z).
// Backward compatible: existing UI can ignore z/arcZ and still work.

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Simple parabola peak at t=0.5, returns 0..1
function parabola01(t) {
  // 4t(1-t) peaks at 1
  return 4 * t * (1 - t);
}

/**
 * Determine step count based on:
 * - effective distance (preferred) OR flightMs fallback
 * - timeScale (adaptive density)
 */
function computeStepCount({ flightMs, projectile, timeScale }) {
  const ms = Math.max(1, Number(flightMs ?? 450));

  // Prefer effective distance if embedded
  const eff =
    projectile?.distance?.eff ??
    projectile?.meta?.distance?.eff ??
    projectile?.meta?.eff ??
    null;

  const tsRaw = Number(timeScale);
  const ts = Number.isFinite(tsRaw) && tsRaw > 0 ? tsRaw : 1;

  const density = clamp(1 / ts, 0.35, 6);

  let base;
  if (Number.isFinite(eff)) base = Math.ceil(eff * 2);
  else base = Math.round(ms / 120);

  const steps = Math.round(base * density);
  const maxSteps = ts < 0.6 ? 80 : 40;
  return clamp(steps, 4, maxSteps);
}

/**
 * Choose a good arc height (z) in "hex units" (or meters if you map it).
 * Uses effective distance when available. Also considers altitude difference.
 *
 * projectile.meta can override:
 * - arcHeight (absolute)
 * - arcHeightPerEff (multiplier)
 * - arcMax / arcMin
 */
function computeArcHeight({ projectile }) {
  const eff =
    projectile?.distance?.eff ??
    projectile?.meta?.distance?.eff ??
    projectile?.meta?.eff ??
    null;

  const fromAlt = Number(projectile?.meta?.fromAlt ?? projectile?.fromAlt ?? 0);
  const toAlt = Number(projectile?.meta?.toAlt ?? projectile?.toAlt ?? 0);
  const altDelta = Math.abs(fromAlt - toAlt);

  // Manual override
  if (Number.isFinite(Number(projectile?.meta?.arcHeight))) {
    return Math.max(0, Number(projectile.meta.arcHeight));
  }

  // Defaults:
  // - arrow-ish: small arc
  // - long distance: higher arc
  // - altitude differences: add a bit
  const arcHeightPerEff = Number.isFinite(Number(projectile?.meta?.arcHeightPerEff))
    ? Number(projectile.meta.arcHeightPerEff)
    : 0.12;

  const base = Number.isFinite(eff) ? eff * arcHeightPerEff : 0.8;

  // Add a bit if shooting up/down
  const withAlt = base + altDelta * 0.25;

  const arcMin = Number.isFinite(Number(projectile?.meta?.arcMin)) ? Number(projectile.meta.arcMin) : 0.25;
  const arcMax = Number.isFinite(Number(projectile?.meta?.arcMax)) ? Number(projectile.meta.arcMax) : 3.0;

  return clamp(withAlt, arcMin, arcMax);
}

/**
 * scheduleAttack({ attackerId, projectile, flightMs, timeScale })
 * projectile: { id, kind, from:{x,y}, to:{x,y}, distance?, meta? }
 * Returns: [{t, e}, ...]
 */
function scheduleAttack({ attackerId, projectile, flightMs, timeScale }) {
  const ms = Math.max(1, Number(flightMs ?? 450));
  const items = [];

  // Spawn event
  items.push({
    t: 0,
    e: { type: "PROJECTILE_SPAWN", attackerId, projectile },
  });

  const steps = computeStepCount({ flightMs: ms, projectile, timeScale });

  const from = projectile?.from;
  const to = projectile?.to;

  // Arc settings
  const useArc = projectile?.meta?.useArc !== false; // default true
  const arcHeight = useArc ? computeArcHeight({ projectile }) : 0;

  // If you want "flat bolts" but arcing arrows:
  // set projectile.meta.useArc=false for bolts/spells, or set arcHeight=0.

  if (from && to) {
    for (let i = 1; i <= steps; i++) {
      const tNorm = i / (steps + 1);
      const tMs = Math.round(ms * tNorm);

      const x = lerp(from.x, to.x, tNorm);
      const y = lerp(from.y, to.y, tNorm);

      // Parabolic arc z
      // (If you want to incorporate gravity feel, this is the simplest pleasant curve.)
      const arcZ = arcHeight * parabola01(tNorm);

      items.push({
        t: tMs,
        e: {
          type: "PROJECTILE_STEP",
          attackerId,
          projectileId: projectile.id,
          kind: projectile.kind,
          tNorm,
          x,
          y,
          // new optional fields:
          arcZ,
          // if UI wants absolute Z relative to ground, it can add its own ground height.
          // For convenience, also include arcHeight:
          arcHeight,
          from,
          to,
        },
      });
    }
  }

  // Impact marker
  items.push({
    t: ms,
    e: {
      type: "PROJECTILE_IMPACT",
      attackerId,
      projectileId: projectile.id,
      kind: projectile.kind,
      at: projectile?.to ?? null,
    },
  });

  // Despawn
  items.push({
    t: ms + 1,
    e: {
      type: "PROJECTILE_DESPAWN",
      attackerId,
      projectileId: projectile.id,
      kind: projectile.kind,
    },
  });

  return items;
}

module.exports = { scheduleAttack };

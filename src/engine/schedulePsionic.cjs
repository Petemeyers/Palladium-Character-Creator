// src/engine/schedulePsionic.cjs
function schedulePsionic({ userId, power, from, to, flightMs = 450 }) {
  const items = [];
  const powerId = power?.id || power?.name || "psionic";
  const kind = power?.vfxKind || power?.kind || "burst"; // burst | bolt | cone | aoe | buff

  items.push({
    t: 0,
    e: { type: "PSIONIC_USE_START", userId, powerId, kind, from, to },
  });

  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    items.push({
      t: Math.round((flightMs * i) / steps),
      e: { type: "PSIONIC_VFX_UPDATE", userId, powerId, alpha: i / steps },
    });
  }

  items.push({
    t: flightMs,
    e: { type: "PSIONIC_IMPACT", userId, powerId, to, kind },
  });

  return items;
}

module.exports = { schedulePsionic };

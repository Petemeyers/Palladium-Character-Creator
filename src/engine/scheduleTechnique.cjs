// src/engine/scheduleTechnique.cjs

function scheduleTechnique({ casterId, technique, from, to, flightMs = 550, castId }) {
  const items = [];

  const techniqueId = technique?.id || technique?.name || "technique";
  const kind = technique?.vfxKind || technique?.kind || "bolt"; // bolt | beam | aoe | buff | summon

  items.push({
    t: 0,
    e: { type: "TECHNIQUE_START", casterId, techniqueId, kind, from, to },
  });

  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    items.push({
      t: Math.round((flightMs * i) / steps),
      e: { type: "TECHNIQUE_VFX_UPDATE", casterId, techniqueId, alpha: i / steps },
    });
  }

  items.push({
    t: flightMs + 1,
    e: { type: "TECHNIQUE_IMPACT", casterId, techniqueId, to, kind, castId },
  });

  return items;
}

module.exports = { scheduleTechnique };


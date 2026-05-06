// src/engine/scheduleSpell.cjs

function scheduleSpell({ casterId, spell, from, to, flightMs = 550, castId }) {
  const items = [];

  const spellId = spell?.id || spell?.name || "spell";
  const kind = spell?.vfxKind || spell?.kind || "bolt"; // bolt | beam | aoe | buff | summon

  items.push({
    t: 0,
    e: { type: "SPELL_CAST_START", casterId, spellId, kind, from, to },
  });

  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    items.push({
      t: Math.round((flightMs * i) / steps),
      e: { type: "SPELL_VFX_UPDATE", casterId, spellId, alpha: i / steps },
    });
  }

  items.push({
    t: flightMs + 1,
    e: { type: "SPELL_IMPACT", casterId, spellId, to, kind, castId },
  });

  return items;
}

module.exports = { scheduleSpell };


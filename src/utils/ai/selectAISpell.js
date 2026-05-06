/**
 * AI Spell Selection System
 * Selects appropriate spells for AI casters based on combat situation
 */

import { getFighterSpells } from "../getFighterSpells.js";

export function selectAISpell(
  caster,
  spellbook,
  fighters,
  positions,
  lastSpellMemory = {}
) {
  // ✅ Normalize object-form call
  if (caster && typeof caster === "object" && caster.caster && !spellbook) {
    const ctx = caster;
    return selectAISpell(
      ctx.caster,
      getFighterSpells(ctx.caster) || [],
      ctx.fighters || [],
      ctx.positions || {},
      lastSpellMemory || {}
    );
  }

  if (!spellbook || spellbook.length === 0) return null;

  const casterPos = positions[caster.id];
  if (!casterPos) return null;

  const casterSide = caster.side ?? caster.type;
  const enemies = fighters.filter(
    f => f.id !== caster.id && (f.side ?? f.type) !== casterSide
  );
  const allies = fighters.filter(
    f => f.id !== caster.id && (f.side ?? f.type) === casterSide
  );

  // --- helpers ---
  const parseRangeFeet = (spell) => {
    if (typeof spell.range === "number") return spell.range;
    if (typeof spell.rangeFeet === "number") return spell.rangeFeet;

    const raw = spell.range || spell.rangeText || "";
    if (typeof raw !== "string") return Infinity;

    if (raw.toLowerCase().includes("touch")) return 5;

    const match = raw.match(/(\d+)/);
    return match ? Number(match[1]) : Infinity;
  };

  const distFeet = (a, b) => {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const dz = Math.abs(dx + dy);
    return Math.max(dx, dy, dz) * 5;
  };

  const isInRange = (spell, from, targets) => {
    const r = parseRangeFeet(spell);
    return targets.some(t => {
      const p = positions[t.id];
      return p && distFeet(from, p) <= r;
    });
  };

  // --- legality filter ---
  const legalSpells = spellbook.filter(spell => {
    if (!spell || !spell.name) return false;

    if (spell.healing) {
      const wounded = allies.filter(a => {
        const hp = a.currentHP ?? a.hp ?? 0;
        const maxHp = a.maxHP ?? a.maxHp ?? a.HP ?? 100;
        return hp < maxHp;
      });
      return isInRange(spell, casterPos, wounded);
    }

    if (spell.support) {
      return isInRange(spell, casterPos, allies.concat([caster]));
    }

    return isInRange(spell, casterPos, enemies);
  });

  if (legalSpells.length === 0) return null;

  // --- simple priority pick (parse "2d6" etc. for comparison) ---
  const avgDamage = (d) => {
    if (typeof d === "number") return d;
    const m = String(d || "").match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!m) return 0;
    return (parseInt(m[1], 10) * (parseInt(m[2], 10) + 1) / 2) + (m[3] ? parseInt(m[3], 10) : 0);
  };
  legalSpells.sort((a, b) => avgDamage(b.damage || b.combatDamage) - avgDamage(a.damage || a.combatDamage));

  return legalSpells[0];
}

/**
 * AI Technique Selection System
 * Selects appropriate techniques for AI casters based on combat situation
 */

import { getFighterTechniques } from "../getFighterTechniques.js";
import { canTargetForAction } from "../factionDisposition.js";

export function selectAITechnique(
  caster,
  techniqueBook,
  fighters,
  positions,
  lastTechniqueMemory = {},
  sceneContext = { sceneType: "combat", relations: {} }
) {
  // âœ… Normalize object-form call
  if (caster && typeof caster === "object" && caster.caster && !techniqueBook) {
    const ctx = caster;
    return selectAITechnique(
      ctx.caster,
      getFighterTechniques(ctx.caster) || [],
      ctx.fighters || [],
      ctx.positions || {},
      ctx.lastTechniqueMemory || lastTechniqueMemory || {},
      ctx.sceneContext || sceneContext
    );
  }

  if (!techniqueBook || techniqueBook.length === 0) return null;

  const casterPos = positions[caster.id];
  if (!casterPos) return null;

  const enemies = fighters.filter(
    f => canTargetForAction(caster, f, "techniqueHostile", sceneContext)
  );
  const allies = fighters.filter(
    f => canTargetForAction(caster, f, "buff", sceneContext)
  );

  // --- helpers ---
  const parseRangeFeet = (technique) => {
    if (typeof technique.range === "number") return technique.range;
    if (typeof technique.rangeFeet === "number") return technique.rangeFeet;

    const raw = technique.range || technique.rangeText || "";
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

  const isInRange = (technique, from, targets) => {
    const r = parseRangeFeet(technique);
    return targets.some(t => {
      const p = positions[t.id];
      return p && distFeet(from, p) <= r;
    });
  };

  // --- legality filter ---
  const legalTechniques = techniqueBook.filter(technique => {
    if (!technique || !technique.name) return false;

    if (technique.healing) {
      const wounded = allies.filter(a => {
        const hp = a.currentHP ?? a.hp ?? 0;
        const maxHp = a.maxHP ?? a.maxHp ?? a.HP ?? 100;
        return hp < maxHp;
      });
      return isInRange(technique, casterPos, wounded);
    }

    if (technique.support) {
      return isInRange(technique, casterPos, allies.concat([caster]));
    }

    return isInRange(technique, casterPos, enemies);
  });

  if (legalTechniques.length === 0) return null;

  // --- simple priority pick (parse "2d6" etc. for comparison) ---
  const avgDamage = (d) => {
    if (typeof d === "number") return d;
    const m = String(d || "").match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!m) return 0;
    return (parseInt(m[1], 10) * (parseInt(m[2], 10) + 1) / 2) + (m[3] ? parseInt(m[3], 10) : 0);
  };
  legalTechniques.sort((a, b) => avgDamage(b.damage || b.combatDamage) - avgDamage(a.damage || a.combatDamage));

  return legalTechniques[0];
}

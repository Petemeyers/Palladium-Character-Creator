// src/engine/resolveSpellImpact.cjs

const { normalizeDuration } = require("./utils/normalizeDuration.cjs");
const { applyStatus } = require("./statusEngine.cjs");
const { resolveDamage } = require("./damageEngine.cjs");
const { resolveSave } = require("./saveEngine.cjs");

function rollDice(formula) {
  const m = String(formula).match(/^(\d+)d(\d+)$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const d = parseInt(m[2], 10);
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += 1 + Math.floor(Math.random() * d);
  }
  return total;
}

module.exports = function resolveSpellImpact(payload) {
  const { caster, target, spell, state, meta, ruleset } = payload;
  const castId = meta?.castId ?? null;
  const events = [];

  const casterF = state.fighters?.find(f => f.id === caster);
  const casterLevel = casterF?.level ?? casterF?.Level ?? 1;
  const targetId = typeof target === "string" ? target : target?.id;
  const targetF = targetId
    ? state.fighters?.find(f => f.id === targetId)
    : null;

  // Protection circle spells
  if (spell?.isProtectionCircle) {
    const pos = state.positions?.[caster];
    if (pos) {
      const ticks = normalizeDuration(spell.duration ?? 10, { level: casterLevel });
      events.push({
        type: "CIRCLE_CREATED",
        circle: {
          id: `circle:${Date.now()}`,
          casterId: caster,
          name: spell.name,
          x: pos.x,
          y: pos.y,
          radius: spell.radius ?? 5,
          duration: ticks,
        },
      });
    }
    events.push({ type: "TURN_ENDED", eid: caster, meta: castId ? { castId } : undefined });
    return { ok: true, events };
  }

  // Damage spells (support damage, combatDamage, Damage, combat_damage from DB)
  const dmgFormula =
    spell?.damage ??
    spell?.combatDamage ??
    spell?.Damage ??
    spell?.combat_damage ??
    null;

  if (dmgFormula) {
    events.push({
      type: "LOG",
      level: "info",
      message: `🎯 Spell targetId=${targetId ?? "null"} hasTargetF=${!!targetF}`,
      meta: castId ? { castId } : undefined,
    });
  }

  if (dmgFormula && targetF) {
    let rolledDamage = rollDice(dmgFormula);

    events.push({
      type: "LOG",
      level: "info",
      message: `⚡ ${spell?.name ?? "Spell"} damage formula: ${dmgFormula}`,
      meta: castId ? { castId } : undefined,
    });

    // Resolve save if spell requires one
    const save = spell.saveType
      ? resolveSave({
          target: targetF,
          saveType: spell.saveType, // "magic" etc
          dc: spell.saveDC ?? 14,
          modeOnSuccess: spell.saveMode ?? "half",
          ruleset,
        })
      : null;

    if (save) {
      events.push({
        type: "LOG",
        level: "info",
        message: `🛡️ ${targetF.name} save vs ${save.saveType}: ${save.roll} + ${save.bonus} = ${save.total} vs ${save.dc} (${save.succeeded ? "SUCCESS" : "FAIL"})`,
        meta: castId ? { castId } : undefined,
      });
    }

    const out = resolveDamage({
      target: targetF,
      baseAmount: rolledDamage,
      damageType: spell.damageType || "magic",
      save: save
        ? {
            resisted: save.succeeded,
            mode: save.modeOnSuccess,
            failedMode: save.modeOnFail === "double" ? "double" : undefined,
          }
        : null,
      ruleset,
    });

    if (out.breakdown.immune) {
      events.push({
        type: "LOG",
        level: "warning",
        message: `🛡️ ${targetF.name} is immune to ${out.breakdown.type}!`,
        meta: castId ? { castId } : undefined,
      });
    } else {
      events.push({
        type: "DAMAGE",
        targetId: targetF.id,
        amount: out.final,
        sourceId: caster,
        kind: "spell",
        damageType: out.breakdown.type,
        breakdown: out.breakdown,
        meta: castId ? { castId } : undefined,
      });
    }

    if (spell.status) {
      const ticks = normalizeDuration(spell.statusDuration ?? spell.duration ?? 2, { level: casterLevel });
      const now = state.turnCounter ?? 0;
      const result = applyStatus(state, {
        targetId: targetF.id,
        key: spell.status,
        durationTicks: ticks,
        sourceId: caster,
        now,
        meta: { kind: "spell", spell: spell.name, castId },
        ruleset,
      });
      for (const ev of result.events || []) {
        if ((ev.type === "LOG" || ev.type === "DAMAGE") && !ev.meta?.castId && castId) {
          ev.meta = { ...(ev.meta || {}), castId };
        }
        events.push(ev);
      }
    }

    events.push({ type: "TURN_ENDED", eid: caster, meta: castId ? { castId } : undefined });
    return { ok: true, events };
  }

  // Buffs / self-cast
  if (spell.status && !targetF) {
    const ticks = normalizeDuration(spell.statusDuration ?? spell.duration ?? 2, { level: casterLevel });
    const now = state.turnCounter ?? 0;
    const result = applyStatus(state, {
      targetId: caster,
      key: spell.status,
      durationTicks: ticks,
      sourceId: caster,
      now,
      meta: { kind: "spell", spell: spell.name, castId },
      ruleset,
    });
    for (const ev of result.events || []) {
      if ((ev.type === "LOG" || ev.type === "DAMAGE") && !ev.meta?.castId && castId) {
        ev.meta = { ...(ev.meta || {}), castId };
      }
      events.push(ev);
    }
    events.push({ type: "TURN_ENDED", eid: caster, meta: castId ? { castId } : undefined });
    return { ok: true, events };
  }

  events.push({ type: "TURN_ENDED", eid: caster, meta: castId ? { castId } : undefined });
  return { ok: true, events };
};


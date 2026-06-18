// src/engine/resolveTechniqueImpact.cjs

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

module.exports = function resolveTechniqueImpact(payload) {
  const { caster, target, technique, state, meta, ruleset } = payload;
  const castId = meta?.castId ?? null;
  const events = [];

  const casterF = state.fighters?.find(f => f.id === caster);
  const casterLevel = casterF?.level ?? casterF?.Level ?? 1;
  const targetId = typeof target === "string" ? target : target?.id;
  const targetF = targetId
    ? state.fighters?.find(f => f.id === targetId)
    : null;

  // Protection circle techniques
  if (technique?.isProtectionCircle) {
    const pos = state.positions?.[caster];
    if (pos) {
      const ticks = normalizeDuration(technique.duration ?? 10, { level: casterLevel });
      events.push({
        type: "CIRCLE_CREATED",
        circle: {
          id: `circle:${Date.now()}`,
          casterId: caster,
          name: technique.name,
          x: pos.x,
          y: pos.y,
          radius: technique.radius ?? 5,
          duration: ticks,
        },
      });
    }
    events.push({ type: "TURN_ENDED", eid: caster, meta: castId ? { castId } : undefined });
    return { ok: true, events };
  }

  // Damage techniques (support damage, combatDamage, Damage, combat_damage from DB)
  const dmgFormula =
    technique?.damage ??
    technique?.combatDamage ??
    technique?.Damage ??
    technique?.combat_damage ??
    null;

  if (dmgFormula) {
    events.push({
      type: "LOG",
      level: "info",
      message: `ðŸŽ¯ Technique targetId=${targetId ?? "null"} hasTargetF=${!!targetF}`,
      meta: castId ? { castId } : undefined,
    });
  }

  if (dmgFormula && targetF) {
    let rolledDamage = rollDice(dmgFormula);

    events.push({
      type: "LOG",
      level: "info",
      message: `âš¡ ${technique?.name ?? "Technique"} damage formula: ${dmgFormula}`,
      meta: castId ? { castId } : undefined,
    });

    // Resolve save if technique requires one
    const save = technique.saveType
      ? resolveSave({
          target: targetF,
          saveType: technique.saveType, // "training" etc
          dc: technique.saveDC ?? 14,
          modeOnSuccess: technique.saveMode ?? "half",
          ruleset,
        })
      : null;

    if (save) {
      events.push({
        type: "LOG",
        level: "info",
        message: `ðŸ›¡ï¸ ${targetF.name} save vs ${save.saveType}: ${save.roll} + ${save.bonus} = ${save.total} vs ${save.dc} (${save.succeeded ? "SUCCESS" : "FAIL"})`,
        meta: castId ? { castId } : undefined,
      });
    }

    const out = resolveDamage({
      target: targetF,
      baseAmount: rolledDamage,
      damageType: technique.damageType || "training",
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
        message: `ðŸ›¡ï¸ ${targetF.name} is immune to ${out.breakdown.type}!`,
        meta: castId ? { castId } : undefined,
      });
    } else {
      events.push({
        type: "DAMAGE",
        targetId: targetF.id,
        amount: out.final,
        sourceId: caster,
        kind: "technique",
        damageType: out.breakdown.type,
        breakdown: out.breakdown,
        meta: castId ? { castId } : undefined,
      });
    }

    if (technique.status) {
      const ticks = normalizeDuration(technique.statusDuration ?? technique.duration ?? 2, { level: casterLevel });
      const now = state.turnCounter ?? 0;
      const result = applyStatus(state, {
        targetId: targetF.id,
        key: technique.status,
        durationTicks: ticks,
        sourceId: caster,
        now,
        meta: { kind: "technique", technique: technique.name, castId },
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

  // Buffs / shuman-cast
  if (technique.status && !targetF) {
    const ticks = normalizeDuration(technique.statusDuration ?? technique.duration ?? 2, { level: casterLevel });
    const now = state.turnCounter ?? 0;
    const result = applyStatus(state, {
      targetId: caster,
      key: technique.status,
      durationTicks: ticks,
      sourceId: caster,
      now,
      meta: { kind: "technique", technique: technique.name, castId },
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


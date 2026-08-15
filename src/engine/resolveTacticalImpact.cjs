// src/engine/resolveTacticalImpact.cjs
let CryptoSecureDice;
try {
  CryptoSecureDice = require("../utils/cryptoDice.js");
} catch {
  CryptoSecureDice = null;
}

const { normalizeDuration } = require("./utils/normalizeDuration.cjs");
const { applyStatus } = require("./statusEngine.cjs");
const { resolveDamage } = require("./damageEngine.cjs");
const { resolveSave } = require("./saveEngine.cjs");
const { attachCanonicalResolvedEffect } = require("./attachCanonicalResolvedEffect.cjs");

function rollDice(formula) {
  if (CryptoSecureDice?.parseAndRoll) {
    const r = CryptoSecureDice.parseAndRoll(formula);
    return r.totalWithBonus ?? r.total ?? 0;
  }
  const m = String(formula).trim().match(/^(\d+)d(\d+)$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const d = parseInt(m[2], 10);
  let total = 0;
  for (let i = 0; i < n; i++) total += 1 + Math.floor(Math.random() * d);
  return total;
}

function normalizeTargetId(target) {
  if (!target) return null;
  if (typeof target === "string") return target;
  if (typeof target === "object" && target.id) return target.id;
  return null;
}

// Normalize power metadata from tactics.json structure
function normalizePower(power) {
  return {
    name: power.name,
    focus: power.focus ?? 0,
    attackType: power.attackType ?? "utility",
    saveType: power.saveType ?? null,
    damage: power.damage,
    damageType: power.damageType,
    protectionPolicy: power.protectionPolicy,
    delivery: power.delivery || power.deliveryType,
    duration: power.duration,
    category: power.category,
    effect: power.effect,
    saveDC: power.saveDC ?? 14, // Default DC for tactical saves
  };
}

function withTacticalMeta(event, meta) {
  if (!event) return event;
  return {
    ...event,
    meta: {
      ...meta,
      ...(event.meta || {}),
      source: "tactical",
      kind: event.meta?.kind || event.kind || "tactical",
    },
  };
}

function attachTacticalMeta(events, meta) {
  return (events || []).map((event) => withTacticalMeta(event, meta));
}

// Handler: Mental attacks (save vs tactics, may cause status effects)
function handleMentalAttack({ user, targetF, power, events, userLevel = 1, state, ruleset }) {
  // Resolve save if power requires one
  const save = power.saveType
    ? resolveSave({
        target: targetF,
        saveType: power.saveType, // "tactical" etc
        dc: power.saveDC ?? 14,
        modeOnSuccess: power.saveMode ?? "half",
        ruleset,
      })
    : null;

  if (save) {
    events.push({
      type: "LOG",
      level: "info",
      message: `Ã°Å¸Â§Â  ${targetF.name} save vs ${save.saveType}: ${save.roll} + ${save.bonus} = ${save.total} vs ${save.dc} (${save.succeeded ? "SUCCESS" : "FAIL"})`,
    });
  }

  // If save succeeded and mode is "negate", skip all effects
  if (save?.succeeded && save.modeOnSuccess === "negate") {
    return;
  }

  // Apply damage if power has damage
  if (power.damage) {
    let baseDmg = rollDice(power.damage);
    const out = resolveDamage({
      target: targetF,
      baseAmount: baseDmg,
      damageType: power.damageType || "tactical",
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
        message: `Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${targetF.name} is immune to ${out.breakdown.type}!`,
      });
    } else {
      events.push(attachCanonicalResolvedEffect({
        type: "DAMAGE",
        targetId: targetF.id,
        amount: out.final,
        sourceId: user,
        kind: "tactical",
        attackType: power.attackType,
        damageType: out.breakdown.type,
        power: power.name,
        breakdown: out.breakdown,
        protectionPolicy: power.protectionPolicy,
        delivery: power.delivery || power.deliveryType,
      }, { kind: "tactical", power }));

      events.push({
        type: "LOG",
        level: "combat",
        message: `Ã°Å¸â€™Â¥ ${power.name} hits ${targetF.name} for ${out.final} ${out.breakdown.type} damage!`,
      });
    }
  }

  // Apply status effects from effect text (e.g., "Paralyze target")
  // Status effects are negated if save succeeded and mode is "negate"
  const effectLower = (power.effect || "").toLowerCase();
  if (effectLower.includes("paralyze") || effectLower.includes("paralysis")) {
    // Status effects can have their own save (negate mode)
    const statusSave = resolveSave({
      target: targetF,
      saveType: "tactical",
      dc: power.saveDC ?? 14,
      modeOnSuccess: "negate",
      ruleset,
    });

    if (!statusSave.succeeded) {
      const ticks = normalizeDuration(power.duration ?? "1d4 melees", { level: userLevel });
      const now = state.turnCounter ?? 0;
      const result = applyStatus(state, {
        targetId: targetF.id,
        key: "Paralyzed",
        durationTicks: ticks,
        sourceId: user,
        now,
        meta: { kind: "tactical", power: power.name },
        ruleset,
      });
      events.push(...result.events);
    } else {
      events.push({
        type: "LOG",
        level: "info",
        message: `Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${targetF.name} resists paralysis!`,
      });
    }
  } else if (effectLower.includes("sleep")) {
    const statusSave = resolveSave({
      target: targetF,
      saveType: "tactical",
      dc: power.saveDC ?? 14,
      modeOnSuccess: "negate",
      ruleset,
    });

    if (!statusSave.succeeded) {
      const ticks = normalizeDuration(power.duration ?? "1d4 hours", { level: userLevel });
      const now = state.turnCounter ?? 0;
      const result = applyStatus(state, {
        targetId: targetF.id,
        key: "Asleep",
        durationTicks: ticks,
        sourceId: user,
        now,
        meta: { kind: "tactical", power: power.name },
        ruleset,
      });
      events.push(...result.events);
    } else {
      events.push({
        type: "LOG",
        level: "info",
        message: `Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${targetF.name} resists sleep!`,
      });
    }
  }
}

// Handler: Ranged damage attacks (like Mind Bolt, Psi-Spear)
function handleRangedDamage({ user, targetF, power, events, ruleset }) {
  if (!power.damage) {
    events.push({ type: "LOG", level: "warning", message: `Ã¢Å¡Â Ã¯Â¸Â ${power.name} has no damage formula!` });
    return;
  }

  let baseDmg = rollDice(power.damage);

  // Resolve save if power requires one
  const save = power.saveType
    ? resolveSave({
        target: targetF,
        saveType: power.saveType, // "tactical" etc
        dc: power.saveDC ?? 14,
        modeOnSuccess: power.saveMode ?? "half",
        ruleset,
      })
    : null;

  if (save) {
    events.push({
      type: "LOG",
      level: "info",
      message: `Ã°Å¸Â§Â  ${targetF.name} save vs ${save.saveType}: ${save.roll} + ${save.bonus} = ${save.total} vs ${save.dc} (${save.succeeded ? "SUCCESS" : "FAIL"})`,
    });
  }

  const out = resolveDamage({
    target: targetF,
    baseAmount: baseDmg,
    damageType: power.damageType || "tactical",
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
      message: `Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${targetF.name} is immune to ${out.breakdown.type}!`,
    });
  } else {
    events.push(attachCanonicalResolvedEffect({
      type: "DAMAGE",
      targetId: targetF.id,
      amount: out.final,
      sourceId: user,
      kind: "tactical",
      attackType: power.attackType,
      damageType: out.breakdown.type,
      power: power.name,
      breakdown: out.breakdown,
      protectionPolicy: power.protectionPolicy,
      delivery: power.delivery || power.deliveryType,
    }, { kind: "tactical", power }));

    events.push({
      type: "LOG",
      level: "combat",
      message: `Ã°Å¸â€™Â¥ ${power.name} hits ${targetF.name} for ${out.final} ${out.breakdown.type} damage!`,
    });
  }
}

// Handler: Shuman-buffs and defensive powers
function handleBuff({ user, power, events, userLevel = 1, state, ruleset }) {
  const ticks = normalizeDuration(power.duration ?? "2 melees/level", { level: userLevel });
  const now = state.turnCounter ?? 0;
  const result = applyStatus(state, {
    targetId: user,
    key: power.name,
    durationTicks: ticks,
    sourceId: user,
    now,
    meta: { kind: "tactical", effect: power.effect, description: power.description },
    ruleset,
  });
  events.push(...result.events);

  events.push({
    type: "LOG",
    level: "info",
    message: `Ã¢Å“Â¨ ${power.name} active: ${power.effect || power.description || ""}`,
  });
}

// Handler: Healing tactics
function handleHealing({ user, targetF, power, events }) {
  const targetId = targetF ? targetF.id : user;
  const targetName = targetF ? targetF.name : "shuman";

  if (!power.damage) {
    events.push({ type: "LOG", level: "warning", message: `Ã¢Å¡Â Ã¯Â¸Â ${power.name} has no healing formula!` });
    return;
  }

  // Parse damage formula as healing amount
  const heal = Math.abs(rollDice(power.damage));

  events.push(attachCanonicalResolvedEffect({
    type: "HEAL",
    targetId,
    amount: heal,
    sourceId: user,
    kind: "healing",
    attackType: "healing",
    power: power.name,
    protectionPolicy: "not-applicable",
    delivery: "healing",
  }, { kind: "healing", power }));

  events.push({
    type: "LOG",
    level: "info",
    message: `Ã°Å¸â€™Å¡ ${power.name} heals ${targetName} for ${heal} HP!`,
  });
}

module.exports = function resolveTacticalImpact(payload) {
  const { user, target, power, state, ruleset, meta } = payload;
  const events = [];

  const targetId = normalizeTargetId(target);
  const targetF = targetId ? state.fighters?.find(f => f.id === targetId) : null;
  const userF = state.fighters?.find(f => f.id === user);
  const userLevel = userF?.level ?? userF?.Level ?? 1;
  const tacticalMeta = {
    source: "tactical",
    tacticalUseId: meta?.tacticalUseId ?? null,
    actorId: user,
    casterId: user,
    userId: user,
    targetId: targetId ?? null,
    turnToken: meta?.turnToken ?? null,
    combatSession: meta?.combatSession,
    controlMode: meta?.controlMode,
  };
  const finish = () => ({ ok: true, events: attachTacticalMeta(events, tacticalMeta) });

  // Normalize power from tactics.json structure
  const p = normalizePower(power);

  // PASSIVE tactics do not consume a turn in combat
  if (p.attackType === "passive") {
    events.push({
      type: "LOG",
      level: "info",
      message: `Ã°Å¸Â§Â  Passive tactical active: ${p.name}`,
    });
    return finish();
  }

  // SHUMAN-BUFF / DEFENSE
  if (p.attackType === "buff" || p.attackType === "defense" || p.attackType === "shuman") {
    handleBuff({ user, power: p, events, userLevel, state, ruleset });
    events.push({ type: "TURN_ENDED", eid: user });
    return finish();
  }

  // HEALING
  if (p.attackType === "healing") {
    handleHealing({ user, targetF, power: p, events });
    events.push({ type: "TURN_ENDED", eid: user });
    return finish();
  }

  // MENTAL / RANGED / MELEE OFFENSE
  if ((p.attackType === "mental" || p.attackType === "ranged" || p.attackType === "melee") && targetF) {
    if (p.attackType === "mental") {
      handleMentalAttack({ user, targetF, power: p, events, userLevel, state, ruleset });
    } else {
      handleRangedDamage({ user, targetF, power: p, events, ruleset });
    }
    events.push({ type: "TURN_ENDED", eid: user });
    return finish();
  }

  // UTILITY / MOVEMENT / SUPPORT (no combat effect, but consumes turn)
  if (p.attackType === "utility" || p.attackType === "movement" || p.attackType === "support") {
    events.push({
      type: "LOG",
      level: "info",
      message: `Ã°Å¸Â§Â  ${p.name}: ${p.effect || p.description || ""}`,
    });
    events.push({ type: "TURN_ENDED", eid: user });
    return finish();
  }

  // FALLBACK
  events.push({
    type: "LOG",
    level: "info",
    message: `Ã°Å¸Â§Â  ${p.name} used (${p.attackType})`,
  });
  events.push({ type: "TURN_ENDED", eid: user });
  return finish();
};

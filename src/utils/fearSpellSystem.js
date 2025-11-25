import { applyStatusEffect } from "./statusEffectSystem.js";

const FEAR_STATUS_NAMES = ["shaken", "hesitant", "fleeing"];

function removeFearStatuses(target) {
  if (!target.statusEffects || target.statusEffects.length === 0) return;
  target.statusEffects = target.statusEffects.filter(
    (effect) => !FEAR_STATUS_NAMES.includes((effect.name || "").toLowerCase())
  );
}

export function castCourage(caster, combatants, log = console.log) {
  if (!caster || !Array.isArray(combatants)) return false;

  const level = caster.level || 1;
  const range = 60;
  const duration = level;
  const ppeCost = 6;

  const currentPPE =
    caster.currentPPE ??
    caster.PPE ??
    (typeof caster.ppe === "number" ? caster.ppe : 0);

  if (currentPPE < ppeCost) {
    log(
      `❌ ${caster.name} lacks sufficient PPE to cast Courage (${currentPPE}/${ppeCost}).`,
      "spell"
    );
    return false;
  }

  if (typeof caster.currentPPE === "number") {
    caster.currentPPE = Math.max(0, caster.currentPPE - ppeCost);
  } else if (typeof caster.PPE === "number") {
    caster.PPE = Math.max(0, caster.PPE - ppeCost);
  }

  log(
    `✨ ${caster.name} casts *Courage*, bolstering allies within ${range} ft!`,
    "spell"
  );

  combatants.forEach((target) => {
    if (!target || target.type === "enemy") return;
    if (!target.position || !caster.position) return;

    const dx = (target.position.x || 0) - (caster.position.x || 0);
    const dy = (target.position.y || 0) - (caster.position.y || 0);
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > range) return;

    removeFearStatuses(target);

    if (!target.statusEffects) {
      target.statusEffects = [];
    }

    const existing = target.statusEffects.find(
      (effect) =>
        (effect.name || effect.type || "").toLowerCase() === "courage_buff"
    );

    if (existing) {
      if (target.bonuses && target.bonuses.horrorResist) {
        target.bonuses.horrorResist = Math.max(
          0,
          target.bonuses.horrorResist - (existing.courageBonus || 3)
        );
        if (target.bonuses.horrorResist === 0) {
          delete target.bonuses.horrorResist;
        }
      }
      target.statusEffects = target.statusEffects.filter(
        (effect) => effect !== existing
      );
    }

    const result = applyStatusEffect(target, "COURAGE_BUFF", {
      caster,
      logCallback: log,
      bypassSave: true,
    });
    if (result.success && result.effect) {
      result.effect.duration = duration;
      result.effect.remainingRounds = duration;
      result.effect.courageBonus = 3;
    }
    target.bonuses = target.bonuses || {};
    target.bonuses.horrorResist = (target.bonuses.horrorResist || 0) + 3;

    log(
      `🛡️ ${target.name} feels fearless! +3 vs Horror Factor for ${duration} melees.`,
      "spell"
    );
  });

  return true;
}

export function castRemoveFear(caster, target, log = console.log) {
  if (!caster || !target) return false;

  const ppeCost = 10;
  const range = 10;

  const currentPPE =
    caster.currentPPE ??
    caster.PPE ??
    (typeof caster.ppe === "number" ? caster.ppe : 0);

  if (currentPPE < ppeCost) {
    log(
      `❌ ${caster.name} lacks sufficient PPE to cast Remove Fear (${currentPPE}/${ppeCost}).`,
      "spell"
    );
    return false;
  }

  if (!caster.position || !target.position) {
    log(
      `🚫 ${caster.name} cannot reach ${target.name} to remove fear.`,
      "spell"
    );
    return false;
  }

  const dx = (caster.position.x || 0) - (target.position.x || 0);
  const dy = (caster.position.y || 0) - (target.position.y || 0);
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > range) {
    log(
      `🚫 ${target.name} is too far for Remove Fear (needs to be within ${range} ft).`,
      "spell"
    );
    return false;
  }

  if (typeof caster.currentPPE === "number") {
    caster.currentPPE = Math.max(0, caster.currentPPE - ppeCost);
  } else if (typeof caster.PPE === "number") {
    caster.PPE = Math.max(0, caster.PPE - ppeCost);
  }

  removeFearStatuses(target);

  log(
    `🙏 ${caster.name} casts *Remove Fear* on ${target.name}, dispelling all terror.`,
    "spell"
  );

  return true;
}

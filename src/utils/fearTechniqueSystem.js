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
  const staminaCost = 6;

  const currentstamina =
    caster.currentstamina ??
    caster.stamina ??
    (typeof caster.stamina === "number" ? caster.stamina : 0);

  if (currentstamina < staminaCost) {
    log(
      `âŒ ${caster.name} lacks sufficient stamina to cast Courage (${currentstamina}/${staminaCost}).`,
      "technique"
    );
    return false;
  }

  if (typeof caster.currentstamina === "number") {
    caster.currentstamina = Math.max(0, caster.currentstamina - staminaCost);
  } else if (typeof caster.stamina === "number") {
    caster.stamina = Math.max(0, caster.stamina - staminaCost);
  }

  log(
    `âœ¨ ${caster.name} casts *Courage*, bolstering allies within ${range} ft!`,
    "technique"
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
      `ðŸ›¡ï¸ ${target.name} feels fearless! +3 vs dreadRating for ${duration} melees.`,
      "technique"
    );
  });

  return true;
}

export function castRemoveFear(caster, target, log = console.log) {
  if (!caster || !target) return false;

  const staminaCost = 10;
  const range = 10;

  const currentstamina =
    caster.currentstamina ??
    caster.stamina ??
    (typeof caster.stamina === "number" ? caster.stamina : 0);

  if (currentstamina < staminaCost) {
    log(
      `âŒ ${caster.name} lacks sufficient stamina to cast Remove Fear (${currentstamina}/${staminaCost}).`,
      "technique"
    );
    return false;
  }

  if (!caster.position || !target.position) {
    log(
      `ðŸš« ${caster.name} cannot reach ${target.name} to remove fear.`,
      "technique"
    );
    return false;
  }

  const dx = (caster.position.x || 0) - (target.position.x || 0);
  const dy = (caster.position.y || 0) - (target.position.y || 0);
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > range) {
    log(
      `ðŸš« ${target.name} is too far for Remove Fear (needs to be within ${range} ft).`,
      "technique"
    );
    return false;
  }

  if (typeof caster.currentstamina === "number") {
    caster.currentstamina = Math.max(0, caster.currentstamina - staminaCost);
  } else if (typeof caster.stamina === "number") {
    caster.stamina = Math.max(0, caster.stamina - staminaCost);
  }

  removeFearStatuses(target);

  log(
    `ðŸ™ ${caster.name} casts *Remove Fear* on ${target.name}, ditechniqueing all terror.`,
    "technique"
  );

  return true;
}

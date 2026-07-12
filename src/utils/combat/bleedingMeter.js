function getFighterHp(fighter = {}) {
  const value = Number(fighter.currentHP ?? fighter.hp ?? fighter.HP ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function setFighterHp(fighter, hp) {
  return {
    ...fighter,
    currentHP: hp,
    hp,
  };
}

export function applyBleedingMeterForNewMeleeRound(fighter = {}, { meleeRound } = {}) {
  const conditions = Array.isArray(fighter.conditions) ? fighter.conditions : [];
  let hpLoss = 0;
  let changed = false;

  const nextConditions = conditions.map((condition) => {
    if (!condition || condition.type !== "BLEEDING" || condition.untilTreated === false) {
      return condition;
    }

    const rate = Math.max(0, Number(condition.ratePerMelee) || 0);
    const meter = Math.max(0, Number(condition.bleedMeter) || 0) + rate;
    const wholeLoss = Math.floor(meter);
    hpLoss += wholeLoss;
    changed = changed || wholeLoss > 0 || meter !== condition.bleedMeter;

    return {
      ...condition,
      bleedMeter: meter - wholeLoss,
      lastBleedMeleeRound: meleeRound,
    };
  });

  if (!changed) {
    return { fighter, hpLoss: 0, conditions: nextConditions };
  }

  const currentHP = getFighterHp(fighter);
  const nextHP = currentHP - hpLoss;
  return {
    fighter: {
      ...setFighterHp(fighter, nextHP),
      conditions: nextConditions,
    },
    hpLoss,
    conditions: nextConditions,
  };
}

export default applyBleedingMeterForNewMeleeRound;

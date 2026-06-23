const HP_FIELDS = ["HP", "hp", "hitPoints"];

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (!hasValue(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function getPublicCombatHpInfo(combatant = {}) {
  for (const field of HP_FIELDS) {
    const hp = toNumber(combatant?.[field]);
    if (hp !== null) {
      return {
        ok: true,
        hp,
        field,
        readOnlySource: false,
        missingFields: [],
      };
    }
  }

  const derivedHp = toNumber(combatant?.publicDerivedStats?.hitPoints);
  if (derivedHp !== null) {
    return {
      ok: true,
      hp: derivedHp,
      field: "HP",
      readOnlySource: true,
      missingFields: [],
    };
  }

  return {
    ok: false,
    hp: null,
    field: null,
    readOnlySource: false,
    missingFields: ["HP"],
  };
}

export function applyPublicCombatDamage(target, damageTotal, { applied = false } = {}) {
  const missingFields = [];
  const damage = toNumber(damageTotal);

  if (applied) missingFields.push("applied");
  if (!target) missingFields.push("target");
  if (damage === null) missingFields.push("damageTotal");

  const hpInfo = getPublicCombatHpInfo(target || {});
  if (!hpInfo.ok) missingFields.push(...hpInfo.missingFields);

  if (missingFields.length > 0) {
    return {
      ok: false,
      target,
      updatedTarget: target,
      hpField: hpInfo.field,
      oldHp: hpInfo.hp,
      newHp: hpInfo.hp,
      damageTotal: damage,
      missingFields: [...new Set(missingFields)],
      message: `Cannot apply damage: missing ${[...new Set(missingFields)].join(", ")}.`,
    };
  }

  const oldHp = hpInfo.hp;
  const newHp = Math.max(0, oldHp - Math.max(0, damage));
  const updatedTarget = {
    ...target,
    [hpInfo.field]: newHp,
  };

  return {
    ok: true,
    target,
    updatedTarget,
    hpField: hpInfo.field,
    oldHp,
    newHp,
    damageTotal: damage,
    missingFields: [],
    message: `${target?.name || "Target"} HP: ${oldHp} -> ${newHp}.`,
  };
}

export default {
  applyPublicCombatDamage,
  getPublicCombatHpInfo,
};

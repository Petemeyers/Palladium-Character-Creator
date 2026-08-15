export const MIN_CANONICAL_COMBAT_HP = -100;

const finiteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export function getFighterHP(fighter = {}) {
  const value =
    fighter.currentHP ??
    fighter.currentHp ??
    fighter.hp ??
    fighter.HP ??
    fighter.hitPoints?.current ??
    fighter.hitPoints;
  return finiteNumber(value) ?? 0;
}

export function getFighterMaxHP(fighter = {}, fallback = getFighterHP(fighter)) {
  const value =
    fighter.maxHP ??
    fighter.maxHp ??
    fighter.maximumHP ??
    fighter.hitPoints?.max ??
    fighter.derivedStats?.maxHp ??
    fighter.derivedStats?.hp ??
    fighter.HP ??
    fighter.hp;
  return finiteNumber(value) ?? finiteNumber(fallback) ?? 0;
}

export function clampHP(value, fighter, minHp = MIN_CANONICAL_COMBAT_HP) {
  const numeric = finiteNumber(value);
  if (numeric === null) return value;
  return Math.max(Number(minHp), Math.min(numeric, getFighterMaxHP(fighter, numeric)));
}

export function applyHPToFighter(
  fighter,
  newHP,
  { updateStatus = true } = {},
) {
  if (!fighter || typeof fighter !== "object") return fighter;
  const canonicalHP = clampHP(newHP, fighter);
  let scalarAliasWritten = false;
  for (const field of ["currentHP", "currentHp", "hp", "HP"]) {
    if (fighter[field] === undefined) continue;
    fighter[field] = canonicalHP;
    scalarAliasWritten = true;
  }
  if (!scalarAliasWritten) fighter.currentHP = canonicalHP;
  if (fighter.hitPoints && typeof fighter.hitPoints === "object") {
    fighter.hitPoints = { ...fighter.hitPoints, current: canonicalHP };
  }
  if (!updateStatus) return fighter;
  if (canonicalHP > 0) fighter.status = "active";
  else if (canonicalHP === 0) fighter.status = "unconscious";
  else fighter.status = "dying";
  return fighter;
}

export default {
  applyHPToFighter,
  clampHP,
  getFighterHP,
  getFighterMaxHP,
};

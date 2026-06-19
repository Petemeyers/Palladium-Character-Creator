const DEFAULT_ABILITY_SCORE = 10;
const DEFAULT_HIT_POINTS = 10;
const DEFAULT_ARMOR_CLASS = 10;
const DEFAULT_SPEED = 30;

function firstNumber(...values) {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return undefined;
}

function getNestedAbility(combatant, ...keys) {
  for (const key of keys) {
    const value = firstNumber(
      combatant?.[key],
      combatant?.attributes?.[key],
      combatant?.stats?.[key],
      combatant?.abilityScores?.[key]
    );
    if (value !== undefined) return value;
  }
  return undefined;
}

function getAbilityScore(combatant, primaryKey, legacyKey) {
  return (
    getNestedAbility(
      combatant,
      primaryKey,
      primaryKey.toUpperCase(),
      legacyKey,
      legacyKey.toLowerCase()
    ) ?? DEFAULT_ABILITY_SCORE
  );
}

export function getAbilityModifier(score) {
  const abilityScore = firstNumber(score) ?? DEFAULT_ABILITY_SCORE;
  return Math.floor((abilityScore - 10) / 2);
}

export function getProficiencyBonus(level = 1) {
  const normalizedLevel = Math.max(1, Math.floor(firstNumber(level) ?? 1));
  return Math.max(2, Math.ceil(normalizedLevel / 4) + 1);
}

export function getHitPoints(combatant = {}) {
  return (
    firstNumber(
      combatant.hp,
      combatant.currentHp,
      combatant.currentHP,
      combatant.currentHitPoints,
      combatant.hitPoints,
      combatant.HP,
      combatant.health
    ) ?? DEFAULT_HIT_POINTS
  );
}

export function getMaxHitPoints(combatant = {}) {
  return (
    firstNumber(
      combatant.maxHp,
      combatant.maxHP,
      combatant.maxHitPoints,
      combatant.maximumHitPoints,
      combatant.hitPoints,
      combatant.hp,
      combatant.HP,
      combatant.health
    ) ?? DEFAULT_HIT_POINTS
  );
}

export function getTemporaryHitPoints(combatant = {}) {
  return (
    firstNumber(
      combatant.tempHp,
      combatant.temporaryHitPoints,
      combatant.temporaryHp,
      combatant.tempHP
    ) ?? 0
  );
}

export function getArmorClass(combatant = {}) {
  return (
    firstNumber(
      combatant.ac,
      combatant.AC,
      combatant.armorClass,
      combatant.guardRating,
      combatant.baseGuardRating
    ) ?? DEFAULT_ARMOR_CLASS
  );
}

export function getSpeed(combatant = {}) {
  const explicitSpeed = firstNumber(
    combatant.speed,
    combatant.movement,
    combatant.movementSpeed,
    combatant.walkSpeed,
    combatant.attributes?.speed,
    combatant.stats?.speed
  );
  if (explicitSpeed !== undefined) return explicitSpeed;

  const legacySpeed = firstNumber(
    combatant.Spd,
    combatant.spd,
    combatant.SPD,
    combatant.attributes?.Spd,
    combatant.attributes?.spd,
    combatant.attributes?.SPD,
    combatant.stats?.Spd,
    combatant.stats?.spd,
    combatant.stats?.SPD
  );
  if (legacySpeed !== undefined) return Math.max(5, legacySpeed * 3);

  return DEFAULT_SPEED;
}

export function getStrModifier(combatant = {}) {
  return getAbilityModifier(getAbilityScore(combatant, "str", "PS"));
}

export function getDexModifier(combatant = {}) {
  return getAbilityModifier(getAbilityScore(combatant, "dex", "PP"));
}

export function getConModifier(combatant = {}) {
  return getAbilityModifier(getAbilityScore(combatant, "con", "PE"));
}

export function normalize5eCombatant(input = {}) {
  const combatant = input || {};
  const str = getAbilityScore(combatant, "str", "PS");
  const dex = getAbilityScore(combatant, "dex", "PP");
  const con = getAbilityScore(combatant, "con", "PE");
  const int = getAbilityScore(combatant, "int", "IQ");
  const wis = getAbilityScore(combatant, "wis", "ME");
  const cha = getAbilityScore(combatant, "cha", "MA");
  const hp = getHitPoints(combatant);
  const maxHp = getMaxHitPoints(combatant);
  const speed = getSpeed(combatant);
  const level = firstNumber(combatant.level, combatant.cr, combatant.challengeRating) ?? 1;
  const proficiencyBonus =
    firstNumber(combatant.proficiencyBonus, combatant.trainingBonus) ??
    getProficiencyBonus(level);

  const abilityScores = { str, dex, con, int, wis, cha };
  const abilityMods = Object.fromEntries(
    Object.entries(abilityScores).map(([key, value]) => [key, getAbilityModifier(value)])
  );
  const actionEconomy = {
    action: combatant.action ?? combatant.actions ?? true,
    bonusAction: combatant.bonusAction ?? true,
    reaction: combatant.reaction ?? true,
    movement: combatant.movement ?? speed,
  };

  return {
    ...combatant,
    str,
    dex,
    con,
    int,
    wis,
    cha,
    abilityScores,
    abilityMods,
    hp,
    maxHp,
    ac: getArmorClass(combatant),
    tempHp: getTemporaryHitPoints(combatant),
    speed,
    proficiencyBonus,
    initiativeBonus: firstNumber(combatant.initiativeBonus) ?? 0,
    actions: actionEconomy.action,
    bonusAction: actionEconomy.bonusAction,
    reaction: actionEconomy.reaction,
    movement: actionEconomy.movement,
    actionEconomy,
  };
}

export default normalize5eCombatant;

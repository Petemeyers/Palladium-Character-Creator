const defaultRollDice = (sides, count) => {
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
};

export function evaluateDice(expression, rollDiceFn = defaultRollDice) {
  if (expression === null || expression === undefined || expression === "") return 0;
  if (typeof expression === "number") return Number.isFinite(expression) ? expression : 0;
  if (typeof expression !== "string") return 0;

  const normalizedExpression = expression.trim();
  if (!normalizedExpression) return 0;

  const numericValue = Number(normalizedExpression);
  if (Number.isFinite(numericValue)) return numericValue;

  const diceMatch = normalizedExpression.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (diceMatch) {
    const [, diceCountText, diceSidesText, modifierText] = diceMatch;
    const diceCount = Number(diceCountText);
    const diceSides = Number(diceSidesText);
    if (diceCount <= 0 || diceSides <= 0) return 0;
    const rolledTotal = Number(rollDiceFn(diceSides, diceCount));
    const modifier = modifierText ? Number(modifierText) : 0;
    return (Number.isFinite(rolledTotal) ? rolledTotal : 0) + modifier;
  }

  return 0;
}

export function applyBonus(current, bonusExpression) {
  const currentValue = Number(current);
  const normalizedCurrent = Number.isFinite(currentValue) ? currentValue : 0;
  return normalizedCurrent + evaluateDice(bonusExpression);
}

export function getAverageDiceRoll(diceNotation, fallback = 3.5) {
  if (typeof diceNotation === "number") {
    return Number.isFinite(diceNotation) && diceNotation >= 0 ? diceNotation : fallback;
  }
  if (typeof diceNotation !== "string") return fallback;

  const normalizedNotation = diceNotation.trim();
  if (!normalizedNotation) return fallback;
  const numericValue = Number(normalizedNotation);
  if (Number.isFinite(numericValue) && numericValue >= 0) return numericValue;

  const diceMatch = normalizedNotation.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!diceMatch) return fallback;
  const diceCount = Number(diceMatch[1]);
  const diceSides = Number(diceMatch[2]);
  const modifier = diceMatch[3] ? Number(diceMatch[3]) : 0;
  if (diceCount <= 0 || diceSides <= 0) return fallback;
  return diceCount * ((diceSides + 1) / 2) + modifier;
}

export default evaluateDice;

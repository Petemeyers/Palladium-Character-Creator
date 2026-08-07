import { getEnemyActionMovementAllowanceFeet } from "../enemyClosingMovement.js";

const positiveNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
};

const roundUpToHex = (feet) => Math.ceil(Math.max(0, Number(feet) || 0) / 5) * 5;
const roundDownToHex = (feet) => Math.floor(Math.max(0, Number(feet) || 0) / 5) * 5;

export function getOddRHexDistanceHexes(from, to) {
  if (!from || !to) return 0;
  const toCube = (position) => {
    const row = Number(position.y) || 0;
    const col = Number(position.x) || 0;
    const q = col - ((row - (row & 1)) / 2);
    const r = row;
    return { x: q, z: r, y: -q - r };
  };
  const a = toCube(from);
  const b = toCube(to);
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.z - b.z),
  );
}

export function getOddRHexDistanceFeet(from, to) {
  return getOddRHexDistanceHexes(from, to) * 5;
}

export function getCanonicalRoundGroundPaceFt(fighter = {}) {
  const canonicalGroundSpeed = positiveNumber(
    fighter.movement?.ground,
    fighter.movement?.groundPace,
    fighter.derivedStats?.movement,
    fighter.movementSpeed,
    fighter.speed,
    getEnemyActionMovementAllowanceFeet(fighter, "MOVE", 0),
  );
  const speed = positiveNumber(
    fighter.Spd,
    fighter.spd,
    fighter.attributes?.Spd,
    fighter.attributes?.spd,
    10,
  ) || 10;
  const compatibilityGroundPace = Math.max(5, speed * 4.5);
  return Math.max(5, roundDownToHex(canonicalGroundSpeed ?? compatibilityGroundPace));
}

export function getCanonicalMovementActionBudgetFt(fighter = {}, movementType = "walk") {
  const normalizedMode = String(movementType || "walk").toLowerCase();
  const isWalk = normalizedMode === "move" || normalizedMode === "walk";
  const isFlight = normalizedMode === "fly" || normalizedMode === "flight";
  const isCharge = normalizedMode === "charge";
  const allowanceMode = isFlight ? "FLY" : isWalk ? "MOVE" : isCharge ? "CHARGE" : "RUN";

  const roundGroundPace = getCanonicalRoundGroundPaceFt(fighter);
  const actionsPerRound = Math.max(
    1,
    positiveNumber(
      fighter.actionsPerRound,
      fighter.actionsPerMelee,
      fighter.maxActions,
      fighter.attacks,
      1,
    ) || 1,
  );
  const spentThisRound = Math.max(
    0,
    Number(
      fighter.movementSpentThisRoundFt ??
      fighter.roundMovementSpentFt ??
      fighter.movementState?.spentThisRoundFt ??
      0,
    ) || 0,
  );

  const canonicalFullSpeed = positiveNumber(
    isWalk ? roundGroundPace : null,
    isFlight ? fighter.movement?.flying : isCharge ? fighter.movement?.burst : fighter.movement?.runDistance,
    isFlight ? fighter.flightSpeed : isCharge ? fighter.burstSpeed : fighter.runSpeed,
    getEnemyActionMovementAllowanceFeet(fighter, allowanceMode, 0),
  );

  let budget;
  if (isWalk) {
    const strideFeet = Math.max(5, roundUpToHex(roundGroundPace / actionsPerRound));
    const remainingRoundFeet = Math.max(0, roundGroundPace - spentThisRound);
    budget = Math.min(strideFeet, remainingRoundFeet);
  } else {
    budget = canonicalFullSpeed ?? Math.max(roundGroundPace, roundGroundPace * 2);
  }

  const armorPenaltyFeet = Math.max(
    0,
    Number(
      fighter.armorMovementPenaltyFeet ??
      fighter.movementPenaltyFeet ??
      fighter.encumbrance?.movementPenaltyFeet ??
      0,
    ) || 0,
  );
  budget -= armorPenaltyFeet;

  const currentStamina = Number(
    fighter.currentStamina ??
    fighter.combatStamina?.currentStamina ??
    fighter.combatStamina?.current ??
    fighter.stamina,
  );
  const maxStamina = Number(
    fighter.maxStamina ??
    fighter.combatStamina?.maximum ??
    fighter.combatStamina?.maxStamina ??
    fighter.staminaMaximum ??
    fighter.maximumStamina,
  );
  if (Number.isFinite(currentStamina) && Number.isFinite(maxStamina) && maxStamina > 0) {
    const staminaRatio = currentStamina / maxStamina;
    if (staminaRatio <= 0.1) budget *= 0.5;
    else if (staminaRatio <= 0.25) budget *= 0.75;
  }

  if (budget <= 0) return 0;
  return Math.max(5, roundDownToHex(budget));
}

export function validateMovementActionDestination({
  fighter,
  movementType = "walk",
  origin,
  destination,
  path = null,
} = {}) {
  const budgetFeet = getCanonicalMovementActionBudgetFt(fighter, movementType);
  const distanceFeet = Array.isArray(path) && path.length > 0
    ? path.length * 5
    : getOddRHexDistanceFeet(origin, destination);
  return {
    accepted: distanceFeet > 0 && distanceFeet <= budgetFeet,
    budgetFeet,
    distanceFeet,
    movementType: String(movementType || "walk").toLowerCase(),
  };
}

const DEFAULT_ATTRIBUTE = 10;

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const firstNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
};

const getFieldNumber = (actor, ...keys) => {
  for (const key of keys) {
    const value = firstNumber(
      actor?.originalActorMetadata?.attributes?.[key],
      actor?.attributes?.[key],
      actor?.abilityScores?.[key],
      actor?.publicAbilityScores?.[key],
      actor?.finalAbilityScores?.[key],
      actor?.compatibilityAttributes?.[key],
      actor?.stats?.[key],
      actor?.[key],
    );
    if (value !== undefined) return value;
  }
  return undefined;
};

const attributeOrDefault = (actor, originalKey, compatibilityKeys, fallback = DEFAULT_ATTRIBUTE) =>
  getFieldNumber(actor, originalKey, ...compatibilityKeys) ?? fallback;

const cloneValue = (value) => {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
};

const cloneRecord = (value) => isPlainObject(value) ? cloneValue(value) : {};

const cloneArray = (value) => Array.isArray(value)
  ? value.map(cloneValue)
  : [];

const getMovementPace = (actor) => {
  const movement = isPlainObject(actor?.movement) ? actor.movement : {};
  const explicitPace = firstNumber(
    movement.pace,
    movement.ground?.pace,
    movement.ground,
    actor?.derivedStats?.movement,
    actor?.movementSpeed,
    actor?.speed,
    typeof actor?.movement === "number" ? actor.movement : undefined,
  );
  if (explicitPace !== undefined) return explicitPace;
  const compatibilitySpeed = firstNumber(actor?.Spd, actor?.spd, actor?.compatibilityAttributes?.Spd);
  return compatibilitySpeed !== undefined ? Math.max(5, compatibilitySpeed * 3) : 30;
};

const buildMovementMetadata = (actor) => {
  const movement = isPlainObject(actor?.movement) ? actor.movement : {};
  const priorMovement = cloneRecord(actor?.originalActorMetadata?.movement);
  const modes = Array.isArray(priorMovement.modes)
    ? [...priorMovement.modes]
    : Array.isArray(movement.modes)
    ? [...movement.modes]
    : Array.isArray(actor?.movementModes)
      ? [...actor.movementModes]
      : ["ground"];
  const pace = firstNumber(priorMovement.pace, getMovementPace(actor)) ?? 30;
  const flyingPace = firstNumber(priorMovement.flying?.pace, movement.flying?.pace, movement.flying);

  return {
    ...priorMovement,
    modes,
    pace,
    burst: firstNumber(priorMovement.burst, movement.burst) ?? pace * 2,
    recoveryStep: firstNumber(priorMovement.recoveryStep, movement.recoveryStep) ?? 5,
    pursuit: firstNumber(priorMovement.pursuit, movement.pursuit) ?? 0,
    withdrawal: firstNumber(priorMovement.withdrawal, movement.withdrawal) ?? 0,
    turnControl: firstNumber(priorMovement.turnControl, movement.turnControl) ?? 0,
    formationPace: firstNumber(priorMovement.formationPace, movement.formationPace) ?? 0,
    terrainMobility: {
      ...cloneRecord(movement.terrainMobility),
      ...cloneRecord(priorMovement.terrainMobility),
    },
    ground: {
      ...cloneRecord(priorMovement.ground),
      pace,
      burst: firstNumber(priorMovement.ground?.burst, movement.ground?.burst) ?? pace * 2,
    },
    ...(flyingPace !== undefined ? {
      flying: {
        ...cloneRecord(priorMovement.flying),
        pace: flyingPace,
        burst: firstNumber(priorMovement.flying?.burst, movement.flying?.burst) ?? flyingPace * 2,
        turnControl: firstNumber(priorMovement.flying?.turnControl, movement.flying?.turnControl) ?? attributeOrDefault(actor, "mobility", ["dexterity", "dex", "PP"]),
        recoveryStep: firstNumber(priorMovement.flying?.recoveryStep, movement.flying?.recoveryStep) ?? 15,
      },
    } : {}),
  };
};

export function buildOriginalAttributes(actor = {}) {
  return {
    ...cloneRecord(actor?.originalActorMetadata?.attributes),
    might: attributeOrDefault(actor, "might", ["strength", "str", "PS"]),
    deftness: attributeOrDefault(actor, "deftness", ["dexterity", "dex", "PP"]),
    vigor: attributeOrDefault(actor, "vigor", ["constitution", "con", "PE"]),
    endurance: attributeOrDefault(actor, "endurance", ["constitution", "con", "PE"]),
    mobility: attributeOrDefault(actor, "mobility", ["dexterity", "dex", "PP"]),
    intellect: attributeOrDefault(actor, "intellect", ["intelligence", "int", "IQ"]),
    awareness: attributeOrDefault(actor, "awareness", ["wisdom", "wis", "ME"]),
    cunning: attributeOrDefault(actor, "cunning", []),
    resolve: attributeOrDefault(actor, "resolve", ["wisdom", "wis", "ME"]),
    discipline: attributeOrDefault(actor, "discipline", []),
    presence: attributeOrDefault(actor, "presence", ["charisma", "cha", "MA"]),
    renown: attributeOrDefault(actor, "renown", [], 0),
    favor: attributeOrDefault(actor, "favor", [], 0),
  };
}

export function buildOriginalActorMetadata(actor = {}) {
  const prior = cloneRecord(actor?.originalActorMetadata);
  const directTraining = cloneRecord(actor?.training);
  const training = cloneRecord(prior.training);
  const directState = cloneRecord(actor?.state);
  const state = cloneRecord(prior.state);
  const directReputation = cloneRecord(actor?.reputation);
  const reputation = cloneRecord(prior.reputation);
  const directFavor = cloneRecord(actor?.favor);
  const favor = cloneRecord(prior.favor);
  const directBehavior = cloneRecord(actor?.behavior);
  const behavior = cloneRecord(prior.behavior);

  return {
    ...prior,
    attributes: buildOriginalAttributes(actor),
    training: {
      ...directTraining,
      ...training,
      weapons: { ...cloneRecord(directTraining.weapons), ...cloneRecord(training.weapons) },
      formationDrill: firstNumber(training.formationDrill, directTraining.formationDrill) ?? 0,
      fieldcraft: firstNumber(training.fieldcraft, directTraining.fieldcraft) ?? 0,
      healing: firstNumber(training.healing, directTraining.healing) ?? 0,
      horsemanship: firstNumber(training.horsemanship, directTraining.horsemanship) ?? 0,
    },
    traits: cloneArray(Array.isArray(prior.traits) ? prior.traits : actor?.traits),
    state: {
      ...directState,
      ...state,
      morale: firstNumber(state.morale, directState.morale, actor?.morale) ?? 100,
      fatigue: firstNumber(state.fatigue, directState.fatigue, actor?.fatigue) ?? 0,
      fear: firstNumber(state.fear, directState.fear, actor?.fear) ?? 0,
      wounds: cloneArray(Array.isArray(state.wounds) ? state.wounds : Array.isArray(directState.wounds) ? directState.wounds : actor?.wounds),
      cohesion: firstNumber(state.cohesion, directState.cohesion, actor?.cohesion) ?? 100,
    },
    reputation: {
      ...directReputation,
      ...reputation,
      local: firstNumber(reputation.local, directReputation.local) ?? 0,
      regional: firstNumber(reputation.regional, directReputation.regional) ?? 0,
      legendary: firstNumber(reputation.legendary, directReputation.legendary) ?? 0,
      faction: { ...cloneRecord(directReputation.faction), ...cloneRecord(reputation.faction) },
      titles: cloneArray(Array.isArray(reputation.titles) ? reputation.titles : directReputation.titles),
      knownDeeds: cloneArray(Array.isArray(reputation.knownDeeds) ? reputation.knownDeeds : directReputation.knownDeeds),
    },
    favor: {
      ...directFavor,
      ...favor,
      sacred: firstNumber(favor.sacred, directFavor.sacred) ?? 0,
      royal: firstNumber(favor.royal, directFavor.royal) ?? 0,
      folk: firstNumber(favor.folk, directFavor.folk) ?? 0,
      ancestral: firstNumber(favor.ancestral, directFavor.ancestral) ?? 0,
      cursed: firstNumber(favor.cursed, directFavor.cursed) ?? 0,
      faction: { ...cloneRecord(directFavor.faction), ...cloneRecord(favor.faction) },
    },
    behavior: {
      ...directBehavior,
      ...behavior,
      instinct: firstNumber(behavior.instinct, directBehavior.instinct, actor?.instinct) ?? 0,
      aggression: firstNumber(behavior.aggression, directBehavior.aggression, actor?.aggression) ?? 0,
      caution: firstNumber(behavior.caution, directBehavior.caution, actor?.caution) ?? 0,
      loyalty: firstNumber(behavior.loyalty, directBehavior.loyalty, actor?.loyalty) ?? 0,
    },
    movement: buildMovementMetadata(actor),
  };
}

export function addOriginalActorMetadata(actor = {}) {
  const metadata = buildOriginalActorMetadata(actor);
  const existingAttributes = isPlainObject(actor?.attributes) ? actor.attributes : {};
  const existingTraining = isPlainObject(actor?.training) ? actor.training : null;
  const existingState = isPlainObject(actor?.state) ? actor.state : null;
  const existingReputation = isPlainObject(actor?.reputation) ? actor.reputation : null;
  const existingFavor = isPlainObject(actor?.favor) ? actor.favor : null;
  const existingBehavior = isPlainObject(actor?.behavior) ? actor.behavior : null;

  return {
    ...actor,
    attributes: { ...existingAttributes, ...metadata.attributes },
    training: existingTraining
      ? { ...metadata.training, ...existingTraining, weapons: { ...metadata.training.weapons, ...cloneRecord(existingTraining.weapons) } }
      : actor?.training === undefined ? metadata.training : actor.training,
    traits: actor?.traits === undefined ? metadata.traits : actor.traits,
    state: existingState ? { ...metadata.state, ...existingState } : actor?.state === undefined ? metadata.state : actor.state,
    reputation: existingReputation
      ? { ...metadata.reputation, ...existingReputation, faction: { ...metadata.reputation.faction, ...cloneRecord(existingReputation.faction) } }
      : actor?.reputation === undefined ? metadata.reputation : actor.reputation,
    favor: existingFavor
      ? { ...metadata.favor, ...existingFavor, faction: { ...metadata.favor.faction, ...cloneRecord(existingFavor.faction) } }
      : actor?.favor === undefined ? metadata.favor : actor.favor,
    behavior: existingBehavior ? { ...metadata.behavior, ...existingBehavior } : actor?.behavior === undefined ? metadata.behavior : actor.behavior,
    originalActorMetadata: metadata,
  };
}

export default buildOriginalActorMetadata;

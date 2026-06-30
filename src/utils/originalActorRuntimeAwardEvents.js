const normalizeText = (value) => String(value ?? "").trim();
const normalizeTag = (value) => normalizeText(value).toLowerCase().replace(/[\s-]+/g, "_");
const normalizeDetailText = (value) => (
  typeof value === "string" || typeof value === "number"
    ? String(value).trim() || null
    : null
);

const MYTHIC_MARKERS = new Set([
  "beast",
  "dragon",
  "giant",
  "legendary",
  "minotaur",
  "monster",
  "mythic",
  "spirit",
  "supernatural",
  "titan",
]);

const getActorId = (actor) => normalizeText(
  actor?.id || actor?._id || actor?.fighterId || actor?.characterId
);

const getActorName = (actor) => normalizeText(actor?.name || actor?.displayName) || "Unnamed actor";

const getActorAffiliations = (actor) => {
  const explicitAffiliations = new Set([
    actor?.factionId,
    actor?.teamId,
    actor?.team,
    actor?.side,
    actor?.battleSide,
    actor?.armyId,
  ].map(normalizeTag).filter(Boolean));
  if (explicitAffiliations.size > 0) return explicitAffiliations;
  return new Set([normalizeTag(actor?.type)].filter(Boolean));
};

const areKnownAllies = (left, right) => {
  const leftAffiliations = getActorAffiliations(left);
  const rightAffiliations = getActorAffiliations(right);
  return [...leftAffiliations].some((value) => rightAffiliations.has(value));
};

const normalizeNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const isActiveEncounterActor = (actor) => {
  const status = normalizeTag(actor?.status || actor?.condition);
  const hp = normalizeNumber(actor?.currentHP ?? actor?.currentHp ?? actor?.hp ?? actor?.HP);
  return (
    actor?.fled !== true &&
    actor?.isDead !== true &&
    !["dead", "defeated", "fled"].includes(status) &&
    (!Number.isFinite(hp) || hp > 0)
  );
};

const getMarkerValues = (actor) => {
  const metadata = actor?.originalActorMetadata || {};
  const tags = [
    ...(Array.isArray(actor?.tags) ? actor.tags : []),
    ...(Array.isArray(metadata?.tags) ? metadata.tags : []),
  ];
  return [
    metadata?.tier,
    metadata?.category,
    actor?.category,
    actor?.creatureType,
    actor?.type,
    actor?.species,
    actor?.name,
    actor?.modelKey,
    ...tags,
  ].map(normalizeTag).filter(Boolean);
};

const hasMarker = (value) => {
  if (MYTHIC_MARKERS.has(value)) return true;
  return value.split(/[^a-z0-9]+/).some((part) => MYTHIC_MARKERS.has(part));
};

const hasSeriousCondition = (actor) => {
  const markers = [
    actor?.status,
    actor?.condition,
    actor?.moraleState?.status,
    ...(Array.isArray(actor?.statusEffects) ? actor.statusEffects : []),
  ].map(normalizeTag);
  return markers.some((marker) => (
    marker.includes("bleed") ||
    marker.includes("unconscious") ||
    marker.includes("wound") ||
    marker === "shaken" ||
    marker === "dying" ||
    marker === "critical"
  ));
};

export function isMythicOrMonsterActor(actor = {}) {
  return getMarkerValues(actor).some(hasMarker);
}

export function isSeriousOriginalActorHarm({
  actor = {},
  damage,
  hpAfter,
  maxHP,
} = {}) {
  const safeDamage = Math.max(0, normalizeNumber(damage, 0));
  const safeHPAfter = normalizeNumber(hpAfter, normalizeNumber(actor?.currentHP ?? actor?.hp ?? actor?.HP));
  const safeMaxHP = normalizeNumber(
    maxHP,
    normalizeNumber(
      actor?.maxHP ?? actor?.maxHp ?? actor?.totalHP ??
      actor?.derivedStats?.maxHp ?? actor?.derivedStats?.maxHitPoints
    )
  );
  if (!Number.isFinite(safeMaxHP) || safeMaxHP <= 0) return hasSeriousCondition(actor);

  const belowQuarterHealth = Number.isFinite(safeHPAfter) && safeHPAfter <= safeMaxHP * 0.25;
  const highRelativeDamage = safeDamage >= Math.max(1, safeMaxHP * 0.35);
  return belowQuarterHealth || highRelativeDamage || hasSeriousCondition(actor);
}

export function createOriginalDamageAwardEventInputs({
  actor = {},
  sourceActor = null,
  damage,
  hpBefore,
  hpAfter,
  maxHP,
  attackName,
  damageExpression,
  bodyLocation,
  wasCritical = false,
  round = 0,
  turn = 0,
} = {}) {
  const safeDamage = Math.max(0, normalizeNumber(damage, 0));
  const safeHPBefore = normalizeNumber(hpBefore);
  const safeHPAfter = normalizeNumber(hpAfter);
  const safeMaxHP = normalizeNumber(maxHP);
  if (!getActorId(actor) || safeDamage <= 0) return [];

  const damageDetails = {
    damage: safeDamage,
    hpBefore: safeHPBefore,
    hpAfter: safeHPAfter,
    attackName: normalizeDetailText(attackName),
    damageExpression: normalizeDetailText(damageExpression),
    bodyLocation: normalizeDetailText(bodyLocation),
    wasCritical: wasCritical === true,
  };
  const common = { actor, sourceActor, round, turn };
  const events = [{
    ...common,
    type: "actor_damaged",
    details: damageDetails,
  }];

  if (isSeriousOriginalActorHarm({ actor, damage: safeDamage, hpAfter: safeHPAfter, maxHP: safeMaxHP })) {
    events.push({
      ...common,
      type: "actor_seriously_wounded",
      details: { ...damageDetails, maxHP: safeMaxHP },
    });
  }

  if (
    sourceActor &&
    getActorId(sourceActor) &&
    !areKnownAllies(actor, sourceActor) &&
    Number.isFinite(safeHPBefore) &&
    Number.isFinite(safeHPAfter) &&
    safeHPBefore > 0 &&
    safeHPAfter <= 0
  ) {
    events.push({
      type: "actor_defeated_enemy",
      actor: sourceActor,
      sourceActor: actor,
      round,
      turn,
      details: {
        defeatedActorId: getActorId(actor),
        defeatedActorName: getActorName(actor),
        attackName: damageDetails.attackName,
        wasCritical: damageDetails.wasCritical,
      },
    });
  }

  return events;
}

export function createMythicFacingEventInputs(combatants = [], { round = 0, turn = 0 } = {}) {
  const participants = (Array.isArray(combatants) ? combatants : [])
    .filter((actor) => actor && typeof actor === "object");
  const mythicActors = participants.filter((actor) => (
    isActiveEncounterActor(actor) && isMythicOrMonsterActor(actor)
  ));
  if (mythicActors.length === 0) return [];

  return participants.flatMap((actor) => {
    if (!isActiveEncounterActor(actor) || isMythicOrMonsterActor(actor)) return [];
    const facedActor = mythicActors.find((mythicActor) => {
      return getActorId(mythicActor) !== getActorId(actor) && !areKnownAllies(actor, mythicActor);
    });
    if (!facedActor) return [];
    return [{
      type: "actor_faced_mythic",
      actor,
      sourceActor: facedActor,
      round,
      turn,
      details: {
        mythicActorId: getActorId(facedActor),
        mythicActorName: getActorName(facedActor),
      },
    }];
  });
}

export default {
  createMythicFacingEventInputs,
  createOriginalDamageAwardEventInputs,
  isMythicOrMonsterActor,
  isSeriousOriginalActorHarm,
};

import { getWeaponTacticalTraits } from "./weaponEngagementAuthority.js";
import {
  createWeaponCondition,
  isWeaponConditionActive,
  WEAPON_CONDITION_TYPES,
} from "./weaponConditionAuthority.js";
import { resolveTerrainFormationContext } from "./terrainFormationAuthority.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const getActorId = (actor) => actor?.id || actor?._id || null;
const getActorTeam = (actor) => normalizeText(actor?.team || actor?.side || actor?.armyId || actor?.type);

export const FORMATION_COHESION_STATES = Object.freeze({
  ISOLATED: "isolated",
  LOOSE: "loose",
  SUPPORTED: "supported",
  ORDERED_LINE: "ordered-line",
  DISRUPTED: "disrupted",
});

const actorCanSupport = (actor, currentRound = null) => {
  if (!actor) return false;
  if (actor?.formationState?.recoveryRequired === true || actor?.formationState?.status === FORMATION_COHESION_STATES.DISRUPTED) return false;
  if (actor.dead || actor.isDead || actor.defeated || actor.isDefeated || actor.unconscious || actor.isUnconscious) return false;
  if (actor.routed || actor.hasFled || actor.isCombatBroken || actor.prone || actor.isProne) return false;
  const statuses = Array.isArray(actor.statusEffects) ? actor.statusEffects : [];
  const disrupted = statuses.some((status) => {
    const type = normalizeText(typeof status === "string" ? status : status?.type || status?.id).replaceAll("_", "-");
    return type === WEAPON_CONDITION_TYPES.FORMATION_DISRUPTED && isWeaponConditionActive(status, currentRound);
  });
  return !disrupted;
};

const getFormationDrill = (actor = {}) => Math.max(0, toFinite(
  actor?.training?.formationDrill ??
  actor?.originalActorMetadata?.training?.formationDrill ??
  actor?.formationDrill,
  0,
));

const resolvePosition = (actor, positions = {}) => positions?.[getActorId(actor)] || actor?.position || null;

const getDistance = (a, b, calculateDistanceFeet) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  if (typeof calculateDistanceFeet === "function") {
    const result = Number(calculateDistanceFeet(a, b));
    if (Number.isFinite(result)) return result;
  }
  const dx = toFinite(a.x) - toFinite(b.x);
  const dy = toFinite(a.y) - toFinite(b.y);
  return Math.sqrt(dx * dx + dy * dy) * 5;
};

const isLongWeaponSupporter = (weapon, actorTraits) => {
  const traits = getWeaponTacticalTraits(weapon || {});
  if (!traits.isPolearm && traits.reachFeet < 9.5) return false;
  return traits.reachFeet >= Math.max(9.5, toFinite(actorTraits?.reachFeet, 5) - 5);
};

const evaluateAlignment = ({ actorPos, supporterPos, targetPos, calculateDistanceFeet }) => {
  if (!actorPos || !supporterPos) return { aligned: false, reason: "missing-position" };
  const actorSupportDistance = getDistance(actorPos, supporterPos, calculateDistanceFeet);
  if (actorSupportDistance > 5.6) return { aligned: false, reason: "supporter-not-adjacent", actorSupportDistance };
  if (!targetPos) return { aligned: true, reason: "adjacent-without-target", actorSupportDistance };

  const actorTargetDistance = getDistance(actorPos, targetPos, calculateDistanceFeet);
  const supporterTargetDistance = getDistance(supporterPos, targetPos, calculateDistanceFeet);
  const notAheadOfLine = supporterTargetDistance >= actorTargetDistance - 0.6;
  const closeToLineDepth = supporterTargetDistance <= actorTargetDistance + 6;
  return {
    aligned: notAheadOfLine && closeToLineDepth,
    reason: notAheadOfLine && closeToLineDepth ? "adjacent-line-support" : "supporter-out-of-line",
    actorSupportDistance,
    actorTargetDistance,
    supporterTargetDistance,
  };
};

export const resolveSpatialFormationSupport = ({
  actor,
  target = null,
  combatants = [],
  positions = {},
  getWeapon = null,
  calculateDistanceFeet = null,
  currentRound = null,
  maxSupporters = 2,
  terrainContext = null,
  terrainAt = null,
} = {}) => {
  if (!actor || !actorCanSupport(actor, currentRound)) {
    return {
      formationSupported: false,
      state: FORMATION_COHESION_STATES.DISRUPTED,
      supportBonus: 0,
      cohesionScore: 0,
      supporterIds: [],
      supporters: [],
      reasons: ["actor-cannot-maintain-formation"],
    };
  }

  const actorId = getActorId(actor);
  const actorTeam = getActorTeam(actor);
  const actorPos = resolvePosition(actor, positions);
  const targetPos = resolvePosition(target, positions);
  const resolvedTerrainContext = terrainContext || resolveTerrainFormationContext({
    actor,
    target,
    actorPosition: actorPos,
    targetPosition: targetPos,
    terrain: typeof terrainAt === "function" ? terrainAt(actorPos, actor) : actor?.terrain || actor?.terrainType,
    targetTerrain: typeof terrainAt === "function" ? terrainAt(targetPos, target) : target?.terrain || target?.terrainType,
  });
  const actorWeapon = typeof getWeapon === "function" ? getWeapon(actor) : actor?.selectedAttack || actor?.equippedWeapon || actor?.weapon;
  const actorTraits = getWeaponTacticalTraits(actorWeapon || {});
  const candidates = [];

  for (const ally of Array.isArray(combatants) ? combatants : []) {
    const allyId = getActorId(ally);
    if (!allyId || allyId === actorId || getActorTeam(ally) !== actorTeam || !actorCanSupport(ally, currentRound)) continue;
    const allyWeapon = typeof getWeapon === "function" ? getWeapon(ally) : ally?.selectedAttack || ally?.equippedWeapon || ally?.weapon;
    if (!isLongWeaponSupporter(allyWeapon, actorTraits)) continue;
    const supporterPos = resolvePosition(ally, positions);
    const alignment = evaluateAlignment({ actorPos, supporterPos, targetPos, calculateDistanceFeet });
    if (!alignment.aligned) continue;
    candidates.push({
      actor: ally,
      actorId: allyId,
      weapon: allyWeapon,
      distanceFeet: alignment.actorSupportDistance,
      targetDistanceFeet: alignment.supporterTargetDistance ?? null,
      alignmentReason: alignment.reason,
      formationDrill: getFormationDrill(ally),
    });
  }

  candidates.sort((left, right) => (
    right.formationDrill - left.formationDrill ||
    left.distanceFeet - right.distanceFeet ||
    String(left.actorId).localeCompare(String(right.actorId))
  ));
  const terrainSupportCap = Math.max(0, Math.min(2, Math.max(0, maxSupporters) + toFinite(resolvedTerrainContext?.supportCapModifier, 0)));
  const supporters = candidates.slice(0, terrainSupportCap);
  const formationDrill = getFormationDrill(actor);
  const actorFormationDependent = Boolean(actorTraits.formationDependent || actorTraits.isPike);
  const supportCount = supporters.length;
  const anchored = actor?.formationState?.anchored === true;
  const cohesionScore = Math.min(100, Math.max(0,
    supportCount * 28 +
    Math.min(30, formationDrill * 5) +
    (actorFormationDependent && supportCount >= 2 ? 14 : 0) +
    toFinite(resolvedTerrainContext?.cohesionModifier, 0) * 10 +
    (anchored ? 8 : 0)
  ));

  let state = FORMATION_COHESION_STATES.ISOLATED;
  if (supportCount === 1) state = FORMATION_COHESION_STATES.SUPPORTED;
  if (supportCount >= 2 && cohesionScore >= 65) state = FORMATION_COHESION_STATES.ORDERED_LINE;
  else if (supportCount >= 1 && cohesionScore < 35) state = FORMATION_COHESION_STATES.LOOSE;

  let supportBonus = 0;
  if (supportCount >= 1) supportBonus = 1;
  if (actorFormationDependent && state === FORMATION_COHESION_STATES.ORDERED_LINE) supportBonus = 2;
  if (anchored && supportBonus > 0) supportBonus += 1;
  supportBonus += Math.min(0, toFinite(resolvedTerrainContext?.cohesionModifier, 0));
  supportBonus = Math.max(0, Math.min(3, supportBonus));
  if (!actorTraits.isPolearm && actorTraits.reachFeet < 9.5) supportBonus = 0;

  return {
    formationSupported: supportBonus > 0,
    state,
    supportBonus,
    cohesionScore,
    supporterIds: supporters.map((entry) => entry.actorId),
    supporters: supporters.map((entry) => entry.actor),
    details: supporters,
    actorId,
    targetId: getActorId(target),
    actorWeaponFamily: actorTraits.family,
    actorReachFeet: actorTraits.reachFeet,
    anchored,
    terrainContext: resolvedTerrainContext,
    reasons: supportBonus > 0
      ? [state, ...supporters.map((entry) => entry.alignmentReason)]
      : ["no-spatially-valid-supporters"],
  };
};

export const applyFormationDisruption = (actor, {
  sourceActorId = null,
  currentRound = 0,
  durationRounds = 1,
  reason = "formation-breached",
} = {}) => {
  if (!actor) return actor;
  const existing = Array.isArray(actor.statusEffects) ? actor.statusEffects : [];
  const condition = createWeaponCondition({
    type: WEAPON_CONDITION_TYPES.FORMATION_DISRUPTED,
    source: reason,
    sourceActorId,
    targetActorId: getActorId(actor),
    currentRound,
    durationRounds,
    penalties: { defense: 0, entry: -1, control: -1, attack: 0 },
    metadata: { persistentUntilRecovered: true },
  });
  return {
    ...actor,
    statusEffects: [
      ...existing.filter((entry) => normalizeText(entry?.type || entry) !== WEAPON_CONDITION_TYPES.FORMATION_DISRUPTED),
      condition,
    ],
    formationState: {
      ...(actor.formationState || {}),
      status: FORMATION_COHESION_STATES.DISRUPTED,
      disruptedBy: sourceActorId,
      disruptedRound: currentRound,
      disruptionReason: reason,
      recoveryRequired: true,
      anchored: false,
    },
  };
};

export const buildFormationCohesionPresentation = ({
  combatants = [],
  positions = {},
  getWeapon = null,
  calculateDistanceFeet = null,
  currentRound = null,
  terrainAt = null,
} = {}) => {
  const links = [];
  const statesByActorId = {};
  const seen = new Set();
  for (const actor of Array.isArray(combatants) ? combatants : []) {
    const state = resolveSpatialFormationSupport({
      actor,
      combatants,
      positions,
      getWeapon,
      calculateDistanceFeet,
      currentRound,
      terrainAt,
    });
    const actorId = getActorId(actor);
    if (!actorId) continue;
    statesByActorId[actorId] = state;
    state.supporterIds.forEach((supporterId) => {
      const key = [actorId, supporterId].sort().join("::");
      if (seen.has(key)) return;
      seen.add(key);
      links.push({
        id: `formation-link:${key}`,
        actorId,
        supporterId,
        state: state.state,
        cohesionScore: state.cohesionScore,
        supportBonus: state.supportBonus,
        label: state.state === FORMATION_COHESION_STATES.ORDERED_LINE ? "Ordered line" : "Weapon support",
      });
    });
  }
  return { links, statesByActorId };
};

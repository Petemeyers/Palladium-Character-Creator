import { ACTION_TYPES } from "./aiActionRegistry";
import { countClaimsOnTarget } from "./aiClaims";
import { getAiProfile } from "./aiProfiles";

function idOf(actor) {
  return actor?.id ?? actor?._id ?? actor?.name;
}

function hpPercent(actor) {
  return Number(actor?.currentHP ?? actor?.hp ?? actor?.HP ?? 0) /
    Math.max(1, Number(actor?.maxHP ?? actor?.maxHp ?? actor?.HP ?? 1));
}

function resourcePercent(actor, kind) {
  if (kind === "ppe") {
    return Number(actor?.currentPPE ?? actor?.ppe ?? actor?.PPE ?? 0) /
      Math.max(1, Number(actor?.maxPPE ?? actor?.ppe ?? actor?.PPE ?? 1));
  }

  if (kind === "isp") {
    return Number(actor?.currentISP ?? actor?.isp ?? actor?.ISP ?? 0) /
      Math.max(1, Number(actor?.maxISP ?? actor?.isp ?? actor?.ISP ?? 1));
  }

  return 1;
}

function wasUsedRecently(action, actor, world) {
  const key = `${idOf(actor)}:${action.type}:${
    action.spell?.name ?? action.psionic?.name ?? action.skillName ?? action.name
  }`;
  const lastUsedRound = world?.aiMemory?.lastUsedRoundByKey?.[key];
  if (lastUsedRound == null) return false;

  const round = Number(world?.round ?? world?.turnCounter ?? 0);
  return round - Number(lastUsedRound) <= 1;
}

function visibleEnemyCount(actor, world) {
  const actorId = idOf(actor);
  const explicit = world?.visibleEnemiesByActorId?.[actorId];
  if (Array.isArray(explicit)) return explicit.length;
  return Number(world?.visibleEnemyCountByActorId?.[actorId] ?? 0);
}

function applyGoalScore(score, action, actor) {
  const goal = actor?.aiGoal;
  if (!goal) return score;
  const tags = action.tags ?? [];

  if (goal.type === "HUNT_AND_KILL") {
    if (tags.includes("damage")) score += 20;
    if (tags.includes("hunt")) score += 15;
  }

  if (goal.type === "DEFEND_AREA") {
    if (action.type === ACTION_TYPES.GUARD) score += 20;
    if (tags.includes("movement") && tags.includes("engage")) score -= 10;
  }

  if (goal.type === "ESCAPE") {
    if (action.type === ACTION_TYPES.RETREAT) score += 60;
    if (tags.includes("damage")) score -= 25;
  }

  if (goal.type === "PROTECT_ALLY") {
    if (tags.includes("healing")) score += 25;
    if (tags.includes("defense")) score += 15;
  }

  return score;
}

function applyTeamTacticsScore(score, action, actor, world) {
  const actorId = actor?.id ?? actor?._id ?? actor?.name;
  const tactics = world?.teamTactics;
  if (!tactics) return score;

  const role = tactics.rolesByActorId?.[actorId];
  const intent = tactics.teamIntent;
  const tags = action.tags ?? [];

  if (role === "HEALER") {
    if (tags.includes("healing")) score += 35;
    if (tags.includes("damage")) score -= 15;
    if (tags.includes("defense")) score += 10;
  }

  if (role === "CASTER") {
    if (tags.includes("spell")) score += 10;
    if (tags.includes("control")) score += 15;
    if (tags.includes("melee")) score -= 20;
  }

  if (role === "RANGED") {
    if (tags.includes("ranged")) score += 20;
    if (tags.includes("melee")) score -= 15;
  }

  if (role === "SCOUT") {
    if (tags.includes("search")) score += 15;
    if (tags.includes("stealth")) score += 20;
    if (tags.includes("hunt")) score += 15;
  }

  if (role === "FRONTLINE") {
    if (tags.includes("melee")) score += 20;
    if (tags.includes("defense")) score += 8;
  }

  if (intent === "SURVIVE_AND_STABILIZE") {
    if (tags.includes("healing")) score += 40;
    if (tags.includes("defense")) score += 20;
    if (tags.includes("damage")) score -= 10;
  }

  if (intent === "DEFENSIVE_ALERT") {
    if (action.type === ACTION_TYPES.GUARD) score += 25;
    if (tags.includes("search")) score += 20;
    if (tags.includes("hunt")) score -= 10;
  }

  if (intent === "FOCUS_HEALER") {
    if (tactics.enemyHealerIds?.includes(action.targetId)) score += 35;
  }

  if (intent === "PRESSURE_CASTER") {
    if (tactics.enemyCasterIds?.includes(action.targetId)) score += 30;
  }

  return score;
}

function applyClaimScore(score, action, world) {
  if (!action.targetId) return score;

  const claims = countClaimsOnTarget(world, action.targetId);

  if (claims >= 3) score -= 30;
  else if (claims === 2) score -= 18;
  else if (claims === 1) score -= 8;

  return score;
}

export function scoreAiAction(action, actor, world = {}) {
  const p = getAiProfile(actor);
  let score = Number(action.baseScore ?? 0);
  const tags = action.tags ?? [];
  const actorHp = hpPercent(actor);

  if (tags.includes("damage")) {
    score += 25 * p.aggression;
  }

  if (tags.includes("healing")) {
    score += actorHp < 0.35 ? 55 : 10;
    score += 20 * p.support;
  }

  if (tags.includes("defense")) {
    score += actorHp < 0.45 ? 35 : 8;
    score += 20 * p.caution;
  }

  if (tags.includes("hunt") || tags.includes("search")) {
    if (visibleEnemyCount(actor, world) === 0) score += 35;
    score += 15 * p.curiosity;
  }

  if (tags.includes("stealth")) {
    score += actorHp < 0.5 ? 20 : 10;
    score += 10 * p.caution;
  }

  if (action.spell) {
    const ppePercent = resourcePercent(actor, "ppe");
    score -= Number(action.spell.ppeCost ?? action.spell.PPE ?? 0) * (0.4 + p.resourceConservation);
    if (ppePercent < 0.3) score -= 25;
  }

  if (action.psionic) {
    const ispPercent = resourcePercent(actor, "isp");
    score -= Number(action.psionic.isp ?? action.psionic.ISP ?? 0) * (0.3 + p.resourceConservation);
    if (ispPercent < 0.3) score -= 20;
  }

  if (action.requiresRoll) {
    const chance = Number(action.executePayload?.skillPercent ?? 50) / 100;
    score *= 0.6 + chance;
  }

  if (wasUsedRecently(action, actor, world)) {
    if (tags.includes("spell") || tags.includes("psionic")) {
      score -= 45;
    } else if (tags.includes("hunt") || tags.includes("search")) {
      score -= 25;
    } else {
      score -= 20;
    }
  }

  if (actor?.moraleState?.routed || actor?.moraleState?.status === "ROUTED") {
    if (tags.includes("defense") || action.type === ACTION_TYPES.RETREAT) score += 50;
    if (tags.includes("damage")) score -= 35;
  }

  score = applyGoalScore(score, action, actor, world);
  score = applyTeamTacticsScore(score, action, actor, world);
  score = applyClaimScore(score, action, world);

  return Math.round(score);
}

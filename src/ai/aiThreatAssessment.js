function getId(entity) {
  return entity?.id ?? entity?._id ?? entity?.name;
}

function hpPercent(actor) {
  return Number(actor?.currentHP ?? actor?.hp ?? 0) /
    Math.max(1, Number(actor?.maxHP ?? actor?.hp ?? 1));
}

function distanceBetween(a, b) {
  if (!a || !b) return Infinity;

  const ax = Number(a.x ?? 0);
  const az = Number(a.z ?? a.y ?? 0);
  const bx = Number(b.x ?? 0);
  const bz = Number(b.z ?? b.y ?? 0);

  const dx = ax - bx;
  const dz = az - bz;

  return Math.sqrt(dx * dx + dz * dz);
}

function isCaster(target) {
  const occ = String(target?.occ ?? target?.className ?? "").toLowerCase();
  return (
    occ.includes("wizard") ||
    occ.includes("warlock") ||
    occ.includes("priest") ||
    occ.includes("shaman") ||
    occ.includes("druid") ||
    occ.includes("mind")
  );
}

function isHealer(target) {
  const occ = String(target?.occ ?? target?.className ?? "").toLowerCase();
  const skills = [
    ...(target?.skills ?? []),
    ...(target?.occSkills ?? []),
    ...(target?.electiveSkills ?? []),
    ...(target?.secondarySkills ?? []),
  ].map((s) => String(s?.name ?? s).toLowerCase());

  return (
    occ.includes("healer") ||
    skills.some((s) => s.includes("first aid") || s.includes("medical"))
  );
}

function hasRecentDamageOutput(target, world) {
  const targetId = getId(target);
  const recent = world?.recentDamageByActorId?.[targetId] ?? 0;
  return Number(recent);
}

function isObjectiveTarget(target, actor, world) {
  const goal = actor?.aiGoal;
  if (!goal) return world?.teamFocusTargetId === getId(target);

  return (
    goal.targetId === getId(target) ||
    world?.teamFocusTargetId === getId(target)
  );
}

function isThreateningProtectedAlly(target, actor, world) {
  if (actor?.aiGoal?.type !== "PROTECT_ALLY" || !actor.aiGoal.allyId) {
    return false;
  }

  const protectedAlly = (world?.fighters ?? []).find(
    (fighter) => getId(fighter) === actor.aiGoal.allyId
  );
  if (!protectedAlly) return false;

  return distanceBetween(target?.position, protectedAlly.position) <= 10;
}

export function scoreThreatTarget(actor, target, world = {}) {
  const actorId = getId(actor);
  const targetId = getId(target);
  const actorPos = actor?.position ?? world?.positions?.[actorId];
  const targetPos = target?.position ?? world?.positions?.[targetId];

  const dist = distanceBetween(actorPos, targetPos);
  const hp = hpPercent(target);

  let score = 0;

  if (dist <= 5) score += 30;
  else if (dist <= 20) score += 20;
  else if (dist <= 60) score += 10;
  else score -= 10;

  if (hp <= 0.25) score += 35;
  else if (hp <= 0.5) score += 20;
  else if (hp <= 0.75) score += 8;

  if (isCaster(target)) score += 25;
  if (isHealer(target)) score += 20;

  score += Math.min(30, hasRecentDamageOutput(target, world));

  if (isObjectiveTarget(target, actor, world)) score += 40;
  if (isThreateningProtectedAlly(target, actor, world)) score += 35;

  if (target?.moraleState?.routed && hp > 0.5) score -= 15;

  if (target?.isDead || Number(target?.currentHP ?? 1) <= 0) score = -999;

  return Math.round(score);
}

export function rankThreatTargets(actor, targets = [], world = {}) {
  return targets
    .map((target) => ({
      target,
      targetId: getId(target),
      score: scoreThreatTarget(actor, target, world),
    }))
    .sort((a, b) => b.score - a.score);
}

export function getBestThreatTarget(actor, targets = [], world = {}) {
  return rankThreatTargets(actor, targets, world)[0]?.target ?? null;
}

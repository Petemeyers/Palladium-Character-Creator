function getId(entity) {
  return entity?.id ?? entity?._id ?? entity?.name;
}

function getTeamId(actor) {
  return actor?.team ?? actor?.faction ?? actor?.side ?? actor?.type ?? "neutral";
}

function hpPercent(actor) {
  return Number(actor?.currentHP ?? actor?.hp ?? 0) /
    Math.max(1, Number(actor?.maxHP ?? actor?.hp ?? 1));
}

function asSkillText(skill) {
  return String(skill?.name ?? skill).toLowerCase();
}

function getSkills(actor) {
  return [
    ...(actor?.skills ?? []),
    ...(actor?.occSkills ?? []),
    ...(actor?.electiveSkills ?? []),
    ...(actor?.secondarySkills ?? []),
  ].map(asSkillText);
}

function isCaster(actor) {
  const occ = String(actor?.occ ?? actor?.className ?? "").toLowerCase();
  return (
    occ.includes("wizard") ||
    occ.includes("warlock") ||
    occ.includes("priest") ||
    occ.includes("shaman") ||
    occ.includes("druid") ||
    occ.includes("mind")
  );
}

function isHealer(actor) {
  const occ = String(actor?.occ ?? actor?.className ?? "").toLowerCase();
  const skills = getSkills(actor);

  return (
    occ.includes("healer") ||
    skills.some((s) => s.includes("first aid") || s.includes("medical"))
  );
}

function isRanged(actor) {
  const skills = getSkills(actor);

  return (
    actor?.rangedWeapon ||
    skills.some(
      (s) =>
        s.includes("w.p. bow") ||
        s.includes("w.p. crossbow") ||
        s.includes("w.p. sling")
    )
  );
}

function isScout(actor) {
  const skills = getSkills(actor);

  return skills.some(
    (s) =>
      s.includes("track") ||
      s.includes("prowl") ||
      s.includes("detect ambush") ||
      s.includes("identify tracks")
  );
}

export function inferAiRole(actor) {
  if (isHealer(actor)) return "HEALER";
  if (isCaster(actor)) return "CASTER";
  if (isRanged(actor)) return "RANGED";
  if (isScout(actor)) return "SCOUT";
  return "FRONTLINE";
}

export function buildTeamTactics({ actor, fighters = [], world = {} }) {
  const teamId = getTeamId(actor);

  const allies = fighters.filter(
    (f) => getTeamId(f) === teamId && !f.isDead && Number(f.currentHP ?? 1) > 0
  );

  const enemies = fighters.filter(
    (f) => getTeamId(f) !== teamId && !f.isDead && Number(f.currentHP ?? 1) > 0
  );

  const woundedAllies = allies.filter((a) => hpPercent(a) < 0.45);
  const badlyWoundedAllies = allies.filter((a) => hpPercent(a) < 0.25);

  const enemyCasters = enemies.filter(isCaster);
  const enemyHealers = enemies.filter(isHealer);

  let teamIntent = "PRESS_ATTACK";

  if (badlyWoundedAllies.length >= 2) {
    teamIntent = "SURVIVE_AND_STABILIZE";
  } else if (world.flags?.ambushDetected) {
    teamIntent = "DEFENSIVE_ALERT";
  } else if (enemyHealers.length) {
    teamIntent = "FOCUS_HEALER";
  } else if (enemyCasters.length) {
    teamIntent = "PRESSURE_CASTER";
  } else if (woundedAllies.length) {
    teamIntent = "BALANCED";
  }

  const rolesByActorId = {};

  for (const ally of allies) {
    rolesByActorId[getId(ally)] = ally.aiRole ?? inferAiRole(ally);
  }

  return {
    teamId,
    teamIntent,
    rolesByActorId,
    woundedAllyIds: woundedAllies.map(getId),
    badlyWoundedAllyIds: badlyWoundedAllies.map(getId),
    enemyCasterIds: enemyCasters.map(getId),
    enemyHealerIds: enemyHealers.map(getId),
  };
}

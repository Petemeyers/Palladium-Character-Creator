const normalized = (value) => String(value || "").trim().toLowerCase();

export function getCombatActorId(actor = {}) {
  return actor.id ?? actor._id ?? null;
}

export function isSameCombatActor(left, right) {
  const leftId = getCombatActorId(left);
  const rightId = getCombatActorId(right);
  return leftId != null && rightId != null && String(leftId) === String(rightId);
}

export function getCombatActorSide(actor = {}) {
  const value = normalized(
    actor.team ??
    actor.teamId ??
    actor.side ??
    actor.battleSide ??
    actor.armyId ??
    actor.factionId ??
    actor.type,
  );
  if (["party", "player", "players", "ally", "allies"].includes(value)) return "party";
  if (["enemy", "enemies", "hostile", "opponent"].includes(value)) return "enemy";
  return value || "unknown";
}

const shortId = (actor = {}) => {
  const id = String(getCombatActorId(actor) || "");
  if (!id) return "?";
  return id.length <= 8 ? id : id.slice(-8);
};

export function formatCombatActorLabel(actor = {}, { roster = [], counterpart = null } = {}) {
  const name = String(actor.name || actor.displayName || getCombatActorId(actor) || "Unknown");
  const duplicates = (Array.isArray(roster) ? roster : []).filter((candidate) => (
    candidate &&
    !isSameCombatActor(candidate, actor) &&
    normalized(candidate.name || candidate.displayName) === normalized(name)
  ));
  const counterpartDuplicatesName = counterpart &&
    !isSameCombatActor(counterpart, actor) &&
    normalized(counterpart.name || counterpart.displayName) === normalized(name);
  if (duplicates.length === 0 && !counterpartDuplicatesName) return name;

  const side = getCombatActorSide(actor);
  const sameSideDuplicate = duplicates.some((candidate) => getCombatActorSide(candidate) === side) ||
    (counterpartDuplicatesName && getCombatActorSide(counterpart) === side);
  return sameSideDuplicate ? `${name} [${side}/${shortId(actor)}]` : `${name} [${side}]`;
}

export function buildCombatDamageLogEvent({
  actor = {},
  target = {},
  roster = [],
  damage = 0,
  damageType = null,
  hitLocation = null,
  result = "damage-applied",
} = {}) {
  const actorLabel = formatCombatActorLabel(actor, { roster, counterpart: target });
  const targetLabel = formatCombatActorLabel(target, { roster, counterpart: actor });
  const appliedDamage = Math.max(0, Number(damage) || 0);
  return {
    actorId: getCombatActorId(actor),
    actorName: String(actor.name || actor.displayName || "Unknown"),
    actorSide: getCombatActorSide(actor),
    targetId: getCombatActorId(target),
    targetName: String(target.name || target.displayName || "Unknown"),
    targetSide: getCombatActorSide(target),
    damage: appliedDamage,
    damageType,
    hitLocation,
    result,
    message: appliedDamage > 0
      ? `${targetLabel} takes ${appliedDamage} damage from ${actorLabel}.`
      : `${targetLabel} takes no bodily damage from ${actorLabel}.`,
  };
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function disambiguateDuplicateCombatActorNames(message, { roster = [], activeActor = null } = {}) {
  let result = String(message ?? "");
  const groups = new Map();
  (Array.isArray(roster) ? roster : []).forEach((actor) => {
    const name = String(actor?.name || actor?.displayName || "").trim();
    if (!name || getCombatActorId(actor) == null) return;
    const key = normalized(name);
    if (!groups.has(key)) groups.set(key, { name, actors: [] });
    groups.get(key).actors.push(actor);
  });

  groups.forEach(({ name, actors }) => {
    const uniqueIds = new Set(actors.map((actor) => String(getCombatActorId(actor))));
    if (uniqueIds.size < 2 || !result.includes(name)) return;
    const activeMatch = actors.find((actor) => isSameCombatActor(actor, activeActor)) || null;
    const occurrenceCount = result.match(new RegExp(escapeRegExp(name), "g"))?.length || 0;
    if (!activeMatch && occurrenceCount < 2) return;
    const active = activeMatch || actors[0];
    const others = actors.filter((actor) => !isSameCombatActor(actor, active));
    let occurrence = 0;
    result = result.replace(new RegExp(`${escapeRegExp(name)}(?![\\w#-])(?!\\s*\\[)`, "g"), () => {
      const actor = occurrence === 0 ? active : (others[occurrence - 1] || others[0] || active);
      occurrence += 1;
      return formatCombatActorLabel(actor, { roster: actors });
    });
  });
  return result;
}

export default {
  buildCombatDamageLogEvent,
  disambiguateDuplicateCombatActorNames,
  formatCombatActorLabel,
  getCombatActorId,
  getCombatActorSide,
  isSameCombatActor,
};

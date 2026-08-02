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

export const sanitizeCombatActorBaseName = (value) => String(value || "Unknown")
  .replace(/^(?:(?:party|enemy)\s+)+/i, "")
  .replace(/\s+\[(?:party|enemy)(?:\/[^\]]+)?\](?=\s|$)/gi, "")
  .replace(/(?:\s+\d{2}){2,}$/g, "")
  .replace(/\s{2,}/g, " ")
  .trim() || "Unknown";

const undecoratedName = (actor = {}) => sanitizeCombatActorBaseName(String(
  actor.name || actor.displayName || getCombatActorId(actor) || "Unknown",
));

export function getCombatDisplayName(actor = {}) {
  return String(actor.battleLabel || undecoratedName(actor));
}

export function formatCombatActorLabel(actor = {}, { roster = [], counterpart = null } = {}) {
  if (actor.battleLabel) return getCombatDisplayName(actor);
  const name = undecoratedName(actor);
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

export function assignBattleLocalIdentities(actors = []) {
  const roster = Array.isArray(actors) ? actors : [];
  const seenIds = new Map();
  const withUniqueIds = roster.map((actor, index) => {
    const originalId = String(getCombatActorId(actor) || `combat-actor-${index + 1}`);
    const occurrence = (seenIds.get(originalId) || 0) + 1;
    seenIds.set(originalId, occurrence);
    const actorId = occurrence === 1 ? originalId : `${originalId}:battle-${String(occurrence).padStart(2, "0")}`;
    return {
      ...actor,
      id: actorId,
      _id: actorId,
      ...(occurrence > 1 ? { originalCombatId: originalId } : {}),
    };
  });
  const nameTotals = new Map();
  const sideNameTotals = new Map();
  for (const actor of withUniqueIds) {
    const key = normalized(undecoratedName(actor));
    nameTotals.set(key, (nameTotals.get(key) || 0) + 1);
    const sideKey = `${getCombatActorSide(actor)}:${key}`;
    sideNameTotals.set(sideKey, (sideNameTotals.get(sideKey) || 0) + 1);
  }
  const sideNameCounts = new Map();
  return withUniqueIds.map((actor) => {
    const name = undecoratedName(actor);
    const nameKey = normalized(name);
    if ((nameTotals.get(nameKey) || 0) < 2) {
      return { ...actor, battleLabel: name };
    }
    const side = getCombatActorSide(actor);
    const bucket = `${side}:${nameKey}`;
    const sequence = (sideNameCounts.get(bucket) || 0) + 1;
    sideNameCounts.set(bucket, sequence);
    const sideLabel = side === "party" ? "Party" : side === "enemy" ? "Enemy" : side.replace(/^./, (letter) => letter.toUpperCase());
    const needsSameSideOccurrence = (sideNameTotals.get(bucket) || 0) > 1;
    const occurrenceLabel = needsSameSideOccurrence
      ? (/#\d+$/.test(name) ? ` (${sequence})` : ` #${sequence}`)
      : "";
    return { ...actor, battleLabel: `${sideLabel} ${name}${occurrenceLabel}` };
  });
}

export function auditBattleRosterIdentity(actors = []) {
  const roster = Array.isArray(actors) ? actors : [];
  const ids = roster.map(getCombatActorId).filter(Boolean).map(String);
  const labels = roster.map((actor) => String(actor?.battleLabel || "")).filter(Boolean);
  const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
  const duplicateActorIds = duplicates(ids);
  const duplicateBattleLabels = duplicates(labels);
  const identities = Object.freeze(roster.map((actor) => {
    const actorId = getCombatActorId(actor);
    const team = getCombatActorSide(actor);
    const battleLabel = String(actor?.battleLabel || "");
    const expectedSidePrefix = team === "party" ? "Party" : team === "enemy" ? "Enemy" : null;
    const contradictorySideToken = team === "party"
      ? /(?:^|\s)(?:Enemy\b|\[enemy(?:\/[^\]]+)?\])/i.test(battleLabel)
      : team === "enemy"
        ? /(?:^|\s)(?:Party\b|\[party(?:\/[^\]]+)?\])/i.test(battleLabel)
        : false;
    const hasExplicitSidePrefix = /^(?:Party|Enemy)\b/i.test(battleLabel);
    const sideMatchesTeam = !contradictorySideToken && (
      !hasExplicitSidePrefix || !expectedSidePrefix || battleLabel.startsWith(`${expectedSidePrefix} `)
    );
    return Object.freeze({ actorId, team, battleLabel, expectedSidePrefix, sideMatchesTeam });
  }));
  const sideMatches = identities.every((identity) => identity.sideMatchesTeam);
  return Object.freeze({
    actorCount: roster.length,
    uniqueActorIdCount: new Set(ids).size,
    uniqueBattleLabelCount: new Set(labels).size,
    duplicateActorIds,
    duplicateBattleLabels,
    identities,
    sideMatches,
    matches: ids.length === roster.length && labels.length === roster.length && duplicateActorIds.length === 0 && duplicateBattleLabels.length === 0 && sideMatches,
  });
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
    if (actors.some((actor) => actor?.battleLabel && result.includes(getCombatDisplayName(actor)))) return;
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
  assignBattleLocalIdentities,
  auditBattleRosterIdentity,
  buildCombatDamageLogEvent,
  disambiguateDuplicateCombatActorNames,
  formatCombatActorLabel,
  getCombatDisplayName,
  getCombatActorId,
  getCombatActorSide,
  isSameCombatActor,
};

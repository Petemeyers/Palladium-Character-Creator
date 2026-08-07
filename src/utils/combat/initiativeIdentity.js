import { getCombatDisplayName } from "../combatActorIdentity.js";

const actorIdOf = (actor = {}) => String(actor.id ?? actor._id ?? actor.actorId ?? "");

const canonicalTeam = (actor = {}) => {
  const team = String(actor.team ?? actor.battleSide ?? actor.side ?? "").toLowerCase();
  if (["party", "player", "ally", "allied"].includes(team)) return "party";
  if (["enemy", "opponent", "hostile"].includes(team)) return "enemy";
  const type = String(actor.type ?? "").toLowerCase();
  if (type === "player") return "party";
  if (type === "enemy") return "enemy";
  return team || type || "neutral";
};

export function resolveCombatantDisplayIdentity(actorId, roster = []) {
  const stableId = String(actorId ?? "");
  const actor = (Array.isArray(roster) ? roster : []).find(
    (candidate) => actorIdOf(candidate) === stableId,
  );
  const baseName = String(actor?.baseName ?? actor?.name ?? stableId ?? "Unknown").replace(
    /\s+\[(?:party|enemy|neutral)\]\s*$/i,
    "",
  );
  const team = canonicalTeam(actor);
  const type = String(actor?.type ?? team);
  const sideLabel = team === "party" ? "party" : team === "enemy" ? "enemy" : team;
  return Object.freeze({
    actorId: stableId,
    baseName,
    displayName: actor?.battleLabel ? getCombatDisplayName(actor) : `${baseName} [${sideLabel}]`,
    team,
    type,
    sideLabel,
  });
}

export function buildInitiativePresentation(ordered = [], roster = ordered, {
  initiativeRound = 1,
  source = "round-start",
} = {}) {
  const eligible = ordered.filter((fighter) => fighter.initiativeEligible);
  const results = eligible.map((fighter, index) => {
    const actorId = actorIdOf(fighter);
    const identity = resolveCombatantDisplayIdentity(actorId, roster);
    return Object.freeze({
      eventType: "round-initiative-rolled",
      actorId,
      actorName: identity.baseName,
      name: identity.displayName,
      displayName: identity.displayName,
      team: identity.team,
      type: identity.type,
      initiativeRound,
      initiativeRoll: fighter.initiativeRoll,
      initiativeBonus: fighter.initiativeBreakdown?.total ?? 0,
      initiativeTotal: fighter.initiativeTotal,
      initiativeTieBreaker: fighter.initiativeTieBreaker,
      initiativeRank: index + 1,
      source,
    });
  });
  const tieGroups = new Map();
  results.forEach((result) => {
    const group = tieGroups.get(result.initiativeTotal) || [];
    group.push(result);
    tieGroups.set(result.initiativeTotal, group);
  });
  const ties = [...tieGroups.entries()]
    .filter(([, participants]) => participants.length > 1)
    .map(([tiedTotal, participants]) => Object.freeze({
      eventType: "round-initiative-tie-resolved",
      initiativeRound,
      tiedTotal,
      participants: Object.freeze(participants.map(({ actorId, initiativeTieBreaker }) =>
        Object.freeze({ actorId, tieBreaker: initiativeTieBreaker }))),
      winnerActorId: participants[0].actorId,
      fallbackSource: participants.every(
        (entry) => entry.initiativeTieBreaker === participants[0].initiativeTieBreaker,
      ) ? "stable-actor-id" : "tie-break-roll",
    }));
  const summary = results.length
    ? results.map((result) =>
        `${result.initiativeRank}. ${result.displayName} — ${result.initiativeTotal}`).join("\n")
    : "No combatants are eligible to act.";
  return Object.freeze({
    initiativeRound,
    results: Object.freeze(results),
    ties: Object.freeze(ties),
    summary,
    firstRankedActorId: results[0]?.actorId ?? null,
  });
}

export function auditInitiativeSchedulerAgreement({
  initiativeRound,
  firstRankedActorId,
  scheduledActorId,
} = {}) {
  return Object.freeze({
    eventType: "initiative-order-scheduler-audit",
    initiativeRound,
    firstRankedActorId: firstRankedActorId ?? null,
    scheduledActorId: scheduledActorId ?? null,
    matches: Boolean(firstRankedActorId && firstRankedActorId === scheduledActorId),
  });
}

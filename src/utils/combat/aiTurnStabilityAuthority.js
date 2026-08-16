export const AI_TURN_STABILITY_AUTHORITY_ID = "ai-turn-stability-v1";

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

function normalizeCoordinateValue(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

export function buildPlayerAiProgressCoordinate(snapshot = {}) {
  return {
    initiativeTurnId: normalizeCoordinateValue(snapshot.initiativeTurnId),
    round: normalizeCoordinateValue(snapshot.round),
    turnCounter: normalizeCoordinateValue(snapshot.turnCounter),
    turnIndex: normalizeCoordinateValue(snapshot.turnIndex),
    activeActorId: normalizeCoordinateValue(snapshot.activeActorId),
  };
}

function compareCoordinateField(before, after, field, reasons) {
  const left = before[field];
  const right = after[field];
  if (left === null || right === null || left === right) return;
  reasons.push(`${field}-changed`);
}

/**
 * Distinguishes a genuine same-turn progress observation from an observation
 * that crossed an initiative/round boundary while awaiting asynchronous AI
 * work. A superseded observation must never trigger zero-progress recovery for
 * the old invocation.
 */
export function classifyPlayerAiProgressObservation(beforeSnapshot = {}, afterSnapshot = {}) {
  const before = buildPlayerAiProgressCoordinate(beforeSnapshot);
  const after = buildPlayerAiProgressCoordinate(afterSnapshot);
  const reasons = [];

  compareCoordinateField(before, after, "initiativeTurnId", reasons);
  compareCoordinateField(before, after, "round", reasons);
  compareCoordinateField(before, after, "turnCounter", reasons);
  compareCoordinateField(before, after, "turnIndex", reasons);
  compareCoordinateField(before, after, "activeActorId", reasons);

  const superseded = reasons.length > 0;
  return {
    classification: superseded ? "superseded-turn" : "same-turn",
    superseded,
    sameTurn: !superseded,
    reasons,
    before,
    after,
  };
}

function combatantId(combatant) {
  return firstDefined(combatant?.id, combatant?.actorId, combatant?.combatantId, combatant?.generationActorId);
}

function combatantSide(combatant) {
  return firstDefined(
    combatant?.team,
    combatant?.side,
    combatant?.battleSide,
    combatant?.factionId,
    combatant?.faction,
  );
}

export function isActiveFormationCombatant(combatant) {
  if (!combatant || typeof combatant !== "object") return false;
  if (
    combatant.active === false ||
    combatant.inCombat === false ||
    combatant.removedFromCombat === true ||
    combatant.fled === true ||
    combatant.hasFled === true ||
    combatant.dead === true ||
    combatant.isDead === true ||
    combatant.defeated === true ||
    combatant.surrendered === true ||
    combatant.unconscious === true ||
    combatant.isUnconscious === true
  ) return false;
  return true;
}

export function hasActiveFormationAlly(actor, combatants = [], areAllies = null) {
  if (!actor || !Array.isArray(combatants)) return false;
  const actorId = combatantId(actor);
  const actorSide = combatantSide(actor);

  return combatants.some((candidate) => {
    if (!candidate || candidate === actor || !isActiveFormationCombatant(candidate)) return false;
    const candidateId = combatantId(candidate);
    if (actorId !== undefined && actorId !== null && candidateId !== undefined && candidateId !== null && String(actorId) === String(candidateId)) {
      return false;
    }
    if (typeof areAllies === "function") return areAllies(actor, candidate) === true;
    const candidateSide = combatantSide(candidate);
    return actorSide !== undefined && actorSide !== null && candidateSide !== undefined && candidateSide !== null && String(actorSide) === String(candidateSide);
  });
}

/**
 * AI-only tactical viability filter. It does not redefine formation command
 * legality; it prevents automated selection of Rally Formation when there is
 * nobody else on the actor's side to rally with. Manual command options remain
 * governed by formationCommandAuthority.
 */
export function filterAutomatedFormationOptionsForViability({
  actor,
  combatants = [],
  options = [],
  areAllies = null,
} = {}) {
  if (!Array.isArray(options) || options.length === 0) return [];
  if (hasActiveFormationAlly(actor, combatants, areAllies)) return [...options];
  return options.filter((option) => String(option?.id ?? "") !== "rally-formation");
}

const finiteInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};

export function createInitiativeCoordinate({
  generationId,
  combatSession = generationId,
  round,
  initiativeIndex,
  turnCounter,
  actorId,
  initiativeTurnId = null,
} = {}) {
  return Object.freeze({
    generationId: generationId ?? combatSession ?? null,
    combatSession: combatSession ?? generationId ?? null,
    round: finiteInteger(round),
    initiativeIndex: finiteInteger(initiativeIndex),
    turnCounter: finiteInteger(turnCounter),
    actorId: actorId ?? null,
    initiativeTurnId: initiativeTurnId ?? null,
  });
}

export function compareInitiativeCoordinates(candidateInput, authoritativeInput) {
  const candidate = createInitiativeCoordinate(candidateInput);
  const authoritative = createInitiativeCoordinate(authoritativeInput);
  const valid = (coordinate) => (
    coordinate.generationId != null &&
    coordinate.combatSession != null &&
    coordinate.round != null &&
    coordinate.initiativeIndex != null &&
    coordinate.turnCounter != null &&
    coordinate.actorId != null
  );
  if (!valid(candidate) || !valid(authoritative)) return "invalid";
  if (
    candidate.generationId !== authoritative.generationId ||
    candidate.combatSession !== authoritative.combatSession
  ) {
    return "different-generation";
  }
  if (
    candidate.round === authoritative.round &&
    candidate.initiativeIndex === authoritative.initiativeIndex &&
    candidate.turnCounter === authoritative.turnCounter &&
    candidate.actorId === authoritative.actorId
  ) {
    return "same";
  }
  if (candidate.turnCounter !== authoritative.turnCounter) {
    return candidate.turnCounter > authoritative.turnCounter ? "newer" : "older";
  }
  if (candidate.round !== authoritative.round) {
    return candidate.round > authoritative.round ? "newer" : "older";
  }
  if (candidate.initiativeIndex !== authoritative.initiativeIndex) {
    return candidate.initiativeIndex > authoritative.initiativeIndex ? "newer" : "older";
  }
  return "invalid";
}

export function admitInitiativeCoordinate(candidate, authoritative, {
  allowNewer = false,
} = {}) {
  const comparison = compareInitiativeCoordinates(candidate, authoritative);
  return Object.freeze({
    accepted: comparison === "same" || (allowNewer && comparison === "newer"),
    comparison,
    candidate: createInitiativeCoordinate(candidate),
    authoritative: createInitiativeCoordinate(authoritative),
  });
}


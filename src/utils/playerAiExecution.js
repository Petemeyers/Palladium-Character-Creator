export function createPlayerAiExecutionOwnership({
  combatSession,
  generation,
  fighterId,
  turnIndex,
  meleeRound,
  turnCounter,
  turnToken,
  playerAiToken,
  reason = "scheduled-player-ai",
  startedAt = Date.now(),
  timeoutMs = 8000,
} = {}) {
  const executionKey = [
    combatSession ?? "session",
    generation ?? "generation",
    fighterId ?? "fighter",
    turnIndex ?? "index",
    meleeRound ?? "round",
    turnCounter ?? "turn",
    turnToken ?? "token",
    playerAiToken ?? "ai-token",
  ].join("|");
  const safeTimeoutMs = Math.max(1, Number(timeoutMs) || 8000);
  return {
    executionKey,
    fighterId: fighterId ?? null,
    turnIndex: Number.isInteger(turnIndex) ? turnIndex : null,
    meleeRound: Number.isFinite(Number(meleeRound)) ? Number(meleeRound) : null,
    turnCounter: Number.isFinite(Number(turnCounter)) ? Number(turnCounter) : null,
    turnToken: turnToken ?? null,
    playerAiToken: playerAiToken ?? null,
    reason,
    startedAt,
    deadline: startedAt + safeTimeoutMs,
  };
}

export function doesPlayerAiExecutionOwnTurn(ownership, current = {}) {
  if (!ownership?.executionKey || ownership.fighterId !== current?.fighterId) return false;
  if (current.turnIndex != null && ownership.turnIndex !== current.turnIndex) return false;
  if (current.meleeRound != null && ownership.meleeRound !== current.meleeRound) return false;
  if (current.turnCounter != null && ownership.turnCounter !== current.turnCounter) return false;
  if (current.turnToken != null && ownership.turnToken !== current.turnToken) return false;
  if (current.playerAiToken != null && ownership.playerAiToken !== current.playerAiToken) return false;
  return true;
}

export function shouldPlayerAiExecutionWatchdogFire(ownership, current, now = Date.now()) {
  return doesPlayerAiExecutionOwnTurn(ownership, current) && now >= ownership.deadline;
}

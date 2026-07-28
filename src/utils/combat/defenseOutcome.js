export const DEFENSE_OUTCOMES = Object.freeze({
  FAILED: "parry_failed",
  NEUTRAL: "parry_neutral",
  ADVANTAGE: "parry_advantage",
  DOMINANT: "parry_dominant",
});

const TERMINAL_STATES = new Set([
  "dead",
  "unconscious",
  "defeated",
  "surrendered",
  "captured",
  "removed",
]);

const getCanonicalHp = (fighter) => Number(
  fighter?.currentHP ??
  fighter?.currentHp ??
  fighter?.hp ??
  fighter?.derivedStats?.hp ??
  Number.POSITIVE_INFINITY
);

const isTerminalFighter = (fighter) => {
  const status = String(
    fighter?.status ||
    fighter?.combatStatus ||
    fighter?.surrenderState ||
    "",
  ).toLowerCase();
  return (
    !fighter ||
    getCanonicalHp(fighter) <= 0 ||
    fighter.isConscious === false ||
    fighter.conscious === false ||
    fighter.isDefeated === true ||
    fighter.defeated === true ||
    fighter.surrendered === true ||
    TERMINAL_STATES.has(status)
  );
};

const finiteTotal = (value, label) => {
  const total = Number(value);
  if (!Number.isFinite(total)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return total;
};

export function calculateDefenseMargin({ attackTotal, defenseTotal } = {}) {
  return finiteTotal(defenseTotal, "defenseTotal") - finiteTotal(attackTotal, "attackTotal");
}

export function getParryOutcomeForMargin(defenseMargin) {
  const margin = finiteTotal(defenseMargin, "defenseMargin");
  if (margin < 0) return DEFENSE_OUTCOMES.FAILED;
  if (margin < 5) return DEFENSE_OUTCOMES.NEUTRAL;
  if (margin < 10) return DEFENSE_OUTCOMES.ADVANTAGE;
  return DEFENSE_OUTCOMES.DOMINANT;
}

export function shouldTransferTempo({
  outcome,
  attackType = "melee",
  defenseType = "weapon",
  isProjectile = false,
  isGrappling = false,
} = {}) {
  if (![DEFENSE_OUTCOMES.ADVANTAGE, DEFENSE_OUTCOMES.DOMINANT].includes(outcome)) return false;
  if (isProjectile || isGrappling) return false;
  if (String(attackType).toLowerCase() !== "melee") return false;
  return ["weapon", "shield", "block", "parry"].includes(String(defenseType).toLowerCase());
}

export function classifyParryOutcome({
  attackTotal,
  defenseTotal,
  attackNaturalRoll = null,
  defenseNaturalRoll = null,
  canonicalSuccess,
  promoteSuccessfulNaturalTwenty = false,
  attackType = "melee",
  defenseType = "weapon",
  attackerId = null,
  defenderId = null,
  isProjectile = false,
  isGrappling = false,
} = {}) {
  const finalAttackTotal = finiteTotal(attackTotal, "attackTotal");
  const finalDefenseTotal = finiteTotal(defenseTotal, "defenseTotal");
  const defenseMargin = calculateDefenseMargin({
    attackTotal: finalAttackTotal,
    defenseTotal: finalDefenseTotal,
  });
  const success = typeof canonicalSuccess === "boolean"
    ? canonicalSuccess
    : defenseMargin >= 0;
  let outcome = success
    ? getParryOutcomeForMargin(defenseMargin)
    : DEFENSE_OUTCOMES.FAILED;

  // This is deliberately opt-in: the caller remains the authority for existing
  // natural-roll rules and must first declare the defense successful.
  if (
    success &&
    promoteSuccessfulNaturalTwenty &&
    Number(defenseNaturalRoll) === 20
  ) {
    outcome = DEFENSE_OUTCOMES.DOMINANT;
  }

  const tempoTransfer = shouldTransferTempo({
    outcome,
    attackType,
    defenseType,
    isProjectile,
    isGrappling,
  });
  const openingLevel = tempoTransfer
    ? outcome === DEFENSE_OUTCOMES.DOMINANT ? 2 : 1
    : 0;

  return Object.freeze({
    attempted: true,
    success,
    attackTotal: finalAttackTotal,
    defenseTotal: finalDefenseTotal,
    defenseMargin,
    attackNaturalRoll: attackNaturalRoll != null && Number.isFinite(Number(attackNaturalRoll))
      ? Number(attackNaturalRoll)
      : null,
    defenseNaturalRoll: defenseNaturalRoll != null && Number.isFinite(Number(defenseNaturalRoll))
      ? Number(defenseNaturalRoll)
      : null,
    defenseType,
    outcome,
    tempoTransfer,
    tempoOwnerId: tempoTransfer ? defenderId : outcome === DEFENSE_OUTCOMES.FAILED ? attackerId : null,
    openingLevel,
  });
}

export function buildExchangeState({
  result,
  generationId,
  round,
  actionSequence,
  attackExecutionKey,
  attackerId,
  defenderId,
  reactionDepth = 0,
} = {}) {
  if (!result || !attackExecutionKey || !attackerId || !defenderId) {
    throw new TypeError("A canonical result and complete exchange identity are required");
  }
  const canonicalRound = finiteTotal(round, "round");
  const canonicalSequence = finiteTotal(actionSequence, "actionSequence");
  const exchange = {
    exchangeId: `${attackExecutionKey}:defense`,
    attackExecutionKey,
    generationId,
    round: canonicalRound,
    attackerId,
    defenderId,
    tempoOwnerId: result.tempoOwnerId,
    openingAgainstId: result.openingLevel > 0 ? attackerId : null,
    openingLevel: result.openingLevel,
    parryOutcome: result.outcome,
    defenseMargin: result.defenseMargin,
    reactionDepth: Math.max(0, Number(reactionDepth) || 0),
    createdAtActionSequence: canonicalSequence,
    consumed: false,
  };
  return Object.freeze(exchange);
}

export function getExchangePairKey(attackerId, defenderId) {
  return [String(attackerId), String(defenderId)].sort().join("::");
}

export function registerExchangeState(registry, exchange) {
  if (!(registry instanceof Map) || !exchange) return null;
  registry.set(getExchangePairKey(exchange.attackerId, exchange.defenderId), exchange);
  return exchange;
}

export function clearExchangeStatesForActor(registry, actorId) {
  if (!(registry instanceof Map) || !actorId) return 0;
  let cleared = 0;
  for (const [key, exchange] of registry.entries()) {
    if (exchange.attackerId !== actorId && exchange.defenderId !== actorId) continue;
    registry.delete(key);
    cleared += 1;
  }
  return cleared;
}

export function clearInvalidExchangeStates(registry, {
  generationId,
  round,
  combatActive = true,
  fighters = [],
} = {}) {
  if (!(registry instanceof Map)) return 0;
  const byId = new Map(fighters.map((fighter) => [fighter?.id, fighter]));
  let cleared = 0;
  for (const [key, exchange] of registry.entries()) {
    const attacker = byId.get(exchange.attackerId);
    const defender = byId.get(exchange.defenderId);
    const invalidPosture = (fighter) => (
      fighter.isProne === true ||
      fighter.knockedDown === true ||
      ["prone", "collapsed"].includes(String(fighter.positionState || "").toLowerCase())
    );
    const grappling = Boolean(
      attacker?.grappleState?.opponent ||
      attacker?.grappleState?.opponentId ||
      defender?.grappleState?.opponent ||
      defender?.grappleState?.opponentId
    );
    if (
      !combatActive ||
      exchange.generationId !== generationId ||
      exchange.round !== Number(round) ||
      isTerminalFighter(attacker) ||
      isTerminalFighter(defender) ||
      invalidPosture(attacker) ||
      invalidPosture(defender) ||
      grappling
    ) {
      registry.delete(key);
      cleared += 1;
    }
  }
  return cleared;
}

export function isExchangeAdmissionCurrent({
  combatActive,
  expectedGenerationId,
  currentGenerationId,
  expectedRound,
  currentRound,
  expectedExecutionKey,
  currentExecutionKey,
  attacker,
  defender,
} = {}) {
  if (!combatActive) return false;
  if (expectedGenerationId !== currentGenerationId) return false;
  if (Number(expectedRound) !== Number(currentRound)) return false;
  if (!expectedExecutionKey || expectedExecutionKey !== currentExecutionKey) return false;
  if (!attacker?.id || !defender?.id) return false;
  if (isTerminalFighter(attacker) || isTerminalFighter(defender)) return false;
  return true;
}

export function getDefenseOutcomeMessage({
  defenderName = "Defender",
  attackerName = "attacker",
  defenseType = "weapon",
  result,
} = {}) {
  if (!result) return "";
  const type = String(defenseType).toLowerCase();
  if (!result.success) {
    if (type === "dodge" || type === "evade" || type === "move") {
      return `${defenderName} fails to evade ${attackerName}'s attack.`;
    }
    return `${defenderName}'s defense fails against ${attackerName}.`;
  }
  if (type === "dodge" || type === "evade" || type === "move") {
    return `${defenderName} evades ${attackerName}'s attack.`;
  }
  const shield = type === "shield";
  if (result.outcome === DEFENSE_OUTCOMES.DOMINANT) {
    return shield
      ? `${defenderName} drives the attack offline and leaves ${attackerName} badly exposed.`
      : `${defenderName} dominates the bind and leaves ${attackerName} exposed.`;
  }
  if (result.outcome === DEFENSE_OUTCOMES.ADVANTAGE) {
    return shield
      ? `${defenderName} turns the blow aside and gains the tempo.`
      : `${defenderName} redirects the attack and takes control of the exchange.`;
  }
  return shield
    ? `${defenderName} catches the blow on the shield.`
    : `${defenderName} catches the attack on the weapon.`;
}

export function buildDefenseResolutionEvent({
  result,
  attackExecutionKey,
  attackerId,
  defenderId,
  defenseType,
  tempoBefore = null,
  exchange = null,
} = {}) {
  return Object.freeze({
    eventType: "defense_resolution",
    attackExecutionKey,
    attackerId,
    defenderId,
    attackTotal: result.attackTotal,
    defenseTotal: result.defenseTotal,
    defenseMargin: result.defenseMargin,
    attackNaturalRoll: result.attackNaturalRoll,
    defenseNaturalRoll: result.defenseNaturalRoll,
    defenseType,
    outcome: result.outcome,
    tempoBefore,
    tempoAfter: exchange?.tempoOwnerId ?? result.tempoOwnerId,
    openingLevel: exchange?.openingLevel ?? result.openingLevel,
  });
}

export function resolveCanonicalDefenseExchange({
  registry,
  admission,
  attackTotal,
  defenseTotal,
  attackNaturalRoll = null,
  defenseNaturalRoll = null,
  canonicalSuccess,
  attackType = "melee",
  defenseType = "weapon",
  isProjectile = false,
  isGrappling = false,
  actionSequence,
  defenderName,
  attackerName,
  reactionDepth = 0,
} = {}) {
  if (!isExchangeAdmissionCurrent(admission)) {
    return Object.freeze({ accepted: false, reason: "stale-defense-admission" });
  }
  const attackerId = admission.attacker.id;
  const defenderId = admission.defender.id;
  const result = classifyParryOutcome({
    attackTotal,
    defenseTotal,
    attackNaturalRoll,
    defenseNaturalRoll,
    canonicalSuccess,
    attackType,
    defenseType,
    attackerId,
    defenderId,
    isProjectile,
    isGrappling,
  });
  const pairKey = getExchangePairKey(attackerId, defenderId);
  const tempoBefore = registry?.get(pairKey)?.tempoOwnerId ?? null;
  const exchange = buildExchangeState({
    result,
    generationId: admission.expectedGenerationId,
    round: admission.expectedRound,
    actionSequence,
    attackExecutionKey: admission.expectedExecutionKey,
    attackerId,
    defenderId,
    reactionDepth,
  });
  registerExchangeState(registry, exchange);
  return Object.freeze({
    accepted: true,
    result,
    exchange,
    developerEvent: buildDefenseResolutionEvent({
      result,
      attackExecutionKey: admission.expectedExecutionKey,
      attackerId,
      defenderId,
      defenseType,
      tempoBefore,
      exchange,
    }),
    playerMessage: getDefenseOutcomeMessage({
      defenderName,
      attackerName,
      defenseType,
      result,
    }),
  });
}

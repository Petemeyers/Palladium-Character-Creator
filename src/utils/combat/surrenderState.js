export const SURRENDER_STATES = Object.freeze({
  NONE: "none",
  OFFERED: "offered",
  ACCEPTED: "accepted",
  REFUSED: "refused",
  CAPTURED: "captured",
  RELEASED: "released",
  EXECUTED: "executed",
});

const VALID_STATES = new Set(Object.values(SURRENDER_STATES));

export function normalizeSurrenderState(fighter = {}) {
  const raw = fighter?.surrenderState;
  const status = typeof raw === "string" ? raw : raw?.status;
  return {
    ...(raw && typeof raw === "object" ? raw : {}),
    status: VALID_STATES.has(status) ? status : SURRENDER_STATES.NONE,
  };
}

const includesText = (values, pattern) => values.some((value) => pattern.test(String(value || "").toLowerCase()));

export function scoreSurrenderResponse({
  responder = {},
  surrenderingFighter = {},
  orders = responder.orders,
  prisonerValue = 0,
  guardsPresent = 0,
  alliesPresent = 0,
  enemiesRemaining = 1,
  witnessesPresent = 0,
} = {}) {
  const alignment = String(responder.alignment || responder.behaviorProfile?.alignment || "neutral").toLowerCase();
  const traits = [
    ...(Array.isArray(responder.traits) ? responder.traits : []),
    ...(Array.isArray(responder.tags) ? responder.tags : []),
    responder.behaviorProfile?.mercy,
  ];
  const orderText = String(orders || "").toLowerCase();
  const scores = { accept: 10, refuse: 8, capture: 8, release: 3, execute: 1 };

  // Alignment is one bounded preference among several; it never forces an outcome.
  if (/good|honorable|lawful/.test(alignment)) { scores.accept += 3; scores.capture += 2; scores.execute -= 2; }
  if (/evil|cruel|chaotic/.test(alignment)) { scores.refuse += 2; scores.execute += 3; scores.accept -= 1; }
  if (includesText(traits, /merciful|honorable|chival/)) { scores.accept += 5; scores.release += 2; }
  if (includesText(traits, /cruel|bloodthirst|no quarter/)) { scores.execute += 6; scores.refuse += 3; }
  if (/capture|prisoner|ransom/.test(orderText)) { scores.capture += 8; scores.accept += 3; }
  if (/no quarter|execute|kill/.test(orderText)) { scores.execute += 9; scores.accept -= 4; }
  scores.capture += Math.max(0, Number(prisonerValue) || 0);
  scores.capture += Math.max(0, Number(guardsPresent) || 0) * 2;
  scores.accept += Math.max(0, Number(alliesPresent) || 0);
  scores.refuse += Math.max(0, Number(enemiesRemaining) - 1);
  scores.accept += Math.max(0, Number(witnessesPresent) || 0);
  if (surrenderingFighter?.isDead || surrenderingFighter?.isUnconscious) scores.accept = -Infinity;

  const preference = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || "refuse";
  return { scores, preference, factors: { alignment, orders: orderText, prisonerValue, guardsPresent, alliesPresent, enemiesRemaining, witnessesPresent } };
}

export function offerSurrender(fighter = {}, { offeredToId = null, actionToken = null, reason = null } = {}) {
  return {
    ...fighter,
    surrenderState: {
      ...normalizeSurrenderState(fighter),
      status: SURRENDER_STATES.OFFERED,
      offeredToId,
      actionToken,
      reason,
    },
  };
}

export function offerRoutedExhaustedCowerSurrender(fighter = {}, { offeredToId = null, actionToken = null } = {}) {
  const offered = offerSurrender(fighter, {
    offeredToId,
    actionToken,
    reason: "routed-exhausted-cower",
  });
  return {
    ...offered,
    canAct: false,
    remainingActions: 0,
    attacksRemaining: 0,
    moraleState: {
      ...(fighter.moraleState || {}),
      status: "ROUTED",
      hasFled: false,
      survivalIntent: "cower",
      terminalReason: null,
    },
  };
}

export function isPendingSurrenderResolution(fighter = {}) {
  return normalizeSurrenderState(fighter).status === SURRENDER_STATES.OFFERED;
}

export function shouldDeferCombatEndForSurrender({ pendingSurrenders = [], resistingFighters = [], victors = [] } = {}) {
  return pendingSurrenders.length > 0 && resistingFighters.length === 0 && victors.length > 0;
}

export function scoreSurrenderTreatment(context = {}) {
  const scored = scoreSurrenderResponse(context);
  const scores = {
    "take-prisoner": scored.scores.capture + 2,
    ransom: scored.scores.capture + Math.max(0, Number(context.prisonerValue) || 0),
    "confiscate-and-capture": scored.scores.capture + (/capture|confiscate/.test(String(context.orders || "").toLowerCase()) ? 3 : 0),
    "disarm-and-release": scored.scores.release + scored.scores.accept,
    "refuse-surrender": scored.scores.refuse,
    execute: scored.scores.execute,
  };
  const treatment = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || "refuse-surrender";
  return { ...scored, treatment, treatmentScores: scores };
}

export function applySurrenderResponse(fighter = {}, response = SURRENDER_STATES.REFUSED, metadata = {}) {
  const status = VALID_STATES.has(response) ? response : SURRENDER_STATES.REFUSED;
  const accepted = [SURRENDER_STATES.ACCEPTED, SURRENDER_STATES.CAPTURED].includes(status);
  const refused = status === SURRENDER_STATES.REFUSED;
  return {
    ...fighter,
    ...(accepted ? { canAct: false, remainingActions: 0, attacksRemaining: 0, defeated: true, status: "defeated" } : {}),
    ...(refused ? { canAct: true, active: true, isActive: true } : {}),
    // Surrender is a participation state, never an HP or consciousness mutation.
    surrenderState: { ...normalizeSurrenderState(fighter), ...metadata, status },
  };
}

export function isSurrenderedForCombat(fighter = {}) {
  return [SURRENDER_STATES.ACCEPTED, SURRENDER_STATES.CAPTURED, SURRENDER_STATES.EXECUTED]
    .includes(normalizeSurrenderState(fighter).status);
}

export default { SURRENDER_STATES, applySurrenderResponse, isPendingSurrenderResolution, isSurrenderedForCombat, normalizeSurrenderState, offerRoutedExhaustedCowerSurrender, offerSurrender, scoreSurrenderResponse, scoreSurrenderTreatment, shouldDeferCombatEndForSurrender };

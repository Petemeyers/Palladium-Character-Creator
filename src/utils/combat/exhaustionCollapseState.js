export const GROUND_CONTROL_STATES = Object.freeze({
  NEUTRAL: "neutral",
  ADVANTAGE: "advantage",
  DOMINANT: "dominant",
  PINNED: "pinned",
});

const VALID_GROUND_CONTROL_STATES = new Set(Object.values(GROUND_CONTROL_STATES));

const fighterId = (fighter) => fighter?.id ?? fighter?._id ?? null;
const grappleOpponentId = (fighter) => fighter?.grappleState?.opponent ?? fighter?.grappleState?.opponentId ?? null;

export function normalizeGroundControlState(value = null) {
  const candidate = typeof value === "string" ? value : value?.state;
  return VALID_GROUND_CONTROL_STATES.has(candidate) ? candidate : GROUND_CONTROL_STATES.NEUTRAL;
}

export function hasSufficientGroundControl(fighter = {}, opponent = {}) {
  const control = fighter?.grappleState?.groundControl;
  const state = normalizeGroundControlState(control);
  return grappleOpponentId(fighter) === fighterId(opponent) &&
    control?.controllerId === fighterId(fighter) &&
    (state === GROUND_CONTROL_STATES.DOMINANT || state === GROUND_CONTROL_STATES.PINNED);
}

export function advanceGroundControl(fighter = {}, opponent = {}, metadata = {}) {
  const existing = fighter?.grappleState?.groundControl || opponent?.grappleState?.groundControl || {};
  const ownsControl = existing.controllerId === fighterId(fighter);
  const current = ownsControl ? normalizeGroundControlState(existing) : GROUND_CONTROL_STATES.NEUTRAL;
  const nextState = current === GROUND_CONTROL_STATES.NEUTRAL
    ? GROUND_CONTROL_STATES.ADVANTAGE
    : current === GROUND_CONTROL_STATES.ADVANTAGE
      ? GROUND_CONTROL_STATES.DOMINANT
      : GROUND_CONTROL_STATES.PINNED;
  const groundControl = Object.freeze({
    ...existing,
    ...metadata,
    state: nextState,
    controllerId: fighterId(fighter),
    controlledId: fighterId(opponent),
  });
  return {
    groundControl,
    fighter: { ...fighter, grappleState: { ...(fighter.grappleState || {}), positionState: "ground", groundControl } },
    opponent: { ...opponent, grappleState: { ...(opponent.grappleState || {}), positionState: "ground", groundControl } },
  };
}

export function applyGroundedGrappleHoldAndRest(fighter = {}, opponent = {}, { recovery = 1 } = {}) {
  const active = grappleOpponentId(fighter) === fighterId(opponent) &&
    [fighter?.grappleState?.positionState, opponent?.grappleState?.positionState]
      .some((state) => ["ground", "grounded"].includes(String(state || "").toLowerCase()));
  if (!active) return { ok: false, reason: "hold-and-rest-requires-grounded-grapple", fighter, opponent };
  const amount = Math.max(0, Number(recovery) || 0);
  const fatigueState = fighter.fatigueState
    ? { ...fighter.fatigueState, currentStamina: Number(fighter.fatigueState.currentStamina || 0) + amount }
    : fighter.fatigueState;
  return {
    ok: true,
    recovery: amount,
    fighter: {
      ...fighter,
      ...(Object.prototype.hasOwnProperty.call(fighter, "currentStamina")
        ? { currentStamina: Number(fighter.currentStamina || 0) + amount }
        : {}),
      fatigueState,
    },
    opponent,
    grapplePreserved: true,
    collapseCleared: false,
  };
}

export function isConsciousExhaustionCollapse(fighter = {}) {
  const hp = Number(fighter.currentHP ?? fighter.hp ?? fighter.HP ?? 0);
  const status = String(fighter.status || "").toLowerCase();
  const surrender = String(fighter.surrenderState?.status || "none").toLowerCase();
  return fighter.fatigueState?.status === "collapsed" &&
    hp > 0 && fighter.isDead !== true && fighter.dead !== true &&
    fighter.isUnconscious !== true && fighter.unconscious !== true &&
    !["dead", "unconscious", "dying"].includes(status) &&
    !["accepted", "captured", "executed"].includes(surrender);
}

export function applyAuthoritativeExhaustionCollapse({
  fighters = [],
  fighterId: collapsedFighterId,
  currentStamina,
  collapseRoundsRemaining = 0,
  round = null,
  turn = null,
  reason = "conscious-exhaustion-collapse",
} = {}) {
  const roster = Array.isArray(fighters) ? fighters : [];
  const collapsed = roster.find((fighter) => fighterId(fighter) === collapsedFighterId);
  if (!collapsed) return { ok: false, reason: "collapsed-fighter-not-found", fighters: roster };

  const hp = Number(collapsed.currentHP ?? collapsed.hp ?? collapsed.HP ?? 0);
  if (hp <= 0 || collapsed.isDead === true || collapsed.isUnconscious === true) {
    return { ok: false, reason: "collapse-fighter-terminal", fighters: roster };
  }

  const opponentId = grappleOpponentId(collapsed);
  const opponent = opponentId ? roster.find((fighter) => fighterId(fighter) === opponentId) : null;
  const reciprocal = opponent && grappleOpponentId(opponent) === collapsedFighterId;
  const activeStandingGrapple = Boolean(
    reciprocal &&
    String(collapsed.grappleState?.state || "neutral") !== "neutral" &&
    String(opponent.grappleState?.state || "neutral") !== "neutral" &&
    !["ground", "grounded"].includes(String(collapsed.grappleState?.positionState || "").toLowerCase())
  );
  const groundControl = activeStandingGrapple
    ? Object.freeze({
        state: GROUND_CONTROL_STATES.DOMINANT,
        controllerId: fighterId(opponent),
        controlledId: collapsedFighterId,
        reason,
        round,
        turn,
      })
    : null;

  const next = roster.map((fighter) => {
    const id = fighterId(fighter);
    if (id === collapsedFighterId) {
      return {
        ...fighter,
        canAct: false,
        remainingActions: 0,
        attacksRemaining: 0,
        prone: true,
        isProne: true,
        collapsed: true,
        collapseState: { conscious: true, reason, round, turn },
        fatigueState: {
          ...(fighter.fatigueState || {}),
          status: "collapsed",
          currentStamina,
          collapseRoundsRemaining,
          penalties: { attack: -5, block: -5, evade: -5, ps: 0, speed: 0 },
        },
        ...(groundControl ? {
          grappleState: {
            ...(fighter.grappleState || {}),
            positionState: "ground",
            groundControl,
          },
        } : {}),
      };
    }
    if (groundControl && id === fighterId(opponent)) {
      return {
        ...fighter,
        grappleState: {
          ...(fighter.grappleState || {}),
          positionState: "ground",
          groundControl,
        },
      };
    }
    return fighter;
  });

  return {
    ok: true,
    fighters: next,
    collapsedFighterId,
    conscious: true,
    combatTerminal: false,
    activeGrapplePreserved: activeStandingGrapple,
    opponentId: opponent ? fighterId(opponent) : null,
    groundControl,
  };
}

export default {
  GROUND_CONTROL_STATES,
  advanceGroundControl,
  applyGroundedGrappleHoldAndRest,
  applyAuthoritativeExhaustionCollapse,
  hasSufficientGroundControl,
  isConsciousExhaustionCollapse,
  normalizeGroundControlState,
};

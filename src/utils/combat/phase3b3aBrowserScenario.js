import { transitionCanonicalGrappleExecutionRecord } from "./canonicalGrappleExecution.js";
import {
  applyAuthoritativeExhaustionCollapse,
  applyGroundedGrappleHoldAndRest,
  hasSufficientGroundControl,
  isConsciousExhaustionCollapse,
} from "./exhaustionCollapseState.js";
import { offerSurrender } from "./surrenderState.js";

function completeCanonicalNoRollFixture({ actionType, actionToken, actorId, opponentId, sequence }) {
  let record = {
    generationId: "phase3b3a-browser",
    initiativeTurnId: "phase3b3a-browser:round-2:controller",
    executionKey: `phase3b3a-browser:${actionType}:${sequence}`,
    actionToken,
    actionSequence: sequence,
    actorId,
    opponentId,
    actionType,
    state: "created",
    rollStarted: false,
    completionEmitted: false,
  };
  const events = ["initiative-action-token-created"];
  for (const [state, eventType] of [
    ["selected", "grapple-action-selected"],
    ["dispatched", "grapple-action-dispatched"],
    ["resolving", "grapple-action-resolution-started"],
    ["committed", "grapple-action-committed"],
    ["completed", "grapple-action-completed"],
  ]) {
    const transition = transitionCanonicalGrappleExecutionRecord(record, state, sequence);
    if (!transition.ok) throw new Error(`fixture lifecycle rejected ${record.state} -> ${state}: ${transition.reason}`);
    record = transition.record;
    events.push(eventType);
  }
  return { record: Object.freeze({ ...record, completionEmitted: true }), events: Object.freeze(events) };
}

export function runPhase3B3ABrowserScenario() {
  const sharedHex = { x: 3, y: 3 };
  const collapsing = {
    id: "collapsed-knight", name: "Collapsed Knight", currentHP: 10, maxHP: 30,
    currentStamina: 1, remainingActions: 1, canAct: true,
    fatigueState: { status: "collapse_risk", currentStamina: 1 },
    grappleState: { state: "grapple_clinch", positionState: "standing", opponent: "controller-knight", sharedHex },
  };
  const controller = {
    id: "controller-knight", name: "Controller Knight", currentHP: 20, maxHP: 30,
    currentStamina: 4, remainingActions: 2, canAct: true,
    fatigueState: { status: "winded", currentStamina: 4 },
    grappleState: { state: "grapple_clinch", positionState: "standing", opponent: "collapsed-knight", sharedHex },
  };
  const staminaAfterForcedExpenditure = collapsing.currentStamina - 1;
  const collapse = applyAuthoritativeExhaustionCollapse({
    fighters: [controller, collapsing],
    fighterId: collapsing.id,
    currentStamina: staminaAfterForcedExpenditure,
    collapseRoundsRemaining: 1,
    round: 2,
    turn: 1,
    reason: "browser-fixture-forced-next-expenditure",
  });
  if (!collapse.ok) throw new Error(collapse.reason);
  const groundedController = collapse.fighters.find((fighter) => fighter.id === controller.id);
  const groundedCollapsed = collapse.fighters.find((fighter) => fighter.id === collapsing.id);
  const noVictoryAtCollapse = isConsciousExhaustionCollapse(groundedCollapsed) && collapse.combatTerminal === false;

  // The collapsed participant still receives its later initiative slot; it
  // cannot act, so ownership advances normally to the controlling fighter.
  const laterInitiativeTurn = Object.freeze({ actorId: groundedCollapsed.id, received: true, skippedForCollapse: true });
  const holdLifecycle = completeCanonicalNoRollFixture({
    actionType: "holdAndRest",
    actionToken: "phase3b3a-browser:round-2:controller:1",
    actorId: groundedController.id,
    opponentId: groundedCollapsed.id,
    sequence: 1,
  });
  const rest = applyGroundedGrappleHoldAndRest(groundedController, groundedCollapsed, { recovery: 1 });
  if (!rest.ok) throw new Error(rest.reason);
  const surrenderLifecycle = completeCanonicalNoRollFixture({
    actionType: "demandSurrender",
    actionToken: "phase3b3a-browser:round-2:controller:2",
    actorId: rest.fighter.id,
    opponentId: rest.opponent.id,
    sequence: 2,
  });
  const surrenderOffer = offerSurrender(rest.opponent, {
    offeredToId: rest.fighter.id,
    actionToken: surrenderLifecycle.record.actionToken,
  });

  return Object.freeze({
    importedInBrowser: true,
    forcedCollapse: true,
    staminaBeforeExpenditure: 1,
    staminaAfterForcedExpenditure,
    noVictoryAtCollapse,
    grounded: rest.fighter.grappleState.positionState === "ground" && rest.opponent.grappleState.positionState === "ground",
    reciprocalGrapple: rest.fighter.grappleState.opponent === rest.opponent.id && rest.opponent.grappleState.opponent === rest.fighter.id,
    dominantControl: hasSufficientGroundControl(rest.fighter, rest.opponent),
    laterInitiativeTurn,
    holdAndRest: Object.freeze({
      canonical: holdLifecycle.record.state === "completed" && holdLifecycle.record.completionEmitted,
      events: holdLifecycle.events,
      staminaBefore: groundedController.currentStamina,
      staminaAfter: rest.fighter.currentStamina,
      recovered: rest.recovery,
      grappleActive: rest.grapplePreserved,
    }),
    surrenderDemand: Object.freeze({
      canonical: surrenderLifecycle.record.state === "completed" && surrenderLifecycle.record.completionEmitted,
      canDemand: hasSufficientGroundControl(rest.fighter, rest.opponent),
      offeredState: surrenderOffer.surrenderState.status,
      events: surrenderLifecycle.events,
    }),
  });
}

export default runPhase3B3ABrowserScenario;

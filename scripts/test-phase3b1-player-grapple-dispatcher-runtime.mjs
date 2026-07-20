import assert from "node:assert/strict";
import { createServer } from "vite";

import { normalizePlayerGrappleDispatcherContext } from "../src/utils/ai/playerGrappleDispatcher.js";

const vite = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const { runPlayerTurnAI } = await vite.ssrLoadModule("/src/utils/ai/playerTurnAI.js");
  const player = {
    id: "player-knight",
    name: "Player Knight",
    type: "player",
    team: "party",
    currentHP: 30,
    maxHP: 30,
    remainingActions: 2,
    grappleState: { state: "ground", opponent: "enemy-knight", hasGrappleAdvantage: true },
  };
  const opponent = {
    id: "enemy-knight",
    name: "Enemy Knight",
    type: "enemy",
    team: "enemy",
    currentHP: 30,
    maxHP: 30,
    remainingActions: 2,
    grappleState: { state: "grappled", opponent: "player-knight" },
  };
  const fighters = [player, opponent];
  const positions = {
    [player.id]: { x: 0, y: 0 },
    [opponent.id]: { x: 0, y: 0 },
  };
  const events = [];
  const dispatchAdmissions = [];
  let rolls = 0;
  let completed = 0;

  const addLog = (entry) => {
    if (entry && typeof entry === "object" && entry.eventType) events.push(entry);
  };
  const dispatchGrappleTurnAction = (actor, target, actionType, _plan, admission) => {
    dispatchAdmissions.push(admission);
    events.push({ eventType: "player-grapple-dispatcher-action-entry", data: {
      dispatcherPresent: true,
      continuationAuthorizationPresent: Boolean(admission?.continuationAuthorization),
    } });
    events.push({ eventType: "grapple-action-selected" });
    events.push({ eventType: "grapple-action-dispatched" });
    events.push({ eventType: "grapple-action-resolution-started" });
    events.push({ eventType: "grapple-action-roll-claimed" });
    rolls += 1;
    events.push({ eventType: "grapple-roll" });
    completed += 1;
    events.push({ eventType: "grapple-action-completed" });
    actor.remainingActions -= 1;
    return {
      accepted: true,
      completed: true,
      handled: true,
      terminal: true,
      actionSpent: true,
      remainingActions: actor.remainingActions,
      actionType,
      reason: "fixture-grapple-completed",
    };
  };

  const ref = (current) => ({ current });
  const noop = () => false;
  const baseContext = {
    actorId: player.id,
    fighters,
    positions,
    combatActive: true,
    aiControlEnabled: true,
    meleeRound: 4,
    turnCounter: 8,
    initiativeTurnId: "initiative-player-4",
    currentTurnToken: "turn-token-4",
    combatSession: "combat-session-1",
    dispatcherChain: { outerDispatcherPresent: true },
    dispatchGrappleTurnAction,
    addLog,
    canFighterAct: () => true,
    getHPStatus: () => ({ description: "ready" }),
    scheduleEndTurn: noop,
    calculateDistance: () => 0,
    calculateTargetPriority: () => 1,
    canAISeeTarget: () => true,
    canSelectHostileTarget: (actor, target) => actor.team !== target.team,
    getEquistaminadWeapons: () => [
      { id: "dagger", name: "Dagger", type: "melee", damage: "1d4" },
      { id: "shortbow", name: "Shortbow", type: "ranged", range: 80 },
    ],
    getFighterTechniques: () => [],
    getFighterTacticalPowers: () => [],
    getFighterstamina: () => 10,
    getFighterfocus: () => 0,
    getFighterHP: (fighter) => fighter.currentHP,
    getFighterMaxHP: (fighter) => fighter.maxHP,
    processingPlayerAIRef: ref(true),
    playerAIActionScheduledRef: ref(false),
    pendingTurnAdvanceRef: ref(false),
    turnActionResolvingRef: ref(false),
    aiControlEnabledRef: ref(true),
    combatActiveRef: ref(true),
    combatOverRef: ref(false),
    fightersRef: ref(fighters),
    positionsRef: ref(positions),
    turnIndexRef: ref(0),
    visibilityLogRef: ref(new Set()),
    movementAttemptsRef: ref(new Map()),
    playerAIRecentlyUsedTacticsRef: ref(new Map()),
    activePlayerAITurnKeysRef: ref(new Set()),
    techniqueAttemptBudgetRef: ref(new Map()),
    activeTechniqueImpactRef: ref(null),
    activeTacticalImpactRef: ref(null),
    currentTurnTokenRef: ref("turn-token-4"),
    combatSessionRef: ref("combat-session-1"),
    playerAITurnTokenRef: ref(1),
    playerAITurnToken: 1,
    turnCounterRef: ref(8),
    sceneContext: { sceneType: "combat", relations: {} },
    GRID_CONFIG: { CELL_SIZE: 5 },
    MOVEMENT_RATES: {},
    MOVEMENT_ACTIONS: {},
    setFighters: noop,
    setPositions: noop,
    autoEquipWeapons: (fighter) => fighter,
    isTargetBlocked: noop,
    getBlockingCombatant: () => null,
    findFlankingPositions: () => [],
    calculateFlankingBonus: () => 0,
    validateWeaponRange: () => true,
    isHexOccupied: noop,
    getTargetsInLine: () => [],
    isOffensiveTechnique: noop,
    isHealingTechnique: noop,
    getTechniqueCost: () => 0,
    getTechniqueHealingFormula: () => null,
    getTacticalCost: () => 0,
    getTacticalTargetCategory: () => null,
    parseRangeToFeet: () => 0,
    getTechniqueRangeInFeet: () => 0,
    techniqueCanAffectTarget: () => false,
    getWeaponRange: () => 5,
    getWeaponType: () => "melee",
    getWeaponLength: () => 1,
    MIN_COMBAT_HP: -20,
  };

  const freshContext = normalizePlayerGrappleDispatcherContext(baseContext);
  events.push({ eventType: "player-grapple-dispatcher-ai-entry", data: { dispatcherPresent: true } });
  events.push({ eventType: "player-grapple-dispatcher-normalized", data: {
    dispatcherPresent: typeof freshContext.dispatchGrappleTurnAction === "function",
  } });
  const freshResult = await runPlayerTurnAI(player, freshContext);

  assert.equal(freshResult.terminal, true);
  assert.equal(player.remainingActions, 1);
  assert.equal(dispatchAdmissions.length, 1);
  assert.equal(dispatchAdmissions[0].continuationAuthorization, null);
  assert.equal(dispatchAdmissions[0].source, "player-ai-active-grapple");
  assert.deepEqual(dispatchAdmissions[0].dispatcherChain, {
    outerDispatcherPresent: true,
    normalizedDispatcherPresent: true,
    runPlayerDispatcherPresent: true,
    routeDispatcherPresent: true,
  });
  assert.equal(events.filter((event) => event.eventType === "player-grapple-dispatcher-route-entry").length, 1);
  assert.equal(events.filter((event) => event.eventType === "player-grapple-dispatcher-action-entry").length, 1);
  assert.equal(events.filter((event) => event.eventType === "grapple-dispatch-required-but-missing").length, 0);
  assert.equal(events.filter((event) => event.eventType === "player-ai-zero-progress-action-detected").length, 0);

  const continuationAuthorization = {
    continuationKey: "continuation-player-4-2",
    initiativeTurnId: "initiative-player-4",
    actorId: player.id,
    opponentId: opponent.id,
    actionSequence: 2,
  };
  const continuationContext = normalizePlayerGrappleDispatcherContext({
    ...baseContext,
    continuationKey: continuationAuthorization.continuationKey,
    continuationAuthorization,
    actionToken: "initiative-player-4:2",
  });
  continuationContext.processingPlayerAIRef.current = true;
  continuationContext.playerAIActionScheduledRef.current = false;
  const continuationResult = await runPlayerTurnAI(player, continuationContext);

  assert.equal(continuationResult.terminal, true);
  assert.equal(player.remainingActions, 0);
  assert.equal(dispatchAdmissions.length, 2);
  assert.equal(dispatchAdmissions[1].continuationAuthorization, continuationAuthorization);
  assert.equal(dispatchAdmissions[1].source, "remaining-action-continuation");
  assert.equal(rolls, 2, "fresh and continuation actions must each roll exactly once");
  assert.equal(completed, 2, "fresh and continuation actions must each complete exactly once");
  assert.equal(events.filter((event) => event.eventType === "grapple-dispatch-required-but-missing").length, 0);
  assert.equal(events.filter((event) => event.eventType === "player-ai-zero-progress-action-detected").length, 0);

  console.log("✅ Phase 3B1 player grapple dispatcher fresh/continuation runtime tests passed");
} finally {
  await vite.close();
}

/**
 * Player Turn AI Module
 *
 * Handles AI decision-making for player characters during combat.
 * This is a pure function module - no React hooks or state management.
 * All state updates are done via callbacks passed in the context.
 */

import { isBleeding } from "../bleedingSystem.js";
import { canFly, isFlying, getAltitude } from "../abilitySystem";
import { formatAttacksRemaining } from "../actionEconomy.js";
import {
  canThreatenWithMelee,
  canThreatenWithMeleeWithWeapon,
  markTargetUnreachable,
  isTargetUnreachable,
  clearUnreachableTarget,
  getReachableEnemies,
  hasAnyValidOffensiveOption,
  hasAnyRangedOptionAgainstFlying,
} from "./meleeReachabilityHelpers";
import { findNearbyCorpse, scavengeCorpse } from "../scavengingSystem";
import { findFoodItem, consumeItem } from "../consumptionSystem";
import {
  chooseBestOffensiveTactical,
  chooseBestHealingTactical,
} from "../tacticalDecisionHelpers";
import {
  canTargetForAction,
  isAllyOf,
} from "../factionDisposition.js";
import {
  getPreferredEngagementRange,
} from "../grapplingSystem.js";
import {
  getMeleeEngagementContext,
  selectMeleeAttackForContext,
} from "../meleeEngagementContext.js";
import { assessGrappleSizeOutcome } from "../sizeStrengthModifiers.js";
import { getPlayerAiProfessionText } from "../playerAiProfileText.js";
import { createPlayerAiActionResult } from "../playerAiTurnResult.js";
import { getPlayerAiContinuationBlockReason } from "../playerAiContinuation.js";
import { formatCombatActorLabel, isSameCombatActor } from "../combatActorIdentity.js";
import { formatCombatWeaponAvailability } from "../combatWeaponAvailability.js";
import { resolveArmoredCombatAction } from "./resolveArmoredCombatAction.js";
import { resolveGrappleTurnAction } from "./resolveGrappleTurnAction.js";

const DEFEATED_KEYWORDS = [
  "vampire",
  "mummy",
  "skeleton",
  "zombie",
  "ghoul",
  "wraith",
  "wight",
  "lich",
  "spectre",
  "ghost",
];

function isFallenUnit(unit) {
  const label = (
    unit?.species ||
    unit?.race ||
    unit?.type ||
    unit?.name ||
    ""
  ).toLowerCase();

  if (!label) return false;
  return DEFEATED_KEYWORDS.some((w) => label.includes(w));
}

// Fallen combatant detection for routing immunity
function isFallenCombatant(fighter) {
  const name = (fighter.name || fighter.displayName || "").toLowerCase();
  const type = (fighter.type || fighter.combatantType || "").toLowerCase();

  const fallenKeywords = [
    "fallen",
    "vampire",
    "mummy",
    "zombie",
    "skeleton",
    "ghoul",
    "wight",
    "wraith",
    "lich",
    "ghost",
    "spectre",
  ];

  return fallenKeywords.some((k) => name.includes(k) || type.includes(k));
}

function isConcealedFighter(fighter) {
  return Boolean(
    fighter?.hidden || fighter?.isProwling || fighter?.prowlState?.hidden
  );
}

function stripConcealment(fighter, reason = "movement") {
  if (!fighter || !isConcealedFighter(fighter)) return fighter;
  return {
    ...fighter,
    hidden: false,
    isProwling: false,
    prowlState: {
      ...(fighter.prowlState || {}),
      hidden: false,
      prowlSuccess: false,
      brokenBy: reason,
    },
  };
}

function revealAfterObviousMovement(fighter, setFighters, addLog, detail = "moving") {
  if (!isConcealedFighter(fighter) || typeof setFighters !== "function") return false;
  setFighters((prev) =>
    prev.map((f) => (f.id === fighter.id ? stripConcealment(f, "movement") : f))
  );
  addLog?.(
    `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${fighter.name} reveals ${fighter.type === "enemy" ? "its" : "their"} position by ${detail}.`,
    "info"
  );
  return true;
}

// --- Alignment / archetype helpers for healer AI ---

function getAlignmentTextForAI(fighter = {}) {
  const alignment =
    fighter.alignmentName ||
    fighter.alignment ||
    fighter.alignmentText ||
    fighter.alignmentDescription ||
    "";
  return String(alignment).toLowerCase();
}

function isGoodAlignedForAI(fighter = {}) {
  const text = getAlignmentTextForAI(fighter);
  if (!text) return false;

  // Medieval Combat Simulator "good" family: Principled, Scrupulous, etc.
  return (
    text.includes("good") ||
    text.includes("principled") ||
    text.includes("scrupulous")
  );
}

// Healer PROFESSION detection based on rulebook PROFESSION list (Clergy)
function isHealerProfessionForAI(fighter = {}) {
  if (!fighter) return false;

  const professionText = getPlayerAiProfessionText(fighter);

  // Map directly to PROFESSIONs you defined in professionData.js (category: "Clergy")
  // Priest, PriestOfLight, PriestOfDarkness, Healer, Druid, Shaman
  const healerPatterns = [
    "priest of light",
    "priest of darkness",
    "priest", // generic priest PROFESSION
    "healer",
    "druid",
    "shaman",
  ];

  return healerPatterns.some((pattern) => professionText.includes(pattern));
}

// Healer archetype detection
function isHealerArchetype(player) {
  const rawProfession =
    player.professionId ||
    player.profession ||
    player.PROFESSION ||
    player.classId ||
    player.className ||
    player.professionName ||
    player.archetype ||
    "";

  const profession = String(rawProfession).toLowerCase();

  // Core Medieval Combat Simulator healer-ish PROFESSIONs
  const healerKeywords = [
    "priest of light",
    "priest of darkness",
    "priest",
    "healer",
    "druid",
    "shaman",
    "cleric",
    "paladin",
    "monk",
  ];

  if (healerKeywords.some((k) => profession.includes(k))) {
    return true;
  }

  // Fallback: look at technique list ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ a character with multiple healing techniques
  // is probably a healer in practice.
  if (Array.isArray(player.techniques)) {
    const healingLike = player.techniques.filter((s) => {
      const n = (s.name || "").toLowerCase();
      return (
        n.includes("heal") ||
        n.includes("healing") ||
        n.includes("restoration") ||
        n.includes("regeneration") ||
        n.includes("cure")
      );
    });
    if (healingLike.length >= 2) return true;
  }

  return false;
}

// Good alignment detection
function isGoodAlignmentForHealer(player) {
  const raw =
    player.alignment || player.alignmentName || player.alignmentShort || "";

  if (!raw) return false;

  const a = raw.toLowerCase();

  // Obviously evil tags first
  if (
    a.includes("diabolic") ||
    a.includes("miscreant") ||
    a.includes("aberrant")
  ) {
    return false;
  }

  // Basic good/selfish-but-not-horrible
  if (
    a.includes("good") ||
    a.includes("scrupulous") ||
    a.includes("principled")
  ) {
    return true;
  }

  return false;
}

// Find ally needing healing
function findAllyNeedingHealing(
  player,
  fighters,
  getFighterHP,
  getFighterMaxHP,
  { criticalOnly = false, sceneContext = { sceneType: "combat", relations: {} } } = {}
) {
  // We consider "allies" to be other fighters on the same side.
  const allies = fighters.filter(
    (f) =>
      f.id !== player.id &&
      !f.isDead &&
      !f.isDying &&
      isAllyOf(player, f, sceneContext)
  );

  let best = null;
  let lowestRatio = 1;

  for (const ally of allies) {
    const currentHP = getFighterHP(ally);
    const maxHP = getFighterMaxHP(ally) || 1;
    if (!maxHP || currentHP <= 0) continue;

    const ratio = currentHP / maxHP;

    // Skip healthy-ish allies if we're only looking for critical patients
    if (criticalOnly && ratio > 0.5) continue;

    // Only heal if actually injured
    if (ratio >= 0.95) continue;

    if (!best || ratio < lowestRatio) {
      lowestRatio = ratio;
      best = ally;
    }
  }

  return best;
}

// Check if in serious melee trouble
function isInSeriousMeleeTrouble(
  player,
  enemies,
  positions,
  calculateDistance,
  getFighterHP,
  getFighterMaxHP
) {
  const currentHP = getFighterHP(player);
  const maxHP = getFighterMaxHP(player) || 1;
  const hpRatio = maxHP ? currentHP / maxHP : 1;

  const playerPos = positions[player.id];
  if (!playerPos) return false;

  const adjacentEnemies = enemies.filter((e) => {
    const enemyPos = positions[e.id];
    if (!enemyPos) return false;
    const dist = calculateDistance(playerPos, enemyPos);
    return dist <= 5; // 5ft = adjacent hex
  });

  return hpRatio < 0.4 && adjacentEnemies.length >= 1;
}

// Rough "outmatched" check: badly hurt vs fairly healthy enemy
function isOutmatchedForAI(attacker, target, getFighterHP, getFighterMaxHP) {
  if (!attacker || !target) return false;
  const aHp = getFighterHP(attacker);
  const aMax = getFighterMaxHP(attacker) || 1;
  const tHp = getFighterHP(target);
  const tMax = getFighterMaxHP(target) || 1;

  const aRatio = aHp / aMax;
  const tRatio = tHp / tMax;

  // Outmatched if healer <35% HP and enemy >50% HP
  return aRatio < 0.35 && tRatio > 0.5;
}

// Very lightweight technique/tactical classifiers for "escape" options.
// We keep this intentionally fuzzy; it will only trigger if such powers exist.
function isPotentialEscapeTechnique(technique = {}) {
  const name = (technique.name || "").toLowerCase();
  const text = (
    technique.effect ||
    technique.description ||
    technique.summary ||
    ""
  ).toLowerCase();

  const escapeKeywords = [
    "teleport",
    "teleportation",
    "dimension door",
    "dimensional portal",
    "fly",
    "levitate",
    "levitation",
    "invisibility",
    "become mist",
    "turn invisible",
    "ethereal",
    "phase",
    "wall of",
    "fraidere field",
    "fraiderefield",
  ];

  return escapeKeywords.some((kw) => name.includes(kw) || text.includes(kw));
}

function isPotentialEscapeTactical(power = {}) {
  const name = (power.name || "").toLowerCase();
  const text = (power.effect || power.description || "").toLowerCase();

  const escapeKeywords = [
    "teleport",
    "levitate",
    "levitation",
    "float",
    "invisibility",
    "invisible",
    "ethereal",
    "phase",
    "become mist",
    "escape",
  ];

  return escapeKeywords.some((kw) => name.includes(kw) || text.includes(kw));
}

// Try to escape if a good healer is outmatched in melee
async function attemptEscapeIfOutmatched({
  player,
  target,
  positions,
  escapeTechniques,
  escapeTactics,
  focusAvailable,
  staminaAvailable,
  addLog,
  processingPlayerAIRef,
  calculateDistance,
  executeTacticalPower,
  startTechniqueAttempt,
}) {
  if (!player || !target) return false;
  if (!positions[player.id] || !positions[target.id]) return false;

  // Only consider "directly attacked in melee" when adjacent
  const distanceFeet = calculateDistance(
    positions[player.id],
    positions[target.id]
  );
  const inMelee = distanceFeet <= 5.5;
  if (!inMelee) return false;

  // If we don't have any escape tools, bail out
  const hasEscapeTools =
    (escapeTechniques && escapeTechniques.length > 0) ||
    (escapeTactics && escapeTactics.length > 0);
  if (!hasEscapeTools) return false;

  // We don't decide *here* if we're outmatched; caller passes that info
  // If caller says "try to escape", we burn the first escape tool that fits.

  // Prefer tactical escape (usually cheaper / instant)
  if (escapeTactics && escapeTactics.length > 0) {
    const power =
      escapeTactics.find((p) => (p.focus || p.focus || 0) <= focusAvailable) ||
      escapeTactics[0];
    if (power) {
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  ${player.name} is outmatched in melee and tries to escape with tactical ${power.name}!`,
        "info"
      );
      try {
        const tacticalResult = await executeTacticalPower(player, player, power);
        const usedTactical = tacticalResult === true || tacticalResult?.ok === true;
        if (usedTactical) {
          processingPlayerAIRef.current = false;
          return true;
        }
      } catch (err) {
        addLog?.(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} failed to use tactical escape: ${err?.message || String(err)}`,
          "warning"
        );
      }
    }
  }

  // Fallback: escape-type technique
  if (escapeTechniques && escapeTechniques.length > 0) {
    const technique =
      escapeTechniques.find(
        (s) => (s.cost ?? s.stamina ?? s.stamina ?? 0) <= staminaAvailable
      ) || escapeTechniques[0];

    if (technique) {
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${player.name} is outmatched in melee and tries to escape with technique ${technique.name}!`,
        "info"
      );
      if (await startTechniqueAttempt?.({ technique, techniqueTarget: player })) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Run player turn AI
 * @param {Object} player - The player fighter object
 * @param {Object} context - Context object containing all necessary dependencies
 */
export async function runPlayerTurnAI(player, context) {
  const {
    fighters,
    positions,
    combatTerrain,
    arenaEnvironment,
    meleeRound,
    turnCounter,
    combatActive,
    aiControlEnabled, // Whether AI control is enabled (vs manual control)
    // Core helpers
    canFighterAct,
    getHPStatus,
    addLog,
    scheduleEndTurn,
    // Distance & movement
    calculateDistance,
    isTargetBlocked,
    getBlockingCombatant,
    calculateTargetPriority,
    findFlankingPositions,
    calculateFlankingBonus,
    validateWeaponRange,
    isHexOccupied,
    handlePositionChange,
    getEquistaminadWeapons,
    findRetreatDestination,
    // Visibility / fog
    fogEnabled,
    visibleCells,
    canAISeeTarget,
    visibilityLogRef,
    // Training / tactics
    getFighterTechniques,
    getFighterTacticalPowers,
    getFighterstamina,
    getFighterfocus,
    // Attack & combat
    attack,
    createAttackActionGrant,
    createAttackExecutionKey,
    clearPlayerAIContinuationAttack,
    claimPlayerAIContinuation,
    completePlayerAIContinuation,
    createFiredActionContinuationReceipt,
    dispatchGrappleTurnAction,
    recoverMissingPlayerGrappleDispatcher,
    setPositions,
    setFighters,
    commitPlayerAIPosition,
    positionsRef,
    movementAttemptsRef,
    playerAIRecentlyUsedTacticsRef,
    fightersRef,
    processingPlayerAIRef,
    // Player AI async guardrails (optional, provided by CombatPage)
    playerAIActionScheduledRef,
    playerAITurnTokenRef,
    playerAITurnToken,
    techniqueAttemptBudgetRef,
    pendingTurnAdvanceRef,
    turnActionResolvingRef,
    aiControlEnabledRef,
    activePlayerAITurnKeysRef,
    combatActiveRef,
    combatOverRef,
    combatSessionRef,
    combatSession,
    currentTurnTokenRef,
    currentTurnToken,
    turnIndexRef,
    // Technique/power utilities
    isOffensiveTechnique,
    isHealingTechnique,
    getTechniqueCost,
    getTechniqueHealingFormula,
    getTacticalCost,
    getTacticalTargetCategory,
    parseRangeToFeet,
    getTechniqueRangeInFeet,
    techniqueCanAffectTarget,
    executeTechnique,
    executeTacticalPower,
    activeTechniqueImpactRef,
    activeTacticalImpactRef,
    turnCounterRef,
    // Weapon utilities
    getWeaponRange,
    getWeaponType,
    getWeaponLength,
    autoEquipWeapons,
    // Constants
    MIN_COMBAT_HP,
    getFighterHP,
    getFighterMaxHP,
    GRID_CONFIG,
    MOVEMENT_RATES,
    MOVEMENT_ACTIONS,
    getHexNeighbors,
    isValidPosition,
    findBeePath,
    getTargetsInLine,
    canSelectHostileTarget,
    clearSeparatedGrapple,
    canFinalizeTurn,
    onNoHostilesRemaining,
    sceneContext = { sceneType: "combat", relations: {} },
  } = context;

  const continuationKey = context.continuationKey || null;
  const continuationAuthorization = context.continuationAuthorization || null;

  if (continuationAuthorization) {
    addLog?.({
      audience: "developer",
      channel: "turn",
      eventType: "action-continuation-receipt-hop",
      level: "info",
      type: "debug",
      actorId: continuationAuthorization.actorId,
      source: "run-player-turn-ai",
      message: `action continuation receipt hop: stage=player-action-route continuationKey=${continuationAuthorization.continuationKey}`,
      data: {
        stage: "player-action-route",
        continuationId: continuationAuthorization.continuationId || continuationAuthorization.authorizationId || null,
        continuationKey: continuationAuthorization.continuationKey,
        initiativeTurnId: continuationAuthorization.initiativeTurnId,
        actorId: continuationAuthorization.actorId,
        receiptState: continuationAuthorization.state,
        completedActionType: continuationAuthorization.completedActionType,
        completedActionSequence: continuationAuthorization.completedActionSequence,
        nextActionSequence: continuationAuthorization.nextActionSequence,
        requestedActionSequence: continuationAuthorization.nextActionSequence,
        consumingActionType: null,
        consumingActionToken: null,
      },
    }, "debug");
  }

  addLog?.(`runPlayerTurnAI entered fighter=${player?.name || "unknown"}`, "info");

  const isHostileTarget = (target, actionKind = "attack") => {
    if (!target || isSameCombatActor(player, target)) return false;
    return actionKind === "attack" && typeof canSelectHostileTarget === "function"
      ? canSelectHostileTarget(player, target, sceneContext)
      : canTargetForAction(player, target, actionKind, sceneContext);
  };
  const isAllyTarget = (target) => isAllyOf(player, target, sceneContext);

  const isPlayerAiAllowed = () => {
    if (aiControlEnabledRef && aiControlEnabledRef.current !== true) return false;
    if (aiControlEnabled !== true) return false;
    if (pendingTurnAdvanceRef?.current) return false;
    if (activeTechniqueImpactRef?.current || activeTacticalImpactRef?.current) return false;
    if (!tokenStillValid()) return false;
    return true;
  };
  const tokenStillValid = () => {
    if (!playerAITurnTokenRef || !playerAITurnToken) return true;
    if (playerAITurnTokenRef.current !== playerAITurnToken) return false;
    if (combatSessionRef && combatSession != null && combatSessionRef.current !== combatSession) return false;
    if (currentTurnTokenRef && currentTurnToken != null && currentTurnTokenRef.current !== currentTurnToken) return false;
    return true;
  };

  const canRunPlayerAICallback = ({ token, fighterId }) => {
    if (combatOverRef?.current) return false;
    if (combatActiveRef?.current === false) return false;
    if (pendingTurnAdvanceRef?.current) return false;
    if (activeTechniqueImpactRef?.current || activeTacticalImpactRef?.current) return false;
    if (combatSessionRef && combatSession != null && combatSessionRef.current !== combatSession) return false;
    if (currentTurnTokenRef && currentTurnToken != null && currentTurnTokenRef.current !== currentTurnToken) return false;
    if (playerAITurnTokenRef?.current != null && token != null && playerAITurnTokenRef.current !== token) return false;
    const curIdx = turnIndexRef?.current;
    const liveFighters = fightersRef?.current || fighters;
    const curFighterId = liveFighters?.[curIdx]?.id;
    if (curFighterId && fighterId && curFighterId !== fighterId) return false;
    const liveFighter = liveFighters?.find?.((f) => f.id === fighterId);
    if (fighterId && (!liveFighter || (Number(liveFighter.remainingActions ?? 0) || 0) <= 0)) return false;
    return true;
  };
  const markActionScheduled = () => {
    if (playerAIActionScheduledRef) playerAIActionScheduledRef.current = true;
  };
  const finalizeApproachMoveOnly = (reason = "player-ai-approach-move-only") => {
    addLog("ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª approach post-move continuation: inRange=false", "debug");
    addLog("ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª finishAttackAfterImpact reason=approach-move-only", "debug");
    addLog(`ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â­ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} used this action to move into position.`, "info");
    addLog("ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª approach move-only finalizing", "debug");
    markActionScheduled();
    if (turnActionResolvingRef) turnActionResolvingRef.current = false;
    if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
    processingPlayerAIRef.current = false;
    addLog("ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª approach move-only finalized; scheduling turn advance", "debug");
    scheduleEndTurn(0, reason);
  };
  const getLatestPlayerState = () =>
    fightersRef?.current?.find((f) => f.id === player.id) ||
    fighters.find((f) => f.id === player.id) ||
    player;
  const getTechniqueAttemptKey = (fighterId) =>
    `${fighterId}:${playerAITurnToken ?? turnCounter ?? 0}`;
  const getAiActionLockKey = (fighter) =>
    [
      fighter?.id,
      meleeRound ?? 0,
      turnCounter ?? 0,
      fighter?.remainingActions ?? 0,
    ].join(":");
  const tryLockAiAction = (fighter) => {
    if (!activePlayerAITurnKeysRef?.current || !fighter) return true;
    const key = getAiActionLockKey(fighter);
    if (activePlayerAITurnKeysRef.current.has(key)) {
      console.warn("[PLAYER AI TURN BLOCKED - duplicate]", key);
      return false;
    }
    activePlayerAITurnKeysRef.current.add(key);
    return key;
  };
  const unlockAiAction = (key) => {
    if (!key || key === false) return;
    activePlayerAITurnKeysRef?.current?.delete?.(key);
  };
  const canTryTechniqueThisTurn = (fighterId) => {
    if (!techniqueAttemptBudgetRef?.current) return true;
    const key = getTechniqueAttemptKey(fighterId);
    const count = Number(techniqueAttemptBudgetRef.current.get(key) || 0);
    return count < 2;
  };
  const noteTechniqueAttemptForTurn = (fighterId) => {
    if (!techniqueAttemptBudgetRef?.current) return 1;
    const key = getTechniqueAttemptKey(fighterId);
    const next = Number(techniqueAttemptBudgetRef.current.get(key) || 0) + 1;
    techniqueAttemptBudgetRef.current.set(key, next);
    // Keep the budget map bounded to recent entries.
    if (techniqueAttemptBudgetRef.current.size > 80) {
      const entries = Array.from(techniqueAttemptBudgetRef.current.entries()).slice(-40);
      techniqueAttemptBudgetRef.current = new Map(entries);
    }
    return next;
  };
  const startTechniqueAttempt = async ({
    technique,
    techniqueTarget,
    announceLog = null,
    precheckDistance = null,
  }) => {
    const latestPlayer = getLatestPlayerState();
    if (!technique || !latestPlayer) return false;
    if (!isPlayerAiAllowed()) return false;
    if ((latestPlayer.remainingActions ?? 0) <= 0) return false;

    // Respect the RAW limit (enfraidered again inside executeTechnique).
    if ((latestPlayer.techniquesCastThisMelee || 0) >= 1) return false;

    if (techniqueTarget && precheckDistance != null && precheckDistance !== Infinity) {
      const rangeFeet = getTechniqueRangeInFeet(technique);
      if (rangeFeet !== Infinity && precheckDistance > rangeFeet) return false;
    }

    if (!canTryTechniqueThisTurn(latestPlayer.id)) {
      addLog?.(`ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${latestPlayer.name} stops technique attempts (cap reached), switching to fallback.`, "info");
      return false;
    }

    const actionLockKey = tryLockAiAction(latestPlayer);
    if (!actionLockKey) return false;
    noteTechniqueAttemptForTurn(latestPlayer.id);
    if (announceLog) addLog?.(announceLog, "info");

    markActionScheduled();
    const playerId = latestPlayer.id;
    addLog?.(
      `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª startTechniqueAttempt begin caster=${latestPlayer?.name} technique=${technique?.name}`,
      "info"
    );

    try {
      const result = await executeTechnique(latestPlayer, techniqueTarget ?? latestPlayer, technique);
      const techniqueSucceeded = result === true || result?.ok === true;
      addLog?.(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª startTechniqueAttempt result techniqueSucceeded=${techniqueSucceeded} raw=${String(result)}`,
        "info"
      );

      if (!techniqueSucceeded && !canTryTechniqueThisTurn(playerId)) {
        addLog?.(`ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${latestPlayer.name} technique attempts exhausted; will fallback next decision.`, "info");
      }

      if (techniqueSucceeded) {
        let after = null;
        const liveFighters = fightersRef?.current ?? fighters ?? [];
        const updated = liveFighters.map((f) => {
          if (f.id !== playerId) return f;
          after = {
            ...f,
            remainingActions: Math.max(0, (f.remainingActions ?? 0) - 1),
          };
          return after;
        });
        setFighters(updated);
        if (after) {
          const attacksLeft = formatAttacksRemaining(
            after.remainingActions ?? 0,
            after.actionsPerRound ?? after.actionsPerMelee ?? 0
          );
          addLog?.(`${after.name} has ${attacksLeft} remaining`, "info");
        }
        const pending = activeTechniqueImpactRef?.current;
        const techniqueOwnsTurnEnd =
          pending &&
          pending.turnCounter === (turnCounterRef?.current ?? turnCounter) &&
          pending.casterId === playerId;
        if (!techniqueOwnsTurnEnd) {
          scheduleEndTurn(16, "player-ai-technique-no-impact");
        }
      } else if (result?.consumeAction === true) {
        addLog?.(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${latestPlayer?.name} failed to cast ${technique?.name}; consuming action per result.`,
          "warning"
        );
        setFighters((prev) =>
          prev.map((f) =>
            f.id === playerId
              ? {
                  ...f,
                  remainingActions: Math.max(0, (f.remainingActions ?? 0) - 1),
                }
              : f
          )
        );
        scheduleEndTurn(16, "player-ai-technique-consume");
      } else {
        addLog?.(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${latestPlayer?.name} failed to cast ${technique?.name}; no action spent.`,
          "warning"
        );
        scheduleEndTurn(16, "player-ai-technique-fail");
      }

      return techniqueSucceeded;
    } catch (err) {
      addLog?.(
        `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Player AI technique failed: ${err?.message || String(err)}`,
        "warning"
      );
      if (turnActionResolvingRef) turnActionResolvingRef.current = false;
      if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
      scheduleEndTurn(16, "player-ai-technique-catch");
      return false;
    } finally {
      if (processingPlayerAIRef) processingPlayerAIRef.current = false;
      unlockAiAction(actionLockKey);
    }
  };

  // Minimal, low-noise AI trace for Ariel (opt-in).
  // Usage: localStorage.debugArielAI = "1"
  const dbg =
    typeof window !== "undefined" &&
    window?.localStorage?.getItem("debugArielAI") === "1" &&
    String(player?.name || "")
      .toLowerCase()
      .includes("ariel");
  const trace = (msg) => {
    if (dbg) addLog?.(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  ArielAI: ${msg}`, "info");
  };

  if (!isPlayerAiAllowed()) {
    if (processingPlayerAIRef) processingPlayerAIRef.current = false;
    return;
  }

  // Low-noise AI debugging (opt-in).
  // Usage: localStorage.debugCombatAI = "1"
  const DEBUG_AI =
    typeof window !== "undefined" &&
    window?.localStorage?.getItem("debugCombatAI") === "1";

  const dbgLog = (msg, level = "info") => {
    if (DEBUG_AI) addLog?.(msg, level);
  };


  trace(
    `start | remainingActions=${player?.remainingActions ?? "?"} | enemies=${
      fighters.filter(
        (f) =>
          isHostileTarget(f) && canFighterAct(f) && (f.currentHP ?? 0) > -21
      ).length
    } | posKeys=${Object.keys(positions || {}).length}`
  );

  // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ CRITICAL: Check if player can act (conscious, not dying/dead/unconscious)
  if (!canFighterAct(player)) {
    const hpStatus = getHPStatus(player.currentHP);
    addLog(
      `ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â­ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} cannot act (${hpStatus.description}), skipping turn`,
      "info"
    );
    trace(`exit: cannot act (${hpStatus?.description || "unknown"})`);
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }

  // ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â´ NEW: Check if paralyzed
  const isParalyzed = player.statusEffects?.some(
    (e) =>
      (typeof e === "string" && e === "PARALYZED") ||
      (typeof e === "object" && e.type === "PARALYZED")
  );
  if (isParalyzed) {
    addLog(`ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â­ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} is paralyzed and cannot act this round!`, "info");
    trace(`exit: paralyzed`);
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }

  // ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€¦Ã‚Â¸ Fallen exception: they never flee from morale ROUTED
  if (
    isFallenUnit(player) &&
    (player.moraleState?.status === "ROUTED" ||
      player.statusEffects?.includes("ROUTED"))
  ) {
    addLog(
      `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ ${player.name} is fallen and refuses to flee (ignoring ROUTED).`,
      "info"
    );

    player.moraleState = {
      ...(player.moraleState || {}),
      status: "UNSHAKEN",
    };

    if (Array.isArray(player.statusEffects)) {
      player.statusEffects = player.statusEffects.filter((s) => s !== "ROUTED");
    }

    // proceed with a normal action instead of routing logic
  }

  // ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â´ NEW: Check if routed - if so, attempt to flee instead of fighting
  if (
    player.moraleState?.status === "ROUTED" ||
    player.statusEffects?.includes("ROUTED")
  ) {
    addLog(`player routed AI start fighter=${player.name}`, "debug");
    addLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€ Ã¢â‚¬â„¢ ${player.name} is ROUTED and attempts to flee!`, "warning");
    trace(`route: attempting flee`);

    // Attempt to withdraw from threats
    const currentPos = positions[player.id];
    if (!currentPos) {
      addLog(
        `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} cannot withdraw (no position data).`,
        "warning"
      );
      trace(`exit: routed but no position data`);
      addLog("player routed AI blocked reason=no-position-data", "warning");
      markActionScheduled();
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return createPlayerAiActionResult("routed-blocked", { reason: "no-position-data" });
    }

    // Get active enemy fighters as threats
    const enemyFighters = fighters.filter(
      (f) =>
        isHostileTarget(f) &&
        canFighterAct(f) &&
        f.currentHP > 0 &&
        f.currentHP > -21
    );

    // If no active enemies, just end turn
    if (enemyFighters.length === 0) {
      addLog(`ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} finds no active foes.`, "info");
      trace(`exit: no active foes`);
      addLog("player routed AI blocked reason=no-active-foes", "warning");
      markActionScheduled();
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return createPlayerAiActionResult("routed-blocked", { reason: "no-active-foes" });
    }

    // Calculate threat positions
    const threatPositions = enemyFighters
      .map((f) => positions[f.id])
      .filter(Boolean);

    if (threatPositions.length === 0) {
      addLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂºÃƒâ€šÃ‚Â¡ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} cannot see any threats.`, "info");
      trace(
        `exit: no threats | enemyIds=${enemyFighters
          .map((e) => e.id)
          .join(",")}`
      );
      // Optional one-run debug: set localStorage.debugThreatPositions = "1"
      try {
        if (
          typeof window !== "undefined" &&
          window?.localStorage?.getItem("debugThreatPositions") === "1"
        ) {
          addLog(
            `DEBUG: ${
              player.name
            } threatPositions empty. enemies=${enemyFighters
              .map((e) => e.id)
              .join(",")} posKeys=${Object.keys(positions || {}).length}`,
            "warning"
          );
        }
      } catch {
        // no-op (non-browser)
      }
      addLog("player routed AI blocked reason=no-visible-threat-position", "warning");
      markActionScheduled();
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return createPlayerAiActionResult("routed-blocked", {
        reason: "no-visible-threat-position",
      });
    }

    // Calculate max retreat steps based on movement
    const speed =
      player.Spd ||
      player.spd ||
      player.attributes?.Spd ||
      player.attributes?.spd ||
      10;
    const actionsPerRound = player.actionsPerRound || 2;
    const fullFeetPerAction = (speed * 18) / Math.max(1, actionsPerRound);
    const maxSteps = Math.max(
      1,
      Math.min(Math.floor(fullFeetPerAction / GRID_CONFIG.CELL_SIZE), 5)
    );

    if (typeof findRetreatDestination !== "function") {
      addLog("player routed AI blocked reason=retreat-helper-unavailable", "warning");
      markActionScheduled();
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return createPlayerAiActionResult("routed-blocked", {
        reason: "retreat-helper-unavailable",
      });
    }

    // Try to find retreat destination using the shared live-combat routing adapter.
    const retreatDestination = findRetreatDestination({
      currentPos,
      threatPositions,
      maxSteps,
      enemyId: player.id,
      isHexOccupied,
    });

    if (retreatDestination && retreatDestination.position) {
      addLog(
        `player routed AI flee target selected=${retreatDestination.position.x},${retreatDestination.position.y}`,
        "debug",
      );
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¶ ${player.name} withdraws from threats to (${retreatDestination.position.x}, ${retreatDestination.position.y}).`,
        "info"
      );
      trace(
        `action: withdraw | to=(${retreatDestination.position.x},${retreatDestination.position.y})`
      );

      // Actually move the player using handlePositionChange
      handlePositionChange(player.id, retreatDestination.position, {
        action: "RETREAT",
        actionCost: 0,
        description: "Flee from threats",
        movementType: "withdraw",
        source: "AI_WITHDRAW",
        threatPositions: threatPositions,
      });

      addLog(
        `player routed AI moved fighter=${player.name} to=${retreatDestination.position.x},${retreatDestination.position.y} result=routed-move`,
        "debug",
      );
      markActionScheduled();
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return createPlayerAiActionResult("routed-move", {
        destination: retreatDestination.position,
      });
    }

    // No safe retreat hex found ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ end turn
    addLog(
      `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} looks for a safe place to withdraw but finds none.`,
      "warning"
    );

    addLog("player routed AI blocked reason=no-retreat-destination", "warning");
    markActionScheduled();
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return createPlayerAiActionResult("routed-blocked", {
      reason: "no-retreat-destination",
    });
  }

  // Check if combat is still active
  if (!combatActive) {
    addLog(`ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Combat ended, ${player.name} skips turn`, "info");
    processingPlayerAIRef.current = false;
    return;
  }

  // Check if player has actions remaining
  if (player.remainingActions <= 0) {
    if (typeof canFinalizeTurn === "function" && !canFinalizeTurn("player-ai-no-actions")) {
      processingPlayerAIRef.current = false;
      return createPlayerAiActionResult("stale-finalizer-ignored");
    }
    addLog(
      `ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â­ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} has no actions remaining - passing to next fighter in initiative order`,
      "info"
    );
    trace(
      `exit: no actions remaining | remainingActions=${player.remainingActions}`
    );
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }

  // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ FIX: Filter enemies by visibility AND exclude unconscious/dying/dead targets
  // Only target conscious enemies (HP > 0) - unconscious/dying enemies are already defeated
  const allEnemies = fighters.filter(
    (f) =>
      isHostileTarget(f) &&
      canFighterAct(f) &&
      f.currentHP > 0 && // Only conscious enemies
      f.currentHP > -21 // Not dead
  );

  // Get equistaminad weapons early for reachability checks
  addLog?.(`runPlayerTurnAI before weapon selection fighter=${player.name}`, "debug");
  const equistaminadWeapons = getEquistaminadWeapons(player);
  addLog?.(
    `runPlayerTurnAI after weapon selection fighter=${player.name} count=${equistaminadWeapons.length}`,
    "debug",
  );

  // Check if player has ranged weapons (used to determine if we should respect "unreachable" marks)
  const hasRangedWeapon = equistaminadWeapons.some((w) => {
    const name = (w.name || "").toLowerCase();
    const type = (w.type || "").toLowerCase();
    const isRanged =
      type === "ranged" ||
      name.includes("bow") ||
      name.includes("crossbow") ||
      name.includes("sling") ||
      name.includes("thrown") ||
      (w.range && w.range > 10);
    if (dbg) {
      trace(
        `weapon check: ${w.name || "unnamed"} | type=${w.type} | range=${
          w.range
        } | isRanged=${isRanged}`
      );
    }
    return isRanged;
  });

  if (dbg) {
    trace(
      `weapon detection: equistaminadWeapons=${
        equistaminadWeapons.length
      } | hasRanged=${hasRangedWeapon} | weapons=[${equistaminadWeapons
        .map((w) => `${w.name || "unnamed"}(type=${w.type}, range=${w.range})`)
        .join(", ")}]`
    );
  }

  const enemyTargets = allEnemies.filter((target) => {
    // First check visibility
    const canSee = canAISeeTarget(player, target, positions, combatTerrain, {
      useFogOfWar: fogEnabled,
      fogOfWarVisibleCells: visibleCells,
    });
    if (!canSee) {
      trace(`target ${target.id}: filtered (visibility=false)`);
      return false;
    }

    // If the player is a flier and the target is grounded, melee reachability can be solved by descending/dive.
    // In that case, we should NOT permanently mark the target unreachable (that would cause AI to skip forever).
    const targetAlt = getAltitude(target) || 0;
    const targetIsFlying = isFlying(target) && targetAlt > 0;
    const allowDescendToGroundTarget =
      !hasRangedWeapon &&
      (canFly(player) || isFlying(player)) &&
      !targetIsFlying &&
      targetAlt <= 5;

    // Only check "unreachable" mark if player has NO ranged weapons AND we cannot solve it by descending.
    if (
      !hasRangedWeapon &&
      !allowDescendToGroundTarget &&
      isTargetUnreachable(player, target)
    ) {
      trace(
        `target ${target.id}: filtered (marked unreachable, no ranged weapon)`
      );
      return false;
    }

    // If target was previously marked unreachable but player now has ranged weapons, clear the mark
    if (hasRangedWeapon && isTargetUnreachable(player, target)) {
      clearUnreachableTarget(player, target.id);
      trace(
        `target ${target.id}: cleared unreachable mark (player has ranged weapon)`
      );
    }

    // For melee-focused players without ranged weapons, check melee reachability early
    if (!hasRangedWeapon) {
      // If flier vs grounded target, clear any stale unreachable mark and allow targeting.
      // Actual descent/dive policy is handled later in the AI action selection.
      if (allowDescendToGroundTarget) {
        if (isTargetUnreachable(player, target)) {
          clearUnreachableTarget(player, target.id);
          trace(
            `target ${target.id}: cleared unreachable mark (flier can descend to ground target)`
          );
        }
        trace(
          `target ${target.id}: ACCEPTED | hasRanged=${hasRangedWeapon} (can descend to engage)`
        );
        return true;
      }

      // Check if target is reachable with melee (includes altitude check)
      const canThreaten = canThreatenWithMelee(player, target);
      if (!canThreaten) {
        trace(
          `target ${target.id}: filtered (melee unreachable, no ranged weapon)`
        );
        markTargetUnreachable(player, target);
        return false;
      }
    }

    trace(`target ${target.id}: ACCEPTED | hasRanged=${hasRangedWeapon}`);
    return true;
  });

  trace(
    `targets: allEnemies=${allEnemies.length} | filtered=${enemyTargets.length} | equistaminadWeapons=${equistaminadWeapons.length}`
  );

  if (enemyTargets.length === 0) {
    // Check if there are enemies but they're just not visible
    if (allEnemies.length > 0) {
      // Only log visibility issues once per combat round per player to avoid spam
      // Use meleeRound instead of turnCounter since turnCounter changes every action
      const visibilityLogKey = `${player.id}_round_${meleeRound}`;
      if (!visibilityLogRef.current.has(visibilityLogKey)) {
        addLog(
          `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} cannot see any enemies (hidden/obscured).`,
          "info"
        );
        visibilityLogRef.current.add(visibilityLogKey);
        // Clean up old entries (keep only last 10 rounds worth)
        if (visibilityLogRef.current.size > 100) {
          const entries = Array.from(visibilityLogRef.current);
          visibilityLogRef.current = new Set(entries.slice(-50));
        }
      }
      trace(
        `exit: no visible targets | allEnemies=${allEnemies.length} | filtered=0`
      );
    } else {
      if (onNoHostilesRemaining?.("player-no-targets")) {
        processingPlayerAIRef.current = false;
        return;
      }
      addLog(`${player.name} has no targets and defends.`, "info");
      trace(`exit: no targets (all enemies defeated/removed)`);
    }
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }

  const professionLower = (
    player.PROFESSION ||
    player.profession ||
    player.class ||
    ""
  ).toLowerCase();
  const livePlayer = getLatestPlayerState();
  const fighterTechniques = getFighterTechniques(livePlayer) || [];
  const fighterTactics = getFighterTacticalPowers(livePlayer);
  const staminaAvailable = getFighterstamina(livePlayer);
  const focusAvailable = getFighterfocus(livePlayer);

  const hasTechniques = Array.isArray(fighterTechniques) && fighterTechniques.length > 0;

  // Use tags if available, otherwise fall back to existing filters
  const damageTechniques = hasTechniques
    ? fighterTechniques.filter(
        (s) =>
          (s.tags?.includes("direct_damage") || s.tags?.includes("area")) &&
          getTechniqueCost(s) <= staminaAvailable
      )
    : [];

  const healingTechniques = hasTechniques
    ? fighterTechniques.filter(
        (s) =>
          (s.tags?.includes("healing") ||
            (isHealingTechnique(s) && getTechniqueHealingFormula(s))) &&
          getTechniqueCost(s) <= staminaAvailable
      )
    : [];

  // escapeTechniques is defined later in the escape tools section

  // Fallback to existing offensive filter if no tags
  const offensiveTechniques =
    damageTechniques.length > 0
      ? damageTechniques
      : fighterTechniques.filter(
          (technique) =>
            isOffensiveTechnique(technique) && getTechniqueCost(technique) <= staminaAvailable
        );

  const offensiveTactics = fighterTactics.filter((power) => {
    const cost = getTacticalCost(power);
    if (cost > focusAvailable) return false;
    return getTacticalTargetCategory(power) === "enemy";
  });

  const healingTactics = fighterTactics.filter((power) => {
    const cost = getTacticalCost(power);
    if (cost > focusAvailable) return false;

    // Exclude detection/utility powers that don't actually heal
    const powerName = (power.name || "").toLowerCase();
    if (
      powerName.includes("see aura") ||
      powerName.includes("detect") ||
      powerName.includes("sense") ||
      powerName.includes("telepathy") ||
      powerName.includes("empathy") ||
      powerName.includes("presence sense")
    ) {
      return false;
    }

    const type = (power.attackType || "").toLowerCase();
    if (type === "healing") return true;
    const category = (power.category || "").toLowerCase();
    if (category.includes("healing")) return true;
    if ((power.effect || "").toLowerCase().includes("heal")) return true;

    // Only include powers that explicitly mention HP healing
    const description = (power.description || "").toLowerCase();
    if (
      description.includes("restore hp") ||
      description.includes("heal hp") ||
      description.includes("regain hit points")
    )
      return true;

    return false;
  });

  // --- NEW: escape tools & healer alignment flags ---
  // Note: escapeTechniques is already defined above using tags, so we use that
  // If tags aren't available, fall back to the helper function
  const escapeTechniquesTagged = hasTechniques
    ? fighterTechniques.filter(
        (s) =>
          (s.tags?.includes("escape") || s.tags?.includes("defensive")) &&
          getTechniqueCost(s) <= staminaAvailable
      )
    : [];

  const escapeTechniquesFallback = hasTechniques
    ? fighterTechniques.filter(
        (technique) =>
          getTechniqueCost(technique) <= staminaAvailable && isPotentialEscapeTechnique(technique)
      )
    : [];

  const escapeTechniquesFinal =
    escapeTechniquesTagged.length > 0 ? escapeTechniquesTagged : escapeTechniquesFallback;

  const escapeTactics = fighterTactics.filter((power) => {
    const cost = getTacticalCost(power);
    if (cost > focusAvailable) return false;
    return isPotentialEscapeTactical(power);
  });

  const alignmentTextForAI = getAlignmentTextForAI(player);
  const isGoodAlignment = isGoodAlignedForAI(player);
  const isHealerProfessionType = isHealerProfessionForAI(player);

  // Healer archetype = Clergy PROFESSIONs (Priest, Healer, Druid, Shaman, etc.) OR explicit healer skills
  const hasHealerSkills =
    Array.isArray(player.skills) &&
    player.skills.some((s) =>
      ["Healer PROFESSION role Skill", "Holistic Medicine"].includes(s.name)
    );

  const hasHealingTraining =
    healingTechniques.length > 0 || healingTactics.length > 0;

  // A "healer archetype" is either a clergy/healer PROFESSION or someone who actually has heals
  const isHealer = (isHealerProfessionType || hasHealerSkills) && hasHealingTraining;
  const isGoodHealer = isGoodAlignment && isHealer;

  const healingCandidates = fighters
    .filter((f) => isAllyTarget(f) && f.currentHP > MIN_COMBAT_HP)
    .filter((f) => getFighterHP(f) < getFighterMaxHP(f));

  const prioritizedHealingTargets = [...healingCandidates].sort(
    (a, b) => getFighterHP(a) - getFighterHP(b)
  );

  const healingTargets = prioritizedHealingTargets.filter((candidate) => {
    const hp = getFighterHP(candidate);
    const max = getFighterMaxHP(candidate) || 1;
    if (hp <= 0) return true;
    return hp / max <= 0.6;
  });

  const attemptHealing = async (targetsToHeal) => {
    // Track which powers we've already tried this turn to prevent loops
    const triedPowers = new Set();

    for (const candidate of targetsToHeal) {
      const isShumanTarget = candidate.id === player.id;

      // For Stop Bleeding specifically, only attempt on bleeding targets
      // and skip if already stabilized this round
      const stopBleedingPower = healingTactics.find(
        (p) => p.name === "Stop Bleeding"
      );
      if (stopBleedingPower) {
        const candidateIsBleeding = isBleeding(candidate);
        const alreadyStabilized =
          candidate.statusEffects?.includes("STABILIZED") ||
          (candidate.meta?.stabilizedByTactics &&
            candidate.meta?.lastStopBleedingRound >= meleeRound);

        if (!candidateIsBleeding || alreadyStabilized) {
          // Skip Stop Bleeding for this target - try other healing options
        } else {
          // Only try Stop Bleeding if target is bleeding and not already stabilized
          const canUseStopBleeding = !triedPowers.has("Stop Bleeding");
          if (canUseStopBleeding) {
            const category = getTacticalTargetCategory(stopBleedingPower);
            const canTarget =
              (isShumanTarget && (category === "shuman" || category === "ally")) ||
              (!isShumanTarget && category === "ally");

            if (canTarget) {
              const rangeFeet = parseRangeToFeet(stopBleedingPower.range);
              const inRange =
                rangeFeet === Infinity ||
                (positions[player.id] &&
                  positions[candidate.id] &&
                  calculateDistance(
                    positions[player.id],
                    positions[candidate.id]
                  ) <= rangeFeet);

              if (inRange) {
                triedPowers.add("Stop Bleeding");
                addLog(
                  `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€¦Ã‚Â¡ ${player.name} channels Stop Bleeding to help ${candidate.name}.`,
                  "info"
                );
                try {
                  const tacticalResult = await executeTacticalPower(player, candidate, stopBleedingPower);
                  const usedTactical = tacticalResult === true || tacticalResult?.ok === true;
                  if (usedTactical) {
                    processingPlayerAIRef.current = false;
                    return true;
                  }
                } catch (err) {
                  addLog?.(
                    `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} failed to use Stop Bleeding: ${err?.message || String(err)}`,
                    "warning"
                  );
                }
                // Continue to next target if Stop Bleeding failed
                continue;
              }
            }
          }
        }
      }

      const technique = healingTechniques.find((techniqueOption) =>
        techniqueCanAffectTarget(techniqueOption, player, candidate)
      );

      if (technique) {
        addLog(
          `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€¦Ã‚Â¡ ${player.name} uses ${technique.name} to aid ${candidate.name}.`,
          "info"
        );
        if (await startTechniqueAttempt({ technique, techniqueTarget: candidate })) {
          return true;
        }
      }

      // Try other healing tactics (excluding Stop Bleeding which we already handled)
      const tactical = healingTactics.find((power) => {
        // Skip Stop Bleeding (already handled above)
        if (power.name === "Stop Bleeding") return false;
        // Skip if we've already tried this power
        if (triedPowers.has(power.name)) return false;

        const category = getTacticalTargetCategory(power);
        if (isShumanTarget) {
          return category === "shuman" || category === "ally";
        }
        if (category !== "ally") return false;
        if (!positions[player.id] || !positions[candidate.id]) return true;
        const rangeFeet = parseRangeToFeet(power.range);
        if (rangeFeet === Infinity) return true;
        const distanceFeet = calculateDistance(
          positions[player.id],
          positions[candidate.id]
        );
        return distanceFeet <= rangeFeet;
      });

      if (tactical) {
        triedPowers.add(tactical.name); // Mark as tried
        addLog(
          `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€¦Ã‚Â¡ ${player.name} channels ${tactical.name} to help ${candidate.name}.`,
          "info"
        );
        try {
          const tacticalResult = await executeTacticalPower(player, candidate, tactical);
          const usedTactical = tacticalResult === true || tacticalResult?.ok === true;
          if (usedTactical) {
            processingPlayerAIRef.current = false;
            return true;
          }
        } catch (err) {
          addLog?.(
            `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} failed to use ${tactical.name}: ${err?.message || String(err)}`,
            "warning"
          );
        }
      }
    }
    return false;
  };

  // --- GOOD HEALER LOGIC ---

  // If this fighter is a good-aligned healer AND they are being directly engaged
  // in melee by a tough foe (outmatched), they should try to escape first
  // rather than stand and trade blows.
  // Find the nearest enemy as the potential threat
  let nearestEnemy = null;
  if (enemyTargets.length > 0) {
    const playerPos = positions[player.id];
    if (playerPos) {
      nearestEnemy = enemyTargets
        .map((e) => ({
          enemy: e,
          distance: calculateDistance(playerPos, positions[e.id] || {}),
        }))
        .sort((a, b) => a.distance - b.distance)[0]?.enemy;
    }
  }

  if (isGoodHealer && nearestEnemy) {
    const outmatched = isOutmatchedForAI(
      player,
      nearestEnemy,
      getFighterHP,
      getFighterMaxHP
    );

    if (outmatched) {
      const escaped = await attemptEscapeIfOutmatched({
        player,
        target: nearestEnemy,
        positions,
        escapeTechniques: escapeTechniquesFinal,
        escapeTactics,
        focusAvailable,
        staminaAvailable,
        addLog,
        processingPlayerAIRef,
        calculateDistance,
        executeTacticalPower,
        startTechniqueAttempt,
      });

      if (escaped) {
        // Healer successfully bailed out ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ turn is done
        return;
      }
      // If no escape option worked, we fall through to normal healing priority
    }
  }

  // --- HEALING PRIORITY (as before) ---
  // Healers (and anyone else with heals) still prioritize healing wounded allies,
  // but now good-aligned healers will bail out first if they're getting mauled.
  if (
    healingTargets.length > 0 &&
    (healingTechniques.length > 0 || healingTactics.length > 0)
  ) {
    if (await attemptHealing(healingTargets)) {
      return;
    }
  }

  // Check if player is a prey animal and has no enemies to attack
  function isPreyAnimal(fighter) {
    if (!fighter) return false;

    const name = (fighter.baseName || fighter.name || "").toLowerCase();

    // Explicit: named prey combatants
    if (
      name.includes("mouse") ||
      name.includes("rat") ||
      name.includes("rabbit") ||
      name.includes("squirrel")
    ) {
      return true;
    }

    // Fallback: tiny animals that are not opponents/fallen
    // Note: getSizeCategory would need to be imported if available
    const sizeCat = fighter.sizeCategory || fighter.size || "";
    if (
      sizeCat === "Tiny" &&
      !fighter.isFallen &&
      !fighter.isRaider &&
      !fighter.isOpponent
    ) {
      return true;
    }

    return false;
  }

  /**
   * Prey idle brain:
   * - If scary enemy nearby => run/hide (retreat)
   * - Else if safe and food/loot nearby => scavenge/forage
   * - Else => wander / sniff around (flavor)
   */
  function runPreyIdleTurn({
    fighter,
    enemies,
    allies,
    positions,
    terrain,
    objects,
    log,
    setFighters,
    scheduleEndTurn,
    processingPlayerAIRef,
    setPositions,
    positionsRef,
    calculateDistance,
    findRetreatDestination,
    handlePositionChange,
    isHexOccupied,
  }) {
    if (!fighter || !positions) return;

    const myPos = positions[fighter.id];
    if (!myPos) {
      scheduleEndTurn();
      if (processingPlayerAIRef) processingPlayerAIRef.current = false;
      return;
    }

    // 1) THREAT DETECTION: any hostile within "fear radius"
    const FEAR_RADIUS_HEXES = 12; // ~60 ft on 5ft hexes
    let nearestThreat = null;
    let nearestThreatDistSq = Infinity;

    for (const enemy of enemies) {
      if (!enemy || enemy.isDead || enemy.isDying || enemy.currentHP <= 0)
        continue;

      const enemyPos = positions[enemy.id];
      if (!enemyPos) continue;

      const dx = enemyPos.x - myPos.x;
      const dy = enemyPos.y - myPos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= FEAR_RADIUS_HEXES * FEAR_RADIUS_HEXES) {
        if (distSq < nearestThreatDistSq) {
          nearestThreatDistSq = distSq;
          nearestThreat = enemy;
        }
      }
    }

    // 1a) If there is a threat: run/hide using existing retreat logic
    if (nearestThreat) {
      const threatPos = positions[nearestThreat.id];

      // Prefer to flee *away* from threat
      const threatPositions = threatPos ? [threatPos] : [];
      const retreatDestination = findRetreatDestination
        ? findRetreatDestination({
            currentPos: myPos,
            threatPositions,
            maxSteps: 5,
            enemyId: fighter.id,
            isHexOccupied,
          })
        : null;

      if (retreatDestination) {
        log(
          `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â­ ${fighter.name} panics at the sight of ${nearestThreat.name} and scurries away!`,
          "info"
        );

        // Move toward retreat destination
        if (handlePositionChange && retreatDestination.position) {
          handlePositionChange(fighter.id, retreatDestination.position, {
            action: "RETREAT",
            actionCost: 0,
            description: "Flee from threat",
          });
        } else if (setPositions) {
          setPositions((prev) => {
            const updated = {
              ...prev,
              [fighter.id]: retreatDestination.position,
            };
            if (positionsRef) positionsRef.current = updated;
            return updated;
          });
          revealAfterObviousMovement(
            fighter,
            setFighters,
            addLog,
            "retreating"
          );
        }

        setFighters((prev) =>
          prev.map((f) =>
            f.id === fighter.id
              ? {
                  ...f,
                  defensiveStance: "Retreat",
                  remainingActions: Math.max(0, f.remainingActions - 1),
                }
              : f
          )
        );

        scheduleEndTurn();
        if (processingPlayerAIRef) processingPlayerAIRef.current = false;
        return;
      }

      // If no retreat destination found, just cower / defend
      log(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â­ ${fighter.name} freezes in fear, unable to find a way to flee from ${nearestThreat.name}.`,
        "info"
      );

      setFighters((prev) =>
        prev.map((f) =>
          f.id === fighter.id
            ? {
                ...f,
                remainingActions: Math.max(0, f.remainingActions - 1),
                defensiveStance: "Cower",
              }
            : f
        )
      );

      scheduleEndTurn();
      if (processingPlayerAIRef) processingPlayerAIRef.current = false;
      return;
    }

    // 2) SAFE: SCAVENGE / FORAGE
    const SCAVENGE_RADIUS = 6; // 6-hex "forage" radius

    // First, look for corpses
    const allFighters = [...(allies || []), ...(enemies || [])];
    const corpse = findNearbyCorpse(
      fighter,
      allFighters,
      positions,
      SCAVENGE_RADIUS
    );
    if (corpse) {
      const corpsePos = positions[corpse.id];
      if (corpsePos) {
        const dist = calculateDistance
          ? calculateDistance(myPos, corpsePos)
          : Math.sqrt(
              (corpsePos.x - myPos.x) ** 2 + (corpsePos.y - myPos.y) ** 2
            ) * 5;

        if (dist > 5) {
          // Move partway toward corpse
          const dx = corpsePos.x - myPos.x;
          const dy = corpsePos.y - myPos.y;
          const step = {
            x: myPos.x + Math.sign(dx),
            y: myPos.y + Math.sign(dy),
          };

          log(
            `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â­ ${fighter.name} cautiously noses toward a nearby corpse to scavenge.`,
            "info"
          );

          if (setPositions) {
            setPositions((prev) => {
              const updated = { ...prev, [fighter.id]: step };
              if (positionsRef) positionsRef.current = updated;
              return updated;
            });
          }

          setFighters((prev) =>
            prev.map((f) =>
              f.id === fighter.id
                ? {
                    ...f,
                    remainingActions: Math.max(0, f.remainingActions - 1),
                  }
                : f
            )
          );

          scheduleEndTurn();
          if (processingPlayerAIRef) processingPlayerAIRef.current = false;
          return;
        }

        // Already adjacent: actually scavenge/eat
        log(`${fighter.name} scavenges from the corpse.`, "info");
        scavengeCorpse(fighter, corpse, log);

        setFighters((prev) =>
          prev.map((f) =>
            f.id === fighter.id
              ? {
                  ...f,
                  remainingActions: Math.max(0, f.remainingActions - 1),
                  defensiveStance: "Idle/Forage",
                }
              : f
          )
        );

        scheduleEndTurn();
        if (processingPlayerAIRef) processingPlayerAIRef.current = false;
        return;
      }
    }

    // 2b) Optional: forage items (grain, crumbs, berries)
    const foodItem = findFoodItem(fighter);
    if (foodItem) {
      log(`${fighter.name} snacks on ${foodItem.name}.`, "info");
      consumeItem(fighter, foodItem, { log });

      setFighters((prev) =>
        prev.map((f) =>
          f.id === fighter.id
            ? {
                ...f,
                remainingActions: Math.max(0, f.remainingActions - 1),
                defensiveStance: "Idle/Forage",
              }
            : f
        )
      );

      scheduleEndTurn();
      if (processingPlayerAIRef) processingPlayerAIRef.current = false;
      return;
    }

    // 3) WANDER / IDLE: sniff around, maybe toward a hiding spot
    // Note: findNearbyHidingSpot would need to be imported or defined here
    // For now, skip hiding spot logic if not available
    const hideSpot = null; // findNearbyHidingSpot(fighter, positions, terrain, objects || [], 12);

    if (hideSpot) {
      const hx = hideSpot.position.x - myPos.x;
      const hy = hideSpot.position.y - myPos.y;
      const step = {
        x: myPos.x + Math.sign(hx),
        y: myPos.y + Math.sign(hy),
      };

      log(`${fighter.name} creeps cautiously toward a hiding place.`, "info");

      if (setPositions) {
        setPositions((prev) => {
          const updated = { ...prev, [fighter.id]: step };
          if (positionsRef) positionsRef.current = updated;
          return updated;
        });
      }

      setFighters((prev) =>
        prev.map((f) =>
          f.id === fighter.id
            ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
            : f
        )
      );

      scheduleEndTurn();
      if (processingPlayerAIRef) processingPlayerAIRef.current = false;
      return;
    }

    // Small idle wander: spend one action making a tiny reposition (prey shouldn't look frozen).
    // This keeps them visually alive even when there are no enemies visible.
    if (positions && positions[fighter.id] && Math.random() < 0.55) {
      const p = positions[fighter.id];
      const isHex = terrain?.mapType === "hex";
      const dirs = isHex
        ? [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
            { dx: 1, dy: -1 },
            { dx: -1, dy: 1 },
          ]
        : [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
          ];

      // shuffle directions
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }

      for (const d of dirs) {
        const nx = p.x + d.dx;
        const ny = p.y + d.dy;
        if (typeof isHexOccupied === "function" && isHexOccupied(nx, ny))
          continue;

        setPositions((prev) => ({
          ...prev,
          [fighter.id]: { ...prev[fighter.id], x: nx, y: ny },
        }));

        log(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â¾ ${fighter.name} wanders cautiously, sniffing the ground.`);

        setFighters((prev) =>
          prev.map((f) =>
            f.id === fighter.id
              ? {
                  ...f,
                  remainingActions: Math.max(0, (f.remainingActions || 0) - 1),
                  defensiveStance: "Idle/Alert",
                }
              : f
          )
        );

        scheduleEndTurn();
        if (processingPlayerAIRef) processingPlayerAIRef.current = false;
        return;
      }
    }

    // No threats, no food, no clear hiding spot: pure idle flavor
    const idleLines = [
      `${fighter.name} sniffs the air nervously.`,
      `${fighter.name} grooms itshuman and twitches its whiskers.`,
      `${fighter.name} pauses, listening for danger.`,
    ];
    const line = idleLines[Math.floor(Math.random() * idleLines.length)];
    log(line, "info");

    setFighters((prev) =>
      prev.map((f) =>
        f.id === fighter.id
          ? {
              ...f,
              remainingActions: Math.max(0, f.remainingActions - 1),
              defensiveStance: "Idle/Alert",
            }
          : f
      )
    );

    scheduleEndTurn();
    if (processingPlayerAIRef) processingPlayerAIRef.current = false;
  }

  // If no enemies visible and player is a prey animal, use idle/forage behavior
  if (enemyTargets.length === 0 && isPreyAnimal(player)) {
    const playerAllies = fighters.filter(
      (f) => isAllyTarget(f) && f.id !== player.id
    );
    runPreyIdleTurn({
      fighter: player,
      enemies: enemyTargets,
      allies: playerAllies,
      positions,
      terrain: combatTerrain,
      objects: arenaEnvironment?.objects || [],
      log: addLog,
      setFighters,
      scheduleEndTurn,
      processingPlayerAIRef,
      setPositions,
      positionsRef,
      calculateDistance,
      findRetreatDestination,
      handlePositionChange,
      isHexOccupied,
    });
    return;
  }

  // AI Strategy for players: Similar to enemy AI but with player-specific logic
  let target = null;
  let reasoning = "";

  // equistaminadWeapons is already defined above for enemyTargets filtering

  // Debug: Show what we found (only log if not a prey animal to reduce spam)
  if (!isPreyAnimal(player)) {
    addLog(
      `${player.name} weapon check: ${equistaminadWeapons.length} equipped weapons found`,
      "info"
    );
    if (equistaminadWeapons.length > 0) {
      addLog(
        `${player.name} equipped weapons: ${equistaminadWeapons
          .map((w) => w.name)
          .join(", ")}`,
        "info"
      );
    }
    addLog(formatCombatWeaponAvailability(player), "info");
  }

  // Calculate distances to all targets and check if they're reachable
  const targetsWithDistance = enemyTargets
    .map((t) => {
      const dist =
        positions[player.id] && positions[t.id]
          ? calculateDistance(positions[player.id], positions[t.id])
          : Infinity;

      const isBlocked = isTargetBlocked(player.id, t.id, positions);

      // Check if target is unreachable using centralized helper
      let isUnreachable = isTargetUnreachable(player, t);
      if (!isUnreachable) {
        // For melee-focused players without ranged weapons, check melee reachability
        const hasRangedWeapon = equistaminadWeapons.some((w) => {
          const name = (w.name || "").toLowerCase();
          return (
            name.includes("bow") ||
            name.includes("crossbow") ||
            name.includes("sling") ||
            name.includes("thrown") ||
            (w.range && w.range > 10)
          );
        });
        if (!hasRangedWeapon) {
          isUnreachable = !canThreatenWithMelee(player, t);
          if (isUnreachable) {
            markTargetUnreachable(player, t);
          }
        }
      }

      return {
        target: t,
        distance: dist,
        hpPercent: t.currentHP / t.maxHP,
        isWounded: t.currentHP < t.maxHP,
        isBlocked: isBlocked,
        isUnreachable: isUnreachable,
        priority: calculateTargetPriority(t, dist, isBlocked),
      };
    })
    .sort((a, b) => a.priority - b.priority);

  // Filter to only targets in reasonable range and reachable
  const targetsInRange = targetsWithDistance.filter(
    (t) => t.distance <= 100 && !t.isUnreachable
  );

  // Check if player has any valid offensive options against flying enemies
  if (targetsInRange.length === 0 && targetsWithDistance.length > 0) {
    const allUnreachable = targetsWithDistance.every((t) => t.isUnreachable);

    if (allUnreachable) {
      // Check if player has ranged options (weapons, techniques, tactics) that can reach flying enemies
      const hasRangedOptions = hasAnyRangedOptionAgainstFlying(
        player,
        enemyTargets,
        {
          getFighterTechniques,
          getFighterTacticalPowers,
          getFighterstamina,
          getFighterfocus,
          getTechniqueCost,
          getTacticalCost,
          getTechniqueRangeInFeet,
          parseRangeToFeet,
          isOffensiveTechnique,
          calculateDistance,
          positions,
        }
      );

      if (!hasRangedOptions) {
        // If this is a prey animal, use idle/forage behavior instead of defend/withdraw
        if (isPreyAnimal(player)) {
          const playerAllies = fighters.filter(
            (f) => isAllyTarget(f) && f.id !== player.id
          );
          runPreyIdleTurn({
            fighter: player,
            enemies: enemyTargets,
            allies: playerAllies,
            positions,
            terrain: combatTerrain,
            objects: arenaEnvironment?.objects || [],
            log: addLog,
            setFighters,
            scheduleEndTurn,
            processingPlayerAIRef,
            setPositions,
            positionsRef,
            calculateDistance,
            findRetreatDestination,
            handlePositionChange,
            isHexOccupied,
          });
          return;
        }

        // Spam control: only log once per combat round per player
        const shouldLog =
          !player.meta?.loggedNoRangedOptions ||
          player.meta?.loggedNoRangedRound !== meleeRound;

        if (shouldLog) {
          // Mark that we logged this
          if (!player.meta) player.meta = {};
          player.meta.loggedNoRangedOptions = true;
          player.meta.loggedNoRangedRound = meleeRound;

          if (aiControlEnabled) {
            // AI control: auto-defend/withdraw
            addLog(
              `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} has no way to hit flying enemies (no ranged weapons, techniques, or tactics). Defaulting to defend/withdraw.`,
              "warning"
            );
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          } else {
            // Manual control: show hint but don't auto-end turn
            addLog(
              `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â All visible enemies are flying out of melee range. ${player.name} can choose a technique, tactical, missile weapon, or Hold Action.`,
              "info"
            );
            // Return without ending turn - let player make choice
            return;
          }
        } else {
          // Already logged this melee - just end turn if AI control
          if (aiControlEnabled) {
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          }
          // Manual control: return without ending turn
          return;
        }
      }
    }
  }

  if (targetsInRange.length === 0) {
    target = targetsWithDistance[0]?.target || enemyTargets[0];
    reasoning = `targeting the closest reachable foe`;
  } else {
    const reachableTargets = targetsInRange.filter((t) => !t.isBlocked);
    const blockedTargets = targetsInRange.filter((t) => t.isBlocked);

    if (reachableTargets.length > 0) {
      const bestReachable = reachableTargets[0];
      target = bestReachable.target;
      reasoning = `attacking closest reachable target (${Math.round(
        bestReachable.distance
      )}ft away)`;
    } else if (blockedTargets.length > 0) {
      const bestBlocked = blockedTargets[0];
      target = bestBlocked.target;
      reasoning = `target blocked by ${
        getBlockingCombatant(player.id, target.id, positions)?.name ||
        "another combatant"
      }, considering area attack`;
    } else {
      target = targetsInRange[0].target;
      const dist = Math.round(targetsInRange[0].distance);
      reasoning = `attacking closest target (${dist}ft away)`;
    }
  }

  let currentDistance = Infinity;
  if (target && positions[player.id] && positions[target.id]) {
    currentDistance = calculateDistance(
      positions[player.id],
      positions[target.id]
    );
  }

  const selectOffensiveTechnique = (techniquesList) => {
    if (!target) return null;

    // Check target immunities
    const targetAbilities = target.abilities || {};
    const isFireImmune = Array.isArray(targetAbilities.impervious_to)
      ? targetAbilities.impervious_to.some((t) =>
          String(t).toLowerCase().includes("fire")
        )
      : false;

    const viable = techniquesList.filter((technique) => {
      // Check if technique can affect target (friendly/enemy restrictions)
      if (!techniqueCanAffectTarget(technique, player, target)) return false;

      // Filter out fire techniques if target is fire-immune
      if (isFireImmune) {
        const techniqueName = (technique.name || "").toLowerCase();
        const damageType = (technique.damageType || "").toLowerCase();
        if (
          techniqueName.includes("fire") ||
          techniqueName.includes("flame") ||
          techniqueName.includes("burn") ||
          damageType === "fire"
        ) {
          return false;
        }
      }

      return true;
    });
    if (viable.length === 0) return null;
    const inRange = viable.filter((technique) => {
      const rangeFeet = getTechniqueRangeInFeet(technique);
      return (
        rangeFeet === Infinity ||
        currentDistance === Infinity ||
        currentDistance <= rangeFeet
      );
    });
    // If nothing is in range, don't pick a "melee-range" technique at 120ft and waste the action.
    if (inRange.length === 0) return null;

    // Prefer longer-range techniques when multiple are viable (prevents picking Flame Lick over Fire Ball at distance).
    const rangeVal = (technique) => {
      const r = getTechniqueRangeInFeet(technique);
      return r === Infinity ? 1_000_000_000 : Number(r || 0);
    };
    inRange.sort((a, b) => rangeVal(b) - rangeVal(a));
    return inRange[0];
  };

  // Track recently used tactics per fighter to prevent spamming
  // Alignment and healer helpers
  const GOOD_ALIGNMENTS = ["principled", "scrupulous"];
  // Alignment constants (for future use)
  // const EVIL_ALIGNMENTS = ["diabolic", "miscreant"];
  // const SHUMANISH_ALIGNMENTS = ["unprincipled", "anarchist"];

  const isGood = (fighter) => {
    const a = (fighter.alignment || "").toLowerCase();
    return GOOD_ALIGNMENTS.includes(a);
  };

  const isHealerProfession = (fighter) => {
    const profession = (fighter.profession || fighter.class || "").toLowerCase();
    return (
      profession.includes("healer") ||
      profession.includes("priest of light") ||
      profession.includes("priestess of light") ||
      profession.includes("druid") ||
      profession.includes("cleric") ||
      profession.includes("priest")
    );
  };

  const findMostInjuredAlly = (allies) => {
    let best = null;
    let bestRatio = 1;

    allies.forEach((ally) => {
      if (!ally || ally.isDead || !canFighterAct(ally)) return;
      const maxHp = getFighterMaxHP(ally) || 1;
      const curHp = getFighterHP(ally);
      if (maxHp <= 0) return;
      const ratio = curHp / maxHp;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = ally;
      }
    });

    // Only heal if under ~70% health
    if (best && bestRatio < 0.7) return best;
    return null;
  };

  const chooseBestHealingTechnique = ({
    fighter,
    techniques,
    isHealingTechnique,
    distanceFeetToTarget,
  }) => {
    const stamina = getFighterstamina(fighter);
    if (!techniques || !techniques.length) return null;

    const affordable = techniques.filter((s) => {
      const cost = getTechniqueCost(s);
      return cost <= stamina && isHealingTechnique(s);
    });
    if (!affordable.length) return null;

    // Prefer techniques that can reach (if they have range)
    const inRange = affordable.filter((s) => {
      const r = getTechniqueRangeInFeet(s);
      return r === Infinity || r === 0 || distanceFeetToTarget <= r;
    });

    const pool = inRange.length ? inRange : affordable;

    // Simple: highest cost = strongest
    return pool.reduce((best, s) => {
      const cost = getTechniqueCost(s);
      if (!best) return s;
      const bestCost = getTechniqueCost(best);
      return cost > bestCost ? s : best;
    }, null);
  };

  const isThreatenedInMelee = (fighter, enemies) => {
    return enemies.some((e) => {
      if (!e || !canFighterAct(e)) return false;
      const dist =
        positions[fighter.id] && positions[e.id]
          ? calculateDistance(positions[fighter.id], positions[e.id])
          : Infinity;
      return dist <= 5; // adjacent
    });
  };

  const chooseBestEscapeAbility = ({ fighter, techniques, tactics }) => {
    const nameMatchesEscape = (name) => {
      const n = (name || "").toLowerCase();
      return (
        n.includes("escape") ||
        n.includes("teleport") ||
        n.includes("shadow meld") ||
        n.includes("invisibility") ||
        n.includes("wall of") ||
        n.includes("sanctuary")
      );
    };

    const stamina = getFighterstamina(fighter);
    const focus = getFighterfocus(fighter);

    let escapeTechnique = null;
    if (techniques && techniques.length) {
      const candidates = techniques.filter((s) => {
        const cost = getTechniqueCost(s);
        return cost <= stamina && nameMatchesEscape(s.name);
      });
      if (candidates.length) {
        escapeTechnique = candidates[0];
      }
    }

    let escapeTactical = null;
    if (tactics && tactics.length) {
      const cand = tactics.filter((p) => {
        const cost = getTacticalCost(p);
        return cost <= focus && nameMatchesEscape(p.name);
      });
      if (cand.length) escapeTactical = cand[0];
    }

    return {
      escapeTechnique,
      escapeTactical,
    };
  };

  // Healer AI: heal allies first, escape if threatened, then attack
  const healer = isHealerProfession(player) && isGood(player);
  const playerAllies = fighters.filter(
    (f) => isAllyTarget(f) && f.id !== player.id
  );
  const threatened = isThreatenedInMelee(player, enemyTargets);

  if (healer) {
    // 1) Heal ally first if safe-ish
    const injuredAlly = findMostInjuredAlly(playerAllies);

    if (injuredAlly && !threatened) {
      const dist =
        positions[player.id] && positions[injuredAlly.id]
          ? calculateDistance(positions[player.id], positions[injuredAlly.id])
          : Infinity;
      const healTechnique = chooseBestHealingTechnique({
        fighter: player,
        techniques: fighterTechniques,
        isHealingTechnique,
        distanceFeetToTarget: dist,
      });

      if (healTechnique) {
        addLog(
          `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${player.name} (healer) chooses to heal ${injuredAlly.name} with ${healTechnique.name}`,
          "info"
        );
        if (await startTechniqueAttempt({ technique: healTechnique, techniqueTarget: injuredAlly })) {
          return;
        }
      }

      // Try healing tactical
      const healTactical = chooseBestHealingTactical({
        caster: player,
        tacticalOptions: fighterTactics,
        target: injuredAlly,
        distanceFeet: dist,
        focus: focusAvailable,
      });

      if (healTactical) {
        addLog(
          `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  ${player.name} (healer) chooses to heal ${injuredAlly.name} with ${healTactical.name}`,
          "info"
        );
        try {
          const tacticalResult = await executeTacticalPower(player, injuredAlly, healTactical);
          const usedTactical = tacticalResult === true || tacticalResult?.ok === true;
          if (usedTactical) {
            processingPlayerAIRef.current = false;
            return;
          }
        } catch (err) {
          addLog?.(
            `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} failed to use ${healTactical.name}: ${err?.message || String(err)}`,
            "warning"
          );
        }
      }
    }

    // 2) If threatened and enemy is tough, try escape
    if (threatened && target) {
      const escape = chooseBestEscapeAbility({
        fighter: player,
        techniques: fighterTechniques,
        tactics: fighterTactics,
      });

      if (escape.escapeTechnique) {
        addLog(
          `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã¢â‚¬â„¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ ${player.name} (healer) uses escape technique ${escape.escapeTechnique.name}`,
          "info"
        );
        if (await startTechniqueAttempt({ technique: escape.escapeTechnique, techniqueTarget: player })) {
          return;
        }
      }

      if (escape.escapeTactical) {
        const recentlyUsed =
          playerAIRecentlyUsedTacticsRef.current.get(player.id) || [];
        if (recentlyUsed.length === 0) {
          addLog(
            `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  ${player.name} (healer) uses escape tactical ${escape.escapeTactical.name}`,
            "info"
          );
          try {
            const tacticalResult = await executeTacticalPower(player, player, escape.escapeTactical);
            const usedTactical = tacticalResult === true || tacticalResult?.ok === true;
            if (usedTactical) {
              processingPlayerAIRef.current = false;
              return;
            }
          } catch (err) {
            addLog?.(
              `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} failed to use ${escape.escapeTactical.name}: ${err?.message || String(err)}`,
              "warning"
            );
          }
        }
      }
    }
  }

  // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ CRITICAL: Only choose ONE tactical per action using the helper
  // This prevents spam by ensuring we pick one and execute it once
  const bestOffensiveTactical =
    target && offensiveTactics.length > 0
      ? chooseBestOffensiveTactical({
          caster: player,
          tacticalOptions: offensiveTactics,
          target,
          distanceFeet: currentDistance,
          focus: focusAvailable,
          alignment: player.alignment,
        })
      : null;

  const bestOffensiveTechnique = selectOffensiveTechnique(offensiveTechniques);

  const trainingKeywords = [
    "duelist",
    "mage",
    "mercenary",
    "witch",
    "sraidererer",
    "summoner",
    "diabolist",
    "cleric",
    "priest",
    "druid",
    "shaman",
  ];
  const isTrainingFocused = trainingKeywords.some((keyword) =>
    professionLower.includes(keyword)
  );
  const isMindMage =
    professionLower.includes("tactician") || professionLower.includes("mindmage");

  // ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â¹ GOOD HEALER LOGIC - Check before general training-focused behavior
  const isHealerArchetypePlayer = isHealerArchetype(player);
  const goodHealer =
    isHealerArchetypePlayer && isGoodAlignmentForHealer(player);

  if (isTrainingFocused && goodHealer && isHealerArchetypePlayer) {
    addLog(
      `${player.name} is training-focused and a good-aligned healer - evaluating techniques and tactics...`,
      "info"
    );

    // 1) If badly outmatched in melee, prefer escape/defensive training FOR SHUMAN
    const inSeriousTrouble = isInSeriousMeleeTrouble(
      player,
      enemyTargets,
      positions,
      calculateDistance,
      getFighterHP,
      getFighterMaxHP
    );
    if (inSeriousTrouble && escapeTechniquesFinal.length > 0) {
      const escapeTechnique = escapeTechniquesFinal[0]; // later you can pick smarter
      addLog(
        `${player.name} is a good healer in serious melee trouble - using escape technique: ${escapeTechnique.name}`,
        "info"
      );
      // Shuman-target escape
      if (await startTechniqueAttempt({ technique: escapeTechnique, techniqueTarget: player })) {
        return;
      }
    }

    // 2) Otherwise, heal the most injured ally if anyone needs it
    const allyToHeal = findAllyNeedingHealing(
      player,
      fighters,
      getFighterHP,
      getFighterMaxHP,
      {
        criticalOnly: true, // only heal when someone is pretty hurt
        sceneContext,
      }
    );

    if (allyToHeal && healingTechniques.length > 0) {
      // For now choose the first healing technique; later you can add a "selectBestHealingTechnique" helper.
      const healingTechnique = healingTechniques[0];

      addLog(
        `${player.name} prioritizes healing ally ${allyToHeal.name} with ${healingTechnique.name}`,
        "info"
      );
      if (await startTechniqueAttempt({ technique: healingTechnique, techniqueTarget: allyToHeal })) {
        return;
      }
    }
  }

  // Debug logging for training-focused characters
  if (isTrainingFocused) {
    addLog(
      `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${player.name} technique check: Found ${fighterTechniques.length} total techniques, ${fighterTactics.length} tactical powers`,
      "info"
    );
    if (fighterTechniques.length > 0) {
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${player.name} techniques: ${fighterTechniques
          .map((s) => s.name)
          .join(", ")}`,
        "info"
      );
    } else {
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${
          player.name
        } has no techniques found in: training=${!!player.training}, techniques=${!!player.techniques}, knownTechniques=${!!player.knownTechniques}, techniqueBook=${!!player.techniqueBook}, abilities=${!!player.abilities}`,
        "warning"
      );
    }
    addLog(
      `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${player.name} stamina: ${staminaAvailable}, focus: ${focusAvailable}`,
      "info"
    );
  }

  // Debug logging for tacticians
  if (isMindMage) {
    addLog(
      `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  ${player.name} is a Tactician - checking tactical powers...`,
      "info"
    );
    addLog(
      `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  Available tactical powers: ${fighterTactics.length}, Offensive: ${offensiveTactics.length}, focus: ${focusAvailable}`,
      "info"
    );
    if (bestOffensiveTactical) {
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  Best offensive tactical: ${
          bestOffensiveTactical.name
        } (cost: ${getTacticalCost(bestOffensiveTactical)} focus)`,
        "info"
      );
    } else {
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  No viable offensive tactical found (target: ${
          target?.name
        }, distance: ${Math.round(currentDistance)}ft)`,
        "info"
      );
    }
  }

  const attemptOffensiveTechnique = async (technique) => {
    return startTechniqueAttempt({
      technique,
      techniqueTarget: target,
      announceLog: `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${player.name} unleashes ${technique.name} at ${target.name}!`,
      precheckDistance: currentDistance,
    });
  };

  const attemptOffensiveTactical = async (power) => {
    addLog(
      `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  ${player.name} focuses ${power.name} on ${target.name}!`,
      "info"
    );
    // Mark immediately so CombatPage watchdog/invariant doesn't end-turn while a tactical action is executing.
    markActionScheduled();
    try {
      const tacticalResult = await executeTacticalPower(player, target, power);
      const usedTactical = tacticalResult === true || tacticalResult?.ok === true;
      if (usedTactical) {
        // Track this tactical as recently used to prevent spamming
        const recentlyUsed =
          playerAIRecentlyUsedTacticsRef.current.get(player.id) || [];
        recentlyUsed.push(power.name);
        // Keep only last 3 used tactics per fighter
        if (recentlyUsed.length > 3) {
          recentlyUsed.shift();
        }
        playerAIRecentlyUsedTacticsRef.current.set(player.id, recentlyUsed);

        processingPlayerAIRef.current = false;
        return true;
      }
    } catch (err) {
      addLog?.(
        `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} failed to use ${power.name}: ${err?.message || String(err)}`,
        "warning"
      );
    }
    if (playerAIActionScheduledRef) playerAIActionScheduledRef.current = false;
    return false;
  };

  // For tacticians, prioritize tactics over weapons and techniques
  // For others, use tactics if no technique available or at long range
  const shouldUseTactics =
    !!bestOffensiveTactical &&
    (isMindMage ||
      (!bestOffensiveTechnique && currentDistance > 5.5) ||
      currentDistance > 20);

  if (isMindMage) {
    addLog(
      `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  Tactician tactical decision: shouldUseTactics=${shouldUseTactics}, bestOffensiveTactical=${
        bestOffensiveTactical?.name || "none"
      }`,
      "info"
    );
  }

  if (shouldUseTactics && bestOffensiveTactical) {
    const tacticalResult = await attemptOffensiveTactical(bestOffensiveTactical);
    if (isMindMage) {
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Â  Tactical execution result: ${tacticalResult ? "SUCCESS" : "FAILED"}`,
        tacticalResult ? "info" : "error"
      );
    }
    if (tacticalResult) {
      return;
    }
  }

  // Only use techniques if not a tactician (tacticians should prefer tactics)
  // For training-focused classes (duelist, etc.), ALWAYS prioritize techniques over melee
  // The technique range check hastaminans in executeTechnique, so we can try to use techniques at any distance
  const shouldUseTechnique =
    !!bestOffensiveTechnique &&
    !isMindMage &&
    (isTrainingFocused || // Training classes always prefer techniques when available
      currentDistance > 20 ||
      !bestOffensiveTactical);

  // Debug logging for training-focused classes
  if (isTrainingFocused) {
    if (bestOffensiveTechnique) {
      dbgLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${player.name} is training-focused - prioritizing technique: ${bestOffensiveTechnique.name}`, "info");
    } else {
      dbgLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${player.name} is training-focused but has no offensive techniques available`, "info");
    }
  }

  if (shouldUseTechnique && bestOffensiveTechnique) {
    if (await attemptOffensiveTechnique(bestOffensiveTechnique)) {
      return;
    }
  }

  // For training-focused classes, if we have techniques/tactics available, don't use melee
  // Allow movement to get in range, but skip melee attacks
  const hasTrainingAvailable = bestOffensiveTechnique || bestOffensiveTactical;
  if (isTrainingFocused && hasTrainingAvailable) {
    // If we tried to use training but it failed (e.g., out of range), allow movement
    // But don't fall through to melee - training classes should use training, not melee
    if (currentDistance > 5.5) {
      dbgLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${player.name} is training-focused with training available but out of range - will move to get in range`, "info");
      // Allow movement to continue below
    } else {
      // In melee range but training-focused - still prefer training over melee
      dbgLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â® ${player.name} is training-focused - skipping melee in favor of training`, "info");
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return;
    }
  }
  dbgLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â ${player.name} checking weapons...`, "info");
  let selectedAttack = null;
  let attackName = "Unarmed Attack";
  let selectedWeapon = null;
  let grappleOriginalWeaponName = null;

  // If no weapons found, try to equip a basic weapon from inventory
  if (equistaminadWeapons.length === 0) {
    addLog(
      `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} has no equipped weapons - checking inventory...`,
      "warning"
    );

    // Check if player has weapons in inventory/wardrobe
    const inventory = player.wardrobe || player.inventory || [];
    dbgLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â ${player.name}'s inventory has ${inventory.length} items`, "info");

    const availableWeapons = inventory.filter(
      (item) =>
        item.type === "weapon" ||
        item.category === "one-handed" ||
        item.category === "two-handed" ||
        item.name?.toLowerCase().includes("sword") ||
        item.name?.toLowerCase().includes("bow") ||
        item.name?.toLowerCase().includes("dagger")
    );

    dbgLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Found ${availableWeapons.length} weapons in inventory`, "info");

    if (availableWeapons.length > 0) {
      // Use autoEquipWeapons to properly equip weapons from inventory
      const updatedPlayer = autoEquipWeapons(player);

      // Update player's equistaminad weapons
      if (
        updatedPlayer.equistaminadWeapons &&
        updatedPlayer.equistaminadWeapons.length > 0
      ) {
        equistaminadWeapons.push(
          ...updatedPlayer.equistaminadWeapons.filter((w) => w.name !== "Unarmed")
        );

        // Update the player object in fighters array
        setFighters((prev) =>
          prev.map((f) =>
            f.id === player.id
              ? {
                  ...f,
                  equistaminadWeapons: updatedPlayer.equistaminadWeapons,
                  equistaminad: updatedPlayer.equistaminad,
                  equistaminadWeapon: updatedPlayer.equistaminadWeapon,
                }
              : f
          )
        );

        const equistaminadWeaponNames = updatedPlayer.equistaminadWeapons
          .filter((w) => w.name !== "Unarmed")
          .map((w) => w.name)
          .join(", ");
        addLog(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} auto-equistaminad: ${
            equistaminadWeaponNames || "No weapons"
          }`,
          "info"
        );
      } else {
        addLog(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ ${player.name} has no weapons in inventory - using unarmed`,
          "warning"
        );
      }
    } else {
      addLog(
        `ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ ${player.name} has no weapons in inventory - using unarmed`,
        "warning"
      );
    }
  }

  // Calculate current distance to target for weapon selection
  if (target && positions[player.id] && positions[target.id]) {
    currentDistance = calculateDistance(
      positions[player.id],
      positions[target.id]
    );
    const combatLogRoster = fightersRef?.current || fighters || [];
    const playerLogLabel = formatCombatActorLabel(player, {
      roster: combatLogRoster,
      counterpart: target,
    });
    const targetLogLabel = formatCombatActorLabel(target, {
      roster: combatLogRoster,
      counterpart: player,
    });
    addLog(
      `${playerLogLabel} is ${Math.round(currentDistance)}ft from ${
        targetLogLabel
      }`,
      "info"
    );
  }

  const isNeutralGrappleState = (fighter) => {
    const state = String(fighter?.grappleState?.state || "neutral").toLowerCase();
    return !state || state === "neutral";
  };

  const sameHexAsTarget =
    !!target &&
    !!positions[player.id] &&
    !!positions[target.id] &&
    positions[player.id].x === positions[target.id].x &&
    positions[player.id].y === positions[target.id].y;
  const playerGrappleOpponent = player?.grappleState?.opponent;
  const targetGrappleOpponent = target?.grappleState?.opponent;
  const activeGrappleBetween =
    !!target &&
    !isNeutralGrappleState(player) &&
    !isNeutralGrappleState(target) &&
    playerGrappleOpponent === target.id &&
    targetGrappleOpponent === player.id;
  const inGrappleState =
    !isNeutralGrappleState(player) || !isNeutralGrappleState(target);
  const inGrappleRange =
    !!target &&
    (sameHexAsTarget || activeGrappleBetween);
  const meleeEngagementContext = getMeleeEngagementContext({
    actor: player,
    target,
    positions,
    distanceFeet: currentDistance,
    calculateDistance,
  });

  const shouldAttemptAdjacentGrapple = () => {
    if (typeof dispatchGrappleTurnAction !== "function" || !target) return false;
    if (!sameHexAsTarget && (!Number.isFinite(currentDistance) || currentDistance > 5.5)) return false;
    if ((Number(player.remainingActions ?? 0) || 0) <= 0) return false;
    if (!inGrappleRange && (!isNeutralGrappleState(player) || !isNeutralGrappleState(target))) return false;

    const professionLabel = String(player.profession || player.PROFESSION || player.className || "").toLowerCase();
    const nameLabel = String(player.name || "").toLowerCase();
    const sizeLabel = String(player.size || player.sizeCategory || "").toLowerCase();
    const ps = Number(player.attributes?.PS ?? player.attributes?.ps ?? player.PS ?? player.ps ?? 0) || 0;
    const isKnightly =
      professionLabel.includes("knight") ||
      professionLabel.includes("paladin") ||
      nameLabel.includes("knight") ||
      nameLabel.includes("paladin");
    const isStrongMelee =
      ps >= 18 ||
      sizeLabel.includes("large") ||
      sizeLabel.includes("heavy") ||
      sizeLabel.includes("huge");
    const sizeOutcome = assessGrappleSizeOutcome(player, target);
    const targetDisabled =
      sizeOutcome.targetDisabled ||
      target?.prone ||
      target?.stunned ||
      target?.restrained;
    const traitText = [
      ...(Array.isArray(player.traits) ? player.traits : []),
      player.trait,
      player.archetype,
      player.aiRole,
      player.tacticalIntent,
      player.intent,
    ]
      .map((trait) => (typeof trait === "string" ? trait : trait?.name || trait?.id || trait?.type || ""))
      .join(" ")
      .toLowerCase();
    const hasGrapplerTrait =
      traitText.includes("grappler") ||
      traitText.includes("wrestler") ||
      traitText.includes("wrestling") ||
      traitText.includes("grapple");
    const hasSpecialGrappleIntent =
      String(player.specialTacticalIntent || player.tacticalIntent?.type || player.aiIntent || "")
        .toLowerCase()
        .includes("grapple");
    const weaponLooksRanged = (weapon) => {
      const name = String(weapon?.name || "").toLowerCase();
      const type = String(weapon?.type || weapon?.weaponType || weapon?.category || "").toLowerCase();
      const range = Number(weapon?.range ?? weapon?.normalRange ?? 0);
      return (
        weapon?.isRanged === true ||
        weapon?.ammunition ||
        weapon?.ammoType ||
        type.includes("ranged") ||
        type.includes("bow") ||
        name.includes("bow") ||
        name.includes("crossbow") ||
        name.includes("sling") ||
        (Number.isFinite(range) && range > 10)
      );
    };
    const weaponLooksUnarmed = (weapon) => {
      const name = String(weapon?.name || weapon?.type || "").toLowerCase();
      return !weapon || name.includes("unarmed") || name.includes("fist") || name.includes("punch");
    };
    const hasUsableMeleeWeapon = equistaminadWeapons.some((weapon) => (
      weapon &&
      !weaponLooksUnarmed(weapon) &&
      !weaponLooksRanged(weapon)
    ));
    const actorIsUnarmed = !hasUsableMeleeWeapon;

    if (
      hasUsableMeleeWeapon &&
      !hasGrapplerTrait &&
      !targetDisabled &&
      !actorIsUnarmed &&
      !hasSpecialGrappleIntent
    ) {
      return false;
    }

    if (sizeOutcome.sizeDelta >= 2 && !sizeOutcome.hasSpecialAdvantage && !targetDisabled) {
      return false;
    }
    if (
      sizeOutcome.sizeDelta === 1 &&
      !targetDisabled &&
      !sizeOutcome.hasSpecialAdvantage &&
      ps < sizeOutcome.targetPS - 2
    ) {
      return false;
    }

    if (isKnightly) {
      return (Number(player.remainingActions ?? 0) || 0) > 1;
    }
    if (isStrongMelee) {
      return ((turnCounter || 0) + String(player.id || "").length) % 3 === 0;
    }
    return false;
  };

  if (inGrappleState && !inGrappleRange) {
    clearSeparatedGrapple?.(player, target);
  } else if (inGrappleState && typeof dispatchGrappleTurnAction !== "function") {
    const recovery = recoverMissingPlayerGrappleDispatcher?.({
      actorId: player.id,
      initiativeTurnId: context.initiativeTurnId,
      opponentId: target?.id || player?.grappleState?.opponent || null,
      source: "player-ai-active-grapple",
      remainingActions: player.remainingActions,
    });
    return createPlayerAiActionResult("pass", {
      ...(recovery || {}),
      reason: "grapple-dispatch-required-but-missing",
      terminal: true,
      handled: true,
    });
  } else if (inGrappleState && typeof dispatchGrappleTurnAction === "function") {
    addLog?.({
      audience: "developer",
      channel: "ai",
      eventType: "grapple-state-read",
      level: "info",
      type: "debug",
      actorId: player.id,
      targetId: target?.id,
      source: "player-ai-active-grapple",
      message: `grapple-state-read: actorId=${player.id} opponentId=${target?.id || player?.grappleState?.opponent || "unknown"} active=true source=player-ai-active-grapple`,
      data: { active: true, grappleState: player?.grappleState },
    }, "debug");
    addLog?.({
      audience: "developer",
      channel: "ai",
      eventType: "standing-armored-selector-suppressed",
      level: "info",
      type: "debug",
      actorId: player.id,
      targetId: target?.id,
      source: "player-ai-active-grapple",
      message: `standing armored selector suppressed: actor=${player.name || player.id} reason=active-grapple`,
      data: { reason: "active-grapple" },
    }, "debug");
    addLog?.({
      audience: "developer",
      channel: "ai",
      eventType: "player-grapple-dispatcher-route-entry",
      level: "info",
      type: "debug",
      actorId: player.id,
      targetId: target?.id,
      source: "player-ai-active-grapple",
      message: `player grapple dispatcher route entry: actorId=${player.id} dispatcherPresent=${typeof dispatchGrappleTurnAction === "function"}`,
      data: {
        initiativeTurnId: context.initiativeTurnId || null,
        actorId: player.id,
        source: "player-ai-active-grapple",
        dispatcherPresent: typeof dispatchGrappleTurnAction === "function",
        dispatcherType: typeof dispatchGrappleTurnAction,
        continuationAuthorizationPresent: Boolean(continuationAuthorization),
      },
    }, "debug");
    if (continuationAuthorization) {
      addLog?.({
        audience: "developer",
        channel: "ai",
        eventType: "player-grapple-authorization-route-entry",
        level: "info",
        type: "debug",
        actorId: player.id,
        targetId: target?.id,
        source: "player-ai-active-grapple",
        message: `player grapple authorization route entry: continuationKey=${continuationAuthorization.continuationKey}`,
        data: { ...continuationAuthorization, receiptPresent: true, runPlayerDispatcherPresent: typeof dispatchGrappleTurnAction === "function" },
      }, "debug");
    }
    const grappleRoute = resolveGrappleTurnAction({
      actor: player,
      opponent: target,
      grappleState: player?.grappleState,
      remainingActions: player?.remainingActions,
      availableClinchWeapons: equistaminadWeapons,
      generationId: combatSession || combatSessionRef?.current || "default",
      round: context.meleeRound,
      initiativeIndex: context.turnIndexRef?.current,
      initiativeTurnId: context.initiativeTurnId,
      turnToken: currentTurnToken || currentTurnTokenRef?.current,
      source: "player-ai",
    });
    addLog?.({
      audience: "developer",
      channel: "ai",
      eventType: "combat-obligation-routed",
      level: "info",
      type: "debug",
      actorId: player.id,
      targetId: target?.id,
      message:
        `combat obligation routed: actorId=${player.id} opponentId=${target?.id || player?.grappleState?.opponent || "unknown"} ` +
        `obligation=active-grapple generationId=${combatSession || combatSessionRef?.current || "default"} ` +
        `turnToken=${currentTurnToken || currentTurnTokenRef?.current || "missing"}`,
      data: grappleRoute,
    }, "debug");
    if (grappleRoute.routeType === "legal-pass") {
      scheduleEndTurn?.(0, "player-ai-active-grapple-legal-pass");
      return createPlayerAiActionResult("pass", { reason: grappleRoute.reason || "no-grapple-action" });
    }
    if (!grappleRoute.handled || !grappleRoute.dispatchRequired) {
      return createPlayerAiActionResult("no-action", { reason: grappleRoute.reason || "routing-only-no-action" });
    }
    addLog(`${player.name} attempts a grapple follow-up.`, "info");
    markActionScheduled();
    const grappleDispatchSource = continuationAuthorization
      ? "remaining-action-continuation"
      : "player-ai-active-grapple";
    const grappleResult = dispatchGrappleTurnAction(
      player,
      target,
      grappleRoute.grappleAction?.actionType || grappleRoute.actionType,
      null,
      {
        continuationKey,
        continuationAuthorization,
        source: grappleDispatchSource,
        dispatcherChain: {
          ...(context.dispatcherChain || {}),
          runPlayerDispatcherPresent: typeof dispatchGrappleTurnAction === "function",
          routeDispatcherPresent: typeof dispatchGrappleTurnAction === "function",
        },
      },
    );
    if (grappleResult?.terminal === true) {
      addLog?.({
        audience: "developer",
        channel: "turn",
        eventType: "player-grapple-terminal-return-propagated",
        level: "info",
        type: "debug",
        actorId: player.id,
        targetId: target?.id,
        source: "player-ai-active-grapple",
        message:
          `player-grapple-terminal-return-propagated: actorId=${player.id} ` +
          `initiativeTurnId=${context.initiativeTurnId || "none"} source=player-ai-active-grapple`,
        data: {
          handled: true,
          terminal: true,
          routeType: "grapple-terminal",
          result: grappleResult,
        },
      }, "debug");
      return createPlayerAiActionResult("grapple", {
        reason: grappleResult.reason || "active-grapple-dispatched",
        handled: true,
        terminal: true,
        routeType: "grapple-terminal",
        grappleRoute,
        grappleResult,
      });
    }
    addLog?.({
      audience: "developer",
      channel: "ai",
      eventType: "player-ai-zero-progress-action-detected",
      level: "error",
      type: "error",
      actorId: player.id,
      targetId: target?.id,
      source: "player-ai-active-grapple",
      message: `player AI zero progress action detected: actorId=${player.id} source=active-grapple-dispatch-returned-false`,
      data: {
        remainingActionsBefore: player.remainingActions,
        remainingActionsAfter: player.remainingActions,
        actionTokenBefore: context.actionToken || null,
        actionTokenAfter: context.actionToken || null,
        pendingContinuationBefore: Boolean(continuationKey),
        pendingContinuationAfter: Boolean(continuationKey),
        authoritativeExecutionBefore: false,
        authoritativeExecutionAfter: false,
      },
    }, "error");
    const recovery = recoverMissingPlayerGrappleDispatcher?.({
      actorId: player.id,
      initiativeTurnId: context.initiativeTurnId,
      opponentId: target?.id || player?.grappleState?.opponent || null,
      source: "player-ai-active-grapple-zero-progress-recovery",
      remainingActions: player.remainingActions,
    });
    return createPlayerAiActionResult("pass", {
      ...(recovery || {}),
      reason: "player-ai-active-grapple-zero-progress-recovered",
      grappleRoute,
      terminal: true,
      handled: true,
    });
  }

  if (shouldAttemptAdjacentGrapple()) {
    addLog(`${player.name} attempts to grapple ${target.name}!`, "info");
    markActionScheduled();
    const grappleResult = dispatchGrappleTurnAction(player, target, null, null, { continuationKey, continuationAuthorization, source: "player-ai-adjacent-grapple" });
    if (grappleResult?.terminal === true) {
      return createPlayerAiActionResult("grapple", { reason: grappleResult.reason || "adjacent-grapple-dispatched", terminal: true, grappleResult });
    }
    if (playerAIActionScheduledRef) playerAIActionScheduledRef.current = false;
  }

  const isRangedLikeAttack = (attack) => {
    const name = String(attack?.name || "").toLowerCase();
    const type = String(attack?.type || "").toLowerCase();
    const range =
      typeof attack?.range === "number" ? attack.range : Number(attack?.range);
    const category = String(attack?.category || "").toLowerCase();
    const weaponType = String(attack?.weaponType || "").toLowerCase();
    const attackMode = String(attack?.attackMode || "").toLowerCase();
    return (
      type === "ranged" ||
      attack?.isRanged === true ||
      attack?.isThrown === true ||
      weaponType === "thrown" ||
      category === "thrown" ||
      attackMode === "thrown" ||
      name.includes("bow") ||
      name.includes("crossbow") ||
      name.includes("sling") ||
      name.includes("thrown") ||
      (Number.isFinite(range) && range > 10)
    );
  };

  if (equistaminadWeapons.length > 0) {
    // Smart weapon selection based on distance to target
    // Categorize weapons by range and type
    // IMPORTANT: treat "reach" weapons (e.g. 10-20ft) as MELEE, not ranged.
    // Only count weapons as ranged if they are truly missile/thrown/firearm style (ammo/keywords),
    // and use actual distance checks before choosing them.
    const isTrueRangedWeapon = (w) => {
      const name = String(w?.name || "").toLowerCase();
      if (w?.ammunition) return true;
      if (w?.ammoType) return true;
      if (w?.isRanged === true) return true;
      if (name.includes("bow")) return true;
      if (name.includes("crossbow")) return true;
      if (name.includes("sling")) return true;
      if (
        name.includes("gun") ||
        name.includes("rifle") ||
        name.includes("pistol")
      )
        return true;
      if (name.includes("throwing") || name.includes("thrown")) return true;
      // Fall back to data-driven: very long numeric ranges are almost certainly ranged
      const r = Number(getWeaponRange(w) || 0);
      return r > 30;
    };

    const meleeWeapons = equistaminadWeapons.filter((w) => !isTrueRangedWeapon(w));
    const rangedWeapons = equistaminadWeapons.filter((w) => isTrueRangedWeapon(w));
    // Use getWeaponType and getWeaponLength for detailed weapon info
    const weaponTypeInfo = equistaminadWeapons
      .map((w) => {
        const type = getWeaponType(w);
        const length = getWeaponLength(w);
        return `${w.name} (${type}, ${length}ft)`;
      })
      .join(", ");

    addLog(
      `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â ${player.name} has ${meleeWeapons.length} melee and ${rangedWeapons.length} ranged weapons`,
      "info"
    );
    if (equistaminadWeapons.length > 0) {
      addLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â Weapon details: ${weaponTypeInfo}`, "info");
    }

    // Choose weapon based on distance (and *actual* reachability)
    const canReachTargetWithWeapon = (w) => {
      if (!target) return true;
      const r = getWeaponRange(w);
      if (!Number.isFinite(currentDistance) || currentDistance === Infinity)
        return true;
      return r === Infinity || (typeof r === "number" && r >= currentDistance);
    };

    const reachableMelee = meleeWeapons.filter(canReachTargetWithWeapon);
    const reachableRanged = rangedWeapons.filter(canReachTargetWithWeapon);

    const adjacentToTarget = Number(currentDistance) <= 5.5;

    if (
      meleeEngagementContext.isClinched ||
      meleeEngagementContext.isGrappling ||
      meleeEngagementContext.isGround
    ) {
      const currentWeapon = equistaminadWeapons[0];
      const clinchSelection = selectMeleeAttackForContext({
        actor: player,
        target,
        candidates: meleeWeapons,
        selectedAttack: currentWeapon,
        context: meleeEngagementContext,
      });
      const grappleWeapon = clinchSelection.attack;
      if (clinchSelection.rejectedAttack) {
        grappleOriginalWeaponName = currentWeapon.name || "Unknown";
        addLog(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} cannot use ${currentWeapon.name} effectively in a grapple.`,
          "warning"
        );
      }
      if (grappleWeapon) {
        selectedWeapon = grappleWeapon;
        addLog(
          /dagger|knife/i.test(selectedWeapon?.name || "")
            ? `${player.name} switches to ${selectedWeapon.name} for close fighting.`
            : `${player.name} uses ${selectedWeapon.name} in the clinch.`,
          "info"
        );
      } else {
        selectedWeapon = {
          id: "fallback_grapple_unarmed_attack",
          name: "Unarmed Attack",
          damage: "1d3",
          damageDice: "1d3",
          count: 1,
          range: 5,
          rangeFeet: 5,
          reachFeet: 5,
          attackType: "melee",
          type: "melee",
          weaponType: "melee",
          category: "melee",
          isMelee: true,
          isWeapon: false,
          isNaturalAttack: true,
          isFallbackUnarmed: true,
        };
        addLog(
          `${player.name} is in grapple range and switches to close-quarters combat.`,
          "info"
        );
      }
    // If an archer is trastaminad in melee with no melee weapon, keep the turn resolvable.
    } else if (adjacentToTarget && rangedWeapons.length > 0 && meleeWeapons.length === 0) {
      selectedWeapon = {
        id: "fallback_unarmed_attack",
        name: "Unarmed Attack",
        damage: "1d3",
        damageDice: "1d3",
        count: 1,
        range: 5,
        rangeFeet: 5,
        reachFeet: 5,
        attackType: "melee",
        type: "melee",
        weaponType: "melee",
        category: "melee",
        isMelee: true,
        isWeapon: false,
        isNaturalAttack: true,
        isFallbackUnarmed: true,
      };
      addLog(
        `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“Ãƒâ€¦Ã‚Â  ${player.name} is too close for ${rangedWeapons[0]?.name || "a ranged weapon"} and switches to an unarmed attack.`,
        "info"
      );
    } else if (currentDistance <= 20 && reachableMelee.length > 0) {
      // Prefer a melee/reach weapon if it can already hit (e.g. Fire Whip at 15ft)
      const preferredRange = getPreferredEngagementRange(player, target);
      reachableMelee.sort(
        (a, b) =>
          Number(getWeaponRange(b) || 0) - Number(getWeaponRange(a) || 0)
      );
      selectedWeapon = reachableMelee[0];
      if (
        preferredRange?.minHexes >= 2 &&
        Number(getWeaponRange(selectedWeapon) || 0) >= 10 &&
        currentDistance <= Number(getWeaponRange(selectedWeapon) || 0)
      ) {
        addLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â ${player.name} keeps distance with ${selectedWeapon.name}.`, "info");
      }
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒâ€šÃ‚Â¡ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} selects ${selectedWeapon.name} for melee combat`,
        "info"
      );
    } else if (reachableRanged.length > 0) {
      // Otherwise prefer a true ranged weapon that can actually reach
      reachableRanged.sort(
        (a, b) =>
          Number(getWeaponRange(b) || 0) - Number(getWeaponRange(a) || 0)
      );
      selectedWeapon = reachableRanged[0];
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â¹ ${player.name} selects ${
          selectedWeapon.name
        } for ranged combat (${Math.round(currentDistance)}ft away)`,
        "info"
      );
    } else if (currentDistance <= 5.5 && meleeWeapons.length > 0) {
      // Close range - prefer melee weapons even if range calc is weird
      selectedWeapon =
        meleeWeapons[Math.floor(Math.random() * meleeWeapons.length)];
      addLog(
        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒâ€šÃ‚Â¡ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} selects ${selectedWeapon.name} for melee combat`,
        "info"
      );
    } else if (equistaminadWeapons.length > 0) {
      // Fallback to any equistaminad weapon that can reach the target
      // Before selecting fallback, check if any melee weapon can reach target
      const meleeWeapons = equistaminadWeapons.filter((w) => {
        const name = (w.name || "").toLowerCase();
        return (
          !name.includes("bow") &&
          !name.includes("crossbow") &&
          !name.includes("sling") &&
          !(w.range && w.range > 10)
        );
      });

      // Find a melee weapon that can reach the target
      const reachableMeleeWeapon = meleeWeapons.find((w) =>
        canThreatenWithMeleeWithWeapon(player, target, w)
      );

      if (reachableMeleeWeapon) {
        selectedWeapon = reachableMeleeWeapon;
        addLog(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} selects ${selectedWeapon.name} (fallback)`,
          "info"
        );
      } else if (
        meleeWeapons.length > 0 &&
        !canThreatenWithMelee(player, target)
      ) {
        // No melee weapon can reach - don't choose knife, use ranged or defend
        addLog(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} has no melee weapon that can reach ${target.name} (target too high)`,
          "warning"
        );
        markTargetUnreachable(player, target);
        // Will fall through to check for ranged weapons or defensive actions
        // For now, select first ranged weapon if available, otherwise first weapon
        const rangedWeapons = equistaminadWeapons.filter((w) => {
          const name = (w.name || "").toLowerCase();
          return (
            name.includes("bow") ||
            name.includes("crossbow") ||
            name.includes("sling") ||
            (w.range && w.range > 10)
          );
        });
        selectedWeapon =
          rangedWeapons.length > 0 ? rangedWeapons[0] : equistaminadWeapons[0];
        if (selectedWeapon) {
          addLog(
            `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} selects ${selectedWeapon.name} (fallback - no reachable melee)`,
            "info"
          );
        }
      } else {
        // Fallback to first equistaminad weapon
        selectedWeapon =
          equistaminadWeapons[Math.floor(Math.random() * equistaminadWeapons.length)];
        addLog(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} selects ${selectedWeapon.name} (fallback)`,
          "info"
        );
      }
    }

    const isTrueRangedSelectedWeapon = (weapon) => {
      const name = String(weapon?.name || "").toLowerCase();
      return (
        weapon?.type === "ranged" ||
        weapon?.isRanged === true ||
        weapon?.weaponType === "thrown" ||
        weapon?.category === "thrown" ||
        weapon?.attackMode === "thrown" ||
        weapon?.ammunition != null ||
        weapon?.ammoType != null ||
        name.includes("bow") ||
        name.includes("crossbow") ||
        name.includes("sling") ||
        name.includes("thrown") ||
        Number(getWeaponRange(weapon) || 0) > 10
      );
    };

    if (selectedWeapon) {
      const weaponRange = getWeaponRange(selectedWeapon);
      selectedAttack = {
        name: selectedWeapon.name,
        weapon: selectedWeapon,
        grappleResolvedFromWeapon: grappleOriginalWeaponName || selectedWeapon.name,
        grappleResolvedFinalWeapon: selectedWeapon.name,
        damage: selectedWeapon.damage || "1d3",
        count: 1,
        range: weaponRange,
        type: isTrueRangedSelectedWeapon(selectedWeapon)
          ? "ranged"
          : selectedWeapon.type,
        isRanged: isTrueRangedSelectedWeapon(selectedWeapon),
        isThrown:
          selectedWeapon?.isThrown === true ||
          selectedWeapon?.weaponType === "thrown" ||
          selectedWeapon?.category === "thrown",
        weaponType: selectedWeapon?.weaponType,
        category: selectedWeapon?.category,
        attackMode: selectedWeapon?.attackMode,
        ammunition: selectedWeapon?.ammunition,
        ammoType: selectedWeapon?.ammoType,
      };
      if (grappleOriginalWeaponName && grappleOriginalWeaponName !== selectedAttack.name) {
        addLog(
          `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª grapple weapon resolved: original=${grappleOriginalWeaponName}, final=${selectedAttack.name}`,
          "debug"
        );
      }
      attackName = selectedAttack.name;
      addLog(`ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ ${player.name} will attack with ${attackName}`, "info");
    }
  }

  // Fallback to unarmed if no weapon selected
  if (!selectedAttack) {
    selectedAttack = {
      name: "Unarmed Attack",
      damage: "1d3",
      count: 1,
      range: 5.5,
      type: "melee",
    };
  }

  if (target && selectedAttack) {
    const attackerPos = positions?.[player.id];
    const defenderPos = positions?.[target.id];
    const armoredDistance = attackerPos && defenderPos && typeof calculateDistance === "function"
      ? calculateDistance(attackerPos, defenderPos)
      : currentDistance;
    let armoredAction;
    try {
      armoredAction = resolveArmoredCombatAction({
        attacker: player,
        defender: target,
        selectedWeapon: selectedAttack.weapon || selectedAttack,
        distance: armoredDistance,
        remainingActions: player.remainingActions,
        generationId: context.combatSession || context.combatSessionRef?.current || "default",
        round: context.meleeRound,
        initiativeIndex: context.turnIndexRef?.current,
        initiativeTurnId: context.initiativeTurnIdRef?.current || context.initiativeTurnId,
        turnToken: context.currentTurnToken || context.currentTurnTokenRef?.current,
        actionToken: context.currentTurnToken || context.currentTurnTokenRef?.current,
        authoritativeTurn: context.authoritativeInitiativeTurn || null,
        getTacticalMemory: context.getArmoredTacticalMemory,
        rng: context.armoredTechniqueRng,
        rngSource: context.armoredTechniqueRngSource || "player-ai",
        source: "player-ai",
        addLog,
      });
    } catch (error) {
      addLog?.({
        audience: "developer",
        channel: "ai",
        eventType: "armored-selection-runtime-fallback",
        level: "error",
        type: "error",
        actorId: player.id,
        targetId: target.id,
        message: `armored selection runtime fallback: actor=${player.name} target=${target.name} error=${error?.message || String(error)}`,
        data: { error: error?.message || String(error), source: "player-ai" },
      }, "error");
      armoredAction = {
        actionType: "attack",
        technique: "longsword-cut",
        weapon: {
          ...(selectedAttack.weapon || selectedAttack),
          attackMode: "longsword-cut",
          selectedTechnique: "longsword-cut",
          armorTechnique: "longsword-cut",
          armoredActionPlan: {
            actionType: "attack",
            selectedTechnique: "longsword-cut",
            attackerId: player.id,
            defenderId: target.id,
            generationId: context.combatSession || context.combatSessionRef?.current || "default",
            round: context.meleeRound,
            initiativeIndex: context.turnIndexRef?.current,
            turnToken: context.currentTurnToken || context.currentTurnTokenRef?.current,
            source: "armored-selection-runtime-fallback",
          },
        },
      };
    }
    if (armoredAction?.suppressed) {
      scheduleEndTurn?.(0, "player-ai-offensive-suppressed");
      return;
    }
    if (armoredAction?.technique) {
      if (armoredAction.actionType === "grapple" && typeof dispatchGrappleTurnAction === "function") {
        addLog?.(`${player.name} closes to grapple the armored opponent.`, "info");
        addLog?.({
          audience: "developer",
          channel: "ai",
          eventType: "armored-action-plan-dispatched",
          level: "info",
          type: "debug",
          actorId: player.id,
          targetId: target.id,
          message: `armored action plan dispatched: actor=${player.name} target=${target.name} technique=${armoredAction.technique}`,
          data: { actionType: armoredAction.actionType, selectedTechnique: armoredAction.technique, source: "player-ai" },
        }, "debug");
        markActionScheduled();
        if (dispatchGrappleTurnAction(player, target, null, armoredAction.armoredActionPlan, {
          continuationAuthorization,
          continuationKey: continuationAuthorization?.continuationKey || null,
          requestedActionSequence: continuationAuthorization?.nextActionSequence ?? null,
          nextActionSequence: continuationAuthorization?.nextActionSequence ?? null,
          initiativeTurnId: continuationAuthorization?.initiativeTurnId || context.initiativeTurnId || null,
          source: continuationAuthorization ? "remaining-action-continuation" : "player-ai-armored-grapple",
        })) {
          return createPlayerAiActionResult("grapple", {
            reason: "armored-grapple-dispatched",
            armoredAction,
          });
        }
        if (playerAIActionScheduledRef) playerAIActionScheduledRef.current = false;
      } else {
        selectedAttack = armoredAction.weapon;
        attackName = selectedAttack.name;
        addLog?.({
          audience: "developer",
          channel: "ai",
          eventType: "armored-action-plan-dispatched",
          level: "info",
          type: "debug",
          actorId: player.id,
          targetId: target.id,
          message: `armored action plan dispatched: actor=${player.name} target=${target.name} technique=${armoredAction.technique}`,
          data: selectedAttack.armoredActionPlan || { actionType: "attack", selectedTechnique: armoredAction.technique, source: "player-ai" },
        }, "debug");
        if (armoredAction.technique === "half-sword-thrust") {
          addLog?.(`${player.name} shifts to a half-sword grip.`, "info");
        } else if (armoredAction.technique === "pommel-or-crossguard-strike") {
          addLog?.(`${player.name} reverses the sword and strikes with the pommel.`, "info");
        }
      }
    }
  }

  // Check if player needs to move closer to attack
  let needsToMoveCloser = false;

  if (target && positions[player.id] && positions[target.id]) {
    try {
      currentDistance = calculateDistance(
        positions[player.id],
        positions[target.id]
      );
      // Use proper weapon range validation
      // If this is a melee attack and the attacker is airborne but the target is grounded,
      // treat the attacker as able to descend for the attack (prevents "hover forever" stalemates).
      const atkName = String(selectedAttack?.name || "").toLowerCase();
      const atkType = String(selectedAttack?.type || "").toLowerCase();
      const atkRangeNum =
        typeof selectedAttack?.range === "number"
          ? selectedAttack.range
          : Number(selectedAttack?.range);
      const isRangedLike =
        atkType === "ranged" ||
        atkName.includes("bow") ||
        atkName.includes("crossbow") ||
        atkName.includes("sling") ||
        atkName.includes("thrown") ||
        (Number.isFinite(atkRangeNum) && atkRangeNum > 10);
      const attackerAlt = getAltitude(player) || 0;
      const targetAlt = getAltitude(target) || 0;
      const targetIsAirborne = isFlying(target) && targetAlt > 0;
      const shouldAutoDescendForMelee =
        !hasRangedWeapon &&
        !isRangedLike &&
        attackerAlt > 0 &&
        !targetIsAirborne &&
        targetAlt <= 5;
      const attackerForRangeCheck = shouldAutoDescendForMelee
        ? { ...player, altitude: 0, altitudeFeet: 0 }
        : player;
      if (dbg && shouldAutoDescendForMelee) {
        trace(
          `auto-descend: enabling melee-vs-ground range check | fromAlt=${attackerAlt}ft`
        );
      }
      const rangeValidation = validateWeaponRange(
        attackerForRangeCheck,
        target,
        selectedAttack,
        currentDistance
      );
      needsToMoveCloser = !rangeValidation.canAttack;
    } catch (error) {
      console.error("Error in range validation:", error);
      needsToMoveCloser = true; // Default to needing to move closer
    }
  }

  // Handle movement if needed
  if (
    needsToMoveCloser &&
    target &&
    positions[player.id] &&
    positions[target.id]
  ) {
    try {
      const currentPos = positions[player.id];
      const targetPos = positions[target.id];
      const speed =
        player.Spd ||
        player.spd ||
        player.attributes?.Spd ||
        player.attributes?.spd ||
        10;

      // Initialize or reset movement attempts tracker for this fighter/turn
      const attemptKey = `${player.id}-${turnCounter}`;
      if (!movementAttemptsRef.current[attemptKey]) {
        movementAttemptsRef.current[attemptKey] = {
          count: 0,
          lastDistance: currentDistance,
          lastPosition: { ...currentPos },
        };
      }
      const movementTracker = movementAttemptsRef.current[attemptKey];
      if (movementTracker.lastDistance == null) {
        movementTracker.lastDistance = currentDistance;
      }
      if (!movementTracker.lastPosition) {
        movementTracker.lastPosition = { ...currentPos };
      }

      // Prevent infinite loops: max 3 movement attempts per turn
      if (movementTracker.count >= 3) {
        addLog(
          `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â« ${player.name} has tried to move 3 times and cannot reach target - ending turn`,
          "error"
        );
        processingPlayerAIRef.current = false;
        scheduleEndTurn(0, "movement-attempt-limit");
        return;
      }

      // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ FIX: Check if distance actually improved from last attempt
      // Also check if combat ended or target is no longer valid
      if (!combatActive) {
        addLog(`ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Combat ended, ${player.name} stops moving`, "info");
        processingPlayerAIRef.current = false;
        return;
      }

      // Check if target is still valid (conscious and alive)
      if (target && (target.currentHP <= 0 || target.currentHP <= -21)) {
        addLog(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name}'s target is no longer valid, ending turn`,
          "info"
        );
        processingPlayerAIRef.current = false;
        scheduleEndTurn(0, "non-improving-approach");
        return;
      }

      if (
        movementTracker.count > 0 &&
        currentDistance >= movementTracker.lastDistance
      ) {
        addLog(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} movement not improving distance (${Math.round(
            currentDistance
          )}ft >= ${Math.round(movementTracker.lastDistance)}ft) - ending turn`,
          "warning"
        );
        processingPlayerAIRef.current = false;
        scheduleEndTurn();
        return;
      }

      movementTracker.count++;
      movementTracker.lastDistance = currentDistance;

      // Check for flanking opportunities
      const flankingPositions = findFlankingPositions(
        targetPos,
        positions,
        player.id
      );
      const currentFlankingBonus = calculateFlankingBonus(
        currentPos,
        targetPos,
        positions,
        player.id
      );

      // If we can flank, prioritize flanking positions
      // BUT: Check if target is reachable with melee first
      if (flankingPositions.length > 0 && currentFlankingBonus === 0) {
        // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ FIX: Don't attempt ground flanking if target is flying and player isn't
        const targetIsFlying =
          target.isFlying || (target.altitudeFeet ?? target.altitude ?? 0) > 0;
        const playerIsFlying =
          player.isFlying || (player.altitudeFeet ?? player.altitude ?? 0) > 0;

        if (targetIsFlying && !playerIsFlying) {
          addLog(
            `ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ ${player.name} skips flanking ${target.name} (target is flying, player is grounded - use techniques/ranged instead)`,
            "warning"
          );
          markTargetUnreachable(player, target);
          // Don't attempt flanking if target is flying and player isn't - skip to next action
        } else if (!canThreatenWithMelee(player, target)) {
          addLog(
            `ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ ${player.name} skips flanking ${target.name} (target unreachable in melee)`,
            "warning"
          );
          markTargetUnreachable(player, target);
          // Don't attempt flanking if target is unreachable - skip to next action
        } else {
          // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ NEW: Check if melee requires dive attack (player flying, target on ground)
          const playerIsFlyingCheck =
            player.isFlying || (player.altitudeFeet ?? 0) > 0;
          const targetIsFlyingCheck =
            target.isFlying || (target.altitudeFeet ?? 0) > 0;
          if (playerIsFlyingCheck && !targetIsFlyingCheck) {
            // Pre-check: if player is flying and target is on ground, validate if dive is needed
            const preRangeCheck = validateWeaponRange(
              player,
              target,
              selectedAttack,
              currentDistance
            );
            const reasonLower = (preRangeCheck.reason || "").toLowerCase();
            if (
              reasonLower.includes("dive attack required") ||
              reasonLower.includes("too far below")
            ) {
              addLog(
                `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ ${player.name} skips flanking ${target.name} (dive attack required - use techniques or dive instead)`,
                "ai"
              );
              markTargetUnreachable(player, target);
              // Skip flanking, will fall through to technique selection
            } else {
              addLog(
                `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¯ ${player.name} considers flanking ${target.name}`,
                "info"
              );
            }
          } else {
            addLog(
              `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¯ ${player.name} considers flanking ${target.name}`,
              "info"
            );
          }

          // Find the best flanking position (closest to current position)
          const bestFlankPos = flankingPositions.reduce((best, current) => {
            const bestDist = calculateDistance(currentPos, best);
            const currentDist = calculateDistance(currentPos, current);
            return currentDist < bestDist ? current : best;
          });

          // Check if we can reach the flanking position
          const flankDistance = calculateDistance(currentPos, bestFlankPos);
          const maxMoveDistance = speed * 5; // 5 feet per hex

          if (flankDistance <= maxMoveDistance) {
            addLog(
              `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¯ ${player.name} attempts to flank ${target.name}`,
              "info"
            );

            // Move to flanking position
            if (typeof commitPlayerAIPosition === "function") {
              commitPlayerAIPosition(player, bestFlankPos, "player-ai-flanking");
            } else {
              setPositions((prev) => {
                const updated = {
                  ...prev,
                  [player.id]: bestFlankPos,
                };
                positionsRef.current = updated;
                return updated;
              });
            }

            // Deduct movement action cost
            const movementCost = Math.ceil(flankDistance / (speed * 5));
            setFighters((prev) =>
              prev.map((f) =>
                f.id === player.id
                  ? {
                      ...f,
                      remainingActions: Math.max(
                        0,
                        f.remainingActions - movementCost
                      ),
                    }
                  : f
              )
            );

            addLog(
              `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¯ ${player.name} targets flanking position (${bestFlankPos.x}, ${bestFlankPos.y})`,
              "info"
            );
            addLog(
              `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â ${player.name} moves ${Math.round(flankDistance)}ft to flanking position (${bestFlankPos.x}, ${bestFlankPos.y})`,
              "info"
            );

            // Claim this turn before yielding to the post-move continuation.
            markActionScheduled();
            claimPlayerAIContinuation?.({
              source: "player-ai-flanking-continuation",
              timeoutMs: 6500,
            });
            let flankingContinuationStarted = false;
            // Continue with attack after movement - use updated positions from state
            setTimeout(() => {
              if (!tokenStillValid()) {
                completePlayerAIContinuation?.("player-ai-flanking-continuation-stale");
                return;
              }
              if (pendingTurnAdvanceRef?.current) {
                completePlayerAIContinuation?.("player-ai-flanking-continuation-advance-pending");
                return;
              }
              if (!combatActive) {
                completePlayerAIContinuation?.("player-ai-flanking-continuation-combat-ended");
                return;
              }
              // Read the canonical position ref directly. React state updaters may replay,
              // so they must not be used to launch continuation side effects.
              const currentPositions = positionsRef.current || positions;
              positionsRef.current = currentPositions;
              if (flankingContinuationStarted) return;
              flankingContinuationStarted = true;
              // Check range after position update
              setTimeout(() => {
                  void (async () => {
                    const abortFlankingContinuation = (reason = "flanking continuation aborted") => {
                    addLog(`flanking continuation stopped: reason=${reason}`, "warning");
                    addLog(`ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª ${reason}`, "debug");
                    if (turnActionResolvingRef) turnActionResolvingRef.current = false;
                    if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
                      processingPlayerAIRef.current = false;
                      completePlayerAIContinuation?.("player-ai-flanking-continuation-abort");
                      scheduleEndTurn(0, "player-ai-flanking-continuation-abort");
                  };

                  try {
                  if (!tokenStillValid()) {
                    abortFlankingContinuation("stale token");
                    return;
                  }
                  if (pendingTurnAdvanceRef?.current) {
                    abortFlankingContinuation("turn advance pending");
                    return;
                  }
                  if (!combatActive) {
                    abortFlankingContinuation("combat inactive");
                    return;
                  }
                  const continuationPositions = positionsRef.current || currentPositions;
                  const actualFlankPos =
                    continuationPositions[player.id] || bestFlankPos;
                  const actualTargetPos =
                    continuationPositions[target.id] || targetPos;
                  const liveFighters = fightersRef?.current || fighters;
                  const livePlayer =
                    liveFighters.find((f) => f.id === player.id) || player;
                  const liveTarget =
                    liveFighters.find((f) => f.id === target.id) || target;
                  if (isSameCombatActor(livePlayer, liveTarget) || !isHostileTarget(liveTarget)) {
                    abortFlankingContinuation("target is self or no longer hostile");
                    return;
                  }
                  const newDistance = calculateDistance(
                    actualFlankPos,
                    actualTargetPos
                  );
                  let rangeValidation;
                  rangeValidation = validateWeaponRange(
                    livePlayer,
                    liveTarget,
                    selectedAttack,
                    newDistance
                  );
                  addLog(
                    `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª flanking post-move continuation: inRange=${!!rangeValidation.canAttack}`,
                    "debug"
                  );

                  if (rangeValidation.canAttack) {
                    addLog(
                      `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â ${player.name} is now ${Math.round(newDistance)}ft from ${target.name}.`,
                      "info"
                    );
                    let flankingBonus = 0;
                    try {
                      flankingBonus = calculateFlankingBonus(
                        actualFlankPos,
                        actualTargetPos,
                        continuationPositions,
                        player.id
                      );
                    } catch (err) {
                      console.error("[playerTurnAI] flanking bonus calculation failed:", err);
                      abortFlankingContinuation(`flanking bonus failed: ${err?.message || String(err)}`);
                      return;
                    }
                    if (flankingBonus > 0) {
                      addLog(
                        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¯ ${player.name} gains flanking bonus (+${flankingBonus} to hit)!`,
                        "info"
                      );
                    }

                    // Execute attack with flanking bonus
                    const updatedPlayer = {
                      ...livePlayer,
                      selectedAttack: selectedAttack,
                    };
                    const bonuses = flankingBonus > 0 ? { flankingBonus } : {};
                    if (!tokenStillValid()) {
                      abortFlankingContinuation("stale token before attack");
                      return;
                    }
                    if (pendingTurnAdvanceRef?.current) {
                      abortFlankingContinuation("turn advance pending before attack");
                      return;
                    }
                    if (!combatActive) {
                      abortFlankingContinuation("combat inactive before attack");
                      return;
                    }
                    const remainingActionsAfterMovement = Number(livePlayer?.remainingActions);
                    if (
                      Number.isFinite(remainingActionsAfterMovement) &&
                      remainingActionsAfterMovement <= 0
                    ) {
                      addLog(
                        "flanking continuation skipped attack: no actions remaining after movement",
                        "warning",
                      );
                      completePlayerAIContinuation?.("player-ai-flanking-move-only");
                      if (turnActionResolvingRef) turnActionResolvingRef.current = false;
                      if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
                      processingPlayerAIRef.current = false;
                      scheduleEndTurn(16, "player-ai-flanking-move-only");
                      return;
                    }
                    // Selection is deliberately ownership-free: a flanking continuation
                    // may resolve into either an ordinary attack or a dedicated grapple.
                    const completedMovementSequence = Math.max(1, Number(context.getActionSequence?.() ?? 0) + 1);
                    context.setActionSequence?.(completedMovementSequence);
                    const movementContinuationAdmission = createFiredActionContinuationReceipt?.({
                      actorId: livePlayer.id,
                      opponentId: liveTarget.id,
                      completedActionType: "movement",
                      completedActionSequence: completedMovementSequence,
                      remainingActions: remainingActionsAfterMovement,
                      source: "player-ai-flanking-movement",
                    }) || null;
                    let flankingAttackGrant = null;
                    let flankingAttackActionId = null;
                    let flankingAttackSettled = false;
                    let flankingAttackWatchdog = null;
                    try {
                      let flankingAttackData = selectedAttack;
                      const flankingArmoredAction = resolveArmoredCombatAction({
                        attacker: livePlayer,
                        defender: liveTarget,
                        selectedWeapon: flankingAttackData?.weapon || flankingAttackData,
                        distance: newDistance,
                        remainingActions: livePlayer.remainingActions,
                        generationId: context.combatSession || context.combatSessionRef?.current || "default",
                        round: context.meleeRound,
                        initiativeIndex: context.turnIndexRef?.current,
                        initiativeTurnId: context.initiativeTurnIdRef?.current || context.initiativeTurnId,
                        turnToken: currentTurnToken || currentTurnTokenRef?.current,
                        actionToken: currentTurnToken || currentTurnTokenRef?.current,
                        authoritativeTurn: context.authoritativeInitiativeTurn || null,
                        getTacticalMemory: context.getArmoredTacticalMemory,
                        rng: context.armoredTechniqueRng,
                        rngSource: context.armoredTechniqueRngSource || "player-ai-flanking-continuation",
                        source: "player-ai-flanking-continuation",
                        addLog,
                      });
                      if (flankingArmoredAction?.suppressed) {
                        flankingAttackSettled = true;
                        clearTimeout(flankingAttackWatchdog);
                        completePlayerAIContinuation?.("player-ai-flanking-armored-suppressed");
                        scheduleEndTurn(16, "player-ai-flanking-armored-suppressed");
                        return;
                      }
                      addLog?.({
                        audience: "developer",
                        channel: "ai",
                        eventType: "flanking-armored-action-resolved",
                        level: "info",
                        type: "debug",
                        actorId: livePlayer.id,
                        targetId: liveTarget.id,
                        source: "player-ai-flanking-continuation",
                        message: `flanking armored action resolved: actorId=${livePlayer.id} actionType=${flankingArmoredAction?.actionType || "attack"}`,
                        data: { actionType: flankingArmoredAction?.actionType || "attack", armoredActionPlan: flankingArmoredAction?.armoredActionPlan || null },
                      }, "debug");
                      if (flankingArmoredAction?.actionType === "grapple" && typeof dispatchGrappleTurnAction === "function") {
                        flankingAttackSettled = true;
                        // The movement continuation is not an attack owner. Release its
                        // latch so the dedicated grapple dispatcher can own this action.
                        if (turnActionResolvingRef) turnActionResolvingRef.current = false;
                        addLog?.({
                          audience: "developer",
                          channel: "ai",
                          eventType: "flanking-grapple-dispatch-started",
                          level: "info",
                          type: "debug",
                          actorId: livePlayer.id,
                          targetId: liveTarget.id,
                          source: "player-ai-flanking-continuation",
                          message: `flanking grapple dispatch started: actorId=${livePlayer.id} targetId=${liveTarget.id}`,
                          data: { armoredActionPlan: flankingArmoredAction.armoredActionPlan || null },
                        }, "debug");
                        addLog("flanking continuation dispatching armored grapple plan", "debug");
                        const grappleResult = dispatchGrappleTurnAction(
                          livePlayer,
                          liveTarget,
                          null,
                          flankingArmoredAction.armoredActionPlan,
                          movementContinuationAdmission,
                        );
                        if (grappleResult?.terminal === true || grappleResult) {
                          completePlayerAIContinuation?.("player-ai-flanking-grapple-dispatched");
                          addLog?.({
                            audience: "developer",
                            channel: "turn",
                            eventType: "player-flanking-grapple-terminal-return-propagated",
                            level: "info",
                            type: "debug",
                            actorId: livePlayer.id,
                            targetId: liveTarget.id,
                            source: "player-ai-flanking-continuation",
                            message: `player flanking grapple terminal return propagated: actorId=${livePlayer.id}`,
                            data: { handled: true, terminal: true, routeType: "grapple-terminal", result: grappleResult },
                          }, "debug");
                          return;
                        }
                        completePlayerAIContinuation?.("player-ai-flanking-grapple-failed");
                        scheduleEndTurn(16, "player-ai-flanking-grapple-failed");
                        return;
                      }
                      if (flankingArmoredAction?.technique && flankingArmoredAction?.weapon) {
                        flankingAttackData = flankingArmoredAction.weapon;
                      }
                      if (turnActionResolvingRef) turnActionResolvingRef.current = true;
                      flankingAttackGrant =
                        typeof createAttackActionGrant === "function"
                          ? createAttackActionGrant(player.id, liveTarget.id, "player-ai-flanking-continuation")
                          : null;
                      flankingAttackActionId =
                        typeof createAttackExecutionKey === "function"
                          ? createAttackExecutionKey(player.id, liveTarget.id, "player-ai-flanking-continuation", {
                              grant: flankingAttackGrant,
                              scheduledAtTurnToken: flankingAttackGrant?.turnToken || currentTurnToken || "no-turn-token",
                              callbackSource: "player-ai-flanking-continuation",
                              isDelayedCallback: true,
                            })
                          : `player-ai-flank-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                      addLog?.({
                        audience: "developer",
                        channel: "ai",
                        eventType: "flanking-attack-execution-key-created",
                        level: "info",
                        type: "debug",
                        actorId: livePlayer.id,
                        targetId: liveTarget.id,
                        executionKey: flankingAttackActionId,
                        source: "player-ai-flanking-continuation",
                        message: `flanking attack execution key created: actorId=${livePlayer.id} executionKey=${flankingAttackActionId}`,
                      }, "debug");
                      flankingAttackWatchdog = setTimeout(() => {
                        if (flankingAttackSettled || !flankingAttackActionId) return;
                        if (!pendingTurnAdvanceRef?.current && turnActionResolvingRef?.current && combatActiveRef?.current !== false && !combatOverRef?.current && tokenStillValid()) {
                          flankingAttackSettled = true;
                          addLog("flanking continuation exception: attack did not settle", "warning");
                          clearPlayerAIContinuationAttack?.(flankingAttackActionId, "flanking-attack-watchdog");
                          turnActionResolvingRef.current = false;
                          if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
                          processingPlayerAIRef.current = false;
                          completePlayerAIContinuation?.("player-ai-flanking-continuation-timeout");
                          scheduleEndTurn(16, "player-ai-flanking-continuation-timeout");
                        }
                      }, 5000);
                      addLog("flanking continuation calling attack after armored action resolution", "debug");
                      addLog(
                        `flanking continuation attack start attacker=${livePlayer.name} target=${liveTarget.name} weapon=${flankingAttackData?.name || "unknown"}`,
                        "debug",
                      );
                      const attackOutcome = await attack(updatedPlayer, liveTarget.id, {
                        ...bonuses,
                        continuationAuthorization: movementContinuationAdmission?.continuationAuthorization || null,
                        requestedActionSequence: movementContinuationAdmission?.nextActionSequence || null,
                        attackActionId: flankingAttackActionId,
                        attackActionGrant: flankingAttackGrant,
                        attackDataOverride: flankingAttackData,
                        attackerPosOverride: actualFlankPos,
                        defenderPosOverride: actualTargetPos,
                        distanceOverride: newDistance,
                      });
                      completePlayerAIContinuation?.(
                        getPlayerAiContinuationBlockReason(attackOutcome)
                          ? "player-ai-flanking-continuation-blocked"
                          : "player-ai-flanking-continuation-resolved",
                      );
                      const blockedReason = getPlayerAiContinuationBlockReason(attackOutcome);
                      if (blockedReason) {
                        flankingAttackSettled = true;
                        clearTimeout(flankingAttackWatchdog);
                        addLog(
                          `flanking continuation attack blocked: reason=${blockedReason} attacker=${livePlayer.name} target=${liveTarget.name}`,
                          "warning",
                        );
                        clearPlayerAIContinuationAttack?.(
                          flankingAttackActionId,
                          `flanking-blocked:${blockedReason}`,
                        );
                        if (turnActionResolvingRef) turnActionResolvingRef.current = false;
                        if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
                        scheduleEndTurn(16, "player-ai-flanking-continuation-blocked");
                        return;
                      }
                      flankingAttackSettled = true;
                      clearTimeout(flankingAttackWatchdog);
                      addLog(
                        `flanking continuation attack resolved attacker=${livePlayer.name} result=${attackOutcome?.accepted ? "scheduled" : "resolved"}`,
                        "debug",
                      );
                      scheduleEndTurn(16, "player-ai-flanking-continuation-resolved");
                    } catch (err) {
                      flankingAttackSettled = true;
                      clearTimeout(flankingAttackWatchdog);
                      console.error("[playerTurnAI] flanking attack failed:", err);
                      addLog(
                        `flanking continuation exception: ${err?.message || String(err)}`,
                        "warning"
                      );
                      addLog(
                        `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Player AI attack failed: ${err?.message || String(err)}`,
                        "warning"
                      );
                      clearPlayerAIContinuationAttack?.(
                        flankingAttackActionId,
                        "flanking-attack-exception",
                      );
                      if (turnActionResolvingRef) turnActionResolvingRef.current = false;
                      if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
                      scheduleEndTurn(16, "player-ai-flank-attack-catch");
                    } finally {
                      processingPlayerAIRef.current = false;
                    }
                  } else {
                    const reasonLower = String(
                      rangeValidation.reason || ""
                    ).toLowerCase();
                    const isMeleeSpecificError =
                      reasonLower.includes("melee") ||
                      reasonLower.includes("flying too high") ||
                      reasonLower.includes("to be reached by melee");
                    if (
                      !(isRangedLikeAttack(selectedAttack) && isMeleeSpecificError)
                    ) {
                      addLog(
                        `ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ ${player.name} cannot reach ${target.name} from flanking position (${rangeValidation.reason})`,
                        "warning"
                      );
                    }

                    // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ NEW: If "dive attack required" and player is flying, skip retry loop
                    const playerIsFlying =
                      player.isFlying || (player.altitudeFeet ?? 0) > 0;
                    const targetIsFlying =
                      target.isFlying || (target.altitudeFeet ?? 0) > 0;
                    const requiresDive =
                      reasonLower.includes("dive attack required") ||
                      reasonLower.includes("too far below");

                    if (playerIsFlying && !targetIsFlying && requiresDive) {
                      // Player is flying, target is on ground, melee requires dive
                      // Skip the retry loop - either dive or use techniques
                      addLog(
                        `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ ${player.name} is flying too high for melee - will use techniques or dive attack instead`,
                        "ai"
                      );
                      markTargetUnreachable(player, target);
                      processingPlayerAIRef.current = false;
                      scheduleEndTurn();
                      return;
                    }

                    finalizeApproachMoveOnly("player-ai-flanking-move-only");
                    return;

                    // Check if we should continue trying to move closer - use closure variables
                    setTimeout(() => {
                      const updatedPlayerState = fighters.find(
                        (f) => f.id === player.id
                      );
                      const attemptKey = `${player.id}-${turnCounter}`;
                      const currentTracker =
                        movementAttemptsRef.current[attemptKey];

                      if (
                        updatedPlayerState &&
                        updatedPlayerState.remainingActions > 0 &&
                        currentTracker &&
                        currentTracker.count < 3 &&
                        newDistance < currentDistance
                      ) {
                        // Distance improved, continue trying to move closer
                        addLog(
                          `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€ Ã¢â‚¬â„¢ ${player.name} continues moving towards ${
                            target.name
                          } (${Math.round(newDistance)}ft, attempt ${
                            currentTracker.count + 1
                          }/3)...`,
                          "info"
                        );
                        // Update movement tracker
                        currentTracker.lastDistance = newDistance;
                        currentTracker.lastPosition = actualFlankPos;
                        currentTracker.count++;
                        // Continue movement logic by triggering another movement attempt
                        if (combatActive && !processingPlayerAIRef.current) {
                          processingPlayerAIRef.current = true;
                          setTimeout(() => {
                            // Recursive call - but we need to pass the context
                            // For now, we'll just schedule end turn and let the next turn handle it
                            processingPlayerAIRef.current = false;
                            scheduleEndTurn();
                          }, 500);
                        } else {
                          processingPlayerAIRef.current = false;
                          scheduleEndTurn();
                        }
                      } else {
                        // Can't continue - end turn
                        addLog(
                          `ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â­ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${
                            player.name
                          } cannot continue moving (attempts: ${
                            currentTracker?.count || 0
                          }/3, distance: ${Math.round(
                            newDistance
                          )}ft) - ending turn`,
                          "info"
                        );
                        processingPlayerAIRef.current = false;
                        scheduleEndTurn(0);
                      }
                    }, 500);
                  }
                  } catch (err) {
                    console.error("[playerTurnAI] flanking continuation failed:", err);
                    addLog(
                      `flanking continuation exception: ${err?.message || String(err)}`,
                      "warning"
                    );
                    abortFlankingContinuation(`exception: ${err?.message || String(err)}`);
                  }
                })();
              }, 100);
            }, 1000);
            return createPlayerAiActionResult("pending-continuation", {
              pendingContinuation: true,
              movement: "flank",
            });
          }
        } // Close the else block for reachable flanking
      } // Close the if block for flankingPositions.length > 0

      // Use proper weapon range validation
      const rangeValidation = validateWeaponRange(
        player,
        target,
        selectedAttack,
        currentDistance
      );
      const weaponRange = rangeValidation.maxRange || 5.5;

      // Calculate how much we need to move to get into range
      const distanceNeeded = currentDistance - weaponRange;

      // Calculate movement per action using MOVEMENT_RATES
      const movementRates = MOVEMENT_RATES.calculateMovement(speed);
      const movementPerAction =
        movementRates.walking / (player.actionsPerRound || 1);
      const moveDistance = Math.min(distanceNeeded, movementPerAction);
      let hexesToMove = Math.max(
        1,
        Math.ceil(moveDistance / GRID_CONFIG.CELL_SIZE)
      );
      const hexDistanceToTarget = Math.ceil(
        currentDistance / GRID_CONFIG.CELL_SIZE
      );
      hexesToMove = Math.min(hexesToMove, Math.max(1, hexDistanceToTarget - 1));

      if (hexesToMove > 0) {
        const computeBeeDetour = (
          startHex,
          goalHex,
          stepsAllowed = 1,
          maxRings = 3
        ) => {
          if (!startHex || !goalHex) return null;
          const visited = new Set([`${goalHex.x},${goalHex.y}`]);
          const queue = [{ pos: goalHex, ring: 0 }];
          const candidateHexes = [];

          while (queue.length > 0) {
            const { pos, ring } = queue.shift();
            if (ring >= maxRings) continue;
            const neighbors = getHexNeighbors(pos.x, pos.y) || [];
            neighbors.forEach((neighbor) => {
              const key = `${neighbor.x},${neighbor.y}`;
              if (visited.has(key)) return;
              visited.add(key);
              if (!isValidPosition(neighbor.x, neighbor.y)) return;
              const nextRing = ring + 1;
              queue.push({ pos: neighbor, ring: nextRing });
              candidateHexes.push({ ...neighbor, ring: nextRing });
            });
          }

          if (candidateHexes.length === 0) return null;

          const openCandidates = candidateHexes.filter((hex) => {
            if (hex.x === goalHex.x && hex.y === goalHex.y) return false;
            if (hex.x === startHex.x && hex.y === startHex.y) return false;
            return !isHexOccupied(hex.x, hex.y, player.id);
          });

          if (openCandidates.length === 0) return null;

          openCandidates.sort((a, b) => {
            if (a.ring !== b.ring) return a.ring - b.ring;
            const distA = calculateDistance(startHex, a);
            const distB = calculateDistance(startHex, b);
            return distA - distB;
          });

          for (const candidate of openCandidates) {
            const path = findBeePath(
              { q: startHex.x, r: startHex.y },
              { q: candidate.x, r: candidate.y },
              (hex) => {
                if (!hex) return true;
                if (
                  !Number.isFinite(hex.q) ||
                  !Number.isFinite(hex.r) ||
                  hex.q < 0 ||
                  hex.q >= GRID_CONFIG.GRID_WIDTH ||
                  hex.r < 0 ||
                  hex.r >= GRID_CONFIG.GRID_HEIGHT
                ) {
                  return true;
                }
                if (hex.q === candidate.x && hex.r === candidate.y) {
                  return false;
                }
                return Boolean(isHexOccupied(hex.q, hex.r, player.id));
              }
            );

            if (path && path.length > 1) {
              const stepsToTake = Math.min(
                Math.max(1, stepsAllowed),
                path.length - 1
              );
              const destination = path[stepsToTake];
              if (!destination) continue;
              if (destination.q === startHex.x && destination.r === startHex.y)
                continue;

              return {
                destination: { x: destination.q, y: destination.r },
                path,
                goal: candidate,
                stepsTaken: stepsToTake,
                goalRing: candidate.ring,
              };
            }
          }

          return null;
        };

        const candidateMoves = [];
        const candidateKeys = new Set();
        const pushCandidateMove = (pos, label, type, meta = {}) => {
          if (!pos) return;
          if (!isValidPosition(pos.x, pos.y)) return;
          const key = `${pos.x},${pos.y}`;
          if (candidateKeys.has(key)) return;
          if (isHexOccupied(pos.x, pos.y, player.id)) return;
          candidateKeys.add(key);
          const distanceAfterMove = calculateDistance(pos, targetPos);
          candidateMoves.push({
            pos,
            label,
            type,
            meta,
            distance: distanceAfterMove,
          });
        };

        const dx = targetPos.x - currentPos.x;
        const dy = targetPos.y - currentPos.y;
        const linearDistance = Math.sqrt(dx * dx + dy * dy);

        if (linearDistance > 0) {
          const moveRatio = hexesToMove / linearDistance;
          let directX = Math.round(currentPos.x + dx * moveRatio);
          let directY = Math.round(currentPos.y + dy * moveRatio);

          if (directX === currentPos.x && directY === currentPos.y) {
            const dirX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
            const dirY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
            if (dirX !== 0 || dirY !== 0) {
              directX = currentPos.x + dirX;
              directY = currentPos.y + dirY;
            }
          }

          if (!isHexOccupied(directX, directY, player.id)) {
            pushCandidateMove(
              { x: directX, y: directY },
              `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ ${player.name} moves to position (${directX}, ${directY})`,
              "direct",
              { via: "direct" }
            );
          } else {
            for (let offset = 1; offset <= 2; offset += 1) {
              const testPositions = [
                { x: directX - offset, y: directY },
                { x: directX + offset, y: directY },
                { x: directX, y: directY - offset },
                { x: directX, y: directY + offset },
              ];

              testPositions.forEach((testPos) => {
                if (!isValidPosition(testPos.x, testPos.y)) return;
                if (isHexOccupied(testPos.x, testPos.y, player.id)) return;
                pushCandidateMove(
                  testPos,
                  `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ ${player.name} sidesteps to (${testPos.x}, ${testPos.y})`,
                  "sidestep",
                  { via: "sidestep" }
                );
              });
            }
          }
        }

        const beeDetour = computeBeeDetour(
          currentPos,
          targetPos,
          hexesToMove,
          3
        );
        if (beeDetour) {
          pushCandidateMove(
            beeDetour.destination,
            `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â ${player.name} reroutes via BeeLine to (${beeDetour.destination.x}, ${beeDetour.destination.y})`,
            "bee",
            beeDetour
          );
        }

        if (candidateMoves.length === 0) {
          addLog(
            `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â« ${player.name} cannot find path to target - no open hexes`,
            "warning"
          );
          addLog(`ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â­ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} loses this action trying to find a path.`, "info");
          setFighters((prev) =>
            prev.map((f) =>
              f.id === player.id
                ? { ...f, remainingActions: Math.max(0, (Number(f.remainingActions ?? 0) || 0) - 1) }
                : f
            )
          );
          processingPlayerAIRef.current = false;
          scheduleEndTurn();
          return;
        }

        candidateMoves.sort((a, b) => a.distance - b.distance);
        const previousDistance =
          movementTracker.lastDistance ?? currentDistance;
        let chosenMove = candidateMoves[0];

        if (chosenMove.distance >= previousDistance) {
          const improvedMove = candidateMoves.find(
            (move) => move.distance < previousDistance
          );
          if (improvedMove) {
            chosenMove = improvedMove;
          }
        }

        if (
          !chosenMove ||
          (chosenMove.pos.x === currentPos.x &&
            chosenMove.pos.y === currentPos.y)
        ) {
          addLog(
            `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â« ${player.name} cannot advance toward ${target.name} - blocked`,
            "info"
          );
          processingPlayerAIRef.current = false;
          scheduleEndTurn();
          return;
        }

        if (typeof commitPlayerAIPosition === "function") {
          commitPlayerAIPosition(player, chosenMove.pos, "player-ai-approach-move-only");
        } else {
          setPositions((prev) => {
            const updated = {
              ...prev,
              [player.id]: { x: chosenMove.pos.x, y: chosenMove.pos.y },
            };
            positionsRef.current = updated;
            return updated;
          });
        }

        if (chosenMove.type === "bee") {
          const stepsTaken = chosenMove.meta?.stepsTaken ?? 1;
          const goalRing = chosenMove.meta?.goalRing ?? 1;
          addLog(
            `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â ${player.name} follows BeeLine path (${stepsTaken} hex${
              stepsTaken > 1 ? "es" : ""
            }, ring ${goalRing})`,
            "info"
          );
        } else {
          addLog(chosenMove.label, "info");
        }

        const newDistance = chosenMove.distance;
        // Same auto-descend logic for post-move reachability checks.
        const atkName = String(selectedAttack?.name || "").toLowerCase();
        const atkType = String(selectedAttack?.type || "").toLowerCase();
        const atkRangeNum =
          typeof selectedAttack?.range === "number"
            ? selectedAttack.range
            : Number(selectedAttack?.range);
        const isRangedLike =
          atkType === "ranged" ||
          atkName.includes("bow") ||
          atkName.includes("crossbow") ||
          atkName.includes("sling") ||
          atkName.includes("thrown") ||
          (Number.isFinite(atkRangeNum) && atkRangeNum > 10);
        const attackerAlt = getAltitude(player) || 0;
        const targetAlt = getAltitude(target) || 0;
        const targetIsAirborne = isFlying(target) && targetAlt > 0;
        const shouldAutoDescendForMelee =
          !hasRangedWeapon &&
          !isRangedLike &&
          attackerAlt > 0 &&
          !targetIsAirborne &&
          targetAlt <= 5;
        const attackerForRangeCheck = shouldAutoDescendForMelee
          ? { ...player, altitude: 0, altitudeFeet: 0 }
          : player;
        const rangeValidation = validateWeaponRange(
          attackerForRangeCheck,
          target,
          selectedAttack,
          newDistance
        );
        const improved = newDistance + 0.01 < previousDistance;

        movementTracker.lastDistance = Math.min(previousDistance, newDistance);
        movementTracker.lastPosition = { ...chosenMove.pos };

        setFighters((prev) =>
          prev.map((f) => {
            if (f.id === player.id) {
              return {
                ...f,
                x: chosenMove.pos.x,
                y: chosenMove.pos.y,
                position: { x: chosenMove.pos.x, y: chosenMove.pos.y },
                hex: f.hex ? { x: chosenMove.pos.x, y: chosenMove.pos.y } : f.hex,
                remainingActions: Math.max(0, (f.remainingActions || 0) - 1),
              };
            }
            return f;
          })
        );

        if (!rangeValidation.canAttack) {
          if (!combatActive) {
            addLog(`ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Combat ended, ${player.name} stops moving`, "info");
            processingPlayerAIRef.current = false;
            return;
          }

          const updatedTargetState = fighters.find((f) => f.id === target.id);
          if (
            !updatedTargetState ||
            updatedTargetState.currentHP <= 0 ||
            updatedTargetState.currentHP <= -21
          ) {
            addLog(
              `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name}'s target is no longer valid, ending turn`,
              "info"
            );
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          }

          const reasonLower = String(rangeValidation.reason || "").toLowerCase();
          const isMeleeSpecificError =
            reasonLower.includes("melee") ||
            reasonLower.includes("flying too high") ||
            reasonLower.includes("to be reached by melee");
          if (!(isRangedLikeAttack(selectedAttack) && isMeleeSpecificError)) {
            addLog(
              `ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ ${player.name} still cannot reach ${target.name} for attack! (${rangeValidation.reason})`,
              "warning"
            );
          }

          finalizeApproachMoveOnly("player-ai-approach-move-only");
          return createPlayerAiActionResult("move", {
            movement: "approach",
          });
        } else {
          const livePositionsNow = positionsRef.current || positions;
          const liveFightersNow = fightersRef?.current || fighters;
          const livePlayer =
            liveFightersNow.find((f) => f.id === player.id) || player;
          const liveTarget =
            liveFightersNow.find((f) => f.id === target.id) || target;
          const liveAttackerPos = livePositionsNow?.[player.id] || chosenMove.pos;
          const liveTargetPos = livePositionsNow?.[target.id] || targetPos;
          const liveDistance =
            liveAttackerPos && liveTargetPos
              ? calculateDistance(liveAttackerPos, liveTargetPos)
              : newDistance;
          let liveRangeValidation;
          try {
            liveRangeValidation = validateWeaponRange(
              attackerForRangeCheck,
              liveTarget,
              selectedAttack,
              liveDistance
            );
          } catch (err) {
            console.error("[playerTurnAI] approach range validation failed:", err);
            addLog("approach continuation aborted safely", "warning");
            if (turnActionResolvingRef) turnActionResolvingRef.current = false;
            if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
            processingPlayerAIRef.current = false;
            scheduleEndTurn(0, "player-ai-approach-continuation-abort");
            return createPlayerAiActionResult("move", {
              movement: "approach",
            });
          }

          addLog(
            `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª approach post-move continuation: inRange=${!!liveRangeValidation.canAttack}`,
            "debug"
          );

          if (!liveRangeValidation.canAttack) {
            finalizeApproachMoveOnly("player-ai-approach-move-only");
            return createPlayerAiActionResult("move", {
              movement: "approach",
            });
          }

          addLog(
            `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ ${player.name} is now in range (${liveRangeValidation.reason})`,
            "info"
          );
          addLog(
            `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ ${player.name} attacking closest reachable target (${Math.round(liveDistance)}ft away) and attacks ${liveTarget.name} with ${attackName}!`,
            "info"
          );
          markActionScheduled();
          claimPlayerAIContinuation?.({
            source: "player-ai-approach-continuation",
            timeoutMs: 5000,
          });
          setTimeout(() => {
            void (async () => {
              if (!canRunPlayerAICallback({ token: playerAITurnToken, fighterId: player.id })) {
                addLog("approach continuation aborted safely", "warning");
                processingPlayerAIRef.current = false;
                scheduleEndTurn(0, "player-ai-approach-stale");
                return;
              }
              if (pendingTurnAdvanceRef?.current || !combatActive) {
                addLog("approach continuation aborted safely", "warning");
                if (turnActionResolvingRef) turnActionResolvingRef.current = false;
                if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
                processingPlayerAIRef.current = false;
                scheduleEndTurn(0, "player-ai-approach-continuation-abort");
                return;
              }
              if (turnActionResolvingRef) turnActionResolvingRef.current = true;
              try {
                await attack(
                  { ...livePlayer, aiConchampioned: true, selectedAttack },
                  liveTarget.id,
                  {
                    attackDataOverride: selectedAttack,
                    attackerPosOverride: liveAttackerPos,
                    defenderPosOverride: liveTargetPos,
                    distanceOverride: liveDistance,
                  }
                );
                completePlayerAIContinuation?.("player-ai-approach-continuation-resolved");
              } catch (err) {
                console.error("[playerTurnAI] approach attack failed:", err);
                addLog("approach continuation aborted safely", "warning");
                addLog(
                  `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Player AI approach attack failed: ${err?.message || String(err)}`,
                  "warning"
                );
                if (turnActionResolvingRef) turnActionResolvingRef.current = false;
                if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
                completePlayerAIContinuation?.("player-ai-approach-continuation-abort");
                scheduleEndTurn(16, "player-ai-approach-attack-catch");
              } finally {
                processingPlayerAIRef.current = false;
              }
            })();
          }, 100);
          return createPlayerAiActionResult("pending-continuation", {
            pendingContinuation: true,
            movement: "approach",
          });
        }
      }
    } catch (error) {
      console.error("Error in movement logic:", error);
      addLog(`ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢ ${player.name} movement failed: ${error.message}`, "error");
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return;
    }
  }

  // Execute attack
  addLog(
    `ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ ${player.name} ${reasoning} and attacks ${target.name} with ${attackName}!`,
    "info"
  );
  // Mark immediately so CombatPage's invariant doesn't end the turn before delayed execution happens.
  markActionScheduled();

  // Create updatedPlayer with selectedAttack
  const updatedPlayer = {
    ...player,
    aiConchampioned: true,
    selectedAttack: selectedAttack,
  };

  // Execute attack after ensuring position state is updated
  const executeAttack = (flankingBonus = 0) => {
    // Check for area attacks (like charge attacks)
    const isAreaAttack =
      selectedAttack.name.toLowerCase().includes("charge") ||
      selectedAttack.name.toLowerCase().includes("gore") ||
      selectedAttack.name.toLowerCase().includes("ram") ||
      selectedAttack.name.toLowerCase().includes("rush");

    if (isAreaAttack && isTargetBlocked(player.id, target.id, positions)) {
      const targetsInLine = getTargetsInLine(player.id, target.id, positions);

      if (targetsInLine.length > 0) {
        addLog(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¡ ${player.name} uses ${attackName} - area attack hitting ${targetsInLine.length} target(s)!`,
          "info"
        );

        // Execute area attack on all targets in line (one action, multiple targets)
        setTimeout(() => {
          void (async () => {
            if (!canRunPlayerAICallback({ token: playerAITurnToken, fighterId: player.id })) return;
            if (turnActionResolvingRef) turnActionResolvingRef.current = true;
            try {
              for (let index = 0; index < targetsInLine.length; index += 1) {
                if (!canRunPlayerAICallback({ token: playerAITurnToken, fighterId: player.id })) break;
                if (index > 0) {
                  await new Promise((r) => setTimeout(r, 500));
                }
                const lineTarget = targetsInLine[index];
                await attack(updatedPlayer, lineTarget.id, {
                  flankingBonus,
                  attackDataOverride: selectedAttack,
                  suppressEndTurn: true,
                });
              }
              scheduleEndTurn(0, "player-ai-area-line-complete");
            } catch (err) {
              console.error("[playerTurnAI] area line attack failed:", err);
              addLog(
                `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Player AI area attack failed: ${err?.message || String(err)}`,
                "warning"
              );
              if (turnActionResolvingRef) turnActionResolvingRef.current = false;
              if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
              scheduleEndTurn(16, "player-ai-area-line-catch");
            } finally {
              processingPlayerAIRef.current = false;
            }
          })();
        }, Math.max(500, targetsInLine.length * 400));
        return;
      }
    }

    // Execute attack - only ONE attack per turn
    setTimeout(() => {
      void (async () => {
      if (!canRunPlayerAICallback({ token: playerAITurnToken, fighterId: player.id })) return;
      // Get current fighter state to check remaining attacks before executing
      const currentFighterState = fighters.find((f) => f.id === player.id);

      // Check if fighter has attacks remaining before executing
      if (currentFighterState && currentFighterState.remainingActions <= 0) {
        addLog(`ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â ${player.name} is out of attacks this turn!`, "warning");
        processingPlayerAIRef.current = false;
        scheduleEndTurn(0);
        return;
      }

      const currentPositions = positionsRef.current || positions;
      const attackerPos = currentPositions?.[player.id] || null;
      const defenderPos = currentPositions?.[target.id] || null;
      const latestDistance =
        attackerPos && defenderPos
          ? calculateDistance(attackerPos, defenderPos)
          : undefined;

      if (!canRunPlayerAICallback({ token: playerAITurnToken, fighterId: player.id })) return;
      if (turnActionResolvingRef) turnActionResolvingRef.current = true;
      try {
        await attack(updatedPlayer, target.id, {
          flankingBonus,
          attackDataOverride: selectedAttack,
          attackerPosOverride: attackerPos,
          defenderPosOverride: defenderPos,
          distanceOverride: latestDistance,
          // If we're melee-only and currently airborne vs a grounded target, auto-descend before the attack.
          ...(function () {
            const atkName = String(selectedAttack?.name || "").toLowerCase();
            const atkType = String(selectedAttack?.type || "").toLowerCase();
            const atkRangeNum =
              typeof selectedAttack?.range === "number"
                ? selectedAttack.range
                : Number(selectedAttack?.range);
            const isRangedLike =
              atkType === "ranged" ||
              atkName.includes("bow") ||
              atkName.includes("crossbow") ||
              atkName.includes("sling") ||
              atkName.includes("thrown") ||
              (Number.isFinite(atkRangeNum) && atkRangeNum > 10);
            const attackerAlt = getAltitude(player) || 0;
            const targetAlt = getAltitude(target) || 0;
            const targetIsAirborne = isFlying(target) && targetAlt > 0;
            const shouldAutoDescendForMelee =
              !hasRangedWeapon &&
              !isRangedLike &&
              attackerAlt > 0 &&
              !targetIsAirborne &&
              targetAlt <= 5;
            if (!shouldAutoDescendForMelee) return {};
            if (dbg) {
              trace(
                `action: auto-descend before melee attack | fromAlt=${attackerAlt}ft`
              );
            }
            return {
              attackerStatePatch: {
                altitude: 0,
                altitudeFeet: 0,
                isFlying: false,
              },
            };
          })(),
        });
      } catch (err) {
        console.error("[playerTurnAI] attack failed:", err);
        addLog(
          `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Player AI attack failed: ${err?.message || String(err)}`,
          "warning"
        );
        if (turnActionResolvingRef) turnActionResolvingRef.current = false;
        if (pendingTurnAdvanceRef) pendingTurnAdvanceRef.current = false;
        scheduleEndTurn(16, "player-ai-main-attack-catch");
      } finally {
        // attack() schedules endTurn on success; clear processing after await returns.
        processingPlayerAIRef.current = false;
      }
      })();
    }, 500);
  };

  // Use a longer delay to ensure position state is fully updated, then execute attack
  markActionScheduled();
  setTimeout(() => {
    if (!tokenStillValid()) return;
    executeAttack(0); // No flanking bonus by default
  }, 1000);
  return { actionTaken: true, action: "attack" };
}

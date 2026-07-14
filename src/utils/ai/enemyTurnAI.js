/**
 * Enemy Turn AI Module
 *
 * Handles AI decision-making for enemy characters during combat.
 * This is a pure function module - no React hooks or state management.
 * All state updates are done via callbacks passed in the context.
 */

import CryptoSecureDice from "../cryptoDice";
import { getRandomCombatTechnique } from "../../data/combatTechniques";
import { getFighterTechniques } from "../getFighterTechniques.js";
import {
  ACTION_TYPES,
  addAiClaimToPatch,
  applyAiSkillEvents,
  buildAiWorldState,
  chooseAiAction,
  consumeAiUnlock,
  AI_KNOWLEDGE_SCOPE,
  resolveAiAction,
  updateAiMemoryAfterAction,
} from "../../ai";
import { createThreatProfile } from "./threatAnalysis";
import {
  getWeaknessMemoryForEnemy,
  recordWeaknessAttempt,
  recordWeaknessOutcome,
  mergeWeaknessMemory,
} from "./weaknessMemory";
import { tryKnowledgeCheck } from "./knowledgeChecks";
import { selectTechniqueForRole } from "./unifiedTechniqueSelection";
import {
  decayAwareness,
  updateAwareness,
  getAwareness,
  AWARENESS_STATES,
} from "../aiVisibilityFilter";
import { hasSpecialSenses } from "../stealthSystem";
import { calculatePerceptionCheck } from "../terrainSystem";
import { isRoutingOrPassiveTarget, prioritizeEnemyCombatTargets } from "./routedTargetPriority.js";
import { getWeaponRange } from "../distanceCombatSystem";
import { canFly, isFlying, getAltitude } from "../abilitySystem";
import { getSizeCategory, SIZE_CATEGORIES } from "../sizeStrengthModifiers";
import { getWeaponSizeForRace, WEAPON_SIZE } from "../weaponSizeSystem";
import {
  getCreatureSize,
  getCreatureSizeRank,
  getLegacyWeaponSizeCompatibility,
} from "../publicRulesAdapter";
import combatantBehaviorData from "../../data/combatantBehavior.json";
import {
  spendFlyingStamina,
  shouldLandToRest,
  recoverStamina,
} from "../combatFatigueSystem";
import {
  isScavenger,
  findNearbyCorpse,
  scavengeCorpse,
} from "../scavengingSystem";
import { findFoodItem, consumeItem } from "../consumptionSystem";
import { runFlyingTurn } from "./flyingBehaviorSystem";
import {
  pickBestPerchForFlyer,
  reservePerch,
  toSimpleAIObject,
} from "../treeAssetHelpers";
import {
  canThreatenWithMelee,
  canThreatenWithMeleeWithWeapon,
  markTargetUnreachable,
  isTargetUnreachable,
  getReachableEnemies,
  hasAnyValidOffensiveOption,
} from "./meleeReachabilityHelpers";
import {
  findRoutingDestination,
  getRoutingProfile,
  hasSatisfiedRoutingExit,
  resolveRoutedTurnRecovery,
} from "../routingSystem.js";
import {
  canTargetForAction,
  isAllyOf,
} from "../factionDisposition.js";
import { getSelectableActorAttackForDistance } from "../selectableActorAdapter.js";
import {
  getMeleeEngagementContext,
  isChargeOnlyAttack,
  selectMeleeAttackForContext,
} from "../meleeEngagementContext.js";
import { spendEnemyNoTargetAction } from "../enemyTurnScheduling.js";
import {
  formatEnemyMovementDebug,
  getCombatantFootprintHexes,
  resolveEnemyMovementBudget,
} from "../enemyClosingMovement.js";
import {
  chooseEnemyMovementFallback,
  executeEnemyMovementPlan,
  validateEnemyMovementPlan,
} from "../enemyMovementFallback.js";
import { decideEnemyTacticalIntentSafely } from "../enemyAttributeTacticalIntent.js";
import { markCombatantFled } from "../combatFledState.js";
import { normalizeMoraleState } from "../morale/moraleChecks.js";
import { evaluateMoraleTriggers } from "../morale/moraleTriggerChecks.js";
import { formatCombatActorLabel, isSameCombatActor } from "../combatActorIdentity.js";

// -----------------------------------------------------------------------------
// Weakness Memory Persistence (across encounters)
// - enemyTurnAI.js is "pure-ish", but module-scope + localStorage is fine in-browser.
// - If localStorage is unavailable, it gracefully degrades to in-memory only.
// -----------------------------------------------------------------------------

const AI_WEAKNESS_STORE_KEY = "mcs_ai_weakness_memory_v1";
const _inMemoryWeaknessStore = new Map(); // fallback if localStorage fails

function safeReadWeaknessStore() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(AI_WEAKNESS_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return null;
  }
}

function consumeUtilityAiUnlock({
  enemy,
  unlockType,
  setFighters,
  clearHidden = false,
}) {
  setFighters((prev) =>
    prev.map((fighter) => {
      if (fighter.id !== enemy.id) return fighter;

      const nextPatch = consumeAiUnlock(
        fighter.meta?.utilityPrivateWorldPatch ??
          fighter.meta?.utilityWorldPatch ??
          {},
        fighter.id,
        unlockType,
      );

      return {
        ...fighter,
        ...(clearHidden
          ? {
              hidden: false,
              isProwling: false,
              prowlState: {
                ...(fighter.prowlState || {}),
                hidden: false,
                prowlSuccess: false,
                brokenBy: unlockType,
              },
            }
          : null),
        meta: {
          ...(fighter.meta || {}),
          utilityPrivateWorldPatch: {
            ...nextPatch,
            scope: AI_KNOWLEDGE_SCOPE.PRIVATE,
            hiddenActorIds: clearHidden
              ? (nextPatch.hiddenActorIds ?? []).filter(
                  (id) => id !== fighter.id,
                )
              : nextPatch.hiddenActorIds,
          },
        },
      };
    }),
  );
}

function safeWriteWeaknessStore(obj) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    window.localStorage.setItem(AI_WEAKNESS_STORE_KEY, JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}

function getEnemyMemoryKey(enemy) {
  // Stable-ish key: prefer base species/name over ephemeral encounter ids.
  const base =
    enemy?.baseName ||
    enemy?.species ||
    enemy?.race ||
    enemy?.name ||
    enemy?.id ||
    "unknown_enemy";
  const profession = enemy?.PROFESSION || enemy?.profession || enemy?.class || "";
  return `${String(base).toLowerCase()}::${String(profession).toLowerCase()}`;
}

function getTargetMemoryKey(target) {
  const base =
    target?.baseName ||
    target?.species ||
    target?.race ||
    target?.name ||
    target?.id ||
    "unknown_target";
  const cat = target?.category || target?.type || target?.combatantType || "";
  return `${String(base).toLowerCase()}::${String(cat).toLowerCase()}`;
}

function isConcealedFighter(fighter) {
  return Boolean(
    fighter?.hidden || fighter?.isProwling || fighter?.prowlState?.hidden,
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

function revealAfterObviousMovement(
  fighter,
  setFighters,
  addLog,
  detail = "moving",
) {
  if (!isConcealedFighter(fighter) || typeof setFighters !== "function")
    return false;
  setFighters((prev) =>
    prev.map((f) =>
      f.id === fighter.id ? stripConcealment(f, "movement") : f,
    ),
  );
  addLog?.(
    `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¹Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${fighter.name} reveals ${fighter.type === "enemy" ? "its" : "their"} position by ${detail}.`,
    "info",
  );
  return true;
}

function logUtilityAiDecision(addLog, enemy, action) {
  if (!action) return;
  console.log("[UTILITY AI CHOICE]", {
    actor: enemy.name,
    chosen: action.name,
    score: action.score,
    reason: action.reason,
    alternatives: action.alternatives,
  });
  addLog?.(
    `${enemy.name} chooses ${action.name} (${action.score ?? "n/a"}) - ${
      action.reason || "utility scoring"
    }`,
    "debug",
  );
}

function logUtilityAiPerception(actor, utilityWorld) {
  const actorId = actor?.id ?? actor?._id ?? actor?.name;
  console.log("[UTILITY AI PERCEPTION]", {
    actor: actor?.name,
    visibleIds: utilityWorld.visibilityByActorId?.[actorId],
    hiddenActorIds: utilityWorld.hiddenActorIds,
    unlocks: utilityWorld.unlockedActionsByActorId?.[actorId],
    teamFocusTargetId: utilityWorld.teamFocusTargetId,
    teamTactics: utilityWorld.teamTactics,
    claims: utilityWorld.aiClaimsByRound?.[utilityWorld.round ?? 0],
    flags: utilityWorld.flags,
  });
}

function storeUtilityAiClaim({ enemy, action, utilityWorld, setFighters }) {
  setFighters((prev) =>
    prev.map((fighter) => {
      if (fighter.id !== enemy.id) return fighter;

      const claimPatch = addAiClaimToPatch(
        fighter.meta?.utilityTeamWorldPatch ?? {},
        fighter,
        action,
        utilityWorld,
      );

      return {
        ...fighter,
        meta: {
          ...(fighter.meta || {}),
          utilityTeamWorldPatch: {
            ...claimPatch,
            scope: AI_KNOWLEDGE_SCOPE.TEAM,
          },
        },
      };
    }),
  );
}

function dfocusatchUtilityCombatEvent(event, addLog) {
  if (!event) return;
  if (event.type === "LOG") {
    addLog?.(event.message, event.level || "info");
    return;
  }

  if (event.type === "AI_SKILL_ROLL") {
    addLog?.(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â² ${event.message}`, event.success ? "success" : "info");
    return;
  }

  addLog?.(`[AI EVENT] ${event.type}`, "debug");
}

function persistUtilityAiMemory({ enemy, action, result, world, setFighters }) {
  const nextMemory = updateAiMemoryAfterAction(
    world.aiMemory,
    enemy,
    action,
    result,
    world,
  );

  setFighters((prev) =>
    prev.map((fighter) =>
      fighter.id === enemy.id
        ? {
            ...fighter,
            meta: {
              ...(fighter.meta || {}),
              utilityAiMemory: nextMemory,
              utilityPrivateWorldPatch: {
                ...(fighter.meta?.utilityPrivateWorldPatch || {}),
                scope: AI_KNOWLEDGE_SCOPE.PRIVATE,
                aiMemory: nextMemory,
              },
            },
          }
        : fighter,
    ),
  );

  return nextMemory;
}

function applyUtilityWorldPatch({ enemy, appliedWorld, setFighters }) {
  const scope = appliedWorld.scope ?? AI_KNOWLEDGE_SCOPE.PRIVATE;
  const patchKey =
    scope === AI_KNOWLEDGE_SCOPE.TEAM
      ? "utilityTeamWorldPatch"
      : scope === AI_KNOWLEDGE_SCOPE.GLOBAL
        ? "utilityWorldPatch"
        : "utilityPrivateWorldPatch";

  setFighters((prev) =>
    prev.map((fighter) => {
      if (fighter.id !== enemy.id) return fighter;

      const isHidden = (appliedWorld.hiddenActorIds ?? []).includes(enemy.id);
      return {
        ...fighter,
        ...(isHidden
          ? {
              hidden: true,
              isProwling: true,
              prowlState: {
                ...(fighter.prowlState || {}),
                hidden: true,
                prowlSuccess: true,
              },
            }
          : null),
        meta: {
          ...(fighter.meta || {}),
          [patchKey]: {
            ...(fighter.meta?.[patchKey] || {}),
            scope,
            lastKnownEnemyByActorId: appliedWorld.lastKnownEnemyByActorId,
            flags: appliedWorld.flags,
            hiddenActorIds: appliedWorld.hiddenActorIds,
            unlockedActionsByActorId: appliedWorld.unlockedActionsByActorId,
            aiMemory: appliedWorld.aiMemory,
          },
        },
      };
    }),
  );
}

function getActionTarget(action, fighters) {
  if (!action?.targetId) return null;
  return fighters.find((fighter) => fighter.id === action.targetId) || null;
}

function moveTowardUtilityTarget({
  enemy,
  action,
  positions,
  calculateDistance,
  handlePositionChange,
  addLog,
}) {
  const currentPos = positions?.[enemy.id];
  const targetPos = action?.targetPos;
  if (!currentPos || !targetPos) return false;

  const dist = calculateDistance(currentPos, targetPos);
  if (!Number.isFinite(dist) || dist <= 5) return false;

  const stepFeet = Math.min(15, Math.max(5, dist - 5));
  const stepCells = stepFeet / 5;
  const dx = Number(targetPos.x ?? 0) - Number(currentPos.x ?? 0);
  const dy = Number(targetPos.y ?? 0) - Number(currentPos.y ?? 0);
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const destination = {
    x: Math.round(Number(currentPos.x ?? 0) + (dx / length) * stepCells),
    y: Math.round(Number(currentPos.y ?? 0) + (dy / length) * stepCells),
  };

  handlePositionChange(enemy.id, destination, {
    action: action.type,
    actionCost: 1,
    source: "UTILITY_AI",
  });
  addLog?.(
    `[AI] ${enemy.name} ${action.type === ACTION_TYPES.HUNT_ENEMY ? "hunts toward" : "moves toward"} (${destination.x}, ${destination.y}).`,
    "ai",
  );
  return true;
}

function loadPersistentWeaknessMemory(enemy) {
  const enemyKey = getEnemyMemoryKey(enemy);

  // 1) Try localStorage
  const store = safeReadWeaknessStore();
  if (store && store[enemyKey]) return store[enemyKey];

  // 2) Fallback to module memory
  return _inMemoryWeaknessStore.get(enemyKey) || {};
}

function savePersistentWeaknessMemory(enemy, memoryObj) {
  const enemyKey = getEnemyMemoryKey(enemy);

  // 1) Try localStorage
  const store = safeReadWeaknessStore();
  if (store) {
    store[enemyKey] = memoryObj || {};
    const ok = safeWriteWeaknessStore(store);
    if (ok) return;
  }

  // 2) Fallback
  _inMemoryWeaknessStore.set(enemyKey, memoryObj || {});
}

function inferCasterRole(enemy) {
  const name = (enemy?.name || enemy?.baseName || "").toLowerCase();
  const cat = (
    enemy?.category ||
    enemy?.type ||
    enemy?.combatantType ||
    ""
  ).toLowerCase();
  const profession = (
    enemy?.PROFESSION ||
    enemy?.profession ||
    enemy?.class ||
    enemy?.professionName ||
    enemy?.role ||
    ""
  ).toLowerCase();

  // Angel / Raider shortcuts
  if (name.includes("ariel") || cat.includes("angel")) return "angel";
  if (
    cat.includes("raider") ||
    name.includes("baal-rog") ||
    name.includes("baalrog")
  )
    return "raider";

  // Duelist / mage-ish
  if (
    profession.includes("duelist") ||
    profession.includes("mercenary") ||
    profession.includes("mage") ||
    cat.includes("duelist")
  )
    return "duelist";

  // Default: treat as duelist if it has techniques
  return "duelist";
}

function getEnemyTechniqueCatalog(enemy) {
  // Keep this permissive: your CombatPage may store techniques differently per combatant.
  // The unified selector can accept an array of technique objects.
  if (!enemy) return [];

  // Check techniqueBook first (used by Ariel and other unrestricted casters)
  if (Array.isArray(enemy.techniqueBook) && enemy.techniqueBook.length > 0) {
    return enemy.techniqueBook;
  }

  const direct =
    enemy.techniques ||
    enemy.combatTechniques ||
    enemy.training ||
    enemy.trainingTechniques ||
    enemy.trainingAbilities?.techniques ||
    enemy.trainingAbilities?.techniqueList ||
    [];

  if (Array.isArray(direct)) return direct;
  if (Array.isArray(direct?.techniques)) return direct.techniques;

  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ FALLBACK ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â critical for modular AI
  const fallback = getFighterTechniques?.(enemy) || [];
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;

  return [];
}

function setEnemyAIDebug(setFighters, enemyId, debugPatch) {
  if (!setFighters || !enemyId) return;
  setFighters((prev) =>
    prev.map((f) => {
      if (f.id !== enemyId) return f;
      const meta = f.meta || {};
      return {
        ...f,
        meta: {
          ...meta,
          aiDebug: {
            ...(meta.aiDebug || {}),
            ...debugPatch,
            updatedAt: Date.now(),
          },
        },
      };
    }),
  );
}

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

// Raider combatant detection for routing immunity
function isRaiderCombatant(fighter) {
  if (fighter?.isRaider === true) return true;

  const name = (fighter.name || fighter.displayName || "").toLowerCase();
  const type = (fighter.type || fighter.combatantType || "").toLowerCase();
  const category = (fighter.category || "").toLowerCase();
  const species = (fighter.species || fighter.race || "").toLowerCase();

  const raiderKeywords = [
    "raider",
    "devil",
    "fiend",
    "baal-rog",
    "baal_rog",
    "baalrog",
    "infernal",
    "hellspawn",
  ];

  const label = `${name} ${type} ${category} ${species}`;
  return raiderKeywords.some((k) => label.includes(k));
}

// Healer PROFESSION detection based on rulebook PROFESSION list (Clergy)
function isHealerProfessionForAI(fighter) {
  if (!fighter) return false;

  const professionText = [
    fighter.PROFESSION,
    fighter.profession,
    fighter.class,
    fighter.professionName,
    fighter.role,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

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

  return healerPatterns.some((pattern) => occText.includes(pattern));
}

/**
 * Hawk AI Helper Functions
 * Determines if a combatant is a hawk and identifies preferred prey (tiny/small combatants)
 */

const SIZE_ORDER = [
  SIZE_CATEGORIES.TINY,
  SIZE_CATEGORIES.SMALL,
  SIZE_CATEGORIES.MEDIUM,
  SIZE_CATEGORIES.LARGE,
  SIZE_CATEGORIES.HUGE,
  SIZE_CATEGORIES.LARGE_HEAVY,
];

/**
 * Check if a combatant is a hawk
 * @param {Object} combatant - Combatant object
 * @returns {boolean} True if combatant is a hawk
 */
function isHawk(combatant) {
  if (!combatant) return false;
  const id = (
    combatant.id ||
    combatant.type ||
    combatant.name ||
    combatant.species ||
    ""
  ).toLowerCase();
  return id.includes("hawk");
}

/**
 * Check if target is an animal
 * @param {Object} target - Target combatant
 * @returns {boolean} True if target is an animal
 */
function isAnimal(target) {
  if (!target) return false;
  const cat = (target.category || target.type || "").toLowerCase();
  return (
    cat === "animal" ||
    target.tags?.includes("animal") ||
    target.tags?.includes("Animal")
  );
}

/**
 * Check if target is a tiny or small animal (prey for hawks)
 * @param {Object} target - Target combatant
 * @returns {boolean} True if target is tiny/small animal
 */
function isTinyOrSmallAnimal(target) {
  if (!isAnimal(target)) return false;

  const sizeCat = getSizeCategory(target);
  return sizeCat === SIZE_CATEGORIES.TINY || sizeCat === SIZE_CATEGORIES.SMALL;
}

function getEnemyAISizeContext(combatant) {
  return {
    creatureSize: getCreatureSize(combatant),
    sizeRank: getCreatureSizeRank(combatant),
    legacySizeContext: getLegacyWeaponSizeCompatibility(combatant),
  };
}

/**
 * Check if target is scout-sized (Fairy, Scout, Sprite, etc.)
 * @param {Object} target - Target combatant
 * @returns {boolean} True if target is scout-sized
 */
function isScoutSizedTarget(target) {
  if (!target) return false;

  const sizeContext = getEnemyAISizeContext(target);
  if (target.sizePolicy === "neutral-size") {
    return (
      sizeContext.creatureSize === "Tiny" ||
      sizeContext.creatureSize === "Small"
    );
  }

  const race =
    target.race || target.species || target.type || target.name || "";
  if (!race) return false;

  const weaponSize = getWeaponSizeForRace(race);
  return weaponSize === WEAPON_SIZE.SCOUT;
}

/**
 * Check if target is preferred hawk prey (tiny/small animals or scout folk)
 * @param {Object} attacker - Attacking combatant (should be hawk)
 * @param {Object} target - Target combatant
 * @returns {boolean} True if target is preferred prey
 */
function isPreferredHawkPrey(attacker, target) {
  if (!isHawk(attacker)) return false;
  if (!target) return false;

  // Tiny/small animals: mice, small birds, etc.
  if (isTinyOrSmallAnimal(target)) return true;

  // Tiny scout folk: Fairy, Scout, Sprite, Scout, etc.
  if (isScoutSizedTarget(target)) return true;

  // Also check if target is explicitly TINY by size category
  const targetSize = getSizeCategory(target);
  if (targetSize === SIZE_CATEGORIES.TINY) return true;

  return false;
}

/**
 * Check if target is bigger and dangerous to hawk
 * @param {Object} attacker - Attacking combatant (should be hawk)
 * @param {Object} target - Target combatant
 * @returns {boolean} True if target is larger and threatening
 */
function isBiggerThreat(attacker, target) {
  if (!attacker || !target) return true; // Assume threat if unknown

  const attackerSize = getSizeCategory(attacker);
  const targetSize = getSizeCategory(target);

  const aIndex = SIZE_ORDER.indexOf(attackerSize);
  const tIndex = SIZE_ORDER.indexOf(targetSize);

  // If we don't know sizes, assume threat
  if (aIndex === -1 || tIndex === -1) return true;

  return tIndex > aIndex; // Target is strictly larger than the hawk
}

/**
 * Check if a fighter is a prey animal (mice, rats, rabbits, etc.)
 * @param {Object} fighter - Fighter object
 * @returns {boolean} True if fighter is a prey animal
 */
function isPreyAnimal(fighter) {
  if (!fighter) return false;

  const name = (fighter.baseName || fighter.name || "").toLowerCase();
  const size = (fighter.sizeCategory || fighter.size || "").toLowerCase();

  // Tiny / Small animals are fair game by default
  const isSmallBody = ["tiny", "small"].includes(size);

  // Specific species tags
  const preyKeywords = ["mouse", "rat", "rabbit", "squirrel", "songbird"];
  const isNamedPrey = preyKeywords.some((k) => name.includes(k));

  return isSmallBody || isNamedPrey;
}

/**
 * Check if a fighter is a flying hunter (hawk, falcon, eagle, etc.)
 * @param {Object} fighter - Fighter object
 * @returns {boolean} True if fighter is a flying hunter
 */
function isFlyingHunter(fighter) {
  if (!fighter) return false;

  const name = (fighter.name || "").toLowerCase();
  const species = (fighter.species || "").toLowerCase();

  const hunterKeywords = ["hawk", "falcon", "eagle", "vulture", "owl"];
  const isBirdOfPrey =
    hunterKeywords.some((k) => name.includes(k)) ||
    hunterKeywords.some((k) => species.includes(k));

  return isFlying(fighter) && isBirdOfPrey;
}

/**
 * Find nearby hiding spots (burrow, bush, rock, ruins, etc.)
 * @param {Object} fighter - Fighter object
 * @param {Object} positions - Positions map
 * @param {Object} terrain - Terrain data (optional)
 * @param {Array} objects - Map objects array (optional)
 * @param {number} maxRadiusHexes - Maximum search radius in hexes
 * @returns {Object|null} Nearest hiding spot object or null
 */
function findNearbyHidingSpot(
  fighter,
  positions,
  terrain,
  objects,
  maxRadiusHexes = 6,
) {
  if (!fighter || !positions || !objects) return null;

  const myPos = positions[fighter.id];
  if (!myPos) return null;

  // objects: expected shape: [{ id, position: {x,y}, tags: ['cover','burrow'] }, ...]
  const hidingCandidates = objects.filter((obj) => {
    const tags = obj.tags || [];
    const hasHideTag =
      tags.includes("cover") ||
      tags.includes("burrow") ||
      tags.includes("hideout") ||
      tags.includes("foliage");

    if (!hasHideTag || !obj.position) return false;

    const dx = obj.position.x - myPos.x;
    const dy = obj.position.y - myPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= maxRadiusHexes; // radius in hexes
  });

  if (!hidingCandidates.length) return null;

  // Simple "closest hiding spot"
  hidingCandidates.sort((a, b) => {
    const da =
      (a.position.x - myPos.x) * (a.position.x - myPos.x) +
      (a.position.y - myPos.y) * (a.position.y - myPos.y);
    const db =
      (b.position.x - myPos.x) * (b.position.x - myPos.x) +
      (b.position.y - myPos.y) * (b.position.y - myPos.y);
    return da - db;
  });

  return hidingCandidates[0];
}

// Altitude bands for flying hunters (hawks, etc.)
const HAWK_SCOUT_ALT_MIN_FT = 60; // cruising high when no prey
const HAWK_SCOUT_ALT_MAX_FT = 100; // max climb when no prey
const HAWK_HUNT_ALT_MIN_FT = 25; // lower band when actively hunting
const HAWK_HUNT_ALT_MAX_FT = 60; // don't stay higher than this when prey is known
const HAWK_CLIMB_STEP_FT = 40; // per action turn (soaring)
const HAWK_DESCENT_STEP_FT = 20;

/**
 * Adjust a flying hunter's altitude while it's circling.
 * - If there is NO visible prey: climb toward a random high scouting altitude (60ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ100ft).
 * - If there IS visible prey: stay in a lower hunting band (25ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ60ft).
 * @param {Object} flier - Flying combatant
 * @param {boolean} hasVisiblePrey - Whether there are visible ground targets
 * @param {Function} addLog - Logging function
 * @param {Function} setFighters - Function to update fighters state
 * @param {Array} fighters - Array of all fighters (to get latest flier state)
 */
function updateCirclingHunterAltitude(
  flier,
  hasVisiblePrey,
  addLog,
  setFighters,
  fighters,
) {
  if (!flier) return;

  // Get latest flier state from fighters array
  const latestFlier = fighters?.find((f) => f.id === flier.id) || flier;

  const currentAlt =
    typeof latestFlier.altitudeFeet === "number"
      ? latestFlier.altitudeFeet
      : typeof latestFlier.altitude === "number"
        ? latestFlier.altitude
        : 0;

  // When no prey is visible: climb up into scouting band and just hang there
  if (!hasVisiblePrey) {
    let targetAlt = latestFlier.scoutingAltitudeFeet;

    if (!targetAlt) {
      const rand =
        HAWK_SCOUT_ALT_MIN_FT +
        Math.floor(
          Math.random() * (HAWK_SCOUT_ALT_MAX_FT - HAWK_SCOUT_ALT_MIN_FT + 1),
        );

      // Store the target scouting altitude on the fighter
      setFighters((prev) =>
        prev.map((f) =>
          f.id === flier.id ? { ...f, scoutingAltitudeFeet: rand } : f,
        ),
      );

      targetAlt = rand;

      // If we're already at or above the target, no need to climb
      if (currentAlt >= targetAlt) {
        return;
      }
    }

    if (targetAlt && currentAlt < targetAlt) {
      const nextAlt = Math.min(targetAlt, currentAlt + HAWK_CLIMB_STEP_FT);

      setFighters((prev) =>
        prev.map((f) =>
          f.id === flier.id
            ? {
                ...f,
                altitude: nextAlt,
                altitudeFeet: nextAlt,
              }
            : f,
        ),
      );

      addLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${flier.name} climbs to ${nextAlt}ft, scanning for prey.`,
        "info",
      );
    }

    // If already at/above target, just glide; no log spam needed.
    return;
  }

  // If there IS visible prey: stay in a lower hunting band
  // (don't sit forever at 80ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ100ft when there are targets on the ground)
  const SOAR_MAX_ALT_FT = 300;
  let targetAlt = Math.min(SOAR_MAX_ALT_FT, currentAlt + HAWK_CLIMB_STEP_FT);
  if (targetAlt < HAWK_HUNT_ALT_MIN_FT) targetAlt = HAWK_HUNT_ALT_MIN_FT;

  if (targetAlt !== currentAlt) {
    const dir = Math.sign(targetAlt - currentAlt);
    const step = dir > 0 ? HAWK_CLIMB_STEP_FT : HAWK_DESCENT_STEP_FT;
    const nextAlt =
      dir > 0
        ? Math.min(targetAlt, currentAlt + step)
        : Math.max(targetAlt, currentAlt - step);

    setFighters((prev) =>
      prev.map((f) =>
        f.id === flier.id
          ? {
              ...f,
              altitude: nextAlt,
              altitudeFeet: nextAlt,
            }
          : f,
      ),
    );

    addLog(
      `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${flier.name} adjusts altitude to ${nextAlt}ft while circling above prey.`,
      "info",
    );
  }
}

/**
 * Get species behavior profile for a combatant
 * @param {Object} combatant - Combatant object
 * @returns {Object} Behavior profile or null
 */
function getSpeciesBehaviorProfile(combatant) {
  if (!combatant) return null;

  const species = combatant.species || combatant.race || combatant.type || "";
  const speciesMap = combatantBehaviorData.species || {};

  // Try exact match first
  if (speciesMap[species]) {
    return speciesMap[species];
  }

  // Try case-insensitive match
  const speciesLower = species.toLowerCase();
  const matchingKey = Object.keys(speciesMap).find(
    (key) => key.toLowerCase() === speciesLower,
  );
  if (matchingKey) {
    return speciesMap[matchingKey];
  }

  // Try partial match (e.g., "hawk" in "Hawk" or "Hawk (Heavy)")
  for (const [key, profile] of Object.entries(speciesMap)) {
    if (
      speciesLower.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(speciesLower)
    ) {
      return profile;
    }
  }

  return null;
}

/**
 * Get flight style for a combatant
 * @param {Object} combatant - Combatant object
 * @returns {string} Flight style: "circling", "hover", or "none"
 */
function getFlightStyle(combatant) {
  if (!combatant) return "none";
  const profile = getSpeciesBehaviorProfile(combatant);
  return profile?.flightStyle || "none";
}

/**
 * Get cruise fraction (glide speed as fraction of full speed)
 * @param {Object} combatant - Combatant object
 * @returns {number} Cruise fraction (default 0.25 = 25%)
 */
function getCruiseFraction(combatant) {
  if (!combatant) return 0.25;
  const profile = getSpeciesBehaviorProfile(combatant);
  return profile?.cruiseFraction ?? 0.25;
}

/**
 * Get circle preferences for a flying combatant
 * @param {Object} combatant - Combatant object
 * @returns {Object} Circle preferences with radiusFt and toleranceFt
 */
function getCirclePrefs(combatant) {
  if (!combatant) return { radiusFt: 30, toleranceFt: 10 };
  const profile = getSpeciesBehaviorProfile(combatant);
  return {
    radiusFt: profile?.circleRadiusFeet ?? 30,
    toleranceFt: profile?.circleRadiusToleranceFeet ?? 10,
  };
}

/**
 * Get full speed per action for a combatant
 * @param {Object} combatant - Combatant object
 * @param {number} actionsPerMelee - Actions per combat round
 * @returns {number} Full speed per action in feet
 */
function getFullSpeedPerAction(combatant, actionsPerMelee) {
  if (!combatant || !actionsPerMelee || actionsPerMelee <= 0) return 5;

  // Use flying speed if available, otherwise use ground speed
  const speed =
    combatant.flySpeedFt ||
    combatant.Spd ||
    combatant.spd ||
    combatant.attributes?.Spd ||
    combatant.attributes?.spd ||
    10;

  // Convert speed to feet per melee (Medieval Combat Simulator: Speed ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 18 = feet per melee)
  const speedFtPerMelee = speed * 18;
  return speedFtPerMelee / Math.max(actionsPerMelee, 1);
}

/**
 * Get flight focus point (target or enemy cluster center)
 * @param {Object} flier - Flying combatant
 * @param {Object} context - AI context
 * @returns {Object} Focus point {x, y} or null
 */
function getFlightFocusPoint(flier, context) {
  const { positions, fighters, calculateDistance } = context;
  const sceneContext = context.sceneContext || { sceneType: "combat", relations: {} };

  if (!positions[flier.id]) return null;

  // Find primary target (closest enemy)
  const enemies = fighters.filter(
    (f) =>
      canTargetForAction(flier, f, "attack", sceneContext) &&
      f.id !== flier.id &&
      f.currentHP > -21 &&
      positions[f.id],
  );

  if (enemies.length === 0) return positions[flier.id];

  // Find closest enemy
  const flierPos = positions[flier.id];
  let closestEnemy = null;
  let closestDist = Infinity;

  enemies.forEach((enemy) => {
    const dist = calculateDistance(flierPos, positions[enemy.id]);
    if (dist < closestDist) {
      closestDist = dist;
      closestEnemy = enemy;
    }
  });

  if (closestEnemy && positions[closestEnemy.id]) {
    return positions[closestEnemy.id];
  }

  // Fallback: use flier's current position
  return flierPos;
}

/**
 * Pick a circling hex for a flying combatant
 * @param {Object} flier - Flying combatant
 * @param {Object} focusPoint - Focus point to circle around
 * @param {Object} context - AI context
 * @returns {Object} Next hex position {x, y} or null
 */
function pickCirclingHex(flier, focusPoint, context) {
  const { positions, calculateDistance, isHexOccupied, GRID_CONFIG } = context;

  if (!positions[flier.id] || !focusPoint) return null;

  const currentPos = positions[flier.id];
  const { radiusFt, toleranceFt } = getCirclePrefs(flier);

  const minRadius = Math.max(radiusFt - toleranceFt, 5);
  const maxRadius = radiusFt + toleranceFt;

  // Generate candidate hexes in a ring around current position
  const candidates = [];
  const searchRadius = 3; // Search up to 3 hexes away

  for (let dx = -searchRadius; dx <= searchRadius; dx++) {
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      if (dx === 0 && dy === 0) continue; // Don't stay in same hex

      const candidate = {
        x: currentPos.x + dx,
        y: currentPos.y + dy,
      };

      // Check if hex is valid and not occupied
      if (isHexOccupied(candidate.x, candidate.y, flier.id)) continue;

      // Check distance from focus point
      const distFromFocus = calculateDistance(candidate, focusPoint);
      if (distFromFocus < minRadius || distFromFocus > maxRadius) continue;

      // Calculate distance from current position (prefer closer moves for smooth circling)
      const distFromCurrent = calculateDistance(currentPos, candidate);
      candidates.push({
        pos: candidate,
        distFromFocus,
        distFromCurrent,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by distance from current (prefer smooth gliding motion)
  candidates.sort((a, b) => a.distFromCurrent - b.distFromCurrent);

  // Prefer candidates that maintain similar distance to focus (smooth arc)
  const currentDistFromFocus = calculateDistance(currentPos, focusPoint);
  candidates.sort((a, b) => {
    const aDiff = Math.abs(a.distFromFocus - currentDistFromFocus);
    const bDiff = Math.abs(b.distFromFocus - currentDistFromFocus);
    if (Math.abs(aDiff - bDiff) < 2) {
      // If similar, prefer closer to current position
      return a.distFromCurrent - b.distFromCurrent;
    }
    return aDiff - bDiff;
  });

  return candidates[0].pos;
}

/**
 * Handle flying idle or harass action - circling behavior
 * @param {Object} flier - Flying combatant
 * @param {Object} context - AI context
 * @returns {boolean} True if movement was performed
 */
function handleFlyingIdleOrHarassAction(flier, context) {
  const {
    positions,
    calculateDistance,
    setPositions,
    positionsRef,
    setFighters,
    addLog,
    fighters,
    GRID_CONFIG,
  } = context;
  const sceneContext = context.sceneContext || { sceneType: "combat", relations: {} };

  // Low-noise AI debugging (opt-in).
  // Usage: localStorage.debugCombatAI = "1"
  const DEBUG_AI =
    typeof window !== "undefined" &&
    window?.localStorage?.getItem("debugCombatAI") === "1";

  const dbgLog = (msg, level = "info") => {
    if (DEBUG_AI) addLog?.(msg, level);
  };

  if (!isFlying(flier)) return false;

  const flightStyle = getFlightStyle(flier);

  // Hovering combatants can stay put (exceptional flight, hummingbirds, etc.)
  if (flightStyle === "hover") return false;

  // Must be circling style
  if (flightStyle !== "circling") return false;

  // Check for visible ground prey (only stuff on the ground counts as hawk prey)
  const groundPrey = fighters.filter(
    (f) =>
      !f.isDead &&
      canTargetForAction(flier, f, "attack", sceneContext) &&
      !isFlying(f) && // only stuff on the ground counts as hawk prey
      f.currentHP > 0 &&
      f.currentHP > -21,
  );

  const hasVisiblePrey = groundPrey.length > 0;

  // Adjust altitude based on whether prey is visible
  updateCirclingHunterAltitude(
    flier,
    hasVisiblePrey,
    addLog,
    setFighters,
    fighters,
  );

  const actionsPerMelee = flier.actionsPerRound || flier.remainingActions || 4;
  const fullPerAction = getFullSpeedPerAction(flier, actionsPerMelee);
  const cruiseFraction = getCruiseFraction(flier);
  const glideFt = Math.max(5, fullPerAction * cruiseFraction); // At least 1 hex (5ft)

  // Get focus point (target or enemy cluster)
  const focusPoint = getFlightFocusPoint(flier, context);
  if (!focusPoint) return false;

  // Pick next circling hex
  const nextHex = pickCirclingHex(flier, focusPoint, context);
  if (!nextHex) {
    // Fallback: move one hex in a safe direction
    const currentPos = positions[flier.id];
    if (!currentPos) return false;

    // Try moving in a direction away from focus (if too close) or toward it (if too far)
    const currentDist = calculateDistance(currentPos, focusPoint);
    const { radiusFt } = getCirclePrefs(flier);
    const dx = focusPoint.x - currentPos.x;
    const dy = focusPoint.y - currentPos.y;
    const angle = Math.atan2(dy, dx);

    // If too close, move away; if too far, move closer
    const moveDirection = currentDist < radiusFt ? -1 : 1;
    const fallbackHex = {
      x: Math.round(currentPos.x + Math.cos(angle) * moveDirection),
      y: Math.round(currentPos.y + Math.sin(angle) * moveDirection),
    };

    // Update position
    setPositions((prev) => {
      const updated = { ...prev, [flier.id]: fallbackHex };
      positionsRef.current = updated;
      return updated;
    });
    revealAfterObviousMovement(flier, setFighters, addLog, "circling overhead");

    addLog(
      `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${flier.name} drifts to maintain circling pattern (${fallbackHex.x}, ${fallbackHex.y})`,
      "info",
    );
    return true;
  }

  // Check distance to next hex
  const currentPos = positions[flier.id];
  const distanceToNext = calculateDistance(currentPos, nextHex);

  // Cap movement to glide distance
  if (distanceToNext > glideFt) {
    // Move partway towards nextHex
    const moveRatio = glideFt / distanceToNext;
    const partialHex = {
      x: Math.round(currentPos.x + (nextHex.x - currentPos.x) * moveRatio),
      y: Math.round(currentPos.y + (nextHex.y - currentPos.y) * moveRatio),
    };

    setPositions((prev) => {
      const updated = { ...prev, [flier.id]: partialHex };
      positionsRef.current = updated;
      return updated;
    });
    revealAfterObviousMovement(flier, setFighters, addLog, "circling overhead");

    // Drain stamina for circling movement
    spendFlyingStamina(flier, "FLY_HOVER", 1);

    addLog(
      `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${flier.name} circles overhead, gliding to maintain position (${partialHex.x}, ${partialHex.y})`,
      "info",
    );
    return true;
  }

  // Full glide to chosen hex
  // Drain stamina for circling movement
  spendFlyingStamina(flier, "FLY_HOVER", 1);

  setPositions((prev) => {
    const updated = { ...prev, [flier.id]: nextHex };
    positionsRef.current = updated;
    return updated;
  });
  revealAfterObviousMovement(flier, setFighters, addLog, "circling overhead");

  const distFromFocus = calculateDistance(nextHex, focusPoint);
  addLog(
    `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${flier.name} circles overhead, gliding to new position (${
      nextHex.x
    }, ${nextHex.y}) - maintaining ~${Math.round(distFromFocus)}ft radius`,
    "info",
  );

  // Deduct one action for movement
  setFighters((prev) =>
    prev.map((f) =>
      f.id === flier.id
        ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
        : f,
    ),
  );

  return true;
}

/**
 * Check if combatant has skittish_flying_predator AI profile
 * @param {Object} combatant - Combatant object
 * @returns {boolean} True if combatant has this profile
 */
function hasSkittishFlyingPredatorProfile(combatant) {
  const profile = getSpeciesBehaviorProfile(combatant);
  return profile?.aiProfile === "skittish_flying_predator";
}

/**
 * Check if target has weapons (armed threat)
 * @param {Object} target - Target combatant
 * @returns {boolean} True if target is armed
 */
function isArmedThreat(target) {
  if (!target) return false;

  // Check for equistaminad weapons
  if (target.equistaminadWeapons?.primary || target.equistaminadWeapons?.secondary) {
    return true;
  }

  // Check for weapon in attacks
  const attacks = target.attacks || [];
  const hasWeaponAttack = attacks.some((a) => {
    const name = (a.name || "").toLowerCase();
    return (
      name.includes("sword") ||
      name.includes("axe") ||
      name.includes("mace") ||
      name.includes("spear") ||
      name.includes("dagger") ||
      name.includes("bow")
    );
  });

  return hasWeaponAttack;
}

/**
 * Count how many armed enemies are threatening the combatant
 * @param {Object} combatant - Combatant to check
 * @param {Array} allFighters - All fighters in combat
 * @param {Object} positions - Position map
 * @param {Function} calculateDistance - Distance calculation function
 * @param {Function} canFighterAct - Function to check if fighter can act
 * @returns {number} Count of armed threats within 30ft
 */
function countArmedThreats(
  combatant,
  allFighters,
  positions,
  calculateDistance,
  canFighterAct,
  sceneContext = { sceneType: "combat", relations: {} },
) {
  if (!combatant || !positions[combatant.id]) return 0;

  const combatantPos = positions[combatant.id];
  let threatCount = 0;

  allFighters.forEach((fighter) => {
    // Only count enemies (opposite type)
    if (
      fighter.id === combatant.id ||
      !canTargetForAction(combatant, fighter, "attack", sceneContext)
    ) {
      return;
    }
    if (!canFighterAct(fighter)) return;

    // Check if armed
    if (!isArmedThreat(fighter)) return;

    // Check if within threat range (30ft)
    if (positions[fighter.id]) {
      const dist = calculateDistance(combatantPos, positions[fighter.id]);
      if (dist <= 30) {
        threatCount++;
      }
    }
  });

  return threatCount;
}

/**
 * Attempt tactical withdraw when enemy has no valid offensive options
 * Actually moves the enemy away from threats, or falls back to defending in place.
 * @param {Object} params - Parameters object
 * @param {Object} params.enemy - The enemy fighter
 * @param {Array} params.fighters - All fighters
 * @param {Object} params.positions - Position map
 * @param {Function} params.addLog - Logging function
 * @param {Function} params.findRetreatDestination - Retreat destination finder
 * @param {Function} params.isHexOccupied - Hex occupation checker
 * @param {Function} params.handlePositionChange - Function to move fighter
 * @param {Function} params.setDefensiveStance - Function to set defensive stance
 * @param {Function} params.scheduleEndTurn - Turn end scheduler
 * @param {Function} params.canFighterAct - Function to check if fighter can act
 * @param {Object} params.GRID_CONFIG - Grid configuration
 * @returns {boolean} True if withdrawal move was made, false if just defending
 */
function attemptTacticalWithdraw({
  enemy,
  fighters,
  positions,
  addLog,
  findRetreatDestination,
  isHexOccupied,
  handlePositionChange,
  setDefensiveStance,
  scheduleEndTurn,
  canFighterAct,
  GRID_CONFIG,
  sceneContext = { sceneType: "combat", relations: {} },
}) {
  try {
    const currentPos = positions[enemy.id];
    if (!currentPos) {
      addLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} cannot withdraw (no position data). Holding position defensively.`,
        "warning",
      );
      setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Defend" }));
      scheduleEndTurn();
      return false;
    }

    // Get active player fighters as threats
    const playerFighters = fighters.filter(
      (f) =>
        canTargetForAction(enemy, f, "attack", sceneContext) &&
        canFighterAct(f) &&
        f.currentHP > 0 &&
        f.currentHP > -21,
    );

    // If no active enemies, just end turn
    if (playerFighters.length === 0) {
      addLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} finds no active foes and cautiously lowers their guard.`,
        "info",
      );
      setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Defend" }));
      scheduleEndTurn();
      return false;
    }

    // Calculate threat positions
    const threatPositions = playerFighters
      .map((f) => positions[f.id])
      .filter(Boolean);

    if (threatPositions.length === 0) {
      addLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} cannot see any threats. Holding position defensively.`,
        "info",
      );
      setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Defend" }));
      scheduleEndTurn();
      return false;
    }

    // Calculate max retreat steps based on movement
    const speed =
      enemy.Spd ||
      enemy.spd ||
      enemy.attributes?.Spd ||
      enemy.attributes?.spd ||
      10;
    const actionsPerRound = enemy.actionsPerRound || 2;
    const fullFeetPerAction = (speed * 18) / Math.max(1, actionsPerRound);
    const maxSteps = Math.max(
      1,
      Math.min(Math.floor(fullFeetPerAction / GRID_CONFIG.CELL_SIZE), 5),
    );

    // Try to find retreat destination
    const retreatDestination = findRetreatDestination({
      currentPos,
      threatPositions,
      maxSteps,
      enemyId: enemy.id,
      isHexOccupied,
    });

    if (retreatDestination && retreatDestination.position) {
      addLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶ ${enemy.name} withdraws from unreachable foes to (${retreatDestination.position.x}, ${retreatDestination.position.y}).`,
        "info",
      );

      // Actually move the enemy using handlePositionChange
      handlePositionChange(enemy.id, retreatDestination.position, {
        movementType: "withdraw",
        source: "AI_WITHDRAW",
        threatPositions: threatPositions,
      });

      // Set defensive stance to "Retreat"
      setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Retreat" }));

      scheduleEndTurn();
      return true;
    }

    // No safe retreat hex found ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ defend in place
    addLog(
      `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} looks for a safe place to withdraw but finds none; defending in place.`,
      "warning",
    );

    setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Defend" }));
    scheduleEndTurn();
    return false;
  } catch (err) {
    console.error("Error during tactical withdraw:", err);
    addLog(
      `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} tries to withdraw but something goes wrong; they hold position defensively.`,
      "warning",
    );
    setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Defend" }));
    scheduleEndTurn();
    return false;
  }
}

/**
 * Run enemy turn AI
 * @param {Object} enemy - The enemy fighter object
 * @param {Object} context - Context object containing all necessary dependencies
 */
export function runEnemyTurnAI(enemy, context) {
  const {
    fighters,
    positions,
    combatTerrain,
    arenaEnvironment,
    meleeRound,
    turnIndex,
    turnCounter,
    routRecoveryHandled = false,
    moraleTriggersHandled = false,
    routingEnabled = true,
    combatActive,
    // Core helpers
    canFighterAct,
    getHPStatus,
    addLog,
    scheduleEndTurn,
    canFinalizeTurn,
    endTurn,
    // Distance & movement
    calculateDistance,
    isTargetBlocked,
    getBlockingCombatant,
    calculateTargetPriority,
    calculateEnemyMovementAI,
    analyzeMovementAndAttack,
    findFlankingPositions,
    calculateFlankingBonus,
    validateWeaponRange,
    handlePositionChange,
    isHexOccupied,
    getHexNeighbors,
    isValidPosition,
    findRetreatDestination,
    // Healing / support
    getAvailableSkills,
    isEvilAlignment,
    healerAbility,
    clericalHealingTouch,
    medicalTreatment,
    getFighterTechniques: getFighterTechniquesFromContext,
    getFighterTacticalPowers,
    getFighterstamina,
    getFighterfocus,
    // AI engine
    createAIActionSelector,
    GRID_CONFIG,
    calculateMovementPerAction,
    MOVEMENT_RATES,
    MOVEMENT_ACTIONS,
    // Fog of war
    fogEnabled,
    visibleCells,
    canAISeeTarget,
    // State setters
    setPositions,
    setFighters,
    setDefensiveStance,
    setTemporaryHexSharing,
    setCombatActive,
    onNoHostilesRemaining,
    // Attack & combat
    attack,
    createAttackActionGrant,
    createAttackExecutionKey,
    validateDelayedAttackCallback,
    // Refs
    positionsRef,
    processingEnemyTurnRef,
    attackRef,
    combatEndCheckRef,
    // Other
    getTargetsInLine,
    sceneContext = { sceneType: "combat", relations: {} },
  } = context;

  const combatOverRef = context.combatOverRef;
  const markDistanceClosed = context.markDistanceClosed;
  const combatStateRef = context.combatStateRef;
  const commitEnemyTurnAction = context.commitEnemyTurnAction;
  const isEnemyTurnStillCurrent = context.isEnemyTurnStillCurrent;
  if (!moraleTriggersHandled) {
    const moraleOutcome = evaluateMoraleTriggers(enemy, {
      fighters,
      positions: positionsRef?.current || positions,
      calculateDistance,
      routingEnabled,
      sceneContext,
      turnKey: `${turnCounter}:${enemy.id}`,
    });
    if (!moraleOutcome.skipped) {
      enemy = moraleOutcome.actor;
      setFighters((prev) => prev.map((fighter) => (
        fighter.id === enemy.id ? enemy : fighter
      )));
      addLog(
        `${enemy.name} morale pressure (${moraleOutcome.trigger}, enemy-turn): ${moraleOutcome.result}.`,
        ["routed", "broken"].includes(moraleOutcome.result) ? "warning" : "info",
      );
    }
  }
  const isHostileTarget = (target, actionKind = "attack") =>
    Boolean(target) &&
    !isSameCombatActor(enemy, target) &&
    canTargetForAction(enemy, target, actionKind, sceneContext);
  const isAllyTarget = (target) => isAllyOf(enemy, target, sceneContext);

  /** One committed action per runEnemyTurnAI invocation (prevents move + attack fall-through). */
  let actionCommitted = false;
  function commitEnemyAction(reason) {
    if (typeof commitEnemyTurnAction === "function") {
      const ok = commitEnemyTurnAction(enemy, reason);
      if (!ok) return false;
    }
    if (actionCommitted) {
      console.warn("[ENEMY AI BLOCKED - duplicate action in same turn slice]", {
        enemy: enemy?.name,
        reason,
        turnIndex,
        round: meleeRound,
      });
      return false;
    }
    actionCommitted = true;
    return true;
  }

  const makeEnemyAttackExecutionKey = (actor, targetId, source = "enemy-ai-attack", options = {}) => {
    const grant =
      options.grant ||
      (
        typeof createAttackActionGrant === "function"
          ? createAttackActionGrant(actor?.id, targetId, source)
          : null
      );
    return typeof createAttackExecutionKey === "function"
      ? createAttackExecutionKey(actor?.id, targetId, source, {
          grant,
          scheduledAtTurnToken: grant?.turnToken,
          callbackSource: options.callbackSource,
          isDelayedCallback: Boolean(options.isDelayedCallback || options.callbackSource),
          allowOutOfTurnAttack: Boolean(options.allowOutOfTurnAttack),
        })
      : `attack-legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const validateEnemyAttackCallbackEntry = ({
    actor,
    targetId,
    executionKey,
    source = "enemy-ai-delayed-attack",
    allowOutOfTurn = false,
  } = {}) => {
    if (typeof validateDelayedAttackCallback !== "function") return true;
    return validateDelayedAttackCallback({
      actor,
      targetId,
      executionKey,
      source,
      allowOutOfTurn,
    });
  };

  // -----------------------------------------------------------------------------
  // Load weakness memory once per turn for this enemy (persistent across encounters)
  // We store it on enemy.meta._weaknessMemory for easy access and HUD rendering.
  // -----------------------------------------------------------------------------
  const persistentMemory = loadPersistentWeaknessMemory(enemy);
  if (!enemy.meta) enemy.meta = {};
  if (!enemy.meta._weaknessMemory) {
    enemy.meta._weaknessMemory = persistentMemory || {};
  } else {
    // Merge in persisted data (in case enemy object survived while storage updated)
    enemy.meta._weaknessMemory = mergeWeaknessMemory(
      enemy.meta._weaknessMemory,
      persistentMemory || {},
    );
  }

  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ CRITICAL: Check if enemy can act (conscious, not dying/dead/unconscious)
  if (!canFighterAct(enemy)) {
    const hpStatus = getHPStatus(enemy.currentHP);
    addLog(
      `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} cannot act (${hpStatus.description}), skipping turn`,
      "info",
    );
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }

  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â´ NEW: Check if paralyzed
  const isParalyzed = enemy.statusEffects?.some(
    (e) =>
      (typeof e === "string" && e === "PARALYZED") ||
      (typeof e === "object" && e.type === "PARALYZED"),
  );
  if (isParalyzed) {
    addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} is paralyzed and cannot act this round!`, "info");
    processingEnemyTurnRef.current = false;
    scheduleEndTurn();
    return;
  }

  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ Define allPlayers early so ROUTED logic and rest of AI can use it
  const allPlayers = fighters.filter(
    (f) =>
      isHostileTarget(f) &&
      canFighterAct(f) &&
      f.currentHP > 0 && // conscious only
      f.currentHP > -21, // not dead
  );

  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â´ NEW: Check if routed - if so, attempt to flee instead of fighting
  if (
    enemy.moraleState?.status === "ROUTED" ||
    enemy.statusEffects?.includes("ROUTED")
  ) {
    const bridgedEnemy = normalizeMoraleState(enemy);
    setFighters((prev) => prev.map((fighter) => (
      fighter.id === enemy.id
        ? { ...fighter, state: bridgedEnemy.state }
        : fighter
    )));
    if (isFallenCombatant(enemy)) {
      // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ Fallen: clear ROUTED and stand ground
      addLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ ${enemy.name} is fallen and refuses to flee (ignoring ROUTED).`,
        "info",
      );

      enemy.moraleState = {
        ...(enemy.moraleState || {}),
        status: "UNSHAKEN",
      };

      if (Array.isArray(enemy.statusEffects)) {
        enemy.statusEffects = enemy.statusEffects.filter((s) => s !== "ROUTED");
      }

      // fall through to normal action selection instead of flee
    } else if (isRaiderCombatant(enemy)) {
      // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â  Raider: clear ROUTED and stand ground (raiders are fearless)
      addLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â  ${enemy.name} is a raider and refuses to flee (ignoring ROUTED).`,
        "info",
      );

      enemy.moraleState = {
        ...(enemy.moraleState || {}),
        status: "UNSHAKEN",
      };

      if (Array.isArray(enemy.statusEffects)) {
        enemy.statusEffects = enemy.statusEffects.filter((s) => s !== "ROUTED");
      }

      // fall through to normal action selection instead of flee
    } else if (!isFallenCombatant(enemy) && !isRaiderCombatant(enemy)) {
      if (!routRecoveryHandled) {
        const recovery = resolveRoutedTurnRecovery({
          actor: enemy,
          fighters,
          positions: positionsRef?.current || positions,
          calculateDistance,
          sceneContext: { sceneType: "combat", relations: {} },
          turnKey: `${turnCounter}:${enemy.id}`,
        });
        setFighters((prev) => prev.map((fighter) => (
          fighter.id === enemy.id ? recovery.actor : fighter
        )));
        if (recovery.recovered) {
          const label = recovery.result === "strong_recovery" ? "uneasy" : "shaken";
          addLog(`${enemy.name} steadies enough to stop routing, but remains ${label}.`, "info");
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }

      const routingProfile = getRoutingProfile(enemy);
      const usesOpponentRouting = routingProfile.pathStyle !== "panic";
      const currentPos = (positionsRef?.current || positions)?.[enemy.id];

      addLog(
        usesOpponentRouting
          ? `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ ${enemy.name} breaks and tries to withdraw from the fight!`
          : `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} is ROUTED and attempts to flee!`,
        usesOpponentRouting ? "info" : "warning",
      );

      if (!currentPos) {
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} cannot ${usesOpponentRouting ? "withdraw" : "flee"} (no position data).`,
          "warning",
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      const threatPositions = allPlayers
        .map((f) => positions[f.id])
        .filter(Boolean);
      if (threatPositions.length === 0) {
        if (usesOpponentRouting && routingProfile.canRally) {
          enemy.moraleState = {
            ...(enemy.moraleState || {}),
            status: "STEADY",
            hasFled: false,
            lastReason: "rallied_after_break_contact",
          };
          if (Array.isArray(enemy.statusEffects)) {
            enemy.statusEffects = enemy.statusEffects.filter(
              (s) => s !== "ROUTED",
            );
          }
          setFighters((prev) =>
            prev.map((f) =>
              f.id === enemy.id
                ? {
                    ...f,
                    moraleState: enemy.moraleState,
                    statusEffects: enemy.statusEffects,
                  }
                : f,
            ),
          );
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ ${enemy.name} regains its nerve when no foe presses the attack.`,
            "info",
          );
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }

        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? markCombatantFled({
                  ...f,
                  moraleState: {
                    ...(f.moraleState || {}),
                    status: "ROUTED",
                    hasFled: true,
                  },
                  statusEffects: Array.isArray(f.statusEffects)
                    ? Array.from(new Set([...f.statusEffects, "FLED"]))
                    : ["FLED"],
                })
              : f,
          ),
        );
        setPositions((prev) => {
          const next = { ...prev };
          delete next[enemy.id];
          if (positionsRef) positionsRef.current = next;
          return next;
        });
        addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} flees off the battlefield!`, "warning");
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      const speed =
        enemy.Spd ||
        enemy.spd ||
        enemy.attributes?.Spd ||
        enemy.attributes?.spd ||
        10;
      const actionsPerRound = enemy.actionsPerRound || 2;
      const fullFeetPerAction = (speed * 18) / Math.max(1, actionsPerRound);
      const maxSteps = Math.max(
        1,
        Math.min(Math.floor(fullFeetPerAction / GRID_CONFIG.CELL_SIZE), 5),
      );
      const retreatDestination = findRoutingDestination({
        currentPos,
        threatPositions,
        maxSteps,
        isHexOccupied: (x, y) => isHexOccupied(x, y, enemy.id),
        getHexNeighbors: (x, y) => {
          const even = y % 2 === 0;
          return [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 },
            { x: x + (even ? -1 : 1), y: y - 1 },
            { x: x + (even ? -1 : 1), y: y + 1 },
          ];
        },
        isValidPosition: (x, y) =>
          x >= 0 &&
          y >= 0 &&
          x < GRID_CONFIG.GRID_WIDTH &&
          y < GRID_CONFIG.GRID_HEIGHT,
        calculateDistance,
        gridWidth: GRID_CONFIG.GRID_WIDTH,
        gridHeight: GRID_CONFIG.GRID_HEIGHT,
        routingProfile,
      });

      if (retreatDestination?.position) {
        const escaped = hasSatisfiedRoutingExit({
          position: retreatDestination.position,
          threatPositions,
          calculateDistance,
          gridWidth: GRID_CONFIG.GRID_WIDTH,
          gridHeight: GRID_CONFIG.GRID_HEIGHT,
          routingProfile,
        });

        if (escaped) {
          setFighters((prev) =>
            prev.map((f) =>
              f.id === enemy.id
                ? markCombatantFled({
                    ...f,
                    moraleState: {
                      ...(f.moraleState || {}),
                      status: "ROUTED",
                      hasFled: true,
                    },
                    statusEffects: Array.isArray(f.statusEffects)
                      ? Array.from(new Set([...f.statusEffects, "FLED"]))
                      : ["FLED"],
                  })
                : f,
            ),
          );
          setPositions((prev) => {
            const next = { ...prev };
            delete next[enemy.id];
            if (positionsRef) positionsRef.current = next;
            return next;
          });
          addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} flees off the battlefield!`, "warning");
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }

        handlePositionChange(enemy.id, retreatDestination.position, {
          movementType: usesOpponentRouting ? "break_contact" : "withdraw",
          source: usesOpponentRouting ? "AI_MONSTER_ROUTING" : "AI_ROUTING",
          threatPositions,
        });
        setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Retreat" }));
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? {
                  ...f,
                  remainingActions: 0,
                  moraleState: {
                    ...(f.moraleState || {}),
                    status: "ROUTED",
                    hasFled: false,
                    lastReason: usesOpponentRouting
                      ? "break_contact_withdrawal"
                      : f.moraleState?.lastReason,
                  },
                }
              : f,
          ),
        );
        addLog(
          usesOpponentRouting
            ? `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ ${enemy.name} breaks contact and withdraws to (${retreatDestination.position.x}, ${retreatDestination.position.y}).`
            : `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} flees to (${retreatDestination.position.x}, ${retreatDestination.position.y})!`,
          usesOpponentRouting ? "info" : "warning",
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      if (
        usesOpponentRouting &&
        (routingProfile.corneredBehavior === "berserk" ||
          routingProfile.corneredBehavior === "fight" ||
          routingProfile.corneredBehavior === "push_through")
      ) {
        enemy.moraleState = {
          ...(enemy.moraleState || {}),
          status: "STEADY",
          hasFled: false,
          lastReason: "cornered_counterattack",
        };
        if (Array.isArray(enemy.statusEffects)) {
          enemy.statusEffects = enemy.statusEffects.filter(
            (s) => s !== "ROUTED",
          );
        }
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? {
                  ...f,
                  moraleState: enemy.moraleState,
                  statusEffects: enemy.statusEffects,
                }
              : f,
          ),
        );
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ ${enemy.name} is cornered and lashes out instead of running!`,
          "warning",
        );
      } else {
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} cannot find a safe escape route and hesitates.`,
          "warning",
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    // Check if combat is still active
    if (needsToMoveCloser) {
      const noMoveSource = "enemy-ai-no-move-fallback";
      addLog(`${enemy.name} cannot find a path and holds position.`, "warning");
      if (commitEnemyAction(noMoveSource)) {
        setFighters((prev) => prev.map((fighter) => (
          fighter.id === enemy.id
            ? {
                ...fighter,
                remainingActions: Math.max(0, (Number(fighter.remainingActions ?? 0) || 0) - 1),
              }
            : fighter
        )));
      }
      processingEnemyTurnRef.current = false;
      scheduleEndTurn(0, noMoveSource);
      return;
    }

    if (!combatActive) {
      addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Combat ended, ${enemy.name} skips turn`, "info");
      processingEnemyTurnRef.current = false;
      return;
    }

    // Check if enemy has actions remaining
    if (enemy.remainingActions <= 0) {
      if (typeof canFinalizeTurn === "function" && !canFinalizeTurn("enemy-ai-no-actions")) {
        processingEnemyTurnRef.current = false;
        return;
      }
      addLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} has no actions remaining - passing to next fighter in initiative order`,
        "info",
      );
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }

    // allPlayers is already defined above (after paralyzed check) for use in ROUTED logic

    // Decay awareness for each player target
    allPlayers.forEach((target) => {
      decayAwareness(enemy, target);
    });

    // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ Flying Enemy Behavior Integration
    const enemyCanFly = canFly(enemy);
    const enemyIsFlying = isFlying(enemy);

    // If the enemy is airborne, delegate to the flying behavior system.
    // EXCEPTION: Flying hunters (hawks, etc.) use the inline diving/circling logic below
    // instead of the generic runFlyingTurn, so they can actively hunt prey.
    // Note: We check enemyIsFlying first (must be actually flying), then enemyCanFly (must have flight ability)
    if (enemyIsFlying && enemyCanFly && !isFlyingHunter(enemy)) {
      addLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} is airborne at ${
          enemy.altitudeFeet ?? enemy.altitude ?? 0
        }ft - using flying behavior`,
        "info",
      );

      runFlyingTurn(enemy, {
        fighters,
        positions,
        setPositions,
        enemyIndex: fighters.findIndex((f) => f.id === enemy.id),
        movementMap: null, // Not used in runFlyingTurn currently
        addLog,
        updateFighter: (id, updates) => {
          setFighters((prev) =>
            prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
          );
        },
        applyDamage: null, // Not used in runFlyingTurn currently
        endTurn,
        scheduleEndTurn,
        canFighterAct,
        selectBestAttackForEnemy: null, // Not used in runFlyingTurn currently
        isEnemyFlying: (id) => {
          const fighter = fighters.find((f) => f.id === id);
          return fighter ? isFlying(fighter) : false;
        },
        canFlyFn: canFly,
        getBestRangedAttack: null, // Not used in runFlyingTurn currently
        syncCombinedPositions: null, // Not used in runFlyingTurn currently
        applyFallDamage: null, // Not used in runFlyingTurn currently
        getEnemyAwarenessState: null, // Not used in runFlyingTurn currently
        setEnemyAwarenessState: null, // Not used in runFlyingTurn currently
        calculateDistanceFn: calculateDistance,
        sceneContext,
        importMetaEnv: import.meta.env,
      });

      // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ Do NOT fall through to ground AI when flying
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }

    // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â FLIGHT AI: If enemy can fly but is currently grounded, check if threatened by melee-only enemies
    if (enemyCanFly && !enemyIsFlying && allPlayers.length > 0) {
      // Check if any nearby players are melee-only threats
      const threateningMeleeEnemies = allPlayers.filter((player) => {
        if (!positions[enemy.id] || !positions[player.id]) return false;
        const dist = calculateDistance(
          positions[enemy.id],
          positions[player.id],
        );
        if (dist > 30) return false; // Too far to be immediate threat

        // Check if player has ranged weapons
        const playerHasRanged =
          player.equistaminadWeapons?.primary ||
          player.equistaminadWeapons?.secondary ||
          player.attacks?.some((a) => {
            const name = a.name?.toLowerCase() || "";
            return (
              name.includes("bow") ||
              name.includes("crossbow") ||
              name.includes("sling") ||
              name.includes("thrown") ||
              (a.range && a.range > 10)
            );
          });

        // If player is close and has no ranged weapons, they're a melee threat
        return !playerHasRanged && dist <= 20;
      });

      if (threateningMeleeEnemies.length > 0) {
        // Take off to escape melee threats!
        // Altitude is tracked in 5ft increments (similar to hex distances)
        // For hawks: use 100ft altitude (realistic soaring/circling height)
        const newAltitude = isHawk(enemy) ? 100 : 30;
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? { ...f, altitude: newAltitude, altitudeFeet: newAltitude }
              : f,
          ),
        );
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} takes to the air (altitude: ${newAltitude}ft) to escape melee attackers!`,
          "info",
        );
        // Deduct one action for taking off
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
              : f,
          ),
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    // Filter visible targets and get awareness states
    const visiblePlayers = [];
    allPlayers.forEach((target) => {
      const isVisible = canAISeeTarget(
        enemy,
        target,
        positions,
        combatTerrain,
        {
          useFogOfWar: fogEnabled,
          fogOfWarVisibleCells: visibleCells,
        },
      );

      if (isVisible) {
        visiblePlayers.push(target);
        // Update awareness to Alert when enemy can see target
        updateAwareness(enemy, target, AWARENESS_STATES.ALERT);
      } else {
        // Use calculatePerceptionCheck to determine if enemy can detect hidden target
        const perceptionCheck = calculatePerceptionCheck(enemy, target, {
          terrain: combatTerrain?.terrain,
          lighting: combatTerrain?.lighting || "BRIGHT_DAYLIGHT",
          distance:
            positions[enemy.id] && positions[target.id]
              ? calculateDistance(positions[enemy.id], positions[target.id])
              : 0,
        });

        // Check if enemy can still target Searching players (lost track but actively looking)
        const awareness = getAwareness(enemy, target);
        if (
          awareness === AWARENESS_STATES.SEARCHING ||
          hasSpecialSenses(enemy) ||
          perceptionCheck.success
        ) {
          visiblePlayers.push(target);
          // Keep awareness at Searching if enemy is actively looking
          if (awareness !== AWARENESS_STATES.SEARCHING) {
            updateAwareness(enemy, target, AWARENESS_STATES.SEARCHING);
          }
        } else {
          // Target is hidden - update awareness to Unaware if not already
          if (awareness !== AWARENESS_STATES.UNAWARE) {
            updateAwareness(enemy, target, AWARENESS_STATES.UNAWARE);
          }
        }
      }
    });

    // AI Skill Usage: Check if enemy should use healing/support skills before attacking
    const availableSkills = getAvailableSkills(enemy);
    const healingSkills = availableSkills.filter(
      (skill) =>
        skill.type === "healer_ability" ||
        skill.type === "clerical_ability" ||
        skill.type === "medical_skill",
    );

    // Healer archetype = Clergy PROFESSIONs (Priest, Healer, Druid, Shaman, etc.) OR explicit healer skills
    const hasHealerSkills =
      Array.isArray(enemy.skills) &&
      enemy.skills.some((s) =>
        ["Healer PROFESSION role Skill", "Holistic Medicine"].includes(s.name),
      );

    const isHealer = isHealerProfessionForAI(enemy) || hasHealerSkills;

    // Check for allies that need healing (only for non-evil alignments)
    const enemyAlignment = enemy.alignment || enemy.attributes?.alignment || "";
    const isEvil = isEvilAlignment(enemyAlignment);
    const isGood =
      !isEvil &&
      ((enemyAlignment || "").toLowerCase().includes("good") ||
        (enemyAlignment || "").toLowerCase().includes("principled") ||
        (enemyAlignment || "").toLowerCase().includes("scrupulous"));

    // Good-aligned healers prioritize healing allies
    if (isHealer && isGood && (healingSkills.length > 0 || hasHealerSkills)) {
      // Find injured allies (same type as enemy)
      const allies = fighters.filter(
        (f) =>
          isAllyTarget(f) &&
          f.id !== enemy.id &&
          f.currentHP > -21 &&
          (f.currentHP < f.maxHP * 0.5 || f.currentHP <= 0), // Injured or dying
      );

      if (allies.length > 0) {
        // Prioritize dying allies (HP <= 0)
        const dyingAllies = allies.filter((a) => a.currentHP <= 0);
        const targetAlly = dyingAllies.length > 0 ? dyingAllies[0] : allies[0];

        // Check if enemy is adjacent to target (for touch skills)
        const enemyPos = positions[enemy.id];
        const allyPos = positions[targetAlly.id];
        const isAdjacent =
          enemyPos && allyPos && calculateDistance(enemyPos, allyPos) <= 5.5;

        if (isAdjacent) {
          // Select appropriate healing skill
          let selectedHealingSkill = null;

          // Prioritize Lust for Life for dying allies
          if (targetAlly.currentHP <= 0) {
            selectedHealingSkill = healingSkills.find(
              (s) => s.name === "Lust for Life",
            );
          }

          // Fallback to Healing Touch or First Aid
          if (!selectedHealingSkill) {
            selectedHealingSkill = healingSkills.find(
              (s) => s.name.includes("Healing Touch") || s.name === "First Aid",
            );
          }

          if (selectedHealingSkill) {
            // Check if enemy has enough resources
            let canUse = true;
            if (selectedHealingSkill.costType === "focus") {
              const currentfocus =
                enemy.currentfocus || enemy.currentIsp || enemy.focus || 0;
              canUse = currentfocus >= selectedHealingSkill.cost;
            }

            if (canUse) {
              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ ${enemy.name} uses ${selectedHealingSkill.name} on ${targetAlly.name}!`,
                "info",
              );

              // Execute the healing skill
              let skillResult = null;

              if (selectedHealingSkill.type === "healer_ability") {
                const powerName = selectedHealingSkill.name.replace(
                  " (Healer)",
                  "",
                );
                skillResult = healerAbility(enemy, targetAlly, powerName);

                if (!skillResult.error) {
                  // Update enemy focus
                  setFighters((prev) =>
                    prev.map((f) =>
                      f.id === enemy.id
                        ? {
                            ...f,
                            currentfocus: skillResult.focusRemaining,
                            focus: skillResult.focusRemaining,
                          }
                        : f,
                    ),
                  );

                  // Update ally HP
                  if (skillResult.healed !== undefined) {
                    setFighters((prev) =>
                      prev.map((f) =>
                        f.id === targetAlly.id
                          ? { ...f, currentHP: skillResult.currentHp }
                          : f,
                      ),
                    );
                  }

                  addLog(
                    skillResult.message,
                    skillResult.success === false ? "error" : "success",
                  );
                }
              } else if (selectedHealingSkill.type === "clerical_ability") {
                skillResult = clericalHealingTouch(enemy, targetAlly);

                if (!skillResult.error) {
                  setFighters((prev) =>
                    prev.map((f) =>
                      f.id === targetAlly.id
                        ? { ...f, currentHP: skillResult.currentHp }
                        : f,
                    ),
                  );
                  addLog(skillResult.message, "success");
                }
              } else if (selectedHealingSkill.type === "medical_skill") {
                const skillPercent = selectedHealingSkill.skillPercent || 50;
                skillResult = medicalTreatment(enemy, targetAlly, skillPercent);

                if (skillResult.healed > 0) {
                  setFighters((prev) =>
                    prev.map((f) =>
                      f.id === targetAlly.id
                        ? { ...f, currentHP: skillResult.currentHp }
                        : f,
                    ),
                  );
                }
                addLog(
                  skillResult.message,
                  skillResult.success ? "success" : "error",
                );
              }

              // Deduct action and end turn
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id
                    ? {
                        ...f,
                        remainingActions: Math.max(
                          0,
                          f.remainingActions - selectedHealingSkill.cost,
                        ),
                      }
                    : f,
                ),
              );

              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          }
        }
      }
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
      processingEnemyTurnRef,
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
        if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
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
          // You could add extra logic here: only count predators, flying hunters, etc.
          if (distSq < nearestThreatDistSq) {
            nearestThreatDistSq = distSq;
            nearestThreat = enemy;
          }
        }
      }

      // 1a) If there is a threat: run/hide using existing retreat logic
      if (nearestThreat) {
        const threatPos = positions[nearestThreat.id];

        // Prefer to flee *away* from threat, using existing retreat code
        const threatPositions = threatPos ? [threatPos] : [];
        const retreatDestination = findRetreatDestination({
          currentPos: myPos,
          threatPositions,
          maxSteps: 5,
          enemyId: fighter.id,
          isHexOccupied,
        });

        if (retreatDestination) {
          log(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ ${fighter.name} panics at the sight of ${nearestThreat.name} and scurries away!`,
            "info",
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
              "retreating",
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
                : f,
            ),
          );

          scheduleEndTurn();
          if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
          return;
        }

        // If no retreat destination found, just cower / defend
        log(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ ${fighter.name} freezes in fear, unable to find a way to flee from ${nearestThreat.name}.`,
          "info",
        );

        setFighters((prev) =>
          prev.map((f) =>
            f.id === fighter.id
              ? {
                  ...f,
                  remainingActions: Math.max(0, f.remainingActions - 1),
                  defensiveStance: "Cower",
                }
              : f,
          ),
        );

        scheduleEndTurn();
        if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
        return;
      }

      // 2) SAFE: SCAVENGE / FORAGE
      // Reuse existing scavenging helpers for small prey
      const SCAVENGE_RADIUS = 6; // 6-hex "forage" radius

      // First, look for corpses
      const allFighters = [...(allies || []), ...(enemies || [])];
      const corpse = findNearbyCorpse(
        fighter,
        allFighters,
        positions,
        SCAVENGE_RADIUS,
      );
      if (corpse) {
        const corpsePos = positions[corpse.id];
        if (corpsePos) {
          const dist = calculateDistance
            ? calculateDistance(myPos, corpsePos)
            : Math.sqrt(
                (corpsePos.x - myPos.x) ** 2 + (corpsePos.y - myPos.y) ** 2,
              ) * 5; // Convert hexes to feet

          if (dist > 5) {
            // Move partway toward corpse (simple 1-hex step)
            const dx = corpsePos.x - myPos.x;
            const dy = corpsePos.y - myPos.y;
            const step = {
              x: myPos.x + Math.sign(dx),
              y: myPos.y + Math.sign(dy),
            };

            log(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ ${fighter.name} cautiously noses toward a nearby corpse to scavenge.`,
              "info",
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
                  : f,
              ),
            );

            scheduleEndTurn();
            if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
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
                : f,
            ),
          );

          scheduleEndTurn();
          if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
          return;
        }
      }

      // 2b) Optional: forage items (grain, crumbs, berries) via consumptionSystem
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
              : f,
          ),
        );

        scheduleEndTurn();
        if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
        return;
      }

      // 3) WANDER / IDLE: sniff around a bit, maybe toward a future hiding spot
      const hideSpot = findNearbyHidingSpot(
        fighter,
        positions,
        terrain,
        objects || [],
        12,
      );

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
              : f,
          ),
        );

        scheduleEndTurn();
        if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
        return;
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
            : f,
        ),
      );

      scheduleEndTurn();
      if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
    }

    const searchingTarget = allPlayers.find(
      (target) =>
        getAwareness(enemy, target) === AWARENESS_STATES.SEARCHING &&
        positions?.[target.id],
    );
    const utilityBaseWorld = {
      positions,
      turnCounter,
      calculateDistance,
      getFighterTechniques: getFighterTechniquesFromContext || getFighterTechniques,
      getFighterTacticalPowers,
      getFighterstamina,
      getFighterfocus,
      visibilityByActorId: {
        [enemy.id]: visiblePlayers.map((target) => target.id),
      },
      visibleEnemiesByActorId: {
        [enemy.id]: visiblePlayers.map((target) => target.id),
      },
      lastKnownEnemyByActorId: searchingTarget
        ? {
            [enemy.id]: {
              targetId: searchingTarget.id,
              position: positions[searchingTarget.id],
            },
          }
        : undefined,
      recentEnemyPositions: allPlayers
        .map((target) =>
          positions?.[target.id]
            ? { targetId: target.id, position: positions[target.id] }
            : null,
        )
        .filter(Boolean),
      flags: {
        suspectedAmbush: visiblePlayers.length === 0 && allPlayers.length > 0,
        enteringDanger: visiblePlayers.length === 0 && allPlayers.length > 0,
        hasCover: Boolean(
          combatTerrain?.cover || arenaEnvironment?.objects?.length,
        ),
      },
      environmentType:
        combatTerrain?.terrain === "forest" ||
        combatTerrain?.terrain === "wilderness"
          ? "wilderness"
          : combatTerrain?.terrain,
      sceneContext,
    };
    const utilityWorld = buildAiWorldState({
      actor: enemy,
      fighters,
      round: meleeRound,
      encounter: context.encounter,
      baseWorld: utilityBaseWorld,
    });
    logUtilityAiPerception(enemy, utilityWorld);
    const utilityAction = chooseAiAction(enemy, utilityWorld);
    storeUtilityAiClaim({
      enemy,
      action: utilityAction,
      utilityWorld,
      setFighters,
    });

    const playerTargets = prioritizeEnemyCombatTargets({
      attacker: enemy,
      candidates: visiblePlayers,
      positions,
      calculateDistance,
    });
    const ignoredRouter = visiblePlayers.find((target) => isRoutingOrPassiveTarget(target) && !playerTargets.includes(target));
    if (ignoredRouter && playerTargets[0]) {
      addLog(`${enemy.name} ignores routing ${ignoredRouter.name} and focuses on ${playerTargets[0].name}.`, "info");
    }
    if (playerTargets.length === 0) {
      if (
        utilityAction?.type === ACTION_TYPES.USE_SKILL ||
        utilityAction?.type === ACTION_TYPES.HUNT_ENEMY ||
        utilityAction?.type === ACTION_TYPES.HUNT_REVEALED_ENEMY ||
        utilityAction?.type === ACTION_TYPES.WARN_ALLIES ||
        utilityAction?.type === ACTION_TYPES.GUARD
      ) {
        logUtilityAiDecision(addLog, enemy, utilityAction);

        if (utilityAction.type === ACTION_TYPES.USE_SKILL) {
          const result = resolveAiAction(utilityAction, enemy, utilityWorld);
          const applied = applyAiSkillEvents({
            events: result.events,
            actor: enemy,
            world: utilityWorld,
          });

          applyUtilityWorldPatch({
            enemy,
            appliedWorld: applied.world,
            setFighters,
          });
          for (const event of applied.events) {
            dfocusatchUtilityCombatEvent(event, addLog);
          }
          persistUtilityAiMemory({
            enemy,
            action: utilityAction,
            result,
            world: utilityWorld,
            setFighters,
          });
        } else if (
          utilityAction.type === ACTION_TYPES.HUNT_ENEMY ||
          utilityAction.type === ACTION_TYPES.HUNT_REVEALED_ENEMY
        ) {
          const result = resolveAiAction(utilityAction, enemy, utilityWorld);
          if (utilityAction.type === ACTION_TYPES.HUNT_REVEALED_ENEMY) {
            addLog?.(`${enemy.name} follows the trail.`, "info");
            consumeUtilityAiUnlock({
              enemy,
              unlockType: "HUNT_REVEALED_ENEMY",
              setFighters,
            });
          }
          moveTowardUtilityTarget({
            enemy,
            action: utilityAction,
            positions,
            calculateDistance,
            handlePositionChange,
            addLog,
          });
          persistUtilityAiMemory({
            enemy,
            action: utilityAction,
            result,
            world: utilityWorld,
            setFighters,
          });
        } else if (utilityAction.type === ACTION_TYPES.WARN_ALLIES) {
          const result = resolveAiAction(utilityAction, enemy, utilityWorld);
          const alliedIds = fighters
            .filter(
              (fighter) =>
                isAllyTarget(fighter) && fighter.id !== enemy.id,
            )
            .map((fighter) => fighter.id);
          const focusTargetId =
            utilityAction.targetId ??
            utilityWorld.lastKnownEnemyByActorId?.[enemy.id]?.targetId ??
            null;

          addLog?.(`${enemy.name} warns nearby allies of danger!`, "info");
          consumeUtilityAiUnlock({
            enemy,
            unlockType: "WARN_ALLIES",
            setFighters,
          });
          setDefensiveStance?.((prev) => ({ ...prev, [enemy.id]: "Guard" }));
          setFighters((prev) =>
            prev.map((fighter) =>
              fighter.id === enemy.id
                ? {
                    ...fighter,
                    meta: {
                      ...(fighter.meta || {}),
                      utilityTeamWorldPatch: {
                        ...(fighter.meta?.utilityTeamWorldPatch || {}),
                        scope: AI_KNOWLEDGE_SCOPE.TEAM,
                        flags: {
                          ...(fighter.meta?.utilityTeamWorldPatch?.flags || {}),
                          ambushDetected: true,
                          alliesWarned: true,
                        },
                        teamFocusTargetId: focusTargetId,
                        warnedActorIds: alliedIds,
                      },
                    },
                  }
                : fighter,
            ),
          );
          persistUtilityAiMemory({
            enemy,
            action: utilityAction,
            result,
            world: utilityWorld,
            setFighters,
          });
        } else {
          const result = resolveAiAction(utilityAction, enemy, utilityWorld);
          setDefensiveStance?.((prev) => ({ ...prev, [enemy.id]: "Guard" }));
          addLog?.(
            `[AI] ${enemy.name} guards and scans for hidden threats.`,
            "ai",
          );
          persistUtilityAiMemory({
            enemy,
            action: utilityAction,
            result,
            world: utilityWorld,
            setFighters,
          });
        }

        setFighters((prev) =>
          prev.map((fighter) =>
            fighter.id === enemy.id
              ? {
                  ...fighter,
                  remainingActions: Math.max(
                    0,
                    (fighter.remainingActions ?? enemy.remainingActions ?? 1) -
                      1,
                  ),
                }
              : fighter,
          ),
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      // Check if there are players but they're just not visible
      if (allPlayers.length > 0) {
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¹Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} cannot see any players (hidden/obscured).`,
          "info",
        );
      } else {
        if (onNoHostilesRemaining?.("enemy-no-targets")) {
          if (processingEnemyTurnRef) processingEnemyTurnRef.current = false;
          return;
        }
        // Check if this is a prey animal - if so, use idle/forage behavior instead of just defending
        if (isPreyAnimal(enemy)) {
          const playerEnemies = fighters.filter(
            (f) => isHostileTarget(f) && canFighterAct(f),
          );
          const enemyAllies = fighters.filter(
            (f) => isAllyTarget(f) && f.id !== enemy.id,
          );
          runPreyIdleTurn({
            fighter: enemy,
            enemies: playerEnemies,
            allies: enemyAllies,
            positions,
            terrain: combatTerrain,
            objects: arenaEnvironment?.objects || [],
            log: addLog,
            setFighters,
            scheduleEndTurn,
            processingEnemyTurnRef,
            setPositions,
            positionsRef,
            calculateDistance,
            findRetreatDestination,
            handlePositionChange,
            isHexOccupied,
          });
          return;
        }
        addLog(`${enemy.name} has no targets and defends.`, "info");
      }
      if ((Number(enemy.remainingActions ?? 0) || 0) > 0) {
        setFighters((previous) => spendEnemyNoTargetAction(previous, enemy.id));
      }
      processingEnemyTurnRef.current = false;
      scheduleEndTurn(0, "enemy-no-targets");
      return;
    }

    const normalizeLabel = (value) => {
      if (!value) return null;
      if (typeof value === "string") return value.toLowerCase();
      if (typeof value === "object") {
        const nested =
          value.key ??
          value.id ??
          value.slug ??
          value.type ??
          value.terrain ??
          value.name;
        if (typeof nested === "string") {
          return nested.toLowerCase();
        }
      }
      return null;
    };

    const engineTerrain =
      normalizeLabel(combatTerrain?.terrainData?.terrain) ??
      normalizeLabel(combatTerrain?.terrainData) ??
      normalizeLabel(combatTerrain?.terrain) ??
      normalizeLabel(arenaEnvironment?.terrainData?.terrain) ??
      normalizeLabel(arenaEnvironment?.terrainData) ??
      normalizeLabel(arenaEnvironment?.terrain) ??
      "plains";

    const engineLighting =
      normalizeLabel(combatTerrain?.lightingData?.lighting) ??
      normalizeLabel(combatTerrain?.lightingData) ??
      normalizeLabel(combatTerrain?.lighting) ??
      normalizeLabel(arenaEnvironment?.lightingData?.lighting) ??
      normalizeLabel(arenaEnvironment?.lightingData) ??
      normalizeLabel(arenaEnvironment?.lighting) ??
      "daylight";

    const engineContext = {
      combatants: fighters,
      environment: {
        terrain: engineTerrain,
        lighting: engineLighting,
      },
      positions: positionsRef.current || positions,
      logCallback: (message, type = "ai") => {
        addLog(message, type);
      },
    };

    let actionPlan = null;
    try {
      const selector = createAIActionSelector(engineContext);
      actionPlan = selector(enemy, playerTargets, fighters);
    } catch (error) {
      console.error("[AI] Failed to evaluate layered combat action", error);
      addLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} hesitates (AI error: ${error.message})`,
        "error",
      );
    }

    if (actionPlan && !actionPlan.target && playerTargets.length > 0) {
      actionPlan.target = playerTargets[0];
    }

    if (
      utilityAction &&
      [
        ACTION_TYPES.MELEE_ATTACK,
        ACTION_TYPES.RANGED_ATTACK,
        ACTION_TYPES.AMBUSH_ATTACK,
        ACTION_TYPES.USE_TECHNIQUE,
        ACTION_TYPES.USE_SKILL,
        ACTION_TYPES.WARN_ALLIES,
      ].includes(utilityAction.type)
    ) {
      logUtilityAiDecision(addLog, enemy, utilityAction);

      if (utilityAction.type === ACTION_TYPES.USE_SKILL) {
        const result = resolveAiAction(utilityAction, enemy, utilityWorld);
        const applied = applyAiSkillEvents({
          events: result.events,
          actor: enemy,
          world: utilityWorld,
        });

        applyUtilityWorldPatch({
          enemy,
          appliedWorld: applied.world,
          setFighters,
        });
        for (const event of applied.events) {
          dfocusatchUtilityCombatEvent(event, addLog);
        }
        persistUtilityAiMemory({
          enemy,
          action: utilityAction,
          result,
          world: utilityWorld,
          setFighters,
        });
        setFighters((prev) =>
          prev.map((fighter) =>
            fighter.id === enemy.id
              ? {
                  ...fighter,
                  remainingActions: Math.max(
                    0,
                    (fighter.remainingActions ?? enemy.remainingActions ?? 1) -
                      1,
                  ),
                }
              : fighter,
          ),
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      if (utilityAction.type === ACTION_TYPES.WARN_ALLIES) {
        const result = resolveAiAction(utilityAction, enemy, utilityWorld);
        const alliedIds = fighters
          .filter(
            (fighter) => isAllyTarget(fighter) && fighter.id !== enemy.id,
          )
          .map((fighter) => fighter.id);
        const focusTargetId =
          utilityAction.targetId ??
          utilityWorld.lastKnownEnemyByActorId?.[enemy.id]?.targetId ??
          null;

        addLog?.(`${enemy.name} warns nearby allies of danger!`, "info");
        consumeUtilityAiUnlock({
          enemy,
          unlockType: "WARN_ALLIES",
          setFighters,
        });
        setDefensiveStance?.((prev) => ({ ...prev, [enemy.id]: "Guard" }));
        setFighters((prev) =>
          prev.map((fighter) =>
            fighter.id === enemy.id
              ? {
                  ...fighter,
                  remainingActions: Math.max(
                    0,
                    (fighter.remainingActions ?? enemy.remainingActions ?? 1) -
                      1,
                  ),
                  meta: {
                    ...(fighter.meta || {}),
                    utilityTeamWorldPatch: {
                      ...(fighter.meta?.utilityTeamWorldPatch || {}),
                      scope: AI_KNOWLEDGE_SCOPE.TEAM,
                      flags: {
                        ...(fighter.meta?.utilityTeamWorldPatch?.flags || {}),
                        ambushDetected: true,
                        alliesWarned: true,
                      },
                      teamFocusTargetId: focusTargetId,
                      warnedActorIds: alliedIds,
                    },
                  },
                }
              : fighter,
          ),
        );
        persistUtilityAiMemory({
          enemy,
          action: utilityAction,
          result,
          world: utilityWorld,
          setFighters,
        });
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      const utilityTarget = getActionTarget(utilityAction, fighters);
      if (utilityTarget) {
        const result = resolveAiAction(utilityAction, enemy, utilityWorld);
        persistUtilityAiMemory({
          enemy,
          action: utilityAction,
          result,
          world: utilityWorld,
          setFighters,
        });
        actionPlan = {
          ...(actionPlan || {}),
          type: "attack",
          aiAction:
            utilityAction.type === ACTION_TYPES.USE_TECHNIQUE
              ? "technique"
              : utilityAction.type === ACTION_TYPES.RANGED_ATTACK
                ? "ranged attack"
                : "melee attack",
          target: utilityTarget,
          technique: utilityAction.technique,
          utilityAction,
        };
      }
    }

    if (actionPlan) {
      const aiType = (actionPlan.type || "").toLowerCase();
      if (aiType === "hold") {
        addLog(
          `[AI] ${enemy.name} holds position (${
            actionPlan.aiAction || "Hold"
          })`,
          "ai",
        );
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? {
                  ...f,
                  remainingActions: Math.max(
                    0,
                    (f.remainingActions ?? enemy.remainingActions ?? 1) - 1,
                  ),
                }
              : f,
          ),
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      if (aiType === "defend" || aiType === "evade") {
        const stance =
          actionPlan.stance === "retreat"
            ? "Retreat"
            : actionPlan.defend === "block"
              ? "Block"
              : "Evade";

        if (stance === "Retreat") {
          const currentPositions = positionsRef.current || positions;
          const currentPos = currentPositions?.[enemy.id];
          const threatPositions = playerTargets
            .map((target) => currentPositions?.[target.id])
            .filter(Boolean);

          const speed =
            enemy.Spd ||
            enemy.spd ||
            enemy.attributes?.Spd ||
            enemy.attributes?.spd ||
            10;
          const actionsPerRound =
            enemy.actionsPerRound || enemy.remainingActions || 1;
          const movementStats = calculateMovementPerAction(
            speed,
            Math.max(1, actionsPerRound),
            enemy,
          );
          const fullFeetPerAction =
            movementStats.fullMovementPerAction ||
            movementStats.feetPerAction ||
            (speed * 18) / Math.max(1, actionsPerRound);
          const retreatSteps = Math.max(
            1,
            Math.min(Math.floor(fullFeetPerAction / GRID_CONFIG.CELL_SIZE), 5),
          );

          let retreatDestination = null;
          if (currentPos && threatPositions.length > 0) {
            retreatDestination = findRetreatDestination({
              currentPos,
              threatPositions,
              maxSteps: retreatSteps,
              enemyId: enemy.id,
              isHexOccupied,
            });
          }

          if (retreatDestination) {
            const retreatInfo = {
              action: "RETREAT",
              actionCost: 0,
              description: `Withdraw ${Math.round(
                retreatDestination.distanceFeet,
              )}ft`,
            };
            handlePositionChange(
              enemy.id,
              retreatDestination.position,
              retreatInfo,
            );
            addLog(
              `[AI] ${enemy.name} withdraws ${Math.round(
                retreatDestination.distanceFeet,
              )}ft to (${retreatDestination.position.x}, ${
                retreatDestination.position.y
              }).`,
              "ai",
            );
          } else if (!currentPos) {
            addLog(
              `[AI] ${enemy.name} tries to withdraw but has no recorded position.`,
              "ai",
            );
          } else if (threatPositions.length === 0) {
            addLog(
              `[AI] ${enemy.name} looks for an escape path but no enemies are visible.`,
              "ai",
            );
          } else {
            addLog(
              `[AI] ${enemy.name} tries to withdraw but finds no safe space!`,
              "ai",
            );
          }

          setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Retreat" }));

          const currentEnemyState = fighters.find((f) => f.id === enemy.id);
          const remainingBefore =
            currentEnemyState?.remainingActions ?? enemy.remainingActions ?? 1;
          const remainingAfter = Math.max(0, remainingBefore - 1);

          setFighters((prev) =>
            prev.map((f) =>
              f.id === enemy.id
                ? {
                    ...f,
                    remainingActions: Math.max(
                      0,
                      (f.remainingActions ?? remainingBefore) - 1,
                    ),
                  }
                : f,
            ),
          );
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} has ${remainingAfter} action(s) remaining this melee`,
            "info",
          );

          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        } else {
          addLog(
            `[AI] ${
              enemy.name
            } prepares to ${stance.toLowerCase()} (+defense).`,
            "ai",
          );
          if (stance === "Block" || stance === "Evade") {
            setDefensiveStance((prev) => ({ ...prev, [enemy.id]: stance }));
          }
        }

        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? {
                  ...f,
                  remainingActions: Math.max(
                    0,
                    (f.remainingActions ?? enemy.remainingActions ?? 1) - 1,
                  ),
                }
              : f,
          ),
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    // Enhanced enemy AI with strategic reasoning (fallback/augment for attacks and specials)
    let target = actionPlan?.target || null;
    let reasoning = actionPlan?.aiAction
      ? `layered AI preference: ${actionPlan.aiAction}`
      : "";

    if (!target) {
      // Strategy 1: Target the weakest player (lowest HP percentage)
      const weakestTarget = playerTargets.reduce((weakest, current) => {
        const currentHPPct = current.currentHP / current.maxHP;
        const weakestHPPct = weakest.currentHP / weakest.maxHP;
        return currentHPPct < weakestHPPct ? current : weakest;
      });

      // Strategy 2: Target players with lowest guardRating (easiest to hit)
      const easyTarget = playerTargets.reduce((easiest, current) => {
        const currentGuardRating = current.guardRating || current.guardRating || 10;
        const easiestGuardRating = easiest.guardRating || easiest.guardRating || 10;
        return currentGuardRating < easiestGuardRating ? current : easiest;
      });

      // Strategy 3: Target players who are currently taking their turn (aggressive)
      const currentPlayerTarget = playerTargets.find(
        (f) => f.id === fighters[turnIndex]?.id,
      );

      // Enhanced AI LOGIC: Smart target selection with pathfinding consideration

      // Calculate distances to all targets and check if they're reachable
      // Note: enemyCanFly and enemyIsFlying are declared earlier in function (line 684-685)
      const enemyHasRangedWeapon =
        enemy.equistaminadWeapons?.primary ||
        enemy.equistaminadWeapons?.secondary ||
        enemy.attacks?.some((a) => {
          const name = a.name?.toLowerCase() || "";
          return (
            name.includes("bow") ||
            name.includes("crossbow") ||
            name.includes("sling") ||
            name.includes("thrown") ||
            (a.range && a.range > 10)
          );
        });

      const targetsWithDistance = playerTargets
        .map((t) => {
          const dist =
            positions[enemy.id] && positions[t.id]
              ? calculateDistance(positions[enemy.id], positions[t.id])
              : Infinity;

          // Check if target is blocked by another combatant
          const isBlocked = isTargetBlocked(enemy.id, t.id, positions);

          // Check if target is unreachable using centralized helper
          // First check if already marked as unreachable
          let isUnreachable = isTargetUnreachable(enemy, t);

          // If not marked, check actual reachability
          if (!isUnreachable) {
            // For melee-focused enemies without ranged weapons, check melee reachability
            if (!enemyHasRangedWeapon) {
              isUnreachable = !canThreatenWithMelee(enemy, t);
              if (isUnreachable) {
                markTargetUnreachable(enemy, t);
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
        .sort((a, b) => a.priority - b.priority); // Sort by priority (lower = better)

      // Filter to only targets in reasonable range (within 100 ft to consider) and reachable
      const targetsInRange = targetsWithDistance.filter(
        (t) => t.distance <= 100 && !t.isUnreachable,
      );

      // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â SUPPRESSION AWARENESS: prefer cover when under visible threat
      if (
        enemy.suppression?.isSuppressed &&
        enemy.suppression?.visibleThreat &&
        enemy.remainingActions > 0
      ) {
        const rawObjects = arenaEnvironment?.objects || [];
        const coverObjects = rawObjects
          .map((obj) => (obj?.position ? obj : toSimpleAIObject(obj)))
          .filter(Boolean);
        const hideSpot = findNearbyHidingSpot(
          enemy,
          positions,
          combatTerrain,
          coverObjects,
          6,
        );

        if (hideSpot?.position && handlePositionChange) {
          handlePositionChange(enemy.id, hideSpot.position, {
            action: "MOVE",
            actionCost: 1,
            description: "Move to cover (suppression)",
          });

          setFighters((prev) =>
            prev.map((f) =>
              f.id === enemy.id
                ? {
                    ...f,
                    remainingActions: Math.max(0, f.remainingActions - 1),
                  }
                : f,
            ),
          );

          addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} seeks cover under incoming fire.`, "info");

          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }

      // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ HAWK AI: Special behaviors (landing, scavenging, hunting, circling, eating)
      // Note: enemyCanFly and enemyIsFlying are declared earlier in function (line 684-685)
      const isSkittishFlyingPredator =
        isHawk(enemy) || hasSkittishFlyingPredatorProfile(enemy);

      // 1. LANDING WHEN TIRED: If flying and low on stamina, find safe spot and land (HIGHEST PRIORITY)
      if (
        enemyIsFlying &&
        shouldLandToRest(enemy) &&
        enemy.remainingActions > 0
      ) {
        // Find safe landing hex (away from enemies)
        const myPos = positions[enemy.id];
        if (myPos) {
          // Find enemies nearby
          const nearbyEnemies = fighters
            .filter(
              (f) => isHostileTarget(f) && canFighterAct(f) && f.currentHP > 0,
            )
            .map((f) => ({
              fighter: f,
              pos: positions[f.id],
              dist: positions[f.id]
                ? calculateDistance(myPos, positions[f.id])
                : Infinity,
            }))
            .filter((e) => e.dist < 50); // Within 50ft

          // Try to find a hex away from enemies (simplified: move away from nearest threat)
          if (nearbyEnemies.length > 0) {
            const nearestThreat = nearbyEnemies.sort(
              (a, b) => a.dist - b.dist,
            )[0];
            const threatPos = nearestThreat.pos;

            // Move away from threat
            const dx = myPos.x - threatPos.x;
            const dy = myPos.y - threatPos.y;
            const angle = Math.atan2(dy, dx);
            const retreatDistance = 20; // Move 20ft away
            const newPos = {
              x: myPos.x + Math.cos(angle) * (retreatDistance / 5),
              y: myPos.y + Math.sin(angle) * (retreatDistance / 5),
            };

            setPositions((prev) => {
              const updated = { ...prev, [enemy.id]: newPos };
              positionsRef.current = updated;
              return updated;
            });
            revealAfterObviousMovement(
              enemy,
              setFighters,
              addLog,
              "retreating through the air",
            );

            // Use sprint stamina for fleeing
            spendFlyingStamina(enemy, "FLY_SPRINT", 1);

            addLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} is exhausted and flies to a safer location to rest.`,
              "info",
            );
          }

          // Land: attempt a real tree perch first, fall back to ground landing
          const targetGrid = target?.id ? positions[target.id] : null;
          const perchChoice = pickBestPerchForFlyer({
            flyer: enemy,
            flyerGrid: myPos,
            targetGrid,
            arenaEnvironment,
            options: {
              intent: target ? "STALK" : "SCOUT",
              maxTreeSearchCells: 8,
              preferDistanceToTargetCells: target ? 3 : 6,
            },
          });

          if (perchChoice) {
            const tree = (arenaEnvironment?.objects || []).find(
              (o) => o.id === perchChoice.treeId,
            );

            if (tree && reservePerch(tree, perchChoice.perchId, enemy.id)) {
              setPositions((prev) => {
                const updated = {
                  ...prev,
                  [enemy.id]: {
                    x: perchChoice.treeGrid.x,
                    y: perchChoice.treeGrid.y,
                  },
                };
                positionsRef.current = updated;
                return updated;
              });

              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id
                    ? {
                        ...f,
                        isFlying: false,
                        perchedOn: {
                          treeId: perchChoice.treeId,
                          perchId: perchChoice.perchId,
                        },
                        altitude: perchChoice.altitudeFeet,
                        altitudeFeet: perchChoice.altitudeFeet,
                        perchOffsetFeet: perchChoice.localOffsetFeet,
                      }
                    : f,
                ),
              );

              addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} lands on a branch to rest.`, "info");
            } else {
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id
                    ? { ...f, isFlying: false, altitude: 0, altitudeFeet: 0 }
                    : f,
                ),
              );
              addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} lands on the ground to rest.`, "info");
            }
          } else {
            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id
                  ? { ...f, isFlying: false, altitude: 0, altitudeFeet: 0 }
                  : f,
              ),
            );
            addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} lands on the ground to rest.`, "info");
          }

          // Rest this action (recover stamina)
          recoverStamina(enemy, "FULL_REST", 1);

          // Deduct action
          setFighters((prev) =>
            prev.map((f) =>
              f.id === enemy.id
                ? {
                    ...f,
                    remainingActions: Math.max(0, f.remainingActions - 1),
                  }
                : f,
            ),
          );

          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }

      // 2. SCAVENGING: If hawk is a scavenger and there's a corpse nearby, go eat it
      if (isScavenger(enemy) && enemy.remainingActions > 0) {
        const corpse = findNearbyCorpse(enemy, fighters, positions, 8); // 8 hex radius
        if (corpse) {
          const myPos = positions[enemy.id];
          const corpsePos = positions[corpse.id];

          if (myPos && corpsePos) {
            const distToCorpse = calculateDistance(myPos, corpsePos);

            // Move to corpse if not adjacent
            if (distToCorpse > 5) {
              // Move closer to corpse (simplified movement)
              const dx = corpsePos.x - myPos.x;
              const dy = corpsePos.y - myPos.y;
              const moveDistance = Math.min(5, distToCorpse - 5);
              const angle = Math.atan2(dy, dx);
              const newPos = {
                x: myPos.x + Math.cos(angle) * (moveDistance / 5),
                y: myPos.y + Math.sin(angle) * (moveDistance / 5),
              };

              setPositions((prev) => {
                const updated = { ...prev, [enemy.id]: newPos };
                positionsRef.current = updated;
                return updated;
              });

              // Drain stamina for movement
              if (enemyIsFlying) {
                spendFlyingStamina(enemy, "FLY_HOVER", 1);
              }

              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} moves toward ${
                  corpse.name || "a corpse"
                } to scavenge.`,
                "info",
              );

              // Deduct action
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id
                    ? {
                        ...f,
                        remainingActions: Math.max(0, f.remainingActions - 1),
                      }
                    : f,
                ),
              );

              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            } else {
              // Adjacent to corpse - scavenge it
              scavengeCorpse(enemy, corpse, addLog);

              // Deduct action
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id
                    ? {
                        ...f,
                        remainingActions: Math.max(0, f.remainingActions - 1),
                      }
                    : f,
                ),
              );

              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          }
        }
      }

      // 3. EATING: Removed generic eating block - only scavengers/prey/hawks eat mid-fight
      // (See hawk/skittish-specific eating block further down)

      if (isSkittishFlyingPredator) {
        const profile = getSpeciesBehaviorProfile(enemy);
        const stayAtRangeFeet = profile?.stayAtRangeFeet || 30;
        const fleeIfOutnumberedBy = profile?.fleeIfOutnumberedBy || 2;
        const fleeAtHpPercent = profile?.fleeAtHpPercent || 0.5;

        // Check flee conditions: hurt or outnumbered
        const hpPercent = enemy.currentHP / enemy.maxHP;
        const armedThreatCount = countArmedThreats(
          enemy,
          fighters,
          positions,
          calculateDistance,
          canFighterAct,
          sceneContext,
        );
        const shouldFlee =
          hpPercent < fleeAtHpPercent ||
          armedThreatCount >= fleeIfOutnumberedBy;

        if (shouldFlee) {
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} is ${
              hpPercent < fleeAtHpPercent ? "badly hurt" : "outnumbered"
            } and breaks off to escape!`,
            "info",
          );
          // Maintain altitude and move away from threats
          if (!enemyIsFlying) {
            const newAltitude = isHawk(enemy) ? 100 : 20;
            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id
                  ? { ...f, altitude: newAltitude, altitudeFeet: newAltitude }
                  : f,
              ),
            );
            addLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} takes to the air (altitude: ${newAltitude}ft)`,
              "info",
            );
          }
          // Move away from closest threat
          if (targetsInRange.length > 0) {
            const closestThreat = targetsInRange[0];
            const currentPos = positions[enemy.id];
            const threatPos = positions[closestThreat.target.id];
            if (currentPos && threatPos) {
              // Calculate direction away from threat
              const dx = currentPos.x - threatPos.x;
              const dy = currentPos.y - threatPos.y;
              const angle = Math.atan2(dy, dx);
              const fleeDistance = 10; // Move 10ft away
              const newPos = {
                x: currentPos.x + Math.cos(angle) * (fleeDistance / 5),
                y: currentPos.y + Math.sin(angle) * (fleeDistance / 5),
              };
              setPositions((prev) => {
                const updated = { ...prev, [enemy.id]: newPos };
                positionsRef.current = updated;
                return updated;
              });
              addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} flees to safety`, "info");
            }
          }
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }

        // 1) Prefer tiny prey (scouts + tiny/small animals)
        const preyTargets = targetsInRange.filter((t) =>
          isPreferredHawkPrey(enemy, t.target),
        );

        if (preyTargets.length > 0) {
          // Sort by distance and pick closest prey
          preyTargets.sort((a, b) => a.distance - b.distance);
          const bestPrey = preyTargets[0];
          target = bestPrey.target;
          const preyType = isScoutSizedTarget(bestPrey.target)
            ? "scout"
            : "small animal";
          reasoning = `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${
            enemy.name
          } spots ${preyType} prey and dives to attack (${Math.round(
            bestPrey.distance,
          )}ft away)`;
        } else {
          // 2) No good prey ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â check for larger armed enemies
          const dangerousArmed = targetsInRange.filter(
            (t) => isBiggerThreat(enemy, t.target) && isArmedThreat(t.target),
          );

          if (dangerousArmed.length > 0) {
            // Stay at range - circle and maintain distance
            const currentPos = positions[enemy.id];
            const closestThreat = dangerousArmed[0];
            const threatPos = positions[closestThreat.target.id];
            const currentDist = closestThreat.distance;

            // If too close, move away to maintain stayAtRangeFeet
            if (currentDist < stayAtRangeFeet && currentPos && threatPos) {
              const dx = currentPos.x - threatPos.x;
              const dy = currentPos.y - threatPos.y;
              const angle = Math.atan2(dy, dx);
              const moveAwayDistance = Math.min(
                10,
                stayAtRangeFeet - currentDist,
              );
              const newPos = {
                x: currentPos.x + Math.cos(angle) * (moveAwayDistance / 5),
                y: currentPos.y + Math.sin(angle) * (moveAwayDistance / 5),
              };
              setPositions((prev) => {
                const updated = { ...prev, [enemy.id]: newPos };
                positionsRef.current = updated;
                return updated;
              });
              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} maintains distance from larger threats (staying ${stayAtRangeFeet}ft away)`,
                "info",
              );
              // Ensure flying
              if (!enemyIsFlying) {
                const newAltitude = isHawk(enemy) ? 100 : 20;
                setFighters((prev) =>
                  prev.map((f) =>
                    f.id === enemy.id
                      ? {
                          ...f,
                          altitude: newAltitude,
                          altitudeFeet: newAltitude,
                        }
                      : f,
                  ),
                );
              }
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            } else {
              // Already at safe distance - circle overhead
              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} circles overhead, avoiding larger armed threats`,
                "info",
              );
              if (!enemyIsFlying) {
                const newAltitude = isHawk(enemy) ? 100 : 20;
                setFighters((prev) =>
                  prev.map((f) =>
                    f.id === enemy.id
                      ? {
                          ...f,
                          altitude: newAltitude,
                          altitudeFeet: newAltitude,
                        }
                      : f,
                  ),
                );
                addLog(
                  `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} takes to the air (altitude: ${newAltitude}ft)`,
                  "info",
                );
              }
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          } else if (targetsInRange.length > 0) {
            // Some targets are same size or smaller but not prey-type
            // Pick the smallest/closest non-dangerous target
            const safeTargets = targetsInRange.filter(
              (t) => !isBiggerThreat(enemy, t.target),
            );
            if (safeTargets.length > 0) {
              safeTargets.sort((a, b) => a.distance - b.distance);
              target = safeTargets[0].target;
              reasoning = `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${
                enemy.name
              } targets closest manageable foe (${Math.round(
                safeTargets[0].distance,
              )}ft away)`;
            } else {
              // Fallback to closest
              target = targetsInRange[0].target;
              reasoning = `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${
                enemy.name
              } cautiously approaches closest target (${Math.round(
                targetsInRange[0].distance,
              )}ft away)`;
            }
          } else {
            // No targets in range
            addLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} circles overhead, no suitable targets in range`,
              "info",
            );
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        }
      } else {
        // Normal AI target selection (non-hawk)
        // If no reachable targets, check if enemy has any valid offensive options
        if (targetsInRange.length === 0 && targetsWithDistance.length > 0) {
          const allUnreachable = targetsWithDistance.every(
            (t) => t.isUnreachable,
          );
          if (allUnreachable) {
            // Check if enemy has any way to attack (ranged, techniques, tactics)
            if (!hasAnyValidOffensiveOption(enemy, playerTargets)) {
              // Does this enemy behave like a flying predator and are there any prey at all?
              const hasPreyTargets =
                isFlyingHunter(enemy) && playerTargets.some(isPreyAnimal);

              // If this is a prey animal, use prey idle behavior instead of withdraw
              if (isPreyAnimal(enemy)) {
                const playerEnemies = fighters.filter(
                  (f) => isHostileTarget(f) && canFighterAct(f),
                );
                const enemyAllies = fighters.filter(
                  (f) => isAllyTarget(f) && f.id !== enemy.id,
                );
                runPreyIdleTurn({
                  fighter: enemy,
                  enemies: playerEnemies,
                  allies: enemyAllies,
                  positions,
                  terrain: combatTerrain,
                  objects: arenaEnvironment?.objects || [],
                  log: addLog,
                  setFighters,
                  scheduleEndTurn,
                  processingEnemyTurnRef,
                  setPositions,
                  positionsRef,
                  calculateDistance,
                  findRetreatDestination,
                  handlePositionChange,
                  isHexOccupied,
                });
                return;
              }

              // Flying hunters with prey targets should keep hunting, not withdraw
              if (hasPreyTargets) {
                // Continue circling/hunting instead of withdrawing
                // The hawk will dive on prey in subsequent turns
                processingEnemyTurnRef.current = false;
                scheduleEndTurn();
                return;
              }

              // Non-prey fallback: defend/withdraw as before
              // Only log this once per combat for this fighter (spam control)
              if (!enemy._noOffenseLogged) {
                addLog(
                  `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} has no way to hit any enemies (flight/range). Attempting to withdraw to safety.`,
                  "warning",
                );
                // Mark that we've logged this for this fighter
                setFighters((prev) =>
                  prev.map((f) =>
                    f.id === enemy.id ? { ...f, _noOffenseLogged: true } : f,
                  ),
                );
              }
              processingEnemyTurnRef.current = false;

              // Attempt tactical withdraw instead of just ending turn
              const didWithdraw = attemptTacticalWithdraw({
                enemy,
                fighters,
                positions,
                addLog,
                findRetreatDestination,
                isHexOccupied,
                handlePositionChange,
                setDefensiveStance,
                scheduleEndTurn,
                canFighterAct,
                GRID_CONFIG,
                sceneContext,
              });

              // If withdrawal failed, end turn (withdraw function already handled logging)
              if (!didWithdraw) {
                return;
              }

              // Withdrawal succeeded and already scheduled move + endTurn
              return;
            } else {
              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â« ${enemy.name} cannot reach any targets with melee - all enemies are flying!`,
                "warning",
              );
              // Enemy has ranged options, so continue (they'll use ranged attacks)
            }
          }
        }

        if (targetsInRange.length === 0) {
          // No one in range, use fallback strategies
          if (weakestTarget && weakestTarget.currentHP < weakestTarget.maxHP) {
            target = weakestTarget;
            reasoning = `targeting the weakest foe (${Math.round(
              (weakestTarget.currentHP / weakestTarget.maxHP) * 100,
            )}% HP)`;
          } else if (easyTarget && (easyTarget.guardRating || easyTarget.guardRating) < 10) {
            target = easyTarget;
            reasoning = `targeting easiest to hit (guardRating ${
              easyTarget.guardRating || easyTarget.guardRating
            })`;
          } else if (currentPlayerTarget) {
            target = currentPlayerTarget;
            reasoning = `targeting player currently taking turn (aggressive)`;
          } else {
            // Fallback to closest
            target = targetsWithDistance[0]?.target || playerTargets[0];
            reasoning = `targeting the closest reachable foe`;
          }
        } else {
          // Find best target considering reachability
          const reachableTargets = targetsInRange.filter((t) => !t.isBlocked);
          const blockedTargets = targetsInRange.filter((t) => t.isBlocked);

          if (reachableTargets.length > 0) {
            // Prefer reachable targets
            const bestReachable = reachableTargets[0];
            target = bestReachable.target;
            reasoning = `attacking closest reachable target (${Math.round(
              bestReachable.distance,
            )}ft away)`;
          } else if (blockedTargets.length > 0) {
            // All targets blocked - try area attack or choose alternative
            const bestBlocked = blockedTargets[0];
            target = bestBlocked.target;
            reasoning = `target blocked by ${
              getBlockingCombatant(enemy.id, target.id, positions)?.name ||
              "another combatant"
            }, considering area attack`;
          } else {
            // Fallback
            target = targetsInRange[0].target;
            const dist = Math.round(targetsInRange[0].distance);
            reasoning = `attacking closest target (${dist}ft away)`;
          }
        }
      }
    } // <-- closes the `if (!target) {` block

    if (!reasoning) {
      reasoning = `following layered AI plan: ${
        actionPlan?.aiAction || "Attack"
      }`;
    }

    // Check if enemy needs to move closer to attack
    let needsToMoveCloser = false;
    let currentDistance = Infinity;
    let enemyMovementPlan = null;

    // Select which attack to use (if combatant has multiple attacks)
    const availableAttacks = enemy.attacks || [
      { name: "Claw", damage: "1d6", count: 1 },
    ];
    let selectedAttack = availableAttacks[0]; // Default to first attack
    let isChargingAttack = false; // Track if this will be a charge attack

    if (availableAttacks.length > 1) {
      // Check if combatant has training/technique attacks (prioritize when trainingAbilities exists)
      const trainingAttacks = availableAttacks.filter(
        (a) =>
          a.name.toLowerCase() === "training" ||
          a.name.toLowerCase() === "techniquecasting" ||
          a.damage === "by technique" ||
          (enemy.trainingAbilities &&
            (a.name.toLowerCase().includes("technique") ||
              a.name.toLowerCase().includes("training"))),
      );

      // Check if combatant has charge-type attacks (Horn Charge, Gore, Ram, etc.)
      const chargeAttacks = availableAttacks.filter(
        (a) =>
          a.name.toLowerCase().includes("charge") ||
          a.name.toLowerCase().includes("gore") ||
          a.name.toLowerCase().includes("ram") ||
          a.name.toLowerCase().includes("trample"),
      );

      // Prioritize training attacks if combatant has trainingAbilities or techniques available
      if (
        trainingAttacks.length > 0 &&
        (enemy.trainingAbilities || (enemy.training && enemy.training.length > 0))
      ) {
        // Has training - prefer training attacks (70% chance) but allow other attacks (30%)
        const allAttacks = [
          ...trainingAttacks,
          ...trainingAttacks, // Double weight for training
          ...trainingAttacks, // Triple weight for training
          ...availableAttacks.filter((a) => !trainingAttacks.includes(a)),
        ];
        try {
          const attackRoll = CryptoSecureDice.parseAndRoll(
            `1d${allAttacks.length}`,
          );
          selectedAttack = allAttacks[attackRoll.totalWithBonus - 1];
        } catch (error) {
          const isDev =
            import.meta.env.DEV || import.meta.env.MODE === "development";
          if (isDev) {
            console.warn(
              "[runEnemyTurnAI] Error rolling for training attack selection:",
              error,
            );
          }
          selectedAttack = trainingAttacks[0] || availableAttacks[0];
        }
      } else if (chargeAttacks.length > 0) {
        // Has charge attack - choose randomly between charge and other attacks
        const allAttacks = [
          ...chargeAttacks,
          ...availableAttacks.filter((a) => !chargeAttacks.includes(a)),
        ];
        try {
          const attackRoll = CryptoSecureDice.parseAndRoll(
            `1d${allAttacks.length}`,
          );
          selectedAttack = allAttacks[attackRoll.totalWithBonus - 1];
        } catch (error) {
          const isDev =
            import.meta.env.DEV || import.meta.env.MODE === "development";
          if (isDev) {
            console.warn(
              "[runEnemyTurnAI] Error rolling for attack selection:",
              error,
            );
          }
          selectedAttack = allAttacks[0];
        }
      } else {
        // Choose attack strategically from available
        try {
          const attackRoll = CryptoSecureDice.parseAndRoll(
            `1d${availableAttacks.length}`,
          );
          selectedAttack = availableAttacks[attackRoll.totalWithBonus - 1];
        } catch (error) {
          const isDev =
            import.meta.env.DEV || import.meta.env.MODE === "development";
          if (isDev) {
            console.warn(
              "[runEnemyTurnAI] Error rolling for available attack selection:",
              error,
            );
          }
          selectedAttack = availableAttacks[0];
        }
      }
    }

    if (actionPlan?.aiAction && selectedAttack) {
      const aiActionName = actionPlan.aiAction.toLowerCase();
      const directMatch = availableAttacks.find(
        (attack) => (attack.name || "").toLowerCase() === aiActionName,
      );
      if (directMatch) {
        selectedAttack = directMatch;
      } else if (aiActionName.includes("technique") && actionPlan.technique) {
        const techniqueAttack = {
          name: actionPlan.technique.name,
          damage: actionPlan.technique.damage || "by technique",
          type: "technique",
          technique: actionPlan.technique,
        };
        enemy.selectedAttack = techniqueAttack;
        selectedAttack = techniqueAttack;
      }
    }

    // If attack is Techniquecasting, choose a specific technique
    let attackName = selectedAttack.name;
    if (
      selectedAttack.name === "Techniquecasting" ||
      selectedAttack.damage === "by technique"
    ) {
      // -----------------------------------------------------------------------
      // Threat-aware + memory-aware technique selection
      // - Threat profile tags start false (must be earned)
      // - Weakness memory tracks suspected/confirmed/dfocusroven
      // - Debug HUD shows inferred vs confirmed via meta.aiDebug
      // -----------------------------------------------------------------------

      // Ensure meta containers exist
      if (!enemy.meta) enemy.meta = {};
      if (!enemy.meta._threatProfiles) enemy.meta._threatProfiles = {};

      const role = inferCasterRole(enemy);
      const catalog = getEnemyTechniqueCatalog(enemy);
      const targetKey = target ? getTargetMemoryKey(target) : "no_target";

      const enemyPos = positions?.[enemy.id];
      const targetPos = target ? positions?.[target.id] : null;
      const distFt =
        enemyPos && targetPos
          ? calculateDistance(enemyPos, targetPos)
          : Infinity;

      // 1) Load + merge persistent weakness memory
      const persisted = loadPersistentWeaknessMemory(enemy) || {};
      const inEncounter = enemy.meta._weaknessMemory || {};
      const mergedMemory = mergeWeaknessMemory(persisted, inEncounter);

      // 1a) Apply any deferred outcomes (optional hook set by technique resolver)
      // Expected shape (recommended):
      // enemy.meta.lastTechniqueOutcome = { targetKey, techniqueName, element, outcome, notes }
      const lastOutcome = enemy.meta.lastTechniqueOutcome;
      if (lastOutcome && typeof lastOutcome === "object") {
        try {
          const tk = lastOutcome.targetKey || targetKey;
          recordWeaknessOutcome(mergedMemory, tk, lastOutcome);
        } catch {
          // ignore
        }
        enemy.meta.lastTechniqueOutcome = null;
      }

      enemy.meta._weaknessMemory = mergedMemory;

      // 2) Threat profile tags (start false; must be earned)
      let threatProfile = enemy.meta._threatProfiles[targetKey] || null;
      try {
        threatProfile = createThreatProfile({
          caster: enemy,
          target,
          previous: threatProfile,
          combatTerrain,
          arenaEnvironment,
          weaknessMemory: mergedMemory?.[targetKey] || null,
        });
      } catch {
        // If module uses a simpler signature, fall back safely.
        try {
          threatProfile = createThreatProfile(enemy, target);
        } catch {
          // keep existing
        }
      }
      enemy.meta._threatProfiles[targetKey] = threatProfile;

      // 3) Knowledge check can promote inferred -> suspected/confirmed (no auto reveal)
      try {
        const knowledge = tryKnowledgeCheck({
          caster: enemy,
          target,
          threatProfile,
          weaknessMemory: mergedMemory,
          distanceFeet: distFt,
        });
        if (knowledge?.weaknessMemory) {
          enemy.meta._weaknessMemory = mergeWeaknessMemory(
            enemy.meta._weaknessMemory,
            knowledge.weaknessMemory,
          );
        }
        if (knowledge?.threatProfile) {
          threatProfile = knowledge.threatProfile;
          enemy.meta._threatProfiles[targetKey] = threatProfile;
        }
      } catch {
        // ignore
      }

      // 4) Spam guard: avoid repeating last 2 techniques unless we learned something new
      const recentTechniques = enemy.meta._recentTechniques || [];
      const avoidTechniqueNames = new Set(
        recentTechniques
          .slice(-2)
          .map((s) => String(s?.name || "").toLowerCase())
          .filter(Boolean),
      );

      let chosen = null;
      if (Array.isArray(catalog) && catalog.length > 0 && target) {
        try {
          chosen = selectTechniqueForRole({
            role,
            caster: enemy,
            target,
            distanceFeet: distFt,
            catalog,
            threatProfile,
            weaknessMemory: enemy.meta._weaknessMemory?.[targetKey] || null,
            avoidTechniqueNames,
          });
        } catch {
          chosen = null;
        }
      }

      // Fallback to old random system if we can't pick from catalog
      const technique = chosen || getRandomCombatTechnique(enemy.level || 3);

      // 5) Record attempt (confirmation/dfocusroof comes from resolution hooks)
      if (target) {
        try {
          enemy.meta._weaknessMemory = recordWeaknessAttempt(
            enemy.meta._weaknessMemory || {},
            targetKey,
            technique,
          );
        } catch {
          // ignore
        }
      }

      // 6) Update recent-technique history (spam prevention)
      enemy.meta._recentTechniques = [
        ...recentTechniques,
        { name: technique?.name, t: Date.now() },
      ].slice(-6);

      // 7) Persist memory across encounters
      savePersistentWeaknessMemory(enemy, enemy.meta._weaknessMemory || {});

      // 8) Debug HUD: inferred vs confirmed
      const mem = enemy.meta._weaknessMemory?.[targetKey] || null;
      setEnemyAIDebug(setFighters, enemy.id, {
        casterRole: role,
        targetKey,
        targetId: target?.id,
        targetName: target?.name,
        distanceFeet: Number.isFinite(distFt) ? Math.round(distFt) : null,
        selectedTechnique: technique?.name,
        avoidedRecent: Array.from(avoidTechniqueNames),
        threatProfile: threatProfile || null,
        weaknesses: {
          inferred: mem?.suspected || null,
          confirmed: mem?.confirmed || null,
          dfocusroven: mem?.dfocusroven || null,
        },
      });

      attackName = technique?.name
        ? `${technique.name}${technique.damageType ? ` (${technique.damageType})` : ""}`
        : "Technique";

      selectedAttack = {
        ...selectedAttack,
        damage: technique?.damage || selectedAttack.damage,
        name: attackName,
        technique,
        type: "technique",
      };
    }

    const isLegalEnemyMovementCenter = (center) => (
      Boolean(center) &&
      getCombatantFootprintHexes(enemy, center).every((cell) => (
        cell.x >= 0 &&
        cell.x < GRID_CONFIG.GRID_WIDTH &&
        cell.y >= 0 &&
        cell.y < GRID_CONFIG.GRID_HEIGHT &&
        // movementRules.isValidPosition expects numeric width/height arguments.
        // Terrain legality is handled by the explicit bounds/occupancy checks here;
        // passing the terrain object as the width makes every open-arena cell fail.
        (typeof isValidPosition !== "function" ||
          isValidPosition(cell.x, cell.y)) &&
        !isHexOccupied(cell.x, cell.y, enemy.id)
      ))
    );

    const planEnemyMovement = (maxHexes, candidates = playerTargets) => {
      if (!positions?.[enemy.id] || typeof getHexNeighbors !== "function") return null;
      try {
        return chooseEnemyMovementFallback({
          enemy,
          hostileCandidates: candidates,
          positions,
          currentPosition: positions[enemy.id],
          maxHexes,
          getNeighbors: getHexNeighbors,
          isLegalCenter: isLegalEnemyMovementCenter,
          getDistance: calculateDistance,
          isHostile: (candidate) => isHostileTarget(candidate),
          canAttackFrom: (position, candidate, candidatePosition) => {
            const distance = calculateDistance(position, candidatePosition);
            const attackForDistance = getSelectableActorAttackForDistance(
              enemy,
              distance,
              selectedAttack,
            );
            return Boolean(validateWeaponRange(
              enemy,
              candidate,
              attackForDistance,
              distance,
            )?.canAttack);
          },
          getPreferredAttackHexes: (candidate) => (
            findFlankingPositions(positions[candidate.id], positions, enemy.id) || []
          ),
        });
      } catch (error) {
        return {
          type: "hold",
          target: candidates.find(Boolean) || target || null,
          position: null,
          path: [],
          planningError: error?.message || String(error),
          rankedTargets: [],
        };
      }
    };

    // Rank targets before range logging so a blocked closest target does not
    // hide an attackable or path-reachable hostile actor.
    if (target && positions?.[enemy.id]) {
      const speedForPlanning =
        enemy.Spd || enemy.spd || enemy.attributes?.Spd || enemy.attributes?.spd || 10;
      const runningFeet = MOVEMENT_RATES.calculateMovement(speedForPlanning).running;
      const planningHexes = Math.max(
        1,
        Math.floor(
          (runningFeet / (enemy.actionsPerRound || 1)) /
          (GRID_CONFIG.CELL_SIZE || 5),
        ),
      );
      enemyMovementPlan = planEnemyMovement(planningHexes);
      if (enemyMovementPlan?.target && enemyMovementPlan.target.id !== target.id) {
        const previousTarget = target;
        target = enemyMovementPlan.target;
        currentDistance = calculateDistance(positions[enemy.id], positions[target.id]);
        selectedAttack = getSelectableActorAttackForDistance(
          enemy,
          currentDistance,
          selectedAttack,
        );
        addLog(
          `${enemy.name} cannot get a clear approach to ${previousTarget.name}, so it redirects toward ${target.name}.`,
          "info",
        );
      }
    }

    // Check weapon range for enemy attacks
    if (positions && positions[enemy.id] && positions[target.id]) {
      // Check if enemy just arrived from pending movement - use CURRENT position
      const enemyCurrentPos = positions[enemy.id];
      const targetCurrentPos = positions[target.id];

      // Recalculate distance with current positions using proper hex distance
      currentDistance = calculateDistance(enemyCurrentPos, targetCurrentPos);

      const attackBeforeDistanceFallback = selectedAttack;
      selectedAttack = getSelectableActorAttackForDistance(
        enemy,
        currentDistance,
        selectedAttack,
      );

      const meleeEngagement = getMeleeEngagementContext({
        actor: enemy,
        target,
        positions,
        distanceFeet: currentDistance,
        calculateDistance,
      });
      const closeSelection = selectMeleeAttackForContext({
        actor: enemy,
        target,
        candidates: availableAttacks,
        selectedAttack: isChargeOnlyAttack(attackBeforeDistanceFallback)
          ? attackBeforeDistanceFallback
          : selectedAttack,
        context: meleeEngagement,
      });
      if (closeSelection.rejectedAttack) {
        addLog(
          `charge attack rejected at ${meleeEngagement.rangeBand} range: ${closeSelection.rejectedAttack.name}`,
          "info",
        );
      }
      if (closeSelection.changed && closeSelection.attack) {
        selectedAttack = closeSelection.attack;
        addLog(
          meleeEngagement.isClinched || meleeEngagement.isGrappling || meleeEngagement.isGround
            ? `${enemy.name} uses ${selectedAttack.name} in the clinch.`
            : `${enemy.name} selects ${selectedAttack.name} for close range.`,
          "info",
        );
      }

      const combatLogRoster = fighters || [];
      const enemyLogLabel = formatCombatActorLabel(enemy, {
        roster: combatLogRoster,
        counterpart: target,
      });
      const targetLogLabel = formatCombatActorLabel(target, {
        roster: combatLogRoster,
        counterpart: enemy,
      });
      addLog(
        `${enemyLogLabel} is at (${enemyCurrentPos.x}, ${enemyCurrentPos.y}), ${
          targetLogLabel
        } is at (${targetCurrentPos.x}, ${
          targetCurrentPos.y
        }), distance: ${Math.round(currentDistance)}ft`,
        "info",
      );

      // Use proper weapon range validation
      const rangeValidation = validateWeaponRange(
        enemy,
        target,
        selectedAttack,
        currentDistance,
      );

      // If we're already engaged/adjacent, do not select a charge/gore/ram style attack.
      // (Charge is only valid when we actually charge; prevents "Horn Charge at 5ft".)
      const distFtNow = Number.isFinite(currentDistance)
        ? currentDistance
        : Infinity;
      const selName = String(selectedAttack?.name || "").toLowerCase();
      const isChargeLike =
        selName.includes("charge") ||
        selName.includes("gore") ||
        selName.includes("ram");
      if (isChargeLike && distFtNow <= (GRID_CONFIG?.CELL_SIZE || 5) + 0.01) {
        const nonCharge = (availableAttacks || []).find((a) => {
          const n = String(a?.name || "").toLowerCase();
          return !(
            n.includes("charge") ||
            n.includes("gore") ||
            n.includes("ram")
          );
        });
        if (nonCharge) {
          selectedAttack = nonCharge;
        }
      }

      // Check if target is unreachable (flying target for ground combatant)
      if (rangeValidation.isUnreachable) {
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â« ${enemy.name} cannot reach ${target.name} - ${target.name} is flying and ${enemy.name} cannot fly!`,
          "warning",
        );
        // Skip this target and try another one, or do nothing this turn
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      if (!rangeValidation.canAttack) {
        needsToMoveCloser = true;
        addLog(
          `${enemyLogLabel} is ${Math.round(currentDistance)}ft from ${
            targetLogLabel
          } (${rangeValidation.reason})`,
          "info",
        );
      } else {
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} is in range (${rangeValidation.reason})`,
          "info",
        );
        if (rangeValidation.rangeInfo) {
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} attacking at ${rangeValidation.rangeInfo}`,
            "info",
          );
        }
      }
    }

    // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ HAWK PERCHING BEHAVIOR: perch when idle/scouting and not attacking
    if (
      isFlying(enemy) &&
      enemy.remainingActions > 0 &&
      isSkittishFlyingPredatorCheck &&
      !enemy.perchedOn &&
      positions[enemy.id] &&
      arenaEnvironment?.objects?.length
    ) {
      const shouldPerch =
        !target ||
        (target && currentDistance > 30 && !needsToMoveCloser) ||
        (target && !isPreferredHawkPrey(enemy, target));

      if (shouldPerch) {
        const perchChoice = pickBestPerchForFlyer({
          flyer: enemy,
          flyerGrid: positions[enemy.id],
          targetGrid: target ? positions[target.id] : null,
          arenaEnvironment,
          options: {
            intent: target ? "STALK" : "SCOUT",
            maxTreeSearchCells: 8,
            preferDistanceToTargetCells: target ? 3 : 6,
          },
        });

        if (perchChoice) {
          const tree = arenaEnvironment.objects.find(
            (o) => o.id === perchChoice.treeId,
          );

          if (tree && reservePerch(tree, perchChoice.perchId, enemy.id)) {
            setPositions((prev) => {
              const updated = {
                ...prev,
                [enemy.id]: {
                  x: perchChoice.treeGrid.x,
                  y: perchChoice.treeGrid.y,
                },
              };
              positionsRef.current = updated;
              return updated;
            });
            revealAfterObviousMovement(
              enemy,
              setFighters,
              addLog,
              "perching to observe",
            );

            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id
                  ? {
                      ...f,
                      isFlying: false,
                      perchedOn: {
                        treeId: perchChoice.treeId,
                        perchId: perchChoice.perchId,
                      },
                      altitude: perchChoice.altitudeFeet,
                      altitudeFeet: perchChoice.altitudeFeet,
                      perchOffsetFeet: perchChoice.localOffsetFeet,
                      remainingActions: Math.max(0, f.remainingActions - 1),
                    }
                  : f,
              ),
            );

            addLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} perches on a nearby tree to observe the area.`,
              "info",
            );

            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        }
      }
    }

    // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ FLYING CIRCLING BEHAVIOR: If flying combatant is not actively attacking, make it circle
    // This hastaminans BEFORE dive attacks or other movement, but only if no immediate action is needed
    const flightStyle = getFlightStyle(enemy);
    const isSkittishFlyingPredatorCheck =
      isHawk(enemy) || hasSkittishFlyingPredatorProfile(enemy);

    // Check if we should circle (flying, not attacking this action, not diving/fleeing)
    // Note: enemyIsFlying and enemyCanFly are declared later in the function, so we check isFlying here
    if (
      isFlying(enemy) &&
      flightStyle === "circling" &&
      enemy.remainingActions > 0
    ) {
      // Only circle if:
      // 1. No target selected, OR
      // 2. Target is out of range and we're not actively moving to attack, OR
      // 3. We're maintaining distance (skittish predator behavior)
      const shouldCircle =
        !target ||
        (target && currentDistance > 30 && !needsToMoveCloser) ||
        (isSkittishFlyingPredatorCheck &&
          target &&
          !isPreferredHawkPrey(enemy, target));

      if (shouldCircle) {
        const circled = handleFlyingIdleOrHarassAction(enemy, context);
        if (circled) {
          // Circling movement was performed, end turn
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }
    }

    // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ HAWK DIVE ATTACK: If hawk is hunting prey, perform dive attack
    if (
      isHawk(enemy) &&
      target &&
      isPreferredHawkPrey(enemy, target) &&
      positions[enemy.id] &&
      positions[target.id]
    ) {
      const currentPos = positions[enemy.id];
      const targetPos = positions[target.id];
      const currentDist = calculateDistance(currentPos, targetPos);
      const enemyIsFlying = isFlying(enemy);
      const currentAltitude = getAltitude(enemy);

      // If hawk is flying high and prey is in range, dive to attack
      if (enemyIsFlying && currentAltitude >= 15 && currentDist <= 30) {
        if (!commitEnemyAction("HAWK_DIVE")) {
          processingEnemyTurnRef.current = false;
          return;
        }
        // Dive attack: drop altitude to 0-5ft and move toward target
        const diveAltitude = Math.min(5, currentAltitude - 15); // Drop to low altitude

        // Move horizontally toward target if needed
        let newPos = currentPos;
        if (currentDist > 5) {
          // Move closer to target (simplified - just move in direction of target)
          const dx = targetPos.x - currentPos.x;
          const dy = targetPos.y - currentPos.y;
          const moveDistance = Math.min(5, currentDist - 5); // Move to get within 5ft
          const angle = Math.atan2(dy, dx);
          newPos = {
            x: currentPos.x + Math.cos(angle) * (moveDistance / 5),
            y: currentPos.y + Math.sin(angle) * (moveDistance / 5),
          };
        }

        // Update position and altitude
        setPositions((prev) => {
          const updated = { ...prev, [enemy.id]: newPos };
          positionsRef.current = updated;
          return updated;
        });
        revealAfterObviousMovement(enemy, setFighters, addLog, "diving");

        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? { ...f, altitude: diveAltitude, altitudeFeet: diveAltitude }
              : f,
          ),
        );

        // Drain stamina for dive attack (sprint)
        spendFlyingStamina(enemy, "FLY_SPRINT", 1);

        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} dives from ${currentAltitude}ft to ${diveAltitude}ft to attack ${target.name}!`,
          "info",
        );

        // Deduct movement action
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
              : f,
          ),
        );

        // Attack immediately after dive
        const diveExecutionKey = makeEnemyAttackExecutionKey(enemy, target.id, "enemy-turn-ai-dive-attack", {
          callbackSource: "enemy-turn-ai-dive-attack-callback",
          isDelayedCallback: true,
        });
        setTimeout(() => {
          if (!validateEnemyAttackCallbackEntry({
            actor: enemy,
            targetId: target.id,
            executionKey: diveExecutionKey,
            source: "enemy-turn-ai-dive-attack-callback",
          })) {
            processingEnemyTurnRef.current = false;
            return;
          }
          if (
            combatOverRef?.current ||
            combatEndCheckRef?.current ||
            !combatActive
          ) {
            processingEnemyTurnRef.current = false;
            return;
          }
          const newDistance = calculateDistance(newPos, targetPos);
          const rangeValidation = validateWeaponRange(
            enemy,
            target,
            selectedAttack,
            newDistance,
          );

          if (rangeValidation.canAttack) {
            addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} attacks with talons!`, "info");
            if (attackRef.current) {
              attackRef.current(enemy, target.id, {
                attackActionId: diveExecutionKey,
                source: "enemy-turn-ai-dive-attack",
              });
            }

            // After attack, immediately fly back up and away (hit-and-run)
            setTimeout(() => {
              if (
                combatOverRef?.current ||
                combatEndCheckRef?.current ||
                !combatActive
              ) {
                return;
              }
              const currentPos = positions[enemy.id];
              const targetPos = positions[target.id];

              // Fly up to cruising altitude (100ft for hawks, 20ft for others)
              const cruiseAltitude = isHawk(enemy) ? 100 : 20;
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id
                    ? {
                        ...f,
                        altitude: cruiseAltitude,
                        altitudeFeet: cruiseAltitude,
                      }
                    : f,
                ),
              );
              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} climbs back to ${cruiseAltitude}ft altitude`,
                "info",
              );

              // Move away from target (hit-and-run pattern)
              if (currentPos && targetPos) {
                const dx = currentPos.x - targetPos.x;
                const dy = currentPos.y - targetPos.y;
                const angle = Math.atan2(dy, dx);
                const moveAwayDistance = 10; // Move 10ft away
                const newPos = {
                  x: currentPos.x + Math.cos(angle) * (moveAwayDistance / 5),
                  y: currentPos.y + Math.sin(angle) * (moveAwayDistance / 5),
                };
                setPositions((prev) => {
                  const updated = { ...prev, [enemy.id]: newPos };
                  positionsRef.current = updated;
                  return updated;
                });
                revealAfterObviousMovement(
                  enemy,
                  setFighters,
                  addLog,
                  "breaking away after the attack",
                );
                addLog(
                  `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} breaks away after the attack (hit-and-run)`,
                  "info",
                );
              }
            }, 500);
          } else {
            addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} misses the dive attack`, "info");
            // Still fly back up
            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id
                  ? { ...f, altitude: 20, altitudeFeet: 20 }
                  : f,
              ),
            );
          }

          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
        }, 1000);

        return;
      } else if (!enemyIsFlying && currentDist <= 30) {
        // Hawk on ground, take off and dive
        const takeOffAltitude = isHawk(enemy) ? 100 : 20;
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? {
                  ...f,
                  altitude: takeOffAltitude,
                  altitudeFeet: takeOffAltitude,
                }
              : f,
          ),
        );
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} takes to the air (altitude: ${takeOffAltitude}ft) to hunt ${target.name}`,
          "info",
        );

        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
              : f,
          ),
        );

        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    // 4. CIRCLING: If flying and no other action, circle overhead (default flying behavior)
    // Check if this is a skittish flying predator (may be declared earlier in function scope)
    const isSkittishFlyingPredatorForCircling =
      isHawk(enemy) || hasSkittishFlyingPredatorProfile(enemy);
    if (
      enemyIsFlying &&
      enemy.remainingActions > 0 &&
      isSkittishFlyingPredatorForCircling
    ) {
      const flightStyle = getFlightStyle(enemy);
      if (flightStyle === "circling") {
        // Only circle if:
        // 1. No target selected, OR
        // 2. Target is out of range and we're not actively moving to attack, OR
        // 3. We're maintaining distance (skittish predator behavior)
        const shouldCircle =
          !target ||
          (target && currentDistance > 30 && !needsToMoveCloser) ||
          (target && !isPreferredHawkPrey(enemy, target));

        if (shouldCircle) {
          const circled = handleFlyingIdleOrHarassAction(enemy, context);
          if (circled) {
            // Circling movement was performed, end turn
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        }
      }
    }

    // 5. EATING: If grounded and has food, eat it (lowest priority)
    const isSkittishFlyingPredatorForEating =
      isHawk(enemy) || hasSkittishFlyingPredatorProfile(enemy);
    if (
      !enemyIsFlying &&
      enemy.remainingActions > 0 &&
      isSkittishFlyingPredatorForEating
    ) {
      const foodItem = findFoodItem(enemy);
      if (foodItem) {
        consumeItem(enemy, foodItem, { log: addLog });

        // Deduct action
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? { ...f, remainingActions: Math.max(0, f.remainingActions - 1) }
              : f,
          ),
        );

        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    // Enhanced enemy AI using distance-based combat system
    if (
      needsToMoveCloser &&
      target &&
      positions[enemy.id] &&
      positions[target.id]
    ) {
      const currentPos = positions[enemy.id];
      let targetPos = positions[target.id];

      // Check if target is unreachable using centralized helper
      if (!canThreatenWithMelee(enemy, target)) {
        // Check if enemy has ranged weapons - if so, they can still attack
        const enemyHasRangedWeapon =
          enemy.equistaminadWeapons?.primary ||
          enemy.equistaminadWeapons?.secondary ||
          enemy.attacks?.some((a) => {
            const name = a.name?.toLowerCase() || "";
            return (
              name.includes("bow") ||
              name.includes("crossbow") ||
              name.includes("sling") ||
              name.includes("thrown") ||
              (a.range && a.range > 10)
            );
          });

        if (!enemyHasRangedWeapon) {
          const targetAltitude = getAltitude(target) || 0;
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â« ${enemy.name} cannot reach ${target.name} with melee - ${target.name} is flying (${targetAltitude}ft) and ${enemy.name} has no ranged weapons!`,
            "warning",
          );
          markTargetUnreachable(enemy, target);
          // Skip this target - don't waste actions trying to reach an unreachable target
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }

      // Use analyzeMovementAndAttack to determine best movement strategy
      const equistaminadWeapon =
        enemy.equistaminadWeapons?.primary ||
        enemy.equistaminadWeapons?.secondary ||
        enemy.attacks?.[0] ||
        null;
      if (equistaminadWeapon) {
        const movementAnalysis = analyzeMovementAndAttack(
          enemy,
          target,
          currentPos,
          targetPos,
          equistaminadWeapon,
        );
        // NEW: Double-check with full range logic (including altitude) before trusting inRange
        const currentDistance = calculateDistance(currentPos, targetPos);
        const rangeValidation = validateWeaponRange(
          enemy,
          target,
          equistaminadWeapon,
          currentDistance,
        );
        const movementLogRoster = fighters || [];
        const movementEnemyLabel = formatCombatActorLabel(enemy, {
          roster: movementLogRoster,
          counterpart: target,
        });
        const movementTargetLabel = formatCombatActorLabel(target, {
          roster: movementLogRoster,
          counterpart: enemy,
        });

        // Only trust movementAnalysis.inRange if altitude-aware range check also says canAttack
        const actuallyInRange =
          movementAnalysis.inRange && rangeValidation.canAttack;

        if (
          movementAnalysis.recommendations &&
          movementAnalysis.recommendations.length > 0
        ) {
          if (movementAnalysis.inRange && !rangeValidation.canAttack) {
            // Movement analysis says "in range" but altitude check says "unreachable"
            dbgLog(
              `${movementEnemyLabel} analyzes movement toward ${movementTargetLabel}: ${movementAnalysis.distance}ft away, but ${rangeValidation.reason}`,
              "info",
            );
          } else {
            dbgLog(
              `${movementEnemyLabel} analyzes movement toward ${movementTargetLabel}: ${
                movementAnalysis.distance
              }ft away, ${actuallyInRange ? "in range" : "needs to move"}`,
              "info",
            );
          }
        }

        // If target is unreachable due to altitude, mark it and skip movement
        if (
          !rangeValidation.canAttack &&
          (rangeValidation.reason?.includes("flying too high") ||
            rangeValidation.reason?.includes(
              "cannot be reached by melee attacks from ground",
            ))
        ) {
          // If we can fly, pursue the target into the air instead of giving up.
          const enemyCanFlyNow = canFly(enemy);
          const enemyIsFlyingNow = isFlying(enemy);
          const targetAltFeet = target?.altitudeFeet ?? target?.altitude ?? 0;
          const enemyAltFeet = enemy?.altitudeFeet ?? enemy?.altitude ?? 0;

          if (enemyCanFlyNow) {
            // Climb/descend in 20ft steps per action (keeps it Medieval Combat Simulator-ish and avoids "teleport to altitude").
            const ALT_STEP_FT = 20;
            const desiredAlt = Math.max(0, targetAltFeet);
            let nextAlt = enemyAltFeet;

            if (!enemyIsFlyingNow && enemyAltFeet <= 0) {
              // Take off
              nextAlt = Math.min(ALT_STEP_FT, desiredAlt || ALT_STEP_FT);
            } else if (enemyAltFeet < desiredAlt) {
              nextAlt = Math.min(enemyAltFeet + ALT_STEP_FT, desiredAlt);
            } else if (enemyAltFeet > desiredAlt) {
              nextAlt = Math.max(enemyAltFeet - ALT_STEP_FT, desiredAlt);
            }

            // Spend 1 action to change altitude / take off
            const enemyHasActions = (enemy.remainingActions ?? 0) > 0;

            if (enemyHasActions) {
              const updatedMeta = { ...(enemy.meta || {}) };
              updatedMeta.aiDebug = updatedMeta.aiDebug || {};
              updatedMeta.aiDebug.flight = {
                ...(updatedMeta.aiDebug.flight || {}),
                intent: "pursue_air",
                target: target.name,
                inferredFrom: rangeValidation.reason,
                fromAlt: enemyAltFeet,
                toAlt: nextAlt,
                targetAlt: desiredAlt,
              };

              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} takes to the air to pursue ${target.name} (${enemyAltFeet}ft ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ${nextAlt}ft)`,
                "info",
              );

              setFighters((prev) =>
                prev.map((f) => {
                  if (f.id !== enemy.id) return f;
                  return {
                    ...f,
                    isFlying: true,
                    altitudeFeet: nextAlt,
                    altitude: nextAlt,
                    meta: updatedMeta,
                    remainingActions: Math.max(
                      0,
                      (f.remainingActions ?? 0) - 1,
                    ),
                  };
                }),
              );

              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          }

          // Target is flying too high and we can't (or can't act) -> mark as unreachable and end turn immediately
          markTargetUnreachable(enemy, target);
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} realizes ${target.name} is unreachable (${rangeValidation.reason}).`,
            "warning",
          );
          // Mark target as unreachable for this round to prevent spam
          if (!enemy.meta) enemy.meta = {};
          if (!enemy.meta.unreachableTargetsThisRound) {
            enemy.meta.unreachableTargetsThisRound = [];
          }
          if (!enemy.meta.unreachableTargetsThisRound.includes(target.id)) {
            enemy.meta.unreachableTargetsThisRound.push(target.id);
          }
          setFighters((prev) =>
            prev.map((f) =>
              f.id === enemy.id ? { ...f, meta: enemy.meta } : f,
            ),
          );
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }

      // Use new AI system for movement decisions with flanking consideration
      const aiDecision = calculateEnemyMovementAI(
        enemy,
        target,
        currentPos,
        targetPos,
        availableAttacks,
      );
      if (String(aiDecision?.reason || "").toLowerCase() === "can reach and attack") {
        aiDecision.reason = "cannot attack this action, closing distance";
      }
      const tacticalAllies = fighters.filter((fighter) => (
        fighter.id !== enemy.id && canFighterAct(fighter) && isAllyTarget(fighter)
      ));
      const tacticalEnemies = fighters.filter((fighter) => (
        fighter.id !== enemy.id && canFighterAct(fighter) && isHostileTarget(fighter)
      ));
      const allyEngaged = tacticalAllies.some((ally) => (
        positions[ally.id] && calculateDistance(positions[ally.id], targetPos) <= GRID_CONFIG.CELL_SIZE + 0.01
      ));
      const tacticalIntent = decideEnemyTacticalIntentSafely({
        actor: enemy,
        target,
        distanceFt: currentDistance,
        meleeRangeFt: GRID_CONFIG.CELL_SIZE,
        allies: tacticalAllies,
        enemies: tacticalEnemies,
        battlefield: { allyEngaged },
        movementContext: {
          hasAttackOption: availableAttacks.length > 0,
          inAttackRange: false,
          allyEngaged,
          defensive: ["defensive", "guard"].includes(String(enemy.aiRole || "").toLowerCase()),
        },
      }, (error) => addLog(
        `${enemy.name} tactical intent failed; using normal advance (${error?.message || String(error)}).`,
        "warning",
      ));
      addLog(
        `${enemy.name} chooses ${tacticalIntent.intent.replaceAll("_", " ")}: ${tacticalIntent.reasons.slice(0, 2).join("; ")}.`,
        "info",
      );
      if (tacticalIntent.intent === "hold" || tacticalIntent.intent === "hesitate") {
        executeEnemyMovementPlan({ type: tacticalIntent.intent, position: null }, {
          commit: () => commitEnemyAction(`TACTICAL_${tacticalIntent.intent.toUpperCase()}`),
          spendAction: () => setFighters((prev) => prev.map((fighter) => (
            fighter.id === enemy.id
              ? {
                  ...fighter,
                  remainingActions: Math.max(0, (Number(fighter.remainingActions ?? 0) || 0) - 1),
                }
              : fighter
          ))),
          finish: ({ committed }) => {
            if (!committed) return;
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
          },
        });
        return;
      }

      // Check for flanking opportunities
      const flankingPositions = findFlankingPositions(
        targetPos,
        positions,
        enemy.id,
      );
      const currentFlankingBonus = calculateFlankingBonus(
        currentPos,
        targetPos,
        positions,
        enemy.id,
      );

      // If we can flank, prioritize flanking positions
      // BUT: Check if target is reachable with melee first
      if (flankingPositions.length > 0 && currentFlankingBonus === 0) {
        // Check if target is reachable with melee before attempting to flank
        if (!canThreatenWithMelee(enemy, target)) {
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} skips flanking ${target.name} (target unreachable in melee)`,
            "warning",
          );
          markTargetUnreachable(enemy, target);
          // Don't attempt flanking if target is unreachable - skip to next action
        } else {
          dbgLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ ${enemy.name} considers flanking ${target.name}`, "info");

          // Find the best flanking position (closest to current position AND within attack range)
          const speed =
            enemy.Spd ||
            enemy.spd ||
            enemy.attributes?.Spd ||
            enemy.attributes?.spd ||
            10;

          // For flying combatants, movement is not limited by ground speed
          // They can use flight movement which may allow longer distances
          // For now, we'll use a more generous movement allowance for fliers
          const enemyIsFlying = isFlying(enemy);
          const enemyCanFly = canFly(enemy);
          const maxMoveDistance =
            enemyCanFly || enemyIsFlying
              ? speed * 10 // Flying combatants can move further (10ft per speed point)
              : speed * 5; // Ground movement: 5 feet per hex

          // Log movement type for debugging
          if (enemyCanFly || enemyIsFlying) {
            addLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ ${enemy.name} uses flight movement (max ${maxMoveDistance}ft)`,
              "info",
            );
          }

          const flankPlan = planEnemyMovement(
            Math.max(1, Math.floor(maxMoveDistance / (GRID_CONFIG.CELL_SIZE || 5))),
            [target],
          );
          const reachableFlankKeys = new Set(
            (flankPlan?.rankedTargets?.[0]?.attackHexes || [])
              .filter((entry) => entry.preferred)
              .map((entry) => `${entry.position.x},${entry.position.y}`),
          );

          // Filter flanking positions to only those that are:
          // 1. Within movement range
          // 2. Within attack range after moving
          const validFlankingPositions = flankingPositions.filter(
            (flankPos) => {
              if (!reachableFlankKeys.has(`${flankPos.x},${flankPos.y}`)) return false;
              const flankDistance = calculateDistance(currentPos, flankPos);
              if (flankDistance > maxMoveDistance) return false; // Can't reach it

              // Check if this flanking position is within attack range
              const distanceFromFlankToTarget = calculateDistance(
                flankPos,
                targetPos,
              );
              const rangeValidation = validateWeaponRange(
                enemy,
                target,
                selectedAttack,
                distanceFromFlankToTarget,
              );
              return rangeValidation.canAttack;
            },
          );

          if (validFlankingPositions.length > 0) {
            // Find the best valid flanking position (closest to current position)
            const bestFlankPos = validFlankingPositions.reduce(
              (best, current) => {
                const bestDist = calculateDistance(currentPos, best);
                const currentDist = calculateDistance(currentPos, current);
                return currentDist < bestDist ? current : best;
              },
            );

            const flankDistance = calculateDistance(currentPos, bestFlankPos);

            dbgLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ ${enemy.name} attempts to flank ${target.name}`, "info");

            if (!commitEnemyAction("FLANKING_MOVE")) {
              processingEnemyTurnRef.current = false;
              return;
            }

            // Move to flanking position
            setPositions((prev) => {
              const updated = {
                ...prev,
                [enemy.id]: bestFlankPos,
              };
              positionsRef.current = updated;
              return updated;
            });

            // Deduct movement action cost
            const movementCost = Math.ceil(flankDistance / (speed * 5));
            setFighters((prev) =>
              prev.map((f) =>
                f.id === enemy.id
                  ? {
                      ...f,
                      remainingActions: Math.max(
                        0,
                        f.remainingActions - movementCost,
                      ),
                    }
                  : f,
              ),
            );

            dbgLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ ${enemy.name} targets flanking position (${bestFlankPos.x}, ${bestFlankPos.y})`,
              "info",
            );

            // Flanking reposition only this slice (same rule as RUN/MOVE ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â no move+attack here).
            setTimeout(() => {
              if (
                combatOverRef?.current ||
                combatEndCheckRef?.current ||
                !combatActive
              ) {
                processingEnemyTurnRef.current = false;
                return;
              }
              const newDistance = calculateDistance(bestFlankPos, targetPos);
              if (
                markDistanceClosed &&
                combatStateRef?.current &&
                newDistance <= (GRID_CONFIG.CELL_SIZE || 5) + 0.01
              ) {
                try {
                  markDistanceClosed(enemy, target, combatStateRef.current);
                } catch {
                  // ignore
                }
              }
              processingEnemyTurnRef.current = false;
              scheduleEndTurn(0);
            }, 1000);
            return;
          } else {
            // No valid flanking positions (either can't reach them or they're out of attack range)
            // Fall through to normal movement logic
            dbgLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ ${enemy.name} cannot reach a valid flanking position - will move directly toward ${target.name}`,
              "info",
            );
            if (
              (flankPlan?.rankedTargets?.[0]?.attackHexes || [])
                .some((entry) => !entry.preferred)
            ) {
              addLog(
                `${enemy.name} cannot reach the flank tile, so it takes the nearest open attack position.`,
                "info",
              );
            }
          }
        } // Close the else block for reachable target check
      }

      // Get enemy speed for movement calculations
      const speed =
        enemy.Spd ||
        enemy.spd ||
        enemy.attributes?.Spd ||
        enemy.attributes?.spd ||
        10;

      let movementType = "MOVE";
      let movementDescription = "moves";
      let hexesToMove = 1;
      let isChargingAttack = false;

      switch (aiDecision.decision) {
        case "charge":
          movementType = "CHARGE";
          movementDescription = "charges";
          hexesToMove = Math.min(
            Math.round(currentDistance / GRID_CONFIG.CELL_SIZE) - 1,
            3,
          );
          isChargingAttack = true;
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ ${enemy.name} decides to charge! (${aiDecision.reason})`,
            "info",
          );
          break;

        case "move_and_attack": {
          movementType = "MOVE";
          movementDescription = "moves closer";
          // Use Medieval Combat Simulator movement calculation: Speed ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 18 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· actions per round = feet per action
          const moveAndAttackFeetPerAction =
            (speed * 18) / (enemy.actionsPerRound || 1);
          const moveAndAttackWalkingSpeed = Math.floor(
            moveAndAttackFeetPerAction * 0.5,
          ); // Walking speed
          hexesToMove = Math.floor(
            moveAndAttackWalkingSpeed / GRID_CONFIG.CELL_SIZE,
          );
          if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} moves closer to attack (${aiDecision.reason})`,
            "info",
          );
          }
          break;
        }

        case "move_closer": {
          movementType = "RUN";
          movementDescription = "runs closer";
          // Use Medieval Combat Simulator movement calculation: Speed ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â 18 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· actions per round = feet per action
          const moveCloserFeetPerAction =
            (speed * 18) / (enemy.actionsPerRound || 1);
          hexesToMove = Math.floor(
            moveCloserFeetPerAction / GRID_CONFIG.CELL_SIZE,
          );
          addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} runs closer (${aiDecision.reason})`, "info");
          break;
        }

        case "use_ranged": {
          // Try to use ranged attack instead of moving
          const rangedAttack = availableAttacks.find(
            (a) => a.range && a.range > 0,
          );
          if (rangedAttack) {
            addLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹ ${enemy.name} uses ranged attack instead of moving (${aiDecision.reason})`,
              "info",
            );
            if (!commitEnemyAction("USE_RANGED_INSTEAD")) {
              processingEnemyTurnRef.current = false;
              return;
            }
            const rangedExecutionKey = makeEnemyAttackExecutionKey(enemy, target.id, "enemy-turn-ai-ranged-attack", {
              callbackSource: "enemy-turn-ai-ranged-callback",
              isDelayedCallback: true,
            });
            setTimeout(() => {
              if (!validateEnemyAttackCallbackEntry({
                actor: enemy,
                targetId: target.id,
                executionKey: rangedExecutionKey,
                source: "enemy-turn-ai-ranged-callback",
              })) {
                processingEnemyTurnRef.current = false;
                return;
              }
              if (
                combatOverRef?.current ||
                combatEndCheckRef?.current ||
                !combatActive
              ) {
                processingEnemyTurnRef.current = false;
                return;
              }
              const flankingBonus = calculateFlankingBonus(
                positions[enemy.id],
                positions[target.id],
                positions,
                enemy.id,
              );
              const bonuses = {
                ...(flankingBonus > 0 ? { flankingBonus } : {}),
                attackDataOverride: rangedAttack,
                attackActionId: rangedExecutionKey,
                source: "enemy-turn-ai-ranged-attack",
              };
              attack(
                { ...enemy, selectedAttack: rangedAttack },
                target.id,
                bonuses,
              );
              processingEnemyTurnRef.current = false;
            }, 1000);
            return;
          }
          // Fall back to movement if no ranged attack
          movementType = MOVEMENT_ACTIONS.RUN.name;
          movementDescription = "runs closer";
          // Use MOVEMENT_RATES for Medieval Combat Simulator movement calculation
          const movementRates = MOVEMENT_RATES.calculateMovement(speed);
          const fallbackFeetPerAction =
            movementRates.running / (enemy.actionsPerRound || 1);
          hexesToMove = Math.floor(
            fallbackFeetPerAction / GRID_CONFIG.CELL_SIZE,
          );
          break;
        }

        default:
          movementType = MOVEMENT_ACTIONS.MOVE.name;
          movementDescription = "moves";
          hexesToMove = 1;
      }

      // Legacy fallback for very far distances - use Medieval Combat Simulator movement
      if (currentDistance > 20 * GRID_CONFIG.CELL_SIZE) {
        // Far away - RUN (move at full speed using Medieval Combat Simulator formula)
        movementType = MOVEMENT_ACTIONS.RUN.name;
        movementDescription = "runs";

        // Use MOVEMENT_RATES for official Medieval Combat Simulator movement
        const movementRates = MOVEMENT_RATES.calculateMovement(speed);
        const maxMovementFeet =
          movementRates.running / (enemy.actionsPerRound || 1); // Use feet per action
        hexesToMove = Math.floor(maxMovementFeet / GRID_CONFIG.CELL_SIZE);

        if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} is very far away, ${movementDescription} at full speed (${maxMovementFeet}ft/action)`,
          "info",
        );
        }
      }
      // else: close distance (1-3 hexes) - use default MOVE (1 hex)

      if (
        ["cautious_advance", "flank"].includes(tacticalIntent.intent) &&
        movementType !== "CHARGE" &&
        movementType !== "FLY"
      ) {
        movementType = "MOVE";
        movementDescription = tacticalIntent.intent === "flank"
          ? "advances cautiously toward a flank"
          : "advances cautiously";
        const cautiousFeet = (speed * 18 * 0.5) / (enemy.actionsPerRound || 1);
        hexesToMove = Math.max(1, Math.floor(cautiousFeet / GRID_CONFIG.CELL_SIZE));
      }

      // AI switch uses "MOVE"/"RUN"/"CHARGE" while MOVEMENT_ACTIONS uses Title Case ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â normalize.
      const mtNorm = String(movementType || "").trim();
      const mtUstaminar = mtNorm.toUpperCase();
      const isChargeMovement =
        mtNorm === MOVEMENT_ACTIONS.CHARGE.name || mtUstaminar === "CHARGE";
      const isWalkOrMoveMovement =
        mtNorm === MOVEMENT_ACTIONS.MOVE.name ||
        ["MOVE", "WALK"].includes(mtUstaminar);

      // If we decided to CHARGE, make sure we're using a charge-type attack!
      if (isChargeMovement && isChargingAttack) {
        const chargeAttacks = availableAttacks.filter(
          (a) =>
            a.name.toLowerCase().includes("charge") ||
            a.name.toLowerCase().includes("gore") ||
            a.name.toLowerCase().includes("ram"),
        );

        if (chargeAttacks.length > 0) {
          selectedAttack = chargeAttacks[0]; // Use Horn Charge, Gore, etc.
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ ${enemy.name} selects ${selectedAttack.name} for the charge!`,
            "combat",
          );
        }
      }

      // Calculate new position
      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // FIX: Check for zero or very small distance to prevent NaN
      if (distance < 0.01) {
        // Already at target position, no movement needed
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} is already at target position, skipping movement`,
          "info",
        );
        // Continue to attack if in range
        const distanceFromCurrentPos = calculateDistance(currentPos, targetPos);
        const rangeValidation = validateWeaponRange(
          enemy,
          target,
          selectedAttack,
          distanceFromCurrentPos,
        );

        if (rangeValidation.canAttack) {
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} attacks from current position (${rangeValidation.reason})`,
            "info",
          );
          // Continue to attack below (don't return)
        } else {
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} cannot reach target (${rangeValidation.reason}) and ends turn`,
            "info",
          );
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }

      // Calculate distance in hexes for movement calculations
      const hexDistance = Math.round(currentDistance / GRID_CONFIG.CELL_SIZE);
      const movementBudget = resolveEnemyMovementBudget({
        fighter: enemy,
        movementType,
        pathSearchBudgetFeet: hexesToMove * GRID_CONFIG.CELL_SIZE,
        legacyAllowanceFeet: hexesToMove * GRID_CONFIG.CELL_SIZE,
        distanceFeet: currentDistance,
        cellSize: GRID_CONFIG.CELL_SIZE,
      });

      dbgLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} movement debug: distance=${Math.round(
          currentDistance,
        )}ft, hexDistance=${hexDistance}, ${formatEnemyMovementDebug(movementBudget)}, movementType=${movementType}`,
        "info",
      );

      // Determine actual hexes to move (don't overshoot, but ensure at least 1 hex if far away)
      // Fix: Ensure we always make progress toward the target
      let actualHexesToMove;

      actualHexesToMove = movementBudget.maxCommittedHexes;
      const moveRatio =
        (actualHexesToMove * GRID_CONFIG.CELL_SIZE) /
        (distance * GRID_CONFIG.CELL_SIZE);

      // Log movement ratio for debugging (if significant movement)
      const isDev =
        import.meta.env.DEV || import.meta.env.MODE === "development";
      if (isDev && moveRatio > 0.1) {
        console.debug(
          `[runEnemyTurnAI] Movement ratio: ${(moveRatio * 100).toFixed(
            1,
          )}% of distance`,
        );
      }

      let newX, newY, movementInfo;
      const liveMovementPlan = planEnemyMovement(actualHexesToMove);
      if (liveMovementPlan?.target && liveMovementPlan.target.id !== target.id) {
        const previousTarget = target;
        target = liveMovementPlan.target;
        targetPos = positions[target.id];
        addLog(
          `${enemy.name} redirects toward ${target.name} because ${previousTarget.name} is blocked.`,
          "info",
        );
      }
      const movementValidation = validateEnemyMovementPlan(liveMovementPlan, {
        currentPosition: currentPos,
        isLegalCenter: isLegalEnemyMovementCenter,
      });
      const executableMovementPlan = movementValidation.valid
        ? liveMovementPlan
        : {
            ...liveMovementPlan,
            type: "hold",
            position: null,
            invalidReason: movementValidation.reason,
          };
      const plannedMovementPosition = executableMovementPlan?.position || null;
      if (plannedMovementPosition && liveMovementPlan.type === "approach") {
        const actualFeet = calculateDistance(currentPos, plannedMovementPosition);
        addLog(
          `${enemy.name} cannot reach an open attack position, so it advances ${Math.round(actualFeet)}ft along a clear path.`,
          "info",
        );
        dbgLog(
          `${enemy.name} movement debug: ${formatEnemyMovementDebug({
            ...movementBudget,
            actualMovedDistance: actualFeet,
          })}`,
          "info",
        );
      } else if (!plannedMovementPosition && executableMovementPlan?.type === "hold") {
        executeEnemyMovementPlan(executableMovementPlan, {
          commit: () => commitEnemyAction("BLOCKED_MOVEMENT_HOLD"),
          hold: (plan) => {
            const failureReason = plan.planningError
              ? `movement planning failed: ${plan.planningError}`
              : plan.invalidReason
                ? `the selected plan was ${plan.invalidReason}`
                : "all closer candidates are blocked";
            addLog(
              `${enemy.name} cannot find a legal approach hex: ${failureReason}.`,
              "warning",
            );
          },
          spendAction: () => setFighters((prev) => prev.map((fighter) => (
            fighter.id === enemy.id
              ? {
                  ...fighter,
                  remainingActions: Math.max(0, (fighter.remainingActions ?? 1) - 1),
                }
              : fighter
          ))),
          finish: () => {
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
          },
        });
        return;
      }

      if (isChargeMovement || isWalkOrMoveMovement) {
        // MOVE: move calculated hexes immediately
        // CHARGE: move multiple hexes immediately and attack with bonuses
        const hexesThisTurn = actualHexesToMove; // Use the calculated movement distance

        // FIX: Prevent NaN by ensuring distance is valid
        if (plannedMovementPosition) {
          newX = plannedMovementPosition.x;
          newY = plannedMovementPosition.y;
        } else if (distance < 0.01) {
          newX = currentPos.x;
          newY = currentPos.y;
        } else {
          newX = Math.round(currentPos.x + (dx / distance) * hexesThisTurn);
          newY = Math.round(currentPos.y + (dy / distance) * hexesThisTurn);
        }

        // Ensure valid numbers
        newX = isNaN(newX) ? currentPos.x : newX;
        newY = isNaN(newY) ? currentPos.y : newY;

        dbgLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} calculated movement: from (${currentPos.x}, ${currentPos.y}) to (${newX}, ${newY}), hexesThisTurn=${hexesThisTurn}`,
          "info",
        );

        // Check if destination is occupied
        const occupant = isHexOccupied(newX, newY, enemy.id);
        if (occupant) {
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â« ${enemy.name} cannot move to (${newX}, ${newY}) - occupied by ${occupant.name}`,
            "info",
          );

          // Recalculate distance from CURRENT position (not the blocked destination)
          const distanceFromCurrentPos = calculateDistance(
            currentPos,
            targetPos,
          );

          // Check if within weapon range
          const rangeValidation = validateWeaponRange(
            enemy,
            target,
            selectedAttack,
            distanceFromCurrentPos,
          );

          if (rangeValidation.canAttack) {
            addLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} is within range (${rangeValidation.reason}) and attacks`,
              "info",
            );
            // Don't end turn, continue to attack below
          } else {
            // Check if target is unreachable due to altitude (flying too high)
            const isFlyingTooHigh =
              rangeValidation.reason?.includes("flying too high") ||
              rangeValidation.reason?.includes(
                "cannot be reached by melee attacks from ground",
              );

            if (isFlyingTooHigh) {
              // Target is flying too high - mark as unreachable and end turn immediately
              markTargetUnreachable(enemy, target);
              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} realizes ${target.name} is unreachable (${rangeValidation.reason}).`,
                "warning",
              );
              // Mark target as unreachable for this round to prevent spam
              if (!enemy.meta) enemy.meta = {};
              if (!enemy.meta.unreachableTargetsThisRound) {
                enemy.meta.unreachableTargetsThisRound = [];
              }
              if (!enemy.meta.unreachableTargetsThisRound.includes(target.id)) {
                enemy.meta.unreachableTargetsThisRound.push(target.id);
              }
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === enemy.id ? { ...f, meta: enemy.meta } : f,
                ),
              );
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }

            // Cannot attack from current position - try to find alternative path
            // If no alternative found, end turn
            addLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} cannot get any closer to ${target.name} and is out of melee range (path blocked).`,
              "warning",
            );

            // Try to find alternative path (same logic as RUN/SPRINT section)
            let foundAlternative = false;
            for (let offset = 1; offset <= 3 && !foundAlternative; offset++) {
              const testPositions = [
                { x: newX - offset, y: newY },
                { x: newX + offset, y: newY },
                { x: newX, y: newY - offset },
                { x: newX, y: newY + offset },
                { x: newX - offset, y: newY - offset },
                { x: newX + offset, y: newY + offset },
              ];

              for (const testPos of testPositions) {
                if (
                  testPos.x >= 0 &&
                  testPos.x < GRID_CONFIG.GRID_WIDTH &&
                  testPos.y >= 0 &&
                  testPos.y < GRID_CONFIG.GRID_HEIGHT
                ) {
                  if (!isHexOccupied(testPos.x, testPos.y, enemy.id)) {
                    const testDistance = calculateDistance(testPos, targetPos);
                    const testRangeValidation = validateWeaponRange(
                      enemy,
                      target,
                      selectedAttack,
                      testDistance,
                    );
                    if (testRangeValidation.canAttack) {
                      newX = testPos.x;
                      newY = testPos.y;
                      foundAlternative = true;
                      addLog(
                        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} adjusts path to avoid ${occupant.name}, moving to (${newX}, ${newY})`,
                        "info",
                      );
                      break;
                    }
                  }
                }
              }
            }

            if (!foundAlternative) {
              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} cannot reach target (${rangeValidation.reason}) and ends turn`,
                "info",
              );
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
            // Found alternative - continue with movement
          }
        } else {
          // Not occupied, safe to move
          if (!commitEnemyAction(`move:${movementType || "Move"}`)) {
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
          const currentMovementAction = isChargeMovement
            ? MOVEMENT_ACTIONS.CHARGE
            : MOVEMENT_ACTIONS.MOVE;
          movementInfo = {
            action: movementType,
            actionCost: currentMovementAction.actionCost,
            description: isChargeMovement
              ? `Charge to position (${newX}, ${newY}) - ${MOVEMENT_ACTIONS.CHARGE.description}`
              : `Move to position (${newX}, ${newY}) - ${MOVEMENT_ACTIONS.MOVE.description}`,
          };

          // Update position immediately for MOVE or CHARGE
          handlePositionChange(enemy.id, { x: newX, y: newY }, movementInfo);

          const distanceMoved = calculateDistance(currentPos, { x: newX, y: newY });
          const actionVerb = isChargeMovement ? "charges" : "moves";

          // Use MOVEMENT_RATES for 1994 Medieval Combat Simulator format
          const movementRates = MOVEMENT_RATES.calculateMovement(speed);
          const runAction = MOVEMENT_ACTIONS.RUN;
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} uses ${runAction.actionCost} action(s) to ${runAction.name} (Speed ${speed} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ${movementRates.running}ft/melee)`,
            "info",
          );
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} ${actionVerb} ${Math.round(
              distanceMoved,
            )}ft toward ${target.name} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ new position (${newX},${newY})`,
            "info",
          );

          // Deduct 1 action for movement
          setFighters((prev) =>
            prev.map((f) => {
              if (f.id === enemy.id) {
                const updatedEnemy = {
                  ...f,
                  remainingActions: Math.max(0, f.remainingActions - 1),
                };
                addLog(
                  `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} has ${updatedEnemy.remainingActions} action(s) remaining this melee`,
                  "info",
                );
                return updatedEnemy;
              }
              return f;
            }),
          );

          // Movement is this turn slice's committed action, including charge movement.
          // Do not fall through into the attack section from the same enemy AI call.
          const newDistanceAfterMove = calculateDistance(
            { x: newX, y: newY },
            targetPos,
          );
          if (
            markDistanceClosed &&
            combatStateRef?.current &&
            newDistanceAfterMove <= (GRID_CONFIG.CELL_SIZE || 5) + 0.01
          ) {
            try {
              markDistanceClosed(enemy, target, combatStateRef.current);
            } catch {
              // ignore
            }
          }
          const remainingDistance = Math.round(newDistanceAfterMove);
          if (remainingDistance > 5) {
            addLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} still ${remainingDistance}ft out of melee range - ending turn`,
              "info",
            );
          }
          processingEnemyTurnRef.current = false;
          scheduleEndTurn(16);
          return;
        }
      } else {
        // RUN/SPRINT/CLOSE: Move immediately (Medieval Combat Simulator 1994 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â move only this slice, no deferred attack)
        if (!commitEnemyAction("RUN_TO_RANGE")) {
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
        const moveDistance = actualHexesToMove;

        // FIX: Prevent NaN by checking distance is valid
        if (plannedMovementPosition) {
          newX = plannedMovementPosition.x;
          newY = plannedMovementPosition.y;
        } else if (distance < 0.01) {
          // Already at target, don't move
          newX = currentPos.x;
          newY = currentPos.y;
        } else {
          newX = Math.round(currentPos.x + (dx / distance) * moveDistance);
          newY = Math.round(currentPos.y + (dy / distance) * moveDistance);
        }

        // Clamp to grid bounds and ensure valid numbers
        newX = Math.max(
          0,
          Math.min(
            GRID_CONFIG.GRID_WIDTH - 1,
            isNaN(newX) ? currentPos.x : newX,
          ),
        );
        newY = Math.max(
          0,
          Math.min(
            GRID_CONFIG.GRID_HEIGHT - 1,
            isNaN(newY) ? currentPos.y : newY,
          ),
        );

        // Check if destination is occupied
        const occupant = isHexOccupied(newX, newY, enemy.id);
        let targetX = newX;
        let targetY = newY;
        let closingIntoOpponent = false;
        let attackOfOpportunityAttacker = null;
        if (occupant) {
          const occupantIsAlly = isAllyTarget(occupant);

          if (occupantIsAlly) {
            addLog(
              `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} weaves past ${occupant.name} while running full tilt`,
              "info",
            );
          } else {
            let attackRange = 5.5;
            if (typeof selectedAttack?.range === "number") {
              attackRange = selectedAttack.range;
            } else if (selectedAttack?.weapon) {
              const derivedRange = getWeaponRange(selectedAttack.weapon);
              if (
                typeof derivedRange === "number" &&
                !Number.isNaN(derivedRange)
              ) {
                attackRange = derivedRange;
              }
            }

            if (attackRange <= 5.5) {
              // Check if occupant (target) is actually reachable (altitude check)
              const distanceFromCurrentPos = calculateDistance(
                currentPos,
                targetPos,
              );
              const rangeValidation = validateWeaponRange(
                enemy,
                occupant, // occupant is the target in this case
                selectedAttack,
                distanceFromCurrentPos,
              );

              // Check if target is unreachable due to altitude (flying too high)
              const isFlyingTooHigh =
                rangeValidation.reason?.includes("flying too high") ||
                rangeValidation.reason?.includes(
                  "cannot be reached by melee attacks from ground",
                );

              if (isFlyingTooHigh) {
                // Target is flying too high - mark as unreachable and end turn immediately
                markTargetUnreachable(enemy, occupant);
                addLog(
                  `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} realizes ${occupant.name} is unreachable (${rangeValidation.reason}).`,
                  "warning",
                );
                // Mark target as unreachable for this round to prevent spam
                if (!enemy.meta) enemy.meta = {};
                if (!enemy.meta.unreachableTargetsThisRound) {
                  enemy.meta.unreachableTargetsThisRound = [];
                }
                if (
                  !enemy.meta.unreachableTargetsThisRound.includes(occupant.id)
                ) {
                  enemy.meta.unreachableTargetsThisRound.push(occupant.id);
                }
                setFighters((prev) =>
                  prev.map((f) =>
                    f.id === enemy.id ? { ...f, meta: enemy.meta } : f,
                  ),
                );
                processingEnemyTurnRef.current = false;
                scheduleEndTurn();
                return;
              }

              // Target is reachable - proceed with closing into opponent
              closingIntoOpponent = true;
              attackOfOpportunityAttacker = occupant;
              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} barrels through to engage ${occupant.name}!`,
                "info",
              );
            } else {
              // Find nearest unoccupied hex toward target
              let foundAlternative = false;
              for (let offset = 1; offset <= 3 && !foundAlternative; offset++) {
                // Try hexes around the target at increasing distances
                const testPositions = [
                  { x: newX - offset, y: newY },
                  { x: newX + offset, y: newY },
                  { x: newX, y: newY - offset },
                  { x: newX, y: newY + offset },
                  { x: newX - offset, y: newY - offset },
                  { x: newX + offset, y: newY + offset },
                ];

                for (const testPos of testPositions) {
                  if (
                    testPos.x >= 0 &&
                    testPos.x < GRID_CONFIG.GRID_WIDTH &&
                    testPos.y >= 0 &&
                    testPos.y < GRID_CONFIG.GRID_HEIGHT
                  ) {
                    if (!isHexOccupied(testPos.x, testPos.y, enemy.id)) {
                      targetX = testPos.x;
                      targetY = testPos.y;
                      foundAlternative = true;
                      addLog(
                        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} adjusts path to avoid ${occupant.name}, moving to (${targetX}, ${targetY})`,
                        "info",
                      );
                      break;
                    }
                  }
                }
              }

              if (!foundAlternative) {
                addLog(
                  `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â« ${enemy.name} cannot find path to target - all hexes occupied`,
                  "info",
                );

                // Check if enemy can still attack from current position despite being blocked
                const distanceFromCurrentPos = calculateDistance(
                  currentPos,
                  targetPos,
                );
                const rangeValidation = validateWeaponRange(
                  enemy,
                  target,
                  selectedAttack,
                  distanceFromCurrentPos,
                );

                // Check if target is unreachable due to altitude (flying too high)
                const isFlyingTooHigh =
                  rangeValidation.reason?.includes("flying too high") ||
                  rangeValidation.reason?.includes(
                    "cannot be reached by melee attacks from ground",
                  );

                if (isFlyingTooHigh) {
                  // Target is flying too high - mark as unreachable and end turn immediately
                  markTargetUnreachable(enemy, target);
                  addLog(
                    `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} realizes ${target.name} is unreachable (${rangeValidation.reason}).`,
                    "warning",
                  );
                  // Mark target as unreachable for this round to prevent spam
                  if (!enemy.meta) enemy.meta = {};
                  if (!enemy.meta.unreachableTargetsThisRound) {
                    enemy.meta.unreachableTargetsThisRound = [];
                  }
                  if (
                    !enemy.meta.unreachableTargetsThisRound.includes(target.id)
                  ) {
                    enemy.meta.unreachableTargetsThisRound.push(target.id);
                  }
                  setFighters((prev) =>
                    prev.map((f) =>
                      f.id === enemy.id ? { ...f, meta: enemy.meta } : f,
                    ),
                  );
                  processingEnemyTurnRef.current = false;
                  scheduleEndTurn();
                  return;
                }

                if (!rangeValidation.canAttack) {
                  addLog(
                    `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} cannot get any closer to ${target.name} and is out of melee range (path blocked). Ending turn.`,
                    "warning",
                  );
                  processingEnemyTurnRef.current = false;
                  scheduleEndTurn();
                  return;
                }

                // Can attack from current position - continue to attack below
                addLog(
                  `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} is within range from current position (${rangeValidation.reason}) and attacks`,
                  "info",
                );
                // Don't end turn, continue to attack section below
              }
            }
          }
        }

        if (closingIntoOpponent) {
          setTemporaryHexSharing((prev) => ({
            ...prev,
            [enemy.id]: {
              originalPos: { ...currentPos },
              targetHex: { x: targetX, y: targetY },
              targetCharId: attackOfOpportunityAttacker?.id,
              turnCreated: turnCounter,
            },
          }));
        }

        // Update position immediately (no pending movement)
        setPositions((prev) => {
          const updated = {
            ...prev,
            [enemy.id]: { x: targetX, y: targetY },
          };
          positionsRef.current = updated;
          return updated;
        });
        revealAfterObviousMovement(enemy, setFighters, addLog, "running");

        if (closingIntoOpponent && attackOfOpportunityAttacker) {
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${attackOfOpportunityAttacker.name} gets an attack of opportunity against ${enemy.name}!`,
            "warning",
          );
          const attackerForAoO = attackOfOpportunityAttacker;
          const targetForAoO = enemy.id;
          const opportunityExecutionKey = makeEnemyAttackExecutionKey(
            attackerForAoO,
            targetForAoO,
            "enemy-turn-ai-attack-of-opportunity",
            {
              callbackSource: "enemy-turn-ai-attack-of-opportunity-callback",
              isDelayedCallback: true,
              allowOutOfTurnAttack: true,
            },
          );

          setTimeout(() => {
            if (!validateEnemyAttackCallbackEntry({
              actor: attackerForAoO,
              targetId: targetForAoO,
              executionKey: opportunityExecutionKey,
              source: "enemy-turn-ai-attack-of-opportunity-callback",
              allowOutOfTurn: true,
            })) {
              return;
            }
            if (
              combatOverRef?.current ||
              combatEndCheckRef?.current ||
              !combatActive
            ) {
              return;
            }
            if (attackRef.current) {
              attackRef.current(attackerForAoO, targetForAoO, {
                attackActionId: opportunityExecutionKey,
                allowOutOfTurnAttack: true,
                source: "attack-of-opportunity",
              });
            } else {
              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Attack of opportunity delayed - attack system not ready`,
                "info",
              );
              setTimeout(() => {
                if (!validateEnemyAttackCallbackEntry({
                  actor: attackerForAoO,
                  targetId: targetForAoO,
                  executionKey: opportunityExecutionKey,
                  source: "enemy-turn-ai-attack-of-opportunity-retry",
                  allowOutOfTurn: true,
                })) {
                  return;
                }
                if (
                  combatOverRef?.current ||
                  combatEndCheckRef?.current ||
                  !combatActive
                ) {
                  return;
                }
                if (attackRef.current) {
                  attackRef.current(attackerForAoO, targetForAoO, {
                    attackActionId: opportunityExecutionKey,
                    allowOutOfTurnAttack: true,
                    source: "attack-of-opportunity",
                  });
                }
              }, 1000);
            }
          }, 500);
        }

        const distanceMoved = calculateDistance(currentPos, {
          x: targetX,
          y: targetY,
        });

        // 1994 Medieval Combat Simulator format: RUN/SPRINT uses one action
        const feetPerMelee = speed * 18; // Official formula
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ ${enemy.name} uses one action to RUN (Speed ${speed} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ${feetPerMelee}ft/melee)`,
          "info",
        );
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Moves up to ${Math.round(distanceMoved)}ft toward ${
            target.name
          } ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ new position (${targetX},${targetY})`,
          "info",
        );

        // Deduct 1 action for movement
        setFighters((prev) =>
          prev.map((f) => {
            if (f.id === enemy.id) {
              const updatedEnemy = {
                ...f,
                remainingActions: Math.max(0, f.remainingActions - 1),
              };
              addLog(
                `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} has ${updatedEnemy.remainingActions} action(s) remaining this melee`,
                "info",
              );
              return updatedEnemy;
            }
            return f;
          }),
        );

        const distAfterRun = calculateDistance(
          { x: targetX, y: targetY },
          targetPos,
        );
        if (
          markDistanceClosed &&
          combatStateRef?.current &&
          distAfterRun <= (GRID_CONFIG.CELL_SIZE || 5) + 0.01
        ) {
          try {
            markDistanceClosed(enemy, target, combatStateRef.current);
          } catch {
            // ignore
          }
        }

        processingEnemyTurnRef.current = false;
        scheduleEndTurn(16, "RUN_TO_RANGE");
        return;
      }
    }

    // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ FIX: Final validation: make sure target can still be attacked and combat is active
    if (!combatActive) {
      addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Combat ended, ${enemy.name} stops attacking`, "info");
      processingEnemyTurnRef.current = false;
      return;
    }
    if (combatOverRef?.current || combatEndCheckRef?.current) {
      processingEnemyTurnRef.current = false;
      return;
    }

    if (!target || target.currentHP <= -21) {
      addLog(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name}'s target is dead, ending turn`, "info");
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }

    // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ FIX: Don't allow attacking unconscious/dying targets if all players are already defeated
    // Exception: Evil alignments may finish off dying players (coup de grÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ce)
    if (target && target.currentHP <= 0 && target.currentHP > -21) {
      // Check if there are any conscious players remaining
      const consciousPlayers = fighters.filter(
        (f) => isHostileTarget(f) && canFighterAct(f) && f.currentHP > 0,
      );
      const enemyAlignment =
        enemy.alignment || enemy.attributes?.alignment || "";
      const isEvil = isEvilAlignment(enemyAlignment);

      if (consciousPlayers.length === 0) {
        // All players are defeated
        if (isEvil) {
          // Evil alignments may finish off dying players (coup de grÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ce)
          const hpStatus = getHPStatus(target.currentHP);
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â  ${enemy.name} (${enemyAlignment}) finishes off dying ${target.name} (${hpStatus.description})!`,
            "warning",
          );
        } else {
          // Good/neutral alignments show mercy - don't attack unconscious players
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â All players are defeated! ${enemy.name} shows mercy and stops attacking.`,
            "info",
          );
          if (!combatEndCheckRef.current) {
            combatEndCheckRef.current = true;
            addLog("ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ All players are defeated! Enemies win!", "defeat");
            setCombatActive(false);
          }
          processingEnemyTurnRef.current = false;
          return;
        }
      } else {
        // Still conscious players remaining - allow attacking dying ones
        const hpStatus = getHPStatus(target.currentHP);
        if (isEvil) {
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â  ${enemy.name} (${enemyAlignment}) attacks dying ${target.name} (${hpStatus.description})!`,
            "warning",
          );
        } else {
          addLog(
            `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${enemy.name} targeting ${target.name} who is ${hpStatus.description}`,
            "warning",
          );
        }
      }
    }

    // Check if this is an area attack (Horn Charge, etc.)
    const isAreaAttack =
      selectedAttack.name.toLowerCase().includes("charge") ||
      selectedAttack.name.toLowerCase().includes("gore") ||
      selectedAttack.name.toLowerCase().includes("ram");

    if (isAreaAttack && isTargetBlocked(enemy.id, target.id, positions)) {
      // Area attack - can hit multiple targets in line
      const targetsInLine = getTargetsInLine(enemy.id, target.id, positions);

      if (targetsInLine.length > 0) {
        if (!commitEnemyAction("AREA_ATTACK_LINE")) {
          processingEnemyTurnRef.current = false;
          return;
        }
        addLog(
          `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ ${enemy.name} uses ${attackName} - area attack hitting ${targetsInLine.length} target(s)!`,
          "info",
        );

        // Execute area attack on all targets in line (one action, multiple targets)
        const chargeBonus = isChargingAttack ? { attackBonus: +2 } : {};

        // Attack all targets in line, but this is still ONE action
        targetsInLine.forEach((lineTarget, lineIndex) => {
          const areaExecutionKey = makeEnemyAttackExecutionKey(
            enemy,
            lineTarget.id,
            `enemy-turn-ai-area-attack:${lineIndex}`,
          );
          if (!validateEnemyAttackCallbackEntry({
            actor: enemy,
            targetId: lineTarget.id,
            executionKey: areaExecutionKey,
            source: "enemy-turn-ai-area-attack-entry",
          })) {
            return;
          }
          attack({ ...enemy, selectedAttack }, lineTarget.id, {
            ...chargeBonus,
            attackActionId: areaExecutionKey,
            source: "enemy-turn-ai-area-attack",
            attackDataOverride: selectedAttack,
            suppressEndTurn: true,
            flankingBonus: calculateFlankingBonus(
              positions[enemy.id],
              positions[lineTarget.id],
              positions,
              enemy.id,
            ),
          });
        });
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    if (!commitEnemyAction("MELEE_ATTACK")) {
      processingEnemyTurnRef.current = false;
      return;
    }

    addLog(
      `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ ${enemy.name} ${reasoning} and attacks ${target.name} with ${attackName}!`,
      "info",
    );

    // Create updated enemy with selected attack (don't update state yet to prevent re-render loop)
    const updatedEnemy = { ...enemy, selectedAttack: selectedAttack };

    // Determine if this is a charging attack (for bonuses)
    const chargeBonus = isChargingAttack ? { attackBonus: +2 } : {};

    // Check for flanking bonus
    const currentFlankingBonus = calculateFlankingBonus(
      positions[enemy.id],
      positions[target.id],
      positions,
      enemy.id,
    );
    const flankingBonus =
      currentFlankingBonus > 0 ? { flankingBonus: currentFlankingBonus } : {};

    const isAmbushUtilityAttack =
      actionPlan?.utilityAction?.type === ACTION_TYPES.AMBUSH_ATTACK;
    const ambushBonus = isAmbushUtilityAttack
      ? { attackBonus: 2, source: "AMBUSH_ATTACK" }
      : {};

    if (isAmbushUtilityAttack) {
      addLog?.(`${enemy.name} attacks from hiding!`, "info");
      consumeUtilityAiUnlock({
        enemy,
        unlockType: "AMBUSH_ATTACK",
        setFighters,
        clearHidden: true,
      });
    }

    // Combine all bonuses
    const allBonuses = {
      ...chargeBonus,
      ...flankingBonus,
      ...ambushBonus,
      attackDataOverride: selectedAttack,
    };

    if (flankingBonus.flankingBonus > 0) {
      dbgLog(
        `ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ ${enemy.name} gains +${flankingBonus.flankingBonus} flanking bonus!`,
        "info",
      );
    }

    if (
      combatOverRef?.current ||
      combatEndCheckRef?.current ||
      !combatActive
    ) {
      processingEnemyTurnRef.current = false;
      return;
    }
    if (
      typeof isEnemyTurnStillCurrent === "function" &&
      !isEnemyTurnStillCurrent("modular-ai-attack")
    ) {
      processingEnemyTurnRef.current = false;
      return;
    }

    // -----------------------------------------------------------------------
    // OPTIONAL: Weakness outcome feedback hook (if your combat engine provides it)
    // If context exposes `onAICombatResolution`, it can call back with:
    // { casterId, targetId, techniqueName, outcome: "confirmed"|"dfocusroven"|"no_effect", notes }
    // This keeps enemyTurnAI.js signature unchanged.
    // -----------------------------------------------------------------------
    const maybeResolutionHook = context?.onAICombatResolution;
    if (
      typeof maybeResolutionHook === "function" &&
      updatedEnemy?.selectedAttack?.technique &&
      target?.id
    ) {
      try {
        // Register a one-shot listener for this action. Your engine can call it later.
        maybeResolutionHook({
          casterId: enemy.id,
          targetId: target.id,
          techniqueName: updatedEnemy.selectedAttack.technique.name,
          onResolved: (resolution) => {
            try {
              const targetKey = getTargetMemoryKey(target);
              enemy.meta._weaknessMemory = recordWeaknessOutcome(
                enemy.meta._weaknessMemory || {},
                targetKey,
                resolution,
              );
              savePersistentWeaknessMemory(
                enemy,
                enemy.meta._weaknessMemory || {},
              );
              setEnemyAIDebug(setFighters, enemy.id, {
                lastResolution: resolution,
                weaknessMemory:
                  enemy.meta._weaknessMemory?.[targetKey] || null,
              });
            } catch (e) {
              // swallow
            }
          },
        });
      } catch (e) {
        // swallow
      }
    }

    // Multi-attack (count > 1): attack() schedules sub-attacks and logs once.
    const meleeExecutionKey =
      allBonuses?.attackActionId ||
      makeEnemyAttackExecutionKey(updatedEnemy, target.id, "enemy-turn-ai-melee-attack");
    if (!validateEnemyAttackCallbackEntry({
      actor: updatedEnemy,
      targetId: target.id,
      executionKey: meleeExecutionKey,
      source: "enemy-turn-ai-melee-entry",
    })) {
      processingEnemyTurnRef.current = false;
      return;
    }
    attack(updatedEnemy, target.id, {
      ...allBonuses,
      attackActionId: meleeExecutionKey,
      source: allBonuses?.source || "enemy-turn-ai-melee-attack",
    });
    processingEnemyTurnRef.current = false;
    return;
  }
}


import React, { useState, useEffect, useCallback, useRef, startTransition, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  Grid,
  GridItem,
  Badge,
  Select,
  Input,
  FormControl,
  FormLabel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Alert,
  AlertIcon,
  Flex,
  Spacer,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Divider,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import CryptoSecureDice from "../utils/cryptoDice.js";
import bestiary from "../data/bestiary.json";
import { getAllBestiaryEntries } from "../utils/bestiaryUtils.js";
import CombatActionsPanel from "../components/CombatActionsPanel.jsx";
import { createPlayableCharacterFighter, getPlayableCharacterRollDetails } from "../utils/autoRoll.js";
import { assignRandomWeaponToEnemy, getDefaultWeaponForEnemy, equipWeaponToEnemy, addWeaponToInventory } from "../utils/enemyWeaponAssigner.js";
import armorShopData from "../data/armorShopData.js";
import { initializeAmmo, canFireMissileWeapon, getInventoryAmmoCount, decrementInventoryAmmo } from "../utils/combatAmmoManager.js";
import { getSpellsForLevel } from "../data/combatSpells.js";
import { selectAISpell } from "../utils/ai/selectAISpell.js";
import { getSpellsForCreature, SPELL_ELEMENT_MAP } from "../utils/magicAbilitiesParser.js";
import { updateStatusEffects } from "../utils/statusEffectSystem.js";
import { createThreatProfile } from "../utils/ai/threatAnalysis.js";
import { selectSpell } from "../utils/ai/unifiedSpellSelection.js";
import {
  parseRangeToFeet,
  getSpellCost,
  getSpellRangeInFeet,
  spellCanAffectTarget,
  spellRequiresTarget,
  getSpellHealingFormula,
  hasSpellDamage,
  isHealingSpell,
  isOffensiveSpell,
  isSupportSpell,
  getPsionicCost,
} from "../utils/spellUtils.js";
import { getFighterSpells as getFighterSpellsUtil } from "../utils/getFighterSpells.js";
import { hasDimensionalTeleport, attemptDimensionalTeleport } from "../utils/dimensionalTeleport.js";
import { parseClericalAbilities, getAvailableClericalAbilities, animateDead, turnDead, performExorcism, removeCurse, clericalHealingTouch, isDead, isUndead } from "../utils/clericalAbilities.js";
import { isTwoHandedWeapon, getWeaponDamage } from "../utils/weaponSlotManager.js";
import { usePsionic } from "../utils/psionicEffects.js";
import { applyInitialEffect, applyFallDamage } from "../utils/updateActiveEffects.js";
import TacticalMap from "../components/TacticalMap.jsx";
import HexArena3D from "../components/HexArena3D.jsx";
import Phase0PreCombatModal from "../components/Phase0PreCombatModal.jsx";
import ResizableLayout from "../components/ResizableLayout.jsx";
import LootWindow from "../components/LootWindow.jsx";
import { getInitialPositions, getEngagementRange, MOVEMENT_RATES, GRID_CONFIG, MOVEMENT_ACTIONS, calculateDistance, getMovementRange, getHexNeighbors, isValidPosition } from "../data/movementRules.js";
import { getDistanceBetween } from "../utils/positionManager.js";
import { resolvePhase0Encounter, preCombatSystem, executePreCombatAction, hasSpecialSenses } from "../utils/stealthSystem.js";
import { 
  canAISeeTarget, 
  updateAwareness,
  getAwareness,
  decayAwareness,
  canPerformSneakAttack,
  attemptMidCombatHide,
  AWARENESS_STATES 
} from "../utils/aiVisibilityFilter.js";
import { calculateVisibleCells, calculateVisibleCellsMultiple, getVisibilityRange } from "../utils/visibilityCalculator.js";
import { updateFogMemory, resetFogMemory } from "../utils/fogMemorySystem.js";
import { getAttacksPerMelee, getCreatureAttacksPerMelee, getActionCost, formatAttacksRemaining } from "../utils/actionEconomy.js";
import { calculateTotalHP } from "../utils/levelProgression.js";
import { grantXPFromEnemy, getMonsterByName, calculateMonsterXP } from "../utils/enemyXP.js";
import { weapons, getWeaponByName, baalRogFireWhip } from "../data/weapons.js";
import { calculateRangePenalty, calculateReachAdvantage } from "../utils/weaponSystem.js";
import { 
  analyzeMovementAndAttack, 
  executeChargeAttack, 
  validateAttackRange,
  calculateMovementPerAction,
  calculateEnemyMovementAI,
  getWeaponRange
} from "../utils/distanceCombatSystem.js";
import { validateFlexibleWeaponReach } from "../utils/whipReachSystem.js";
import { getCombatModifiers, canUseWeapon, getWeaponType, getWeaponLength } from "../utils/combatEnvironmentLogic.js";
import { getDynamicWidth, getActorsInProximity, getDynamicHeight } from "../utils/environmentMetrics.js";
import { canFly, isFlying, getAltitude, parseAbilities, calculateFlightMovement, applyBioRegeneration } from "../utils/abilitySystem.js";
import {
  canFighterFly,
  startFlying,
  landFighter,
  changeAltitude,
  performDiveAttack,
  liftAndCarry,
  dropCarriedTarget,
} from "../utils/flightActions.js";
import { getDefaultMovementMode, getSpeciesProfile } from "../utils/ai/movementModeHelpers.js";

// Debug toggle for grapple system
const DEBUG_GRAPPLE = true; // set to false in production
import {
  getReachStrikeModifiers,
  getReachParryModifiers,
  getReachDodgeModifiers,
  getReachInitiativeModifier,
  canUseCalledShot,
  hasClosedDistance,
  markDistanceClosed,
  attemptCloseDistance,
  needsToCloseDistance,
  resetClosedDistances,
  getChargeMomentumModifiers,
  canDodgeCharge,
  getHeavyWeaponRecovery,
  canChargeInTerrain,
  getCollisionMomentumDamage,
  getEnvironmentCategory
} from "../utils/reachCombatRules.js";
import MovementRangeDisplay from "../components/MovementRangeDisplay.jsx";
import RunActionLogger from "../components/RunActionLogger.jsx";
import { autoEquipWeapons, getWeaponDisplayInfo } from "../utils/weaponManager.js";
import { 
  getCoverBonus,
  applyLightingEffects, 
  TERRAIN_TYPES,
  calculateLineOfSight,
  calculatePerceptionCheck 
} from "../utils/terrainSystem.js";
import { castSpell, getUnifiedAbilities, getCombatBonus } from "../utils/unifiedAbilities.js";
import { createProtectionCircle, isProtectionCircle, CIRCLE_TYPES } from "../utils/protectionCircleSystem.js";
import { updateProtectionCirclesOnMap } from "../utils/protectionCircleMapSystem.js";
import { healerAbility, medicalTreatment } from "../utils/healingSystem.js";
import { getSkillPercentage, rollSkillCheck, lookupSkill } from "../utils/skillSystem.js";
import CirclePlacementTool from "../components/CirclePlacementTool.jsx";
import CircleManagerPanel from "../components/CircleManagerPanel.jsx";
import CircleRechargePanel from "../components/CircleRechargePanel.jsx";
import FloatingPanel from "../components/FloatingPanel.jsx";
import { findBeePath } from "../ai/index.js";
import GameSettingsPanel from "../components/GameSettingsPanel.jsx";
import { useGameSettings } from "../context/GameSettingsContext.jsx";
import WeaknessDebugHUD from "../components/WeaknessDebugHUD.jsx";
import { syncCombinedPositions } from "../utils/combinedBodySystem.js";
import { applyPainStagger } from "../utils/painSystem.js";
import { resolveMoraleCheck, isFearImmune } from "../utils/moraleSystem.js";
import { hasHorrorFactor, resolveHorrorCheck } from "../utils/horrorSystem.js";
import { processCourageAuras, clearCourageBonuses } from "../utils/courageAuraSystem.js";
import {
  getThreatPositionsForFighter,
  makeIsHexOccupied,
  findBestRetreatHex,
  isAtMapEdge,
} from "../utils/routingSystem.js";
import { canBeCaptured, tieUpPrisoner, lootPrisoner } from "../utils/captureSystem.js";
import { 
  initializeCombatFatigue, 
  drainStamina, 
  applyFatiguePenalties,
  getFatigueStatus,
  resolveCollapseFromExhaustion,
  updateFatiguePenalties,
  recoverStamina,
  resetFatigue,
  STAMINA_COSTS,
  canFatigue
} from "../utils/combatFatigueSystem.js";
import { createAIActionSelector } from "../utils/combatEngine.js";
import { runPlayerTurnAI } from "../utils/ai/playerTurnAI.js";
import { runEnemyTurnAI } from "../utils/ai/enemyTurnAI.js";
import { runFlyingTurn, isFlyingCreature, moveFlyingCreature as moveFlyingCreatureHelper, performDiveAttack as performDiveAttackHelper } from "../utils/ai/flyingBehaviorSystem.js";
import { hasAnyValidOffensiveOption } from "../utils/ai/meleeReachabilityHelpers.js";
import {
  initializeGrappleState,
  attemptGrapple,
  maintainGrapple,
  performTakedown,
  groundStrike,
  breakFree,
  getGrappleStatus,
  resetGrapple,
  canUseWeaponInGrapple,
  applyDamageWithArmor,
  initiateGrapple,
  breakGrappleWithPush,
  breakGrappleWithTrip,
  grapplerPushOff,
  defenderPushBreak,
  defenderReversal,
  GRAPPLE_STATES,
} from "../utils/grapplingSystem.js";
import {
  getSizeCategory,
  getCombinedGrappleModifiers,
  getReachAdvantage,
  applySizeModifiers,
  canCarryTarget,
  SIZE_CATEGORIES,
  SIZE_DEFINITIONS,
} from "../utils/sizeStrengthModifiers.js";
import {
  executeTripManeuver as executeTripManeuverHandler,
  executeShoveManeuver as executeShoveManeuverHandler,
  executeDisarmManeuver as executeDisarmManeuverHandler,
} from "../utils/combatActionHandlers/maneuverActions.js";
import {
  handleMoveSelect as handleMoveSelectHandler,
  handleRunActionUpdate as handleRunActionUpdateHandler,
  handleWithdrawAction,
} from "../utils/combatActionHandlers/movementActions.js";
import {
  handleChargeAttack as handleChargeAttackHandler,
  handleStrikeWithMovement as handleStrikeWithMovementHandler,
} from "../utils/combatActionHandlers/attackActions.js";
import {
  handleGrappleAction as handleGrappleActionHandler,
} from "../utils/combatActionHandlers/grappleActions.js";

function minDistanceToThreats(position, threatPositions) {
  if (!position || !Array.isArray(threatPositions) || threatPositions.length === 0) {
    return 0;
  }

  return threatPositions.reduce((closest, threatPos) => {
    if (!threatPos) return closest;
    const distance = calculateDistance(position, threatPos);
    return Math.min(closest, distance);
  }, Number.POSITIVE_INFINITY);
}

function findRetreatDestination({
  currentPos,
  threatPositions,
  maxSteps,
  enemyId,
  isHexOccupied,
}) {
  // ✅ Delegate to routingSystem (best-of-all-within-N-steps + tie-moves + edge preference)
  return findBestRetreatHex({
    currentPos,
    threatPositions,
    maxSteps,
    isHexOccupied: (x, y) => (isHexOccupied ? isHexOccupied(x, y, enemyId) : false),
    getHexNeighbors,
    isValidPosition: (x, y) => isValidPosition(x, y),
    calculateDistance,
    gridWidth: GRID_CONFIG.GRID_WIDTH,
    gridHeight: GRID_CONFIG.GRID_HEIGHT,
    allowTieMoves: true,
    preferEdgeEscape: true,
  });
}


function getAttributeSaveBonus(value, thresholds) {
  for (const [threshold, bonus] of thresholds) {
    if (value >= threshold) return bonus;
  }
  return 0;
}

function getPEMagicBonus(pe) {
  return getAttributeSaveBonus(pe, [
    [30, 5],
    [24, 4],
    [20, 3],
    [16, 2],
    [12, 1],
  ]);
}

function getMEMagicBonus(me) {
  return getAttributeSaveBonus(me, [
    [20, 2],
    [16, 1],
  ]);
}

function getValueOrZero(...values) {
  for (const value of values) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }
  return 0;
}

function gatherSavingThrowBonuses(target) {
  const bonuses = [];
  const bonusSources = [
    target.bonuses,
    target.occBonuses,
    target.tempBonuses,
    target.saves,
  ].filter(Boolean);

  bonusSources.forEach((source) => {
    if (typeof source !== "object") return;
    bonuses.push(
      getValueOrZero(
        source.saveMagic,
        source.saveVsMagic,
        source.save_vs_magic,
        source.vsMagic,
        source.magic,
        source.allSaves,
        source.all
      )
    );
  });

  bonuses.push(getValueOrZero(target.occBonusVsMagic));

  return bonuses.reduce((total, value) => total + value, 0);
}

function getCasterSpellDC(caster, baseDC = 12) {
  const level =
    getValueOrZero(
      caster.level,
      caster.levelValue,
      caster.levels?.mage,
      caster.levels?.wizard,
      caster.levels?.spellcaster
    ) || 1;
  const levelBonus = Math.floor(Math.max(level, 1) / 2);
  return baseDC + levelBonus;
}

function resolveMagicSave(caster, target, spellName, options = {}) {
  if (!target) {
    return { resisted: false };
  }

  const baseDC = options.baseDC ?? 12;
  const dc = getCasterSpellDC(caster, baseDC);

  const pe = getValueOrZero(
    target.attributes?.PE,
    target.PE,
    target.stats?.PE
  );
  const me = getValueOrZero(
    target.attributes?.ME,
    target.ME,
    target.stats?.ME
  );

  const attributeBonus = getPEMagicBonus(pe) + getMEMagicBonus(me);
  const externalBonus = gatherSavingThrowBonuses(target);
  const totalBonus = attributeBonus + externalBonus;

  const roll = CryptoSecureDice.rollD20();
  const total = roll + totalBonus;
  const resisted = total >= dc;

  return {
    resisted,
    roll,
    totalBonus,
    total,
    dc,
    spellName,
  };
}

function convertUnifiedSpellToCombatSpell(spell) {
  if (!spell) return null;

  const rawDamage =
    spell.damage !== undefined && spell.damage !== null
      ? spell.damage
      : spell.combatDamage;

  let damage = "";
  if (typeof rawDamage === "number") {
    damage = rawDamage > 0 ? String(rawDamage) : "";
  } else if (typeof rawDamage === "string") {
    const trimmed = rawDamage.trim();
    if (
      trimmed &&
      trimmed.toLowerCase() !== "none" &&
      trimmed !== "0" &&
      trimmed.toLowerCase() !== "no damage"
    ) {
      damage = trimmed;
    }
  }


  const rawCost =
    spell.cost !== undefined && spell.cost !== null
      ? spell.cost
      : spell.ppeCost;
  const cost =
    typeof rawCost === "number"
      ? rawCost
      : parseInt(rawCost, 10) || 0;

  const description = spell.description || spell.effect || "";

  const combatSpell = {
    name: spell.name,
    cost,
    effect: spell.effect || description,
    description,
  };

  if (damage) combatSpell.damage = damage;
  if (spell.range) combatSpell.range = spell.range;
  if (spell.duration) combatSpell.duration = spell.duration;
  if (spell.level !== undefined) combatSpell.level = spell.level;
  if (spell.save) combatSpell.save = spell.save;

  return combatSpell;
}

// ---------------------------------------------------------------------------
// AI Threat/Weakness hooks (used by enemyTurnAI deferred outcome integration)
// - These are intentionally tiny and local to CombatPage.jsx.
// - enemyTurnAI reads caster.meta.lastSpellOutcome on next selection turn.
// - threatAnalysis.js can optionally merge caster.meta._earnedThreatTags[targetKey].
// ---------------------------------------------------------------------------

function getAIMemoryTargetKey(target) {
  const base =
    target?.baseName ||
    target?.species ||
    target?.race ||
    target?.name ||
    target?.id ||
    "unknown_target";
  const cat = target?.category || target?.type || target?.creatureType || "";
  return `${String(base).toLowerCase()}::${String(cat).toLowerCase()}`;
}

function inferSpellElementForAI(combatSpell) {
  if (!combatSpell || !combatSpell.name) return null;
  const dmgType = (combatSpell.damageType || "").toLowerCase();
  if (dmgType && dmgType !== "force" && dmgType !== "magic") return dmgType;
  const mapped = SPELL_ELEMENT_MAP?.[combatSpell.name] || null;
  if (mapped) return String(mapped).toLowerCase();
  const n = combatSpell.name.toLowerCase();
  if (n.includes("flame") || n.includes("fire")) return "fire";
  if (n.includes("ice") || n.includes("cold") || n.includes("frost")) return "cold";
  if (n.includes("lightning")) return "electricity";
  return null;
}

function getThreatTagsEarnedBySpell(combatSpell) {
  const name = (combatSpell?.name || "").toLowerCase();
  // Spells that help infer "what is this thing / what protections are up"
  if (name.includes("sense magic")) return { detect_magic: true, aura_magic_present: true };
  if (name.includes("sense evil")) return { detect_alignment: true, aura_evil_present: true };
  if (name.includes("see the invisible") || name.includes("see invisible")) return { detect_invisible: true, detect_hidden_threat: true };
  if (name.includes("sense traps")) return { detect_traps: true, hazard_awareness: true };
  if (name.includes("words of truth")) return { interrogation_truth: true, intel_gathering: true };
  if (name.includes("commune with dead")) return { divination: true, lore_from_spirits: true };
  if (name.includes("commune with spirits")) return { divination: true, lore_from_spirits: true };
  if (name.includes("detect poison")) return { detect_poison: true, toxin_threat: true };
  if (name.includes("xray vision") || name.includes("x-ray vision")) return { anatomy_scan: true, see_through_obstacles: true };
  if (name.includes("eyes of the wolf") || name.includes("spirit of the wolf")) return { enhanced_senses: true, track_target: true, anti_ambush: true };
  return null;
}

export default function CombatPage({ characters = [] }) {
  const navigate = useNavigate();
  const [log, setLog] = useState([]);
  const [logFilterType, setLogFilterType] = useState("all");
  const [logSortOrder, setLogSortOrder] = useState("newest");
  const [fighters, setFighters] = useState([]);
  const [turnIndex, setTurnIndex] = useState(0);
  // Ammo is now inventory-based - computed from fighters' inventory
  const ammoCount = useMemo(() => initializeAmmo(fighters), [fighters]); // For UI/trackers
  
  // Helper function for generating crypto-random IDs (must be defined before normalizeFighterId)
  // Use useRef to persist idCounter across renders without causing re-renders
  const idCounterRef = useRef(0);
  const generateCryptoId = useCallback(() => {
    try {
      const timestamp = Date.now();
      // Use multiple smaller dice rolls to get a large random number (max die size is 1000)
      const roll1 = CryptoSecureDice.parseAndRoll("1d1000");
      const roll2 = CryptoSecureDice.parseAndRoll("1d1000");
      const roll3 = CryptoSecureDice.parseAndRoll("1d1000");
      const combinedRandom = roll1.totalWithBonus * 1000000 + roll2.totalWithBonus * 1000 + roll3.totalWithBonus;
      const microtime = performance.now(); // Add microsecond precision
      idCounterRef.current++; // Increment counter for uniqueness
      return `${timestamp}-${combinedRandom}-${Math.floor(microtime * 1000)}-${idCounterRef.current}`;
    } catch (error) {
      // Log error for debugging
      if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
        console.warn('[generateCryptoId] Error generating crypto ID, using fallback:', error);
      }
      // Fallback to timestamp-based ID with microsecond precision
      const timestamp = Date.now();
      const microtime = performance.now();
      idCounterRef.current++; // Increment counter for uniqueness
      return `${timestamp}-${Math.floor(Math.random() * 1000000)}-${Math.floor(microtime * 1000)}-${idCounterRef.current}`;
    }
  }, []);
  
  // Helper to normalize fighter IDs - ensures both id and _id exist and point to the same value
  // This provides backwards compatibility for code that uses either id or _id
  const normalizeFighterId = useCallback((rawFighter) => {
    if (!rawFighter) return rawFighter;
    
    // Get the primary ID (prefer id, then _id, then generate new)
    const primaryId = rawFighter.id || rawFighter._id || generateCryptoId();
    
    // Return normalized fighter with both id and _id set to the same value
    return {
      ...rawFighter,
      id: primaryId,
      _id: primaryId, // Ensure both exist and point to the same value
    };
  }, [generateCryptoId]);
  
  // Helper to ensure fighters have default moraleState and mentalState
  const normalizeFighter = useCallback((rawFighter) => {
    if (!rawFighter) return rawFighter;
    
    const fighter = normalizeFighterId(rawFighter);
    
    // Ensure mentalState exists
    if (!fighter.mentalState) {
      fighter.mentalState = {
        horrorSeen: [],
        insanityPoints: 0,
        disorders: [],
        lastFailedHorrorId: null,
      };
    }
    
    // Ensure meta container exists for AI debug + memory
    if (!fighter.meta) fighter.meta = {};
    
    // Ensure moraleState exists
    if (!fighter.moraleState) {
      fighter.moraleState = {
        status: "STEADY",
        moraleValue: undefined, // moraleSystem will fill
        failedChecks: 0,
        lastCheckRound: 0,
        lastReason: null,
        hasFled: false,
      };
    }
    
    return fighter;
  }, [normalizeFighterId]);
  
  // Helper function to determine HP status based on Palladium coma rules
  const getHPStatus = (currentHP) => {
    if (currentHP > 0) return { status: "conscious", canAct: true, description: "Conscious" };
    if (currentHP === 0) return { status: "unconscious", canAct: false, description: "Unconscious (stable)" };
    if (currentHP >= -10) return { status: "dying", canAct: false, description: "Dying (need help in 1d4 minutes)" };
    if (currentHP >= -20) return { status: "critical", canAct: false, description: "Critical (need help in 1d4 rounds)" };
    return { status: "dead", canAct: false, description: "DEAD" };
  };

  // Get settings early so it can be used in callbacks
  const { settings } = useGameSettings();

  // Helper to check if fighter can act (conscious only)
  const canFighterAct = (fighter) => {
    if (!fighter) return false;

    // Units that have fully fled the battlefield cannot act
    if (fighter.moraleState?.hasFled) return false;
    if (Array.isArray(fighter.statusEffects) && fighter.statusEffects.includes("FLED")) return false;

    // NOTE: ROUTED units CAN act (they should spend actions fleeing).
    // Blocking ROUTED here causes freezes and premature "All players defeated" checks.
    const hpStatus = getHPStatus(fighter.currentHP);
    return hpStatus.canAct && fighter.status !== "defeated";
  };

  // Helper to mark a fighter as fled off-map (soft swap: keep in fighters, remove from map)
  const markFighterFledOffMap = useCallback((fighterId, nameForLog) => {
    // 1) Keep them in fighters, but mark fled + no actions
    setFighters((prev) =>
      prev.map((f) =>
        f.id === fighterId
          ? {
              ...f,
              remainingAttacks: 0,
              moraleState: {
                ...(f.moraleState || {}),
                status: "ROUTED", // or "FLED" if you want a distinct status
                hasFled: true,
              },
              statusEffects: Array.isArray(f.statusEffects)
                ? Array.from(new Set([...f.statusEffects, "FLED"]))
                : ["FLED"],
            }
          : f
      )
    );

    // 2) Remove them from the map so they disappear from grid
    setPositions((prev) => {
      const next = { ...prev };
      delete next[fighterId];
      positionsRef.current = next;
      return next;
    });

    if (nameForLog) addLog(`🏃 ${nameForLog} flees off the battlefield!`, "warning");
  }, [addLog]);

  // =========================
  // Predator/Prey visibility + panic helpers (Hawk ↔ Mouse)
  // =========================
  // Define these early so they're available for other hooks
  const isPredatorBird = useCallback((f) => {
    if (!f) return false;
    const name = (f.name || "").toLowerCase();
    // Expand later (eagle, falcon, owl, etc.)
    if (name.includes("hawk")) return true;
    // Treat any flying "raptor" style creature as predator bird if tagged
    const tags = (f.tags || f.aiTags || []).map(t => String(t).toLowerCase());
    if (tags.includes("predator_bird") || tags.includes("raptor")) return true;
    return false;
  }, []);

  const isTinyPrey = useCallback((f) => {
    if (!f) return false;
    const name = (f.name || "").toLowerCase();
    if (name.includes("mouse")) return true;
    try {
      const cat = getSizeCategory(f);
      return cat === SIZE_CATEGORIES.TINY;
    } catch {
      return false;
    }
  }, []);

  // Asymmetric detection:
  // - Tiny prey often does NOT see a flying hawk until it is low/committed (dive / close pass)
  // - Hawks see tiny prey more easily (always "spotted" for AI purposes)
  const canAISeeTargetAsymmetric = useCallback((viewer, target, pos, terrain, opts = {}) => {
    // ✅ Adjacent ⇒ visible override (AI sanity):
    // If you're in adjacent melee range, we treat the target as visible regardless of LoS heuristics.
    try {
      const p1 = pos?.[viewer?.id];
      const p2 = pos?.[target?.id];
      if (p1 && p2) {
        const d = calculateDistance(p1, p2);
        if (typeof d === "number" && d <= 5.5) return true;
      }
    } catch {
      // ignore and fall back to normal logic
    }

    const base = canAISeeTarget(viewer, target, pos, terrain, opts);

    // Tiny prey has trouble spotting a flying hawk overhead unless it's very low or already alerted
    if (isTinyPrey(viewer) && isPredatorBird(target) && isFlying(target)) {
      const alt = getAltitude(target) || 0;
      const aw = getAwareness?.(viewer, target);
      const awareState = aw?.state || aw?.awarenessState || "";
      const isAlerted =
        awareState === AWARENESS_STATES?.ALERT ||
        String(awareState).toUpperCase() === "ALERT" ||
        String(awareState).toUpperCase() === "AWARE";
      // Only spot the hawk if it's basically on the deck / committing to a strike
      if (!isAlerted && alt > 5) return false;
    }

    // Predator bird vision advantage: hawk sees tiny prey even when prey can't see hawk yet
    if (isPredatorBird(viewer) && isTinyPrey(target)) {
      return true;
    }

    return base;
  }, [isTinyPrey, isPredatorBird, canAISeeTarget, getAwareness, AWARENESS_STATES, getAltitude, isFlying]);

  // Optional helper to restore a fled fighter back onto the map (for reuse in later encounters)
  // Usage: restoreFledFighterToMap(fighterId, { x: 10, y: 10 })
  const restoreFledFighterToMap = useCallback((fighterId, spawnPos) => {
    setFighters((prev) =>
      prev.map((f) =>
        f.id === fighterId
          ? {
              ...f,
              moraleState: { ...(f.moraleState || {}), hasFled: false, status: "STEADY" },
              statusEffects: (f.statusEffects || []).filter((s) => s !== "FLED"),
            }
          : f
      )
    );

    setPositions((prev) => {
      const next = { ...prev, [fighterId]: spawnPos };
      positionsRef.current = next;
      return next;
    });
  }, []);
  
  // Helper to calculate allies down ratio for morale checks
  const getAlliesDownRatio = useCallback((fightersArray, subject) => {
    if (!subject || !Array.isArray(fightersArray)) return 0;
    
    const sameSideType = subject.type;
    const allies = fightersArray.filter(f => 
      f.id !== subject.id && 
      f.type === sameSideType &&
      !f.isDead &&
      !f.isKO
    );
    if (allies.length === 0) return 0;
    const downAllies = allies.filter(f => 
      f.currentHP <= 0 || 
      !canFighterAct(f) ||
      f.status === "defeated"
    );
    return downAllies.length / allies.length;
  }, [canFighterAct]);
  
  // Low-HP "I give up" morale check
  const maybeTriggerLowHpMorale = useCallback((fighter, allFighters, currentRound, addLog, settings) => {
    if (!settings?.useMoraleRouting || !fighter) return fighter;

    // NEW: dying/unconscious characters do not make morale checks
    if (!canFighterAct(fighter) || (fighter.currentHP ?? 0) <= 0) {
      return fighter;
    }

    const maxHP =
      fighter.maxHP ||
      fighter.totalHP ||
      fighter.currentHP ||
      1;

    const hpPercent = maxHP > 0 ? (fighter.currentHP ?? maxHP) / maxHP : 1;

    // Only start "I give up" checks when VERY low on HP
    // e.g. 20% or less (tune as you like)
    if (hpPercent > 0.2) return fighter;

    // Don't keep re-rolling if already fled, routed, or surrendered
    if (fighter.moraleState?.status === "ROUTED" || 
        fighter.moraleState?.status === "SURRENDERED" || 
        fighter.moraleState?.hasFled) {
      return fighter;
    }

    const alliesDownRatio = getAlliesDownRatio(allFighters, fighter);

    const { success, moraleState, result } = resolveMoraleCheck(fighter, {
      roundNumber: currentRound || 0,
      reason: "low_hp",
      hpPercent,
      alliesDownRatio,
      horrorFailed: false,
      bigPainHit: false,
    });

    const updated = {
      ...fighter,
      moraleState,
    };

    if (!success) {
      if (moraleState.status === "SURRENDERED") {
        addLog(
          `🤚 ${fighter.name} collapses, dropping their weapon: "I surrender!"`,
          "warning"
        );
      } else if (moraleState.status === "ROUTED") {
        addLog(
          `🏃 ${fighter.name} is badly wounded and panics! Attempts to flee!`,
          "warning"
        );
      } else if (moraleState.status === "SHAKEN") {
        addLog(
          `😨 ${fighter.name} hesitates, injured and losing resolve...`,
          "info"
        );
      }
    }

    return updated;
  }, [getAlliesDownRatio]);

  // Helper function to run Horror Factor and Morale checks together
  const runHorrorAndMorale = useCallback((attacker, defender, fightersArray, combatState, log) => {
    let scarySource = null;
    let horrorTarget = null;

    // Decide who is scary
    if (hasHorrorFactor(attacker)) {
      scarySource = attacker;
      horrorTarget = defender;
    } else if (hasHorrorFactor(defender)) {
      scarySource = defender;
      horrorTarget = attacker;
    }

    if (!scarySource || !horrorTarget) {
      return { attacker, defender, horrorFailed: false };
    }

    // Get latest horror target state to ensure we have persisted meta
    const latestHorrorTarget = fightersArray.find(f => f.id === horrorTarget.id) || horrorTarget;

    // 1) Apply Horror Factor check once per pair
    const updatedHorrorTarget = resolveHorrorCheck({
      source: scarySource,
      target: latestHorrorTarget,
      combatState,
      log,
    });

    const sourceId = scarySource.id || scarySource.name || "UNKNOWN_SOURCE";
    const horrorCheck = updatedHorrorTarget.meta?.horrorChecks?.[sourceId];
    const horrorFailed = horrorCheck?.result === "fail";

    // 2) Feed into morale if enabled
    let finalTarget = updatedHorrorTarget;
    if (settings.useMoraleRouting && canFighterAct(updatedHorrorTarget)) {
      const maxHP = updatedHorrorTarget.maxHP ?? updatedHorrorTarget.hpMax ?? updatedHorrorTarget.totalHP ?? 1;
      const curHP = updatedHorrorTarget.currentHP ?? updatedHorrorTarget.HP ?? maxHP;
      const hpPercent = Math.max(0, curHP / maxHP);

      const alliesDownRatio = getAlliesDownRatio(fightersArray, updatedHorrorTarget);

      const moraleResult = resolveMoraleCheck(updatedHorrorTarget, {
        roundNumber: combatState.currentRound ?? combatState.meleeRound ?? 1,
        reason: "horror",
        hpPercent,
        alliesDownRatio,
        horrorFailed,
        bigPainHit: false,
      });

      finalTarget = {
        ...updatedHorrorTarget,
        moraleState: moraleResult.moraleState,
      };
    }

    if (finalTarget.id === attacker.id) {
      return { attacker: finalTarget, defender, horrorFailed };
    } else {
      return { attacker, defender: finalTarget, horrorFailed };
    }
  }, [getAlliesDownRatio, canFighterAct, settings, resolveMoraleCheck]);

  const [meleeRound, setMeleeRound] = useState(1); // Track melee rounds (1 minute each)
  const [turnCounter, setTurnCounter] = useState(0); // Track absolute turn number (increments every turn)
  const [combatActive, setCombatActive] = useState(false);
  const [selectedCreature, setSelectedCreature] = useState("");
  const [customEnemyName, setCustomEnemyName] = useState("");
  const [enemyCount, setEnemyCount] = useState(1);
  const [enemyLevel, setEnemyLevel] = useState(1);
  const [selectedArmor, setSelectedArmor] = useState("");
  const [selectedWeapon, setSelectedWeapon] = useState("");
  const [selectedAmmoCount, setSelectedAmmoCount] = useState(0);
  const [selectedAttack, setSelectedAttack] = useState(0);
  const [selectedParty, setSelectedParty] = useState([]);
  const [showPartySelector, setShowPartySelector] = useState(false);
  const [diceRolls, setDiceRolls] = useState([]);
  const [showRollDetails, setShowRollDetails] = useState(false);
  const [showCombatChoices, setShowCombatChoices] = useState(false);
  const [aiControlEnabled, setAiControlEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [selectedGrappleAction, setSelectedGrappleAction] = useState(null);
  const [selectedManeuver, setSelectedManeuver] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [selectedWeaponSlot, setSelectedWeaponSlot] = useState(null);
  const [showWeaponModal, setShowWeaponModal] = useState(false);
  const [selectedAttackWeapon, setSelectedAttackWeapon] = useState(null);
  const [selectedPsionicPower, setSelectedPsionicPower] = useState(null);
  const [selectedSpell, setSelectedSpell] = useState(null);
  const [cinematicProjectiles, setCinematicProjectiles] = useState(false);
  const [targetingMode, setTargetingMode] = useState(null); // null | "OVERWATCH_HEX"
  const [overwatchTargetHex, setOverwatchTargetHex] = useState(null);
  const [spellSearch, setSpellSearch] = useState("");
  const [spellLevelFilter, setSpellLevelFilter] = useState("all");
  const [defensiveStance, setDefensiveStance] = useState({}); // Track defensive actions by fighter ID
  const [activeCircles, setActiveCircles] = useState([]); // Track active protection circles
  const [showCirclePlacementTool, setShowCirclePlacementTool] = useState(false); // Show GM circle placement tool
  const [selectedCirclePosition, setSelectedCirclePosition] = useState(null); // Selected position for circle placement
  const [showCircleManager, setShowCircleManager] = useState(false); // Show GM circle manager panel
  const [showCircleRecharge, setShowCircleRecharge] = useState(false); // Show circle recharge panel
  const [selectedMovementHex, setSelectedMovementHex] = useState(null); // Track movement hex for strike+movement
  const [showMovementSelection, setShowMovementSelection] = useState(false); // Show movement selection UI
  const [tempModifiers, setTempModifiers] = useState({}); // Track temporary bonuses/penalties (e.g., charge)
  const [positions, setPositions] = useState({}); // Combatant positions on tactical map
  const [renderPositions, setRenderPositions] = useState({}); // Render-only positions (visual pose)
  const [projectiles, setProjectiles] = useState([]); // Render-only projectiles
  const [overwatchHexes, setOverwatchHexes] = useState([]); // Render-only overwatch danger hexes
  const [overwatchShots, setOverwatchShots] = useState([]); // Render-only overwatch shots
  const positionsRef = useRef(positions);
  const renderPositionsRef = useRef(renderPositions);
  const prevPositionsRef = useRef(null);
  const suppressNextAnimationRef = useRef(new Set());
  const actionClockRef = useRef({ busy: false, endsAtMs: 0 });
  const timelineRef = useRef({ events: [], locked: false });
  const suppressEndTurnRef = useRef(false);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  useEffect(() => {
    renderPositionsRef.current = renderPositions;
  }, [renderPositions]);

  const confirmOverwatchHex = useCallback(
    (hex) => {
      const shooter = fightersRef.current?.[turnIndexRef.current];
      if (!shooter || !hex) return;

      const weapon = selectedAttackWeapon;
      if (!weapon) {
        addLog(`${shooter.name} wants to overwatch but has no weapon selected!`, "error");
        return;
      }

      const isUsingTwoHanded = weapon.twoHanded || isTwoHandedWeapon(weapon);
      const weaponDamage = getWeaponDamage(weapon, isUsingTwoHanded, shooter);
      const attackSnapshot = {
        name: weapon.name,
        damage: weaponDamage,
        type:
          weapon?.range != null ||
          ["bow", "crossbow", "sling"].includes((weapon?.category || "").toLowerCase())
            ? "ranged"
            : weapon.type,
        range: weapon?.range,
        ammunition: weapon?.ammunition,
        weaponType: weapon?.weaponType,
        category: weapon?.category,
      };
      const damageBonus = shooter.bonuses?.damage || 0;
      const safeDamageBonus =
        typeof damageBonus === "number" && !isNaN(damageBonus) ? damageBonus : 0;
      const parseDamageFormula = (damageStr) => {
        if (!damageStr || typeof damageStr !== "string") {
          return { baseFormula: "1d6", existingBonus: 0 };
        }

        const bonusMatch = damageStr.match(/^(\d+d\d+)\+(\d+)$/);
        if (bonusMatch) {
          return {
            baseFormula: bonusMatch[1],
            existingBonus: parseInt(bonusMatch[2], 10),
          };
        }

        const diceMatch = damageStr.match(/^(\d+d\d+)$/);
        if (diceMatch) {
          return {
            baseFormula: diceMatch[1],
            existingBonus: 0,
          };
        }

        return { baseFormula: damageStr, existingBonus: 0 };
      };
      let damageRollResult;
      let damageFormulaSnapshot = "";
      let dmgStr = weaponDamage;
      if (typeof dmgStr === "string" && dmgStr.includes("-")) {
        dmgStr = dmgStr.replace("-", "d");
      }
      if (typeof dmgStr === "string" && dmgStr.includes("d")) {
        const parsed = parseDamageFormula(dmgStr);
        const totalBonus = parsed.existingBonus + safeDamageBonus;
        damageFormulaSnapshot =
          totalBonus >= 0 ? `${parsed.baseFormula}+${totalBonus}` : parsed.baseFormula;
        const damageBonusParam = totalBonus >= 0 ? 0 : totalBonus;
        damageRollResult = CryptoSecureDice.parseAndRoll(
          damageFormulaSnapshot,
          damageBonusParam
        );
      } else if (dmgStr != null && !isNaN(dmgStr)) {
        const numericDamage = parseInt(dmgStr, 10);
        const diceCount = Math.max(1, Math.floor(numericDamage / 3));
        const diceSize = numericDamage <= 3 ? 4 : 6;
        const baseFormula = `${diceCount}d${diceSize}`;
        damageFormulaSnapshot =
          safeDamageBonus >= 0 ? `${baseFormula}+${safeDamageBonus}` : baseFormula;
        const damageBonusParam = safeDamageBonus >= 0 ? 0 : safeDamageBonus;
        damageRollResult = CryptoSecureDice.parseAndRoll(
          damageFormulaSnapshot,
          damageBonusParam
        );
      } else {
        damageFormulaSnapshot = safeDamageBonus >= 0 ? `1d6+${safeDamageBonus}` : "1d6";
        const damageBonusParam = safeDamageBonus >= 0 ? 0 : safeDamageBonus;
        damageRollResult = CryptoSecureDice.parseAndRoll(
          damageFormulaSnapshot,
          damageBonusParam
        );
      }

      attackSnapshot.damageTotal = damageRollResult?.totalWithBonus ?? 0;
      attackSnapshot.damageDiceRolls = damageRollResult?.diceRolls || [];
      attackSnapshot.damageFormula = damageFormulaSnapshot;

      const baseStrikeBonus = getCombatBonus(shooter, "strike", attackSnapshot) || 0;
      const tempBonus =
        (tempModifiers[shooter.id]?.strikeBonus || 0) +
        (tempModifiers[shooter.id]?.nextMeleeStrike || 0);
      const strikeBonus = baseStrikeBonus + tempBonus;

      if (tempModifiers[shooter.id]?.nextMeleeStrike) {
        const updatedTempMods = { ...tempModifiers };
        delete updatedTempMods[shooter.id].nextMeleeStrike;
        if (Object.keys(updatedTempMods[shooter.id]).length === 0) {
          delete updatedTempMods[shooter.id];
        }
        setTempModifiers(updatedTempMods);
      }

      const diceFormula = strikeBonus >= 0 ? `1d20+${strikeBonus}` : `1d20`;
      const bonus = strikeBonus >= 0 ? 0 : strikeBonus;
      const rollResult = CryptoSecureDice.parseAndRoll(diceFormula, bonus);
      let attackRoll = rollResult.totalWithBonus;

      const fatiguedShooter = applyFatiguePenalties(shooter);
      const fatiguePenalty = fatiguedShooter.bonuses?.strike || 0;
      if (fatiguePenalty < 0) {
        attackRoll += fatiguePenalty;
      }

      const attackDiceRoll = rollResult.diceRolls?.[0]?.result || attackRoll - strikeBonus;
      const isCriticalHit = attackDiceRoll === 20;
      const isCriticalMiss = attackDiceRoll === 1;

      attackSnapshot.attackRoll = attackRoll;
      attackSnapshot.attackDiceRoll = attackDiceRoll;
      attackSnapshot.isCriticalHit = isCriticalHit;
      attackSnapshot.isCriticalMiss = isCriticalMiss;
      attackSnapshot.strikeBonus = strikeBonus;
      attackSnapshot.scatterSeed = `${shooter.id}|${attackSnapshot.name}|${attackDiceRoll}|${attackRoll}`;
      addLog(
        `🏹 ${shooter.name} fires overwatch (d20=${attackDiceRoll}, total=${attackRoll}, dmg=${attackSnapshot.damageTotal}).`,
        "info"
      );

      const projectileResult = spawnProjectileToHex({
        attackerId: shooter.id,
        targetHex: hex,
        attackData: attackSnapshot,
      });

      if (!projectileResult) {
        addLog(`⚠️ ${shooter.name} could not fire overwatch.`, "error");
        return;
      }

      const impactAtMs = projectileResult.impactAtMs;
      const isNoticeable = projectileResult.durationMs >= 450;
      if (isNoticeable) {
        const isHiddenShooter =
          shooter?.isHidden ||
          shooter?.statusEffects?.includes("HIDDEN") ||
          shooter?.statusEffects?.includes("INVISIBLE");
        const visibleThreat = !isHiddenShooter;
        const revealLeadMs = 250;

        const occupantsNow = Object.entries(positionsRef.current || {})
          .filter(([id, pos]) => id !== shooter.id && pos.x === hex.x && pos.y === hex.y)
          .map(([id]) => id);

        occupantsNow.forEach((occId) => {
          applySuppressionToFighter(occId, {
            sourceId: shooter.id,
            kind: "COVERFIRE_HEX",
            dangerHexes: [{ x: hex.x, y: hex.y }],
            lane: null,
            startedAtMs: performance.now(),
            impactAtMs,
            expiresAtMs: impactAtMs + 500,
            visibleThreat,
            revealedAtMs: visibleThreat ? null : impactAtMs - revealLeadMs,
            severity: "MED",
          });
        });
      }

      // spend action immediately
      setFighters((prev) =>
        prev.map((f) =>
          f.id === shooter.id
            ? { ...f, remainingAttacks: Math.max(0, (f.remainingAttacks || 0) - 1) }
            : f
        )
      );

      const shotId = `ow_${shooter.id}_${hex.x}_${hex.y}_${Math.round(impactAtMs)}`;

      setOverwatchShots((prev) => [
        ...prev,
        {
          id: shotId,
          shooterId: shooter.id,
          firedAtMs: performance.now(),
          impactAtMs,
          from: { ...positionsRef.current?.[shooter.id] },
          to: { x: hex.x, y: hex.y },
          attackSnapshot,
          projectileId: null,
          visible: !(shooter.isHidden || shooter.statusEffects?.includes("HIDDEN")),
        },
      ]);

      scheduleTimelineEvent({
        id: `impact_${shotId}`,
        type: "PROJECTILE_IMPACT",
        timeMs: impactAtMs,
        data: {
          shooterId: shooter.id,
          targetHex: { ...hex },
          weaponData: attackSnapshot,
          impactAtMs,
          attackSnapshot: {
            ...attackSnapshot,
            scatterSeed: `${attackSnapshot.scatterSeed}|${Math.round(impactAtMs)}`,
          },
        },
      });

      setOverwatchHexes((prev) => [
        ...prev,
        {
          x: hex.x,
          y: hex.y,
          expiresAtMs: impactAtMs + 200,
          shooterId: shooter.id,
          kind: projectileResult.kind,
        },
      ]);

      addLog(`🏹 ${shooter.name} fires overwatch at (${hex.x}, ${hex.y}).`, "info");
      setSelectedAction(null);
      setOverwatchTargetHex(null);
      setTargetingMode(null);
      setShowCombatChoices(false);
      closeCombatChoices();
      scheduleEndTurn(500);
    },
    [
      addLog,
      applyFatiguePenalties,
      applySuppressionToFighter,
      closeCombatChoices,
      getCombatBonus,
      getWeaponDamage,
      isTwoHandedWeapon,
      scheduleEndTurn,
      scheduleTimelineEvent,
      selectedAttackWeapon,
      spawnProjectileToHex,
      tempModifiers,
      setTempModifiers,
    ]
  );

  const handleSelectedHexChange = useCallback(
    (hex) => {
      if (targetingMode === "OVERWATCH_HEX" && hex) {
        setOverwatchTargetHex(hex);
        confirmOverwatchHex(hex);
        return;
      }
      setSelectedHex(hex);
    },
    [targetingMode, confirmOverwatchHex]
  );

  const dangerHexes = useMemo(() => {
    const hexes = [];
    fighters.forEach((f) => {
      const s = f?.suppression;
      if (
        s?.isSuppressed &&
        s?.visibleThreat &&
        Array.isArray(s.dangerHexes)
      ) {
        s.dangerHexes.forEach((h) => {
          if (h && Number.isFinite(h.x) && Number.isFinite(h.y)) {
            hexes.push({ x: h.x, y: h.y });
          }
        });
      }
    });
    overwatchHexes.forEach((h) => {
      if (h && Number.isFinite(h.x) && Number.isFinite(h.y)) {
        hexes.push({ x: h.x, y: h.y });
      }
    });
    return hexes;
  }, [fighters, overwatchHexes]);

  useEffect(() => {
    setRenderPositions((prev) => {
      const next = { ...prev };
      Object.entries(positions).forEach(([id, pos]) => {
        if (!next[id]) {
          next[id] = {
            x: pos.x,
            y: pos.y,
            altitudeFeet: pos.altitudeFeet ?? 0,
            facing: pos.facing || 0,
          };
        }
      });
      Object.keys(next).forEach((id) => {
        if (!positions[id]) delete next[id];
      });
      return next;
    });
  }, [positions]);

  useEffect(() => {
    if (!positions || Object.keys(positions).length === 0) return;

    if (!prevPositionsRef.current) {
      prevPositionsRef.current = positions;
      return;
    }

    const prev = prevPositionsRef.current;
    prevPositionsRef.current = positions;

    for (const [id, newPos] of Object.entries(positions)) {
      const oldPos = prev[id];
      if (!oldPos) continue;

      const moved = oldPos.x !== newPos.x || oldPos.y !== newPos.y;
      if (!moved) continue;

      if (suppressNextAnimationRef.current.has(id)) {
        suppressNextAnimationRef.current.delete(id);
        setRenderPositions((rp) => ({
          ...rp,
          [id]: {
            ...(rp[id] || {}),
            x: newPos.x,
            y: newPos.y,
          },
        }));
        continue;
      }

      const dx = newPos.x - oldPos.x;
      const dy = newPos.y - oldPos.y;
      const approxCells = Math.max(Math.abs(dx), Math.abs(dy));
      const distanceFeet = approxCells * 5;

      const fighter = fightersRef.current?.find?.((f) => f.id === id);
      const altitudeFeet = fighter?.altitudeFeet ?? fighter?.altitude ?? 0;

      enqueueMoveAnimation(
        id,
        { x: newPos.x, y: newPos.y, altitudeFeet },
        getMoveDurationMs(distanceFeet)
      );
    }
  }, [positions, enqueueMoveAnimation, getMoveDurationMs]);

  // Keep latest fighters/turnIndex snapshots available to async guardrails without relying on stale closures.
  const fightersRef = useRef(fighters);
  useEffect(() => {
    fightersRef.current = fighters;
  }, [fighters]);

  const turnIndexRef = useRef(turnIndex);
  useEffect(() => {
    turnIndexRef.current = turnIndex;
  }, [turnIndex]);

  // Prefer a ref snapshot only when it's non-empty; avoids transient {} snapshots causing AI to see "no threats".
  const pickNonEmptyObject = useCallback((preferred, fallback) => {
    return preferred && typeof preferred === "object" && Object.keys(preferred).length > 0
      ? preferred
      : fallback;
  }, []);
  
  // Track recently used psionics per fighter to prevent AI spamming the same power
  const playerAIRecentlyUsedPsionicsRef = useRef(new Map());
  
  const [pendingMovements, setPendingMovements] = useState({}); // Track pending movements (for RUN/SPRINT/CHARGE)
  const [temporaryHexSharing, setTemporaryHexSharing] = useState({}); // Track temporary hex sharing {characterId: {originalPos, targetHex, targetCharId}}
  const [flashingCombatants, setFlashingCombatants] = useState(new Set()); // Track which combatants are flashing
  const processingEnemyTurnRef = useRef(false); // Prevent duplicate enemy turn processing (use ref for synchronous check)
  const processingPlayerAIRef = useRef(false); // Prevent duplicate player AI turn processing
  // Player AI async guardrails:
  // - playerAIActionScheduledRef: set true as soon as AI schedules any delayed work (movement/attack/spell)
  // - playerAITurnTokenRef: incremented each player AI turn; delayed callbacks must match token or abort
  const playerAIActionScheduledRef = useRef(false);
  const playerAITurnTokenRef = useRef(0);
  const lastProcessedTurnRef = useRef(null); // Track the last processed turn to prevent duplicates
  const topCombatLogRef = useRef(null); // Ref for top combat log scroll container
  const detailedCombatLogRef = useRef(null); // Ref for detailed combat log tab scroll container
  const aiUnreachableTargetsRef = useRef({}); // Track unreachable targets per attacker: { [attackerId]: Set<defenderId> }
  const aiUnreachableTurnsRef = useRef(new Map()); // key: `${attackerId}:${defenderId}` => { count, lastTurnCounter }
  const justCreatedPendingMovementRef = useRef(new Set()); // Track movements created this turn (don't apply until NEXT turn)
  const handleEnemyTurnRef = useRef(null); // Store latest version of handleEnemyTurn to avoid dependency loops
  const attackRef = useRef(null); // Store attack function to avoid initialization order issues
  const lastOpenedChoicesTurnRef = useRef(null); // Track which turn we opened choices for
  const movementAttemptsRef = useRef({}); // Track movement attempts per fighter to prevent infinite loops: {fighterId: {count, lastDistance, lastPosition}}
  const combatEndCheckRef = useRef(false); // Prevent duplicate combat end checks
  const combatOverRef = useRef(false); // ✅ AUTHORITATIVE: Combat is over (checked by all timeouts/actions)
  const lastProcessedEnemyTurnRef = useRef(null); // Track last processed enemy turn to prevent duplicates
  const executingActionRef = useRef(false); // Prevent multiple rapid action executions
  const visibilityLogRef = useRef(new Set()); // Track visibility logs to prevent spam: Set of "playerId_turnCounter"
  const turnTimeoutRef = useRef(null); // Track scheduled end turn timeout
  const pendingTurnAdvanceRef = useRef(false); // ✅ Prevent AI re-entry while a turn advance is scheduled but not yet executed
  const allTimeoutsRef = useRef([]); // ✅ Track ALL timeouts so we can clear them on combat end
  const combatPausedRef = useRef(false); // Track paused state in async callbacks
  const resolvedSpellEffectsRef = useRef(new Set()); // Track resolved spell effects to prevent duplicates: Set of "castId::targetId"
  const activeCastIdsRef = useRef(new Set()); // ✅ Track active cast IDs to prevent duplicate casts
  const combatCastGuardRef = useRef(new Set()); // ✅ Track spell casts per action window to prevent machine-gun casting: Set of "casterId:spellName:turnIndex:meleeRound"
  const lastSpellMemoryRef = useRef({}); // ✅ Track last spells cast per fighter to avoid spam: { [fighterId]: spellName, [fighterId_recent]: [spell1, spell2] }
  // Improvised ammo + retreat memory for anti-air logic
  // key: enemyId -> { qty, types: { rock?: n, brick?: n, branch?: n, bone?: n }, expiresAtTurn }
  const aiImprovisedAmmoRef = useRef(new Map());
  const aiRetreatedFromAirborneRef = useRef(new Map()); // key: "enemyId:targetId" -> lastRetreatTurn
  // ===============================
  // Arena props (rocks/branches/bricks) seeded by arenaEnvironment
  // ===============================
  const arenaPropsRef = useRef(new Map()); // key "x,y" -> { rock: n, branch: n, brick: n, bone: n }
  const arenaPropsSeededForRef = useRef(null); // env key we last seeded for (resets when combat ends)
  // =========================
  // AI Spell Selection Guards
  // =========================
  const enemySpellLoopGuardRef = useRef(new Map()); // key: `${enemyId}:${meleeRound}` => { lastCastAt, lastSpellName, targetId, recent: string[], lastMeleeRound }
  const recentLogMessagesRef = useRef(new Map()); // Track recent log messages to prevent duplicates (React Strict Mode): Map<messageKey, timestamp>
  const lastAutoTurnKeyRef = useRef(null); // Prevent duplicate auto-processing per turn
  const lastNoActionLogRef = useRef(new Map()); // Track "no action" logs per fighter per turn: Map<fighterId_turnCounter, true>
  const noActionsPassLogRef = useRef(new Set()); // Track "no actions remaining" pass logs per fighter per melee round: Set<`${fighterId}:${meleeRound}`>
  const prevAiControlRef = useRef(aiControlEnabled);
  const wasPausedRef = useRef(false);

  // =========================
  // AI transient refs reset (per-combat)
  // =========================
  function resetAITransientRefs() {
    // These are intentionally NOT persisted across combats.
    if (aiImprovisedAmmoRef.current?.clear) aiImprovisedAmmoRef.current.clear();
    if (aiUnreachableTurnsRef.current?.clear) aiUnreachableTurnsRef.current.clear();
    aiUnreachableTargetsRef.current = {};
    if (aiRetreatedFromAirborneRef.current?.clear) aiRetreatedFromAirborneRef.current.clear();

    // Arena props should be reseeded per combat/environment.
    if (arenaPropsRef.current?.clear) arenaPropsRef.current.clear();
    arenaPropsSeededForRef.current = null;

    // Spell spam guards / last-spell memory should reset on combat start.
    if (enemySpellLoopGuardRef.current?.clear) enemySpellLoopGuardRef.current.clear();
    lastSpellMemoryRef.current = {};
    noActionsPassLogRef.current = new Set();

    // ✅ Also remove improvised ammo items from inventories (fresh combat)
    setFighters((prev) =>
      prev.map((f) => {
        const inv = Array.isArray(f.inventory) ? f.inventory : [];
        const nextInv = inv.filter((it) => !isImprovisedAmmoInventoryItem(it));
        return nextInv.length === inv.length ? f : { ...f, inventory: nextInv };
      })
    );
  }
  
  // =========================
  // AI Spell Selection Helper Functions
  // =========================
  const normalizeDamageType = useCallback((dt) => (dt || "").toLowerCase().trim(), []);
  
  const targetHasImmunityText = useCallback((target, needle) => {
    if (!target || !needle) return false;
    
    const n = (needle || "").toLowerCase();
    
    // Check if abilities is a parsed object (structured)
    if (target.abilities && typeof target.abilities === "object" && !Array.isArray(target.abilities)) {
      // Check impervious_to array (e.g., ["fire", "cold"])
      if (Array.isArray(target.abilities.impervious_to)) {
        const imperviousTypes = target.abilities.impervious_to.map(t => String(t).toLowerCase());
        if (n.includes("fire") && imperviousTypes.includes("fire")) return true;
        if (n.includes("cold") && imperviousTypes.includes("cold")) return true;
        if (n.includes("ice") && imperviousTypes.includes("cold")) return true;
        if (n.includes("poison") && imperviousTypes.includes("poison")) return true;
        if (n.includes("magic") && imperviousTypes.includes("magic")) return true;
      }
      
      // Check immunities array
      if (Array.isArray(target.abilities.immunities)) {
        const immuneTypes = target.abilities.immunities.map(t => String(t).toLowerCase());
        if (n.includes("fire") && immuneTypes.includes("fire")) return true;
        if (n.includes("cold") && immuneTypes.includes("cold")) return true;
        if (n.includes("ice") && immuneTypes.includes("cold")) return true;
        if (n.includes("poison") && immuneTypes.includes("poison")) return true;
        if (n.includes("magic") && immuneTypes.includes("magic")) return true;
      }
      
      // Check other array (unparsed ability strings)
      if (Array.isArray(target.abilities.other)) {
        const otherAbilities = target.abilities.other.map(s => String(s).toLowerCase());
        if (otherAbilities.some(txt => txt.includes(n))) return true;
      }
    }
    
    // Fallback: Check if abilities is an array of strings
    const list = [
      ...(Array.isArray(target?.abilities) ? target.abilities : []),
      ...(target?.immunities || []),
      ...(target?.resistances || []),
      ...(target?.notes ? [target.notes] : []),
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    
    return list.some((txt) => txt.includes(n));
  }, []);

  // ✅ AI Anti-Air: improvised thrown object (house-rule, engine-friendly)
  // Make this unambiguously ranged/thrown for all classifier paths.
  function buildImprovisedThrownAttack(attacker, propType = "rock") {
    const size = String(attacker?.sizeCategory || attacker?.size || "").toLowerCase();

    let damage = "1d6";
    let range = 60; // feet
    if (size.includes("large")) {
      damage = "2d6";
      range = 80;
    } else if (size.includes("huge") || size.includes("gargantuan")) {
      damage = "3d6";
      range = 100;
    }

    const ps = Number(attacker?.PS ?? attacker?.ps ?? attacker?.attributes?.PS ?? attacker?.attributes?.ps ?? 0) || 0;
    const bonus = ps >= 24 ? 2 : ps >= 18 ? 1 : 0;
    const finalDamage = bonus > 0 ? `${damage}+${bonus}` : damage;

    const prop = String(propType || "rock").toLowerCase();
    const name =
      prop === "branch" ? "Thrown Branch" :
      prop === "brick" ? "Thrown Brick" :
      prop === "bone" ? "Thrown Bone" :
      prop === "rock" ? "Thrown Rock" :
      "Thrown Debris";

    return {
      // display
      name,

      // ✅ HARD FLAGS (cover all classifiers)
      damage: finalDamage,
      type: "ranged",
      rangeCategory: "ranged",
      isRanged: true,
      isThrown: true,
      weaponType: "thrown",
      category: "thrown",
      attackMode: "thrown",

      // ✅ Range/Damage (what validateWeaponRange uses)
      range, // must be >10 to avoid melee inference

      // extra "do not classify as melee" hints
      isMelee: false,
      length: 0,

      ammoTag: "improvised",
      count: 1,
    };
  }

  function getImprovisedAmmoQty(enemyId) {
    return aiImprovisedAmmoRef.current.get(enemyId)?.qty || 0;
  }

  function getImprovisedAmmoBreakdown(enemyId) {
    return aiImprovisedAmmoRef.current.get(enemyId)?.types || {};
  }

  function getImprovisedAmmoSummaryForFighter(fighterId) {
    const qty = getImprovisedAmmoQty(fighterId);
    if (qty <= 0) return null;
    const types = getImprovisedAmmoBreakdown(fighterId);
    return {
      qty,
      types,
      details: formatImprovisedAmmoBreakdown(types),
    };
  }

  function isImprovisedAmmoInventoryItem(item) {
    if (!item) return false;
    if (item.ammoTag === "improvised") return true;
    if (item.category === "improvised") return true;
    if ((item.type || "").toLowerCase() === "ammunition" && (item.subtype || "") === "improvised") return true;
    const n = (item.name || "").toLowerCase();
    return n.startsWith("improvised ") || n.includes("(improvised)");
  }

  function syncImprovisedAmmoIntoFighterInventory(fighterId, typesMap) {
    const safeTypes = typesMap && typeof typesMap === "object" ? typesMap : {};
    const total = Object.values(safeTypes).reduce((s, n) => s + (Number(n) || 0), 0);

    setFighters((prev) =>
      prev.map((f) => {
        if (f.id !== fighterId) return f;
        const inv = Array.isArray(f.inventory) ? f.inventory : [];
        const kept = inv.filter((it) => !isImprovisedAmmoInventoryItem(it));

        if (total <= 0) return { ...f, inventory: kept };

        const makeItem = (type, qty) => ({
          name:
            type === "rock" ? "Improvised Rock" :
            type === "brick" ? "Improvised Brick" :
            type === "branch" ? "Improvised Branch" :
            type === "bone" ? "Improvised Bone" :
            "Improvised Debris",
          type: "ammunition",
          subtype: "improvised",
          category: "improvised",
          ammoTag: "improvised",
          quantity: Number(qty) || 0,
          weight: 0,
          price: 0,
        });

        const improvisedItems = Object.entries(safeTypes)
          .filter(([, n]) => (Number(n) || 0) > 0)
          .map(([t, n]) => makeItem(t, n));

        return { ...f, inventory: [...kept, ...improvisedItems] };
      })
    );
  }

  function formatImprovisedAmmoBreakdown(types = {}) {
    const parts = Object.entries(types)
      .filter(([, n]) => (n || 0) > 0)
      .map(([t, n]) => {
        const plural =
          n === 1
            ? t
            : t === "branch"
              ? "branches"
              : `${t}s`;
        return `${n} ${plural}`;
      });
    return parts.length ? parts.join(", ") : "none";
  }

  function grantImprovisedAmmo(enemyId, qty, currentTurnCounter, typesDelta = null) {
    const cur =
      aiImprovisedAmmoRef.current.get(enemyId) || {
        qty: 0,
        types: {},
        expiresAtTurn: currentTurnCounter + 6,
      };
    const nextTypes = { ...(cur.types || {}) };
    if (typesDelta && typeof typesDelta === "object") {
      for (const [t, n] of Object.entries(typesDelta)) {
        nextTypes[t] = (nextTypes[t] || 0) + (Number(n) || 0);
      }
    }
    aiImprovisedAmmoRef.current.set(enemyId, {
      qty: Math.min(6, (cur.qty || 0) + qty),
      types: nextTypes,
      expiresAtTurn: Math.max(cur.expiresAtTurn || 0, currentTurnCounter + 6),
    });

    // ✅ Keep fighter.inventory in sync (real item, not just UI)
    syncImprovisedAmmoIntoFighterInventory(enemyId, nextTypes);
  }

  function consumeImprovisedAmmo(enemyId) {
    const cur = aiImprovisedAmmoRef.current.get(enemyId);
    if (!cur || cur.qty <= 0) return false;
    const nextQty = Math.max(0, cur.qty - 1);
    const nextTypes = { ...(cur.types || {}) };

    // Pick an item type to consume (deterministic priority)
    const order = ["rock", "brick", "branch", "bone"];
    let usedType = "debris";
    for (const t of order) {
      if ((nextTypes[t] || 0) > 0) {
        nextTypes[t] -= 1;
        usedType = t;
        break;
      }
    }

    aiImprovisedAmmoRef.current.set(enemyId, { ...cur, qty: nextQty, types: nextTypes });

    // ✅ Keep fighter.inventory in sync (real item, not just UI)
    syncImprovisedAmmoIntoFighterInventory(enemyId, nextTypes);

    return usedType;
  }

  function cleanupImprovisedAmmo(currentTurnCounter) {
    for (const [enemyId, v] of aiImprovisedAmmoRef.current.entries()) {
      if ((v?.expiresAtTurn ?? 0) <= currentTurnCounter || (v?.qty ?? 0) <= 0) {
        aiImprovisedAmmoRef.current.delete(enemyId);
        // ✅ Remove expired improvised ammo from fighter.inventory
        syncImprovisedAmmoIntoFighterInventory(enemyId, {});
      }
    }
  }

  // Environment profiles (tweak freely)
  const ENV_PROP_PROFILES = {
    forest: {
      density: 0.18, // chance per cell to have any props
      bundles: [
        { type: "branch", min: 1, max: 3, weight: 0.60 },
        { type: "rock", min: 1, max: 2, weight: 0.25 },
        { type: "bone", min: 1, max: 2, weight: 0.15 },
      ],
    },
    cave: {
      density: 0.22,
      bundles: [
        { type: "rock", min: 1, max: 3, weight: 0.75 },
        { type: "bone", min: 1, max: 2, weight: 0.10 },
        { type: "brick", min: 1, max: 2, weight: 0.15 }, // loose chunks / rubble
      ],
    },
    ruins: {
      density: 0.25,
      bundles: [
        { type: "brick", min: 1, max: 3, weight: 0.70 },
        { type: "rock", min: 1, max: 2, weight: 0.20 },
        { type: "bone", min: 1, max: 2, weight: 0.10 },
      ],
    },
    // default fallback
    generic: {
      density: 0.12,
      bundles: [
        { type: "rock", min: 1, max: 2, weight: 0.60 },
        { type: "branch", min: 1, max: 2, weight: 0.25 },
        { type: "brick", min: 1, max: 2, weight: 0.15 },
      ],
    },
  };

  function pickWeighted(bundles) {
    const total = bundles.reduce((s, b) => s + (b.weight || 0), 0) || 1;
    let r = Math.random() * total;
    for (const b of bundles) {
      r -= b.weight || 0;
      if (r <= 0) return b;
    }
    return bundles[bundles.length - 1];
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  // If you have "combatTerrain" with blocked/solid cells, wire that here.
  // For now: seed only valid positions, and skip occupied at seeding time.
  function seedArenaProps({
    arenaEnvironment: envIn,
    isValidPosition: isValidPositionFn,
    isHexOccupied: isHexOccupiedFn,
    width = GRID_CONFIG?.GRID_WIDTH ?? 40,
    height = GRID_CONFIG?.GRID_HEIGHT ?? 40,
  }) {
    // envIn is often an object (mapDefinition/combatTerrain). Prefer a meaningful label over "[object Object]".
    let envRaw = (
      typeof envIn === "string"
        ? envIn
        : (envIn?.biome ||
            envIn?.environmentName ||
            envIn?.environment ||
            envIn?.name ||
            envIn?.mapName ||
            envIn?.type ||
            envIn?.terrainType ||
            envIn?.mapType ||
            "")
    )
      .toString()
      .toLowerCase();
    // Guard: mapType like "hex"/"square" isn't an environment profile.
    if (envRaw === "hex" || envRaw === "square") envRaw = "";
    const env =
      envRaw.includes("forest") ? "forest" :
      envRaw.includes("cave") ? "cave" :
      envRaw.includes("ruin") ? "ruins" :
      "generic";

    const profile = ENV_PROP_PROFILES[env] || ENV_PROP_PROFILES.generic;
    const newMap = new Map();

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (!isValidPositionFn(x, y)) continue;
        if (isHexOccupiedFn(x, y, null)) continue; // skip occupied at seed time
        if (Math.random() > profile.density) continue;

        const bundle = pickWeighted(profile.bundles);
        const qty = randInt(bundle.min, bundle.max);

        const k = cellKey(x, y);
        const cur = newMap.get(k) || {};
        newMap.set(k, { ...cur, [bundle.type]: (cur[bundle.type] || 0) + qty });
      }
    }

    arenaPropsRef.current = newMap;
  }

  function takePropsAtCell(x, y, wantTypes, maxTake = 2) {
    const k = cellKey(x, y);
    const cur = arenaPropsRef.current.get(k);
    if (!cur) return { taken: {}, total: 0 };

    let remaining = maxTake;
    const taken = {};

    for (const t of wantTypes) {
      if (remaining <= 0) break;
      const have = cur[t] || 0;
      if (have <= 0) continue;

      const take = Math.min(have, remaining);
      taken[t] = (taken[t] || 0) + take;
      cur[t] = have - take;
      remaining -= take;
    }

    // Cleanup empty cells
    const stillHasAny = Object.values(cur).some((n) => (n || 0) > 0);
    if (!stillHasAny) arenaPropsRef.current.delete(k);
    else arenaPropsRef.current.set(k, cur);

    const total = Object.values(taken).reduce((s, n) => s + n, 0);
    return { taken, total };
  }

  function findAndTakeNearbyProps(myPos, radius = 2) {
    if (!myPos) return { taken: {}, total: 0 };

    const wantTypes = ["rock", "brick", "branch", "bone"]; // all count as throwable “debris”
    // Check center + rings of neighbors up to radius
    const visited = new Set();
    const queue = [{ x: myPos.x, y: myPos.y, d: 0 }];

    while (queue.length) {
      const node = queue.shift();
      const k = cellKey(node.x, node.y);
      if (visited.has(k)) continue;
      visited.add(k);

      // Try to take from this cell
      const got = takePropsAtCell(node.x, node.y, wantTypes, 2);
      if (got.total > 0) return got;

      if (node.d >= radius) continue;
      const nbrs = getHexNeighbors(node.x, node.y) || [];
      for (const n of nbrs) queue.push({ x: n.x, y: n.y, d: node.d + 1 });
    }

    return { taken: {}, total: 0 };
  }
  
  const isTargetImmuneToSpellDamageType = useCallback((target, spell) => {
    if (!spell || !target) return false;
    
    // Determine spell damage type from multiple sources
    let effectiveDmgType = normalizeDamageType(spell?.damageType);
    
    // Fallback 1: Check SPELL_ELEMENT_MAP if damageType is not set
    if (!effectiveDmgType || effectiveDmgType === "force" || effectiveDmgType === "magic") {
      const spellElement = SPELL_ELEMENT_MAP[spell.name] || null;
      if (spellElement) {
        effectiveDmgType = spellElement.toLowerCase();
      }
    }
    
    // Fallback 2: Check spell name for fire/cold keywords
    const spellNameLower = (spell.name || "").toLowerCase();
    if (!effectiveDmgType || effectiveDmgType === "force" || effectiveDmgType === "magic") {
      if (spellNameLower.includes("fire") || spellNameLower.includes("flame") || spellNameLower.includes("burn")) {
        effectiveDmgType = "fire";
      } else if (spellNameLower.includes("cold") || spellNameLower.includes("ice") || spellNameLower.includes("frost")) {
        effectiveDmgType = "cold";
      } else if (spellNameLower.includes("poison") || spellNameLower.includes("toxin")) {
        effectiveDmgType = "poison";
      }
    }
    
    if (!effectiveDmgType) return false;
    
    // Common "no effect" patterns
    if (effectiveDmgType.includes("fire")) {
      return (
        targetHasImmunityText(target, "impervious to fire") ||
        targetHasImmunityText(target, "immune to fire") ||
        targetHasImmunityText(target, "immunity to fire")
      );
    }
    if (effectiveDmgType.includes("cold") || effectiveDmgType.includes("ice")) {
      return (
        targetHasImmunityText(target, "impervious to cold") ||
        targetHasImmunityText(target, "immune to cold") ||
        targetHasImmunityText(target, "immunity to cold") ||
        targetHasImmunityText(target, "impervious to ice")
      );
    }
    if (effectiveDmgType.includes("poison") || effectiveDmgType.includes("toxin")) {
      return (
        targetHasImmunityText(target, "immune to poison") ||
        targetHasImmunityText(target, "immunity to poison") ||
        targetHasImmunityText(target, "poison immunity")
      );
    }
    if (effectiveDmgType.includes("magic") || effectiveDmgType.includes("spell")) {
      return (
        targetHasImmunityText(target, "immune to magic") ||
        targetHasImmunityText(target, "impervious to magic")
      );
    }
    
    return false;
  }, [normalizeDamageType, targetHasImmunityText]);
  
  // Initialize weakness memory for AI fighters
  const weaknessMemoryRef = useRef({}); // Store weakness memory per AI fighter
  
  // Initialize threat profiles for enemies
  const initializeThreatProfile = useCallback((fighter) => {
    if (!fighter.threatProfile) {
      setFighters(prev => prev.map(f => 
        f.id === fighter.id 
          ? { ...f, threatProfile: createThreatProfile() }
          : f
      ));
    }
  }, []);

  const pickEnemySpellFromCatalog = useCallback((enemy, target) => {
    // Full catalog for Ariel comes from getFighterSpellsUtil(enemy) now
    const catalog = (getFighterSpellsUtil?.(enemy) || []).filter(Boolean);
    if (catalog.length === 0) return null;
    
    const guardKey = `${enemy.id}:${meleeRound}`;
    const now = Date.now();
    const guard = enemySpellLoopGuardRef.current.get(guardKey) || {
      lastCastAt: 0,
      lastSpellName: null,
      targetId: null,
      recent: [],
      lastMeleeRound: null,
    };
    
    // 1) Hard "cooldown" (prevents rapid-fire spam loops)
    if (now - guard.lastCastAt < 1200) return null;
    
    // 2) One spell per melee per enemy (prevents machine-gun casting)
    // If you WANT more than 1 spell/melee later, change this to a counter.
    if (guard.lastCastAt && guardKey && guard.lastMeleeRound === meleeRound) {
      // already cast this melee
      return null;
    }
    
    // Initialize weakness memory for this AI if needed
    if (!weaknessMemoryRef.current[enemy.id]) {
      weaknessMemoryRef.current[enemy.id] = {};
    }
    
    // Initialize threat profile for target if needed
    if (target && !target.threatProfile) {
      initializeThreatProfile(target);
    }
    
    // Use unified spell selection system (Palladium-faithful)
    const selectedSpell = selectSpell(
      enemy,
      target,
      catalog,
      weaknessMemoryRef.current[enemy.id],
      meleeRound,
      {
        avoidRepeating: true,
        lastSpellName: guard.lastSpellName,
        maxPPE: enemy.currentPPE || enemy.PPE || Infinity
      }
    );
    
    // Fallback to old system if unified selection returns null
    if (!selectedSpell) {
      // Filter: can affect target + not immune
      const viable = catalog.filter((s) => {
        if (!s) return false;
        // If spell needs a target, ensure it can affect the chosen target
        if (spellRequiresTarget?.(s) || s.requiresTarget) {
          if (!spellCanAffectTarget?.(s, enemy, target)) return false;
        }
        if (isTargetImmuneToSpellDamageType(target, s)) return false;
        
        // Avoid repeating the same spell into the same target back-to-back
        const name = (s.name || "").toLowerCase();
        if (guard.targetId === target?.id && guard.recent.slice(-2).includes(name)) {
          return false;
        }
        return true;
      });
      
      if (viable.length === 0) return null;
      
      // Simple bias: offensive if enemy is "attacking"
      const offensive = viable.filter((s) => isOffensiveSpell?.(s));
      const pool = offensive.length > 0 ? offensive : viable;
      
      // Random pick
      const idx = Math.floor(Math.random() * pool.length);
      return pool[idx] || null;
    }
    
    return selectedSpell;
  }, [meleeRound, spellRequiresTarget, spellCanAffectTarget, isTargetImmuneToSpellDamageType, isOffensiveSpell, initializeThreatProfile]);
  
  const [showTacticalMap, setShowTacticalMap] = useState(false); // Toggle tactical map display
  const [show3DView, setShow3DView] = useState(false); // Toggle 3D view display (hidden by default)
  const [mapViewMode, setMapViewMode] = useState('2D'); // '2D' or '3D' view mode
  const [mapHeight, setMapHeight] = useState(1200); // Map height in pixels
  const [movementMode, setMovementMode] = useState({ active: false, isRunning: false }); // Track if player is selecting movement and running mode
  const [playerMovementMode, setPlayerMovementMode] = useState('ground'); // Track player's chosen movement mode: 'ground' | 'flight'
  const [selectedCombatantId, setSelectedCombatantId] = useState(null); // Track selected combatant from map
  const [hoveredCell, setHoveredCell] = useState(null); // Track hovered hex cell
  const [selectedHex, setSelectedHex] = useState(null); // Track selected hex for movement
  const [selectedMovementFighter, setSelectedMovementFighter] = useState(null); // Track which fighter is moving
  const [psionicsMode, setPsionicsMode] = useState(false); // Track if player is selecting psionic power
  const [spellsMode, setSpellsMode] = useState(false); // Track if player is selecting spell
  const [clericalAbilitiesMode, setClericalAbilitiesMode] = useState(false); // Track if player is selecting clerical ability
  const [selectedClericalAbility, setSelectedClericalAbility] = useState(null); // Selected clerical ability
  const [selectedSkill, setSelectedSkill] = useState(null); // Track selected skill for use
  const [showPhase0Modal, setShowPhase0Modal] = useState(false); // Phase 0 scene setup modal
  const [lootWindowOpen, setLootWindowOpen] = useState(false); // Loot window state
  const [selectedLootSource, setSelectedLootSource] = useState(null); // Fighter to loot from
  const [lootData, setLootData] = useState(null); // Loot data to display
  const [arenaSpeed, setArenaSpeed] = useState("slow"); // Combat pacing: slow/normal/fast
  const [phase0Results, setPhase0Results] = useState(null); // Store Phase 0 scene setup
  const [combatTerrain, setCombatTerrain] = useState(null); // Store terrain data for combat
  const [mode, setMode] = useState("MAP_EDITOR"); // "MAP_EDITOR" | "COMBAT"
  const [mapDefinition, setMapDefinition] = useState(null); // Map definition for editor mode
  const arena3DRef = useRef(null);
  // Editor paint selection (start simple)
  const [selectedTerrainType, setSelectedTerrainType] = useState("grass");
  // Incremental 3D sync queue
  const pending3DChangesRef = useRef([]);
  const rafFlushRef = useRef(null);
  // Keep the latest mapDefinition for RAF flush
  const mapDefinitionRef = useRef(null);
  useEffect(() => {
    mapDefinitionRef.current = mapDefinition;
  }, [mapDefinition]);
  const [enemySortMode, setEnemySortMode] = useState("type"); // Sort mode for bestiary creatures
  const [creatureTypeFilter, setCreatureTypeFilter] = useState("all"); // Filter bestiary by category
  const collator = useMemo(() => new Intl.Collator(undefined, { sensitivity: "base" }), []);
  const creatureTypeOptions = useMemo(() => {
    const creatures = getAllBestiaryEntries(bestiary);
    const uniqueCategories = new Set(creatures.map((creature) => creature.category || "Unknown"));
    return Array.from(uniqueCategories).sort((a, b) => collator.compare(a, b));
  }, [collator]);
  const formatCreatureCategory = useCallback((category) => {
    if (!category) return "Unknown";
    return category
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }, []);
  const sortedCreatures = useMemo(() => {
    const creatures = getAllBestiaryEntries(bestiary);
    const filteredCreatures =
      creatureTypeFilter === "all"
        ? creatures
        : creatures.filter((creature) => (creature.category || "Unknown") === creatureTypeFilter);
    const sorted = [...filteredCreatures];

    if (enemySortMode === "type") {
      return sorted.sort((a, b) => {
        const typeA = a.category || "Unknown";
        const typeB = b.category || "Unknown";
        const typeComparison = collator.compare(typeA, typeB);
        if (typeComparison !== 0) return typeComparison;
        return collator.compare(a.name || "", b.name || "");
      });
    }

    return sorted.sort((a, b) => collator.compare(a.name || "", b.name || ""));
  }, [collator, creatureTypeFilter, enemySortMode]);
  const selectedCreatureData = useMemo(
    () => sortedCreatures.find((creature) => creature.id === selectedCreature),
    [sortedCreatures, selectedCreature]
  );

  // Get all available armors from armorShopData
  const availableArmors = useMemo(() => {
    const allArmors = [
      ...(armorShopData.lightArmor || []),
      ...(armorShopData.mediumArmor || []),
      ...(armorShopData.heavyArmor || []),
      ...(armorShopData.shields || []),
    ];
    // Add "None" option
    return [{ name: "None", ar: 0, sdc: 0, type: "none", description: "No armor" }, ...allArmors];
  }, []);

  // Get all available weapons (including natural attacks for non-humanoids)
  const availableWeapons = useMemo(() => {
    const baseWeapons = [{ name: "None", damage: null, type: "none", description: "Use default weapon assignment" }, ...weapons];
    
    // For non-humanoid creatures with natural attacks, add them to the weapon list
    if (selectedCreatureData && !isHumanoid(selectedCreatureData) && selectedCreatureData.attacks && Array.isArray(selectedCreatureData.attacks)) {
      const naturalAttacks = selectedCreatureData.attacks
        .filter(attack => attack.name && attack.damage !== "by spell" && attack.damage !== "varies" && !attack.name.toLowerCase().includes("magic"))
        .map(attack => {
          // Special handling for Fire Whip - use proper weapon definition
          if (attack.name === "Fire Whip") {
            return {
              name: attack.name,
              damage: baalRogFireWhip.damage || attack.damage || "4d6",
              type: "melee",
              category: "natural",
              reach: baalRogFireWhip.reach || attack.reach || 15,
              range: attack.range || 0,
              weaponType: "flexible",
              properties: baalRogFireWhip.properties || {},
              specialAttacks: baalRogFireWhip.specialAttacks || [],
            };
          }
          return {
            name: attack.name,
            damage: attack.damage || "1d6",
            type: "melee",
            category: "natural",
            reach: attack.reach || 0,
            range: attack.range || 0,
          };
        });
      
      // Get natural attack names to filter duplicates from weapons array
      const naturalAttackNames = new Set(naturalAttacks.map(attack => attack.name));
      
      // Filter out weapons that are already in natural attacks (to prevent duplicates)
      const filteredWeapons = baseWeapons.slice(1).filter(weapon => !naturalAttackNames.has(weapon.name));
      
      // Add natural attacks to the beginning of the list (after "None")
      return [baseWeapons[0], ...naturalAttacks, ...filteredWeapons];
    }
    
    return baseWeapons;
  }, [selectedCreatureData]);

  // Check if selected weapon requires ammo
  const selectedWeaponRequiresAmmo = useMemo(() => {
    if (!selectedWeapon || selectedWeapon === "None") return false;
    const weapon = weapons.find(w => w.name === selectedWeapon);
    if (!weapon) return false;
    return Boolean(weapon.ammunition && weapon.ammunition !== "self");
  }, [selectedWeapon]);

  // Check if selected creature is humanoid
  const isSelectedHumanoid = useMemo(() => {
    return selectedCreatureData ? isHumanoid(selectedCreatureData) : false;
  }, [selectedCreatureData]);
  useEffect(() => {
    if (selectedCreature && !selectedCreatureData) {
      setSelectedCreature("");
    }
  }, [selectedCreature, selectedCreatureData]);
  const combatStateRef = useRef({ closedDistances: new Map() }); // Track reach-based combat state
  const [visibleCells, setVisibleCells] = useState([]); // Fog of war: visible cell positions
  const [exploredCells, setExploredCells] = useState([]); // Fog of war: explored (memory) cell positions
  const [fogEnabled, setFogEnabled] = useState(false); // Enable/disable fog of war
  const [combatPaused, setCombatPaused] = useState(false); // Pause/resume combat flow
  // Awareness states are now tracked internally by aiVisibilityFilter.js using Map
  // No need for separate state - awareness is managed automatically
  const MIN_COMBAT_HP = -100;
  const currentMapType = useMemo(() => {
    const selectedType = combatTerrain?.mapType || phase0Results?.environment?.mapType;
    return selectedType === "square" ? "square" : "hex";
  }, [combatTerrain?.mapType, phase0Results?.environment?.mapType]);

  const arenaEnvironment = useMemo(() => {
    if (combatTerrain) return combatTerrain;
    if (mapDefinition) return mapDefinition;
    return phase0Results?.environment || null;
  }, [combatTerrain, mapDefinition, phase0Results]);

  useEffect(() => {
    // Seed props once at start of combat (or whenever environment changes while combat is active)
    if (!combatActive) {
      arenaPropsSeededForRef.current = null;
      return;
    }

    let envKey = (
      typeof arenaEnvironment === "string"
        ? arenaEnvironment
        : (arenaEnvironment?.biome ||
            arenaEnvironment?.environmentName ||
            arenaEnvironment?.environment ||
            arenaEnvironment?.name ||
            arenaEnvironment?.mapName ||
            arenaEnvironment?.type ||
            arenaEnvironment?.terrainType ||
            arenaEnvironment?.mapType ||
            "generic")
    )
      .toString()
      .toLowerCase();
    if (envKey === "hex" || envKey === "square") envKey = "generic";
    if (arenaPropsSeededForRef.current === envKey) return;

    try {
      seedArenaProps({
        arenaEnvironment,
        isValidPosition,
        isHexOccupied,
        width: GRID_CONFIG?.GRID_WIDTH ?? 40,
        height: GRID_CONFIG?.GRID_HEIGHT ?? 40,
      });
      arenaPropsSeededForRef.current = envKey;
      addLog(`🌿 Arena props seeded for environment: ${envKey}`, "info");
    } catch {
      // props are optional; fail silently
    }
  }, [combatActive, arenaEnvironment]);

  // Initialize mapDefinition from phase0Results when available
  useEffect(() => {
    if (phase0Results?.environment && !mapDefinition) {
      setMapDefinition(phase0Results.environment);
    }
  }, [phase0Results, mapDefinition]);

  // Incremental 3D sync queue
  const queue3DCellChange = useCallback((col, row, cell) => {
    pending3DChangesRef.current.push({ col, row, cell });
    if (rafFlushRef.current) return;

    rafFlushRef.current = requestAnimationFrame(() => {
      const changes = pending3DChangesRef.current;
      pending3DChangesRef.current = [];
      rafFlushRef.current = null;

      const latest = mapDefinitionRef.current;
      if (changes.length && latest && arena3DRef.current?.syncMapEditorState) {
        arena3DRef.current.syncMapEditorState(latest, changes);
      }
    });
  }, []);

  // Editor cell edit handler
  const handleMapCellEdit = useCallback(
    (x, y, cell) => {
      setMapDefinition((prev) => {
        const updated = { ...(prev || {}) };
        if (!updated.grid) updated.grid = [];
        if (!updated.grid[y]) updated.grid[y] = [];
        updated.grid[y][x] = cell;
        return updated;
      });

      queue3DCellChange(x, y, cell);
    },
    [queue3DCellChange]
  );

  const handleMapCellsEdit = useCallback(
    (changes) => {
      if (!Array.isArray(changes) || changes.length === 0) return;
      setMapDefinition((prev) => {
        const updated = { ...(prev || {}) };
        const nextGrid = Array.isArray(updated.grid)
          ? updated.grid.map((row) => (Array.isArray(row) ? [...row] : []))
          : [];
        changes.forEach((c) => {
          if (!nextGrid[c.y]) nextGrid[c.y] = [];
          nextGrid[c.y][c.x] = c.cell;
        });
        updated.grid = nextGrid;
        return updated;
      });
      // Feed into the existing incremental 3D queue (single RAF flush)
      changes.forEach((c) => queue3DCellChange(c.x, c.y, c.cell));
    },
    [queue3DCellChange]
  );

  // Start combat from editor - switches from MAP_EDITOR to COMBAT mode
  // Start combat from editor - switches from MAP_EDITOR to COMBAT mode
  const startCombatFromEditor = useCallback(() => {
    setMode("COMBAT");
    if (mapDefinition) {
      setCombatTerrain(mapDefinition);
    }
    // The existing startCombat function will be called separately to initialize combat
    // This just switches the UI mode and sets up the terrain
  }, [mapDefinition]);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isPartyOpen, onOpen: onPartyOpen, onClose: onPartyClose } = useDisclosure();
  
  // Sync showPartySelector with isPartyOpen for compatibility
  useEffect(() => {
    setShowPartySelector(isPartyOpen);
  }, [isPartyOpen]);
  const { isOpen: isCombatChoicesOpen, onOpen: openCombatChoices, onClose: closeCombatChoices } = useDisclosure();
  const { isOpen: isMobileDrawerOpen, onOpen: onMobileDrawerOpen, onClose: onMobileDrawerClose } = useDisclosure();
  
  // Sync showCombatChoices with isCombatChoicesOpen for compatibility
  useEffect(() => {
    setShowCombatChoices(isCombatChoicesOpen);
  }, [isCombatChoicesOpen]);
  
  // Sync isCombatChoicesOpen with showCombatChoices when showCombatChoices changes externally
  useEffect(() => {
    if (showCombatChoices && !isCombatChoicesOpen) {
      openCombatChoices();
    } else if (!showCombatChoices && isCombatChoicesOpen) {
      closeCombatChoices();
    }
  }, [showCombatChoices, isCombatChoicesOpen, openCombatChoices, closeCombatChoices]);

  useEffect(() => {
    combatPausedRef.current = combatPaused;
  }, [combatPaused]);

  useEffect(() => {
    if (wasPausedRef.current && !combatPaused) {
      lastAutoTurnKeyRef.current = null;
    }
    wasPausedRef.current = combatPaused;
  }, [combatPaused]);

  useEffect(() => {
    if (prevAiControlRef.current !== aiControlEnabled) {
      prevAiControlRef.current = aiControlEnabled;
      lastAutoTurnKeyRef.current = null;
    }
  }, [aiControlEnabled]);

  useEffect(() => {
    lastAutoTurnKeyRef.current = null;
  }, [arenaSpeed]);

  const getActionDelay = useCallback(
    (speed = arenaSpeed) => {
      switch (speed) {
        case "slow":
          return 15000;
        case "fast":
          return 500;
        default:
          return 1500;
      }
    },
    [arenaSpeed]
  );

  const getMoveDurationMs = useCallback(
    (distanceFeet) => {
      const base = getActionDelay();
      const scaled = Math.round(
        base * Math.min(1, Math.max(0.25, (distanceFeet || 0) / 30))
      );
      return Math.max(250, Math.min(2500, scaled));
    },
    [getActionDelay]
  );

  const markActionBusy = useCallback((durationMs) => {
    if (!durationMs || durationMs <= 0) return;
    const now = performance.now();
    actionClockRef.current.busy = true;
    actionClockRef.current.endsAtMs = Math.max(
      actionClockRef.current.endsAtMs || 0,
      now + durationMs
    );
  }, []);

  const isActionBusy = useCallback(() => {
    if (!actionClockRef.current.busy) return false;
    const now = performance.now();
    if (now >= actionClockRef.current.endsAtMs) {
      actionClockRef.current.busy = false;
      return false;
    }
    return true;
  }, []);

  const enqueueMoveAnimation = useCallback(
    (fighterId, toPos, durationMs) => {
      if (!fighterId || !toPos || durationMs <= 0) return;

      const lerp = (a, b, t) => a + (b - a) * t;
      const easeInOut = (t) =>
        t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const startMs = performance.now();

      setRenderPositions((prev) => {
        const cur =
          prev[fighterId] ||
          positionsRef.current?.[fighterId] ||
          toPos;
        return {
          ...prev,
          [fighterId]: {
            x: cur.x,
            y: cur.y,
            altitudeFeet: cur.altitudeFeet ?? 0,
            facing: cur.facing ?? 0,
          },
        };
      });

      markActionBusy(durationMs);

      const tick = () => {
        const now = performance.now();
        const tRaw = (now - startMs) / durationMs;
        const t = Math.min(1, Math.max(0, tRaw));
        const k = easeInOut(t);

        setRenderPositions((prev) => {
          const cur = prev[fighterId];
          if (!cur) return prev;
          return {
            ...prev,
            [fighterId]: {
              ...cur,
              x: lerp(cur.x, toPos.x, k),
              y: lerp(cur.y, toPos.y, k),
              altitudeFeet: lerp(cur.altitudeFeet ?? 0, toPos.altitudeFeet ?? 0, k),
            },
          };
        });

        if (t < 1) {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);
    },
    [setRenderPositions, markActionBusy]
  );

  const applySuppressionToFighter = useCallback(
    (fighterId, payload) => {
      if (!fighterId || !payload) return;
      const now = performance.now();
      const severityRank = { LOW: 1, MED: 2, HIGH: 3 };

      setFighters((prev) => {
        let changed = false;
        const next = prev.map((f) => {
          if (f.id !== fighterId) return f;
          if (!canFighterAct(f)) return f;

          const existing = f.suppression;
          const existingExpired =
            existing?.expiresAtMs && existing.expiresAtMs <= now;
          const existingRank = severityRank[existing?.severity] || 0;
          const newRank = severityRank[payload?.severity] || 1;
          const existingImpact = existing?.impactAtMs ?? Infinity;
          const newImpact = payload?.impactAtMs ?? Infinity;

          let nextSuppression;
          if (!existing || existingExpired) {
            nextSuppression = { ...payload, isSuppressed: true };
          } else if (newRank > existingRank || newImpact < existingImpact) {
            nextSuppression = {
              ...payload,
              isSuppressed: true,
              visibleThreat:
                existing.visibleThreat || payload.visibleThreat,
              revealedAtMs:
                payload.revealedAtMs ?? existing.revealedAtMs,
            };
          } else {
            nextSuppression = {
              ...existing,
              isSuppressed: true,
              visibleThreat:
                existing.visibleThreat || payload.visibleThreat,
              revealedAtMs:
                existing.revealedAtMs ?? payload.revealedAtMs,
            };
          }

          if (JSON.stringify(existing) !== JSON.stringify(nextSuppression)) {
            changed = true;
            return { ...f, suppression: nextSuppression };
          }
          return f;
        });

        return changed ? next : prev;
      });
    },
    [canFighterAct, setFighters]
  );

  const getProjectileKindAndSpeed = useCallback((attackData) => {
    const weaponName = String(attackData?.name || "").toLowerCase();
    const ammoType = String(attackData?.ammunition || "").toLowerCase();
    const weaponType = String(attackData?.weaponType || "").toLowerCase();
    const category = String(attackData?.category || "").toLowerCase();

    let kind = "generic";
    if (ammoType.includes("arrow") || weaponName.includes("bow")) kind = "arrow";
    else if (ammoType.includes("bolt") || weaponName.includes("crossbow"))
      kind = "bolt";
    else if (
      ammoType.includes("stone") ||
      ammoType.includes("rock") ||
      weaponName.includes("sling")
    )
      kind = "stone";
    else if (weaponType.includes("thrown") || category.includes("thrown"))
      kind = "thrown";

    const speedByKind = {
      arrow: 180,
      bolt: 160,
      stone: 120,
      thrown: 90,
      generic: 140,
    };
    const speed = speedByKind[kind] || 140;
    return { kind, speed };
  }, []);

  const scheduleTimelineEvent = useCallback((evt) => {
    if (!evt || !Number.isFinite(evt.timeMs)) return;
    timelineRef.current.events.push(evt);
    timelineRef.current.events.sort((a, b) => a.timeMs - b.timeMs);
  }, []);

  const popDueTimelineEvents = useCallback(() => {
    const now = performance.now();
    const due = [];
    const rest = [];
    timelineRef.current.events.forEach((e) => {
      if (e.timeMs <= now) due.push(e);
      else rest.push(e);
    });
    timelineRef.current.events = rest;
    return due;
  }, []);

  const resolveOverwatchImpact = useCallback(
    ({ shooterId, targetHex, weaponData, attackSnapshot }) => {
      if (!shooterId || !targetHex || !weaponData || !attackSnapshot) return;
      const shooter =
        fightersRef.current?.find?.((f) => f.id === shooterId) || null;
      if (!shooter) return;
      addLog(
        `🟠 Overwatch impact at (${targetHex.x}, ${targetHex.y}) (d20=${attackSnapshot.attackDiceRoll}, total=${attackSnapshot.attackRoll}).`,
        "info"
      );

      const order = fightersRef.current || [];
      const orderIndex = new Map(order.map((f, idx) => [f.id, idx]));
      const sortByOrder = (a, b) => {
        const ia = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const ib = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (ia !== ib) return ia - ib;
        return String(a.id).localeCompare(String(b.id));
      };

      const wouldHitTarget = (snapshot, targetAR) => {
        if (snapshot.isCriticalMiss) return false;
        if (snapshot.isCriticalHit) return true;
        return snapshot.attackRoll >= targetAR;
      };

      const getCandidatesAtHex = (hex) =>
        Object.entries(positionsRef.current || {})
          .filter(([, pos]) => pos.x === hex.x && pos.y === hex.y)
          .map(([id]) => fightersRef.current?.find?.((f) => f.id === id))
          .filter(Boolean)
          .sort(sortByOrder);

      const tryResolveAtHex = (hex, snapshot) => {
        const candidates = getCandidatesAtHex(hex);
        if (!candidates.length) {
          return false;
        }

        for (const target of candidates) {
          const targetAR = target.AR || target.ar || 10;
          if (wouldHitTarget(snapshot, targetAR)) {
            suppressEndTurnRef.current = true;
            try {
              attack(shooter, target.id, {
                attackDataOverride: weaponData,
                preRoll: snapshot,
                suppressEndTurn: true,
                forceNoDefense: true,
                skipStaminaDrain: true,
                skipTempModifiers: true,
              });
              const snapDamage = snapshot?.damageTotal ?? "unknown";
              addLog(
                `🎯 Overwatch hits ${target.name} for ${snapDamage} (snapshot).`,
                "warning"
              );
            } finally {
              suppressEndTurnRef.current = false;
            }
            return true;
          }
        }
        return false;
      };

      if (attackSnapshot.isCriticalMiss) {
        const neighbors = getHexNeighbors(targetHex.x, targetHex.y) || [];
        if (!neighbors.length) {
          addLog(`🟠 Overwatch CRIT MISS scatters but hits nothing.`, "info");
          return;
        }

        const seed = String(attackSnapshot.scatterSeed || "");
        let h = 2166136261;
        for (let i = 0; i < seed.length; i++) {
          h ^= seed.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        const startIdx = (h >>> 0) % neighbors.length;
        let scatterHex = null;
        for (let i = 0; i < neighbors.length; i++) {
          const candidate = neighbors[(startIdx + i) % neighbors.length];
          if (candidate && isValidPosition(candidate.x, candidate.y)) {
            scatterHex = candidate;
            break;
          }
        }

        if (!scatterHex) {
          addLog(`🟠 Overwatch CRIT MISS scatters but hits nothing.`, "info");
          return;
        }

        const scatterSnapshot = { ...attackSnapshot, isCriticalMiss: false };

        addLog(
          `🟠 Overwatch CRIT MISS scatters to (${scatterHex.x}, ${scatterHex.y})…`,
          "info"
        );

        const hit = tryResolveAtHex(scatterHex, scatterSnapshot);
        if (!hit) {
          addLog(
            `🟠 Scatter lands at (${scatterHex.x}, ${scatterHex.y}) but hits no one.`,
            "info"
          );
        }
        return;
      }

      const hit = tryResolveAtHex(targetHex, attackSnapshot);
      if (!hit) {
        addLog(
          `🟠 Overwatch lands at (${targetHex.x}, ${targetHex.y}) but hits no one.`,
          "info"
        );
      }
    },
    [addLog, attack]
  );

  const handleTimelineEvent = useCallback(
    (evt) => {
      if (!evt || evt.type !== "PROJECTILE_IMPACT") return;
      const { shooterId, targetHex, weaponData, attackSnapshot } = evt.data || {};
      if (!shooterId || !targetHex || !attackSnapshot) return;

      resolveOverwatchImpact({
        shooterId,
        targetHex,
        weaponData,
        attackSnapshot,
      });
    },
    [resolveOverwatchImpact]
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!timelineRef.current.locked) {
        const due = popDueTimelineEvents();
        if (due.length) {
          due.forEach(handleTimelineEvent);
        }
      }

      const now = performance.now();
      setOverwatchHexes((prev) =>
        prev.filter((h) => !h?.expiresAtMs || h.expiresAtMs > now)
      );
      setOverwatchShots((prev) =>
        prev.filter((s) => !s?.impactAtMs || s.impactAtMs > now)
      );

      setFighters((prev) => {
        let changed = false;
        const next = prev.map((f) => {
          const sup = f.suppression;
          if (!sup?.isSuppressed) return f;

          if (sup.expiresAtMs && now >= sup.expiresAtMs) {
            changed = true;
            const nextF = { ...f };
            delete nextF.suppression;
            return nextF;
          }

          if (!sup.visibleThreat && sup.revealedAtMs && now >= sup.revealedAtMs) {
            changed = true;
            return {
              ...f,
              suppression: { ...sup, visibleThreat: true },
            };
          }

          return f;
        });
        return changed ? next : prev;
      });
    }, 100);

    return () => clearInterval(intervalId);
  }, [setFighters, popDueTimelineEvents, handleTimelineEvent]);

  const pickMissGridNear = useCallback(
    (targetPos) => {
      const offsets = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: -1, y: 1 },
      ];
      for (const off of offsets) {
        const x = targetPos.x + off.x;
        const y = targetPos.y + off.y;
        if (
          x >= 0 &&
          y >= 0 &&
          x < GRID_CONFIG.GRID_WIDTH &&
          y < GRID_CONFIG.GRID_HEIGHT
        ) {
          return { x, y };
        }
      }
      return { x: targetPos.x, y: targetPos.y };
    },
    []
  );

  const spawnProjectile = useCallback(
    ({ attackerId, defenderId, attackData, hit }) => {
      if (!attackerId || !defenderId) return;

      const attackerPos =
        renderPositionsRef.current?.[attackerId] ||
        positionsRef.current?.[attackerId];
      const defenderPos =
        renderPositionsRef.current?.[defenderId] ||
        positionsRef.current?.[defenderId];
      if (!attackerPos || !defenderPos) return;

      const fromGrid = {
        x: Math.round(attackerPos.x),
        y: Math.round(attackerPos.y),
      };
      const toGridBase = {
        x: Math.round(defenderPos.x),
        y: Math.round(defenderPos.y),
      };

      const attacker = fightersRef.current?.find?.((f) => f.id === attackerId);
      const defender = fightersRef.current?.find?.((f) => f.id === defenderId);

      const { kind, speed } = getProjectileKindAndSpeed(attackData);

      const targetGrid = hit ? toGridBase : pickMissGridNear(toGridBase);

      const distanceFeet = calculateDistance(fromGrid, targetGrid);
      const durationMs = Math.max(
        180,
        Math.min(900, Math.round((distanceFeet / speed) * 1000))
      );

      if (cinematicProjectiles) {
        markActionBusy(Math.min(durationMs, 900));
      }

      const isNoticeable = durationMs >= 450;
      if (isNoticeable && defender) {
        const isHiddenShooter =
          attacker?.isHidden ||
          attacker?.statusEffects?.includes("HIDDEN") ||
          attacker?.statusEffects?.includes("INVISIBLE");
        const impactAtMs = performance.now() + durationMs;
        const revealLeadMs = 250;
        const visibleThreat = !isHiddenShooter;

        applySuppressionToFighter(defenderId, {
          sourceId: attackerId,
          kind: "PROJECTILE_INBOUND",
          dangerHexes: [{ x: targetGrid.x, y: targetGrid.y }],
          lane: null,
          startedAtMs: performance.now(),
          impactAtMs,
          expiresAtMs: impactAtMs + 500,
          visibleThreat,
          revealedAtMs: visibleThreat ? null : impactAtMs - revealLeadMs,
          severity: kind === "arrow" || kind === "bolt" ? "MED" : "LOW",
        });
      }

      const fromAlt = (attacker?.altitudeFeet ?? attacker?.altitude ?? 0) + 4;
      const toAlt = (defender?.altitudeFeet ?? defender?.altitude ?? 0) + 4;

      const projectile = {
        id: `p_${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}`,
        kind,
        from: { x: fromGrid.x, y: fromGrid.y, altitudeFeet: fromAlt },
        to: { x: targetGrid.x, y: targetGrid.y, altitudeFeet: toAlt },
        firedAtMs: performance.now(),
        durationMs,
      };

      setProjectiles((prev) => [...prev, projectile]);

      // Cleanup after animation completes
      const cleanupDelay = durationMs + 200;
      const timeoutId = setTimeout(() => {
        setProjectiles((prev) => prev.filter((p) => p.id !== projectile.id));
      }, cleanupDelay);
      allTimeoutsRef.current.push(timeoutId);
    },
    [
      calculateDistance,
      pickMissGridNear,
      cinematicProjectiles,
      markActionBusy,
      applySuppressionToFighter,
      getProjectileKindAndSpeed,
    ]
  );

  const spawnProjectileToHex = useCallback(
    ({ attackerId, targetHex, attackData }) => {
      if (!attackerId || !targetHex || !attackData) return null;

      const attackerPos =
        renderPositionsRef.current?.[attackerId] ||
        positionsRef.current?.[attackerId];
      if (!attackerPos) return null;

      const fromGrid = {
        x: Math.round(attackerPos.x),
        y: Math.round(attackerPos.y),
      };
      const targetGrid = {
        x: Math.round(targetHex.x),
        y: Math.round(targetHex.y),
      };

      const { kind, speed } = getProjectileKindAndSpeed(attackData);
      const distanceFeet = calculateDistance(fromGrid, targetGrid);
      const durationMs = Math.max(
        180,
        Math.min(900, Math.round((distanceFeet / speed) * 1000))
      );

      if (cinematicProjectiles) {
        markActionBusy(Math.min(durationMs, 900));
      }

      const attacker =
        fightersRef.current?.find?.((f) => f.id === attackerId) || null;
      const fromAlt = (attacker?.altitudeFeet ?? attacker?.altitude ?? 0) + 4;

      const projectile = {
        id: `p_${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}`,
        kind,
        from: { x: fromGrid.x, y: fromGrid.y, altitudeFeet: fromAlt },
        to: { x: targetGrid.x, y: targetGrid.y, altitudeFeet: fromAlt },
        firedAtMs: performance.now(),
        durationMs,
      };

      setProjectiles((prev) => [...prev, projectile]);

      const cleanupDelay = durationMs + 200;
      const timeoutId = setTimeout(() => {
        setProjectiles((prev) => prev.filter((p) => p.id !== projectile.id));
      }, cleanupDelay);
      allTimeoutsRef.current.push(timeoutId);

      return { durationMs, kind, impactAtMs: projectile.firedAtMs + durationMs };
    },
    [calculateDistance, getProjectileKindAndSpeed, cinematicProjectiles, markActionBusy]
  );

  const clearScheduledTurn = useCallback(() => {
    if (turnTimeoutRef.current) {
      clearTimeout(turnTimeoutRef.current);
      turnTimeoutRef.current = null;
    }
    pendingTurnAdvanceRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      clearScheduledTurn();
    };
  }, [clearScheduledTurn]);

  useEffect(() => {
    if (combatPaused) {
      clearScheduledTurn();
    }
  }, [combatPaused, clearScheduledTurn]);

  // Helper: Check if alignment is evil (would attack dying targets)
  const isEvilAlignment = (alignment) => {
    if (!alignment) return false;

    const normalizeAlignments = (value) => {
      if (!value) return [];

      if (typeof value === "string") {
        return [value];
      }

      if (Array.isArray(value)) {
        return value.flatMap((item) => normalizeAlignments(item));
      }

      if (typeof value === "object") {
        const possibleKeys = [
          "name",
          "label",
          "type",
          "value",
          "alignment",
          "primary",
          "secondary"
        ];

        return possibleKeys.flatMap((key) => normalizeAlignments(value[key]));
      }

      return [];
    };

    const normalizedAlignments = normalizeAlignments(alignment)
      .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
      .filter(Boolean);

    if (normalizedAlignments.length === 0) return false;

    const evilAlignments = new Set(["evil", "miscreant", "aberrant", "diabolic"]);

    return normalizedAlignments.some((align) => evilAlignments.has(align));
  };

  // Helper: Get available skills for a character (including healer abilities, First Aid, etc.)
  const getAvailableSkills = useCallback((character) => {
    if (!character) return [];
    const skills = [];
    const occ = (character.occ || character.class || "").toLowerCase();
    
    // Healer ISP-based abilities
    if (occ.includes("healer")) {
      const currentISP = character.currentISP || character.currentIsp || character.ISP || 0;
      if (currentISP >= 8) {
        skills.push({ 
          name: "Healing Touch (Healer)", 
          type: "healer_ability", 
          cost: 8, 
          costType: "ISP",
          requiresTarget: true,
          range: "touch",
          description: "Restores 2d6+2 HP (8 ISP)"
        });
      }
      if (currentISP >= 6) {
        skills.push({ 
          name: "Negate Toxins", 
          type: "healer_ability", 
          cost: 6, 
          costType: "ISP",
          requiresTarget: true,
          range: "touch",
          description: "Neutralizes all poisons (6 ISP)"
        });
      }
      if (currentISP >= 10) {
        skills.push({ 
          name: "Lust for Life", 
          type: "healer_ability", 
          cost: 10, 
          costType: "ISP",
          requiresTarget: true,
          range: "touch",
          description: "Stabilizes dying target at 1 HP (10 ISP)"
        });
      }
      if (currentISP >= 10) {
        skills.push({ 
          name: "Resurrection", 
          type: "healer_ability", 
          cost: 10, 
          costType: "ISP",
          requiresTarget: true,
          range: "touch",
          description: "Attempts to resurrect dead target (10 ISP, 40% success)"
        });
      }
    }
    
    // Clerical Healing Touch (Priest, Cleric, Shaman)
    if (occ.includes("priest") || occ.includes("cleric") || occ.includes("shaman")) {
      skills.push({ 
        name: "Healing Touch (Divine)", 
        type: "clerical_ability", 
        cost: 0, 
        costType: "none",
        requiresTarget: true,
        range: "touch",
        description: "Restores 2d6+2 HP (divine power)"
      });
    }
    
    // First Aid / Medical Treatment
    const hasFirstAid = character.occSkills && (
      Object.keys(character.occSkills).some(skill => 
        skill.toLowerCase().includes("first aid") || 
        skill.toLowerCase().includes("medical")
      ) ||
      character.electiveSkills?.some(skill => 
        typeof skill === "string" && (
          skill.toLowerCase().includes("first aid") || 
          skill.toLowerCase().includes("medical") ||
          skill.toLowerCase().includes("surgery")
        )
      )
    );
    
    if (hasFirstAid) {
      const firstAidSkill = character.occSkills && Object.entries(character.occSkills).find(([skill]) => 
        skill.toLowerCase().includes("first aid") || skill.toLowerCase().includes("medical")
      );
      // Use getSkillPercentage to get accurate skill percentage
      const skillPercent = firstAidSkill 
        ? getSkillPercentage(character, firstAidSkill[0]) || (firstAidSkill[1]?.total || firstAidSkill[1] || 50)
        : 50;
      
      // Use lookupSkill to get skill details if available
      const skillInfo = lookupSkill("First Aid");
      
      skills.push({ 
        name: "First Aid", 
        type: "medical_skill", 
        cost: 1, 
        costType: "action",
        requiresTarget: true,
        range: "touch",
        skillPercent: skillPercent,
        description: `Medical treatment (1d6+2 HP on success, ${skillPercent}% skill)`,
        skillInfo: skillInfo // Store skill info for reference
      });
    }
    
    // Other combat-relevant skills
    if (character.occSkills) {
      Object.entries(character.occSkills).forEach(([skillName, skillData]) => {
        const skillLower = skillName.toLowerCase();
        // Add combat-relevant skills
        if (skillLower.includes("prowl") || skillLower.includes("track") || 
            skillLower.includes("climb") || skillLower.includes("detect")) {
          // Use getSkillPercentage to get accurate skill percentage
          const skillPercent = getSkillPercentage(character, skillName) || (skillData?.total || skillData || 0);
          
          // Use lookupSkill to get skill details if available
          const skillInfo = lookupSkill(skillName);
          
          if (skillPercent > 0) {
            skills.push({
              name: skillName,
              type: "combat_skill",
              cost: 1,
              costType: "action",
              requiresTarget: false,
              range: "self",
              skillPercent: skillPercent,
              description: `${skillName} (${skillPercent}%)`,
              skillInfo: skillInfo // Store skill info for reference
            });
          }
        }
      });
    }
    
    return skills;
  }, []);

  // Get current fighter (needed early for callbacks)
  const currentFighter = fighters[turnIndex];
  const activeFighters = fighters.filter(f => f.status === "active");
  const alivePlayers = fighters.filter(f => f.type === "player" && f.currentHP > -21);
  const aliveEnemies = fighters.filter(f => f.type === "enemy" && f.currentHP > -21);

  const shouldShowCombatOptions =
    fighters.length > 0 &&
    currentFighter &&
    currentFighter.type === "player" &&
    combatActive &&
    !aiControlEnabled;

  const isArielTurn =
    shouldShowCombatOptions &&
    String(currentFighter?.name || "").trim().toLowerCase() === "ariel";

  const getFighterPsionicPowers = useCallback((fighter) => {
    if (!fighter || !Array.isArray(fighter.psionicPowers)) return [];
    return fighter.psionicPowers.filter(Boolean);
  }, []);

  // Use the utility function from getFighterSpells.js
  const getFighterSpells = useCallback((fighter) => {
    return getFighterSpellsUtil(fighter, convertUnifiedSpellToCombatSpell);
  }, []);

  const availablePsionicPowers = useMemo(
    () => getFighterPsionicPowers(currentFighter),
    [currentFighter, getFighterPsionicPowers]
  );

  const availableSpells = useMemo(
    () => getFighterSpells(currentFighter),
    [currentFighter, getFighterSpells]
  );

  const hasPsionics = availablePsionicPowers.length > 0;
  const hasSpells = availableSpells.length > 0;

  // --- AI flight preference helpers ---
  const parseFlyMphFromAbilities = useCallback((fighter) => {
    if (!fighter) return 0;
    const abilities = fighter?.abilities;
    
    // Handle parsed object structure first (most common after abilities are parsed)
    if (abilities && typeof abilities === "object" && !Array.isArray(abilities)) {
      if (abilities?.movement?.flight?.mphSpeed) {
        return abilities.movement.flight.mphSpeed;
      }
      return 0;
    }
    
    // Handle array of strings (raw abilities from bestiary)
    if (Array.isArray(abilities)) {
      for (const a of abilities) {
        const s = String(a || "");
        // matches: "Fly 30 mph", "Fly: 30 mph", "Fly 45mph"
        const m = s.match(/fly[^0-9]*([\d.]+)\s*mph/i);
        if (m) {
          const mph = Number(m[1]);
          if (!Number.isNaN(mph) && mph > 0) return mph;
        }
      }
    }
    
    return 0;
  }, []);

  const estimateGroundMphFromSpd = useCallback((fighter) => {
    // Palladium: Speed attribute × 18 = feet per melee (15 seconds)
    // mph = (ft/melee) / 22 (since 1 mph ≈ 22 ft per 15 sec)
    const spd = Number(fighter?.attributes?.Spd ?? fighter?.Spd ?? fighter?.spd ?? 0);
    if (!spd || Number.isNaN(spd)) return 0;
    const ftPerMelee = spd * 18;
    return ftPerMelee / 22;
  }, []);

  // Palladium-ish conversion:
  // mph → feet per melee (15 sec): mph * 22 feet per 15 sec  (since 1 mph ≈ 22 ft / 15 sec)
  const getFighterFlySpeedFeetPerMelee = useCallback((fighter) => {
    const mph = parseFlyMphFromAbilities(fighter);
    if (!mph) return 0;
    return Math.round(mph * 22);
  }, [parseFlyMphFromAbilities]);

  const getFighterGroundFeetPerAction = useCallback((fighter) => {
    // Your movement system generally uses: speed attribute = feet per action for "Move" baseline.
    // Many places treat Spd as feet per action in grid movement.
    const spd = Number(fighter?.attributes?.Spd ?? fighter?.Spd ?? fighter?.spd ?? 0);
    if (!spd || Number.isNaN(spd)) return 0;
    return spd;
  }, []);

  const getFighterFlyFeetPerAction = useCallback((fighter) => {
    // Convert fly ft/melee into per-action using the fighter's attacks/melee
    const ftPerMelee = getFighterFlySpeedFeetPerMelee(fighter);
    if (!ftPerMelee) return 0;
    const apm = Number(fighter?.attacksPerMelee ?? fighter?.attacks ?? fighter?.actionsPerMelee ?? 0) || 0;
    if (!apm) return 0;
    return Math.max(1, Math.floor(ftPerMelee / apm));
  }, [getFighterFlySpeedFeetPerMelee]);

  const getPreferredMovementModeForAI = useCallback((fighter, contextTarget = null) => {
    // Only prefer flight if the creature can fly at all
    if (!canFighterFly(fighter)) return "ground";

    // Hard override: if already airborne, stay in flight mode
    if (isFlying(fighter) && (getAltitude(fighter) || 0) > 0) return "flight";

    // Hard override: if target is airborne, prefer flight for pursuit (pairs with air-chase)
    if (contextTarget && isFlying(contextTarget) && (getAltitude(contextTarget) || 0) > 0) return "flight";

    // IMPORTANT: Don't auto-prefer flight just because it's faster if we're melee-only and the target is grounded.
    // Otherwise AI will take off, then refuse to engage forever due to melee reachability checks at altitude.
    try {
      const targetAlt = contextTarget ? (getAltitude(contextTarget) || 0) : 0;
      const targetGrounded = !contextTarget || !isFlying(contextTarget) || targetAlt <= 5;
      if (targetGrounded) {
        const weaponCandidates = [];
        if (Array.isArray(fighter?.equippedWeapons) && fighter.equippedWeapons.length > 0) {
          weaponCandidates.push(...fighter.equippedWeapons);
        } else if (fighter?.equipped) {
          if (fighter.equipped.weaponPrimary) weaponCandidates.push(fighter.equipped.weaponPrimary);
          if (fighter.equipped.weaponSecondary) weaponCandidates.push(fighter.equipped.weaponSecondary);
        }
        // As a last resort, also consider attack entries (some creatures store natural attacks here).
        if (Array.isArray(fighter?.attacks) && fighter.attacks.length > 0) {
          weaponCandidates.push(...fighter.attacks);
        }
        const hasRangedOption = weaponCandidates.some((w) => {
          const name = String(w?.name || "").toLowerCase();
          const type = String(w?.type || "").toLowerCase();
          const rangeVal = w?.range;
          const rangeNum = typeof rangeVal === "number" ? rangeVal : Number(rangeVal);
          return (
            type === "ranged" ||
            name.includes("bow") ||
            name.includes("crossbow") ||
            name.includes("sling") ||
            name.includes("thrown") ||
            (Number.isFinite(rangeNum) && rangeNum > 10)
          );
        });
        if (!hasRangedOption) return "ground";
      }
    } catch {
      // ignore and fall back to speed heuristic
    }

    const flyPerAction = getFighterFlyFeetPerAction(fighter);
    const groundPerAction = getFighterGroundFeetPerAction(fighter);

    // If we can't compute fly/action, don't force flight
    if (!flyPerAction) return "ground";

    // Prefer flight only if meaningfully faster (avoids mode flipping for tiny gains)
    const ratio = groundPerAction > 0 ? flyPerAction / groundPerAction : 999;
    return ratio >= 1.25 ? "flight" : "ground";
  }, [getFighterFlyFeetPerAction, getFighterGroundFeetPerAction]);

  // Helpers for movement UI
  const canFlyNow = currentFighter && currentFighter.type === "player" && canFighterFly(currentFighter);
  const speciesProfile = currentFighter ? getSpeciesProfile(currentFighter) : null;
  const isFloatOnly = !!speciesProfile && (speciesProfile.movementMode === "float" || speciesProfile.usesGroundRun === false);

  // Decide what label to show on the Move button
  let moveLabel = "🚶 Move";
  let moveTitle = !showTacticalMap
    ? "Show tactical map first to enable movement"
    : "Click to activate movement mode";

  if (currentFighter && currentFighter.type === "player") {
    if (isFloatOnly) {
      moveLabel = "🌀 Move (Float)";
      moveTitle = "This creature moves by floating/flying; it does not run on the ground.";
    } else if (canFlyNow) {
      if (playerMovementMode === "flight") {
        moveLabel = "🪽 Move (Fly)";
        moveTitle = "Move by flying using aerial movement rules.";
      } else {
        moveLabel = "🚶 Move (Run)";
        moveTitle = "Move on the ground using normal running rules.";
      }
    }
  }

  const actionOptions = useMemo(() => {
    const hasPsionicOptions = availablePsionicPowers.length > 0;
    const hasSpellOptions = availableSpells.length > 0;
    const fighterCanFly = currentFighter && canFighterFly(currentFighter);
    const fighterIsFlying = currentFighter && isFlying(currentFighter);

    const baseOptions = [
      { value: "Strike", label: "⚔️ Strike" },
      { value: "Parry", label: "🛡️ Parry" },
      { value: "Dodge", label: "🎯 Dodge" },
      { value: "Brace", label: "⚔️ Brace (vs Charge)" },
      { value: "Run", label: "🏃 Run" },
      { value: "Defend/Hold", label: "🛡️ Defend" },
      { value: "Light Rest", label: "😮‍💨 Catch Breath (Light Rest)" },
      { value: "Full Rest", label: "🧘 Full Rest" },
      { value: "Combat Maneuvers", label: "⚔️ Maneuver" },
      { value: "Use Skill", label: "🛠️ Use Skill" },
      { value: "Hide", label: "👤 Hide / Prowl" },
    ];

    // Add flight actions if fighter can fly
    if (fighterCanFly) {
      if (!fighterIsFlying) {
        baseOptions.push({ value: "Fly", label: "🪽 Fly (Take Off)" });
      } else {
        baseOptions.push({ value: "Land", label: "🛬 Land" });
        baseOptions.push({ value: "Change Altitude", label: "⬆️⬇️ Change Altitude" });
        baseOptions.push({ value: "Dive Attack", label: "🦅 Dive Attack" });
        
        // Add carry/drop if grappling or carrying
        if (
          (currentFighter.grappleState?.state === GRAPPLE_STATES.GROUND ||
           currentFighter.grappleState?.state === GRAPPLE_STATES.CLINCH) &&
          currentFighter.grappleState?.opponent
        ) {
          baseOptions.push({ value: "Lift & Carry", label: "✈️ Lift & Carry" });
        }
        if (currentFighter.isCarrying && currentFighter.carriedTargetId) {
          baseOptions.push({ value: "Drop Target", label: "💥 Drop Target" });
        }
      }
    }

    if (hasPsionicOptions) {
      baseOptions.push({ value: "Psionics", label: "🧠 Psionics" });
    }
    if (hasSpellOptions) {
      baseOptions.push({ value: "Spells", label: "🔮 Spells" });
    }

    return baseOptions;
  }, [availablePsionicPowers, availableSpells, currentFighter]);

useEffect(() => {
  if (
    selectedPsionicPower &&
    !availablePsionicPowers.some((power) => power?.name === selectedPsionicPower.name)
  ) {
    setSelectedPsionicPower(null);
  }
}, [availablePsionicPowers, selectedPsionicPower]);

useEffect(() => {
  if (selectedSpell && !availableSpells.some((spell) => spell?.name === selectedSpell.name)) {
    setSelectedSpell(null);
  }
}, [availableSpells, selectedSpell]);

  const PSIONIC_ENEMY_TYPES = useMemo(
    () => new Set(["ranged", "mental", "melee", "attack", "offense"]),
    []
  );
  const PSIONIC_SELF_TYPES = useMemo(
    () => new Set(["self", "passive"]),
    []
  );
  const PSIONIC_ALLY_TYPES = useMemo(
    () => new Set(["buff", "defense", "support", "healing", "utility", "movement"]),
    []
  );

  // spellRequiresTarget is now imported from spellUtils.js

  const getPsionicTargetCategory = useCallback(
    (power) => {
      if (!power) return "enemy";
      const type = (power.attackType || "").toLowerCase();
      if (PSIONIC_SELF_TYPES.has(type)) return "self";
      if (PSIONIC_ALLY_TYPES.has(type)) {
        if ((power.range || "").toLowerCase().includes("self")) {
          return "self";
        }
        return "ally";
      }
      if (PSIONIC_ENEMY_TYPES.has(type)) return "enemy";
      if ((power.range || "").toLowerCase().includes("self")) return "self";
      return "enemy";
    },
    [PSIONIC_ALLY_TYPES, PSIONIC_ENEMY_TYPES, PSIONIC_SELF_TYPES]
  );

  const getTargetOptionsForAction = useCallback(
    (actionName) => {
      if (!actionName || !currentFighter) return [];
      switch (actionName) {
        case "Strike":
        case "Combat Maneuvers":
        case "Dive Attack":
          return fighters.filter(
            (f) =>
              f.type !== currentFighter.type &&
              f.status !== "defeated" &&
              getFighterHP(f) > MIN_COMBAT_HP
          );
        case "Psionics": {
          if (!selectedPsionicPower) return [];
          const category = getPsionicTargetCategory(selectedPsionicPower);
          if (category === "self") return [currentFighter];
          if (category === "ally") {
            return fighters.filter(
              (f) =>
                f.type === currentFighter.type &&
                f.status !== "defeated" &&
                getFighterHP(f) > MIN_COMBAT_HP
            );
          }
          return fighters.filter(
            (f) =>
              f.type !== currentFighter.type &&
              f.status !== "defeated" &&
              getFighterHP(f) > MIN_COMBAT_HP
          );
        }
        case "Spells": {
          if (!selectedSpell || !spellRequiresTarget(selectedSpell)) return [];
          const range = (selectedSpell.range || "").toLowerCase();
          const isSelf = range.includes("self");
          if (isSelf) return [currentFighter];
          if (range.includes("touch") || range.includes("ally")) {
            return fighters.filter(
              (f) =>
                f.type === currentFighter.type &&
                f.status !== "defeated" &&
                getFighterHP(f) > MIN_COMBAT_HP
            );
          }
          return fighters.filter(
            (f) =>
              f.type !== currentFighter.type &&
              f.status !== "defeated" &&
              getFighterHP(f) > MIN_COMBAT_HP
          );
        }
        case "Clerical Abilities": {
          if (!selectedClericalAbility) return [];
          
          const abilityName = selectedClericalAbility.name;
          
          // Animate Dead: targets are dead bodies (HP <= -21)
          if (abilityName === "Animate Dead") {
            return fighters.filter(f => isDead(f) && positions[f.id]);
          }
          
          // Turn Dead: targets are undead enemies
          if (abilityName === "Turn Dead") {
            return fighters.filter(f => 
              f.id !== currentFighter.id && 
              isUndead(f) && 
              positions[f.id] &&
              f.status !== "defeated"
            );
          }
          
          // Exorcism: targets are demons, spirits, or possessed entities
          if (abilityName === "Exorcism") {
            return fighters.filter(f => {
              if (f.id === currentFighter.id || !positions[f.id] || f.status === "defeated") return false;
              const targetType = (f.type || f.category || f.species || "").toLowerCase();
              return targetType.includes("demon") || 
                     targetType.includes("devil") || 
                     targetType.includes("spirit") || 
                     targetType.includes("ghost") || 
                     targetType.includes("wraith") ||
                     f.possessed ||
                     f.possessingEntity;
            });
          }
          
          // Remove Curse: targets are cursed characters
          if (abilityName === "Remove Curse") {
            return fighters.filter(f => 
              f.id !== currentFighter.id && 
              positions[f.id] &&
              (f.cursed || f.hasCurse || (Array.isArray(f.statusEffects) && f.statusEffects.includes("CURSED")))
            );
          }
          
          // Healing Touch: targets are living allies (not undead, not self)
          if (abilityName === "Healing Touch") {
            return fighters.filter(f => 
              f.id !== currentFighter.id &&
              f.type === currentFighter.type &&
              positions[f.id] &&
              !isUndead(f) &&
              f.status !== "defeated"
            );
          }
          
          return [];
        }
        case "Lift & Carry": {
          const oppId = currentFighter?.grappleState?.opponent;
          if (!oppId) return [];
          const opp = fighters.find((f) => f.id === oppId);
          return opp && opp.status !== "defeated" && getFighterHP(opp) > MIN_COMBAT_HP ? [opp] : [];
        }
        default:
          return [];
      }
    },
    [currentFighter, fighters, selectedPsionicPower, selectedSpell, selectedClericalAbility, positions, getPsionicTargetCategory, spellRequiresTarget, MIN_COMBAT_HP]
  );

  useEffect(() => {
    if (!currentFighter) return;
    if (selectedAction?.name !== "Psionics" || !selectedPsionicPower) return;

    const category = getPsionicTargetCategory(selectedPsionicPower);
    const options = getTargetOptionsForAction("Psionics");

    if (category === "self") {
      if (!selectedTarget || selectedTarget.id !== currentFighter.id) {
        setSelectedTarget(currentFighter);
      }
      return;
    }

    if (options.length === 0) {
      setSelectedTarget(null);
      return;
    }

    const stillValid = selectedTarget && options.some((opt) => opt.id === selectedTarget.id);
    if (!stillValid) {
      setSelectedTarget(options[0]);
    }
  }, [selectedPsionicPower, selectedAction, currentFighter, fighters, selectedTarget, getTargetOptionsForAction, getPsionicTargetCategory]);

  useEffect(() => {
    if (!currentFighter) return;
    if (selectedAction?.name !== "Clerical Abilities" || !selectedClericalAbility) return;
    
    const abilityName = selectedClericalAbility.name;
    const requiresTarget = abilityName !== "Animate Dead"; // Animate Dead doesn't need target selection
    
    if (!requiresTarget) {
      setSelectedTarget(null);
      return;
    }
    
    const options = getTargetOptionsForAction("Clerical Abilities");
    if (!options || options.length === 0) {
      setSelectedTarget(null);
      return;
    }
    
    const stillValid = selectedTarget && options.some((opt) => opt.id === selectedTarget.id);
    if (!stillValid) {
      setSelectedTarget(options[0]);
    }
  }, [selectedClericalAbility, selectedAction, currentFighter, fighters, selectedTarget, getTargetOptionsForAction]);

  useEffect(() => {
    if (!currentFighter) return;
    if (selectedAction?.name !== "Spells" || !selectedSpell) return;

    if (!spellRequiresTarget(selectedSpell)) {
      setSelectedTarget(null);
      return;
    }

    const options = getTargetOptionsForAction("Spells");
    if (!options || options.length === 0) {
      setSelectedTarget(null);
      return;
    }

    const stillValid = selectedTarget && options.some((opt) => opt.id === selectedTarget.id);
    if (!stillValid) {
      setSelectedTarget(options[0]);
    }
  }, [selectedSpell, selectedAction, currentFighter, fighters, selectedTarget, getTargetOptionsForAction, spellRequiresTarget]);

  const targetOptions = useMemo(
    () => getTargetOptionsForAction(selectedAction?.name),
    [selectedAction?.name, getTargetOptionsForAction]
  );

  // Get available grapple actions based on current state
  const getAvailableGrappleActions = useCallback((fighter, target) => {
    if (!fighter || !target) return [];
    
    const grappleStatus = getGrappleStatus(fighter);
    const targetGrappleStatus = getGrappleStatus(target);
    const actions = [];
    
    // If both are neutral, can attempt grapple
    if (grappleStatus.state === GRAPPLE_STATES.NEUTRAL && targetGrappleStatus.state === GRAPPLE_STATES.NEUTRAL) {
      actions.push({ value: 'grapple', label: '🤼 Attempt Grapple' });
      return actions;
    }
    
    // Check if in a clinch
    const inClinch = grappleStatus.state === GRAPPLE_STATES.CLINCH && 
                     targetGrappleStatus.state === GRAPPLE_STATES.CLINCH &&
                     grappleStatus.opponent === target.id &&
                     targetGrappleStatus.opponent === fighter.id;
    
    if (inClinch) {
      // Check who is the grappler (isAttacker)
      const fighterGrappleState = fighter.grappleState || {};
      const isGrappler = fighterGrappleState.isAttacker === true;
      
      if (isGrappler) {
        // Grappler actions
        actions.push({ value: 'takedown', label: '⬇️ Takedown/Trip' });
        actions.push({ value: 'groundStrike', label: '🗡️ Ground Strike' });
        actions.push({ value: 'grapplerPushOff', label: '👊 Push Off (Break)' });
      } else {
        // Defender actions
        actions.push({ value: 'defenderPushBreak', label: '💪 Push Break' });
        actions.push({ value: 'defenderReversal', label: '🔄 Reversal (Take Control)' });
        actions.push({ value: 'breakFree', label: '🏃 Break Free' });
      }
    }
    
    // If fighter is grappling on ground
    if (grappleStatus.state === GRAPPLE_STATES.GROUND) {
      actions.push({ value: 'maintain', label: '🔒 Maintain Grapple' });
      actions.push({ value: 'groundStrike', label: '🗡️ Ground Strike' });
    }
    
    // If fighter is pinned
    if (grappleStatus.state === GRAPPLE_STATES.GRAPPLED) {
      if (!inClinch) {
        actions.push({ value: 'breakFree', label: '💪 Break Free' });
        actions.push({ value: 'groundStrike', label: '🗡️ Ground Strike' });
      }
    }
    
    // If target is pinned
    if (targetGrappleStatus.state === GRAPPLE_STATES.GRAPPLED) {
      if (!actions.find(a => a.value === 'groundStrike')) {
        actions.push({ value: 'groundStrike', label: '🗡️ Ground Strike' });
      }
    }
    
    return actions;
  }, [getGrappleStatus, GRAPPLE_STATES]);

  const shouldShowTargetDropdown = useMemo(() => {
    if (!selectedAction) return false;
    if (!targetOptions || targetOptions.length === 0) return false;
    const actionName = selectedAction.name;
    if (!["Strike", "Combat Maneuvers", "Psionics", "Spells", "Dive Attack", "Clerical Abilities"].includes(actionName)) {
      return false;
    }
    // For Clerical Abilities, only show target dropdown if ability requires a target
    if (actionName === "Clerical Abilities" && selectedClericalAbility) {
      const abilityName = selectedClericalAbility.name;
      if (abilityName === "Animate Dead") {
        return false; // Animate Dead doesn't need target selection
      }
    }
    if (
      currentFighter &&
      targetOptions.length === 1 &&
      targetOptions[0].id === currentFighter.id
    ) {
      return false;
    }
    return true;
  }, [selectedAction, targetOptions, currentFighter, selectedClericalAbility]);

  // Check if a hex is occupied by any LIVING combatant
  const isHexOccupied = useCallback((x, y, excludeId = null) => {
    for (const [id, pos] of Object.entries(positions)) {
      if (id === excludeId) continue; // Don't check against self
      
      const combatant = fighters.find(f => f.id === id);
      if (combatant) {
        // Only check living combatants - defeated enemies don't block movement
        if (pos.x === x && pos.y === y && combatant.status !== "defeated") {
          return combatant; // Return the occupying combatant
        }
      }
    }
    return null;
  }, [positions, fighters]);

  // Apply pending movements when turn starts
  useEffect(() => {
    if (fighters.length > 0 && turnIndex >= 0) {
      const currentFighter = fighters[turnIndex];
      
      // Clear processing flag when turn changes
      processingEnemyTurnRef.current = false;
      
      // Clear flashing for the CURRENT fighter only (they've completed their turn)
      if (currentFighter) {
        setFlashingCombatants(prev => {
          const newSet = new Set(prev);
          newSet.delete(currentFighter.id);
          return newSet;
        });
      }
      
      // Clear the "just created" set from previous turn
      justCreatedPendingMovementRef.current = new Set();
      
      if (currentFighter && pendingMovements[currentFighter.id]) {
        const pendingMove = pendingMovements[currentFighter.id];
        
        console.log('⏰ Checking pending movement for', currentFighter.name, 'at turnCounter', turnCounter);
        console.log('   Created at turn:', pendingMove.createdAtTurn, 'Current turn counter:', turnCounter);
        
        // DON'T apply if this movement was just created this turn (need to wait for NEXT turn)
        if (pendingMove.createdAtTurn === turnCounter) {
          console.log('⏸️ Skipping - movement was just created this turn (counter match), will apply next turn');
          return; // Don't apply yet, wait for next turn
        }
        
        console.log('✅ Applying pending movement - different turn counter');

        
        // Check if destination is occupied before applying
        const occupant = isHexOccupied(pendingMove.newPosition.x, pendingMove.newPosition.y, currentFighter.id);
        if (occupant) {
          addLog(`🚫 ${currentFighter.name} cannot arrive at (${pendingMove.newPosition.x}, ${pendingMove.newPosition.y}) - occupied by ${occupant.name}`, "info");
          addLog(`➡️ ${currentFighter.name} stays at current position`, "info");
        } else {
          // Apply the pending movement
          setPositions(prev => {
            const updated = {
              ...prev,
              [currentFighter.id]: pendingMove.newPosition
            };
            positionsRef.current = updated;
            return updated;
          });
          
          addLog(`➡️ ${currentFighter.name} arrives at position (${pendingMove.newPosition.x}, ${pendingMove.newPosition.y}) after ${pendingMove.movementType}`, "info");
        }
        
        // Clear the pending movement either way
        setPendingMovements(prev => {
          const updated = { ...prev };
          delete updated[currentFighter.id];
          return updated;
        });
      }
    }
  }, [turnIndex, turnCounter, fighters, pendingMovements, addLog, isHexOccupied]);

  // Handle clicking on defeated combatants to show loot window
  useEffect(() => {
    if (selectedCombatantId) {
      const selectedFighter = fighters.find(f => f.id === selectedCombatantId);
      
      if (selectedFighter) {
        // Check if fighter is defeated (dead, unconscious, or HP <= 0)
        const isDefeated = 
          selectedFighter.isDead || 
          selectedFighter.isKO || 
          (selectedFighter.currentHP ?? 0) <= 0 ||
          selectedFighter.status === "defeated";
        
        if (isDefeated) {
          // Generate loot from the defeated fighter
          const { loot } = lootPrisoner(selectedFighter);
          
          // Only show loot window if there's actually loot
          const hasLoot = 
            (loot.inventory?.length || 0) > 0 ||
            (loot.weapons?.length || 0) > 0 ||
            loot.armor !== null;
          
          if (hasLoot) {
            setSelectedLootSource(selectedFighter);
            setLootData(loot);
            setLootWindowOpen(true);
          } else {
            addLog(`💰 ${selectedFighter.name} has no loot.`, "info");
          }
        }
      }
      
      // Reset selection after handling
      setSelectedCombatantId(null);
    }
  }, [selectedCombatantId, fighters, addLog]);

  // Handler for enabling movement mode
  const activateMovementMode = useCallback(() => {
    if (currentFighter && currentFighter.type === "player") {
      setMovementMode({ active: true, isRunning: false });
      setSelectedMovementFighter(currentFighter.id);
      setShowMovementSelection(true); // Show movement selection UI
      addLog(`🚶 Select a highlighted hex to move ${currentFighter.name}`, "info");
    }
  }, [currentFighter, addLog]);
  // Define endTurn function with useCallback - MUST be before handleMoveSelect
  // PALLADIUM RAW: Alternating actions per initiative
  const endTurn = useCallback(() => {
    if (suppressEndTurnRef.current) {
      return;
    }
    // ✅ Always release any AI "in progress" locks when a turn actually ends
    pendingTurnAdvanceRef.current = false;
    processingEnemyTurnRef.current = false;
    processingPlayerAIRef.current = false;

    // ✅ CRITICAL: Stop processing if combat has ended
    if (!combatActive || combatEndCheckRef.current) {
      return;
    }
    
    clearScheduledTurn();

    // Clear movement attempts tracker for old turns (keep only current and previous turn)
    const currentTurnKey = turnCounter;
    Object.keys(movementAttemptsRef.current).forEach(key => {
      const turnNum = parseInt(key.split('-').pop());
      if (turnNum < currentTurnKey - 1) {
        delete movementAttemptsRef.current[key];
      }
    });
    
    // PALLADIUM RAW: Check if all fighters are out of actions (melee round complete)
    const fightersWithActions = fighters.filter(f => 
      canFighterAct(f) && (f.remainingAttacks || 0) > 0
    );
    
    if (fightersWithActions.length === 0) {
      // All fighters are out of actions - start new melee round
      // But only if combat is still active
      if (!combatActive || combatEndCheckRef.current) {
        return;
      }
      
      addLog(`⏰ Melee Round ${meleeRound} complete! Starting Round ${meleeRound + 1}...`, "combat");
      
      // ✅ Clear cast guard for new melee round (allows new casts in new round)
      combatCastGuardRef.current.clear();
      // ✅ Clear spell loop guard for new melee round (allows new spell casts)
      enemySpellLoopGuardRef.current.clear();
      // ✅ Reset "no actions remaining" pass-log guard each melee
      noActionsPassLogRef.current = new Set();
      
      // End of melee: clear last melee's temp courage bonuses
      clearCourageBonuses(fighters);
      
      // Reset all fighters' actions for new melee round
      // Also reset the "no ranged options" log flag for each fighter
      setFighters(prev => {
        const updated = prev.map(f => {
          // ✅ Tick down + clear status effects each melee
          // (needed so temporary effects like SHAKEN expire correctly)
          const withStatus = updateStatusEffects({ ...f }, meleeRound + 1);
          // Fix: Use proper fallback for animals (attacksPerMelee ?? attacks ?? 2)
          const apm = withStatus.attacksPerMelee ?? withStatus.attacks ?? 2; // fallback for animals
          const fighter = {
            ...withStatus,
            remainingAttacks: apm,
            spellsCastThisMelee: 0, // ✅ Reset spells cast counter for new melee round (RAW)
            // if you track "hasActedThisRound" etc, reset it here too
          };
          // Clear the loggedNoRangedRound flag for new melee round
          if (fighter.meta?.loggedNoRangedRound !== undefined) {
            fighter.meta = {
              ...fighter.meta,
              loggedNoRangedRound: undefined,
              loggedNoRangedOptions: false,
            };
          }
          return fighter;
        });
        
        // Check for stalemate: if neither side can hit the other
        const playerFighters = updated.filter(f => f.type === "player" && canFighterAct(f) && f.currentHP > 0);
        const enemyFighters = updated.filter(f => f.type === "enemy" && canFighterAct(f) && f.currentHP > 0);
        
        if (playerFighters.length > 0 && enemyFighters.length > 0) {
          // Check if players have any valid offensive options
          const playersCanAttack = playerFighters.some(player => 
            hasAnyValidOffensiveOption(player, enemyFighters)
          );
          
          // Check if enemies have any valid offensive options
          const enemiesCanAttack = enemyFighters.some(enemy => 
            hasAnyValidOffensiveOption(enemy, playerFighters)
          );
          
          // If neither side can attack, end combat as stalemate
          if (!playersCanAttack && !enemiesCanAttack) {
            addLog("⚠️ Neither side can attack the other (stalemate). Combat ends.", "warning");
            setCombatActive(false);
            combatEndCheckRef.current = true;
            return updated;
          }
        }
        
        // ✅ Start of new melee: apply courage/holy aura bonuses + fear dispel
        processCourageAuras(updated, positions, addLog);
        
        // ✅ Apply bio-regeneration for fighters with regeneration abilities
        // Note: applyBioRegeneration mutates the fighter object, so we need to create new objects for React state
        const currentMeleeRound = meleeRound; // Get current melee round for interval tracking
        const updatedWithRegen = updated.map(fighter => {
          const fighterCopy = { ...fighter };
          const regenResult = applyBioRegeneration(fighterCopy, currentMeleeRound);
          if (regenResult) {
            addLog(regenResult.log, "healing");
            // Return updated fighter with new HP and meta tracking
            return {
              ...fighterCopy,
              currentHP: fighterCopy.currentHP,
              hp: fighterCopy.currentHP,
              meta: fighterCopy.meta, // Preserve bioRegenLastMelee tracking
            };
          }
          return fighter;
        });
        
        return updatedWithRegen;
      });
      
      // Only continue if combat is still active
      if (!combatActive || combatEndCheckRef.current) {
        return;
      }
      
      setMeleeRound(prev => prev + 1);
      setTurnIndex(0); // Start from highest initiative again
      setTurnCounter(prev => prev + 1);
      
      // Clear processing flags for new round (only if combat is still active)
      if (combatActive && !combatEndCheckRef.current) {
        combatEndCheckRef.current = false;
        lastProcessedEnemyTurnRef.current = null;
        processingPlayerAIRef.current = false;
        lastOpenedChoicesTurnRef.current = null;
      }
      
      return;
    }
    
    // PALLADIUM RAW: Move to next fighter in initiative order (wrapping around)
    // Find next active fighter with actions remaining, in initiative order
    let nextIndex = (turnIndex + 1) % fighters.length;
    let attempts = 0;
    let foundNext = false;
    
    // Loop through fighters in initiative order until we find one with actions
    while (attempts < fighters.length) {
      const nextFighter = fighters[nextIndex];
      if (nextFighter && canFighterAct(nextFighter) && (nextFighter.remainingAttacks || 0) > 0) {
        foundNext = true;
        break; // Found a fighter that can act and has actions
      }
      nextIndex = (nextIndex + 1) % fighters.length;
      attempts++;
    }
    
    // If no fighter found with actions, start new melee round (shouldn't happen due to check above, but safety)
    if (!foundNext) {
      // Only start new round if combat is still active
      if (!combatActive || combatEndCheckRef.current) {
        return;
      }
      
      addLog(`⏰ All fighters out of actions - starting new melee round`, "combat");
      setFighters(prev => prev.map(f => ({
        ...f,
        remainingAttacks: f.attacksPerMelee || 2
      })));
      setMeleeRound(prev => prev + 1);
      setTurnIndex(0);
      setTurnCounter(prev => prev + 1);
      return;
    }
    
    // NOTE: We do NOT reset remainingAttacks here - actions persist across the melee round
    // Each fighter keeps their remainingAttacks until the melee round completes
    
    // ✅ CRITICAL: Only reset combat end check flag if combat is still active
    // Don't reset if combat has ended (prevents further action processing)
    if (combatActive && !combatEndCheckRef.current) {
      // Reset flag only if combat is active and hasn't ended
      // (combatEndCheckRef.current will be true if victory/defeat was declared)
    }
    
    // Clear the last processed enemy turn ref when action changes
    lastProcessedEnemyTurnRef.current = null;
    
    // Clear player AI processing flag when action changes (allows next player to act)
    processingPlayerAIRef.current = false;
    
    // Clear last opened choices ref to allow new player action to process
    lastOpenedChoicesTurnRef.current = null;
    
    // Clear temporary modifiers for the fighter ending their action
    const currentFighterId = fighters[turnIndex]?.id;
    if (currentFighterId) {
      setTempModifiers(prev => {
        const updated = { ...prev };
        delete updated[currentFighterId];
        return updated;
      });

      // Reset temporary hex sharing position
      if (temporaryHexSharing[currentFighterId]) {
        const tempPos = temporaryHexSharing[currentFighterId];
        addLog(`↩️ ${fighters[turnIndex]?.name} returns to original position (${tempPos.originalPos.x}, ${tempPos.originalPos.y})`, "info");
        
        setPositions(prev => {
          const updated = {
            ...prev,
            [currentFighterId]: tempPos.originalPos
          };
          positionsRef.current = updated;
          return updated;
        });

        setTemporaryHexSharing(prev => {
          const updated = { ...prev };
          delete updated[currentFighterId];
          return updated;
        });
      }
    }
    
    setTurnIndex(nextIndex);
    setTurnCounter(prev => prev + 1); // Increment absolute action counter
    
    // Clear action execution lock when turn changes
    executingActionRef.current = false;
    
    // Clean up old visibility/AI log entries when turn changes (keep only recent ones)
    if (visibilityLogRef.current.size > 200) {
      const entries = Array.from(visibilityLogRef.current);
      visibilityLogRef.current = new Set(entries.slice(-100));
    }
  }, [fighters, turnIndex, temporaryHexSharing, addLog, meleeRound, turnCounter, clearScheduledTurn, canFighterAct, combatActive]);

  // Collapse-from-exhaustion check at the start of a fighter's turn
  useEffect(() => {
    if (!fighters.length || turnIndex < 0) return;

    const currentFighter = fighters[turnIndex];
    if (!currentFighter || !currentFighter.fatigueState) return;
    
    // Skip collapse checks for creatures that can't fatigue
    if (!canFatigue(currentFighter)) return;

    const fatigue = getFatigueStatus(currentFighter);

    // 1) If they are already collapsed, tick down collapseRoundsRemaining
    if (currentFighter.fatigueState.status === "collapsed") {
      const remaining = currentFighter.fatigueState.collapseRoundsRemaining ?? 0;

      if (remaining > 0) {
        // Decrement remaining melees and keep them down
        setFighters(prev =>
          prev.map(f =>
            f.id === currentFighter.id
              ? {
                  ...f,
                  fatigueState: {
                    ...f.fatigueState,
                    collapseRoundsRemaining: remaining - 1,
                  },
                }
              : f
          )
        );

        addLog(
          `💤 ${currentFighter.name} is collapsed from exhaustion (${remaining - 1} melees remaining).`,
          "status"
        );

        // Their turn effectively does nothing - skip to next fighter
        setTimeout(() => {
          endTurn();
        }, 1000);
        return;
      }

      // They wake up this turn: switch them to "exhausted" with severe penalties
      // Stamina was already bumped to Severe threshold (-15) when they collapsed
      setFighters(prev =>
        prev.map(f => {
          if (f.id === currentFighter.id) {
            const updatedFighter = {
              ...f,
              fatigueState: {
                ...f.fatigueState,
                status: "exhausted",
                fatigueLevel: 3,
                collapseRoundsRemaining: 0,
                // Preserve currentStamina (should be at Severe threshold from collapse)
                // updateFatiguePenalties will recalculate penalties based on this
              },
            };
            // Update penalties after status change (will set correct penalties for -15 stamina)
            updateFatiguePenalties(updatedFighter);
            return updatedFighter;
          }
          return f;
        })
      );

      addLog(
        `😓 ${currentFighter.name} staggers back to their feet, still exhausted.`,
        "status"
      );

      return;
    }

    // 2) If they are in the risk band, roll the collapse check
    if (fatigue.status === "collapse_risk") {
      const stamina = currentFighter.fatigueState.currentStamina;
      const { collapsed, roll, target, durationMelees, newStamina } =
        resolveCollapseFromExhaustion(currentFighter, stamina);

      if (collapsed) {
        // Update fighter to fully collapsed
        setFighters(prev =>
          prev.map(f =>
            f.id === currentFighter.id
              ? {
                  ...f,
                  fatigueState: {
                    ...f.fatigueState,
                    status: "collapsed",
                    currentStamina: newStamina,
                    collapseRoundsRemaining: durationMelees,
                    penalties: {
                      strike: -5,
                      parry: -5,
                      dodge: -5,
                      ps: 0,
                      speed: 0,
                    },
                  },
                }
            : f
          )
        );

        addLog(
          `⚠️ ${currentFighter.name} collapses from exhaustion! (rolled ${roll} vs P.E. ${target})`,
          "warning"
        );

        // Their turn is basically a no-op now - skip to next fighter
        setTimeout(() => {
          endTurn();
        }, 1000);
        return;
      } else {
        // They stay up but are in bad shape; keep them in collapse_risk
        setFighters(prev =>
          prev.map(f =>
            f.id === currentFighter.id
              ? {
                  ...f,
                  fatigueState: {
                    ...f.fatigueState,
                    status: "collapse_risk",
                    currentStamina: newStamina,
                  },
                }
            : f
          )
        );

        addLog(
          `😣 ${currentFighter.name} nearly collapses from exhaustion (rolled ${roll} vs P.E. ${target}) but stays on their feet.`,
          "status"
        );
      }
    }
  }, [fighters, turnIndex, addLog, endTurn]);

  // Auto-set default movement mode when fighter or target changes
  useEffect(() => {
    if (!currentFighter || !selectedTarget) {
      // If no target, default to ground
      setPlayerMovementMode('ground');
      return;
    }

    const mode = getDefaultMovementMode(currentFighter, selectedTarget, {
      fighters,
      positions,
    });

    setPlayerMovementMode(mode);
  }, [currentFighter, selectedTarget, fighters, positions]);

  const scheduleEndTurn = useCallback(
    (delayOverride = null) => {
      if (suppressEndTurnRef.current) {
        return;
      }
      // ✅ GUARD: Stop scheduling if combat is over (use ref for latest state)
      if (combatOverRef.current || !combatActive || combatEndCheckRef.current || combatPausedRef.current) {
        clearScheduledTurn();
        pendingTurnAdvanceRef.current = false;
        return;
      }

      const tryEndTurn = () => {
        if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
          pendingTurnAdvanceRef.current = false;
          return;
        }
        if (isActionBusy()) {
          requestAnimationFrame(tryEndTurn);
          return;
        }
        pendingTurnAdvanceRef.current = true;
        endTurn();
      };

      const delay = typeof delayOverride === "number" ? delayOverride : getActionDelay();

      if (delay <= 0) {
        clearScheduledTurn();
        // ✅ GUARD: Check combat state before ending turn (use ref for latest state)
        if (combatOverRef.current || !combatActive || combatEndCheckRef.current) return;
        tryEndTurn();
        return;
      }

      clearScheduledTurn();
      pendingTurnAdvanceRef.current = true;
      turnTimeoutRef.current = setTimeout(() => {
        turnTimeoutRef.current = null;
        // ✅ GUARD: Check combat state in delayed callback (use ref for latest state)
        if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
          pendingTurnAdvanceRef.current = false;
          return;
        }
        tryEndTurn();
      }, delay);
      
      // ✅ Track this timeout so we can clear it on combat end
      allTimeoutsRef.current.push(turnTimeoutRef.current);
    },
    [clearScheduledTurn, getActionDelay, endTurn, combatActive, isActionBusy]
  );

  // Helper function for player flight movement
  const handlePlayerFlightMove = useCallback(async (fighter, targetHex, oldPos, selectedMove) => {
    if (!fighter) return;

    const currentAlt = fighter.altitudeFeet ?? fighter.altitude ?? 0;
    const minCruiseAlt = 10;

    // Take off if not already flying
    if (!fighter.isFlying || currentAlt <= 0) {
      const updatedFighter = { ...fighter };
      startFlying(updatedFighter, {
        fighters,
        positions,
        setFighters,
        setPositions,
        addLog,
      });
      
      // Update fighter state
      setFighters(prev => prev.map(f => 
        f.id === fighter.id ? updatedFighter : f
      ));
      
      addLog(`🦅 ${fighter.name} takes off into the air!`, "info");
      
      // Ensure minimum cruising altitude
      if ((updatedFighter.altitudeFeet ?? 0) < minCruiseAlt) {
        changeAltitude(updatedFighter, minCruiseAlt - (updatedFighter.altitudeFeet ?? 0), {
          fighters,
          positions,
          setFighters,
          setPositions,
          addLog,
        });
      }
    }

    // Move horizontally to target hex
    setPositions(prev => {
      const updated = {
        ...prev,
        [fighter.id]: { x: targetHex.x, y: targetHex.y }
      };
      positionsRef.current = updated;
      return updated;
    });

    const moveDistance = oldPos ? calculateDistance(oldPos, targetHex) : 5;
    const altitudeFeet = Math.max(
      minCruiseAlt,
      fighter.altitudeFeet ?? fighter.altitude ?? minCruiseAlt
    );
    enqueueMoveAnimation(
      fighter.id,
      { x: targetHex.x, y: targetHex.y, altitudeFeet },
      getMoveDurationMs(moveDistance)
    );
    suppressNextAnimationRef.current.add(fighter.id);

    // Update fighter position
    setFighters(prev => prev.map(f => {
      if (f.id === fighter.id) {
        return {
          ...f,
          position: { x: targetHex.x, y: targetHex.y },
          isFlying: true,
          altitudeFeet: Math.max(minCruiseAlt, f.altitudeFeet ?? minCruiseAlt),
        };
      }
      return f;
    }));
  }, [fighters, positions, setFighters, setPositions, addLog, enqueueMoveAnimation, getMoveDurationMs, calculateDistance]);

  // Handler for movement selection from TacticalMap
  const handleMoveSelect = useCallback((x, y) => {
    if (movementMode.active && selectedMovementFighter && positions[selectedMovementFighter]) {
      const oldPos = positions[selectedMovementFighter];
      
      // Additional safety check: verify this is a valid move and check action cost
      const combatant = fighters.find(f => f.id === selectedMovementFighter);
      let selectedMove = null;
      
      if (combatant) {
        // Check if combatant has enough action points
        if (combatant.remainingAttacks <= 0) {
          addLog(`⚠️ ${combatant.name} has no actions remaining!`, "error");
          return;
        }
        
        const speed = combatant.Spd || combatant.spd || combatant.attributes?.Spd || combatant.attributes?.spd || 10;
        const attacksPerMelee = combatant.attacksPerMelee || 1;
        const validPositions = getMovementRange(oldPos, speed, attacksPerMelee, {}, movementMode.isRunning);
        selectedMove = validPositions.find(pos => pos.x === x && pos.y === y);
        
        if (!selectedMove) {
          addLog(`❌ Invalid move! ${combatant.name} cannot reach (${x}, ${y})`, "error");
          return;
        }
        
        // Check if player has enough action points for this movement
        if (combatant.remainingAttacks < selectedMove.actionCost) {
          addLog(`❌ Not enough actions! ${combatant.name} needs ${selectedMove.actionCost} actions but only has ${combatant.remainingAttacks}`, "error");
          return;
        }
      }
      
      // Check if destination is occupied - allow "closing" for short weapons
      const occupant = isHexOccupied(x, y, selectedMovementFighter);
      const isClosingToMelee = occupant && occupant.type !== combatant.type;
      
      if (isClosingToMelee) {
        // Character is closing into melee range - temporarily occupy same hex
        const weaponRange = combatant.equippedWeapons?.find(w => w)?.range || 
                           (combatant.weapons?.length > 0 && getWeaponRange(combatant.weapons[0])) || 
                           5.5;
        
        if (weaponRange <= 5) {
          // Short weapon - allowed to close
          addLog(`⚔️ ${combatant.name} closes into melee with ${occupant.name} (temporarily occupying same hex)`, "info");
          
          // Store original position for reset
          setTemporaryHexSharing(prev => ({
            ...prev,
            [selectedMovementFighter]: {
              originalPos: oldPos,
              targetHex: { x, y },
              targetCharId: occupant.id,
              turnCreated: turnCounter
            }
          }));
          
          // Update position to enemy's hex
          setPositions(prev => {
            const updated = {
            ...prev,
            [selectedMovementFighter]: { x, y }
            };
            positionsRef.current = updated;
            return updated;
          });
          
          // Enemy gets an attack of opportunity (free attack)
          addLog(`⚠️ ${occupant.name} gets an attack of opportunity against ${combatant.name}!`, "warning");
          
          // Store attack info for later execution after attack function is initialized
          const attackerForAoO = occupant;
          const targetForAoO = selectedMovementFighter;
          
          // Queue the attack of opportunity after a brief delay
          setTimeout(() => {
            addLog(`⚔️ ${attackerForAoO.name} makes attack of opportunity!`, "info");
            // Execute attack of opportunity - will be called via ref after attack is defined
            if (attackRef.current) {
              attackRef.current(attackerForAoO, targetForAoO, {});
            } else {
              addLog(`⚠️ Attack of opportunity delayed - attack function not ready`, "info");
              // Retry after a longer delay
              setTimeout(() => {
                if (attackRef.current) {
                  attackRef.current(attackerForAoO, targetForAoO, {});
                }
              }, 1000);
            }
          }, 500);
          
        } else {
          addLog(`❌ ${combatant.name} cannot close into melee - weapon range too long!`, "error");
          return;
        }
        } else {
        // Check if new position is off-board (fled/routed)
        const isOffBoard = 
          x < 0 || 
          y < 0 || 
          x >= GRID_CONFIG.GRID_WIDTH || 
          y >= GRID_CONFIG.GRID_HEIGHT;

        if (isOffBoard && combatant) {
          // Character has moved off-board - remove from combat
          const isBird = (combatant.species || combatant.name || "").toLowerCase().includes("hawk") ||
                        (combatant.species || combatant.name || "").toLowerCase().includes("bird") ||
                        (combatant.species || combatant.name || "").toLowerCase().includes("owl") ||
                        (combatant.species || combatant.name || "").toLowerCase().includes("eagle");
          
          if (isBird) {
            addLog(`🦅 ${combatant.name} flies away from the battle.`, "info");
          } else {
            addLog(`🏃 ${combatant.name} has fled the battlefield!`, "warning");
          }

          // Remove from fighters array
          setFighters((prev) => prev.filter((f) => f.id !== selectedMovementFighter));
          
          // Remove from positions
          setPositions((prev) => {
            const updated = { ...prev };
            delete updated[selectedMovementFighter];
            positionsRef.current = updated;
            return updated;
          });

          // End turn
          scheduleEndTurn(1500);
          return;
        }

        // Normal movement - check if this should be flight or ground
        const profile = getSpeciesProfile(combatant);
        const useFlight = playerMovementMode === 'flight' && canFighterFly(combatant);
        
        // Handle floaters (ghosts, elementals) - always use flight
        if (profile.movementMode === 'float' || profile.usesGroundRun === false) {
          // Floaters always move as "flight" even if not explicitly set
          handlePlayerFlightMove(combatant, { x, y }, oldPos, selectedMove);
        } else if (useFlight) {
          // Flight movement
          handlePlayerFlightMove(combatant, { x, y }, oldPos, selectedMove);
        } else {
          // Ground movement
          setPositions(prev => {
            const updated = {
            ...prev,
            [selectedMovementFighter]: { x, y }
            };
            positionsRef.current = updated;
            return updated;
          });
        }
      }
      
      // Deduct action points based on movement distance
      const actionCost = selectedMove ? selectedMove.actionCost : 1;
      
      // Calculate remaining attacks before updating state
      const remainingAfterMove = Math.max(0, combatant.remainingAttacks - actionCost);
      
      setFighters(prev => prev.map(f => {
        if (f.id === selectedMovementFighter) {
          const updatedFighter = { ...f, remainingAttacks: remainingAfterMove };
          addLog(`⏭️ ${f.name} used ${actionCost} action(s) for movement, ${remainingAfterMove} remaining this melee`, "info");
          return updatedFighter;
        }
        return f;
      }));
      
      const movementType = movementMode.isRunning ? "runs" : "moves";
      const actionText = actionCost > 1 ? ` (${actionCost} actions)` : "";
      const movementModeText = playerMovementMode === 'flight' ? "flies" : movementType;
      addLog(`🚶 ${currentFighter?.name} ${movementModeText} from (${oldPos.x}, ${oldPos.y}) to (${x}, ${y})${actionText}`, "info");
      
      // Clear movement mode
      setMovementMode({ active: false, isRunning: false });
      setShowMovementSelection(false); // Hide movement selection UI
      setSelectedMovementHex(null); // Clear selected movement hex
      setSelectedMovementFighter(null);
      
      // ALWAYS end turn after movement - this ensures alternating action system
      // endTurn() will cycle to the next fighter with actions remaining
      // If this fighter still has actions, they'll get another turn after others act
      if (remainingAfterMove <= 0) {
        addLog(`⏭️ ${combatant.name} has no actions remaining - will pass to next fighter in initiative order`, "info");
      } else {
        addLog(`🎮 ${combatant.name} has ${remainingAfterMove} action(s) remaining this melee round`, "info");
      }
      // Always end turn after movement to alternate actions
      scheduleEndTurn(500);
      }
  }, [movementMode, selectedMovementFighter, positions, currentFighter, addLog, fighters, isHexOccupied, getWeaponRange, turnCounter, endTurn, handlePlayerFlightMove, playerMovementMode]);

  // Enhanced attack validation with distance-based combat system
  const validateWeaponRange = useCallback((
    attacker,
    defender,
    attackData,
    distance,
    attackerPosOverride = null,
    defenderPosOverride = null
  ) => {
    const weaponName = String(attackData?.name || "Unarmed");
    const weaponNameLower = weaponName.toLowerCase();

    // ✅ Thrown/ranged fast-path:
    // Ensure thrown attacks never fall into melee validation logic.
    const isExplicitThrown =
      attackData?.isThrown === true ||
      attackData?.weaponType === "thrown" ||
      attackData?.category === "thrown" ||
      attackData?.attackMode === "thrown";
    // Name-based ranged detection (covers cases where attack entries omit range/type metadata)
    const isNameRanged =
      weaponNameLower.includes("bow") ||
      weaponNameLower.includes("crossbow") ||
      weaponNameLower.includes("sling");

    // Provide sane default ranges by name when metadata is missing (prevents 60ft fallback for bows)
    const impliedRangeByName =
      weaponNameLower.includes("long bow") || weaponNameLower === "longbow"
        ? 640
        : weaponNameLower.includes("short bow") || weaponNameLower === "shortbow"
          ? 360
          : weaponNameLower.includes("crossbow")
            ? 320
            : weaponNameLower.includes("sling")
              ? 160
              : null;

    const isExplicitRanged =
      attackData?.type === "ranged" ||
      attackData?.rangeCategory === "ranged" ||
      attackData?.isRanged === true ||
      isExplicitThrown ||
      isNameRanged ||
      (attackData?.range != null && Number(attackData.range) > 10) ||
      weaponNameLower.includes("thrown");
    if (isExplicitRanged) {
      const maxRange =
        Number(attackData?.range ?? attackData?.rangeFt ?? attackData?.rangeFeet ?? impliedRangeByName ?? 0) || 60;
      const canAttack = distance <= maxRange;
      return {
        canAttack,
        reason: canAttack
          ? `Within ranged range (${Math.round(distance)}ft ≤ ${maxRange}ft)`
          : `Out of ranged range (${Math.round(distance)}ft > ${maxRange}ft)`,
        maxRange,
        isUnreachable: false,
        requiresDive: false,
        rangeInfo: `ranged (${maxRange}ft)`,
      };
    }
    
    // ✅ Debug logging for Long Bow
    if (import.meta.env.DEV && weaponName?.toLowerCase() === "long bow") {
      console.log("DB getWeaponByName(Long Bow):", getWeaponByName("Long Bow"));
      console.log("DB weapons.find(Long Bow):", weapons.find(w => w.name?.toLowerCase() === "long bow"));
    }
    
    // Get positions early - needed for flexible reach weapons
    const attackerPos = attackerPosOverride || positions[attacker.id];
    const defenderPos = defenderPosOverride || positions[defender.id];
    
    // Check if target is currently flying (airborne) vs just having flight capability
    const targetIsFlying = isFlying(defender);
    const attackerCanFly = canFly(attacker);
    const attackerIsFlying = isFlying(attacker);
    const targetAltitude = getAltitude(defender) || 0;
    const attackerAltitude = getAltitude(attacker) || 0;
    const verticalSeparation = Math.abs(attackerAltitude - targetAltitude);
    
    // Try to find weapon in weapons database using getWeaponByName
    const weapon = getWeaponByName(weaponName) || weapons.find(w => w.name.toLowerCase() === weaponName.toLowerCase());
    
    if (!weapon) {
      // Fallback: Try to create a basic weapon object from attackData to use getWeaponType
      const fallbackWeapon = attackData ? { name: weaponName, ...attackData } : { name: weaponName };
      const weaponType = getWeaponType(fallbackWeapon);
      const weaponLength = getWeaponLength(fallbackWeapon);
      
      // Use weapon type to determine if it's ranged
      // Breath weapons (Fire Breath, Ice Breath, etc.) are treated as ranged/area attacks
      const isBreathWeapon = weaponName.toLowerCase().includes('breath') || 
                            weaponName.toLowerCase().includes('breath weapon');
      const isRangedWeapon = isBreathWeapon ||
                           weaponName.toLowerCase().includes('bow') || 
                           weaponName.toLowerCase().includes('crossbow') ||
                           weaponName.toLowerCase().includes('sling') ||
                           weaponName.toLowerCase().includes('gun') ||
                           weaponName.toLowerCase().includes('thrown') ||
                           weaponName.toLowerCase().includes('spell') ||
                           (attackData?.type === 'ranged') ||
                           (attackData?.range && attackData.range > 10);
      
      if (isRangedWeapon) {
        // Get weapon range from attackData or use defaults
        // Breath weapons typically have 20-60ft range (cone/line)
        let weaponRange;
        if (isBreathWeapon) {
          weaponRange = attackData?.range || 30; // Default 30ft for breath weapons
        } else {
          weaponRange = attackData?.range || 
                        (weaponName.toLowerCase().includes('long bow') || weaponName.toLowerCase() === 'longbow' ? 640 :
                         weaponName.toLowerCase().includes('short bow') || weaponName.toLowerCase() === 'shortbow' ? 360 :
                         weaponName.toLowerCase().includes('bow') ? 360 :
                         weaponName.toLowerCase().includes('crossbow') ? 480 : 100);
        }
        // ✅ 3D range check for flying targets (works even if caller passed horizontal distance)
        const horizontalDistance =
          attackerPos && defenderPos ? calculateDistance(attackerPos, defenderPos) : distance;
        const distanceForRangeCheck = Math.hypot(horizontalDistance, verticalSeparation);
        const canAttack = distanceForRangeCheck <= weaponRange;
        const rangeType = isBreathWeapon ? 'breath weapon' : 'ranged';
        return { 
          canAttack, 
          reason: canAttack
            ? `Within ${rangeType} range (${Math.round(distanceForRangeCheck)}ft ≤ ${weaponRange}ft)`
            : `Out of ${rangeType} range (${Math.round(distanceForRangeCheck)}ft > ${weaponRange}ft)`,
          maxRange: weaponRange,
          rangeInfo: isBreathWeapon ? `${rangeType} (${weaponRange}ft cone/line)` : `ranged (${weaponRange}ft)`
        };
      } else {
        // Check if this is a flexible reach weapon (like Fire Whip)
        const isFlexibleReach = weaponName.toLowerCase().includes("whip") ||
                                attackData?.weaponType === "flexible" ||
                                attackData?.properties?.flexible === true ||
                                attackData?.properties?.entangleCapable === true;
        
        // For flexible reach weapons, use 3D reach calculation
        if (isFlexibleReach && (attackData?.reach > 5 || attackData?.lengthFt > 5)) {
          const maxReachFt = attackData?.reach || attackData?.lengthFt || 15;
          
          // Use 3D reach validation
          const reachCheck = validateFlexibleWeaponReach(
            attacker,
            defender,
            { name: weaponName, reach: maxReachFt, ...attackData },
            attackerPos,
            defenderPos
          );
          
          return {
            canAttack: reachCheck.withinReach,
            reason: reachCheck.reason,
            maxRange: maxReachFt,
            isUnreachable: !reachCheck.withinReach,
            requiresDive: false,
            effectiveDistance: reachCheck.effectiveDistance,
            horizontalFt: reachCheck.horizontalFt,
            verticalFt: reachCheck.verticalFt
          };
        }
        
        // For unknown melee weapons, adjacent hexes (5ft) are always in melee range
        // Weapon length only matters for reach weapons that can attack beyond adjacent hexes
        // Minimum melee range is 5.5ft to account for adjacent hexes in hex grid
        const effectiveRange = Math.max(5.5, weaponLength > 0 ? weaponLength : 5.5);
        
        // Check if this is a melee attack (do NOT force melee for thrown/ranged)
        const isExplicitThrown =
          attackData?.isThrown === true ||
          attackData?.weaponType === "thrown" ||
          attackData?.category === "thrown" ||
          attackData?.attackMode === "thrown";
        const weaponNameLower = weaponName.toLowerCase();
        const isNameRanged =
          weaponNameLower.includes("bow") ||
          weaponNameLower.includes("crossbow") ||
          weaponNameLower.includes("sling");
        const isExplicitRanged =
          attackData?.type === "ranged" ||
          attackData?.rangeCategory === "ranged" ||
          attackData?.isRanged === true ||
          isExplicitThrown ||
          isNameRanged ||
          (attackData?.range && attackData.range > 10) ||
          weaponName.toLowerCase().includes("thrown");
        const isMeleeAttack = !isExplicitRanged;
        
        // SYMMETRIC ALTITUDE CHECK: For melee attacks, check vertical separation for both sides
        // - Ground attacker vs flying target: must have reach >= altitude
        // - Flying attacker vs ground target: must dive to melee altitude
        // - Both flying: must be at similar altitudes
        let isUnreachable = false;
        let requiresDive = false;
        
        if (isMeleeAttack) {
          // 3D reach check: if vertical gap is bigger than reach, melee can't connect
          // BUT: if the attacker is already flying above the target, it can resolve this
          // with a Dive Attack (combined descent + strike in one action).
          if (verticalSeparation > effectiveRange) {
            if (attackerIsFlying && attackerAltitude > targetAltitude) {
              requiresDive = true;
              isUnreachable = false;
            } else {
              isUnreachable = true;
            }
          }
          
          // Extra rule / nicer messaging for ground attackers vs flying targets
          if (targetIsFlying && !attackerIsFlying) {
            // Allow only long-reach weapons to hit low-flying targets
            if (
              effectiveRange >= targetAltitude &&
              targetAltitude <= 15 &&
              effectiveRange >= 10 &&
              verticalSeparation <= effectiveRange
            ) {
              // Long reach weapon vs low-flying target is ok
              isUnreachable = false;
            } else {
              isUnreachable = true;
            }
          }
        }
        
        const canAttack = distance <= effectiveRange && !isUnreachable && !requiresDive;
        
        let reason;
        if (requiresDive) {
          reason = `${defender.name || "Target"} is too far below (${verticalSeparation.toFixed(1)}ft vertical) for melee reach (${effectiveRange.toFixed(1)}ft) — dive attack required`;
        } else if (isUnreachable) {
          if (targetIsFlying && !attackerIsFlying) {
            if (targetAltitude > 15) {
              reason = `${defender.name || "Target"} is flying too high (${targetAltitude}ft) to be reached by melee attacks from ground`;
            } else {
              reason = `${defender.name || "Target"} is flying and cannot be reached by melee attacks from ground`;
            }
          } else if (verticalSeparation > effectiveRange) {
            reason = `${defender.name || "Target"} is too far above/below (${verticalSeparation.toFixed(1)}ft vertical) for melee reach (${effectiveRange.toFixed(1)}ft)`;
          } else {
            reason = `${defender.name || "Target"} cannot be reached by melee attacks from current position`;
          }
        } else if (canAttack) {
          reason = isMeleeAttack
            ? `Within melee range (${weaponType} weapon, adjacent hex)`
            : `Within ranged range (${Math.round(distance)}ft ≤ ${effectiveRange}ft)`;
        } else {
          reason = `Out of melee range (${Math.round(distance)}ft > ${effectiveRange}ft)`;
        }
        
        return { 
          canAttack, 
          reason,
          maxRange: effectiveRange,
          isUnreachable: isUnreachable || false,
          requiresDive: requiresDive || false
        };
      }
    }
    
    // Use enhanced distance-based validation
    const effectiveDistance =
      typeof distance === "number" && !Number.isNaN(distance)
        ? distance
        : (attackerPos && defenderPos
            ? calculateDistance(attackerPos, defenderPos)
            : Infinity);
    
    // ✅ Normalize weapon.range into a usable numeric "feet" value when possible.
    // This prevents validateAttackRange() from falling back to melee 5.5ft
    // just because range was missing or stored as a string like "640 ft".
    const resolveRangeFeet = (w, name) => {
      const raw =
        w?.range ?? w?.maxRange ?? w?.rangeFeet ?? attackData?.range ?? null;

      if (typeof raw === "number" && raw > 0) return raw;

      if (typeof raw === "string") {
        const m = raw.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
        if (m) return parseFloat(m[1]);
      }

      const n = (name || "").toLowerCase();
      if (n.includes("long bow") || n === "longbow") return 640;
      if (n.includes("short bow") || n === "shortbow") return 360;
      if (n.includes("crossbow")) return 320;
      if (n.includes("sling")) return 160;

      return null;
    };

    const looksRanged =
      weaponName.toLowerCase().includes("bow") ||
      weaponName.toLowerCase().includes("crossbow") ||
      weaponName.toLowerCase().includes("sling") ||
      weapon?.type === "ranged" ||
      (typeof weapon?.range === "number" && weapon.range > 10);

    const parsedRange = looksRanged ? resolveRangeFeet(weapon, weaponName) : null;
    const normalizedWeapon =
      parsedRange && weapon ? { ...weapon, range: parsedRange } : weapon;

    let rangeValidation = validateAttackRange(
      attacker,
      defender,
      attackerPos,
      defenderPos,
      normalizedWeapon,
      effectiveDistance
    );

    // ✅ Safety override: if downstream still claims melee 5.5ft for a ranged weapon,
    // force a ranged decision using parsedRange.
    if (
      looksRanged &&
      parsedRange &&
      typeof rangeValidation?.maxRange === "number" &&
      rangeValidation.maxRange <= 6
    ) {
      const canAttack = effectiveDistance <= parsedRange;
      rangeValidation = {
        ...rangeValidation,
        canAttack,
        maxRange: parsedRange,
        reason: canAttack
          ? `Within ranged range (${Math.round(effectiveDistance)}ft ≤ ${parsedRange}ft)`
          : `Out of ranged range (${Math.round(effectiveDistance)}ft > ${parsedRange}ft)`,
      };
    }
    
    if (rangeValidation.canAttack) {
      // Add range penalty info for ranged weapons
      const finalRange = parsedRange || weapon?.range || weapon?.maxRange;
      if (finalRange && finalRange > 0) {
        const rangePenalty = calculateRangePenalty(effectiveDistance, normalizedWeapon || weapon);
        return {
          canAttack: true,
          reason: rangeValidation.reason,
          maxRange: finalRange,
          rangeInfo: rangePenalty.rangeInfo,
          penalty: rangePenalty.penalty
        };
      } else {
        return {
          canAttack: true,
          reason: rangeValidation.reason,
          maxRange: weapon?.reach || 5
        };
      }
    } else {
      // Provide movement suggestions when out of range
      const finalRange = parsedRange || weapon?.range || weapon?.maxRange || weapon?.reach || 5;
      return {
        canAttack: false,
        reason: rangeValidation.reason,
        maxRange: finalRange,
        suggestions: rangeValidation.suggestions
      };
    }
  }, [positions]);

  // Trip maneuver handler
  const executeTripManeuver = useCallback((attacker, defender) => {
    executeTripManeuverHandler(attacker, defender, {
      fighters,
      combatActive,
      addLog,
      setFighters,
      setPositions,
    });
  }, [fighters, combatActive, addLog, setFighters, setPositions]);

  // Shove maneuver handler
  const executeShoveManeuver = useCallback((attacker, defender) => {
    executeShoveManeuverHandler(attacker, defender, {
      fighters,
      combatActive,
      addLog,
      setFighters,
      setPositions,
      positions,
    });
  }, [fighters, combatActive, addLog, setFighters, setPositions, positions]);

  // Disarm maneuver handler
  const executeDisarmManeuver = useCallback((attacker, defender) => {
    executeDisarmManeuverHandler(attacker, defender, {
      fighters,
      combatActive,
      addLog,
      setFighters,
      positions,
    });
  }, [fighters, combatActive, addLog, setFighters, positions]);

  // Grapple action handler
  const handleGrappleAction = useCallback((actionType, attacker, defenderId) => {
    handleGrappleActionHandler(actionType, attacker, defenderId, {
      fighters,
      combatActive,
      addLog,
      positions,
      setFighters,
      setPositions,
      clampHP,
      getFighterHP,
      applyHPToFighter,
    });
  }, [fighters, combatActive, addLog, positions, setFighters, setPositions, clampHP, getFighterHP, applyHPToFighter]);

  // Define attack function with useCallback (isPredatorBird, isTinyPrey, canAISeeTargetAsymmetric are defined earlier)
  const attack = useCallback((attacker, defenderId, bonusModifiers = {}) => {
    const isDebugThrownAttack =
      (import.meta.env?.DEV || import.meta.env?.MODE === "development") &&
      (
        attacker?.selectedAttack?.weaponType === "thrown" ||
        attacker?.selectedAttack?.isThrown === true ||
        attacker?.selectedAttack?.category === "thrown"
      );

    // ✅ AUTHORITATIVE COMBAT-END GUARD:
    // Attacks can be scheduled via timeouts; once combat end has been declared, ignore late arrivals silently.
    if (combatOverRef.current || combatEndCheckRef.current) {
      if (isDebugThrownAttack) {
        addLog(`DEBUG throw: attack() aborted (combat over)`, "info");
      }
      return;
    }

    // ✅ CRITICAL: Check if combat is still active before allowing attacks
    if (!combatActive) {
      if (isDebugThrownAttack) {
        addLog(`DEBUG throw: attack() aborted (combatActive=false)`, "info");
      }
      return;
    }
    
    let stateAttacker = fighters.find(f => f.id === attacker.id) || attacker;

    // ✅ Hard guard: never execute an attack with 0 actions remaining (prevents ghost actions/log spam)
    if ((stateAttacker.remainingAttacks ?? 0) <= 0) {
      addLog(`⚠️ ${stateAttacker.name} has no actions remaining!`, "error");
      // Ensure we don't stall the combat loop if an AI branch attempted an action late.
      scheduleEndTurn();
      return;
    }

    // ✅ CRITICAL: Check if attacker can act (must be conscious, not dying/dead/unconscious)
    if (!canFighterAct(stateAttacker)) {
      const hpStatus = getHPStatus(stateAttacker.currentHP);
      addLog(`❌ ${attacker.name} cannot attack (${hpStatus.description})!`, "error");
      scheduleEndTurn();
      return;
    }
    
    const updated = fighters.map(f => ({ ...f }));
    const attackerIndex = updated.findIndex(f => f.id === stateAttacker.id);
    // If caller passed a pre-selected attack (AI), prefer it over the stale fighter snapshot.
    if (attacker?.selectedAttack) {
      if (attackerIndex !== -1) {
        updated[attackerIndex].selectedAttack = attacker.selectedAttack;
      } else {
        stateAttacker = { ...stateAttacker, selectedAttack: attacker.selectedAttack };
      }
    }
    const defenderIndex = updated.findIndex(f => f.id === defenderId);
    if (defenderIndex === -1) {
      addLog(`Invalid target! Target with ID ${defenderId} not found`, "error");
      scheduleEndTurn();
      return;
    }

    let defender = updated[defenderIndex];
    
    // 😱 Horror Factor + Morale Check: Before attack, check for Horror Factor and integrate with morale
    // This should happen ONCE per encounter per target (idempotent via horrorSystem.js)
    // Called at the start of attack/engagement as per Palladium rules
    if (settings.useInsanityTrauma) {
      const { attacker: updatedAttacker, defender: updatedDefender } = runHorrorAndMorale(
        stateAttacker,
        defender,
        fighters,
        {
          currentRound: meleeRound,
          meleeRound: meleeRound,
        },
        addLog
      );
      
      // Use the updated fighters (may have horror/morale effects applied)
      if (updatedAttacker.id === stateAttacker.id) {
        // Attacker was affected by horror (defender has HF)
        const attackerIdx = updated.findIndex(f => f.id === updatedAttacker.id);
        if (attackerIdx !== -1) {
          updated[attackerIdx] = updatedAttacker;
        }
      }
      if (updatedDefender.id === defender.id) {
        // Defender was affected by horror (attacker has HF)
        defender = updatedDefender;
        updated[defenderIndex] = defender;
      }
    }
    
    // ✅ CRITICAL: Check if defender can act (not unconscious/dead) before attacking
    if (!canFighterAct(defender)) {
      const hpStatus = getHPStatus(defender.currentHP);
      // Allow evil alignments to finish off dying enemies (coup de grâce)
      const attackerAlignment = stateAttacker.alignment || stateAttacker.attributes?.alignment || "";
      const isEvil = isEvilAlignment(attackerAlignment);
      
      if (defender.currentHP <= -21) {
        addLog(`❌ ${attacker.name} cannot attack ${defender.name} - ${defender.name} is already dead`, "error");
        return;
      } else if (!isEvil && defender.currentHP <= 0) {
        // Good/neutral alignments show mercy - don't attack unconscious/dying enemies
        addLog(`⚠️ ${attacker.name} shows mercy and does not attack ${defender.name} (${hpStatus.description.toLowerCase()})`, "info");
        return;
      } else if (isEvil && defender.currentHP <= 0) {
        // Evil alignments may finish off dying enemies (coup de grâce) - allow attack
        addLog(`😈 ${attacker.name} (${attackerAlignment}) attempts to finish off ${defender.name}!`, "warning");
      }
    }
    
    // Find attacker in updated array to check/deduct attacks
    const attackerInArray = attackerIndex !== -1 ? updated[attackerIndex] : null;

    // Allow callers (AI/actions) to patch attacker state for this action.
    // Example: Dive Attack sets altitude/isFlying so range checks + post-attack state remain consistent.
    if (attackerInArray && bonusModifiers?.attackerStatePatch) {
      Object.assign(attackerInArray, bonusModifiers.attackerStatePatch);
    }
    if (attackerInArray && attackerInArray.type === "player") {
      // Check if player has attacks remaining
      if (attackerInArray.remainingAttacks <= 0) {
        addLog(`⚠️ ${attacker.name} is out of attacks this turn!`, "error");
        return;
      }
      // CRITICAL: Close combat choices modal immediately for player attacks
      // This prevents multiple actions from being queued
      setShowCombatChoices(false);
      closeCombatChoices(); // Also close via disclosure hook
      setSelectedAction(null);
      setSelectedTarget(null);
      setSelectedAttackWeapon(null);
      setSelectedManeuver(null);
      setSelectedAttack(0); // Reset attack selection
    }

    // Check if attacker is grappled - long weapons cannot be used
    const effectiveAttacker = attackerInArray || stateAttacker;
    const attackerGrappleStatus = getGrappleStatus(effectiveAttacker);
    if (attackerGrappleStatus.state !== GRAPPLE_STATES.NEUTRAL) {
      // Check if current weapon can be used in grapple
      const currentWeapon = effectiveAttacker.equippedWeapons?.primary || effectiveAttacker.equippedWeapons?.secondary || null;
      if (currentWeapon && !canUseWeaponInGrapple(effectiveAttacker, currentWeapon)) {
        addLog(`⚠️ ${attacker.name} is grappled! Cannot use ${currentWeapon.name} (too long). Use a dagger or unarmed attack.`, "warning");
        return;
      }
    }

    // Get attack data - use selected weapon for players, selectedAttack for enemies
    let attackData;
    if (bonusModifiers?.attackDataOverride) {
      attackData = bonusModifiers.attackDataOverride;
    } else if (attacker.type === "player" && selectedAttackWeapon) {
      // Use selected weapon for player attacks
      // Check if weapon is being used two-handed (either weapon is two-handed type or using two-handed grip)
      const isUsingTwoHanded = selectedAttackWeapon.twoHanded || isTwoHandedWeapon(selectedAttackWeapon);
      // Use getWeaponDamage to properly calculate damage with two-handed bonuses and weapon size modifiers
      const weaponDamage = getWeaponDamage(selectedAttackWeapon, isUsingTwoHanded, attacker);
      attackData = {
        name: selectedAttackWeapon.name,
        damage: weaponDamage,
        type: (selectedAttackWeapon?.range != null || ["bow","crossbow","sling"].includes((selectedAttackWeapon?.category || "").toLowerCase())) ? "ranged" : selectedAttackWeapon.type,
        range: selectedAttackWeapon?.range
      };
      
      // Check if weapon can be used while grappled
      if (attackerGrappleStatus.state !== GRAPPLE_STATES.NEUTRAL && !canUseWeaponInGrapple(effectiveAttacker, attackData)) {
        addLog(`⚠️ ${attacker.name} is grappled! Cannot use ${attackData.name} (too long). Use a dagger or unarmed attack.`, "warning");
        return;
      }
    } else if (effectiveAttacker.selectedAttack) {
      // Enemy has a pre-selected attack (e.g., spell or specific attack)
      attackData = effectiveAttacker.selectedAttack;
    } else if (effectiveAttacker.attacks && effectiveAttacker.attacks.length > 0) {
      // Use selectedAttack state to choose attack by index, or default to first attack
      const attackIndex = typeof selectedAttack === 'number' && selectedAttack >= 0 && selectedAttack < effectiveAttacker.attacks.length 
        ? selectedAttack 
        : 0;
      attackData = effectiveAttacker.attacks[attackIndex];
    } else {
      // Fallback: no attacks available
      attackData = null;
    }
    
    if (!attackData) {
      addLog(`${attacker.name} has no attacks available!`, "error");
      return;
    }

    // ✅ Guardrail: always resolve placeholder/generic enemy attacks to the actually equipped weapon.
    // This is shared with the planner so the two cannot diverge again.
    if (attacker.type === "enemy") {
      const resolved = resolveEnemyEffectiveAttack(effectiveAttacker, attackData, { preferRanged: true });
      attackData = resolved.attack;
    }

    // ✅ FIX: If this is a spell attack, route to executeSpell() instead of melee/ranged attack
    if (attackData.type === "spell" || attackData.damage === "by spell" || attackData.spell) {
      const spellToCast = attackData.spell || attackData;
      const spellTarget = defender;
      
      // Check if attacker has actions remaining
      const attackerInArray = updated.find(f => f.id === attacker.id);
      if (attackerInArray && attackerInArray.remainingAttacks <= 0) {
        addLog(`⚠️ ${attacker.name} has no actions remaining!`, "error");
        return;
      }
      
      // Execute the spell (executeSpell will handle action consumption, PPE, etc.)
      const spellSuccess = executeSpell(attackerInArray || attacker, spellTarget, spellToCast);
      if (spellSuccess) {
        // Spell was cast successfully - executeSpell handles turn ending
        return;
      } else {
        // Spell failed - still consume action if it was attempted
        if (attackerInArray && attackerInArray.remainingAttacks > 0) {
          setFighters(prev => prev.map(f => 
            f.id === attacker.id 
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
              : f
          ));
        }
        scheduleEndTurn();
        return;
      }
    }

    // Check range and line of sight for attacks
    const livePositions =
      positionsRef.current && Object.keys(positionsRef.current).length > 0
        ? positionsRef.current
        : positions;
    if (
      livePositions &&
      (livePositions[attacker.id] || bonusModifiers?.attackerPosOverride) &&
      (livePositions[defenderId] || bonusModifiers?.defenderPosOverride)
    ) {
      const attackerPosOverride = bonusModifiers?.attackerPosOverride || null;
      const defenderPosOverride = bonusModifiers?.defenderPosOverride || null;
      const attackerPos = attackerPosOverride || livePositions[attacker.id];
      const defenderPos = defenderPosOverride || livePositions[defenderId];
      const distanceOverride = bonusModifiers?.distanceOverride;
      const distance =
        typeof distanceOverride === "number" && !Number.isNaN(distanceOverride)
          ? distanceOverride
          : calculateDistance(attackerPos, defenderPos);
      
      // Check line of sight if terrain is set - ONLY for player characters
      if (combatTerrain && attacker.type === "player") {
        // Note: LOS calculation happens here, obstacles are generated by TacticalMap
        // For now, we'll do a basic distance check - can be enhanced later with proper LOS
        const attackDistance = calculateDistance(attackerPos, defenderPos);
        
        // Apply visibility modifier if distance is very long in dense terrain
        if (combatTerrain.terrainData && attackDistance > 60) {
          const visibilityMod = combatTerrain.terrainData.visibilityModifier || 1.0;
          if (visibilityMod < 0.5) {
            const losResult = calculateLineOfSight(
              attackerPos, 
              defenderPos, 
              { obstacles: [] }
            );
            
            if (!losResult.hasLineOfSight) {
              addLog(`🌲 ${attacker.name} cannot clearly see ${defender.name} through the dense ${combatTerrain.terrainData.name.toLowerCase()}!`, "info");
              return; // Block the attack if player can't see target
            }
          }
        }
      }
      
      // Use proper weapon range validation
      const vSepFt = Math.abs((getAltitude(attacker) || 0) - (getAltitude(defender) || 0));
      const attackNameLower = String(attackData?.name || "").toLowerCase();
      const isRangedForRangeCheck =
        attackData?.type === "ranged" ||
        attackData?.weaponType === "thrown" ||
        attackData?.isThrown === true ||
        (attackData?.range != null && Number(attackData.range) > 10) ||
        (attackData?.category && String(attackData.category).toLowerCase() === "thrown") ||
        // Name-based fallback (enemy attacks are sometimes "Strike" with a ranged weapon name)
        attackNameLower.includes("bow") ||
        attackNameLower.includes("crossbow") ||
        attackNameLower.includes("sling");
      const distanceForRangeCheck = isRangedForRangeCheck ? Math.hypot(distance, vSepFt) : distance;

      const rangeValidation = validateWeaponRange(
        attacker,
        defender,
        attackData,
        distanceForRangeCheck,
        attackerPos,
        defenderPos
      );

      // 🦅 Auto-dive support: flying predator birds (e.g., hawk) can descend-and-strike in a single action.
      // This prevents the "hover above target forever" stalemate by converting a vertical gap into a dive attack.
      const isEnemyAttacker = attacker?.type === "enemy";
      if (
        !rangeValidation.canAttack &&
        rangeValidation.requiresDive &&
        isPredatorBird(effectiveAttacker) &&
        isFlying(effectiveAttacker)
      ) {
        const preferredDiveAttack =
          (effectiveAttacker.attacks || []).find((a) => /talon|claw/i.test(a?.name || "")) ||
          attackData;

        const dive = performDiveAttack(
          { ...effectiveAttacker, selectedAttack: preferredDiveAttack },
          defender,
          { attackOffsetFeet: 5 }
        );

        if (dive?.success) {
          // Apply post-dive state (altitude drop) + dive strike bonus
          try {
            Object.assign(effectiveAttacker, dive.fighter || {});
          } catch {
            // no-op
          }
          attackData = preferredDiveAttack;
          // Continue with attack using dive-modified state
        } else {
          // Dive attacks are melee-only, so this error is always valid to log
          addLog(`❌ ${attacker.name} cannot reach ${defender.name} for attack! (${rangeValidation.reason})`, "error");
          // ✅ Last safety net: if AI attempted an illegal action, consume an action and advance.
          if (isEnemyAttacker || attacker?.aiControlled === true) {
            setFighters(prev => prev.map(f => {
              if (f.id !== attacker.id) return f;
              const ra = Number(f.remainingAttacks ?? 0) || 0;
              return { ...f, remainingAttacks: Math.max(0, ra - 1) };
            }));
            scheduleEndTurn(0);
          }
          return;
        }
      } else if (!rangeValidation.canAttack) {
        // Check if this is a ranged attack - if so, don't log melee-specific errors
        const isRangedAttackForError =
          attackData?.type === "ranged" ||
          attackData?.weaponType === "thrown" ||
          attackData?.isThrown === true ||
          (attackData?.range != null && Number(attackData.range) > 10) ||
          (attackData?.category && String(attackData.category).toLowerCase() === "thrown") ||
          attackNameLower.includes("bow") ||
          attackNameLower.includes("crossbow") ||
          attackNameLower.includes("sling");
        
        const reasonLower = String(rangeValidation.reason || "").toLowerCase();
        const isMeleeSpecificError = 
          reasonLower.includes("melee") ||
          reasonLower.includes("flying too high") ||
          reasonLower.includes("to be reached by melee");
        
        // Only log error if it's not a ranged attack with a melee-specific error message
        // (ranged attacks will be validated separately and don't need melee error spam)
        if (!(isRangedAttackForError && isMeleeSpecificError)) {
          addLog(`❌ ${attacker.name} cannot reach ${defender.name} for attack! (${rangeValidation.reason})`, "error");
          
          // Show movement suggestions
          if (rangeValidation.suggestions && rangeValidation.suggestions.length > 0) {
            addLog(`💡 Options: ${rangeValidation.suggestions.slice(0, 3).join(", ")}`, "info");
          }
        }
        
        // ✅ Avoid infinite AI turn loops:
        // If an AI-controlled fighter attempts an illegal attack, consume an action and advance.
        const isAIControlledFighter = isEnemyAttacker || attacker?.aiControlled === true;
        if (isAIControlledFighter && attacker?.id) {
          setFighters(prev => prev.map(f => {
            if (f.id !== attacker.id) return f;
            const ra = Number(f.remainingAttacks ?? 0) || 0;
            return { ...f, remainingAttacks: Math.max(0, ra - 1) };
          }));
          scheduleEndTurn(0);
        }

        return;
      } else {
        // Log range info for successful attacks
        if (rangeValidation.rangeInfo) {
          addLog(`📍 ${attacker.name} attacking at ${rangeValidation.rangeInfo}`, "info");
        }
      }
      
      // Ammunition for ranged weapons is strictly inventory-based.
      // Bows require arrows, crossbows require bolts, slings require rocks/stones.
      const weaponName = attackData?.name || "";
      const isRangedWeapon =
        weaponName.toLowerCase().includes("bow") ||
        weaponName.toLowerCase().includes("crossbow") ||
        weaponName.toLowerCase().includes("sling") ||
        attackData?.type === "ranged" ||
        (attackData?.range && attackData.range > 10);

      const ammoType = attackData?.ammunition;
      const requiresAmmo = Boolean(ammoType && ammoType !== "self" && isRangedWeapon);
      const isProjectileAttack =
        isRangedWeapon ||
        attackData?.type === "ranged" ||
        attackData?.rangeCategory === "ranged" ||
        attackData?.isRanged === true ||
        attackData?.weaponType === "thrown" ||
        attackData?.category === "thrown";

      if (requiresAmmo) {
        // IMPORTANT: apply ammo decrement into the same `updated` array that will later be committed.
        // Otherwise later `setFighters(updated)` calls can overwrite the decrement (UI shows old ammo).
        const currentAmmo = getInventoryAmmoCount(attackerInArray || attacker, ammoType);

        if (currentAmmo <= 0) {
          addLog(`❌ ${attacker.name} is out of ${ammoType}! Cannot fire ${weaponName}.`, "error");
          // ✅ If AI is out of ammo and attempted to shoot, consume an action and advance to prevent stalls.
          if (isEnemyAttacker || attacker?.aiControlled === true) {
            setFighters(prev => prev.map(f => {
              if (f.id !== attacker.id) return f;
              const ra = Number(f.remainingAttacks ?? 0) || 0;
              return { ...f, remainingAttacks: Math.max(0, ra - 1) };
            }));
            scheduleEndTurn(0);
          }
          return;
        }

        // Spend 1 ammo per shot (hit or miss).
        if (attackerIndex !== -1) {
          updated[attackerIndex] = decrementInventoryAmmo(updated[attackerIndex], ammoType, 1);
        } else {
          // Fallback (should be rare): update via functional state update
          setFighters((prev) =>
            prev.map((f) => (f.id === attacker.id ? decrementInventoryAmmo(f, ammoType, 1) : f))
          );
        }

        const remainingAmmo = Math.max(0, currentAmmo - 1);
        if (remainingAmmo > 0) {
          addLog(`🏹 ${attacker.name} fires ${weaponName} (${remainingAmmo} ${ammoType} remaining)`, "info");
        } else {
          addLog(`🏹 ${attacker.name} fires ${weaponName} (OUT OF ${String(ammoType).toUpperCase()}!)`, "warning");
        }
      }
    }

    try {
      // Crypto secure attack roll with optional bonus modifiers (e.g., +2 from charge, flanking bonus)
      const baseStrikeBonus = getCombatBonus(attacker, "strike", attackData) || 0;
      const chargeBonus = bonusModifiers.strikeBonus || 0;
      const flankingBonus = bonusModifiers.flankingBonus || 0;
      let tempBonus =
        (tempModifiers[attacker.id]?.strikeBonus || 0) +
        (tempModifiers[attacker.id]?.nextMeleeStrike || 0);
      if (bonusModifiers?.skipTempModifiers) {
        tempBonus = 0;
      }
      // Clear nextMeleeStrike after using it (one-time penalty)
      if (!bonusModifiers?.skipTempModifiers && tempModifiers[attacker.id]?.nextMeleeStrike) {
        const updatedTempMods = { ...tempModifiers };
        delete updatedTempMods[attacker.id].nextMeleeStrike;
        if (Object.keys(updatedTempMods[attacker.id]).length === 0) {
          delete updatedTempMods[attacker.id];
        }
        setTempModifiers(updatedTempMods);
      }
      
      // Apply dynamic terrain-based combat modifiers
      let terrainModifiers = { strike: 0, dodge: 0, parry: 0, damage: 0, notes: [] };
      if (combatTerrain && combatTerrain.terrain && positions && positions[attacker.id] && positions[defenderId]) {
        // Get all actors in proximity to attacker
        const nearbyActors = getActorsInProximity(
          positions[attacker.id], 
          fighters, 
          positions, 
          2
        );
        
        // Get defender's weapon for reach comparison
        const defenderWeapon = defender.equippedWeapons?.primary || defender.equippedWeapons?.secondary || null;
        const attackerWeapon = attackData;
        
        // Check if this is first melee round (turnCounter === 1 means first round of combat)
        const isFirstMeleeRound = turnCounter <= fighters.length;
        
        // Check if distance has been closed (for short vs long weapon scenarios)
        const hasClosed = hasClosedDistance(attacker, defender, combatStateRef.current);
        
        // Check if attacker needs to close distance (short weapon vs long weapon)
        if (attackerWeapon && defenderWeapon) {
          const needsToClose = needsToCloseDistance(attackerWeapon, defenderWeapon);
          if (needsToClose && !hasClosed) {
            // Attempt to close distance automatically (spend 1 action)
            const closeResult = attemptCloseDistance(attacker, {});
            if (closeResult.success) {
              markDistanceClosed(attacker, defender, combatStateRef.current);
              if (closeResult.actionCost > 0) {
                // Deduct action cost for closing distance
                if (attackerInArray) {
                  attackerInArray.remainingAttacks = Math.max(0, attackerInArray.remainingAttacks - closeResult.actionCost);
                }
                addLog(`⚔️ ${attacker.name} ${closeResult.reason}`, "info");
              }
            }
          }
        }
        
        // Get attack distance
        const attackDistance = calculateDistance(positions[attacker.id], positions[defenderId]);
        
        // Check if called shot is possible (for future called shot feature)
        if (attackerWeapon) {
          const calledShotCheck = canUseCalledShot(attackerWeapon, attackDistance);
          // Store called shot info for potential use (not implemented in UI yet)
          if (calledShotCheck.canUse && (import.meta.env?.DEV || import.meta.env?.MODE === 'development')) {
            // Only log in development to avoid spam
            // addLog(`🎯 Called shot available: ${calledShotCheck.reason}`, "info");
          }
        }
        
        // Get combat modifiers based on terrain and environment
        terrainModifiers = getCombatModifiers(
          attackData,
          attacker,
          defender,
          combatTerrain.terrain,
          nearbyActors,
          {
            attackerPos: positions[attacker.id],
            positions: positions,
            defenderWeapon: defenderWeapon,
            isFirstMeleeRound: isFirstMeleeRound,
            combatState: combatStateRef.current,
            distance: attackDistance
          }
        );
        
        // Check if weapon can be used in current terrain
        const weaponCheck = canUseWeapon(
          attackData,
          combatTerrain.terrain,
          nearbyActors,
          {
            attackerPos: positions[attacker.id],
            positions: positions
          }
        );
        
        if (!weaponCheck.canUse) {
          addLog(`❌ ${weaponCheck.reason}`, "error");
          return;
        }
        
        // Apply reach-based strike modifiers
        if (defenderWeapon && attackerWeapon) {
          // Use calculateReachAdvantage for basic reach comparison (complements getReachStrikeModifiers)
          const reachAdvantage = calculateReachAdvantage(attackerWeapon, defenderWeapon);
          if (reachAdvantage.hasAdvantage && reachAdvantage.bonus > 0) {
            terrainModifiers.strike += reachAdvantage.bonus;
            terrainModifiers.notes.push(reachAdvantage.description);
          }
          
          const terrainHeight = getDynamicHeight(combatTerrain.terrain, nearbyActors);
          const terrainData = TERRAIN_TYPES[combatTerrain.terrain];
          const terrainDensity = terrainData?.density || combatTerrain.terrainData?.density || 0;
          const hasObstructions = terrainData?.hasObstructions || combatTerrain.terrainData?.hasObstructions || false;
          
          const reachModifiers = getReachStrikeModifiers(
            attackerWeapon,
            defenderWeapon,
            combatTerrain.terrain,
            getDynamicWidth(combatTerrain.terrain, nearbyActors, {
              attackerPos: positions[attacker.id],
              positions: positions
            }),
            terrainHeight,
            terrainDensity,
            hasObstructions,
            isFirstMeleeRound,
            hasClosed,
            attackDistance,
            "auto", // Attack type - will auto-detect based on weapon
            attacker // Pass attacker for size-based length adjustments
          );
          terrainModifiers.strike += reachModifiers.strike;
          terrainModifiers.notes.push(...reachModifiers.notes);
        }
        
        // Log terrain modifiers if any
        if (terrainModifiers.notes.length > 0) {
          terrainModifiers.notes.forEach(note => {
            addLog(`🌲 ${note}`, "info");
          });
        }
      }
      
      // Check for sneak attack bonus (if target is unaware or searching)
      let sneakAttackBonus = 0;
      let sneakDamageMultiplier = 1;
      if (attacker.type === "player") {
        const sneakCheck = canPerformSneakAttack(attacker, defender, { firstAttackOnly: true });
        if (sneakCheck.allowed) {
          sneakAttackBonus = sneakCheck.strikeBonus;
          sneakDamageMultiplier = sneakCheck.damageMultiplier;
          addLog(sneakCheck.log, "combat");
          // Update awareness - target becomes alert after being attacked
          updateAwareness(defender, attacker, AWARENESS_STATES.ALERT);
        }
      }
      
      // Check for grapple advantage bonus
      const grappleAdvantage = attacker.grappleState?.hasGrappleAdvantage ? 2 : 0;
      
      const isRangedForBonus =
        attackData?.type === "ranged" ||
        attackData?.weaponType === "thrown" ||
        attackData?.isThrown === true ||
        (attackData?.range != null && Number(attackData.range) > 10) ||
        (attackData?.category && String(attackData.category).toLowerCase() === "thrown");

      // Flanking is melee-only (avoid ranged attackers "flanking" from 100+ ft).
      const effectiveFlankingBonus = isRangedForBonus ? 0 : flankingBonus;

      const computedStrikeBonus =
        baseStrikeBonus +
        chargeBonus +
        effectiveFlankingBonus +
        tempBonus +
        terrainModifiers.strike +
        sneakAttackBonus +
        grappleAdvantage;
      const strikeBonus =
        bonusModifiers?.preRoll?.strikeBonus ?? computedStrikeBonus;
      
      if (tempBonus !== 0) {
        addLog(`⚡ ${attacker.name} has ${tempBonus > 0 ? '+' : ''}${tempBonus} temporary strike bonus!`, "info");
      }
      
      if (effectiveFlankingBonus > 0) {
        addLog(`🎯 ${attacker.name} gains +${effectiveFlankingBonus} flanking bonus!`, "info");
      }
      
      if (sneakAttackBonus > 0) {
        addLog(`🗡️ Sneak attack bonus: +${sneakAttackBonus} strike, ×${sneakDamageMultiplier} damage`, "combat");
      }
      
      if (grappleAdvantage > 0) {
        addLog(`🎯 ${attacker.name} gains +${grappleAdvantage} grapple advantage bonus!`, "info");
        // Clear the advantage flag after use
        setFighters(prev => prev.map(f => {
          if (f.id === attacker.id && f.grappleState) {
            return {
              ...f,
              grappleState: {
                ...f.grappleState,
                hasGrappleAdvantage: false,
              },
            };
          }
          return f;
        }));
      }
      
      const preRoll = bonusModifiers?.preRoll;
      let attackRollResult;
      let attackRoll;
      let attackDiceRoll;
      let isCriticalHit;
      let isCriticalMiss;

      if (preRoll) {
        attackRoll = preRoll.attackRoll;
        attackDiceRoll = preRoll.attackDiceRoll;
        isCriticalHit = preRoll.isCriticalHit;
        isCriticalMiss = preRoll.isCriticalMiss;
        attackRollResult = {
          totalWithBonus: attackRoll,
          diceRolls: [{ result: attackDiceRoll }],
        };
      } else {
      // Format dice formula correctly (handle negative bonuses)
      // The dice parser only accepts + in the formula, so use the bonus parameter for negatives
      const diceFormula = strikeBonus >= 0 ? `1d20+${strikeBonus}` : `1d20`;
      const bonus = strikeBonus >= 0 ? 0 : strikeBonus; // Pass negative as bonus parameter
      // Apply fatigue penalties to attack roll
      const fatiguedAttacker = applyFatiguePenalties(attacker);
      const fatiguePenalty = fatiguedAttacker.bonuses?.strike || 0;
      
      // Get size/strength modifiers (for non-grapple attacks, use reach advantage)
      const reachMod = getReachAdvantage(attacker, defender);
      const sizeMod = getCombinedGrappleModifiers(attacker, defender);
      const sizeStrikeBonus = reachMod.strikeBonus; // Use reach bonus for regular attacks
      
        attackRollResult = CryptoSecureDice.parseAndRoll(diceFormula, bonus);
        attackRoll = attackRollResult.totalWithBonus;
      
      // Apply fatigue penalty to attack roll
      if (fatiguePenalty < 0) {
        attackRoll += fatiguePenalty;
        const fatigueStatus = getFatigueStatus(attacker);
        addLog(`💪 ${attacker.name} attack penalty from fatigue: ${fatiguePenalty} (Stamina: ${fatigueStatus.stamina?.toFixed(1) || 'N/A'}/${fatigueStatus.maxStamina || 'N/A'})`, "info");
      }
      
      // Apply size/reach modifier to attack roll
      if (sizeStrikeBonus !== 0) {
        attackRoll += sizeStrikeBonus;
        addLog(`📏 ${reachMod.description}`, "info");
      }
      
        if (!bonusModifiers?.skipStaminaDrain) {
      // Drain stamina for normal combat action
      const staminaDrained = drainStamina(attacker, STAMINA_COSTS.NORMAL_COMBAT, 1);
      if (staminaDrained.currentStamina < staminaDrained.maxStamina * 0.5) {
        const status = getFatigueStatus(attacker);
        if (status.status !== "ready") {
          addLog(`⚠️ ${attacker.name} is ${status.description.toLowerCase()}! (Stamina: ${status.stamina.toFixed(1)}/${status.maxStamina})`, "warning");
            }
        }
        }

        attackDiceRoll = attackRollResult.diceRolls?.[0]?.result || attackRoll - strikeBonus;
        isCriticalHit = attackDiceRoll === 20; // Natural 20 = critical hit
        isCriticalMiss = attackDiceRoll === 1; // Natural 1 = critical miss
      }
      
      let targetAR = defender.AR || defender.ar || 10;
      
      // Apply cover bonus from terrain
      if (combatTerrain && positions && positions[defender.id]) {
        const coverBonus = getCoverBonus(
          { x: positions[defender.id].x, y: positions[defender.id].y },
          combatTerrain
        );
        if (coverBonus > 0) {
          targetAR += coverBonus;
          addLog(`🛡️ ${defender.name} gains +${coverBonus} AR from terrain cover!`, "info");
        }
      }
      
      // Apply lighting penalties (only if distance was calculated)
      if (!preRoll && combatTerrain && combatTerrain.lightingData && positions && positions[attacker.id] && positions[defenderId]) {
        const attackDistance = calculateDistance(positions[attacker.id], positions[defenderId]);
        // Convert hex distance to feet (assuming 5 feet per hex/square)
        const distanceInFeet = attackDistance * 5;
        const lightingEffects = applyLightingEffects(
          distanceInFeet,
          combatTerrain.lighting,
          attacker.hasInfravision || false,
          attacker // Pass character for nightvision check
        );
        
        // Apply penalty if present (negative values reduce attack roll)
        if (lightingEffects.penalty < 0) {
          attackRoll += lightingEffects.penalty; // Penalty is already negative, so add it
          
          // Log with nightvision indicator if active
          if (lightingEffects.nightvisionActive) {
            addLog(`🌘 Nightvision active: ${lightingEffects.reason}`, "info");
          } else {
            addLog(`🌑 Lighting penalty: ${lightingEffects.reason} (${lightingEffects.penalty}%)`, "info");
          }
        } else if (lightingEffects.nightvisionActive) {
          // Log nightvision even if no penalty (for visibility in combat log)
          addLog(`🌘 Nightvision active: ${lightingEffects.reason}`, "info");
        }
      }
      
      // Log the attack roll and store in diceRolls
      setDiceRolls(prev => [...prev, {
        id: generateCryptoId(),
        type: 'attack',
        attacker: attacker.name,
        roll: attackDiceRoll,
        total: attackRoll,
        bonus: strikeBonus,
        timestamp: new Date().toLocaleTimeString()
      }]);
      if (isCriticalHit) {
        addLog(`🎲 ${attacker.name} rolls NATURAL 20! Critical Hit! (Total: ${attackRoll} vs AR ${targetAR})`, "critical");
      } else if (isCriticalMiss) {
        addLog(`🎲 ${attacker.name} rolls NATURAL 1! Critical Miss!`, "miss");
      } else {
        // Format strike bonus display (show negative clearly)
        const bonusDisplay = strikeBonus >= 0 ? `+${strikeBonus}` : `${strikeBonus}`;
        addLog(`🎲 ${attacker.name} rolls ${attackDiceRoll} ${bonusDisplay} = ${attackRoll} vs AR ${targetAR}`, "info");
      }
      
      const isRangedAttack =
        attackData?.type === "ranged" ||
        attackData?.weaponType === "thrown" ||
        (attackData?.range != null && Number(attackData.range) > 10) ||
        (attackData?.category && String(attackData.category).toLowerCase() === "thrown");

      // AUTO-PARRY: If enemy attacks and defender has Hand-to-Hand, auto-parry if conditions are met
      // NOTE: Ranged/thrown attacks are NOT parryable under our rules; only dodge/cover applies.
      let defenseSuccess = false;
      let defenseType = defensiveStance[defender.id];
      let autoParryUsed = false; // Track if auto-parry was used

      if (bonusModifiers?.forceNoDefense) {
        defenseType = null;
        autoParryUsed = false;
      }

      // If defender chose Parry but incoming is ranged/thrown, treat as Dodge (or no defense if they can't dodge).
      if (defenseType === "Parry" && isRangedAttack) {
        defenseType = "Dodge";
        addLog(`🏹 ${defender.name} cannot parry a ranged attack and attempts to dodge instead!`, "info");
      }
      
      // Check for auto-parry when enemy attacks (only if no defensive stance already set)
      if (!bonusModifiers?.forceNoDefense && !defenseType && !isRangedAttack && attackRoll >= targetAR && canFighterAct(defender)) {
        // Check if defender has Hand-to-Hand skill
        const hasHandToHand = defender.handToHand && (
          defender.handToHand.type || 
          defender.handToHand.parryBonus !== undefined ||
          defender.bonuses?.parry !== undefined
        );
        
        // Check if defender has attacks remaining
        const hasAttacksRemaining = defender.remainingAttacks > 0;
        
        // Auto-parry if defender has Hand-to-Hand and can act
        if (hasHandToHand && hasAttacksRemaining) {
          defenseType = "Parry";
          autoParryUsed = true; // Mark that auto-parry was used
          addLog(`🛡️ ${defender.name} automatically attempts to parry!`, "info");
          
          // Apply fatigue penalties to defense rolls
          const fatiguedDefender = applyFatiguePenalties(defender);
          const fatigueDefensePenalty = fatiguedDefender.bonuses?.parry || 0;
          
          // Get base parry bonus
          let defenseBonus = (getCombatBonus(defender, "parry", defender.weaponSlots?.leftHand || defender.weaponSlots?.rightHand || defender.weapon || null) || 0) + fatigueDefensePenalty;
          
          // Apply grapple penalties to defense rolls
          const grappleStatus = getGrappleStatus(defender);
          const grappleDefensePenalty = grappleStatus.penalties.parry || 0;
          defenseBonus += grappleDefensePenalty;
          
          // Get size modifier penalty for defender
          const sizeMod = getCombinedGrappleModifiers(attacker, defender);
          defenseBonus += sizeMod.defenderParryPenalty || 0;
          
          // Apply reach-based parry modifiers (with combat distance)
          if (combatTerrain && positions && positions[attacker.id] && positions[defender.id]) {
            const attackerWeapon = attackData;
            const defenderWeapon = defender.equippedWeapons?.primary || defender.equippedWeapons?.secondary || null;
            
            if (attackerWeapon && defenderWeapon) {
              const hasClosed = hasClosedDistance(defender, attacker, combatStateRef.current);
              const isFlanking = bonusModifiers.flankingBonus > 0;
              const combatDistance = calculateDistance(positions[attacker.id], positions[defender.id]);
              
              const reachParryMods = getReachParryModifiers(
                defenderWeapon,
                attackerWeapon,
                hasClosed,
                isFlanking,
                combatDistance
              );
              
              defenseBonus += reachParryMods.parry;
              if (reachParryMods.notes.length > 0) {
                reachParryMods.notes.forEach(note => {
                  addLog(`⚔️ ${note}`, "info");
                });
              }
            }
          }
          
          // Format dice formula correctly (handle negative bonuses)
          const defenseDiceFormula = defenseBonus >= 0 ? `1d20+${defenseBonus}` : `1d20`;
          const defenseBonusParam = defenseBonus >= 0 ? 0 : defenseBonus;
          const defenseRollResult = CryptoSecureDice.parseAndRoll(defenseDiceFormula, defenseBonusParam);
          const defenseRoll = defenseRollResult.totalWithBonus;
          const defenseDiceRoll = defenseRollResult.diceRolls?.[0]?.result || defenseRoll;
          
          // Store defense roll in diceRolls
          setDiceRolls(prev => [...prev, {
            id: generateCryptoId(),
            type: 'defense',
            defender: defender.name,
            defenseType: 'Parry',
            roll: defenseDiceRoll,
            total: defenseRoll,
            bonus: defenseBonus,
            timestamp: new Date().toLocaleTimeString()
          }]);
          
          addLog(`🛡️ ${defender.name} parries! Rolls ${defenseDiceRoll} + ${defenseBonus} = ${defenseRoll}`, "info");
          
          if (defenseRoll >= attackRoll) {
            defenseSuccess = true;
            addLog(`✨ ${defender.name} successfully parries the attack!`, "success");
            
            // Deduct one attack for the parry
            setFighters(prev => prev.map(f => 
              f.id === defender.id 
                ? { ...f, remainingAttacks: Math.max(0, (f.remainingAttacks || 0) - 1) }
                : f
            ));
          } else {
            addLog(`❌ ${defender.name}'s parry fails (${defenseRoll} < ${attackRoll}) - attack hits!`, "warning");
            
            // Deduct one attack for the failed parry attempt
            setFighters(prev => prev.map(f => 
              f.id === defender.id 
                ? { ...f, remainingAttacks: Math.max(0, (f.remainingAttacks || 0) - 1) }
                : f
            ));
          }
        }
      }
      
      // Check if this is a charge attack and if defender can dodge
      const isChargeAttack = bonusModifiers?.strikeBonus >= 2 || bonusModifiers.strikeBonus >= 2;
      let canDodge = true;
      
      if (isChargeAttack && defenseType === "Dodge" && combatTerrain && positions && positions[defender.id]) {
        const terrainWidth = getDynamicWidth(
          combatTerrain.terrain,
          getActorsInProximity(positions[defender.id], fighters, positions, 2),
          {
            attackerPos: positions[defender.id],
            positions: positions
          }
        );
        
        // Check if defender can dodge the charge
        const dodgeCheck = canDodgeCharge(defender, attacker, terrainWidth);
        canDodge = dodgeCheck.canDodge;
        
        if (!canDodge) {
          addLog(`⚠️ ${dodgeCheck.reason} - ${defender.name} cannot Dodge!`, "warning");
          // Force defender to use Parry instead if they have a weapon, or take the hit
          if (defender.equippedWeapons?.primary || defender.equippedWeapons?.secondary) {
            defenseType = "Parry";
            addLog(`⚔️ ${defender.name} attempts Parry instead (at -2 penalty)`, "info");
          } else {
            // No weapon/shield - must take the hit
            addLog(`❌ ${defender.name} has no weapon/shield - cannot defend against charge!`, "error");
            defenseType = null; // Force defense failure
          }
        }
      }
      
      // Only process regular defense if auto-parry hasn't already handled it
      if (defenseType && attackRoll >= targetAR && !autoParryUsed) {
        // Check if defender has attacks remaining to parry/dodge
        if (defender.remainingAttacks <= 0) {
          addLog(`⚠️ ${defender.name} is out of attacks and cannot ${defenseType.toLowerCase()}!`, "error");
        } else {
          // Defender is using parry, dodge, or move - roll defense!
          // Apply fatigue penalties to defense rolls
          const fatiguedDefender = applyFatiguePenalties(defender);
          const fatigueDefensePenalty = fatiguedDefender.bonuses?.[defenseType.toLowerCase()] || 0;
          
          let defenseBonus = 0;
          
          // Apply grapple penalties to defense rolls
          const grappleStatus = getGrappleStatus(defender);
          const grappleDefensePenalty = grappleStatus.penalties[defenseType.toLowerCase()] || 0;
          
          // Get size modifier penalty for defender (smaller = harder to defend)
          const sizeMod = getCombinedGrappleModifiers(attacker, defender);
          const sizeDefensePenalty = defenseType === "Parry" 
            ? sizeMod.defenderParryPenalty 
            : sizeMod.defenderDodgePenalty;
          
          if (defenseType === "Move") {
            // Move gives +1 to dodge
            defenseBonus = (getCombatBonus(defender, "dodge", defender.weaponSlots?.leftHand || defender.weaponSlots?.rightHand || defender.weapon || null) || 0) + 1 + fatigueDefensePenalty + grappleDefensePenalty + sizeDefensePenalty;
          } else {
            defenseBonus = (getCombatBonus(defender, defenseType.toLowerCase(), defender.weaponSlots?.leftHand || defender.weaponSlots?.rightHand || defender.weapon || null) || 0) + fatigueDefensePenalty + grappleDefensePenalty + sizeDefensePenalty;
            
            // Apply reach-based parry modifiers (with combat distance)
            if (defenseType === "Parry" && combatTerrain && positions && positions[attacker.id] && positions[defender.id]) {
              const attackerWeapon = attackData;
              const defenderWeapon = defender.equippedWeapons?.primary || defender.equippedWeapons?.secondary || null;
              
              if (attackerWeapon && defenderWeapon) {
                const hasClosed = hasClosedDistance(defender, attacker, combatStateRef.current);
                const isFlanking = bonusModifiers.flankingBonus > 0;
                const combatDistance = calculateDistance(positions[attacker.id], positions[defender.id]);
                
                const reachParryMods = getReachParryModifiers(
                  defenderWeapon,
                  attackerWeapon,
                  hasClosed,
                  isFlanking,
                  combatDistance
                );
                
                defenseBonus += reachParryMods.parry;
                if (reachParryMods.notes.length > 0) {
                  reachParryMods.notes.forEach(note => {
                    addLog(`⚔️ ${note}`, "info");
                  });
                }
              }
            }
            
            // Apply reach-based dodge modifiers
            if (defenseType === "Dodge" && combatTerrain && positions && positions[attacker.id] && positions[defender.id]) {
              const defenderWeapon = defender.equippedWeapons?.primary || defender.equippedWeapons?.secondary || null;
              
              if (defenderWeapon) {
                const terrainWidth = getDynamicWidth(
                  combatTerrain.terrain,
                  getActorsInProximity(positions[defender.id], fighters, positions, 2),
                  {
                    attackerPos: positions[defender.id],
                    positions: positions
                  }
                );
                const terrainHeight = getDynamicHeight(combatTerrain.terrain, getActorsInProximity(positions[defender.id], fighters, positions, 2));
                const terrainData = TERRAIN_TYPES[combatTerrain.terrain];
                const terrainDensity = terrainData?.density || 0;
                const isTightCombat = terrainWidth < 10;
                
                const reachDodgeMods = getReachDodgeModifiers(defenderWeapon, terrainWidth, terrainHeight, terrainDensity, isTightCombat);
                defenseBonus += reachDodgeMods.dodge;
                if (reachDodgeMods.notes.length > 0) {
                  reachDodgeMods.notes.forEach(note => {
                    addLog(`🏃 ${note}`, "info");
                  });
                }
              }
            }
            
            // Charge attack parry penalty (if defender cannot dodge)
            if (isChargeAttack && defenseType === "Parry" && !canDodge) {
              defenseBonus -= 2;
              addLog(`💥 Parry penalty due to charge momentum (-2 parry)`, "warning");
            }
          }
          
          // Format dice formula correctly (handle negative bonuses)
          // The dice parser only accepts + in the formula, so use the bonus parameter for negatives
          const defenseDiceFormula = defenseBonus >= 0 ? `1d20+${defenseBonus}` : `1d20`;
          const defenseBonusParam = defenseBonus >= 0 ? 0 : defenseBonus; // Pass negative as bonus parameter
          const defenseRollResult = CryptoSecureDice.parseAndRoll(defenseDiceFormula, defenseBonusParam);
          const defenseRoll = defenseRollResult.totalWithBonus;
          const defenseDiceRoll = defenseRollResult.diceRolls?.[0]?.result || defenseRoll;
          
          // Store defense roll in diceRolls
          setDiceRolls(prev => [...prev, {
            id: generateCryptoId(),
            type: 'defense',
            defender: defender.name,
            defenseType: defenseType,
            roll: defenseDiceRoll,
            total: defenseRoll,
            bonus: defenseBonus,
            timestamp: new Date().toLocaleTimeString()
          }]);
          
          const defenseActionText = defenseType === "Move" ? "evades (moved)" : `${defenseType}s`;
          addLog(`🛡️ ${defender.name} ${defenseActionText}! Rolls ${defenseDiceRoll} + ${defenseBonus} = ${defenseRoll}`, "info");
          
          if (defenseRoll >= attackRoll) {
            defenseSuccess = true;
            addLog(`✨ ${defender.name} successfully ${defenseType.toLowerCase()}s the attack!`, "success");
            
            // If dodging, move to a neighboring hex
            if (defenseType === "Dodge" && positions[defender.id] && positions[attacker.id]) {
              const defenderPos = positions[defender.id];
              const attackerPos = positions[attacker.id];
              
              // Get all neighboring hexes
              const neighbors = getHexNeighbors(defenderPos.x, defenderPos.y);
              
              // Find available neighboring hexes (prefer moving away from attacker)
              const availableNeighbors = neighbors.filter(neighbor => {
                // Check if hex is not occupied
                const occupant = isHexOccupied(neighbor.x, neighbor.y, defender.id);
                return !occupant;
              });
              
              if (availableNeighbors.length > 0) {
                // Prefer moving away from attacker
                let bestNeighbor = availableNeighbors[0];
                let maxDistance = calculateDistance(availableNeighbors[0], attackerPos);
                
                for (const neighbor of availableNeighbors) {
                  const distance = calculateDistance(neighbor, attackerPos);
                  if (distance > maxDistance) {
                    maxDistance = distance;
                    bestNeighbor = neighbor;
                  }
                }
                
                // Move defender to the selected neighboring hex
                setTimeout(() => {
                  handlePositionChange(defender.id, bestNeighbor, {
                    type: "dodge",
                    description: "Dodged to avoid attack"
                  });
                  addLog(`🏃 ${defender.name} dodges to neighboring hex (${bestNeighbor.x}, ${bestNeighbor.y})!`, "info");
                }, 500);
              } else {
                // No available neighboring hexes - can't move but dodge still succeeds
                addLog(`⚠️ ${defender.name} successfully dodges but cannot move (no available hexes nearby)`, "info");
              }
            }
          } else {
            addLog(`💥 ${defender.name}'s ${defenseType.toLowerCase()} fails! (${defenseRoll} < ${attackRoll})`, "info");
          }
          
          // Deduct 1 attack for defensive action
          updated[defenderIndex].remainingAttacks = Math.max(0, (updated[defenderIndex].remainingAttacks || 0) - 1);
          addLog(`${defender.name} used 1 attack to defend (${updated[defenderIndex].remainingAttacks}/${defender.attacksPerMelee} remaining)`, "info");
        }
        
        // Clear defensive stance after it's used (one-time use per turn)
        setDefensiveStance(prev => {
          const updated = { ...prev };
          delete updated[defender.id];
          return updated;
        });
      }
      
      const didHit =
        !isCriticalMiss && (isCriticalHit || attackRoll >= targetAR) && !defenseSuccess;

      if (isProjectileAttack) {
        spawnProjectile({
          attackerId: attacker.id,
          defenderId,
          attackData,
          hit: didHit,
        });
      }
      
      // Critical miss auto-fails
      if (isCriticalMiss) {
        addLog(`❌ ${attacker.name} FUMBLES the attack!`, "miss");
        setFighters(updated);
        endTurn();
        return;
      }
      // Critical hit auto-succeeds, normal hit requires beating AR
      if (didHit) {
        // Hit! Crypto secure damage roll
        const damageBonus = attacker.bonuses?.damage || 0;
        
        // Ensure damageBonus is a valid number
        const safeDamageBonus = typeof damageBonus === 'number' && !isNaN(damageBonus) ? damageBonus : 0;
        
        // Helper function to parse damage formula and extract existing bonus
        const parseDamageFormula = (damageStr) => {
          if (!damageStr || typeof damageStr !== 'string') {
            return { baseFormula: '1d6', existingBonus: 0 };
          }
          
          // Check if formula already has a bonus (e.g., "1d8+2")
          const bonusMatch = damageStr.match(/^(\d+d\d+)\+(\d+)$/);
          if (bonusMatch) {
            return {
              baseFormula: bonusMatch[1],
              existingBonus: parseInt(bonusMatch[2])
            };
          }
          
          // Check if it's just dice notation without bonus (e.g., "1d8" or "2d6")
          const diceMatch = damageStr.match(/^(\d+d\d+)$/);
          if (diceMatch) {
            return {
              baseFormula: diceMatch[1],
              existingBonus: 0
            };
          }
          
          // No match - return as-is with no bonus
          return { baseFormula: damageStr, existingBonus: 0 };
        };
        
        // Use crypto dice for damage roll
        let damageRollResult;
        const loggedDamageSource = preRoll?.damageFormula ?? attackData.damage;
        
        // Log attack data for debugging
        console.log(`Attack data for ${attacker.name}:`, attackData);
        
        // Handle "by weapon" damage - resolve to actual weapon damage
        if (attackData.damage && typeof attackData.damage === 'string' && attackData.damage.toLowerCase().includes('by weapon')) {
          // Get equipped weapon
          const equippedWeapon = attacker.equippedWeapons?.[0] || 
                                 attacker.equippedWeapons?.primary || 
                                 attacker.equippedWeapons?.secondary ||
                                 (attacker.equippedWeapon ? { name: attacker.equippedWeapon, damage: null } : null);
          
          if (equippedWeapon) {
            // Check if weapon is being used two-handed
            const isUsingTwoHanded = equippedWeapon.twoHanded || isTwoHandedWeapon(equippedWeapon);
            // Use getWeaponDamage to properly calculate damage with two-handed bonuses and weapon size modifiers
            const weaponDamage = getWeaponDamage(equippedWeapon, isUsingTwoHanded, attacker);
            attackData.damage = weaponDamage;
            addLog(`⚔️ Using weapon damage: ${weaponDamage} from ${equippedWeapon.name}`, "info");
          } else {
            // No weapon equipped, use unarmed damage
            attackData.damage = "1d3";
            addLog(`⚠️ No weapon equipped, using unarmed damage: 1d3`, "info");
          }
        }
        
        if (preRoll?.damageTotal != null) {
          damageRollResult = {
            totalWithBonus: preRoll.damageTotal,
            diceRolls: preRoll.damageDiceRolls || [],
          };
        } else if (attackData.damage && typeof attackData.damage === 'string' && attackData.damage.includes('d')) {
          // Parse damage like "1d4" or "2d6" or "1d8+2"
          const parsed = parseDamageFormula(attackData.damage);
          const totalBonus = parsed.existingBonus + safeDamageBonus;
          
          // Build formula: if total bonus is positive, include it; if negative, use bonus parameter
          const damageFormula = totalBonus >= 0 ? `${parsed.baseFormula}+${totalBonus}` : parsed.baseFormula;
          const damageBonusParam = totalBonus >= 0 ? 0 : totalBonus;
            damageRollResult = CryptoSecureDice.parseAndRoll(damageFormula, damageBonusParam);
        } else if (attackData.damage && typeof attackData.damage === 'string' && attackData.damage.includes('-')) {
          // Parse damage like "1-8+2" (convert to "1d8+2")
          const convertedDamage = attackData.damage.replace('-', 'd');
          addLog(`⚠️ Converting damage format ${attackData.damage} to ${convertedDamage}`, "info");
          const parsed = parseDamageFormula(convertedDamage);
          const totalBonus = parsed.existingBonus + safeDamageBonus;
          
          const damageFormula = totalBonus >= 0 ? `${parsed.baseFormula}+${totalBonus}` : parsed.baseFormula;
          const damageBonusParam = totalBonus >= 0 ? 0 : totalBonus;
          damageRollResult = CryptoSecureDice.parseAndRoll(damageFormula, damageBonusParam);
        } else if (attackData.damage && !isNaN(attackData.damage)) {
          // Numeric damage value - convert to dice roll (1d6 per 3 points of damage, minimum 1d4)
          const numericDamage = parseInt(attackData.damage);
          const diceCount = Math.max(1, Math.floor(numericDamage / 3));
          const diceSize = numericDamage <= 3 ? 4 : 6;
          const damageFormula = `${diceCount}d${diceSize}`;
          addLog(`⚠️ Converting numeric damage ${numericDamage} to ${damageFormula}`, "info");
          const totalBonus = safeDamageBonus;
          
          const bonusFormula = totalBonus >= 0 ? `${damageFormula}+${totalBonus}` : damageFormula;
          const damageBonusParam = totalBonus >= 0 ? 0 : totalBonus;
            damageRollResult = CryptoSecureDice.parseAndRoll(bonusFormula, damageBonusParam);
        } else if (attackData.damage && attackData.damage.toLowerCase().includes('special')) {
          // Special damage (e.g., "special (varies by head)") - use high damage for powerful special attacks
          addLog(`⚠️ Special attack damage, using 3d6 base`, "info");
          const totalBonus = safeDamageBonus;
          
          const damageFormula = totalBonus >= 0 ? `3d6+${totalBonus}` : '3d6';
          const damageBonusParam = totalBonus >= 0 ? 0 : totalBonus;
            damageRollResult = CryptoSecureDice.parseAndRoll(damageFormula, damageBonusParam);
        } else {
          // Fallback to 1d6 if damage is undefined or invalid
          addLog(`⚠️ Invalid damage value, using 1d6`, "info");
          const totalBonus = safeDamageBonus;
          
          const damageFormula = totalBonus >= 0 ? `1d6+${totalBonus}` : '1d6';
          const damageBonusParam = totalBonus >= 0 ? 0 : totalBonus;
            damageRollResult = CryptoSecureDice.parseAndRoll(damageFormula, damageBonusParam);
        }
        
        let damage = damageRollResult.totalWithBonus;
        
        // Optional extra damage dice from action modifiers (e.g., dive attack momentum)
        let extraDamageFromDive = 0;
        if (bonusModifiers?.extraDamageDice) {
          try {
            const extraRoll = CryptoSecureDice.parseAndRoll(bonusModifiers.extraDamageDice);
            extraDamageFromDive = extraRoll.totalWithBonus || 0;
            damage += extraDamageFromDive;
            addLog(`🪽 Bonus damage: ${bonusModifiers.extraDamageDice} = ${extraDamageFromDive}`, "info");
          } catch (e) {
            if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
              console.warn('[attack] extraDamageDice parse failed:', e);
            }
          }
        }
        
        // Critical hit doubles damage!
        if (isCriticalHit) {
          const baseDamageBeforeCrit = damage;
          damage = damage * 2;
          // Calculate total bonus for logging (existing bonus + damage bonus)
          const parsedDamage = parseDamageFormula(loggedDamageSource);
          const totalBonusForLog = parsedDamage.existingBonus + safeDamageBonus;
          const extraText = extraDamageFromDive > 0 ? ` + ${extraDamageFromDive}` : "";
          addLog(`🎲 Damage: ${parsedDamage.baseFormula} + ${totalBonusForLog}${extraText} = ${baseDamageBeforeCrit} × 2 (CRITICAL) = ${damage}`, "critical");
        } else {
          // Calculate total bonus for logging
          const parsedDamage = parseDamageFormula(loggedDamageSource);
          const totalBonusForLog = parsedDamage.existingBonus + safeDamageBonus;
          const extraText = extraDamageFromDive > 0 ? ` + ${extraDamageFromDive}` : "";
          addLog(`🎲 Damage: ${parsedDamage.baseFormula} + ${totalBonusForLog}${extraText} = ${damage}`, "info");
        }
        
        // Calculate damage with multipliers
        let finalDamage = damage;
        
        // Apply sneak attack damage multiplier (if applicable)
        if (sneakDamageMultiplier > 1) {
          finalDamage = Math.floor(damage * sneakDamageMultiplier);
          addLog(`🗡️ Sneak attack multiplies damage: ${damage} × ${sneakDamageMultiplier} = ${finalDamage}`, "combat");
        }
        
        // Apply charge damage multiplier
        if (bonusModifiers.damageMultiplier && bonusModifiers.damageMultiplier > 1) {
          finalDamage = Math.floor(finalDamage * bonusModifiers.damageMultiplier);
          addLog(`💥 Charge momentum multiplies damage: ${damage} × ${bonusModifiers.damageMultiplier} = ${finalDamage}`, "critical");
        }
        
        // Apply wall crush damage for narrow passages
        if (combatTerrain && positions && positions[defender.id]) {
          const terrainWidth = getDynamicWidth(
            combatTerrain.terrain,
            getActorsInProximity(positions[defender.id], fighters, positions, 2),
            {
              attackerPos: positions[defender.id],
              positions: positions
            }
          );
          const terrainHeight = getDynamicHeight(combatTerrain.terrain, fighters);
          const terrainData = TERRAIN_TYPES[combatTerrain.terrain] || {};
          const isChargeAttack = bonusModifiers?.strikeBonus >= 2 || bonusModifiers.strikeBonus >= 2;
          
          // Narrow passage + charge = wall crush (use getCollisionMomentumDamage for proper calculation)
          if ((terrainWidth <= 6 || getEnvironmentCategory(terrainWidth, terrainHeight) === "NARROW_TRAIL") && 
              isChargeAttack && !defenseSuccess) {
            // Use getCollisionMomentumDamage for proper collision damage calculation
            const collisionDamage = getCollisionMomentumDamage(
              attacker,
              defender,
              terrainWidth,
              terrainHeight,
              terrainData?.density || 0,
              terrainData?.hasObstructions || false
            );
            finalDamage += collisionDamage.damage;
            if (collisionDamage.notes && collisionDamage.notes.length > 0) {
              collisionDamage.notes.forEach(note => {
                addLog(`💥 ${note}`, "critical");
              });
            } else {
              addLog(`💥 Wall/Tree Crush! +${collisionDamage.damage} damage (crushed against ${terrainWidth <= 6 ? 'wall' : 'tree'})`, "critical");
            }
          }
        }
        
        // Allow HP to go negative for coma rules
        const startingHP = getFighterHP(defender);
        const newHP = clampHP(startingHP - finalDamage, defender);
        applyHPToFighter(defender, newHP);
        
        // ✅ OPTION B: Dive-hit auto-grapple (talon grab)
        try {
          const isDiveAttack =
            bonusModifiers?.source === "DIVE_ATTACK" ||
            bonusModifiers?.source === "DIVE" ||
            bonusModifiers?.diveAttack === true;

          const nameStr = (attacker?.species || attacker?.name || "").toLowerCase();
          const isPredBird =
            nameStr.includes("hawk") ||
            nameStr.includes("eagle") ||
            nameStr.includes("falcon") ||
            nameStr.includes("owl");

          // Only grapple if the strike hit AND target is still alive
          if (isDiveAttack && isPredBird && newHP > 0) {
            const attInUpdated = updated[attackerIndex];
            const defInUpdated = updated[defenderIndex];

            const attStatus = getGrappleStatus(attInUpdated);
            const defStatus = getGrappleStatus(defInUpdated);

            // Don't re-init if already grappling
            if (attStatus.state === GRAPPLE_STATES.NEUTRAL && defStatus.state === GRAPPLE_STATES.NEUTRAL) {
              // Ensure grapple states exist
              if (!attInUpdated.grappleState) attInUpdated.grappleState = initializeGrappleState(attInUpdated);
              if (!defInUpdated.grappleState) defInUpdated.grappleState = initializeGrappleState(defInUpdated);

              // Hawk grabs prey on contact
              attInUpdated.grappleState = {
                ...attInUpdated.grappleState,
                state: GRAPPLE_STATES.CLINCH,
                opponent: defInUpdated.id,
                hasGrappleAdvantage: true, // your existing +2 bonus is consumed next attack
                canUseLongWeapons: false,
              };

              defInUpdated.grappleState = {
                ...defInUpdated.grappleState,
                state: GRAPPLE_STATES.GRAPPLED,
                opponent: attInUpdated.id,
                penalties: { strike: -2, parry: -3, dodge: -4 },
                canUseLongWeapons: false,
              };

              addLog(`🪝 ${attInUpdated.name} hooks ${defInUpdated.name} in a talon-grab grapple!`, "combat");
            }
          }
        } catch (e) {
          console.warn("Dive grapple hook failed:", e);
        }
        
        // 🧊 Pain Stagger + Morale System Integration
        let defenderAfterHit = { ...defender };
        let bigPainHit = false;
        
        // 1) Pain stagger (only if enabled)
        if (settings.usePainStagger) {
          const painResult = applyPainStagger({
            defender: defenderAfterHit,
            damageDealt: finalDamage,
            weapon: attackData,
            addLog: addLog,
          });
          
          if (painResult.updatedDefender) {
            defenderAfterHit = painResult.updatedDefender;
          }
          bigPainHit = painResult.painTriggered;
        }
        
        // 2) Morale check (only if enabled and defender is not incapacitated)
        if (settings.useMoraleRouting && canFighterAct(defenderAfterHit)) {
          const maxHP = defenderAfterHit.maxHP || defenderAfterHit.totalHP || defenderAfterHit.currentHP || 1;
          const hpPercent = maxHP > 0 ? defenderAfterHit.currentHP / maxHP : 1;
          
          const alliesDownRatio = getAlliesDownRatio(updated, defenderAfterHit);
          
          // Check if defender already failed a horror check this round
          // (horrorFailed would be set if horror was checked earlier in the attack flow)
          const horrorFailed = defenderAfterHit.meta?.horrorFailedRound === meleeRound ||
                               defenderAfterHit.statusEffects?.includes("HORROR_SHOCKED");
          
          const moraleOutcome = resolveMoraleCheck(defenderAfterHit, {
            roundNumber: meleeRound || 0,
            reason: bigPainHit ? "pain_hit" : "damage",
            hpPercent: hpPercent,
            alliesDownRatio: alliesDownRatio,
            horrorFailed: horrorFailed,
            bigPainHit: bigPainHit,
          });
          
          defenderAfterHit = {
            ...defenderAfterHit,
            moraleState: moraleOutcome.moraleState,
          };
          
          if (moraleOutcome.moraleState.status === "ROUTED") {
            addLog(`🏃 ${defenderAfterHit.name} breaks and ROUTES!`, "warning");
          } else if (
            moraleOutcome.moraleState.status === "SHAKEN" &&
            moraleOutcome.result &&
            !moraleOutcome.success
          ) {
            addLog(`😨 ${defenderAfterHit.name} is SHAKEN by the attack!`, "info");
          }
        }
        
        // 3) Replace original defender in updated array with defenderAfterHit
        updated[defenderIndex] = defenderAfterHit;
        // Use defenderAfterHit directly instead of reassigning const defender
        
        // ✅ CRITICAL: Check for victory condition AFTER damage is applied
        if (defenderAfterHit.type === "enemy") {
          // Defender already updated in array above
          
          // Check if there are any conscious enemies remaining
          const remainingConsciousEnemies = updated.filter(f => f.type === "enemy" && canFighterAct(f));
          
          if (remainingConsciousEnemies.length === 0 && !combatEndCheckRef.current) {
            // All enemies are defeated - end combat immediately
            combatEndCheckRef.current = true;
            combatOverRef.current = true; // ✅ AUTHORITATIVE: Set combat over flag
            addLog("🎉 Victory! All enemies defeated!", "victory");
            setCombatActive(false);
            
            // ✅ CRITICAL: Clear ALL pending timeouts to stop post-victory actions
            if (turnTimeoutRef.current) {
              clearTimeout(turnTimeoutRef.current);
              turnTimeoutRef.current = null;
            }
            allTimeoutsRef.current.forEach(clearTimeout);
            allTimeoutsRef.current = [];
            
            // Update fighters state and return early to prevent further processing
            setFighters(updated);
            return;
          }
        }
        
        // Check for braced weapon counter-damage (spear/polearm vs charge on natural 18-20)
        const defenderWeapon = defenderAfterHit.equippedWeapons?.primary || defenderAfterHit.equippedWeapons?.secondary || null;
        const isBraced = defensiveStance[defenderAfterHit.id] === "Brace" || 
                        (defenseType === "Parry" && defenderWeapon && (defenderWeapon.name?.toLowerCase().includes("spear") || 
                              defenderWeapon.name?.toLowerCase().includes("pike") ||
                              defenderWeapon.name?.toLowerCase().includes("polearm") ||
                              defenderWeapon.name?.toLowerCase().includes("lance")));
        
        if (isBraced && bonusModifiers.damageMultiplier >= 2 && defenderWeapon) {
          const attackDiceRoll = attackRollResult.diceRolls?.[0]?.result || attackRoll - strikeBonus;
          if (attackDiceRoll >= 18 && attackDiceRoll <= 20) {
            // Braced weapon counter-damage
            const counterDamage = Math.floor(finalDamage / 3); // Attacker takes 1/3 of damage
            addLog(`⚔️ ${defender.name}'s braced ${defenderWeapon.name} impales ${attacker.name} for ${counterDamage} damage!`, "critical");
            // Apply counter-damage to attacker
            const attackerInUpdated = updated.find(f => f.id === attacker.id);
            if (attackerInUpdated) {
              attackerInUpdated.currentHP = (attackerInUpdated.currentHP || attackerInUpdated.maxHP) - counterDamage;
              if (attackerInUpdated.currentHP <= 0) {
                const attackerHPStatus = getHPStatus(attackerInUpdated.currentHP);
                if (attackerInUpdated.currentHP <= -21) {
                  addLog(`💀 ${attacker.name} is KILLED by the counter-attack!`, "defeat");
                } else if (attackerInUpdated.currentHP <= -11) {
                  addLog(`⚠️ ${attacker.name} is CRITICALLY wounded by the counter-attack!`, "defeat");
                } else if (attackerInUpdated.currentHP <= -1) {
                  addLog(`🩸 ${attacker.name} is DYING from the counter-attack!`, "defeat");
                } else {
                  addLog(`😴 ${attacker.name} is knocked unconscious by the counter-attack!`, "defeat");
                }
              }
            }
          }
        }
        
        // Knockdown check for massive attackers (2x defender weight) in charges
        if (bonusModifiers.damageMultiplier >= 2 && !defenseSuccess) {
          const attackerWeight = attacker.weight || 150;
          const defenderWeight = defenderAfterHit.weight || 150;
          if (attackerWeight >= defenderWeight * 2) {
            // Roll P.E. check for knockdown
            const peCheck = defenderAfterHit.PE || defenderAfterHit.pe || defenderAfterHit.attributes?.PE || defenderAfterHit.attributes?.pe || 10;
            const peRoll = CryptoSecureDice.parseAndRoll("1d20").totalWithBonus;
            if (peRoll > peCheck) {
              addLog(`💥 ${defenderAfterHit.name} is knocked down! (P.E. ${peCheck} < roll ${peRoll}) - loses 1 action to recover`, "warning");
              // Deduct 1 action from defender
              updated[defenderIndex].remainingAttacks = Math.max(0, (updated[defenderIndex].remainingAttacks || 0) - 1);
            } else {
              addLog(`💪 ${defenderAfterHit.name} resists knockdown! (P.E. ${peCheck} >= roll ${peRoll})`, "info");
            }
          }
        }
        
        // Check if flying character should fall (HP <= 0 means they can't maintain flight)
        // Only check if they were flying before and now are unconscious/dying
        if (isFlying(defenderAfterHit) && defenderAfterHit.currentHP <= 0) {
          const currentAltitude = getAltitude(defenderAfterHit) || 0;
          if (currentAltitude > 0) {
            addLog(`💥 ${defenderAfterHit.name} is hit and plummets ${currentAltitude}ft to the ground!`, "warning");
            
            // Apply fall damage
            const afterFall = applyFallDamage(defenderAfterHit, currentAltitude, addLog);
            defenderAfterHit = {
              ...afterFall,
              isFlying: false,
              altitude: 0,
              altitudeFeet: 0,
              aiFlightState: null,
            };
            
            // Update in the array
            updated[defenderIndex] = defenderAfterHit;
          }
        }
        
        // Determine HP status based on coma rules
        const hpStatus = getHPStatus(defenderAfterHit.currentHP);
        
        // Check if defender is defeated (unconscious or worse)
        if (defenderAfterHit.currentHP <= 0) {
          defenderAfterHit.status = "defeated";
          updated[defenderIndex] = defenderAfterHit; // Update status in array
          
          if (defenderAfterHit.currentHP <= -21) {
            addLog(`💀 ${defenderAfterHit.name} has been KILLED! (${hpStatus.description})`, "defeat");
            // Reset grapple state when fighter dies
            resetGrapple(defenderAfterHit);
          } else if (defenderAfterHit.currentHP <= -11) {
            addLog(`⚠️ ${defenderAfterHit.name} is CRITICALLY wounded! ${hpStatus.description}`, "defeat");
          } else if (defenderAfterHit.currentHP <= -1) {
            addLog(`🩸 ${defenderAfterHit.name} is DYING! ${hpStatus.description}`, "defeat");
          } else {
            addLog(`😴 ${defenderAfterHit.name} has been knocked unconscious!`, "defeat");
          }
          
          // ✅ CRITICAL: Check for victory condition AFTER damage is applied
          if (defenderAfterHit.type === "enemy") {
            // Defender already updated in array above
            
            // Check if there are any conscious enemies remaining
            const remainingConsciousEnemies = updated.filter(f => f.type === "enemy" && canFighterAct(f));
            
            if (remainingConsciousEnemies.length === 0 && !combatEndCheckRef.current) {
              // All enemies are defeated - end combat immediately
              combatEndCheckRef.current = true;
              combatOverRef.current = true; // ✅ AUTHORITATIVE: Set combat over flag
              addLog("🎉 Victory! All enemies defeated!", "victory");
              setCombatActive(false);
              
              // ✅ CRITICAL: Clear ALL pending timeouts to stop post-victory actions
              if (turnTimeoutRef.current) {
                clearTimeout(turnTimeoutRef.current);
                turnTimeoutRef.current = null;
              }
              allTimeoutsRef.current.forEach(clearTimeout);
              allTimeoutsRef.current = [];
              
              // Update fighters state and return early to prevent further processing
              setFighters(updated);
              return;
            }
          }
          
          // Award XP if an enemy was defeated by players (only if dead, not just unconscious)
          if (defenderAfterHit.type === "enemy" && defenderAfterHit.currentHP <= -21) {
            // Don't use canFighterAct() as the definition of "alive player." For defeat, use HP + status
            const alivePlayers = updated.filter(
              (f) => f.type === "player" && f.status !== "defeated" && f.status !== "fled" && getFighterHP(f) > 0
            );
            if (alivePlayers.length > 0) {
              // Find enemy in bestiary for XP calculation using getMonsterByName
              const enemyData = getMonsterByName(defenderAfterHit.name, bestiary) || getAllBestiaryEntries(bestiary)?.find(m => 
                m.name.toLowerCase() === defenderAfterHit.name.toLowerCase()
              );
              
              // Calculate XP reward
              const xpReward = enemyData?.XPValue || calculateMonsterXP(enemyData || defenderAfterHit);
              const xpPerPlayer = Math.floor(xpReward / alivePlayers.length);
              
              // Use grantXPFromEnemy to properly award XP (returns updated characters, but we'll log for now)
              // Note: grantXPFromEnemy updates character XP, but we're just logging for now
              try {
                // Try to grant XP (will update characters if XP system is fully integrated)
                grantXPFromEnemy(alivePlayers[0], enemyData || defender, alivePlayers);
              } catch (error) {
                // If grantXPFromEnemy fails, just log the XP
                console.warn('[CombatPage] grantXPFromEnemy failed:', error);
                console.log('[CombatPage] grantXPFromEnemy not fully integrated, logging XP only');
              }
              
              addLog(`💰 ${xpReward} XP awarded! (${xpPerPlayer} XP each for ${alivePlayers.length} player${alivePlayers.length > 1 ? 's' : ''})`, "reward");
              
              // TODO: Actually update character XP in database/localStorage
              // For now, just log it
            }
          }
          
          // ✅ FIX: Immediately check for combat end after each death (synchronous check)
          // Check combat end immediately to prevent further attacks
          if (!combatEndCheckRef.current) {
            const consciousPlayers = updated.filter(f => f.type === "player" && canFighterAct(f));
            const consciousEnemies = updated.filter(f => f.type === "enemy" && canFighterAct(f));
                
                if (consciousPlayers.length === 0) {
                  combatEndCheckRef.current = true;
                  combatOverRef.current = true; // ✅ AUTHORITATIVE: Stop all further actions (defeat)
                  addLog("💀 All players are defeated! Enemies win!", "defeat");
                  setCombatActive(false);

                  // ✅ CRITICAL: Clear ALL pending timeouts to stop post-defeat actions
                  if (turnTimeoutRef.current) {
                    clearTimeout(turnTimeoutRef.current);
                    turnTimeoutRef.current = null;
                  }
                  allTimeoutsRef.current.forEach(clearTimeout);
                  allTimeoutsRef.current = [];

                  // Update fighters state immediately
                  setFighters(updated);
                  return;
                } else if (consciousEnemies.length === 0) {
                  combatEndCheckRef.current = true;
                  combatOverRef.current = true; // ✅ AUTHORITATIVE: Set combat over flag
                  addLog("🎉 Victory! All enemies defeated!", "victory");
                  setCombatActive(false);
                  
                  // ✅ CRITICAL: Clear ALL pending timeouts to stop post-victory actions
                  if (turnTimeoutRef.current) {
                    clearTimeout(turnTimeoutRef.current);
                    turnTimeoutRef.current = null;
                  }
                  allTimeoutsRef.current.forEach(clearTimeout);
                  allTimeoutsRef.current = [];
                  
                  // Update fighters state immediately
                  setFighters(updated);
                  return;
                }
          }
        }
      } else {
        addLog(`❌ ${attacker.name} misses ${defender.name}!`, "miss");
        
        // Dive attack miss consequence: momentum penalty
        if (bonusModifiers.tag === "DIVE_ATTACK" || bonusModifiers.source === "DIVE_ATTACK") {
          // Apply momentum penalty: -2 parry for 1 action
          if (attackerInArray) {
            // Store temporary penalty that will be applied on next action
            if (!attackerInArray.bonuses) attackerInArray.bonuses = {};
            if (!attackerInArray.bonuses.tempPenalties) attackerInArray.bonuses.tempPenalties = {};
            attackerInArray.bonuses.tempPenalties.parry = (attackerInArray.bonuses.tempPenalties.parry || 0) - 2;
            attackerInArray.bonuses.tempPenalties.diveMomentum = true; // Flag to clear after 1 action
            addLog(`⚠️ ${attacker.name} overcommits on the dive and is off-balance! (-2 parry until next action)`, "warning");
          }
        }
        
        // Check for heavy weapon recovery penalty
        const missMargin = attackRoll - targetAR;
        const recoveryCheck = getHeavyWeaponRecovery(attackData, missMargin);
        if (recoveryCheck.requiresRecovery) {
          recoveryCheck.notes.forEach(note => {
            addLog(`⚔️ ${note}`, "info");
          });
          
          // Deduct one additional attack for recovery
          if (attackerInArray) {
            attackerInArray.remainingAttacks = Math.max(0, (attackerInArray.remainingAttacks || 0) - 1);
            addLog(`⏱️ ${attacker.name} loses 1 action to recover stance (${attackerInArray.remainingAttacks}/${attackerInArray.attacksPerMelee} remaining)`, "info");
          }
        }
      }
    } catch (error) {
      console.error("Attack error:", error);
      console.error("Error details:", {
        message: error?.message,
        stack: error?.stack,
        attacker: attacker?.name,
        defenderId,
        attackData
      });
      addLog(`❌ Attack error for ${attacker.name}: ${error?.message || 'Unknown error'}`, "error");
    }
    
    // Deduct 1 attack from attacker (Strike costs 1 attack)
    if (attackerInArray) {
      attackerInArray.remainingAttacks = Math.max(0, (attackerInArray.remainingAttacks || 0) - 1);
      
      // Log remaining attacks
      if (attackerInArray.type === "player") {
        const attacksLeft = formatAttacksRemaining(attackerInArray.remainingAttacks, attackerInArray.attacksPerMelee);
        addLog(`${attacker.name} has ${attacksLeft} remaining`, "info");
      }
    }

    setFighters(updated);
    
    // ALWAYS end turn after each action - this ensures alternating action system
    // endTurn() will cycle to the next fighter with actions remaining
    // If this fighter still has actions, they'll get another turn after others act
    if (!bonusModifiers?.suppressEndTurn) {
      const timeoutId = setTimeout(() => {
        // ✅ GUARD: Check combat state in delayed callback (use ref for latest state)
        if (combatOverRef.current || !combatActive || combatEndCheckRef.current) return;
        endTurn();
      }, 1500);
      
      // ✅ Track this timeout so we can clear it on combat end
      allTimeoutsRef.current.push(timeoutId);
    }
  }, [
    fighters,
    addLog,
    endTurn,
    isPredatorBird,
    performDiveAttack,
    isFlying,
    spawnProjectile,
  ]);

  // Handle charge attack (move and attack with bonuses)
  const handleChargeAttack = useCallback((attacker, target) => {
    handleChargeAttackHandler(attacker, target, {
      positions,
      fighters,
      selectedAttackWeapon,
      combatTerrain,
      attack,
      addLog,
      setPositions,
      setFighters,
      positionsRef,
    });
  }, [fighters, positions, selectedAttackWeapon, combatTerrain, attack, addLog, setPositions, setFighters, positionsRef]);

  // Handle strike with movement (move then attack in one action)
  const handleStrikeWithMovement = useCallback((attacker, movementHex, target, weapon) => {
    handleStrikeWithMovementHandler(attacker, movementHex, target, weapon, {
      positions,
      selectedAttackWeapon,
      attack,
      addLog,
      setPositions,
      setSelectedMovementHex,
      setShowMovementSelection,
      positionsRef,
    });
  }, [positions, selectedAttackWeapon, attack, addLog, setPositions, setSelectedMovementHex, setShowMovementSelection, positionsRef]);
  
  // Handle RunActionLogger updates
  const handleRunActionUpdate = useCallback((updatedAttacker) => {
    handleRunActionUpdateHandler(updatedAttacker, {
      addLog,
      attack,
      fighters,
      setFighters,
      setPositions,
      positionsRef,
    });
  }, [addLog, attack, fighters, setFighters, setPositions, positionsRef]);

  // Handle altitude changes for flying fighters
  const handleChangeAltitude = useCallback((fighter, deltaFeet) => {
    if (!fighter || !isFlying(fighter)) {
      addLog(`❌ ${fighter?.name || 'Fighter'} must be flying to change altitude`, "error");
      return;
    }

    const result = changeAltitude(fighter, deltaFeet, { maxAltitude: 100 });
    if (result.success) {
      setFighters(prev => prev.map(f => 
        f.id === fighter.id ? result.fighter : f
      ));
      addLog(result.message, "info");
    } else {
      addLog(`❌ ${result.reason}`, "error");
    }
  }, [addLog, setFighters]);

  // Handle position changes on the tactical map
  const handlePositionChange = useCallback((combatantId, newPosition, movementInfo = null) => {
    const combatant = fighters.find(f => f.id === combatantId);
    
    // Only update position if it's NOT a pending movement (RUN/SPRINT only - CHARGE is now immediate)
    if (movementInfo && (movementInfo.action === 'RUN' || movementInfo.action === 'SPRINT')) {
      // Don't update position - it's a pending movement
      // Add to flashing set
      setFlashingCombatants(prev => new Set(prev).add(combatantId));
      
      // Just log the action
      if (combatant) {
        const { action, actionCost, description } = movementInfo;
        addLog(`🏃 ${combatant.name} ${action.toLowerCase()}s to position (${newPosition.x}, ${newPosition.y}) - ${description}`, "info");
        
        // Handle action cost
        if (actionCost === "all" || actionCost >= 1) {
          addLog(`⏭️ ${combatant.name} used ${actionCost === "all" ? "all actions" : `${actionCost} action(s)`} for movement`, "info");
        }
      }
    } else if (movementInfo && movementInfo.action === 'CHARGE') {
      // CHARGE is immediate: move + attack with bonuses
      setPositions(prev => {
        const updated = {
        ...prev,
        [combatantId]: newPosition
        };
        positionsRef.current = updated;
        // Sync combined body positions (mounts, carriers, etc.)
        const synced = syncCombinedPositions(fighters, updated);
        positionsRef.current = synced;
        return synced;
      });

      const chargeDistance = calculateDistance(
        positions[combatantId] || newPosition,
        newPosition
      );
      enqueueMoveAnimation(
        combatantId,
        {
          x: newPosition.x,
          y: newPosition.y,
          altitudeFeet: combatant?.altitudeFeet ?? combatant?.altitude ?? 0,
        },
        getMoveDurationMs(chargeDistance)
      );
      suppressNextAnimationRef.current.add(combatantId);
      
      // Add to flashing set (CHARGE uses up the turn)
      setFlashingCombatants(prev => new Set(prev).add(combatantId));
      
      if (combatant) {
        const distance = calculateDistance(positions[combatantId] || newPosition, newPosition);
        addLog(`⚡ ${combatant.name} CHARGES ${Math.round(distance)}ft toward the enemy! (+2 strike, -2 parry/dodge)`, "combat");
        
        // Apply temporary modifiers for this round
        setTempModifiers(prev => ({
          ...prev,
          [combatantId]: {
            strikeBonus: +2,
            parryPenalty: -2,
            dodgePenalty: -2
          }
        }));
        
        // Note: Attack will be selected/executed separately by the player
        // The bonuses will apply automatically
      }
    } else {
      // Check if new position is off-board (fled/routed)
      const isOffBoard = 
        newPosition.x < 0 || 
        newPosition.y < 0 || 
        newPosition.x >= GRID_CONFIG.GRID_WIDTH || 
        newPosition.y >= GRID_CONFIG.GRID_HEIGHT;

      if (isOffBoard && combatant) {
        // Character has moved off-board - remove from combat
        const isBird = (combatant.species || combatant.name || "").toLowerCase().includes("hawk") ||
                      (combatant.species || combatant.name || "").toLowerCase().includes("bird") ||
                      (combatant.species || combatant.name || "").toLowerCase().includes("owl") ||
                      (combatant.species || combatant.name || "").toLowerCase().includes("eagle");
        
        if (isBird) {
          addLog(`🦅 ${combatant.name} flies away from the battle.`, "info");
        } else {
          addLog(`🏃 ${combatant.name} has fled the battlefield!`, "warning");
        }

        // Remove from fighters array
        setFighters((prev) => prev.filter((f) => f.id !== combatantId));
        
        // Remove from positions
        setPositions((prev) => {
          const updated = { ...prev };
          delete updated[combatantId];
          positionsRef.current = updated;
          return updated;
        });
        setRenderPositions((prev) => {
          const updated = { ...prev };
          delete updated[combatantId];
          return updated;
        });

        // End turn
        scheduleEndTurn(1500);
        return;
      }

      // Normal movement (MOVE) - update position immediately (use transition for performance)
      startTransition(() => {
        setPositions(prev => {
          const updated = {
            ...prev,
            [combatantId]: newPosition
          };
          positionsRef.current = updated;
          // Sync combined body positions (mounts, carriers, etc.)
          const synced = syncCombinedPositions(fighters, updated);
          positionsRef.current = synced;
          return synced;
        });
      });

      const moveDistance = calculateDistance(
        positions[combatantId] || newPosition,
        newPosition
      );
      enqueueMoveAnimation(
        combatantId,
        {
          x: newPosition.x,
          y: newPosition.y,
          altitudeFeet: combatant?.altitudeFeet ?? combatant?.altitude ?? 0,
        },
        getMoveDurationMs(moveDistance)
      );
      suppressNextAnimationRef.current.add(combatantId);
      
      if (combatant) {
        if (movementInfo) {
          const { action, actionCost, description } = movementInfo;
          addLog(`🏃 ${combatant.name} ${action.toLowerCase()}s to position (${newPosition.x}, ${newPosition.y}) - ${description}`, "info");
          
          // Handle action cost - if it costs actions, end the turn
          if (actionCost === "all" || actionCost >= 1) {
            addLog(`⏭️ ${combatant.name} used ${actionCost === "all" ? "all actions" : `${actionCost} action(s)`} for movement`, "info");
            scheduleEndTurn(1500);
          }
        } else {
          addLog(`📍 ${combatant.name} moved to position (${newPosition.x}, ${newPosition.y})`, "info");
        }
      }
    }
  }, [fighters, addLog, endTurn, enqueueMoveAnimation, getMoveDurationMs, calculateDistance, setRenderPositions]);

  // Helper function to get all targets in a line for area attacks
  const getTargetsInLine = useCallback((attackerId, targetId, positions) => {
    if (!positions[attackerId] || !positions[targetId]) return [];
    
    const attackerPos = positions[attackerId];
    const targetPos = positions[targetId];
    
    const dx = targetPos.x - attackerPos.x;
    const dy = targetPos.y - attackerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= 1) return []; // Adjacent, no line
    
    const targetsInLine = [];
    
    // Check all positions along the line
    const steps = Math.ceil(distance);
    for (let i = 1; i <= steps; i++) {
      const lineX = Math.round(attackerPos.x + (dx * i / steps));
      const lineY = Math.round(attackerPos.y + (dy * i / steps));
      
      // Find combatant at this position
      const occupantId = Object.keys(positions).find(id => 
        id !== attackerId && 
        positions[id] && 
        positions[id].x === lineX && 
        positions[id].y === lineY
      );
      
      if (occupantId) {
        const combatant = fighters.find(f => f.id === occupantId);
        if (combatant && combatant.currentHP > 0) {
          targetsInLine.push(combatant);
        }
      }
    }
    
    return targetsInLine;
  }, [fighters]);

  // Helper function to check if a target is blocked by another combatant
  const isTargetBlocked = useCallback((attackerId, targetId, positions) => {
    if (!positions[attackerId] || !positions[targetId]) return false;
    
    const attackerPos = positions[attackerId];
    const targetPos = positions[targetId];
    
    // Check if there's a combatant between attacker and target
    const dx = targetPos.x - attackerPos.x;
    const dy = targetPos.y - attackerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= 1) return false; // Adjacent, not blocked
    
    // Check intermediate positions
    const steps = Math.ceil(distance);
    for (let i = 1; i < steps; i++) {
      const intermediateX = Math.round(attackerPos.x + (dx * i / steps));
      const intermediateY = Math.round(attackerPos.y + (dy * i / steps));
      
      // Check if this position is occupied by someone other than attacker or target
      const occupant = Object.keys(positions).find(id => 
        id !== attackerId && id !== targetId && 
        positions[id] && 
        positions[id].x === intermediateX && 
        positions[id].y === intermediateY
      );
      
      if (occupant) {
        return true; // Blocked
      }
    }
    
    return false;
  }, []);

  // Helper function to get the combatant blocking the path
  const getBlockingCombatant = useCallback((attackerId, targetId, positions) => {
    if (!positions[attackerId] || !positions[targetId]) return null;
    
    const attackerPos = positions[attackerId];
    const targetPos = positions[targetId];
    
    const dx = targetPos.x - attackerPos.x;
    const dy = targetPos.y - attackerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= 1) return null;
    
    // Find the first combatant in the path
    const steps = Math.ceil(distance);
    for (let i = 1; i < steps; i++) {
      const intermediateX = Math.round(attackerPos.x + (dx * i / steps));
      const intermediateY = Math.round(attackerPos.y + (dy * i / steps));
      
      const occupantId = Object.keys(positions).find(id => 
        id !== attackerId && id !== targetId && 
        positions[id] && 
        positions[id].x === intermediateX && 
        positions[id].y === intermediateY
      );
      
      if (occupantId) {
        return fighters.find(f => f.id === occupantId);
      }
    }
    
    return null;
  }, [fighters]);

  // Helper function to calculate target priority (lower = better target)
  const calculateTargetPriority = useCallback((target, distance, isBlocked) => {
    let priority = distance; // Base priority on distance
    
    // Wounded targets are higher priority (lower number)
    const hpPercent = target.currentHP / target.maxHP;
    if (hpPercent < 0.5) priority -= 50; // Severely wounded
    else if (hpPercent < 0.8) priority -= 25; // Moderately wounded
    
    // Blocked targets are lower priority (higher number)
    if (isBlocked) priority += 100;
    
    // Lower AR targets are slightly higher priority
    const ar = target.AR || target.ar || 10;
    priority -= (15 - ar); // Lower AR = higher priority
    
    return priority;
  }, []);

  // Unified movement calculation - single source of truth
  const getMaxMoveFtThisAction = useCallback((fighter, movementType = "Run") => {
    const speed = fighter.Spd || fighter.spd || fighter.attributes?.Spd || fighter.attributes?.spd || 10;
    const attacksPerMelee = fighter.attacksPerMelee || fighter.actionsPerMelee || 4;
    
    // Check if fighter is flying
    const isFlyingState = fighter.isFlying || fighter.altitude > 0;
    // Check abilities - can be array (raw) or object (parsed)
    let canFly = false;
    if (Array.isArray(fighter.abilities)) {
      canFly = fighter.abilities.some(a => 
        typeof a === "string" && (a.toLowerCase().includes("fly") || a.toLowerCase().includes("flight"))
      );
    } else if (fighter.abilities && typeof fighter.abilities === "object") {
      // Check parsed abilities object
      canFly = fighter.abilities.movement?.flight || 
               (Array.isArray(fighter.abilities.other) && fighter.abilities.other.some(a => 
                 typeof a === "string" && (a.toLowerCase().includes("fly") || a.toLowerCase().includes("flight"))
               ));
    }
    
    // If currently flying, use flight speed
    if (isFlyingState && canFly) {
      // Flight movement: Speed × multiplier × 18 feet per melee
      // Default flight multiplier is 8 (30 mph for Speed 10)
      const flightMultiplier = 8; // Can be extracted from abilities if needed
      const feetPerMelee = speed * flightMultiplier * 18;
      const feetPerAction = feetPerMelee / attacksPerMelee;
      return feetPerAction;
    }
    
    // If can fly but grounded, use slower ground speed
    if (canFly && !isFlyingState) {
      // Check for explicit ground speed in movementProfile
      const groundSpd = fighter.movementProfile?.groundSpd;
      if (groundSpd) {
        const feetPerMelee = groundSpd * 18;
        const feetPerAction = feetPerMelee / attacksPerMelee;
        if (movementType === "MOVE" || movementType === "Walk") {
          return Math.floor(feetPerAction * 0.5);
        }
        return feetPerAction;
      }
      
      // Fallback: use default slow ground speed for flying creatures
      // Small flyers (hawks, pixies) get Spd 4 on ground
      const sizeCategory = fighter.sizeCategory || fighter.size || "MEDIUM";
      const isSmall = sizeCategory === "TINY" || sizeCategory === "SMALL";
      const groundSpeed = isSmall ? 4 : 6;
      const feetPerMelee = groundSpeed * 18;
      const feetPerAction = feetPerMelee / attacksPerMelee;
      if (movementType === "MOVE" || movementType === "Walk") {
        return Math.floor(feetPerAction * 0.5);
      }
      return feetPerAction;
    }
    
    // Ground movement for non-flying creatures: OFFICIAL 1994 PALLADIUM FORMULA
    // Speed × 18 = feet per melee (running speed)
    const feetPerMelee = speed * 18;
    const feetPerAction = feetPerMelee / attacksPerMelee;
    
    // Walking speed is ~half of running speed (Palladium rule)
    if (movementType === "MOVE" || movementType === "Walk") {
      return Math.floor(feetPerAction * 0.5);
    }
    
    // Running speed (full speed)
    return feetPerAction;
  }, []);

  // Helper function to find flanking positions around a target
  const findFlankingPositions = useCallback((targetPos, allPositions, attackerId) => {
    const flankingPositions = [];
    // ✅ Use hex neighbors (6 directions) instead of square grid (8 directions)
    const neighbors = getHexNeighbors(targetPos.x, targetPos.y);
    
    neighbors.forEach(flankPos => {
      // Check if position is valid and not occupied (exclude attacker)
      let isOccupied = false;
      for (const [id, pos] of Object.entries(allPositions)) {
        // Exclude attacker from occupied check
        if (id !== attackerId && pos.x === flankPos.x && pos.y === flankPos.y) {
          isOccupied = true;
          break;
        }
      }
      
      if (!isOccupied) {
        flankingPositions.push(flankPos);
      }
    });
    
    return flankingPositions;
  }, []);
  // Helper function to calculate flanking bonus
  const calculateFlankingBonus = useCallback((attackerPos, targetPos, allPositions, attackerId) => {
    let flankingCount = 0;
    // ✅ Use hex neighbors (6 directions) instead of square grid (8 directions)
    const neighbors = getHexNeighbors(targetPos.x, targetPos.y);
    
    neighbors.forEach(checkPos => {
      // Check if any ally is at this position
      for (const [id, pos] of Object.entries(allPositions)) {
        if (pos.x === checkPos.x && pos.y === checkPos.y && id !== attackerId) {
          // Check if it's an ally (same type as attacker)
          const attackerFighter = fighters.find(f => f.id === attackerId);
          const occupantFighter = fighters.find(f => f.id === id);
          
          if (attackerFighter && occupantFighter && attackerFighter.type === occupantFighter.type) {
            flankingCount++;
          }
        }
      }
    });
    
    return flankingCount;
  }, [fighters]);

  // Helper function to get equipped weapons for a character
  const getEquippedWeapons = useCallback((character) => {
    // Disabled expensive logging in production - only enable for debugging
    const isDev = import.meta.env?.DEV || import.meta.env?.MODE === 'development';
    // eslint-disable-next-line no-constant-condition
    if (isDev && false) { // Set to true only when debugging
      console.log('🔍 getEquippedWeapons called for:', character.name);
      console.log('🔍 Character equippedWeapons:', character.equippedWeapons);
    }
    
    const weapons = [];
    
    // Use the unified weapon management system
    if (character.equippedWeapons && Array.isArray(character.equippedWeapons)) {
      character.equippedWeapons.forEach(weapon => {
        if (weapon && weapon.name && weapon.name !== "Unarmed") {
          // ✅ Merge canonical weapon stats to ensure range/reach/etc are populated
          const base = getWeaponByName(weapon.name) || {};
          const merged = { ...base, ...weapon }; // equipped overrides canonical
          weapons.push({
            name: merged.name,
            damage: merged.damage || "1d3",
            slot: weapon.slot || "Right Hand",
            range: merged.range,
            reach: merged.reach,
            ammunition: merged.ammunition,
            weaponType: merged.weaponType,
            category: merged.category,
            type: merged.type
          });
        }
      });
    }
    
    // Fallback: Check equipped items for weapon slots
    if (weapons.length === 0 && character.equipped) {
      const weaponSlots = ['weaponPrimary', 'weaponSecondary'];
      
      weaponSlots.forEach(slot => {
        const weapon = character.equipped[slot];
        if (weapon && weapon.name && weapon.name !== "Unarmed") {
          // ✅ Merge canonical weapon stats to ensure range/reach/etc are populated
          const base = getWeaponByName(weapon.name) || {};
          const merged = { ...base, ...weapon }; // equipped overrides canonical
          weapons.push({
            name: merged.name,
            damage: merged.damage || "1d3",
            slot: slot,
            range: merged.range,
            reach: merged.reach,
            ammunition: merged.ammunition,
            weaponType: merged.weaponType,
            category: merged.category,
            type: merged.type
          });
        }
      });
    }
    
    // Disabled expensive logging
    
    // If no weapons found, return unarmed
    if (weapons.length === 0) {
      return [{
        name: "Unarmed",
        damage: "1d3",
        slot: "Right Hand",
        range: "",
        reach: "",
        category: "unarmed",
        type: "unarmed"
      }];
    }
    
    return weapons;
  }, []);

  // Shared guardrail: resolve placeholder/generic enemy attack entries into the actually equipped weapon.
  // This is intentionally used by BOTH planner (handleEnemyTurn) and executor (attack()) so they cannot diverge.
  const resolveEnemyEffectiveAttack = useCallback(
    (enemy, attackData, opts = {}) => {
      const beforeName = String(attackData?.name || "");
      const nameLower = beforeName.toLowerCase();
      const damageLower = String(attackData?.damage || "").toLowerCase();

      const looksGeneric =
        nameLower === "strike" ||
        nameLower === "unarmed" ||
        nameLower === "" ||
        nameLower.includes("punch") ||
        nameLower.includes("kick") ||
        nameLower.startsWith("weapon (") ||
        damageLower.includes("by weapon");

      const looksPlaceholderRanged =
        nameLower.includes("bow/") ||
        nameLower.includes("crossbow/") ||
        nameLower.includes("sling/") ||
        nameLower.includes("bow /") ||
        nameLower.includes("crossbow /") ||
        nameLower.includes("sling /") ||
        nameLower.includes("bow/long bow") ||
        nameLower.includes("bow/longbow");

      // If the selected attack already looks like a real specific weapon (and not a placeholder), keep it.
      if (!looksGeneric && !looksPlaceholderRanged) {
        return { attack: attackData, meta: { beforeName, afterName: beforeName, equippedName: null } };
      }

      const preferRanged = Boolean(opts.preferRanged ?? true);
      const eqList = getEquippedWeapons(enemy) || [];
      const equipped = eqList.filter((w) => w && w.name && String(w.name).toLowerCase() !== "unarmed");

      const rangedLike = (w) => {
        const n = String(w?.name || "").toLowerCase();
        return (
          (w?.range != null && Number(w.range) > 10) ||
          n.includes("bow") ||
          n.includes("crossbow") ||
          n.includes("sling")
        );
      };

      const candidates = preferRanged ? equipped.filter(rangedLike) : equipped;
      const chosen =
        (preferRanged
          ? [...candidates].sort((a, b) => (Number(b?.range) || 0) - (Number(a?.range) || 0))[0]
          : candidates[0]) ||
        equipped[0] ||
        null;
      if (!chosen) {
        return { attack: attackData, meta: { beforeName, afterName: beforeName, equippedName: null } };
      }

      const chosenIsRanged = rangedLike(chosen);
      const weaponDamage = getWeaponDamage(
        chosen,
        Boolean(chosen.twoHanded || isTwoHandedWeapon(chosen)),
        enemy
      );

      const normalized = {
        ...attackData,
        name: chosen.name,
        weapon: chosen,
        damage: weaponDamage || attackData?.damage,
        type: chosenIsRanged ? "ranged" : (chosen.type ?? attackData?.type),
        range: chosen.range ?? attackData?.range,
        reach: chosen.reach ?? attackData?.reach,
        category: chosen.category ?? attackData?.category,
        weaponType: chosen.weaponType ?? attackData?.weaponType,
        ammunition: chosen.ammunition ?? attackData?.ammunition,
      };

      return {
        attack: normalized,
        meta: { beforeName, afterName: String(normalized?.name || ""), equippedName: String(chosen?.name || "") },
      };
    },
    [getEquippedWeapons, getWeaponDamage, isTwoHandedWeapon]
  );

  // AI logic for player characters
  const handlePlayerAITurn = useCallback((player) => {
    if (combatPausedRef.current) {
      addLog(`⏸️ Combat paused - ${player.name}'s turn is waiting`, "info");
      processingPlayerAIRef.current = false;
      return;
    }

    // If an endTurn is already scheduled, don't start another AI turn in the delay window.
    if (pendingTurnAdvanceRef.current) {
      return;
    }

    // Prevent duplicate processing - check FIRST before any logging
    if (processingPlayerAIRef.current) {
      // Already processing - skip silently to avoid log spam
      return;
    }
    
    // Mark as processing IMMEDIATELY
    processingPlayerAIRef.current = true;
    
    // ✅ CRITICAL: Get latest player state from fighters array to ensure we have persisted moraleState
    let latestPlayer = fighters.find(f => f.id === player.id) || player;

    // 🐭 Predator panic: tiny prey ROUTES when a predator bird is nearby/visible.
    // This triggers the existing routed-flee logic immediately.
    if (settings.useMoraleRouting && isTinyPrey(latestPlayer)) {
      const currentPositions =
        positionsRef.current && Object.keys(positionsRef.current).length > 0
          ? positionsRef.current
          : positions;
      const myPos = currentPositions?.[latestPlayer.id];
      if (myPos) {
        const predators = fighters.filter(f =>
          f.type === "enemy" &&
          canFighterAct(f) &&
          f.currentHP > 0 &&
          isPredatorBird(f)
        );

        let nearestPred = null;
        let nearestDist = Infinity;
        let predatorVisible = false;

        predators.forEach((p) => {
          const pPos = currentPositions?.[p.id];
          if (!pPos) return;
          const dist = calculateDistance(myPos, pPos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestPred = p;
          }
          const vis = canAISeeTargetAsymmetric(latestPlayer, p, currentPositions, combatTerrain, {
            useFogOfWar: fogEnabled,
            fogOfWarVisibleCells: visibleCells,
          });
          if (vis) predatorVisible = true;
        });

        // Mice can also "sense" danger at close range (hearing), even if the hawk is hard to see.
        const hearingPanicRangeFt = 30; // 6 hexes
        const shouldPanic = nearestPred && (predatorVisible || nearestDist <= hearingPanicRangeFt);

        if (shouldPanic && latestPlayer.moraleState?.status !== "ROUTED") {
          addLog(`🐭 ${latestPlayer.name} panics and ROUTES from ${nearestPred.name}!`, "warning");

          // Persist morale state
          setFighters(prev =>
            prev.map(f =>
              f.id === latestPlayer.id
                ? {
                    ...f,
                    moraleState: {
                      ...(f.moraleState || {}),
                      status: "ROUTED",
                      reason: "predator_threat",
                    },
                  }
                : f
            )
          );

          // Also update local view so this turn uses routed logic immediately
          latestPlayer = {
            ...latestPlayer,
            moraleState: {
              ...(latestPlayer.moraleState || {}),
              status: "ROUTED",
              reason: "predator_threat",
            },
          };
        }
      }
    }
    
    // 🔴 NEW: Check if routed - if so, attempt to flee instead of fighting
    if (settings.useMoraleRouting && (latestPlayer.moraleState?.status === "ROUTED" || latestPlayer.statusEffects?.includes("ROUTED"))) {
      // 🛡️ Fear-immune creatures never flee - clear ROUTED and continue with normal turn
      if (latestPlayer.neverFlee || isFearImmune(latestPlayer)) {
        addLog(`🛡️ ${latestPlayer.name} is immune to fear and refuses to flee (ignoring ROUTED).`, "info");
        // Clear ROUTED status
        setFighters(prev => prev.map(f => {
          if (f.id === latestPlayer.id) {
            return {
              ...f,
              moraleState: {
                ...(f.moraleState || {}),
                status: "STEADY",
              },
              statusEffects: Array.isArray(f.statusEffects) ? f.statusEffects.filter(s => s !== "ROUTED") : f.statusEffects,
            };
          }
          return f;
        }));
        // Continue with normal turn (don't flee)
      } else {
        addLog(`🏃 ${latestPlayer.name} is ROUTED and attempts to flee!`, "warning");
      
      const currentPositions =
        positionsRef.current && Object.keys(positionsRef.current).length > 0
          ? positionsRef.current
          : positions;
      const myPos = currentPositions[latestPlayer.id];
      
      if (myPos) {
        // Evaluate ALL reachable candidates within maxSteps (non-greedy) and allow tie-moves.
        // This stops the endless loop of: routed → can't find strictly-better step → end turn.
        const threatPositions = getThreatPositionsForFighter(
          latestPlayer,
          fighters,
          currentPositions
        ).filter(Boolean);

        if (threatPositions.length === 0) {
          // ✅ No threats to flee from, mark as fled
          addLog(`🏃 ${latestPlayer.name} flees in terror!`, "warning");
          markFighterFledOffMap(latestPlayer.id, latestPlayer.name);
          processingPlayerAIRef.current = false;
          scheduleEndTurn();
          return;
        } else {
          const occ = makeIsHexOccupied(currentPositions, latestPlayer.id);
          const retreat = findBestRetreatHex({
            currentPos: myPos,
            threatPositions,
            maxSteps: 3,
            isHexOccupied: (x, y) => occ(x, y, latestPlayer.id),
            getHexNeighbors,
            isValidPosition: (x, y) => isValidPosition(x, y, combatTerrain),
            calculateDistance,
            gridWidth: GRID_CONFIG.GRID_WIDTH,
            gridHeight: GRID_CONFIG.GRID_HEIGHT,
            allowTieMoves: true,
            preferEdgeEscape: true,
          });

          if (retreat?.position) {
            const atEdge =
              retreat.reachedEdge ||
              isAtMapEdge(retreat.position, GRID_CONFIG.GRID_WIDTH, GRID_CONFIG.GRID_HEIGHT);

            if (atEdge) {
              markFighterFledOffMap(latestPlayer.id, latestPlayer.name);
              processingPlayerAIRef.current = false;
              scheduleEndTurn();
              return;
            } else {
              // ✅ Routed player moves but hasn't reached edge yet - still in combat, just fleeing
              setPositions((prev) => ({ ...prev, [latestPlayer.id]: retreat.position }));
              addLog(
                `🏃 ${latestPlayer.name} flees ${Math.round(retreat.distanceFeet)}ft to (${retreat.position.x}, ${retreat.position.y})!`,
                "warning"
              );
              
              // Set remaining attacks to 0 (routed units don't fight) but DON'T set hasFled
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === latestPlayer.id
                    ? {
                        ...f,
                        remainingAttacks: 0,
                        moraleState: {
                          ...(f.moraleState || {}),
                          status: "ROUTED",
                          hasFled: false, // ✅ Still on map, just fleeing
                        },
                      }
                    : f
                )
              );
              
              // End turn after moving
              processingPlayerAIRef.current = false;
              scheduleEndTurn();
              return;
            }
          } else {
            // ✅ If routed player cannot find a safe path, mark them as fled (they're effectively out of combat)
            addLog(`🏃 ${latestPlayer.name} attempts to flee but cannot find a safe path! Marking as fled.`, "warning");
            markFighterFledOffMap(latestPlayer.id, latestPlayer.name);
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          }
        }
      } else {
        // ✅ No position, mark as fled
        markFighterFledOffMap(latestPlayer.id, latestPlayer.name);
        processingPlayerAIRef.current = false;
        scheduleEndTurn();
        return;
      }
      }
    }
    
    // Build context for AI module
    const positionsForAI = pickNonEmptyObject(positionsRef.current, positions);
    // Optional turn banner to confirm turn flow (opt-in).
    // Usage: localStorage.debugTurnFlow = "1"
    try {
      if (
        typeof window !== "undefined" &&
        window?.localStorage?.getItem("debugTurnFlow") === "1"
      ) {
        addLog(
          `🟦 Turn: ${latestPlayer.name} (${latestPlayer.type}) | actions=${latestPlayer.remainingAttacks ?? 0}`,
          "info"
        );
      }
    } catch {
      // no-op
    }

    // Optional Ariel-specific turn outcome banner (opt-in, low noise).
    // Usage: localStorage.debugArielAI = "1"
    let dbgAriel = false;
    try {
      dbgAriel =
        typeof window !== "undefined" &&
        window?.localStorage?.getItem("debugArielAI") === "1" &&
        String(latestPlayer?.name || "").toLowerCase().includes("ariel");
    } catch {
      dbgAriel = false;
    }
    if (dbgAriel) {
      const enemyCount = (fighters || []).filter(
        (f) => f?.type === "enemy" && canFighterAct(f) && (Number(f?.currentHP ?? 0) > -21)
      ).length;
      const hpVal = latestPlayer?.currentHP ?? latestPlayer?.HP ?? latestPlayer?.hp;
      addLog(
        `🟦 ArielTurn start | actions=${latestPlayer?.remainingAttacks ?? 0} | HP=${hpVal ?? "?"} | alt=${getAltitude(latestPlayer) || 0} | enemyCount=${enemyCount}`,
        "info"
      );
      addLog(
        `🧪 ArielActCheck | canAct=${canFighterAct(latestPlayer)} | status=${latestPlayer?.status || latestPlayer?.condition || "none"} | effects=${(latestPlayer?.statusEffects || [])
          .map((e) => (e && typeof e === "object" ? (e.name || e.type || JSON.stringify(e)) : String(e)))
          .join(",")}`,
        "info"
      );
    }
    // New token per AI turn; delayed callbacks (and watchdog) must match this token or abort.
    const playerAITurnToken = (playerAITurnTokenRef.current || 0) + 1;
    playerAITurnTokenRef.current = playerAITurnToken;

    const context = {
      fighters,
      positions: positionsForAI,
      combatTerrain,
      arenaEnvironment,
      meleeRound,
      turnCounter,
      combatActive,
      aiControlEnabled, // Pass AI control state to AI module
      // Player AI async guardrails
      playerAIActionScheduledRef,
      playerAITurnTokenRef,
      playerAITurnToken,
      // Core helpers
      canFighterAct,
      getHPStatus,
      addLog,
      scheduleEndTurn,
      endTurn,
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
      getEquippedWeapons,
      // Visibility / fog
      fogEnabled,
      visibleCells,
      canAISeeTarget,
      visibilityLogRef,
      // Magic / psionics
      getFighterSpells,
      getFighterPsionicPowers,
      getFighterPPE,
      getFighterISP,
      // Attack & combat
      attack,
      setPositions,
      setFighters,
      getActionDelay,
      arenaSpeed,
      positionsRef,
      movementAttemptsRef,
      playerAIRecentlyUsedPsionicsRef,
      processingPlayerAIRef,
      // Spell/power utilities
      isOffensiveSpell,
      isHealingSpell,
      getSpellCost,
      getSpellHealingFormula,
      getPsionicCost,
      getPsionicTargetCategory,
      parseRangeToFeet,
      getSpellRangeInFeet,
      spellCanAffectTarget,
      executeSpell,
      executePsionicPower,
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
    };
    
    // Delegate to AI module - use latestPlayer to ensure we have persisted state
    // Reset action-scheduled marker for this AI turn
    playerAIActionScheduledRef.current = false;
    runPlayerTurnAI(latestPlayer, context);

    // ✅ Invariant: player AI must spend an action OR end the turn.
    // This catches early returns that clear the processing flag or forget to advance,
    // and prevents the "enemy machine-gunning" feel even when initiative alternates.
    const startActions = Number(latestPlayer.remainingAttacks ?? 0) || 0;
    const startTurnIndex = turnIndexRef.current;
    const startFighterId = latestPlayer.id;
    setTimeout(() => {
      if (!combatActive || combatEndCheckRef.current) return;
      const curIdx = turnIndexRef.current;
      const curFighterId = fightersRef.current?.[curIdx]?.id;
      if (curIdx !== startTurnIndex || curFighterId !== startFighterId) return;

      const fNow = (fightersRef.current || []).find((x) => x.id === startFighterId);
      const nowActions = Number(fNow?.remainingAttacks ?? 0) || 0;

      if (
        processingPlayerAIRef.current &&
        nowActions === startActions &&
        !playerAIActionScheduledRef.current
      ) {
        if (dbgAriel) {
          addLog(`🟥 ArielTurn forced endTurn (AI made no action)`, "warning");
        }
        addLog(`🛑 ${latestPlayer.name} AI made no action — forcing endTurn().`, "warning");
        processingPlayerAIRef.current = false;
        // Invalidate any delayed AI callbacks for this fighter/turn
        playerAITurnTokenRef.current = (playerAITurnTokenRef.current || 0) + 1;
        scheduleEndTurn(0);
      }
    }, 250);

    // ✅ Fail-safe: if a player AI module forgets to end the turn, don't let combat stall forever.
    // This should be a no-op in normal flow because the AI should clear processingPlayerAIRef
    // and scheduleEndTurn promptly.
    // runPlayerTurnAI uses delayed execution (~1000ms + 1500ms) before it actually attacks.
    // Give it enough runway before we declare the AI "stuck".
    const watchdogDelay = Math.max(
      2800,
      (getActionDelay?.(arenaSpeed) || 0) + 2600
    );
    setTimeout(() => {
      if (!combatActive || combatEndCheckRef.current) return;
      // Only fire for the SAME fighter + SAME AI token that scheduled this watchdog.
      const curIdx = turnIndexRef.current;
      const curFighterId = fightersRef.current?.[curIdx]?.id;
      if (curIdx !== startTurnIndex || curFighterId !== startFighterId) return;
      if (playerAITurnTokenRef.current !== playerAITurnToken) return;

      const fNow = (fightersRef.current || []).find((x) => x.id === startFighterId);
      const nowActions = Number(fNow?.remainingAttacks ?? 0) || 0;

      // Only force-release if we're still stuck "processing" and no action has been scheduled.
      if (
        processingPlayerAIRef.current &&
        nowActions === startActions &&
        !playerAIActionScheduledRef.current
      ) {
        processingPlayerAIRef.current = false;
        addLog(`⏱️ AI watchdog: forcing end of ${latestPlayer.name}'s turn`, "warning");
        // Invalidate any delayed AI callbacks for this fighter/turn
        playerAITurnTokenRef.current = (playerAITurnTokenRef.current || 0) + 1;
        scheduleEndTurn(0);
      }
    }, watchdogDelay);
  }, [
    fighters,
    positions,
    combatTerrain,
    arenaEnvironment,
    meleeRound,
    turnCounter,
    combatActive,
    canFighterAct,
    getHPStatus,
    addLog,
    scheduleEndTurn,
    endTurn,
    calculateDistance,
    isTargetBlocked,
    getBlockingCombatant,
    calculateTargetPriority,
    findFlankingPositions,
    calculateFlankingBonus,
    validateWeaponRange,
    isHexOccupied,
    handlePositionChange,
    getEquippedWeapons,
    fogEnabled,
    visibleCells,
    canAISeeTarget,
    visibilityLogRef,
    getFighterSpells,
    getFighterPsionicPowers,
    getFighterPPE,
    getFighterISP,
    attack,
    setPositions,
    setFighters,
    getActionDelay,
    arenaSpeed,
    positionsRef,
    pickNonEmptyObject,
    movementAttemptsRef,
    playerAIRecentlyUsedPsionicsRef,
    processingPlayerAIRef,
    isOffensiveSpell,
    isHealingSpell,
    getSpellCost,
    getSpellHealingFormula,
    getPsionicCost,
    getPsionicTargetCategory,
    parseRangeToFeet,
    getSpellRangeInFeet,
    spellCanAffectTarget,
    executeSpell,
    executePsionicPower,
    getWeaponRange,
    getWeaponType,
    getWeaponLength,
    autoEquipWeapons,
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
    aiControlEnabled,
    markFighterFledOffMap,
    isTinyPrey,
    isPredatorBird,
    canAISeeTargetAsymmetric,
    settings.useMoraleRouting,
    fogEnabled,
    visibleCells,
    getAwareness,
  ]);

  // Define handleEnemyTurn function with useCallback last
  const handleEnemyTurn = useCallback((enemy) => {
    // Prevent duplicate processing using ref for immediate synchronous check
    if (processingEnemyTurnRef.current) {
      console.warn('🚫 BLOCKED: Already processing enemy turn, skipping duplicate call for', enemy.name);
      addLog(`🚫 DEBUG: Blocked duplicate call for ${enemy.name}`, "error");
      return;
    }

    // If an endTurn is already scheduled, don't start another enemy turn in the delay window.
    if (pendingTurnAdvanceRef.current) {
      return;
    }

    if (combatPausedRef.current) {
      addLog(`⏸️ Combat paused - ${enemy.name}'s turn is waiting`, "info");
      processingEnemyTurnRef.current = false;
      return;
    }

    console.log('✅ Starting enemy turn for', enemy.name, 'at turn index', turnIndex);
    processingEnemyTurnRef.current = true;
    
    // ✅ CRITICAL: Check if enemy can act (conscious, not dying/dead/unconscious)
    if (!canFighterAct(enemy)) {
      const hpStatus = getHPStatus(enemy.currentHP);
      addLog(`⏭️ ${enemy.name} cannot act (${hpStatus.description}), skipping turn`, "info");
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
    
    // Check if combat is still active
    if (!combatActive) {
      addLog(`⚠️ Combat ended, ${enemy.name} skips turn`, "info");
      processingEnemyTurnRef.current = false;
      return;
    }
    
    // 🦅 Hawk predator override: if grappling/carrying, handle here (don't defer to generic flying AI)
    let liveEnemy = fighters.find(f => f.id === enemy.id) || enemy;
    const enemyNameStr = (liveEnemy?.species || liveEnemy?.name || "").toLowerCase();
    const isPredBird =
      enemyNameStr.includes("hawk") ||
      enemyNameStr.includes("eagle") ||
      enemyNameStr.includes("falcon") ||
      enemyNameStr.includes("owl");

    // 1) If carrying: climb → fly away → drop (hawk mid-air prey logic)
    if (isPredBird && liveEnemy?.isCarrying && liveEnemy?.carriedTargetId) {
      const carried = fighters.find(f => f.id === liveEnemy.carriedTargetId);

      if (!carried) {
        // orphan carry state
        setFighters(prev => prev.map(f => (
          f.id === liveEnemy.id ? { ...f, isCarrying: false, carriedTargetId: null } : f
        )));
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      const livePos = pickNonEmptyObject(positionsRef.current, positions);
      const myPos = livePos[liveEnemy.id];
      const alt = getAltitude(liveEnemy) || 0;

      // Carry state lives on the hawk so we can enforce "fly away before drop"
      const carryState = liveEnemy.aiPredatorCarry || {
        movedAway: false,
        desiredAlt: 40,
        safeDistanceFt: 60,
      };

      // A) Climb first (one action)
      if (alt < carryState.desiredAlt) {
        const step = Math.min(20, carryState.desiredAlt - alt);
        const climbed = changeAltitude(liveEnemy, +step);
        if (climbed.success) {
          setFighters(prev => prev.map(f => {
            if (f.id !== liveEnemy.id) return f;
            const ra = Number(f.remainingAttacks ?? 0) || 0;
            return {
              ...climbed.fighter,
              remainingAttacks: Math.max(0, ra - 1),
              aiPredatorCarry: { ...carryState },
            };
          }));
          addLog(`🦅 ${liveEnemy.name} climbs with prey (${alt}ft → ${alt + step}ft)!`, "info");
        }
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      // B) Ensure we "fly away" at least once before dropping (one action)
      if (!carryState.movedAway && myPos) {
        // Find closest threat (exclude the carried prey)
        const threats = fighters.filter(f =>
          f.type !== liveEnemy.type &&
          canFighterAct(f) &&
          f.currentHP > 0 &&
          f.id !== carried.id &&
          !f.isCarried
        );

        let retreatTarget = null;
        if (threats.length > 0) {
          const nearest = threats
            .map(t => ({ t, d: calculateDistance(myPos, livePos[t.id]) }))
            .filter(x => x.d != null && !Number.isNaN(x.d))
            .sort((a, b) => a.d - b.d)[0];
          if (nearest?.t && livePos[nearest.t.id]) {
            const tp = livePos[nearest.t.id];
            const dx = myPos.x - tp.x;
            const dy = myPos.y - tp.y;
            const ang = Math.atan2(dy, dx);
            const retreatHexes = 6; // ~30ft
            retreatTarget = {
              x: Math.round(myPos.x + Math.cos(ang) * retreatHexes),
              y: Math.round(myPos.y + Math.sin(ang) * retreatHexes),
            };
          }
        }

        // If no threats, drift toward nearest edge (predators tend to take prey away)
        if (!retreatTarget) {
          const left = myPos.x;
          const right = (GRID_CONFIG.GRID_WIDTH - 1) - myPos.x;
          const top = myPos.y;
          const bottom = (GRID_CONFIG.GRID_HEIGHT - 1) - myPos.y;
          const min = Math.min(left, right, top, bottom);
          const retreatHexes = 6;
          if (min === left) retreatTarget = { x: myPos.x - retreatHexes, y: myPos.y };
          else if (min === right) retreatTarget = { x: myPos.x + retreatHexes, y: myPos.y };
          else if (min === top) retreatTarget = { x: myPos.x, y: myPos.y - retreatHexes };
          else retreatTarget = { x: myPos.x, y: myPos.y + retreatHexes };
        }

        // Clamp + find nearest free hex
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        let targetHex = {
          x: clamp(retreatTarget.x, 0, GRID_CONFIG.GRID_WIDTH - 1),
          y: clamp(retreatTarget.y, 0, GRID_CONFIG.GRID_HEIGHT - 1),
        };

        const occ = (x, y) => isHexOccupied(x, y, liveEnemy.id);
        if (occ(targetHex.x, targetHex.y) || !isValidPosition(targetHex.x, targetHex.y)) {
          const neighbors = getHexNeighbors(targetHex.x, targetHex.y)
            .filter(n => isValidPosition(n.x, n.y) && !occ(n.x, n.y));
          if (neighbors.length > 0) targetHex = neighbors[0];
        }

        handlePositionChange(liveEnemy.id, targetHex, {
          action: "FLY",
          actionCost: 0,
          description: "Carries prey away",
        });
        addLog(`🦅 ${liveEnemy.name} carries ${carried.name} away through the air!`, "warning");

        setFighters(prev => prev.map(f => {
          if (f.id !== liveEnemy.id) return f;
          const ra = Number(f.remainingAttacks ?? 0) || 0;
          return {
            ...f,
            remainingAttacks: Math.max(0, ra - 1),
            aiPredatorCarry: { ...carryState, movedAway: true },
          };
        }));

        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      // C) Drop for damage (one action)
      const drop = dropCarriedTarget(liveEnemy, carried, { height: alt });
      if (drop.success) {
        setFighters(prev => prev.map(f => {
          if (f.id === liveEnemy.id) {
            const ra = Number(f.remainingAttacks ?? 0) || 0;
            return { ...drop.fighter, remainingAttacks: Math.max(0, ra - 1), aiPredatorCarry: null };
          }
          if (f.id === carried.id) return drop.target;
          return f;
        }));
        addLog(`💥 ${liveEnemy.name} drops ${carried.name} from ${alt}ft!`, "warning");
      } else {
        addLog(`❌ ${liveEnemy.name} failed to drop prey: ${drop.reason}`, "error");
        // Still consume an action for the attempt
        setFighters(prev => prev.map(f => {
          if (f.id !== liveEnemy.id) return f;
          const ra = Number(f.remainingAttacks ?? 0) || 0;
          return { ...f, remainingAttacks: Math.max(0, ra - 1) };
        }));
      }

      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }

    // 2) If grappling (but not carrying): finish-kill with beak/talons OR lift & carry
    if (isPredBird && liveEnemy?.grappleState?.opponent && liveEnemy?.grappleState?.state !== GRAPPLE_STATES.NEUTRAL) {
      const prey = fighters.find(f => f.id === liveEnemy.grappleState.opponent);

      if (!prey) {
        // orphan grapple
        setFighters(prev => prev.map(f => {
          if (f.id === liveEnemy.id) {
            const copy = { ...f };
            resetGrapple(copy);
            return copy;
          }
          return f;
        }));
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      const preyHP = prey.currentHP ?? prey.hp ?? 0;
      const preyMax = getFighterMaxHP(prey) || 1;
      const weakThreshold = Math.max(6, Math.floor(preyMax * 0.25));

      // Prefer "beak/talons/claw/bite" while holding prey
      const finisher = (liveEnemy.attacks || []).find(a => {
        const n = (a.name || "").toLowerCase();
        return n.includes("beak") || n.includes("talon") || n.includes("claw") || n.includes("bite");
      }) || (liveEnemy.attacks || [])[0];

      // A) If prey is weak, finish it.
      if (preyHP <= weakThreshold && finisher) {
        const updatedAttacker = { ...liveEnemy, selectedAttack: finisher };
        addLog(`🦅 ${liveEnemy.name} tears into ${prey.name} with ${finisher.name}!`, "combat");
        // attack() will end the turn; release the enemy-turn lock first.
        processingEnemyTurnRef.current = false;
        setTimeout(() => {
              attack(updatedAttacker, prey.id, {
          source: "GRAPPLE_FINISH",
                consumeAttackerAction: true,
              });
              }, 0);
              return; // attack + scheduleEndTurn handled elsewhere
      }

      // B) Otherwise, attempt to lift & carry ONLY if physically possible.
      // If the attempt fails, we don't "free follow-up" into an attack (that would be 2 actions).
      const carryFeasible = canCarryTarget(liveEnemy, prey, { capacityMultiplier: 10 });
      if (carryFeasible?.canCarry) {
        const lift = liftAndCarry(liveEnemy, prey, { positions: pickNonEmptyObject(positionsRef.current, positions) });
        if (lift.success) {
          setFighters(prev => prev.map(f => {
            if (f.id === liveEnemy.id) {
              const ra = Number(f.remainingAttacks ?? 0) || 0;
              return {
                ...lift.carrier,
                remainingAttacks: Math.max(0, ra - 1),
                aiPredatorCarry: { movedAway: false, desiredAlt: 40, safeDistanceFt: 60 },
              };
            }
            if (f.id === prey.id) return lift.carried;
            return f;
          }));
          // Keep carried prey "stacked" on the carrier immediately (don't rely on stale fighters closure)
          setPositions(prevPos => {
            const base = { ...(pickNonEmptyObject(positionsRef.current, prevPos)) };
            const carrierPos = base[lift.carrier.id] || base[liveEnemy.id];
            if (carrierPos) base[lift.carried.id] = { ...carrierPos };
            positionsRef.current = base;
            return base;
          });
          addLog(`🦅 ${liveEnemy.name} snatches ${prey.name} mid-air and begins to carry them!`, "warning");
        } else {
          // Consume an action for the failed lift attempt
          setFighters(prev => prev.map(f => {
            if (f.id !== liveEnemy.id) return f;
            const ra = Number(f.remainingAttacks ?? 0) || 0;
            return { ...f, remainingAttacks: Math.max(0, ra - 1) };
          }));
          addLog(`⚠️ ${liveEnemy.name} fails to get a clean lift: ${lift.reason}`, "info");
        }

        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      // C) If carrying is not feasible, just keep mauling in the grapple.
      if (finisher) {
        const updatedAttacker = { ...liveEnemy, selectedAttack: finisher };
        addLog(`🦅 ${liveEnemy.name} mauls ${prey.name} with ${finisher.name}!`, "combat");
        // attack() will end the turn; release the enemy-turn lock first.
        processingEnemyTurnRef.current = false;
        setTimeout(() => {
          attack(updatedAttacker, prey.id, {
            source: "GRAPPLE_MAUL",
            consumeAttackerAction: true,
          });
        }, 500);
        return;
      }

      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }

    // 3) Predator dive logic (Option B): if the hawk is flying, it can dive-swoop to contact and strike in ONE action.
    // This bypasses any "10ft dive" gating and prevents the "hover forever out of reach" stalemate.
    if (isPredBird && isFlying(liveEnemy) && (liveEnemy.remainingAttacks ?? 0) > 0) {
      const livePos = pickNonEmptyObject(positionsRef.current, positions);
      const myPos = livePos[liveEnemy.id];

      // Choose closest valid prey
      const candidates = fighters.filter(f =>
        f.type !== liveEnemy.type &&
        canFighterAct(f) &&
        (f.currentHP ?? 0) > 0 &&
        !f.isCarried
      );

      if (myPos && candidates.length > 0) {
        const prey = candidates
          .map(t => ({ t, d: calculateDistance(myPos, livePos[t.id]) }))
          .filter(x => x.d != null && !Number.isNaN(x.d))
          .sort((a, b) => a.d - b.d)[0]?.t;

        if (prey && livePos[prey.id]) {
          const preyPos = livePos[prey.id];
          const curAlt = getAltitude(liveEnemy) || 0;
          const preyAlt = getAltitude(prey) || 0;
          const verticalGap = Math.abs(curAlt - preyAlt);
          const dist = calculateDistance(myPos, preyPos);

          // If prey is visible but too far for an immediate swoop, glide/hover toward it instead of circling in place.
          // This prevents the "frozen hovering" loop when distance is large.
          if (dist > 60) {
            const occ = (x, y) => isHexOccupied(x, y, liveEnemy.id);

            // Soar higher and higher while gliding in to improve spotting and line up a dive.
            // Each glide action: climb in steps (up to a cap). The dive will then start from whatever altitude we've built up.
            const MIN_SCOUT_ALT = 80;
            const CLIMB_PER_GLIDE = 40;
            const MAX_SCOUT_ALT = 300;

            let scoutAlt = Number(curAlt || 0) || 0;
            if (scoutAlt < MIN_SCOUT_ALT) scoutAlt = MIN_SCOUT_ALT;
            else scoutAlt = Math.min(MAX_SCOUT_ALT, scoutAlt + CLIMB_PER_GLIDE);

            if ((curAlt || 0) < scoutAlt) {
              setFighters(prev => prev.map(f => (
                f.id === liveEnemy.id ? { ...f, isFlying: true, altitudeFeet: scoutAlt, altitude: scoutAlt } : f
              )));
              addLog(`🦅 ${liveEnemy.name} climbs higher to scout (${Math.round(scoutAlt)}ft).`, "info");
            }

            // Step up to 3 hexes closer this action
            let step = { ...myPos };
            for (let i = 0; i < 3; i++) {
              const neighbors = (getHexNeighbors(step.x, step.y) || [])
                .filter(n => isValidPosition(n.x, n.y) && !occ(n.x, n.y));
              if (!neighbors.length) break;
              const best = neighbors.sort((a, b) => calculateDistance(a, preyPos) - calculateDistance(b, preyPos))[0];
              // Only move if it meaningfully improves distance
              if (calculateDistance(best, preyPos) >= calculateDistance(step, preyPos)) break;
              step = best;
            }
            if (step && (step.x !== myPos.x || step.y !== myPos.y)) {
              const basePos = { ...(pickNonEmptyObject(positionsRef.current, positions)) };
              basePos[liveEnemy.id] = { ...step };
              const syncedPos = syncCombinedPositions(fighters, basePos);
              positionsRef.current = syncedPos;
              setPositions(syncedPos);
              addLog(`🦅 ${liveEnemy.name} glides toward ${prey.name} from above.`, "info");
              // Spend an action for the glide
              setFighters(prev => prev.map(f => {
                if (f.id !== liveEnemy.id) return f;
                const ra = Number(f.remainingAttacks ?? 0) || 0;
                return { ...f, remainingAttacks: Math.max(0, ra - 1) };
              }));
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            } else {
              // Couldn't improve horizontal distance this action (blocked / already optimal).
              // Still spend the action to "glide & gain altitude" so the hawk doesn't freeze.
              addLog(`🦅 ${liveEnemy.name} glides in slow circles at ${Math.round(Math.max(curAlt || 0, scoutAlt))}ft, lining up a dive.`, "info");
              setFighters(prev => prev.map(f => {
                if (f.id !== liveEnemy.id) return f;
                const ra = Number(f.remainingAttacks ?? 0) || 0;
                return { ...f, remainingAttacks: Math.max(0, ra - 1) };
              }));
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          }

          // Dive if we're close-ish but vertical separation makes melee impossible, OR if within a short swoop range.
          const shouldDive = (dist <= 60 && verticalGap > 5.5) || (dist <= 20 && verticalGap >= 0);

          if (shouldDive) {
            // Pick an adjacent hex to the prey (can't occupy prey's hex)
            const occ = (x, y) => isHexOccupied(x, y, liveEnemy.id);
            const adj = getHexNeighbors(preyPos.x, preyPos.y)
              .filter(n => isValidPosition(n.x, n.y) && !occ(n.x, n.y));

            if (adj.length > 0) {
              const contactHex = adj.sort((a, b) =>
                calculateDistance(myPos, a) - calculateDistance(myPos, b)
              )[0];

              // Move as part of the swoop (no extra action). Update positionsRef immediately so attack() uses the new distance.
              const basePos = { ...(pickNonEmptyObject(positionsRef.current, positions)) };
              basePos[liveEnemy.id] = { ...contactHex };
              const syncedPos = syncCombinedPositions(fighters, basePos);
              positionsRef.current = syncedPos;
              setPositions(syncedPos);

              addLog(`🏃 ${liveEnemy.name} dives to position (${contactHex.x}, ${contactHex.y}) - Dive-swoops to contact`, "info");

              // Set near-contact altitude and strike
              const diveAttack = (liveEnemy.attacks || []).find(a => {
                const n = (a.name || "").toLowerCase();
                return n.includes("talon") || n.includes("claw") || n.includes("bite") || n.includes("beak");
              }) || (liveEnemy.attacks || [])[0];

              const attackerCopy = { ...liveEnemy };
              const dive = performDiveAttack(attackerCopy, prey, { attackOffsetFeet: 5 });
              const contactAlt = dive?.newAltitude ?? (preyAlt + 5);

              const updatedAttacker = {
                ...liveEnemy,
                selectedAttack: diveAttack,
                isFlying: true,
                altitudeFeet: contactAlt,
                altitude: contactAlt,
              };

              setFighters(prev => prev.map(f => (f.id === updatedAttacker.id ? updatedAttacker : f)));
              
              // Only log dive if there was an actual altitude drop (not already at contact altitude)
              const actualDrop = Math.max(0, curAlt - contactAlt);
              if (actualDrop > 0.1) {
                addLog(`🦅 ${liveEnemy.name} dive-swoops (${curAlt}ft → ${contactAlt}ft) at ${prey.name}!`, "combat");
              } else {
                addLog(`🦅 ${liveEnemy.name} swoops low and strikes ${prey.name}!`, "combat");
              }

              // attack() ends the turn; release the lock first.
              processingEnemyTurnRef.current = false;
              setTimeout(() => {
                attack(updatedAttacker, prey.id, {
                strikeBonus: dive?.attackBonus ?? 0,
                source: "DIVE_ATTACK",
                diveAttack: true,
                diveFromFeet: curAlt,
                diveToFeet: contactAlt,
                attackerStatePatch: { isFlying: true, altitudeFeet: contactAlt, altitude: contactAlt },
                consumeAttackerAction: true,
              });
              }, 0);
              return;
            }
          }
        }
      }
    }
    
    // 🦅 FLYING AI (Predator-bird only):
    // Circling/harass/hunt behavior should NOT apply to general fliers like Baal-Rog in a duel.
    // We restrict the generic flight AI to predator birds *only* when tiny prey exists (mouse/rat/etc.).
    const hasTinyPreyOnBoard = (() => {
      try {
        const preyKeywords = ["mouse", "rat", "rabbit", "squirrel", "songbird"];
        const hostiles = fighters.filter(
          (f) => f && f.type !== enemy.type && canFighterAct(f) && (f.currentHP ?? 0) > 0
        );
        return hostiles.some((f) => {
          const name = String(f.name || "").toLowerCase();
          const size = String(f.sizeCategory || f.size || "").toLowerCase();
          const isSmallBody = size === "tiny" || size === "small";
          const isNamedPrey = preyKeywords.some((k) => name.includes(k));
          return isSmallBody || isNamedPrey;
        });
      } catch {
        return false;
      }
    })();

    if (
      isPredBird &&
      hasTinyPreyOnBoard &&
      isFlyingCreature(enemy, canFly) &&
      (enemy.isFlying || enemy.altitudeFeet > 0)
    ) {
      const flyingHandled = runFlyingTurn(enemy, {
        fighters: fighters,
        positions: positions,
        addLog: addLog,
        canFlyFn: canFly,
        moveFlyingCreature: (creature, hex, opts) => {
          return moveFlyingCreatureHelper(creature, hex, {
            gameState: {
              fighters: fighters,
              positions: positions,
            },
            positions: positions,
            log: addLog,
            moveCreatureOnMap: (creature, targetHex, movementOpts) => {
              // Use handlePositionChange for proper movement
              handlePositionChange(creature.id, targetHex, {
                ...movementOpts,
                mode: "FLY",
              });
            },
          }, opts);
        },
        getReachableEnemies: (flier, allFighters, allPositions) => {
          return allFighters.filter(f => 
            f.type !== flier.type && 
            canFighterAct(f) && 
            f.currentHP > 0 && 
            !isTargetBlocked(flier.id, f.id, allPositions)
          );
        },
        pickClosestEnemy: (flier, enemies, allPositions) => {
          const flierPos = allPositions[flier.id];
          if (!flierPos) return null;
          return enemies.sort((a, b) => 
            calculateDistance(flierPos, allPositions[a.id]) - 
            calculateDistance(flierPos, allPositions[b.id])
          )[0];
        },
        performDiveAttack: (flier, target) => {
          return performDiveAttackHelper(flier, target, {
            gameState: {
              fighters: fighters,
              positions: positions,
            },
            positions: positions,
            log: addLog,
            moveCreatureOnMap: (creature, targetHex, movementOpts) => {
              // Use handlePositionChange for proper movement
              handlePositionChange(creature.id, targetHex, {
                ...movementOpts,
                mode: "FLY",
              });
            },
            performMeleeAttack: (attacker, defender, options) => {
              // Find appropriate attack
              const diveAttack = attacker.attacks?.find(a => 
                a.name?.toLowerCase().includes("talons") || 
                a.name?.toLowerCase().includes("bite") || 
                a.name?.toLowerCase().includes("claw")
              ) || attacker.attacks?.[0];
              
              if (diveAttack) {
                const updatedAttacker = { 
                  ...attacker, 
                  selectedAttack: diveAttack,
                  isFlying: true,
                };
                
                // Execute attack with dive bonus from options
                const diveBonus = options?.attackBonus || 0;
                attack(updatedAttacker, defender.id, { 
                  strikeBonus: diveBonus, // Use strikeBonus to match existing attack system
                  diveBonus: diveBonus, // Also include for logging
                  source: options?.source || "DIVE_ATTACK",
                });
                
                // Deduct action
                setFighters((prev) =>
                  prev.map((f) =>
                    f.id === attacker.id
                      ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
                      : f
                  )
                );
                
                processingEnemyTurnRef.current = false;
                scheduleEndTurn();
              }
            },
            setFighters: setFighters,
          });
        },
        getFlightFocusPoint: (flier) => {
          // Focus on the closest enemy or own position
          const reachable = fighters.filter(f => 
            f.type !== flier.type && 
            canFighterAct(f) && 
            f.currentHP > 0 && 
            !isTargetBlocked(flier.id, f.id, positions)
          );
          const closest = reachable.sort((a, b) => 
            calculateDistance(positions[flier.id], positions[a.id]) - 
            calculateDistance(positions[flier.id], positions[b.id])
          )[0];
          return closest ? positions[closest.id] : positions[flier.id];
        },
        findSafeLandingHex: (flier) => {
          const myPos = positions[flier.id];
          if (!myPos) return null;
          // Find a hex away from enemies
          const nearbyEnemies = fighters.filter(f => 
            f.type !== flier.type && 
            canFighterAct(f) && 
            f.currentHP > 0 && 
            calculateDistance(myPos, positions[f.id]) < 50
          );
          if (nearbyEnemies.length > 0) {
            const nearestThreat = nearbyEnemies.sort((a, b) => 
              calculateDistance(myPos, positions[a.id]) - 
              calculateDistance(myPos, positions[b.id])
            )[0];
            const threatPos = positions[nearestThreat.id];
            const dx = myPos.x - threatPos.x;
            const dy = myPos.y - threatPos.y;
            const angle = Math.atan2(dy, dx);
            const retreatDistance = 20; // Move 20ft away
            const newPos = {
              x: myPos.x + Math.cos(angle) * (retreatDistance / 5),
              y: myPos.y + Math.sin(angle) * (retreatDistance / 5),
            };
            return newPos;
          }
          return myPos; // Land in current position if no threats
        },
        updateFighter: (updatedFighter) => {
          setFighters((prev) => prev.map((f) => (f.id === updatedFighter.id ? updatedFighter : f)));
        },
        updatePositions: (updatedPositions) => {
          setPositions(updatedPositions);
          positionsRef.current = updatedPositions;
        },
        setPositions: setPositions,
        setFighters: setFighters,
        calculateDistanceFn: calculateDistance,
      });
      
      if (flyingHandled) {
        // Flying AI handled the turn, don't run normal ground AI
        processingEnemyTurnRef.current = false;
        // Use setTimeout to ensure turn actually ends
        setTimeout(() => {
          endTurn();
        }, 1500);
        return;
      }
    }
    
    // 1) First, refresh the enemy from state (in case their HP / morale changed)
    const fightersSnapshot = fighters;
    liveEnemy = fightersSnapshot.find(f => f.id === enemy.id) || enemy;
    
    // 🛠️ Fix #2: Safety net - Clear ROUTED for fear-immune creatures BEFORE routing logic runs
    // This guarantees HF, Morale, Spell fear, and future mechanics can never force fear-immune flight
    if (isFearImmune(liveEnemy) || liveEnemy.neverFlee) {
      // Force-clear any fear-based routing
      if (liveEnemy.moraleState?.status === "ROUTED") {
        liveEnemy.moraleState = {
          ...(liveEnemy.moraleState || {}),
          status: "STEADY",
        };
      }
      if (Array.isArray(liveEnemy.statusEffects)) {
        liveEnemy.statusEffects = liveEnemy.statusEffects.filter(s => s !== "ROUTED");
      }
      // Update state immediately
      setFighters(prev => prev.map(f => {
        if (f.id === liveEnemy.id) {
          return { ...f, moraleState: liveEnemy.moraleState, statusEffects: liveEnemy.statusEffects };
        }
        return f;
      }));
    }
    
    // 2) Low-HP "I give up" morale check (only if Morale & Routing enabled)
    liveEnemy = maybeTriggerLowHpMorale(
      liveEnemy,
      fightersSnapshot,
      meleeRound,
      addLog,
      settings
    );
    
    // Make sure we store the updated moraleState back into fighters
    setFighters(prev =>
      prev.map(f => (f.id === liveEnemy.id ? { ...f, moraleState: liveEnemy.moraleState } : f))
    );
    
    // 2.5) NEW: Check for SURRENDERED or CAPTURED (before routing)
    if (
      settings.useMoraleRouting &&
      (liveEnemy.moraleState?.status === "SURRENDERED" || liveEnemy.isCaptured || liveEnemy.hasSurrendered)
    ) {
      addLog(`🤚 ${liveEnemy.name} has surrendered and will not act.`, "info");
      
      // Remove ability to fight
      setFighters(prev =>
        prev.map(f =>
          f.id === liveEnemy.id
            ? {
                ...f,
                remainingAttacks: 0,
                hasSurrendered: true,
              }
            : f
        )
      );
      
      // Enemy does nothing this turn
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
    
    // 3) 🏃 Routing System: Check if enemy is routed and should flee
    // CRITICAL: This must happen BEFORE any attack/movement logic
    if (settings.useMoraleRouting && (liveEnemy.moraleState?.status === "ROUTED" || liveEnemy.statusEffects?.includes("ROUTED"))) {
      // 🛡️ Fear-immune creatures never flee - clear ROUTED and continue with normal turn
      if (liveEnemy.neverFlee || isFearImmune(liveEnemy)) {
        addLog(`🛡️ ${liveEnemy.name} is immune to fear and refuses to flee (ignoring ROUTED).`, "info");
        // Clear ROUTED status and update local copy
        liveEnemy.moraleState = {
          ...(liveEnemy.moraleState || {}),
          status: "STEADY",
        };
        if (Array.isArray(liveEnemy.statusEffects)) {
          liveEnemy.statusEffects = liveEnemy.statusEffects.filter(s => s !== "ROUTED");
        }
        // Update state
        setFighters(prev => prev.map(f => {
          if (f.id === liveEnemy.id) {
            return { ...f, moraleState: liveEnemy.moraleState, statusEffects: liveEnemy.statusEffects };
          }
          return f;
        }));
        // Continue with normal AI turn (don't end turn)
      } else {
        // Normal routing behavior - attempt to flee
        addLog(`🏃 ${liveEnemy.name} is ROUTED and attempts to flee!`, "warning");
        
        const currentPositions =
          positionsRef.current && Object.keys(positionsRef.current).length > 0
            ? positionsRef.current
            : positions;
        const myPos = currentPositions[liveEnemy.id];
        
        if (myPos) {
        // Evaluate ALL reachable candidates within maxSteps (non-greedy) and allow tie-moves.
        // This stops the endless loop of: routed → can't find strictly-better step → end turn.
        const threatPositions = getThreatPositionsForFighter(
          liveEnemy,
          fightersSnapshot,
          currentPositions
        ).filter(Boolean);

        if (threatPositions.length === 0) {
          // ✅ No threats to flee from, mark as fled
          addLog(`🏃 ${liveEnemy.name} flees in terror!`, "warning");
          markFighterFledOffMap(liveEnemy.id, liveEnemy.name);
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        } else {
          const occ = makeIsHexOccupied(currentPositions, liveEnemy.id);
          const retreat = findBestRetreatHex({
            currentPos: myPos,
            threatPositions,
            maxSteps: 3,
            isHexOccupied: (x, y) => occ(x, y, liveEnemy.id),
            getHexNeighbors,
            isValidPosition: (x, y) => isValidPosition(x, y, combatTerrain),
            calculateDistance,
            gridWidth: GRID_CONFIG.GRID_WIDTH,
            gridHeight: GRID_CONFIG.GRID_HEIGHT,
            allowTieMoves: true,
            preferEdgeEscape: true,
          });

          if (retreat?.position) {
            const atEdge =
              retreat.reachedEdge ||
              isAtMapEdge(retreat.position, GRID_CONFIG.GRID_WIDTH, GRID_CONFIG.GRID_HEIGHT);

            if (atEdge) {
              markFighterFledOffMap(liveEnemy.id, liveEnemy.name);
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            } else {
              // ✅ Routed unit moves but hasn't reached edge yet - still in combat, just fleeing
              setPositions((prev) => ({ ...prev, [liveEnemy.id]: retreat.position }));
              addLog(
                `🏃 ${liveEnemy.name} flees ${Math.round(retreat.distanceFeet)}ft to (${retreat.position.x}, ${retreat.position.y})!`,
                "warning"
              );
              
              // Set remaining attacks to 0 (routed units don't fight) but DON'T set hasFled
              setFighters((prev) =>
                prev.map((f) =>
                  f.id === liveEnemy.id
                    ? {
                        ...f,
                        remainingAttacks: 0,
                        moraleState: {
                          ...(f.moraleState || {}),
                          status: "ROUTED",
                          hasFled: false, // ✅ Still on map, just fleeing
                        },
                      }
                    : f
                )
              );
              
              // End turn after moving
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          } else {
            // ✅ If routed enemy cannot find a safe path, mark them as fled (they're effectively out of combat)
            addLog(`🏃 ${liveEnemy.name} attempts to flee but cannot find a safe path! Marking as fled.`, "warning");
            markFighterFledOffMap(liveEnemy.id, liveEnemy.name);
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        }
      } else {
        // ✅ No position, mark as fled
        markFighterFledOffMap(liveEnemy.id, liveEnemy.name);
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }
    }
    
    // Update enemy reference for rest of function
    enemy = liveEnemy;
    
    // Check if enemy has actions remaining
    if (enemy.remainingAttacks <= 0) {
      addLog(`⏭️ ${enemy.name} has no actions remaining - passing to next fighter in initiative order`, "info");
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
    
    // ✅ FIX: Filter players by visibility AND exclude unconscious/dying/dead targets
    // Only target conscious players (HP > 0) - unconscious/dying players are already defeated
    const allPlayers = fighters.filter(f => 
      f.type === "player" && 
      canFighterAct(f) && 
      f.currentHP > 0 &&  // Only conscious players
      f.currentHP > -21    // Not dead
    );
    
    // Decay awareness for each player target
    allPlayers.forEach(target => {
      decayAwareness(enemy, target);
    });
    
    // Filter visible targets and get awareness states
    const visiblePlayers = [];
    allPlayers.forEach(target => {
      const isVisible = canAISeeTarget(enemy, target, positions, combatTerrain, {
        useFogOfWar: fogEnabled,
        fogOfWarVisibleCells: visibleCells
      });
      
      if (isVisible) {
        visiblePlayers.push(target);
        // Update awareness to Alert when enemy can see target
        updateAwareness(enemy, target, AWARENESS_STATES.ALERT);
        
        // 😱 Horror Factor Check: When player sees enemy with HF > 0
        // Check from player's perspective when they can see the enemy
        // Uses centralized horrorSystem.js to ensure only one check per source/target pair
        if (settings.useInsanityTrauma) {
          // Check if enemy has Horror Factor (uses centralized canTriggerHorrorFactor)
          if (hasHorrorFactor(enemy)) {
            // Check if player can see this enemy (reverse visibility check)
            const playerCanSeeEnemy = canAISeeTarget(target, enemy, positions, combatTerrain, {
              useFogOfWar: fogEnabled,
              fogOfWarVisibleCells: visibleCells
            });
            
            if (playerCanSeeEnemy) {
              // Use centralized check - idempotent, safe to call every time
              // It will only process once per source/target pair
              // IMPORTANT: Get the latest fighter state from the fighters array to ensure we have persisted meta
              const latestTarget = fighters.find(f => f.id === target.id) || target;
              const updatedTarget = resolveHorrorCheck({
                source: enemy,
                target: latestTarget,
                combatState: {
                  currentRound: meleeRound,
                  meleeRound: meleeRound,
                },
                log: addLog,
              });
              
              // Always persist the updated target to ensure meta.horrorChecks is saved
              // The function is idempotent, so this is safe even if nothing changed
              setFighters((prev) =>
                prev.map((f) => (f.id === target.id ? updatedTarget : f))
              );
            }
          }
        }
      } else {
        // Use calculatePerceptionCheck to determine if enemy can detect hidden target
        const perceptionCheck = calculatePerceptionCheck(
          enemy,
          target,
          {
            terrain: combatTerrain?.terrain,
            lighting: combatTerrain?.lighting || "BRIGHT_DAYLIGHT",
            distance: positions[enemy.id] && positions[target.id] 
              ? calculateDistance(positions[enemy.id], positions[target.id])
              : 0
          }
        );
        
        // Check if enemy can still target Searching players (lost track but actively looking)
        const awareness = getAwareness(enemy, target);
        if (awareness === AWARENESS_STATES.SEARCHING || hasSpecialSenses(enemy) || perceptionCheck.success) {
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
    const healingSkills = availableSkills.filter(skill => 
      skill.type === "healer_ability" || 
      skill.type === "clerical_ability" || 
      skill.type === "medical_skill"
    );
    
    // Check for allies that need healing (only for non-evil alignments)
    const enemyAlignment = enemy.alignment || enemy.attributes?.alignment || "";
    const isEvil = isEvilAlignment(enemyAlignment);
    
    if (healingSkills.length > 0 && !isEvil) {
      // Find injured allies (same type as enemy)
      const allies = fighters.filter(f => 
        f.type === enemy.type && 
        f.id !== enemy.id && 
        f.currentHP > -21 &&
        (f.currentHP < f.maxHP * 0.5 || f.currentHP <= 0) // Injured or dying
      );
      
      if (allies.length > 0) {
        // Prioritize dying allies (HP <= 0)
        const dyingAllies = allies.filter(a => a.currentHP <= 0);
        const targetAlly = dyingAllies.length > 0 ? dyingAllies[0] : allies[0];
        
        // Check if enemy is adjacent to target (for touch skills)
        const enemyPos = positions[enemy.id];
        const allyPos = positions[targetAlly.id];
        const isAdjacent = enemyPos && allyPos && calculateDistance(enemyPos, allyPos) <= 5.5;
        
        if (isAdjacent) {
          // Select appropriate healing skill
          let selectedHealingSkill = null;
          
          // Prioritize Lust for Life for dying allies
          if (targetAlly.currentHP <= 0) {
            selectedHealingSkill = healingSkills.find(s => s.name === "Lust for Life");
          }
          
          // Fallback to Healing Touch or First Aid
          if (!selectedHealingSkill) {
            selectedHealingSkill = healingSkills.find(s => 
              s.name.includes("Healing Touch") || s.name === "First Aid"
            );
          }
          
          if (selectedHealingSkill) {
            // Check if enemy has enough resources
            let canUse = true;
            if (selectedHealingSkill.costType === "ISP") {
              const currentISP = enemy.currentISP || enemy.currentIsp || enemy.ISP || 0;
              canUse = currentISP >= selectedHealingSkill.cost;
            }
            
            if (canUse) {
              addLog(`🤖 ${enemy.name} uses ${selectedHealingSkill.name} on ${targetAlly.name}!`, "info");
              
              // Execute the healing skill
              let skillResult = null;
              
              if (selectedHealingSkill.type === "healer_ability") {
                const powerName = selectedHealingSkill.name.replace(" (Healer)", "");
                skillResult = healerAbility(enemy, targetAlly, powerName);
                
                if (!skillResult.error) {
                  // Update enemy ISP
                  setFighters(prev => prev.map(f => 
                    f.id === enemy.id 
                      ? { ...f, currentISP: skillResult.ispRemaining, ISP: skillResult.ispRemaining }
                      : f
                  ));
                  
                  // Update ally HP
                  if (skillResult.healed !== undefined) {
                    setFighters(prev => prev.map(f => 
                      f.id === targetAlly.id 
                        ? { ...f, currentHP: skillResult.currentHp }
                        : f
                    ));
                  }
                  
                  addLog(skillResult.message, skillResult.success === false ? "error" : "success");
                }
              } else if (selectedHealingSkill.type === "clerical_ability") {
                skillResult = clericalHealingTouch(enemy, targetAlly);
                
                if (!skillResult.error) {
                  setFighters(prev => prev.map(f => 
                    f.id === targetAlly.id 
                      ? { ...f, currentHP: skillResult.currentHp }
                      : f
                  ));
                  addLog(skillResult.message, "success");
                }
              } else if (selectedHealingSkill.type === "medical_skill") {
                const skillPercent = selectedHealingSkill.skillPercent || 50;
                skillResult = medicalTreatment(enemy, targetAlly, skillPercent);
                
                if (skillResult.healed > 0) {
                  setFighters(prev => prev.map(f => 
                    f.id === targetAlly.id 
                      ? { ...f, currentHP: skillResult.currentHp }
                      : f
                  ));
                }
                addLog(skillResult.message, skillResult.success ? "success" : "error");
              }
              
              // Deduct action and end turn
              setFighters(prev => prev.map(f => 
                f.id === enemy.id 
                  ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - selectedHealingSkill.cost) }
                  : f
              ));
              
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          }
        }
      }
    }
    
    const playerTargets = visiblePlayers;
    if (playerTargets.length === 0) {
      // Check if there are players but they're just not visible
      if (allPlayers.length > 0) {
        addLog(`👁️ ${enemy.name} cannot see any players (hidden/obscured).`, "info");
      } else {
      addLog(`${enemy.name} has no targets and defends.`, "info");
      }
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
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

    const positionsForEngineAI =
      positionsRef.current && Object.keys(positionsRef.current).length > 0
        ? positionsRef.current
        : positions;

    const engineContext = {
      combatants: fighters,
      environment: {
        terrain: engineTerrain,
        lighting: engineLighting,
      },
      positions: positionsForEngineAI,
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
      addLog(`⚠️ ${enemy.name} hesitates (AI error: ${error.message})`, "error");
    }

    if (actionPlan && !actionPlan.target && playerTargets.length > 0) {
      actionPlan.target = playerTargets[0];
    }

    if (actionPlan) {
      const aiType = (actionPlan.type || "").toLowerCase();
      if (aiType === "hold") {
        addLog(
          `[AI] ${enemy.name} holds position (${actionPlan.aiAction || "Hold"})`,
          "ai"
        );
        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? {
                  ...f,
                  remainingAttacks: Math.max(
                    0,
                    (f.remainingAttacks ?? enemy.remainingAttacks ?? 1) - 1
                  ),
                }
              : f
          )
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }

      if (aiType === "defend" || aiType === "dodge") {
        const stance =
          actionPlan.stance === "retreat"
            ? "Retreat"
            : actionPlan.defend === "parry"
            ? "Parry"
            : "Dodge";

        if (stance === "Retreat") {
          const currentPositions =
            positionsRef.current && Object.keys(positionsRef.current).length > 0
              ? positionsRef.current
              : positions;
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
          const attacksPerMelee =
            enemy.attacksPerMelee ||
            enemy.remainingAttacks ||
            1;
          const movementStats = calculateMovementPerAction(
            speed,
            Math.max(1, attacksPerMelee),
            enemy
          );
          const fullFeetPerAction =
            movementStats.fullMovementPerAction ||
            movementStats.feetPerAction ||
            (speed * 18) / Math.max(1, attacksPerMelee);
          const retreatSteps = Math.max(
            1,
            Math.min(
              Math.floor(fullFeetPerAction / GRID_CONFIG.CELL_SIZE),
              5
            )
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
                retreatDestination.distanceFeet
              )}ft`,
            };
            handlePositionChange(
              enemy.id,
              retreatDestination.position,
              retreatInfo
            );
            addLog(
              `[AI] ${enemy.name} withdraws ${Math.round(
                retreatDestination.distanceFeet
              )}ft to (${retreatDestination.position.x}, ${
                retreatDestination.position.y
              }).`,
              "ai"
            );
          } else if (!currentPos) {
            addLog(
              `[AI] ${enemy.name} tries to withdraw but has no recorded position.`,
              "ai"
            );
          } else if (threatPositions.length === 0) {
            addLog(
              `[AI] ${enemy.name} looks for an escape path but no enemies are visible.`,
              "ai"
            );
          } else {
            addLog(
              `[AI] ${enemy.name} tries to withdraw but finds no safe space!`,
              "ai"
            );
          }

          setDefensiveStance((prev) => ({ ...prev, [enemy.id]: "Retreat" }));

          const currentEnemyState = fighters.find(
            (f) => f.id === enemy.id
          );
          const remainingBefore =
            currentEnemyState?.remainingAttacks ??
            enemy.remainingAttacks ??
            1;
          const remainingAfter = Math.max(0, remainingBefore - 1);

          setFighters((prev) =>
            prev.map((f) =>
              f.id === enemy.id
                ? {
                    ...f,
                    remainingAttacks: Math.max(
                      0,
                      (f.remainingAttacks ?? remainingBefore) - 1
                    ),
                  }
                : f
            )
          );
          addLog(
            `⏭️ ${enemy.name} has ${remainingAfter} action(s) remaining this melee`,
            "info"
          );

          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        } else {
          addLog(
            `[AI] ${enemy.name} prepares to ${stance.toLowerCase()} (+defense).`,
            "ai"
          );
          if (stance === "Parry" || stance === "Dodge") {
            setDefensiveStance((prev) => ({ ...prev, [enemy.id]: stance }));
          }
        }

        setFighters((prev) =>
          prev.map((f) =>
            f.id === enemy.id
              ? {
                  ...f,
                  remainingAttacks: Math.max(
                    0,
                    (f.remainingAttacks ?? enemy.remainingAttacks ?? 1) - 1
                  ),
                }
              : f
          )
        );
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }

    // Enhanced enemy AI with strategic reasoning (fallback/augment for strikes and specials)
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

    // Strategy 2: Target players with lowest AR (easiest to hit)
    const easyTarget = playerTargets.reduce((easiest, current) => {
      const currentAR = current.AR || current.ar || 10;
      const easiestAR = easiest.AR || easiest.ar || 10;
      return currentAR < easiestAR ? current : easiest;
    });

    // Strategy 3: Target players who are currently taking their turn (aggressive)
    const currentPlayerTarget = playerTargets.find(f => f.id === fighters[turnIndex]?.id);

    // Enhanced AI LOGIC: Smart target selection with pathfinding consideration
    
    // Calculate distances to all targets and check if they're reachable
    const targetsWithDistance = playerTargets.map(t => {
      const dist = positions[enemy.id] && positions[t.id] 
        ? calculateDistance(positions[enemy.id], positions[t.id])
        : Infinity;
      
      const isBlockedLoS = isTargetBlocked(enemy.id, t.id, positions);
      
      const unreachableForEnemy = aiUnreachableTargetsRef.current?.[enemy.id];
      const isUnreachableMelee = unreachableForEnemy?.has(t.id) || false;

      // IMPORTANT: "Unreachable in melee" is NOT the same as "blocked".
      // (Minotaur vs flying Ariel): we still want to allow targeting for spells / thrown objects / ranged attacks.
      const isBlocked = isBlockedLoS;
      
      return {
        target: t,
        distance: dist,
        hpPercent: t.currentHP / t.maxHP,
        isWounded: t.currentHP < t.maxHP,
        isBlocked: isBlocked,
        isUnreachableMelee: isUnreachableMelee,
        priority: calculateTargetPriority(t, dist, isBlocked)
      };
    }).sort((a, b) => a.priority - b.priority); // Sort by priority (lower = better)
    
    // Filter to only targets in reasonable range (within 100 ft to consider)
    const targetsInRange = targetsWithDistance.filter(t => t.distance <= 100);
    
    if (targetsInRange.length === 0) {
      // No one in range, use fallback strategies
      if (weakestTarget && weakestTarget.currentHP < weakestTarget.maxHP) {
        target = weakestTarget;
        reasoning = `targeting the weakest foe (${Math.round((weakestTarget.currentHP / weakestTarget.maxHP) * 100)}% HP)`;
      } else if (easyTarget && (easyTarget.AR || easyTarget.ar) < 10) {
        target = easyTarget;
        reasoning = `targeting easiest to hit (AR ${easyTarget.AR || easyTarget.ar})`;
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
      const reachableTargets = targetsInRange.filter(t => !t.isBlocked);
      const blockedTargets = targetsInRange.filter(t => t.isBlocked);
      
      if (reachableTargets.length > 0) {
        // Prefer reachable targets
        const bestReachable = reachableTargets[0];
        target = bestReachable.target;
        reasoning = `attacking closest reachable target (${Math.round(bestReachable.distance)}ft away)`;
      } else if (blockedTargets.length > 0) {
        // All targets blocked - check if they're unreachable (flying too high) vs just blocked by another combatant
        const unreachableTargets = blockedTargets.filter(t => {
          const unreachableForEnemy = aiUnreachableTargetsRef.current?.[enemy.id];
          return unreachableForEnemy?.has(t.target.id) || false;
        });
        const justBlockedTargets = blockedTargets.filter(t => {
          const unreachableForEnemy = aiUnreachableTargetsRef.current?.[enemy.id];
          return !unreachableForEnemy?.has(t.target.id);
        });
        
        if (justBlockedTargets.length > 0) {
          // Some targets are just blocked by other combatants - try area attack
          const bestBlocked = justBlockedTargets[0];
          target = bestBlocked.target;
          reasoning = `target blocked by ${getBlockingCombatant(enemy.id, target.id, positions)?.name || 'another combatant'}, considering area attack`;
        } else if (unreachableTargets.length > 0) {
          // All targets are unreachable (e.g., all flying) - skip this turn or find alternative
          // Don't select an unreachable target - end turn instead
          addLog(`❌ ${enemy.name} has no reachable targets (all enemies are unreachable)`, "warning");
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        } else {
          // Fallback
          target = blockedTargets[0].target;
          reasoning = `target blocked, attempting attack anyway`;
        }
      } else {
        // Fallback
        target = targetsInRange[0].target;
        const dist = Math.round(targetsInRange[0].distance);
        reasoning = `attacking closest target (${dist}ft away)`;
      }
      }
    } else if (!reasoning) {
      reasoning = `following layered AI plan: ${actionPlan?.aiAction || "Strike"}`;
    }

    // ✅ AIR-CHASE PREFLIGHT
    // If target is airborne and attacker has flight capability but is not currently flying,
    // spend an action to take off (and optionally climb toward target altitude).
    const tgtAlt = getAltitude(target) || 0;
    const meAlt = getAltitude(liveEnemy) || 0;
    const targetIsAirborne = isFlying(target) && tgtAlt > 0;
    const attackerCanFly = canFly(liveEnemy);
    const attackerIsFlying = isFlying(liveEnemy);

    if (targetIsAirborne && attackerCanFly && !attackerIsFlying) {
      // Take off into a reasonable initial band; try to close vertical gap without teleporting to 100ft instantly
      const TAKEOFF_ALT_FT = 20;
      const CLIMB_STEP_FT = 20; // one action per climb step (keeps it consistent with your UI increments)
      const desired = Math.max(TAKEOFF_ALT_FT, Math.min(tgtAlt, meAlt + CLIMB_STEP_FT));

      addLog(
        `🪽 ${liveEnemy.name} takes off to pursue ${target.name} (${meAlt}ft → ${desired}ft).`,
        "info"
      );

      // Apply flight state + altitude
      setFighters(prev =>
        prev.map(f =>
          f.id === liveEnemy.id
            ? {
                ...f,
                isFlying: true,
                altitude: desired,
                altitudeFeet: desired,
                remainingAttacks: Math.max(0, (f.remainingAttacks ?? 0) - 1),
              }
            : f
        )
      );

      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }

    // ✅ AIR-CHASE CLIMB/DESCEND (already flying)
    // If both are airborne but altitude mismatch keeps melee unreachable, adjust altitude first.
    if (targetIsAirborne && attackerCanFly && attackerIsFlying) {
      const verticalSeparation = Math.abs(meAlt - tgtAlt);
      // 5.5ft is your melee "adjacent hex" minimum; if we're way off, spend an action syncing altitude band.
      if (verticalSeparation > 10 && (liveEnemy.remainingAttacks ?? 0) > 0) {
        const CLIMB_STEP_FT = 20;
        const nextAlt =
          meAlt < tgtAlt
            ? Math.min(tgtAlt, meAlt + CLIMB_STEP_FT)
            : Math.max(tgtAlt, meAlt - CLIMB_STEP_FT);

        if (nextAlt !== meAlt) {
          addLog(
            `🪽 ${liveEnemy.name} adjusts altitude while chasing ${target.name} (${meAlt}ft → ${nextAlt}ft).`,
            "info"
          );

          setFighters(prev =>
            prev.map(f =>
              f.id === liveEnemy.id
                ? {
                    ...f,
                    altitude: nextAlt,
                    altitudeFeet: nextAlt,
                    remainingAttacks: Math.max(0, (f.remainingAttacks ?? 0) - 1),
                  }
                : f
            )
          );

          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }
    }

    // Check if enemy needs to move closer to attack
    let needsToMoveCloser = false;
    let currentDistance = Infinity;

    // Select which attack to use (if creature has multiple attacks)
    const availableAttacks = enemy.attacks || [{ name: "Claw", damage: "1d6", count: 1 }];
    let selectedAttack = availableAttacks[0]; // Default to first attack
    let isChargingAttack = false; // Track if this will be a charge attack
    
    if (availableAttacks.length > 1) {
      // Check if creature has charge-type attacks (Horn Charge, Gore, Ram, etc.)
      const chargeAttacks = availableAttacks.filter(a => 
        a.name.toLowerCase().includes('charge') ||
        a.name.toLowerCase().includes('gore') ||
        a.name.toLowerCase().includes('ram') ||
        a.name.toLowerCase().includes('trample')
      );
      
      // Choose attack strategically from available
      if (chargeAttacks.length > 0) {
        // Has charge attack - choose randomly between charge and other attacks
        const allAttacks = [...chargeAttacks, ...availableAttacks.filter(a => !chargeAttacks.includes(a))];
        try {
          const attackRoll = CryptoSecureDice.parseAndRoll(`1d${allAttacks.length}`);
          selectedAttack = allAttacks[attackRoll.totalWithBonus - 1];
        } catch (error) {
          if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
            console.warn('[handleEnemyTurn] Error rolling for attack selection:', error);
          }
          selectedAttack = allAttacks[0];
        }
      } else {
        // Choose attack strategically from available
        try {
          const attackRoll = CryptoSecureDice.parseAndRoll(`1d${availableAttacks.length}`);
          selectedAttack = availableAttacks[attackRoll.totalWithBonus - 1];
        } catch (error) {
          if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
            console.warn('[handleEnemyTurn] Error rolling for available attack selection:', error);
          }
          selectedAttack = availableAttacks[0];
        }
      }
    }

    if (actionPlan?.aiAction && selectedAttack) {
      const aiActionName = actionPlan.aiAction.toLowerCase();
      const directMatch = availableAttacks.find(
        (attack) => (attack.name || "").toLowerCase() === aiActionName
      );
      if (directMatch) {
        selectedAttack = directMatch;
      } else if (aiActionName.includes("spell") && actionPlan.spell) {
        const spellAttack = {
          name: actionPlan.spell.name,
          damage: actionPlan.spell.damage || "by spell",
          type: "spell",
          spell: actionPlan.spell,
        };
        enemy.selectedAttack = spellAttack;
        selectedAttack = spellAttack;
      }
    }
    
    // If attack is Spellcasting, choose a specific spell (FULL CATALOG + IMMUNITY AWARE + LOOP GUARD)
    let attackName = selectedAttack.name;
    if (selectedAttack.name === "Spellcasting" || selectedAttack.damage === "by spell") {
      const chosenSpell = pickEnemySpellFromCatalog(enemy, target);
      
      if (chosenSpell) {
        attackName = `${chosenSpell.name} (${chosenSpell.damageType || "magic"})`;
        
        // Mark cast lock immediately (prevents rapid repeat calls before state updates land)
        const guardKey = `${enemy.id}:${meleeRound}`;
        const now = Date.now();
        const prev = enemySpellLoopGuardRef.current.get(guardKey) || { recent: [] };
        const nextRecent = [...(prev.recent || []), (chosenSpell.name || "").toLowerCase()].slice(-6);
        
        enemySpellLoopGuardRef.current.set(guardKey, {
          ...prev,
          lastCastAt: now,
          lastSpellName: chosenSpell.name,
          targetId: target?.id || null,
          lastMeleeRound: meleeRound,
          recent: nextRecent,
        });
        
        // Build a real spell attack object (matches your actionPlan spell shape)
        selectedAttack = {
          ...selectedAttack,
          type: "spell",
          spell: chosenSpell,
          name: attackName,
          damage: chosenSpell.damage || chosenSpell.combatDamage || "by spell",
        };
        
        // Also persist on the enemy object for downstream consumers (safe/no-op if unused)
        enemy.selectedAttack = selectedAttack;
      } else {
        // No viable spell (immunity/range/loop-guard) → fall back to a physical attack
        const fallback = (availableAttacks || []).find(
          (a) => a && a.name && a.name !== "Spellcasting" && (a.damage || "").toLowerCase() !== "by spell"
        );
        if (fallback) {
          selectedAttack = fallback;
          attackName = fallback.name;
        } else {
          addLog(`⚠️ ${enemy.name} has no viable spells or attacks available`, "info");
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }
    }

    // ✅ Guardrail: resolve any placeholder/generic enemy attack entries into the actually equipped weapon
    // BEFORE range validation / movement planning (shared with attack()).
    {
      const before = String(selectedAttack?.name || "");
      const { attack: normalized, meta } = resolveEnemyEffectiveAttack(enemy, selectedAttack, { preferRanged: true });
      selectedAttack = normalized;
      attackName = selectedAttack?.name || attackName;

      // Optional one-run debug: set localStorage.debugAttackNormalize = "1"
      const debugNormalize =
        (import.meta.env?.DEV || import.meta.env?.MODE === "development") &&
        typeof window !== "undefined" &&
        window?.localStorage?.getItem("debugAttackNormalize") === "1";
      if (debugNormalize && meta?.afterName && before !== meta.afterName) {
        const vSepFt = Math.abs((getAltitude(enemy) || 0) - (getAltitude(target) || 0));
        const n = String(selectedAttack?.name || "").toLowerCase();
        const isRangedLike = n.includes("bow") || n.includes("crossbow") || n.includes("sling") || n.includes("thrown") ||
          selectedAttack?.type === "ranged" || (selectedAttack?.range != null && Number(selectedAttack.range) > 10);
        const rangeDist = isRangedLike ? Math.hypot(currentDistance, vSepFt) : currentDistance;
        addLog(
          `DEBUG normalize: "${meta.beforeName}" → "${meta.afterName}" | equipped="${meta.equippedName}" | d=${Math.round(rangeDist)}ft | atkRange=${selectedAttack?.range ?? "n/a"}`,
          "info"
        );
      }
    }

    // Helper: enemy range validation uses 3D distance (horizontal + altitude) for ranged attacks
    const isRangedLikeForEnemy = (atk) => {
      const n = String(atk?.name || "").toLowerCase();
      return (
        atk?.type === "ranged" ||
        atk?.weaponType === "thrown" ||
        atk?.isThrown === true ||
        (atk?.range != null && Number(atk.range) > 10) ||
        (atk?.category && String(atk.category).toLowerCase() === "thrown") ||
        n.includes("bow") ||
        n.includes("crossbow") ||
        n.includes("sling")
      );
    };

    const validateEnemyAttackRange = (distFt, atk = selectedAttack, attackerF = enemy, defenderF = target) => {
      const vSepFt = Math.abs((getAltitude(attackerF) || 0) - (getAltitude(defenderF) || 0));
      const d = isRangedLikeForEnemy(atk) ? Math.hypot(distFt, vSepFt) : distFt;
      return validateWeaponRange(attackerF, defenderF, atk, d);
    };

    // Check weapon range for enemy attacks
    if (positions && positions[enemy.id] && positions[target.id]) {
      // Check if enemy just arrived from pending movement - use CURRENT position
      const enemyCurrentPos = positions[enemy.id];
      const targetCurrentPos = positions[target.id];
      
      // Recalculate distance with current positions using proper hex distance
      currentDistance = calculateDistance(enemyCurrentPos, targetCurrentPos);
      
      addLog(`📍 ${enemy.name} is at (${enemyCurrentPos.x}, ${enemyCurrentPos.y}), ${target.name} is at (${targetCurrentPos.x}, ${targetCurrentPos.y}), distance: ${Math.round(currentDistance)}ft`, "info");
      
      // ✅ Guardrail (again, just in case): keep selectedAttack resolved before validating.
      // This uses the same resolver as attack() so planner/executor cannot diverge.
      if (enemy?.type === "enemy" && selectedAttack) {
        const { attack: normalized } = resolveEnemyEffectiveAttack(enemy, selectedAttack, { preferRanged: true });
        selectedAttack = normalized;
        attackName = selectedAttack?.name || attackName;
      }

      // Use proper weapon range validation (3D distance for ranged)
      const rangeValidation = validateEnemyAttackRange(currentDistance);

      // OPTION B (Recommended): Dive Attack (combined descent + strike).
      // If the enemy is flying and the only thing blocking a melee strike is altitude,
      // treat this as solvable by a Dive Attack rather than "unreachable".
      const enemyIsFlyingNow = isFlying(enemy) || enemy.isFlying;
      const attackNameLower = String(selectedAttack?.name || "").toLowerCase();
      const isLikelyMeleeAttack =
        selectedAttack?.type !== "spell" &&
        selectedAttack?.type !== "ranged" &&
        !((selectedAttack?.range || 0) > 10) &&
        !attackNameLower.includes("bow") &&
        !attackNameLower.includes("crossbow") &&
        !attackNameLower.includes("sling");

      const diveTriggered =
        !rangeValidation.canAttack &&
        enemyIsFlyingNow &&
        isLikelyMeleeAttack &&
        (
          rangeValidation.requiresDive ||
          String(rangeValidation.reason || "").includes("dive attack required") ||
          String(rangeValidation.reason || "").includes("too far above/below")
        );

      if (diveTriggered) {
        const livePositions =
          positionsRef.current && Object.keys(positionsRef.current).length > 0
            ? positionsRef.current
            : positions;
        const enemyPos = livePositions?.[enemy.id];
        const tgtPos = livePositions?.[target.id];
        const landingCandidates = tgtPos ? findFlankingPositions(tgtPos, livePositions, enemy.id) : [];

        if (enemyPos && tgtPos && landingCandidates.length > 0) {
          // Choose closest adjacent landing hex around the target (already filtered as unoccupied)
          const landing = landingCandidates.reduce((best, cur) => {
            const bd = calculateDistance(enemyPos, best);
            const cd = calculateDistance(enemyPos, cur);
            return cd < bd ? cur : best;
          });

          // Dive uses the flyer's per-action movement budget (treat as RUN distance)
          const speed = enemy.Spd || enemy.spd || enemy.attributes?.Spd || enemy.attributes?.spd || 10;
          const feetPerAction = (speed * 18) / (enemy.attacksPerMelee || 1);
          const distToLanding = calculateDistance(enemyPos, landing);

          if (distToLanding <= feetPerAction + 0.01) {
            const targetAlt = getAltitude(target) || 0;

            addLog(`🪽 ${enemy.name} DIVE ATTACKS ${target.name}!`, "combat");

            // Move attacker into melee adjacency as part of the same action
            setPositions(prev => {
              const updated = { ...prev, [enemy.id]: landing };
              positionsRef.current = updated;
              return updated;
            });

            // Execute the strike with dive bonuses.
            const updatedEnemy = { ...enemy, selectedAttack };
            const diveBonuses = {
              strikeBonus: 2,
              extraDamageDice: "1d6",
              // Make sure the post-attack fighter state keeps the descended altitude.
              attackerStatePatch: {
                altitudeFeet: targetAlt,
                altitude: targetAlt,
                isFlying: targetAlt > 0,
              },
              // Ensure range check uses the landing hex immediately (before React state settles)
              attackerPosOverride: landing,
              defenderPosOverride: tgtPos,
              distanceOverride: calculateDistance(landing, tgtPos),
            };

            setTimeout(() => {
              attack(updatedEnemy, target.id, diveBonuses);
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
            }, 500);

            return;
          }
        }
      }

      // ✅ HARD GUARDRAIL: Target airborne + attacker cannot fly + melee unreachable → change plan (no melee spam loops)
      // RAW-faithful: if you can't reach, you don't keep "trying" the same melee plan.
      if (!rangeValidation.canAttack && rangeValidation.isUnreachable) {
        const targetAlt = getAltitude(target) || 0;
        const targetIsAirborne = isFlying(target) && targetAlt > 5;
        const attackerCanFlyNow = canFly(enemy) || isFlying(enemy);

        if (targetIsAirborne && !attackerCanFlyNow) {
          // Track unreachable attempts per attacker/target across turns
          const k = `${enemy.id}:${target.id}`;
          const prev = aiUnreachableTurnsRef.current.get(k) || { count: 0, lastTurnCounter: null };
          const nextCount = prev.lastTurnCounter === turnCounter ? prev.count : (prev.count + 1);
          aiUnreachableTurnsRef.current.set(k, { count: nextCount, lastTurnCounter: turnCounter });

          if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
            addLog(
              `DEBUG anti-air: attackerType=${enemy.type} targetType=${target.type} ammo=${getImprovisedAmmoQty(
                enemy.id
              )} stuck=${nextCount}`,
              "info"
            );
          }

          // Remember this for this combat (melee-unreachable)
          if (!aiUnreachableTargetsRef.current[enemy.id]) aiUnreachableTargetsRef.current[enemy.id] = new Set();
          aiUnreachableTargetsRef.current[enemy.id].add(target.id);

          // Option A: if we have improvised ammo and can throw and in range → throw (consumes ammo).
          const ps = Number(enemy.PS ?? enemy.ps ?? enemy.attributes?.PS ?? enemy.attributes?.ps ?? 0) || 0;
          const dmgBonus = Number(enemy?.bonuses?.damage ?? enemy?.bonuses?.Damage ?? 0) || 0;
          const sizeText = String(enemy?.sizeCategory || enemy?.size || "").toLowerCase();
          // Some bestiary entries don't have explicit PS; fall back to size/damage bonus heuristics.
          const canThrow =
            ps >= 18 ||
            dmgBonus >= 4 ||
            sizeText.includes("large") ||
            sizeText.includes("huge") ||
            sizeText.includes("gargantuan");
          const thrownAttack = buildImprovisedThrownAttack(enemy);
          const ammoQtyNow = getImprovisedAmmoQty(enemy.id);

          // Use 3D distance for thrown range checks (matches validateWeaponRange/attack() ranged logic)
          const throwVsepFt = Math.abs((getAltitude(enemy) || 0) - (getAltitude(target) || 0));
          const throwDistance3D = Math.hypot(currentDistance, throwVsepFt);

          if (ammoQtyNow > 0 && canThrow && throwDistance3D <= (thrownAttack.range || 60)) {

            addLog(
              `🪨 ${enemy.name} uses improvised ammo (${ammoQtyNow} left: ${formatImprovisedAmmoBreakdown(
                getImprovisedAmmoBreakdown(enemy.id)
              )}) and hurls debris at ${target.name}!`,
              "combat"
            );

            const usedType = consumeImprovisedAmmo(enemy.id);
            const usedAttack = buildImprovisedThrownAttack(enemy, usedType);

            // Use latest attacker snapshot to avoid stale remainingAttacks / state races
            const liveThrower = fighters.find((f) => f.id === enemy.id) || enemy;
            const updatedEnemyForThrow = {
              ...liveThrower,
              selectedAttack: usedAttack,
              attacks: liveThrower.attacks || enemy.attacks || [],
            };

            // ✅ Reset "stuck" counter since we took a productive anti-air action (throw)
            aiUnreachableTurnsRef.current.delete(k);

            // attack() consumes the action and ends the turn; release the enemy-turn lock first.
            processingEnemyTurnRef.current = false;
            if (combatOverRef.current || !combatActive || combatEndCheckRef.current) return;
            // Clarify what was thrown
            if (usedType && usedType !== "debris") {
              addLog(`🪨 ${enemy.name} throws a ${usedType}!`, "info");
            }
            const attackFn = attackRef.current || attack;
            if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
              addLog(
                `DEBUG throw: calling attack() with ${updatedEnemyForThrow.name} remainingAttacks=${updatedEnemyForThrow.remainingAttacks ?? "?"}`,
                "info"
              );
            }
            attackFn(updatedEnemyForThrow, target.id, {});
            return;
          }

          // Option B+: if we’ve been stuck for 2+ turns, do a productive fallback.
          // Priority:
          // 1) If we have improvised ammo, throw.
          // 2) Else SEARCH locally to pick up rocks/branches (grants ammo).
          // 3) Retreat ONCE from this airborne target, then stop retreating.
          // 4) Defend in place (stable).
          if (nextCount >= 2) {
            cleanupImprovisedAmmo(turnCounter);

            const ammoQty = getImprovisedAmmoQty(enemy.id);
            const ps = Number(enemy.PS ?? enemy.ps ?? enemy.attributes?.PS ?? enemy.attributes?.ps ?? 0) || 0;
            const dmgBonus = Number(enemy?.bonuses?.damage ?? enemy?.bonuses?.Damage ?? 0) || 0;
            const sizeText = String(enemy?.sizeCategory || enemy?.size || "").toLowerCase();
            const canThrow =
              ps >= 18 ||
              dmgBonus >= 4 ||
              sizeText.includes("large") ||
              sizeText.includes("huge") ||
              sizeText.includes("gargantuan");
            const thrownAttack = buildImprovisedThrownAttack(enemy);
            const throwVsepFt = Math.abs((getAltitude(enemy) || 0) - (getAltitude(target) || 0));
            const throwDistance3D = Math.hypot(currentDistance, throwVsepFt);
            const throwInRange = throwDistance3D <= (thrownAttack.range || 60);

            // 1) If we already have ammo and can throw and in range → throw now.
            if (ammoQty > 0 && canThrow && throwInRange) {
              addLog(
                `🪨 ${enemy.name} uses improvised ammo (${ammoQty} left: ${formatImprovisedAmmoBreakdown(
                  getImprovisedAmmoBreakdown(enemy.id)
                )}) and hurls debris at ${target.name}!`,
                "combat"
              );

              // spend 1 ammo
              const usedType = consumeImprovisedAmmo(enemy.id);
              const usedAttack = buildImprovisedThrownAttack(enemy, usedType);

              // Use latest attacker snapshot to avoid stale remainingAttacks / state races
              const liveThrower = fighters.find((f) => f.id === enemy.id) || enemy;
              const updatedEnemyForThrow = {
                ...liveThrower,
                selectedAttack: usedAttack,
                attacks: liveThrower.attacks || enemy.attacks || [],
              };

              // ✅ Reset "stuck" counter since we took a productive anti-air action (throw)
              aiUnreachableTurnsRef.current.delete(k);

              // attack() consumes the action and ends the turn; release the enemy-turn lock first.
              processingEnemyTurnRef.current = false;
              if (combatOverRef.current || !combatActive || combatEndCheckRef.current) return;
              if (usedType && usedType !== "debris") {
                addLog(`🪨 ${enemy.name} throws a ${usedType}!`, "info");
              }
              const attackFn = attackRef.current || attack;
              if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
                addLog(
                  `DEBUG throw: calling attack() with ${updatedEnemyForThrow.name} remainingAttacks=${updatedEnemyForThrow.remainingAttacks ?? "?"}`,
                  "info"
                );
              }
              attackFn(updatedEnemyForThrow, target.id, {});
              return;
            }

            // 2) Search/pickup action: pull real props from the arena based on environment seed
            if (ammoQty <= 0 && canThrow) {
              const livePos = pickNonEmptyObject(positionsRef.current, positions);
              const myPos = livePos?.[enemy.id];

              const got = findAndTakeNearbyProps(myPos, 2); // radius 2 hexes
              const foundQty = got.total;

              if (foundQty > 0) {
                grantImprovisedAmmo(enemy.id, foundQty, turnCounter, got.taken);
                // ✅ Reset "stuck" counter since we took a productive anti-air action (found ammo)
                aiUnreachableTurnsRef.current.delete(k);

                const details = formatImprovisedAmmoBreakdown(got.taken);

                addLog(
                  `🔎 ${enemy.name} searches nearby and grabs ${details} as improvised missiles.`,
                  "info"
                );

                setFighters((prevF) =>
                  prevF.map((f) =>
                    f.id === enemy.id
                      ? { ...f, remainingAttacks: Math.max(0, (f.remainingAttacks ?? 1) - 1) }
                      : f
                  )
                );

                setDefensiveStance((prevSt) => ({ ...prevSt, [enemy.id]: "Search" }));
                processingEnemyTurnRef.current = false;
                scheduleEndTurn();
                return;
              }

              // Nothing found nearby -> don’t retreat forever; defend.
              addLog(
                `🔎 ${enemy.name} searches for rocks/branches but finds nothing usable nearby.`,
                "info"
              );

              setDefensiveStance((prevSt) => ({ ...prevSt, [enemy.id]: "Defend" }));
              setFighters((prevF) =>
                prevF.map((f) =>
                  f.id === enemy.id
                    ? { ...f, remainingAttacks: Math.max(0, (f.remainingAttacks ?? 1) - 1) }
                    : f
                )
              );

              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }

            // 3) Retreat only ONCE per enemy/target every few turns, otherwise stop backing up forever.
            const retreatKey = `${enemy.id}:${target.id}`;
            const lastRetreatTurn = aiRetreatedFromAirborneRef.current.get(retreatKey);
            const canRetreatAgain = lastRetreatTurn == null || (turnCounter - lastRetreatTurn) >= 4;

            // If we're far away already, retreating just worsens the stalemate. Only consider retreat when close-ish.
            if (canRetreatAgain && currentDistance <= 30) {
              addLog(
                `🐂 ${enemy.name} cannot engage ${target.name} (airborne, no flight). Withdrawing once to avoid wasting actions.`,
                "warning"
              );

              try {
                const livePos = pickNonEmptyObject(positionsRef.current, positions);
                const myPos = livePos?.[enemy.id];
                const tgtPos = livePos?.[target.id];

                if (myPos && tgtPos) {
                  const occ = (x, y) => isHexOccupied(x, y, enemy.id);
                  const neighbors = (getHexNeighbors(myPos.x, myPos.y) || [])
                    .filter((n) => isValidPosition(n.x, n.y) && !occ(n.x, n.y));

                  if (neighbors.length > 0) {
                    const best = neighbors.sort(
                      (a, b) => calculateDistance(b, tgtPos) - calculateDistance(a, tgtPos)
                    )[0];

                    setPositions((prevPos) => {
                      const updatedPos = { ...prevPos, [enemy.id]: best };
                      positionsRef.current = updatedPos;
                      return updatedPos;
                    });

                    setFighters((prevF) =>
                      prevF.map((f) =>
                        f.id === enemy.id
                          ? { ...f, remainingAttacks: Math.max(0, (f.remainingAttacks ?? 1) - 1) }
                          : f
                      )
                    );

                    aiRetreatedFromAirborneRef.current.set(retreatKey, turnCounter);
                    setDefensiveStance((prevSt) => ({ ...prevSt, [enemy.id]: "Retreat" }));
                    addLog(`🏃 ${enemy.name} withdraws from the unreachable airborne target.`, "info");

                    processingEnemyTurnRef.current = false;
                    scheduleEndTurn();
                    return;
                  }
                }
              } catch {
                // fall through to defend
              }
            }

            // 4) Stable fallback:
            // - If far away, don't stall by defending — close distance so throws can happen.
            // - If close and still no options, defend.
            if (currentDistance > 30) {
              addLog(
                `🏃 ${enemy.name} has no viable anti-air action yet and closes distance instead of defending.`,
                "info"
              );
              // Fall through: the normal movement logic below will handle spending the action and moving.
            } else {
              addLog(
                `🛡️ ${enemy.name} holds position and DEFENDS (no viable anti-air action this turn).`,
                "info"
              );

              setDefensiveStance((prevSt) => ({ ...prevSt, [enemy.id]: "Defend" }));
              setFighters((prevF) =>
                prevF.map((f) =>
                  f.id === enemy.id
                    ? { ...f, remainingAttacks: Math.max(0, (f.remainingAttacks ?? 1) - 1) }
                    : f
                )
              );

              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          }

          // If we're close-ish and can throw but have no ammo yet, SEARCH once to acquire nearby props.
          // (This prevents the "stand adjacent doing nothing" loop.)
          if (canThrow && currentDistance <= 30 && getImprovisedAmmoQty(enemy.id) <= 0) {
            const livePos = pickNonEmptyObject(positionsRef.current, positions);
            const myPos = livePos?.[enemy.id];
            const got = findAndTakeNearbyProps(myPos, 2);
            if (got.total > 0) {
              grantImprovisedAmmo(enemy.id, got.total, turnCounter, got.taken);
              // ✅ Reset "stuck" counter since we took a productive anti-air action (found ammo)
              aiUnreachableTurnsRef.current.delete(k);
              const details = formatImprovisedAmmoBreakdown(got.taken);
              addLog(`🔎 ${enemy.name} searches nearby and grabs ${details} as improvised missiles.`, "info");

              setFighters((prevF) =>
                prevF.map((f) =>
                  f.id === enemy.id
                    ? { ...f, remainingAttacks: Math.max(0, (f.remainingAttacks ?? 1) - 1) }
                    : f
                )
              );
              setDefensiveStance((prevSt) => ({ ...prevSt, [enemy.id]: "Search" }));
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          }
        }
      }
      
      if (!rangeValidation.canAttack) {
        needsToMoveCloser = true;
        addLog(`📍 ${enemy.name} is ${Math.round(currentDistance)}ft from ${target.name} (${rangeValidation.reason})`, "info");
      } else {
        addLog(`✅ ${enemy.name} is in range (${rangeValidation.reason})`, "info");
        if (rangeValidation.rangeInfo) {
          addLog(`📍 ${enemy.name} attacking at ${rangeValidation.rangeInfo}`, "info");
        }
      }
    }
    // Enhanced enemy AI using distance-based combat system
    if (needsToMoveCloser && target && positions[enemy.id] && positions[target.id]) {
      const currentPos = positions[enemy.id];
      const targetPos = positions[target.id];
      
      // Use analyzeMovementAndAttack to determine best movement strategy
      const equippedWeapon = enemy.equippedWeapons?.primary || enemy.equippedWeapons?.secondary || enemy.attacks?.[0] || null;
      if (equippedWeapon) {
        const movementAnalysis = analyzeMovementAndAttack(enemy, target, currentPos, targetPos, equippedWeapon);
        if (movementAnalysis.recommendations && movementAnalysis.recommendations.length > 0) {
          addLog(`🔍 ${enemy.name} analyzes movement: ${movementAnalysis.distance}ft away, ${movementAnalysis.inRange ? 'in range' : 'needs to move'}`, "info");
        }
      }
      
      // Use new AI system for movement decisions with flanking consideration
      const aiDecision = calculateEnemyMovementAI(enemy, target, currentPos, targetPos, availableAttacks);
      
      // Check for flanking opportunities
      const flankingPositions = findFlankingPositions(targetPos, positions, enemy.id);
      const currentFlankingBonus = calculateFlankingBonus(currentPos, targetPos, positions, enemy.id);
      
      // Check if target is already marked as unreachable
      const unreachableForEnemy = aiUnreachableTargetsRef.current?.[enemy.id];
      const isTargetUnreachable = unreachableForEnemy?.has(target.id) || false;
      
      const isRangedSelectedAttackForFlank =
        selectedAttack?.type === "ranged" ||
        selectedAttack?.weaponType === "thrown" ||
        selectedAttack?.isThrown === true ||
        (selectedAttack?.range != null && Number(selectedAttack.range) > 10) ||
        (selectedAttack?.category && String(selectedAttack.category).toLowerCase() === "thrown");

      // If we can flank, prioritize flanking positions (MELEE ONLY)
      // BUT: Check if target is reachable with melee first (skip if already marked unreachable)
      if (!isRangedSelectedAttackForFlank && flankingPositions.length > 0 && currentFlankingBonus === 0 && !isTargetUnreachable) {
        // Check if target is reachable with melee before attempting to flank
        const currentDistance = calculateDistance(currentPos, targetPos);
        const rangeCheck = validateEnemyAttackRange(currentDistance);
        
        if (!rangeCheck.canAttack && rangeCheck.isUnreachable) {
          // Target is unreachable (e.g., flying too high) - mark it and skip flanking
          if (!aiUnreachableTargetsRef.current[enemy.id]) {
            aiUnreachableTargetsRef.current[enemy.id] = new Set();
          }
          aiUnreachableTargetsRef.current[enemy.id].add(target.id);
          addLog(
            `❌ ${enemy.name} skips flanking ${target.name} (target unreachable: ${rangeCheck.reason})`,
            "warning"
          );
          // Skip to next action instead of attempting to flank - fall through to normal movement logic
        } else {
          addLog(`🎯 ${enemy.name} considers flanking ${target.name}`, "info");
        
          // TWO-STAGE FLANKING APPROACH:
          // Stage 1: Far away (>30ft) - just move toward target, don't pick specific flank tile
          // Stage 2: Near enough (≤30ft) - pick reachable flank tile or step toward best one
          const distanceToTarget = calculateDistance(currentPos, targetPos);
          const flankPlanRadiusFt = 30; // 6 hexes * 5ft
          
          if (distanceToTarget > flankPlanRadiusFt) {
            // Far away: don't pick a flank tile yet — just close distance
            // Fall through to normal movement logic (which will move toward target)
            addLog(`🎯 ${enemy.name} is too far (${Math.round(distanceToTarget)}ft) to plan flanking, closing distance first`, "info");
            // Continue to normal movement below
          } else {
            // Near enough: pick best reachable flank tile or step toward it
            const maxMoveFt = getMaxMoveFtThisAction(enemy, "Run");
            
            // Score and filter flanking positions
            const scoredFlankPositions = flankingPositions
              .map(flankPos => {
                const dist = calculateDistance(currentPos, flankPos);
                const targetDist = calculateDistance(flankPos, targetPos);
                // Score: prefer closer to current position, prefer behind target
                const score = 1000 - dist - (targetDist * 0.1);
                return { pos: flankPos, dist, targetDist, score };
              })
              .filter(fp => {
                // Filter out occupied positions
                for (const [id, pos] of Object.entries(positions)) {
                  if (id !== enemy.id && pos.x === fp.pos.x && pos.y === fp.pos.y) {
                    return false;
                  }
                }
                return isValidPosition(fp.pos.x, fp.pos.y);
              })
              .sort((a, b) => b.score - a.score);
            
            if (scoredFlankPositions.length === 0) {
              addLog(`❌ ${enemy.name} has no valid flanking positions available`, "info");
              // Fall through to normal movement
            } else {
              // Find best reachable flank position
              const bestFlank = scoredFlankPositions.find(fp => fp.dist <= maxMoveFt);
              
              let targetFlankPos;
              if (bestFlank) {
                // Can reach a flank position this action
                targetFlankPos = bestFlank.pos;
                addLog(`🎯 ${enemy.name} attempts to flank ${target.name} (can reach flank tile)`, "info");
              } else {
                // Can't reach any flank position - step toward the best one
                const bestCandidate = scoredFlankPositions[0];
                // Calculate step position toward best flank (move maxMoveFt toward it)
                const dx = bestCandidate.pos.x - currentPos.x;
                const dy = bestCandidate.pos.y - currentPos.y;
                const stepDist = Math.min(bestCandidate.dist, maxMoveFt);
                const stepRatio = stepDist / bestCandidate.dist;
                targetFlankPos = {
                  x: Math.round(currentPos.x + (dx * stepRatio)),
                  y: Math.round(currentPos.y + (dy * stepRatio))
                };
                // Ensure valid position
                if (!isValidPosition(targetFlankPos.x, targetFlankPos.y)) {
                  // Fallback: move toward target instead
                  addLog(`🎯 ${enemy.name} cannot reach flanking position, moving toward target instead`, "info");
                  // Fall through to normal movement
                } else {
                  addLog(`🎯 ${enemy.name} steps toward flanking position (need=${Math.round(bestCandidate.dist)}ft, max=${Math.round(maxMoveFt)}ft)`, "info");
                }
              }
              
              if (targetFlankPos) {
                // Move to flanking position (or step toward it)
                const actualFlankDistance = calculateDistance(currentPos, targetFlankPos);
                
                setPositions(prev => {
                  const updated = {
                    ...prev,
                    [enemy.id]: targetFlankPos
                  };
                  positionsRef.current = updated;
                  return updated;
                });
                
                // Deduct movement action cost (1 action for movement)
                setFighters(prev => prev.map(f => 
                  f.id === enemy.id 
                    ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
                    : f
                ));
                
                addLog(`🎯 ${enemy.name} targets flanking position (${targetFlankPos.x}, ${targetFlankPos.y})`, "info");
                
                // Continue with attack after movement
                setTimeout(() => {
                  if (!combatActive || combatEndCheckRef.current) return;
                  
                  const newDistance = calculateDistance(targetFlankPos, targetPos);
                  const rangeValidation = validateEnemyAttackRange(newDistance);
                  
                  if (rangeValidation.canAttack) {
                    const flankingBonus = calculateFlankingBonus(targetFlankPos, targetPos, positions, enemy.id);
                    if (flankingBonus > 0) {
                      addLog(`🎯 ${enemy.name} gains flanking bonus (+${flankingBonus} to hit)!`, "info");
                    }
                    
                    // Execute attack with flanking bonus
                    const updatedEnemy = { ...enemy, selectedAttack: selectedAttack };
                    const bonuses = flankingBonus > 0 ? { flankingBonus } : {};
                    attack(updatedEnemy, target.id, bonuses);
                    
                    processingEnemyTurnRef.current = false;
                    scheduleEndTurn();
                  } else {
                    if (rangeValidation.isUnreachable) {
                      addLog(
                        `❌ ${enemy.name} realizes ${target.name} is unreachable (${rangeValidation.reason}).`,
                        "warning"
                      );
                      
                      // Remember this for this combat
                      if (!aiUnreachableTargetsRef.current[enemy.id]) {
                        aiUnreachableTargetsRef.current[enemy.id] = new Set();
                      }
                      aiUnreachableTargetsRef.current[enemy.id].add(target.id);
                    } else {
                      addLog(
                        `❌ ${enemy.name} cannot reach ${target.name} from flanking position (${rangeValidation.reason})`,
                        "error"
                      );
                    }
                    processingEnemyTurnRef.current = false;
                    scheduleEndTurn();
                  }
                }, 1000);
                return;
              }
            }
          }
        }
      }
      
      // Get enemy speed for movement calculations
      const speed = enemy.Spd || enemy.spd || enemy.attributes?.Spd || enemy.attributes?.spd || 10;
      
      let movementType = 'MOVE';
      let movementDescription = 'moves';
      let hexesToMove = 1;
      let isChargingAttack = false;
      
      switch (aiDecision.decision) {
        case 'charge':
          movementType = 'CHARGE';
          movementDescription = 'charges';
          // Charge is limited to 3 hexes max
          hexesToMove = Math.min(Math.round(currentDistance / GRID_CONFIG.CELL_SIZE) - 1, 3);
          isChargingAttack = true;
          addLog(`⚡ ${enemy.name} decides to charge! (${aiDecision.reason})`, "info");
          break;
          
        case 'move_and_attack': {
          movementType = 'MOVE';
          movementDescription = 'moves closer';
          // Use unified movement calculation for walking speed
          const moveAndAttackFeet = getMaxMoveFtThisAction(enemy, "MOVE");
          hexesToMove = Math.floor(moveAndAttackFeet / GRID_CONFIG.CELL_SIZE);
          addLog(`🏃 ${enemy.name} moves closer to attack (${aiDecision.reason})`, "info");
          break;
        }
          
        case 'move_closer': {
          movementType = 'RUN';
          movementDescription = 'runs closer';
          // Use unified movement calculation for running speed
          const moveCloserFeet = getMaxMoveFtThisAction(enemy, "Run");
          hexesToMove = Math.floor(moveCloserFeet / GRID_CONFIG.CELL_SIZE);
          addLog(`🏃 ${enemy.name} runs closer (${aiDecision.reason})`, "info");
          break;
        }
          
        case 'use_ranged': {
          // Try to use ranged attack instead of moving
          const rangedAttack = availableAttacks.find(a => a.range && a.range > 0);
          if (rangedAttack) {
            addLog(`🏹 ${enemy.name} uses ranged attack instead of moving (${aiDecision.reason})`, "info");
            setTimeout(() => {
              if (!combatActive || combatEndCheckRef.current) return;
              const flankingBonus = calculateFlankingBonus(positions[enemy.id], positions[target.id], positions, enemy.id);
              const bonuses = flankingBonus > 0 ? { flankingBonus } : {};
              // Preserve selectedAttack for ranged attacks
              const updatedEnemyForRanged = { 
                ...enemy, 
                selectedAttack: rangedAttack,
                attacks: enemy.attacks || []
              };
              attack(updatedEnemyForRanged, target.id, bonuses);
            }, 1000);
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
          // Fall back to movement if no ranged attack
          movementType = MOVEMENT_ACTIONS.RUN.name;
          movementDescription = 'runs closer';
          // Use unified movement calculation
          const fallbackFeet = getMaxMoveFtThisAction(enemy, "Run");
          hexesToMove = Math.floor(fallbackFeet / GRID_CONFIG.CELL_SIZE);
          break;
        }
          
        default:
          movementType = MOVEMENT_ACTIONS.MOVE.name;
          movementDescription = 'moves';
          // Use unified movement calculation
          const defaultFeet = getMaxMoveFtThisAction(enemy, "MOVE");
          hexesToMove = Math.floor(defaultFeet / GRID_CONFIG.CELL_SIZE);
      }
      
      // For very far distances, ensure we use RUN movement type
      if (currentDistance > 20 * GRID_CONFIG.CELL_SIZE) {
        // Far away - RUN (move at full speed)
        movementType = MOVEMENT_ACTIONS.RUN.name;
        movementDescription = 'runs';
        
        // Use unified movement calculation
        const maxMovementFeet = getMaxMoveFtThisAction(enemy, "Run");
        hexesToMove = Math.floor(maxMovementFeet / GRID_CONFIG.CELL_SIZE);
        
        addLog(`🏃 ${enemy.name} is very far away, ${movementDescription} at full speed (${Math.round(maxMovementFeet)}ft/action)`, "info");
      }
      // else: close distance (1-3 hexes) - use default MOVE (1 hex)
      
      // If we decided to CHARGE, make sure we're using a charge-type attack!
      if (movementType === 'CHARGE' && isChargingAttack) {
        const chargeAttacks = availableAttacks.filter(a => 
          a.name.toLowerCase().includes('charge') ||
          a.name.toLowerCase().includes('gore') ||
          a.name.toLowerCase().includes('ram')
        );
        
        if (chargeAttacks.length > 0) {
          selectedAttack = chargeAttacks[0]; // Use Horn Charge, Gore, etc.
          addLog(`⚡ ${enemy.name} selects ${selectedAttack.name} for the charge!`, "combat");
        }
      }
      
      // Calculate new position
      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // FIX: Check for zero or very small distance to prevent NaN
      if (distance < 0.01) {
        // Already at target position, no movement needed
        addLog(`📍 ${enemy.name} is already at target position, skipping movement`, "info");
        // Continue to attack if in range
        const distanceFromCurrentPos = calculateDistance(currentPos, targetPos);
        const rangeValidation = validateEnemyAttackRange(distanceFromCurrentPos);
        
        if (rangeValidation.canAttack) {
          addLog(`⚔️ ${enemy.name} attacks from current position (${rangeValidation.reason})`, "info");
          // Continue to attack below (don't return)
        } else {
          addLog(`⚔️ ${enemy.name} cannot reach target (${rangeValidation.reason}) and ends turn`, "info");
          processingEnemyTurnRef.current = false;
          scheduleEndTurn();
          return;
        }
      }
      
      // Calculate distance in hexes for movement calculations
      const hexDistance = Math.round(currentDistance / GRID_CONFIG.CELL_SIZE);
      
      // Use unified movement calculation
      const maxMoveFtThisAction = getMaxMoveFtThisAction(enemy, movementType);
      const maxHexesThisAction = Math.floor(maxMoveFtThisAction / GRID_CONFIG.CELL_SIZE);
      
      addLog(`🔍 ${enemy.name} movement debug: distance=${Math.round(currentDistance)}ft, hexDistance=${hexDistance}, hexesToMove=${hexesToMove}, maxThisAction=${Math.round(maxMoveFtThisAction)}ft (${maxHexesThisAction} hexes), movementType=${movementType}`, "info");
      
      // Determine actual hexes to move (don't overshoot, but ensure at least 1 hex if far away)
      // Fix: Ensure we always make progress toward the target
      let actualHexesToMove;
      
      if (currentDistance > 100) {
        // For very far distances, move more aggressively to prevent infinite loops
        actualHexesToMove = Math.min(hexesToMove * 3, Math.floor(hexDistance / 3));
        actualHexesToMove = Math.max(5, actualHexesToMove); // Minimum 5 hexes for far distances
        addLog(`🔍 ${enemy.name} far away (${Math.round(currentDistance)}ft), using aggressive movement: ${actualHexesToMove} hexes`, "info");
      } else {
        // Normal movement calculation
        actualHexesToMove = Math.max(1, Math.min(hexesToMove, hexDistance - 1)); // At least 1 hex, stop 1 hex away
      }
      const moveRatio = (actualHexesToMove * GRID_CONFIG.CELL_SIZE) / (distance * GRID_CONFIG.CELL_SIZE);
      
      // Log movement ratio for debugging (if significant movement)
      if ((import.meta.env?.DEV || import.meta.env?.MODE === 'development') && moveRatio > 0.1) {
        console.debug(`[handleEnemyTurn] Movement ratio: ${(moveRatio * 100).toFixed(1)}% of distance`);
      }
      
      let newX, newY, movementInfo;
      
      if (movementType === MOVEMENT_ACTIONS.MOVE.name || movementType === MOVEMENT_ACTIONS.CHARGE.name) {
        // MOVE: move calculated hexes immediately
        // CHARGE: move multiple hexes immediately and attack with bonuses
        const hexesThisTurn = actualHexesToMove; // Use the calculated movement distance
        
        // FIX: Prevent NaN by ensuring distance is valid
        if (distance < 0.01) {
          newX = currentPos.x;
          newY = currentPos.y;
        } else {
          newX = Math.round(currentPos.x + (dx / distance) * hexesThisTurn);
          newY = Math.round(currentPos.y + (dy / distance) * hexesThisTurn);
        }
        
        // Ensure valid numbers
        newX = isNaN(newX) ? currentPos.x : newX;
        newY = isNaN(newY) ? currentPos.y : newY;
        
        // ✅ Air-vs-ground rule: never attempt to move into an airborne target's hex.
        // Hex occupancy is 2D; a flying target "occupies" its XY, so ground units should move adjacent instead.
        const targetAltForMove = getAltitude(target) || 0;
        const targetIsAirborneForMove = isFlying(target) && targetAltForMove > 5;
        const attackerCanFlyForMove = canFly(enemy) || isFlying(enemy);

        if (targetIsAirborneForMove && !attackerCanFlyForMove && newX === targetPos.x && newY === targetPos.y) {
          const neighbors = getHexNeighbors(targetPos.x, targetPos.y) || [];
          const open = neighbors.filter((n) => isValidPosition(n.x, n.y) && !isHexOccupied(n.x, n.y, enemy.id));
          if (open.length > 0) {
            const best = open.reduce((best, cur) => {
              const bd = calculateDistance(currentPos, best);
              const cd = calculateDistance(currentPos, cur);
              return cd < bd ? cur : best;
            });
            newX = best.x;
            newY = best.y;
          }
        }

        addLog(`🔍 ${enemy.name} calculated movement: from (${currentPos.x}, ${currentPos.y}) to (${newX}, ${newY}), hexesThisTurn=${hexesThisTurn}`, "info");
        
        // Check if destination is occupied
        let occupant = isHexOccupied(newX, newY, enemy.id);

        // If we still collided with an airborne target's hex (rounding), try an adjacent fallback.
        if (occupant && targetIsAirborneForMove && !attackerCanFlyForMove && occupant.id === target.id) {
          const neighbors = getHexNeighbors(targetPos.x, targetPos.y) || [];
          const open = neighbors.filter((n) => isValidPosition(n.x, n.y) && !isHexOccupied(n.x, n.y, enemy.id));
          if (open.length > 0) {
            const best = open.reduce((best, cur) => {
              const bd = calculateDistance(currentPos, best);
              const cd = calculateDistance(currentPos, cur);
              return cd < bd ? cur : best;
            });
            newX = best.x;
            newY = best.y;
            occupant = isHexOccupied(newX, newY, enemy.id);
          }
        }
        if (occupant) {
          addLog(`🚫 ${enemy.name} cannot move to (${newX}, ${newY}) - occupied by ${occupant.name}`, "info");
          
          // Recalculate distance from CURRENT position (not the blocked destination)
          const distanceFromCurrentPos = calculateDistance(currentPos, targetPos);
          
          // Check if within weapon range
          const rangeValidation = validateEnemyAttackRange(distanceFromCurrentPos);
          
          if (rangeValidation.canAttack) {
            addLog(`⚔️ ${enemy.name} is within range (${rangeValidation.reason}) and attacks`, "info");
            // Don't end turn, continue to attack below
          } else {
            addLog(`⚔️ ${enemy.name} cannot reach target (${rangeValidation.reason}) and ends turn`, "info");
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
        } else {
          // Not occupied, safe to move
          const currentMovementAction = movementType === MOVEMENT_ACTIONS.CHARGE.name ? MOVEMENT_ACTIONS.CHARGE : MOVEMENT_ACTIONS.MOVE;
          movementInfo = {
            action: movementType,
            actionCost: currentMovementAction.actionCost,
            description: movementType === MOVEMENT_ACTIONS.CHARGE.name 
              ? `Charge to position (${newX}, ${newY}) - ${MOVEMENT_ACTIONS.CHARGE.description}`
              : `Move to position (${newX}, ${newY}) - ${MOVEMENT_ACTIONS.MOVE.description}`
          };
          
          // Update position immediately for MOVE or CHARGE
          handlePositionChange(enemy.id, { x: newX, y: newY }, movementInfo);
          
          const distanceMoved = hexesThisTurn * GRID_CONFIG.CELL_SIZE;
          const actionVerb = movementType === MOVEMENT_ACTIONS.CHARGE.name ? 'charges' : 'moves';
          
          // Use MOVEMENT_RATES for 1994 Palladium format
          const movementRates = MOVEMENT_RATES.calculateMovement(speed);
          const runAction = MOVEMENT_ACTIONS.RUN;
          addLog(`🏃 ${enemy.name} uses ${runAction.actionCost} action(s) to ${runAction.name} (Speed ${speed} → ${movementRates.running}ft/melee)`, "info");
          addLog(`📍 ${enemy.name} ${actionVerb} ${Math.round(distanceMoved)}ft toward ${target.name} → new position (${newX},${newY})`, "info");
          
          // Deduct 1 action for movement
          setFighters(prev => prev.map(f => {
            if (f.id === enemy.id) {
              const updatedEnemy = { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) };
              addLog(`⏭️ ${enemy.name} has ${updatedEnemy.remainingAttacks} action(s) remaining this melee`, "info");
              return updatedEnemy;
            }
            return f;
          }));
          
          if (movementType === MOVEMENT_ACTIONS.CHARGE.name) {
            // CHARGE continues to attack on same turn (don't end turn yet!)
            const chargeAction = MOVEMENT_ACTIONS.CHARGE;
            addLog(`⚡ Now within melee range! Charge attack: ${chargeAction.description}`, "combat");
            // Continue to attack section below (don't return)
          } else {
            // After movement, check if we're now in range
            const newDistanceAfterMove = calculateDistance({ x: newX, y: newY }, targetPos);
            const rangeValidation = validateEnemyAttackRange(newDistanceAfterMove);
            
            const updatedEnemy = fighters.find(f => f.id === enemy.id);
            const hasActionsRemaining = updatedEnemy && updatedEnemy.remainingAttacks > 0;
            
            if (rangeValidation.canAttack && hasActionsRemaining) {
              // In range - perform a single attack, then end turn
              // Ensure selectedAttack is preserved (don't let weapon selection override natural attacks)
              const updatedEnemyForAttack = { 
                ...enemy, 
                selectedAttack: selectedAttack,
                // Explicitly set to prevent weapon selection from overriding
                attacks: enemy.attacks || []
              };
              attack(updatedEnemyForAttack, target.id, {});
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            } else {
              // Not in range or no actions - end turn
              const remainingDistance = Math.round(newDistanceAfterMove);
              if (remainingDistance > 5) {
                addLog(`📍 ${enemy.name} still ${remainingDistance}ft out of melee range - ending turn`, "info");
              } else if (!hasActionsRemaining) {
                addLog(`⏭️ ${enemy.name} has no actions remaining after movement - passing to next fighter`, "info");
              }
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return;
            }
          }
        }
      } else {
        // RUN/SPRINT: Move immediately (Palladium 1994 - no future movement)
        const moveDistance = actualHexesToMove;
        
        // FIX: Prevent NaN by checking distance is valid
        if (distance < 0.01) {
          // Already at target, don't move
          newX = currentPos.x;
          newY = currentPos.y;
        } else {
          newX = Math.round(currentPos.x + (dx / distance) * moveDistance);
          newY = Math.round(currentPos.y + (dy / distance) * moveDistance);
        }
        
        // Clamp to grid bounds and ensure valid numbers
        newX = Math.max(0, Math.min(GRID_CONFIG.GRID_WIDTH - 1, isNaN(newX) ? currentPos.x : newX));
        newY = Math.max(0, Math.min(GRID_CONFIG.GRID_HEIGHT - 1, isNaN(newY) ? currentPos.y : newY));
        
        // Check if destination is occupied
        const occupant = isHexOccupied(newX, newY, enemy.id);
        let targetX = newX;
        let targetY = newY;
        let closingIntoOpponent = false;
        let attackOfOpportunityAttacker = null;
        if (occupant) {
          const occupantIsAlly = occupant.type === enemy.type;
          
          if (occupantIsAlly) {
            addLog(`🏃 ${enemy.name} weaves past ${occupant.name} while running full tilt`, "info");
          } else {
            let attackRange = 5.5;
            if (typeof selectedAttack?.range === "number") {
              attackRange = selectedAttack.range;
            } else if (selectedAttack?.weapon) {
              const derivedRange = getWeaponRange(selectedAttack.weapon);
              if (typeof derivedRange === "number" && !Number.isNaN(derivedRange)) {
                attackRange = derivedRange;
              }
            }
            
            if (attackRange <= 5.5) {
              closingIntoOpponent = true;
              attackOfOpportunityAttacker = occupant;
              addLog(`⚔️ ${enemy.name} barrels through to engage ${occupant.name}!`, "info");
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
                      addLog(`📍 ${enemy.name} adjusts path to avoid ${occupant.name}, moving to (${targetX}, ${targetY})`, "info");
                  break;
                }
              }
            }
          }
          
          if (!foundAlternative) {
            addLog(`🚫 ${enemy.name} cannot find path to target - all hexes occupied`, "info");
            addLog(`⏭️ ${enemy.name} ends turn (blocked)`, "info");
            processingEnemyTurnRef.current = false;
                scheduleEndTurn();
            return;
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
        setPositions(prev => {
          const updated = {
            ...prev,
            [enemy.id]: { x: targetX, y: targetY }
          };
          positionsRef.current = updated;
          return updated;
        });
        
        if (closingIntoOpponent && attackOfOpportunityAttacker) {
          addLog(`⚠️ ${attackOfOpportunityAttacker.name} gets an attack of opportunity against ${enemy.name}!`, "warning");
          const attackerForAoO = attackOfOpportunityAttacker;
          const targetForAoO = enemy.id;
          
          setTimeout(() => {
            if (attackRef.current) {
              attackRef.current(attackerForAoO, targetForAoO, {});
            } else {
              addLog(`⚠️ Attack of opportunity delayed - attack system not ready`, "info");
              setTimeout(() => {
                if (attackRef.current) {
                  attackRef.current(attackerForAoO, targetForAoO, {});
                }
              }, 1000);
            }
          }, 500);
        }
        
        const distanceMoved = calculateDistance(currentPos, { x: targetX, y: targetY });
        
        // 1994 Palladium format: RUN/SPRINT uses one action
        const feetPerMelee = speed * 18; // Official formula
        addLog(`🏃 ${enemy.name} uses one action to RUN (Speed ${speed} → ${feetPerMelee}ft/melee)`, "info");
        addLog(`📍 Moves up to ${Math.round(distanceMoved)}ft toward ${target.name} → new position (${targetX},${targetY})`, "info");
        
        // Deduct 1 action for movement
        setFighters(prev => prev.map(f => {
          if (f.id === enemy.id) {
            const updatedEnemy = { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) };
            addLog(`⏭️ ${enemy.name} has ${updatedEnemy.remainingAttacks} action(s) remaining this melee`, "info");
            return updatedEnemy;
          }
          return f;
        }));
        
        // After RUN/SPRINT movement, check if we're now in range and can attack
        setTimeout(() => {
          setPositions(currentPositions => {
            positionsRef.current = currentPositions;
            const latestEnemyPos = currentPositions[enemy.id] || { x: targetX, y: targetY };
            const latestTargetPos = currentPositions[target.id] || targetPos;
            const finalDistance = calculateDistance(latestEnemyPos, latestTargetPos);
            const rangeValidation = validateEnemyAttackRange(finalDistance);
            
            const updatedEnemy = fighters.find(f => f.id === enemy.id);
            const hasActionsRemaining = updatedEnemy && updatedEnemy.remainingAttacks > 0;
            
            // ✅ FIX: Check combat status and target validity before attacking
            if (!combatActive) {
              addLog(`⚠️ Combat ended, ${enemy.name} stops moving`, "info");
              processingEnemyTurnRef.current = false;
              return currentPositions;
            }
            
            // Check if target is still valid
            const updatedTarget = fighters.find(f => f.id === target.id);
            if (!updatedTarget || updatedTarget.currentHP <= 0 || updatedTarget.currentHP <= -21) {
              addLog(`⚠️ ${enemy.name}'s target is no longer valid, ending turn`, "info");
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              return currentPositions;
            }
            
            if (rangeValidation.canAttack && hasActionsRemaining) {
              addLog(`⚔️ ${enemy.name} is now in range (${rangeValidation.reason})!`, "info");
              // Preserve selectedAttack from attacks array (don't let weapon selection override)
              const updatedEnemyForAttack = { 
                ...enemy, 
                selectedAttack: selectedAttack,
                attacks: enemy.attacks || [] // Ensure attacks array is preserved
              };
              attack(updatedEnemyForAttack, target.id, {
                attackerPosOverride: latestEnemyPos,
                defenderPosOverride: latestTargetPos,
                distanceOverride: finalDistance
              });
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
              } else {
                if (finalDistance > 5) {
                  addLog(`📍 ${enemy.name} still ${Math.round(finalDistance)}ft out of melee range - ending turn`, "info");
                } else if (!hasActionsRemaining) {
                addLog(`⏭️ ${enemy.name} has no actions remaining - passing to next fighter`, "info");
                }
                processingEnemyTurnRef.current = false;
                setTimeout(() => {
                  // ✅ GUARD: Check combat state in delayed callback
                  if (!combatActive || combatEndCheckRef.current) return;
                  endTurn();
                }, 1500);
              }
              
              return currentPositions;
            });
          }, 800);
          return;
      }
    }
    
    // ✅ FIX: Final validation: make sure target can still be attacked and combat is active
    if (!combatActive) {
      addLog(`⚠️ Combat ended, ${enemy.name} stops attacking`, "info");
      processingEnemyTurnRef.current = false;
      return;
    }
    
    if (!target || target.currentHP <= -21) {
      addLog(`⚠️ ${enemy.name}'s target is dead, ending turn`, "info");
      processingEnemyTurnRef.current = false;
      scheduleEndTurn();
      return;
    }
    
    // ✅ FIX: Don't allow attacking unconscious/dying targets if all players are already defeated
    // Exception: Evil alignments may finish off dying players (coup de grâce)
    if (target && target.currentHP <= 0 && target.currentHP > -21) {
      // Check if there are any conscious players remaining
      const consciousPlayers = fighters.filter(f => f.type === "player" && canFighterAct(f) && f.currentHP > 0);
      const enemyAlignment = enemy.alignment || enemy.attributes?.alignment || "";
      const isEvil = isEvilAlignment(enemyAlignment);
      
      if (consciousPlayers.length === 0) {
        // All players are defeated
        if (isEvil) {
          // Evil alignments may finish off dying players (coup de grâce)
          const hpStatus = getHPStatus(target.currentHP);
          addLog(`😈 ${enemy.name} (${enemyAlignment}) finishes off dying ${target.name} (${hpStatus.description})!`, "warning");
        } else {
          // Good/neutral alignments show mercy - don't attack unconscious players
          addLog(`⚠️ All players are defeated! ${enemy.name} shows mercy and stops attacking.`, "info");
          if (!combatEndCheckRef.current) {
            combatEndCheckRef.current = true;
            combatOverRef.current = true; // ✅ AUTHORITATIVE: Stop all further actions (defeat)
            addLog("💀 All players are defeated! Enemies win!", "defeat");
            setCombatActive(false);

            // ✅ CRITICAL: Clear ALL pending timeouts to stop post-defeat actions
            if (turnTimeoutRef.current) {
              clearTimeout(turnTimeoutRef.current);
              turnTimeoutRef.current = null;
            }
            allTimeoutsRef.current.forEach(clearTimeout);
            allTimeoutsRef.current = [];
          }
          processingEnemyTurnRef.current = false;
          return;
        }
      } else {
        // Still conscious players remaining - allow attacking dying ones
        const hpStatus = getHPStatus(target.currentHP);
        if (isEvil) {
          addLog(`😈 ${enemy.name} (${enemyAlignment}) attacks dying ${target.name} (${hpStatus.description})!`, "warning");
        } else {
          addLog(`⚠️ ${enemy.name} targeting ${target.name} who is ${hpStatus.description}`, "warning");
        }
      }
    }
    
    // Check if this is an area attack (Horn Charge, etc.)
    const isAreaAttack = selectedAttack.name.toLowerCase().includes('charge') || 
                        selectedAttack.name.toLowerCase().includes('gore') ||
                        selectedAttack.name.toLowerCase().includes('ram');
    
    if (isAreaAttack && isTargetBlocked(enemy.id, target.id, positions)) {
      // Area attack - can hit multiple targets in line
      const targetsInLine = getTargetsInLine(enemy.id, target.id, positions);
      
      if (targetsInLine.length > 0) {
        addLog(`⚡ ${enemy.name} uses ${attackName} - area attack hitting ${targetsInLine.length} target(s)!`, "info");
        
        // Execute area attack on all targets in line (one action, multiple targets)
        const chargeBonus = isChargingAttack ? { strikeBonus: +2 } : {};
        
        // Attack all targets in line, but this is still ONE action
        // Preserve selectedAttack for area attacks
        const updatedEnemyForArea = { 
          ...enemy, 
          selectedAttack: selectedAttack,
          attacks: enemy.attacks || []
        };
        targetsInLine.forEach((lineTarget) => {
          attack(updatedEnemyForArea, lineTarget.id, {
            ...chargeBonus,
            flankingBonus: calculateFlankingBonus(
              positions[enemy.id],
              positions[lineTarget.id],
              positions,
              enemy.id
            ),
          });
        });
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
    }
    
    addLog(`🤖 ${enemy.name} ${reasoning} and attacks ${target.name} with ${attackName}!`, "info");
    
    // Create updated enemy with selected attack (don't update state yet to prevent re-render loop)
    // Preserve selectedAttack from attacks array - don't let weapon selection override natural attacks
    const updatedEnemy = { 
      ...enemy, 
      selectedAttack: selectedAttack,
      attacks: enemy.attacks || [] // Ensure attacks array is preserved
    };
    
    // Get the number of attacks for this attack type
    const attackCount = selectedAttack.count || 1;
    
    // Determine if this is a charging attack (for bonuses)
    const chargeBonus = isChargingAttack ? { strikeBonus: +2 } : {};
    
    const isRangedSelectedAttack =
      selectedAttack?.type === "ranged" ||
      selectedAttack?.weaponType === "thrown" ||
      selectedAttack?.isThrown === true ||
      (selectedAttack?.range != null && Number(selectedAttack.range) > 10) ||
      (selectedAttack?.category && String(selectedAttack.category).toLowerCase() === "thrown");

    // Flanking is melee-only.
    const attackFlankingBonus = isRangedSelectedAttack
      ? 0
      : calculateFlankingBonus(positions[enemy.id], positions[target.id], positions, enemy.id);
    const flankingBonus = attackFlankingBonus > 0 ? { flankingBonus: attackFlankingBonus } : {};
    
    // Combine all bonuses
    const allBonuses = { ...chargeBonus, ...flankingBonus };
    
    if (attackFlankingBonus > 0 && !isRangedSelectedAttack) {
      addLog(`🎯 ${enemy.name} gains +${attackFlankingBonus} flanking bonus!`, "info");
    }
    
    // Execute attack - handle attack count for multi-strike attacks
    // The count property is for attacks that hit multiple times in ONE action (like dual wield)
    if (attackCount > 1) {
      addLog(`⚔️ ${enemy.name} performs ${attackCount}-strike attack!`, "info");
    }
    attack(updatedEnemy, target.id, allBonuses);
    
    // End of handleEnemyTurn: schedule the turn advance; AI locks are released in endTurn()
    scheduleEndTurn(1500);
  }, [
    fighters,
    addLog,
    endTurn,
    attack,
    positions,
    handlePositionChange,
    isHexOccupied,
    getAvailableSkills,
    isEvilAlignment,
    calculateDistance,
    setFighters,
    healerAbility,
    clericalHealingTouch,
    medicalTreatment,
    combatTerrain,
    arenaEnvironment,
    scheduleEndTurn,
    settings,
    canFighterAct,
    isValidPosition,
    canAISeeTarget,
    fogEnabled,
    visibleCells,
    setPositions,
  ]);
  
  // Store the latest handleEnemyTurn in a ref to avoid dependency loops in useEffect
  useEffect(() => {
    handleEnemyTurnRef.current = handleEnemyTurn;
  }, [handleEnemyTurn]);

  // Store the attack function in a ref to avoid initialization order issues
  useEffect(() => {
    attackRef.current = attack;
  }, [attack]);

  // Auto-open combat choices when it's a player character's turn
  // Also responds to aiControlEnabled changes during combat
  useEffect(() => {
    // ✅ CRITICAL: Stop processing if combat has ended
    if (!combatActive || combatEndCheckRef.current) {
      lastAutoTurnKeyRef.current = null;
      return;
    }

    if (combatPaused) {
      return;
    }

    if (fighters.length === 0) {
      return;
    }

    const currentFighter = fighters[turnIndex];
    if (!currentFighter) {
      return;
    }

    // ✅ If the fighter has no actions left, don't re-run AI/menus repeatedly.
    // This can happen because endTurn() increments turnCounter before fighter state updates settle.
    if ((currentFighter.remainingAttacks ?? 0) <= 0) {
      const noActionLoopKey = `NOA_${currentFighter.id}_${meleeRound}`;
      if (lastAutoTurnKeyRef.current === noActionLoopKey) return;
      lastAutoTurnKeyRef.current = noActionLoopKey;

      const passLogKey = `${currentFighter.id}:${meleeRound}`;
      if (!noActionsPassLogRef.current.has(passLogKey)) {
        noActionsPassLogRef.current.add(passLogKey);
        addLog(
          `⏭️ ${currentFighter.name} has no actions remaining - passing to next fighter in initiative order`,
          "info"
        );
        // prevent unbounded growth
        if (noActionsPassLogRef.current.size > 200) noActionsPassLogRef.current = new Set();
      }

      endTurn();
      return;
    }

    const currentTurnKey = `${currentFighter.id}-${turnCounter}`;
    if (lastAutoTurnKeyRef.current === currentTurnKey) {
      return;
    }
    lastAutoTurnKeyRef.current = currentTurnKey;
      
      // Skip fighters that can't act (unconscious, dying, dead)
    if (!canFighterAct(currentFighter)) {
        const hpStatus = getHPStatus(currentFighter.currentHP);
        addLog(`⏭️ ${currentFighter.name} cannot act (${hpStatus.description}), skipping turn`, "info");
        endTurn();
        return;
      }

    // If AI is controlling this fighter, auto-select movement mode preference
    // NOTE: We may also auto-takeoff for AI-controlled fliers (costs 1 action).
    let fighterForAITurn = currentFighter;
    if (aiControlEnabled && currentFighter) {
      // If there's an obvious current target, pass it so flight is preferred when target is airborne.
      // This keeps Ariel airborne if she chose to fly and improves flier pursuit behavior.
      let targetForPreference = null;
      try {
        if (currentFighter.type === "player") {
          // players generally target nearest enemy for AI planning
          targetForPreference = fighters.find((f) => f.type === "enemy" && f.currentHP > 0) || null;
        } else {
          targetForPreference = fighters.find((f) => f.type === "player" && f.currentHP > 0) || null;
        }
      } catch { /* ignore */ }

      const preferred = getPreferredMovementModeForAI(currentFighter, targetForPreference);

      // Only flip it if it actually changes (prevents pointless rerenders)
      if (preferred && preferred !== playerMovementMode) {
        setPlayerMovementMode(preferred);
      }

      // Optional/Recommended: If AI prefers flight, auto-takeoff immediately (spend 1 action),
      // so the AI doesn't "stay grounded in flight mode" when it intends to solve an air problem.
      if (
        currentFighter.type === "player" &&
        preferred === "flight" &&
        canFighterFly(currentFighter) &&
        !isFlying(currentFighter) &&
        (getAltitude(currentFighter) || 0) <= 0 &&
        (currentFighter.remainingAttacks ?? 0) > 0
      ) {
        try {
          const takeoff = startFlying(currentFighter, { altitude: 20 });
          if (takeoff?.success && takeoff.fighter) {
            const spent = 1;
            const nextFighter = {
              ...takeoff.fighter,
              remainingAttacks: Math.max(
                0,
                Number(takeoff.fighter.remainingAttacks ?? currentFighter.remainingAttacks ?? 0) - spent
              ),
            };
            setFighters((prev) => prev.map((f) => (f.id === currentFighter.id ? nextFighter : f)));
            addLog(`🪽 ${currentFighter.name} takes off to 20ft (AI auto-takeoff)`, "info");
            fighterForAITurn = nextFighter;
          }
        } catch {
          // ignore
        }
      }
    }
      
    if (currentFighter.type === "player") {
        if (aiControlEnabled) {
          // Handle player turn with AI - prevent duplicate calls
        if (!processingPlayerAIRef.current) {
            setShowCombatChoices(false);
            startTransition(() => {
              setTimeout(() => {
              if (
                combatPausedRef.current ||
                !combatActive ||
                !canFighterAct(currentFighter)
              ) {
                processingPlayerAIRef.current = false;
                return;
              }
                  handlePlayerAITurn(fighterForAITurn);
            }, 0);
            });
          }
        } else {
        // Manual control: open choices once per turn
        if (lastOpenedChoicesTurnRef.current !== currentTurnKey) {
            lastOpenedChoicesTurnRef.current = currentTurnKey;
          if (!showCombatChoices) {
            setShowCombatChoices(true);
            openCombatChoices(); // Also open via disclosure hook
          }
          if (!selectedAction) {
            setSelectedAction(null);
            setSelectedTarget(null);
            setSelectedAttackWeapon(null);
            setSelectedManeuver(null);
            setMovementMode(prev => (prev.active ? { active: false, isRunning: false } : prev));
            setSelectedMovementFighter(null);
          }
          }
        }
      } else {
      // Enemy turn (auto-run)
        setShowCombatChoices(false);
        closeCombatChoices(); // Also close via disclosure hook
          if (!processingEnemyTurnRef.current) {
            startTransition(() => {
              setTimeout(() => {
            if (
              combatPausedRef.current ||
              !combatActive ||
              !canFighterAct(currentFighter)
            ) {
              processingEnemyTurnRef.current = false;
              return;
            }
            handleEnemyTurn(currentFighter);
          }, 0);
            });
          }
        }
  }, [
    combatActive,
    combatPaused,
    fighters,
    turnIndex,
    turnCounter,
    aiControlEnabled,
    handlePlayerAITurn,
    handleEnemyTurn,
    canFighterAct,
    endTurn,
    showCombatChoices,
    selectedAction,
    getPreferredMovementModeForAI,
    getFighterFlyFeetPerAction,
    getFighterGroundFeetPerAction,
    getFighterFlySpeedFeetPerMelee,
    canFighterFly,
    isFlying,
    getAltitude,
    fighters,
    playerMovementMode,
    addLog,
    openCombatChoices,
    closeCombatChoices,
  ]);

  // Helper function to roll HP from dice formulas like "2d6" or "1d8+3" or ranges like "24-96"
  function rollHP(hpFormula) {
    if (!hpFormula) return 1;
    if (typeof hpFormula === 'number') return hpFormula;
    
    const hpString = hpFormula.toString();
    
    // Check if it's a range like "24-96"
    const rangeMatch = hpString.match(/(\d+)-(\d+)/);
    if (rangeMatch) {
      const minHP = parseInt(rangeMatch[1]);
      const maxHP = parseInt(rangeMatch[2]);
      // Use crypto dice for range: roll 1d(maxHP-minHP+1) and add minHP-1
      const rangeSize = maxHP - minHP + 1;
      const diceResult = CryptoSecureDice.parseAndRoll(`1d${rangeSize}`);
      const finalHP = minHP - 1 + diceResult.totalWithBonus;
      
      // Log the HP range roll
      const diceRoll = diceResult.diceRolls?.[0]?.result || diceResult.totalWithBonus;
      addLog(`🎲 HP Range: ${hpString} = ${diceRoll} + ${minHP - 1} = ${finalHP}`, "info");
      
      return finalHP;
    }
    
    try {
      const result = CryptoSecureDice.parseAndRoll(hpString);
      const rolledHP = result.totalWithBonus;
      
      // Log the HP roll with individual dice results
      const diceTotal = result.total || 0;
      const diceRolls = result.individualRolls?.join(" + ") || diceTotal;
      const bonus = result.bonus || 0;
      const bonusText = bonus > 0 ? ` + ${bonus}` : "";
      addLog(`🎲 HP Roll: ${hpString} = [${diceRolls}]${bonusText} = ${rolledHP}`, "info");
      
      return Math.max(1, rolledHP);
    } catch (error) {
      console.warn(`Failed to roll HP formula "${hpFormula}":`, error);
      // Fallback using crypto dice
      const fallbackRoll = CryptoSecureDice.parseAndRoll("1d6"); // 1-6
      const fallbackHP = fallbackRoll.totalWithBonus + 5; // 6-11
      const fallbackDiceRoll = fallbackRoll.diceRolls?.[0]?.result || fallbackRoll.totalWithBonus;
      addLog(`🎲 HP Fallback: 1d6+5 = ${fallbackDiceRoll} + 5 = ${fallbackHP}`, "info");
      return fallbackHP;
    }
  }

  /**
   * Apply level-based stat adjustments to an enemy
   * @param {Object} fighter - Fighter object
   * @param {number} level - Level (1-15)
   * @returns {Object} Updated fighter with level adjustments
   */
  function applyLevelToEnemy(fighter, level) {
    if (!fighter || level <= 1) return fighter;
    
    const levelMultiplier = level - 1; // How many levels above 1
    
    // HP adjustment: +10% per level above 1 (or use level progression if available)
    const baseHP = fighter.maxHP || fighter.currentHP || 20;
    const hpPerLevel = Math.max(1, Math.floor(baseHP * 0.1)); // 10% per level
    const adjustedHP = baseHP + (hpPerLevel * levelMultiplier);
    
    // AR adjustment: +1 per 3 levels (rounded down)
    const arBonus = Math.floor(levelMultiplier / 3);
    const baseAR = fighter.AR || 10;
    const adjustedAR = Math.min(20, baseAR + arBonus); // Cap at 20
    
    // Combat bonuses: +1 strike/parry/dodge per 2 levels
    const combatBonus = Math.floor(levelMultiplier / 2);
    
    // Attacks per melee: +1 per 4 levels
    const attacksBonus = Math.floor(levelMultiplier / 4);
    
    return {
      ...fighter,
      level: level,
      currentHP: adjustedHP,
      maxHP: adjustedHP,
      AR: adjustedAR,
      bonuses: {
        ...(fighter.bonuses || {}),
        strike: (fighter.bonuses?.strike || 0) + combatBonus,
        parry: (fighter.bonuses?.parry || 0) + combatBonus,
        dodge: (fighter.bonuses?.dodge || 0) + combatBonus,
      },
      attacksPerMelee: (fighter.attacksPerMelee || 2) + attacksBonus,
    };
  }

  /**
   * Check if a creature is humanoid
   * @param {Object} creatureData - Creature data from bestiary
   * @returns {boolean} True if humanoid
   */
  function isHumanoid(creatureData) {
    if (!creatureData) return false;
    
    const category = (creatureData.category || "").toLowerCase();
    const name = (creatureData.name || "").toLowerCase();
    const species = (creatureData.species || creatureData.race || "").toLowerCase();
    
    // Check category
    if (category === "humanoid") return true;
    
    // Check common humanoid species
    const humanoidSpecies = [
      "human", "elf", "dwarf", "gnome", "halfling", "kobold", "goblin", 
      "orc", "hobgoblin", "bugbear", "ogre", "troll", "giant", "wolfen"
    ];
    if (humanoidSpecies.some(s => species.includes(s) || name.includes(s))) {
      return true;
    }
    
    return false;
  }

  /**
   * Equip armor to an enemy fighter
   * @param {Object} fighter - Fighter object
   * @param {Object} armorData - Armor data from armorShopData
   * @returns {Object} Updated fighter with armor equipped
   */
  function equipArmorToEnemy(fighter, armorData) {
    if (!fighter || !armorData || armorData.name === "None") {
      return fighter;
    }

    // Initialize equipped object if needed
    if (!fighter.equipped) {
      fighter.equipped = {};
    }

    // Equip armor to chest slot (main armor piece)
    fighter.equipped.chest = {
      name: armorData.name,
      armorRating: armorData.ar,
      sdc: armorData.sdc,
      currentSDC: armorData.sdc,
      weight: armorData.weight || 0,
      price: armorData.cost || 0,
      category: armorData.type || "armor",
      type: "armor",
      slot: "chest",
      broken: false,
    };

    // Update AR - use armor's AR if it's higher than base AR
    const armorAR = armorData.ar || 0;
    const baseAR = fighter.AR || 10;
    fighter.AR = Math.max(baseAR, armorAR);

    // Also set equippedArmor for backwards compatibility
    fighter.equippedArmor = armorData.name;

    return fighter;
  }

  /**
   * Get random alignment from creature's bestiary entry
   * Maps broad categories (good/selfish/evil) to specific Palladium alignments
   * @param {Object} creatureData - The creature data from bestiary.json
   * @returns {string} - Randomly selected alignment
   */
  const getRandomAlignmentFromBestiary = useCallback((creatureData) => {
    if (!creatureData) return "Unprincipled"; // Default fallback

    // All Palladium Fantasy RPG alignments as per rulebook
    const PALLADIUM_ALIGNMENTS = {
      // Good alignments
      "principled": "Principled",
      "scrupulous": "Scrupulous",
      // Selfish alignments
      "unprincipled": "Unprincipled",
      "anarchist": "Anarchist",
      // Evil alignments
      "miscreant": "Miscreant",
      "aberrant": "Aberrant",
      "diabolic": "Diabolic",
      // Broad categories (will be expanded to specific alignments)
      "good": ["Principled", "Scrupulous"],
      "selfish": ["Unprincipled", "Anarchist"],
      "evil": ["Miscreant", "Aberrant", "Diabolic"],
      // Special case
      "unaligned": "Unaligned"
    };

    // Get alignment array from creature data
    let alignmentOptions = creatureData.alignment || creatureData.alignment_options || [];
    
    // If alignment is a string, convert to array
    if (typeof alignmentOptions === "string") {
      alignmentOptions = [alignmentOptions];
    }
    
    // If no alignment specified, check alignment_tendency
    if (!Array.isArray(alignmentOptions) || alignmentOptions.length === 0) {
      const tendency = creatureData.alignment_tendency || "";
      if (tendency) {
        // Map tendency to alignment options
        const tendencyLower = tendency.toLowerCase();
        if (tendencyLower.includes("good")) {
          alignmentOptions = ["good"];
        } else if (tendencyLower.includes("evil") || tendencyLower.includes("selfish")) {
          alignmentOptions = ["evil", "selfish"];
        } else if (tendencyLower.includes("selfish")) {
          alignmentOptions = ["selfish"];
        } else {
          alignmentOptions = ["any"];
        }
      } else {
        // Default: any alignment
        alignmentOptions = ["any"];
      }
    }

    // Expand broad categories to specific alignments
    const expandedOptions = [];
    for (const align of alignmentOptions) {
      const alignLower = align.toLowerCase().trim();
      
      if (alignLower === "any") {
        // Include all alignments except unaligned
        expandedOptions.push("Principled", "Scrupulous", "Unprincipled", "Anarchist", 
                            "Miscreant", "Aberrant", "Diabolic");
      } else if (PALLADIUM_ALIGNMENTS[alignLower]) {
        const mapped = PALLADIUM_ALIGNMENTS[alignLower];
        if (Array.isArray(mapped)) {
          // Broad category - add all specific alignments
          expandedOptions.push(...mapped);
        } else {
          // Specific alignment
          expandedOptions.push(mapped);
        }
      } else {
        // Try to match with case-insensitive partial match
        const found = Object.keys(PALLADIUM_ALIGNMENTS).find(key => 
          key.includes(alignLower) || alignLower.includes(key)
        );
        if (found) {
          const mapped = PALLADIUM_ALIGNMENTS[found];
          if (Array.isArray(mapped)) {
            expandedOptions.push(...mapped);
          } else {
            expandedOptions.push(mapped);
          }
        } else {
          // Unknown alignment - capitalize and use as-is
          expandedOptions.push(align.charAt(0).toUpperCase() + align.slice(1).toLowerCase());
        }
      }
    }

    // Remove duplicates
    const uniqueOptions = [...new Set(expandedOptions)];

    // If we have valid options, randomly select one
    if (uniqueOptions.length > 0) {
      const selected = uniqueOptions[Math.floor(Math.random() * uniqueOptions.length)];
      return selected;
    }

    // Fallback: return a default alignment based on creature category
    const category = (creatureData.category || "").toLowerCase();
    if (category.includes("demon") || category.includes("undead")) {
      return "Miscreant"; // Default evil for demons/undead
    } else if (category.includes("creature_of_magic") && creatureData.alignment?.includes("good")) {
      return "Principled"; // Default good for good-aligned magical creatures
    } else {
      return "Unprincipled"; // Default selfish for most creatures
    }
  }, []);

  // Legacy function for backward compatibility (now uses bestiary-based selection)
  const getRandomAlignmentForRace = useCallback((race, species, creatureData = null) => {
    // If creatureData is provided, use the new bestiary-based function
    if (creatureData) {
      return getRandomAlignmentFromBestiary(creatureData);
    }
    
    // Fallback to old behavior if creatureData not available
    const allAlignments = [
      "Principled", "Scrupulous", // Good
      "Unprincipled", "Anarchist", // Selfish
      "Miscreant", "Aberrant", "Diabolic" // Evil
    ];
    
    const raceName = (race || species || "").toUpperCase();
    
    // Races that tend toward evil/selfish
    if (["GOBLIN", "HOB-GOBLIN", "KOBOLD", "ORC", "TROLL", "OGRE"].includes(raceName)) {
      const evilSelfish = ["Unprincipled", "Anarchist", "Miscreant", "Aberrant", "Diabolic"];
      return evilSelfish[Math.floor(Math.random() * evilSelfish.length)];
    }
    
    // Races that tend toward good
    if (["ELF", "GNOME"].includes(raceName)) {
      const goodSelfish = ["Principled", "Scrupulous", "Unprincipled", "Anarchist"];
      return goodSelfish[Math.floor(Math.random() * goodSelfish.length)];
    }
    
    // Default: any alignment (most races)
    return allAlignments[Math.floor(Math.random() * allAlignments.length)];
  }, [getRandomAlignmentFromBestiary]);

  function addCreature(creatureData, customNameOverride = null, levelOverride = null, armorOverride = null, weaponOverride = null, ammoOverride = null) {
    let newFighter;
    const nameToUse = customNameOverride || customEnemyName;
    const level = levelOverride || enemyLevel || 1;
    const armorToEquip = armorOverride || selectedArmor;
    const weaponToEquip = weaponOverride !== undefined ? weaponOverride : selectedWeapon;
    const ammoToGive = ammoOverride !== undefined ? ammoOverride : selectedAmmoCount;
    
    // Check if this is a playable character
    if (creatureData.playable) {
      // Auto-roll attributes and create playable character fighter
      newFighter = createPlayableCharacterFighter(creatureData, nameToUse);
      
      // ✅ Override weapon if one was selected
      if (weaponToEquip && weaponToEquip !== "None") {
        const weaponData = weapons.find(w => w.name === weaponToEquip);
        if (weaponData) {
          newFighter = equipWeaponToEnemy(newFighter, weaponData);
          newFighter = addWeaponToInventory(newFighter, weaponData);
          addLog(`⚔️ ${newFighter.name} wields ${weaponData.name}`, "info");
          
          // Add ammo if weapon requires it and ammo count is provided
          if (weaponData.ammunition && weaponData.ammunition !== "self" && ammoToGive > 0) {
            if (!newFighter.inventory) {
              newFighter.inventory = [];
            }
            // Add ammo to inventory
            const ammoItem = {
              name: weaponData.ammunition,
              type: "ammunition",
              quantity: ammoToGive,
              weight: 0.1 * ammoToGive
            };
            newFighter.inventory.push(ammoItem);
            addLog(`📦 ${newFighter.name} receives ${ammoToGive} ${weaponData.ammunition}`, "info");
          }
        }
      }
      
      // Log detailed roll information with debug details
      const rollDetails = getPlayableCharacterRollDetails(creatureData, newFighter.attributes);
      
      addLog(`🎲 Auto-rolled ${newFighter.name}:`, "info");
      // Enhanced attribute roll logging
      Object.entries(rollDetails.attributes).forEach(([attr, data]) => {
        const rollBreakdown = data.roll?.diceRolls?.map(d => d.result).join(' + ') || data.value;
        const bonus = data.roll?.bonus ? ` + ${data.roll.bonus}` : '';
        addLog(`   🎲 ${attr}: ${data.dice} = [${rollBreakdown}]${bonus} = ${data.value}`, "info");
      });
      addLog(`   HP: ${newFighter.currentHP}, AR: ${newFighter.AR}, Speed: ${newFighter.Spd || newFighter.spd || newFighter.attributes?.Spd || newFighter.attributes?.spd || 10}`, "info");
      addLog(`   Bonuses: ${Object.entries(newFighter.bonuses).map(([key, val]) => 
        `${key}: +${val}`).join(", ")}`, "info");
      if (newFighter.equippedWeapons && newFighter.equippedWeapons.length > 0 && newFighter.equippedWeapons[0].name !== "Unarmed Strike") {
        addLog(`   ⚔️ Weapons: ${newFighter.equippedWeapons.map(w => w.name).join(", ")}`, "info");
      }
      
      // Debug: Log psionics and magic data
      if (newFighter.psionicPowers && newFighter.psionicPowers.length > 0) {
        addLog(`🧠 ${newFighter.name} has ${newFighter.psionicPowers.length} psionic powers (ISP: ${newFighter.ISP})`, "info");
      }
      if (newFighter.magic && newFighter.magic.length > 0) {
        addLog(`🔮 ${newFighter.name} has ${newFighter.magic.length} spells (PPE: ${newFighter.PPE})`, "info");
      }
      
      // ✅ Assign random alignment from bestiary entry (always pick one from the array/category)
      // Even if alignment exists as an array, we need to pick a specific one
      const randomAlignment = getRandomAlignmentFromBestiary(creatureData);
      newFighter.alignment = randomAlignment;
      newFighter.alignmentName = randomAlignment;
      addLog(`🎲 ${newFighter.name} alignment: ${randomAlignment}`, "info");
    } else {
      // Regular creature (existing logic)
      const rolledHP = rollHP(creatureData.HP);
      newFighter = {
        ...creatureData,
        id: `enemy-${generateCryptoId()}`,
        type: "enemy",
        name: nameToUse || creatureData.name,
        currentHP: rolledHP,
        maxHP: rolledHP,
        initiative: 0,
        status: "active"
      };
      
      // Parse abilities from string array to structured format (needed for canFly check)
      // Parse clerical abilities if present
      if (newFighter.clericalAbilities && Array.isArray(newFighter.clericalAbilities)) {
        const parsedClerical = parseClericalAbilities(newFighter.clericalAbilities);
        if (Object.keys(parsedClerical).length > 0) {
          // Store parsed clerical abilities in fighter's abilities object
          if (!newFighter.abilities) newFighter.abilities = {};
          if (!newFighter.abilities.clerical) newFighter.abilities.clerical = {};
          newFighter.abilities.clerical = parsedClerical;
          addLog(`🙏 ${newFighter.name} has clerical abilities: ${Object.keys(parsedClerical).join(", ")}`, "info");
        }
      }
      
      if (newFighter.abilities && Array.isArray(newFighter.abilities)) {
        const parsedAbilities = parseAbilities(newFighter.abilities);
        newFighter.abilities = parsedAbilities;
      }
      
      // Assign weapon - use selected weapon if provided, otherwise use default/random assignment
      const isHumanoidCreature = isHumanoid(creatureData);
      
      if (isHumanoidCreature && weaponToEquip && weaponToEquip !== "None") {
        // Use selected weapon
        const weaponData = weapons.find(w => w.name === weaponToEquip);
        if (weaponData) {
          newFighter = equipWeaponToEnemy(newFighter, weaponData);
          newFighter = addWeaponToInventory(newFighter, weaponData);
          addLog(`⚔️ ${newFighter.name} wields ${weaponData.name}`, "info");
          
          // Add ammo if weapon requires it and ammo count is provided
          if (weaponData.ammunition && weaponData.ammunition !== "self" && ammoToGive > 0) {
            if (!newFighter.inventory) {
              newFighter.inventory = [];
            }
            // Add ammo to inventory
            const ammoItem = {
              name: weaponData.ammunition,
              type: "ammunition",
              quantity: ammoToGive,
              category: "ammunition"
            };
            newFighter.inventory.push(ammoItem);
            addLog(`📦 ${newFighter.name} has ${ammoToGive} ${weaponData.ammunition}`, "info");
          }
        }
      } else {
        // Check if creature has Claw attack - use it as default "unarmed" for all creatures
        const hasClawAttack = creatureData.attacks && Array.isArray(creatureData.attacks) && 
          creatureData.attacks.some(attack => attack.name && attack.name === "Claw");
        
        // Initialize equippedWeapons with Claw if available, otherwise Unarmed
        // This allows creatures with Claw to still equip weapons (which will replace Claw)
        if (!newFighter.equippedWeapons || !Array.isArray(newFighter.equippedWeapons)) {
          if (hasClawAttack) {
            const clawAttack = creatureData.attacks.find(attack => attack.name === "Claw");
            const defaultClaw = {
              name: "Claw",
              damage: clawAttack?.damage || "1d6",
              type: "melee",
              category: "natural",
              slot: "Right Hand",
              reach: clawAttack?.reach || 0,
              range: clawAttack?.range || 0,
            };
            newFighter.equippedWeapons = [
              defaultClaw,
              { ...defaultClaw, slot: "Left Hand" }
            ];
          } else {
            newFighter.equippedWeapons = [
              { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Right Hand" },
              { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Left Hand" }
            ];
          }
        }
        
        // Use default/random weapon assignment
        const favoriteWeapons = creatureData.favorite_weapons || creatureData.preferred_weapons || creatureData.favoriteWeapons;
        
        if (favoriteWeapons) {
          newFighter = assignRandomWeaponToEnemy(newFighter, favoriteWeapons);
          if (newFighter.equippedWeapons && newFighter.equippedWeapons[0]?.name !== "Unarmed" && newFighter.equippedWeapons[0]?.name !== "Claw") {
            addLog(`⚔️ ${newFighter.name} wields ${newFighter.equippedWeapons[0]?.name}`, "info");
          } else if (hasClawAttack && newFighter.equippedWeapons[0]?.name === "Claw") {
            // Creature with Claw didn't get a favorite weapon, so they're using Claw
            const clawAttack = creatureData.attacks.find(attack => attack.name === "Claw");
            addLog(`⚔️ ${newFighter.name} uses Claw (${clawAttack?.damage || "1d6"})`, "info");
          }
        } else {
          if (isHumanoidCreature) {
            // Humanoids without preferred weapons get a random common weapon
            // But they can still use Claw as default if they have it
            const defaultWeapon = getDefaultWeaponForEnemy(newFighter);
            if (defaultWeapon && defaultWeapon.name !== "Unarmed" && defaultWeapon.name !== "Claw") {
              newFighter = assignRandomWeaponToEnemy(newFighter, defaultWeapon.name);
              addLog(`⚔️ ${newFighter.name} wields ${newFighter.equippedWeapons?.[0]?.name || defaultWeapon.name}`, "info");
            } else if (hasClawAttack) {
              // Humanoid with Claw - log that they're using Claw
              addLog(`⚔️ ${newFighter.name} uses Claw (${creatureData.attacks.find(a => a.name === "Claw")?.damage || "1d6"})`, "info");
            }
          } else if (creatureData.attacks && Array.isArray(creatureData.attacks) && creatureData.attacks.length > 0) {
            // Non-humanoid creatures: convert natural attacks to equipped weapons
            // Check if a specific natural attack was selected from the dropdown
            let physicalAttack = null;
            if (weaponToEquip && weaponToEquip !== "None") {
              // User selected a specific natural attack
              physicalAttack = creatureData.attacks.find(
                attack => attack.name && attack.name === weaponToEquip
              );
            }
            
            // If no specific attack selected, find the first non-magic/spellcasting attack
            // Prioritize Fire Whip if it exists, then Claw, then other physical attacks
            if (!physicalAttack) {
              // First, try to find Fire Whip
              physicalAttack = creatureData.attacks.find(
                attack => attack.name && attack.name === "Fire Whip"
              );
              
              // If no Fire Whip, try Claw
              if (!physicalAttack) {
                physicalAttack = creatureData.attacks.find(
                  attack => attack.name && attack.name === "Claw"
                );
              }
              
              // If still no physical attack, find any non-magic/spellcasting attack
              if (!physicalAttack) {
                physicalAttack = creatureData.attacks.find(
                  attack => attack.name && 
                  !attack.name.toLowerCase().includes("magic") && 
                  !attack.name.toLowerCase().includes("spell") &&
                  attack.damage !== "by spell"
                ) || creatureData.attacks[0]; // Fallback to first attack if all are magic
              }
            }
            
            if (physicalAttack && physicalAttack.name) {
              // Convert natural attack to weapon format
              // Special handling for Fire Whip - use proper weapon definition
              let naturalWeapon;
              if (physicalAttack.name === "Fire Whip") {
                // Get Fire Whip from weapons array or use baalRogFireWhip
                const fireWhipWeapon = getWeaponByName("Fire Whip") || baalRogFireWhip;
                naturalWeapon = {
                  ...fireWhipWeapon,
                  slot: "Left Hand", // Fire Whip goes in left hand for Baal-Rog
                  category: "natural", // Keep as natural attack category
                  damage: physicalAttack.damage || fireWhipWeapon.damage || "4d6", // Use damage from attack or weapon definition
                };
                // Set Fire Whip in left hand (index 1)
                newFighter.equippedWeapons[1] = naturalWeapon;
                
                // Also set in equipped object for consistency
                if (!newFighter.equipped) {
                  newFighter.equipped = {};
                }
                newFighter.equipped.weaponSecondary = naturalWeapon;
                
                // Set legacy fields
                newFighter.equippedWeapon = physicalAttack.name; // Legacy support
                newFighter.weapon = physicalAttack.name; // Legacy support
              } else if (physicalAttack.name === "Claw") {
                // Claw is already set as default, but update with correct damage if different
                const clawWeapon = {
                  name: "Claw",
                  damage: physicalAttack.damage || "1d6",
                  type: "melee",
                  category: "natural",
                  slot: "Right Hand",
                  reach: physicalAttack.reach || 0,
                  range: physicalAttack.range || 0,
                };
                newFighter.equippedWeapons[0] = clawWeapon;
                
                // Initialize equipped object if needed
                if (!newFighter.equipped) {
                  newFighter.equipped = {};
                }
                newFighter.equipped.weaponPrimary = clawWeapon;
                
                // Set legacy fields
                newFighter.equippedWeapon = physicalAttack.name; // Legacy support
                newFighter.weapon = physicalAttack.name; // Legacy support
              } else {
                // Other natural attacks (not Claw, not Fire Whip)
                naturalWeapon = {
                  name: physicalAttack.name,
                  damage: physicalAttack.damage || "1d6",
                  type: "melee",
                  category: "natural",
                  slot: "Right Hand",
                  reach: physicalAttack.reach || 0,
                  range: physicalAttack.range || 0,
                };
                newFighter.equippedWeapons[0] = naturalWeapon;
                
                // Initialize equipped object if needed
                if (!newFighter.equipped) {
                  newFighter.equipped = {};
                }
                newFighter.equipped.weaponPrimary = naturalWeapon;
                
                // Set legacy fields
                newFighter.equippedWeapon = physicalAttack.name; // Legacy support
                newFighter.weapon = physicalAttack.name; // Legacy support
              }
              
              // Only log if it's not Claw (since Claw is default and already logged above)
              if (physicalAttack.name !== "Claw") {
                addLog(`⚔️ ${newFighter.name} uses ${physicalAttack.name} (${physicalAttack.damage || "1d6"})`, "info");
              }
            } else if (hasClawAttack) {
              // Creature has Claw but no other physical attack selected - Claw is already set as default
              const clawAttack = creatureData.attacks.find(attack => attack.name === "Claw");
              addLog(`⚔️ ${newFighter.name} uses Claw (${clawAttack?.damage || "1d6"})`, "info");
            }
          }
        }
      }
      
      // ✅ Assign random alignment from bestiary entry (always pick one from the array/category)
      // Even if alignment exists as an array, we need to pick a specific one
      const randomAlignment = getRandomAlignmentFromBestiary(creatureData);
      newFighter.alignment = randomAlignment;
      newFighter.alignmentName = randomAlignment;
      addLog(`🎲 ${newFighter.name} alignment: ${randomAlignment}`, "info");
      
      // Apply level-based stat adjustments
      if (level > 1) {
        newFighter = applyLevelToEnemy(newFighter, level);
        addLog(`📊 ${newFighter.name} adjusted to level ${level} (HP: ${newFighter.maxHP}, AR: ${newFighter.AR})`, "info");
      }

      // Equip armor for humanoids (after level adjustments so AR is calculated correctly)
      if (isHumanoidCreature && armorToEquip && armorToEquip !== "None") {
        const armorData = availableArmors.find(a => a.name === armorToEquip);
        if (armorData) {
          newFighter = equipArmorToEnemy(newFighter, armorData);
          addLog(`🛡️ ${newFighter.name} equipped with ${armorData.name} (AR: ${armorData.ar})`, "info");
        }
      }
    }
    
        // Apply size modifiers to new fighter (for both playable and regular creatures)
        newFighter = applySizeModifiers(newFighter);
        
        // Apply level-based stat adjustments for playable characters too
        if (level > 1) {
          newFighter = applyLevelToEnemy(newFighter, level);
          addLog(`📊 ${newFighter.name} adjusted to level ${level} (HP: ${newFighter.maxHP}, AR: ${newFighter.AR})`, "info");
        }
        
        // Load spells if creature has magicAbilities
        if (newFighter.magicAbilities && typeof newFighter.magicAbilities === "string") {
          // Check if this is Wizard (Invocation) magic - use fullList for unrestricted access
          const isWizardMagic = /spell\s+magic|wizard\s+magic|invocation\s+magic|invocation/i.test(newFighter.magicAbilities.toLowerCase());
          
          // Use enhanced parser for complex magicAbilities strings
          // For Wizard magic, get full list and store in spellbook; also get curated list for magic
          const spellResult = getSpellsForCreature(newFighter.magicAbilities, {
            fullList: isWizardMagic, // Full list for Wizard magic
            includeNonCombat: true   // Include all spells, not just combat
          });
          
          if (spellResult.spells.length > 0) {
            // Convert to combat spell format
            const allSpells = spellResult.spells.map(spell => ({
              name: spell.name,
              cost: spell.ppeCost || spell.cost || 10,
              damage: spell.damage || spell.combatDamage || "",
              effect: spell.description || "",
              level: spell.level || 1,
              range: spell.range || "100ft",
            }));
            
            // For Wizard magic: store full list in spellbook, curated list in magic
            if (isWizardMagic || spellResult.unrestricted) {
              newFighter.spellbook = allSpells; // Full catalog
              // Also keep a curated subset in magic for quick access (combat damage spells only)
              const combatSpells = allSpells.filter(s => s.damage && s.damage !== "0" && s.damage !== "");
              newFighter.magic = combatSpells.slice(0, 20); // Top 20 combat spells for quick access
              // Set unrestricted flag for getFighterSpells to detect
              newFighter.unrestricted = true;
              newFighter.magicProfile = { isWizardMagic: true, unrestricted: true };
            } else {
              // For elemental magic, use the curated list
              newFighter.magic = allSpells;
            }
            
            newFighter.PPE = newFighter.PPE || spellResult.ppe;
            newFighter.currentPPE = newFighter.currentPPE || newFighter.PPE;
            addLog(`🔮 ${newFighter.name} has ${isWizardMagic ? allSpells.length + ' spells in spellbook' : allSpells.length + ' spells'} available (${newFighter.magicAbilities})`, "info");
          } else {
            // Fallback to old method if parser returns no spells
            const magicText = newFighter.magicAbilities.toLowerCase();
            const levelMatch = magicText.match(/levels?\s+(\d+)[-\s]+(\d+)/);
            const maxLevel = levelMatch ? parseInt(levelMatch[2]) : 5;
            
            const availableSpells = getSpellsForLevel(maxLevel);
            if (availableSpells.length > 0) {
              const numSpells = Math.min(5, Math.max(3, availableSpells.length));
              const selectedSpells = [];
              for (let i = 0; i < numSpells; i++) {
                const randomIndex = Math.floor(Math.random() * availableSpells.length);
                const spell = availableSpells[randomIndex];
                if (!selectedSpells.find(s => s.name === spell.name)) {
                  selectedSpells.push({
                    name: spell.name,
                    cost: spell.ppeCost || spell.cost || 10,
                    damage: spell.damage || spell.combatDamage || "",
                    effect: spell.description || "",
                    level: spell.level || 1,
                    range: spell.range || "100ft",
                  });
                }
              }
              newFighter.magic = selectedSpells;
              newFighter.PPE = newFighter.PPE || (maxLevel * 20);
              newFighter.currentPPE = newFighter.currentPPE || newFighter.PPE;
              addLog(`🔮 ${newFighter.name} has ${selectedSpells.length} spells available (${newFighter.magicAbilities})`, "info");
            }
          }
        }
        
        // Initialize ISP for psionic creatures (check abilities for psionics)
        if (!newFighter.ISP && !newFighter.currentISP) {
          const abilitiesText = Array.isArray(newFighter.abilities) 
            ? newFighter.abilities.join(" ").toLowerCase()
            : (typeof newFighter.abilities === "string" ? newFighter.abilities.toLowerCase() : "");
          const hasPsionics = abilitiesText.includes("psionic") || 
                             abilitiesText.includes("isp") ||
                             (newFighter.psionicPowers && newFighter.psionicPowers.length > 0) ||
                             (newFighter.psionics && newFighter.psionics.length > 0);
          
          if (hasPsionics) {
            // Default ISP: 20 + (level * 10), minimum 30, max 200
            const creatureLevel = newFighter.level || 1;
            const defaultISP = Math.min(Math.max(30, 20 + (creatureLevel * 10)), 200);
            newFighter.ISP = defaultISP;
            newFighter.currentISP = defaultISP;
            addLog(`🧠 ${newFighter.name} has psionic abilities - initialized with ${defaultISP} ISP`, "info");
          }
        } else if (newFighter.ISP && !newFighter.currentISP) {
          // If ISP is set but currentISP is not, initialize it
          newFighter.currentISP = newFighter.ISP;
        }
        
        // Initialize PPE for magic users (if not already set by magicAbilities)
        if (!newFighter.PPE && !newFighter.currentPPE) {
          const abilitiesText = Array.isArray(newFighter.abilities) 
            ? newFighter.abilities.join(" ").toLowerCase()
            : (typeof newFighter.abilities === "string" ? newFighter.abilities.toLowerCase() : "");
          const hasMagic = abilitiesText.includes("magic") || 
                          (newFighter.magic && newFighter.magic.length > 0) ||
                          newFighter.magicAbilities;
          
          if (hasMagic) {
            // Default PPE: level * 20, minimum 20, max 200
            const creatureLevel = newFighter.level || 1;
            const defaultPPE = Math.min(Math.max(20, creatureLevel * 20), 200);
            newFighter.PPE = defaultPPE;
            newFighter.currentPPE = defaultPPE;
            addLog(`🔮 ${newFighter.name} has magic abilities - initialized with ${defaultPPE} PPE`, "info");
          }
        } else if (newFighter.PPE && !newFighter.currentPPE) {
          // If PPE is set but currentPPE is not, initialize it
          newFighter.currentPPE = newFighter.PPE;
        }
        
        // Initialize altitude for flying creatures
        // Altitude is tracked in 5ft increments, similar to hex distances
        if (canFly(newFighter)) {
          // Check if this is a hawk or similar skittish flying predator
          // These should start flying at altitude 20ft (4 hexes)
          const nameLower = (newFighter.name || newFighter.species || newFighter.type || "").toLowerCase();
          const isHawkOrFlyingPredator = nameLower.includes("hawk") || 
                                         nameLower.includes("eagle") || 
                                         nameLower.includes("falcon") ||
                                         nameLower.includes("vulture");
          
          // Check if creature prefers flight (from speciesBehavior.json)
          const speciesProfile = getSpeciesProfile(newFighter);
          const prefersFlight = speciesProfile?.preferFlight || false;
          
          if (isHawkOrFlyingPredator || prefersFlight) {
            // Start flying at appropriate altitude (hawks at 20ft, others at 15ft for strategic advantage)
            const startAltitude = isHawkOrFlyingPredator ? 20 : 15;
            newFighter.altitude = startAltitude;
            newFighter.altitudeFeet = startAltitude;
            newFighter.isFlying = true; // Mark as actively flying
            // Initialize flight state to cruising mode
            newFighter.aiFlightState = {
              mode: "cruising",
              previousAltitude: null,
              cruiseAltitudeFeet: startAltitude,
            };
            addLog(`🦅 ${newFighter.name} starts flying at ${startAltitude}ft altitude`, "info");
          } else {
            // Other flying creatures start grounded
            newFighter.altitude = 0;
            newFighter.altitudeFeet = 0;
          }
        } else {
          newFighter.altitude = 0;
          newFighter.altitudeFeet = 0;
        }
        
        // Normalize fighter to ensure IDs, moraleState, and mentalState exist
        newFighter = normalizeFighter(newFighter);
        
        // Initialize ammo for ranged weapons
        const equippedWeapon = newFighter.equippedWeapons?.[0];
        if (equippedWeapon) {
          const weaponName = (equippedWeapon.name || "").toLowerCase();
          const isRanged = weaponName.includes('bow') || 
                          weaponName.includes('crossbow') ||
                          weaponName.includes('sling') ||
                          equippedWeapon.type === 'ranged' ||
                          (equippedWeapon.range && equippedWeapon.range > 10);
          
          // Ammo is now strictly inventory-based - no free ammo given
        }
        
        setFighters(prev => [...prev, newFighter]);

    addLog(`Added ${newFighter.name} to combat!`, "success");
    return newFighter;
  }

  /**
   * Add multiple enemies to combat (up to 10)
   * @param {Object} creatureData - The creature data from bestiary
   * @param {number} count - Number of enemies to add (1-10)
   * @param {number} level - Level for all enemies (1-15)
   * @param {string} armorName - Armor name to equip (optional)
   * @param {string} weaponName - Weapon name to equip (optional)
   * @param {number} ammoCount - Ammo count to give (optional)
   */
  function addMultipleEnemies(creatureData, count, level = 1, armorName = null, weaponName = null, ammoCount = null) {
    if (!creatureData) {
      addLog(`❌ No creature selected`, "error");
      return;
    }

    // Clamp count between 1 and 10
    const enemyCount = Math.max(1, Math.min(10, Math.floor(count) || 1));
    
    if (enemyCount > 10) {
      addLog(`❌ Cannot add more than 10 enemies at once`, "error");
      return;
    }

    addLog(`➕ Adding ${enemyCount} ${creatureData.name}${enemyCount > 1 ? 's' : ''} to combat...`, "info");

    const newFighters = [];
    
    for (let i = 0; i < enemyCount; i++) {
      // For multiple enemies, add a number suffix to distinguish them
      const enemyName = enemyCount > 1 
        ? `${customEnemyName || creatureData.name} #${i + 1}`
        : (customEnemyName || creatureData.name);
      
      const newFighter = addCreature(creatureData, enemyName, level, armorName, weaponName, ammoCount);
      if (newFighter) {
        newFighters.push(newFighter);
      }
    }

    if (newFighters.length > 0) {
      addLog(`✅ Successfully added ${newFighters.length} ${creatureData.name}${newFighters.length > 1 ? 's' : ''} to combat!`, "success");
    }

    // Clear form
    setCustomEnemyName("");
    setSelectedCreature("");
    setEnemyLevel(1); // Reset level
    setSelectedArmor(""); // Reset armor
    setSelectedWeapon(""); // Reset weapon
    setSelectedAmmoCount(0); // Reset ammo
    onClose();
  }

  function addLog(message, type = "info", diceInfo = null) {
    // Prevent duplicate log messages (React Strict Mode double-invocation and rapid repeats)
    const recentKey = `${message.substring(0, 100)}_${type}`; // Use first 100 chars + type as key
    const now = Date.now();
    
    // Check if this exact message was logged in the last 2 seconds (prevent duplicates from rapid calls)
    const recentMessages = recentLogMessagesRef.current;
    const lastTimestamp = recentMessages.get(recentKey);
    
    if (lastTimestamp && (now - lastTimestamp) < 2000) {
      return; // Skip duplicate log (within 2 seconds)
    }
    
    // Add to recent messages and clean up old ones (keep only entries from last 10 seconds)
    recentMessages.set(recentKey, now);
    if (recentMessages.size > 100) {
      // Clean up entries older than 10 seconds
      for (const [key, timestamp] of recentMessages.entries()) {
        if (now - timestamp > 10000) {
          recentMessages.delete(key);
        }
      }
    }
    
    const logEntry = {
      id: generateCryptoId(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
      diceInfo
    };
    setLog(prev => [logEntry, ...prev]);
  }

  function startCombat(skipPhase0 = false) {
    // Apply Phase 0 scene setup if it exists
    // ✅ Check if combatTerrain already exists (set from onComplete) - if so, use it instead of overwriting
    if (!skipPhase0 && combatTerrain && combatTerrain.mapType) {
      // ✅ combatTerrain was already set from onComplete, use it (preserves mapType)
      if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
        console.log('[CombatPage] startCombat - Using existing combatTerrain with mapType:', combatTerrain.mapType);
      }
      // Don't overwrite - combatTerrain is already set correctly
    } else if (!skipPhase0 && phase0Results && phase0Results.environment) {
      // Resolve Phase 0 encounter if we have players and enemies
      const playerFighters = fighters.filter(f => f.type === "player");
      const enemyFighters = fighters.filter(f => f.type === "enemy");
      
      if (playerFighters.length > 0 && enemyFighters.length > 0) {
        try {
          const phase0Resolution = resolvePhase0Encounter(
            playerFighters,
            enemyFighters,
            phase0Results.environment
          );
          
          // Log Phase 0 results
          if (phase0Resolution.surpriseRound) {
            addLog("⚡ SURPRISE ROUND! Players caught enemies off guard!", "critical");
          }
          
          phase0Resolution.players.forEach(playerResult => {
            if (playerResult.hidden) {
              addLog(`👤 ${playerResult.player.name} successfully prowled and remains hidden`, "info");
            } else {
              addLog(`👤 ${playerResult.player.name} failed to prowl and is detected`, "warning");
            }
          });
          
          phase0Resolution.enemies.forEach(enemyResult => {
            if (enemyResult.detected) {
              addLog(`👹 ${enemyResult.enemy.name} detected the party! Reaction: ${enemyResult.reaction.action}`, "info");
            } else {
              addLog(`👹 ${enemyResult.enemy.name} did not detect the party`, "info");
            }
          });
          
          // Store Phase 0 resolution for potential use
          setPhase0Results(prev => ({
            ...prev,
            resolution: phase0Resolution
          }));
        } catch (error) {
          console.error('[CombatPage] Error resolving Phase 0 encounter:', error);
          addLog("⚠️ Error resolving Phase 0 encounter, proceeding with normal combat", "warning");
        }
      }
      const env = phase0Results.environment;
      
      // ✅ Debug: Log what we're storing
      if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
        console.log('[CombatPage] startCombat - Setting combatTerrain from phase0Results with mapType:', env.mapType, 'Full env:', env);
      }
      
      setCombatTerrain(env);
      
      addLog("🌲 Scene Setup Applied:", "info");
      addLog(`Terrain: ${env.terrainData?.name || env.terrain}`, "info");
      addLog(`Lighting: ${env.lightingData?.name || env.lighting}`, "info");
      
      // ✅ Log map type selection
      const mapTypeDisplay = env.mapType === "square" ? "⬛ Square Grid" : "⬡ Hex Grid";
      addLog(`🗺️ Map Type: ${mapTypeDisplay}`, "info");
      
      // ✅ Warn if mapType is missing
      if (!env.mapType) {
        console.warn('[CombatPage] WARNING: mapType is missing from environment!', env);
      }
      
      if (env.description) {
        addLog(`📝 ${env.description}`, "info");
      }
      
      // Apply terrain modifiers
      if (env.terrainData) {
        addLog(`⚙️ Movement: ${env.terrainData.movementModifier * 100}%, Visibility: ${env.terrainData.visibilityModifier * 100}%, Cover: +${env.terrainData.cover} AR`, "info");
      }
      
      // Log visibility range if computed
      if (env.visibilityRange) {
        const cellType = env.mapType === "square" ? "squares" : "hexes";
        addLog(`👁️ Visibility Range: ${env.visibilityRange} feet (${Math.ceil(env.visibilityRange / 5)} ${cellType})`, "info");
      }
      
      // Initialize fog of war will be handled by useEffect when positions are set
    } else {
      // ✅ Default empty terrain: no obstructions, basic lighting, all characters visible within range
      const defaultTerrain = {
        terrain: "OPEN_GROUND",
        terrainData: {
          name: "Open Ground",
          movementModifier: 1.0,
          visibilityModifier: 1.0,
          cover: 0,
          density: 0,
        },
        lighting: "BRIGHT_DAYLIGHT",
        lightingData: {
          name: "Bright Daylight",
          visibilityBonus: 0,
          prowlModifier: 0,
        },
        mapType: "hex",
        visibilityRange: 120, // Full visibility range for basic lighting
        obstacles: [], // No obstructions
        grid: null, // No grid-based obstacles
        description: "Open combat arena - no obstructions",
      };
      
      if (!combatTerrain) {
        setCombatTerrain(defaultTerrain);
        addLog("🌲 Default Arena: Open ground, bright lighting, no obstructions", "info");
      }
    }
    
    setCombatPaused(false);
    setLog([]);
    lastAutoTurnKeyRef.current = null;
    setTurnIndex(0);
    setShowPartySelector(false);
    setPsionicsMode(false); // Reset psionics mode
    setSpellsMode(false); // Reset spells mode
    setClericalAbilitiesMode(false); // Reset clerical abilities mode
    setSelectedClericalAbility(null); // Clear selected clerical ability
    // Reset fog memory for new combat
    setVisibleCells([]);
    setExploredCells(resetFogMemory());
    
    // Roll initiative for all fighters (1994 Palladium rules: d20 + bonuses)
    const updatedFighters = fighters.map(fighter => {
      let d20 = CryptoSecureDice.rollD20();
      
      // Calculate initiative bonuses (Hand-to-Hand, P.P., situational)
      const handToHandBonus = fighter.handToHand?.initiativeBonus || 0;
      const ppBonus = fighter.attributes?.PP ? Math.floor((fighter.attributes.PP - 10) / 2) : 0;
      
      // Apply reach-based initiative modifier (short weapons +1 Initiative)
      const equippedWeapon = getEquippedWeapons(fighter)?.primary || getEquippedWeapons(fighter)?.secondary || null;
      const reachInitiativeMod = equippedWeapon ? getReachInitiativeModifier(equippedWeapon) : 0;
      
      // Apply horror factor initiative penalty (if they failed horror this round)
      const horrorInitPenalty = fighter.meta?.horrorInitPenalty ?? 0;
      
      const totalBonus = handToHandBonus + ppBonus + reachInitiativeMod + horrorInitPenalty;
      let initiativeTotal = d20 + totalBonus;
      
      if (horrorInitPenalty < 0) {
        addLog(`${fighter.name} suffers ${Math.abs(horrorInitPenalty)} initiative penalty from horror!`, "info");
      }
      
      // Store initial roll for tie resolution
      fighter._initialInitiativeRoll = initiativeTotal;
      
      const rollInfo = {
        character: fighter.name,
        characterType: fighter.type,
        action: "Initiative",
        rollDetails: {
          d20Roll: d20,
          handToHandBonus: handToHandBonus,
          ppBonus: ppBonus,
          totalBonus: totalBonus,
          total: initiativeTotal
        }
      };
      
      const bonusText = totalBonus > 0 ? ` + bonus:${totalBonus}${reachInitiativeMod > 0 ? ` (${reachInitiativeMod} from weapon reach)` : ""}` : "";
      addLog(`${fighter.name} rolled initiative: ${initiativeTotal} (d20:${d20}${bonusText})`, "initiative", rollInfo);
      
      // Calculate attacks per melee for this fighter
      let attacksPerMelee;
      if (fighter.type === "player") {
        const level = fighter.level || 1;
        const occ = fighter.occ || "";
        attacksPerMelee = getAttacksPerMelee(level, occ);
      } else {
        // Enemy/monster
        attacksPerMelee = getCreatureAttacksPerMelee(fighter);
      }
      
      // Initialize combat fatigue for each fighter
      if (!fighter.fatigueState) {
        fighter.fatigueState = initializeCombatFatigue(fighter);
        const fatigueStatus = getFatigueStatus(fighter);
        addLog(`💪 ${fighter.name} stamina: ${fatigueStatus.maxStamina} SP (P.E. ${fighter.attributes?.PE || fighter.PE || 10} × 2)`, "info");
      }
      
      // Initialize grapple state for each fighter
      if (!fighter.grappleState) {
        fighter.grappleState = initializeGrappleState(fighter);
      }
      
      // Apply size modifiers to fighter
      const fighterWithSizeMods = applySizeModifiers(fighter);
      Object.assign(fighter, fighterWithSizeMods);
      
      // Log size category for reference (non-medium sizes)
      const sizeCategory = getSizeCategory(fighter);
      if (sizeCategory !== SIZE_CATEGORIES.MEDIUM) {
        const sizeDef = SIZE_DEFINITIONS[sizeCategory];
        const sizeDesc = sizeDef ? sizeDef.description : sizeCategory;
        addLog(`📏 ${fighter.name} size category: ${sizeDesc}`, "info");
      }
      
      // Clear horror initiative penalty after applying it (only applies to this melee round)
      const fighterMeta = { ...(fighter.meta || {}) };
      if (fighterMeta.horrorInitPenalty !== undefined) {
        delete fighterMeta.horrorInitPenalty;
      }
      
      // Reset ROUTED status at combat start (fighters should start fresh)
      // They can become ROUTED during combat from morale checks, but shouldn't start ROUTED
      const resetMoraleState = fighter.moraleState?.status === "ROUTED" || fighter.moraleState?.status === "SURRENDERED"
        ? { ...(fighter.moraleState || {}), status: "STEADY", failedChecks: 0 }
        : fighter.moraleState;

      // ✅ Clear encounter-scoped horror metadata on combat start
      // (prevents HF from leaking between separate combats)
      if (fighterMeta.horrorChecks !== undefined) {
        delete fighterMeta.horrorChecks;
      }
      if (fighterMeta.horrorFailedRound !== undefined) {
        delete fighterMeta.horrorFailedRound;
      }
      
      const updatedFighter = {
        ...fighter,
        initiative: initiativeTotal,
        attacksPerMelee: attacksPerMelee,
        remainingAttacks: attacksPerMelee, // Start with full attacks
        meta: fighterMeta,
        moraleState: resetMoraleState,
        // Clear ROUTED status effect if present
        statusEffects: Array.isArray(fighter.statusEffects) 
          ? fighter.statusEffects.filter(s => s !== "ROUTED")
          : fighter.statusEffects,
      };
      
      // Normalize IDs to ensure both id and _id exist for backwards compatibility
      return normalizeFighterId(updatedFighter);
    });

    // Resolve initiative ties (1994 Palladium rules)
    const initiativeGroups = {};
    updatedFighters.forEach(fighter => {
      if (!initiativeGroups[fighter.initiative]) {
        initiativeGroups[fighter.initiative] = [];
      }
      initiativeGroups[fighter.initiative].push(fighter);
    });

    // Reroll ties
    Object.keys(initiativeGroups).forEach(initiativeValue => {
      const tiedFighters = initiativeGroups[initiativeValue];
      if (tiedFighters.length > 1) {
        addLog(`🔄 Initiative tie at ${initiativeValue}! Rerolling for: ${tiedFighters.map(f => f.name).join(', ')}`, "info");
        
        tiedFighters.forEach(fighter => {
          const tieBreaker = CryptoSecureDice.rollD20();
          fighter.initiative += tieBreaker;
          addLog(`${fighter.name} rerolls: ${tieBreaker} → new total: ${fighter.initiative}`, "info");
        });
      }
    });

    // Sort by initiative (highest first)
    updatedFighters.sort((a, b) => b.initiative - a.initiative);
    
    setFighters(updatedFighters);
    setTurnIndex(0);
    setMeleeRound(1); // Start at melee round 1
    
    // Initialize positions ONLY when combat starts
    const playerCount = fighters.filter(f => f.type === "player").length;
    const enemyCount = fighters.filter(f => f.type === "enemy").length;
    
    const initialPositions = getInitialPositions(playerCount, enemyCount);
    const positionMap = {};
    
    // Map positions to fighter IDs
    let playerIndex = 0;
    let enemyIndex = 0;
    
    updatedFighters.forEach(fighter => {
      if (fighter.type === "player" && initialPositions.players[playerIndex]) {
        positionMap[fighter.id] = initialPositions.players[playerIndex];
        playerIndex++;
      } else if (fighter.type === "enemy" && initialPositions.enemies[enemyIndex]) {
        positionMap[fighter.id] = initialPositions.enemies[enemyIndex];
        enemyIndex++;
      }
    });
    
    positionsRef.current = positionMap;
    setPositions(positionMap);
    setProjectiles([]);
    setOverwatchHexes([]);
    setOverwatchShots([]);
    timelineRef.current.events = [];
    setRenderPositions(() => {
      const renderMap = {};
      Object.entries(positionMap).forEach(([id, pos]) => {
        renderMap[id] = {
          x: pos.x,
          y: pos.y,
          altitudeFeet: 0,
          facing: pos.facing || 0,
        };
      });
      return renderMap;
    });
    // ✅ Reset combat-over flags when starting new combat
    combatEndCheckRef.current = false;
    combatOverRef.current = false;
    allTimeoutsRef.current = []; // Clear any stale timeouts
    activeCastIdsRef.current.clear(); // Clear any stale cast IDs
    resolvedSpellEffectsRef.current.clear(); // Clear any stale spell effects
    combatCastGuardRef.current.clear(); // ✅ Clear cast guard for new combat
    // ✅ Reset per-combat AI refs (anti-air ammo, unreachable counters, spell spam guards, arena props)
    resetAITransientRefs();
    
    setCombatActive(true);
    setMode("COMBAT"); // Ensure mode is set to COMBAT so icons appear on the map
    
    addLog("⚔️ Combat Started!", "combat");
    addLog(`Melee Round 1 begins - Actions will alternate in initiative order`, "info");
    addLog(`Initiative Order: ${updatedFighters.map(f => `${f.name} (${f.initiative})`).join(", ")}`, "info");
    
    // ✅ Start of combat: apply courage/holy aura bonuses + fear dispel for Round 1
    processCourageAuras(updatedFighters, positionMap, addLog);
  }

  function executePsionicPower(caster, target, power) {
    if (!power || !power.name) {
      addLog(`❌ Invalid psionic power provided to executePsionicPower`, "error");
      return false;
    }
    
    // ✅ CRITICAL: Get latest caster and target from fighters array to ensure we have persisted ISP
    const latestCaster = fighters.find(f => f.id === caster.id) || caster;
    const latestTarget = target ? (fighters.find(f => f.id === target.id) || target) : null;
    
    // Pass combatState to usePsionic for Stop Bleeding guard checks
    const resolution = usePsionic(power.name, latestCaster, latestTarget, addLog, {
      combatTerrain,
      positions,
      combatState: {
        currentRound: meleeRound,
        meleeRound: meleeRound,
        fighters: fighters,
        positions: positions
      }
    });

    if (!resolution.success) {
      // Only log error if it's not a "silent" failure (like already attempted this round)
      if (resolution.reason !== "already_attempted_this_round" && resolution.reason !== "already_stabilized") {
        addLog(`❌ Psionic ${power.name} failed: ${resolution.message || 'Unknown error'}`, "error");
      }
      (resolution.additionalLogs || []).forEach(entry => {
        addLog(entry.message, entry.type || "error");
      });
      return false;
    }
    
    // Handle special psionic effects (Paralysis, etc.)
    if (power.name === "Bio-Manipulation (Paralysis)" && resolution.success) {
      // Apply paralysis status effect with duration
      const durationRounds = 4; // 1d4 melees, defaulting to 4
      setFighters(prev => prev.map(fighter => {
        if (fighter.id === target.id) {
          const updated = { ...fighter };
          if (!updated.statusEffects) {
            updated.statusEffects = [];
          }
          // Remove existing paralysis if any
          updated.statusEffects = updated.statusEffects.filter(e => 
            (typeof e === 'string' && e !== "PARALYZED") ||
            (typeof e === 'object' && e.type !== "PARALYZED")
          );
          // Add new paralysis effect
          updated.statusEffects.push({
            type: "PARALYZED",
            name: "Paralyzed",
            remainingRounds: durationRounds,
            duration: durationRounds,
            caster: caster,
            appliedAt: Date.now(),
          });
          addLog(`🧠 ${target.name} is paralyzed for ${durationRounds} melee rounds!`, "status");
          return updated;
        }
        return fighter;
      }));
    }
    
    // Don't duplicate success log - usePsionic already logs it for Stop Bleeding
    // For other psionics, the log is already in usePsionic
    if (power.name !== "Stop Bleeding") {
      addLog(`✅ Psionic ${power.name} executed successfully`, "info");
    }

    // ✅ CRITICAL: Apply updates using latest fighter state
    setFighters(prev => prev.map(fighter => {
      if (fighter.id === latestCaster.id) {
        const updated = applyFighterUpdates(fighter, resolution.casterUpdates);
        // Debug log for ISP changes (only for Stop Bleeding to diagnose spam)
        if (power.name === "Stop Bleeding" && resolution.casterUpdates?.deltaISP) {
          const beforeISP = getFighterISP(fighter);
          const afterISP = getFighterISP(updated);
          if (import.meta.env.DEV) {
            console.log(`[Stop Bleeding] ${latestCaster.name} ISP: ${beforeISP} → ${afterISP} (delta: ${resolution.casterUpdates.deltaISP})`);
          }
        }
        return updated;
      }
      if (latestTarget && resolution.targetUpdates && fighter.id === latestTarget.id) {
        return applyFighterUpdates(fighter, resolution.targetUpdates);
      }
      return fighter;
    }));

    (resolution.additionalLogs || []).forEach(entry => {
      addLog(entry.message, entry.type || "info");
    });

    endTurn();
    return true;
  }
    
  function applyFighterUpdates(fighter, updates) {
    if (!updates) return fighter;

    let updated = { ...fighter };

    if (updates.deltaISP) {
      const currentISP = getFighterISP(updated);
      const isp = Math.max(0, currentISP + updates.deltaISP);
      // Always set currentISP (for tracking current ISP)
      updated.currentISP = isp;
      // Also update ISP/isp if they exist (for backwards compatibility)
      if (updated.ISP !== undefined) updated.ISP = isp;
      if (updated.isp !== undefined) updated.isp = isp;
    }

    if (updates.deltaHP) {
      const newHP = clampHP(getFighterHP(updated) + updates.deltaHP, updated);
      applyHPToFighter(updated, newHP);
    }

    if (updates.setHP !== undefined) {
      const newHP = clampHP(updates.setHP, updated);
      applyHPToFighter(updated, newHP);
    }

    if (updates.conditions) {
      updated.conditions = {
        ...(updated.conditions || {}),
        ...updates.conditions,
      };
    }

    if (updates.bonusMods) {
      Object.entries(updates.bonusMods).forEach(([key, value]) => {
        updated[key] = (updated[key] || 0) + value;
      });
    }

    if (updates.effectAdds && updates.effectAdds.length > 0) {
      const existingEffects = Array.isArray(updated.activeEffects)
        ? [...updated.activeEffects]
        : [];

      updates.effectAdds.forEach(effect => {
        const effectCopy = { ...effect };
        existingEffects.push(effectCopy);
        applyInitialEffect(updated, effectCopy);
      });

      updated.activeEffects = existingEffects;
    }

    return updated;
  }

  function getFighterHP(fighter) {
    return (
      fighter.currentHP ??
      fighter.hp ??
      fighter.HP ??
      fighter.derived?.currentHP ??
      0
    );
  }

  function applyHPToFighter(fighter, newHP) {
    const wasConscious = (fighter.currentHP ?? fighter.hp ?? fighter.HP ?? 0) > 0;
    const isNowUnconscious = newHP <= 0;
    const wasFlying = isFlying(fighter);
    const currentAltitude = wasFlying ? (getAltitude(fighter) || 0) : 0;
    
    if (fighter.currentHP !== undefined) fighter.currentHP = newHP;
    if (fighter.hp !== undefined) fighter.hp = newHP;
    if (fighter.HP !== undefined) fighter.HP = newHP;

    fighter.isDead = false;

    if (newHP <= MIN_COMBAT_HP) {
      fighter.status = "defeated";
      fighter.isDead = true;
    } else if (newHP > 0) {
      fighter.status = "active";
    } else if (newHP === 0) {
      fighter.status = "unconscious";
    } else if (newHP >= -10) {
      fighter.status = "dying";
    } else if (newHP >= -20) {
      fighter.status = "critical";
    } else {
      fighter.status = "defeated";
      fighter.isDead = true;
    }
    
    // ✅ FLYING FALL CHECK: If flying character becomes unconscious, they fall immediately
    if (wasConscious && isNowUnconscious && wasFlying && currentAltitude > 0) {
      addLog(`💥 ${fighter.name} is hit and plummets ${currentAltitude}ft to the ground!`, "warning");
      // Apply fall damage and ground the character
      const afterFall = applyFallDamage(fighter, currentAltitude, addLog);
      Object.assign(fighter, {
        ...afterFall,
        isFlying: false,
        altitude: 0,
        altitudeFeet: 0,
        aiFlightState: null,
      });
      // Update HP status after fall damage
      const hpAfterFall = fighter.currentHP ?? fighter.hp ?? fighter.HP ?? 0;
      if (hpAfterFall <= MIN_COMBAT_HP) {
        fighter.status = "defeated";
        fighter.isDead = true;
      } else if (hpAfterFall > 0) {
        fighter.status = "active";
      } else if (hpAfterFall === 0) {
        fighter.status = "unconscious";
      } else if (hpAfterFall >= -10) {
        fighter.status = "dying";
      } else if (hpAfterFall >= -20) {
        fighter.status = "critical";
      } else {
        fighter.status = "defeated";
        fighter.isDead = true;
      }
    }
  }

  function clampHP(value, fighter) {
    const max = getFighterMaxHP(fighter);
    return Math.max(MIN_COMBAT_HP, Math.min(value, max));
  }

  function getFighterMaxHP(fighter) {
    if (!fighter || typeof fighter !== "object") return 9999;
    return (
      fighter.maxHP ??
      fighter.derived?.maxHP ??
      fighter.baseHP ??
      fighter.initialHP ??
      fighter.derived?.hitPoints ??
      9999
    );
  }

  function getFighterPPE(fighter) {
    return (
      fighter.currentPPE ??
      fighter.PPE ??
      fighter.ppe ??
      fighter.derived?.currentPPE ??
      0
    );
  }

  function getFighterISP(fighter) {
    return (
      fighter.currentISP ??
      fighter.ISP ??
      fighter.isp ??
      fighter.derived?.currentISP ??
      0
    );
  }

  // Execute spell
  function executeSpell(caster, target, spell) {
    // ✅ GUARD: Stop all processing if combat is over (use ref for latest state)
    if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
      return false;
    }

    // ✅ DE-DUPE: Generate unique cast ID with high-resolution timestamp + random
    // Use performance.now() for better precision than Date.now()
    const castId = `${caster.id}:${spell.name || spell.id || 'spell'}:${performance.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    // ✅ PREVENT DUPLICATE CASTS: Check if this exact cast ID is already active
    if (activeCastIdsRef.current.has(castId)) {
      // This exact cast is already being processed - skip
      return false;
    }
    
    // Mark cast as active immediately
    activeCastIdsRef.current.add(castId);
    
    // Clean up old cast IDs (keep last 50 to prevent memory leak)
    if (activeCastIdsRef.current.size > 50) {
      const entries = Array.from(activeCastIdsRef.current);
      activeCastIdsRef.current = new Set(entries.slice(-25));
    }
    
    // ✅ DE-DUPE: Check if this spell effect has already been resolved for this target
    const effectKey = target ? `${castId}::${target.id}` : `${castId}::self`;
    
    if (resolvedSpellEffectsRef.current.has(effectKey)) {
      // This spell effect has already been resolved - skip
      activeCastIdsRef.current.delete(castId); // Clean up
      return false;
    }
    
    // Mark as resolved immediately to prevent duplicate processing
    resolvedSpellEffectsRef.current.add(effectKey);
    
    // Clean up old entries (keep last 100 to prevent memory leak)
    if (resolvedSpellEffectsRef.current.size > 100) {
      const entries = Array.from(resolvedSpellEffectsRef.current);
      resolvedSpellEffectsRef.current = new Set(entries.slice(-50));
    }

    // Check if this is a protection circle spell using isProtectionCircle
    if (isProtectionCircle(spell)) {
      // Handle protection circle creation
      const circlePosition = positions[caster.id] || { x: 0, y: 0 };
      const circleType = spell.name || CIRCLE_TYPES.PROTECTION_FROM_EVIL;
      const createdCircle = createProtectionCircle(caster, circleType, circlePosition, 5);
      
      if (createdCircle) {
        const fullCircle = {
          ...createdCircle,
          caster: caster.name || caster.id,
          name: spell.name || circleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          bonus: 5,
          remaining: 10,
        };
        
        setActiveCircles(prev => [...prev, fullCircle]);
        
        // Use updateProtectionCirclesOnMap to update map state
        updateProtectionCirclesOnMap({
          circles: [...activeCircles, fullCircle],
          combatants: fighters,
          positions: positions,
          log: addLog
        });
        
        addLog(`🕯️ ${caster.name} draws ${fullCircle.name}!`, "holy");
        addLog(`✨ The circle glows with divine light (radius ${fullCircle.radius} ft, +${fullCircle.bonus} vs Horror).`, "holy");
        return true;
      }
    }
    
    // Use castSpell as a wrapper for unified spell casting interface
    // Note: castSpell is a wrapper that calls activateAbility, but we use executeSpell for full implementation
    const castResult = castSpell(caster, target, spell, addLog);
    if (!castResult) {
      return false; // castSpell handles validation and logging
    }
    
    // Convert unified spell to combat spell format if needed
    let combatSpell = spell;
    if (spell.type === "magic" || spell.source === "unified") {
      const converted = convertUnifiedSpellToCombatSpell(spell);
      if (converted) {
        combatSpell = converted;
      }
    }
    
    // Use getSpellCost for consistent cost extraction
    const spellCost = getSpellCost(combatSpell);
    const availablePPE =
      caster.currentPPE ??
      caster.PPE ??
      0;
    const healingFormula = getSpellHealingFormula(combatSpell);
    const healTarget = healingFormula ? (target || caster) : null;

    if (availablePPE < spellCost) {
      addLog(`❌ ${caster.name} lacks the PPE to cast ${combatSpell.name}!`, "error");
      return false;
    }

    // Validate target requirement
    if (spellRequiresTarget(combatSpell) && !target) {
      addLog(`❌ ${caster.name} must have a valid target for ${combatSpell.name}.`, "error");
      return false;
    }
    
    // Validate if spell can affect the target (friendly/enemy restrictions, self-only, etc.)
    if (target && !spellCanAffectTarget(combatSpell, caster, target)) {
      const isFriendly = caster.type === target.type;
      if (isHealingSpell(combatSpell) && !isFriendly) {
        addLog(`❌ ${combatSpell.name} cannot be cast on enemies!`, "error");
      } else if (isSupportSpell(combatSpell) && !isFriendly) {
        addLog(`❌ ${combatSpell.name} cannot be cast on enemies!`, "error");
      } else {
        addLog(`❌ ${combatSpell.name} cannot affect ${target.name}!`, "error");
      }
      return false;
      }
    
    // Validate spell range if target is provided
    if (target && positions[caster.id] && positions[target.id]) {
      const rangeFeet = getSpellRangeInFeet(combatSpell);
      const distance = calculateDistance(positions[caster.id], positions[target.id]);
      if (rangeFeet !== Infinity && distance > rangeFeet) {
        addLog(`❌ ${target.name} is ${Math.round(distance)}ft away, but ${combatSpell.name} has range ${rangeFeet}ft!`, "error");
        return false;
      }
    }

    // ✅ CAST DE-DUPE / ANTI-LOOP GUARD: Prevent machine-gun casting in same action window
    const castKey = `${caster.id}:${combatSpell.name}:${turnIndex}:${meleeRound}`;
    if (combatCastGuardRef.current.has(castKey)) {
      // We already resolved this exact cast for this action window
      activeCastIdsRef.current.delete(castId); // Clean up
      resolvedSpellEffectsRef.current.delete(effectKey); // Clean up
      return false;
    }
    combatCastGuardRef.current.add(castKey);

    // ✅ RAW WIZARD LIMIT: 1 spell per melee (2 at lvl 4+ later)
    if ((caster.spellsCastThisMelee || 0) >= 1) {
      addLog(`⏭️ ${caster.name} cannot cast another spell this melee`, "info");
      activeCastIdsRef.current.delete(castId); // Clean up
      resolvedSpellEffectsRef.current.delete(effectKey); // Clean up
      return false;
    }

    addLog(`🔮 ${caster.name} casts ${combatSpell.name}! (castId=${castId.substring(0, 30)}...)`, "combat");

    // ✅ IMMUNITY CHECK: Check for damage type immunity BEFORE save/resist logic
    // This prevents contradictory "fails to resist" + "impervious" messages
    if (hasSpellDamage(combatSpell) && target) {
      // Determine spell damage type
      const dmgType = (combatSpell.damageType || "").toLowerCase();
      
      // Fallback: Check SPELL_ELEMENT_MAP if damageType is not set
      let spellElement = null;
      if (!dmgType || dmgType === "force" || dmgType === "magic") {
        spellElement = SPELL_ELEMENT_MAP[combatSpell.name] || null;
      }
      
      // Map spell element to damage type
      const effectiveDmgType = dmgType || (spellElement ? spellElement.toLowerCase() : null);
      
      // Also check spell name for fire/cold keywords as fallback
      const spellNameLower = combatSpell.name.toLowerCase();
      const isFireSpell = effectiveDmgType === "fire" || spellElement === "fire" || 
                         spellNameLower.includes("fire") || spellNameLower.includes("flame");
      const isColdSpell = effectiveDmgType === "cold" || spellElement === "cold" || 
                         spellNameLower.includes("cold") || spellNameLower.includes("ice") || spellNameLower.includes("frost");
      
      // Check target immunities
      const targetAbilities = target.abilities || {};
      let isImmune = false;
      let immunityType = null;
      
      // Check parsed abilities object for impervious_to
      if (targetAbilities.impervious_to && Array.isArray(targetAbilities.impervious_to)) {
        if (isFireSpell && targetAbilities.impervious_to.includes("fire")) {
          isImmune = true;
          immunityType = "fire";
        } else if (isColdSpell && targetAbilities.impervious_to.includes("cold")) {
          isImmune = true;
          immunityType = "cold";
        } else if (effectiveDmgType && targetAbilities.impervious_to.includes(effectiveDmgType)) {
          isImmune = true;
          immunityType = effectiveDmgType;
        }
      }
      
      // Also check raw abilities array if it exists (fallback)
      if (!isImmune && Array.isArray(target.abilities)) {
        if (isFireSpell && target.abilities.some(a => 
          typeof a === "string" && 
          (a.toLowerCase().includes("impervious to fire") || 
           a.toLowerCase().includes("impervious to fire (no damage)"))
        )) {
          isImmune = true;
          immunityType = "fire";
        } else if (isColdSpell && target.abilities.some(a => 
          typeof a === "string" && 
          (a.toLowerCase().includes("impervious to cold") || 
           a.toLowerCase().includes("impervious to cold (no damage)"))
        )) {
          isImmune = true;
          immunityType = "cold";
        }
      }
      
      // If immune, log immunity message, spend PPE, end turn, and return early
      if (isImmune) {
        addLog(`🛡️ ${target.name} is impervious to ${immunityType} and takes no damage from ${combatSpell.name}!`, "info");
        addLog(`🔮 ${caster.name} spent ${spellCost} PPE`, "combat");

        // -------------------------------------------------------------------
        // AI: write deferred outcome so enemyTurnAI can mark this element as
        // DISPROVEN against this target (prevents Flame Lick spam vs Baal-Rog).
        // -------------------------------------------------------------------
        try {
          if (!caster.meta) caster.meta = {};
          const targetKey = getAIMemoryTargetKey(target);
          caster.meta.lastSpellOutcome = {
            targetKey,
            spellName: combatSpell.name,
            element: immunityType || inferSpellElementForAI(combatSpell),
            outcome: "disproven",
            notes: `Target is impervious to ${immunityType || "this element"}`,
          };
        } catch (e) {
          // swallow
        }
        
        // ✅ Increment spells cast this melee (RAW: 1 spell per melee limit) - spell was cast even if immune
        setFighters(prev => 
          prev.map(f => 
            f.id === caster.id
              ? { ...f, spellsCastThisMelee: (f.spellsCastThisMelee || 0) + 1 }
              : f
          )
        );
        
        activeCastIdsRef.current.delete(castId); // Clean up
        endTurn();
        return true;
      }
    }

    setFighters((prev) => {
      // ✅ GUARD: Check combat state inside setState callback
      if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
        activeCastIdsRef.current.delete(castId); // Clean up on abort
        return prev;
      }
      
      return prev.map((f) => {
        if (f.id !== caster.id) return f;
        const updated = { ...f };
        if (typeof updated.PPE === "number") {
          updated.PPE = Math.max(0, updated.PPE - spellCost);
        }
        if (typeof updated.currentPPE === "number") {
          updated.currentPPE = Math.max(0, updated.currentPPE - spellCost);
        }
        return updated;
      });
    });

    // -----------------------------------------------------------------------
    // AI: "threat intel" spells earn threat-analysis tags (inferred, not confirmed)
    // Stored on caster.meta._earnedThreatTags[targetKey] so createThreatProfile
    // can merge them if you choose.
    // -----------------------------------------------------------------------
    try {
      const earned = getThreatTagsEarnedBySpell(combatSpell);
      if (earned && target) {
        if (!caster.meta) caster.meta = {};
        if (!caster.meta._earnedThreatTags) caster.meta._earnedThreatTags = {};
        const targetKey = getAIMemoryTargetKey(target);
        caster.meta._earnedThreatTags[targetKey] = {
          ...(caster.meta._earnedThreatTags[targetKey] || {}),
          ...earned,
          _lastSourceSpell: combatSpell.name,
          _t: Date.now(),
        };
      }
    } catch (e) {
      // swallow
    }

    if (healingFormula && healTarget) {
      let healAmount = 0;
      try {
        if (healingFormula.type === "dice") {
          const roll = CryptoSecureDice.parseAndRoll(healingFormula.expression);
          healAmount = Math.abs(roll.totalWithBonus);
        } else if (typeof healingFormula.amount === "number") {
          healAmount = Math.abs(healingFormula.amount);
        }
      } catch (error) {
        console.warn(`Failed to parse healing formula for ${combatSpell.name}:`, error);
      }

      if (healAmount > 0) {
        setFighters((prev) => {
          // ✅ GUARD: Check combat state inside setState callback
          if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
            activeCastIdsRef.current.delete(castId); // Clean up on abort
            return prev;
          }
          
          return prev.map((f) => {
            if (f.id !== healTarget.id) return f;
            const updatedTarget = { ...f };
            const newHP = clampHP(getFighterHP(updatedTarget) + healAmount, updatedTarget);
            applyHPToFighter(updatedTarget, newHP);
            return updatedTarget;
          });
        });
        addLog(`💚 ${healTarget.name} recovers ${healAmount} HP from ${combatSpell.name}!`, "combat");
      } else if (combatSpell.effect) {
        addLog(`✨ ${combatSpell.effect}`, "combat");
      }

      addLog(`🔮 ${caster.name} spent ${spellCost} PPE`, "combat");
      
      // ✅ GUARD: Check combat state before ending turn (use ref for latest state)
      if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
        activeCastIdsRef.current.delete(castId); // Clean up on abort
        return false;
      }
      
      activeCastIdsRef.current.delete(castId); // Clean up after successful completion
      endTurn();
      return true;
    }

    // Handle damage spells
    let spellSaveInfo = null;
    let saveResisted = false;

    if (hasSpellDamage(combatSpell) && target) {
      // ✅ GUARD: Check combat state before processing (use ref for latest state)
      if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
        activeCastIdsRef.current.delete(castId); // Clean up on abort
        return false;
      }
      
      spellSaveInfo = resolveMagicSave(caster, target, combatSpell.name);
      if (spellSaveInfo) {
        const { roll, totalBonus, total, dc, resisted } = spellSaveInfo;
        addLog(
          `🛡️ ${target.name} attempts to resist ${combatSpell.name}: roll ${roll} + ${totalBonus} = ${total} vs ${dc}`,
          "info"
        );
        if (resisted) {
          addLog(`⚡ ${target.name} resists part of the spell!`, "warning");
          saveResisted = true;
        } else {
          addLog(`🔥 ${target.name} fails to resist ${combatSpell.name}!`, "combat");
        }
      }
    }

    if (combatSpell.damage && target) {
      // ✅ GUARD: Check combat state before applying damage (use ref for latest state)
      if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
        activeCastIdsRef.current.delete(castId); // Clean up on abort
        return false;
      }
      
      // Check for fire/cold resistance (half damage) - immunity already checked above
      const targetAbilities = target.abilities || {};
      const spellNameLower = combatSpell.name.toLowerCase();
      const spellElement = SPELL_ELEMENT_MAP[combatSpell.name] || null;
      const dmgType = (combatSpell.damageType || "").toLowerCase();
      const isFireSpell = dmgType === "fire" || spellElement === "fire" || 
                         spellNameLower.includes("fire") || spellNameLower.includes("flame");
      const isColdSpell = dmgType === "cold" || spellElement === "cold" || 
                         spellNameLower.includes("cold") || spellNameLower.includes("ice") || spellNameLower.includes("frost");
      
      // Check for fire resistance (half damage)
      if (isFireSpell) {
        const fireResistance = targetAbilities.resistances?.fire;
        if (fireResistance && fireResistance < 1.0) {
          const damageRoll = CryptoSecureDice.parseAndRoll(combatSpell.damage);
          let damage = Math.floor(damageRoll.totalWithBonus * fireResistance);
          if (saveResisted) {
            damage = Math.max(1, Math.floor(damage / 2));
          }
          
          setFighters((prev) => {
            if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
              activeCastIdsRef.current.delete(castId);
              return prev;
            }
            
            return prev.map((f) => {
              if (f.id !== target.id) return f;
              const updatedTarget = { ...f };
              const newHP = clampHP(getFighterHP(updatedTarget) - damage, updatedTarget);
              applyHPToFighter(updatedTarget, newHP);
              return updatedTarget;
            });
          });
          
          addLog(`💥 ${combatSpell.name} hits ${target.name} for ${damage} damage (fire resistance: ${Math.round(fireResistance * 100)}%)!`, "combat");
          addLog(`🔮 ${caster.name} spent ${spellCost} PPE`, "combat");

          // AI: spell worked (confirmed effective vs target; not a "weakness" claim)
          try {
            if (!caster.meta) caster.meta = {};
            const targetKey = getAIMemoryTargetKey(target);
            caster.meta.lastSpellOutcome = {
              targetKey,
              spellName: combatSpell.name,
              element: inferSpellElementForAI(combatSpell),
              outcome: damage > 0 ? "confirmed" : "no_effect",
              notes: saveResisted ? "Target partially resisted" : "Spell dealt damage",
            };
          } catch (e) {
            // swallow
          }
          
          // ✅ Increment spells cast this melee (RAW: 1 spell per melee limit)
          setFighters(prev => 
            prev.map(f => 
              f.id === caster.id
                ? { ...f, spellsCastThisMelee: (f.spellsCastThisMelee || 0) + 1 }
                : f
            )
          );
          
          activeCastIdsRef.current.delete(castId);
          endTurn();
          return true;
        }
      }
      
      // Check for cold resistance (half damage)
      if (isColdSpell) {
        const coldResistance = targetAbilities.resistances?.cold;
        if (coldResistance && coldResistance < 1.0) {
          const damageRoll = CryptoSecureDice.parseAndRoll(combatSpell.damage);
          let damage = Math.floor(damageRoll.totalWithBonus * coldResistance);
          if (saveResisted) {
            damage = Math.max(1, Math.floor(damage / 2));
          }
          
          setFighters((prev) => {
            if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
              activeCastIdsRef.current.delete(castId);
              return prev;
            }
            
            return prev.map((f) => {
              if (f.id !== target.id) return f;
              const updatedTarget = { ...f };
              const newHP = clampHP(getFighterHP(updatedTarget) - damage, updatedTarget);
              applyHPToFighter(updatedTarget, newHP);
              return updatedTarget;
            });
          });
          
          addLog(`💥 ${combatSpell.name} hits ${target.name} for ${damage} damage (cold resistance: ${Math.round(coldResistance * 100)}%)!`, "combat");
          addLog(`🔮 ${caster.name} spent ${spellCost} PPE`, "combat");

          // AI: spell worked (confirmed effective vs target; not a "weakness" claim)
          try {
            if (!caster.meta) caster.meta = {};
            const targetKey = getAIMemoryTargetKey(target);
            caster.meta.lastSpellOutcome = {
              targetKey,
              spellName: combatSpell.name,
              element: inferSpellElementForAI(combatSpell),
              outcome: damage > 0 ? "confirmed" : "no_effect",
              notes: saveResisted ? "Target partially resisted" : "Spell dealt damage",
            };
          } catch (e) {
            // swallow
          }
          
          // ✅ Increment spells cast this melee (RAW: 1 spell per melee limit)
          setFighters(prev => 
            prev.map(f => 
              f.id === caster.id
                ? { ...f, spellsCastThisMelee: (f.spellsCastThisMelee || 0) + 1 }
                : f
            )
          );
          
          activeCastIdsRef.current.delete(castId);
          endTurn();
          return true;
        }
      }
      
      const damageRoll = CryptoSecureDice.parseAndRoll(combatSpell.damage);
      let damage = damageRoll.totalWithBonus;
      if (saveResisted) {
        damage = Math.max(1, Math.floor(damage / 2));
      }

      setFighters((prev) => {
        // ✅ GUARD: Double-check combat state inside setState callback (use ref for latest state)
        if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
          activeCastIdsRef.current.delete(castId); // Clean up on abort
          return prev;
        }
        
        return prev.map((f) => {
          if (f.id !== target.id) return f;

          const updatedTarget = { ...f };
          const newHP = clampHP(getFighterHP(updatedTarget) - damage, updatedTarget);
          // applyHPToFighter will handle the fall check automatically
          applyHPToFighter(updatedTarget, newHP);
          
          return updatedTarget;
        });
      });

      addLog(`💥 ${combatSpell.name} hits ${target.name} for ${damage} damage!`, "combat");
      
      // ✅ Increment spells cast this melee (RAW: 1 spell per melee limit)
      setFighters(prev => 
        prev.map(f => 
          f.id === caster.id
            ? { ...f, spellsCastThisMelee: (f.spellsCastThisMelee || 0) + 1 }
            : f
        )
      );
    } else if (combatSpell.effect) {
      addLog(`✨ ${combatSpell.effect}`, "combat");
      
      // ✅ Increment spells cast this melee (RAW: 1 spell per melee limit)
      setFighters(prev => 
        prev.map(f => 
          f.id === caster.id
            ? { ...f, spellsCastThisMelee: (f.spellsCastThisMelee || 0) + 1 }
            : f
        )
      );
    }

    addLog(`🔮 ${caster.name} spent ${spellCost} PPE`, "combat");
    
    // ✅ GUARD: Check combat state before ending turn (use ref for latest state)
    if (combatOverRef.current || !combatActive || combatEndCheckRef.current) {
      activeCastIdsRef.current.delete(castId); // Clean up on abort
      return false;
    }
    
    activeCastIdsRef.current.delete(castId); // Clean up after successful completion
    endTurn();
    return true;
  }
  function executeSelectedAction() {
    const currentFighter = fighters[turnIndex];
    
    if (combatPausedRef.current) {
      addLog("⏸️ Combat is paused. Resume to take actions.", "warning");
      return;
    }

    // Prevent multiple rapid action executions
    if (executingActionRef.current) {
      // Don't spam the log - only warn once per turn
      const lockKey = `lock_${currentFighter?.id}_${turnCounter}`;
      if (!lastProcessedTurnRef.current || lastProcessedTurnRef.current !== lockKey) {
        addLog(`⏳ ${currentFighter?.name || 'Character'} is already executing an action, please wait...`, "warning");
        lastProcessedTurnRef.current = lockKey;
      }
      return;
    }
    
    if (!currentFighter || currentFighter.type !== "player") {
      endTurn();
      return;
    }

    if (!selectedAction) {
      // Prevent duplicate "no action" logs for the same fighter in the same turn
      const noActionKey = `${currentFighter.id}_${turnCounter}`;
      if (!lastNoActionLogRef.current.has(noActionKey)) {
        addLog(`${currentFighter.name} takes no action this turn.`, "info");
        lastNoActionLogRef.current.set(noActionKey, true);
        // Clean up old entries (keep only current turn)
        if (lastNoActionLogRef.current.size > 10) {
          const currentTurnKeys = Array.from(lastNoActionLogRef.current.keys()).filter(
            key => key.endsWith(`_${turnCounter}`)
          );
          lastNoActionLogRef.current.clear();
          currentTurnKeys.forEach(key => lastNoActionLogRef.current.set(key, true));
        }
      }
      // Clear selections and close modal
      setSelectedAction(null);
      setSelectedTarget(null);
      setSelectedAttackWeapon(null);
      setSelectedManeuver(null);
      setShowCombatChoices(false);
      closeCombatChoices(); // Also close via disclosure hook
      setTargetingMode(null);
      scheduleEndTurn(500);
      return;
    }

    // Mark as executing to prevent rapid multiple clicks
    executingActionRef.current = true;
    
    // Safety: Auto-clear lock after 5 seconds if it gets stuck
    const lockTimeout = setTimeout(() => {
      if (executingActionRef.current) {
        console.warn('⚠️ Action lock was stuck, auto-clearing');
        executingActionRef.current = false;
      }
    }, 5000);

    // CRITICAL: Close combat choices modal immediately to prevent multiple actions
    // Clear selections so player can't queue another action
    const actionToExecute = selectedAction;
    const targetToExecute = selectedTarget;
    const weaponToExecute = selectedAttackWeapon;
    
    setSelectedAction(null);
    setSelectedTarget(null);
    setSelectedAttackWeapon(null);
    setShowCombatChoices(false);
    closeCombatChoices(); // Also close via disclosure hook

    // Execute the selected action based on type
    switch (actionToExecute.name) {
      case "Strike":
        if (targetToExecute && weaponToExecute) {
          // Use the selected weapon for attack
          addLog(`${currentFighter.name} strikes with ${weaponToExecute.name}!`, "info");
          attack(currentFighter, targetToExecute.id);
          // Note: executingActionRef will be cleared when attack completes (endTurn resets it)
          return; // attack function already calls endTurn
        } else if (!targetToExecute) {
          addLog(`${currentFighter.name} wants to strike but has no target selected!`, "error");
          executingActionRef.current = false; // Clear lock on error
          clearTimeout(lockTimeout);
          return;
        } else if (!weaponToExecute) {
          addLog(`${currentFighter.name} wants to strike but has no weapon selected!`, "error");
          executingActionRef.current = false; // Clear lock on error
          clearTimeout(lockTimeout);
          return;
        }
        break;
      case "Overwatch Shot":
        if (!weaponToExecute) {
          addLog(`${currentFighter.name} wants to overwatch but has no weapon selected!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        if (!overwatchTargetHex) {
          setTargetingMode("OVERWATCH_HEX");
          addLog("🎯 Select a hex for Overwatch.", "info");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }

        // Hex selection commits the overwatch; nothing else to do here.
        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        return;
        executingActionRef.current = false; // Clear lock if we break
        break;
      
      case "Parry": {
        // Set defensive stance for this fighter
        setDefensiveStance(prev => ({ ...prev, [currentFighter.id]: "Parry" }));
        addLog(`${currentFighter.name} takes a defensive stance, preparing to parry incoming attacks.`, "info");
        // Deduct action cost using standardized function
        const parryCost = getActionCost("PARRY");
        setFighters(prev => prev.map(f => 
          f.id === currentFighter.id 
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - (parryCost === "all" ? f.remainingAttacks : parryCost)) }
            : f
        ));
        executingActionRef.current = false; // Clear lock after action completes
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
      }
      
      case "Dodge": {
        // Set defensive stance for this fighter
        setDefensiveStance(prev => ({ ...prev, [currentFighter.id]: "Dodge" }));
        addLog(`${currentFighter.name} prepares to dodge incoming attacks.`, "info");
        // Deduct action cost using standardized function
        const dodgeCost = getActionCost("DODGE");
        setFighters(prev => prev.map(f => 
          f.id === currentFighter.id 
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - (dodgeCost === "all" ? f.remainingAttacks : dodgeCost)) }
            : f
        ));
        scheduleEndTurn(500);
        return;
      }
      
      case "Hide":
      case "Prowl": {
        // Attempt to hide mid-combat
        const hideResult = attemptMidCombatHide(
          currentFighter,
          positions,
          combatTerrain,
          fighters.filter(f => f.type === "enemy")
        );
        
        addLog(hideResult.log, hideResult.success ? "info" : "warning");
        
        if (hideResult.success) {
          // Update awareness for all enemies - they lose track
          fighters.filter(f => f.type === "enemy").forEach(enemy => {
            updateAwareness(enemy, currentFighter, AWARENESS_STATES.SEARCHING);
          });
        }
        
        // Deduct action cost using standardized function
        const hideCost = getActionCost("USE_SKILL"); // Hide/Prowl uses skill action cost
        setFighters(prev => prev.map(f => 
          f.id === currentFighter.id 
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - (hideCost === "all" ? f.remainingAttacks : hideCost)) }
            : f
        ));
        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
      }
      
      case "Move":
        // Move action - activate movement mode for tactical positioning
        // Movement mode activates - action will be deducted when movement is confirmed
        if (currentFighter.type === "player") {
          activateMovementMode();
          // Action will be deducted in handleMoveSelect when hex is selected
        } else {
          // For enemies, just log the move action and deduct action
          addLog(`🏃 ${currentFighter.name} moves to a better position (+1 dodge next attack).`, "info");
          setDefensiveStance(prev => ({ ...prev, [currentFighter.id]: "Move" }));
          setFighters(prev => prev.map(f => 
            f.id === currentFighter.id 
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
              : f
          ));
          scheduleEndTurn(500);
        }
        return;
      
      case "Run":
        // Run action - activate movement mode with running speed
        // Movement mode activates - action will be deducted when movement is confirmed
        if (currentFighter.type === "player") {
          // Set running mode flag for movement calculations
          setMovementMode({ active: true, isRunning: true });
          setSelectedMovementFighter(currentFighter.id);
          addLog(`🏃 ${currentFighter.name} prepares to run (full speed movement)`, "info");
          // Action will be deducted in handleMoveSelect when hex is selected
        } else {
          // For enemies, just log the run action and deduct action
          addLog(`🏃 ${currentFighter.name} runs to a better position.`, "info");
          setDefensiveStance(prev => ({ ...prev, [currentFighter.id]: "Run" }));
          setFighters(prev => prev.map(f => 
            f.id === currentFighter.id 
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
              : f
          ));
          scheduleEndTurn(500);
        }
        return;
      
      case "Withdraw":
        // Withdraw action - move away from enemies to a safer position
        if (currentFighter.type === "player") {
          handleWithdrawAction({
            currentFighter,
            fighters,
            positions,
            setPositions,
            addLog,
            endTurn: () => {
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              endTurn();
            },
            maxWithdrawSteps: 3,
          });
        } else {
          // For enemies, use AI withdraw logic (already handled in enemyTurnAI)
          addLog(`🏃 ${currentFighter.name} withdraws to a safer position.`, "info");
          setDefensiveStance(prev => ({ ...prev, [currentFighter.id]: "Retreat" }));
          setFighters(prev => prev.map(f => 
            f.id === currentFighter.id 
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
              : f
          ));
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          scheduleEndTurn(500);
        }
        return;
      
      case "Defend/Hold":
        addLog(`${currentFighter.name} takes a defensive stance and holds their ground.`, "info");
        // Decrement action and end turn
        setFighters(prev => prev.map(f => 
          f.id === currentFighter.id 
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
            : f
        ));
        scheduleEndTurn(500);
        return;
      
      case "Light Rest": {
        // Player takes a moment to catch their breath
        const restCost = getActionCost("USE_SKILL"); // 1 action by default

        setFighters(prev =>
          prev.map(f => {
            if (f.id !== currentFighter.id) return f;

            // Clone so recoverStamina can safely mutate fatigueState
            const cloned = { ...f };
            const updatedFatigue = recoverStamina(cloned, "LIGHT_REST", 1);

            return {
              ...cloned,
              fatigueState: { ...updatedFatigue },
              remainingAttacks: Math.max(
                0,
                f.remainingAttacks -
                  (restCost === "all" ? f.remainingAttacks : restCost)
              ),
            };
          })
        );

        addLog(
          `😮‍💨 ${currentFighter.name} takes a moment to catch their breath and recover stamina.`,
          "info"
        );

        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
      }

      case "Full Rest": {
        // Player drops out of the action to fully rest
        setFighters(prev =>
          prev.map(f => {
            if (f.id !== currentFighter.id) return f;

            const cloned = { ...f };
            const updatedFatigue = recoverStamina(cloned, "FULL_REST", 1);

            return {
              ...cloned,
              fatigueState: { ...updatedFatigue },
              remainingAttacks: 0, // full turn spent resting
            };
          })
        );

        addLog(
          `🧘 ${currentFighter.name} pauses to fully rest, focusing on recovering stamina this round.`,
          "info"
        );

        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
      }
      
      case "Brace": {
        // Set defensive stance for bracing against charges (spear/polearm)
        const braceWeapon = getEquippedWeapons(currentFighter)?.primary || getEquippedWeapons(currentFighter)?.secondary || null;
        if (braceWeapon && (braceWeapon.name?.toLowerCase().includes("spear") || 
                            braceWeapon.name?.toLowerCase().includes("pike") ||
                            braceWeapon.name?.toLowerCase().includes("polearm") ||
                            braceWeapon.name?.toLowerCase().includes("lance"))) {
          setDefensiveStance(prev => ({ ...prev, [currentFighter.id]: "Brace" }));
          addLog(`⚔️ ${currentFighter.name} braces ${braceWeapon.name} against incoming charges! (+2 strike, triple damage on charge, counter-damage on 18-20)`, "info");
          // Decrement action and end turn
          setFighters(prev => prev.map(f => 
            f.id === currentFighter.id 
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
              : f
          ));
          executingActionRef.current = false; // Clear lock after action completes
          scheduleEndTurn(500);
        } else {
          addLog(`❌ ${currentFighter.name} cannot brace without a spear, pike, polearm, or lance!`, "error");
          executingActionRef.current = false; // Clear lock on error
        }
        return;
      }
      
      case "Combat Maneuvers": {
        if (targetToExecute) {
          // Check if fighter is in a grapple state
          const grappleStatus = getGrappleStatus(currentFighter);
          const targetGrappleStatus = getGrappleStatus(targetToExecute);
          
          // If either fighter is grappled, use grapple actions
          if (grappleStatus.state !== GRAPPLE_STATES.NEUTRAL || targetGrappleStatus.state !== GRAPPLE_STATES.NEUTRAL) {
            // Use selected grapple action if available, otherwise determine from state
            let grappleAction = selectedGrappleAction || 'grapple';
            
            if (!selectedGrappleAction) {
              // Fallback: determine appropriate grapple action based on current state
              if (grappleStatus.state === GRAPPLE_STATES.CLINCH || grappleStatus.state === GRAPPLE_STATES.GROUND) {
                // Already grappling - default to maintain
                grappleAction = 'maintain';
              } else if (grappleStatus.state === GRAPPLE_STATES.GRAPPLED) {
                // Pinned - default to break free
                grappleAction = 'breakFree';
              } else if (targetGrappleStatus.state === GRAPPLE_STATES.GRAPPLED) {
                // Target is pinned - default to ground strike
                grappleAction = 'groundStrike';
              }
            }
            
            // Execute grapple action
            handleGrappleAction(grappleAction, currentFighter, targetToExecute.id);
            setSelectedGrappleAction(null); // Clear selection after use
            executingActionRef.current = false; // Clear lock after action completes
            clearTimeout(lockTimeout);
            scheduleEndTurn(500);
            return;
          } else {
            // Not in grapple - use selected maneuver
            if (!selectedManeuver) {
              addLog(`⚠️ Please select a maneuver first!`, "error");
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              return;
            }
            
            if (selectedManeuver === "grapple") {
              // Use handleGrappleAction for grapple maneuver
              handleGrappleAction('grapple', currentFighter, targetToExecute.id);
              setSelectedManeuver(null); // Clear selection after use
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              scheduleEndTurn(500);
              return;
            } else if (selectedManeuver === "trip") {
              executeTripManeuver(currentFighter, targetToExecute);
              setSelectedManeuver(null); // Clear selection after use
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              scheduleEndTurn(500);
              return;
            } else if (selectedManeuver === "shove") {
              executeShoveManeuver(currentFighter, targetToExecute);
              setSelectedManeuver(null); // Clear selection after use
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              scheduleEndTurn(500);
              return;
            } else if (selectedManeuver === "disarm") {
              executeDisarmManeuver(currentFighter, targetToExecute);
              setSelectedManeuver(null); // Clear selection after use
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              scheduleEndTurn(500);
              return;
            } else {
              addLog(`⚠️ Unknown maneuver: ${selectedManeuver}`, "error");
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              return;
            }
          }
        } else {
          addLog(`${currentFighter.name} wants to perform a maneuver but has no target selected!`, "error");
          executingActionRef.current = false; // Clear lock on error
          clearTimeout(lockTimeout);
          return;
        }
      }
      
      case "Psionics": {
        // Check if character has psionic powers
        if (!currentFighter.psionicPowers || currentFighter.psionicPowers.length === 0) {
          addLog(`${currentFighter.name} has no psionic powers available!`, "error");
          return;
        }
        // Check ISP
        if (!currentFighter.ISP || currentFighter.ISP <= 0) {
          addLog(`${currentFighter.name} has no ISP remaining!`, "error");
          return;
        }
        // Check if psionic power is selected
        if (!selectedPsionicPower) {
          addLog(`${currentFighter.name} must select a psionic power first!`, "error");
          return;
        }
        // Execute the psionic power
        const psionicSuccess = executePsionicPower(currentFighter, targetToExecute, selectedPsionicPower);
        if (psionicSuccess) {
          setPsionicsMode(false);
          setSelectedPsionicPower(null);
          return; // executePsionicPower handles turn ending
        }
        break;
      }
      
      case "Clerical Abilities": {
        const clericalAbilities = getAvailableClericalAbilities(currentFighter);
        if (clericalAbilities.length === 0) {
          addLog(`❌ ${currentFighter.name} has no clerical abilities!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        
        // Check if ability is selected
        if (!selectedClericalAbility) {
          addLog(`❌ ${currentFighter.name} must select a clerical ability first!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        
        // Execute the selected clerical ability
        const abilityName = selectedClericalAbility.name;
        let result = null;
        
        switch (abilityName) {
          case "Animate Dead": {
            // Find dead characters on the map
            const deadBodies = fighters.filter(f => isDead(f) && positions[f.id]);
            if (deadBodies.length === 0) {
              addLog(`❌ No dead bodies available to animate!`, "error");
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              return;
            }
            
            result = animateDead(currentFighter, deadBodies, { log: addLog });
            
            if (result.success && result.animated) {
              // TODO: Create animated undead fighters from result.animated
              // For now, just log success
              addLog(`✨ ${result.animated.length} dead body/bodies animated!`, "info");
            }
            break;
          }
          
          case "Turn Dead": {
            // Find undead targets
            const undeadTargets = fighters.filter(f => 
              f.id !== currentFighter.id && 
              isUndead(f) && 
              positions[f.id]
            );
            
            if (undeadTargets.length === 0) {
              addLog(`❌ No undead targets available!`, "error");
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              return;
            }
            
            result = turnDead(currentFighter, undeadTargets, { log: addLog });
            
            if (result.success) {
              // Apply turn effects to turned/destroyed undead
              if (result.turned && result.turned.length > 0) {
                // Mark as routed/fled
                setFighters(prev => prev.map(f => {
                  if (result.turned.some(t => t.id === f.id)) {
                    return {
                      ...f,
                      moraleState: { ...(f.moraleState || {}), status: "ROUTED", hasFled: true },
                      statusEffects: Array.isArray(f.statusEffects) 
                        ? [...f.statusEffects, "FLED"] 
                        : ["FLED"]
                    };
                  }
                  return f;
                }));
              }
              
              if (result.destroyed && result.destroyed.length > 0) {
                // Destroy undead (set HP to -100 or remove from combat)
                setFighters(prev => prev.map(f => {
                  if (result.destroyed.some(t => t.id === f.id)) {
                    return { ...f, currentHP: -100, status: "defeated" };
                  }
                  return f;
                }));
              }
            }
            break;
          }
          
          case "Exorcism": {
            if (!targetToExecute) {
              addLog(`❌ ${currentFighter.name} must select a target for Exorcism!`, "error");
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              return;
            }
            
            result = performExorcism(currentFighter, targetToExecute, { log: addLog });
            
            if (result.success && result.banished) {
              // Remove or mark target as banished
              addLog(`✨ ${targetToExecute.name} has been banished!`, "info");
              // Could remove from combat or mark as banished
            }
            break;
          }
          
          case "Remove Curse": {
            if (!targetToExecute) {
              addLog(`❌ ${currentFighter.name} must select a target for Remove Curse!`, "error");
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              return;
            }
            
            result = removeCurse(currentFighter, targetToExecute, { log: addLog });
            
            if (result.success && result.removed) {
              // Remove curse status from target
              setFighters(prev => prev.map(f => {
                if (f.id === targetToExecute.id) {
                  const newStatusEffects = Array.isArray(f.statusEffects)
                    ? f.statusEffects.filter(e => e !== "CURSED")
                    : [];
                  return {
                    ...f,
                    cursed: false,
                    hasCurse: false,
                    statusEffects: newStatusEffects
                  };
                }
                return f;
              }));
            }
            break;
          }
          
          case "Healing Touch": {
            if (!targetToExecute) {
              addLog(`❌ ${currentFighter.name} must select a target for Healing Touch!`, "error");
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              return;
            }
            
            result = clericalHealingTouch(currentFighter, targetToExecute, { log: addLog });
            
            if (result.success) {
              // Update target HP
              setFighters(prev => prev.map(f => {
                if (f.id === targetToExecute.id) {
                  return {
                    ...f,
                    currentHP: result.currentHp,
                    hp: result.currentHp
                  };
                }
                return f;
              }));
              addLog(result.message, "healing");
            } else {
              addLog(`❌ ${result.reason || "Healing Touch failed"}`, "error");
            }
            break;
          }
          
          default:
            addLog(`❌ Unknown clerical ability: ${abilityName}`, "error");
            executingActionRef.current = false;
            clearTimeout(lockTimeout);
            return;
        }
        
        // Deduct action cost
        setFighters(prev => prev.map(f => 
          f.id === currentFighter.id 
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
            : f
        ));
        
        // Clear selections
        setClericalAbilitiesMode(false);
        setSelectedClericalAbility(null);
        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
      }
      
      case "Spells": {
        // Check if character has spells
        if (!availableSpells || availableSpells.length === 0) {
          addLog(`${currentFighter.name} has no spells available!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        // Check PPE
        const currentPPE =
          currentFighter.currentPPE ??
          currentFighter.PPE ??
          0;
        if (currentPPE <= 0) {
          addLog(`${currentFighter.name} has no PPE remaining!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        // Check if spell is selected
        if (!selectedSpell) {
          addLog(`${currentFighter.name} must select a spell first!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        if (spellRequiresTarget(selectedSpell) && !targetToExecute) {
          addLog(`${currentFighter.name} must select a target for ${selectedSpell.name}!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        // Validate if spell can affect the target
        if (targetToExecute && !spellCanAffectTarget(selectedSpell, currentFighter, targetToExecute)) {
          const isFriendly = currentFighter.type === targetToExecute.type;
          if (isHealingSpell(selectedSpell) && !isFriendly) {
            addLog(`${selectedSpell.name} cannot be cast on enemies!`, "error");
          } else if (isSupportSpell(selectedSpell) && !isFriendly) {
            addLog(`${selectedSpell.name} cannot be cast on enemies!`, "error");
          } else {
            addLog(`${selectedSpell.name} cannot affect ${targetToExecute.name}!`, "error");
          }
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        // Validate spell range
        if (targetToExecute && positions[currentFighter.id] && positions[targetToExecute.id]) {
          const rangeFeet = getSpellRangeInFeet(selectedSpell);
          const distance = calculateDistance(positions[currentFighter.id], positions[targetToExecute.id]);
          if (rangeFeet !== Infinity && distance > rangeFeet) {
            addLog(`${targetToExecute.name} is ${Math.round(distance)}ft away, but ${selectedSpell.name} has range ${rangeFeet}ft!`, "error");
            executingActionRef.current = false;
            clearTimeout(lockTimeout);
            return;
          }
        }
        // Execute the spell
        const spellSuccess = executeSpell(currentFighter, targetToExecute, selectedSpell);
        if (spellSuccess) {
          setSpellsMode(false);
          setSelectedSpell(null);
          return; // executeSpell handles turn ending
        }
        break;
      }
      
      case "Use Skill": {
        // Check if skill is selected
        if (!selectedSkill) {
          addLog(`${currentFighter.name} must select a skill first!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        
        // Check if target is required and selected
        if (selectedSkill.requiresTarget && !targetToExecute) {
          addLog(`${selectedSkill.name} requires a target!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        
        // Check range for touch skills
        if (selectedSkill.range === "touch" && targetToExecute) {
          const userPos = positions[currentFighter.id];
          const targetPos = positions[targetToExecute.id];
          if (userPos && targetPos) {
            const distance = calculateDistance(userPos, targetPos);
            if (distance > 5.5) { // 5.5 feet = 1 hex
              addLog(`❌ ${currentFighter.name} is too far from ${targetToExecute.name} (${Math.round(distance)}ft). Touch skills require being adjacent.`, "error");
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              return;
            }
          }
        }
        
        // Execute the skill based on type
        let skillResult = null;
        
        if (selectedSkill.type === "healer_ability") {
          // Healer ISP-based ability
          const powerName = selectedSkill.name.replace(" (Healer)", "");
          skillResult = healerAbility(currentFighter, targetToExecute, powerName);
          
          if (skillResult.error) {
            addLog(`❌ ${skillResult.error}`, "error");
            executingActionRef.current = false;
            clearTimeout(lockTimeout);
            return;
    }

          // Update fighter ISP
          setFighters(prev => prev.map(f => 
            f.id === currentFighter.id 
              ? { ...f, currentISP: skillResult.ispRemaining, ISP: skillResult.ispRemaining }
              : f
          ));
          
          // Update target HP if healed
          if (skillResult.healed !== undefined) {
            setFighters(prev => prev.map(f => 
              f.id === targetToExecute.id 
                ? { ...f, currentHP: skillResult.currentHp }
                : f
            ));
          }
          
          addLog(skillResult.message, skillResult.success === false ? "error" : "success");
          
        } else if (selectedSkill.type === "clerical_ability") {
          // Clerical Healing Touch
          skillResult = clericalHealingTouch(currentFighter, targetToExecute);
          
          if (skillResult.error) {
            addLog(`❌ ${skillResult.error}`, "error");
            executingActionRef.current = false;
            clearTimeout(lockTimeout);
            return;
          }
          
          // Update target HP
          setFighters(prev => prev.map(f => 
            f.id === targetToExecute.id 
              ? { ...f, currentHP: skillResult.currentHp }
              : f
          ));
          
          addLog(skillResult.message, "success");
          
        } else if (selectedSkill.type === "medical_skill") {
          // First Aid / Medical Treatment
          const skillPercent = selectedSkill.skillPercent || 50;
          skillResult = medicalTreatment(currentFighter, targetToExecute, skillPercent);
          
          // Update target HP if healed
          if (skillResult.healed > 0) {
            setFighters(prev => prev.map(f => 
              f.id === targetToExecute.id 
                ? { ...f, currentHP: skillResult.currentHp }
                : f
            ));
          }
          
          addLog(skillResult.message, skillResult.success ? "success" : "error");
          
        } else {
          // Other combat skills (Prowl, Track, etc.)
          // Use getSkillPercentage to ensure accurate skill percentage
          const skillPercent = getSkillPercentage(currentFighter, selectedSkill.name) || selectedSkill.skillPercent || 0;
          const skillCheck = rollSkillCheck(skillPercent);
          
          // Use lookupSkill to get additional skill information if available
          const skillInfo = lookupSkill(selectedSkill.name);
          if (skillInfo && skillInfo.category) {
            addLog(`📚 Using ${selectedSkill.name} (${skillInfo.category} skill)`, "info");
          }
          
          if (skillCheck.success) {
            addLog(`✅ ${currentFighter.name} successfully uses ${selectedSkill.name}! (Roll: ${skillCheck.roll}/${skillPercent}%)`, "success");
          } else {
            addLog(`❌ ${currentFighter.name} fails ${selectedSkill.name}. (Roll: ${skillCheck.roll}/${skillPercent}%)`, "error");
          }
        }
        
        // Deduct action cost using standardized function (use skill cost if specified, otherwise use standard USE_SKILL cost)
        {
          const skillActionCost = selectedSkill.cost !== undefined ? selectedSkill.cost : getActionCost("USE_SKILL");
          setFighters(prev => prev.map(f => 
            f.id === currentFighter.id 
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - (skillActionCost === "all" ? f.remainingAttacks : skillActionCost)) }
              : f
          ));
        }
        
        // Clear selections
        setSelectedSkill(null);
    setSelectedTarget(null);
        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        scheduleEndTurn(1500);
        return;
      }
      
      case "Fly": {
        const result = startFlying(currentFighter, { altitude: 20 });
        if (result.success) {
          setFighters(prev => prev.map(f => 
            f.id === currentFighter.id ? result.fighter : f
          ));
          addLog(result.message, "info");
        } else {
          addLog(`❌ ${result.reason}`, "error");
        }
        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
      }

      case "Land": {
        const carried = currentFighter.carriedTargetId 
          ? fighters.find(f => f.id === currentFighter.carriedTargetId)
          : null;
        const result = landFighter(currentFighter, { controlledLanding: true, carriedTarget: carried });
        if (result.success) {
          setFighters(prev => prev.map(f => {
            if (f.id === currentFighter.id) return result.fighter;
            if (result.dropped && f.id === result.dropped.target.id) return result.dropped.target;
            return f;
          }));
          addLog(result.message, "info");
          if (result.dropped) {
            addLog(result.dropped.message, "warning");
          }
        } else {
          addLog(`❌ ${result.reason}`, "error");
        }
        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
      }

      case "Change Altitude": {
        // For now, use a simple prompt. In full implementation, show modal with ±5, ±10, ±20 options
        // Default to +10ft climb
        const deltaFeet = 10; // TODO: Add UI for altitude change amount
        const result = changeAltitude(currentFighter, deltaFeet);
        if (result.success) {
          setFighters(prev => prev.map(f => 
            f.id === currentFighter.id ? result.fighter : f
          ));
          addLog(result.message, "info");
        } else {
          addLog(`❌ ${result.reason}`, "error");
        }
        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
      }

      case "Dive Attack": {
        if (!targetToExecute) {
          addLog(`❌ ${currentFighter.name} must select a target for dive attack!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }

        // ✅ Only requirement: must be flying
        if (!isFlying(currentFighter)) {
          addLog(`❌ ${currentFighter.name} must be flying to perform a dive attack`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }

        const fromAlt = getAltitude(currentFighter) || 0;
        const toAlt = getAltitude(targetToExecute) || 0;

        // ✅ Dive Attack (player) should descend to contact altitude = targetAlt + 5 (still flying)
        const contactAlt = toAlt + 5;

        const updatedAttacker = {
          ...currentFighter,
          isFlying: true,
          altitudeFeet: contactAlt,
          altitude: contactAlt,
        };

        const drop = Math.max(0, fromAlt - contactAlt);
        const diveBonus = Math.min(4, Math.floor(drop / 10));

        setFighters(prev => prev.map(f => (f.id === updatedAttacker.id ? updatedAttacker : f)));

        addLog(`🦅 ${currentFighter.name} dives (${fromAlt}ft → ${contactAlt}ft) to strike ${targetToExecute.name}!`, "combat");

        attack(updatedAttacker, targetToExecute.id, {
          strikeBonus: diveBonus,
          source: "DIVE_ATTACK",
          diveFromFeet: fromAlt,
          diveToFeet: contactAlt,
        });

        return; // attack() handles endTurn
      }

      case "Dimensional Teleport": {
        if (!hasDimensionalTeleport(currentFighter)) {
          addLog(`❌ ${currentFighter.name} does not have dimensional teleport ability!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }

        // Teleport requires selecting a destination hex
        if (!selectedMovementHex || !showTacticalMap) {
          addLog(`❌ ${currentFighter.name} must select a destination hex on the tactical map to teleport!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }

        const currentPos = positions[currentFighter.id];
        if (!currentPos) {
          addLog(`❌ Cannot find current position for ${currentFighter.name}!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }

        const result = attemptDimensionalTeleport(
          currentFighter,
          selectedMovementHex,
          currentPos,
          { maxRange: 500, log: addLog }
        );

        if (result.success) {
          // Move fighter to new position
          handlePositionChange(currentFighter.id, result.newPosition);
          
          // Deduct action cost (teleport costs 1-2 actions, using 1 for now)
          setFighters(prev => prev.map(f => 
            f.id === currentFighter.id 
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
              : f
          ));
          
          addLog(result.message, "info");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          scheduleEndTurn(500);
          return;
        } else {
          // Teleport failed - still costs an action
          setFighters(prev => prev.map(f => 
            f.id === currentFighter.id 
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
              : f
          ));
          
          addLog(`❌ ${result.reason}`, "warning");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          scheduleEndTurn(500);
          return;
        }
      }

      case "Lift & Carry": {
        if (!targetToExecute) {
          addLog(`❌ ${currentFighter.name} must select a grappled target to carry!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        const result = liftAndCarry(currentFighter, targetToExecute, { positions });
        if (result.success) {
          setFighters(prev => prev.map(f => {
            if (f.id === currentFighter.id) return result.carrier;
            if (f.id === targetToExecute.id) return result.carried;
            return f;
          }));
          // Sync positions
          const newPositions = syncCombinedPositions(fighters, positions);
          setPositions(newPositions);
          addLog(result.message, "info");
        } else {
          addLog(`❌ ${result.reason}`, "error");
        }
        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
      }

      case "Drop Target": {
        const carriedId = currentFighter.carriedTargetId;
        if (!carriedId) {
          addLog(`❌ ${currentFighter.name} is not carrying anyone!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        const carried = fighters.find(f => f.id === carriedId);
        if (!carried) {
          addLog(`❌ Cannot find carried target!`, "error");
          executingActionRef.current = false;
          clearTimeout(lockTimeout);
          return;
        }
        const result = dropCarriedTarget(currentFighter, carried, { height: getAltitude(currentFighter) || 0 });
        if (result.success) {
          setFighters(prev => prev.map(f => {
            if (f.id === currentFighter.id) return result.fighter;
            if (f.id === carried.id) return result.target;
            return f;
          }));
          addLog(result.message, "warning");
          if (result.fallDamage) {
            addLog(`💥 ${carried.name} takes fall damage!`, "combat");
          }
        } else {
          addLog(`❌ ${result.reason}`, "error");
        }
        executingActionRef.current = false;
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
      }

      default:
        addLog(`${currentFighter.name} performs ${actionToExecute.name}.`, "info");
        // Decrement action and end turn for any unhandled action
        setFighters(prev => prev.map(f => 
          f.id === currentFighter.id 
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
            : f
        ));
        executingActionRef.current = false; // Clear lock after action completes
        clearTimeout(lockTimeout);
        scheduleEndTurn(500);
        return;
    }

    // Clear selections - most actions return early, but this is a fallback
    // (Should not reach here due to returns above)
  }


  function resetCombat() {
    try {
      // ✅ Reset per-combat AI refs (prevents stale behavior after multiple resets)
      resetAITransientRefs();

      // Reset closed distances when combat ends
      if (combatStateRef.current) {
        resetClosedDistances(combatStateRef.current);
      }
      
      setFighters(prev => prev.map(f => {
        // Use resetGrapple to reset grapple state for each fighter
        const fighterCopy = { ...f };
        resetGrapple(fighterCopy);
        
        // Reset stamina/fatigue state
        if (fighterCopy.fatigueState) {
          resetFatigue(fighterCopy);
        } else {
          // Initialize fatigue state if it doesn't exist
          fighterCopy.fatigueState = initializeCombatFatigue(fighterCopy);
        }
        
        // Reset ISP and PPE to max values (always reset, even if 0)
        // Re-initialize PPE for creatures with magicAbilities if it's missing or 0
        if ((!fighterCopy.PPE || fighterCopy.PPE === 0) && fighterCopy.magicAbilities) {
          // Check if this is Wizard (Invocation) magic - use fullList for unrestricted access
          const isWizardMagic = fighterCopy.magicAbilities && typeof fighterCopy.magicAbilities === "string" &&
            /spell\s+magic|wizard\s+magic|invocation\s+magic|invocation/i.test(fighterCopy.magicAbilities.toLowerCase());
          
          const spellResult = getSpellsForCreature(fighterCopy.magicAbilities, {
            fullList: isWizardMagic, // Full list for Wizard magic
            includeNonCombat: true   // Include all spells
          });
          
          if (spellResult.spells.length > 0) {
            // Convert to combat spell format
            const allSpells = spellResult.spells.map(spell => ({
              name: spell.name,
              cost: spell.ppeCost || spell.cost || 10,
              damage: spell.damage || spell.combatDamage || "",
              effect: spell.description || "",
              level: spell.level || 1,
              range: spell.range || "100ft",
            }));
            
            // For Wizard magic: store full list in spellbook
            if (isWizardMagic || spellResult.unrestricted) {
              fighterCopy.spellbook = allSpells; // Full catalog
              const combatSpells = allSpells.filter(s => s.damage && s.damage !== "0" && s.damage !== "");
              fighterCopy.magic = combatSpells.slice(0, 20); // Top 20 combat spells for quick access
              // Set unrestricted flag for getFighterSpells to detect
              fighterCopy.unrestricted = true;
              fighterCopy.magicProfile = { isWizardMagic: true, unrestricted: true };
            } else {
              fighterCopy.magic = allSpells;
            }
          }
          
          if (spellResult.ppe > 0) {
            fighterCopy.PPE = spellResult.ppe; // Use parser's PPE calculation
            addLog(`🔮 ${fighterCopy.name} PPE re-initialized to ${spellResult.ppe} from magicAbilities on combat reset.`, "info");
          } else {
            // Fallback to simple calculation if parser fails
            const magicText = typeof fighterCopy.magicAbilities === "string" 
              ? fighterCopy.magicAbilities.toLowerCase() 
              : "";
            const levelMatch = magicText.match(/levels?\s+(\d+)[-\s]+(\d+)/);
            const maxLevel = levelMatch ? parseInt(levelMatch[2]) : 5;
            fighterCopy.PPE = maxLevel * 20;
          }
        }
        
        const maxISP = fighterCopy.ISP !== undefined ? fighterCopy.ISP : 0;
        const maxPPE = fighterCopy.PPE !== undefined ? fighterCopy.PPE : 0;
        fighterCopy.currentISP = maxISP;
        fighterCopy.currentPPE = maxPPE;
        
        // Reset altitude (flying creatures should start grounded)
        fighterCopy.altitude = 0;
        fighterCopy.altitudeFeet = 0;
        fighterCopy.isFlying = false;
        
        // Reset morale state
        if (fighterCopy.moraleState) {
          fighterCopy.moraleState = {
            ...fighterCopy.moraleState,
            status: "STEADY",
            failedChecks: 0,
          };
        }
        
        // Clear status effects (ROUTED, etc.)
        if (Array.isArray(fighterCopy.statusEffects)) {
          fighterCopy.statusEffects = fighterCopy.statusEffects.filter(
            effect => effect !== "ROUTED" && effect !== "SURRENDERED"
          );
        }
        
        // Reset meta (horror checks, initiative penalties, etc.)
        if (fighterCopy.meta) {
          const newMeta = { ...fighterCopy.meta };
          delete newMeta.horrorChecks;
          delete newMeta.horrorInitPenalty;
          delete newMeta.horrorFailedRound;
          fighterCopy.meta = Object.keys(newMeta).length > 0 ? newMeta : undefined;
        }
        
        return {
          ...fighterCopy,
          currentHP: f.maxHP || f.HP || f.hp || 30,
          status: "active",
          initiative: 0,
          remainingAttacks: f.attacksPerMelee || 2,
        };
      }));
      
      setTurnIndex(0);
      setMeleeRound(1);
      setTurnCounter(0);
      setCombatActive(false);
      setCombatPaused(false);
      lastAutoTurnKeyRef.current = null;
      processingEnemyTurnRef.current = false;
      processingPlayerAIRef.current = false;
      combatEndCheckRef.current = false;
      setLog([]);
      setDiceRolls([]);
      setSelectedParty([]);
      setSelectedAttack(0); // Reset attack selection
      setPsionicsMode(false); // Reset psionics mode
      setSpellsMode(false); // Reset spells mode
      setClericalAbilitiesMode(false); // Reset clerical abilities mode
      setSelectedClericalAbility(null); // Clear selected clerical ability
      setVisibleCells([]);
      setExploredCells(resetFogMemory());
      setSelectedTarget(null);
      addLog("Combat reset! Fog of war memory cleared.", "info");
    } catch (error) {
      console.error("Error resetting combat:", error);
      addLog(`Error resetting combat: ${error.message}`, "error");
    }
  }

  // Weapon management functions
  function handleChangeWeapon(fighterId, slotIndex) {
    setSelectedWeaponSlot({ fighterId, slotIndex });
    setShowWeaponModal(true);
  }


  function confirmWeaponChange(weaponName) {
    if (!selectedWeaponSlot) return;
    
    setFighters(prev => prev.map(fighter => {
      if (fighter.id === selectedWeaponSlot.fighterId) {
        // Handle "Unarmed" selection
        if (weaponName === "Unarmed") {
          const updatedWeapons = [...(fighter.equippedWeapons || [])];
          updatedWeapons[selectedWeaponSlot.slotIndex] = {
            name: "Unarmed",
            damage: "1d3",
            type: "unarmed",
            category: "unarmed",
            weight: 0,
            price: 0,
            slot: selectedWeaponSlot.slotIndex === 0 ? "Right Hand" : "Left Hand"
          };
          
          return {
            ...fighter,
            equippedWeapons: updatedWeapons,
            equippedWeapon: updatedWeapons[0]?.name || "Unarmed"
          };
        }
        
        // Find the weapon in the character's original inventory
        const originalWeapon = fighter.inventory?.find(item => 
          item.name === weaponName && (item.type === "weapon" || item.type === "Weapon" || item.category === "Weapons")
        );
        
        if (!originalWeapon) {
          addLog(`❌ ${weaponName} not found in ${fighter.name}'s inventory`, "error");
          return fighter;
        }
        
        // Check if weapon is two-handed
        const twoHanded = isTwoHandedWeapon(originalWeapon);
        
        // Check if weapon is already equipped in the other hand
        const otherHandIndex = selectedWeaponSlot.slotIndex === 0 ? 1 : 0;
        const otherHandWeapon = fighter.equippedWeapons?.[otherHandIndex];
        
        if (otherHandWeapon?.name === weaponName) {
          // Swap weapons between hands
          const updatedWeapons = [...(fighter.equippedWeapons || [])];
          updatedWeapons[selectedWeaponSlot.slotIndex] = {
            name: originalWeapon.name,
            damage: originalWeapon.damage || "1d4",
            type: originalWeapon.type || "weapon",
            category: originalWeapon.category || "one-handed",
            weight: originalWeapon.weight || 3,
            price: originalWeapon.price || 6,
            slot: selectedWeaponSlot.slotIndex === 0 ? "Right Hand" : "Left Hand",
            twoHanded: twoHanded
          };
          updatedWeapons[otherHandIndex] = {
            name: "Unarmed",
            damage: "1d3",
            type: "unarmed",
            category: "unarmed",
            weight: 0,
            price: 0,
            slot: otherHandIndex === 0 ? "Right Hand" : "Left Hand"
          };
          
          addLog(`🔄 ${fighter.name} swapped ${weaponName} to ${selectedWeaponSlot.slotIndex === 0 ? "Right" : "Left"} Hand`, "info");
          
          return {
            ...fighter,
            equippedWeapons: updatedWeapons,
            equippedWeapon: updatedWeapons[0]?.name || "Unarmed"
          };
        }
        
        // Normal weapon change
        const updatedWeapons = [...(fighter.equippedWeapons || [])];
        updatedWeapons[selectedWeaponSlot.slotIndex] = {
          name: originalWeapon.name,
          damage: originalWeapon.damage || "1d4",
          type: originalWeapon.type || "weapon",
          category: originalWeapon.category || "one-handed",
          weight: originalWeapon.weight || 3,
          price: originalWeapon.price || 6,
          slot: selectedWeaponSlot.slotIndex === 0 ? "Right Hand" : "Left Hand",
          twoHanded: twoHanded
        };
        
        // If two-handed weapon, clear the other hand
        if (twoHanded) {
          updatedWeapons[otherHandIndex] = {
            name: "— Occupied by Two-Handed Weapon —",
            damage: "—",
            type: "disabled",
            category: "disabled",
            weight: 0,
            price: 0,
            slot: otherHandIndex === 0 ? "Right Hand" : "Left Hand",
            disabled: true
          };
          addLog(`⚔️ ${fighter.name} equipped ${weaponName} (Two-Handed weapon)`, "info");
        } else {
          // If equipping to right hand and left hand is occupied by two-handed, clear it
          if (selectedWeaponSlot.slotIndex === 0 && updatedWeapons[1]?.disabled) {
            updatedWeapons[1] = {
              name: "Unarmed",
              damage: "1d3",
              type: "unarmed",
              category: "unarmed",
              weight: 0,
              price: 0,
              slot: "Left Hand"
            };
          }
        }
        
        return {
          ...fighter,
          equippedWeapons: updatedWeapons,
          equippedWeapon: updatedWeapons[0]?.name || "Unarmed"
        };
      }
      return fighter;
    }));
    
    setShowWeaponModal(false);
    setSelectedWeaponSlot(null);
  }

  function removeFighter(fighterId) {
    setFighters(prev => prev.filter(f => f.id !== fighterId));
    addLog(`Removed fighter from combat.`, "info");
  }

  function changeFighterSide(fighterId, newSide) {
    if (newSide !== "player" && newSide !== "enemy") {
      return;
    }

    const fighter = fighters.find(f => f.id === fighterId);

    setFighters(prev => prev.map(f => (
      f.id === fighterId ? { ...f, type: newSide } : f
    )));

    if (fighter && fighter.type !== newSide) {
      const sideLabel = newSide === "enemy" ? "enemy forces" : "party side";
      addLog(`🔄 ${fighter.name} reassigned to ${sideLabel}.`, "info");
    }
  }

  const selectParty = useCallback((party) => {
    console.log(`[selectParty] Called with ${party.length} characters:`, party.map(c => c.name));
    
    // Set selectedParty FIRST and ensure it persists (synchronously, outside transition)
    // This ensures the party selection is immediately visible even if heavy computation is deferred
    setSelectedParty([...party]); // Create a new array to ensure React detects the change
    
    // Close modal AFTER state is set
    onPartyClose();
    setShowPartySelector(false); // Ensure showPartySelector is also closed
    
    // Process characters and create fighters
    // CRITICAL: We need to create fighters and set them immediately, not defer with startTransition
    // startTransition was causing the state update to be deferred indefinitely
    console.log(`[selectParty] Processing ${party.length} characters (synchronously)`);
    const characterFighters = party.map(char => {
      // Use autoEquipWeapons to ensure weapons are properly equipped from inventory
      const updatedChar = autoEquipWeapons(char);
      
      // Use equipped weapons from database if available, otherwise use auto-equipped weapons
      let equippedWeaponName = "Unarmed";
      let equippedWeapons = updatedChar.equippedWeapons || char.equippedWeapons || [
        // Right Hand (index 0) - Start with Unarmed
        {
          name: "Unarmed",
          damage: "1d3",
          type: "unarmed",
          category: "unarmed",
          weight: 0,
          price: 0,
          slot: "Right Hand"
        },
        // Left Hand (index 1) - Start with Unarmed
        {
          name: "Unarmed",
          damage: "1d3",
          type: "unarmed",
          category: "unarmed",
          weight: 0,
          price: 0,
          slot: "Left Hand"
        }
      ];
      
      // Get the primary weapon name for legacy support
      if (equippedWeapons.length > 0 && equippedWeapons[0].name !== "Unarmed") {
        equippedWeaponName = equippedWeapons[0].name;
      }
      
      // Use updated character's equipped object if available (for future use)
      // const equipped = updatedChar.equipped || char.equipped || {};
      
      console.log(`🔍 ${char.name} equipped weapons from database:`, equippedWeapons);
      
      // Get HP - prioritize derived stats from level-up system, then stored HP, then calculate
      const peBonus = Math.floor((char.attributes?.PE || char.PE || 10) / 4);
      const level = char.level || 1;
      const occCategory = char.occCategory || "Men of Arms"; // Default category
      const characterHP = char.derived?.hitPoints || char.hp || char.HP || calculateTotalHP(occCategory, level, peBonus);
      
      // Get combat bonuses from derived/occBonuses if available
      const combatBonuses = char.derived?.occBonuses || char.occBonuses || {};
      const attacksPerMelee = char.derived?.attacksPerMelee || char.attacksPerMelee;
      
      const unified = getUnifiedAbilities(char);
      const derivedSpells = unified?.magic?.knownSpells || [];
      let magicSpells = Array.isArray(char.magic) ? [...char.magic] : [];
      
      // Debug logging for wizards
      const isWizardChar = (char.OCC || char.occ || char.class || "").toLowerCase().includes("wizard");
      if (isWizardChar && import.meta.env.DEV) {
        const magicAbilities = Array.isArray(char.abilities) ? char.abilities.filter(a => a.type === "magic" || a.type === "spell") : [];
        console.log(`🔮 [selectParty] Converting ${char.name} (Wizard):`);
        console.log(`  - magic:`, char.magic, `(length: ${char.magic?.length || 0})`);
        console.log(`  - abilities:`, char.abilities, `(length: ${char.abilities?.length || 0})`);
        console.log(`  - magicAbilities:`, magicAbilities, `(length: ${magicAbilities.length})`);
        console.log(`  - unified:`, unified);
        console.log(`  - derivedSpells:`, derivedSpells, `(length: ${derivedSpells.length})`);
        if (magicAbilities.length > 0) {
          console.log(`  - First magic ability:`, JSON.stringify(magicAbilities[0], null, 2));
        }
      }
      
      // If no spells in magic array, check abilities array for spells with type: "magic"
      if (magicSpells.length === 0 && Array.isArray(char.abilities)) {
        const magicAbilities = char.abilities.filter(a => {
          const type = a.type?.toLowerCase();
          return type === "magic" || type === "spell" || (a.name && a.name.toLowerCase().startsWith("spell:"));
        });
        if (magicAbilities.length > 0) {
          if (isWizardChar && import.meta.env.DEV) {
            console.log(`🔮 [selectParty] Found ${magicAbilities.length} magic abilities for ${char.name}, converting to spells...`);
            console.log(`🔮 [selectParty] Magic abilities:`, JSON.stringify(magicAbilities, null, 2));
          }
          magicSpells = magicAbilities.map(ability => {
            // Convert ability to spell format
            const spellName = ability.name?.replace(/^Spell: /i, "") || ability.name;
            // Try to extract cost from various fields
            const cost = ability.cost || ability.ppeCost || ability.value || 10; // Default PPE cost if not specified
            const converted = {
              name: spellName,
              cost: typeof cost === "number" ? cost : (typeof cost === "string" ? parseInt(cost) || 10 : 10),
              damage: ability.damage || "",
              effect: ability.effect || "",
              type: "magic",
              source: "abilities"
            };
            if (isWizardChar && import.meta.env.DEV) {
              console.log(`🔮 [selectParty] Converted ability to spell:`, JSON.stringify(ability, null, 2), '→', JSON.stringify(converted, null, 2));
            }
            return converted;
          });
        } else if (isWizardChar && import.meta.env.DEV) {
          console.log(`🔮 [selectParty] No magic abilities found in abilities array for ${char.name}`);
          if (Array.isArray(char.abilities) && char.abilities.length > 0) {
            console.log(`🔮 [selectParty] Sample abilities (first 3):`, JSON.stringify(char.abilities.slice(0, 3), null, 2));
          }
        }
      }
      
      // Also check unified abilities
      if (magicSpells.length === 0 && derivedSpells.length > 0) {
        if (isWizardChar && import.meta.env.DEV) {
          console.log(`🔮 [selectParty] Using ${derivedSpells.length} derived spells from unified abilities for ${char.name}`);
        }
        magicSpells = derivedSpells
          .map(convertUnifiedSpellToCombatSpell)
          .filter(Boolean);
      }
      
      // If still no spells, load from spell database for wizards
      if (magicSpells.length === 0 && isWizardChar) {
        try {
          const wizardLevel = char.level || 1;
          const availableSpells = getSpellsForLevel(wizardLevel);
          
          // Take a reasonable number of spells (e.g., 5-10 spells for a level 15 wizard)
          const numSpells = Math.min(Math.max(5, Math.floor(wizardLevel / 2)), availableSpells.length);
          const selectedSpells = availableSpells.slice(0, numSpells);
          
          magicSpells = selectedSpells.map(spell => ({
            name: spell.name,
            cost: spell.ppeCost || 10,
            damage: spell.damage || "",
            effect: spell.description || "",
            range: spell.range || "",
            level: spell.level || 1,
            type: "magic",
            source: "spellDatabase"
          }));
          
          if (import.meta.env.DEV) {
            console.log(`🔮 [selectParty] Loaded ${magicSpells.length} spells from spell database for ${char.name} (level ${wizardLevel})`);
            console.log(`🔮 [selectParty] Loaded spells:`, magicSpells.map(s => s.name).join(', '));
          }
        } catch (error) {
          console.error(`🔮 [selectParty] Error loading spells from database for ${char.name}:`, error);
        }
      }
      
      if (isWizardChar && import.meta.env.DEV) {
        console.log(`🔮 [selectParty] Final magicSpells for ${char.name}:`, magicSpells.length, 'spells');
        if (magicSpells.length > 0) {
          console.log(`🔮 [selectParty] Spell names:`, magicSpells.map(s => s.name).join(', '));
        }
      }

      const existingPPE = typeof char.PPE === "number" ? char.PPE : 0;
      const derivedPPE =
        (unified?.magic?.maxPPE ?? unified?.energy?.PPE ?? 0);
      let PPEValue = existingPPE > 0 ? existingPPE : derivedPPE;
      
      // If wizard has spells but no PPE, give them a default amount based on level
      // Default: 10 PPE per level, minimum 20 PPE for level 1-2, max 200 PPE
      if (magicSpells.length > 0 && PPEValue === 0) {
        const wizardLevel = char.level || 1;
        PPEValue = Math.min(Math.max(20, wizardLevel * 10), 200);
        if (import.meta.env.DEV) {
          console.log(`🔮 [selectParty] Wizard ${char.name} has spells but no PPE - initializing to ${PPEValue} PPE (level ${wizardLevel})`);
        }
      }
      
      const currentPPEValue =
        typeof char.currentPPE === "number"
          ? char.currentPPE
          : PPEValue; // Always set currentPPE to PPEValue if not explicitly set
      
      const fighter = {
        ...char,
        id: `player-${char._id}-${generateCryptoId()}`,
        type: "player", // Ensure type is explicitly set to "player" (overrides any type from char)
        currentHP: characterHP,
        maxHP: characterHP,
        initiative: 0,
        status: "active",
        equippedWeapon: equippedWeaponName,
        equippedWeapons: equippedWeapons,
        weapon: equippedWeaponName, // For backward compatibility
        // Preserve bonuses from character
        bonuses: combatBonuses,
        occBonuses: combatBonuses,
        attacksPerMelee: attacksPerMelee,
        // Preserve derived stats if they exist
        derived: char.derived,
        // Preserve psionics and magic data
        psionicPowers: char.psionicPowers || [],
        magic: magicSpells,
        ISP: char.ISP || 0,
        PPE: PPEValue,
        currentPPE: currentPPEValue, // Always set currentPPE
        // Add attacks array for combat (equipped weapon or unarmed)
        attacks: [{
          name: equippedWeaponName,
          damage: equippedWeapons[0]?.damage || "1d3",
          type: (equippedWeapons[0]?.type === "unarmed" || !equippedWeapons[0]) ? "melee" : "melee"
        }],
        
        // Initialize altitude for all fighters (starts at 0 = grounded)
        // Altitude is tracked in 5ft increments, similar to hex distances
        altitude: char.altitude || 0,
        altitudeFeet: char.altitudeFeet || char.altitude || 0,
      };

        // Apply size modifiers to fighter
        const fighterWithSizeMods = applySizeModifiers(fighter);
        
        // Initialize altitude for flying creatures (starts at 0 = grounded)
        // Altitude is tracked in 5ft increments, similar to hex distances
        if (!fighterWithSizeMods.altitude && !fighterWithSizeMods.altitudeFeet) {
          fighterWithSizeMods.altitude = 0;
          fighterWithSizeMods.altitudeFeet = 0;
        }
        
        // Normalize IDs to ensure both id and _id exist for backwards compatibility
        return normalizeFighterId(fighterWithSizeMods);
      });
      
      // Replace existing player fighters with new party, keep enemies
      // CRITICAL: Use functional update to access current fighters state (prev)
      console.log(`[selectParty] About to setFighters with ${characterFighters.length} character fighters`);
      console.log(`[selectParty] Character fighters details:`, 
        characterFighters.map(f => ({ name: f.name, type: f.type, id: f.id })));
      
      setFighters(prev => {
        const existingEnemies = prev.filter(f => f.type === "enemy");
        const newFighters = [...characterFighters, ...existingEnemies];
        
        // Debug: Log fighter types to verify they're set correctly
        console.log(`[selectParty] setFighters callback - Added ${characterFighters.length} player fighters:`, 
          characterFighters.map(f => ({ name: f.name, type: f.type, id: f.id })));
        console.log(`[selectParty] setFighters callback - Total fighters: ${newFighters.length} (${newFighters.filter(f => f.type === "player").length} players, ${newFighters.filter(f => f.type === "enemy").length} enemies)`);
        console.log(`[selectParty] setFighters callback - Player fighter types check:`, newFighters.filter(f => f.type === "player").map(f => ({ name: f.name, type: f.type })));
        
        return newFighters;
      });
      console.log(`[selectParty] setFighters called (state update scheduled)`);
      
      // Note: selectedParty was already set synchronously before startTransition
      // No need to set it again here - it should already be persisted
      
      addLog(`Selected party: ${party.map(c => c.name).join(", ")}`, "info");
      
      // Debug: Log psionics and magic data for each character
      characterFighters.forEach(fighter => {
        if (fighter.psionicPowers && fighter.psionicPowers.length > 0) {
          addLog(`🧠 ${fighter.name} has ${fighter.psionicPowers.length} psionic powers (ISP: ${fighter.ISP})`, "info");
        }
        if (fighter.magic && fighter.magic.length > 0) {
          addLog(`🔮 ${fighter.name} has ${fighter.magic.length} spells (PPE: ${fighter.PPE})`, "info");
        }
      });
      
      // Log weapon equipping status
      characterFighters.forEach(fighter => {
        if (fighter.equippedWeapon !== "Unarmed") {
          addLog(`⚔️ ${fighter.name} auto-equipped ${fighter.equippedWeapon}!`, "info");
        } else {
          addLog(`⚠️ ${fighter.name} has no weapons - using unarmed attacks`, "warning");
        }
      });
  }, [onPartyClose, addLog, autoEquipWeapons, getUnifiedAbilities, applySizeModifiers, generateCryptoId, calculateTotalHP, setFighters, setSelectedParty, normalizeFighterId]);

  // Initialize positions ONLY when combat starts (after startCombat is called)
  // Positions are NOT set until combat begins to prevent showing fighters on map prematurely

  // Check for combat end conditions (reduced to prevent duplicate checks - primary check is in attack function)
  useEffect(() => {
    if (combatActive && activeFighters.length > 0 && !combatEndCheckRef.current) {
      // Only do a delayed check if combat end hasn't been triggered yet
      const checkCombatEnd = () => {
        // Skip if already checked
        if (combatEndCheckRef.current || !combatActive) return;
        
        // Use alivePlayers and aliveEnemies for combat end checks
        const consciousPlayers = alivePlayers.filter(f => canFighterAct(f));
        const consciousEnemies = aliveEnemies.filter(f => canFighterAct(f));
        
        if (consciousPlayers.length === 0) {
          // All players are either dead or unconscious - enemies win
          combatEndCheckRef.current = true;
          combatOverRef.current = true; // ✅ AUTHORITATIVE: Stop all further actions (defeat)
          addLog("💀 All players are defeated! Enemies win!", "defeat");
          setCombatActive(false);
          
          // ✅ CRITICAL: Clear ALL pending timeouts to stop post-defeat actions
          if (turnTimeoutRef.current) {
            clearTimeout(turnTimeoutRef.current);
            turnTimeoutRef.current = null;
          }
          allTimeoutsRef.current.forEach(clearTimeout);
          allTimeoutsRef.current = [];
        } else if (consciousEnemies.length === 0) {
          // All enemies are either dead or unconscious - players win
          combatEndCheckRef.current = true;
          combatOverRef.current = true; // ✅ AUTHORITATIVE: Set combat over flag
          addLog("🎉 Victory! All enemies defeated!", "victory");
          setCombatActive(false);
          
          // ✅ CRITICAL: Clear ALL pending timeouts to stop post-victory actions
          if (turnTimeoutRef.current) {
            clearTimeout(turnTimeoutRef.current);
            turnTimeoutRef.current = null;
          }
          allTimeoutsRef.current.forEach(clearTimeout);
          allTimeoutsRef.current = [];
        }
      };
      
      // Delay the check to allow for state updates to complete
      setTimeout(checkCombatEnd, 500);
    }
  }, [fighters, combatActive, turnIndex, alivePlayers, aliveEnemies, canFighterAct, addLog]); // Check on turn changes

  // Update visible cells for fog of war (optimized for performance)
  // ✅ Enhanced to account for altitude when fog is enabled
  const updateVisibleCells = useCallback(() => {
    if (!fogEnabled || !fighters || !positions || Object.keys(positions).length === 0) {
      setVisibleCells([]);
      return;
    }

    // Get all player positions with altitude
    const playerFighters = fighters.filter(f => f.type === "player" && positions[f.id]);
    if (playerFighters.length === 0) {
      setVisibleCells([]);
      return;
    }

    // Get visibility range from scene setup (computed in Phase0PreCombatModal)
    // This includes terrain and lighting modifiers, or fallback to lighting-based calculation
    const lighting = combatTerrain?.lighting || "BRIGHT_DAYLIGHT";
    const baseRange = combatTerrain?.visibilityRange || getVisibilityRange(lighting, false, null);
    
    // ✅ Extract terrain obstacles from terrain data if available (default empty)
    const terrainObstaclesList = combatTerrain?.obstacles || []; // Empty by default for open arena
    
    // ✅ Calculate visible cells for all players (union), accounting for altitude
    const observerPositions = playerFighters.map(f => {
      const pos = positions[f.id];
      const altitude = f.altitudeFeet || f.altitude || 0;
      return { ...pos, altitude }; // Include altitude in position
    }).filter(pos => pos && pos.x !== undefined && pos.y !== undefined);
    
    if (observerPositions.length === 0) {
      setVisibleCells([]);
      return;
    }
    
    // ✅ Get all fighter positions with altitude for fog calculation
    const allFighterPositions = new Map();
    fighters.forEach(f => {
      if (positions[f.id]) {
        const altitude = f.altitudeFeet || f.altitude || 0;
        allFighterPositions.set(f.id, { ...positions[f.id], altitude });
      }
    });
    
    // Use requestAnimationFrame to batch DOM updates and avoid blocking
    requestAnimationFrame(() => {
      let visible;
      
      // Optimize: Use calculateVisibleCells for single observer, calculateVisibleCellsMultiple for multiple
      if (observerPositions.length === 1) {
        // Single observer - use calculateVisibleCells directly for better performance
        visible = calculateVisibleCells(observerPositions[0], baseRange, {
          terrain: combatTerrain || { lighting, mapType: "hex" },
          lighting: lighting,
          hasInfravision: false, // TODO: Check player abilities for infravision
          isProwling: false, // TODO: Check if player is successfully prowling
          terrainObstacles: terrainObstaclesList,
          mapType: combatTerrain?.mapType || "hex",
          observerAltitude: observerPositions[0].altitude || 0, // ✅ Pass altitude
          fighterPositions: allFighterPositions, // ✅ Pass all fighter positions with altitude
        });
      } else {
        // Multiple observers - use calculateVisibleCellsMultiple to combine visibility
        visible = calculateVisibleCellsMultiple(observerPositions, baseRange, {
          terrain: combatTerrain || { lighting, mapType: "hex" },
          lighting: lighting,
          hasInfravision: false, // TODO: Check player abilities for infravision
          isProwling: false, // TODO: Check if player is successfully prowling
          terrainObstacles: terrainObstaclesList,
          mapType: combatTerrain?.mapType || "hex",
          fighterPositions: allFighterPositions, // ✅ Pass all fighter positions with altitude
        });
      }
      
      // Debug logging (only in development)
      if ((import.meta.env?.DEV || import.meta.env?.MODE === 'development') && visible.length > 0) {
        console.log(`[Fog of War] Calculated ${visible.length} visible cells from ${observerPositions.length} observer(s)`, {
          observerPositions,
          baseRange,
          lighting,
          sampleCells: visible.slice(0, 5)
        });
      }

      // Update fog memory with newly visible cells
      const updatedExplored = updateFogMemory(exploredCells, visible);
      setExploredCells(updatedExplored);
      setVisibleCells(visible);
    });
  }, [fogEnabled, combatTerrain, fighters, positions, exploredCells]);

  // Update visible cells when positions change or fog is toggled
  useEffect(() => {
    // Allow fog to work even when combat isn't active (for setup/preview)
    if (fogEnabled && fighters.length > 0 && positions && Object.keys(positions).length > 0) {
      // Use requestAnimationFrame to defer heavy calculations and avoid blocking
      const frameId = requestAnimationFrame(() => {
        // Use a small timeout to batch multiple updates
        const timer = setTimeout(() => {
          updateVisibleCells();
        }, 50);
        return () => clearTimeout(timer);
      });
      return () => {
        cancelAnimationFrame(frameId);
      };
    } else if (!fogEnabled) {
      setVisibleCells([]); // Clear visible cells when fog disabled
      setExploredCells([]); // Clear explored cells when fog disabled
    }
  }, [positions, fogEnabled, combatActive, combatTerrain, fighters, updateVisibleCells]);

  const getLogColor = (type) => {
    switch (type) {
      case "hit": return "green.600";
      case "critical": return "red.600";
      case "miss": return "orange.600";
      case "defeat": return "red.700";
      case "victory": return "green.700";
      case "info": return "blue.600";
      case "combat": return "purple.600";
      case "initiative": return "purple.500";
      case "success": return "green.500";
      case "error": return "red.500";
      default: return "gray.600";
    }
  };

  // Auto-scroll top combat log to show most recent entry
  useEffect(() => {
    if (topCombatLogRef.current && log.length > 0) {
      // Scroll to top to show most recent entry (newest entries are at the beginning of the array)
      topCombatLogRef.current.scrollTop = 0;
    }
  }, [log]);

  // Auto-scroll detailed combat log to show most recent entry
  useEffect(() => {
    if (detailedCombatLogRef.current && log.length > 0 && logSortOrder === "newest") {
      // Scroll to top to show most recent entry (newest entries are at the beginning of the array)
      detailedCombatLogRef.current.scrollTop = 0;
    }
  }, [log, logSortOrder]);

  return (
    <Box
      px={{ base: 3, md: 4 }}
      py={{ base: 3, md: 4 }}
      maxW="100%"
      w="100%"
      mx="auto"
    >
      {/* Navigation Bar with Hamburger Menu */}
      <Flex align="center" justify="space-between" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="xl">⚔️ Combat Arena</Heading>
          {selectedParty.length > 0 && (
            <Text fontSize="sm" color="gray.600">
              Party: {selectedParty.map(c => c.name).join(", ")} ({selectedParty.length} members)
            </Text>
          )}
        </VStack>
        <Spacer />
        <HStack spacing={2}>
          <Menu>
            <MenuButton
              as={Button}
              aria-label="Help menu"
              variant="outline"
              colorScheme="green"
              mr={3}
            >
              ❓ Help
            </MenuButton>
            <MenuList>
              <MenuItem onClick={() => alert('Combat Help:\n\n1. Click on characters in the map to select them\n2. Use the Combat Options menu to select actions\n3. Click "Move" button to activate movement mode\n4. Click colored hexes to move characters\n5. Use Strike, Parry, Dodge, and other actions from the dropdown')}>
                📖 Combat Guide
              </MenuItem>
              <MenuItem onClick={() => alert('Movement Help:\n\n- Green hexes: 1 action (15s)\n- Yellow hexes: 2 actions (30s)\n- Orange hexes: 3 actions (45s)\n- Red hexes: 4 actions (60s)\n\nClick "Move" in Combat Options to activate movement mode, then click a colored hex to move.')}>
                🚶 Movement Guide
              </MenuItem>
              <MenuItem onClick={() => alert('Actions:\n\n- Strike: Attack with equipped weapon\n- Parry: Defend against melee attacks\n- Dodge: Avoid attacks\n- Run: Move quickly\n- Use Skill: Perform a skill check\n- And more...')}>
                ⚔️ Actions Guide
              </MenuItem>
            </MenuList>
          </Menu>
        <Menu>
          <MenuButton
            as={Button}
            aria-label="Navigation menu"
            variant="outline"
            colorScheme="blue"
            mr={3}
          >
            ☰ Menu
          </MenuButton>
          <MenuList>
            <MenuItem onClick={() => navigate('/')}>
              🏠 Home
            </MenuItem>
            <MenuItem onClick={() => navigate('/character-list')}>
              👥 Characters
            </MenuItem>
            <MenuItem onClick={() => navigate('/combat')}>
              ⚔️ Combat
            </MenuItem>
            <MenuItem onClick={() => navigate('/party-builder')}>
              👫 Party Builder
            </MenuItem>
            <MenuItem onClick={() => navigate('/trader-shop')}>
              🛒 Shop
            </MenuItem>
            <MenuItem onClick={() => navigate('/weapon-shop')}>
              ⚔️ Weapon Shop
            </MenuItem>
            <MenuItem onClick={() => navigate('/bestiary')}>
              👹 Bestiary
            </MenuItem>
          </MenuList>
        </Menu>
        </HStack>
        <HStack>
          {!combatActive && (
            <>
              <Button colorScheme="teal" onClick={() => setShowPhase0Modal(true)} isDisabled={fighters.length < 2}>
                🌲 Setup Scene
              </Button>
              {phase0Results && (
                <Badge colorScheme="teal" mr={2}>
                  Scene Ready
                </Badge>
              )}
              <Button colorScheme="green" onClick={() => startCombat()} isDisabled={fighters.length < 2}>
                ⚔️ Start Combat
              </Button>
            </>
          )}
          <Button colorScheme="purple" onClick={() => {
            startTransition(() => {
              onPartyOpen();
              setShowPartySelector(true);
            });
          }} isDisabled={combatActive}>
            Choose Party
          </Button>
          <Button colorScheme="blue" onClick={() => {
            startTransition(() => {
              onOpen();
            });
          }}>
            Add Enemy
          </Button>
          <Button colorScheme="red" onClick={() => {
            resetCombat();
          }}>
            Reset Combat
          </Button>
          <Button
            size="sm"
            colorScheme="blue"
            variant="outline"
            onClick={() =>
              setArenaSpeed((prev) =>
                prev === "slow" ? "normal" : prev === "normal" ? "fast" : "slow"
              )
            }
            title="Toggle combat pacing"
          >
            {arenaSpeed === "slow" ? "⏱️ Delay: 15s" : arenaSpeed === "fast" ? "⚡ Delay: 0.5s" : "⏲️ Delay: 1.5s"}
          </Button>
          
          {/* Fog of War Toggle */}
          <Button
            size="sm"
            colorScheme={fogEnabled ? "purple" : "gray"}
            variant={fogEnabled ? "solid" : "outline"}
            onClick={() => {
              const newFogState = !fogEnabled;
              
              // Update state immediately (non-blocking)
              setFogEnabled(newFogState);
              
              if (newFogState) {
                addLog("🌫️ Fog of War enabled - Hidden areas will be darkened", "info");
                // Defer heavy calculation to avoid blocking UI
                // Use requestIdleCallback if available for better performance
                if (window.requestIdleCallback) {
                  requestIdleCallback(() => {
                    if (fighters.length > 0 && positions && Object.keys(positions).length > 0) {
                      updateVisibleCells();
                    }
                  }, { timeout: 500 });
                } else {
                  // Fallback for browsers without requestIdleCallback
                  requestAnimationFrame(() => {
                    setTimeout(() => {
                      if (fighters.length > 0 && positions && Object.keys(positions).length > 0) {
                        updateVisibleCells();
                      }
                    }, 200);
                  });
                }
              } else {
                addLog("🌫️ Fog of War disabled - All areas visible", "info");
                // Clear immediately (fast operation)
                setVisibleCells([]);
                setExploredCells([]);
              }
            }}
            title={fogEnabled ? "Disable fog of war" : "Enable fog of war"}
          >
            {fogEnabled ? "🌫️ Fog ON" : "🌫️ Fog OFF"}
          </Button>

          <Button
            size="sm"
            colorScheme={combatPaused ? "yellow" : "gray"}
            variant={combatPaused ? "solid" : "outline"}
            onClick={() => {
              if (!combatActive) {
                addLog("⚠️ Combat is not active - nothing to pause.", "warning");
                return;
              }
              setCombatPaused((prev) => {
                const next = !prev;
                if (next) {
                  processingEnemyTurnRef.current = false;
                  processingPlayerAIRef.current = false;
                  lastProcessedEnemyTurnRef.current = null;
                  addLog("⏸️ Combat paused", "warning");
                } else {
                  addLog("▶️ Combat resumed", "info");
                }
                return next;
              });
            }}
            isDisabled={!combatActive}
            title={combatPaused ? "Resume combat" : "Pause combat"}
          >
            {combatPaused ? "▶️ Resume" : "⏸️ Pause"}
          </Button>
          
          {/* AI Control Toggle - Available before and during combat */}
          <Button
            size="sm"
            colorScheme={aiControlEnabled ? "purple" : "gray"}
            variant={aiControlEnabled ? "solid" : "outline"}
            onClick={() => {
              const newValue = !aiControlEnabled;
              setAiControlEnabled(newValue);
              if (newValue) {
                addLog("🤖 AI Control ENABLED - Players will be controlled by AI", "info");
              } else {
                addLog("🎮 Manual Control ENABLED - Players will control themselves", "info");
              }
            }}
            title={aiControlEnabled ? "Disable AI control - players will control themselves" : "Enable AI control - AI will control players"}
          >
            {aiControlEnabled ? "🤖 AI ON" : "🎮 Manual"}
          </Button>
          <Button
            size="sm"
            colorScheme="gray"
            variant="outline"
            onClick={() => setShowSettings(true)}
            title="Configure game settings (pain stagger, morale, insanity)"
          >
            ⚙️ Game Settings
          </Button>
        </HStack>
      </Flex>

      {/* Selected Character Info Box - Top of Screen */}
      {combatActive && (
        <Box mb={4}>
          <Alert status="info" variant="subtle">
            <AlertIcon />
            <VStack spacing={2} align="stretch" w="100%">
              <HStack spacing={4} justify="space-between" align="center" w="100%">
                {selectedCombatantId ? (() => {
                  const selectedFighter = fighters.find(f => f.id === selectedCombatantId);
                  const selectedPos = positions[selectedCombatantId];
                  return selectedFighter ? (
                    <>
                      <VStack spacing={0} align="start">
                        <Text fontSize="sm" fontWeight="bold" color="blue.600">
                          📍 Selected: {selectedFighter.name}
              </Text>
                        {selectedFighter.suppression?.isSuppressed &&
                          selectedFighter.suppression?.visibleThreat && (
                            <Badge colorScheme="orange" size="sm">
                              SUPPRESSED
                            </Badge>
                          )}
                        {selectedPos && (
                          <Text fontSize="xs" color="gray.600">
                            Position: ({selectedPos.x}, {selectedPos.y})
              </Text>
                        )}
                      </VStack>
                      {/* Center - Movement Instructions */}
                      <Box flex="1" textAlign="center" px={4}>
                        {!movementMode.active && (
                          <VStack spacing={0}>
                            <Text fontSize="xs" color="gray.600" fontStyle="italic">
                              Use Combat Options menu to move characters
                            </Text>
                            <Text fontSize="xs" color="blue.600" fontWeight="bold">
                              🚶 Click &quot;Move&quot; button to activate movement mode
                            </Text>
                          </VStack>
                        )}
            </Box>
                      <VStack spacing={0} align="end">
                        <Text fontSize="xs" color="gray.600">
                          {selectedFighter.type === "enemy" ? "🗡️ Enemy" : "🛡️ Player"}
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          HP: {selectedFighter.currentHP}/{selectedFighter.maxHP || "?"}
                        </Text>
                      </VStack>
                    </>
                  ) : null;
                })() : (
                  <>
                    <Box flex="1" textAlign="center" px={4}>
                      {!movementMode.active && (
                        <VStack spacing={0}>
                          <Text fontSize="xs" color="gray.600" fontStyle="italic">
                            Use Combat Options menu to move characters
                          </Text>
                          <Text fontSize="xs" color="blue.600" fontWeight="bold">
                            🚶 Click &quot;Move&quot; button to activate movement mode
                          </Text>
                        </VStack>
                      )}
              </Box>
                    <Text fontSize="xs" color="gray.500" fontStyle="italic">
                      No character selected - Click on a character in the map to select
                    </Text>
                  </>
              )}
            </HStack>
              
              {/* Combat Log Display - Single line with scrollbar */}
              <Box 
                ref={topCombatLogRef}
                w="100%" 
                borderTop="1px solid" 
                borderColor="blue.200" 
                pt={2}
                h="24px"
                overflowY="auto"
                overflowX="hidden"
                sx={{
                  '&::-webkit-scrollbar': {
                    width: '6px',
                    height: '6px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'transparent',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'blue.300',
                    borderRadius: '3px',
                  },
                  '&::-webkit-scrollbar-thumb:hover': {
                    background: 'blue.400',
                  },
                }}
              >
                {log.length === 0 ? (
                  <Text fontSize="xs" color="gray.500" fontStyle="italic" h="20px" lineHeight="20px">
                    Combat log will appear here...
                  </Text>
                ) : (
                  <VStack spacing={0.5} align="stretch">
                    {log.map((entry) => (
                      <Text 
                        key={entry.id}
                        fontSize="xs" 
                        color={getLogColor(entry.type)}
                        fontWeight="medium"
                        whiteSpace="nowrap"
                        h="20px"
                        lineHeight="20px"
                      >
                        [{entry.timestamp}] {entry.message}
                      </Text>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>
          </Alert>
        </Box>
      )}


      {/* Round/Turn Display - Only shown during active combat */}

      <ResizableLayout
        initialLeftWidth={350}
        initialRightWidth={350}
        minSidebarWidth={200}
        maxSidebarWidth={600}
        leftSidebar={
          <VStack align="start" spacing={4} h="full">
            {/* Party Members Panel */}
            <Heading size="md" color="blue.600">🏰 Party Members ({alivePlayers.length}/{fighters.filter(f => f.type === "player").length})</Heading>
            <Box w="100%" maxH="300px" overflowY="auto" border="2px solid" borderColor="blue.400" p={4} borderRadius="md" bg="blue.50">
              {fighters.filter(f => f.type === "player").length === 0 ? (
                <Box color="gray.500" textAlign="center" py={8}>
                  <VStack spacing={3}>
                    <Text fontWeight="bold">No party members selected</Text>
                    <Text fontSize="sm">Click &apos;Choose Party&apos; to select characters for combat</Text>
                    <Button colorScheme="blue" size="sm" onClick={() => { onPartyOpen(); setShowPartySelector(true); }}>
                      Choose Party
                    </Button>
                  </VStack>
                </Box>
              ) : (
                <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={3}>
                {fighters.filter(f => f.type === "player").map((fighter) => (
                  <GridItem key={fighter.id}>
                  <Box 
                    key={fighter.id} 
                    p={3} 
                    mb={2} 
                    border="2px solid" 
                    borderColor={
                      fighter.currentHP <= -21 ? "black" : 
                      fighter.currentHP <= -11 ? "purple.400" : 
                      fighter.currentHP <= -1 ? "orange.400" : 
                      fighter.currentHP === 0 ? "yellow.400" : 
                      fighter.id === currentFighter?.id ? "yellow.400" : "blue.400"
                    }
                    borderRadius="md"
                    bg={
                      fighter.currentHP <= -21 ? "gray.800" : 
                      fighter.currentHP <= -11 ? "purple.100" : 
                      fighter.currentHP <= -1 ? "orange.100" : 
                      fighter.currentHP === 0 ? "yellow.100" : 
                      fighter.id === currentFighter?.id ? "yellow.100" : "white"
                    }
                    shadow="sm"
                    _hover={{ shadow: "md" }}
                  >
                    <Flex justify="space-between" align="start">
                      <VStack align="start" spacing={2} flex="1" w="100%">
                        <HStack flexWrap="wrap" spacing={2}>
                          <Text fontWeight="bold" color="blue.600" fontSize="md">
                            {fighter.name}
                          </Text>
                          {fighter.id === currentFighter?.id && <Badge colorScheme="yellow" size="md">Current Turn</Badge>}
                          {fighter.suppression?.isSuppressed &&
                            fighter.suppression?.visibleThreat && (
                              <Badge colorScheme="orange" size="md">
                                SUPPRESSED
                              </Badge>
                            )}
                          {(() => {
                            const hpStatus = getHPStatus(fighter.currentHP);
                            // Use hpStatus for consistent status display
                            if (hpStatus.status === "dead") {
                              return <Badge colorScheme="black" size="md">DEAD</Badge>;
                            } else if (hpStatus.status === "critical") {
                              return <Badge colorScheme="purple" size="md">Critical</Badge>;
                            } else if (hpStatus.status === "dying") {
                              return <Badge colorScheme="orange" size="md">Dying</Badge>;
                            } else if (hpStatus.status === "unconscious") {
                              return <Badge colorScheme="yellow" size="md">Unconscious</Badge>;
                            }
                            return null;
                          })()}
                        </HStack>

                        <HStack spacing={2} align="center">
                          <Text fontSize="xs" color="gray.600" fontWeight="bold">
                            Battle Side
                          </Text>
                          <Select
                            size="xs"
                            width="auto"
                            value={fighter.type}
                            onChange={(e) => changeFighterSide(fighter.id, e.target.value)}
                          >
                            <option value="player">Party Side</option>
                            <option value="enemy">Enemy Side</option>
                          </Select>
                        </HStack>
                        
                        {/* Type/Race and OCC */}
                        <HStack spacing={2} flexWrap="wrap">
                          {fighter.species && (
                            <Badge colorScheme="cyan" size="sm">Race: {fighter.species}</Badge>
                          )}
                          {fighter.OCC && (
                            <Badge colorScheme="purple" size="sm">OCC: {fighter.OCC}</Badge>
                          )}
                          {fighter.class && !fighter.OCC && (
                            <Badge colorScheme="purple" size="sm">Class: {fighter.class}</Badge>
                          )}
                          {/* ✅ Alignment Display */}
                          {(fighter.alignment || fighter.alignmentName || fighter.alignmentText) && (
                            <Badge colorScheme="gray" size="sm">
                              {fighter.alignment || fighter.alignmentName || fighter.alignmentText}
                            </Badge>
                          )}
                        </HStack>
                        
                        <Text fontSize="sm" color="blue.700">
                          HP: {fighter.currentHP}/{fighter.maxHP} | AR: {fighter.AR || 10} | Speed: {fighter.Spd || fighter.spd || fighter.attributes?.Spd || fighter.attributes?.spd || 10}
                          {fighter.ISP !== undefined && ` | ISP: ${fighter.ISP}`}
                          {fighter.PPE !== undefined && ` | PPE: ${fighter.PPE}`}
                        </Text>
                        
                        {/* ✅ Attributes Display */}
                        {fighter.attributes && (
                          <Box fontSize="xs" color="gray.600">
                            <Text fontWeight="medium">Attributes:</Text>
                            <HStack spacing={2} flexWrap="wrap">
                              {fighter.attributes.IQ && <Text>IQ: {fighter.attributes.IQ}</Text>}
                              {fighter.attributes.ME && <Text>ME: {fighter.attributes.ME}</Text>}
                              {fighter.attributes.MA && <Text>MA: {fighter.attributes.MA}</Text>}
                              {fighter.attributes.PS && <Text>PS: {fighter.attributes.PS}</Text>}
                              {fighter.attributes.PP && <Text>PP: {fighter.attributes.PP}</Text>}
                              {fighter.attributes.PE && <Text>PE: {fighter.attributes.PE}</Text>}
                              {fighter.attributes.PB && <Text>PB: {fighter.attributes.PB}</Text>}
                              {fighter.attributes.Spd && <Text>Spd: {fighter.attributes.Spd}</Text>}
                            </HStack>
                          </Box>
                        )}
                        {/* Altitude, Stamina, and Carrying Status */}
                        <HStack spacing={2} fontSize="sm">
                          <Text color="blue.700">
                            🪽 Altitude: {isFlying(fighter) && (fighter.altitudeFeet ?? 0) > 0
                              ? `${fighter.altitudeFeet ?? fighter.altitude ?? 0}ft`
                              : 'Ground'}
                          </Text>
                          {(() => {
                            const fatigueStatus = getFatigueStatus(fighter);
                            if (fatigueStatus && fatigueStatus.maxStamina) {
                              const staminaColor = fatigueStatus.stamina <= 0 ? "red.700" : 
                                                   fatigueStatus.stamina < fatigueStatus.maxStamina * 0.5 ? "orange.700" : "green.700";
                              return (
                                <Text color={staminaColor}>
                                  💪 Stamina: {fatigueStatus.stamina?.toFixed(1) || 0}/{fatigueStatus.maxStamina || 0} SP
                                  {fatigueStatus.status !== "ready" && ` (${fatigueStatus.description})`}
                                </Text>
                              );
                            }
                            return null;
                          })()}
                          {fighter.isCarrying && fighter.carriedTargetId && (
                            <Text color="purple.700">
                              ✈️ Carrying: {fighters.find(f => f.id === fighter.carriedTargetId)?.name || 'Target'}
                            </Text>
                          )}
                        </HStack>
                        
                        {/* Combat Bonuses */}
                        {(fighter.bonuses || fighter.occBonuses) && (
                          <HStack spacing={1} flexWrap="wrap">
                            {(fighter.bonuses?.strike || fighter.occBonuses?.strike) && (
                              <Badge colorScheme="green" size="xs">Strike: +{fighter.bonuses?.strike || fighter.occBonuses?.strike}</Badge>
                            )}
                            {(fighter.bonuses?.parry || fighter.occBonuses?.parry) && (
                              <Badge colorScheme="blue" size="xs">Parry: +{fighter.bonuses?.parry || fighter.occBonuses?.parry}</Badge>
                            )}
                            {(fighter.bonuses?.dodge || fighter.occBonuses?.dodge) && (
                              <Badge colorScheme="purple" size="xs">Dodge: +{fighter.bonuses?.dodge || fighter.occBonuses?.dodge}</Badge>
                            )}
                            {(fighter.bonuses?.damage || fighter.occBonuses?.damage) && (
                              <Badge colorScheme="red" size="xs">Dmg: +{fighter.bonuses?.damage || fighter.occBonuses?.damage}</Badge>
                            )}
                            {fighter.attacksPerMelee && (
                              <Badge colorScheme="orange" size="xs">Attacks: {fighter.attacksPerMelee}/melee</Badge>
                            )}
                          </HStack>
                        )}
                        
                        {/* Skills Accordion */}
                        {fighter.occSkills && Object.keys(fighter.occSkills).length > 0 && (
                          <Accordion allowToggle w="100%" size="xs">
                            <AccordionItem border="none">
                              <AccordionButton px={0} py={1} _hover={{ bg: "transparent" }}>
                                <Box flex="1" textAlign="left">
                          <HStack spacing={1} flexWrap="wrap">
                            <Text fontSize="xs" color="gray.600" fontWeight="bold">Skills:</Text>
                            {Object.entries(fighter.occSkills).slice(0, 3).map(([skillName, skillData]) => (
                              <Badge key={skillName} colorScheme="teal" size="xs">
                                {skillName}: {skillData.total || skillData}%
                              </Badge>
                            ))}
                            {Object.keys(fighter.occSkills).length > 3 && (
                                      <Badge colorScheme="gray" size="xs">
                                        +{Object.keys(fighter.occSkills).length - 3} more
                                      </Badge>
                            )}
                          </HStack>
                                </Box>
                                <AccordionIcon />
                              </AccordionButton>
                              <AccordionPanel pb={2} px={0}>
                                <VStack align="start" spacing={1} maxH="200px" overflowY="auto">
                                  {Object.entries(fighter.occSkills).map(([skillName, skillData]) => (
                                    <HStack key={skillName} spacing={2} w="100%" justify="space-between">
                                      <Text fontSize="xs" fontWeight="medium">{skillName}:</Text>
                                      <Badge colorScheme="teal" size="xs">
                                        {skillData.total || skillData}%
                                      </Badge>
                                    </HStack>
                                  ))}
                                </VStack>
                              </AccordionPanel>
                            </AccordionItem>
                          </Accordion>
                        )}
                        
                        {/* Equipment Accordion */}
                        {(fighter.equipped || fighter.equippedWeapons || fighter.equippedArmor || fighter.equippedWeapon || fighter.attacks) && (
                          <Accordion allowToggle w="100%" size="xs">
                            <AccordionItem border="none">
                              <AccordionButton px={0} py={1} _hover={{ bg: "transparent" }}>
                                <Box flex="1" textAlign="left">
                                  <Text fontSize="xs" color="gray.600" fontWeight="bold">Equipment & Attacks</Text>
                                </Box>
                                <AccordionIcon />
                              </AccordionButton>
                              <AccordionPanel pb={2} px={0}>
                                <VStack align="start" spacing={1} fontSize="xs">
                                  {(() => {
                                    // Use getWeaponDisplayInfo for consistent weapon display
                                    const weaponInfo = getWeaponDisplayInfo(fighter);
                                    return (
                                      <>
                                        {fighter.equippedWeapon && (
                                          <HStack spacing={2}>
                                            <Text fontWeight="medium">Weapon:</Text>
                                            <Text>{fighter.equippedWeapon}</Text>
                                          </HStack>
                                        )}
                                        {weaponInfo.hasWeapons && (
                                          <Box>
                                            <Text fontWeight="medium">Weapons:</Text>
                                            {weaponInfo.rightHand.name !== "Unarmed" && (
                                              <Text pl={2}>• Right: {weaponInfo.rightHand.name} ({weaponInfo.rightHand.damage})</Text>
                                            )}
                                            {weaponInfo.leftHand.name !== "Unarmed" && (
                                              <Text pl={2}>• Left: {weaponInfo.leftHand.name} ({weaponInfo.leftHand.damage})</Text>
                                            )}
                                          </Box>
                                        )}
                                        {!weaponInfo.hasWeapons && fighter.equippedWeapons && fighter.equippedWeapons.length > 0 && (
                                          <Box>
                                            <Text fontWeight="medium">Weapons:</Text>
                                            {fighter.equippedWeapons.map((w, idx) => (
                                              <Text key={idx} pl={2}>• {w.name || w}</Text>
                                            ))}
                                          </Box>
                                        )}
                                      </>
                                    );
                                  })()}
                                  {fighter.attacks && fighter.attacks.length > 0 && (
                                    <Box>
                                      <Text fontWeight="medium">Attacks:</Text>
                                      {fighter.attacks.map((attack, idx) => (
                                        <Text key={idx} pl={2}>• {attack.name || attack} {attack.damage && `(${attack.damage})`}</Text>
                                      ))}
                                    </Box>
                                  )}
                                  {/* ✅ Armor Display */}
                                  {(fighter.equippedArmor || fighter.AR) && (
                                    <Box>
                                      <Text fontWeight="medium">Armor:</Text>
                                      {fighter.equippedArmor ? (
                                        <Text pl={2}>• {fighter.equippedArmor.name || fighter.equippedArmor} (AR: {fighter.AR || 10})</Text>
                                      ) : (
                                        <Text pl={2}>• AR: {fighter.AR || 10}</Text>
                                      )}
                                    </Box>
                                  )}
                                  
                                  {/* ✅ Ammo Display */}
                                  {(() => {
                                    const invAmmo =
                                      fighter.inventory?.filter(
                                        (item) =>
                                          item?.type === "ammunition" ||
                                          (item?.name &&
                                            (item.name.toLowerCase().includes("arrow") ||
                                              item.name.toLowerCase().includes("bolt") ||
                                              item.name.toLowerCase().includes("bullet")))
                                      ) || [];
                                    const improvised = getImprovisedAmmoSummaryForFighter(fighter.id);
                                    if (invAmmo.length === 0 && !improvised) return null;
                                    return (
                                      <Box>
                                        <Text fontWeight="medium">Ammunition:</Text>
                                        {invAmmo.map((item, idx) => (
                                          <Text key={idx} pl={2}>
                                            • {item.name}: {item.quantity || 0}
                                          </Text>
                                        ))}
                                        {improvised && (
                                          <Text pl={2}>
                                            • Improvised missiles: {improvised.qty} ({improvised.details})
                                          </Text>
                                        )}
                                      </Box>
                                    );
                                  })()}
                                  {fighter.equipped && (
                                    <Box>
                                      <Text fontWeight="medium">Other:</Text>
                                      {Object.entries(fighter.equipped).filter(([key, val]) => val && key !== 'weapon' && key !== 'armor').map(([key, val]) => (
                                        <Text key={key} pl={2}>• {key}: {val.name || val}</Text>
                                      ))}
                                    </Box>
                                  )}
                                </VStack>
                              </AccordionPanel>
                            </AccordionItem>
                          </Accordion>
                        )}
                        
                        {fighter.initiative > 0 && (
                          <Badge colorScheme="purple" size="sm">
                            Initiative: {fighter.initiative}
                          </Badge>
                        )}
                      </VStack>
                      <Button size="sm" colorScheme="red" variant="outline" onClick={() => removeFighter(fighter.id)}>
                        ✕
                      </Button>
                    </Flex>
                  </Box>
                  </GridItem>
                ))}
                </Grid>
              )}
            </Box>
            
            {/* Equipped Weapons Inventory */}
            {fighters.filter(f => f.type === "player").length > 0 && (
              <Box w="100%" mt={4}>
                <Heading size="sm" color="orange.600" mb={2}>⚔️ Equipped Weapons</Heading>
                <Box 
                  w="100%" 
                  maxH="200px" 
                  overflowY="auto" 
                  border="2px solid" 
                  borderColor="orange.400" 
                  p={3} 
                  borderRadius="md" 
                  bg="orange.50"
                >
                  {fighters.filter(f => f.type === "player").map((fighter) => {
                    const equippedWeapons = fighter.equippedWeapons || [];
                    const primaryWeapon = fighter.equippedWeapon || fighter.weapon || "Unarmed";
                    
                    return (
                      <Box key={fighter.id} mb={3} p={2} border="1px solid" borderColor="orange.300" borderRadius="md" bg="white">
                        <VStack align="start" spacing={2}>
                          <HStack>
                            <Text fontSize="sm" fontWeight="bold" color="orange.700">
                              {fighter.name}
                            </Text>
                            <Badge colorScheme="orange" size="sm">
                              Primary: {primaryWeapon}
                            </Badge>
                          </HStack>
                          
                          {equippedWeapons.length > 0 ? (
                            <VStack align="start" spacing={1} w="full">
                              {equippedWeapons.map((weapon, index) => (
                                <HStack key={index} spacing={2} w="full">
                                  <Text 
                                    fontSize="xs" 
                                    color={weapon.disabled ? "gray.400" : "gray.600"}
                                    minW="70px"
                                  >
                                    {weapon.slot || `Slot ${index + 1}`}:
                                  </Text>
                                  <Text 
                                    fontSize="xs" 
                                    fontWeight={weapon.disabled ? "normal" : "medium"}
                                    color={weapon.disabled ? "gray.400" : "orange.600"}
                                    fontStyle={weapon.disabled ? "italic" : "normal"}
                                    flex="1"
                                  >
                                    {weapon.name || weapon}
                                  </Text>
                                  <HStack spacing={1}>
                                    {weapon.twoHanded && !weapon.disabled && (
                                      <Badge colorScheme="purple" size="xs">
                                        Two-Handed
                                      </Badge>
                                    )}
                                    {weapon.damage && weapon.damage !== "—" && (
                                      <Badge colorScheme="red" size="xs">
                                        {weapon.damage} dmg
                                      </Badge>
                                    )}
                                    {weapon.range && (
                                      <Badge colorScheme="blue" size="xs">
                                        {weapon.range} ft
                                      </Badge>
                                    )}
                                    {weapon.type && weapon.type !== "disabled" && (
                                      <Badge colorScheme="gray" size="xs">
                                        {weapon.type}
                                      </Badge>
                                    )}
                                  </HStack>
                                </HStack>
                              ))}
                            </VStack>
                          ) : (
                            <Text fontSize="xs" color="gray.500" fontStyle="italic">
                              No additional weapons equipped
                            </Text>
                          )}
                          
                          {/* Quick Weapon Actions */}
                          <HStack spacing={1} w="full" justify="flex-end">
                            <Button 
                              size="xs" 
                              colorScheme="orange" 
                              variant="outline"
                              onClick={() => handleChangeWeapon(fighter.id, 0)}
                            >
                              🤜 Change Right Hand
                            </Button>
                            <Button 
                              size="xs" 
                              colorScheme="orange" 
                              variant="outline"
                              onClick={() => handleChangeWeapon(fighter.id, 1)}
                              isDisabled={equippedWeapons[1]?.disabled || equippedWeapons[0]?.twoHanded}
                              title={equippedWeapons[1]?.disabled ? "Left hand occupied by two-handed weapon" : "Change left hand weapon"}
                            >
                              🤛 Change Left Hand
                            </Button>
                          </HStack>
                        </VStack>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* Combat Options - Moved here to appear under Equipped Weapons */}
            {shouldShowCombatOptions && !isArielTurn && (
              <Box w="100%" mt={4}>
                <Heading size="sm" color="green.600" mb={2}>🎯 Combat Options for {currentFighter.name}</Heading>
                <Box 
                  w="100%" 
                  maxH="600px" 
                  overflowY="auto" 
                  border="2px solid" 
                  borderColor="green.400" 
                  p={4} 
                  borderRadius="md" 
                  bg="green.50"
                >
                  <VStack spacing={3} align="stretch">
                    {/* Movement Mode Toggle - only show if fighter can fly */}
                    {currentFighter && currentFighter.type === "player" && canFlyNow && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2}>Movement Mode:</Text>
                        <HStack spacing={2}>
                          <Button
                            size="sm"
                            variant={playerMovementMode === 'ground' ? "solid" : "outline"}
                            colorScheme={playerMovementMode === 'ground' ? "blue" : "gray"}
                            onClick={() => setPlayerMovementMode('ground')}
                            isDisabled={isFloatOnly}
                          >
                            Ground
                          </Button>
                          <Button
                            size="sm"
                            variant={playerMovementMode === 'flight' ? "solid" : "outline"}
                            colorScheme={playerMovementMode === 'flight' ? "purple" : "gray"}
                            onClick={() => setPlayerMovementMode('flight')}
                          >
                            Fly
                          </Button>
                        </HStack>
                      </Box>
                    )}
                    {/* Action Buttons */}
                    <Box>
                      <Text fontSize="sm" fontWeight="bold" mb={2}>Select Action:</Text>
                      <Wrap spacing={2}>
                        {actionOptions.map((option) => (
                          <Button
                            key={option.value}
                            size="sm"
                            variant={selectedAction?.name === option.value ? "solid" : "outline"}
                            colorScheme={selectedAction?.name === option.value ? "green" : "blue"}
                            onClick={() => {
                              const actionName = option.value;
                              if (actionName) {
                                // Create a simple action object
                                const action = { name: actionName };
                                setSelectedAction(action);
                                setSelectedTarget(null);
                                setSelectedSkill(null); // Clear skill when action changes
                                setSelectedGrappleAction(null); // Clear grapple action when action changes
                                
                                // Set psionicsMode or spellsMode based on action
                                if (actionName === "Psionics") {
                                  setPsionicsMode(true);
                                  setSpellsMode(false);
                                } else if (actionName === "Spells") {
                                  setSpellsMode(true);
                                  setPsionicsMode(false);
                                } else {
                                  setPsionicsMode(false);
                                  setSpellsMode(false);
                                }
                                
                                addLog(`${currentFighter?.name} selects: ${actionName}`, "info");
                              } else {
                                setSelectedAction(null);
                                setSelectedTarget(null);
                                setSelectedSkill(null);
                                setPsionicsMode(false);
                                setSpellsMode(false);
                                setClericalAbilitiesMode(false);
                                setSelectedClericalAbility(null);
                              }
                            }}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </Wrap>
                    </Box>

                    <HStack spacing={4} align="center" justify="center" flexWrap="wrap">
                      {/* Movement Mode Toggle (only for flyers) */}
                      {currentFighter && currentFighter.type === "player" && canFlyNow && (
                        <HStack spacing={2} align="center">
                          <Text fontSize="xs" fontWeight="bold">
                            Movement Mode:
                          </Text>
                          <Button
                            size="xs"
                            variant={playerMovementMode === "ground" ? "solid" : "outline"}
                            colorScheme={playerMovementMode === "ground" ? "blue" : "gray"}
                            onClick={() => setPlayerMovementMode("ground")}
                            isDisabled={isFloatOnly}
                          >
                            Ground
                          </Button>
                          <Button
                            size="xs"
                            variant={playerMovementMode === "flight" ? "solid" : "outline"}
                            colorScheme={playerMovementMode === "flight" ? "purple" : "gray"}
                            onClick={() => setPlayerMovementMode("flight")}
                          >
                            Fly
                          </Button>
                        </HStack>
                      )}

                      {/* Dedicated Move Button (label depends on movement mode) */}
                      <Button
                        colorScheme="blue"
                        onClick={activateMovementMode}
                        isDisabled={!currentFighter || currentFighter.type !== "player" || !showTacticalMap}
                        size="md"
                        title={moveTitle}
                      >
                        {moveLabel}
                      </Button>

                      {/* Dedicated Run Button (ground-only dash) */}
                      <Button
                        colorScheme="orange"
                        onClick={() => {
                          if (currentFighter && currentFighter.type === "player") {
                            setMovementMode({ active: true, isRunning: true });
                            setSelectedMovementFighter(currentFighter.id);
                            addLog(`🏃 ${currentFighter.name} prepares to run (full speed movement)`, "info");
                          }
                        }}
                        isDisabled={
                          !currentFighter ||
                          currentFighter.type !== "player" ||
                          !showTacticalMap ||
                          isFloatOnly
                        }
                        size="md"
                        title={
                          !showTacticalMap
                            ? "Show tactical map first to enable running"
                            : isFloatOnly
                            ? "This creature cannot run on the ground."
                            : "Click to activate running mode (full speed)"
                        }
                      >
                        🏃 Run
                      </Button>
                    </HStack>

                    {/* Flight Altitude Controls - Only show if fighter can fly and is currently flying */}
                    {currentFighter && canFighterFly(currentFighter) && isFlying(currentFighter) && (
                      <VStack spacing={1} align="stretch" borderWidth="1px" borderColor="blue.300" borderRadius="md" p={2} bg="blue.50">
                        <Text fontSize="xs" fontWeight="bold" color="blue.700">
                          🪽 Altitude: {currentFighter.altitudeFeet ?? currentFighter.altitude ?? 0}ft
                        </Text>
                        <HStack spacing={1} flexWrap="wrap">
                          <Button
                            size="xs"
                            colorScheme="blue"
                            variant="outline"
                            onClick={() => handleChangeAltitude(currentFighter, -20)}
                            title="Descend 20ft"
                          >
                            ⬇️ -20ft
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="blue"
                            variant="outline"
                            onClick={() => handleChangeAltitude(currentFighter, -10)}
                            title="Descend 10ft"
                          >
                            ⬇️ -10ft
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="blue"
                            variant="outline"
                            onClick={() => handleChangeAltitude(currentFighter, -5)}
                            title="Descend 5ft"
                          >
                            ⬇️ -5ft
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="blue"
                            variant="outline"
                            onClick={() => handleChangeAltitude(currentFighter, 5)}
                            title="Climb 5ft"
                          >
                            ⬆️ +5ft
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="blue"
                            variant="outline"
                            onClick={() => handleChangeAltitude(currentFighter, 10)}
                            title="Climb 10ft"
                          >
                            ⬆️ +10ft
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="blue"
                            variant="outline"
                            onClick={() => handleChangeAltitude(currentFighter, 20)}
                            title="Climb 20ft"
                          >
                            ⬆️ +20ft
                          </Button>
                        </HStack>
                      </VStack>
                    )}

                    {/* Movement Instructions */}
                    {showTacticalMap && currentFighter && currentFighter.type === "player" && (
                      <VStack spacing={1} align="start">
                        <Text fontSize="xs" color="blue.600" fontStyle="italic">
                          Click &quot;{canFlyNow ? (playerMovementMode === "flight" ? "Move (Fly)" : "Move (Run)") : "Move"}&quot; then click a green hex to move
                        </Text>
                        <Text fontSize="xs" color="orange.600" fontStyle="italic">
                          Click &quot;Run&quot; then click a green hex to run (full speed)
                        </Text>
                        {movementMode.active && (
                          <Text fontSize="xs" color="green.600" fontWeight="bold">
                            ✅ {movementMode.isRunning ? "Running" : "Movement"} mode active - select destination hex
                          </Text>
                        )}
                      </VStack>
                    )}

                    {/* Target Buttons (Strike / Combat Maneuvers / Psionics / Spells) */}
                    {shouldShowTargetDropdown && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2}>Select Target:</Text>
                        <Wrap spacing={2}>
                          {targetOptions.map((fighter, index, array) => {
                            const sameNameCount = array.filter(f => f.name === fighter.name).length;
                            const displayName = sameNameCount > 1 
                              ? `${fighter.name} (#${array.filter(f => f.name === fighter.name).indexOf(fighter) + 1})`
                              : fighter.name;
                            const hpValue = getFighterHP(fighter);
                            const bloodied = fighter.maxHP ? hpValue <= fighter.maxHP * 0.5 : hpValue <= 0;
                            return (
                              <Button
                                key={fighter.id}
                                size="sm"
                                variant={selectedTarget?.id === fighter.id ? "solid" : "outline"}
                                colorScheme={selectedTarget?.id === fighter.id ? "green" : "blue"}
                                onClick={() => {
                                  setSelectedTarget(fighter);
                                  addLog(`Target selected: ${fighter.name}`, "info");
                                }}
                              >
                                {displayName} {bloodied ? "🩸" : ""}
                              </Button>
                            );
                          })}
                        </Wrap>
                      </Box>
                    )}

                    {/* Maneuver Selection Buttons (only for Combat Maneuvers when NOT in grapple) */}
                    {selectedAction?.name === "Combat Maneuvers" && currentFighter && selectedTarget && (() => {
                      const grappleStatus = getGrappleStatus(currentFighter);
                      const targetGrappleStatus = getGrappleStatus(selectedTarget);
                      const inGrapple = grappleStatus.state !== GRAPPLE_STATES.NEUTRAL || targetGrappleStatus.state !== GRAPPLE_STATES.NEUTRAL;
                      
                      if (!inGrapple) {
                        const maneuvers = [
                          { value: "trip", label: "Trip" },
                          { value: "shove", label: "Shove" },
                          { value: "disarm", label: "Disarm" },
                          { value: "grapple", label: "Grapple" },
                        ];
                        
                        return (
                          <Box>
                            <Text fontSize="sm" fontWeight="bold" mb={2}>Select Maneuver:</Text>
                            <Wrap spacing={2}>
                              {maneuvers.map((maneuver) => (
                                <Button
                                  key={maneuver.value}
                                  size="sm"
                                  variant={selectedManeuver === maneuver.value ? "solid" : "outline"}
                                  colorScheme={selectedManeuver === maneuver.value ? "green" : "blue"}
                                  onClick={() => {
                                    setSelectedManeuver(maneuver.value);
                                    addLog(`Maneuver selected: ${maneuver.label}`, "info");
                                  }}
                                >
                                  {maneuver.label}
                                </Button>
                              ))}
                            </Wrap>
                          </Box>
                        );
                      }
                      return null;
                    })()}

                    {/* Grapple Action Buttons (only for Combat Maneuvers when in grapple) */}
                    {selectedAction?.name === "Combat Maneuvers" && currentFighter && selectedTarget && (() => {
                      const grappleStatus = getGrappleStatus(currentFighter);
                      const targetGrappleStatus = getGrappleStatus(selectedTarget);
                      const inGrapple = grappleStatus.state !== GRAPPLE_STATES.NEUTRAL || targetGrappleStatus.state !== GRAPPLE_STATES.NEUTRAL;
                      const availableActions = inGrapple ? getAvailableGrappleActions(currentFighter, selectedTarget) : [];
                      
                      if (availableActions.length > 0) {
                        return (
                          <Box>
                            <Text fontSize="sm" fontWeight="bold" mb={2}>Select Grapple Action:</Text>
                            <Wrap spacing={2}>
                              {availableActions.map((action) => (
                                <Button
                                  key={action.value}
                                  size="sm"
                                  variant={selectedGrappleAction === action.value ? "solid" : "outline"}
                                  colorScheme={selectedGrappleAction === action.value ? "green" : "blue"}
                                  onClick={() => {
                                    setSelectedGrappleAction(action.value);
                                    addLog(`Grapple action selected: ${action.label}`, "info");
                                  }}
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </Wrap>
                          </Box>
                        );
                      }
                      return null;
                    })()}

                    {/* Capture Actions (for surrendered enemies) */}
                    {selectedTarget && canBeCaptured(selectedTarget) && currentFighter && currentFighter.type === "player" && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2} color="orange.600">
                          ⛓️ Prisoner Actions:
                        </Text>
                        <Wrap spacing={2}>
                          <Button
                            size="sm"
                            colorScheme="orange"
                            variant="outline"
                            onClick={() => {
                              if (!canBeCaptured(selectedTarget)) {
                                addLog(`${selectedTarget.name} cannot be captured right now.`, "info");
                                return;
                              }
                              
                              setFighters(prev =>
                                prev.map(f => {
                                  if (f.id === selectedTarget.id) {
                                    const captured = tieUpPrisoner(f, currentFighter.id);
                                    addLog(
                                      `⛓️ ${currentFighter.name} ties up ${captured.name}, taking them prisoner!`,
                                      "info"
                                    );
                                    return captured;
                                  }
                                  return f;
                                })
                              );
                              setSelectedTarget(null);
                            }}
                          >
                            ⛓️ Capture / Tie Up
                          </Button>
                          <Button
                            size="sm"
                            colorScheme="yellow"
                            variant="outline"
                            onClick={() => {
                              setFighters(prev => {
                                let lootResult = null;
                                
                                const updated = prev.map(f => {
                                  if (f.id === selectedTarget.id) {
                                    const { updatedFighter, loot } = lootPrisoner(f);
                                    lootResult = loot;
                                    return updatedFighter;
                                  }
                                  return f;
                                });
                                
                                if (lootResult) {
                                  const lootCount = (lootResult.inventory?.length || 0) + 
                                                   (lootResult.weapons?.length || 0) + 
                                                   (lootResult.armor ? 1 : 0);
                                  addLog(
                                    `💰 ${selectedTarget.name} is searched; ${lootCount} item${lootCount !== 1 ? 's' : ''} confiscated.`,
                                    "info"
                                  );
                                }
                                
                                return updated;
                              });
                              setSelectedTarget(null);
                            }}
                          >
                            💰 Loot Prisoner
                          </Button>
                        </Wrap>
                      </Box>
                    )}

                    {/* Weapon Selection Buttons (only for Strike) */}
                    {selectedAction?.name === "Strike" && currentFighter && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2}>Select Weapon:</Text>
                        <Wrap spacing={2}>
                          {currentFighter.equippedWeapons?.map((weapon, index) => (
                            <Button
                              key={index}
                              size="sm"
                              variant={selectedAttackWeapon?.slot === weapon.slot ? "solid" : "outline"}
                              colorScheme={selectedAttackWeapon?.slot === weapon.slot ? "green" : "blue"}
                              onClick={() => {
                                setSelectedAttackWeapon(weapon);
                                addLog(`Weapon selected: ${weapon.name} (${weapon.damage})`, "info");
                              }}
                            >
                              {weapon.slot}: {weapon.name}
                            </Button>
                          ))}
                        </Wrap>
                      </Box>
                    )}

                    {/* Clerical Abilities Selection (only for Clerical Abilities) */}
                    {selectedAction?.name === "Clerical Abilities" && currentFighter && clericalAbilitiesMode && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2}>Select Clerical Ability:</Text>
                        <Wrap spacing={2}>
                          {getAvailableClericalAbilities(currentFighter).map((ability, index) => (
                            <Button
                              key={index}
                              size="sm"
                              variant={selectedClericalAbility?.name === ability.name ? "solid" : "outline"}
                              colorScheme={selectedClericalAbility?.name === ability.name ? "green" : "purple"}
                              onClick={() => {
                                setSelectedClericalAbility(ability);
                                addLog(`Clerical ability selected: ${ability.name} (${ability.description})`, "info");
                              }}
                            >
                              {ability.name} ({ability.description})
                            </Button>
                          ))}
                        </Wrap>
                      </Box>
                    )}

                    {/* Psionic Power Selection Buttons (only for Psionics) */}
                    {selectedAction?.name === "Psionics" && currentFighter && hasPsionics && psionicsMode && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2}>Select Psionic Power:</Text>
                        <Wrap spacing={2}>
                          {availablePsionicPowers.map((power, index) => (
                            <Button
                              key={index}
                              size="sm"
                              variant={selectedPsionicPower?.name === power.name ? "solid" : "outline"}
                              colorScheme={selectedPsionicPower?.name === power.name ? "green" : "blue"}
                              onClick={() => {
                                setSelectedPsionicPower(power);
                                addLog(`Psionic power selected: ${power.name} (${power.isp} ISP)`, "info");
                              }}
                            >
                              {power.name} ({power.isp} ISP)
                            </Button>
                          ))}
                        </Wrap>
                      </Box>
                    )}

                    {/* Spell Selection - Searchable Scrollable List (only for Spells) */}
                    {selectedAction?.name === "Spells" && currentFighter && hasSpells && spellsMode && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2}>Select Spell:</Text>
                        
                        {/* Search and Filter Controls */}
                        <VStack spacing={2} mb={3} align="stretch">
                          <Input
                            placeholder="Search spells..."
                            value={spellSearch}
                            onChange={(e) => setSpellSearch(e.target.value)}
                            size="sm"
                          />
                          <Select
                            size="sm"
                            value={spellLevelFilter}
                            onChange={(e) => setSpellLevelFilter(e.target.value)}
                          >
                            <option value="all">All Levels</option>
                            <option value="1">Level 1</option>
                            <option value="2">Level 2</option>
                            <option value="3">Level 3</option>
                            <option value="4">Level 4</option>
                            <option value="5">Level 5</option>
                            <option value="6">Level 6+</option>
                          </Select>
                        </VStack>
                        
                        {/* Filtered Spell List */}
                        {(() => {
                          const filtered = availableSpells.filter((spell) => {
                            const matchesSearch = !spellSearch || 
                              spell.name.toLowerCase().includes(spellSearch.toLowerCase()) ||
                              (spell.effect && spell.effect.toLowerCase().includes(spellSearch.toLowerCase()));
                            const matchesLevel = spellLevelFilter === "all" || 
                              (spellLevelFilter === "6" ? (spell.level || 1) >= 6 : (spell.level || 1) === parseInt(spellLevelFilter));
                            return matchesSearch && matchesLevel;
                          });
                          
                          return (
                            <Box
                              maxH="300px"
                              overflowY="auto"
                              border="1px solid"
                              borderColor="gray.200"
                              borderRadius="md"
                              p={2}
                            >
                              <VStack spacing={1} align="stretch">
                                {filtered.length === 0 ? (
                                  <Text fontSize="xs" color="gray.500" p={2} textAlign="center">
                                    No spells found
                                  </Text>
                                ) : (
                                  filtered.map((spell, index) => {
                                    const ppeCost = spell.cost ?? spell.ppe ?? spell.PPE ?? 0;
                                    const hasDamage = spell.damage && spell.damage !== "0" && spell.damage !== "";
                                    const isSelected = selectedSpell?.name === spell.name;
                                    
                                    return (
                                      <Button
                                        key={index}
                                        size="sm"
                                        variant={isSelected ? "solid" : "outline"}
                                        colorScheme={isSelected ? "green" : "blue"}
                                        isDisabled={!hasDamage && import.meta.env?.DEV !== true}
                                        onClick={() => {
                                          setSelectedSpell(spell);
                                          addLog(`Spell selected: ${spell.name} (${ppeCost} PPE)`, "info");
                                        }}
                                        justifyContent="flex-start"
                                        textAlign="left"
                                        whiteSpace="normal"
                                        height="auto"
                                        py={2}
                                      >
                                        <VStack align="start" spacing={0} width="100%">
                                          <HStack width="100%" justify="space-between">
                                            <Text fontSize="xs" fontWeight="bold">
                                              {spell.name}
                                            </Text>
                                            <Badge fontSize="xs" colorScheme={hasDamage ? "green" : "gray"}>
                                              {ppeCost} PPE
                                            </Badge>
                                          </HStack>
                                          {spell.level && (
                                            <Text fontSize="xs" color="gray.600">
                                              Level {spell.level}
                                            </Text>
                                          )}
                                          {!hasDamage && (
                                            <Text fontSize="xs" color="orange.500" fontStyle="italic">
                                              (Non-combat)
                                            </Text>
                                          )}
                                        </VStack>
                                      </Button>
                                    );
                                  })
                                )}
                              </VStack>
                            </Box>
                          );
                        })()}
                      </Box>
                    )}

                    {/* Skill Selection Buttons (only for Use Skill) */}
                    {selectedAction?.name === "Use Skill" && currentFighter && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2}>Select Skill:</Text>
                        <Wrap spacing={2}>
                          {getAvailableSkills(currentFighter).map((skill, index) => (
                            <Button
                              key={index}
                              size="sm"
                              variant={selectedSkill?.name === skill.name ? "solid" : "outline"}
                              colorScheme={selectedSkill?.name === skill.name ? "green" : "blue"}
                              onClick={() => {
                                setSelectedSkill(skill);
                                addLog(`Skill selected: ${skill.name}`, "info");
                                // Clear target if skill doesn't require one
                                if (skill && !skill.requiresTarget) {
                                  setSelectedTarget(null);
                                }
                              }}
                            >
                              {skill.name} {skill.cost > 0 && `(${skill.cost} ${skill.costType})`}
                            </Button>
                          ))}
                        </Wrap>
                      </Box>
                    )}

                    {/* Target Selection Buttons for Skills that require targets */}
                    {selectedAction?.name === "Use Skill" && selectedSkill && selectedSkill.requiresTarget && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2}>Select Target:</Text>
                        <Wrap spacing={2}>
                          {/* For healing skills, show allies; for other skills, show enemies */}
                          {selectedSkill.type === "healer_ability" || selectedSkill.type === "clerical_ability" || selectedSkill.type === "medical_skill" ? (
                            fighters
                              .filter(f => f.type === currentFighter.type && f.id !== currentFighter.id && f.currentHP > -21)
                              .map((fighter) => (
                                <Button
                                  key={fighter.id}
                                  size="sm"
                                  variant={selectedTarget?.id === fighter.id ? "solid" : "outline"}
                                  colorScheme={selectedTarget?.id === fighter.id ? "green" : "blue"}
                                  onClick={() => {
                                    setSelectedTarget(fighter);
                                    addLog(`Target selected: ${fighter.name}`, "info");
                                  }}
                                >
                                  {fighter.name} ({fighter.currentHP}/{fighter.maxHP} HP)
                                  {fighter.currentHP <= 0 && ' 🩸'}
                                </Button>
                              ))
                          ) : (
                            fighters
                            .filter(f => f.type !== currentFighter.type && f.currentHP > 0)
                            .map((fighter) => (
                              <Button
                                key={fighter.id}
                                size="sm"
                                variant={selectedTarget?.id === fighter.id ? "solid" : "outline"}
                                colorScheme={selectedTarget?.id === fighter.id ? "green" : "blue"}
                                onClick={() => {
                                  setSelectedTarget(fighter);
                                  addLog(`Target selected: ${fighter.name}`, "info");
                                }}
                              >
                                {fighter.name}
                              </Button>
                            ))
                          )}
                        </Wrap>
                      </Box>
                    )}

                    {/* Execute Button */}
                    <Button
                      colorScheme="green"
                      onClick={executeSelectedAction}
                      size="md"
                      isDisabled={!selectedAction}
                      width="full"
                      maxWidth="300px"
                      alignSelf="center"
                    >
                      {selectedAction 
                        ? `Execute ${selectedAction.name} →` 
                        : "Select Action First"}
                    </Button>

                    {/* Action Summary */}
                    {selectedAction && (
                      <Box p={3} bg="green.100" borderRadius="md" borderWidth="1px" borderColor="green.300">
                        <Text fontSize="sm" color="green.700" textAlign="center" fontWeight="bold">
                          {selectedAction.name}
                          {selectedTarget && ` targeting ${selectedTarget.name}`}
                        </Text>
                        {selectedAction.name === "Strike" && selectedAttackWeapon && (
                          <Text fontSize="xs" color="green.600" mt={1}>
                            Using: {selectedAttackWeapon.name} ({selectedAttackWeapon.damage})
                          </Text>
                        )}
                        {selectedAction.name === "Psionics" && selectedPsionicPower && (
                          <Text fontSize="xs" color="purple.600" mt={1}>
                            Using: {selectedPsionicPower.name} ({selectedPsionicPower.isp} ISP)
                          </Text>
                        )}
                        {selectedAction.name === "Spells" && selectedSpell && (
                          <Text fontSize="xs" color="blue.600" mt={1}>
                            Using: {selectedSpell.name} ({selectedSpell.cost} PPE)
                          </Text>
                        )}
                        {selectedAction.name === "Use Skill" && selectedSkill && (
                          <VStack spacing={1} align="start" mt={1}>
                            <Text fontSize="xs" color="teal.600">
                              Using: {selectedSkill.name}
                              {selectedSkill.cost > 0 && ` (${selectedSkill.cost} ${selectedSkill.costType})`}
                            </Text>
                            <Text fontSize="xs" color="gray.600" fontStyle="italic">
                              {selectedSkill.description}
                            </Text>
                            {selectedTarget && (
                              <Text fontSize="xs" color="teal.700">
                                Target: {selectedTarget.name}
                              </Text>
                            )}
                          </VStack>
                        )}
                      </Box>
                    )}
                  </VStack>
                </Box>
              </Box>
            )}
            
            {/* Quick Add Buttons */}
            <HStack spacing={2}>
              <Button 
                size="sm" 
                colorScheme="blue" 
                variant="outline"
                onClick={() => { onPartyOpen(); setShowPartySelector(true); }}
                isDisabled={combatActive}
              >
                + Party
              </Button>
            </HStack>
          </VStack>
        }
        centerContent={
          <>
        {/* CENTER COLUMN - Tactical Map */}
          <VStack align="start" spacing={4} h="full">
            {/* GM Controls - Circle Placement & Management */}
            {showTacticalMap && (
              <HStack spacing={2} flexWrap="wrap">
                <Button
                  size="sm"
                  colorScheme={showCirclePlacementTool ? "green" : "gray"}
                  variant={showCirclePlacementTool ? "solid" : "outline"}
                  onClick={() => {
                    setShowCirclePlacementTool(!showCirclePlacementTool);
                    if (showCirclePlacementTool) {
                      setSelectedCirclePosition(null);
                    }
                  }}
                >
                  {showCirclePlacementTool ? "✓ Circle Tool Active" : "🕯️ Place Circle"}
                </Button>
                <Button
                  size="sm"
                  colorScheme={showCircleManager ? "blue" : "gray"}
                  variant={showCircleManager ? "solid" : "outline"}
                  onClick={() => setShowCircleManager(!showCircleManager)}
                  isDisabled={activeCircles.length === 0}
                >
                  {showCircleManager ? "✓ Managing Circles" : "⚙️ Manage Circles"}
                  {activeCircles.length > 0 && (
                    <Badge ml={2} colorScheme="blue" borderRadius="full">
                      {activeCircles.length}
                    </Badge>
                  )}
                </Button>
                <Button
                  size="sm"
                  colorScheme={showCircleRecharge ? "yellow" : "gray"}
                  variant={showCircleRecharge ? "solid" : "outline"}
                  onClick={() => setShowCircleRecharge(!showCircleRecharge)}
                  isDisabled={activeCircles.length === 0 || !currentFighter}
                >
                  {showCircleRecharge ? "✓ Recharging" : "⚡ Recharge Circle"}
                </Button>
                {showCirclePlacementTool && (
                  <Text fontSize="xs" color="gray.600">
                    Click on the map to select placement location
                  </Text>
                )}
              </HStack>
            )}
            {/* Map Display (2D or 3D) */}
            {showTacticalMap && fighters.length > 0 && (
              <Box w="100%" position="relative" minH="600px">
                {/* GM Circle Placement Tool */}
                {showCirclePlacementTool && (
                  <CirclePlacementTool
                    caster={currentFighter || fighters.find(f => f.type === "player") || fighters[0]}
                    onCreate={(circle) => {
                      const circleCaster = currentFighter || fighters.find(f => f.type === "player") || fighters[0];
                      
                      // Use createProtectionCircle to properly create the circle
                      const createdCircle = createProtectionCircle(
                        circleCaster,
                        circle.type || CIRCLE_TYPES.PROTECTION_FROM_EVIL,
                        selectedCirclePosition || circle.position,
                        circle.radius || 5
                      );
                      
                      if (createdCircle) {
                        // Merge with additional properties from component
                        const fullCircle = {
                          ...createdCircle,
                          ...circle,
                          caster: circleCaster.name || circleCaster.id,
                          name: circle.name || createdCircle.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                          bonus: circle.bonus || 5,
                          remaining: circle.remaining || 10,
                        };
                        
                        setActiveCircles(prev => {
                          const updated = [...prev, fullCircle];
                          
                          // Use updateProtectionCirclesOnMap to update map state
                          updateProtectionCirclesOnMap({
                            circles: updated,
                            combatants: fighters,
                            positions: positions,
                            log: addLog
                          });
                          
                          return updated;
                        });
                        
                        addLog(`🕯️ ${fullCircle.caster} draws ${fullCircle.name}!`, "holy");
                        addLog(
                          `✨ The circle glows with divine light (radius ${fullCircle.radius} ft, +${fullCircle.bonus} vs Horror).`,
                          "holy"
                        );
                      }
                      setShowCirclePlacementTool(false);
                      setSelectedCirclePosition(null);
                    }}
                    mapPosition={selectedCirclePosition}
                    isGM={true} // Always show for now - can be conditional based on user role
                    onClose={() => {
                      setShowCirclePlacementTool(false);
                      setSelectedCirclePosition(null);
                    }}
                  />
                )}
                
                {/* GM Circle Manager Panel */}
                {showCircleManager && (
                  <CircleManagerPanel
                    circles={activeCircles}
                    onUpdate={(updatedCircle) => {
                      const originalCircle = activeCircles.find(c => c.id === updatedCircle.id);
                      const extension = updatedCircle.remaining - (originalCircle?.remaining || 0);
                      setActiveCircles(prev => 
                        prev.map(c => c.id === updatedCircle.id ? updatedCircle : c)
                      );
                      if (extension > 0) {
                        addLog(
                          `✨ GM extends ${updatedCircle.name} by ${extension} melees.`,
                          "holy"
                        );
                        addLog(
                          `🕯️ ${updatedCircle.caster}'s circle now lasts ${Math.round(updatedCircle.remaining)} melees.`,
                          "holy"
                        );
                      }
                    }}
                    onRemove={(circleId) => {
                      const circle = activeCircles.find(c => c.id === circleId);
                      setActiveCircles(prev => prev.filter(c => c.id !== circleId));
                      if (circle) {
                        addLog(`💨 GM dispels ${circle.name} — its light fades away.`, "holy");
                      }
                    }}
                    isGM={true}
                    onClose={() => setShowCircleManager(false)}
                  />
                )}
                
                {/* Circle Recharge Panel */}
                {showCircleRecharge && currentFighter && (
                  <CircleRechargePanel
                    caster={currentFighter}
                    circles={activeCircles}
                    onRecharge={(updatedCircle, updatedCaster) => {
                      // Update circle
                      setActiveCircles(prev => 
                        prev.map(c => c.id === updatedCircle.id ? updatedCircle : c)
                      );
                      
                      // Update caster's PPE
                      if (updatedCaster) {
                        setFighters(prev => prev.map(f => 
                          f.id === updatedCaster.id ? updatedCaster : f
                        ));
                      }
                    }}
                    logCallback={addLog}
                    onClose={() => setShowCircleRecharge(false)}
                  />
                )}
                
                {/* Dual View: 2D map first, then 3D below */}
                <Flex direction="column" gap={4} width="100%" height="100%">
                  {/* 2D Tactical Map - Always mounted */}
                  <Box width="100%" minHeight="600px">
                <TacticalMap
                  combatants={fighters.map(f => ({ 
                    ...f, 
                    _id: f.id,
                    isEnemy: f.type === "enemy" 
                  }))}
                  positions={positions}
                  dangerHexes={dangerHexes}
                  onPositionChange={handlePositionChange}
                  currentTurn={currentFighter?.id}
                  highlightMovement={combatActive}
                  flashingCombatants={flashingCombatants}
                  movementMode={movementMode}
                      onMoveSelect={(x, y) => {
                        // If circle placement tool is active, set selected position
                        if (showCirclePlacementTool) {
                          setSelectedCirclePosition({ x, y });
                        } else {
                          // Normal movement selection
                          handleMoveSelect(x, y);
                        }
                      }}
                      onSelectedCombatantChange={setSelectedCombatantId}
                      onHoveredCellChange={setHoveredCell}
                      allowEmptyHexSelection={targetingMode === "OVERWATCH_HEX"}
                      onSelectedHexChange={handleSelectedHexChange}
                      terrain={mode === "MAP_EDITOR" ? mapDefinition : arenaEnvironment}
                      activeCircles={activeCircles}
                      mapType={currentMapType}
                      mode={mode}
                      mapDefinition={mapDefinition}
                      // ✅ editor paint wiring
                      selectedTerrainType={selectedTerrainType}
                      onSelectedTerrainTypeChange={setSelectedTerrainType}
                      onMapCellEdit={handleMapCellEdit}
                      onMapCellsEdit={handleMapCellsEdit}
                  visibleCells={visibleCells}
                  exploredCells={exploredCells}
                  fogEnabled={fogEnabled}
                  playerPosition={(() => {
                    // Get first player fighter position for vision cone
                    const playerFighter = fighters.find(f => f.type === "player");
                    if (playerFighter && positions[playerFighter.id]) {
                      const pos = positions[playerFighter.id];
                      return {
                        x: pos.x,
                        y: pos.y,
                        facing: pos.facing || 0,
                        visionAngle: 90,
                        lightingRange: getVisibilityRange(combatTerrain?.lighting || "BRIGHT_DAYLIGHT", false, null)
                      };
                    }
                    return null;
                  })()}
                  visibilityRange={combatTerrain?.visibilityRange || getVisibilityRange(combatTerrain?.lighting || "BRIGHT_DAYLIGHT", false, null)}
                      mapHeight={mapHeight}
                />
              </Box>

                </Flex>

                {/* Melee Round & Action Panel moved into Combat Arena - Dual View panel below */}
              </Box>
            )}

            {/* VS Separator (when map is hidden) */}
            {!showTacticalMap && fighters.length > 0 && (
              <Box 
                display="flex" 
                alignItems="center" 
                justifyContent="center"
                p={6}
              >
                <Box 
                  p={4} 
                  bg="purple.100" 
                  borderRadius="full" 
                  border="3px solid" 
                  borderColor="purple.400"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  minW="120px"
                  minH="80px"
                >
                  <VStack spacing={1}>
                    <Text fontSize="3xl" fontWeight="bold" color="purple.600">VS</Text>
                    <Text fontSize="xs" color="purple.500" textAlign="center">Battle Arena</Text>
                    {fighters.length > 0 && (
                      <Badge colorScheme="purple" size="sm">
                        {alivePlayers.length}v{aliveEnemies.length} (Alive: {alivePlayers.length} players, {aliveEnemies.length} enemies)
                      </Badge>
                    )}
                  </VStack>
                </Box>
              </Box>
            )}
            
            {/* Combat Arena - Controls Panel (2D map is shown via Show/Hide Map above) */}
            {fighters.length > 0 && (
              <Box w="100%" display="flex" justifyContent="center" mt={4} mb={4}>
                <FloatingPanel
                  title={`⚔️ Combat Arena - Controls`}
                  initialWidth={1200}
                  initialHeight={600}
                  zIndex={1000}
                  minWidth={800}
                  minHeight={400}
                  center={false}
                >
                  <VStack align="stretch" spacing={3}>
                    <HStack justify="space-between" align="center" wrap="wrap">
                      <VStack align="start" spacing={1}>
                        <Text fontSize="xs" color="gray.600">
                          Combat controls + turn flow (2D map is shown via Show/Hide Map). {currentMapType === "square" ? "⬛ (Dungeon)" : "⬡ (Wilderness)"}
                        </Text>
                        {mode === "MAP_EDITOR" && (
                          <Text fontSize="xs" color="blue.600" fontWeight="bold">
                            📝 Map Editor Mode - Edit your battlefield
                          </Text>
                        )}
                        {mode === "COMBAT" && (
                          <Text fontSize="xs" color="red.600" fontWeight="bold">
                            ⚔️ Combat Mode - Active battle
                          </Text>
                        )}
                      </VStack>
                      <HStack spacing={2}>
                        <Button
                          size="sm"
                          colorScheme={mode === "MAP_EDITOR" ? "blue" : "gray"}
                          variant={mode === "MAP_EDITOR" ? "solid" : "outline"}
                          onClick={() => setMode("MAP_EDITOR")}
                        >
                          📝 Map Editor
                        </Button>
                        <Button
                          size="sm"
                          colorScheme={mode === "COMBAT" ? "red" : "gray"}
                          variant={mode === "COMBAT" ? "solid" : "outline"}
                          onClick={() => setMode("COMBAT")}
                        >
                          ⚔️ Combat View
                        </Button>
                        <Button
                          size="sm"
                          colorScheme={showTacticalMap ? "green" : "gray"}
                          variant={showTacticalMap ? "solid" : "outline"}
                          onClick={() => setShowTacticalMap(!showTacticalMap)}
                        >
                          {showTacticalMap ? "🗺️ Hide Map" : "🗺️ Show Map"}
                        </Button>
                        <Button
                          size="sm"
                          colorScheme={show3DView ? "purple" : "gray"}
                          variant={show3DView ? "solid" : "outline"}
                          onClick={() => setShow3DView(!show3DView)}
                        >
                          {show3DView ? "🎮 Hide 3D Window" : "🎮 Show 3D Window"}
                        </Button>
                        {showTacticalMap && (
                          <Button
                            size="sm"
                            colorScheme={mapViewMode === '2D' ? "blue" : "purple"}
                            variant={mapViewMode === '2D' ? "solid" : "outline"}
                            onClick={() => setMapViewMode(mapViewMode === '2D' ? '3D' : '2D')}
                          >
                            {mapViewMode === '2D' ? "📐 2D View" : "🎮 3D View"}
                          </Button>
                        )}
                        {mode === "MAP_EDITOR" && (
                          <>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              variant="outline"
                              onClick={() => {
                                if (mapDefinition) {
                                  setCombatTerrain(mapDefinition);
                                  // Show a brief confirmation
                                  console.log("✅ Map applied to combat terrain");
                                }
                              }}
                              title="Apply your map edits to the combat arena (without starting combat)"
                            >
                              💾 Apply Map
                            </Button>
                            <Button
                              size="sm"
                              colorScheme="green"
                              onClick={startCombatFromEditor}
                              title="Apply map and start combat"
                            >
                              ▶️ Start Combat
                            </Button>
                          </>
                        )}
                      </HStack>
                    </HStack>
                    
                    {/* Turn Flow */}
                    <Flex direction="column" gap={4} width="100%" height="100%">
                      {/* Melee Round & Action Panel (below map) */}
                      {combatActive && (
                        <Box
                          p={3}
                          border="2px solid"
                          borderColor="green.300"
                          bg="green.50"
                          borderRadius="md"
                        >
                          <Flex
                            gap={4}
                            direction={{ base: "column", lg: "row" }}
                            align="stretch"
                          >
                            <Box flex="1" minW={0}>
                              <VStack align="stretch" spacing={3} fontSize="sm">
                                <Box>
                                  <Text fontWeight="bold" fontSize="lg" color="green.700">
                                    ⚔️ Melee Round {meleeRound} - {currentFighter?.name}&apos;s Action
                                  </Text>
                                  <Text fontSize="md">
                                    Initiative Order Action: <strong>{currentFighter?.name}</strong> (Initiative: {currentFighter?.initiative || 'N/A'})
                                    {currentFighter?.type === "enemy" ? " (Enemy)" : " (Player Character)"}
                                  </Text>
                                  <Text fontSize="xs" color="gray.600" fontStyle="italic">
                                    Actions alternate in initiative order until all fighters are out of actions
                                  </Text>
                                  {currentFighter && (
                                    <Text fontSize="sm" color="orange.600" fontWeight="bold" mt={2}>
                                      {formatAttacksRemaining(currentFighter.remainingAttacks || 0, currentFighter.attacksPerMelee || 2)}
                                    </Text>
                                  )}
                                  {currentFighter && isFlying(currentFighter) && (currentFighter.altitudeFeet ?? currentFighter.altitude ?? 0) > 0 && (
                                    <Text fontSize="sm" color="blue.600" fontWeight="bold" mt={1}>
                                      🦅 Airborne at {currentFighter.altitudeFeet ?? currentFighter.altitude ?? 0}ft
                                    </Text>
                                  )}
                                  {currentFighter && currentFighter.type === "player" && !aiControlEnabled && (
                                    <Text fontSize="sm" color="blue.600" fontWeight="bold" mt={1}>
                                      🎯 Combat choices available below
                                    </Text>
                                  )}
                                  {currentFighter && currentFighter.type === "player" && aiControlEnabled && (
                                    <Text fontSize="sm" color="purple.600" fontWeight="bold" mt={1}>
                                      🤖 AI-controlled player turn
                                    </Text>
                                  )}
                                  {currentFighter && currentFighter.type === "player" && selectedAction && (
                                    <Text fontSize="sm" color="green.600" fontWeight="bold" mt={1}>
                                      ✅ Ready: {selectedAction.name}
                                      {selectedTarget && ` → ${selectedTarget.name}`}
                                    </Text>
                                  )}
                                </Box>

                                {/* Palladium Movement Analysis */}
                                {currentFighter && positions[currentFighter.id] && (
                                  <Box p={2} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
                                    <MovementRangeDisplay
                                      combatant={currentFighter}
                                      position={positions[currentFighter.id]}
                                      scale={1}
                                      showVisual={false}
                                    />
                                  </Box>
                                )}

                                {/* Run Action Logger */}
                                {currentFighter &&
                                 positions[currentFighter.id] &&
                                 fighters.some(f => f.type === "enemy" && f.currentHP > 0) && (() => {
                                  const enemyTarget = fighters.find(f => f.type === "enemy" && f.currentHP > 0);
                                  return enemyTarget && positions[enemyTarget.id] ? (
                                  <Box>
                                    <RunActionLogger
                                      attacker={{...currentFighter, position: positions[currentFighter.id]}}
                                      target={{...enemyTarget, position: positions[enemyTarget.id]}}
                                      onUpdate={handleRunActionUpdate}
                                      disabled={currentFighter.type !== "player"}
                                    />
                                  </Box>
                                  ) : null;
                                })()}

                                {/* Next Turn Button */}
                                <HStack spacing={2} mt={2}>
                                  <Button
                                    size="sm"
                                    colorScheme="green"
                                    onClick={executeSelectedAction}
                                    isDisabled={
                                      combatPaused ||
                                      (aiControlEnabled && currentFighter && currentFighter.type === "player")
                                    }
                                    w="full"
                                  >
                                    {currentFighter && currentFighter.type === "player" && selectedAction
                                      ? `Execute ${selectedAction.name} →`
                                      : "Next Turn →"}
                                  </Button>
                                </HStack>
                              </VStack>
                            </Box>

                            {/* Ariel-only: show Combat Options next to the action panel (right side) */}
                            {isArielTurn && currentFighter && (
                              <Box
                                w={{ base: "100%", lg: "420px" }}
                                flexShrink={0}
                                border="2px solid"
                                borderColor="green.300"
                                bg="green.50"
                                borderRadius="md"
                                p={3}
                                overflow="hidden"
                              >
                                <Text fontWeight="bold" fontSize="md" color="green.700" mb={2}>
                                  🎯 Combat Options for {currentFighter?.name}
                                </Text>

                                <CombatActionsPanel
                                  character={currentFighter}
                                  selectedAction={selectedAction}
                                  selectedTarget={selectedTarget}
                                  availableTargets={targetOptions}
                                  onActionSelect={(action, character) => {
                                    const actionName = action?.name;
                                    if (actionName) {
                                      setSelectedAction(action);
                                      setSelectedTarget(null);
                                      setSelectedSkill(null);
                                      setSelectedGrappleAction(null);
                                    if (actionName === "Overwatch Shot") {
                                      setTargetingMode("OVERWATCH_HEX");
                                      setOverwatchTargetHex(null);
                                      addLog("🎯 Select a hex for Overwatch.", "info");
                                    } else {
                                      setTargetingMode(null);
                                    }

                                      if (actionName === "Psionics") {
                                        setPsionicsMode(true);
                                        setSpellsMode(false);
                                      } else if (actionName === "Spells") {
                                        setSpellsMode(true);
                                        setPsionicsMode(false);
                                      } else {
                                        setPsionicsMode(false);
                                        setSpellsMode(false);
                                      }

                                      addLog(`${character?.name || currentFighter?.name} selects: ${actionName}`, "info");
                                    } else {
                                      setSelectedAction(null);
                                      setSelectedTarget(null);
                                      setSelectedSkill(null);
                                      setPsionicsMode(false);
                                      setSpellsMode(false);
                                      setClericalAbilitiesMode(false);
                                      setSelectedClericalAbility(null);
                                      setTargetingMode(null);
                                    }
                                  }}
                                  onTargetSelect={(target) => {
                                    setSelectedTarget(target);
                                    if (target?.name) addLog(`Target selected: ${target.name}`, "info");
                                  }}
                                />

                                <VStack spacing={2} align="stretch" mt={3}>
                                  <Button
                                    colorScheme="blue"
                                    onClick={activateMovementMode}
                                    isDisabled={!currentFighter || currentFighter.type !== "player" || !showTacticalMap}
                                    size="sm"
                                    title={moveTitle}
                                  >
                                    {moveLabel}
                                  </Button>
                                  <Button
                                    colorScheme="orange"
                                    onClick={() => {
                                      if (currentFighter && currentFighter.type === "player") {
                                        setMovementMode({ active: true, isRunning: true });
                                        setSelectedMovementFighter(currentFighter.id);
                                        addLog(`🏃 ${currentFighter.name} prepares to run (full speed movement)`, "info");
                                      }
                                    }}
                                    isDisabled={
                                      !currentFighter ||
                                      currentFighter.type !== "player" ||
                                      !showTacticalMap ||
                                      isFloatOnly
                                    }
                                    size="sm"
                                    title={
                                      !showTacticalMap
                                        ? "Show tactical map first to enable running"
                                        : isFloatOnly
                                        ? "This creature cannot run on the ground."
                                        : "Click to activate running mode (full speed)"
                                    }
                                  >
                                    🏃 Run
                                  </Button>
                                  <Button
                                    colorScheme="purple"
                                    onClick={() => {
                                      if (currentFighter && currentFighter.type === "player") {
                                        handleWithdrawAction({
                                          currentFighter,
                                          fighters,
                                          positions,
                                          setPositions,
                                          addLog,
                                          endTurn: () => endTurn(),
                                          maxWithdrawSteps: 3,
                                        });
                                      }
                                    }}
                                    isDisabled={!currentFighter || currentFighter.type !== "player" || currentFighter.isDown}
                                    size="sm"
                                  >
                                    🏃 Withdraw
                                  </Button>
                                </VStack>
                              </Box>
                            )}
                          </Flex>
                        </Box>
                      )}
                    </Flex>
                  </VStack>
                </FloatingPanel>
              </Box>
            )}

            {/* 3D Map - Top-of-screen resizable window */}
            {show3DView && fighters.length > 0 && (
              <FloatingPanel
                title={`🎮 3D Hex Arena`}
                initialX={20}
                initialY={10}
                initialWidth={1200}
                initialHeight={700}
                zIndex={1200}
                minWidth={700}
                minHeight={450}
                bg="rgba(255, 255, 255, 0.95)"
                center={false}
              >
                <Box width="100%" height="100%">
                  <HexArena3D
                    ref={arena3DRef}
                    mapDefinition={mapDefinition}
                    fighters={fighters}
                    positions={positions}
                    renderPositions={renderPositions}
                    projectiles={projectiles}
                    dangerHexes={dangerHexes}
                    terrain={arenaEnvironment}
                    mode={mode}
                    visible={show3DView}
                  />
                </Box>
              </FloatingPanel>
            )}
          </VStack>
          </>
        }
        rightSidebar={
          <>
            {/* RIGHT COLUMN - Enemies */}
            <VStack align="start" spacing={4} h="full">
            <Heading size="md" color="red.600">👹 Enemies ({aliveEnemies.length}/{fighters.filter(f => f.type === "enemy").length})</Heading>
            <Box w="100%" maxH="300px" overflowY="auto" border="2px solid" borderColor="red.400" p={4} borderRadius="md" bg="red.50">
              {fighters.filter(f => f.type === "enemy").length === 0 ? (
                <Box color="gray.500" textAlign="center" py={8}>
                  <VStack spacing={3}>
                    <Text fontWeight="bold">No enemies added</Text>
                    <Text fontSize="sm">Click &apos;Add Enemy&apos; to add creatures from bestiary</Text>
                    <Button colorScheme="red" size="sm" onClick={onOpen}>
                      Add Enemy
                    </Button>
                  </VStack>
                </Box>
              ) : (
                <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={3}>
                {fighters.filter(f => f.type === "enemy").map((fighter, index, array) => {
                  // Check if there are multiple enemies with the same name
                  const sameNameCount = array.filter(f => f.name === fighter.name && f.currentHP > 0).length;
                  // Display with index number if duplicates exist
                  const displayName = sameNameCount > 1 
                    ? `${fighter.name} (#${array.filter(f => f.type === "enemy" && f.name === fighter.name && f.currentHP > 0).indexOf(fighter) + 1})`
                    : fighter.name;
                  
                  return (
                    <GridItem key={fighter.id}>
                    <Box 
                      key={fighter.id} 
                      p={3} 
                      mb={2} 
                      border="2px solid" 
                      borderColor={
                        fighter.currentHP <= -21 ? "black" : 
                        fighter.currentHP <= -11 ? "purple.400" : 
                        fighter.currentHP <= -1 ? "orange.400" : 
                        fighter.currentHP === 0 ? "yellow.400" : 
                        fighter.id === currentFighter?.id ? "yellow.400" : "red.400"
                      }
                      borderRadius="md"
                      bg={
                        fighter.currentHP <= -21 ? "gray.800" : 
                        fighter.currentHP <= -11 ? "purple.100" : 
                        fighter.currentHP <= -1 ? "orange.100" : 
                        fighter.currentHP === 0 ? "yellow.100" : 
                        fighter.id === currentFighter?.id ? "yellow.100" : "white"
                      }
                      shadow="sm"
                      _hover={{ shadow: "md" }}
                    >
                      <Flex justify="space-between" align="start">
                        <VStack align="start" spacing={2} flex="1" w="100%">
                          <HStack flexWrap="wrap" spacing={2}>
                            <Text fontWeight="bold" color="red.600" fontSize="md">
                              {displayName}
                            </Text>
                            {fighter.id === currentFighter?.id && <Badge colorScheme="yellow" size="md">Current Turn</Badge>}
                          {fighter.suppression?.isSuppressed &&
                            fighter.suppression?.visibleThreat && (
                              <Badge colorScheme="orange" size="md">
                                SUPPRESSED
                              </Badge>
                            )}
                            {(() => {
                              const hpStatus = getHPStatus(fighter.currentHP);
                              // Use hpStatus for consistent status display
                              if (hpStatus.status === "dead") {
                                return <Badge colorScheme="black" size="md">DEAD</Badge>;
                              } else if (hpStatus.status === "critical") {
                                return <Badge colorScheme="purple" size="md">Critical</Badge>;
                              } else if (hpStatus.status === "dying") {
                                return <Badge colorScheme="orange" size="md">Dying</Badge>;
                              } else if (hpStatus.status === "unconscious") {
                                return <Badge colorScheme="yellow" size="md">Unconscious</Badge>;
                              }
                              return null;
                            })()}
                          </HStack>

                          <HStack spacing={2} align="center">
                            <Text fontSize="xs" color="gray.600" fontWeight="bold">
                              Battle Side
                            </Text>
                            <Select
                              size="xs"
                              width="auto"
                              value={fighter.type}
                              onChange={(e) => changeFighterSide(fighter.id, e.target.value)}
                            >
                              <option value="enemy">Enemy Side</option>
                              <option value="player">Party Side</option>
                            </Select>
                          </HStack>
                          
                          {/* Type/Race and OCC */}
                          <HStack spacing={2} flexWrap="wrap">
                            {fighter.species && (
                              <Badge colorScheme="cyan" size="sm">Race: {fighter.species}</Badge>
                            )}
                            {fighter.type && fighter.type !== "enemy" && (
                              <Badge colorScheme="pink" size="sm">Type: {fighter.type}</Badge>
                            )}
                            {fighter.category && (
                              <Badge colorScheme="orange" size="sm">{fighter.category}</Badge>
                            )}
                            {fighter.OCC && (
                              <Badge colorScheme="purple" size="sm">OCC: {fighter.OCC}</Badge>
                            )}
                            {fighter.class && !fighter.OCC && (
                              <Badge colorScheme="purple" size="sm">Class: {fighter.class}</Badge>
                            )}
                            {/* ✅ Alignment Display */}
                            {(fighter.alignment || fighter.alignmentName || fighter.alignmentText) && (
                              <Badge colorScheme="gray" size="sm">
                                {fighter.alignment || fighter.alignmentName || fighter.alignmentText}
                              </Badge>
                            )}
                          </HStack>
                          
                          <Box fontSize="sm">
                            HP: {fighter.currentHP}/{fighter.maxHP} | AR: {fighter.AR || 10} | Speed: {fighter.Spd || fighter.spd || fighter.attributes?.Spd || fighter.attributes?.spd || 10}
                            {fighter.ISP !== undefined && ` | ISP: ${fighter.ISP}`}
                            {fighter.PPE !== undefined && ` | PPE: ${fighter.PPE}`}
                          </Box>
                          
                          {/* ✅ Attributes Display */}
                          {fighter.attributes && (
                            <Box fontSize="xs" color="gray.600">
                              <Text fontWeight="medium">Attributes:</Text>
                              <HStack spacing={2} flexWrap="wrap">
                                {fighter.attributes.IQ && <Text>IQ: {fighter.attributes.IQ}</Text>}
                                {fighter.attributes.ME && <Text>ME: {fighter.attributes.ME}</Text>}
                                {fighter.attributes.MA && <Text>MA: {fighter.attributes.MA}</Text>}
                                {fighter.attributes.PS && <Text>PS: {fighter.attributes.PS}</Text>}
                                {fighter.attributes.PP && <Text>PP: {fighter.attributes.PP}</Text>}
                                {fighter.attributes.PE && <Text>PE: {fighter.attributes.PE}</Text>}
                                {fighter.attributes.PB && <Text>PB: {fighter.attributes.PB}</Text>}
                                {fighter.attributes.Spd && <Text>Spd: {fighter.attributes.Spd}</Text>}
                              </HStack>
                            </Box>
                          )}
                          {/* Altitude, Stamina, and Carrying Status */}
                          <HStack spacing={2} fontSize="sm">
                            <Text>
                              🪽 Altitude: {isFlying(fighter) && (fighter.altitudeFeet ?? 0) > 0
                                ? `${fighter.altitudeFeet ?? fighter.altitude ?? 0}ft`
                                : 'Ground'}
                            </Text>
                            {(() => {
                              const fatigueStatus = getFatigueStatus(fighter);
                              if (fatigueStatus && fatigueStatus.maxStamina) {
                                const staminaColor = fatigueStatus.stamina <= 0 ? "red.700" : 
                                                     fatigueStatus.stamina < fatigueStatus.maxStamina * 0.5 ? "orange.700" : "green.700";
                                return (
                                  <Text color={staminaColor}>
                                    💪 Stamina: {fatigueStatus.stamina?.toFixed(1) || 0}/{fatigueStatus.maxStamina || 0} SP
                                    {fatigueStatus.status !== "ready" && ` (${fatigueStatus.description})`}
                                  </Text>
                                );
                              }
                              return null;
                            })()}
                            {fighter.isCarrying && fighter.carriedTargetId && (
                              <Text color="purple.700">
                                ✈️ Carrying: {fighters.find(f => f.id === fighter.carriedTargetId)?.name || 'Target'}
                              </Text>
                            )}
                          </HStack>
                          
                          {/* Combat Bonuses */}
                          {(fighter.bonuses || fighter.occBonuses) && (
                            <HStack spacing={1} flexWrap="wrap">
                              {(fighter.bonuses?.strike || fighter.occBonuses?.strike) && (
                                <Badge colorScheme="green" size="xs">Strike: +{fighter.bonuses?.strike || fighter.occBonuses?.strike}</Badge>
                              )}
                              {(fighter.bonuses?.parry || fighter.occBonuses?.parry) && (
                                <Badge colorScheme="blue" size="xs">Parry: +{fighter.bonuses?.parry || fighter.occBonuses?.parry}</Badge>
                              )}
                              {(fighter.bonuses?.dodge || fighter.occBonuses?.dodge) && (
                                <Badge colorScheme="purple" size="xs">Dodge: +{fighter.bonuses?.dodge || fighter.occBonuses?.dodge}</Badge>
                              )}
                              {(fighter.bonuses?.damage || fighter.occBonuses?.damage) && (
                                <Badge colorScheme="red" size="xs">Dmg: +{fighter.bonuses?.damage || fighter.occBonuses?.damage}</Badge>
                              )}
                              {fighter.attacksPerMelee && (
                                <Badge colorScheme="orange" size="xs">Attacks: {fighter.attacksPerMelee}/melee</Badge>
                              )}
                            </HStack>
                          )}
                          
                          {/* Skills Accordion */}
                          {fighter.occSkills && Object.keys(fighter.occSkills).length > 0 && (
                            <Accordion allowToggle w="100%" size="xs">
                              <AccordionItem border="none">
                                <AccordionButton px={0} py={1} _hover={{ bg: "transparent" }}>
                                  <Box flex="1" textAlign="left">
                                    <HStack spacing={1} flexWrap="wrap">
                                      <Text fontSize="xs" color="gray.600" fontWeight="bold">Skills:</Text>
                                      {Object.entries(fighter.occSkills).slice(0, 3).map(([skillName, skillData]) => (
                                        <Badge key={skillName} colorScheme="teal" size="xs">
                                          {skillName}: {skillData.total || skillData}%
                                        </Badge>
                                      ))}
                                      {Object.keys(fighter.occSkills).length > 3 && (
                                        <Badge colorScheme="gray" size="xs">
                                          +{Object.keys(fighter.occSkills).length - 3} more
                                        </Badge>
                                      )}
                                    </HStack>
                                  </Box>
                                  <AccordionIcon />
                                </AccordionButton>
                                <AccordionPanel pb={2} px={0}>
                                  <VStack align="start" spacing={1} maxH="200px" overflowY="auto">
                                    {Object.entries(fighter.occSkills).map(([skillName, skillData]) => (
                                      <HStack key={skillName} spacing={2} w="100%" justify="space-between">
                                        <Text fontSize="xs" fontWeight="medium">{skillName}:</Text>
                                        <Badge colorScheme="teal" size="xs">
                                          {skillData.total || skillData}%
                                        </Badge>
                                      </HStack>
                                    ))}
                                  </VStack>
                                </AccordionPanel>
                              </AccordionItem>
                            </Accordion>
                          )}
                          
                          {/* Equipment Accordion */}
                          {(fighter.equipped || fighter.equippedWeapons || fighter.equippedArmor || fighter.equippedWeapon || fighter.attacks) && (
                            <Accordion allowToggle w="100%" size="xs">
                              <AccordionItem border="none">
                                <AccordionButton px={0} py={1} _hover={{ bg: "transparent" }}>
                                  <Box flex="1" textAlign="left">
                                    <Text fontSize="xs" color="gray.600" fontWeight="bold">Equipment & Attacks</Text>
                                  </Box>
                                  <AccordionIcon />
                                </AccordionButton>
                                <AccordionPanel pb={2} px={0}>
                                  <VStack align="start" spacing={1} fontSize="xs">
                                    {(() => {
                                      // Use getWeaponDisplayInfo for consistent weapon display
                                      const weaponInfo = getWeaponDisplayInfo(fighter);
                                      return (
                                        <>
                                          {fighter.equippedWeapon && (
                                            <HStack spacing={2}>
                                              <Text fontWeight="medium">Weapon:</Text>
                                              <Text>{fighter.equippedWeapon}</Text>
                                            </HStack>
                                          )}
                                          {weaponInfo.hasWeapons && (
                                            <Box>
                                              <Text fontWeight="medium">Weapons:</Text>
                                              {weaponInfo.rightHand.name !== "Unarmed" && (
                                                <Text pl={2}>• Right: {weaponInfo.rightHand.name} ({weaponInfo.rightHand.damage})</Text>
                                              )}
                                              {weaponInfo.leftHand.name !== "Unarmed" && (
                                                <Text pl={2}>• Left: {weaponInfo.leftHand.name} ({weaponInfo.leftHand.damage})</Text>
                                              )}
                                            </Box>
                                          )}
                                          {!weaponInfo.hasWeapons && fighter.equippedWeapons && fighter.equippedWeapons.length > 0 && (
                                            <Box>
                                              <Text fontWeight="medium">Weapons:</Text>
                                              {fighter.equippedWeapons.map((w, idx) => (
                                                <Text key={idx} pl={2}>• {w.name || w}</Text>
                                              ))}
                                            </Box>
                                          )}
                                        </>
                                      );
                                    })()}
                                    {fighter.attacks && fighter.attacks.length > 0 && (
                                      <Box>
                                        <Text fontWeight="medium">Attacks:</Text>
                                        {fighter.attacks.map((attack, idx) => (
                                          <Text key={idx} pl={2}>• {attack.name || attack} {attack.damage && `(${attack.damage})`}</Text>
                                        ))}
                                      </Box>
                                    )}
                                    {/* ✅ Armor Display */}
                                    {(fighter.equippedArmor || fighter.AR) && (
                                      <Box>
                                        <Text fontWeight="medium">Armor:</Text>
                                        {fighter.equippedArmor ? (
                                          <Text pl={2}>• {fighter.equippedArmor.name || fighter.equippedArmor} (AR: {fighter.AR || 10})</Text>
                                        ) : (
                                          <Text pl={2}>• AR: {fighter.AR || 10}</Text>
                                        )}
                                      </Box>
                                    )}
                                    
                                    {/* ✅ Ammo Display */}
                                    {(() => {
                                      const invAmmo =
                                        fighter.inventory?.filter(
                                          (item) =>
                                            item?.type === "ammunition" ||
                                            (item?.name &&
                                              (item.name.toLowerCase().includes("arrow") ||
                                                item.name.toLowerCase().includes("bolt") ||
                                                item.name.toLowerCase().includes("bullet")))
                                        ) || [];
                                      const improvised = getImprovisedAmmoSummaryForFighter(fighter.id);
                                      if (invAmmo.length === 0 && !improvised) return null;
                                      return (
                                        <Box>
                                          <Text fontWeight="medium">Ammunition:</Text>
                                          {invAmmo.map((item, idx) => (
                                            <Text key={idx} pl={2}>
                                              • {item.name}: {item.quantity || 0}
                                            </Text>
                                          ))}
                                          {improvised && (
                                            <Text pl={2}>
                                              • Improvised missiles: {improvised.qty} ({improvised.details})
                                            </Text>
                                          )}
                                        </Box>
                                      );
                                    })()}
                                    {fighter.equipped && (
                                      <Box>
                                        <Text fontWeight="medium">Other:</Text>
                                        {Object.entries(fighter.equipped).filter(([key, val]) => val && key !== 'weapon' && key !== 'armor').map(([key, val]) => (
                                          <Text key={key} pl={2}>• {key}: {val.name || val}</Text>
                                        ))}
                                      </Box>
                                    )}
                                  </VStack>
                                </AccordionPanel>
                              </AccordionItem>
                            </Accordion>
                          )}
                          
                          {fighter.initiative > 0 && (
                            <Badge colorScheme="purple" size="sm">
                              Initiative: {fighter.initiative}
                            </Badge>
                          )}
                        </VStack>
                        <Button size="sm" colorScheme="red" variant="outline" onClick={() => removeFighter(fighter.id)}>
                          ✕
                        </Button>
                      </Flex>
                    </Box>
                    </GridItem>
                  );
                })}
                </Grid>
              )}
            </Box>
            {/* Combat Info Panel */}
            <Box
              w="100%"
              border="2px solid"
              borderColor="blue.400"
              borderRadius="md"
              bg="white"
              p={3}
              maxH="700px"
              overflow="hidden"
            >
              <Heading size="sm" color="blue.700" mb={2}>
                📊 Combat Info
              </Heading>
              <Tabs size="sm" colorScheme="blue" isLazy>
                <TabList>
                  <Tab fontSize="xs">🗒️ Log</Tab>
                  <Tab fontSize="xs">⚔️ Fighter</Tab>
                  <Tab fontSize="xs">📦 Inventory</Tab>
                  <Tab fontSize="xs">📍 Positions</Tab>
                  <Tab fontSize="xs">⬡ Legend</Tab>
                  <Tab fontSize="xs">🔧 Debug</Tab>
                </TabList>
                <TabPanels>
                  {/* Combat Log Tab */}
                  <TabPanel p={2}>
                    <VStack align="stretch" spacing={2}>
                      {/* Log Control Buttons */}
                      <HStack spacing={2} flexWrap="wrap">
                        <Button 
                          size="xs" 
                  colorScheme={showRollDetails ? "blue" : "gray"}
                  onClick={() => setShowRollDetails(!showRollDetails)}
                >
                  🎲 {showRollDetails ? "Hide" : "Show"} Dice Details
                </Button>
                <Select
                          size="xs"
                          width="120px"
                          value={logFilterType || "all"}
                          onChange={(e) => setLogFilterType(e.target.value)}
                        >
                          <option value="all">All Types</option>
                          <option value="hit">Hits</option>
                          <option value="miss">Misses</option>
                          <option value="critical">Critical</option>
                          <option value="victory">Victory</option>
                          <option value="defeat">Defeat</option>
                          <option value="info">Info</option>
                          <option value="combat">Combat</option>
                          <option value="error">Errors</option>
                        </Select>
                        <Select
                          size="xs"
                          width="120px"
                          value={logSortOrder || "newest"}
                          onChange={(e) => setLogSortOrder(e.target.value)}
                        >
                          <option value="newest">Newest First</option>
                          <option value="oldest">Oldest First</option>
                        </Select>
                <Button 
                          size="xs" 
                  colorScheme="green"
                  onClick={() => {
                    const logText = log.map(entry => `[${entry.timestamp}] ${entry.message}`).join('\n');
                    navigator.clipboard.writeText(logText);
                    alert('Combat log copied to clipboard!');
                  }}
                >
                  📋 Copy Log
                </Button>
                        <Button 
                          size="xs" 
                          onClick={() => {
                  setLog([]);
                  setDiceRolls([]);
                          }}
                        >
                  Clear All
                </Button>
              </HStack>
              
                      {/* Combat Log & Dice Rolls */}
              <Box 
                        ref={detailedCombatLogRef}
                        flex="1"
                        minH="300px"
                        maxH="500px"
                border="1px solid" 
                borderColor="gray.200" 
                        p={3} 
                borderRadius="md"
                overflowY="auto"
                bg="gray.50"
              >
                {log.length === 0 && diceRolls.length === 0 ? (
                          <Text color="gray.500" fontSize="xs">Combat log and dice rolls will appear here...</Text>
                ) : (
                          <VStack align="stretch" spacing={2}>
                            {/* Display dice rolls if available */}
                            {diceRolls.length > 0 && (
                              <Box p={2} bg="purple.50" borderRadius="md" borderWidth="1px" borderColor="purple.200">
                                <Text fontSize="xs" fontWeight="bold" color="purple.700" mb={1}>
                                  🎲 Recent Dice Rolls
                                </Text>
                                <VStack align="stretch" spacing={1}>
                                  {diceRolls.slice(-10).reverse().map((roll) => (
                                    <Text key={roll.id} fontSize="xs" color="purple.600">
                                      [{roll.timestamp}] {roll.type === 'attack' ? '⚔️' : '🛡️'} {roll.type === 'attack' ? roll.attacker : roll.defender}: {roll.roll} + {roll.bonus} = {roll.total}
                                    </Text>
                                  ))}
                                </VStack>
                              </Box>
                            )}
                            {(() => {
                              // Filter and sort log entries
                              let filteredLog = [...log];
                              
                              // Filter by type
                              if (logFilterType !== "all") {
                                filteredLog = filteredLog.filter(entry => entry.type === logFilterType);
                              }
                              
                              // Sort by timestamp
                              // Note: log array has newest entries at index 0 (added with [logEntry, ...prev])
                              if (logSortOrder === "oldest") {
                                // Oldest first - reverse the array to put oldest at the beginning
                                filteredLog.reverse();
                              } else {
                                // Newest first (default) - log already has newest at index 0, no need to reverse
                                // filteredLog is already in newest-first order
                              }
                              
                              return filteredLog;
                            })().map((entry) => (
                              <Box key={entry.id}>
                      <Text 
                                  fontSize="xs" 
                        color={getLogColor(entry.type)}
                        fontWeight="bold"
                      >
                        [{entry.timestamp}] {entry.message}
                      </Text>
                      
                      {entry.diceInfo && showRollDetails && (
                                  <Box ml={4} mt={1} p={2} bg="white" borderRadius="md" border="1px" borderColor="gray.300">
                          <VStack align="start" spacing={1}>
                            <Text fontSize="xs" color="purple.600" fontWeight="bold">
                              🎲 {entry.diceInfo.action} Details:
                            </Text>
                            {entry.diceInfo.action === "Initiative" && (
                              <Text as="span" fontSize="xs" color="gray.700">
                                Speed: {entry.diceInfo.rollDetails.diceRoll}, 
                                Total: {entry.diceInfo.rollDetails.total}
                              </Text>
                            )}
                            {entry.diceInfo.action === "Attack Roll" && (
                              <Text as="span" fontSize="xs" color="gray.700">
                                Strike Bonus: {entry.diceInfo.rollDetails.strikeBonus}, 
                                d20: {entry.diceInfo.rollDetails.d20}, 
                                Total: {entry.diceInfo.rollDetails.total}
                              </Text>
                            )}
                            {entry.diceInfo.action === "Damage Roll" && (
                              <VStack align="start" spacing={1}>
                                <Text as="span" fontSize="xs" color="gray.700">
                                  Damage Formula: {entry.diceInfo.rollDetails.damageFormula}
                                </Text>
                                <Text as="span" fontSize="xs" color="gray.700">
                                  Individual Rolls: {entry.diceInfo.rollDetails.individualRolls.join(", ")}
                                </Text>
                                <Text as="span" fontSize="xs" color="gray.700">
                                  Dice Total: {entry.diceInfo.rollDetails.diceTotal}
                                </Text>
                                <Text as="span" fontSize="xs" color="gray.700">
                                  Damage Bonus: {entry.diceInfo.rollDetails.damageBonus}
                                </Text>
                                <Text as="span" fontSize="xs" color="red.600" fontWeight="bold">
                                  Final Damage: {entry.diceInfo.rollDetails.totalDamage}
                                </Text>
                              </VStack>
                            )}
                            <Text as="span" fontSize="xs" color="gray.500" fontStyle="italic">
                              Source: {entry.diceInfo.attacker || entry.diceInfo.character}
                            </Text>
                            {entry.diceInfo.weapon && (
                              <Text as="span" fontSize="xs" color="gray.600">
                                Weapon: {entry.diceInfo.weapon}
                              </Text>
                            )}
                          </VStack>
                        </Box>
                      )}
                    </Box>
                            ))}
                          </VStack>
                )}
            </Box>
          </VStack>
                  </TabPanel>

                  {/* Combat Inventory Tab */}
                  <TabPanel p={2}>
                    <VStack align="stretch" spacing={3}>
                      <Text fontSize="xs" color="gray.600">
                        Read-only snapshot of what each combatant is carrying right now (plus improvised ammo picked up in the arena).
                      </Text>

                      {["player", "enemy"].map((side) => {
                        const list = fighters.filter((f) => f.type === side);
                        const title = side === "player" ? "Party" : "Enemies";
                        return (
                          <Box key={side} borderWidth="1px" borderColor="gray.200" borderRadius="md" p={2} bg="white">
                            <HStack justify="space-between" mb={2}>
                              <Text fontSize="sm" fontWeight="bold">{title}</Text>
                              <Badge colorScheme={side === "player" ? "blue" : "red"} size="sm">
                                {list.length}
                              </Badge>
                            </HStack>

                            {list.length === 0 ? (
                              <Text fontSize="xs" color="gray.500">None</Text>
                            ) : (
                              <Accordion allowMultiple size="sm">
                                {list.map((f) => {
                                  const inv = Array.isArray(f.inventory) ? f.inventory : [];
                                  const improvised = getImprovisedAmmoSummaryForFighter(f.id);
                                  const hasAny = inv.length > 0 || Boolean(improvised);
                                  return (
                                    <AccordionItem key={f.id} border="none">
                                      <AccordionButton px={0}>
                                        <Box flex="1" textAlign="left">
                                          <HStack spacing={2}>
                                            <Text fontSize="sm" fontWeight="semibold">{f.name}</Text>
                                            <Badge colorScheme={side === "player" ? "blue" : "red"} size="xs">
                                              {side}
                                            </Badge>
                                            {improvised && (
                                              <Badge colorScheme="orange" size="xs">
                                                Improvised: {improvised.qty}
                                              </Badge>
                                            )}
                                          </HStack>
                                        </Box>
                                        <AccordionIcon />
                                      </AccordionButton>
                                      <AccordionPanel px={0} pt={1} pb={2}>
                                        {!hasAny ? (
                                          <Text fontSize="xs" color="gray.500">No inventory items.</Text>
                                        ) : (
                                          <VStack align="stretch" spacing={1}>
                                            {improvised && (
                                              <Box p={2} bg="orange.50" borderWidth="1px" borderColor="orange.200" borderRadius="md">
                                                <Text fontSize="xs" fontWeight="bold" color="orange.700">
                                                  Improvised missiles
                                                </Text>
                                                <Text fontSize="xs">
                                                  Qty: {improvised.qty} ({improvised.details})
                                                </Text>
                                              </Box>
                                            )}

                                            {inv.length > 0 && (
                                              <Box borderWidth="1px" borderColor="gray.100" borderRadius="md" overflow="hidden">
                                                <Table size="xs" variant="simple">
                                                  <Thead>
                                                    <Tr>
                                                      <Th>Item</Th>
                                                      <Th>Type</Th>
                                                      <Th isNumeric>Qty</Th>
                                                    </Tr>
                                                  </Thead>
                                                  <Tbody>
                                                    {inv.map((it, idx) => (
                                                      <Tr key={idx}>
                                                        <Td>{it?.name || "Item"}</Td>
                                                        <Td>{it?.type || it?.category || "-"}</Td>
                                                        <Td isNumeric>{it?.quantity ?? it?.qty ?? "-"}</Td>
                                                      </Tr>
                                                    ))}
                                                  </Tbody>
                                                </Table>
                                              </Box>
                                            )}
                                          </VStack>
                                        )}
                                      </AccordionPanel>
                                    </AccordionItem>
                                  );
                                })}
                              </Accordion>
                            )}
                          </Box>
                        );
                      })}
                    </VStack>
                  </TabPanel>

                  {/* Current Fighter Tab */}
                  <TabPanel p={2}>
                    {currentFighter ? (
                      <VStack align="stretch" spacing={3} fontSize="xs">
                        <Box>
                          <Text fontWeight="bold" fontSize="sm">Name:</Text>
                          <Text>{currentFighter.name}</Text>
                </Box>
                        <Box>
                          <Text fontWeight="bold" fontSize="sm">HP:</Text>
                          <Text>
                            {currentFighter.currentHP} / {currentFighter.maxHP || "?"}
                          </Text>
                        </Box>
                        {currentFighter.type && (
                          <Box>
                            <Text fontWeight="bold" fontSize="sm">Type:</Text>
                            <Badge colorScheme={currentFighter.type === "player" ? "blue" : "red"} size="sm">
                              {currentFighter.type === "player" ? "Player" : "Enemy"}
                            </Badge>
                          </Box>
                        )}
                        {positions[currentFighter.id] && (
                          <Box>
                            <Text fontWeight="bold" fontSize="sm">Position:</Text>
                            <Text>
                              x: {positions[currentFighter.id].x}, y: {positions[currentFighter.id].y}
                            </Text>
                          </Box>
                        )}
                        <Box>
                          <Text fontWeight="bold" fontSize="sm">🪽 Altitude:</Text>
                          <Text>
                            {isFlying(currentFighter) && (currentFighter.altitudeFeet ?? 0) > 0
                              ? `${currentFighter.altitudeFeet ?? currentFighter.altitude ?? 0}ft`
                              : 'Ground'}
                          </Text>
                        </Box>
                        {currentFighter.isCarrying && currentFighter.carriedTargetId && (
                          <Box>
                            <Text fontWeight="bold" fontSize="sm">✈️ Carrying:</Text>
                            <Text>
                              {fighters.find(f => f.id === currentFighter.carriedTargetId)?.name || 'Target'}
                            </Text>
                          </Box>
                        )}
                        {currentFighter.remainingAttacks !== undefined && (
                          <Box>
                            <Text fontWeight="bold" fontSize="sm">Actions:</Text>
                            <Text>
                              {formatAttacksRemaining(currentFighter.remainingAttacks || 0, currentFighter.attacksPerMelee || 2)}
                            </Text>
                          </Box>
                        )}
                      </VStack>
                    ) : (
                      <Text color="gray.500" fontSize="xs">No active fighter</Text>
                    )}
                  </TabPanel>

                  {/* Combatant Positions Tab */}
                  <TabPanel p={2}>
                    <VStack align="stretch" spacing={1} maxH="500px" overflowY="auto">
                      {fighters.map((fighter) => {
                        const pos = positions[fighter.id];
                        const speed = fighter.Spd || fighter.spd || fighter.attributes?.Spd || fighter.attributes?.spd || 10;
                        
                        // Calculate distance to closest enemy/ally
                        let closestDistance = Infinity;
                        let closestName = "";
                        for (const other of fighters) {
                          if (other.id === fighter.id) continue;
                          if (other.type === fighter.type) continue; // Same team
                          if (positions[other.id]) {
                            const dist = calculateDistance(pos || {x: 0, y: 0}, positions[other.id]);
                            if (dist < closestDistance) {
                              closestDistance = dist;
                              closestName = other.name;
                            }
                          }
                        }
                        const distInfo = closestDistance !== Infinity ? {
                          distance: Math.round(closestDistance),
                          target: closestName,
                          range: getEngagementRange(closestDistance)
                        } : null;
                  
                  return (
                          <HStack
                      key={fighter.id} 
                            justify="space-between"
                            p={2}
                            bg={fighter.id === currentFighter?.id ? "blue.100" : "white"}
                      borderRadius="md"
                            _hover={{ bg: "gray.100" }}
                          >
                            <HStack spacing={2} flex={1}>
                              <Text fontSize="sm" fontWeight="bold">
                                {fighter.type === "enemy" ? "🗡️" : "🛡️"} {fighter.name}
                            </Text>
                              {fighter.id === currentFighter?.id && (
                                <Badge colorScheme="green" size="sm">Current Turn</Badge>
                              )}
                          </HStack>
                            <HStack spacing={2} fontSize="xs">
                              {pos && (
                                <Badge colorScheme="gray">
                                  ({pos.x}, {pos.y})
                            </Badge>
                          )}
                              {distInfo && (
                                <>
                                  <Badge colorScheme={distInfo.range.canMeleeAttack ? "red" : "blue"}>
                                    {distInfo.distance}ft to {distInfo.target}
                                  </Badge>
                                  <Badge colorScheme="purple">
                                    {distInfo.range.name}
                                  </Badge>
                                </>
                              )}
                              <Badge colorScheme="cyan">
                                Spd: {speed}
                              </Badge>
                            </HStack>
                          </HStack>
                  );
                      })}
                    </VStack>
                  </TabPanel>
            
                  {/* Map Legend Tab */}
                  <TabPanel p={2}>
                    <VStack align="stretch" spacing={3} fontSize="xs">
                      <HStack justify="space-between">
                        <HStack>
                          <Box w="16px" h="16px" bg="cyan.400" borderRadius="sm" />
                          <Text>🛡️ Ally</Text>
            </HStack>
                        <HStack>
                          <Box w="16px" h="16px" bg="red.400" borderRadius="sm" />
                          <Text>🗡️ Enemy</Text>
                        </HStack>
                      </HStack>
                      <HStack justify="space-between">
                        <HStack>
                          <Box w="16px" h="16px" bg="green.400" borderRadius="sm" />
                          <Text>⚡ Current Turn</Text>
                        </HStack>
                        <HStack>
                          <Box w="16px" h="16px" bg="blue.400" borderRadius="sm" />
                          <Text>📍 Selected</Text>
                        </HStack>
                      </HStack>
                      <Divider />
                      <HStack justify="space-between">
                        <HStack>
                          <Box w="16px" h="16px" bg="green.100" borderRadius="sm" />
                          <Text>✅ 1 Action (15s)</Text>
                        </HStack>
                        <HStack>
                          <Box w="16px" h="16px" bg="yellow.100" borderRadius="sm" />
                          <Text>⚡ 2 Actions (30s)</Text>
                        </HStack>
                      </HStack>
                      <HStack justify="space-between">
                        <HStack>
                          <Box w="16px" h="16px" bg="orange.100" borderRadius="sm" />
                          <Text>🔥 3 Actions (45s)</Text>
                        </HStack>
                        <HStack>
                          <Box w="16px" h="16px" bg="red.100" borderRadius="sm" />
                          <Text>💥 4 Actions (60s)</Text>
                        </HStack>
                      </HStack>
                      <Divider />
                      <Text fontStyle="italic" color="gray.600" fontSize="xs">
                        {currentMapType === "square" 
                          ? "⬛ Square grid - standard for dungeon corridors and rooms" 
                          : "⬡ Hexagonal grid allows diagonal movement naturally"}
                      </Text>
          </VStack>
                  </TabPanel>

                  {/* Debug Info Tab */}
                  <TabPanel p={2}>
                    <VStack align="stretch" spacing={3}>
                      <VStack align="stretch" spacing={2} fontSize="xs" fontFamily="mono">
                        <Box>
                          <Text fontWeight="bold">Round:</Text>
                          <Text>{meleeRound}</Text>
                        </Box>
                        <Box>
                          <Text fontWeight="bold">Turn:</Text>
                          <Text>{turnIndex + 1} / {fighters.length}</Text>
                        </Box>
                        <Box>
                          <Text fontWeight="bold">Fighters:</Text>
                          <Text>
                            {fighters.filter(f => f.type === "player").length} players,{" "}
                            {fighters.filter(f => f.type === "enemy").length} enemies
                          </Text>
                        </Box>
                        <Box>
                          <Text fontWeight="bold">Combat Active:</Text>
                          <Badge colorScheme={combatActive ? "green" : "gray"} size="sm">
                            {combatActive ? "Yes" : "No"}
                          </Badge>
                        </Box>
                        {combatTerrain && (
                          <>
                            <Box>
                              <Text fontWeight="bold">🌲 Terrain:</Text>
                              <Text fontSize="xs">{combatTerrain.terrainData?.name || combatTerrain.terrain}</Text>
                            </Box>
                            <Box>
                              <Text fontWeight="bold">💡 Lighting:</Text>
                              <Text fontSize="xs">{combatTerrain.lightingData?.name || combatTerrain.lighting}</Text>
                            </Box>
                            {combatTerrain.description && (
                              <Box>
                                <Text fontWeight="bold">📝 Scene:</Text>
                                <Text fontSize="xs">{combatTerrain.description}</Text>
                              </Box>
                            )}
                          </>
                        )}
                      </VStack>
                      
                      {/* AI Weakness / Threat Debug */}
                      <WeaknessDebugHUD fighters={fighters} />
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </Box>

            {/* Quick Add Enemy Button */}
            <HStack spacing={2}>
              <Button
                size="sm"
                colorScheme="red"
                variant="outline"
                onClick={onOpen}
              >
                + Enemy
              </Button>
            </HStack>
          </VStack>
          </>
        }
      >
      </ResizableLayout>

      {/* Add Enemy Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Enemy to Combat</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl mb={4}>
              <FormLabel>Filter by Type:</FormLabel>
              <Select
                value={creatureTypeFilter}
                onChange={(e) => setCreatureTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                {creatureTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {formatCreatureCategory(type)}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl mb={4}>
              <FormLabel>Sort Creatures By:</FormLabel>
              <Select
                value={enemySortMode}
                onChange={(e) => setEnemySortMode(e.target.value)}
              >
                <option value="type">Creature Type</option>
                <option value="name">Name (A-Z)</option>
              </Select>
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Select Creature from Bestiary:</FormLabel>
              <Select 
                placeholder="Choose a creature..." 
                value={selectedCreature}
                onChange={(e) => setSelectedCreature(e.target.value)}
              >
                {sortedCreatures.map((creature) => (
                  <option key={creature.id} value={creature.id}>
                    {creature.name} ({formatCreatureCategory(creature.category)}){creature.playable ? " [PLAYABLE]" : ""}
                  </option>
                ))}
              </Select>
            </FormControl>
            
            <FormControl mb={4}>
              <FormLabel>Custom Name (optional):</FormLabel>
              <Input 
                placeholder="Leave blank to use creature's default name"
                value={customEnemyName}
                onChange={(e) => setCustomEnemyName(e.target.value)}
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Level (1-15):</FormLabel>
              <Input
                type="number"
                min="1"
                max="15"
                value={enemyLevel}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 1;
                  setEnemyLevel(Math.max(1, Math.min(15, val)));
                }}
                placeholder="1"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Level affects HP (+10% per level), AR (+1 per 3 levels), and combat bonuses (+1 per 2 levels).
              </Text>
            </FormControl>

            {/* Armor Selection - Only show for humanoids */}
            {isSelectedHumanoid && (
              <FormControl mb={4}>
                <FormLabel>Armor (Humanoid Only):</FormLabel>
                <Select
                  placeholder="Select armor (optional)"
                  value={selectedArmor}
                  onChange={(e) => setSelectedArmor(e.target.value)}
                >
                  {availableArmors.map((armor) => (
                    <option key={armor.name} value={armor.name}>
                      {armor.name} {armor.name !== "None" ? `(AR: ${armor.ar}, SDC: ${armor.sdc})` : ""}
                    </option>
                  ))}
                </Select>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Select armor to equip. Armor AR replaces base AR if higher.
                </Text>
              </FormControl>
            )}

            {/* Weapon Selection - Show for humanoids OR creatures with natural attacks */}
            {(isSelectedHumanoid || (selectedCreatureData && selectedCreatureData.attacks && Array.isArray(selectedCreatureData.attacks) && selectedCreatureData.attacks.some(a => a.name && a.damage !== "by spell" && a.damage !== "varies"))) && (
              <FormControl mb={4}>
                <FormLabel>{isSelectedHumanoid ? "Weapon (Humanoid Only):" : "Natural Attack:"}</FormLabel>
                <Select
                  placeholder="Select weapon (optional)"
                  value={selectedWeapon}
                  onChange={(e) => {
                    setSelectedWeapon(e.target.value);
                    // Reset ammo count when weapon changes
                    if (e.target.value === "None" || !availableWeapons.find(w => w.name === e.target.value)?.ammunition) {
                      setSelectedAmmoCount(0);
                    }
                  }}
                >
                  {availableWeapons.map((weapon) => (
                    <option key={weapon.name} value={weapon.name}>
                      {weapon.name} {weapon.name !== "None" ? `(${weapon.damage || "N/A"} damage${weapon.ammunition ? `, needs ${weapon.ammunition}` : ""})` : ""}
                    </option>
                  ))}
                </Select>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {isSelectedHumanoid 
                    ? "Select weapon to equip. Leave as \"None\" to use default weapon assignment."
                    : "Select natural attack to use. Leave as \"None\" to use default attack assignment."}
                </Text>
              </FormControl>
            )}

            {/* Ammo Selection - Only show for ranged weapons that require ammo */}
            {isSelectedHumanoid && selectedWeaponRequiresAmmo && (
              <FormControl mb={4}>
                <FormLabel>Ammunition Count:</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={selectedAmmoCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setSelectedAmmoCount(Math.max(0, val));
                  }}
                  placeholder="0"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Amount of {availableWeapons.find(w => w.name === selectedWeapon)?.ammunition || "ammunition"} to give this enemy.
                </Text>
              </FormControl>
            )}

            <FormControl mb={4}>
              <FormLabel>Number of Enemies (1-10):</FormLabel>
              <Input
                type="number"
                min="1"
                max="10"
                value={enemyCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 1;
                  setEnemyCount(Math.max(1, Math.min(10, val)));
                }}
                placeholder="1"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                You can add up to 10 enemies at once. Multiple enemies will be numbered (e.g., &quot;Goblin #1&quot;, &quot;Goblin #2&quot;).
              </Text>
            </FormControl>

            {selectedCreature && (
              <Box mb={4} p={3} border="1px solid" borderColor="gray.200" borderRadius="md">
                <Text fontWeight="bold" mb={2}>Creature Preview:</Text>
                {(() => {
                  const creature = selectedCreatureData;
                  return creature ? (
                    <VStack align="start" spacing={1}>
                      {creature.playable ? (
                        <>
                          <Text fontSize="sm" color="blue.500">🎲 PLAYABLE CHARACTER - Auto-rolls attributes!</Text>
                          <Text fontSize="sm">Race: {creature.race || "N/A"}</Text>
                          <Text fontSize="sm">Class: {creature.occ || "N/A"}</Text>
                          <Text fontSize="sm">Attributes: {Object.entries(creature.attribute_dice || {}).map(([attr, dice]) => `${attr}: ${dice}`).join(", ")}</Text>
                          <Text fontSize="sm">HP: {creature.HP || "Variable (based on PE)"}</Text>
                          <Text fontSize="sm">AR: {creature.AR || "Variable (based on class/PE)"}</Text>
                          <Text fontSize="sm">Speed: {creature.spd || "Variable (based on Spd roll)"}</Text>
                      <Text fontSize="sm">Type: {formatCreatureCategory(creature.category)}</Text>
                          <Text fontSize="sm">Magic: {creature.magic || "None"}</Text>
                          <Text fontSize="sm">Psionics: {creature.psionics || "None"}</Text>
                        </>
                      ) : (
                        <>
                      <Text fontSize="sm">Type: {formatCreatureCategory(creature.category)}</Text>
                          <Text fontSize="sm">HP: {creature.HP}</Text>
                          <Text fontSize="sm">AR: {creature.AR}</Text>
                          <Text fontSize="sm">Speed: {creature.spd}</Text>
                          <Text fontSize="sm">Attacks: {creature.attacks?.map(a => a.name).join(", ")}</Text>
                        </>
                      )}
                    </VStack>
                  ) : null;
                })()}
              </Box>
            )}

            <HStack>
              <Button 
                colorScheme="blue" 
                onClick={() => {
                  const creature = selectedCreatureData;
                  if (creature) {
                    if (enemyCount === 1) {
                      // Single enemy - use original function
                      addCreature(creature, null, enemyLevel, selectedArmor, selectedWeapon, selectedAmmoCount);
                      setCustomEnemyName("");
                      setSelectedCreature("");
                      setEnemyLevel(1); // Reset level
                      setSelectedArmor(""); // Reset armor
                      setSelectedWeapon(""); // Reset weapon
                      setSelectedAmmoCount(0); // Reset ammo
                      onClose();
                    } else {
                      // Multiple enemies - use new function
                      addMultipleEnemies(creature, enemyCount, enemyLevel, selectedArmor, selectedWeapon, selectedAmmoCount);
                    }
                  }
                }}
                isDisabled={!selectedCreatureData || enemyCount < 1 || enemyCount > 10}
              >
                {enemyCount === 1 ? "Add to Combat" : `Add ${enemyCount} to Combat`}
              </Button>
              <Button onClick={onClose}>Cancel</Button>
            </HStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Party Selection Modal */}
      <Modal isOpen={isPartyOpen || showPartySelector} onClose={() => { onPartyClose(); setShowPartySelector(false); }} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Choose Your Party</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Text mb={4} color="gray.600">
              Select which characters will participate in combat. You can choose any number of characters.
            </Text>
            
            {characters.length === 0 ? (
              <Alert status="info">
                <AlertIcon />
                No characters available. Create some characters first!
              </Alert>
            ) : (
              <VStack spacing={3} align="stretch">
                {characters.map((character) => (
                  <Box
                    key={character._id}
                    p={3}
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="md"
                    cursor="pointer"
                    bg={selectedParty.some(c => c._id === character._id) ? "blue.50" : "white"}
                    _hover={{ bg: "gray.50" }}
                    onClick={() => {
                      const isSelected = selectedParty.some(c => c._id === character._id);
                      if (isSelected) {
                        setSelectedParty(prev => prev.filter(c => c._id !== character._id));
                      } else {
                        setSelectedParty(prev => [...prev, character]);
                      }
                    }}
                  >
                    <HStack justify="space-between">
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold">{character.name}</Text>
                        <Text fontSize="sm" color="gray.600">
                          {character.occ} • Level {character.level || 1} • HP: {character.derived?.hitPoints || character.hp || character.HP || 20} • 
                          AR: {character.AR || 10} • Speed: {character.Spd || character.spd || character.attributes?.Spd || character.attributes?.spd || 10}
                        </Text>
                        {character.attributes && Object.entries(character.attributes).slice(0, 4).map(([attr, value]) => (
                          <Badge key={attr} size="sm" colorScheme="blue">
                            {attr}: {value}
                          </Badge>
                        ))}
                        {/* Show level-up bonuses if available */}
                        {character.derived?.occBonuses && (
                          <HStack spacing={1} flexWrap="wrap">
                            {character.derived.occBonuses.strike && (
                              <Badge colorScheme="green" size="xs">Strike: +{character.derived.occBonuses.strike}</Badge>
                            )}
                            {character.derived.occBonuses.parry && (
                              <Badge colorScheme="blue" size="xs">Parry: +{character.derived.occBonuses.parry}</Badge>
                            )}
                            {character.derived.occBonuses.dodge && (
                              <Badge colorScheme="purple" size="xs">Dodge: +{character.derived.occBonuses.dodge}</Badge>
                            )}
                            {character.derived.attacksPerMelee && (
                              <Badge colorScheme="orange" size="xs">Attacks: {character.derived.attacksPerMelee}/melee</Badge>
                            )}
                          </HStack>
                        )}
                      </VStack>
                      <Box>
                        {selectedParty.some(c => c._id === character._id) ? (
                          <Badge colorScheme="green" variant="solid">Selected</Badge>
                        ) : (
                          <Badge colorScheme="gray" variant="outline">Available</Badge>
                        )}
                      </Box>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </ModalBody>

          <ModalFooter>
            <HStack>
              <Button 
                colorScheme="blue" 
                onClick={() => selectParty(selectedParty)}
                isDisabled={selectedParty.length === 0}
              >
                Confirm Party
              </Button>
              <Button onClick={onPartyClose}>
                Cancel
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {/* Weapon Selection Modal */}
      <Modal isOpen={showWeaponModal} onClose={() => setShowWeaponModal(false)} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Select Weapon from Inventory</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={3} align="stretch">
              {selectedWeaponSlot && (() => {
                const fighter = fighters.find(f => f.id === selectedWeaponSlot.fighterId);
                const currentSlot = fighter?.equippedWeapons?.[selectedWeaponSlot.slotIndex];
                const isSlotDisabled = currentSlot?.disabled;
                
                // If slot is disabled, show message instead of weapon list
                if (isSlotDisabled) {
                  return (
                    <Alert status="warning">
                      <AlertIcon />
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm" fontWeight="bold">
                          This slot is occupied by a two-handed weapon
                        </Text>
                        <Text fontSize="xs">
                          Change the right hand weapon first to free this slot.
                        </Text>
                      </VStack>
                    </Alert>
                  );
                }
                
                const availableWeapons = fighter?.inventory?.filter(item => 
                  item.type === "weapon" || item.type === "Weapon" || item.category === "Weapons"
                ) || [];
                
                return (
                  <>
                    <Text fontSize="sm" color="gray.600">
                      {selectedWeaponSlot?.slotIndex !== null 
                        ? `Change weapon in ${currentSlot?.slot || `Slot ${selectedWeaponSlot.slotIndex + 1}`}:` 
                        : "Add new weapon to inventory"
                      }
                    </Text>
                    
                    <VStack spacing={2} align="stretch">
                      {/* Unarmed option */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => confirmWeaponChange("Unarmed")}
                      >
                        <HStack spacing={2}>
                          <Text>Unarmed</Text>
                          <Badge colorScheme="gray" size="xs">1d3</Badge>
                        </HStack>
                      </Button>
                      
                      {/* Available weapons from inventory */}
                      {availableWeapons.length > 0 ? (
                        availableWeapons.map((weapon, index) => {
                          const isTwoHanded = isTwoHandedWeapon(weapon);
                          return (
                            <Button
                              key={index}
                              size="sm"
                              variant="outline"
                              onClick={() => confirmWeaponChange(weapon.name)}
                              colorScheme={isTwoHanded ? "purple" : "gray"}
                            >
                              <HStack spacing={2} w="full" justify="space-between">
                                <Text>{weapon.name}</Text>
                                <HStack spacing={1}>
                                  {isTwoHanded && (
                                    <Badge colorScheme="purple" size="xs">Two-Handed</Badge>
                                  )}
                                  {weapon.damage && (
                                    <Badge colorScheme="red" size="xs">{weapon.damage}</Badge>
                                  )}
                                </HStack>
                              </HStack>
                            </Button>
                          );
                        })
                      ) : (
                        <Box p={2} bg="gray.50" borderRadius="md" textAlign="center">
                          <Text color="gray.600" fontSize="xs">
                            No additional weapons in inventory
                          </Text>
                        </Box>
                      )}
                    </VStack>
                  </>
                );
              })()}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Phase 0 Pre-Combat Modal */}
      <Phase0PreCombatModal
        isOpen={showPhase0Modal}
        onClose={() => {
          // ✅ Don't clear phase0Results on close - user might reopen modal
          // Only clear if they explicitly cancel
          setShowPhase0Modal(false);
          // Keep phase0Results so mapType is preserved
        }}
        onComplete={(results) => {
          // ✅ Debug: Log what we receive
          if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
            console.log('[CombatPage] Phase0PreCombatModal onComplete called with results:', results);
            console.log('[CombatPage] results.environment?.mapType:', results.environment?.mapType);
            console.log('[CombatPage] Full environment object:', results.environment);
          }
          
          // If players took Phase 0 actions, execute them
          if (results.playerActions && Array.isArray(results.playerActions)) {
            const playerFighters = fighters.filter(f => f.type === "player");
            results.playerActions.forEach(actionData => {
              const player = playerFighters.find(p => p.id === actionData.playerId || p.name === actionData.playerName);
              if (player && actionData.actionName) {
                try {
                  const actionResult = executePreCombatAction(
                    actionData.actionName,
                    player,
                    results.environment || {}
                  );
                  
                  if (actionResult.success) {
                    addLog(`✅ ${player.name} successfully executed ${actionData.actionName}: ${actionResult.effect}`, "info");
                    if (actionResult.roll) {
                      addLog(`🎲 Roll: ${actionResult.roll}/${actionResult.target}`, "info");
                    }
                  } else {
                    addLog(`❌ ${player.name} failed ${actionData.actionName}: ${actionResult.effect || actionResult.error}`, "warning");
                    if (actionResult.roll) {
                      addLog(`🎲 Roll: ${actionResult.roll}/${actionResult.target}`, "info");
                    }
                  }
                } catch (error) {
                  console.error(`[CombatPage] Error executing Phase 0 action for ${player.name}:`, error);
                  addLog(`⚠️ Error executing ${actionData.actionName} for ${player.name}`, "error");
                }
              }
            });
          }
          
          setPhase0Results(results);
          // ✅ Set combatTerrain immediately so TacticalMap can use it before combat starts
          if (results.environment) {
            // ✅ CRITICAL: Verify mapType exists before setting
            if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
              console.log('[CombatPage] Raw results.environment:', results.environment);
              console.log('[CombatPage] results.environment keys:', Object.keys(results.environment));
              console.log('[CombatPage] results.environment.mapType value:', results.environment.mapType);
              if (!results.environment.mapType) {
                console.error('[CombatPage] ERROR: mapType is missing from environment! Full object:', JSON.stringify(results.environment, null, 2));
              }
            }
            
            setCombatTerrain(results.environment);
            if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
              console.log('[CombatPage] Set combatTerrain immediately with mapType:', results.environment?.mapType);
              console.log('[CombatPage] combatTerrain after set:', { mapType: results.environment?.mapType, terrain: results.environment?.terrain, lighting: results.environment?.lighting });
            }
          } else {
            console.warn('[CombatPage] WARNING: results.environment is missing!', results);
          }
          setShowPhase0Modal(false);
          // Don't auto-start - let user click Start Combat to proceed
        }}
        players={fighters.filter(f => f.type === "player")}
        preCombatSystem={preCombatSystem}
      />
      
      {/* Mobile Drawer for Combat Options */}
      <Drawer isOpen={isMobileDrawerOpen} placement="right" onClose={onMobileDrawerClose} size="md">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>🎯 Combat Options for {currentFighter?.name || "Character"}</DrawerHeader>
          <DrawerBody>
            {currentFighter && (
              <VStack align="stretch" spacing={4}>
                {/* Alternative CombatActionsPanel View */}
                <CombatActionsPanel
                  character={currentFighter}
                  selectedAction={selectedAction}
                  selectedTarget={selectedTarget}
                  availableTargets={targetOptions}
                  onActionSelect={(action, character) => {
                    setSelectedAction(action);
                    if (action?.name === "Overwatch Shot") {
                      setTargetingMode("OVERWATCH_HEX");
                      setOverwatchTargetHex(null);
                      addLog("🎯 Select a hex for Overwatch.", "info");
                    } else {
                      setTargetingMode(null);
                    }
                    addLog(`${character.name} selects: ${action.name}`, "info");
                  }}
                  onTargetSelect={(target) => {
                    setSelectedTarget(target);
                    addLog(`Target selected: ${target.name}`, "info");
                  }}
                />
                
                {/* Movement Buttons */}
                <VStack spacing={2} align="stretch">
                  <Button
                    colorScheme="blue"
                    onClick={() => {
                      activateMovementMode();
                      onMobileDrawerClose();
                    }}
                    isDisabled={!currentFighter || currentFighter.type !== "player" || !showTacticalMap}
                  >
                    🚶 Move
                  </Button>
                  <Button
                    colorScheme="orange"
                    onClick={() => {
                      if (currentFighter && currentFighter.type === "player") {
                        setMovementMode({ active: true, isRunning: true });
                        setSelectedMovementFighter(currentFighter.id);
                        addLog(`🏃 ${currentFighter.name} prepares to run (full speed movement)`, "info");
                        onMobileDrawerClose();
                      }
                    }}
                    isDisabled={!currentFighter || currentFighter.type !== "player" || !showTacticalMap}
                  >
                    🏃 Run
                  </Button>
                  <Button
                    colorScheme="purple"
                    onClick={() => {
                      if (currentFighter && currentFighter.type === "player") {
                        handleWithdrawAction({
                          currentFighter,
                          fighters,
                          positions,
                          setPositions,
                          addLog,
                          endTurn: () => endTurn(),
                          maxWithdrawSteps: 3,
                        });
                        onMobileDrawerClose();
                      }
                    }}
                    isDisabled={!currentFighter || currentFighter.type !== "player" || currentFighter.isDown}
                  >
                    🏃 Withdraw
                  </Button>
                </VStack>
                
                {/* Execute Button */}
                <Button
                  colorScheme="green"
                  onClick={() => {
                    executeSelectedAction();
                    onMobileDrawerClose();
                  }}
                  isDisabled={!selectedAction}
                  size="lg"
                >
                  {selectedAction 
                    ? `Execute ${selectedAction.name} →` 
                    : "Select Action First"}
                </Button>
              </VStack>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button variant="outline" onClick={onMobileDrawerClose}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Loot Window - Opens when clicking on defeated characters */}
      <LootWindow
        isOpen={lootWindowOpen}
        onClose={() => {
          setLootWindowOpen(false);
          setSelectedLootSource(null);
          setLootData(null);
        }}
        loot={lootData}
        sourceName={selectedLootSource?.name || "Defeated Enemy"}
        onTakeItem={(item, itemType) => {
          // Handle taking a single item
          // TODO: Add item to player inventory/party inventory
          addLog(`💰 ${item.name} taken from ${selectedLootSource?.name || "enemy"}`, "info");
          
          // Remove item from loot
          if (lootData) {
            const updatedLoot = { ...lootData };
            if (itemType === "inventory") {
              updatedLoot.inventory = updatedLoot.inventory?.filter(i => i !== item) || [];
            } else if (itemType === "weapon") {
              updatedLoot.weapons = updatedLoot.weapons?.filter(w => w !== item) || [];
            } else if (itemType === "armor") {
              updatedLoot.armor = null;
            }
            
            // Update fighter to remove looted item
            setFighters(prev => prev.map(f => {
              if (f.id === selectedLootSource?.id) {
                if (itemType === "inventory") {
                  return {
                    ...f,
                    inventory: f.inventory?.filter(i => i !== item) || [],
                    items: f.items?.filter(i => i !== item) || []
                  };
                } else if (itemType === "weapon") {
                  return {
                    ...f,
                    weapons: f.weapons?.filter(w => w !== item) || [],
                    equippedWeapons: f.equippedWeapons?.filter(w => w.name !== item.name) || []
                  };
                } else if (itemType === "armor") {
                  return {
                    ...f,
                    armor: null,
                    equippedArmor: null
                  };
                }
              }
              return f;
            }));
            
            // Update loot data
            setLootData(updatedLoot);
            
            // Close if no more loot
            if (
              (updatedLoot.inventory?.length || 0) === 0 &&
              (updatedLoot.weapons?.length || 0) === 0 &&
              !updatedLoot.armor
            ) {
              setLootWindowOpen(false);
              setSelectedLootSource(null);
              setLootData(null);
            }
          }
        }}
        onTakeAll={(allItems) => {
          // Handle taking all items
          allItems.forEach((item) => {
            addLog(`💰 ${item.name} taken from ${selectedLootSource?.name || "enemy"}`, "info");
          });
          
          // Remove all items from fighter
          setFighters(prev => prev.map(f => {
            if (f.id === selectedLootSource?.id) {
              return {
                ...f,
                inventory: [],
                items: [],
                weapons: [],
                equippedWeapons: f.equippedWeapons?.map(w => 
                  w && w.name && w.name !== "Unarmed" && w.name !== "None" 
                    ? { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: w.slot || "Right Hand" }
                    : w
                ) || [],
                armor: null,
                equippedArmor: null
              };
            }
            return f;
          }));
          
          // Close loot window
          setLootWindowOpen(false);
          setSelectedLootSource(null);
          setLootData(null);
        }}
        allowSelection={true}
      />

      {/* Game Settings Modal */}
      <GameSettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

    </Box>
  );
}
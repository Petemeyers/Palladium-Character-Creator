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
import CryptoSecureDice from "../utils/cryptoDice";
import bestiary from "../data/bestiary.json";
import { getAllBestiaryEntries } from "../utils/bestiaryUtils.js";
import CombatActionsPanel from "../components/CombatActionsPanel";
import { createPlayableCharacterFighter, getPlayableCharacterRollDetails } from "../utils/autoRoll";
import { assignRandomWeaponToEnemy } from "../utils/enemyWeaponAssigner";
import { initializeAmmo, useAmmo, canFireMissileWeapon } from "../utils/combatAmmoManager";
import { getRandomCombatSpell } from "../data/combatSpells";
import { isTwoHandedWeapon, getWeaponDamage } from "../utils/weaponSlotManager";
import { usePsionic } from "../utils/psionicEffects";
import { applyInitialEffect } from "../utils/updateActiveEffects";
import TacticalMap from "../components/TacticalMap";
import HexArena3D from "../components/HexArena3D";
import Phase0PreCombatModal from "../components/Phase0PreCombatModal";
import ResizableLayout from "../components/ResizableLayout";
import { getInitialPositions, getEngagementRange, MOVEMENT_RATES, GRID_CONFIG, MOVEMENT_ACTIONS, calculateDistance, getMovementRange, getHexNeighbors, isValidPosition } from "../data/movementRules";
import { getDistanceBetween } from "../utils/positionManager";
import { resolvePhase0Encounter, preCombatSystem, executePreCombatAction, hasSpecialSenses } from "../utils/stealthSystem";
import { 
  canAISeeTarget, 
  updateAwareness,
  getAwareness,
  decayAwareness,
  canPerformSneakAttack,
  attemptMidCombatHide,
  AWARENESS_STATES 
} from "../utils/aiVisibilityFilter.js";
import { calculateVisibleCells, calculateVisibleCellsMultiple, getVisibilityRange } from "../utils/visibilityCalculator";
import { updateFogMemory, resetFogMemory } from "../utils/fogMemorySystem";
import { getAttacksPerMelee, getCreatureAttacksPerMelee, getActionCost, formatAttacksRemaining } from "../utils/actionEconomy";
import { calculateTotalHP } from "../utils/levelProgression";
import { grantXPFromEnemy, getMonsterByName, calculateMonsterXP } from "../utils/enemyXP";
import { weapons, getWeaponByName } from "../data/weapons.js";
import { calculateRangePenalty, calculateReachAdvantage } from "../utils/weaponSystem.js";
import { 
  analyzeMovementAndAttack, 
  executeChargeAttack, 
  validateAttackRange,
  calculateMovementPerAction,
  calculateEnemyMovementAI,
  getWeaponRange
} from "../utils/distanceCombatSystem.js";
import { getCombatModifiers, canUseWeapon, getWeaponType, getWeaponLength } from "../utils/combatEnvironmentLogic.js";
import { getDynamicWidth, getActorsInProximity, getDynamicHeight } from "../utils/environmentMetrics.js";

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
import { autoEquipWeapons, getWeaponDisplayInfo } from "../utils/weaponManager";
import { 
  getCoverBonus,
  applyLightingEffects, 
  TERRAIN_TYPES,
  calculateLineOfSight,
  calculatePerceptionCheck 
} from "../utils/terrainSystem.js";
import { castSpell, getUnifiedAbilities } from "../utils/unifiedAbilities.js";
import { createProtectionCircle, isProtectionCircle, CIRCLE_TYPES } from "../utils/protectionCircleSystem.js";
import { updateProtectionCirclesOnMap } from "../utils/protectionCircleMapSystem.js";
import { healerAbility, medicalTreatment, clericalHealingTouch } from "../utils/healingSystem.js";
import { getSkillPercentage, rollSkillCheck, lookupSkill } from "../utils/skillSystem.js";
import CirclePlacementTool from "../components/CirclePlacementTool.jsx";
import CircleManagerPanel from "../components/CircleManagerPanel.jsx";
import CircleRechargePanel from "../components/CircleRechargePanel.jsx";
import FloatingPanel from "../components/FloatingPanel.jsx";
import { findBeePath } from "../ai";
import GameSettingsPanel from "../components/GameSettingsPanel";
import { useGameSettings } from "../context/GameSettingsContext";
import { applyPainStagger } from "../utils/painSystem";
import { resolveMoraleCheck } from "../utils/moraleSystem";
import { resolveHorrorCheck } from "../utils/horrorSystem";
import {
  getThreatPositionsForFighter,
  makeIsHexOccupied,
  findBestRetreatHex,
  isAtMapEdge,
} from "../utils/routingSystem";
import { canBeCaptured, tieUpPrisoner, lootPrisoner } from "../utils/captureSystem";
import { 
  initializeCombatFatigue, 
  drainStamina, 
  applyFatiguePenalties,
  getFatigueStatus,
  STAMINA_COSTS 
} from "../utils/combatFatigueSystem.js";
import { createAIActionSelector } from "../utils/combatEngine.js";
import { runPlayerTurnAI } from "../utils/ai/playerTurnAI";
import { runEnemyTurnAI } from "../utils/ai/enemyTurnAI";
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
  if (
    !currentPos ||
    !Array.isArray(threatPositions) ||
    threatPositions.length === 0 ||
    !maxSteps ||
    maxSteps <= 0
  ) {
    return null;
  }

  const startingScore = minDistanceToThreats(currentPos, threatPositions);
  let bestPosition = currentPos;
  let bestScore = startingScore;
  let workingPosition = currentPos;
  let stepsTaken = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    const neighbors = getHexNeighbors(workingPosition.x, workingPosition.y)
      .filter((hex) => isValidPosition(hex.x, hex.y))
      .filter((hex) => !isHexOccupied(hex.x, hex.y, enemyId));

    if (neighbors.length === 0) {
      break;
    }

    let selectedNeighbor = null;
    let selectedScore = bestScore;

    neighbors.forEach((hex) => {
      const score = minDistanceToThreats(hex, threatPositions);
      if (score > selectedScore + 0.01) {
        selectedNeighbor = hex;
        selectedScore = score;
      }
    });

    if (!selectedNeighbor) {
      break;
    }

    workingPosition = selectedNeighbor;
    bestPosition = selectedNeighbor;
    bestScore = selectedScore;
    stepsTaken += 1;
  }

  if (stepsTaken === 0 || bestScore <= startingScore) {
    return null;
  }

  return {
    position: bestPosition,
    stepsMoved: stepsTaken,
    distanceFeet: calculateDistance(currentPos, bestPosition),
    safetyScore: bestScore,
  };
}

const HEAL_KEYWORDS = ["heal", "restor", "regenerat", "revive", "resurrect", "resurrection", "lay on hands"];
const TOUCH_RANGE_HINTS = ["touch", "target", "per person", "per target", "per creature", "per ally"];
const SELF_ONLY_HINTS = ["self only", "self-only"];
const SUPPORT_KEYWORDS = [
  "fly",
  "invisibility",
  "invisible",
  "shield",
  "armor",
  "protection",
  "protect",
  "bless",
  "speed",
  "strength",
  "resist",
  "resistance",
  "levitate",
  "levitation",
  "globe",
  "light",
  "darkness",
  "circle",
  "ward",
  "flight",
  "float",
  "haste",
  "boost",
  "enhance",
];
const HARMFUL_KEYWORDS = [
  "immobilize",
  "trap",
  "paralyze",
  "blind",
  "curse",
  "ensnare",
  "sleep",
  "disease",
  "poison",
  "stun",
  "control",
  "dominate",
  "fear",
  "agonize",
  "pain",
  "hold",
  "silence",
];

function parseRangeToFeet(rangeValue) {
  if (!rangeValue) return Infinity;
  const range = String(rangeValue).toLowerCase();
  if (range.includes("line of sight") || range.includes("line-of-sight") || range.includes("any target")) return Infinity;
  if (range.includes("self")) return 0;
  if (range.includes("touch") || range.includes("melee")) return 5;

  const numberMatch = range.match(/(\d+(\.\d+)?)/);
  if (!numberMatch) return Infinity;

  const value = parseFloat(numberMatch[1]);
  if (Number.isNaN(value)) return Infinity;

  if (range.includes("mile")) {
    return value * 5280;
  }

  return value;
}

function getSpellCost(spell) {
  if (!spell) return 0;
  const candidates = [
    spell.cost,
    spell.ppe,
    spell.PPE,
    spell.ppeCost,
    spell.PPECOST,
    spell.ppCost,
    spell.ispCost,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && !Number.isNaN(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string") {
      const numeric = parseInt(candidate.replace(/[^\d-]+/g, ""), 10);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
  }

  return 0;
}

function getPsionicCost(power) {
  if (!power) return 0;
  const candidates = [power.isp, power.cost, power.ISP];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && !Number.isNaN(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string") {
      const numeric = parseInt(candidate.replace(/[^\d-]+/g, ""), 10);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
  }
  return 0;
}

function extractHealingFormulaFromText(text) {
  if (!text || typeof text !== "string") return null;
  const lower = text.toLowerCase();
  if (!HEAL_KEYWORDS.some((keyword) => lower.includes(keyword))) return null;

  const diceMatch = text.match(/(\d+d\d+(\s*[+-]\s*\d+)?)/i);
  if (diceMatch) {
    return { type: "dice", expression: diceMatch[1].replace(/\s+/g, "") };
  }

  const flatMatch = text.match(/(\d+)\s*(hp|hit points|points|s\.?d\.?c\.?|sdc)/i);
  if (flatMatch) {
    return { type: "flat", amount: parseInt(flatMatch[1], 10) };
  }

  return null;
}

function getSpellHealingFormula(spell) {
  if (!spell) return null;

  if (typeof spell.healingAmount === "number") {
    return { type: "flat", amount: spell.healingAmount };
  }

  if (typeof spell.healing === "number") {
    return { type: "flat", amount: spell.healing };
  }

  const healingFields = [
    spell.healing,
    spell.effect,
    spell.damage,
    spell.description,
    spell.notes,
  ];

  for (const field of healingFields) {
    const formula = extractHealingFormulaFromText(field);
    if (formula) return formula;
  }

  return null;
}

function hasSpellDamage(spell) {
  if (!spell) return false;

  const damageCandidates = [
    spell.combatDamage,
    spell.damage,
    spell.effect,
    spell.description,
  ];

  for (const candidate of damageCandidates) {
    if (!candidate) continue;
    if (typeof candidate === "number") {
      if (candidate > 0) return true;
      continue;
    }

    if (typeof candidate === "string") {
      const lower = candidate.toLowerCase();
      if (lower.includes("heals")) continue;
      if (lower.includes("damage") && !lower.includes("no damage")) return true;
      if (/\d+d\d+/i.test(lower)) return true;
      const numeric = parseInt(lower.replace(/[^\d-]+/g, ""), 10);
      if (!Number.isNaN(numeric) && numeric > 0) return true;
    }
  }

  return false;
}

function getSpellRangeInFeet(spell) {
  if (!spell) return Infinity;
  return parseRangeToFeet(spell.range);
}

function isHealingSpell(spell) {
  if (!spell) return false;
  if (typeof spell.damageType === "string" && spell.damageType.toLowerCase().includes("healing")) {
    return true;
  }
  if (typeof spell.category === "string" && spell.category.toLowerCase().includes("healing")) {
    return true;
  }
  return Boolean(getSpellHealingFormula(spell));
}

function isOffensiveSpell(spell) {
  return !isHealingSpell(spell) && hasSpellDamage(spell);
}

function isSupportSpell(spell) {
  if (!spell) return false;
  if (isHealingSpell(spell)) return true;
  if (hasSpellDamage(spell)) return false;

  const name = (spell.name || "").toLowerCase();
  const description = (spell.description || spell.effect || "").toLowerCase();
  const range = (spell.range || "").toLowerCase();

  if (HARMFUL_KEYWORDS.some((keyword) => name.includes(keyword) || description.includes(keyword))) {
    return false;
  }

  if (range.includes("self")) return true;
  if (range.includes("touch") || range.includes("per person") || range.includes("per target")) {
    if (SUPPORT_KEYWORDS.some((keyword) => name.includes(keyword) || description.includes(keyword))) {
      return true;
    }
  }

  return SUPPORT_KEYWORDS.some((keyword) => name.includes(keyword) || description.includes(keyword));
}

function doesSpellRequireTarget(spell) {
  if (!spell) return false;
  if (hasSpellDamage(spell)) return true;
  const range = (spell.range || "").toLowerCase();
  if (!range) return false;
  if (range.includes("self") && !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) {
    return false;
  }
  if (TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) return true;
  if (/\d/.test(range) || range.includes("line") || range.includes("area")) return true;
  return false;
}

function spellCanAffectTarget(spell, caster, target) {
  if (!spell) return false;
  if (!target) return !doesSpellRequireTarget(spell);
  if (!caster) return false;
  if (target.id === caster.id) return true;

  const range = (spell.range || "").toLowerCase();
  if (!range) return true;

  if (SELF_ONLY_HINTS.some((hint) => range.includes(hint))) return false;
  if (range.includes("self") && !TOUCH_RANGE_HINTS.some((hint) => range.includes(hint))) {
    return false;
  }

  const isFriendlyTarget = caster.type === target.type;
  if (!isFriendlyTarget) {
    if (isHealingSpell(spell)) return false;
    if (isSupportSpell(spell)) return false;
  }

  return true;
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

export default function CombatPage({ characters = [] }) {
  const navigate = useNavigate();
  const [log, setLog] = useState([]);
  const [logFilterType, setLogFilterType] = useState("all");
  const [logSortOrder, setLogSortOrder] = useState("newest");
  const [fighters, setFighters] = useState([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [ammoCount, setAmmoCount] = useState({}); // Track ammunition for ranged weapons
  
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
      if (process.env.NODE_ENV === 'development') {
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

  // Helper to check if fighter can act (conscious only)
  const canFighterAct = (fighter) => {
    if (!fighter) return false;
    const hpStatus = getHPStatus(fighter.currentHP);
    return hpStatus.canAct && fighter.status !== "defeated";
  };
  
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
  const [meleeRound, setMeleeRound] = useState(1); // Track melee rounds (1 minute each)
  const [turnCounter, setTurnCounter] = useState(0); // Track absolute turn number (increments every turn)
  const [combatActive, setCombatActive] = useState(false);
  const [selectedCreature, setSelectedCreature] = useState("");
  const [customEnemyName, setCustomEnemyName] = useState("");
  const [selectedAttack, setSelectedAttack] = useState(0);
  const [selectedParty, setSelectedParty] = useState([]);
  const [showPartySelector, setShowPartySelector] = useState(false);
  const [diceRolls, setDiceRolls] = useState([]);
  const [showRollDetails, setShowRollDetails] = useState(false);
  const [showCombatChoices, setShowCombatChoices] = useState(false);
  const [aiControlEnabled, setAiControlEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { settings } = useGameSettings();
  const [selectedAction, setSelectedAction] = useState(null);
  const [selectedGrappleAction, setSelectedGrappleAction] = useState(null);
  const [selectedManeuver, setSelectedManeuver] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [selectedWeaponSlot, setSelectedWeaponSlot] = useState(null);
  const [showWeaponModal, setShowWeaponModal] = useState(false);
  const [selectedAttackWeapon, setSelectedAttackWeapon] = useState(null);
  const [selectedPsionicPower, setSelectedPsionicPower] = useState(null);
  const [selectedSpell, setSelectedSpell] = useState(null);
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
  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);
  
  // Track recently used psionics per fighter to prevent AI spamming the same power
  const playerAIRecentlyUsedPsionicsRef = useRef(new Map());
  
  const [pendingMovements, setPendingMovements] = useState({}); // Track pending movements (for RUN/SPRINT/CHARGE)
  const [temporaryHexSharing, setTemporaryHexSharing] = useState({}); // Track temporary hex sharing {characterId: {originalPos, targetHex, targetCharId}}
  const [flashingCombatants, setFlashingCombatants] = useState(new Set()); // Track which combatants are flashing
  const processingEnemyTurnRef = useRef(false); // Prevent duplicate enemy turn processing (use ref for synchronous check)
  const processingPlayerAIRef = useRef(false); // Prevent duplicate player AI turn processing
  const lastProcessedTurnRef = useRef(null); // Track the last processed turn to prevent duplicates
  const topCombatLogRef = useRef(null); // Ref for top combat log scroll container
  const detailedCombatLogRef = useRef(null); // Ref for detailed combat log tab scroll container
  const justCreatedPendingMovementRef = useRef(new Set()); // Track movements created this turn (don't apply until NEXT turn)
  const handleEnemyTurnRef = useRef(null); // Store latest version of handleEnemyTurn to avoid dependency loops
  const attackRef = useRef(null); // Store attack function to avoid initialization order issues
  const lastOpenedChoicesTurnRef = useRef(null); // Track which turn we opened choices for
  const movementAttemptsRef = useRef({}); // Track movement attempts per fighter to prevent infinite loops: {fighterId: {count, lastDistance, lastPosition}}
  const combatEndCheckRef = useRef(false); // Prevent duplicate combat end checks
  const lastProcessedEnemyTurnRef = useRef(null); // Track last processed enemy turn to prevent duplicates
  const executingActionRef = useRef(false); // Prevent multiple rapid action executions
  const visibilityLogRef = useRef(new Set()); // Track visibility logs to prevent spam: Set of "playerId_turnCounter"
  const turnTimeoutRef = useRef(null); // Track scheduled end turn timeout
  const combatPausedRef = useRef(false); // Track paused state in async callbacks
  const recentLogMessagesRef = useRef(new Map()); // Track recent log messages to prevent duplicates (React Strict Mode): Map<messageKey, timestamp>
  const lastAutoTurnKeyRef = useRef(null); // Prevent duplicate auto-processing per turn
  const lastNoActionLogRef = useRef(new Map()); // Track "no action" logs per fighter per turn: Map<fighterId_turnCounter, true>
  const prevAiControlRef = useRef(aiControlEnabled);
  const wasPausedRef = useRef(false);
  const [showTacticalMap, setShowTacticalMap] = useState(false); // Toggle tactical map display
  const [show3DView, setShow3DView] = useState(false); // Toggle 3D view display (hidden by default)
  const [mapViewMode, setMapViewMode] = useState('2D'); // '2D' or '3D' view mode
  const [mapHeight, setMapHeight] = useState(1200); // Map height in pixels
  const [movementMode, setMovementMode] = useState({ active: false, isRunning: false }); // Track if player is selecting movement and running mode
  const [selectedCombatantId, setSelectedCombatantId] = useState(null); // Track selected combatant from map
  const [hoveredCell, setHoveredCell] = useState(null); // Track hovered hex cell
  const [selectedHex, setSelectedHex] = useState(null); // Track selected hex for movement
  const [selectedMovementFighter, setSelectedMovementFighter] = useState(null); // Track which fighter is moving
  const [psionicsMode, setPsionicsMode] = useState(false); // Track if player is selecting psionic power
  const [spellsMode, setSpellsMode] = useState(false); // Track if player is selecting spell
  const [selectedSkill, setSelectedSkill] = useState(null); // Track selected skill for use
  const [showPhase0Modal, setShowPhase0Modal] = useState(false); // Phase 0 scene setup modal
  const [arenaSpeed, setArenaSpeed] = useState("slow"); // Combat pacing: slow/normal/fast
  const [phase0Results, setPhase0Results] = useState(null); // Store Phase 0 scene setup
  const [combatTerrain, setCombatTerrain] = useState(null); // Store terrain data for combat
  const [mode, setMode] = useState("MAP_EDITOR"); // "MAP_EDITOR" | "COMBAT"
  const [mapDefinition, setMapDefinition] = useState(null); // Map definition for editor mode
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

  // Initialize mapDefinition from phase0Results when available
  useEffect(() => {
    if (phase0Results?.environment && !mapDefinition) {
      setMapDefinition(phase0Results.environment);
    }
  }, [phase0Results, mapDefinition]);

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

  const clearScheduledTurn = useCallback(() => {
    if (turnTimeoutRef.current) {
      clearTimeout(turnTimeoutRef.current);
      turnTimeoutRef.current = null;
    }
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

  const getFighterPsionicPowers = useCallback((fighter) => {
    if (!fighter || !Array.isArray(fighter.psionicPowers)) return [];
    return fighter.psionicPowers.filter(Boolean);
  }, []);

  const getFighterSpells = useCallback((fighter) => {
    if (!fighter) return [];

    const normalised = [];
    const seen = new Set();

    const addSpellEntry = (entry) => {
      if (!entry) return;
      let normalizedEntry = entry;
      if (typeof entry === "string") {
        normalizedEntry = { name: entry };
      }
      
      // Check if this is a unified spell and convert it
      if (normalizedEntry.type === "magic" || normalizedEntry.source === "unified") {
        const converted = convertUnifiedSpellToCombatSpell(normalizedEntry);
        if (converted) {
          normalizedEntry = converted;
        }
      }
      
      const name = normalizedEntry.name || normalizedEntry.spell || normalizedEntry.title;
      if (!name || seen.has(name)) return;
      seen.add(name);

      normalised.push({
        ...normalizedEntry,
        name,
        cost: getSpellCost(normalizedEntry),
      });
    };

    const addSpellList = (list) => {
      if (!list) return;
      if (Array.isArray(list)) {
        list.forEach(addSpellEntry);
        return;
      }
      if (Array.isArray(list?.spells)) {
        list.spells.forEach(addSpellEntry);
      }
    };

    addSpellList(fighter.magic);
    addSpellList(fighter.spells);
    addSpellList(fighter.knownSpells);
    addSpellList(fighter.spellbook);
    addSpellList(fighter.spellList);

    return normalised;
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

  const actionOptions = useMemo(() => {
    const hasPsionicOptions = availablePsionicPowers.length > 0;
    const hasSpellOptions = availableSpells.length > 0;

    const baseOptions = [
      { value: "Strike", label: "⚔️ Strike" },
      { value: "Parry", label: "🛡️ Parry" },
      { value: "Dodge", label: "🎯 Dodge" },
      { value: "Brace", label: "⚔️ Brace (vs Charge)" },
      { value: "Run", label: "🏃 Run" },
      { value: "Defend/Hold", label: "🛡️ Defend" },
      { value: "Combat Maneuvers", label: "⚔️ Maneuver" },
      { value: "Use Skill", label: "🛠️ Use Skill" },
      { value: "Hide", label: "👤 Hide / Prowl" },
    ];

    if (hasPsionicOptions) {
      baseOptions.push({ value: "Psionics", label: "🧠 Psionics" });
    }
    if (hasSpellOptions) {
      baseOptions.push({ value: "Spells", label: "🔮 Spells" });
    }

    return baseOptions;
  }, [availablePsionicPowers, availableSpells]);

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

  const spellRequiresTarget = useCallback(doesSpellRequireTarget, []);

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
        default:
          return [];
      }
    },
    [currentFighter, fighters, selectedPsionicPower, selectedSpell, getPsionicTargetCategory, spellRequiresTarget, MIN_COMBAT_HP]
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
    if (!["Strike", "Combat Maneuvers", "Psionics", "Spells"].includes(actionName)) {
      return false;
    }
    if (
      currentFighter &&
      targetOptions.length === 1 &&
      targetOptions[0].id === currentFighter.id
    ) {
      return false;
    }
    return true;
  }, [selectedAction, targetOptions, currentFighter]);

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
      
      // Reset all fighters' actions for new melee round
      setFighters(prev => prev.map(f => ({
        ...f,
        remainingAttacks: f.attacksPerMelee || 2
      })));
      
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

  const scheduleEndTurn = useCallback(
    (delayOverride = null) => {
      if (combatPausedRef.current) {
        clearScheduledTurn();
        return;
      }

      const delay = typeof delayOverride === "number" ? delayOverride : getActionDelay();

      if (delay <= 0) {
        clearScheduledTurn();
        endTurn();
        return;
      }

      clearScheduledTurn();
      turnTimeoutRef.current = setTimeout(() => {
        turnTimeoutRef.current = null;
        endTurn();
      }, delay);
    },
    [clearScheduledTurn, getActionDelay, endTurn]
  );

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
        // Normal movement
        setPositions(prev => {
          const updated = {
          ...prev,
          [selectedMovementFighter]: { x, y }
          };
          positionsRef.current = updated;
          return updated;
        });
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
      addLog(`🚶 ${currentFighter?.name} ${movementType} from (${oldPos.x}, ${oldPos.y}) to (${x}, ${y})${actionText}`, "info");
      
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
      setTimeout(() => endTurn(), 500);
      }
  }, [movementMode, selectedMovementFighter, positions, currentFighter, addLog, fighters, isHexOccupied, getWeaponRange, turnCounter, endTurn]);

  // Enhanced attack validation with distance-based combat system
  const validateWeaponRange = useCallback((
    attacker,
    defender,
    attackData,
    distance,
    attackerPosOverride = null,
    defenderPosOverride = null
  ) => {
    const weaponName = attackData?.name || "Unarmed";
    
    // Try to find weapon in weapons database using getWeaponByName
    const weapon = getWeaponByName(weaponName) || weapons.find(w => w.name.toLowerCase() === weaponName.toLowerCase());
    
    if (!weapon) {
      // Fallback: Try to create a basic weapon object from attackData to use getWeaponType
      const fallbackWeapon = attackData ? { name: weaponName, ...attackData } : { name: weaponName };
      const weaponType = getWeaponType(fallbackWeapon);
      const weaponLength = getWeaponLength(fallbackWeapon);
      
      // Use weapon type to determine if it's ranged
      const isRangedWeapon = weaponName.toLowerCase().includes('bow') || 
                           weaponName.toLowerCase().includes('crossbow') ||
                           weaponName.toLowerCase().includes('sling') ||
                           weaponName.toLowerCase().includes('gun') ||
                           weaponName.toLowerCase().includes('thrown') ||
                           weaponName.toLowerCase().includes('spell') ||
                           (attackData?.type === 'ranged') ||
                           (attackData?.range && attackData.range > 10);
      
      if (isRangedWeapon) {
        // Get weapon range from attackData or use defaults
        const weaponRange = attackData?.range || 
                          (weaponName.toLowerCase().includes('long bow') || weaponName.toLowerCase() === 'longbow' ? 640 :
                           weaponName.toLowerCase().includes('short bow') || weaponName.toLowerCase() === 'shortbow' ? 360 :
                           weaponName.toLowerCase().includes('bow') ? 360 :
                           weaponName.toLowerCase().includes('crossbow') ? 480 : 100);
        const canAttack = distance <= weaponRange;
        return { 
          canAttack, 
          reason: canAttack ? `Within range (${Math.round(distance)}ft ≤ ${weaponRange}ft)` : `Out of range (${Math.round(distance)}ft > ${weaponRange}ft)`,
          maxRange: weaponRange
        };
      } else {
        // For unknown melee weapons, adjacent hexes (5ft) are always in melee range
        // Weapon length only matters for reach weapons that can attack beyond adjacent hexes
        // Minimum melee range is 5.5ft to account for adjacent hexes in hex grid
        const effectiveRange = Math.max(5.5, weaponLength > 0 ? weaponLength : 5.5);
        const canAttack = distance <= effectiveRange;
        return { 
          canAttack, 
          reason: canAttack ? `Within melee range (${weaponType} weapon, adjacent hex)` : `Out of melee range (${Math.round(distance)}ft > ${effectiveRange}ft)`,
          maxRange: effectiveRange
        };
      }
    }
    
    // Use enhanced distance-based validation
    const attackerPos = attackerPosOverride || positions[attacker.id];
    const defenderPos = defenderPosOverride || positions[defender.id];
    const effectiveDistance =
      typeof distance === "number" && !Number.isNaN(distance)
        ? distance
        : (attackerPos && defenderPos
            ? calculateDistance(attackerPos, defenderPos)
            : Infinity);
    const rangeValidation = validateAttackRange(
      attacker,
      defender,
      attackerPos,
      defenderPos,
      weapon,
      effectiveDistance
    );
    
    if (rangeValidation.canAttack) {
      // Add range penalty info for ranged weapons
      if (weapon.range && weapon.range > 0) {
        const rangePenalty = calculateRangePenalty(effectiveDistance, weapon);
        return {
          canAttack: true,
          reason: rangeValidation.reason,
          maxRange: weapon.range,
          rangeInfo: rangePenalty.rangeInfo,
          penalty: rangePenalty.penalty
        };
      } else {
        return {
          canAttack: true,
          reason: rangeValidation.reason,
          maxRange: weapon.reach || 5
        };
      }
    } else {
      // Provide movement suggestions when out of range
      return {
        canAttack: false,
        reason: rangeValidation.reason,
        maxRange: weapon.range || weapon.reach || 5,
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
  // Define attack function with useCallback
  const attack = useCallback((attacker, defenderId, bonusModifiers = {}) => {
    // ✅ CRITICAL: Check if combat is still active before allowing attacks
    if (!combatActive) {
      addLog(`⚠️ Combat has ended, ${attacker.name} cannot attack`, "info");
      return;
    }
    
    const stateAttacker = fighters.find(f => f.id === attacker.id) || attacker;

    // ✅ CRITICAL: Check if attacker can act (must be conscious, not dying/dead/unconscious)
    if (!canFighterAct(stateAttacker)) {
      const hpStatus = getHPStatus(stateAttacker.currentHP);
      addLog(`❌ ${attacker.name} cannot attack (${hpStatus.description})!`, "error");
      return;
    }
    
    const updated = fighters.map(f => ({ ...f }));
    const attackerIndex = updated.findIndex(f => f.id === stateAttacker.id);
    const defenderIndex = updated.findIndex(f => f.id === defenderId);
    if (defenderIndex === -1) {
      addLog(`Invalid target! Target with ID ${defenderId} not found`, "error");
      return;
    }

    const defender = updated[defenderIndex];
    
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
    if (attacker.type === "player" && selectedAttackWeapon) {
      // Use selected weapon for player attacks
      // Check if weapon is being used two-handed (either weapon is two-handed type or using two-handed grip)
      const isUsingTwoHanded = selectedAttackWeapon.twoHanded || isTwoHandedWeapon(selectedAttackWeapon);
      // Use getWeaponDamage to properly calculate damage with two-handed bonuses and weapon size modifiers
      const weaponDamage = getWeaponDamage(selectedAttackWeapon, isUsingTwoHanded, attacker);
      attackData = {
        name: selectedAttackWeapon.name,
        damage: weaponDamage,
        type: selectedAttackWeapon.type
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

    // Check range and line of sight for attacks
    const livePositions = positionsRef.current || positions;
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
      const rangeValidation = validateWeaponRange(
        attacker,
        defender,
        attackData,
        distance,
        attackerPos,
        defenderPos
      );
      
      if (!rangeValidation.canAttack) {
        addLog(`❌ ${attacker.name} cannot reach ${defender.name} for attack! (${rangeValidation.reason})`, "error");
        
        // Show movement suggestions
        if (rangeValidation.suggestions && rangeValidation.suggestions.length > 0) {
          addLog(`💡 Options: ${rangeValidation.suggestions.slice(0, 3).join(", ")}`, "info");
        }
        
        return;
      } else {
        // Log range info for successful attacks
        if (rangeValidation.rangeInfo) {
          addLog(`📍 ${attacker.name} attacking at ${rangeValidation.rangeInfo}`, "info");
        }
      }
      
      // Check ammunition for ranged weapons
      const weaponName = attackData?.name || "";
      const isRangedWeapon = weaponName.toLowerCase().includes('bow') || 
                             weaponName.toLowerCase().includes('crossbow') ||
                             weaponName.toLowerCase().includes('sling') ||
                             (attackData?.type === 'ranged') ||
                             (attackData?.range && attackData.range > 10);
      
      if (isRangedWeapon) {
        // Determine ammo type
        const ammoType = weaponName.toLowerCase().includes('crossbow') ? 'bolts' : 
                        weaponName.toLowerCase().includes('bow') ? 'arrows' : 
                        weaponName.toLowerCase().includes('sling') ? 'stones' : 'arrows';
        
        // Check if fighter has ammo
        const fighterAmmo = ammoCount[attacker.id] || {};
        const currentAmmo = fighterAmmo[ammoType] || 0;
        
        if (currentAmmo <= 0) {
          // Initialize ammo if not set (give default amount)
          if (!ammoCount[attacker.id]) {
            setAmmoCount(prev => ({
              ...prev,
              [attacker.id]: { [ammoType]: 20 } // Default 20 arrows/bolts
            }));
            addLog(`🏹 ${attacker.name} loads ${ammoType} (20 remaining)`, "info");
          } else {
            addLog(`❌ ${attacker.name} is out of ${ammoType}! Cannot fire ${weaponName}.`, "error");
            return;
          }
        } else {
          // Deplete ammo
          setAmmoCount(prev => {
            const newAmmo = { ...prev };
            if (!newAmmo[attacker.id]) newAmmo[attacker.id] = {};
            newAmmo[attacker.id][ammoType] = Math.max(0, (newAmmo[attacker.id][ammoType] || 0) - 1);
            return newAmmo;
          });
          const remainingAmmo = Math.max(0, currentAmmo - 1);
          if (remainingAmmo > 0) {
            addLog(`🏹 ${attacker.name} fires ${weaponName} (${remainingAmmo} ${ammoType} remaining)`, "info");
          } else {
            addLog(`🏹 ${attacker.name} fires ${weaponName} (OUT OF ${ammoType.toUpperCase()}!)`, "warning");
          }
        }
      }
    }

    try {
      // Crypto secure attack roll with optional bonus modifiers (e.g., +2 from charge, flanking bonus)
      const baseStrikeBonus = attacker.bonuses?.strike || 0;
      const chargeBonus = bonusModifiers.strikeBonus || 0;
      const flankingBonus = bonusModifiers.flankingBonus || 0;
      const tempBonus = (tempModifiers[attacker.id]?.strikeBonus || 0) + (tempModifiers[attacker.id]?.nextMeleeStrike || 0);
      // Clear nextMeleeStrike after using it (one-time penalty)
      if (tempModifiers[attacker.id]?.nextMeleeStrike) {
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
          if (calledShotCheck.canUse && process.env.NODE_ENV === 'development') {
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
      
      const strikeBonus = baseStrikeBonus + chargeBonus + flankingBonus + tempBonus + terrainModifiers.strike + sneakAttackBonus + grappleAdvantage;
      
      if (tempBonus !== 0) {
        addLog(`⚡ ${attacker.name} has ${tempBonus > 0 ? '+' : ''}${tempBonus} temporary strike bonus!`, "info");
      }
      
      if (flankingBonus > 0) {
        addLog(`🎯 ${attacker.name} gains +${flankingBonus} flanking bonus!`, "info");
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
      
      const attackRollResult = CryptoSecureDice.parseAndRoll(diceFormula, bonus);
      let attackRoll = attackRollResult.totalWithBonus;
      
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
      
      // Drain stamina for normal combat action
      const staminaDrained = drainStamina(attacker, STAMINA_COSTS.NORMAL_COMBAT, 1);
      if (staminaDrained.currentStamina < staminaDrained.maxStamina * 0.5) {
        const status = getFatigueStatus(attacker);
        if (status.status !== "ready") {
          addLog(`⚠️ ${attacker.name} is ${status.description.toLowerCase()}! (Stamina: ${status.stamina.toFixed(1)}/${status.maxStamina})`, "warning");
        }
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
      if (combatTerrain && combatTerrain.lightingData && positions && positions[attacker.id] && positions[defenderId]) {
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
      const attackDiceRoll = attackRollResult.diceRolls?.[0]?.result || attackRoll - strikeBonus;
      setDiceRolls(prev => [...prev, {
        id: generateCryptoId(),
        type: 'attack',
        attacker: attacker.name,
        roll: attackDiceRoll,
        total: attackRoll,
        bonus: strikeBonus,
        timestamp: new Date().toLocaleTimeString()
      }]);
      const isCriticalHit = attackDiceRoll === 20; // Natural 20 = critical hit
      const isCriticalMiss = attackDiceRoll === 1; // Natural 1 = critical miss
      
      if (isCriticalHit) {
        addLog(`🎲 ${attacker.name} rolls NATURAL 20! Critical Hit! (Total: ${attackRoll} vs AR ${targetAR})`, "critical");
      } else if (isCriticalMiss) {
        addLog(`🎲 ${attacker.name} rolls NATURAL 1! Critical Miss!`, "miss");
      } else {
        // Format strike bonus display (show negative clearly)
        const bonusDisplay = strikeBonus >= 0 ? `+${strikeBonus}` : `${strikeBonus}`;
        addLog(`🎲 ${attacker.name} rolls ${attackDiceRoll} ${bonusDisplay} = ${attackRoll} vs AR ${targetAR}`, "info");
      }
      
      // AUTO-PARRY: If enemy attacks and defender has Hand-to-Hand, auto-parry if conditions are met
      let defenseSuccess = false;
      let defenseType = defensiveStance[defender.id];
      let autoParryUsed = false; // Track if auto-parry was used
      
      // Check for auto-parry when enemy attacks (only if no defensive stance already set)
      if (!defenseType && attackRoll >= targetAR && canFighterAct(defender)) {
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
          let defenseBonus = (defender.bonuses?.parry || 0) + fatigueDefensePenalty;
          
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
            defenseBonus = (defender.bonuses?.dodge || 0) + 1 + fatigueDefensePenalty + grappleDefensePenalty + sizeDefensePenalty;
          } else {
            defenseBonus = (defender.bonuses?.[defenseType.toLowerCase()] || 0) + fatigueDefensePenalty + grappleDefensePenalty + sizeDefensePenalty;
            
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
      
      // Critical miss auto-fails
      if (isCriticalMiss) {
        addLog(`❌ ${attacker.name} FUMBLES the attack!`, "miss");
        setFighters(updated);
        endTurn();
        return;
      }
      // Critical hit auto-succeeds, normal hit requires beating AR
      if ((isCriticalHit || attackRoll >= targetAR) && !defenseSuccess) {
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
        
        // Log attack data for debugging
        console.log(`Attack data for ${attacker.name}:`, attackData);
        
        if (attackData.damage && typeof attackData.damage === 'string' && attackData.damage.includes('d')) {
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
        
        // Critical hit doubles damage!
        if (isCriticalHit) {
          damage = damage * 2;
          // Calculate total bonus for logging (existing bonus + damage bonus)
          const parsedDamage = parseDamageFormula(attackData.damage);
          const totalBonusForLog = parsedDamage.existingBonus + safeDamageBonus;
          addLog(`🎲 Damage: ${parsedDamage.baseFormula} + ${totalBonusForLog} = ${damageRollResult.totalWithBonus} × 2 (CRITICAL) = ${damage}`, "critical");
        } else {
          // Calculate total bonus for logging
          const parsedDamage = parseDamageFormula(attackData.damage);
          const totalBonusForLog = parsedDamage.existingBonus + safeDamageBonus;
          addLog(`🎲 Damage: ${parsedDamage.baseFormula} + ${totalBonusForLog} = ${damage}`, "info");
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
        
        // 2) Morale check (only if enabled)
        if (settings.useMoraleRouting) {
          const maxHP = defenderAfterHit.maxHP || defenderAfterHit.totalHP || defenderAfterHit.currentHP || 1;
          const hpPercent = maxHP > 0 ? defenderAfterHit.currentHP / maxHP : 1;
          
          const alliesDownRatio = getAlliesDownRatio(updated, defenderAfterHit);
          
          const moraleOutcome = resolveMoraleCheck(defenderAfterHit, {
            roundNumber: meleeRound || 0,
            reason: bigPainHit ? "pain_hit" : "damage",
            hpPercent: hpPercent,
            alliesDownRatio: alliesDownRatio,
            horrorFailed: false,
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
            addLog("🎉 Victory! All enemies defeated!", "victory");
            setCombatActive(false);
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
              addLog("🎉 Victory! All enemies defeated!", "victory");
              setCombatActive(false);
              // Update fighters state and return early to prevent further processing
              setFighters(updated);
              return;
            }
          }
          
          // Award XP if an enemy was defeated by players (only if dead, not just unconscious)
          if (defenderAfterHit.type === "enemy" && defenderAfterHit.currentHP <= -21) {
            const alivePlayers = updated.filter(f => f.type === "player" && canFighterAct(f));
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
                  addLog("💀 All players are defeated! Enemies win!", "defeat");
                  setCombatActive(false);
              // Update fighters state immediately
              setFighters(updated);
              return;
                } else if (consciousEnemies.length === 0) {
                  combatEndCheckRef.current = true;
                  addLog("🎉 Victory! All enemies defeated!", "victory");
                  setCombatActive(false);
              // Update fighters state immediately
              setFighters(updated);
              return;
                }
          }
        }
      } else {
        addLog(`❌ ${attacker.name} misses ${defender.name}!`, "miss");
        
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
      setTimeout(() => {
        endTurn();
      }, 1500);
  }, [fighters, addLog, endTurn]);

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
        return updated;
      });
      
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
      // Normal movement (MOVE) - update position immediately (use transition for performance)
      startTransition(() => {
        setPositions(prev => {
          const updated = {
          ...prev,
          [combatantId]: newPosition
          };
          positionsRef.current = updated;
          return updated;
        });
      });
      
      if (combatant) {
        if (movementInfo) {
          const { action, actionCost, description } = movementInfo;
          addLog(`🏃 ${combatant.name} ${action.toLowerCase()}s to position (${newPosition.x}, ${newPosition.y}) - ${description}`, "info");
          
          // Handle action cost - if it costs actions, end the turn
          if (actionCost === "all" || actionCost >= 1) {
            addLog(`⏭️ ${combatant.name} used ${actionCost === "all" ? "all actions" : `${actionCost} action(s)`} for movement`, "info");
            setTimeout(() => endTurn(), 1500);
          }
        } else {
          addLog(`📍 ${combatant.name} moved to position (${newPosition.x}, ${newPosition.y})`, "info");
        }
      }
    }
  }, [fighters, addLog, endTurn]);

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

  // Helper function to find flanking positions around a target
  const findFlankingPositions = useCallback((targetPos, allPositions, attackerId) => {
    const flankingPositions = [];
    const directions = [
      { x: 1, y: 0 },   // Right
      { x: -1, y: 0 },  // Left
      { x: 0, y: 1 },   // Down
      { x: 0, y: -1 },  // Up
      { x: 1, y: 1 },   // Down-right
      { x: -1, y: -1 }, // Up-left
      { x: 1, y: -1 },  // Up-right
      { x: -1, y: 1 },  // Down-left
    ];
    
    directions.forEach(dir => {
      const flankPos = {
        x: targetPos.x + dir.x,
        y: targetPos.y + dir.y
      };
      
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
    const directions = [
      { x: 1, y: 0 },   // Right
      { x: -1, y: 0 },  // Left
      { x: 0, y: 1 },   // Down
      { x: 0, y: -1 },  // Up
      { x: 1, y: 1 },   // Down-right
      { x: -1, y: -1 }, // Up-left
      { x: 1, y: -1 },  // Up-right
      { x: -1, y: 1 },  // Down-left
    ];
    
    directions.forEach(dir => {
      const checkPos = {
        x: targetPos.x + dir.x,
        y: targetPos.y + dir.y
      };
      
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
    const isDev = process.env.NODE_ENV === 'development';
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
          weapons.push({
            name: weapon.name,
            damage: weapon.damage || "1d3",
            slot: weapon.slot || "Right Hand",
            range: weapon.range,
            reach: weapon.reach,
            category: weapon.category,
            type: weapon.type
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
          weapons.push({
            name: weapon.name,
            damage: weapon.damage || "1d3",
            slot: slot,
            range: weapon.range,
            reach: weapon.reach,
            category: weapon.category,
            type: weapon.type
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

  // AI logic for player characters
  const handlePlayerAITurn = useCallback((player) => {
    if (combatPausedRef.current) {
      addLog(`⏸️ Combat paused - ${player.name}'s turn is waiting`, "info");
      processingPlayerAIRef.current = false;
      return;
    }

    // Prevent duplicate processing - check FIRST before any logging
    if (processingPlayerAIRef.current) {
      // Already processing - skip silently to avoid log spam
      return;
    }
    
    // Mark as processing IMMEDIATELY
    processingPlayerAIRef.current = true;
    
    // Build context for AI module
    const context = {
      fighters,
      positions: positionsRef.current || positions,
      combatTerrain,
      arenaEnvironment,
      meleeRound,
      turnCounter,
      combatActive,
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
    
    // Delegate to AI module
    runPlayerTurnAI(player, context);
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
  ]);

  // Define handleEnemyTurn function with useCallback last
  const handleEnemyTurn = useCallback((enemy) => {
    // Prevent duplicate processing using ref for immediate synchronous check
    if (processingEnemyTurnRef.current) {
      console.warn('🚫 BLOCKED: Already processing enemy turn, skipping duplicate call for', enemy.name);
      addLog(`🚫 DEBUG: Blocked duplicate call for ${enemy.name}`, "error");
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
    
    // 1) First, refresh the enemy from state (in case their HP / morale changed)
    const fightersSnapshot = fighters;
    let liveEnemy = fightersSnapshot.find(f => f.id === enemy.id) || enemy;
    
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
    if (settings.useMoraleRouting && liveEnemy.moraleState?.status === "ROUTED" && !liveEnemy.moraleState?.hasFled) {
      const currentPositions = positionsRef.current || positions;
      
      const threats = getThreatPositionsForFighter(liveEnemy, fightersSnapshot, currentPositions);
      const isHexOccupied = makeIsHexOccupied(currentPositions, liveEnemy.id);
      
      const dest = findBestRetreatHex({
        currentPos: currentPositions[liveEnemy.id],
        threatPositions: threats,
        maxSteps: 4,
        isHexOccupied: isHexOccupied,
        getHexNeighbors: getHexNeighbors,
        isValidPosition: isValidPosition,
        calculateDistance: calculateDistance,
      });
      
      if (dest) {
        setPositions((prev) => ({
          ...prev,
          [liveEnemy.id]: dest.position,
        }));
        
        let hasFled = liveEnemy.moraleState?.hasFled || false;
        if (isAtMapEdge(dest.position, GRID_CONFIG.GRID_WIDTH, GRID_CONFIG.GRID_HEIGHT)) {
          hasFled = true;
        }
        
        setFighters((prev) =>
          prev.map((f) =>
            f.id === liveEnemy.id
              ? {
                  ...f,
                  remainingAttacks: 0,
                  moraleState: {
                    ...(f.moraleState || {}),
                    hasFled: hasFled,
                  },
                }
              : f
          )
        );
        
        addLog(`🏃‍♂️ ${liveEnemy.name} turns tail and flees the battle!`, "warning");
        processingEnemyTurnRef.current = false;
        scheduleEndTurn();
        return;
      }
      
      // No safe hex – falls through to normal AI behavior (maybe defend/cower)
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
        if (settings.useInsanityTrauma) {
          // Check if enemy has Horror Factor
          const enemyHF = enemy.HF || enemy.hf || enemy.horrorFactor || 0;
          if (enemyHF > 0) {
            // Check if player can see this enemy (reverse visibility check)
            const playerCanSeeEnemy = canAISeeTarget(target, enemy, positions, combatTerrain, {
              useFogOfWar: fogEnabled,
              fogOfWarVisibleCells: visibleCells
            });
            
            if (playerCanSeeEnemy) {
              const horrorResult = resolveHorrorCheck(target, enemy);
              
              if (horrorResult.triggered) {
                const updatedViewer = horrorResult.updatedViewer;
                
                // Update viewer in fighters list
                setFighters((prev) =>
                  prev.map((f) => (f.id === target.id ? updatedViewer : f))
                );
                
                if (!horrorResult.success) {
                  // Apply immediate fear penalties: lose 1 action, small strike penalty
                  setFighters((prev) =>
                    prev.map((f) => {
                      if (f.id !== target.id) return f;
                      
                      const before = f.remainingAttacks ?? getAttacksPerMelee(f);
                      const after = Math.max(0, before - 1);
                      
                      return {
                        ...f,
                        remainingAttacks: after,
                        tempMentalPenalties: {
                          ...(f.tempMentalPenalties || {}),
                          strike: -2,
                          parry: -1,
                          dodge: -1,
                          roundsRemaining: 1,
                        },
                      };
                    })
                  );
                  
                  addLog(
                    `😱 ${target.name} recoils in horror at the sight of ${enemy.name} and loses 1 action!`,
                    "warning"
                  );
                }
              }
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
          const attacksPerMelee =
            enemy.attacksPerMelee ||
            enemy.remainingAttacks ||
            1;
          const movementStats = calculateMovementPerAction(
            speed,
            Math.max(1, attacksPerMelee)
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
      
      // Check if target is blocked by another combatant
      const isBlocked = isTargetBlocked(enemy.id, t.id, positions);
      
      return {
        target: t,
        distance: dist,
        hpPercent: t.currentHP / t.maxHP,
        isWounded: t.currentHP < t.maxHP,
        isBlocked: isBlocked,
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
        // All targets blocked - try area attack or choose alternative
        const bestBlocked = blockedTargets[0];
        target = bestBlocked.target;
        reasoning = `target blocked by ${getBlockingCombatant(enemy.id, target.id, positions)?.name || 'another combatant'}, considering area attack`;
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
          if (process.env.NODE_ENV === 'development') {
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
          if (process.env.NODE_ENV === 'development') {
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
    
    // If attack is Spellcasting, choose a specific spell
    let attackName = selectedAttack.name;
    if (selectedAttack.name === "Spellcasting" || selectedAttack.damage === "by spell") {
      const spell = getRandomCombatSpell(enemy.level || 3);
      attackName = `${spell.name} (${spell.damageType})`;
      // Update the attack damage to use the spell's damage
      selectedAttack = { ...selectedAttack, damage: spell.damage, name: attackName };
    }

    // Check weapon range for enemy attacks
    if (positions && positions[enemy.id] && positions[target.id]) {
      // Check if enemy just arrived from pending movement - use CURRENT position
      const enemyCurrentPos = positions[enemy.id];
      const targetCurrentPos = positions[target.id];
      
      // Recalculate distance with current positions using proper hex distance
      currentDistance = calculateDistance(enemyCurrentPos, targetCurrentPos);
      
      addLog(`📍 ${enemy.name} is at (${enemyCurrentPos.x}, ${enemyCurrentPos.y}), ${target.name} is at (${targetCurrentPos.x}, ${targetCurrentPos.y}), distance: ${Math.round(currentDistance)}ft`, "info");
      
      // Use proper weapon range validation
      const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, currentDistance);
      
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
      
      // If we can flank, prioritize flanking positions
      if (flankingPositions.length > 0 && currentFlankingBonus === 0) {
        addLog(`🎯 ${enemy.name} considers flanking ${target.name}`, "info");
        
        // Find the best flanking position (closest to current position)
        const bestFlankPos = flankingPositions.reduce((best, current) => {
          const bestDist = calculateDistance(currentPos, best);
          const currentDist = calculateDistance(currentPos, current);
          return currentDist < bestDist ? current : best;
        });
        
        // Check if we can reach the flanking position
        const flankDistance = calculateDistance(currentPos, bestFlankPos);
        const speed = enemy.Spd || enemy.spd || enemy.attributes?.Spd || enemy.attributes?.spd || 10;
        const maxMoveDistance = speed * 5; // 5 feet per hex
        
        if (flankDistance <= maxMoveDistance) {
          addLog(`🎯 ${enemy.name} attempts to flank ${target.name}`, "info");
          
          // Move to flanking position
          setPositions(prev => {
            const updated = {
            ...prev,
            [enemy.id]: bestFlankPos
            };
            positionsRef.current = updated;
            return updated;
          });
          
          // Deduct movement action cost
          const movementCost = Math.ceil(flankDistance / (speed * 5));
          setFighters(prev => prev.map(f => 
            f.id === enemy.id 
              ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - movementCost) }
              : f
          ));
          
          addLog(`🎯 ${enemy.name} moves to flanking position (${bestFlankPos.x}, ${bestFlankPos.y})`, "info");
          
          // Continue with attack after movement
          setTimeout(() => {
            const newDistance = calculateDistance(bestFlankPos, targetPos);
            const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, newDistance);
            
            if (rangeValidation.canAttack) {
              const flankingBonus = calculateFlankingBonus(bestFlankPos, targetPos, positions, enemy.id);
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
              addLog(`❌ ${enemy.name} cannot reach ${target.name} from flanking position`, "error");
              processingEnemyTurnRef.current = false;
              scheduleEndTurn();
            }
          }, 1000);
          return;
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
          hexesToMove = Math.min(Math.round(currentDistance / GRID_CONFIG.CELL_SIZE) - 1, 3);
          isChargingAttack = true;
          addLog(`⚡ ${enemy.name} decides to charge! (${aiDecision.reason})`, "info");
          break;
          
        case 'move_and_attack':
          movementType = 'MOVE';
          movementDescription = 'moves closer';
          // Use Palladium movement calculation: Speed × 18 ÷ attacks per melee = feet per action
          const moveAndAttackFeetPerAction = (speed * 18) / (enemy.attacksPerMelee || 1);
          const moveAndAttackWalkingSpeed = Math.floor(moveAndAttackFeetPerAction * 0.5); // Walking speed
          hexesToMove = Math.floor(moveAndAttackWalkingSpeed / GRID_CONFIG.CELL_SIZE);
          addLog(`🏃 ${enemy.name} moves closer to attack (${aiDecision.reason})`, "info");
          break;
          
        case 'move_closer': {
          movementType = 'RUN';
          movementDescription = 'runs closer';
          // Use Palladium movement calculation: Speed × 18 ÷ attacks per melee = feet per action
          const moveCloserFeetPerAction = (speed * 18) / (enemy.attacksPerMelee || 1);
          hexesToMove = Math.floor(moveCloserFeetPerAction / GRID_CONFIG.CELL_SIZE);
          addLog(`🏃 ${enemy.name} runs closer (${aiDecision.reason})`, "info");
          break;
        }
          
        case 'use_ranged': {
          // Try to use ranged attack instead of moving
          const rangedAttack = availableAttacks.find(a => a.range && a.range > 0);
          if (rangedAttack) {
            addLog(`🏹 ${enemy.name} uses ranged attack instead of moving (${aiDecision.reason})`, "info");
            setTimeout(() => {
              const flankingBonus = calculateFlankingBonus(positions[enemy.id], positions[target.id], positions, enemy.id);
              const bonuses = flankingBonus > 0 ? { flankingBonus } : {};
              attack(enemy, target.id, bonuses);
            }, 1000);
            processingEnemyTurnRef.current = false;
            scheduleEndTurn();
            return;
          }
          // Fall back to movement if no ranged attack
          movementType = MOVEMENT_ACTIONS.RUN.name;
          movementDescription = 'runs closer';
          // Use MOVEMENT_RATES for Palladium movement calculation
          const movementRates = MOVEMENT_RATES.calculateMovement(speed);
          const fallbackFeetPerAction = movementRates.running / (enemy.attacksPerMelee || 1);
          hexesToMove = Math.floor(fallbackFeetPerAction / GRID_CONFIG.CELL_SIZE);
          break;
        }
          
        default:
          movementType = MOVEMENT_ACTIONS.MOVE.name;
          movementDescription = 'moves';
          hexesToMove = 1;
      }
      
      // Legacy fallback for very far distances - use Palladium movement
      if (currentDistance > 20 * GRID_CONFIG.CELL_SIZE) {
        // Far away - RUN (move at full speed using Palladium formula)
        movementType = MOVEMENT_ACTIONS.RUN.name;
        movementDescription = 'runs';
        
        // Use MOVEMENT_RATES for official Palladium movement
        const movementRates = MOVEMENT_RATES.calculateMovement(speed);
        const maxMovementFeet = movementRates.running / (enemy.attacksPerMelee || 1); // Use feet per action
        hexesToMove = Math.floor(maxMovementFeet / GRID_CONFIG.CELL_SIZE);
        
        addLog(`🏃 ${enemy.name} is very far away, ${movementDescription} at full speed (${maxMovementFeet}ft/action)`, "info");
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
        const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, distanceFromCurrentPos);
        
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
      
      addLog(`🔍 ${enemy.name} movement debug: distance=${Math.round(currentDistance)}ft, hexDistance=${hexDistance}, hexesToMove=${hexesToMove}, movementType=${movementType}`, "info");
      
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
      if (process.env.NODE_ENV === 'development' && moveRatio > 0.1) {
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
        
        addLog(`🔍 ${enemy.name} calculated movement: from (${currentPos.x}, ${currentPos.y}) to (${newX}, ${newY}), hexesThisTurn=${hexesThisTurn}`, "info");
        
        // Check if destination is occupied
        const occupant = isHexOccupied(newX, newY, enemy.id);
        if (occupant) {
          addLog(`🚫 ${enemy.name} cannot move to (${newX}, ${newY}) - occupied by ${occupant.name}`, "info");
          
          // Recalculate distance from CURRENT position (not the blocked destination)
          const distanceFromCurrentPos = calculateDistance(currentPos, targetPos);
          
          // Check if within weapon range
          const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, distanceFromCurrentPos);
          
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
            const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, newDistanceAfterMove);
            
            const updatedEnemy = fighters.find(f => f.id === enemy.id);
            const hasActionsRemaining = updatedEnemy && updatedEnemy.remainingAttacks > 0;
            
            if (rangeValidation.canAttack && hasActionsRemaining) {
              // In range - perform a single attack, then end turn
                    const updatedEnemyForAttack = { ...enemy, selectedAttack: selectedAttack };
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
        addLog(`📍 Moves ${Math.round(distanceMoved)}ft toward ${target.name} → new position (${targetX},${targetY})`, "info");
        
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
            const rangeValidation = validateWeaponRange(enemy, target, selectedAttack, finalDistance);
            
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
                const updatedEnemyForAttack = { ...enemy, selectedAttack: selectedAttack };
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
            addLog("💀 All players are defeated! Enemies win!", "defeat");
            setCombatActive(false);
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
        targetsInLine.forEach((lineTarget) => {
          attack(enemy, lineTarget.id, {
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
    const updatedEnemy = { ...enemy, selectedAttack: selectedAttack };
    
    // Get the number of attacks for this attack type
    const attackCount = selectedAttack.count || 1;
    
    // Determine if this is a charging attack (for bonuses)
    const chargeBonus = isChargingAttack ? { strikeBonus: +2 } : {};
    
    // Check for flanking bonus
    const currentFlankingBonus = calculateFlankingBonus(positions[enemy.id], positions[target.id], positions, enemy.id);
    const flankingBonus = currentFlankingBonus > 0 ? { flankingBonus: currentFlankingBonus } : {};
    
    // Combine all bonuses
    const allBonuses = { ...chargeBonus, ...flankingBonus };
    
    if (flankingBonus.flankingBonus > 0) {
      addLog(`🎯 ${enemy.name} gains +${flankingBonus.flankingBonus} flanking bonus!`, "info");
    }
    
    // Execute attack - handle attack count for multi-strike attacks
    // The count property is for attacks that hit multiple times in ONE action (like dual wield)
    setTimeout(() => {
      // If attackCount > 1, this represents a multi-strike attack (all in one action)
      // The attack function should handle this internally, but we log it for clarity
      if (attackCount > 1) {
        addLog(`⚔️ ${enemy.name} performs ${attackCount}-strike attack!`, "info");
      }
      attack(updatedEnemy, target.id, allBonuses);
      
      // End turn after attack
      processingEnemyTurnRef.current = false;
      setTimeout(() => {
        endTurn();
      }, 1500); // Reduced delay for faster turn progression
    }, 1500);
  }, [fighters, addLog, endTurn, attack, positions, handlePositionChange, isHexOccupied, getAvailableSkills, isEvilAlignment, calculateDistance, setFighters, healerAbility, clericalHealingTouch, medicalTreatment, combatTerrain, arenaEnvironment, scheduleEndTurn]);
  
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
                  handlePlayerAITurn(currentFighter);
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
  function addCreature(creatureData) {
    let newFighter;
    
    // Check if this is a playable character
    if (creatureData.playable) {
      // Auto-roll attributes and create playable character fighter
      newFighter = createPlayableCharacterFighter(creatureData, customEnemyName);
      
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
    } else {
      // Regular creature (existing logic)
      const rolledHP = rollHP(creatureData.HP);
      newFighter = {
        ...creatureData,
        id: `enemy-${generateCryptoId()}`,
        type: "enemy",
        name: customEnemyName || creatureData.name,
        currentHP: rolledHP,
        maxHP: rolledHP,
        initiative: 0,
        status: "active"
      };
      
      // Assign random weapon based on favorite/preferred weapons
      const favoriteWeapons = creatureData.favorite_weapons || creatureData.preferred_weapons || creatureData.favoriteWeapons;
      if (favoriteWeapons) {
        newFighter = assignRandomWeaponToEnemy(newFighter, favoriteWeapons);
        if (newFighter.equippedWeapons && newFighter.equippedWeapons[0]?.name !== "Unarmed") {
          addLog(`⚔️ ${newFighter.name} wields ${newFighter.equippedWeapons[0]?.name}`, "info");
        }
      }
    }
    
        // Apply size modifiers to new fighter (for both playable and regular creatures)
        newFighter = applySizeModifiers(newFighter);
        
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
          
          if (isRanged) {
            const ammoType = weaponName.includes('crossbow') ? 'bolts' : 
                           weaponName.includes('bow') ? 'arrows' : 
                           weaponName.includes('sling') ? 'stones' : 'arrows';
            setAmmoCount(prev => ({
              ...prev,
              [newFighter.id]: { [ammoType]: 20 } // Default 20 arrows/bolts
            }));
            addLog(`🏹 ${newFighter.name} starts with 20 ${ammoType}`, "info");
          }
        }
        
        setFighters(prev => [...prev, newFighter]);

    addLog(`Added ${newFighter.name} to combat!`, "success");
    setCustomEnemyName("");
    setSelectedCreature("");
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
      if (process.env.NODE_ENV === 'development') {
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
      if (process.env.NODE_ENV === 'development') {
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
    }
    
    setCombatPaused(false);
    setLog([]);
    lastAutoTurnKeyRef.current = null;
    setTurnIndex(0);
    setShowPartySelector(false);
    setPsionicsMode(false); // Reset psionics mode
    setSpellsMode(false); // Reset spells mode
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
      
      const totalBonus = handToHandBonus + ppBonus + reachInitiativeMod;
      let initiativeTotal = d20 + totalBonus;
      
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
      
      const updatedFighter = {
        ...fighter,
        initiative: initiativeTotal,
        attacksPerMelee: attacksPerMelee,
        remainingAttacks: attacksPerMelee // Start with full attacks
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
    setCombatActive(true);
    setMode("COMBAT"); // Ensure mode is set to COMBAT so icons appear on the map
    
    addLog("⚔️ Combat Started!", "combat");
    addLog(`Melee Round 1 begins - Actions will alternate in initiative order`, "info");
    addLog(`Initiative Order: ${updatedFighters.map(f => `${f.name} (${f.initiative})`).join(", ")}`, "info");
  }

  function executePsionicPower(caster, target, power) {
    if (!power || !power.name) {
      addLog(`❌ Invalid psionic power provided to executePsionicPower`, "error");
      return false;
    }
    
    addLog(`🧠 Executing psionic: ${power.name} (cost: ${getPsionicCost(power)} ISP, caster ISP: ${getFighterISP(caster)})`, "info");
    
    const resolution = usePsionic(power.name, caster, target, addLog, {
      combatTerrain,
      positions,
    });

    if (!resolution.success) {
      addLog(`❌ Psionic ${power.name} failed: ${resolution.message || 'Unknown error'}`, "error");
      (resolution.additionalLogs || []).forEach(entry => {
        addLog(entry.message, entry.type || "error");
      });
      return false;
    }
    
    addLog(`✅ Psionic ${power.name} executed successfully`, "info");

    setFighters(prev => prev.map(fighter => {
      if (fighter.id === caster.id) {
        return applyFighterUpdates(fighter, resolution.casterUpdates);
      }
      if (target && resolution.targetUpdates && fighter.id === target.id) {
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

    addLog(`🔮 ${caster.name} casts ${combatSpell.name}!`, "combat");

    setFighters((prev) =>
      prev.map((f) => {
        if (f.id !== caster.id) return f;
        const updated = { ...f };
        if (typeof updated.PPE === "number") {
          updated.PPE = Math.max(0, updated.PPE - spellCost);
        }
        if (typeof updated.currentPPE === "number") {
          updated.currentPPE = Math.max(0, updated.currentPPE - spellCost);
        }
        return updated;
      })
    );

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
        setFighters((prev) =>
          prev.map((f) => {
            if (f.id !== healTarget.id) return f;
            const updatedTarget = { ...f };
            const newHP = clampHP(getFighterHP(updatedTarget) + healAmount, updatedTarget);
            applyHPToFighter(updatedTarget, newHP);
            return updatedTarget;
          })
        );
        addLog(`💚 ${healTarget.name} recovers ${healAmount} HP from ${combatSpell.name}!`, "combat");
      } else if (combatSpell.effect) {
        addLog(`✨ ${combatSpell.effect}`, "combat");
    }

      addLog(`🔮 ${caster.name} spent ${spellCost} PPE`, "combat");
      endTurn();
    return true;
  }

    let spellSaveInfo = null;
    let saveResisted = false;

    if (hasSpellDamage(combatSpell) && target) {
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
      const damageRoll = CryptoSecureDice.parseAndRoll(combatSpell.damage);
      let damage = damageRoll.totalWithBonus;
      if (saveResisted) {
        damage = Math.max(1, Math.floor(damage / 2));
      }

      setFighters((prev) =>
        prev.map((f) => {
          if (f.id !== target.id) return f;

          const updatedTarget = { ...f };
          const newHP = clampHP(getFighterHP(updatedTarget) - damage, updatedTarget);
          applyHPToFighter(updatedTarget, newHP);
          return updatedTarget;
        })
      );

      addLog(`💥 ${combatSpell.name} hits ${target.name} for ${damage} damage!`, "combat");
    } else if (combatSpell.effect) {
      addLog(`✨ ${combatSpell.effect}`, "combat");
    }

    addLog(`🔮 ${caster.name} spent ${spellCost} PPE`, "combat");
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
      setTimeout(() => endTurn(), 500);
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
        setTimeout(() => endTurn(), 500);
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
        setTimeout(() => endTurn(), 500);
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
        setTimeout(() => endTurn(), 500);
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
          setTimeout(() => endTurn(), 500);
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
          setTimeout(() => endTurn(), 500);
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
        setTimeout(() => endTurn(), 500);
        return;
      
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
          setTimeout(() => endTurn(), 500);
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
            setTimeout(() => endTurn(), 500);
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
              setTimeout(() => endTurn(), 500);
              return;
            } else if (selectedManeuver === "trip") {
              executeTripManeuver(currentFighter, targetToExecute);
              setSelectedManeuver(null); // Clear selection after use
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              setTimeout(() => endTurn(), 500);
              return;
            } else if (selectedManeuver === "shove") {
              executeShoveManeuver(currentFighter, targetToExecute);
              setSelectedManeuver(null); // Clear selection after use
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              setTimeout(() => endTurn(), 500);
              return;
            } else if (selectedManeuver === "disarm") {
              executeDisarmManeuver(currentFighter, targetToExecute);
              setSelectedManeuver(null); // Clear selection after use
              executingActionRef.current = false;
              clearTimeout(lockTimeout);
              setTimeout(() => endTurn(), 500);
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
        return;
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
      
      case "Use Skill":
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
        setTimeout(() => endTurn(), 1500);
        return;
      
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
        setTimeout(() => endTurn(), 500);
        return;
    }

    // Clear selections - most actions return early, but this is a fallback
    // (Should not reach here due to returns above)
  }


  function resetCombat() {
    // Reset closed distances when combat ends
    resetClosedDistances(combatStateRef.current);
    setFighters(prev => prev.map(f => {
      // Use resetGrapple to reset grapple state for each fighter
      const fighterCopy = { ...f };
      resetGrapple(fighterCopy);
      
      return {
        ...fighterCopy,
        currentHP: f.maxHP,
        status: "active",
        initiative: 0
      };
    }));
    setTurnIndex(0);
    setCombatActive(false);
    setCombatPaused(false);
    lastAutoTurnKeyRef.current = null;
    setLog([]);
    setDiceRolls([]);
    setSelectedParty([]);
    setSelectedAttack(0); // Reset attack selection
    setPsionicsMode(false); // Reset psionics mode
    setSpellsMode(false); // Reset spells mode
    setVisibleCells([]);
    setExploredCells(resetFogMemory());
    addLog("Combat reset! Fog of war memory cleared.", "info");
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
      if (magicSpells.length === 0 && derivedSpells.length > 0) {
        magicSpells = derivedSpells
          .map(convertUnifiedSpellToCombatSpell)
          .filter(Boolean);
      }

      const existingPPE = typeof char.PPE === "number" ? char.PPE : 0;
      const derivedPPE =
        (unified?.magic?.maxPPE ?? unified?.energy?.PPE ?? 0);
      const PPEValue = existingPPE > 0 ? existingPPE : derivedPPE;
      const currentPPEValue =
        typeof char.currentPPE === "number"
          ? char.currentPPE
          : (PPEValue > 0 ? PPEValue : undefined);
      
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
        // Add attacks array for combat (equipped weapon or unarmed)
        attacks: [{
          name: equippedWeaponName,
          damage: equippedWeapons[0]?.damage || "1d3",
          type: (equippedWeapons[0]?.type === "unarmed" || !equippedWeapons[0]) ? "melee" : "melee"
        }]
      };

      if (currentPPEValue !== undefined) {
        fighter.currentPPE = currentPPEValue;
      }

        // Apply size modifiers to fighter
        const fighterWithSizeMods = applySizeModifiers(fighter);
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
          addLog("💀 All players are defeated! Enemies win!", "defeat");
          setCombatActive(false);
        } else if (consciousEnemies.length === 0) {
          // All enemies are either dead or unconscious - players win
          combatEndCheckRef.current = true;
          addLog("🎉 Victory! All enemies defeated!", "victory");
          setCombatActive(false);
        }
      };
      
      // Delay the check to allow for state updates to complete
      setTimeout(checkCombatEnd, 500);
    }
  }, [fighters, combatActive, turnIndex, alivePlayers, aliveEnemies, canFighterAct, addLog]); // Check on turn changes

  // Update visible cells for fog of war (optimized for performance)
  const updateVisibleCells = useCallback(() => {
    if (!fogEnabled || !fighters || !positions || Object.keys(positions).length === 0) {
      setVisibleCells([]);
      return;
    }

    // Get all player positions
    const playerFighters = fighters.filter(f => f.type === "player" && positions[f.id]);
    if (playerFighters.length === 0) {
      setVisibleCells([]);
      return;
    }

    // Get visibility range from scene setup (computed in Phase0PreCombatModal)
    // This includes terrain and lighting modifiers, or fallback to lighting-based calculation
    const lighting = combatTerrain?.lighting || "BRIGHT_DAYLIGHT";
    const baseRange = combatTerrain?.visibilityRange || getVisibilityRange(lighting, false, null);
    
    // Extract terrain obstacles from terrain data if available
    const terrainObstaclesList = []; // Can be populated from terrain.grid if needed
    
    // Calculate visible cells for all players (union)
    const observerPositions = playerFighters.map(f => positions[f.id]).filter(pos => pos);
    if (observerPositions.length === 0) {
      setVisibleCells([]);
      return;
    }
    
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
          mapType: combatTerrain?.mapType || "hex"
        });
      } else {
        // Multiple observers - use calculateVisibleCellsMultiple to combine visibility
        visible = calculateVisibleCellsMultiple(observerPositions, baseRange, {
          terrain: combatTerrain || { lighting, mapType: "hex" },
          lighting: lighting,
          hasInfravision: false, // TODO: Check player abilities for infravision
          isProwling: false, // TODO: Check if player is successfully prowling
          terrainObstacles: terrainObstaclesList,
          mapType: combatTerrain?.mapType || "hex"
        });
      }
      
      // Debug logging (only in development)
      if (process.env.NODE_ENV === 'development' && visible.length > 0) {
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
            startTransition(() => {
              resetCombat();
            });
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

      {/* Combined Combat Arena & Tactical Map Controls - Resizable */}
      {fighters.length > 0 && (
        <FloatingPanel
          title={`🗺️ Combat Arena - Dual View (2D + 3D)`}
          initialWidth={1200}
          initialHeight={600}
          zIndex={1000}
          minWidth={800}
          minHeight={400}
          center={true}
        >
          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between" align="center" wrap="wrap">
              <VStack align="start" spacing={1}>
                <Text fontSize="xs" color="gray.600">
                  Dual-view battlefield: 2D tactical map (left) + 3D hex arena (right) - ${currentMapType === "square" ? "⬛ (Dungeon)" : "⬡ (Wilderness)"}
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
                  {show3DView ? "🎮 Hide 3D View" : "🎮 Show 3D View"}
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
                  <Button
                    size="sm"
                    colorScheme="green"
                    onClick={startCombatFromEditor}
                  >
                    ▶️ Start Combat
                  </Button>
              )}
              </HStack>
            </HStack>
            
            {/* Map Height Controls */}
            {showTacticalMap && mapViewMode === '2D' && (
              <HStack spacing={2} align="center" justify="space-between" wrap="wrap">
                <HStack spacing={2}>
                  <Text fontSize="xs" color="gray.600" fontWeight="semibold">
                    Map Height: {mapHeight}px
                </Text>
                  <Button 
                    size="xs" 
                    colorScheme="blue" 
                    onClick={() => setMapHeight(prev => Math.max(400, prev - 50))}
                    title="Decrease map height"
                  >
                    ➖
                  </Button>
                  <Button 
                    size="xs" 
                    colorScheme="blue" 
                    onClick={() => setMapHeight(prev => Math.min(1200, prev + 50))}
                    title="Increase map height"
                  >
                    ➕
                  </Button>
                </HStack>
                <Button 
                  size="xs" 
                  colorScheme="purple" 
                  onClick={() => {
                    // Debug function - can be expanded if needed
                    console.log('Map Height:', mapHeight);
                  }} 
                  title="Debug map dimensions"
                >
                  🔍 Debug
                </Button>
              </HStack>
            )}
            
            {/* Movement Mode Active Info Box */}
            {showTacticalMap && mapViewMode === '2D' && movementMode.active && currentFighter && positions[currentFighter.id] && (
              <Box p={3} bg="green.50" borderRadius="md" borderWidth="1px" borderColor="green.300">
                <VStack align="stretch" spacing={2} fontSize="xs">
                  <HStack spacing={2} align="center">
                    <Text fontSize="sm" fontWeight="bold" color="green.700">
                      🚶 Movement Mode Active
                    </Text>
                    <Badge colorScheme={movementMode.isRunning ? "green" : "orange"} fontSize="xs">
                      {movementMode.isRunning ? "Running" : "Walking"}
                    </Badge>
                  </HStack>
                  <Text fontSize="xs" color="gray.700">
                    Click a colored hex to select destination:
                  </Text>
                  <HStack spacing={2} wrap="wrap">
                    <Badge colorScheme="green" fontSize="xs">🟢 Green: 1 action (15s)</Badge>
                    <Badge colorScheme="yellow" fontSize="xs">🟡 Yellow: 2 actions (30s)</Badge>
                    <Badge colorScheme="orange" fontSize="xs">🟠 Orange: 3 actions (45s)</Badge>
                    <Badge colorScheme="red" fontSize="xs">🔴 Red: 4 actions (60s)</Badge>
                  </HStack>
              
              {/* Palladium Movement Analysis */}
                  {(() => {
                    const speed = currentFighter.Spd || currentFighter.spd || currentFighter.attributes?.Spd || currentFighter.attributes?.spd || 10;
                    const attacksPerMelee = currentFighter.attacksPerMelee || 1;
                    const movement = calculateMovementPerAction(speed, attacksPerMelee);
                    
                    return (
                      <Box bg="blue.50" p={2} borderRadius="md" mt={2}>
                        <VStack spacing={1} align="stretch">
                          <Text fontSize="xs" fontWeight="bold" color="blue.700">
                            📊 Palladium Movement (Speed {speed} × 18 = {movement.display.feetPerMelee}ft/melee)
                          </Text>
                          <HStack spacing={2} fontSize="xs" wrap="wrap">
                            <Badge colorScheme={movementMode.isRunning ? "green" : "orange"}>
                              {movementMode.isRunning ? "Running" : "Walking"}: {movementMode.isRunning ? movement.display.feetPerAction : movement.combatMovementPerAction}ft/action
                            </Badge>
                            <Badge colorScheme="purple">
                              Total: {movement.display.feetPerMelee}ft/melee
                            </Badge>
                          </HStack>
                          <Text fontSize="xs" color="gray.600" fontStyle="italic">
                            ⚡ Official 1994 Formula: Speed × 18 = Feet/Melee
                          </Text>
                        </VStack>
                  </Box>
                    );
              })()}
              
                  {/* Selected Hex Info */}
                  {selectedHex && (() => {
                    const distance = calculateDistance(positions[currentFighter.id], selectedHex);
                    const engagementRange = getEngagementRange(distance);
                    return (
                      <Box bg="white" p={2} borderRadius="md" borderWidth="1px" borderColor="green.300" mt={2}>
                        <VStack spacing={2} align="stretch">
                          <HStack spacing={2} align="center" wrap="wrap">
                            <Badge colorScheme="green" fontSize="xs">
                              Target: ({selectedHex.x}, {selectedHex.y})
                            </Badge>
                            <Badge colorScheme="blue" fontSize="xs">
                              Distance: {Math.round(distance)}ft
                            </Badge>
                            <Badge colorScheme={engagementRange.canMeleeAttack ? "red" : "orange"} fontSize="xs">
                              {engagementRange.name}
                            </Badge>
                          </HStack>
                          <HStack spacing={2}>
                <Button
                              size="xs"
                  colorScheme="green"
                              onClick={() => handleMoveSelect(selectedHex.x, selectedHex.y)}
                            >
                              ✓ Execute Move
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => setSelectedHex(null)}
                            >
                              Cancel
                </Button>
              </HStack>
                        </VStack>
            </Box>
                    );
                  })()}
                </VStack>
        </Box>
      )}

            {/* Hex Selection Info Box */}
            {showTacticalMap && mapViewMode === '2D' && !movementMode.active && (hoveredCell || selectedHex) && (
              <Box p={2} bg="blue.100" borderRadius="md" borderWidth="1px" borderColor="blue.300">
                <VStack align="stretch" spacing={2} fontSize="xs">
                  {selectedHex && currentFighter && positions[currentFighter.id] && (() => {
                    const distance = calculateDistance(positions[currentFighter.id], selectedHex);
                    const engagementRange = getEngagementRange(distance);
                    return (
                      <HStack spacing={2} align="center">
                        <Badge colorScheme="green" fontSize="xs">
                          Selected Hex: ({selectedHex.x}, {selectedHex.y})
                        </Badge>
                        <Badge colorScheme="blue" fontSize="xs">
                          Distance: {Math.round(distance)}ft
                        </Badge>
                        <Badge colorScheme={engagementRange.canMeleeAttack ? "red" : "orange"} fontSize="xs">
                          {engagementRange.name}
                        </Badge>
                      </HStack>
                    );
                  })()}
                  {hoveredCell && selectedCombatantId && positions[selectedCombatantId] && (() => {
                    const distance = calculateDistance(positions[selectedCombatantId], hoveredCell);
                    return (
                      <HStack spacing={2} align="center">
                        <Badge colorScheme="blue" fontSize="xs">
                          Hovered: ({hoveredCell.x}, {hoveredCell.y})
                        </Badge>
                        <Badge colorScheme="cyan" fontSize="xs">
                          Distance: {Math.round(distance)}ft
                        </Badge>
                      </HStack>
                    );
                  })()}
                  {hoveredCell && !selectedCombatantId && (
                    <Badge colorScheme="blue" fontSize="xs" w="fit-content">
                      Hovered: ({hoveredCell.x}, {hoveredCell.y})
                    </Badge>
              )}
            </VStack>
        </Box>
      )}
          </VStack>
        </FloatingPanel>
      )}
      {/* Combat Options FloatingPanel */}
      {fighters.length > 0 && currentFighter && currentFighter.type === "player" && combatActive && !aiControlEnabled && (
        <FloatingPanel
          title={`🎯 Combat Options for ${currentFighter.name}`}
          initialX={50}
          initialY={50}
          initialWidth={400}
          initialHeight={600}
          zIndex={1002}
          minWidth={350}
          minHeight={400}
          bg="rgba(255, 255, 255, 0.95)"
        >
          <Box
            w="100%"
            h="100%"
            overflowY="auto"
            overflowX="hidden"
            p={4}
            sx={{
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'green.300',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: 'green.400',
              },
            }}
          >
            <VStack spacing={3} align="stretch">
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
                          }
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </Wrap>
                </Box>
                
                <HStack spacing={4} align="center" justify="center" flexWrap="wrap">

                    {/* Dedicated Move Button */}
                    <Button
                      colorScheme="blue"
                      onClick={activateMovementMode}
                      isDisabled={!currentFighter || currentFighter.type !== "player" || !showTacticalMap}
                      size="md"
                      title={!showTacticalMap ? "Show tactical map first to enable movement" : "Click to activate movement mode"}
                    >
                      🚶 Move
                    </Button>

                    {/* Dedicated Run Button */}
                    <Button
                      colorScheme="orange"
                      onClick={() => {
                        if (currentFighter && currentFighter.type === "player") {
                          setMovementMode({ active: true, isRunning: true });
                          setSelectedMovementFighter(currentFighter.id);
                          addLog(`🏃 ${currentFighter.name} prepares to run (full speed movement)`, "info");
                        }
                      }}
                      isDisabled={!currentFighter || currentFighter.type !== "player" || !showTacticalMap}
                      size="md"
                      title={!showTacticalMap ? "Show tactical map first to enable running" : "Click to activate running mode (full speed)"}
                    >
                      🏃 Run
                    </Button>

                    {/* Movement Instructions */}
                    {showTacticalMap && currentFighter && currentFighter.type === "player" && (
                      <VStack spacing={1} align="start">
                        <Text fontSize="xs" color="blue.600" fontStyle="italic">
                          Click &quot;Move&quot; then click a green hex to move
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
                                  // Here you could push lootResult into a party loot bag state
                                  // setLoot(prev => [...prev, lootResult]);
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

                    {/* Spell Selection Buttons (only for Spells) */}
                    {selectedAction?.name === "Spells" && currentFighter && hasSpells && spellsMode && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2}>Select Spell:</Text>
                        <Wrap spacing={2}>
                          {availableSpells.map((spell, index) => (
                            <Button
                              key={index}
                              size="sm"
                              variant={selectedSpell?.name === spell.name ? "solid" : "outline"}
                              colorScheme={selectedSpell?.name === spell.name ? "green" : "blue"}
                              onClick={() => {
                                setSelectedSpell(spell);
                                addLog(`Spell selected: ${spell.name} (${spell.cost ?? spell.ppe ?? spell.PPE ?? 0} PPE)`, "info");
                              }}
                            >
                              {spell.name} ({spell.cost ?? spell.ppe ?? spell.PPE ?? 0} PPE)
                            </Button>
                          ))}
                        </Wrap>
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
                  </HStack>

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
          </FloatingPanel>
      )}
      
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
                          {fighter.alignment && (
                            <Badge colorScheme="gray" size="sm">{fighter.alignment}</Badge>
                          )}
                        </HStack>
                        
                        <Text fontSize="sm" color="blue.700">
                          HP: {fighter.currentHP}/{fighter.maxHP} | AR: {fighter.AR || 10} | Speed: {fighter.Spd || fighter.spd || fighter.attributes?.Spd || fighter.attributes?.spd || 10}
                          {fighter.ISP !== undefined && ` | ISP: ${fighter.ISP}`}
                          {fighter.PPE !== undefined && ` | PPE: ${fighter.PPE}`}
                        </Text>
                        
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
                        {(fighter.equipped || fighter.equippedWeapons || fighter.equippedArmor || fighter.equippedWeapon) && (
                          <Accordion allowToggle w="100%" size="xs">
                            <AccordionItem border="none">
                              <AccordionButton px={0} py={1} _hover={{ bg: "transparent" }}>
                                <Box flex="1" textAlign="left">
                                  <Text fontSize="xs" color="gray.600" fontWeight="bold">Equipment</Text>
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
                                  {fighter.equippedArmor && (
                                    <HStack spacing={2}>
                                      <Text fontWeight="medium">Armor:</Text>
                                      <Text>{fighter.equippedArmor.name || fighter.equippedArmor}</Text>
                                    </HStack>
                                  )}
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
                
                {/* Dual View: 2D and 3D side-by-side */}
                <Flex direction="row" gap={4} width="100%" height="100%">
                  {/* 2D Tactical Map - Always mounted */}
                  <Box width={show3DView ? "50%" : "100%"} minHeight="600px">
                <TacticalMap
                  combatants={fighters.map(f => ({ 
                    ...f, 
                    _id: f.id,
                    isEnemy: f.type === "enemy" 
                  }))}
                  positions={positions}
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
                      onSelectedHexChange={setSelectedHex}
                      terrain={mode === "MAP_EDITOR" ? mapDefinition : arenaEnvironment}
                      activeCircles={activeCircles}
                      mapType={currentMapType}
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
                      mode={mode}
                      mapDefinition={mapDefinition}
                />
              </Box>

                  {/* 3D Hex Arena - Hidden by default, toggle with button */}
                  {show3DView && (
                    <Box width="50%" minHeight="600px">
                      <HexArena3D
                        mapDefinition={mapDefinition}
                        fighters={fighters}
                        positions={positions}
                        terrain={arenaEnvironment}
                        mode={mode}
                        visible={show3DView}
                      />
                    </Box>
                  )}
                </Flex>

                {/* Melee Round & Action Panel */}
                {showTacticalMap && fighters.length > 0 && combatActive && (
                  <FloatingPanel
                    title="⚔️ Melee Round & Action"
                    initialX={550}
                    initialY={60}
                    initialWidth={400}
                    initialHeight={500}
                    zIndex={1001}
                    minWidth={350}
                    minHeight={300}
                  >
                    <VStack align="stretch" spacing={3} fontSize="sm">
                      <Box>
                        <Text fontWeight="bold" fontSize="lg" color="green.600">
                          Melee Round {meleeRound} - {currentFighter?.name}&apos;s Action
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
                       combatActive && 
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
                  </FloatingPanel>
                )}
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
                            {fighter.alignment && (
                              <Badge colorScheme="gray" size="sm">{fighter.alignment}</Badge>
                            )}
                          </HStack>
                          
                          <Box fontSize="sm">
                            HP: {fighter.currentHP}/{fighter.maxHP} | AR: {fighter.AR || 10} | Speed: {fighter.Spd || fighter.spd || fighter.attributes?.Spd || fighter.attributes?.spd || 10}
                            {fighter.ISP !== undefined && ` | ISP: ${fighter.ISP}`}
                            {fighter.PPE !== undefined && ` | PPE: ${fighter.PPE}`}
                          </Box>
                          
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
                                    {fighter.equippedArmor && (
                                      <HStack spacing={2}>
                                        <Text fontWeight="medium">Armor:</Text>
                                        <Text>{fighter.equippedArmor.name || fighter.equippedArmor}</Text>
                                      </HStack>
                                    )}
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
            
            {/* Combat Info Panel */}
            <FloatingPanel
              title="📊 Combat Info"
              initialWidth={350}
              initialHeight={600}
              zIndex={1001}
              minWidth={300}
              minHeight={400}
              bg="rgba(255, 255, 255, 0.91)"
              center={true}
            >
              <Tabs size="sm" colorScheme="blue" isLazy>
                <TabList>
                  <Tab fontSize="xs">🗒️ Log</Tab>
                  <Tab fontSize="xs">⚔️ Fighter</Tab>
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
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </FloatingPanel>
          </VStack>
          </>
        }
      />

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
                  if (creature) addCreature(creature);
                }}
                isDisabled={!selectedCreatureData}
              >
                Add to Combat
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
          if (process.env.NODE_ENV === 'development') {
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
            if (process.env.NODE_ENV === 'development') {
              console.log('[CombatPage] Raw results.environment:', results.environment);
              console.log('[CombatPage] results.environment keys:', Object.keys(results.environment));
              console.log('[CombatPage] results.environment.mapType value:', results.environment.mapType);
              if (!results.environment.mapType) {
                console.error('[CombatPage] ERROR: mapType is missing from environment! Full object:', JSON.stringify(results.environment, null, 2));
              }
            }
            
            setCombatTerrain(results.environment);
            if (process.env.NODE_ENV === 'development') {
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

      {/* Game Settings Modal */}
      <GameSettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

    </Box>
  );
}
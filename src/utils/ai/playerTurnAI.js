/**
 * Player Turn AI Module
 *
 * Handles AI decision-making for player characters during combat.
 * This is a pure function module - no React hooks or state management.
 * All state updates are done via callbacks passed in the context.
 */

import { isBleeding } from "../bleedingSystem.js";
import { canFly, isFlying, getAltitude } from "../abilitySystem";
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
  chooseBestOffensivePsionic,
  chooseBestHealingPsionic,
} from "../psionicDecisionHelpers";

const UNDEAD_KEYWORDS = [
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

function isUndeadUnit(unit) {
  const label = (
    unit?.species ||
    unit?.race ||
    unit?.type ||
    unit?.name ||
    ""
  ).toLowerCase();

  if (!label) return false;
  return UNDEAD_KEYWORDS.some((w) => label.includes(w));
}

// Undead creature detection for routing immunity
function isUndeadCreature(fighter) {
  const name = (fighter.name || fighter.displayName || "").toLowerCase();
  const type = (fighter.type || fighter.creatureType || "").toLowerCase();

  const undeadKeywords = [
    "undead",
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

  return undeadKeywords.some((k) => name.includes(k) || type.includes(k));
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

  // Palladium "good" family: Principled, Scrupulous, etc.
  return (
    text.includes("good") ||
    text.includes("principled") ||
    text.includes("scrupulous")
  );
}

// Healer OCC detection based on rulebook OCC list (Clergy)
function isHealerOccForAI(fighter = {}) {
  if (!fighter) return false;

  const occText = [
    fighter.OCC,
    fighter.occ,
    fighter.class,
    fighter.occName,
    fighter.rcc,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Map directly to OCCs you defined in occData.js (category: "Clergy")
  // Priest, PriestOfLight, PriestOfDarkness, Healer, Druid, Shaman
  const healerPatterns = [
    "priest of light",
    "priest of darkness",
    "priest", // generic priest OCC
    "healer",
    "druid",
    "shaman",
  ];

  return healerPatterns.some((pattern) => occText.includes(pattern));
}

// Healer archetype detection
function isHealerArchetype(player) {
  const rawOcc =
    player.occId ||
    player.occ ||
    player.OCC ||
    player.classId ||
    player.className ||
    player.occName ||
    player.archetype ||
    "";

  const occ = String(rawOcc).toLowerCase();

  // Core Palladium healer-ish OCCs
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

  if (healerKeywords.some((k) => occ.includes(k))) {
    return true;
  }

  // Fallback: look at spell list – a character with multiple healing spells
  // is probably a healer in practice.
  if (Array.isArray(player.spells)) {
    const healingLike = player.spells.filter((s) => {
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
  { criticalOnly = false } = {}
) {
  // We consider "allies" to be other fighters on the same side.
  const allies = fighters.filter(
    (f) =>
      f.id !== player.id && !f.isDead && !f.isDying && f.type === player.type // same type = same side
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

// Very lightweight spell/psionic classifiers for "escape" options.
// We keep this intentionally fuzzy; it will only trigger if such powers exist.
function isPotentialEscapeSpell(spell = {}) {
  const name = (spell.name || "").toLowerCase();
  const text = (
    spell.effect ||
    spell.description ||
    spell.summary ||
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
    "force field",
    "forcefield",
  ];

  return escapeKeywords.some((kw) => name.includes(kw) || text.includes(kw));
}

function isPotentialEscapePsionic(power = {}) {
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
function attemptEscapeIfOutmatched({
  player,
  target,
  positions,
  escapeSpells,
  escapePsionics,
  ispAvailable,
  ppeAvailable,
  addLog,
  processingPlayerAIRef,
  calculateDistance,
  executeSpell,
  executePsionicPower,
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
    (escapeSpells && escapeSpells.length > 0) ||
    (escapePsionics && escapePsionics.length > 0);
  if (!hasEscapeTools) return false;

  // We don't decide *here* if we're outmatched; caller passes that info
  // If caller says "try to escape", we burn the first escape tool that fits.

  // Prefer psionic escape (usually cheaper / instant)
  if (escapePsionics && escapePsionics.length > 0) {
    const power =
      escapePsionics.find((p) => (p.isp || p.ISP || 0) <= ispAvailable) ||
      escapePsionics[0];
    if (power) {
      addLog(
        `🧠 ${player.name} is outmatched in melee and tries to escape with psionic ${power.name}!`,
        "info"
      );
      if (executePsionicPower(player, player, power)) {
        processingPlayerAIRef.current = false;
        return true;
      }
    }
  }

  // Fallback: escape-type spell
  if (escapeSpells && escapeSpells.length > 0) {
    const spell =
      escapeSpells.find(
        (s) => (s.cost ?? s.ppe ?? s.PPE ?? 0) <= ppeAvailable
      ) || escapeSpells[0];

    if (spell) {
      addLog(
        `🔮 ${player.name} is outmatched in melee and tries to escape with spell ${spell.name}!`,
        "info"
      );
      if (executeSpell(player, player, spell)) {
        processingPlayerAIRef.current = false;
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
export function runPlayerTurnAI(player, context) {
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
    findRetreatDestination,
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
    // Player AI async guardrails (optional, provided by CombatPage)
    playerAIActionScheduledRef,
    playerAITurnTokenRef,
    playerAITurnToken,
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
  } = context;

  const tokenStillValid = () => {
    if (!playerAITurnTokenRef || !playerAITurnToken) return true;
    return playerAITurnTokenRef.current === playerAITurnToken;
  };
  const markActionScheduled = () => {
    if (playerAIActionScheduledRef) playerAIActionScheduledRef.current = true;
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
    if (dbg) addLog?.(`🧠 ArielAI: ${msg}`, "info");
  };

  trace(
    `start | remainingAttacks=${player?.remainingAttacks ?? "?"} | enemies=${
      fighters.filter(
        (f) =>
          f.type === "enemy" && canFighterAct(f) && (f.currentHP ?? 0) > -21
      ).length
    } | posKeys=${Object.keys(positions || {}).length}`
  );

  // ✅ CRITICAL: Check if player can act (conscious, not dying/dead/unconscious)
  if (!canFighterAct(player)) {
    const hpStatus = getHPStatus(player.currentHP);
    addLog(
      `⏭️ ${player.name} cannot act (${hpStatus.description}), skipping turn`,
      "info"
    );
    trace(`exit: cannot act (${hpStatus?.description || "unknown"})`);
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }

  // 🔴 NEW: Check if paralyzed
  const isParalyzed = player.statusEffects?.some(
    (e) =>
      (typeof e === "string" && e === "PARALYZED") ||
      (typeof e === "object" && e.type === "PARALYZED")
  );
  if (isParalyzed) {
    addLog(`⏭️ ${player.name} is paralyzed and cannot act this round!`, "info");
    trace(`exit: paralyzed`);
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }

  // 🧟 Undead exception: they never flee from morale ROUTED
  if (
    isUndeadUnit(player) &&
    (player.moraleState?.status === "ROUTED" ||
      player.statusEffects?.includes("ROUTED"))
  ) {
    addLog(
      `💀 ${player.name} is undead and refuses to flee (ignoring ROUTED).`,
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

  // 🔴 NEW: Check if routed - if so, attempt to flee instead of fighting
  if (
    player.moraleState?.status === "ROUTED" ||
    player.statusEffects?.includes("ROUTED")
  ) {
    addLog(`🏃 ${player.name} is ROUTED and attempts to flee!`, "warning");
    trace(`route: attempting flee`);

    // Attempt to withdraw from threats
    const currentPos = positions[player.id];
    if (!currentPos) {
      addLog(
        `⚠️ ${player.name} cannot withdraw (no position data).`,
        "warning"
      );
      trace(`exit: routed but no position data`);
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return;
    }

    // Get active enemy fighters as threats
    const enemyFighters = fighters.filter(
      (f) =>
        f.type === "enemy" &&
        canFighterAct(f) &&
        f.currentHP > 0 &&
        f.currentHP > -21
    );

    // If no active enemies, just end turn
    if (enemyFighters.length === 0) {
      addLog(`⚠️ ${player.name} finds no active foes.`, "info");
      trace(`exit: no active foes`);
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return;
    }

    // Calculate threat positions
    const threatPositions = enemyFighters
      .map((f) => positions[f.id])
      .filter(Boolean);

    if (threatPositions.length === 0) {
      addLog(`🛡️ ${player.name} cannot see any threats.`, "info");
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
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return;
    }

    // Calculate max retreat steps based on movement
    const speed =
      player.Spd ||
      player.spd ||
      player.attributes?.Spd ||
      player.attributes?.spd ||
      10;
    const attacksPerMelee = player.attacksPerMelee || 2;
    const fullFeetPerAction = (speed * 18) / Math.max(1, attacksPerMelee);
    const maxSteps = Math.max(
      1,
      Math.min(Math.floor(fullFeetPerAction / GRID_CONFIG.CELL_SIZE), 5)
    );

    // Try to find retreat destination
    const retreatDestination = findRetreatDestination({
      currentPos,
      threatPositions,
      maxSteps,
      enemyId: player.id,
      isHexOccupied,
    });

    if (retreatDestination && retreatDestination.position) {
      addLog(
        `🚶 ${player.name} withdraws from threats to (${retreatDestination.position.x}, ${retreatDestination.position.y}).`,
        "info"
      );
      trace(
        `action: withdraw | to=(${retreatDestination.position.x},${retreatDestination.position.y})`
      );

      // Actually move the player using handlePositionChange
      handlePositionChange(player.id, retreatDestination.position, {
        movementType: "withdraw",
        source: "AI_WITHDRAW",
        threatPositions: threatPositions,
      });

      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return;
    }

    // No safe retreat hex found → end turn
    addLog(
      `⚠️ ${player.name} looks for a safe place to withdraw but finds none.`,
      "warning"
    );

    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }

  // Check if combat is still active
  if (!combatActive) {
    addLog(`⚠️ Combat ended, ${player.name} skips turn`, "info");
    processingPlayerAIRef.current = false;
    return;
  }

  // Check if player has actions remaining
  if (player.remainingAttacks <= 0) {
    addLog(
      `⏭️ ${player.name} has no actions remaining - passing to next fighter in initiative order`,
      "info"
    );
    trace(
      `exit: no actions remaining | remainingAttacks=${player.remainingAttacks}`
    );
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }

  // ✅ FIX: Filter enemies by visibility AND exclude unconscious/dying/dead targets
  // Only target conscious enemies (HP > 0) - unconscious/dying enemies are already defeated
  const allEnemies = fighters.filter(
    (f) =>
      f.type === "enemy" &&
      canFighterAct(f) &&
      f.currentHP > 0 && // Only conscious enemies
      f.currentHP > -21 // Not dead
  );

  // Get equipped weapons early for reachability checks
  const equippedWeapons = getEquippedWeapons(player);

  // Check if player has ranged weapons (used to determine if we should respect "unreachable" marks)
  const hasRangedWeapon = equippedWeapons.some((w) => {
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
      `weapon detection: equippedWeapons=${
        equippedWeapons.length
      } | hasRanged=${hasRangedWeapon} | weapons=[${equippedWeapons
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
    `targets: allEnemies=${allEnemies.length} | filtered=${enemyTargets.length} | equippedWeapons=${equippedWeapons.length}`
  );

  if (enemyTargets.length === 0) {
    // Check if there are enemies but they're just not visible
    if (allEnemies.length > 0) {
      // Only log visibility issues once per melee round per player to avoid spam
      // Use meleeRound instead of turnCounter since turnCounter changes every action
      const visibilityLogKey = `${player.id}_round_${meleeRound}`;
      if (!visibilityLogRef.current.has(visibilityLogKey)) {
        addLog(
          `👁️ ${player.name} cannot see any enemies (hidden/obscured).`,
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
      addLog(`${player.name} has no targets and defends.`, "info");
      trace(`exit: no targets (all enemies defeated/removed)`);
    }
    processingPlayerAIRef.current = false;
    scheduleEndTurn();
    return;
  }

  const occLower = (
    player.OCC ||
    player.occ ||
    player.class ||
    ""
  ).toLowerCase();
  const fighterSpells = getFighterSpells(player) || [];
  const fighterPsionics = getFighterPsionicPowers(player);
  const ppeAvailable = getFighterPPE(player);
  const ispAvailable = getFighterISP(player);

  const hasSpells = Array.isArray(fighterSpells) && fighterSpells.length > 0;

  // Use tags if available, otherwise fall back to existing filters
  const damageSpells = hasSpells
    ? fighterSpells.filter(
        (s) =>
          (s.tags?.includes("direct_damage") || s.tags?.includes("area")) &&
          getSpellCost(s) <= ppeAvailable
      )
    : [];

  const healingSpells = hasSpells
    ? fighterSpells.filter(
        (s) =>
          (s.tags?.includes("healing") ||
            (isHealingSpell(s) && getSpellHealingFormula(s))) &&
          getSpellCost(s) <= ppeAvailable
      )
    : [];

  // escapeSpells is defined later in the escape tools section

  // Fallback to existing offensive filter if no tags
  const offensiveSpells =
    damageSpells.length > 0
      ? damageSpells
      : fighterSpells.filter(
          (spell) =>
            isOffensiveSpell(spell) && getSpellCost(spell) <= ppeAvailable
        );

  const offensivePsionics = fighterPsionics.filter((power) => {
    const cost = getPsionicCost(power);
    if (cost > ispAvailable) return false;
    return getPsionicTargetCategory(power) === "enemy";
  });

  const healingPsionics = fighterPsionics.filter((power) => {
    const cost = getPsionicCost(power);
    if (cost > ispAvailable) return false;

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
  // Note: escapeSpells is already defined above using tags, so we use that
  // If tags aren't available, fall back to the helper function
  const escapeSpellsTagged = hasSpells
    ? fighterSpells.filter(
        (s) =>
          (s.tags?.includes("escape") || s.tags?.includes("defensive")) &&
          getSpellCost(s) <= ppeAvailable
      )
    : [];

  const escapeSpellsFallback = hasSpells
    ? fighterSpells.filter(
        (spell) =>
          getSpellCost(spell) <= ppeAvailable && isPotentialEscapeSpell(spell)
      )
    : [];

  const escapeSpellsFinal =
    escapeSpellsTagged.length > 0 ? escapeSpellsTagged : escapeSpellsFallback;

  const escapePsionics = fighterPsionics.filter((power) => {
    const cost = getPsionicCost(power);
    if (cost > ispAvailable) return false;
    return isPotentialEscapePsionic(power);
  });

  const alignmentTextForAI = getAlignmentTextForAI(player);
  const isGoodAlignment = isGoodAlignedForAI(player);
  const isHealerOccType = isHealerOccForAI(player);

  // Healer archetype = Clergy OCCs (Priest, Healer, Druid, Shaman, etc.) OR explicit healer skills
  const hasHealerSkills =
    Array.isArray(player.skills) &&
    player.skills.some((s) =>
      ["Healer OCC R.C.C. Skill", "Holistic Medicine"].includes(s.name)
    );

  const hasHealingMagic =
    healingSpells.length > 0 || healingPsionics.length > 0;

  // A "healer archetype" is either a clergy/healer OCC or someone who actually has heals
  const isHealer = (isHealerOccType || hasHealerSkills) && hasHealingMagic;
  const isGoodHealer = isGoodAlignment && isHealer;

  const healingCandidates = fighters
    .filter((f) => f.type === "player" && f.currentHP > MIN_COMBAT_HP)
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

  const attemptHealing = (targetsToHeal) => {
    // Track which powers we've already tried this turn to prevent loops
    const triedPowers = new Set();

    for (const candidate of targetsToHeal) {
      const isSelfTarget = candidate.id === player.id;

      // For Stop Bleeding specifically, only attempt on bleeding targets
      // and skip if already stabilized this round
      const stopBleedingPower = healingPsionics.find(
        (p) => p.name === "Stop Bleeding"
      );
      if (stopBleedingPower) {
        const candidateIsBleeding = isBleeding(candidate);
        const alreadyStabilized =
          candidate.statusEffects?.includes("STABILIZED") ||
          (candidate.meta?.stabilizedByPsionics &&
            candidate.meta?.lastStopBleedingRound >= meleeRound);

        if (!candidateIsBleeding || alreadyStabilized) {
          // Skip Stop Bleeding for this target - try other healing options
        } else {
          // Only try Stop Bleeding if target is bleeding and not already stabilized
          const canUseStopBleeding = !triedPowers.has("Stop Bleeding");
          if (canUseStopBleeding) {
            const category = getPsionicTargetCategory(stopBleedingPower);
            const canTarget =
              (isSelfTarget && (category === "self" || category === "ally")) ||
              (!isSelfTarget && category === "ally");

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
                  `💚 ${player.name} channels Stop Bleeding to help ${candidate.name}.`,
                  "info"
                );
                if (executePsionicPower(player, candidate, stopBleedingPower)) {
                  processingPlayerAIRef.current = false;
                  return true;
                }
                // Continue to next target if Stop Bleeding failed
                continue;
              }
            }
          }
        }
      }

      const spell = healingSpells.find((spellOption) =>
        spellCanAffectTarget(spellOption, player, candidate)
      );

      if (spell) {
        addLog(
          `💚 ${player.name} uses ${spell.name} to aid ${candidate.name}.`,
          "info"
        );
        if (executeSpell(player, candidate, spell)) {
          processingPlayerAIRef.current = false;
          return true;
        }
      }

      // Try other healing psionics (excluding Stop Bleeding which we already handled)
      const psionic = healingPsionics.find((power) => {
        // Skip Stop Bleeding (already handled above)
        if (power.name === "Stop Bleeding") return false;
        // Skip if we've already tried this power
        if (triedPowers.has(power.name)) return false;

        const category = getPsionicTargetCategory(power);
        if (isSelfTarget) {
          return category === "self" || category === "ally";
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

      if (psionic) {
        triedPowers.add(psionic.name); // Mark as tried
        addLog(
          `💚 ${player.name} channels ${psionic.name} to help ${candidate.name}.`,
          "info"
        );
        if (executePsionicPower(player, candidate, psionic)) {
          processingPlayerAIRef.current = false;
          return true;
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
      const escaped = attemptEscapeIfOutmatched({
        player,
        target: nearestEnemy,
        positions,
        escapeSpells: escapeSpellsFinal,
        escapePsionics,
        ispAvailable,
        ppeAvailable,
        addLog,
        processingPlayerAIRef,
        calculateDistance,
        executeSpell,
        executePsionicPower,
      });

      if (escaped) {
        // Healer successfully bailed out – turn is done
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
    (healingSpells.length > 0 || healingPsionics.length > 0)
  ) {
    if (attemptHealing(healingTargets)) {
      return;
    }
  }

  // Check if player is a prey animal and has no enemies to attack
  function isPreyAnimal(fighter) {
    if (!fighter) return false;

    const name = (fighter.baseName || fighter.name || "").toLowerCase();

    // Explicit: named prey creatures
    if (
      name.includes("mouse") ||
      name.includes("rat") ||
      name.includes("rabbit") ||
      name.includes("squirrel")
    ) {
      return true;
    }

    // Fallback: tiny animals that are not monsters/undead
    // Note: getSizeCategory would need to be imported if available
    const sizeCat = fighter.sizeCategory || fighter.size || "";
    if (
      sizeCat === "Tiny" &&
      !fighter.isUndead &&
      !fighter.isDemon &&
      !fighter.isMonster
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
          `🐭 ${fighter.name} panics at the sight of ${nearestThreat.name} and scurries away!`,
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
        }

        setFighters((prev) =>
          prev.map((f) =>
            f.id === fighter.id
              ? {
                  ...f,
                  defensiveStance: "Retreat",
                  remainingAttacks: Math.max(0, f.remainingAttacks - 1),
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
        `🐭 ${fighter.name} freezes in fear, unable to find a way to flee from ${nearestThreat.name}.`,
        "info"
      );

      setFighters((prev) =>
        prev.map((f) =>
          f.id === fighter.id
            ? {
                ...f,
                remainingAttacks: Math.max(0, f.remainingAttacks - 1),
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
            `🐭 ${fighter.name} cautiously noses toward a nearby corpse to scavenge.`,
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
                    remainingAttacks: Math.max(0, f.remainingAttacks - 1),
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
                  remainingAttacks: Math.max(0, f.remainingAttacks - 1),
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
                remainingAttacks: Math.max(0, f.remainingAttacks - 1),
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
            ? { ...f, remainingAttacks: Math.max(0, f.remainingAttacks - 1) }
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

        log(`🐾 ${fighter.name} wanders cautiously, sniffing the ground.`);

        setFighters((prev) =>
          prev.map((f) =>
            f.id === fighter.id
              ? {
                  ...f,
                  remainingAttacks: Math.max(0, (f.remainingAttacks || 0) - 1),
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
      `${fighter.name} grooms itself and twitches its whiskers.`,
      `${fighter.name} pauses, listening for danger.`,
    ];
    const line = idleLines[Math.floor(Math.random() * idleLines.length)];
    log(line, "info");

    setFighters((prev) =>
      prev.map((f) =>
        f.id === fighter.id
          ? {
              ...f,
              remainingAttacks: Math.max(0, f.remainingAttacks - 1),
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
      (f) => f.type === "player" && f.id !== player.id
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

  // equippedWeapons is already defined above for enemyTargets filtering

  // Debug: Show what we found (only log if not a prey animal to reduce spam)
  if (!isPreyAnimal(player)) {
    addLog(
      `🔍 ${player.name} weapon check: ${equippedWeapons.length} equipped weapons found`,
      "info"
    );
    if (equippedWeapons.length > 0) {
      addLog(
        `🔍 ${player.name} equipped weapons: ${equippedWeapons
          .map((w) => w.name)
          .join(", ")}`,
        "info"
      );
    }
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
        const hasRangedWeapon = equippedWeapons.some((w) => {
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
      // Check if player has ranged options (weapons, spells, psionics) that can reach flying enemies
      const hasRangedOptions = hasAnyRangedOptionAgainstFlying(
        player,
        enemyTargets,
        {
          getFighterSpells,
          getFighterPsionicPowers,
          getFighterPPE,
          getFighterISP,
          getSpellCost,
          getPsionicCost,
          getSpellRangeInFeet,
          parseRangeToFeet,
          isOffensiveSpell,
          calculateDistance,
          positions,
        }
      );

      if (!hasRangedOptions) {
        // If this is a prey animal, use idle/forage behavior instead of defend/withdraw
        if (isPreyAnimal(player)) {
          const playerAllies = fighters.filter(
            (f) => f.type === "player" && f.id !== player.id
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

        // Spam control: only log once per melee round per player
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
              `⚠️ ${player.name} has no way to hit flying enemies (no ranged weapons, spells, or psionics). Defaulting to defend/withdraw.`,
              "warning"
            );
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          } else {
            // Manual control: show hint but don't auto-end turn
            addLog(
              `⚠️ All visible enemies are flying out of melee range. ${player.name} can choose a spell, psionic, missile weapon, or Hold Action.`,
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

  const selectOffensiveSpell = (spellsList) => {
    if (!target) return null;

    // Check target immunities
    const targetAbilities = target.abilities || {};
    const isFireImmune = Array.isArray(targetAbilities.impervious_to)
      ? targetAbilities.impervious_to.some((t) =>
          String(t).toLowerCase().includes("fire")
        )
      : false;

    const viable = spellsList.filter((spell) => {
      // Check if spell can affect target (friendly/enemy restrictions)
      if (!spellCanAffectTarget(spell, player, target)) return false;

      // Filter out fire spells if target is fire-immune
      if (isFireImmune) {
        const spellName = (spell.name || "").toLowerCase();
        const damageType = (spell.damageType || "").toLowerCase();
        if (
          spellName.includes("fire") ||
          spellName.includes("flame") ||
          spellName.includes("burn") ||
          damageType === "fire"
        ) {
          return false;
        }
      }

      return true;
    });
    if (viable.length === 0) return null;
    const inRange = viable.filter((spell) => {
      const rangeFeet = getSpellRangeInFeet(spell);
      return (
        rangeFeet === Infinity ||
        currentDistance === Infinity ||
        currentDistance <= rangeFeet
      );
    });
    // If nothing is in range, don't pick a "melee-range" spell at 120ft and waste the action.
    if (inRange.length === 0) return null;

    // Prefer longer-range spells when multiple are viable (prevents picking Flame Lick over Fire Ball at distance).
    const rangeVal = (spell) => {
      const r = getSpellRangeInFeet(spell);
      return r === Infinity ? 1_000_000_000 : Number(r || 0);
    };
    inRange.sort((a, b) => rangeVal(b) - rangeVal(a));
    return inRange[0];
  };

  // Track recently used psionics per fighter to prevent spamming
  // Alignment and healer helpers
  const GOOD_ALIGNMENTS = ["principled", "scrupulous"];
  // Alignment constants (for future use)
  // const EVIL_ALIGNMENTS = ["diabolic", "miscreant"];
  // const SELFISH_ALIGNMENTS = ["unprincipled", "anarchist"];

  const isGood = (fighter) => {
    const a = (fighter.alignment || "").toLowerCase();
    return GOOD_ALIGNMENTS.includes(a);
  };

  const isHealerOcc = (fighter) => {
    const occ = (fighter.occ || fighter.class || "").toLowerCase();
    return (
      occ.includes("healer") ||
      occ.includes("priest of light") ||
      occ.includes("priestess of light") ||
      occ.includes("druid") ||
      occ.includes("cleric") ||
      occ.includes("priest")
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

  const chooseBestHealingSpell = ({
    fighter,
    spells,
    isHealingSpell,
    distanceFeetToTarget,
  }) => {
    const ppe = getFighterPPE(fighter);
    if (!spells || !spells.length) return null;

    const affordable = spells.filter((s) => {
      const cost = getSpellCost(s);
      return cost <= ppe && isHealingSpell(s);
    });
    if (!affordable.length) return null;

    // Prefer spells that can reach (if they have range)
    const inRange = affordable.filter((s) => {
      const r = getSpellRangeInFeet(s);
      return r === Infinity || r === 0 || distanceFeetToTarget <= r;
    });

    const pool = inRange.length ? inRange : affordable;

    // Simple: highest cost = strongest
    return pool.reduce((best, s) => {
      const cost = getSpellCost(s);
      if (!best) return s;
      const bestCost = getSpellCost(best);
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

  const chooseBestEscapeAbility = ({ fighter, spells, psionics }) => {
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

    const ppe = getFighterPPE(fighter);
    const isp = getFighterISP(fighter);

    let escapeSpell = null;
    if (spells && spells.length) {
      const candidates = spells.filter((s) => {
        const cost = getSpellCost(s);
        return cost <= ppe && nameMatchesEscape(s.name);
      });
      if (candidates.length) {
        escapeSpell = candidates[0];
      }
    }

    let escapePsionic = null;
    if (psionics && psionics.length) {
      const cand = psionics.filter((p) => {
        const cost = getPsionicCost(p);
        return cost <= isp && nameMatchesEscape(p.name);
      });
      if (cand.length) escapePsionic = cand[0];
    }

    return {
      escapeSpell,
      escapePsionic,
    };
  };

  // Healer AI: heal allies first, escape if threatened, then attack
  const healer = isHealerOcc(player) && isGood(player);
  const playerAllies = fighters.filter(
    (f) => f.type === "player" && f.id !== player.id
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
      const healSpell = chooseBestHealingSpell({
        fighter: player,
        spells: fighterSpells,
        isHealingSpell,
        distanceFeetToTarget: dist,
      });

      if (healSpell) {
        addLog(
          `🔮 ${player.name} (healer) chooses to heal ${injuredAlly.name} with ${healSpell.name}`,
          "info"
        );
        if (executeSpell(player, injuredAlly, healSpell)) {
          processingPlayerAIRef.current = false;
          return;
        }
      }

      // Try healing psionic
      const healPsionic = chooseBestHealingPsionic({
        caster: player,
        psionicPowers: fighterPsionics,
        target: injuredAlly,
        distanceFeet: dist,
        isp: ispAvailable,
      });

      if (healPsionic) {
        addLog(
          `🧠 ${player.name} (healer) chooses to heal ${injuredAlly.name} with ${healPsionic.name}`,
          "info"
        );
        if (executePsionicPower(player, injuredAlly, healPsionic)) {
          processingPlayerAIRef.current = false;
          return;
        }
      }
    }

    // 2) If threatened and enemy is tough, try escape
    if (threatened && target) {
      const escape = chooseBestEscapeAbility({
        fighter: player,
        spells: fighterSpells,
        psionics: fighterPsionics,
      });

      if (escape.escapeSpell) {
        addLog(
          `🌀 ${player.name} (healer) uses escape spell ${escape.escapeSpell.name}`,
          "info"
        );
        if (executeSpell(player, player, escape.escapeSpell)) {
          processingPlayerAIRef.current = false;
          return;
        }
      }

      if (escape.escapePsionic) {
        const recentlyUsed =
          playerAIRecentlyUsedPsionicsRef.current.get(player.id) || [];
        if (recentlyUsed.length === 0) {
          addLog(
            `🧠 ${player.name} (healer) uses escape psionic ${escape.escapePsionic.name}`,
            "info"
          );
          if (executePsionicPower(player, player, escape.escapePsionic)) {
            processingPlayerAIRef.current = false;
            return;
          }
        }
      }
    }
  }

  // ✅ CRITICAL: Only choose ONE psionic per action using the helper
  // This prevents spam by ensuring we pick one and execute it once
  const bestOffensivePsionic =
    target && offensivePsionics.length > 0
      ? chooseBestOffensivePsionic({
          caster: player,
          psionicPowers: offensivePsionics,
          target,
          distanceFeet: currentDistance,
          isp: ispAvailable,
          alignment: player.alignment,
        })
      : null;

  const bestOffensiveSpell = selectOffensiveSpell(offensiveSpells);

  const magicKeywords = [
    "wizard",
    "mage",
    "warlock",
    "witch",
    "sorcerer",
    "summoner",
    "diabolist",
    "cleric",
    "priest",
    "druid",
    "shaman",
  ];
  const isMagicFocused = magicKeywords.some((keyword) =>
    occLower.includes(keyword)
  );
  const isMindMage =
    occLower.includes("mind mage") || occLower.includes("mindmage");

  // 🔹 GOOD HEALER LOGIC - Check before general magic-focused behavior
  const isHealerArchetypePlayer = isHealerArchetype(player);
  const goodHealer =
    isHealerArchetypePlayer && isGoodAlignmentForHealer(player);

  if (isMagicFocused && goodHealer && isHealerArchetypePlayer) {
    addLog(
      `${player.name} is magic-focused and a good-aligned healer - evaluating spells and psionics...`,
      "info"
    );

    // 1) If badly outmatched in melee, prefer escape/defensive magic FOR SELF
    const inSeriousTrouble = isInSeriousMeleeTrouble(
      player,
      enemyTargets,
      positions,
      calculateDistance,
      getFighterHP,
      getFighterMaxHP
    );
    if (inSeriousTrouble && escapeSpellsFinal.length > 0) {
      const escapeSpell = escapeSpellsFinal[0]; // later you can pick smarter
      addLog(
        `${player.name} is a good healer in serious melee trouble - using escape spell: ${escapeSpell.name}`,
        "info"
      );
      // Self-target escape
      if (executeSpell(player, player, escapeSpell)) {
        processingPlayerAIRef.current = false;
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
      }
    );

    if (allyToHeal && healingSpells.length > 0) {
      // For now choose the first healing spell; later you can add a "selectBestHealingSpell" helper.
      const healingSpell = healingSpells[0];

      addLog(
        `${player.name} prioritizes healing ally ${allyToHeal.name} with ${healingSpell.name}`,
        "info"
      );
      if (executeSpell(player, allyToHeal, healingSpell)) {
        processingPlayerAIRef.current = false;
        return;
      }
    }
  }

  // Debug logging for magic-focused characters
  if (isMagicFocused) {
    addLog(
      `🔮 ${player.name} spell check: Found ${fighterSpells.length} total spells, ${fighterPsionics.length} psionic powers`,
      "info"
    );
    if (fighterSpells.length > 0) {
      addLog(
        `🔮 ${player.name} spells: ${fighterSpells
          .map((s) => s.name)
          .join(", ")}`,
        "info"
      );
    } else {
      addLog(
        `🔮 ${
          player.name
        } has no spells found in: magic=${!!player.magic}, spells=${!!player.spells}, knownSpells=${!!player.knownSpells}, spellbook=${!!player.spellbook}, abilities=${!!player.abilities}`,
        "warning"
      );
    }
    addLog(
      `🔮 ${player.name} PPE: ${ppeAvailable}, ISP: ${ispAvailable}`,
      "info"
    );
  }

  // Debug logging for mind mages
  if (isMindMage) {
    addLog(
      `🧠 ${player.name} is a Mind Mage - checking psionic powers...`,
      "info"
    );
    addLog(
      `🧠 Available psionic powers: ${fighterPsionics.length}, Offensive: ${offensivePsionics.length}, ISP: ${ispAvailable}`,
      "info"
    );
    if (bestOffensivePsionic) {
      addLog(
        `🧠 Best offensive psionic: ${
          bestOffensivePsionic.name
        } (cost: ${getPsionicCost(bestOffensivePsionic)} ISP)`,
        "info"
      );
    } else {
      addLog(
        `🧠 No viable offensive psionic found (target: ${
          target?.name
        }, distance: ${Math.round(currentDistance)}ft)`,
        "info"
      );
    }
  }

  const attemptOffensiveSpell = (spell) => {
    const latestPlayer = fighters.find((f) => f.id === player.id) || player;

    // Respect the RAW limit (enforced again inside executeSpell). Don't even log "unleashes" if blocked.
    if ((latestPlayer.spellsCastThisMelee || 0) >= 1) return false;

    // Avoid misleading logs for obviously out-of-range spells.
    if (target && currentDistance !== Infinity) {
      const rangeFeet = getSpellRangeInFeet(spell);
      if (rangeFeet !== Infinity && currentDistance > rangeFeet) return false;
    }

    addLog(
      `🔮 ${player.name} unleashes ${spell.name} at ${target.name}!`,
      "info"
    );
    // Mark immediately so CombatPage watchdog/invariant doesn't end-turn while a spell action is executing.
    markActionScheduled();
    const result = executeSpell(player, target, spell);
    if (result) {
      processingPlayerAIRef.current = false;
      return true;
    }

    // If the spell fails (resisted/invalid/etc.), fall through so the AI can try psionics, move, or melee.
    return false;
  };

  const attemptOffensivePsionic = (power) => {
    addLog(
      `🧠 ${player.name} focuses ${power.name} on ${target.name}!`,
      "info"
    );
    // Mark immediately so CombatPage watchdog/invariant doesn't end-turn while a psionic action is executing.
    markActionScheduled();
    if (executePsionicPower(player, target, power)) {
      // Track this psionic as recently used to prevent spamming
      const recentlyUsed =
        playerAIRecentlyUsedPsionicsRef.current.get(player.id) || [];
      recentlyUsed.push(power.name);
      // Keep only last 3 used psionics per fighter
      if (recentlyUsed.length > 3) {
        recentlyUsed.shift();
      }
      playerAIRecentlyUsedPsionicsRef.current.set(player.id, recentlyUsed);

      processingPlayerAIRef.current = false;
      return true;
    }
    return false;
  };

  // For mind mages, prioritize psionics over weapons and spells
  // For others, use psionics if no spell available or at long range
  const shouldUsePsionics =
    !!bestOffensivePsionic &&
    (isMindMage ||
      (!bestOffensiveSpell && currentDistance > 5.5) ||
      currentDistance > 20);

  if (isMindMage) {
    addLog(
      `🧠 Mind Mage psionic decision: shouldUsePsionics=${shouldUsePsionics}, bestOffensivePsionic=${
        bestOffensivePsionic?.name || "none"
      }`,
      "info"
    );
  }

  if (shouldUsePsionics && bestOffensivePsionic) {
    const psionicResult = attemptOffensivePsionic(bestOffensivePsionic);
    if (isMindMage) {
      addLog(
        `🧠 Psionic execution result: ${psionicResult ? "SUCCESS" : "FAILED"}`,
        psionicResult ? "info" : "error"
      );
    }
    if (psionicResult) {
      return;
    }
  }

  // Only use spells if not a mind mage (mind mages should prefer psionics)
  // For magic-focused classes (wizard, etc.), ALWAYS prioritize spells over melee
  // The spell range check happens in executeSpell, so we can try to use spells at any distance
  const shouldUseSpell =
    !!bestOffensiveSpell &&
    !isMindMage &&
    (isMagicFocused || // Magic classes always prefer spells when available
      currentDistance > 20 ||
      !bestOffensivePsionic);

  // Debug logging for magic-focused classes
  if (isMagicFocused) {
    if (bestOffensiveSpell) {
      addLog(
        `🔮 ${player.name} is magic-focused - prioritizing spell: ${bestOffensiveSpell.name}`,
        "info"
      );
    } else {
      addLog(
        `🔮 ${player.name} is magic-focused but has no offensive spells available`,
        "info"
      );
    }
  }

  if (shouldUseSpell && bestOffensiveSpell) {
    if (attemptOffensiveSpell(bestOffensiveSpell)) {
      return;
    }
  }

  // For magic-focused classes, if we have spells/psionics available, don't use melee
  // Allow movement to get in range, but skip melee attacks
  const hasMagicAvailable = bestOffensiveSpell || bestOffensivePsionic;
  if (isMagicFocused && hasMagicAvailable) {
    // If we tried to use magic but it failed (e.g., out of range), allow movement
    // But don't fall through to melee - magic classes should use magic, not melee
    if (currentDistance > 5.5) {
      addLog(
        `🔮 ${player.name} is magic-focused with magic available but out of range - will move to get in range`,
        "info"
      );
      // Allow movement to continue below
    } else {
      // In melee range but magic-focused - still prefer magic over melee
      addLog(
        `🔮 ${player.name} is magic-focused - skipping melee in favor of magic`,
        "info"
      );
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return;
    }
  }
  addLog(`🔍 ${player.name} checking weapons...`, "info");
  let selectedAttack = null;
  let attackName = "Unarmed Strike";
  let selectedWeapon = null;

  // If no weapons found, try to equip a basic weapon from inventory
  if (equippedWeapons.length === 0) {
    addLog(
      `⚠️ ${player.name} has no equipped weapons - checking inventory...`,
      "warning"
    );

    // Check if player has weapons in inventory/wardrobe
    const inventory = player.wardrobe || player.inventory || [];
    addLog(
      `🔍 ${player.name}'s inventory has ${inventory.length} items`,
      "info"
    );

    const availableWeapons = inventory.filter(
      (item) =>
        item.type === "weapon" ||
        item.category === "one-handed" ||
        item.category === "two-handed" ||
        item.name?.toLowerCase().includes("sword") ||
        item.name?.toLowerCase().includes("bow") ||
        item.name?.toLowerCase().includes("dagger")
    );

    addLog(`🔍 Found ${availableWeapons.length} weapons in inventory`, "info");

    if (availableWeapons.length > 0) {
      // Use autoEquipWeapons to properly equip weapons from inventory
      const updatedPlayer = autoEquipWeapons(player);

      // Update player's equipped weapons
      if (
        updatedPlayer.equippedWeapons &&
        updatedPlayer.equippedWeapons.length > 0
      ) {
        equippedWeapons.push(
          ...updatedPlayer.equippedWeapons.filter((w) => w.name !== "Unarmed")
        );

        // Update the player object in fighters array
        setFighters((prev) =>
          prev.map((f) =>
            f.id === player.id
              ? {
                  ...f,
                  equippedWeapons: updatedPlayer.equippedWeapons,
                  equipped: updatedPlayer.equipped,
                  equippedWeapon: updatedPlayer.equippedWeapon,
                }
              : f
          )
        );

        const equippedWeaponNames = updatedPlayer.equippedWeapons
          .filter((w) => w.name !== "Unarmed")
          .map((w) => w.name)
          .join(", ");
        addLog(
          `⚔️ ${player.name} auto-equipped: ${
            equippedWeaponNames || "No weapons"
          }`,
          "info"
        );
      } else {
        addLog(
          `❌ ${player.name} has no weapons in inventory - using unarmed`,
          "warning"
        );
      }
    } else {
      addLog(
        `❌ ${player.name} has no weapons in inventory - using unarmed`,
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
    addLog(
      `📍 ${player.name} is ${Math.round(currentDistance)}ft from ${
        target.name
      }`,
      "info"
    );
  }

  if (equippedWeapons.length > 0) {
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

    const meleeWeapons = equippedWeapons.filter((w) => !isTrueRangedWeapon(w));
    const rangedWeapons = equippedWeapons.filter((w) => isTrueRangedWeapon(w));

    // Use getWeaponType and getWeaponLength for detailed weapon info
    const weaponTypeInfo = equippedWeapons
      .map((w) => {
        const type = getWeaponType(w);
        const length = getWeaponLength(w);
        return `${w.name} (${type}, ${length}ft)`;
      })
      .join(", ");

    addLog(
      `🔍 ${player.name} has ${meleeWeapons.length} melee and ${rangedWeapons.length} ranged weapons`,
      "info"
    );
    if (equippedWeapons.length > 0) {
      addLog(`🔍 Weapon details: ${weaponTypeInfo}`, "info");
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

    // Prefer a melee/reach weapon if it can already hit (e.g. Fire Whip at 15ft)
    if (currentDistance <= 20 && reachableMelee.length > 0) {
      reachableMelee.sort(
        (a, b) =>
          Number(getWeaponRange(b) || 0) - Number(getWeaponRange(a) || 0)
      );
      selectedWeapon = reachableMelee[0];
      addLog(
        `🗡️ ${player.name} selects ${selectedWeapon.name} for melee combat`,
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
        `🏹 ${player.name} selects ${
          selectedWeapon.name
        } for ranged combat (${Math.round(currentDistance)}ft away)`,
        "info"
      );
    } else if (currentDistance <= 5.5 && meleeWeapons.length > 0) {
      // Close range - prefer melee weapons even if range calc is weird
      selectedWeapon =
        meleeWeapons[Math.floor(Math.random() * meleeWeapons.length)];
      addLog(
        `🗡️ ${player.name} selects ${selectedWeapon.name} for melee combat`,
        "info"
      );
    } else if (equippedWeapons.length > 0) {
      // Fallback to any equipped weapon that can reach the target
      // Before selecting fallback, check if any melee weapon can reach target
      const meleeWeapons = equippedWeapons.filter((w) => {
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
          `⚔️ ${player.name} selects ${selectedWeapon.name} (fallback)`,
          "info"
        );
      } else if (
        meleeWeapons.length > 0 &&
        !canThreatenWithMelee(player, target)
      ) {
        // No melee weapon can reach - don't choose knife, use ranged or defend
        addLog(
          `⚠️ ${player.name} has no melee weapon that can reach ${target.name} (target too high)`,
          "warning"
        );
        markTargetUnreachable(player, target);
        // Will fall through to check for ranged weapons or defensive actions
        // For now, select first ranged weapon if available, otherwise first weapon
        const rangedWeapons = equippedWeapons.filter((w) => {
          const name = (w.name || "").toLowerCase();
          return (
            name.includes("bow") ||
            name.includes("crossbow") ||
            name.includes("sling") ||
            (w.range && w.range > 10)
          );
        });
        selectedWeapon =
          rangedWeapons.length > 0 ? rangedWeapons[0] : equippedWeapons[0];
        if (selectedWeapon) {
          addLog(
            `⚔️ ${player.name} selects ${selectedWeapon.name} (fallback - no reachable melee)`,
            "info"
          );
        }
      } else {
        // Fallback to first equipped weapon
        selectedWeapon =
          equippedWeapons[Math.floor(Math.random() * equippedWeapons.length)];
        addLog(
          `⚔️ ${player.name} selects ${selectedWeapon.name} (fallback)`,
          "info"
        );
      }
    }

    if (selectedWeapon) {
      selectedAttack = {
        name: selectedWeapon.name,
        damage: selectedWeapon.damage || "1d3",
        count: 1,
        range: getWeaponRange(selectedWeapon),
      };
      attackName = selectedAttack.name;
      addLog(`✅ ${player.name} will attack with ${attackName}`, "info");
    }
  }

  // Fallback to unarmed if no weapon selected
  if (!selectedAttack) {
    selectedAttack = {
      name: "Unarmed Strike",
      damage: "1d3",
      count: 1,
      range: 5.5,
    };
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
      // If this is a melee strike and the attacker is airborne but the target is grounded,
      // treat the attacker as able to descend for the strike (prevents "hover forever" stalemates).
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
          `🚫 ${player.name} has tried to move 3 times and cannot reach target - ending turn`,
          "error"
        );
        processingPlayerAIRef.current = false;
        scheduleEndTurn();
        return;
      }

      // ✅ FIX: Check if distance actually improved from last attempt
      // Also check if combat ended or target is no longer valid
      if (!combatActive) {
        addLog(`⚠️ Combat ended, ${player.name} stops moving`, "info");
        processingPlayerAIRef.current = false;
        return;
      }

      // Check if target is still valid (conscious and alive)
      if (target && (target.currentHP <= 0 || target.currentHP <= -21)) {
        addLog(
          `⚠️ ${player.name}'s target is no longer valid, ending turn`,
          "info"
        );
        processingPlayerAIRef.current = false;
        scheduleEndTurn();
        return;
      }

      if (
        movementTracker.count > 0 &&
        currentDistance >= movementTracker.lastDistance
      ) {
        addLog(
          `⚠️ ${player.name} movement not improving distance (${Math.round(
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
        // ✅ FIX: Don't attempt ground flanking if target is flying and player isn't
        const targetIsFlying =
          target.isFlying || (target.altitudeFeet ?? target.altitude ?? 0) > 0;
        const playerIsFlying =
          player.isFlying || (player.altitudeFeet ?? player.altitude ?? 0) > 0;

        if (targetIsFlying && !playerIsFlying) {
          addLog(
            `❌ ${player.name} skips flanking ${target.name} (target is flying, player is grounded - use spells/ranged instead)`,
            "warning"
          );
          markTargetUnreachable(player, target);
          // Don't attempt flanking if target is flying and player isn't - skip to next action
        } else if (!canThreatenWithMelee(player, target)) {
          addLog(
            `❌ ${player.name} skips flanking ${target.name} (target unreachable in melee)`,
            "warning"
          );
          markTargetUnreachable(player, target);
          // Don't attempt flanking if target is unreachable - skip to next action
        } else {
          // ✅ NEW: Check if melee requires dive attack (player flying, target on ground)
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
                `🦅 ${player.name} skips flanking ${target.name} (dive attack required - use spells or dive instead)`,
                "ai"
              );
              markTargetUnreachable(player, target);
              // Skip flanking, will fall through to spell selection
            } else {
              addLog(
                `🎯 ${player.name} considers flanking ${target.name}`,
                "info"
              );
            }
          } else {
            addLog(
              `🎯 ${player.name} considers flanking ${target.name}`,
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
              `🎯 ${player.name} attempts to flank ${target.name}`,
              "info"
            );

            // Move to flanking position
            setPositions((prev) => {
              const updated = {
                ...prev,
                [player.id]: bestFlankPos,
              };
              positionsRef.current = updated;
              return updated;
            });

            // Deduct movement action cost
            const movementCost = Math.ceil(flankDistance / (speed * 5));
            setFighters((prev) =>
              prev.map((f) =>
                f.id === player.id
                  ? {
                      ...f,
                      remainingAttacks: Math.max(
                        0,
                        f.remainingAttacks - movementCost
                      ),
                    }
                  : f
              )
            );

            addLog(
              `🎯 ${player.name} targets flanking position (${bestFlankPos.x}, ${bestFlankPos.y})`,
              "info"
            );

            // Continue with attack after movement - use updated positions from state
            setTimeout(() => {
              // Re-read positions from state to ensure we have the latest
              setPositions((currentPositions) => {
                positionsRef.current = currentPositions;
                const actualFlankPos =
                  currentPositions[player.id] || bestFlankPos;
                const actualTargetPos =
                  currentPositions[target.id] || targetPos;
                const newDistance = calculateDistance(
                  actualFlankPos,
                  actualTargetPos
                );

                // Check range after position update
                setTimeout(() => {
                  const rangeValidation = validateWeaponRange(
                    player,
                    target,
                    selectedAttack,
                    newDistance
                  );

                  if (rangeValidation.canAttack) {
                    const flankingBonus = calculateFlankingBonus(
                      actualFlankPos,
                      actualTargetPos,
                      currentPositions,
                      player.id
                    );
                    if (flankingBonus > 0) {
                      addLog(
                        `🎯 ${player.name} gains flanking bonus (+${flankingBonus} to hit)!`,
                        "info"
                      );
                    }

                    // Execute attack with flanking bonus
                    const updatedPlayer = {
                      ...player,
                      selectedAttack: selectedAttack,
                    };
                    const bonuses = flankingBonus > 0 ? { flankingBonus } : {};
                    attack(updatedPlayer, target.id, {
                      ...bonuses,
                      attackerPosOverride: actualFlankPos,
                      defenderPosOverride: actualTargetPos,
                      distanceOverride: newDistance,
                    });

                    processingPlayerAIRef.current = false;
                    scheduleEndTurn();
                  } else {
                    addLog(
                      `❌ ${player.name} cannot reach ${target.name} from flanking position (${rangeValidation.reason})`,
                      "error"
                    );

                    // ✅ NEW: If "dive attack required" and player is flying, skip retry loop
                    const playerIsFlying =
                      player.isFlying || (player.altitudeFeet ?? 0) > 0;
                    const targetIsFlying =
                      target.isFlying || (target.altitudeFeet ?? 0) > 0;
                    const reasonLower = (
                      rangeValidation.reason || ""
                    ).toLowerCase();
                    const requiresDive =
                      reasonLower.includes("dive attack required") ||
                      reasonLower.includes("too far below");

                    if (playerIsFlying && !targetIsFlying && requiresDive) {
                      // Player is flying, target is on ground, melee requires dive
                      // Skip the retry loop - either dive or use spells
                      addLog(
                        `🦅 ${player.name} is flying too high for melee - will use spells or dive attack instead`,
                        "ai"
                      );
                      markTargetUnreachable(player, target);
                      processingPlayerAIRef.current = false;
                      scheduleEndTurn();
                      return;
                    }

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
                        updatedPlayerState.remainingAttacks > 0 &&
                        currentTracker &&
                        currentTracker.count < 3 &&
                        newDistance < currentDistance
                      ) {
                        // Distance improved, continue trying to move closer
                        addLog(
                          `🏃 ${player.name} continues moving towards ${
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
                          `⏭️ ${
                            player.name
                          } cannot continue moving (attempts: ${
                            currentTracker?.count || 0
                          }/3, distance: ${Math.round(
                            newDistance
                          )}ft) - ending turn`,
                          "info"
                        );
                        processingPlayerAIRef.current = false;
                        // Use setTimeout to ensure turn actually ends
                        setTimeout(() => {
                          endTurn();
                        }, 1500);
                      }
                    }, 500);
                  }
                }, 100);

                return currentPositions; // Return unchanged since we already updated it
              });
            }, 1000);
            return;
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
        movementRates.walking / (player.attacksPerMelee || 1);
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
              `🤖 ${player.name} moves to position (${directX}, ${directY})`,
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
                  `🤖 ${player.name} sidesteps to (${testPos.x}, ${testPos.y})`,
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
            `🐝 ${player.name} reroutes via BeeLine to (${beeDetour.destination.x}, ${beeDetour.destination.y})`,
            "bee",
            beeDetour
          );
        }

        if (candidateMoves.length === 0) {
          addLog(
            `🚫 ${player.name} cannot find path to target - no open hexes`,
            "warning"
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
            `🚫 ${player.name} cannot advance toward ${target.name} - blocked`,
            "info"
          );
          processingPlayerAIRef.current = false;
          scheduleEndTurn();
          return;
        }

        setPositions((prev) => {
          const updated = {
            ...prev,
            [player.id]: { x: chosenMove.pos.x, y: chosenMove.pos.y },
          };
          positionsRef.current = updated;
          return updated;
        });

        if (chosenMove.type === "bee") {
          const stepsTaken = chosenMove.meta?.stepsTaken ?? 1;
          const goalRing = chosenMove.meta?.goalRing ?? 1;
          addLog(
            `🐝 ${player.name} follows BeeLine path (${stepsTaken} hex${
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
                remainingAttacks: Math.max(0, (f.remainingAttacks || 0) - 1),
              };
            }
            return f;
          })
        );

        if (!rangeValidation.canAttack) {
          if (!combatActive) {
            addLog(`⚠️ Combat ended, ${player.name} stops moving`, "info");
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
              `⚠️ ${player.name}'s target is no longer valid, ending turn`,
              "info"
            );
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          }

          addLog(
            `❌ ${player.name} still cannot reach ${target.name} for attack! (${rangeValidation.reason})`,
            "error"
          );

          if (
            movementTracker.count >= 3 ||
            (!improved && chosenMove.type !== "bee")
          ) {
            addLog(
              `🚫 ${player.name} cannot reach target after ${movementTracker.count} attempt(s) - ending turn`,
              "warning"
            );
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          }

          if (
            player.remainingAttacks > 0 &&
            movementTracker.count < 3 &&
            combatActive
          ) {
            addLog(
              `🏃 ${player.name} is still ${Math.round(
                newDistance
              )}ft away, attempting another move...`,
              "info"
            );
            setTimeout(() => {
              setPositions((currentPositions) => {
                positionsRef.current = currentPositions;
                const updatedPlayerState = fighters.find(
                  (f) => f.id === player.id
                );
                if (
                  updatedPlayerState &&
                  updatedPlayerState.remainingAttacks > 0 &&
                  combatActive &&
                  !processingPlayerAIRef.current
                ) {
                  const latestTarget = fighters.find((f) => f.id === target.id);
                  if (
                    !latestTarget ||
                    latestTarget.currentHP <= 0 ||
                    latestTarget.currentHP <= -21
                  ) {
                    addLog(
                      `⚠️ ${player.name}'s target is no longer valid, ending turn`,
                      "info"
                    );
                    processingPlayerAIRef.current = false;
                    scheduleEndTurn();
                    return currentPositions;
                  }

                  const latestDistance = calculateDistance(
                    currentPositions[player.id] || chosenMove.pos,
                    targetPos
                  );
                  const latestRangeValidation = validateWeaponRange(
                    (function () {
                      const atkName = String(
                        selectedAttack?.name || ""
                      ).toLowerCase();
                      const atkType = String(
                        selectedAttack?.type || ""
                      ).toLowerCase();
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
                      const targetIsAirborne =
                        isFlying(target) && targetAlt > 0;
                      const shouldAutoDescendForMelee =
                        !hasRangedWeapon &&
                        !isRangedLike &&
                        attackerAlt > 0 &&
                        !targetIsAirborne &&
                        targetAlt <= 5;
                      return shouldAutoDescendForMelee
                        ? { ...player, altitude: 0, altitudeFeet: 0 }
                        : player;
                    })(),
                    target,
                    selectedAttack,
                    latestDistance
                  );

                  if (
                    !latestRangeValidation.canAttack &&
                    latestDistance < (movementTracker.lastDistance ?? Infinity)
                  ) {
                    processingPlayerAIRef.current = true;
                    setTimeout(() => {
                      // Note: We can't recursively call runPlayerTurnAI here because we don't have access to the full context
                      // Instead, we'll just schedule end turn and let the next turn handle it
                      processingPlayerAIRef.current = false;
                      scheduleEndTurn();
                    }, 500);
                  } else {
                    processingPlayerAIRef.current = false;
                    scheduleEndTurn();
                  }
                } else {
                  processingPlayerAIRef.current = false;
                  scheduleEndTurn();
                }
                return currentPositions;
              });
            }, 800);
            return;
          } else {
            addLog(
              `⏭️ ${player.name} cannot reach target (${
                movementTracker.count
              } attempts, ${Math.round(
                newDistance
              )}ft remaining) - ending turn`,
              "info"
            );
            processingPlayerAIRef.current = false;
            scheduleEndTurn();
            return;
          }
        } else {
          addLog(
            `✅ ${player.name} is now in range (${rangeValidation.reason})`,
            "info"
          );
        }
      }
    } catch (error) {
      console.error("Error in movement logic:", error);
      addLog(`❌ ${player.name} movement failed: ${error.message}`, "error");
      processingPlayerAIRef.current = false;
      scheduleEndTurn();
      return;
    }
  }

  // Execute attack
  addLog(
    `🤖 ${player.name} ${reasoning} and attacks ${target.name} with ${attackName}!`,
    "info"
  );
  // Mark immediately so CombatPage's invariant doesn't end-turn before delayed execution happens.
  markActionScheduled();

  // Create updatedPlayer with selectedAttack
  const updatedPlayer = { ...player, selectedAttack: selectedAttack };

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
          `⚡ ${player.name} uses ${attackName} - area attack hitting ${targetsInLine.length} target(s)!`,
          "info"
        );

        // Execute area attack on all targets in line (one action, multiple targets)
        setTimeout(() => {
          targetsInLine.forEach((lineTarget, index) => {
            setTimeout(() => {
              attack(updatedPlayer, lineTarget.id, { flankingBonus });
            }, index * 500); // Stagger attacks slightly for visual effect
          });

          processingPlayerAIRef.current = false;
          scheduleEndTurn();
        }, 1500);
        return;
      }
    }

    // Execute attack - only ONE attack per turn
    setTimeout(() => {
      if (!tokenStillValid()) return;
      // Get current fighter state to check remaining attacks before executing
      const currentFighterState = fighters.find((f) => f.id === player.id);

      // Check if fighter has attacks remaining before executing
      if (currentFighterState && currentFighterState.remainingAttacks <= 0) {
        addLog(`⚠️ ${player.name} is out of attacks this turn!`, "warning");
        processingPlayerAIRef.current = false;
        // Respect CombatPage turn-advance lock
        scheduleEndTurn(500);
        return;
      }

      const currentPositions = positionsRef.current || positions;
      const attackerPos = currentPositions?.[player.id] || null;
      const defenderPos = currentPositions?.[target.id] || null;
      const latestDistance =
        attackerPos && defenderPos
          ? calculateDistance(attackerPos, defenderPos)
          : undefined;

      if (!tokenStillValid()) return;
      attack(updatedPlayer, target.id, {
        flankingBonus,
        attackerPosOverride: attackerPos,
        defenderPosOverride: defenderPos,
        distanceOverride: latestDistance,
        // If we're melee-only and currently airborne vs a grounded target, auto-descend before the strike.
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
              `action: auto-descend before melee strike | fromAlt=${attackerAlt}ft`
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

      // Only one attack per tick. Clear processing flag and advance turn.
      const actionDelay = getActionDelay(arenaSpeed);
      setTimeout(() => {
        if (!tokenStillValid()) return;
        processingPlayerAIRef.current = false;
        if (combatActive) {
          endTurn();
        }
      }, actionDelay);
    }, 1500);
  };

  // Use a longer delay to ensure position state is fully updated, then execute attack
  setTimeout(() => {
    if (!tokenStillValid()) return;
    markActionScheduled();
    executeAttack(0); // No flanking bonus by default
  }, 1000);
}

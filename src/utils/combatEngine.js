/**
 * Medieval Combat Simulator - Combat Engine
 *
 * Production-ready alternating action combat loop that implements Medieval Combat Simulator RAW:
 * - Actions alternate in initiative order (one action per fighter, looping until all spent)
 * - Fatigue and stamina drain integration
 * - Grapple state management
 * - Evade/block reaction hooks
 * - Finishing "leftover-action" rounds for fast enemies
 * - Extendable hooks for techniques, ranged attacks, and special abilities
 *
 * Based on Medieval Combat Simulator core rules (1994 edition)
 *
 * Dependencies:
 *   - src/utils/combatFatigueSystem.js
 *   - src/utils/grapplingSystem.js
 *   - src/utils/arenaRosterLoader.js
 *   - src/utils/arenaRosterValidator.js
 *   - src/data/arenaRoster.js
 */

import { calculateDistance } from "../data/movementRules.js";

import {
  drainStamina,
  getFatigueStatus,
  applyFatiguePenalties,
  initializeCombatFatigue,
  STAMINA_COSTS,
} from "./combatFatigueSystem.js";

import { getAdjustedWeaponDamage } from "./weaponSizeSystem.js";
import {
  getNeutralWeaponDamage,
  getCreatureSize,
  getCreatureSizeRank,
  getLegacyWeaponSizeCompatibility,
} from "./publicRulesAdapter.js";

import {
  initializeGrappleState,
  GRAPPLE_STATES,
} from "./grapplingSystem.js";

// Import and re-export arenaRoster utilities for convenience
// eslint-disable-next-line no-unused-vars
import { loadCombatant, loadCombatants } from "./arenaRosterLoader.js";
// eslint-disable-next-line no-unused-vars
import { validateArenaRoster } from "./arenaRosterValidator.js";

// Re-export arenaRoster utilities for convenience
export { loadCombatant, loadCombatants } from "./arenaRosterLoader.js";
export { validateArenaRoster } from "./arenaRosterValidator.js";

// Import ability and skill systems
import { parseAbilities, applyBioRegeneration } from "./abilitySystem.js";
import { mapPROFESSIONSkillsToCombat, getAttacksPerMelee } from "./professionSkillMapper.js";
// eslint-disable-next-line no-unused-vars
import { getUnifiedAbilities, getCombatBonus } from "./unifiedAbilities.js";

import CryptoSecureDice from "./cryptoDice.js";
import { rollRoundInitiative } from "./combat/roundInitiative.js";
import { checkDamageResistance } from "./abilitySystem.js";
import {
  // eslint-disable-next-line no-unused-vars
  applyStatusEffect,
  updateStatusEffects,
  getStatusPenalties,
  canCharacterAct,
  attemptFearRecovery,
  // eslint-disable-next-line no-unused-vars
  STATUS_EFFECTS,
} from "./statusEffectSystem.js";
import {
  triggerHorrorFactor,
  // eslint-disable-next-line no-unused-vars
  resetHorrorChecks,
  hasHorrorFactor,
} from "./dreadRatingSystem.js";
import {
  processCourageAuras,
  clearCourageBonuses,
} from "./courageAuraSystem.js";
import {
  createProtectionCircle,
  // eslint-disable-next-line no-unused-vars
  processProtectionCircles,
  isProtectionCircle,
} from "./protectionCircleSystem.js";
import {
  updateProtectionCirclesOnMap,
  checkCircleEntryExit,
  checkMovementBlockedByCircle,
} from "./protectionCircleMapSystem.js";
import {
  resolveHitLocation,
  getHitLocationDescription,
} from "./hitLocationSystem.js";
import { calculateArmorDamage } from "./equipmentManager.js";
import { attackConnectsVsTarget } from "./resolveWeaponImpactVsArmor.js";
import { getSizeScale, applySizeCombatModifiers } from "./sizeScaleSystem.js";
import { getStatusCombatPenalties } from "./statusEffectSystem.js";
import { autoCastFearProtection } from "./fearAIAutoCast.js";
import { castCourage, castRemoveFear } from "./fearTechniqueSystem.js";

export function getCombatEngineSizeContext(combatant) {
  return {
    creatureSize: getCreatureSize(combatant),
    sizeRank: getCreatureSizeRank(combatant),
    legacySizeContext: getLegacyWeaponSizeCompatibility(combatant),
  };
}

/**
 * Combat Engine Class
 * Manages alternating action combat flow per Medieval Combat Simulator RAW
 */
export class CombatEngine {
  constructor(options = {}) {
    this.combatants = [];
    this.meleeRound = 1;
    this.actionCounter = 0;
    this.logCallback =
      options.logCallback ||
      ((msg, type = "info") => console.log(`[${type}] ${msg}`));
    this.onCombatantUpdate = options.onCombatantUpdate || (() => {});
    this.onMeleeRoundComplete = options.onMeleeRoundComplete || (() => {});
    this.executeCanonicalGrappleAction = options.executeCanonicalGrappleAction || null;
    this.isActive = false;
    this.activeCircles = []; // Track active protection circles
    // Hit location system toggle (default: enabled for realism)
    this.useRandomHitLocations = options.useRandomHitLocations !== false;
  }

  /**
   * Initialize combat with array of fighters
   * @param {Array} fighters - Array of fighter objects
   * @param {Object} options - Optional initialization settings
   * @param {Object} options.terrain - Terrain data with obstacles, lighting
   * @param {Object} options.positions - Map of combatant positions {id: {x, y}}
   */
  initializeCombat(fighters, options = {}) {
    // Ensure all fighters have required properties without cloning
    this.combatants = fighters.map((fighter) => this.normalizeFighter(fighter));

    // Roll initiative for all fighters
    this.rollInitiative();

    // Initialize fatigue and grapple states
    this.combatants.forEach((fighter) => {
      if (!fighter.fatigueState) {
        fighter.fatigueState = this.initializeFatigue(fighter);
      }
      if (!fighter.grappleState) {
        fighter.grappleState = initializeGrappleState(fighter);
      }
    });

    this.meleeRound = 1;
    this.actionCounter = 0;
    this.isActive = true;

    this.logCallback(
      `ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â Combat Initialized - Combat Round ${this.meleeRound}`,
      "combat"
    );
    this.logCallback(
      `Initiative Order: ${this.combatants
        .map((f) => `${f.name} (${f.initiative})`)
        .join(", ")}`,
      "info"
    );

    // Process courage auras BEFORE horror checks (provides bonuses to saves)
    const terrain = options.terrain || {};
    const positions = options.positions || {};

    processCourageAuras(this.combatants, positions, this.logCallback);

    // Trigger dreadRating checks for combatants with dreadRating
    // This hastaminans before the first combat round, when combatants first see each other
    // Only triggers for visible opponents (respects line-of-sight and lighting)
    // Courage bonuses from auras are already applied to tempBonuses.horrorSave
    this.combatants.forEach((combatant) => {
      if (hasHorrorFactor(combatant)) {
        const opponents = this.combatants.filter(
          (t) => t !== combatant && t.type !== combatant.type
        );
        if (opponents.length > 0) {
          triggerHorrorFactor(combatant, opponents, terrain, this.logCallback, {
            positions: positions,
            currentRound: this.currentRound,
            meleeRound: this.currentRound,
          });
        }
      }
    });

    return this.combatants;
  }

  /**
   * Normalize fighter object to ensure required properties exist
   * @param {Object} fighter - Fighter object
   * @returns {Object} Normalized fighter
   */
  normalizeFighter(fighter) {
    if (!fighter || typeof fighter !== "object") {
      throw new Error("Invalid fighter supplied to combat engine");
    }

    if (fighter.__normalized) {
      if (fighter.actionsPerRound == null) {
        fighter.actionsPerRound =
          getAttacksPerMelee(fighter) ||
          fighter.actions ||
          fighter.remainingActions ||
          2;
      }
      if (fighter.remainingActions == null) {
        fighter.remainingActions = fighter.actionsPerRound || 2;
      }
      return fighter;
    }

    const target = fighter;

    const rawAbilities = Array.isArray(target.abilitiesRaw)
      ? target.abilitiesRaw
      : Array.isArray(target.abilities)
      ? target.abilities
      : [];

    const parsedAbilities =
      target.abilitiesParsed ||
      (rawAbilities.length > 0 ? parseAbilities(rawAbilities) : {});

    target.abilities = parsedAbilities;
    target.abilitiesParsed = parsedAbilities;
    target.abilitiesRaw = rawAbilities;

    const combatSkills = mapPROFESSIONSkillsToCombat(target);

    if (!parsedAbilities.skills) parsedAbilities.skills = {};
    if (combatSkills.prowl > 0 && !parsedAbilities.skills.prowl) {
      parsedAbilities.skills.prowl = combatSkills.prowl;
    }
    if (combatSkills.track > 0 && !parsedAbilities.skills.track) {
      parsedAbilities.skills.track = combatSkills.track;
    }
    if (
      combatSkills.horsemanship > 0 &&
      !parsedAbilities.skills.horsemanship
    ) {
      parsedAbilities.skills.horsemanship = combatSkills.horsemanship;
    }
    if (
      combatSkills.detectAmbush > 0 &&
      !parsedAbilities.skills["detect ambush"]
    ) {
      parsedAbilities.skills["detect ambush"] = combatSkills.detectAmbush;
    }
    if (
      combatSkills.scaleWalls > 0 &&
      !parsedAbilities.skills["scale walls"]
    ) {
      parsedAbilities.skills["scale walls"] = combatSkills.scaleWalls;
    }

    const actionsPerRound =
      combatSkills.actionsPerRound ||
      getAttacksPerMelee(target) ||
      target.actionsPerRound ||
      target.actions ||
      target.remainingActions ||
      2;

    target.id =
      target.id || `fighter-${Math.random().toString(36).substring(2, 10)}`;
    target.name = target.name || "Unknown Fighter";
    target.currentHP = target.currentHP ?? target.hp ?? target.maxHP ?? 20;
    target.maxHP = target.maxHP ?? target.hp ?? 20;
    target.actionsPerRound = actionsPerRound;
    target.remainingActions = target.remainingActions ?? actionsPerRound ?? 2;
    target.initiative = target.initiative ?? 0;
    target.attributes = target.attributes || {};
    target.bonuses = target.bonuses || {};
    target.guardRating = target.guardRating ?? target.guardRating ?? 10;
    target.alive =
      target.alive !== false &&
      (target.currentHP ?? target.hp ?? 20) > -21;
    target.type = target.type || "enemy";
    target.skills = parsedAbilities.skills || {};
    target.combatSkills = combatSkills;
    target.hasNightvision = !!parsedAbilities.senses?.nightvision?.active;
    
    // Initialize altitude for all fighters (starts at 0 = grounded)
    // Altitude is tracked in 5ft increments, similar to hex distances
    if (target.altitude === undefined && target.altitudeFeet === undefined) {
      target.altitude = 0;
      target.altitudeFeet = 0;
    } else if (target.altitude === undefined) {
      target.altitude = target.altitudeFeet || 0;
    } else if (target.altitudeFeet === undefined) {
      target.altitudeFeet = target.altitude || 0;
    }

    const sizeInfo = getSizeScale(target);
    if (sizeInfo) {
      target.sizeCategory = target.sizeCategory || sizeInfo.category;
      target.sizeFeet = target.sizeFeet ?? sizeInfo.rawFeet;
      target.gridFootprint = target.gridFootprint || sizeInfo.footprint;
      target.footprint = target.footprint || sizeInfo.footprint;
      target.baseReach = target.baseReach ?? sizeInfo.reach;
      if (!target.reach || sizeInfo.reach > target.reach) {
        target.reach = sizeInfo.reach;
      }
      applySizeCombatModifiers(target, sizeInfo);
    }

    target.__normalized = true;

    return target;
  }

  /**
   * Roll initiative for all fighters
   */
  rollInitiative() {
    this.combatants = rollRoundInitiative(
      this.combatants,
      { round: this.meleeRound, source: "combat-engine" },
      () => CryptoSecureDice.rollD20(),
    );
    const eligible = this.combatants.filter((fighter) => fighter.initiativeEligible);
    this.logCallback(
      `Initiative Order — Round ${this.meleeRound}:\n${eligible
        .map((fighter, index) => `${index + 1}. ${fighter.name} — ${fighter.initiativeTotal}`)
        .join("\n")}`,
      "initiative",
    );
  }

  /**
   * Compatibility sorter for callers that already hold canonical tie metadata.
   */
  resolveInitiativeTies() {
    this.combatants = [...this.combatants].sort((left, right) => {
      const totalDifference =
        Number(right.initiativeTotal ?? right.initiative ?? 0) -
        Number(left.initiativeTotal ?? left.initiative ?? 0);
      if (totalDifference !== 0) return totalDifference;
      const tieDifference =
        Number(right.initiativeTieBreaker ?? 0) -
        Number(left.initiativeTieBreaker ?? 0);
      if (tieDifference !== 0) return tieDifference;
      return String(left.id ?? left.name ?? "").localeCompare(String(right.id ?? right.name ?? ""));
    });
    return this.combatants;
  }

  /**
   * Initialize fatigue state for a fighter
   * @param {Object} fighter - Fighter object
   * @returns {Object} Fatigue state
   */
  initializeFatigue(fighter) {
    const PE = fighter.attributes?.PE || fighter.PE || 10;
    return {
      maxStamina: PE * 2,
      currentStamina: PE * 2,
      fatigueLevel: 0,
      penalties: {
        attack: 0,
        block: 0,
        evade: 0,
        ps: 0,
        speed: 1.0,
      },
      status: "ready",
    };
  }

  /**
   * Execute one combat round (alternating actions until all fighters out of actions)
   * @param {Function} actionSelector - Function that selects action for each fighter (fighter, availableTargets) => action
   * @returns {Object} Round result with stats
   */
  executeMeleeRound(actionSelector) {
    if (!this.isActive) {
      this.logCallback("ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Combat is not active", "error");
      return null;
    }

    this.logCallback(`\nÃƒÂ¢Ã‚ÂÃ‚Â° Combat Round ${this.meleeRound} begins`, "combat");

    // Process courage auras at start of each combat round
    // This applies bonuses and dfocusels fear before any actions
    const positions = this.combatants.reduce((acc, c) => {
      if (c.position || c.id) {
        acc[c.id] = c.position || { x: 0, y: 0 };
      }
      return acc;
    }, {});
    processCourageAuras(this.combatants, positions, this.logCallback);

    // Process protection circles (wards and circles of protection)
    // These also provide courage bonuses and repel evil combatants
    // Map-aware version handles both logic and visual updates
    this.activeCircles = updateProtectionCirclesOnMap({
      circles: this.activeCircles,
      combatants: this.combatants,
      positions: positions,
      log: this.logCallback,
    });

    const roundStats = {
      actions: 0,
      attacks: 0,
      grapples: 0,
      evades: 0,
      parries: 0,
      damageDealt: 0,
      fightersOutOfActions: [],
    };

    // Loop until all fighters are out of actions
    while (this.hasActionsRemaining()) {
      for (const fighter of this.combatants) {
        // Skip if fighter can't act
        if (!this.canFighterAct(fighter)) {
          continue;
        }

        // Skip if fighter has no actions remaining
        if (fighter.remainingActions <= 0) {
          continue;
        }

        // Get available targets
        const targets = this.getAvailableTargets(fighter);
        if (targets.length === 0) {
          this.logCallback(
            `${fighter.name} has no targets and defends`,
            "info"
          );
          fighter.remainingActions = Math.max(0, fighter.remainingActions - 1);
          roundStats.actions++;
          continue;
        }

        // Select action (via callback hook)
        const action = actionSelector(fighter, targets, this.combatants);

        if (!action) {
          this.logCallback(`${fighter.name} takes no action`, "info");
          fighter.remainingActions = Math.max(0, fighter.remainingActions - 1);
          roundStats.actions++;
          continue;
        }

        // Execute action
        this.executeAction(fighter, action, roundStats);

        // Apply stamina drain
        this.applyStaminaDrain(fighter, action.type);

        // Decrement actions
        fighter.remainingActions = Math.max(0, fighter.remainingActions - 1);
        roundStats.actions++;

        // Update combatant state
        this.onCombatantUpdate(fighter);

        // Check for combat end conditions
        if (!this.hasActiveFighters()) {
          this.logCallback(
            "ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â Combat ended - no active fighters remaining",
            "combat"
          );
          this.isActive = false;
          break;
        }
      }
    }

    // Log fighters who ran out of actions
    this.combatants.forEach((fighter) => {
      if (fighter.remainingActions <= 0 && this.canFighterAct(fighter)) {
        roundStats.fightersOutOfActions.push(fighter.name);
      }
    });

    this.logCallback(
      `ÃƒÂ¢Ã‚ÂÃ‚Â° Combat Round ${this.meleeRound} complete (${roundStats.actions} total actions)`,
      "combat"
    );

    // Clear temporary courage bonuses after round completes
    clearCourageBonuses(this.combatants);

    autoCastFearProtection(this.combatants, this.logCallback);

    // Allow characters to attempt recovery from fear each combat round
    attemptFearRecovery(this.combatants, this.logCallback);

    // Reset all fighters' actions for next combat round
    this.resetActionsForNewRound();
    this.meleeRound++;
    this.rollInitiative();

    this.onMeleeRoundComplete(this.meleeRound - 1, roundStats);

    return roundStats;
  }

  /**
   * Check if any fighters have actions remaining
   * @returns {boolean}
   */
  hasActionsRemaining() {
    return this.combatants.some(
      (fighter) => this.canFighterAct(fighter) && fighter.remainingActions > 0
    );
  }

  /**
   * Check if fighter can act (alive, conscious, not dying, not status-effect disabled)
   * @param {Object} fighter - Fighter object
   * @returns {boolean}
   */
  canFighterAct(fighter) {
    if (!fighter.alive) return false;
    if (fighter.currentHP <= -21) return false; // Dead
    if (fighter.currentHP <= -11) return false; // Critical, cannot act
    if (fighter.currentHP <= -1) return false; // Dying, cannot act
    if (fighter.currentHP === 0) return false; // Unconscious

    // Check status effects (paralyzed, asleep, catatonia, etc.)
    if (!canCharacterAct(fighter)) return false;

    return true;
  }

  /**
   * Get available targets for a fighter
   * @param {Object} fighter - Fighter object
   * @returns {Array} Array of target fighters
   */
  getAvailableTargets(fighter) {
    return this.combatants.filter(
      (target) =>
        target !== fighter &&
        this.canFighterAct(target) &&
        target.type !== fighter.type // Only target enemies
    );
  }

  /**
   * Execute an action for a fighter
   * @param {Object} fighter - Fighter performing action
   * @param {Object} action - Action object {type, target, weapon?, technique?, tactical?}
   * @param {Object} roundStats - Round statistics object to update
   * @returns {Object} Action result
   */
  executeAction(fighter, action, roundStats) {
    const result = {
      success: false,
      damage: 0,
      message: "",
    };

    switch (action.type) {
      case "attack":
      case "attack":
        result.success = this.performAttack(
          fighter,
          action.target,
          action.weapon,
          roundStats
        );
        break;

      case "grapple":
        result.success = this.performGrapple(
          fighter,
          action.target,
          roundStats
        );
        break;

      case "evade":
        result.success = this.performEvade(fighter, action.target);
        break;

      case "block":
        result.success = this.performBlock(fighter, action.target);
        break;

      case "move":
        result.success = this.performMove(fighter, action.destination);
        break;

      case "technique":
        result.success = this.performTechnique(
          fighter,
          action.target,
          action.technique
        );
        break;

      case "tactical":
        result.success = this.performTactical(
          fighter,
          action.target,
          action.tactical
        );
        break;

      case "defend":
      case "hold":
        this.logCallback(`${fighter.name} takes a defensive stance`, "info");
        result.success = true;
        break;

      default:
        this.logCallback(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Unknown action type: ${action.type}`, "error");
        result.success = false;
    }

    return result;
  }

  /**
   * Perform a attack/attack action
   * @param {Object} attacker - Attacking fighter
   * @param {Object} defender - Defending fighter
   * @param {Object} weapon - Weapon object (optional)
   * @param {Object} roundStats - Round statistics
   * @returns {boolean} Success
   */
  performAttack(attacker, defender, weapon = null, roundStats = {}) {
    if (!this.canFighterAct(attacker) || !this.canFighterAct(defender)) {
      return false;
    }

    const statusPenalties = getStatusCombatPenalties(
      attacker,
      this.logCallback
    );

    if (statusPenalties.skipTurn) {
      this.logCallback(
        `ÃƒÂ°Ã…Â¸Ã‚ÂÃ†â€™ ${attacker.name} is fleeing and cannot attack this round!`,
        "combat"
      );
      attacker.remainingActions = 0;
      return false;
    }

    if (statusPenalties.loseAttack && attacker.remainingActions > 0) {
      attacker.remainingActions = Math.max(0, attacker.remainingActions - 1);
      this.logCallback(
        `ÃƒÂ°Ã…Â¸Ã‹Å“Ã‚Â° ${attacker.name} hesitates in terror and loses an attack this melee.`,
        "combat"
      );
      return false;
    }

    // Get attack bonuses (use unified abilities system)
    const attackBonus =
      getCombatBonus(attacker, "attack", weapon) ||
      attacker.bonuses?.attack ||
      attacker.handToHand?.attackBonus ||
      0;
    const fatigueStatus = getFatigueStatus(attacker);
    const fatiguePenalty = fatigueStatus.penalties?.attack || 0;

    const statusAttackPenalty = statusPenalties.attack || 0;

    // Get limb-specific penalties (from hit location system)
    // Include both temporary and permanent penalties
    const limbAttackPenalty =
      (attacker.bonuses?.tempPenalties?.attack || 0) +
      (attacker.bonuses?.permanentPenalties?.attack || 0);

    // Roll attack (apply fatigue, status, and limb penalties)
    const d20 = CryptoSecureDice.rollD20();
    const attackRoll =
      d20 +
      attackBonus -
      fatiguePenalty -
      statusAttackPenalty +
      limbAttackPenalty; // Note: limb penalties are already negative

    this.logCallback(
      `ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â² ${attacker.name} rolls attack with status penalties applied (attack bonus ${attackBonus}, fatigue -${fatiguePenalty}, status ${statusAttackPenalty}, limb ${limbAttackPenalty}).`,
      "combat"
    );

    if (d20 === 1) {
      this.logCallback(
        `${attacker.name} fumbles the attack against ${defender.name}!`,
        "combat"
      );
      roundStats.attacks++;
      return false;
    }

    // Get defender's status penalties for block/evade
    // Note: Limb penalties (stored in defender.bonuses.tempPenalties) will be applied
    // when defender actually performs block/evade actions
    const defenderStatusPenalties = getStatusPenalties(defender);

    // Check for block/evade reactions (defender can react)
    const defenseResult = this.checkDefenseReactions(
      defender,
      attacker,
      attackRoll,
      defenderStatusPenalties
    );

    if (defenseResult.defended) {
      this.logCallback(
        `${attacker.name} attacks ${defender.name} but ${defenseResult.method}!`,
        "combat"
      );
      roundStats.parries += defenseResult.method === "block" ? 1 : 0;
      roundStats.evades += defenseResult.method === "evade" ? 1 : 0;
      return false;
    }

    // Resolve damage and hit location, then attack vs armor / natural guardRating
    const baseDamage = this.calculateDamage(attacker, weapon);
    const attackerStatusPenalties = getStatusPenalties(attacker);
    const rolledDamage = Math.max(
      1,
      baseDamage + (attackerStatusPenalties.damage || 0)
    );

    const calledShotLocation = weapon?.calledShotLocation || null;

    const { finalDamage, hit, traumaTriggered, effects } = resolveHitLocation(
      attacker,
      defender,
      rolledDamage,
      this.useRandomHitLocations,
      {
        calledShotLocation: calledShotLocation,
        knockbackFeet: 0, // Can be enhanced later with knockdown system integration
        failedPEroll: false, // Can be enhanced later
      }
    );

    const hitSlot = hit?.slot || "chest";
    const connect = attackConnectsVsTarget({
      defender,
      attackTotal: attackRoll,
      d20,
      slot: hitSlot,
      ruleset: null,
      critOn: 20,
      alwaysMissOn: 1,
    });

    if (!connect.connects) {
      this.logCallback(
        `${attacker.name} attacks ${defender.name} but misses (total ${attackRoll}, d20 ${d20})`,
        "combat"
      );
      roundStats.attacks++;
      return false;
    }

    let damageToCharacter = finalDamage;
    if (defender.equistaminad && typeof calculateArmorDamage === "function") {
      try {
        const armorResult = calculateArmorDamage(
          defender,
          attackRoll,
          finalDamage,
          hitSlot,
          { isCrit: connect.isCrit, isFumble: false }
        );

        if (armorResult.armorHit) {
          damageToCharacter = 0;
          this.logCallback(
            `${attacker.name} hits ${defender.name}'s ${hit.location}, but armor absorbs the blow! (Armor: ${armorResult.damageToArmor} armorDurability damage)`,
            "combat"
          );

          if (armorResult.brokenArmor.length > 0) {
            armorResult.brokenArmor.forEach((broken) => {
              this.logCallback(
                `ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¢ ${defender.name}'s ${broken.name} is destroyed!`,
                "combat"
              );
            });
          }
        } else {
          damageToCharacter = armorResult.damageToCharacter || finalDamage;
        }
      } catch (error) {
        console.warn("Armor damage calculation failed:", error);
      }
    }

    if (damageToCharacter > 0) {
      defender.currentHP -= damageToCharacter;
      roundStats.damageDealt += damageToCharacter;
    }
    roundStats.attacks++;

    const locationDesc = getHitLocationDescription(
      hit,
      damageToCharacter || finalDamage
    );
    const damageNote =
      damageToCharacter > 0
        ? ` (${damageToCharacter} HP damage)`
        : " (armor absorbed)";

    this.logCallback(
      `${attacker.name} hits ${defender.name}'s ${hit.location}${damageNote}! ${locationDesc} (HP: ${defender.currentHP}/${defender.maxHP})`,
      "combat"
    );

    if (traumaTriggered) {
      this.logCallback(
        `ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Head trauma check triggered for ${defender.name}!`,
        "combat"
      );
    }

    if (effects && effects.length > 0) {
      effects.forEach((effect) => {
        this.logCallback(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â ${defender.name}: ${effect}`, "status");
      });
    }

    if (d20 >= 18) {
      this.logCallback(`ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¥ Critical hit!`, "combat");
    }

    if (defender.currentHP <= -21) {
      defender.alive = false;
      this.logCallback(`ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬ ${defender.name} has been slain!`, "combat");
    } else if (defender.currentHP <= 0) {
      this.logCallback(`ÃƒÂ°Ã…Â¸Ã‹Å“Ã‚Âµ ${defender.name} is unconscious!`, "combat");
    }

    return true;
  }

  /**
   * Check if defender can react with evade/block
   * @param {Object} defender - Defending fighter
   * @param {Object} attacker - Attacking fighter
   * @param {number} attackRoll - Attack roll value
   * @param {Object} statusPenalties - Status effect penalties for defender
   * @returns {Object} Defense result {defended: boolean, method: 'block'|'evade'|null}
   */
  checkDefenseReactions(
    _defender,
    _attacker,
    _attackRoll,
    // eslint-disable-next-line no-unused-vars
    _statusPenalties = {}
  ) {
    // TODO: Implement defensive stance checks and reaction logic
    // For now, return no defense (defender needs to declare defense in advance)
    // Status penalties are passed in case they're needed for future implementation
    return { defended: false, method: null };
  }

  /**
   * Calculate damage for an attack
   * @param {Object} attacker - Attacking fighter
   * @param {Object} weapon - Weapon object (optional)
   * @returns {number} Damage dealt
   */
  calculateDamage(attacker, weapon = null) {
    let baseDamage = 0;
    let damageFormula = null;

    if (weapon && weapon.damage) {
      // Get race/species for weapon size adjustment
      const race = attacker.species || attacker.race || attacker.type;
      const sizeContext = getCombatEngineSizeContext(attacker);
      void sizeContext;
      
      // Apply weapon size modifiers (heavy +1 die, gnome reduced damage)
      damageFormula =
        attacker?.sizePolicy === "neutral-size"
          ? getNeutralWeaponDamage(weapon.damage, attacker)
          : getAdjustedWeaponDamage(weapon.damage, race);
      
      // Parse damage dice (e.g., "1d8", "2d6+3")
      baseDamage = this.rollDamageDice(damageFormula);
    } else {
      // Unarmed damage
      const PS = attacker.attributes?.PS || attacker.PS || 10;
      const psBonus = Math.floor(PS / 5);
      const unarmedRoll = CryptoSecureDice.rollDice(1, 3);
      baseDamage = unarmedRoll.total + psBonus;
    }

    // Add damage bonus from unified abilities
    const damageBonus =
      getCombatBonus(attacker, "damage") || attacker.bonuses?.damage || 0;

    return Math.max(1, baseDamage + damageBonus); // Minimum 1 damage
  }

  /**
   * Roll damage dice
   * @param {string} formula - Dice formula (e.g., "1d8", "2d6+3")
   * @returns {number} Total damage
   */
  rollDamageDice(formula) {
    // Use CryptoSecureDice.parseAndRoll for string formulas
    try {
      const result = CryptoSecureDice.parseAndRoll(formula);
      return result.totalWithBonus || result.total;
      // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      // Fallback: Simple dice parser (supports "XdY+Z" format)
      const match = formula.match(/(\d+)d(\d+)(?:\+(\d+))?/);
      if (!match) return 1;

      const count = parseInt(match[1]);
      const sides = parseInt(match[2]);
      const bonus = match[3] ? parseInt(match[3]) : 0;

      const diceResult = CryptoSecureDice.rollDice(count, sides);
      return diceResult.total + bonus;
    }
  }

  /**
   * Perform grapple action
   * @param {Object} attacker - Attacking fighter
   * @param {Object} defender - Defending fighter
   * @param {Object} roundStats - Round statistics
   * @returns {boolean} Success
   */
  performGrapple(attacker, defender, roundStats = {}) {
    if (!this.canFighterAct(attacker) || !this.canFighterAct(defender)) {
      return false;
    }

    if (typeof this.executeCanonicalGrappleAction !== "function") {
      this.logCallback("grapple-inner-resolver-direct-entry-blocked: canonical grapple executor is required", "warning");
      return false;
    }
    const result = this.executeCanonicalGrappleAction({
      actor: attacker,
      opponent: defender,
      actionType: "grapple",
      source: "combat-engine",
      requestedActionSequence: 1,
    });

    if (result.success) {
      this.logCallback(result.message, "combat");
      roundStats.grapples++;
      return true;
    } else {
      this.logCallback(
        result.reason || `${attacker.name} fails to grapple ${defender.name}`,
        "combat"
      );
      return false;
    }
  }

  /**
   * Perform evade action
   * @param {Object} fighter - Dodging fighter
   * @param {Object} attacker - Attacking fighter (optional)
   * @returns {boolean} Success
   */
  // eslint-disable-next-line no-unused-vars
  performEvade(fighter, _attacker = null) {
    this.logCallback(
      `${fighter.name} prepares to evade incoming attacks`,
      "info"
    );
    // Evade is a defensive stance - actual evade roll hastaminans during defense reactions
    return true;
  }

  /**
   * Perform block action
   * @param {Object} fighter - Blocking fighter
   * @param {Object} attacker - Attacking fighter (optional)
   * @returns {boolean} Success
   */
  // eslint-disable-next-line no-unused-vars
  performBlock(fighter, _attacker = null) {
    this.logCallback(
      `${fighter.name} takes a defensive stance, preparing to block`,
      "info"
    );
    // Block is a defensive stance - actual block roll hastaminans during defense reactions
    return true;
  }

  /**
   * Perform move action
   * @param {Object} fighter - Moving fighter
   * @param {Object} destination - Destination coordinates {x, y}
   * @returns {boolean} Success
   */
  performMove(fighter, destination, oldPosition = null) {
    // Check if movement is blocked by protection circles
    if (this.activeCircles && this.activeCircles.length > 0) {
      const blockCheck = checkMovementBlockedByCircle(
        oldPosition || fighter.position || { x: 0, y: 0 },
        destination,
        this.activeCircles,
        fighter
      );

      if (blockCheck.blocked) {
        this.logCallback(`ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â« ${blockCheck.reason}`, "holy");
        return false;
      }

      // Check circle entry/exit if position changed
      if (
        oldPosition &&
        (oldPosition.x !== destination.x || oldPosition.y !== destination.y)
      ) {
        checkCircleEntryExit(
          fighter,
          oldPosition,
          destination,
          this.activeCircles,
          this.logCallback
        );
      }
    }

    // Update fighter position
    fighter.position = destination;

    this.logCallback(
      `${fighter.name} moves to (${destination.x}, ${destination.y})`,
      "info"
    );
    return true;
  }

  /**
   * Perform technique cast (hook for technique system)
   * @param {Object} caster - Casting fighter
   * @param {Object} target - Target fighter
   * @param {Object} technique - Technique object
   * @returns {boolean} Success
   */
  performTechnique(caster, target, technique) {
    // Check if this is a protection circle/ward technique
    if (technique && technique.name && isProtectionCircle(technique.name)) {
      const casterPos = caster.position || { x: 0, y: 0 };
      const circle = createProtectionCircle(caster, technique.name, casterPos);
      this.activeCircles.push(circle);
      this.logCallback(`ÃƒÂ°Ã…Â¸Ã¢â‚¬Â¢Ã‚Â¯ÃƒÂ¯Ã‚Â¸Ã‚Â ${caster.name} draws ${technique.name}!`, "holy");
      this.logCallback(
        `ÃƒÂ¢Ã…â€œÃ‚Â¨ The circle glows with divine light (radius ${circle.radius} ft, +${circle.bonus} vs Horror).`,
        "holy"
      );
      return true;
    }

    if (technique?.name) {
      const techniqueName = technique.name.toLowerCase();
      if (techniqueName === "courage") {
        return castCourage(caster, this.combatants, this.logCallback);
      }
      if (techniqueName === "remove fear") {
        if (!target) {
          this.logCallback(
            `${caster.name} needs a target within reach to cast Remove Fear!`,
            "technique"
          );
          return false;
        }
        return castRemoveFear(caster, target, this.logCallback);
      }
    }

    // Hook for technique system integration
    this.logCallback(`${caster.name} casts ${technique.name || "technique"}`, "combat");
    // TODO: Integrate with technique system
    return true;
  }

  /**
   * Perform tactical power (hook for tactical system)
   * @param {Object} user - Using fighter
   * @param {Object} target - Target fighter
   * @param {Object} tactical - Tactical power object
   * @returns {boolean} Success
   */
  performTactical(user, target, tactical) {
    // Hook for tactical system integration
    this.logCallback(
      `${user.name} uses ${tactical.name || "tactical power"}`,
      "combat"
    );
    // TODO: Integrate with tactical system
    return true;
  }

  /**
   * Apply stamina drain for an action
   * @param {Object} fighter - Fighter performing action
   * @param {string} actionType - Type of action (from STAMINA_COSTS)
   */
  applyStaminaDrain(fighter, actionType) {
    // Grappling costs extra stamina
    if (fighter.grappleState?.state !== GRAPPLE_STATES.NEUTRAL) {
      drainStamina(fighter, STAMINA_COSTS.GRAPPLING, 1);
    } else {
      drainStamina(fighter, actionType, 1);
    }

    // Apply fatigue penalties
    applyFatiguePenalties(fighter);

    const fatigueStatus = getFatigueStatus(fighter);
    if (fatigueStatus.status !== "ready") {
      this.logCallback(
        `ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Âª ${fighter.name} fatigue: ${
          fatigueStatus.status
        } (Stamina: ${fatigueStatus.currentStamina.toFixed(1)}/${
          fatigueStatus.maxStamina
        })`,
        "info"
      );
    }
  }

  /**
   * Reset all fighters' actions for new combat round
   * Also applies bio-regeneration if applicable
   */
  resetActionsForNewRound() {
    this.combatants.forEach((fighter) => {
      // Update status effects (apply ongoing damage, check durations, etc.)
      const statusUpdate = updateStatusEffects(
        fighter,
        this.meleeRound,
        this.logCallback
      );

      // Check if fighter loses next action due to status effects
      if (statusUpdate.loseNextAction) {
        this.logCallback(
          `ÃƒÂ°Ã…Â¸Ã‹Å“Ã‚Âµ ${fighter.name} is stunned and loses their next action!`,
          "combat"
        );
      }

      // Apply speed multiplier from status effects
      if (statusUpdate.speedMultiplier !== 1.0 && fighter.spd) {
        fighter.currentSpeed = Math.floor(
          fighter.spd * statusUpdate.speedMultiplier
        );
      }

      if (statusUpdate.behaviorOverride) {
        fighter.behaviorOverride = statusUpdate.behaviorOverride;
      } else if (fighter.behaviorOverride && !statusUpdate.behaviorOverride) {
        delete fighter.behaviorOverride;
      }

      if (this.canFighterAct(fighter) && !statusUpdate.loseNextAction) {
        fighter.remainingActions = fighter.actionsPerRound || 2;
      } else {
        // Clear loseNextAction flag after checking
        fighter.loseNextAction = false;
      }

      // Apply bio-regeneration if fighter has it
      const regenResult = applyBioRegeneration(fighter);
      if (regenResult) {
        this.logCallback(regenResult.log, "healing");
      }
    });
  }

  /**
   * Check if there are any active fighters remaining
   * @returns {boolean}
   */
  hasActiveFighters() {
    return this.combatants.some((fighter) => this.canFighterAct(fighter));
  }

  /**
   * Get current combat state
   * @returns {Object} Combat state
   */
  getCombatState() {
    return {
      meleeRound: this.meleeRound,
      actionCounter: this.actionCounter,
      combatants: this.combatants.map((f) => ({
        id: f.id,
        name: f.name,
        currentHP: f.currentHP,
        remainingActions: f.remainingActions,
        initiative: f.initiative,
      })),
      isActive: this.isActive,
    };
  }

  /**
   * End combat
   */
  endCombat() {
    this.isActive = false;
    this.logCallback("ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â Combat ended", "combat");

    if (Array.isArray(this.combatants)) {
      this.combatants.forEach((fighter) => {
        if (!fighter || typeof fighter !== "object") return;
        fighter.remainingActions = fighter.actionsPerRound ?? fighter.actions ?? 0;
        fighter.grappleState = undefined;
        fighter.fatigueState = undefined;
      });
    }

    this.combatants = [];
    this.activeCircles = [];
    this.meleeRound = 1;
    this.actionCounter = 0;
  }
}

/**
 * Default action selector (simple AI for testing)
 * @param {Object} fighter - Fighter selecting action
 * @param {Array} targets - Available targets
 * @returns {Object} Action object
 */
export function defaultActionSelector(fighter, targets) {
  if (targets.length === 0) {
    return { type: "defend" };
  }

  // Simple AI: randomly choose attack or grapple
  const actionType = Math.random() < 0.9 ? "attack" : "grapple";
  const target = targets[Math.floor(Math.random() * targets.length)];

  return {
    type: actionType,
    target: target,
  };
}

/**
 * Export singleton instance creator
 */
export function createCombatEngine(options = {}) {
  return new CombatEngine(options);
}

/**
 * Create an AI action selector function
 * @param {Object} engineContext - Context object with combatants, environment, positions, logCallback
 * @returns {Function} Action selector function (fighter, targets, allFighters) => actionPlan
 */
export function createAIActionSelector(engineContext = {}) {
  const {
    combatants = [],
    environment = {},
    positions = {},
    logCallback = () => {},
  } = engineContext;

  /**
   * AI action selector function
   * @param {Object} fighter - Fighter selecting action
   * @param {Array} targets - Available targets
   * @param {Array} allFighters - All fighters in combat
   * @returns {Object} Action plan with type, target, etc.
   */
  return function selectAction(fighter, targets = [], allFighters = []) {
    if (!fighter) {
      return { type: "defend" };
    }

    if (!targets || targets.length === 0) {
      return { type: "defend" };
    }

    // Use default action selector as base
    const baseAction = defaultActionSelector(fighter, targets);

    // Enhance with context-aware decisions
    const actionPlan = {
      type: baseAction.type || "attack",
      target: baseAction.target || targets[0],
      weapon: fighter.equistaminadWeapon || null,
      position: positions[fighter.id] || fighter.position,
    };

    // Add strategic considerations based on environment
    if (environment.terrain === "water" && !fighter.canSwim) {
      actionPlan.type = "defend"; // Can't fight in water if can't swim
    }

    // Add range considerations
    if (actionPlan.target && actionPlan.position && actionPlan.target.position) {
      const distance = calculateDistance(
        actionPlan.position,
        actionPlan.target.position
      );
      if (distance > 5 && actionPlan.weapon && actionPlan.weapon.range) {
        // Prefer ranged attacks at distance
        if (actionPlan.weapon.range >= distance) {
          actionPlan.type = "ranged";
        } else {
          actionPlan.type = "move"; // Need to move closer
        }
      }
    }

    return actionPlan;
  };
}


// ==========================================
// SIMPLIFIED FUNCTIONAL API (for standalone use)
// ==========================================

/**
 * Simple dice rolling utilities (using CryptoSecureDice)
 */
export const rollD20 = () => CryptoSecureDice.rollD20();

export const rollDice = (formula) => {
  try {
    const result = CryptoSecureDice.parseAndRoll(formula);
    return result.totalWithBonus || result.total;
    // eslint-disable-next-line no-unused-vars
  } catch (_error) {
    // Fallback parser
    const match = formula.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) return 1;
    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const bonus = match[3] ? parseInt(match[3]) : 0;
    const diceResult = CryptoSecureDice.rollDice(count, sides);
    return diceResult.total + bonus;
  }
};

/**
 * Simplified combat round function (matches suggested API)
 * Works with arenaRoster.js structure and existing fatigue/grapple systems
 *
 * Usage examples:
 *   - combatRound(["human_knight", "champion"]) // Auto-loads from arenaRoster
 *   - combatRound([loadCombatant("arena-champion"), loadCombatant("scarecrow")]) // Pre-loaded
 *   - validateArenaRoster() // Run on game start to check data integrity
 *
 * @param {Array} combatants - Array of fighter objects or string IDs (will be auto-loaded)
 * @param {Object} arenaRosterData - Optional arenaRoster data (deprecated, use loadCombatants instead)
 * @returns {Promise<Object>} Round statistics
 */
// eslint-disable-next-line no-unused-vars
export async function combatRound(combatants, arenaRosterData = null, options = {}) {
  // Normalize combatants - convert string IDs to full objects using arenaRosterLoader
  const normalizedCombatants = combatants.map((c) => {
    if (typeof c === "string") {
      // Use arenaRosterLoader to load combatant by ID or name
      try {
        const loaded = loadCombatant(c);
        // Ensure compatibility with combat engine expectations
        return {
          ...loaded,
          maxHP: loaded.HP,
          hp: loaded.currentHP,
          guardRating: loaded.guardRating,
          actionsPerRound: loaded.actions || 3,
          remainingActions: loaded.actions || 3,
          weaponDamage: loaded.attacks?.[0]?.damage || "1d8",
          PE: loaded.attributes?.PE || 10,
          PS: loaded.attributes?.PS || 10,
          PP: loaded.attributes?.PP || 10,
          fatigueState: loaded.fatigueState || initializeCombatFatigue(loaded),
          grappleState: loaded.grappleState || initializeGrappleState(loaded),
          initiative: rollD20() + (loaded.bonuses?.initiative || 0),
        };
      } catch (e) {
        console.warn(`Could not load combatant "${c}":`, e.message);
        // Fallback to basic fighter
        return {
          id: c,
          name: c,
          alive: true,
          hp: 20,
          currentHP: 20,
          maxHP: 20,
          actions: 2,
          remainingActions: 2,
          guardRating: 10,
          guardRating: 10,
          initiative: rollD20(),
        };
      }
    }
    // Ensure required properties exist for already-loaded fighters
    return {
      ...c,
      alive: c.alive !== false,
      hp: c.hp ?? c.currentHP ?? c.HP ?? 20,
      currentHP: c.currentHP ?? c.hp ?? c.HP ?? 20,
      maxHP: c.maxHP ?? c.hp ?? c.HP ?? 20,
      actions: c.actions ?? c.remainingActions ?? c.actionsPerRound ?? 2,
      remainingActions:
        c.remainingActions ?? c.actions ?? c.actionsPerRound ?? 2,
      initiative: c.initiative ?? rollD20(),
      PE: c.PE ?? c.attributes?.PE ?? 10,
      PS: c.PS ?? c.attributes?.PS ?? 10,
      PP: c.PP ?? c.attributes?.PP ?? 10,
      bonuses: c.bonuses || {},
      guardRating: c.guardRating ?? c.guardRating ?? 10,
      guardRating: c.guardRating ?? c.guardRating ?? 10,
      weaponDamage: c.weaponDamage || c.attacks?.[0]?.damage || "1d8",
      fatigueState: c.fatigueState || initializeCombatFatigue(c),
      grappleState: c.grappleState || initializeGrappleState(c),
      state: c.state || "neutral",
    };
  });

  // Sort by initiative (highest first)
  normalizedCombatants.sort((a, b) => b.initiative - a.initiative);

  console.log("\n=== ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â Combat Round Begins ===");
  console.table(
    normalizedCombatants.map((c) => ({
      Name: c.name,
      HP: c.currentHP ?? c.hp,
      Actions: c.actions,
      Initiative: c.initiative,
    }))
  );

  const roundStats = {
    actions: 0,
    attacks: 0,
    grapples: 0,
    evades: 0,
    parries: 0,
    damageDealt: 0,
    fightersOutOfActions: [],
  };

  // Loop until all actions spent or all dead
  while (normalizedCombatants.some((c) => c.alive && c.actions > 0)) {
    for (let actor of normalizedCombatants.filter((c) => c.alive)) {
      if (actor.actions <= 0) continue;

      // Select a target
      const targets = normalizedCombatants.filter(
        (t) => t !== actor && t.alive
      );
      if (targets.length === 0) break;

      const target = targets[Math.floor(Math.random() * targets.length)];

      // Randomly decide to grapple or attack (25% chance grapple)
      const useGrapple = Math.random() < 0.25;

      if (useGrapple) {
        const result = typeof options.executeCanonicalGrappleAction === "function"
          ? options.executeCanonicalGrappleAction({ actor, opponent: target, actionType: "grapple", source: "combat-round", requestedActionSequence: 1 })
          : { accepted: false, success: false, reason: "grapple-inner-resolver-direct-entry-blocked" };
        console.log(result.success ? result.message : result.reason);
        if (result.success) roundStats.grapples++;
      } else {
        const attackResult = resolveAttack(actor, target);
        console.log(attackResult);
        if (attackResult.includes("hits")) {
          roundStats.attacks++;
          const dmgMatch = attackResult.match(/for (\d+) damage/);
          if (dmgMatch) {
            roundStats.damageDealt += parseInt(dmgMatch[1]);
          }
        }
      }

      // Update stamina + fatigue (use existing system)
      const actionType =
        actor.grappleState?.state !== GRAPPLE_STATES.NEUTRAL
          ? STAMINA_COSTS.GRAPPLING
          : STAMINA_COSTS.NORMAL_COMBAT;
      drainStamina(actor, actionType, 1);
      applyFatiguePenalties(actor);

      actor.actions -= 1;
      roundStats.actions++;
    }
  }

  // Track who ran out of actions
  normalizedCombatants.forEach((fighter) => {
    if (fighter.actions <= 0 && fighter.alive) {
      roundStats.fightersOutOfActions.push(fighter.name);
    }
  });

  console.log("=== ÃƒÂ°Ã…Â¸Ã‚ÂÃ‚Â Combat Round Ends ===\n");
  return roundStats;
}

/**
 * Resolve a single attack (attack)
 * @param {Object} attacker - Attacking fighter
 * @param {Object} defender - Defending fighter
 * @param {boolean} useRandomHitLocations - Whether to use random hit locations (default: true)
 * @returns {string} Result message
 */
function resolveAttack(attacker, defender, useRandomHitLocations = true) {
  if (!attacker.alive || !defender.alive) return "";

  const attackBonus = getCombatBonus(attacker, "attack", attacker.weapon || attacker.weaponSlots?.rightHand || attacker.weaponSlots?.twoHanded || null) || (attacker.bonuses?.attack || 0);
  const fatiguePenalty = attacker.fatigueState?.penalties?.attack || 0;
  const d20Atk = rollD20();
  const attackRoll = d20Atk + attackBonus - fatiguePenalty;

  if (d20Atk === 1) {
    return `${attacker.name} fumbles the attack against ${defender.name}!`;
  }

  const blockBonus = getCombatBonus(defender, "block", defender.weaponSlots?.leftHand || defender.weaponSlots?.rightHand || defender.weaponSlots?.twoHanded || null) || (defender.bonuses?.block || 0);

  const blockRoll = rollD20() + blockBonus;

  if (attackRoll <= blockRoll) {
    return `${attacker.name} attacks ${defender.name} but misses or is parried.`;
  }

  let baseDmg =
    rollDice(attacker.weaponDamage || "1d8") +
    Math.floor((attacker.PS || 10) / 5);

  const weaponIsTraining = attacker.weaponIsTraining || false;
  const damageType = weaponIsTraining ? "training" : "normal";
  const resistance = checkDamageResistance(
    defender,
    damageType,
    weaponIsTraining
  );

  if (resistance.ignored) {
    return `${attacker.name} attacks ${defender.name} but ${resistance.reason}!`;
  }

  baseDmg = Math.floor(baseDmg * resistance.multiplier);

  if (baseDmg <= 0) {
    return `${attacker.name} attacks ${defender.name} but ${resistance.reason}!`;
  }

  const { finalDamage, hit, effects } = resolveHitLocation(
    attacker,
    defender,
    baseDmg,
    useRandomHitLocations,
    {}
  );

  const connect = attackConnectsVsTarget({
    defender,
    attackTotal: attackRoll,
    d20: d20Atk,
    slot: hit?.slot || "chest",
    ruleset: null,
    critOn: 20,
    alwaysMissOn: 1,
  });

  if (!connect.connects) {
    return `${attacker.name} attacks ${defender.name} but misses.`;
  }

  let damageToCharacter = finalDamage;
  if (defender.equistaminad && typeof calculateArmorDamage === "function") {
    try {
      const armorResult = calculateArmorDamage(
        defender,
        attackRoll,
        finalDamage,
        hit.slot,
        { isCrit: connect.isCrit, isFumble: false }
      );

      if (armorResult.armorHit) {
        damageToCharacter = 0;
        return `${attacker.name} hits ${defender.name}'s ${hit.location}, but armor absorbs the blow!`;
      } else {
        damageToCharacter = armorResult.damageToCharacter || finalDamage;
      }
    } catch {
      // Armor system not available, proceed with normal damage
    }
  }

  defender.currentHP =
    (defender.currentHP ?? defender.hp) - damageToCharacter;
  defender.hp = defender.currentHP;

  let resultMessage = `${attacker.name} hits ${defender.name}'s ${hit.location} for ${damageToCharacter} damage`;
  const resistanceNote =
    resistance.multiplier !== 1 ? ` (${resistance.reason})` : "";
  resultMessage += resistanceNote;

  if (effects && effects.length > 0) {
    resultMessage += ` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${effects.join(", ")}`;
  }

  if (defender.currentHP <= 0) {
    defender.currentHP = 0;
    defender.hp = 0;
    defender.alive = false;
    return `ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬ ${resultMessage} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${defender.name} is slain!`;
  }

  resultMessage += `! (HP: ${defender.currentHP})`;
  return resultMessage;
}

/**
 * Refresh all combatants for next combat round
 * @param {Array} combatants - Array of fighter objects
 */
export function refreshForNextMelee(combatants) {
  for (let c of combatants) {
    if (!c.alive) continue;
    c.actions = calculateActions(c);
    c.initiative = rollD20() + (c.PP || c.attributes?.PP || 10);
  }
}

/**
 * Calculate actions per melee based on character
 * @param {Object} character - Character object
 * @returns {number} Actions per melee
 */
function calculateActions(c) {
  // Check if character has actionsPerRound already set
  if (c.actionsPerRound) return c.actionsPerRound;

  // Simple lookup based on name/type
  const name = (c.name || "").toLowerCase();
  if (name.includes("champion")) return 6;
  if (name.includes("knight")) return 4;
  if (name.includes("heavy fighter")) return 5;

  // Default
  return c.actions || 3;
}

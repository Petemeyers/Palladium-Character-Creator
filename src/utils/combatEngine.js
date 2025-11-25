/**
 * Palladium Fantasy RPG - Combat Engine
 *
 * Production-ready alternating action combat loop that implements Palladium RAW:
 * - Actions alternate in initiative order (one action per fighter, looping until all spent)
 * - Fatigue and stamina drain integration
 * - Grapple state management
 * - Dodge/parry reaction hooks
 * - Finishing "leftover-action" rounds for fast enemies
 * - Extendable hooks for spells, ranged attacks, and special abilities
 *
 * Based on Palladium Fantasy RPG core rules (1994 edition)
 *
 * Dependencies:
 *   - src/utils/combatFatigueSystem.js
 *   - src/utils/grapplingSystem.js
 *   - src/utils/bestiaryLoader.js
 *   - src/utils/bestiaryValidator.js
 *   - src/data/bestiary.json
 */

import { calculateDistance } from "../data/movementRules.js";

import {
  drainStamina,
  getFatigueStatus,
  applyFatiguePenalties,
  initializeCombatFatigue,
  STAMINA_COSTS,
} from "./combatFatigueSystem.js";

import {
  initializeGrappleState,
  attemptGrapple,
  // eslint-disable-next-line no-unused-vars
  maintainGrapple,
  // eslint-disable-next-line no-unused-vars
  breakFree,
  // eslint-disable-next-line no-unused-vars
  groundStrike,
  GRAPPLE_STATES,
} from "./grapplingSystem.js";
// Note: maintainGrapple, breakFree, groundStrike are available for future use

// Import and re-export bestiary utilities for convenience
// eslint-disable-next-line no-unused-vars
import { loadCreature, loadCreatures } from "./bestiaryLoader.js";
// eslint-disable-next-line no-unused-vars
import { validateBestiary } from "./bestiaryValidator.js";

// Re-export bestiary utilities for convenience
export { loadCreature, loadCreatures } from "./bestiaryLoader.js";
export { validateBestiary } from "./bestiaryValidator.js";

// Import ability and skill systems
import { parseAbilities, applyBioRegeneration } from "./abilitySystem.js";
import { mapOCCSkillsToCombat, getAttacksPerMelee } from "./OCCSkillMapper.js";
// eslint-disable-next-line no-unused-vars
import { getUnifiedAbilities, getCombatBonus } from "./unifiedAbilities.js";

import CryptoSecureDice from "./cryptoDice.js";
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
} from "./horrorFactorSystem.js";
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
import { getSizeScale, applySizeCombatModifiers } from "./sizeScaleSystem.js";
import { getStatusCombatPenalties } from "./statusEffectSystem.js";
import { autoCastFearProtection } from "./fearAIAutoCast.js";
import { castCourage, castRemoveFear } from "./fearSpellSystem.js";

/**
 * Combat Engine Class
 * Manages alternating action combat flow per Palladium RAW
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

    // Sort by initiative (highest first)
    this.combatants.sort((a, b) => b.initiative - a.initiative);

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
      `⚔️ Combat Initialized - Melee Round ${this.meleeRound}`,
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

    // Trigger Horror Factor checks for creatures with HF
    // This happens before the first melee round, when combatants first see each other
    // Only triggers for visible opponents (respects line-of-sight and lighting)
    // Courage bonuses from auras are already applied to tempBonuses.horrorSave
    this.combatants.forEach((creature) => {
      if (hasHorrorFactor(creature)) {
        const opponents = this.combatants.filter(
          (t) => t !== creature && t.type !== creature.type
        );
        if (opponents.length > 0) {
          triggerHorrorFactor(creature, opponents, terrain, this.logCallback, {
            positions: positions,
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
      if (fighter.attacksPerMelee == null) {
        fighter.attacksPerMelee =
          getAttacksPerMelee(fighter) ||
          fighter.actions ||
          fighter.remainingAttacks ||
          2;
      }
      if (fighter.remainingAttacks == null) {
        fighter.remainingAttacks = fighter.attacksPerMelee || 2;
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

    const combatSkills = mapOCCSkillsToCombat(target);

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

    const attacksPerMelee =
      combatSkills.attacksPerMelee ||
      getAttacksPerMelee(target) ||
      target.attacksPerMelee ||
      target.actions ||
      target.remainingAttacks ||
      2;

    target.id =
      target.id || `fighter-${Math.random().toString(36).substring(2, 10)}`;
    target.name = target.name || "Unknown Fighter";
    target.currentHP = target.currentHP ?? target.hp ?? target.maxHP ?? 20;
    target.maxHP = target.maxHP ?? target.hp ?? 20;
    target.attacksPerMelee = attacksPerMelee;
    target.remainingAttacks = target.remainingAttacks ?? attacksPerMelee ?? 2;
    target.initiative = target.initiative ?? 0;
    target.attributes = target.attributes || {};
    target.bonuses = target.bonuses || {};
    target.AR = target.AR ?? target.armorRating ?? 10;
    target.alive =
      target.alive !== false &&
      (target.currentHP ?? target.hp ?? 20) > -21;
    target.type = target.type || "enemy";
    target.skills = parsedAbilities.skills || {};
    target.combatSkills = combatSkills;
    target.hasNightvision = !!parsedAbilities.senses?.nightvision?.active;

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
    this.combatants.forEach((fighter) => {
      const d20 = CryptoSecureDice.rollD20();
      const handToHandBonus = fighter.handToHand?.initiativeBonus || 0;
      const ppBonus = Math.floor(
        ((fighter.attributes?.PP || fighter.PP || 10) - 10) / 2
      );
      const totalBonus = handToHandBonus + ppBonus;
      fighter.initiative = d20 + totalBonus;

      this.logCallback(
        `${fighter.name} initiative: ${fighter.initiative} (d20:${d20}${
          totalBonus > 0 ? ` + ${totalBonus}` : ""
        })`,
        "initiative"
      );
    });

    // Resolve ties
    this.resolveInitiativeTies();
  }

  /**
   * Resolve initiative ties (Palladium rules: reroll tied fighters)
   */
  resolveInitiativeTies() {
    const initiativeGroups = {};

    this.combatants.forEach((fighter) => {
      if (!initiativeGroups[fighter.initiative]) {
        initiativeGroups[fighter.initiative] = [];
      }
      initiativeGroups[fighter.initiative].push(fighter);
    });

    Object.keys(initiativeGroups).forEach((initValue) => {
      const tiedFighters = initiativeGroups[initValue];
      if (tiedFighters.length > 1) {
        this.logCallback(
          `🔄 Initiative tie at ${initValue}! Rerolling for: ${tiedFighters
            .map((f) => f.name)
            .join(", ")}`,
          "info"
        );

        tiedFighters.forEach((fighter) => {
          const tieBreaker = CryptoSecureDice.rollD20();
          fighter.initiative += tieBreaker;
          this.logCallback(
            `${fighter.name} rerolls: ${tieBreaker} → new total: ${fighter.initiative}`,
            "info"
          );
        });
      }
    });

    // Re-sort after tie resolution
    this.combatants.sort((a, b) => b.initiative - a.initiative);
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
        strike: 0,
        parry: 0,
        dodge: 0,
        ps: 0,
        speed: 1.0,
      },
      status: "ready",
    };
  }

  /**
   * Execute one melee round (alternating actions until all fighters out of actions)
   * @param {Function} actionSelector - Function that selects action for each fighter (fighter, availableTargets) => action
   * @returns {Object} Round result with stats
   */
  executeMeleeRound(actionSelector) {
    if (!this.isActive) {
      this.logCallback("⚠️ Combat is not active", "error");
      return null;
    }

    this.logCallback(`\n⏰ Melee Round ${this.meleeRound} begins`, "combat");

    // Process courage auras at start of each melee round
    // This applies bonuses and dispels fear before any actions
    const positions = this.combatants.reduce((acc, c) => {
      if (c.position || c.id) {
        acc[c.id] = c.position || { x: 0, y: 0 };
      }
      return acc;
    }, {});
    processCourageAuras(this.combatants, positions, this.logCallback);

    // Process protection circles (wards and circles of protection)
    // These also provide courage bonuses and repel evil creatures
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
      dodges: 0,
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
        if (fighter.remainingAttacks <= 0) {
          continue;
        }

        // Get available targets
        const targets = this.getAvailableTargets(fighter);
        if (targets.length === 0) {
          this.logCallback(
            `${fighter.name} has no targets and defends`,
            "info"
          );
          fighter.remainingAttacks = Math.max(0, fighter.remainingAttacks - 1);
          roundStats.actions++;
          continue;
        }

        // Select action (via callback hook)
        const action = actionSelector(fighter, targets, this.combatants);

        if (!action) {
          this.logCallback(`${fighter.name} takes no action`, "info");
          fighter.remainingAttacks = Math.max(0, fighter.remainingAttacks - 1);
          roundStats.actions++;
          continue;
        }

        // Execute action
        this.executeAction(fighter, action, roundStats);

        // Apply stamina drain
        this.applyStaminaDrain(fighter, action.type);

        // Decrement actions
        fighter.remainingAttacks = Math.max(0, fighter.remainingAttacks - 1);
        roundStats.actions++;

        // Update combatant state
        this.onCombatantUpdate(fighter);

        // Check for combat end conditions
        if (!this.hasActiveFighters()) {
          this.logCallback(
            "⚔️ Combat ended - no active fighters remaining",
            "combat"
          );
          this.isActive = false;
          break;
        }
      }
    }

    // Log fighters who ran out of actions
    this.combatants.forEach((fighter) => {
      if (fighter.remainingAttacks <= 0 && this.canFighterAct(fighter)) {
        roundStats.fightersOutOfActions.push(fighter.name);
      }
    });

    this.logCallback(
      `⏰ Melee Round ${this.meleeRound} complete (${roundStats.actions} total actions)`,
      "combat"
    );

    // Clear temporary courage bonuses after round completes
    clearCourageBonuses(this.combatants);

    autoCastFearProtection(this.combatants, this.logCallback);

    // Allow characters to attempt recovery from fear each melee round
    attemptFearRecovery(this.combatants, this.logCallback);

    // Reset all fighters' actions for next melee round
    this.resetActionsForNewRound();
    this.meleeRound++;

    this.onMeleeRoundComplete(this.meleeRound - 1, roundStats);

    return roundStats;
  }

  /**
   * Check if any fighters have actions remaining
   * @returns {boolean}
   */
  hasActionsRemaining() {
    return this.combatants.some(
      (fighter) => this.canFighterAct(fighter) && fighter.remainingAttacks > 0
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
   * @param {Object} action - Action object {type, target, weapon?, spell?, psionic?}
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
      case "strike":
      case "attack":
        result.success = this.performStrike(
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

      case "dodge":
        result.success = this.performDodge(fighter, action.target);
        break;

      case "parry":
        result.success = this.performParry(fighter, action.target);
        break;

      case "move":
        result.success = this.performMove(fighter, action.destination);
        break;

      case "spell":
        result.success = this.performSpell(
          fighter,
          action.target,
          action.spell
        );
        break;

      case "psionic":
        result.success = this.performPsionic(
          fighter,
          action.target,
          action.psionic
        );
        break;

      case "defend":
      case "hold":
        this.logCallback(`${fighter.name} takes a defensive stance`, "info");
        result.success = true;
        break;

      default:
        this.logCallback(`⚠️ Unknown action type: ${action.type}`, "error");
        result.success = false;
    }

    return result;
  }

  /**
   * Perform a strike/attack action
   * @param {Object} attacker - Attacking fighter
   * @param {Object} defender - Defending fighter
   * @param {Object} weapon - Weapon object (optional)
   * @param {Object} roundStats - Round statistics
   * @returns {boolean} Success
   */
  performStrike(attacker, defender, weapon = null, roundStats = {}) {
    if (!this.canFighterAct(attacker) || !this.canFighterAct(defender)) {
      return false;
    }

    const statusPenalties = getStatusCombatPenalties(
      attacker,
      this.logCallback
    );

    if (statusPenalties.skipTurn) {
      this.logCallback(
        `🏃 ${attacker.name} is fleeing and cannot attack this round!`,
        "combat"
      );
      attacker.remainingAttacks = 0;
      return false;
    }

    if (statusPenalties.loseAttack && attacker.remainingAttacks > 0) {
      attacker.remainingAttacks = Math.max(0, attacker.remainingAttacks - 1);
      this.logCallback(
        `😰 ${attacker.name} hesitates in terror and loses an attack this melee.`,
        "combat"
      );
      return false;
    }

    // Get attack bonuses (use unified abilities system)
    const strikeBonus =
      getCombatBonus(attacker, "strike") ||
      attacker.bonuses?.strike ||
      attacker.handToHand?.strikeBonus ||
      0;
    const fatigueStatus = getFatigueStatus(attacker);
    const fatiguePenalty = fatigueStatus.penalties?.strike || 0;

    const statusStrikePenalty = statusPenalties.strike || 0;

    // Get limb-specific penalties (from hit location system)
    // Include both temporary and permanent penalties
    const limbStrikePenalty =
      (attacker.bonuses?.tempPenalties?.strike || 0) +
      (attacker.bonuses?.permanentPenalties?.strike || 0);

    // Roll attack (apply fatigue, status, and limb penalties)
    const attackRoll =
      CryptoSecureDice.rollD20() +
      strikeBonus -
      fatiguePenalty -
      statusStrikePenalty +
      limbStrikePenalty; // Note: limb penalties are already negative

    this.logCallback(
      `🎲 ${attacker.name} rolls attack with status penalties applied (strike bonus ${strikeBonus}, fatigue -${fatiguePenalty}, status ${statusStrikePenalty}, limb ${limbStrikePenalty}).`,
      "combat"
    );

    // Get defender's status penalties for parry/dodge
    // Note: Limb penalties (stored in defender.bonuses.tempPenalties) will be applied
    // when defender actually performs parry/dodge actions
    const defenderStatusPenalties = getStatusPenalties(defender);

    // Check for parry/dodge reactions (defender can react)
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
      roundStats.parries += defenseResult.method === "parry" ? 1 : 0;
      roundStats.dodges += defenseResult.method === "dodge" ? 1 : 0;
      return false;
    }

    // Check if attack hits
    if (attackRoll >= defender.AR) {
      // Calculate base damage (status effects may reduce damage)
      const baseDamage = this.calculateDamage(attacker, weapon);
      const attackerStatusPenalties = getStatusPenalties(attacker);
      const rolledDamage = Math.max(
        1,
        baseDamage + (attackerStatusPenalties.damage || 0)
      );

      // Check for called shot (from weapon or action options)
      const calledShotLocation = weapon?.calledShotLocation || null;

      // Resolve hit location (random or called shot)
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

      // Apply armor damage calculation (checks if armor absorbs hit)
      let damageToCharacter = finalDamage;
      if (defender.equipped && typeof calculateArmorDamage === "function") {
        try {
          const armorResult = calculateArmorDamage(
            defender,
            attackRoll,
            finalDamage,
            hit.slot
          );

          if (armorResult.armorHit) {
            // Armor absorbed the hit
            damageToCharacter = 0;
            this.logCallback(
              `${attacker.name} hits ${defender.name}'s ${hit.location}, but armor absorbs the blow! (Armor: ${armorResult.damageToArmor} SDC damage)`,
              "combat"
            );

            // Log broken armor
            if (armorResult.brokenArmor.length > 0) {
              armorResult.brokenArmor.forEach((broken) => {
                this.logCallback(
                  `💢 ${defender.name}'s ${broken.name} is destroyed!`,
                  "combat"
                );
              });
            }
          } else {
            // Armor didn't block, damage goes to character
            damageToCharacter = armorResult.damageToCharacter || finalDamage;
          }
        } catch (error) {
          // Armor system not available, proceed with normal damage
          console.warn("Armor damage calculation failed:", error);
        }
      }

      // Apply damage to character HP
      if (damageToCharacter > 0) {
        defender.currentHP -= damageToCharacter;
        roundStats.damageDealt += damageToCharacter;
      }
      roundStats.attacks++;

      // Log hit with location information
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

      // Log head trauma if triggered
      if (traumaTriggered) {
        this.logCallback(
          `⚠️ Head trauma check triggered for ${defender.name}!`,
          "combat"
        );
      }

      // Log limb-specific effects
      if (effects && effects.length > 0) {
        effects.forEach((effect) => {
          this.logCallback(`⚠️ ${defender.name}: ${effect}`, "status");
        });
      }

      // Check for critical hit (natural 18-20)
      const attackD20 = attackRoll - strikeBonus + fatiguePenalty;
      if (attackD20 >= 18) {
        this.logCallback(`💥 Critical hit!`, "combat");
        // Could add critical hit effects here
      }

      // Check if defender is defeated
      if (defender.currentHP <= -21) {
        defender.alive = false;
        this.logCallback(`💀 ${defender.name} has been slain!`, "combat");
      } else if (defender.currentHP <= 0) {
        this.logCallback(`😵 ${defender.name} is unconscious!`, "combat");
      }

      return true;
    } else {
      this.logCallback(
        `${attacker.name} attacks ${defender.name} but misses (rolled ${attackRoll} vs AR ${defender.AR})`,
        "combat"
      );
      return false;
    }
  }

  /**
   * Check if defender can react with dodge/parry
   * @param {Object} defender - Defending fighter
   * @param {Object} attacker - Attacking fighter
   * @param {number} attackRoll - Attack roll value
   * @param {Object} statusPenalties - Status effect penalties for defender
   * @returns {Object} Defense result {defended: boolean, method: 'parry'|'dodge'|null}
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

    if (weapon && weapon.damage) {
      // Parse damage dice (e.g., "1d8", "2d6+3")
      baseDamage = this.rollDamageDice(weapon.damage);
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

    const result = attemptGrapple(attacker, defender, () =>
      CryptoSecureDice.rollD20()
    );

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
   * Perform dodge action
   * @param {Object} fighter - Dodging fighter
   * @param {Object} attacker - Attacking fighter (optional)
   * @returns {boolean} Success
   */
  // eslint-disable-next-line no-unused-vars
  performDodge(fighter, _attacker = null) {
    this.logCallback(
      `${fighter.name} prepares to dodge incoming attacks`,
      "info"
    );
    // Dodge is a defensive stance - actual dodge roll happens during defense reactions
    return true;
  }

  /**
   * Perform parry action
   * @param {Object} fighter - Parrying fighter
   * @param {Object} attacker - Attacking fighter (optional)
   * @returns {boolean} Success
   */
  // eslint-disable-next-line no-unused-vars
  performParry(fighter, _attacker = null) {
    this.logCallback(
      `${fighter.name} takes a defensive stance, preparing to parry`,
      "info"
    );
    // Parry is a defensive stance - actual parry roll happens during defense reactions
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
        this.logCallback(`🚫 ${blockCheck.reason}`, "holy");
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
   * Perform spell cast (hook for spell system)
   * @param {Object} caster - Casting fighter
   * @param {Object} target - Target fighter
   * @param {Object} spell - Spell object
   * @returns {boolean} Success
   */
  performSpell(caster, target, spell) {
    // Check if this is a protection circle/ward spell
    if (spell && spell.name && isProtectionCircle(spell.name)) {
      const casterPos = caster.position || { x: 0, y: 0 };
      const circle = createProtectionCircle(caster, spell.name, casterPos);
      this.activeCircles.push(circle);
      this.logCallback(`🕯️ ${caster.name} draws ${spell.name}!`, "holy");
      this.logCallback(
        `✨ The circle glows with divine light (radius ${circle.radius} ft, +${circle.bonus} vs Horror).`,
        "holy"
      );
      return true;
    }

    if (spell?.name) {
      const spellName = spell.name.toLowerCase();
      if (spellName === "courage") {
        return castCourage(caster, this.combatants, this.logCallback);
      }
      if (spellName === "remove fear") {
        if (!target) {
          this.logCallback(
            `${caster.name} needs a target within reach to cast Remove Fear!`,
            "spell"
          );
          return false;
        }
        return castRemoveFear(caster, target, this.logCallback);
      }
    }

    // Hook for spell system integration
    this.logCallback(`${caster.name} casts ${spell.name || "spell"}`, "combat");
    // TODO: Integrate with spell system
    return true;
  }

  /**
   * Perform psionic power (hook for psionic system)
   * @param {Object} user - Using fighter
   * @param {Object} target - Target fighter
   * @param {Object} psionic - Psionic power object
   * @returns {boolean} Success
   */
  performPsionic(user, target, psionic) {
    // Hook for psionic system integration
    this.logCallback(
      `${user.name} uses ${psionic.name || "psionic power"}`,
      "combat"
    );
    // TODO: Integrate with psionic system
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
        `💪 ${fighter.name} fatigue: ${
          fatigueStatus.status
        } (Stamina: ${fatigueStatus.currentStamina.toFixed(1)}/${
          fatigueStatus.maxStamina
        })`,
        "info"
      );
    }
  }

  /**
   * Reset all fighters' actions for new melee round
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
          `😵 ${fighter.name} is stunned and loses their next action!`,
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
        fighter.remainingAttacks = fighter.attacksPerMelee || 2;
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
        remainingAttacks: f.remainingAttacks,
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
    this.logCallback("⚔️ Combat ended", "combat");

    if (Array.isArray(this.combatants)) {
      this.combatants.forEach((fighter) => {
        if (!fighter || typeof fighter !== "object") return;
        fighter.remainingAttacks = fighter.attacksPerMelee ?? fighter.actions ?? 0;
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

  // Simple AI: randomly choose strike or grapple
  const actionType = Math.random() < 0.9 ? "strike" : "grapple";
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
      type: baseAction.type || "strike",
      target: baseAction.target || targets[0],
      weapon: fighter.equippedWeapon || null,
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
 * Works with bestiary.json structure and existing fatigue/grapple systems
 *
 * Usage examples:
 *   - combatRound(["human_knight", "troll"]) // Auto-loads from bestiary
 *   - combatRound([loadCreature("minotaur"), loadCreature("scarecrow")]) // Pre-loaded
 *   - validateBestiary() // Run on game start to check data integrity
 *
 * @param {Array} combatants - Array of fighter objects or string IDs (will be auto-loaded)
 * @param {Object} bestiaryData - Optional bestiary data (deprecated, use loadCreatures instead)
 * @returns {Promise<Object>} Round statistics
 */
// eslint-disable-next-line no-unused-vars
export async function combatRound(combatants, bestiaryData = null) {
  // Normalize combatants - convert string IDs to full objects using bestiaryLoader
  const normalizedCombatants = combatants.map((c) => {
    if (typeof c === "string") {
      // Use bestiaryLoader to load creature by ID or name
      try {
        const loaded = loadCreature(c);
        // Ensure compatibility with combat engine expectations
        return {
          ...loaded,
          maxHP: loaded.HP,
          hp: loaded.currentHP,
          armorRating: loaded.AR,
          attacksPerMelee: loaded.actions || 3,
          remainingAttacks: loaded.actions || 3,
          weaponDamage: loaded.attacks?.[0]?.damage || "1d8",
          PE: loaded.attributes?.PE || 10,
          PS: loaded.attributes?.PS || 10,
          PP: loaded.attributes?.PP || 10,
          fatigueState: loaded.fatigueState || initializeCombatFatigue(loaded),
          grappleState: loaded.grappleState || initializeGrappleState(loaded),
          initiative: rollD20() + (loaded.bonuses?.initiative || 0),
        };
      } catch (e) {
        console.warn(`Could not load creature "${c}":`, e.message);
        // Fallback to basic fighter
        return {
          id: c,
          name: c,
          alive: true,
          hp: 20,
          currentHP: 20,
          maxHP: 20,
          actions: 2,
          remainingAttacks: 2,
          AR: 10,
          armorRating: 10,
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
      actions: c.actions ?? c.remainingAttacks ?? c.attacksPerMelee ?? 2,
      remainingAttacks:
        c.remainingAttacks ?? c.actions ?? c.attacksPerMelee ?? 2,
      initiative: c.initiative ?? rollD20(),
      PE: c.PE ?? c.attributes?.PE ?? 10,
      PS: c.PS ?? c.attributes?.PS ?? 10,
      PP: c.PP ?? c.attributes?.PP ?? 10,
      bonuses: c.bonuses || {},
      AR: c.AR ?? c.armorRating ?? 10,
      armorRating: c.AR ?? c.armorRating ?? 10,
      weaponDamage: c.weaponDamage || c.attacks?.[0]?.damage || "1d8",
      fatigueState: c.fatigueState || initializeCombatFatigue(c),
      grappleState: c.grappleState || initializeGrappleState(c),
      state: c.state || "neutral",
    };
  });

  // Sort by initiative (highest first)
  normalizedCombatants.sort((a, b) => b.initiative - a.initiative);

  console.log("\n=== ⚔️ Combat Round Begins ===");
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
    dodges: 0,
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

      // Randomly decide to grapple or strike (25% chance grapple)
      const useGrapple = Math.random() < 0.25;

      if (useGrapple) {
        const result = attemptGrapple(actor, target, rollD20);
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

  console.log("=== 🏁 Combat Round Ends ===\n");
  return roundStats;
}

/**
 * Resolve a single attack (strike)
 * @param {Object} attacker - Attacking fighter
 * @param {Object} defender - Defending fighter
 * @param {boolean} useRandomHitLocations - Whether to use random hit locations (default: true)
 * @returns {string} Result message
 */
function resolveAttack(attacker, defender, useRandomHitLocations = true) {
  if (!attacker.alive || !defender.alive) return "";

  const strikeBonus = attacker.bonuses?.strike || 0;
  const fatiguePenalty = attacker.fatigueState?.penalties?.strike || 0;
  const attackRoll = rollD20() + strikeBonus - fatiguePenalty;

  const parryRoll = rollD20() + (defender.bonuses?.parry || 0);

  if (attackRoll >= defender.armorRating && attackRoll > parryRoll) {
    // Calculate base damage
    let baseDmg =
      rollDice(attacker.weaponDamage || "1d8") +
      Math.floor((attacker.PS || 10) / 5);

    // Check damage resistance/immunity
    const weaponIsMagic = attacker.weaponIsMagic || false; // Could be enhanced later
    const damageType = weaponIsMagic ? "magic" : "normal";
    const resistance = checkDamageResistance(
      defender,
      damageType,
      weaponIsMagic
    );

    if (resistance.ignored) {
      return `${attacker.name} attacks ${defender.name} but ${resistance.reason}!`;
    }

    // Apply resistance multiplier
    baseDmg = Math.floor(baseDmg * resistance.multiplier);

    if (baseDmg <= 0) {
      return `${attacker.name} attacks ${defender.name} but ${resistance.reason}!`;
    }

    // Resolve hit location
    const { finalDamage, hit, effects } = resolveHitLocation(
      attacker,
      defender,
      baseDmg,
      useRandomHitLocations,
      {}
    );

    // Apply armor damage calculation if available
    let damageToCharacter = finalDamage;
    if (defender.equipped && typeof calculateArmorDamage === "function") {
      try {
        const armorResult = calculateArmorDamage(
          defender,
          attackRoll,
          finalDamage,
          hit.slot
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

    // Build result message with effects
    let resultMessage = `${attacker.name} hits ${defender.name}'s ${hit.location} for ${damageToCharacter} damage`;
    const resistanceNote =
      resistance.multiplier !== 1 ? ` (${resistance.reason})` : "";
    resultMessage += resistanceNote;

    // Add effects to message
    if (effects && effects.length > 0) {
      resultMessage += ` — ${effects.join(", ")}`;
    }

    if (defender.currentHP <= 0) {
      defender.currentHP = 0;
      defender.hp = 0;
      defender.alive = false;
      return `💀 ${resultMessage} — ${defender.name} is slain!`;
    }

    resultMessage += `! (HP: ${defender.currentHP})`;
    return resultMessage;
  } else {
    return `${attacker.name} attacks ${defender.name} but misses or is parried.`;
  }
}

/**
 * Refresh all combatants for next melee round
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
  // Check if character has attacksPerMelee already set
  if (c.attacksPerMelee) return c.attacksPerMelee;

  // Simple lookup based on name/type
  const name = (c.name || "").toLowerCase();
  if (name.includes("troll")) return 6;
  if (name.includes("knight")) return 4;
  if (name.includes("ogre")) return 5;

  // Default
  return c.actions || 3;
}

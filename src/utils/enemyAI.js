/**
 * Enemy AI Decision Engine
 * Handles strategic decision making for enemy combatants
 * Includes official Palladium sprint and movement mechanics
 */

import {
  updateSprintFatigue,
  restAndRecover,
  canSprint,
  getFatigueStatus,
  getSprintDistanceFeet,
} from "./fatigueSystem.js";
import {
  evaluateWeaponBonuses,
  rankWeaponsByBonuses,
  analyzeClosingDistance,
  getOptimalWeaponRecommendation,
  makeWeaponBonusAIDecision,
} from "./weaponBonusAI.js";

// AI Personality types
export const AI_PERSONALITIES = {
  AGGRESSIVE: {
    name: "Aggressive",
    weights: {
      aggression: 1.0,
      caution: 0.3,
      positioning: 0.6,
      resourceManagement: 0.4,
    },
    preferredActions: ["STRIKE", "MOVE", "COMBAT_MANEUVERS"],
    avoidActions: ["DEFEND_HOLD", "WITHDRAW"],
  },
  DEFENSIVE: {
    name: "Defensive",
    weights: {
      aggression: 0.4,
      caution: 1.0,
      positioning: 0.8,
      resourceManagement: 0.7,
    },
    preferredActions: ["PARRY", "DODGE", "DEFEND_HOLD"],
    avoidActions: ["STRIKE", "COMBAT_MANEUVERS"],
  },
  TACTICAL: {
    name: "Tactical",
    weights: {
      aggression: 0.7,
      caution: 0.7,
      positioning: 1.0,
      resourceManagement: 0.8,
    },
    preferredActions: ["MOVE", "AIM_CALLED_SHOT", "COMBAT_MANEUVERS"],
    avoidActions: [],
  },
  BERSERKER: {
    name: "Berserker",
    weights: {
      aggression: 1.2,
      caution: 0.1,
      positioning: 0.3,
      resourceManagement: 0.2,
    },
    preferredActions: ["STRIKE", "COMBAT_MANEUVERS"],
    avoidActions: ["DEFEND_HOLD", "WITHDRAW", "USE_ITEM"],
  },
};

// Available combat actions
export const COMBAT_ACTIONS = {
  STRIKE: {
    name: "Strike",
    cost: 1,
    type: "offensive",
    requiresTarget: true,
    baseScore: 3.0,
  },
  PARRY: {
    name: "Parry",
    cost: 1,
    type: "defensive",
    requiresTarget: false,
    baseScore: 1.5,
  },
  DODGE: {
    name: "Dodge",
    cost: 1,
    type: "defensive",
    requiresTarget: false,
    baseScore: 1.8,
  },
  MOVE: {
    name: "Move",
    cost: 1,
    type: "utility",
    requiresTarget: false,
    baseScore: 1.0,
  },
  AIM_CALLED_SHOT: {
    name: "Aim/Called Shot",
    cost: 1,
    type: "offensive",
    requiresTarget: true,
    baseScore: 2.5,
  },
  DEFEND_HOLD: {
    name: "Defend/Hold",
    cost: 1,
    type: "defensive",
    requiresTarget: false,
    baseScore: 1.2,
  },
  WITHDRAW: {
    name: "Withdraw",
    cost: 1,
    type: "utility",
    requiresTarget: false,
    baseScore: 1.5,
  },
  COMBAT_MANEUVERS: {
    name: "Combat Maneuvers",
    cost: 1,
    type: "offensive",
    requiresTarget: true,
    baseScore: 2.2,
  },
  USE_ITEM: {
    name: "Use Item",
    cost: 1,
    type: "utility",
    requiresTarget: false,
    baseScore: 2.0,
  },
  SPRINT_TO_TARGET: {
    name: "Sprint to Target",
    cost: 1,
    type: "movement",
    requiresTarget: true,
    baseScore: 2.5,
    requiresSprint: true,
  },
  SPRINT_TO_RETREAT: {
    name: "Sprint to Retreat",
    cost: 1,
    type: "movement",
    requiresTarget: false,
    baseScore: 1.8,
    requiresSprint: true,
  },
  REST_RECOVER: {
    name: "Rest/Recover",
    cost: 1,
    type: "recovery",
    requiresTarget: false,
    baseScore: 1.0,
  },
};

/**
 * AI Decision Engine Class
 */
export class EnemyAI {
  constructor(personality = AI_PERSONALITIES.TACTICAL, difficulty = "normal") {
    this.personality = personality;
    this.difficulty = difficulty;
    this.difficultyMultipliers = {
      easy: 0.8,
      normal: 1.0,
      hard: 1.2,
      nightmare: 1.5,
    };
  }

  /**
   * Choose the best action for an enemy
   * @param {Object} enemy - The enemy character
   * @param {Array} targets - Available targets
   * @param {Object} combatState - Current combat state
   * @returns {Object} Action plan
   */
  chooseAction(enemy, targets, combatState) {
    if (!targets || targets.length === 0) {
      return this.getDefaultAction(enemy);
    }

    // Check sprint/movement decision first (highest priority)
    const sprintDecision = this.decideSprint(enemy, targets, combatState);
    if (sprintDecision) {
      return sprintDecision;
    }

    // Get optimal weapon recommendation (prefers weapons with bonuses)
    const primaryTarget = targets[0];
    const weaponRecommendation = this.getOptimalWeaponForTarget(enemy, primaryTarget, combatState);
    
    // If recommendation suggests closing distance and it's beneficial, prioritize it
    if (weaponRecommendation.action === "close_distance" && weaponRecommendation.score > 1.0) {
      return {
        action: COMBAT_ACTIONS.MOVE,
        target: primaryTarget,
        score: weaponRecommendation.score * 1.5, // Boost score for closing
        reasoning: weaponRecommendation.reasoning,
        isStrategic: true,
        weaponRecommendation: weaponRecommendation,
      };
    }

    // Select best weapon if recommendation is better than current
    if (weaponRecommendation.weapon && weaponRecommendation.score > 0) {
      // Update enemy's weapon preference (could be used to switch weapons)
      enemy._preferredWeapon = weaponRecommendation.weapon;
    }

    const availableActions = this.getAvailableActions(enemy, combatState);
    const scoredActions = this.scoreActions(
      availableActions,
      enemy,
      targets,
      combatState
    );

    // Sort by score (highest first)
    scoredActions.sort((a, b) => b.score - a.score);

    const bestAction = scoredActions[0];

    // Enhance reasoning with weapon bonus info if available
    let enhancedReasoning = bestAction.reasoning;
    if (weaponRecommendation.evaluation && weaponRecommendation.evaluation.bonuses.length > 0) {
      enhancedReasoning += ` | Weapon bonuses: ${weaponRecommendation.evaluation.bonuses.join(', ')}`;
    }

    return {
      action: bestAction.action,
      target: bestAction.target,
      score: bestAction.score,
      reasoning: enhancedReasoning,
      isStrategic: bestAction.score > 2.0,
      weaponRecommendation: weaponRecommendation,
    };
  }

  /**
   * Get optimal weapon for target based on bonuses
   */
  getOptimalWeaponForTarget(enemy, target, combatState) {
    try {
      // Get available weapons
      const availableWeapons = [];
      if (enemy.equippedWeapons && enemy.equippedWeapons.length > 0) {
        enemy.equippedWeapons.forEach(w => {
          if (w && w.name && w.name !== "Unarmed") {
            availableWeapons.push(w);
          }
        });
      }
      if (enemy.inventory) {
        enemy.inventory.forEach(item => {
          if (item.type && (item.type.toLowerCase() === 'weapon' || item.damage)) {
            if (!availableWeapons.find(w => w.name === item.name)) {
              availableWeapons.push(item);
            }
          }
        });
      }

      if (availableWeapons.length === 0) {
        return {
          weapon: null,
          action: "attack",
          score: 0,
          reasoning: "No weapons available",
        };
      }

      // Enhanced combat state
      const enhancedCombatState = {
        ...combatState,
        terrain: combatState.terrain || "open",
        terrainWidth: combatState.terrainWidth || 10,
        terrainHeight: combatState.terrainHeight || 10,
        terrainDensity: combatState.terrainDensity || 0,
        hasObstructions: combatState.hasObstructions || false,
        isFirstMeleeRound: combatState.round === 1,
        combatDistance: combatState.combatDistance || this.calculateDistance(enemy, target) || 5,
        hasClosedDistance: combatState.hasClosedDistance || false,
      };

      return getOptimalWeaponRecommendation(availableWeapons, enemy, target, enhancedCombatState);
    } catch (error) {
      console.warn("Failed to get optimal weapon:", error);
      return {
        weapon: null,
        action: "attack",
        score: 0,
        reasoning: "Error evaluating weapons",
      };
    }
  }

  /**
   * Decide whether to sprint (OFFICIAL PALLADIUM MECHANICS)
   * Based on tactical situation, distance, morale, and fatigue
   */
  decideSprint(enemy, targets, combatState) {
    // Check if collapsed from fatigue - must rest
    const fatigueStatus = getFatigueStatus(enemy);
    if (fatigueStatus.status === "collapsed") {
      return {
        action: COMBAT_ACTIONS.REST_RECOVER,
        target: null,
        score: 5.0,
        reasoning: "Collapsed from exhaustion, must rest",
        isStrategic: true,
      };
    }

    // Check if heavily fatigued (level 3+) - consider resting
    if (enemy.fatigueState && enemy.fatigueState.fatigueLevel >= 3) {
      return {
        action: COMBAT_ACTIONS.REST_RECOVER,
        target: null,
        score: 4.0,
        reasoning: "Heavily fatigued, resting to recover",
        isStrategic: true,
      };
    }

    // Check if can't sprint
    if (!canSprint(enemy)) {
      return null;
    }

    const closestTarget = this.getClosestTarget(enemy, targets);
    if (!closestTarget) return null;

    const distance = this.calculateDistance(enemy, closestTarget);
    const sprintDistance = getSprintDistanceFeet(
      enemy.Spd ||
        enemy.spd ||
        enemy.attributes?.Spd ||
        enemy.attributes?.spd ||
        10
    );
    const meleeRange = 5; // 5 feet = 1 cell
    const closeRange = 30;

    const healthRatio = enemy.currentHP / enemy.maxHP;

    // MORALE CHECK: Retreat if low HP and not fearless
    if (healthRatio < 0.3 && !enemy.isFearless && !enemy.morale?.fearless) {
      // Sprint to retreat
      return {
        action: COMBAT_ACTIONS.SPRINT_TO_RETREAT,
        target: null,
        score: 4.5,
        reasoning: `Low HP (${Math.round(
          healthRatio * 100
        )}%), retreating to survive`,
        isStrategic: true,
      };
    }

    // TACTICAL SPRINT: Close distance to melee if:
    // 1. Target is out of melee range
    // 2. Can reach in one sprint
    // 3. Enemy is melee-focused or ranged attacker is dangerous
    if (distance > meleeRange && distance <= sprintDistance) {
      const isMeleeOnly = !enemy.hasRangedAttack && !enemy.magic;
      const isUnderRangedFire = combatState?.underRangedFire;

      if (isMeleeOnly || (isUnderRangedFire && healthRatio > 0.5)) {
        return {
          action: COMBAT_ACTIONS.SPRINT_TO_TARGET,
          target: closestTarget,
          score: 3.8,
          reasoning: `Closing ${Math.round(distance)}ft gap to engage in melee`,
          isStrategic: true,
        };
      }
    }

    // FLANKING MANEUVER: Sprint to better position if intelligent
    if (enemy.IQ >= 10 && distance > closeRange && distance <= sprintDistance) {
      const hasAlliesEngaged = combatState?.alliesInMelee;
      if (hasAlliesEngaged && healthRatio > 0.6) {
        return {
          action: COMBAT_ACTIONS.SPRINT_TO_TARGET,
          target: closestTarget,
          score: 3.2,
          reasoning: "Flanking maneuver to support allies",
          isStrategic: true,
        };
      }
    }

    // PURSUIT: Chase fleeing target if faster
    if (closestTarget.isFleeing) {
      const targetSpeed = closestTarget.spd || closestTarget.Spd || 10;
      const enemySpeed =
        enemy.Spd ||
        enemy.spd ||
        enemy.attributes?.Spd ||
        enemy.attributes?.spd ||
        10;

      if (enemySpeed >= targetSpeed) {
        return {
          action: COMBAT_ACTIONS.SPRINT_TO_TARGET,
          target: closestTarget,
          score: 3.5,
          reasoning: "Pursuing fleeing target",
          isStrategic: true,
        };
      }
    }

    // BODYGUARD: Sprint to intercept if protecting someone
    if (enemy.role === "bodyguard" && combatState?.protectedAlly) {
      const allyDistance = this.calculateDistance(
        enemy,
        combatState.protectedAlly
      );
      if (
        allyDistance <= sprintDistance &&
        combatState.protectedAlly.isThreaten
      ) {
        return {
          action: COMBAT_ACTIONS.SPRINT_TO_TARGET,
          target: closestTarget,
          score: 4.0,
          reasoning: "Protecting ally from threat",
          isStrategic: true,
        };
      }
    }

    // No sprint needed
    return null;
  }

  /**
   * Get available actions for the enemy
   */
  getAvailableActions(enemy, combatState) {
    const actions = [];

    // Basic actions available to all
    actions.push(COMBAT_ACTIONS.STRIKE);
    actions.push(COMBAT_ACTIONS.PARRY);
    actions.push(COMBAT_ACTIONS.DODGE);
    actions.push(COMBAT_ACTIONS.MOVE);
    actions.push(COMBAT_ACTIONS.DEFEND_HOLD);

    // Advanced actions based on enemy capabilities
    if (enemy.skills?.includes("Combat Maneuvers")) {
      actions.push(COMBAT_ACTIONS.COMBAT_MANEUVERS);
    }

    if (enemy.inventory && enemy.inventory.length > 0) {
      actions.push(COMBAT_ACTIONS.USE_ITEM);
    }

    if (enemy.weaponRange && enemy.weaponRange > 1) {
      actions.push(COMBAT_ACTIONS.AIM_CALLED_SHOT);
    }

    return actions;
  }

  /**
   * Score all available actions
   */
  scoreActions(actions, enemy, targets, combatState) {
    return actions.map((action) => {
      const scores = [];
      let bestTarget = null;
      let bestScore = -Infinity;
      let reasoning = "";

      // Score action against each potential target
      for (const target of targets) {
        const score = this.scoreActionAgainstTarget(
          action,
          enemy,
          target,
          combatState
        );
        scores.push(score);

        if (score > bestScore) {
          bestScore = score;
          bestTarget = target;
          reasoning = this.generateReasoning(action, enemy, target, score);
        }
      }

      // If no target required, score the action itself
      if (!action.requiresTarget) {
        bestScore = this.scoreActionAgainstTarget(
          action,
          enemy,
          null,
          combatState
        );
        reasoning = this.generateReasoning(action, enemy, null, bestScore);
      }

      return {
        action,
        target: bestTarget,
        score: bestScore,
        reasoning,
      };
    });
  }

  /**
   * Score a specific action against a target
   */
  scoreActionAgainstTarget(action, enemy, target, combatState) {
    let score = action.baseScore;

    // Apply personality weights
    switch (action.type) {
      case "offensive":
        score *= this.personality.weights.aggression;
        break;
      case "defensive":
        score *= this.personality.weights.caution;
        break;
      case "utility":
        score *=
          (this.personality.weights.positioning +
            this.personality.weights.resourceManagement) /
          2;
        break;
    }

    // Target-based scoring
    if (target) {
      score += this.evaluateTarget(enemy, target, combatState);
    }

    // Weapon bonus evaluation for strike/attack actions
    if (action.type === "offensive" && target) {
      const weaponBonusScore = this.evaluateWeaponBonusesForAction(enemy, target, combatState, action);
      score += weaponBonusScore;
    }

    // Health-based adjustments
    const healthRatio = enemy.currentHP / enemy.maxHP;
    if (healthRatio < 0.3) {
      // Low health - prefer defensive actions
      if (action.type === "defensive") score *= 1.5;
      else if (action.type === "offensive") score *= 0.7;
    } else if (healthRatio > 0.8) {
      // High health - more aggressive
      if (action.type === "offensive") score *= 1.2;
    }

    // Enemy type specific bonuses
    if (this.personality.preferredActions.includes(action.name)) {
      score *= 1.3;
    }
    if (this.personality.avoidActions.includes(action.name)) {
      score *= 0.5;
    }

    // Difficulty multiplier
    score *= this.difficultyMultipliers[this.difficulty] || 1.0;

    return score;
  }

  /**
   * Evaluate weapon bonuses for an action
   * Prefers weapons with bonuses and closing distance for close-range bonuses
   */
  evaluateWeaponBonusesForAction(enemy, target, combatState, action) {
    let bonusScore = 0;

    try {
      // Get available weapons
      const availableWeapons = [];
      if (enemy.equippedWeapons && enemy.equippedWeapons.length > 0) {
        enemy.equippedWeapons.forEach(w => {
          if (w && w.name && w.name !== "Unarmed") {
            availableWeapons.push(w);
          }
        });
      }
      if (enemy.inventory) {
        enemy.inventory.forEach(item => {
          if (item.type && (item.type.toLowerCase() === 'weapon' || item.damage)) {
            if (!availableWeapons.find(w => w.name === item.name)) {
              availableWeapons.push(item);
            }
          }
        });
      }

      if (availableWeapons.length === 0) {
        return 0; // No weapons to evaluate
      }

      // Get current weapon
      const currentWeapon = enemy.equippedWeapons?.[0] || enemy.equippedWeapon || availableWeapons[0];
      const defenderWeapon = target.equippedWeapons?.[0] || target.equippedWeapon || null;

      // Enhanced combat state with distance
      const enhancedCombatState = {
        ...combatState,
        terrain: combatState.terrain || "open",
        terrainWidth: combatState.terrainWidth || 10,
        terrainHeight: combatState.terrainHeight || 10,
        terrainDensity: combatState.terrainDensity || 0,
        hasObstructions: combatState.hasObstructions || false,
        isFirstMeleeRound: combatState.round === 1,
        combatDistance: combatState.combatDistance || this.calculateDistance(enemy, target) || 5,
        hasClosedDistance: combatState.hasClosedDistance || false,
      };

      // Evaluate current weapon bonuses
      const currentEvaluation = evaluateWeaponBonuses(
        currentWeapon,
        enemy,
        target,
        defenderWeapon,
        enhancedCombatState
      );

      // If action is strike/attack, add weapon bonus score
      if (action.name === "Strike" || action.name === "Attack") {
        bonusScore += currentEvaluation.score * 0.5; // Weight weapon bonuses
        
        // Prefer weapons with bonuses
        if (currentEvaluation.totalBonus > 0) {
          bonusScore += currentEvaluation.totalBonus * 0.3;
        }
      }

      // Check if closing distance would help
      if (action.name === "Move" || action.name === "Sprint to Target") {
        const closeAnalysis = analyzeClosingDistance(enemy, target, currentWeapon, enhancedCombatState);
        if (closeAnalysis.shouldClose && closeAnalysis.benefit > 0) {
          bonusScore += closeAnalysis.benefit * 0.4; // Prefer closing if it provides bonuses
        }
      }

      // Rank all weapons and prefer best one
      const rankedWeapons = rankWeaponsByBonuses(availableWeapons, enemy, target, enhancedCombatState);
      if (rankedWeapons.length > 0 && rankedWeapons[0].score > currentEvaluation.score) {
        // There's a better weapon available
        bonusScore += (rankedWeapons[0].score - currentEvaluation.score) * 0.2;
      }

    } catch (error) {
      // If weapon bonus evaluation fails, continue without it
      console.warn("Weapon bonus evaluation failed:", error);
    }

    return bonusScore;
  }

  /**
   * Evaluate target value
   */
  evaluateTarget(enemy, target, combatState) {
    let value = 0;

    // Target health (weaker targets are more appealing)
    const targetHealthRatio = target.currentHP / target.maxHP;
    value += (1 - targetHealthRatio) * 2; // 0-2 points

    // Target threat level (higher level = more threat = higher priority)
    if (target.level) {
      value += target.level * 0.1;
    }

    // Distance factor (closer is better for melee)
    if (enemy.weaponRange === 1) {
      const distance = this.calculateDistance(enemy, target);
      value += Math.max(0, 2 - distance) * 0.5;
    }

    // Target is casting a spell (interrupt opportunity)
    if (target.status?.includes("casting")) {
      value += 1.5;
    }

    // Target is already wounded
    if (target.status?.includes("wounded")) {
      value += 1.0;
    }

    return value;
  }

  /**
   * Calculate distance between two entities
   */
  calculateDistance(entity1, entity2) {
    // Grid-based 2D distance calculation
    if (
      entity1.position &&
      entity2.position &&
      typeof entity1.position.x !== "undefined"
    ) {
      const dx = entity2.position.x - entity1.position.x;
      const dy = entity2.position.y - entity1.position.y;
      return Math.sqrt(dx * dx + dy * dy) * 5; // Convert cells to feet
    }

    // Fallback: Simple 1D distance
    return Math.abs((entity1.position || 0) - (entity2.position || 0));
  }

  /**
   * Get closest target from list
   */
  getClosestTarget(enemy, targets) {
    if (!targets || targets.length === 0) return null;

    let closest = targets[0];
    let minDistance = this.calculateDistance(enemy, closest);

    for (const target of targets) {
      const distance = this.calculateDistance(enemy, target);
      if (distance < minDistance) {
        minDistance = distance;
        closest = target;
      }
    }

    return closest;
  }

  /**
   * Generate reasoning for the decision
   */
  generateReasoning(action, enemy, target, score) {
    const parts = [];

    parts.push(`${this.personality.name} personality`);

    if (target) {
      const healthPercent = Math.round((target.currentHP / target.maxHP) * 100);
      parts.push(`target at ${healthPercent}% health`);
    }

    if (action.type === "offensive") {
      parts.push("offensive strategy");
    } else if (action.type === "defensive") {
      parts.push("defensive strategy");
    }

    if (score > 3.0) {
      parts.push("high value target");
    }

    return parts.join(", ");
  }

  /**
   * Get default action when no targets available
   */
  getDefaultAction(enemy) {
    return {
      action: COMBAT_ACTIONS.DEFEND_HOLD,
      target: null,
      score: 1.0,
      reasoning: "No targets available, defending",
      isStrategic: false,
    };
  }

  /**
   * Execute the chosen action
   */
  executeAction(actionPlan, enemy, combatState) {
    const { action, target } = actionPlan;

    switch (action.name) {
      case "Strike":
        return this.executeStrike(enemy, target);
      case "Parry":
        return this.executeParry(enemy);
      case "Dodge":
        return this.executeDodge(enemy);
      case "Move":
        return this.executeMove(enemy, target);
      case "Defend/Hold":
        return this.executeDefend(enemy);
      case "Combat Maneuvers":
        return this.executeManeuver(enemy, target);
      case "Use Item":
        return this.executeUseItem(enemy);
      case "Sprint to Target":
        return this.executeSprint(enemy, target);
      case "Sprint to Retreat":
        return this.executeSprintRetreat(enemy);
      case "Rest/Recover":
        return this.executeRest(enemy);
      default:
        return this.executeStrike(enemy, target);
    }
  }

  /**
   * Action execution methods
   */
  executeStrike(enemy, target) {
    if (!target) return { success: false, message: "No target for strike" };

    const weapon = enemy.equippedWeapon || "Unarmed";
    const damage = this.rollDamage(enemy, weapon);

    return {
      success: true,
      action: "strike",
      target: target,
      damage: damage,
      message: `${enemy.name} strikes at ${target.name} with ${weapon} for ${damage} damage`,
    };
  }

  executeParry(enemy) {
    return {
      success: true,
      action: "parry",
      message: `${enemy.name} prepares to parry incoming attacks`,
    };
  }

  executeDodge(enemy) {
    return {
      success: true,
      action: "dodge",
      message: `${enemy.name} prepares to dodge incoming attacks`,
    };
  }

  executeMove(enemy, target) {
    return {
      success: true,
      action: "move",
      target: target,
      message: `${enemy.name} moves to better position`,
    };
  }

  executeDefend(enemy) {
    return {
      success: true,
      action: "defend",
      message: `${enemy.name} takes a defensive stance`,
    };
  }

  executeManeuver(enemy, target) {
    if (!target) return { success: false, message: "No target for maneuver" };

    const maneuvers = ["shove", "trip", "disarm"];
    const maneuver = maneuvers[Math.floor(Math.random() * maneuvers.length)];

    return {
      success: true,
      action: "maneuver",
      target: target,
      maneuver: maneuver,
      message: `${enemy.name} attempts to ${maneuver} ${target.name}`,
    };
  }

  executeUseItem(enemy) {
    // Simple item usage - could be more sophisticated
    return {
      success: true,
      action: "use_item",
      message: `${enemy.name} uses an item`,
    };
  }

  executeSprint(enemy, target) {
    if (!target) return { success: false, message: "No target for sprint" };

    // Update fatigue from sprinting
    updateSprintFatigue(enemy, 1);
    const fatigueStatus = getFatigueStatus(enemy);

    const sprintDistance = getSprintDistanceFeet(
      enemy.Spd ||
        enemy.spd ||
        enemy.attributes?.Spd ||
        enemy.attributes?.spd ||
        10
    );

    return {
      success: true,
      action: "sprint",
      target: target,
      distance: sprintDistance,
      fatigue: fatigueStatus,
      message: `${enemy.name} sprints ${sprintDistance} feet toward ${target.name} [${fatigueStatus.description}]`,
    };
  }

  executeSprintRetreat(enemy) {
    // Update fatigue from sprinting
    updateSprintFatigue(enemy, 1);
    const fatigueStatus = getFatigueStatus(enemy);

    const sprintDistance = getSprintDistanceFeet(
      enemy.Spd ||
        enemy.spd ||
        enemy.attributes?.Spd ||
        enemy.attributes?.spd ||
        10
    );

    return {
      success: true,
      action: "sprint_retreat",
      distance: sprintDistance,
      fatigue: fatigueStatus,
      message: `${enemy.name} sprints ${sprintDistance} feet away to retreat [${fatigueStatus.description}]`,
    };
  }

  executeRest(enemy) {
    // Rest and recover from fatigue
    restAndRecover(enemy, 1);
    const fatigueStatus = getFatigueStatus(enemy);

    return {
      success: true,
      action: "rest",
      fatigue: fatigueStatus,
      message: `${enemy.name} rests to recover stamina [${fatigueStatus.description}]`,
    };
  }

  /**
   * Roll damage for an attack
   */
  rollDamage(enemy, weapon) {
    // Simple damage calculation - integrate with your existing damage system
    const baseDamage = enemy.damage || "1d6";
    const diceMatch = baseDamage.match(/(\d+)d(\d+)([+-]\d+)?/);

    if (diceMatch) {
      const numDice = parseInt(diceMatch[1]);
      const diceSize = parseInt(diceMatch[2]);
      const modifier = diceMatch[3] ? parseInt(diceMatch[3]) : 0;

      let total = modifier;
      for (let i = 0; i < numDice; i++) {
        total += Math.floor(Math.random() * diceSize) + 1;
      }

      return Math.max(1, total);
    }

    return 1;
  }
}

/**
 * AI Manager - handles multiple AI instances
 */
export class AIManager {
  constructor() {
    this.aiInstances = new Map();
    this.defaultPersonality = AI_PERSONALITIES.TACTICAL;
  }

  /**
   * Get or create AI instance for an enemy
   */
  getAI(enemyId, personality = null, difficulty = "normal") {
    if (!this.aiInstances.has(enemyId)) {
      const ai = new EnemyAI(
        personality || this.defaultPersonality,
        difficulty
      );
      this.aiInstances.set(enemyId, ai);
    }
    return this.aiInstances.get(enemyId);
  }

  /**
   * Make decision for an enemy
   */
  makeDecision(
    enemyId,
    enemy,
    targets,
    combatState,
    personality = null,
    difficulty = "normal"
  ) {
    const ai = this.getAI(enemyId, personality, difficulty);
    return ai.chooseAction(enemy, targets, combatState);
  }

  /**
   * Execute action for an enemy
   */
  executeAction(enemyId, actionPlan, enemy, combatState) {
    const ai = this.aiInstances.get(enemyId);
    if (!ai) return { success: false, message: "No AI instance found" };

    return ai.executeAction(actionPlan, enemy, combatState);
  }

  /**
   * Set personality for an enemy
   */
  setPersonality(enemyId, personality) {
    const ai = this.getAI(enemyId);
    ai.personality = personality;
  }

  /**
   * Set difficulty for an enemy
   */
  setDifficulty(enemyId, difficulty) {
    const ai = this.getAI(enemyId);
    ai.difficulty = difficulty;
  }
}

// Export singleton instance
export const aiManager = new AIManager();

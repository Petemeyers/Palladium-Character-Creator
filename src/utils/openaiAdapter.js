/**
 * OpenAI Adapter for Enemy AI
 * Provides LLM-based decision making for enemy combatants
 */

export class OpenAIAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = "https://api.openai.com/v1";
  }

  /**
   * Make AI decision using OpenAI
   * @param {Object} prompt - Decision prompt containing game state and options
   * @returns {Promise<Object|null>} Decision result or null on failure
   */
  async chooseAction(prompt) {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: this.getSystemPrompt(),
            },
            {
              role: "user",
              content: this.formatPrompt(prompt),
            },
          ],
          temperature: 0.7,
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error("No response from OpenAI");
      }

      return this.parseResponse(content, prompt);
    } catch (error) {
      console.error("OpenAI decision error:", error);
      return null;
    }
  }

  /**
   * Get system prompt for the AI
   */
  getSystemPrompt() {
    return `You are an AI controlling an enemy in a tabletop RPG combat. You must make tactical decisions based on the current combat state.
  
  Rules:
  - Choose the most effective action for your character
  - Consider your personality traits and current situation
  - Target the most threatening or weakest enemies
  - Use defensive actions when low on health
  - Be aggressive when you have the advantage
  
  Respond with a JSON object containing:
  {
    "action": "action_name",
    "target": "target_name_or_null",
    "reasoning": "brief explanation"
  }
  
  Available actions: Strike, Parry, Dodge, Move, Aim/Called Shot, Defend/Hold, Withdraw, Combat Maneuvers, Use Item`;
  }

  /**
   * Format the decision prompt for OpenAI
   */
  formatPrompt(prompt) {
    const { enemy, targets, combatState, availableActions } = prompt;

    let promptText = `Current Combat Situation:
  
  Enemy: ${enemy.name}
  - Health: ${enemy.currentHP}/${enemy.maxHP}
  - Personality: ${enemy.personality?.name || "Tactical"}
  - Weapon: ${enemy.equippedWeapon || "Unarmed"}
  - Position: ${enemy.position || "Unknown"}
  
  Available Targets:`;

    targets.forEach((target) => {
      const healthPercent = Math.round((target.currentHP / target.maxHP) * 100);
      promptText += `\n- ${target.name}: ${healthPercent}% health, ${
        target.class || "Unknown class"
      }`;
    });

    promptText += `\n\nCombat State:
  - Round: ${combatState.round}
  - Turn: ${combatState.turn}
  - Difficulty: ${combatState.difficulty}
  
  Available Actions: ${availableActions.map((a) => a.name).join(", ")}
  
  Choose the best action for ${enemy.name} based on the current situation.`;

    return promptText;
  }

  /**
   * Parse OpenAI response
   */
  parseResponse(content, prompt) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate the response
      if (!parsed.action) {
        throw new Error("No action specified in response");
      }

      // Find the target if specified
      let target = null;
      if (parsed.target && parsed.target !== "null") {
        target = prompt.targets.find((t) =>
          t.name.toLowerCase().includes(parsed.target.toLowerCase())
        );
      }

      return {
        chosenIndex: this.findActionIndex(
          parsed.action,
          prompt.availableActions
        ),
        target: target,
        reasoning: parsed.reasoning || "LLM decision",
        confidence: 0.8,
      };
    } catch (error) {
      console.error("Failed to parse OpenAI response:", error);
      return null;
    }
  }

  /**
   * Find action index in available actions
   */
  findActionIndex(actionName, availableActions) {
    const normalizedName = actionName.toLowerCase().replace(/[^a-z]/g, "");

    for (let i = 0; i < availableActions.length; i++) {
      const action = availableActions[i];
      const normalizedAction = action.name.toLowerCase().replace(/[^a-z]/g, "");

      if (
        normalizedAction.includes(normalizedName) ||
        normalizedName.includes(normalizedAction)
      ) {
        return i;
      }
    }

    // Default to first action if no match found
    return 0;
  }
}

/**
 * Enhanced AI Manager with OpenAI support
 */
export class EnhancedAIManager {
  constructor() {
    this.openaiAdapter = null;
    this.useLLM = false;
    this.fallbackToDeterministic = true;
  }

  /**
   * Initialize OpenAI adapter
   */
  initializeOpenAI(apiKey) {
    this.openaiAdapter = new OpenAIAdapter(apiKey);
    this.useLLM = true;
  }

  /**
   * Disable LLM and use deterministic AI only
   */
  disableLLM() {
    this.useLLM = false;
  }

  /**
   * Execute action for an enemy
   */
  executeAction(enemyId, actionPlan, enemy, combatState) {
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
      weapon: weapon,
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
    return {
      success: true,
      action: "use_item",
      message: `${enemy.name} uses an item`,
    };
  }

  /**
   * Roll damage for an attack
   */
  rollDamage(enemy, weapon) {
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

  /**
   * Make decision with LLM fallback to deterministic
   */
  async makeDecision(
    enemyId,
    enemy,
    targets,
    combatState,
    personality = null,
    difficulty = "normal"
  ) {
    // Try LLM first if available
    if (this.useLLM && this.openaiAdapter) {
      try {
        const availableActions = this.getAvailableActions(enemy, combatState);

        const prompt = {
          enemy: {
            ...enemy,
            personality: personality,
          },
          targets: targets,
          combatState: combatState,
          availableActions: availableActions,
        };

        const llmDecision = await this.openaiAdapter.chooseAction(prompt);

        if (llmDecision && llmDecision.chosenIndex !== undefined) {
          const action = availableActions[llmDecision.chosenIndex];
          return {
            action: action,
            target: llmDecision.target,
            score: 5.0, // High score for LLM decisions
            reasoning: `LLM: ${llmDecision.reasoning}`,
            isStrategic: true,
            isLLM: true,
          };
        }
      } catch (error) {
        console.error(
          "LLM decision failed, falling back to deterministic:",
          error
        );
      }
    }

    // Fallback to deterministic AI
    if (this.fallbackToDeterministic) {
      return this.makeDeterministicDecision(
        enemyId,
        enemy,
        targets,
        combatState,
        personality,
        difficulty
      );
    }

    return null;
  }

  /**
   * Get available actions (same as in enemyAI.js)
   */
  getAvailableActions(enemy, combatState) {
    const actions = [];

    // Basic actions available to all
    actions.push({
      name: "Strike",
      type: "offensive",
      requiresTarget: true,
      baseScore: 3.0,
    });
    actions.push({
      name: "Parry",
      type: "defensive",
      requiresTarget: false,
      baseScore: 1.5,
    });
    actions.push({
      name: "Dodge",
      type: "defensive",
      requiresTarget: false,
      baseScore: 1.8,
    });
    actions.push({
      name: "Move",
      type: "utility",
      requiresTarget: false,
      baseScore: 1.0,
    });
    actions.push({
      name: "Defend/Hold",
      type: "defensive",
      requiresTarget: false,
      baseScore: 1.2,
    });

    // Advanced actions based on enemy capabilities
    if (enemy.skills?.includes("Combat Maneuvers")) {
      actions.push({
        name: "Combat Maneuvers",
        type: "offensive",
        requiresTarget: true,
        baseScore: 2.2,
      });
    }

    if (enemy.inventory && enemy.inventory.length > 0) {
      actions.push({
        name: "Use Item",
        type: "utility",
        requiresTarget: false,
        baseScore: 2.0,
      });
    }

    if (enemy.weaponRange && enemy.weaponRange > 1) {
      actions.push({
        name: "Aim/Called Shot",
        type: "offensive",
        requiresTarget: true,
        baseScore: 2.5,
      });
    }

    return actions;
  }

  /**
   * Deterministic decision making (simplified version of enemyAI.js logic)
   */
  makeDeterministicDecision(
    enemyId,
    enemy,
    targets,
    combatState,
    personality,
    difficulty
  ) {
    const availableActions = this.getAvailableActions(enemy, combatState);

    // Simple scoring system
    let bestAction = availableActions[0];
    let bestScore = 0;
    let bestTarget = targets[0] || null;

    for (const action of availableActions) {
      let score = action.baseScore;

      // Apply personality weights
      if (personality) {
        switch (action.type) {
          case "offensive":
            score *= personality.weights.aggression;
            break;
          case "defensive":
            score *= personality.weights.caution;
            break;
          case "utility":
            score *=
              (personality.weights.positioning +
                personality.weights.resourceManagement) /
              2;
            break;
        }
      }

      // Health-based adjustments
      const healthRatio = enemy.currentHP / enemy.maxHP;
      if (healthRatio < 0.3 && action.type === "defensive") {
        score *= 1.5;
      } else if (healthRatio > 0.8 && action.type === "offensive") {
        score *= 1.2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return {
      action: bestAction,
      target: bestTarget,
      score: bestScore,
      reasoning: `Deterministic: ${
        personality?.name || "Tactical"
      } personality`,
      isStrategic: bestScore > 2.0,
      isLLM: false,
    };
  }
}

// Export singleton instance
export const enhancedAIManager = new EnhancedAIManager();

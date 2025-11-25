/**
 * Palladium Fantasy Stealth & Detection System
 * Based on 1994 Palladium Fantasy RPG rules
 *
 * Handles:
 * - Prowl percentile skill checks
 * - Line of Vision detection modifiers
 * - Invisibility and special senses
 * - Enemy reaction rolls (INT + alignment based)
 * - Phase 0 Pre-Combat Encounter system
 */

import preCombatSystem from "../data/preCombatSystem.json";

// Alignment-based aggression modifiers (loaded from JSON)
const ALIGNMENT_MODIFIERS = preCombatSystem.alignmentAggressionModifiers || {
  Principled: -20,
  Scrupulous: -10,
  Unprincipled: 0,
  Anarchist: +10,
  Miscreant: +20,
  Aberrant: +15,
  Diabolic: +25,
  Good: -15,
  Selfish: +5,
  Evil: +25,
  Neutral: 0,
};

// Line of Vision modifiers from JSON
const LO_V_MODIFIERS = preCombatSystem.lineOfVisionModifiers || {};

// Species-specific reaction overrides (1994 Palladium bestiary behavior)
const SPECIES_REACTIONS = {
  Owl: ["stares silently", "takes flight to safety", "hoots alarm"],
  Wolf: ["growls low", "circles the group", "retreats if outnumbered"],
  Troll: [
    "snarls and tightens grip on club",
    "advances with heavy steps",
    "bellows before striking",
  ],
  Minotaur: [
    "lowers horns and charges full speed",
    "snorts and stamps the ground",
    "lets out a roar of challenge",
  ],
  Goblin: ["shrieks for allies", "throws a dagger", "dives behind cover"],
  Orc: [
    "points weapon threateningly",
    "grins menacingly",
    "rushes forward with a war cry",
  ],
  Ogre: [
    "grumbles angrily",
    "takes a cautious step",
    "hurls a rock before closing distance",
  ],
  Dragon: ["unfurls wings", "studies intruders", "breathes elemental energy"],
  Wizard: [
    "murmurs a spell",
    "raises magical barrier",
    "casts an offensive spell immediately",
  ],
  Bear: ["stands on hind legs", "growls deeply", "charges forward"],
  Deer: ["freezes in place", "snorts and flees", "bolts in random direction"],
  Snake: ["hisses and coils", "rears back to strike", "retreats into grass"],
  Kobold: ["yips in alarm", "scatters for cover", "throws crude spear"],
  Hobgoblin: ["shouts orders", "forms rank", "advances in formation"],
  Lizardman: [
    "hisses ancient curse",
    "brandishes spear",
    "attacks with primal fury",
  ],
};

// Detect if character has special senses that can bypass stealth
export function hasSpecialSenses(character) {
  if (!character) return false;

  // Check for psionic powers
  if (character.psionics || character.psionicPowers) {
    const powers = Array.isArray(character.psionics)
      ? character.psionics
      : Array.isArray(character.psionicPowers)
      ? character.psionicPowers
      : [];
    if (
      powers.some(
        (p) =>
          p.name?.toLowerCase().includes("see invisible") ||
          p.name?.toLowerCase().includes("sixth sense")
      )
    ) {
      return true;
    }
  }

  // Check for spells
  if (character.magic || character.spells) {
    const spells = Array.isArray(character.magic)
      ? character.magic
      : Array.isArray(character.spells)
      ? character.spells
      : [];
    if (
      spells.some(
        (s) =>
          s.name?.toLowerCase().includes("see invisible") ||
          s.name?.toLowerCase().includes("detect")
      )
    ) {
      return true;
    }
  }

  return false;
}

// Roll Prowl check (d100 vs Prowl%)
export function rollProwl(character, modifiers = {}) {
  if (!character) return { success: false, roll: 100 };

  // Get Prowl skill percentage
  let prowlPercent = 0;

  if (character.skills?.Prowl) {
    prowlPercent = character.skills.Prowl;
  } else if (character.skills?.prowl) {
    prowlPercent = character.skills.prowl;
  } else if (character.prowl) {
    prowlPercent = character.prowl;
  }

  // Apply bonuses (e.g., Assassin gets +20%)
  const bonusses =
    (character.occBonuses?.Prowl || 0) +
    (character.bonuses?.Prowl || 0) +
    (modifiers.bonus || 0);
  prowlPercent += bonusses;

  // Roll d100
  const roll = Math.floor(Math.random() * 100) + 1;

  // Success if roll is within Prowl%
  const success = roll <= prowlPercent;

  return {
    success,
    roll,
    target: prowlPercent,
    modifiers: bonusses,
  };
}

// Calculate detection chance based on line of vision, invisibility, and special senses
// ✅ Palladium 1994: All modifiers are direct percentage points (±), added to base chance
export function calculateDetection(enemy, target, environment = {}) {
  if (!enemy) return { detected: false, chance: 0 };

  // Base detection (normal vision/hearing)
  let baseDetection = 40; // Default 40% chance for normal awareness

  // Line of Vision modifiers (direct percentage point adjustments)
  const lighting = environment.lighting || "normal";
  const visibility = environment.visibility || "clear";

  switch (lighting) {
    case "dark":
      baseDetection -= 30; // -30 percentage points (not -30% of base)
      break;
    case "dim":
      baseDetection -= 15; // -15 percentage points
      break;
    case "bright":
      baseDetection += 10; // +10 percentage points
      break;
  }

  switch (visibility) {
    case "fog":
    case "heavy_rain":
      baseDetection -= 20; // -20 percentage points
      break;
    case "light_rain":
      baseDetection -= 10; // -10 percentage points
      break;
    case "clear":
    default:
      break;
  }

  // Invisibility handling
  if (target.invisible) {
    // Invisible targets can only be detected by special senses
    if (hasSpecialSenses(enemy)) {
      baseDetection = hasSpecialSenses(enemy) ? 80 : 0;
    } else {
      baseDetection = 0;
    }
  }

  // Cover concealment (percentage point modifiers)
  if (target.cover) {
    switch (target.cover) {
      case "partial":
        baseDetection -= 15; // -15 percentage points
        break;
      case "heavy":
        baseDetection -= 30; // -30 percentage points
        break;
      case "total":
        baseDetection = 0; // Cannot detect
        break;
    }
  }

  // Special senses improve detection (percentage point bonus)
  if (hasSpecialSenses(enemy) && !target.invisible) {
    baseDetection += 25; // +25 percentage points
  }

  // Clamp between 0 and 95 (never 100% guarantee without special abilities)
  // Final detection chance = base + all modifiers
  baseDetection = Math.max(0, Math.min(95, baseDetection));

  return {
    detected: Math.random() * 100 <= baseDetection,
    chance: baseDetection,
  };
}

// Enemy reaction based on INT and alignment (1994 Palladium style)
export function rollEnemyReaction(enemy, situation = "normal") {
  if (!enemy) return { action: "observe", hostility: 0 };

  // Get INT (average is 10)
  const int =
    enemy.Int ||
    enemy.int ||
    enemy.attributes?.Int ||
    enemy.attributes?.int ||
    10;

  // Get alignment
  const alignment = enemy.alignment || "Neutral";

  // Base hostility from alignment
  const baseHostility = ALIGNMENT_MODIFIERS[alignment] || 0;

  // INT modifier (lower INT = more instinctual/aggressive)
  const intModifier = Math.floor((10 - int) * 2);

  // Situation modifiers
  let situationModifier = 0;
  switch (situation) {
    case "surprised":
      situationModifier -= 20;
      break;
    case "cornered":
      situationModifier += 20;
      break;
    case "numbers_advantage":
      situationModifier += 15;
      break;
    case "outnumbered":
      situationModifier -= 10;
      break;
    default:
      break;
  }

  // Total hostility score
  const hostility = baseHostility + intModifier + situationModifier;

  // Roll for reaction
  const reactionRoll = Math.floor(Math.random() * 100) + 1 + hostility;

  // Determine action based on reaction roll
  let action;
  let aggression;

  if (reactionRoll < 20) {
    action = "flees";
    aggression = "very_low";
  } else if (reactionRoll < 40) {
    action = "cautious";
    aggression = "low";
  } else if (reactionRoll < 60) {
    action = "observe";
    aggression = "neutral";
  } else if (reactionRoll < 80) {
    action = "advances";
    aggression = "moderate";
  } else {
    action = "attacks";
    aggression = "high";
  }

  return {
    action,
    aggression,
    hostility,
    reactionRoll,
    int,
    alignment,
  };
}

// Main stealth detection function combining Prowl vs Detection
export function handleStealthPhase(player, enemies, environment = {}) {
  const results = {
    player: null,
    enemies: [],
    combatStarts: false,
  };

  // Player attempts to prowl
  const prowlResult = rollProwl(player);
  results.player = prowlResult;

  // Player is hidden if prowl succeeds
  const playerHidden = prowlResult.success;

  // Each enemy makes detection attempt
  enemies.forEach((enemy) => {
    if (!enemy || enemy.currentHP <= 0) return;

    const detectionResult = calculateDetection(
      enemy,
      {
        invisible: player.invisible || false,
        cover: player.cover || "none",
      },
      environment
    );

    // Enemy detects player if their detection roll succeeds
    if (detectionResult.detected && playerHidden) {
      // Player prowled but enemy detected them
      results.combatStarts = true;
      enemy.alerted = true;

      // Roll reaction
      const reaction = rollEnemyReaction(enemy, "surprised");
      enemy.reaction = reaction;
    } else if (!playerHidden) {
      // Player didn't prowl successfully - combat starts
      results.combatStarts = true;
      enemy.alerted = true;

      const reaction = rollEnemyReaction(enemy, "normal");
      enemy.reaction = reaction;
    } else {
      // Player remains hidden from this enemy
      enemy.alerted = false;
    }

    results.enemies.push({
      enemy,
      detected: detectionResult.detected,
      detectionChance: detectionResult.chance,
    });
  });

  return results;
}

// Get description for enemy reaction
export function getReactionDescription(reaction) {
  const descriptions = {
    flees: `${reaction.enemy?.name || "Enemy"} tries to escape!`,
    cautious: `${reaction.enemy?.name || "Enemy"} stays back, watching warily.`,
    observe: `${
      reaction.enemy?.name || "Enemy"
    } watches and assesses the situation.`,
    advances: `${reaction.enemy?.name || "Enemy"} moves closer cautiously.`,
    attacks: `${reaction.enemy?.name || "Enemy"} immediately attacks!`,
  };

  return descriptions[reaction.action] || "Unknown reaction";
}

// ========== PHASE 0: PRE-COMBAT ENCOUNTER SYSTEM ==========

/**
 * Execute a Phase 0 pre-combat action
 * @param {string} actionName - Name of the action (from preCombatSystem.actions)
 * @param {object} character - The character performing the action
 * @param {object} environment - Environment modifiers
 * @returns {object} Result with success, roll, and effects
 */
export function executePreCombatAction(
  actionName,
  character,
  environment = {}
) {
  const action = preCombatSystem.actions.find((a) => a.name === actionName);
  if (!action) {
    return { success: false, error: `Unknown action: ${actionName}` };
  }

  // Handle auto-success actions
  if (action.roll === "Auto") {
    return {
      success: true,
      roll: 0,
      effect: action.successEffect,
      action: actionName,
    };
  }

  // Handle skill-based actions
  if (action.skill && Array.isArray(action.skill)) {
    // Multiple skill options - use the highest
    let skillValue = 0;
    for (const skillName of action.skill) {
      const skill = getSkillValue(character, skillName);
      if (skill > skillValue) skillValue = skill;
    }

    const roll = Math.floor(Math.random() * 100) + 1;
    const success = roll <= skillValue;

    return {
      success,
      roll,
      target: skillValue,
      effect: success ? action.successEffect : action.failureEffect,
      action: actionName,
      modifiers: applyEnvironmentModifiers(action, character, environment),
    };
  }

  return { success: false, error: "Action not implemented" };
}

/**
 * Get skill value from character
 */
function getSkillValue(character, skillName) {
  if (!character || !skillName) return 0;

  // Check skills object
  if (character.skills?.[skillName]) {
    return character.skills[skillName];
  }

  // Check directly on character
  if (character[skillName]) {
    return character[skillName];
  }

  // Check attributes
  if (character.attributes?.[skillName]) {
    return character.attributes[skillName];
  }

  return 0;
}

/**
 * Apply environment modifiers to action
 */
function applyEnvironmentModifiers(action, character, environment) {
  const modifiers = {};

  if (action.name === "Prowl / Hide" && action.modifiers) {
    const envModifiers = action.modifiers.environment || {};

    // Lighting conditions
    const lighting = environment.lighting || "normal";
    if (lighting === "brightDaylight")
      modifiers.environment = envModifiers.brightDaylight || 0;
    if (lighting === "dimLight")
      modifiers.environment = envModifiers.dimLight || 0;
    if (lighting === "totalDarkness")
      modifiers.environment = envModifiers.totalDarkness || 0;

    // Cover conditions
    const cover = environment.cover || "noCover";
    if (cover === "heavyCover") modifiers.cover = envModifiers.heavyCover || 0;
    if (cover === "noCover") modifiers.cover = envModifiers.noCover || 0;

    // Armor penalty
    const armorWeight = calculateArmorWeight(character);
    modifiers.armorPenalty = Math.floor((armorWeight / 20) * -5);
  }

  return modifiers;
}

/**
 * Calculate total armor weight
 */
function calculateArmorWeight(character) {
  if (!character.equipped) return 0;

  let weight = 0;
  for (const slot in character.equipped) {
    const item = character.equipped[slot];
    if (item && item.weight) {
      weight += parseFloat(item.weight) || 0;
    }
  }

  return weight;
}

/**
 * Get enemy reaction based on Species + INT + alignment
 * Species-specific reactions take priority, then fall back to alignment + intelligence
 */
export function getEnemyInitialReaction(enemy) {
  if (!enemy) return null;

  const int =
    enemy.Int ||
    enemy.int ||
    enemy.attributes?.Int ||
    enemy.attributes?.int ||
    10;
  const alignment = enemy.alignment || "Neutral";
  const species = enemy.species || enemy.name || enemy.race || "";

  // Species-specific reactions take priority
  if (SPECIES_REACTIONS[species]) {
    const speciesBehaviors = SPECIES_REACTIONS[species];
    const randomBehavior =
      speciesBehaviors[Math.floor(Math.random() * speciesBehaviors.length)];

    return {
      action:
        randomBehavior.toLowerCase().includes("attack") ||
        randomBehavior.toLowerCase().includes("charge") ||
        randomBehavior.toLowerCase().includes("strike")
          ? "attacks"
          : "cautious",
      behavior: [randomBehavior],
      aggression: "moderate",
      int,
      alignment,
      species,
      note: "Species-specific behavior",
    };
  }

  // Fall back to alignment + intelligence behavior
  const reactionPattern = preCombatSystem.enemyReactions.find(
    (r) => r.alignment === alignment
  );

  if (!reactionPattern) {
    return {
      action: "observe",
      behavior: ["Watch warily", "Assess threat"],
      aggression: "neutral",
      int,
      alignment,
      species,
    };
  }

  // Determine behavior based on intelligence
  let behavior;
  if (int >= 16) {
    behavior = reactionPattern.reaction; // Use full reaction set
  } else if (int >= 12) {
    behavior = reactionPattern.reaction.slice(0, 2); // Moderate intelligence
  } else if (int >= 6) {
    behavior = [reactionPattern.reaction[reactionPattern.reaction.length - 1]]; // Low intelligence - last reaction
  } else {
    behavior = ["Attack", "Charge", "Defend turf"]; // Animalistic
  }

  const aggressionMap = {
    Principled: "very_low",
    Scrupulous: "low",
    Unprincipled: "neutral",
    Anarchist: "moderate",
    Miscreant: "high",
    Aberrant: "moderate",
    Diabolic: "very_high",
  };

  return {
    action: behavior[0]?.toLowerCase().includes("attack")
      ? "attacks"
      : "cautious",
    behavior,
    aggression: aggressionMap[alignment] || "neutral",
    int,
    alignment,
    species,
  };
}

/**
 * Apply Line of Vision modifiers from preCombatSystem
 */
export function applyLineOfVisionModifiers(baseDetection, environment = {}) {
  let detection = baseDetection;

  // Environment lighting
  const lighting = environment.lighting || "daylight";
  const envMods = LO_V_MODIFIERS.environment || {};
  if (envMods[lighting]) {
    detection += parseInt(envMods[lighting]) || 0;
  }

  // Invisibility
  if (environment.invisible) {
    const invisMods = LO_V_MODIFIERS.invisibility || {};
    if (envMods.invisible === "simple_invisibility") {
      detection += parseInt(invisMods.simple_invisibility) || -50;
    } else if (environment.invisible === "superior_invisibility") {
      detection += parseInt(invisMods.superior_invisibility) || -80;
    }
  }

  // Distance
  const distance = environment.distance || "within_50ft";
  const distMods = LO_V_MODIFIERS.distance || {};
  if (distMods[distance]) {
    const distValue = distMods[distance];
    detection += parseInt(distValue) || 0;
  }

  return Math.max(0, Math.min(100, detection));
}

/**
 * Phase 0 Complete Encounter Resolution
 * Simulates the full pre-combat phase with all modifiers
 */
export function resolvePhase0Encounter(players, enemies, environment = {}) {
  const results = {
    players: [],
    enemies: [],
    actions: [],
    combatStart: false,
    surpriseRound: false,
  };

  // Players attempt pre-combat actions
  players.forEach((player) => {
    const prowlResult = rollProwl(
      player,
      applyEnvironmentModifiers(
        preCombatSystem.actions.find((a) => a.name === "Prowl / Hide"),
        player,
        environment
      )
    );

    results.players.push({
      player,
      prowlResult,
      hidden: prowlResult.success,
    });
  });

  // Enemies attempt detection
  enemies.forEach((enemy) => {
    const reaction = getEnemyInitialReaction(enemy);
    let detected = false;

    // Check if any player was detected
    for (const playerResult of results.players) {
      if (playerResult.hidden) {
        const detection = calculateDetection(
          enemy,
          {
            invisible: playerResult.player.invisible || false,
            cover: playerResult.player.cover || "none",
          },
          environment
        );
        detected = detection.detected;
      } else {
        detected = true; // Player failed prowl
      }

      if (detected) break;
    }

    results.enemies.push({
      enemy,
      reaction,
      detected,
      initiative: reaction.action === "attacks" ? "aggressive" : "cautious",
    });
  });

  // Determine if combat starts and surprise
  const allPlayersHidden = results.players.every((p) => p.hidden);
  const anyEnemyDetected = results.enemies.some((e) => e.detected);

  if (anyEnemyDetected) {
    results.combatStart = true;

    // Surprise if all players succeeded prowl but were still detected
    if (allPlayersHidden && anyEnemyDetected) {
      results.surpriseRound = false; // Mutual surprise or no surprise
    } else if (!allPlayersHidden) {
      results.surpriseRound = true; // Enemies are surprised by hidden players
    }
  } else if (!allPlayersHidden) {
    results.combatStart = true; // Players detected, but enemies not aware
  }

  return results;
}

// Export the JSON system as a named export
export { preCombatSystem };

export default {
  rollProwl,
  calculateDetection,
  rollEnemyReaction,
  handleStealthPhase,
  hasSpecialSenses,
  getReactionDescription,
  // Phase 0 exports
  executePreCombatAction,
  getEnemyInitialReaction,
  applyLineOfVisionModifiers,
  resolvePhase0Encounter,
  preCombatSystem, // Export the JSON system
};

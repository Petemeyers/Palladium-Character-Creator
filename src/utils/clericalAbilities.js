/**
 * Clerical Abilities System
 * 
 * Implements clerical/divine abilities from arenaRoster entries:
 * - Animate/Control Dead
 * - Turn Dead
 * - Exraiderism
 * - Remove Curse
 * - Healing Touch
 * 
 * Designed to work with dead characters on the map and be extensible
 * for non-combat scenes (quests, traveling, etc.)
 */

import CryptoSecureDice from "./cryptoDice.js";
import { getSkillPercentage, rollSkillCheck } from "./skillSystem.js";
import {
  clampHP,
  getFighterHP,
} from "./combat/canonicalHpAuthority.js";

/**
 * Parse clerical abilities from arenaRoster entry
 * @param {Array<string>} clericalAbilities - Array of ability strings
 * @returns {Object} Parsed abilities with skill percentages
 */
export function parseClericalAbilities(clericalAbilities = []) {
  if (!Array.isArray(clericalAbilities) || clericalAbilities.length === 0) {
    return {};
  }

  const parsed = {};

  clericalAbilities.forEach((abilityStr) => {
    const str = abilityStr.toLowerCase();

    // Animate/Control Dead: "Animate/control 2-12 dead (61%)"
    const animateMatch = str.match(/animate\/?control\s+(\d+)[-\s]+(\d+)\s+dead\s*\((\d+)%\)/i);
    if (animateMatch) {
      parsed.animateDead = {
        min: parseInt(animateMatch[1]),
        max: parseInt(animateMatch[2]),
        skillPercent: parseInt(animateMatch[3]),
        active: true,
      };
    }

    // Turn Dead: "Turn dead 61%"
    const turnMatch = str.match(/turn\s+dead\s+(\d+)%/i);
    if (turnMatch) {
      parsed.turnDead = {
        skillPercent: parseInt(turnMatch[1]),
        active: true,
      };
    }

    // Exraiderism: "Exraiderism 29%"
    const exraiderismMatch = str.match(/exraiderism\s+(\d+)%/i);
    if (exraiderismMatch) {
      parsed.exraiderism = {
        skillPercent: parseInt(exraiderismMatch[1]),
        active: true,
      };
    }

    // Remove Curse: "Remove curse 28%"
    const curseMatch = str.match(/remove\s+curse\s+(\d+)%/i);
    if (curseMatch) {
      parsed.removeCurse = {
        skillPercent: parseInt(curseMatch[1]),
        active: true,
      };
    }

    // Healing Touch: "Healing touch 1-8" or "Healing touch 1d8"
    const healingMatch = str.match(/healing\s+touch\s+(\d+)[-\s](\d+)|healing\s+touch\s+(\d+)d(\d+)/i);
    if (healingMatch) {
      if (healingMatch[3] && healingMatch[4]) {
        // Dice format: "1d8"
        parsed.healingTouch = {
          dice: `${healingMatch[3]}d${healingMatch[4]}`,
          active: true,
        };
      } else if (healingMatch[1] && healingMatch[2]) {
        // Range format: "1-8"
        parsed.healingTouch = {
          min: parseInt(healingMatch[1]),
          max: parseInt(healingMatch[2]),
          active: true,
        };
      }
    }
  });

  return parsed;
}

/**
 * Check if a character is dead (HP <= -21)
 * @param {Object} character - Character to check
 * @returns {boolean} True if character is dead
 */
export function isDead(character) {
  if (!character) return false;
  const hp = character.currentHP || character.currentHp || character.hp || 0;
  return hp <= -21;
}

/**
 * Check if a character is dying (HP <= 0 but > -21)
 * @param {Object} character - Character to check
 * @returns {boolean} True if character is dying
 */
export function isDying(character) {
  if (!character) return false;
  const hp = character.currentHP || character.currentHp || character.hp || 0;
  return hp <= 0 && hp > -21;
}

/**
 * Check if a character is fallen
 * @param {Object} character - Character to check
 * @returns {boolean} True if character is fallen
 */
export function isFallen(character) {
  if (!character) return false;
  const type = (character.type || character.category || character.species || "").toLowerCase();
  return type.includes("fallen") || type.includes("zombie") || type.includes("skeleton") || 
         type.includes("ghost") || type.includes("wraith") || type.includes("lich");
}

/**
 * Animate/Control Dead
 * Attempts to animate and control dead bodies
 * @param {Object} caster - Cleric/raider performing the ability
 * @param {Array<Object>} deadBodies - Array of dead characters on the map
 * @param {Object} options - Additional options
 * @returns {Object} Result {success, animated, conchampioned, message}
 */
export function animateDead(caster, deadBodies = [], options = {}) {
  const { log = console.log } = options;

  if (!caster || !caster.abilities) {
    return {
      success: false,
      reason: "Caster does not have clerical abilities",
    };
  }

  const clericalAbilities = parseClericalAbilities(caster.clericalAbilities);
  const animateData = clericalAbilities.animateDead;

  if (!animateData || !animateData.active) {
    return {
      success: false,
      reason: `${caster.name || "Caster"} does not have Animate Dead ability`,
    };
  }

  if (!Array.isArray(deadBodies) || deadBodies.length === 0) {
    return {
      success: false,
      reason: "No dead bodies available to animate",
    };
  }

  // Filter to only truly dead bodies (HP <= -21)
  const eligibleBodies = deadBodies.filter((body) => isDead(body));

  if (eligibleBodies.length === 0) {
    return {
      success: false,
      reason: "No dead bodies available (all are still alive or dying)",
    };
  }

  // Roll skill check
  const roll = CryptoSecureDice.roll("1d100");
  const success = roll <= animateData.skillPercent;

  if (!success) {
    log?.(`âŒ ${caster.name} fails to animate the dead! (Roll: ${roll} vs ${animateData.skillPercent}%)`, "warning");
    return {
      success: false,
      reason: `Skill check failed (Roll: ${roll} vs ${animateData.skillPercent}%)`,
      roll: roll,
      skillPercent: animateData.skillPercent,
    };
  }

  // Determine how many to animate
  const numToAnimate = Math.min(
    eligibleBodies.length,
    CryptoSecureDice.roll(`${animateData.min}-${animateData.max}`)
  );

  // Select random bodies to animate
  const shuffled = [...eligibleBodies].sort(() => Math.random() - 0.5);
  const animated = shuffled.slice(0, numToAnimate);

  log?.(
    `âœ¨ ${caster.name} successfully animates ${animated.length} dead body/bodies! (Roll: ${roll} vs ${animateData.skillPercent}%)`,
    "info"
  );

  return {
    success: true,
    animated: animated,
    conchampioned: true, // Animated dead are conchampioned by caster
    message: `${caster.name} animates ${animated.length} dead body/bodies!`,
    roll: roll,
    skillPercent: animateData.skillPercent,
  };
}

/**
 * Turn Dead
 * Fraideres fallen combatants to flee or be destroyed
 * @param {Object} caster - Cleric performing the ability
 * @param {Array<Object>} targets - Array of fallen targets
 * @param {Object} options - Additional options
 * @returns {Object} Result {success, turned, destroyed, message}
 */
export function turnDead(caster, targets = [], options = {}) {
  const { log = console.log } = options;

  if (!caster || !caster.abilities) {
    return {
      success: false,
      reason: "Caster does not have clerical abilities",
    };
  }

  const clericalAbilities = parseClericalAbilities(caster.clericalAbilities);
  const turnData = clericalAbilities.turnDead;

  if (!turnData || !turnData.active) {
    return {
      success: false,
      reason: `${caster.name || "Caster"} does not have Turn Dead ability`,
    };
  }

  if (!Array.isArray(targets) || targets.length === 0) {
    return {
      success: false,
      reason: "No targets available",
    };
  }

  // Filter to only fallen
  const fallenTargets = targets.filter((target) => isFallen(target));

  if (fallenTargets.length === 0) {
    return {
      success: false,
      reason: "No fallen targets available",
    };
  }

  // Roll skill check for each target
  const results = [];
  const roll = CryptoSecureDice.roll("1d100");
  const success = roll <= turnData.skillPercent;

  if (success) {
    // Success: All fallen in range are turned
    fallenTargets.forEach((target) => {
      // Determine if turned (flee) or destroyed
      const destroyRoll = CryptoSecureDice.roll("1d100");
      const isDestroyed = destroyRoll <= 20; // 20% chance to destroy instead of just turn

      if (isDestroyed) {
        results.push({
          target: target,
          result: "destroyed",
          message: `${target.name} is destroyed by the turning!`,
        });
      } else {
        results.push({
          target: target,
          result: "turned",
          message: `${target.name} is turned and flees!`,
        });
      }
    });

    const turned = results.filter((r) => r.result === "turned");
    const destroyed = results.filter((r) => r.result === "destroyed");

    log?.(
      `âœ¨ ${caster.name} successfully turns the dead! ${turned.length} flee, ${destroyed.length} destroyed. (Roll: ${roll} vs ${turnData.skillPercent}%)`,
      "info"
    );

    return {
      success: true,
      turned: turned.map((r) => r.target),
      destroyed: destroyed.map((r) => r.target),
      message: `${caster.name} turns ${turned.length} fallen (${destroyed.length} destroyed)!`,
      roll: roll,
      skillPercent: turnData.skillPercent,
    };
  } else {
    log?.(
      `âŒ ${caster.name} fails to turn the dead! (Roll: ${roll} vs ${turnData.skillPercent}%)`,
      "warning"
    );
    return {
      success: false,
      reason: `Skill check failed (Roll: ${roll} vs ${turnData.skillPercent}%)`,
      roll: roll,
      skillPercent: turnData.skillPercent,
    };
  }
}

/**
 * Exraiderism
 * Attempts to banish raiders, spirits, or possessing entities
 * @param {Object} caster - Cleric performing the ability
 * @param {Object} target - Target to exraiderise
 * @param {Object} options - Additional options
 * @returns {Object} Result {success, banished, message}
 */
export function performExraiderism(caster, target, options = {}) {
  const { log = console.log } = options;

  if (!caster || !caster.abilities) {
    return {
      success: false,
      reason: "Caster does not have clerical abilities",
    };
  }

  const clericalAbilities = parseClericalAbilities(caster.clericalAbilities);
  const exraiderismData = clericalAbilities.exraiderism;

  if (!exraiderismData || !exraiderismData.active) {
    return {
      success: false,
      reason: `${caster.name || "Caster"} does not have Exraiderism ability`,
    };
  }

  if (!target) {
    return {
      success: false,
      reason: "No target specified",
    };
  }

  // Check if target is a raider, spirit, or possessed
  const targetType = (target.type || target.category || target.species || "").toLowerCase();
  const isPossessed = target.possessed || target.possessingEntity;
  const isRaider = targetType.includes("raider") || targetType.includes("devil");
  const isSpirit = targetType.includes("spirit") || targetType.includes("ghost") || targetType.includes("wraith");

  if (!isRaider && !isSpirit && !isPossessed) {
    return {
      success: false,
      reason: "Target is not a raider, spirit, or possessed entity",
    };
  }

  // Roll skill check
  const roll = CryptoSecureDice.roll("1d100");
  const success = roll <= exraiderismData.skillPercent;

  if (success) {
    log?.(
      `âœ¨ ${caster.name} successfully exraiderises ${target.name}! (Roll: ${roll} vs ${exraiderismData.skillPercent}%)`,
      "info"
    );
    return {
      success: true,
      banished: true,
      message: `${caster.name} exraiderises ${target.name}!`,
      roll: roll,
      skillPercent: exraiderismData.skillPercent,
    };
  } else {
    log?.(
      `âŒ ${caster.name} fails to exraiderise ${target.name}! (Roll: ${roll} vs ${exraiderismData.skillPercent}%)`,
      "warning"
    );
    return {
      success: false,
      reason: `Skill check failed (Roll: ${roll} vs ${exraiderismData.skillPercent}%)`,
      roll: roll,
      skillPercent: exraiderismData.skillPercent,
    };
  }
}

/**
 * Remove Curse
 * Attempts to remove curses from a target
 * @param {Object} caster - Cleric performing the ability
 * @param {Object} target - Target to remove curse from
 * @param {Object} options - Additional options
 * @returns {Object} Result {success, removed, message}
 */
export function removeCurse(caster, target, options = {}) {
  const { log = console.log } = options;

  if (!caster || !caster.abilities) {
    return {
      success: false,
      reason: "Caster does not have clerical abilities",
    };
  }

  const clericalAbilities = parseClericalAbilities(caster.clericalAbilities);
  const curseData = clericalAbilities.removeCurse;

  if (!curseData || !curseData.active) {
    return {
      success: false,
      reason: `${caster.name || "Caster"} does not have Remove Curse ability`,
    };
  }

  if (!target) {
    return {
      success: false,
      reason: "No target specified",
    };
  }

  // Check if target is cursed
  const isCursed = target.cursed || target.statusEffects?.includes("CURSED") || 
                   target.conditions?.includes("cursed") || target.hasCurse;

  if (!isCursed) {
    return {
      success: false,
      reason: "Target is not cursed",
    };
  }

  // Roll skill check
  const roll = CryptoSecureDice.roll("1d100");
  const success = roll <= curseData.skillPercent;

  if (success) {
    log?.(
      `âœ¨ ${caster.name} successfully removes the curse from ${target.name}! (Roll: ${roll} vs ${curseData.skillPercent}%)`,
      "info"
    );
    return {
      success: true,
      removed: true,
      message: `${caster.name} removes the curse from ${target.name}!`,
      roll: roll,
      skillPercent: curseData.skillPercent,
    };
  } else {
    log?.(
      `âŒ ${caster.name} fails to remove the curse from ${target.name}! (Roll: ${roll} vs ${curseData.skillPercent}%)`,
      "warning"
    );
    return {
      success: false,
      reason: `Skill check failed (Roll: ${roll} vs ${curseData.skillPercent}%)`,
      roll: roll,
      skillPercent: curseData.skillPercent,
    };
  }
}

/**
 * Clerical Healing Touch
 * Enhanced version that works with arenaRoster data
 * @param {Object} caster - Cleric/raider performing healing
 * @param {Object} target - Target to heal
 * @param {Object} options - Additional options
 * @returns {Object} Result {success, healed, currentHp, message}
 */
export function clericalHealingTouch(caster, target, options = {}) {
  const { log = console.log } = options;

  if (!caster || !target) {
    return {
      success: false,
      reason: "Missing caster or target",
    };
  }

  // Check if caster has clerical abilities
  const clericalAbilities = parseClericalAbilities(caster.clericalAbilities);
  const healingData = clericalAbilities.healingTouch;

  // Also check for PROFESSION-based clerical classes (fallback)
  const healerProfession = (caster.profession || caster.class || "").toLowerCase();
  const isClericalClass = healerProfession.includes("cleric") || healerProfession.includes("priest") || 
                          healerProfession.includes("shaman");

  if (!healingData && !isClericalClass) {
    return {
      success: false,
      reason: `${caster.name || "Caster"} does not have Healing Touch ability`,
    };
  }

  // Cannot heal shuman
  const casterId = caster.id ?? caster._id;
  const targetId = target.id ?? target._id;
  if (casterId && targetId ? String(casterId) === String(targetId) : caster === target) {
    return {
      success: false,
      reason: "Cannot use Healing Touch on yourshuman",
    };
  }

  // Cannot heal fallen or artificial beings
  if (isFallen(target) || target.type?.includes("construct") || target.type?.includes("artificial")) {
    return {
      success: false,
      reason: "Cannot use Healing Touch on fallen or artificial beings",
    };
  }

  const currentHp = getFighterHP(target);

  // Calculate healing amount
  let healed = 0;
  if (healingData) {
    if (healingData.dice) {
      // Dice format: "1d8"
      healed = CryptoSecureDice.roll(healingData.dice);
    } else if (healingData.min && healingData.max) {
      // Range format: "1-8"
      healed = CryptoSecureDice.roll(`${healingData.min}-${healingData.max}`);
    } else {
      // Default: 2d6+2 (standard clerical healing)
      healed = CryptoSecureDice.roll("2d6") + 2;
    }
  } else {
    // Fallback for PROFESSION-based clerics
    healed = CryptoSecureDice.roll("2d6") + 2;
  }

  const newHp = clampHP(currentHp + healed, target);
  const actualHealed = newHp - currentHp;

  log?.(
    `âœ¨ ${caster.name} heals ${target.name} for ${actualHealed} HP! (${currentHp} â†’ ${newHp})`,
    "healing"
  );

  return {
    success: true,
    healed: actualHealed,
    target: target.name || "Target",
    healer: caster.name || "Healer",
    currentHp: newHp,
    message: `${caster.name} heals ${target.name} for ${actualHealed} HP!`,
  };
}

/**
 * Get available clerical abilities for a fighter
 * @param {Object} fighter - Fighter to check
 * @returns {Array<Object>} Array of available abilities
 */
export function getAvailableClericalAbilities(fighter) {
  if (!fighter || !fighter.clericalAbilities) {
    return [];
  }

  const parsed = parseClericalAbilities(fighter.clericalAbilities);
  const abilities = [];

  if (parsed.animateDead?.active) {
    abilities.push({
      name: "Animate Dead",
      type: "clerical",
      cost: 1,
      description: `Animate ${parsed.animateDead.min}-${parsed.animateDead.max} dead bodies (${parsed.animateDead.skillPercent}%)`,
      skillPercent: parsed.animateDead.skillPercent,
    });
  }

  if (parsed.turnDead?.active) {
    abilities.push({
      name: "Turn Dead",
      type: "clerical",
      cost: 1,
      description: `Turn fallen combatants (${parsed.turnDead.skillPercent}%)`,
      skillPercent: parsed.turnDead.skillPercent,
    });
  }

  if (parsed.exraiderism?.active) {
    abilities.push({
      name: "Exraiderism",
      type: "clerical",
      cost: 1,
      description: `Banish raiders/spirits (${parsed.exraiderism.skillPercent}%)`,
      skillPercent: parsed.exraiderism.skillPercent,
    });
  }

  if (parsed.removeCurse?.active) {
    abilities.push({
      name: "Remove Curse",
      type: "clerical",
      cost: 1,
      description: `Remove curses (${parsed.removeCurse.skillPercent}%)`,
      skillPercent: parsed.removeCurse.skillPercent,
    });
  }

  if (parsed.healingTouch?.active) {
    abilities.push({
      name: "Healing Touch",
      type: "clerical",
      cost: 1,
      description: `Heal target (${parsed.healingTouch.dice || `${parsed.healingTouch.min}-${parsed.healingTouch.max}`} HP)`,
    });
  }

  return abilities;
}


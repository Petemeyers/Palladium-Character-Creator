/**
 * Medieval Combat Simulator - Comprehensive Healing System
 *
 * Based on official Medieval Combat Simulator rules (1994 edition).
 * Source: Medieval Combat Simulator.docx and Rulebook.txt
 *
 * Centralizes all healing logic:
 * - Natural recovery from rest (+2 HP/day first 2 days, +4 HP/day after)
 * - Medical treatment (First Aid, bandaging, herbal remedies) - 1D6+2 HP on success, 0 on failure
 * - Clerical/Divine Healing Touch (2D6+2 HP, any Clergy profession)
 * - Healer profession focus-based abilities (Healing Touch, Negate Toxins, Lust for Life, Resurrection)
 * - Coma recovery with percentile rolls (60% medical, 32% exceptional/clerical)
 * - Optional coma recovery side effects (permanent stat penalties)
 * - Optional insanity effects (for brain damage cases)
 *
 * Integrates with:
 * - dice.js for dice rolling
 * - cryptoDice.js for percentile rolls
 */

import { rollDice } from "./dice.js";
import CryptoSecureDice from "./cryptoDice.js";
import {
  applyHPToFighter,
  clampHP,
  getFighterHP,
} from "./combat/canonicalHpAuthority.js";

/**
 * Roll percentile (d100) - 1-100
 */
function rollPercentile() {
  return CryptoSecureDice.rollPercentile();
}

/**
 * Natural Recovery - Daily HP restoration from rest
 *
 * Rules (Medieval Combat Simulator 1994):
 * - A character can recover hit points naturally through medical treatment and rest
 * - Includes: bandaging, stitching, wrapping wounds, herbal remedies, balms, salves, compresses, and rest
 * - Recovery rate:
 *   - +2 Hit Points per day for the first two days
 *   - +4 Hit Points per day for each day thereafter, until fully healed
 *
 * Source: Medieval Combat Simulator.docx, section "RECOVERING HIT POINTS"
 *
 * @param {object} character - Character to heal
 * @param {number} days - Number of days rested
 * @returns {object} - { method, healed, currentHp }
 */
export function naturalRecovery(character, days = 1) {
  const currentHp = getFighterHP(character);

  // Calculate healing: 2 HP/day for first 2 days, then 4 HP/day
  let healed = 0;
  if (days <= 2) {
    healed = 2 * days;
  } else {
    healed = 4 * (days - 2) + 4; // 2/day for first 2 days + 4/day after
  }

  const newHp = clampHP(currentHp + healed, character);
  const actualHealed = newHp - currentHp;
  applyHPToFighter(character, newHp, { updateStatus: false });

  return {
    method: "Natural Recovery",
    healed: actualHealed,
    currentHp: newHp,
    daysRested: days,
    message: `${
      character.name || "Character"
    } recovers ${actualHealed} HP from ${days} day(s) of rest.`,
  };
}

/**
 * Medical Treatment - First Aid, bandaging, herbal remedies
 *
 * Rules (Medieval Combat Simulator 1994):
 * - Players may heal others using first aid, bandages, or herbs â€” even without training
 * - Requires Medical skill (First Aid listed under elective or secondary skills)
 * - Doesn't instantly restore large HP amounts, but accelerates natural recovery and prevents death from blood loss or infection
 * - Success: 1D6 + 2 HP
 * - Failure: No HP recovered (time wasted, no penalties per core rules)
 *
 * Source: Medieval Combat Simulator.docx - "Medical Treatment (Non-Exceptional Aid)"
 *
 * @param {object} healer - Character providing treatment (must have Medical/First Aid skill)
 * @param {object} target - Character receiving treatment
 * @param {number} skillPercent - First Aid skill percentage (d100 target)
 * @returns {object} - { method, roll, success, healed, currentHp }
 */
export function medicalTreatment(healer, target, skillPercent = 50) {
  const currentHp = getFighterHP(target);

  // Roll skill check (d100 vs skill %)
  const roll = rollPercentile();
  const success = roll <= skillPercent;

  // Success: 1D6 + 2 HP, Failure: 0 HP (wasted time)
  const healed = success ? rollDice("1d6") + 2 : 0;

  const newHp = clampHP(currentHp + healed, target);
  const actualHealed = newHp - currentHp;

  return {
    method: "Medical Treatment",
    roll,
    success,
    healed: actualHealed,
    currentHp: newHp,
    skillPercent,
    healer: healer.name || "Healer",
    target: target.name || "Target",
    message: success
      ? `${healer.name || "Healer"} successfully treats ${
          target.name || "target"
        } (${roll}% vs ${skillPercent}%). Restores ${actualHealed} HP.`
      : `${
          healer.name || "Healer"
        } fails treatment (${roll}% vs ${skillPercent}%). No HP recovered.`,
  };
}

/**
 * Clerical/Divine Healing Touch
 *
 * Rules (Medieval Combat Simulator 1994):
 * - Clerics, priests, shamans, and other divine healers can use Healing Touch
 * - Allows them to lay hands on injured character and heal through faith and divine power
 * - Type: Divine / exceptional touch
 * - Effect: Restores 2D6 + 2 HP per use (range: 4-14 HP, average ~9 HP)
 * - Range: Touch only
 * - Casting Time: 1 melee action
 * - Frequency: Once per melee per target (cooldown managed by caller)
 * - Limitations: Cannot heal shuman, fallen, or artificial beings
 *
 * Note: Clerics and priests do not use focus for this ability, but may have daily prayer/technique limits (GM's discretion)
 *
 * Source: Medieval Combat Simulator.docx - "Recovering Hit Points" section, Clergy abilities
 *
 * @param {object} healer - Cleric/Priest/Shaman performing healing
 * @param {object} target - Character being healed (must be living, not fallen or artificial)
 * @returns {object} - { method, healed, target, currentHp, error? }
 */
export function clericalHealingTouch(healer, target) {
  // Verify healer is a clerical class (Men of Faith)
  const healerProfession = (healer.profession || healer.class || "").toLowerCase();
  const validClericalClasses = ["cleric", "priest", "shaman"];

  if (!validClericalClasses.some((cls) => healerProfession.includes(cls))) {
    return {
      error: `${
        healer.name || "Character"
      } lacks divine healing ability. Only Clerics, Priests, and Shamans can use Healing Touch.`,
      healerProfession: healerProfession,
    };
  }

  // Cannot heal shuman
  const healerId = healer.id ?? healer._id;
  const targetId = target.id ?? target._id;
  if (healerId && targetId ? String(healerId) === String(targetId) : healer === target) {
    return {
      error: "Cannot use Healing Touch on yourshuman.",
    };
  }

  // Cannot heal fallen or artificial beings
  const targetType = (target.type || target.species || "").toLowerCase();
  if (
    targetType.includes("fallen") ||
    targetType.includes("artificial") ||
    targetType.includes("construct")
  ) {
    return {
      error: "Cannot use Healing Touch on fallen or artificial beings.",
      targetType: targetType,
    };
  }

  const currentHp = getFighterHP(target);

  // Healing Touch (Divine): Restores 2D6 + 2 HP per use
  const healed = rollDice("2d6") + 2;

  const newHp = clampHP(currentHp + healed, target);
  const actualHealed = newHp - currentHp;

  return {
    method: "Healing Touch (Divine)",
    healed: actualHealed,
    target: target.name || "Target",
    healer: healer.name || "Healer",
    currentHp: newHp,
    message: `${healer.name || "Healer"} lays hands on ${
      target.name || "target"
    } and restores ${actualHealed} HP through divine healing.`,
  };
}

/**
 * Healer profession focus-Based Abilities (Tactical Healing)
 *
 * Rules (Medieval Combat Simulator 1994):
 * - Healers use Inner Strength Points (focus) to manipulate life energy
 * - These are tactical rather than exceptional or clerical powers - unique to the Healer profession
 * - Equivalent to divine training but uses tactical energy instead
 *
 * Available Powers:
 * - Healing Touch: Restores 2D6+2 HP (range 4-14), costs 8 focus, touch only, others only
 * - Negate Toxins: Neutralizes poison immediately, costs 6 focus, others only
 * - Lust for Life: Stabilizes dying target, restores to 1 HP, prevents death, costs 10 focus
 * - Resurrection: Brings back the dead, costs 10 focus permanently (cannot be recovered), 40% success rate
 *
 * Source: Medieval Combat Simulator 1994 - Healer profession special abilities (PROFESSION.txt + Medieval Combat Simulator.docx)
 *
 * @param {object} healer - Healer profession character
 * @param {object} target - Target character
 * @param {string} power - Power name: 'Healing Touch', 'Negate Toxins', 'Resurrection', 'Lust for Life'
 * @returns {object} - Result object with healing/effect information
 */
export function healerAbility(healer, target, power = "Healing Touch") {
  // Verify healer is Healer profession
  const healerProfession = (healer.profession || healer.class || "").toLowerCase();
  if (!healerProfession.includes("healer")) {
    return {
      error: "Not a Healer profession",
      healerProfession: healerProfession,
    };
  }

  const currentfocus = healer.currentfocus || healer.currentIsp || healer.focus || 0;
  const maxfocus = healer.maxfocus || healer.maxIsp || healer.focus || 0;

  switch (power) {
    case "Healing Touch": {
      const cost = 8;
      if (currentfocus < cost) {
        return {
          error: "Insufficient focus.",
          currentfocus: currentfocus,
          required: cost,
        };
      }

      // Deduct focus
      const newfocus = Math.max(0, currentfocus - cost);
      if (healer.currentfocus !== undefined) {
        healer.currentfocus = newfocus;
      } else if (healer.currentIsp !== undefined) {
        healer.currentIsp = newfocus;
      } else {
        healer.focus = newfocus;
      }

      // Healing Touch: Restores 2D6+2 HP
      const healed = rollDice("2d6") + 2;
      const currentHp = getFighterHP(target);
      const newHp = clampHP(currentHp + healed, target);
      const actualHealed = newHp - currentHp;

      return {
        power,
        focusCost: cost,
        focusRemaining: newfocus,
        healed: actualHealed,
        currentHp: newHp,
        message: `${healer.name || "Healer"} uses Healing Touch on ${
          target.name || "target"
        } (${cost} focus). Restores ${actualHealed} HP.`,
      };
    }

    case "Negate Toxins": {
      const cost = 6;
      if (currentfocus < cost) {
        return {
          error: "Insufficient focus.",
          currentfocus: currentfocus,
          required: cost,
        };
      }

      // Deduct focus
      const newfocus = Math.max(0, currentfocus - cost);
      if (healer.currentfocus !== undefined) {
        healer.currentfocus = newfocus;
      } else if (healer.currentIsp !== undefined) {
        healer.currentIsp = newfocus;
      } else {
        healer.focus = newfocus;
      }

      // Remove poison status
      if (target.status) {
        target.status = target.status.filter((s) => s !== "poisoned");
      }
      if (target.statusEffects) {
        target.statusEffects = target.statusEffects.filter(
          (effect) =>
            !effect.type?.toLowerCase().includes("poison") &&
            !effect.name?.toLowerCase().includes("poison")
        );
      }

      return {
        power,
        focusCost: cost,
        focusRemaining: newfocus,
        result: `${target.name || "Target"}'s toxins neutralized.`,
        message: `${healer.name || "Healer"} uses Negate Toxins on ${
          target.name || "target"
        } (${cost} focus). All poisons are neutralized.`,
      };
    }

    case "Lust for Life": {
      const cost = 10;
      if (currentfocus < cost) {
        return {
          error: "Insufficient focus.",
          currentfocus: currentfocus,
          required: cost,
        };
      }

      // Deduct focus
      const newfocus = Math.max(0, currentfocus - cost);
      if (healer.currentfocus !== undefined) {
        healer.currentfocus = newfocus;
      } else if (healer.currentIsp !== undefined) {
        healer.currentIsp = newfocus;
      } else {
        healer.focus = newfocus;
      }

      // Stabilize at 1 HP if dying
      const currentHp = getFighterHP(target);
      if (currentHp <= 0) {
        const newHp = 1;
        applyHPToFighter(target, newHp, { updateStatus: false });

        // Remove unconscious/coma/dying status
        if (target.status) {
          target.status = target.status.filter(
            (s) =>
              !s.toLowerCase().includes("unconscious") &&
              !s.toLowerCase().includes("coma") &&
              !s.toLowerCase().includes("dying")
          );
        }
        if (target.statusEffects) {
          target.statusEffects = target.statusEffects.filter(
            (effect) =>
              !effect.type?.toLowerCase().includes("unconscious") &&
              !effect.type?.toLowerCase().includes("coma") &&
              !effect.name?.toLowerCase().includes("unconscious") &&
              !effect.name?.toLowerCase().includes("dying")
          );
        }

        return {
          power,
          focusCost: cost,
          focusRemaining: newfocus,
          result: `${target.name || "Target"} stabilized at 1 HP (revived).`,
          currentHp: newHp,
          message: `${healer.name || "Healer"} uses Lust for Life on ${
            target.name || "target"
          } (${cost} focus). ${
            target.name || "target"
          } is stabilized and restored to 1 HP.`,
        };
      } else {
        return {
          error:
            "Target is not dying. Lust for Life only works on characters at 0 HP or below.",
          currentHp: currentHp,
        };
      }
    }

    case "Resurrection": {
      const cost = 10;
      if (currentfocus < cost) {
        return {
          error: "Insufficient focus.",
          currentfocus: currentfocus,
          required: cost,
        };
      }

      const currentHp = getFighterHP(target);
      if (currentHp > -21) {
        return {
          error:
            "Target is not dead. Resurrection only works on characters with HP -21 or less.",
          currentHp: currentHp,
        };
      }

      // Deduct focus (permanently - reduces max focus)
      const newfocus = Math.max(0, currentfocus - cost);
      const newMaxfocus = Math.max(0, maxfocus - cost); // Permanently reduce max focus

      if (healer.currentfocus !== undefined) {
        healer.currentfocus = newfocus;
      } else if (healer.currentIsp !== undefined) {
        healer.currentIsp = newfocus;
      } else {
        healer.focus = newfocus;
      }

      if (healer.maxfocus !== undefined) {
        healer.maxfocus = newMaxfocus;
      } else if (healer.maxIsp !== undefined) {
        healer.maxIsp = newMaxfocus;
      } else if (healer.focus !== undefined) {
        healer.focus = newMaxfocus;
      }

      // Roll for success (40% baseline chance)
      const roll = rollPercentile();
      const success = roll <= 40;

      if (success) {
        // Restore to 1 HP
        const newHp = 1;
        applyHPToFighter(target, newHp, { updateStatus: false });

        // Remove death status
        if (target.status) {
          target.status = target.status.filter(
            (s) => !s.toLowerCase().includes("dead")
          );
        }

        return {
          power,
          focusCost: cost,
          focusRemaining: newfocus,
          focusPermanentlyLost: cost,
          focusMaxReduced: newMaxfocus,
          roll,
          success,
          result: `${target.name || "Target"} resurrected successfully.`,
          currentHp: newHp,
          message: `${healer.name || "Healer"} attempts Resurrection on ${
            target.name || "target"
          } (${cost} focus permanently lost). Roll: ${roll}%. SUCCESS! ${
            target.name || "target"
          } is restored to life at 1 HP.`,
        };
      } else {
        return {
          power,
          focusCost: cost,
          focusRemaining: newfocus,
          focusPermanentlyLost: cost,
          focusMaxReduced: newMaxfocus,
          roll,
          success,
          result: `${target.name || "Target"}'s resurrection failed.`,
          message: `${healer.name || "Healer"} attempts Resurrection on ${
            target.name || "target"
          } (${cost} focus permanently lost). Roll: ${roll}%. FAILED. The target remains dead.`,
        };
      }
    }

    default:
      return {
        error: `Unknown power: ${power}`,
        availablePowers: [
          "Healing Touch",
          "Negate Toxins",
          "Resurrection",
          "Lust for Life",
        ],
      };
  }
}

/**
 * Coma Recovery Process
 *
 * Rules (Medieval Combat Simulator 1994):
 * - When character's HP hits 0 or below, they fall into a coma
 * - To recover: Must be healed to at least 1 HP by medical, divine, or exceptional means
 * - Then roll percentile dice (D100) to see if they wake up:
 *   - 60% or higher if recovered by medical treatment
 *   - 32% or higher if recovered by exceptional or clerical healing
 * - May be attempted once per hour
 *
 * Optional Side Effects (from Optional Coma Recovery Side Effects table):
 * - If successful, roll for permanent stat penalties (scars, limps, brain damage, etc.)
 * - Brain damage can trigger optional insanity effects
 *
 * Source: Medieval Combat Simulator.docx - "Surviving Coma and Near-Death Experiences"
 *
 * @param {object} target - Character in coma (must be at 0 HP or below, healed to 1+ HP first)
 * @param {string} method - 'medical' or 'exceptional' or 'clerical'
 * @param {boolean} applySideEffects - Whether to apply optional side effects (default: true)
 * @returns {object} - { method, treatment, roll, success, result, sideEffect?, currentHp }
 */
export function comaRecovery(
  target,
  method = "medical",
  applySideEffects = true
) {
  const currentHp = getFighterHP(target);

  // Must be at 0 HP or below to be in coma
  if (currentHp >= 1) {
    return {
      message: `${target.name || "Character"} is not in a coma.`,
      currentHp: currentHp,
    };
  }

  // Roll percentile
  const roll = rollPercentile();

  // Determine success threshold based on treatment type
  const threshold = method === "medical" ? 60 : 32;
  const success = roll >= threshold;

  let result = success
    ? `${target.name || "Character"} recovers from coma at 1 HP.`
    : `${target.name || "Character"} remains in coma.`;

  if (success) {
    // Awaken at 1 HP
    const newHp = 1;
    applyHPToFighter(target, newHp, { updateStatus: false });

    // Optional Rulebook Side Effects
    let sideEffect = null;
    if (applySideEffects) {
      const sideRoll = rollPercentile();
      sideEffect = _applySideEffect(target, sideRoll);
    }

    return {
      method: "Coma Recovery",
      treatment: method,
      roll,
      threshold,
      success: true,
      result,
      sideEffect,
      currentHp: newHp,
    };
  } else {
    return {
      method: "Coma Recovery",
      treatment: method,
      roll,
      threshold,
      success: false,
      result,
      currentHp: currentHp,
    };
  }
}

/**
 * Internal helper: applies optional side effect from coma recovery
 *
 * Optional Coma Recovery Side Effects Table (Medieval Combat Simulator 1994):
 *
 * Roll (D100)	Permanent Effect
 * 1â€“10	No permanent damage
 * 11â€“20	Major scarring (â€“2 charisma)
 * 21â€“39	Limp (â€“2 SPD)
 * 40â€“55	Joint stiffness (â€“1 agility)
 * 56â€“70	Severe joint stiffness (â€“2 agility)
 * 71â€“82	Chronic pain (â€“1 endurance)
 * 83â€“92	Minor brain damage (â€“1 intellect) + optional insanity roll
 * 93â€“100	Major brain damage (â€“3 intellect, â€“1 willpower) + optional insanity roll
 *
 * Source: Medieval Combat Simulator.docx - "Optional Coma Recovery Side Effects"
 *
 * @param {object} target - Character to apply side effect to
 * @param {number} roll - D100 roll for side effect table
 * @returns {object} - { roll, effect, insanity?, updatedStats }
 */
function _applySideEffect(target, roll) {
  let effect = "No permanent damage.";
  let insanity = null;

  // Handle multiple attribute field name variations
  const getAttr = (attrName) => {
    const lowerName = attrName.toLowerCase();
    return (
      target[lowerName] ||
      target[lowerName.toUpperCase()] ||
      target.attributes?.[lowerName] ||
      target.attributes?.[lowerName.toUpperCase()] ||
      10
    ); // Default
  };

  const setAttr = (attrName, value) => {
    const lowerName = attrName.toLowerCase();
    if (target[lowerName] !== undefined) {
      target[lowerName] = value;
    } else if (target[lowerName.toUpperCase()] !== undefined) {
      target[lowerName.toUpperCase()] = value;
    } else if (target.attributes) {
      if (target.attributes[lowerName] !== undefined) {
        target.attributes[lowerName] = value;
      } else if (target.attributes[lowerName.toUpperCase()] !== undefined) {
        target.attributes[lowerName.toUpperCase()] = value;
      } else {
        target.attributes[lowerName] = value;
      }
    } else {
      target[lowerName] = value;
    }
  };

  if (roll <= 10) {
    effect = "No permanent damage.";
  } else if (roll <= 20) {
    // Major scarring (â€“2 charisma)
    const currentPB = getAttr("PB") || getAttr("pb");
    setAttr("PB", Math.max(1, currentPB - 2));
    effect = "Major scarring (â€“2 charisma)";
  } else if (roll <= 39) {
    // Limp (â€“2 SPD)
    const currentSPD = getAttr("SPD") || getAttr("spd");
    setAttr("SPD", Math.max(1, currentSPD - 2));
    effect = "Limp (â€“2 SPD)";
  } else if (roll <= 55) {
    // Joint stiffness (â€“1 agility)
    const currentPP = getAttr("PP") || getAttr("pp");
    setAttr("PP", Math.max(1, currentPP - 1));
    effect = "Joint stiffness (â€“1 agility)";
  } else if (roll <= 70) {
    // Severe joint stiffness (â€“2 agility)
    const currentPP = getAttr("PP") || getAttr("pp");
    setAttr("PP", Math.max(1, currentPP - 2));
    effect = "Severe joint stiffness (â€“2 agility)";
  } else if (roll <= 82) {
    // Chronic pain (â€“1 endurance)
    const currentPE = getAttr("PE") || getAttr("pe");
    setAttr("PE", Math.max(1, currentPE - 1));
    effect = "Chronic pain (â€“1 endurance)";
  } else if (roll <= 92) {
    // Minor brain damage (â€“1 intellect) + optional insanity roll
    const currentIQ = getAttr("IQ") || getAttr("iq");
    setAttr("IQ", Math.max(1, currentIQ - 1));
    effect = "Minor brain damage (â€“1 intellect)";
    // Trigger optional insanity effect
    insanity = _applyInsanityEffect(target);
  } else {
    // Major brain damage (â€“3 intellect, â€“1 willpower) + optional insanity roll
    const currentIQ = getAttr("IQ") || getAttr("iq");
    const currentME = getAttr("ME") || getAttr("me");
    setAttr("IQ", Math.max(1, currentIQ - 3));
    setAttr("ME", Math.max(1, currentME - 1));
    effect = "Major brain damage (â€“3 intellect, â€“1 willpower)";
    // Trigger optional insanity effect
    insanity = _applyInsanityEffect(target);
  }

  // Build updated stats object
  const updatedStats = {
    iq: getAttr("IQ") || getAttr("iq"),
    me: getAttr("ME") || getAttr("me"),
    pp: getAttr("PP") || getAttr("pp"),
    pe: getAttr("PE") || getAttr("pe"),
    pb: getAttr("PB") || getAttr("pb"),
    spd: getAttr("SPD") || getAttr("spd"),
  };

  return {
    roll,
    effect,
    insanity,
    updatedStats,
  };
}

/**
 * Internal helper: applies optional insanity effect from brain damage
 *
 * Optional Insanity Effects Table (Medieval Combat Simulator 1994):
 *
 * Roll (D100)	Psychological Condition
 * 1â€“26	None
 * 27â€“48	Phobia
 * 49â€“69	Affective disorder (depression, obsession, etc.)
 * 70â€“95	Psychosis (hallucinations, paranoia)
 * 96â€“100	Neurosis (compulsive, irrational behaviors)
 *
 * Source: Medieval Combat Simulator.docx - "Optional Coma Recovery Side Effects" â†’ "Undetected Brain Damage"
 *
 * @param {object} target - Character to apply insanity effect to
 * @returns {object} - { roll, condition, notes }
 */
function _applyInsanityEffect(target) {
  const roll = rollPercentile();
  let condition = "None";
  let notes = "";

  if (roll <= 26) {
    condition = "None";
    notes = "No psychological effects detected.";
  } else if (roll <= 48) {
    condition = "Phobia";
    notes =
      "Deep irrational fear; may freeze or flee in triggering situations.";
  } else if (roll <= 69) {
    condition = "Affective Disorder";
    notes = "Depression or obsession; â€“10% to skill rolls, poor morale.";
  } else if (roll <= 95) {
    condition = "Psychosis";
    notes = "Paranoia, hallucinations, or violent mood swings.";
  } else {
    condition = "Neurosis";
    notes = "Compulsive or irrational behaviors; may affect social checks.";
  }

  // Store in character state
  if (condition !== "None") {
    if (!target.insanities) {
      target.insanities = [];
    }
    target.insanities.push({
      condition,
      roll,
      notes,
      acquiredAt: new Date().toISOString(),
    });
  }

  return {
    roll,
    condition,
    notes,
  };
}

// Export healing system object
export const healingSystem = {
  naturalRecovery,
  medicalTreatment,
  clericalHealingTouch,
  healerAbility,
  comaRecovery,
};

export default healingSystem;

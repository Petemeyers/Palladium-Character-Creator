/**
 * Palladium Fantasy RPG - Comprehensive Healing System
 *
 * Based on official Palladium Fantasy RPG rules (1994 edition).
 * Source: Palladium.docx and Rulebook.txt
 *
 * Centralizes all healing logic:
 * - Natural recovery from rest (+2 HP/day first 2 days, +4 HP/day after)
 * - Medical treatment (First Aid, bandaging, herbal remedies) - 1D6+2 HP on success, 0 on failure
 * - Clerical/Divine Healing Touch (2D6+2 HP, any Clergy O.C.C.)
 * - Healer O.C.C. ISP-based abilities (Healing Touch, Negate Toxins, Lust for Life, Resurrection)
 * - Coma recovery with percentile rolls (60% medical, 32% magical/clerical)
 * - Optional coma recovery side effects (permanent stat penalties)
 * - Optional insanity effects (for brain damage cases)
 *
 * Integrates with:
 * - dice.js for dice rolling
 * - cryptoDice.js for percentile rolls
 */

import { rollDice } from "./dice.js";
import CryptoSecureDice from "./cryptoDice.js";

/**
 * Roll percentile (d100) - 1-100
 */
function rollPercentile() {
  return CryptoSecureDice.rollPercentile();
}

/**
 * Natural Recovery - Daily HP restoration from rest
 *
 * Rules (Palladium Fantasy RPG 1994):
 * - A character can recover hit points naturally through medical treatment and rest
 * - Includes: bandaging, stitching, wrapping wounds, herbal remedies, balms, salves, compresses, and rest
 * - Recovery rate:
 *   - +2 Hit Points per day for the first two days
 *   - +4 Hit Points per day for each day thereafter, until fully healed
 *
 * Source: Palladium.docx, section "RECOVERING HIT POINTS"
 *
 * @param {object} character - Character to heal
 * @param {number} days - Number of days rested
 * @returns {object} - { method, healed, currentHp }
 */
export function naturalRecovery(character, days = 1) {
  const maxHp = character.maxHP || character.maxHp || character.hp || 30;
  const currentHp =
    character.currentHP || character.currentHp || character.hp || 0;

  // Calculate healing: 2 HP/day for first 2 days, then 4 HP/day
  let healed = 0;
  if (days <= 2) {
    healed = 2 * days;
  } else {
    healed = 4 * (days - 2) + 4; // 2/day for first 2 days + 4/day after
  }

  const newHp = Math.min(maxHp, currentHp + healed);
  const actualHealed = newHp - currentHp;

  // Update character HP (handle multiple field name variations)
  if (character.currentHP !== undefined) {
    character.currentHP = newHp;
  } else if (character.currentHp !== undefined) {
    character.currentHp = newHp;
  } else {
    character.hp = newHp;
  }

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
 * Rules (Palladium Fantasy RPG 1994):
 * - Players may heal others using first aid, bandages, or herbs — even without magic
 * - Requires Medical skill (First Aid listed under elective or secondary skills)
 * - Doesn't instantly restore large HP amounts, but accelerates natural recovery and prevents death from blood loss or infection
 * - Success: 1D6 + 2 HP
 * - Failure: No HP recovered (time wasted, no penalties per core rules)
 *
 * Source: Palladium.docx - "Medical Treatment (Non-Magical Aid)"
 *
 * @param {object} healer - Character providing treatment (must have Medical/First Aid skill)
 * @param {object} target - Character receiving treatment
 * @param {number} skillPercent - First Aid skill percentage (d100 target)
 * @returns {object} - { method, roll, success, healed, currentHp }
 */
export function medicalTreatment(healer, target, skillPercent = 50) {
  const maxHp = target.maxHP || target.maxHp || target.hp || 30;
  const currentHp = target.currentHP || target.currentHp || target.hp || 0;

  // Roll skill check (d100 vs skill %)
  const roll = rollPercentile();
  const success = roll <= skillPercent;

  // Success: 1D6 + 2 HP, Failure: 0 HP (wasted time)
  const healed = success ? rollDice("1d6") + 2 : 0;

  const newHp = Math.min(maxHp, currentHp + healed);
  const actualHealed = newHp - currentHp;

  // Update target HP
  if (target.currentHP !== undefined) {
    target.currentHP = newHp;
  } else if (target.currentHp !== undefined) {
    target.currentHp = newHp;
  } else {
    target.hp = newHp;
  }

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
 * Rules (Palladium Fantasy RPG 1994):
 * - Clerics, priests, shamans, and other divine healers can use Healing Touch
 * - Allows them to lay hands on injured character and heal through faith and divine power
 * - Type: Divine / magical touch
 * - Effect: Restores 2D6 + 2 HP per use (range: 4-14 HP, average ~9 HP)
 * - Range: Touch only
 * - Casting Time: 1 melee action
 * - Frequency: Once per melee per target (cooldown managed by caller)
 * - Limitations: Cannot heal self, undead, or artificial beings
 *
 * Note: Clerics and priests do not use I.S.P. for this ability, but may have daily prayer/spell limits (GM's discretion)
 *
 * Source: Palladium.docx - "Recovering Hit Points" section, Clergy abilities
 *
 * @param {object} healer - Cleric/Priest/Shaman performing healing
 * @param {object} target - Character being healed (must be living, not undead or artificial)
 * @returns {object} - { method, healed, target, currentHp, error? }
 */
export function clericalHealingTouch(healer, target) {
  // Verify healer is a clerical class (Men of Faith)
  const healerOcc = (healer.occ || healer.class || "").toLowerCase();
  const validClericalClasses = ["cleric", "priest", "shaman"];

  if (!validClericalClasses.some((cls) => healerOcc.includes(cls))) {
    return {
      error: `${
        healer.name || "Character"
      } lacks divine healing ability. Only Clerics, Priests, and Shamans can use Healing Touch.`,
      healerOcc: healerOcc,
    };
  }

  // Cannot heal self
  if (
    healer._id === target._id ||
    healer.id === target.id ||
    healer.name === target.name
  ) {
    return {
      error: "Cannot use Healing Touch on yourself.",
    };
  }

  // Cannot heal undead or artificial beings
  const targetType = (target.type || target.species || "").toLowerCase();
  if (
    targetType.includes("undead") ||
    targetType.includes("artificial") ||
    targetType.includes("construct")
  ) {
    return {
      error: "Cannot use Healing Touch on undead or artificial beings.",
      targetType: targetType,
    };
  }

  const maxHp = target.maxHP || target.maxHp || target.hp || 30;
  const currentHp = target.currentHP || target.currentHp || target.hp || 0;

  // Healing Touch (Divine): Restores 2D6 + 2 HP per use
  const healed = rollDice("2d6") + 2;

  const newHp = Math.min(maxHp, currentHp + healed);
  const actualHealed = newHp - currentHp;

  // Update target HP
  if (target.currentHP !== undefined) {
    target.currentHP = newHp;
  } else if (target.currentHp !== undefined) {
    target.currentHp = newHp;
  } else {
    target.hp = newHp;
  }

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
 * Healer O.C.C. ISP-Based Abilities (Psionic Healing)
 *
 * Rules (Palladium Fantasy RPG 1994):
 * - Healers use Inner Strength Points (I.S.P.) to manipulate life energy
 * - These are psionic rather than magical or clerical powers - unique to the Healer O.C.C.
 * - Equivalent to divine magic but uses psionic energy instead
 *
 * Available Powers:
 * - Healing Touch: Restores 2D6+2 HP (range 4-14), costs 8 ISP, touch only, others only
 * - Negate Toxins: Neutralizes poison immediately, costs 6 ISP, others only
 * - Lust for Life: Stabilizes dying target, restores to 1 HP, prevents death, costs 10 ISP
 * - Resurrection: Brings back the dead, costs 10 ISP permanently (cannot be recovered), 40% success rate
 *
 * Source: Palladium Fantasy RPG 1994 - Healer O.C.C. special abilities (OCC.txt + Palladium.docx)
 *
 * @param {object} healer - Healer O.C.C. character
 * @param {object} target - Target character
 * @param {string} power - Power name: 'Healing Touch', 'Negate Toxins', 'Resurrection', 'Lust for Life'
 * @returns {object} - Result object with healing/effect information
 */
export function healerAbility(healer, target, power = "Healing Touch") {
  // Verify healer is Healer O.C.C.
  const healerOcc = (healer.occ || healer.class || "").toLowerCase();
  if (!healerOcc.includes("healer")) {
    return {
      error: "Not a Healer O.C.C.",
      healerOcc: healerOcc,
    };
  }

  const currentISP = healer.currentISP || healer.currentIsp || healer.isp || 0;
  const maxISP = healer.maxISP || healer.maxIsp || healer.ISP || 0;

  switch (power) {
    case "Healing Touch": {
      const cost = 8;
      if (currentISP < cost) {
        return {
          error: "Insufficient ISP.",
          currentISP: currentISP,
          required: cost,
        };
      }

      // Deduct ISP
      const newISP = Math.max(0, currentISP - cost);
      if (healer.currentISP !== undefined) {
        healer.currentISP = newISP;
      } else if (healer.currentIsp !== undefined) {
        healer.currentIsp = newISP;
      } else {
        healer.isp = newISP;
      }

      // Healing Touch: Restores 2D6+2 HP
      const healed = rollDice("2d6") + 2;
      const maxHp = target.maxHP || target.maxHp || target.hp || 30;
      const currentHp = target.currentHP || target.currentHp || target.hp || 0;
      const newHp = Math.min(maxHp, currentHp + healed);
      const actualHealed = newHp - currentHp;

      // Update target HP
      if (target.currentHP !== undefined) {
        target.currentHP = newHp;
      } else if (target.currentHp !== undefined) {
        target.currentHp = newHp;
      } else {
        target.hp = newHp;
      }

      return {
        power,
        ispCost: cost,
        ispRemaining: newISP,
        healed: actualHealed,
        currentHp: newHp,
        message: `${healer.name || "Healer"} uses Healing Touch on ${
          target.name || "target"
        } (${cost} ISP). Restores ${actualHealed} HP.`,
      };
    }

    case "Negate Toxins": {
      const cost = 6;
      if (currentISP < cost) {
        return {
          error: "Insufficient ISP.",
          currentISP: currentISP,
          required: cost,
        };
      }

      // Deduct ISP
      const newISP = Math.max(0, currentISP - cost);
      if (healer.currentISP !== undefined) {
        healer.currentISP = newISP;
      } else if (healer.currentIsp !== undefined) {
        healer.currentIsp = newISP;
      } else {
        healer.isp = newISP;
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
        ispCost: cost,
        ispRemaining: newISP,
        result: `${target.name || "Target"}'s toxins neutralized.`,
        message: `${healer.name || "Healer"} uses Negate Toxins on ${
          target.name || "target"
        } (${cost} ISP). All poisons are neutralized.`,
      };
    }

    case "Lust for Life": {
      const cost = 10;
      if (currentISP < cost) {
        return {
          error: "Insufficient ISP.",
          currentISP: currentISP,
          required: cost,
        };
      }

      // Deduct ISP
      const newISP = Math.max(0, currentISP - cost);
      if (healer.currentISP !== undefined) {
        healer.currentISP = newISP;
      } else if (healer.currentIsp !== undefined) {
        healer.currentIsp = newISP;
      } else {
        healer.isp = newISP;
      }

      // Stabilize at 1 HP if dying
      const currentHp = target.currentHP || target.currentHp || target.hp || 0;
      if (currentHp <= 0) {
        const newHp = 1;
        if (target.currentHP !== undefined) {
          target.currentHP = newHp;
        } else if (target.currentHp !== undefined) {
          target.currentHp = newHp;
        } else {
          target.hp = newHp;
        }

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
          ispCost: cost,
          ispRemaining: newISP,
          result: `${target.name || "Target"} stabilized at 1 HP (revived).`,
          currentHp: newHp,
          message: `${healer.name || "Healer"} uses Lust for Life on ${
            target.name || "target"
          } (${cost} ISP). ${
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
      if (currentISP < cost) {
        return {
          error: "Insufficient ISP.",
          currentISP: currentISP,
          required: cost,
        };
      }

      const currentHp = target.currentHP || target.currentHp || target.hp || 0;
      if (currentHp > -21) {
        return {
          error:
            "Target is not dead. Resurrection only works on characters with HP -21 or less.",
          currentHp: currentHp,
        };
      }

      // Deduct ISP (permanently - reduces max ISP)
      const newISP = Math.max(0, currentISP - cost);
      const newMaxISP = Math.max(0, maxISP - cost); // Permanently reduce max ISP

      if (healer.currentISP !== undefined) {
        healer.currentISP = newISP;
      } else if (healer.currentIsp !== undefined) {
        healer.currentIsp = newISP;
      } else {
        healer.isp = newISP;
      }

      if (healer.maxISP !== undefined) {
        healer.maxISP = newMaxISP;
      } else if (healer.maxIsp !== undefined) {
        healer.maxIsp = newMaxISP;
      } else if (healer.ISP !== undefined) {
        healer.ISP = newMaxISP;
      }

      // Roll for success (40% baseline chance)
      const roll = rollPercentile();
      const success = roll <= 40;

      if (success) {
        // Restore to 1 HP
        const newHp = 1;
        if (target.currentHP !== undefined) {
          target.currentHP = newHp;
        } else if (target.currentHp !== undefined) {
          target.currentHp = newHp;
        } else {
          target.hp = newHp;
        }

        // Remove death status
        if (target.status) {
          target.status = target.status.filter(
            (s) => !s.toLowerCase().includes("dead")
          );
        }

        return {
          power,
          ispCost: cost,
          ispRemaining: newISP,
          ispPermanentlyLost: cost,
          ispMaxReduced: newMaxISP,
          roll,
          success,
          result: `${target.name || "Target"} resurrected successfully.`,
          currentHp: newHp,
          message: `${healer.name || "Healer"} attempts Resurrection on ${
            target.name || "target"
          } (${cost} ISP permanently lost). Roll: ${roll}%. SUCCESS! ${
            target.name || "target"
          } is restored to life at 1 HP.`,
        };
      } else {
        return {
          power,
          ispCost: cost,
          ispRemaining: newISP,
          ispPermanentlyLost: cost,
          ispMaxReduced: newMaxISP,
          roll,
          success,
          result: `${target.name || "Target"}'s resurrection failed.`,
          message: `${healer.name || "Healer"} attempts Resurrection on ${
            target.name || "target"
          } (${cost} ISP permanently lost). Roll: ${roll}%. FAILED. The target remains dead.`,
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
 * Rules (Palladium Fantasy RPG 1994):
 * - When character's HP hits 0 or below, they fall into a coma
 * - To recover: Must be healed to at least 1 HP by medical, divine, or magical means
 * - Then roll percentile dice (D100) to see if they wake up:
 *   - 60% or higher if recovered by medical treatment
 *   - 32% or higher if recovered by magical or clerical healing
 * - May be attempted once per hour
 *
 * Optional Side Effects (from Optional Coma Recovery Side Effects table):
 * - If successful, roll for permanent stat penalties (scars, limps, brain damage, etc.)
 * - Brain damage can trigger optional insanity effects
 *
 * Source: Palladium.docx - "Surviving Coma and Near-Death Experiences"
 *
 * @param {object} target - Character in coma (must be at 0 HP or below, healed to 1+ HP first)
 * @param {string} method - 'medical' or 'magical' or 'clerical'
 * @param {boolean} applySideEffects - Whether to apply optional side effects (default: true)
 * @returns {object} - { method, treatment, roll, success, result, sideEffect?, currentHp }
 */
export function comaRecovery(
  target,
  method = "medical",
  applySideEffects = true
) {
  const currentHp = target.currentHP || target.currentHp || target.hp || 0;

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
    if (target.currentHP !== undefined) {
      target.currentHP = newHp;
    } else if (target.currentHp !== undefined) {
      target.currentHp = newHp;
    } else {
      target.hp = newHp;
    }

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
 * Optional Coma Recovery Side Effects Table (Palladium Fantasy RPG 1994):
 *
 * Roll (D100)	Permanent Effect
 * 1–10	No permanent damage
 * 11–20	Major scarring (–2 P.B.)
 * 21–39	Limp (–2 SPD)
 * 40–55	Joint stiffness (–1 P.P.)
 * 56–70	Severe joint stiffness (–2 P.P.)
 * 71–82	Chronic pain (–1 P.E.)
 * 83–92	Minor brain damage (–1 I.Q.) + optional insanity roll
 * 93–100	Major brain damage (–3 I.Q., –1 M.E.) + optional insanity roll
 *
 * Source: Palladium.docx - "Optional Coma Recovery Side Effects"
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
    // Major scarring (–2 P.B.)
    const currentPB = getAttr("PB") || getAttr("pb");
    setAttr("PB", Math.max(1, currentPB - 2));
    effect = "Major scarring (–2 P.B.)";
  } else if (roll <= 39) {
    // Limp (–2 SPD)
    const currentSPD = getAttr("SPD") || getAttr("spd");
    setAttr("SPD", Math.max(1, currentSPD - 2));
    effect = "Limp (–2 SPD)";
  } else if (roll <= 55) {
    // Joint stiffness (–1 P.P.)
    const currentPP = getAttr("PP") || getAttr("pp");
    setAttr("PP", Math.max(1, currentPP - 1));
    effect = "Joint stiffness (–1 P.P.)";
  } else if (roll <= 70) {
    // Severe joint stiffness (–2 P.P.)
    const currentPP = getAttr("PP") || getAttr("pp");
    setAttr("PP", Math.max(1, currentPP - 2));
    effect = "Severe joint stiffness (–2 P.P.)";
  } else if (roll <= 82) {
    // Chronic pain (–1 P.E.)
    const currentPE = getAttr("PE") || getAttr("pe");
    setAttr("PE", Math.max(1, currentPE - 1));
    effect = "Chronic pain (–1 P.E.)";
  } else if (roll <= 92) {
    // Minor brain damage (–1 I.Q.) + optional insanity roll
    const currentIQ = getAttr("IQ") || getAttr("iq");
    setAttr("IQ", Math.max(1, currentIQ - 1));
    effect = "Minor brain damage (–1 I.Q.)";
    // Trigger optional insanity effect
    insanity = _applyInsanityEffect(target);
  } else {
    // Major brain damage (–3 I.Q., –1 M.E.) + optional insanity roll
    const currentIQ = getAttr("IQ") || getAttr("iq");
    const currentME = getAttr("ME") || getAttr("me");
    setAttr("IQ", Math.max(1, currentIQ - 3));
    setAttr("ME", Math.max(1, currentME - 1));
    effect = "Major brain damage (–3 I.Q., –1 M.E.)";
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
 * Optional Insanity Effects Table (Palladium Fantasy RPG 1994):
 *
 * Roll (D100)	Psychological Condition
 * 1–26	None
 * 27–48	Phobia
 * 49–69	Affective disorder (depression, obsession, etc.)
 * 70–95	Psychosis (hallucinations, paranoia)
 * 96–100	Neurosis (compulsive, irrational behaviors)
 *
 * Source: Palladium.docx - "Optional Coma Recovery Side Effects" → "Undetected Brain Damage"
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
    notes = "Depression or obsession; –10% to skill rolls, poor morale.";
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

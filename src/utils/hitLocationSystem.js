/**
 * Palladium Fantasy RPG - Full Hit Location & Critical Injury System
 * -----------------------------------------------------------------
 * Random hit location with limb-specific penalties, critical injuries,
 * and permanent trauma integration.
 *
 * Compatible with:
 *   - src/utils/headTraumaSystem.js
 *   - src/utils/healingSystem.js
 *   - src/utils/comaAndDeathSystem.js
 *   - src/utils/equipmentManager.js
 *   - src/utils/reachCombatRules.js (for called shots)
 *   - src/utils/statusEffectSystem.js (for stun effects)
 *   - src/utils/combatEngine.js (integration)
 *
 * Called shots override this system entirely.
 * If useRandomHitLocations is false, all attacks hit torso by default.
 */

import CryptoSecureDice from "./cryptoDice.js";
import { processHeadTrauma } from "./headTraumaSystem.js";
import { EQUIPMENT_SLOTS } from "../data/equipmentSlots.js";
import { applyStatusEffect } from "./statusEffectSystem.js";

/**
 * Roll a d20 to determine hit location
 * @returns {{ location: string, slot: string, damageMult: number }}
 */
export function rollHitLocation() {
  const roll = CryptoSecureDice.rollD20();

  if (roll <= 2)
    return { location: "Head", slot: EQUIPMENT_SLOTS.HEAD, damageMult: 1.5 };
  if (roll <= 5)
    return {
      location: "Neck/Shoulders",
      slot: EQUIPMENT_SLOTS.NECK,
      damageMult: 1.25,
    };
  if (roll <= 10)
    return { location: "Torso", slot: EQUIPMENT_SLOTS.TORSO, damageMult: 1.0 };
  if (roll <= 13)
    return {
      location: "Right Arm",
      slot: EQUIPMENT_SLOTS.HANDS,
      damageMult: 0.8,
    };
  if (roll <= 16)
    return {
      location: "Left Arm",
      slot: EQUIPMENT_SLOTS.HANDS,
      damageMult: 0.8,
    };
  if (roll <= 18)
    return {
      location: "Right Leg",
      slot: EQUIPMENT_SLOTS.LEGS,
      damageMult: 0.75,
    };
  return { location: "Left Leg", slot: EQUIPMENT_SLOTS.LEGS, damageMult: 0.75 };
}

/**
 * Apply hit location logic to an attack result
 * @param {Object} attacker - The combatant dealing damage
 * @param {Object} target - The combatant receiving damage
 * @param {number} baseDamage - Rolled damage before modifiers
 * @param {boolean} useRandomHitLocations - Campaign setting toggle
 * @param {Object} options - Additional options
 * @param {string} options.calledShotLocation - Override location if called shot used
 * @param {number} options.knockbackFeet - Knockback distance for trauma checks
 * @param {boolean} options.failedPEroll - Whether P.E. roll failed for trauma checks
 * @returns {{ finalDamage: number, hit: Object, traumaTriggered: boolean }}
 */
export function resolveHitLocation(
  attacker,
  target,
  baseDamage,
  useRandomHitLocations = true,
  options = {}
) {
  const {
    calledShotLocation = null,
    knockbackFeet = 0,
    failedPEroll = false,
  } = options;

  // Use called shot location if specified, otherwise roll random or default to torso
  const hit = calledShotLocation
    ? getCalledShotLocation(calledShotLocation)
    : useRandomHitLocations
    ? rollHitLocation()
    : { location: "Torso", slot: EQUIPMENT_SLOTS.TORSO, damageMult: 1.0 };

  let finalDamage = Math.round(baseDamage * hit.damageMult);

  let traumaTriggered = false;
  const effects = [];

  // Initialize limb status tracking if not present
  if (!target.limbStatus) {
    target.limbStatus = {
      head: false,
      rightArm: false,
      leftArm: false,
      rightLeg: false,
      leftLeg: false,
    };
  }

  // Integration: Head Trauma System
  // Trigger conditions: 20+ damage to head/neck, or knockback > 30ft with failed P.E., or coma
  if (hit.location === "Head" || hit.location === "Neck/Shoulders") {
    const impactDamage = finalDamage;
    // Check for coma: character has 0 HP or less
    const currentHP = target.currentHP ?? target.hp ?? target.maxHP ?? 0;
    const inComa = currentHP <= 0;

    // Check if head trauma should be triggered
    if (
      (impactDamage >= 20 &&
        (hit.location === "Head" || hit.location === "Neck/Shoulders")) ||
      (knockbackFeet > 30 && failedPEroll) ||
      inComa
    ) {
      try {
        const traumaResult = processHeadTrauma(
          target,
          impactDamage,
          knockbackFeet,
          {
            targetBodyPart: hit.location === "Head" ? "head" : "neck",
            failedPEroll: failedPEroll,
            inComa: inComa,
          }
        );

        if (traumaResult.traumaOccurred) {
          traumaTriggered = true;
          effects.push("Head Trauma Risk");
          // Note: processHeadTrauma already modifies the character object
          // The calling code should handle logging the trauma message
        }
      } catch (error) {
        // Head trauma system may not be fully integrated, fail silently
        console.warn("Head trauma system not available:", error);
      }
    }

    // Head stun effect (15+ damage)
    if (hit.location === "Head" && finalDamage >= 15) {
      try {
        const stunResult = applyStatusEffect(target, "STUNNED", {
          caster: attacker,
          logCallback: () => {}, // Logging handled by caller
          bypassSave: true, // Automatic stun on head hit
        });

        if (stunResult.success) {
          // Override duration to 1 melee round for head hits
          const stunnedEffect = target.statusEffects?.find(
            (e) => e.type === "STUNNED"
          );
          if (stunnedEffect) {
            stunnedEffect.remainingRounds = 1;
            stunnedEffect.duration = 1;
          }

          // Apply additional penalties for head stun
          if (!target.bonuses) target.bonuses = {};
          if (!target.bonuses.tempPenalties) target.bonuses.tempPenalties = {};
          target.bonuses.tempPenalties.strike =
            (target.bonuses.tempPenalties.strike || 0) - 3;
          target.bonuses.tempPenalties.parry =
            (target.bonuses.tempPenalties.parry || 0) - 3;
          target.bonuses.tempPenalties.dodge =
            (target.bonuses.tempPenalties.dodge || 0) - 3;

          effects.push("Stunned 1 melee round (-3 to all rolls)");
        }
      } catch (error) {
        // Status effect system may not be available
        console.warn("Status effect system not available:", error);
      }
    }
  }

  // Initialize permanent trauma tracking if not present
  if (!target.permanentTrauma) {
    target.permanentTrauma = {
      scars: [],
      lostLimbs: [],
      statLoss: {},
    };
  }

  // Temporary limb-specific penalties (pain, stun, mobility reduction)
  applyLimbEffects(target, hit, finalDamage, effects);

  // Permanent or critical effects if severe localized damage
  applyCriticalEffects(target, hit, finalDamage, effects);

  return {
    finalDamage,
    hit,
    traumaTriggered,
    effects,
  };
}

/**
 * Get hit location for a called shot
 * @param {string} location - The called shot location (head, arm, leg, etc.)
 * @returns {{ location: string, slot: string, damageMult: number }}
 */
export function getCalledShotLocation(location) {
  const locationLower = location.toLowerCase();

  if (locationLower.includes("head")) {
    return { location: "Head", slot: EQUIPMENT_SLOTS.HEAD, damageMult: 1.5 };
  }
  if (locationLower.includes("neck")) {
    return {
      location: "Neck/Shoulders",
      slot: EQUIPMENT_SLOTS.NECK,
      damageMult: 1.25,
    };
  }
  if (
    locationLower.includes("torso") ||
    locationLower.includes("chest") ||
    locationLower.includes("body")
  ) {
    return { location: "Torso", slot: EQUIPMENT_SLOTS.TORSO, damageMult: 1.0 };
  }
  if (locationLower.includes("arm")) {
    // Default to right arm for called shots (or could randomize)
    return {
      location: "Right Arm",
      slot: EQUIPMENT_SLOTS.HANDS,
      damageMult: 0.8,
    };
  }
  if (locationLower.includes("leg")) {
    // Default to right leg for called shots (or could randomize)
    return {
      location: "Right Leg",
      slot: EQUIPMENT_SLOTS.LEGS,
      damageMult: 0.75,
    };
  }

  // Default fallback
  return { location: "Torso", slot: EQUIPMENT_SLOTS.TORSO, damageMult: 1.0 };
}

/**
 * Apply limb-specific penalties based on hit location and damage
 * @param {Object} target - Target character
 * @param {Object} hit - Hit location object
 * @param {number} damage - Final damage dealt
 * @param {string[]} effects - Array to push effect descriptions
 */
function applyLimbEffects(target, hit, damage, effects) {
  // Ensure target has limb status tracking
  if (!target.limbStatus) {
    target.limbStatus = {
      head: false,
      rightArm: false,
      leftArm: false,
      rightLeg: false,
      leftLeg: false,
    };
  }

  // Normalize limb name for status tracking
  const limbKey =
    hit.location === "Right Arm"
      ? "rightArm"
      : hit.location === "Left Arm"
      ? "leftArm"
      : hit.location === "Right Leg"
      ? "rightLeg"
      : hit.location === "Left Leg"
      ? "leftLeg"
      : null;

  switch (hit.location) {
    case "Right Arm":
    case "Left Arm":
      // Arm damage: 10+ HP disables the arm
      if (damage >= 10 && !target.limbStatus[limbKey]) {
        target.limbStatus[limbKey] = true;

        // Initialize bonuses structure if needed
        if (!target.bonuses) target.bonuses = {};
        if (!target.bonuses.tempPenalties) target.bonuses.tempPenalties = {};

        // Apply combat penalties
        target.bonuses.tempPenalties.strike =
          (target.bonuses.tempPenalties.strike || 0) - 2;
        target.bonuses.tempPenalties.parry =
          (target.bonuses.tempPenalties.parry || 0) - 2;

        // Mark as unable to use 2-handed weapons
        target.cannotUseTwoHanded = true;

        effects.push(
          `${hit.location} disabled (-2 strike, -2 parry, cannot use 2H weapons)`
        );
      }
      break;

    case "Right Leg":
    case "Left Leg":
      // Leg damage: 10+ HP injures the leg
      if (damage >= 10 && !target.limbStatus[limbKey]) {
        target.limbStatus[limbKey] = true;

        // Initialize bonuses structure if needed
        if (!target.bonuses) target.bonuses = {};
        if (!target.bonuses.tempPenalties) target.bonuses.tempPenalties = {};

        // Apply speed penalty (50% reduction)
        const baseSpeed = target.attributes?.SPD || target.SPD || 10;
        target.speedPenalty = Math.floor(baseSpeed / 2);
        target.speedMultiplier = 0.5; // Store multiplier for movement system

        // Apply dodge penalty
        target.bonuses.tempPenalties.dodge =
          (target.bonuses.tempPenalties.dodge || 0) - 1;

        effects.push(`${hit.location} injured (-50% speed, -1 dodge)`);
      }
      break;

    default:
      // Torso, Head, Neck have no special limb penalties (handled elsewhere)
      break;
  }
}

/**
 * Apply permanent or critical effects if severe localized damage
 * @param {Object} target - Target character
 * @param {Object} hit - Hit location object
 * @param {number} damage - Final damage dealt
 * @param {string[]} effects - Array to push effect descriptions
 */
function applyCriticalEffects(target, hit, damage, effects) {
  // Ensure permanent trauma tracking exists
  if (!target.permanentTrauma) {
    target.permanentTrauma = {
      scars: [],
      lostLimbs: [],
      statLoss: {},
    };
  }

  // Head criticals - severe brain damage (40+ HP)
  if (hit.location === "Head" && damage >= 40) {
    // Only apply once per severe trauma (check if IQ loss already applied)
    if (
      target.permanentTrauma.statLoss.IQ === undefined ||
      target.permanentTrauma.statLoss.IQ === null
    ) {
      target.permanentTrauma.statLoss.IQ = -2;
      target.permanentTrauma.statLoss.ME = -1;

      // Apply stat loss to character attributes
      if (target.attributes) {
        target.attributes.IQ = Math.max(1, (target.attributes.IQ || 10) - 2);
        target.attributes.ME = Math.max(1, (target.attributes.ME || 10) - 1);
      } else if (target.IQ !== undefined) {
        target.IQ = Math.max(1, (target.IQ || 10) - 2);
        target.ME = Math.max(1, (target.ME || 10) - 1);
      }

      effects.push(
        "💀 Severe Head Trauma: Permanent memory loss (-2 I.Q., -1 M.E.)"
      );
    }
  }

  // Arms - limb destruction (30+ HP)
  if (
    (hit.location === "Right Arm" || hit.location === "Left Arm") &&
    damage >= 30
  ) {
    if (!target.permanentTrauma.lostLimbs.includes(hit.location)) {
      target.permanentTrauma.lostLimbs.push(hit.location);

      // Mark limb as permanently lost
      if (!target.limbStatus) {
        target.limbStatus = {};
      }
      target.limbStatus[hit.location === "Right Arm" ? "rightArm" : "leftArm"] =
        "severed";

      // Permanent combat penalties
      if (!target.bonuses) target.bonuses = {};
      if (!target.bonuses.permanentPenalties)
        target.bonuses.permanentPenalties = {};
      target.bonuses.permanentPenalties.strike =
        (target.bonuses.permanentPenalties.strike || 0) - 2;
      target.bonuses.permanentPenalties.parry =
        (target.bonuses.permanentPenalties.parry || 0) - 2;

      // Cannot use two-handed weapons
      target.cannotUseTwoHanded = true;

      effects.push(`🩸 ${hit.location} destroyed (limb severed or crippled)`);
    }
  }

  // Legs - crippling or loss (30+ HP)
  if (
    (hit.location === "Right Leg" || hit.location === "Left Leg") &&
    damage >= 30
  ) {
    if (!target.permanentTrauma.lostLimbs.includes(hit.location)) {
      target.permanentTrauma.lostLimbs.push(hit.location);

      // Mark limb as permanently lost/crippled
      if (!target.limbStatus) {
        target.limbStatus = {};
      }
      target.limbStatus[hit.location === "Right Leg" ? "rightLeg" : "leftLeg"] =
        "crippled";

      // Permanent speed reduction
      const baseSpeed = target.attributes?.SPD || target.SPD || 10;
      const speedLoss = 6;
      if (target.attributes) {
        target.attributes.SPD = Math.max(1, baseSpeed - speedLoss);
      } else {
        target.SPD = Math.max(1, baseSpeed - speedLoss);
      }

      // Permanent movement penalty
      if (!target.permanentSpeedPenalty) {
        target.permanentSpeedPenalty = 0;
      }
      target.permanentSpeedPenalty += speedLoss;

      effects.push(`🩸 ${hit.location} crippled or lost (-6 SPD permanently)`);
    }
  }

  // Torso/Neck severe hits - crushed chest or spine (50+ HP)
  if (
    (hit.location === "Torso" || hit.location === "Neck/Shoulders") &&
    damage >= 50
  ) {
    // Check if already applied to avoid stacking
    const traumaKey = `${hit.location}_${Math.floor(damage / 10)}`;
    if (!target.permanentTrauma.statLoss[traumaKey]) {
      target.permanentTrauma.statLoss[traumaKey] = true;

      target.permanentTrauma.statLoss.PE =
        (target.permanentTrauma.statLoss.PE || 0) - 1;
      target.permanentTrauma.statLoss.PP =
        (target.permanentTrauma.statLoss.PP || 0) - 1;

      // Apply stat loss to character attributes
      if (target.attributes) {
        target.attributes.PE = Math.max(1, (target.attributes.PE || 10) - 1);
        target.attributes.PP = Math.max(1, (target.attributes.PP || 10) - 1);
      } else if (target.PE !== undefined) {
        target.PE = Math.max(1, (target.PE || 10) - 1);
        target.PP = Math.max(1, (target.PP || 10) - 1);
      }

      effects.push("💔 Crushed chest or spine injury (-1 P.E., -1 P.P.)");
    }
  }

  // Scarring chance (40% chance for 15+ damage)
  if (damage >= 15 && CryptoSecureDice.rollPercentile() <= 40) {
    const scar = `${hit.location} scar (${Math.floor(damage)} dmg)`;
    if (!target.permanentTrauma.scars.includes(scar)) {
      target.permanentTrauma.scars.push(scar);
      effects.push(`⚔️ ${scar} leaves a lasting mark`);
    }
  }
}

/**
 * Utility: Clear temporary limb effects after healing or rest
 * Can be called by healingSystem.js or after combat
 * @param {Object} target - Character to clear effects from
 */
export function clearLimbEffects(target) {
  if (!target.limbStatus) return;

  // Reset only temporary limb status (not permanent losses)
  Object.keys(target.limbStatus).forEach((key) => {
    if (target.limbStatus[key] === true) {
      // Only clear temporary injuries, not permanent losses
      target.limbStatus[key] = false;
    }
    // Leave "severed" or "crippled" status intact
  });

  // Clear temporary penalties (but not permanent ones)
  if (target.bonuses?.tempPenalties) {
    target.bonuses.tempPenalties.strike = 0;
    target.bonuses.tempPenalties.parry = 0;
    target.bonuses.tempPenalties.dodge = 0;
  }

  // Clear temporary movement penalties (but not permanent speed loss)
  if (target.speedPenalty) {
    target.speedPenalty = 0;
  }
  if (target.speedMultiplier !== undefined && !target.permanentSpeedPenalty) {
    target.speedMultiplier = 1.0;
  }

  // Clear temporary weapon restrictions (but not permanent ones from lost limbs)
  if (target.cannotUseTwoHanded && !target.permanentTrauma?.lostLimbs?.length) {
    target.cannotUseTwoHanded = false;
  }

  // Clear stun status
  target.stunned = false;
  target.stunDuration = 0;
}

/**
 * Removes permanent trauma (for magical or divine healing)
 * Can restore lost limbs, stat loss, and remove scars
 * @param {Object} target - Character to restore
 * @param {Object} options - Restoration options
 * @param {boolean} options.restoreLimbs - Restore lost limbs (default: true)
 * @param {boolean} options.restoreStats - Restore lost stats (default: true)
 * @param {boolean} options.removeScars - Remove scars (default: true)
 * @returns {Object} Summary of what was restored
 */
export function restorePermanentTrauma(target, options = {}) {
  const {
    restoreLimbs = true,
    restoreStats = true,
    removeScars = true,
  } = options;

  if (!target.permanentTrauma) {
    return {
      restored: false,
      message: "No permanent trauma to restore",
    };
  }

  const restored = {
    limbs: [],
    stats: {},
    scars: [],
  };

  // Restore lost limbs
  if (restoreLimbs && target.permanentTrauma.lostLimbs) {
    target.permanentTrauma.lostLimbs.forEach((limb) => {
      // Restore limb status
      if (!target.limbStatus) {
        target.limbStatus = {};
      }
      const limbKey =
        limb === "Right Arm"
          ? "rightArm"
          : limb === "Left Arm"
          ? "leftArm"
          : limb === "Right Leg"
          ? "rightLeg"
          : limb === "Left Leg"
          ? "leftLeg"
          : null;

      if (limbKey && target.limbStatus[limbKey] === "severed") {
        target.limbStatus[limbKey] = false;
        restored.limbs.push(limb);
      } else if (limbKey && target.limbStatus[limbKey] === "crippled") {
        target.limbStatus[limbKey] = false;

        // Restore speed
        if (target.permanentSpeedPenalty) {
          const speedRestored = Math.min(6, target.permanentSpeedPenalty);
          if (target.attributes) {
            target.attributes.SPD =
              (target.attributes.SPD || 1) + speedRestored;
          } else {
            target.SPD = (target.SPD || 1) + speedRestored;
          }
          target.permanentSpeedPenalty = Math.max(
            0,
            target.permanentSpeedPenalty - speedRestored
          );
        }

        restored.limbs.push(limb);
      }
    });

    target.permanentTrauma.lostLimbs = [];
  }

  // Restore lost stats
  if (restoreStats && target.permanentTrauma.statLoss) {
    Object.keys(target.permanentTrauma.statLoss).forEach((stat) => {
      if (stat === "IQ" || stat === "ME" || stat === "PE" || stat === "PP") {
        const loss = target.permanentTrauma.statLoss[stat] || 0;
        if (loss < 0) {
          // Restore the stat
          if (target.attributes) {
            target.attributes[stat] = (target.attributes[stat] || 1) - loss; // loss is negative
          } else {
            target[stat] = (target[stat] || 1) - loss;
          }
          restored.stats[stat] = -loss; // Track how much was restored
        }
      }
    });

    // Clear stat loss tracking
    target.permanentTrauma.statLoss = {};
  }

  // Remove scars
  if (removeScars && target.permanentTrauma.scars) {
    restored.scars = [...target.permanentTrauma.scars];
    target.permanentTrauma.scars = [];
  }

  // Clear permanent penalties
  if (target.bonuses?.permanentPenalties) {
    target.bonuses.permanentPenalties = {};
  }

  // Restore two-handed weapon capability if no limbs are lost
  if (restored.limbs.length > 0) {
    target.cannotUseTwoHanded = false;
  }

  return {
    restored: true,
    details: restored,
    message: `Restored: ${restored.limbs.length} limbs, ${
      Object.keys(restored.stats).length
    } stat(s), ${restored.scars.length} scar(s)`,
  };
}

/**
 * Get hit location description for combat log
 * @param {Object} hit - Hit location object from rollHitLocation()
 * @param {number} damage - Final damage dealt
 * @returns {string} Formatted description
 */
export function getHitLocationDescription(hit, damage) {
  return `💥 ${hit.location} (${Math.round(
    damage
  )} dmg ×${hit.damageMult.toFixed(2)})`;
}

/**
 * Get current limb status summary for a character
 * @param {Object} character - Character to check
 * @returns {Object} Summary of limb status and penalties
 */
export function getLimbStatusSummary(character) {
  const summary = {
    disabledLimbs: [],
    lostLimbs: [],
    penalties: {
      strike: 0,
      parry: 0,
      dodge: 0,
      speed: 0,
    },
    permanentPenalties: {
      strike: 0,
      parry: 0,
      speed: 0,
    },
    cannotUseTwoHanded: false,
    speedMultiplier: 1.0,
    scars: [],
    statLoss: {},
  };

  // Check limb status
  if (character.limbStatus) {
    if (character.limbStatus.rightArm === true) {
      summary.disabledLimbs.push("Right Arm");
      summary.penalties.strike -= 2;
      summary.penalties.parry -= 2;
    } else if (character.limbStatus.rightArm === "severed") {
      summary.lostLimbs.push("Right Arm");
      summary.permanentPenalties.strike -= 2;
      summary.permanentPenalties.parry -= 2;
    }

    if (character.limbStatus.leftArm === true) {
      summary.disabledLimbs.push("Left Arm");
      summary.penalties.strike -= 2;
      summary.penalties.parry -= 2;
    } else if (character.limbStatus.leftArm === "severed") {
      summary.lostLimbs.push("Left Arm");
      summary.permanentPenalties.strike -= 2;
      summary.permanentPenalties.parry -= 2;
    }

    if (character.limbStatus.rightLeg === true) {
      summary.disabledLimbs.push("Right Leg");
      summary.penalties.dodge -= 1;
    } else if (character.limbStatus.rightLeg === "crippled") {
      summary.lostLimbs.push("Right Leg");
      summary.permanentPenalties.speed -= 6;
    }

    if (character.limbStatus.leftLeg === true) {
      summary.disabledLimbs.push("Left Leg");
      summary.penalties.dodge -= 1;
    } else if (character.limbStatus.leftLeg === "crippled") {
      summary.lostLimbs.push("Left Leg");
      summary.permanentPenalties.speed -= 6;
    }
  }

  // Add temporary penalties
  if (character.bonuses?.tempPenalties) {
    summary.penalties.strike += character.bonuses.tempPenalties.strike || 0;
    summary.penalties.parry += character.bonuses.tempPenalties.parry || 0;
    summary.penalties.dodge += character.bonuses.tempPenalties.dodge || 0;
  }

  // Add permanent penalties
  if (character.bonuses?.permanentPenalties) {
    summary.permanentPenalties.strike +=
      character.bonuses.permanentPenalties.strike || 0;
    summary.permanentPenalties.parry +=
      character.bonuses.permanentPenalties.parry || 0;
  }

  // Combine temporary and permanent penalties
  summary.penalties.strike += summary.permanentPenalties.strike;
  summary.penalties.parry += summary.permanentPenalties.parry;

  // Speed penalties
  summary.penalties.speed = character.speedPenalty || 0;
  if (character.permanentSpeedPenalty) {
    summary.permanentPenalties.speed += character.permanentSpeedPenalty;
    summary.penalties.speed += character.permanentSpeedPenalty;
  }

  // Weapon restrictions
  summary.cannotUseTwoHanded = character.cannotUseTwoHanded || false;
  summary.speedMultiplier = character.speedMultiplier || 1.0;

  // Permanent trauma
  if (character.permanentTrauma) {
    summary.scars = [...(character.permanentTrauma.scars || [])];
    summary.statLoss = { ...(character.permanentTrauma.statLoss || {}) };
    if (character.permanentTrauma.lostLimbs) {
      summary.lostLimbs = [
        ...new Set([
          ...summary.lostLimbs,
          ...character.permanentTrauma.lostLimbs,
        ]),
      ];
    }
  }

  return summary;
}

export default {
  rollHitLocation,
  resolveHitLocation,
  getCalledShotLocation,
  getHitLocationDescription,
  clearLimbEffects,
  restorePermanentTrauma,
  getLimbStatusSummary,
};

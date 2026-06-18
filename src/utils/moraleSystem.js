// src/utils/moraleSystem.js
import CryptoSecureDice from "./cryptoDice";
import combatantBehaviorData from "../data/combatantBehavior.json";

// Ã°Å¸â€Â¹ Simple fallen detector by name/species
const DEFEATED_KEYWORDS = [
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

// Ã°Å¸â€Â¹ Simple raider detector by name/species
const RAIDER_KEYWORDS = [
  "raider",
  "devil",
  "fiend",
  "baal-rog",
  "baal_rog",
  "baalrog",
  "infernal",
  "hellspawn",
];

export function isFallenFighter(fighter) {
  const label = (
    fighter?.species ||
    fighter?.race ||
    fighter?.type ||
    fighter?.name ||
    ""
  ).toLowerCase();

  if (!label) return false;
  return DEFEATED_KEYWORDS.some((word) => label.includes(word));
}

export function isRaiderFighter(fighter) {
  if (fighter?.isRaider === true) return true;
  
  const label = (
    fighter?.species ||
    fighter?.race ||
    fighter?.type ||
    fighter?.name ||
    fighter?.category ||
    ""
  ).toLowerCase();

  if (!label) return false;
  return RAIDER_KEYWORDS.some((word) => label.includes(word));
}

/**
 * Centralized fear immunity check used by Horror System, Morale System, and Routing logic.
 * Returns true if the fighter is immune to fear effects (dreadRating, morale routing, etc.)
 * 
 * @param {Object} fighter - Fighter object to check
 * @returns {boolean} True if fighter is immune to fear
 */
export function isFearImmune(fighter) {
  if (!fighter) return false;
  
  return (
    fighter.isFearless ||
    fighter.fearless ||
    fighter.immuneToHorror ||
    fighter.neverFlee ||
    fighter.type === "raider" ||
    fighter.type === "devil" ||
    fighter.type === "fallen" ||
    isFallenFighter(fighter) ||
    isRaiderFighter(fighter)
  );
}

/**
 * Compute a base morale target from ME and level.
 */
export function getBaseMorale(fighter) {
  if (!fighter) return 10;

  const ME =
    fighter.attributes?.ME ||
    fighter.ME ||
    fighter.stats?.ME ||
    10;

  const level =
    fighter.level ||
    fighter.levelValue ||
    fighter.levels?.fighter ||
    1;

  const raw = ME + Math.floor(level / 2);
  return Math.max(6, Math.min(18, raw));
}

/**
 * Determine surrender behavior based on species/race and alignment.
 * Uses data-driven combatantBehavior.json for configuration.
 */
export function getSurrenderProfile(fighter) {
  if (!fighter) {
    return { canSurrender: true, surrenderBias: 0, neverFlee: false };
  }

  const rawSpecies =
    fighter.species ||
    fighter.race ||
    fighter.combatantType ||
    fighter.type ||
    fighter.name ||
    "";
  const speciesKey = String(rawSpecies).toLowerCase().trim();

  const rawAlignment =
    fighter.alignment ||
    fighter.align ||
    fighter.algn ||
    "";
  const alignmentKey = String(rawAlignment).toLowerCase().trim();

  const speciesMap = combatantBehaviorData.species || {};
  const alignmentMap = combatantBehaviorData.alignment || {};

  // Try exact species match first
  let speciesProfile =
    speciesMap[speciesKey] ||
    null;

  // If not found, try some simple normalization / fallback
  if (!speciesProfile) {
    // Fallen variants
    if (
      speciesKey.includes("fallen") ||
      speciesKey.includes("skeleton") ||
      speciesKey.includes("zombie") ||
      speciesKey.includes("mummy") ||
      speciesKey.includes("scarecrow")
    ) {
      // Try specific fallen first, then generic
      if (speciesKey.includes("mummy")) speciesProfile = speciesMap["mummy"];
      else if (speciesKey.includes("scarecrow")) speciesProfile = speciesMap["scarecrow"];
      else if (speciesKey.includes("ghost")) speciesProfile = speciesMap["ghost"];
      else if (speciesKey.includes("spectre")) speciesProfile = speciesMap["spectre"];
      else speciesProfile = speciesMap["fallen"];
    }
    // Shape-shifters
    else if (speciesKey.includes("werewolf")) speciesProfile = speciesMap["werewolf"];
    else if (speciesKey.includes("weretiger")) speciesProfile = speciesMap["weretiger"];
    else if (speciesKey.includes("werepanther")) speciesProfile = speciesMap["werepanther"];
    else if (speciesKey.includes("werebear")) speciesProfile = speciesMap["werebear"];
    // Exceptional combatants
    else if (speciesKey.includes("unicorn")) speciesProfile = speciesMap["unicorn"];
    else if (speciesKey.includes("pegasus")) speciesProfile = speciesMap["pegasus"];
    else if (speciesKey.includes("gryphon") || speciesKey.includes("griffin")) speciesProfile = speciesMap["gryphon"];
    else if (speciesKey.includes("sphinx")) speciesProfile = speciesMap["sphinx"];
    else if (speciesKey.includes("chimera")) speciesProfile = speciesMap["chimera"];
    else if (speciesKey.includes("arena-champion")) speciesProfile = speciesMap["arena-champion"];
    // Other common species
    else if (speciesKey.includes("brigand")) speciesProfile = speciesMap["brigand"];
    else if (speciesKey.includes("brigand")) speciesProfile = speciesMap["brigand"];
    else if (speciesKey.includes("raider")) speciesProfile = speciesMap["raider"];
    else if (speciesKey.includes("champion")) speciesProfile = speciesMap["champion"];
    else if (speciesKey.includes("heavy fighter")) speciesProfile = speciesMap["heavy fighter"];
    else if (speciesKey.includes("harpy")) speciesProfile = speciesMap["harpy"];
    else if (speciesKey.includes("bugbear") || speciesKey.includes("bug bear")) speciesProfile = speciesMap["bugBear"];
    else if (speciesKey.includes("human")) speciesProfile = speciesMap["human"];
    else if (speciesKey.includes("human")) speciesProfile = speciesMap["human"];
    else if (speciesKey.includes("human")) speciesProfile = speciesMap["human"];
    else if (speciesKey.includes("golem")) speciesProfile = speciesMap["golem"];
    else if (speciesKey.includes("raider")) speciesProfile = speciesMap["raider"];
  }

  if (!speciesProfile) {
    speciesProfile = speciesMap["defaultHumanoid"] || {
      canSurrender: true,
      surrenderBias: 1,
      neverFlee: false
    };
  }

  // Map broad categories to specific alignments for better matching
  const alignmentCategoryMap = {
    "good": "principled",      // Good aligns with principled/scrupulous
    "selfish": "unprincipled",  // Shumanish aligns with unprincipled/anarchist
    "evil": "miscreant",        // Evil aligns with miscreant/aberrant/diabolic
    "neutral": "default"
  };

  // Try exact match first
  let alignProfile = alignmentMap[alignmentKey];
  
  // If not found, try broad category mapping
  if (!alignProfile && alignmentCategoryMap[alignmentKey]) {
    alignProfile = alignmentMap[alignmentCategoryMap[alignmentKey]];
  }
  
  // If still not found, try loose match (e.g. "Good: Principled" or "Principled (Good)")
  if (!alignProfile) {
    alignProfile = Object.entries(alignmentMap).find(([k]) =>
      alignmentKey.includes(k) || k.includes(alignmentKey)
    )?.[1];
  }
  
  // Fallback to default
  alignProfile = alignProfile || alignmentMap["default"] || { surrenderBiasDelta: 0 };

  const canSurrender = !!speciesProfile.canSurrender;
  const neverFlee = !!speciesProfile.neverFlee;
  const surrenderBias =
    (speciesProfile.surrenderBias || 0) +
    (alignProfile.surrenderBiasDelta || 0);

  return { canSurrender, surrenderBias, neverFlee };
}

/**
 * Normalize moraleState.
 */
export function ensureMoraleState(fighter) {
  const base = fighter.moraleState || {};
  return {
    status: base.status || "STEADY", // STEADY | SHAKEN | ROUTED | SURRENDERED
    moraleValue:
      typeof base.moraleValue === "number"
        ? base.moraleValue
        : getBaseMorale(fighter),
    failedChecks: base.failedChecks || 0,
    lastCheckRound: base.lastCheckRound || 0,
    lastReason: base.lastReason || null,
    hasFled: base.hasFled || false,
  };
}

/**
 * Resolve a morale check.
 *
 * context:
 *   roundNumber        Ã¢â‚¬â€œ current round (for throttling checks)
 *   reason             Ã¢â‚¬â€œ "pain_hit" | "damage" | "ally_down" | "horror" | etc
 *   hpPercent          Ã¢â‚¬â€œ 0Ã¢â‚¬â€œ1 fraction
 *   alliesDownRatio    Ã¢â‚¬â€œ 0Ã¢â‚¬â€œ1 fraction
 *   horrorFailed       Ã¢â‚¬â€œ bool
 *   bigPainHit         Ã¢â‚¬â€œ bool
 */
export function resolveMoraleCheck(fighter, context = {}) {
  if (!fighter) {
    return {
      success: true,
      result: null,
      moraleState: ensureMoraleState(fighter || {}),
    };
  }

  // Ã°Å¸â€ºÂ¡Ã¯Â¸Â Fear-immune combatants never fail morale checks (no ROUTED/SURRENDER)
  if (isFearImmune(fighter)) {
    const previous = fighter.moraleState || {};
    const logger = context.logger || context.log || (() => {});

    const moraleState = {
      ...previous,
      status: "STEADY", // Fraidere to STEADY (rule-accurate)
      failedChecks: 0, // Reset failed checks
      lastCheckRound:
        context.roundNumber ?? previous.lastCheckRound ?? null,
      notes: "Fear-immune: immune to morale, never rout or surrender.",
    };

    if (logger) {
      logger(
        `Ã°Å¸â€ºÂ¡Ã¯Â¸Â ${fighter.name} is immune to fear and ignores morale checks (never flees).`
      );
    }

    return {
      success: true,
      moraleState,
      result: "AUTO_PASS_FEAR_IMMUNE",
    };
  }

  const {
    roundNumber = 0,
    reason = "generic",
    hpPercent = 1,
    alliesDownRatio = 0,
    horrorFailed = false,
    bigPainHit = false,
    damageDealt = 0,
  } = context;

  const baseState = ensureMoraleState(fighter);
  const baseMorale = baseState.moraleValue;

  let target = baseMorale;

  // Higher target is harder to pass because success is d20 >= target.
  if (hpPercent <= 0.25) target += 2;
  if (hpPercent <= 0.1) target += 2;
  if (alliesDownRatio >= 0.5) target += 2;
  if (alliesDownRatio >= 0.75) target += 2;
  if (horrorFailed) target += 2;
  if (bigPainHit) target += 1;
  if (baseState.status === "SHAKEN") target += 1;

  const damageNumber = Number(damageDealt) || 0;
  if (reason === "damage" && damageNumber > 0 && damageNumber <= 2 && hpPercent > 0.5) {
    target -= 3;
  }
  
  // Phobia penalty: if reason is "horror" and fighter has a matching phobia, additional penalty
  if (reason === "horror" && fighter.mentalState?.disorders) {
    const disorders = fighter.mentalState.disorders || [];
    // Check if any phobia matches (we'll need to pass combatant info in context for exact match)
    // For now, if they have any phobia and reason is horror, apply penalty
    const hasPhobia = disorders.some(d => d.type === "phobia");
    if (hasPhobia) {
      target += 2; // Additional pressure for phobia
    }
  }

  // Bonuses Ã¢â‚¬â€œ brave classes
  const profession = fighter.PROFESSION || fighter.profession || "";
  if (/Knight|Paladin|Soldier|Men-at-Arms/i.test(profession)) {
    target -= 2;
  }
  const combatantText = [
    fighter.name,
    fighter.race,
    fighter.species,
    fighter.category,
    fighter.combatantType,
    fighter.aiProfile,
  ].join(" ").toLowerCase();
  if (
    fighter.dreadRating ||
    fighter.dreadRating ||
    fighter.brute ||
    fighter.opponent ||
    combatantText.includes("arena-champion") ||
    combatantText.includes("opponent") ||
    combatantText.includes("brute")
  ) {
    target -= 3;
  }
  if (fighter.cowardly || fighter.moraleProfile === "cowardly" || combatantText.includes("coward")) {
    target += 2;
  }

  // Roll: d20 vs target
  const rollResult = CryptoSecureDice.rollD20();
  const roll = rollResult.totalWithBonus;
  const success = roll >= target;

  let newStatus = baseState.status;
  let failedChecks = baseState.failedChecks;
  if (!success) {
    failedChecks += 1;
    if (newStatus === "STEADY") newStatus = "SHAKEN";
    
    // Default panic behavior
    if (failedChecks >= 2 || hpPercent <= 0.1 || alliesDownRatio >= 0.75) {
      newStatus = "ROUTED";
    }
    
    // LOW-HP "I give up" logic with species/alignment influence
    if (hpPercent <= 0.10 && reason === "low_hp") {
      const { canSurrender, surrenderBias } = getSurrenderProfile(fighter);
      
      if (canSurrender) {
        // How badly did they fail? Bigger margin = more likely to surrender.
        const panicMargin = target - roll; // target and roll are in scope here
        const surrenderScore = panicMargin + surrenderBias;
        
        // Tune this threshold to taste:
        //  - Cowardly brigands: high bias, small failure => surrender
        //  - Brave knights: need a huge failure to surrender
        if (surrenderScore >= 3) {
          newStatus = "SURRENDERED";
        }
        // else: leave as ROUTED / SHAKEN from above
      } else {
        // Never surrender: keep ROUTED/SHOCK behavior, no SURRENDER override.
        if (newStatus === "SURRENDERED") {
          newStatus = "ROUTED";
        }
      }
    }
  }

  const moraleState = {
    ...baseState,
    status: newStatus,
    failedChecks,
    lastCheckRound: roundNumber,
    lastReason: reason,
  };

  return {
    success,
    result: {
      roll,
      target,
      baseMorale,
      reason,
    },
    moraleState,
  };
}


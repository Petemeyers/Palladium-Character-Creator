// src/utils/moraleSystem.js
import CryptoSecureDice from "./cryptoDice";
import speciesBehaviorData from "../data/speciesBehavior.json";

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
 * Uses data-driven speciesBehavior.json for configuration.
 */
export function getSurrenderProfile(fighter) {
  if (!fighter) {
    return { canSurrender: true, surrenderBias: 0, neverFlee: false };
  }

  const rawSpecies =
    fighter.species ||
    fighter.race ||
    fighter.creatureType ||
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

  const speciesMap = speciesBehaviorData.species || {};
  const alignmentMap = speciesBehaviorData.alignment || {};

  // Try exact species match first
  let speciesProfile =
    speciesMap[speciesKey] ||
    null;

  // If not found, try some simple normalization / fallback
  if (!speciesProfile) {
    // Undead variants
    if (
      speciesKey.includes("undead") ||
      speciesKey.includes("skeleton") ||
      speciesKey.includes("zombie") ||
      speciesKey.includes("mummy") ||
      speciesKey.includes("scarecrow")
    ) {
      // Try specific undead first, then generic
      if (speciesKey.includes("mummy")) speciesProfile = speciesMap["mummy"];
      else if (speciesKey.includes("scarecrow")) speciesProfile = speciesMap["scarecrow"];
      else if (speciesKey.includes("ghost")) speciesProfile = speciesMap["ghost"];
      else if (speciesKey.includes("spectre")) speciesProfile = speciesMap["spectre"];
      else speciesProfile = speciesMap["undead"];
    }
    // Shape-shifters
    else if (speciesKey.includes("werewolf")) speciesProfile = speciesMap["werewolf"];
    else if (speciesKey.includes("weretiger")) speciesProfile = speciesMap["weretiger"];
    else if (speciesKey.includes("werepanther")) speciesProfile = speciesMap["werepanther"];
    else if (speciesKey.includes("werebear")) speciesProfile = speciesMap["werebear"];
    // Magical creatures
    else if (speciesKey.includes("unicorn")) speciesProfile = speciesMap["unicorn"];
    else if (speciesKey.includes("pegasus")) speciesProfile = speciesMap["pegasus"];
    else if (speciesKey.includes("gryphon") || speciesKey.includes("griffin")) speciesProfile = speciesMap["gryphon"];
    else if (speciesKey.includes("sphinx")) speciesProfile = speciesMap["sphinx"];
    else if (speciesKey.includes("chimera")) speciesProfile = speciesMap["chimera"];
    else if (speciesKey.includes("minotaur")) speciesProfile = speciesMap["minotaur"];
    // Other common species
    else if (speciesKey.includes("goblin")) speciesProfile = speciesMap["goblin"];
    else if (speciesKey.includes("kobold")) speciesProfile = speciesMap["kobold"];
    else if (speciesKey.includes("orc")) speciesProfile = speciesMap["orc"];
    else if (speciesKey.includes("troll")) speciesProfile = speciesMap["troll"];
    else if (speciesKey.includes("ogre")) speciesProfile = speciesMap["ogre"];
    else if (speciesKey.includes("harpy")) speciesProfile = speciesMap["harpy"];
    else if (speciesKey.includes("bugbear") || speciesKey.includes("bug bear")) speciesProfile = speciesMap["bugBear"];
    else if (speciesKey.includes("human")) speciesProfile = speciesMap["human"];
    else if (speciesKey.includes("elf")) speciesProfile = speciesMap["elf"];
    else if (speciesKey.includes("dwarf")) speciesProfile = speciesMap["dwarf"];
    else if (speciesKey.includes("golem")) speciesProfile = speciesMap["golem"];
    else if (speciesKey.includes("demon")) speciesProfile = speciesMap["demon"];
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
    "selfish": "unprincipled",  // Selfish aligns with unprincipled/anarchist
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
 *   roundNumber        – current round (for throttling checks)
 *   reason             – "pain_hit" | "damage" | "ally_down" | "horror" | etc
 *   hpPercent          – 0–1 fraction
 *   alliesDownRatio    – 0–1 fraction
 *   horrorFailed       – bool
 *   bigPainHit         – bool
 */
export function resolveMoraleCheck(fighter, context = {}) {
  if (!fighter) {
    return {
      success: true,
      result: null,
      moraleState: ensureMoraleState(fighter || {}),
    };
  }

  const {
    roundNumber = 0,
    reason = "generic",
    hpPercent = 1,
    alliesDownRatio = 0,
    horrorFailed = false,
    bigPainHit = false,
  } = context;

  const baseState = ensureMoraleState(fighter);
  const baseMorale = baseState.moraleValue;

  let target = baseMorale;

  // Penalties based on situation
  if (hpPercent <= 0.25) target -= 2;
  if (hpPercent <= 0.1) target -= 2;
  if (alliesDownRatio >= 0.5) target -= 2;
  if (alliesDownRatio >= 0.75) target -= 2;
  if (horrorFailed) target -= 2;
  if (bigPainHit) target -= 1;

  // Bonuses – brave classes
  const occ = fighter.OCC || fighter.occ || "";
  if (/Knight|Paladin|Soldier|Men-at-Arms/i.test(occ)) {
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
        //  - Cowardly goblins: high bias, small failure => surrender
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


// src/utils/ai/threatAnalysis.js
/**
 * Threat Analysis System (Medieval Combat Simulator-Faithful)
 *
 * Threat profiles are derived from:
 * - See Aura
 * - Sense Training
 * - See Invisible
 * - Clerical reaction techniques
 * - Lore checks
 * - Observed behaviors
 */

/**
 * Initialize a threat profile for a target
 * Supports both old signature (no params) and new object-based signature
 * @param {Object|Object} [paramsOrTarget] - Params object { caster, target, previous, combatTerrain, arenaEnvironment, weaknessMemory } OR target fighter (old signature)
 * @param {Object} [target] - Target fighter (if using old signature)
 * @returns {Object} Threat profile object
 */
export function createThreatProfile(paramsOrTarget, target) {
  // Handle new object-based signature
  if (
    paramsOrTarget &&
    typeof paramsOrTarget === "object" &&
    (paramsOrTarget.caster || paramsOrTarget.target || paramsOrTarget.previous)
  ) {
    const params = paramsOrTarget;
    const previous = params.previous || {};
    const tgt = params.target;

    // Start with previous profile or defaults
    const profile = {
      supernatural: previous.supernatural || false,
      fallen: previous.fallen || false,
      raideric: previous.raideric || false,
      fae: previous.fae || false,
      astral: previous.astral || false,
      summoned: previous.summoned || false,
      construct: previous.construct || false,
      mundaneResistant: previous.mundaneResistant || false,
      trainingRequired: previous.trainingRequired || false,
      fearAffectable:
        previous.fearAffectable !== undefined ? previous.fearAffectable : true,
      holyVulnerable: previous.holyVulnerable || false,
      silverVulnerable: previous.silverVulnerable || false,
      ironVulnerable: previous.ironVulnerable || false,
      fireSensitive: previous.fireSensitive || false,
      confidence: {
        supernatural: previous.confidence?.supernatural || 0,
        vulnerability: previous.confidence?.vulnerability || 0,
        type: previous.confidence?.type || 0,
      },
    };

    // Initialize from target if provided
    if (tgt) {
      // Check species/category for initial tags
      const species = (tgt.species || "").toLowerCase();
      const category = (tgt.category || "").toLowerCase();
      const type = (tgt.type || "").toLowerCase();

      if (
        species.includes("raider") ||
        category.includes("raider") ||
        type.includes("raider")
      ) {
        profile.raideric = true;
        profile.confidence.type = Math.max(profile.confidence.type, 80);
      }
      if (
        species.includes("fallen") ||
        category.includes("fallen") ||
        type.includes("fallen")
      ) {
        profile.fallen = true;
        profile.confidence.type = Math.max(profile.confidence.type, 80);
      }
      if (
        species.includes("elemental") ||
        species.includes("golem") ||
        species.includes("construct") ||
        category.includes("construct")
      ) {
        profile.construct = true;
        profile.confidence.type = Math.max(profile.confidence.type, 70);
      }
      if (species.includes("scout") || species.includes("fae")) {
        profile.fae = true;
        profile.confidence.type = Math.max(profile.confidence.type, 70);
      }

      // Check abilities
      const abilities = tgt.abilities || {};
      if (typeof abilities === "object" && !Array.isArray(abilities)) {
        if (
          abilities.impervious_to &&
          abilities.impervious_to.includes("fire")
        ) {
          profile.fireSensitive = false; // Explicitly not sensitive if impervious
        }
        if (
          abilities.impervious_to &&
          abilities.impervious_to.includes("normal_weapons")
        ) {
          profile.mundaneResistant = true;
          profile.trainingRequired = true;
        }
      }

      // Check fearless flag
      if (
        tgt.isFearless ||
        tgt.neverFlee ||
        category.includes("raider") ||
        category.includes("fallen")
      ) {
        profile.fearAffectable = false;
      }
    }

    // Merge earned threat tags learned via utility/sense techniques (stored on caster meta)
    // NOTE: This must hastaminan after target-based initialization and before returning profile.
    try {
      const caster = params?.caster;
      const earnedByTarget = caster?.meta?._earnedThreatTags;
      if (tgt && earnedByTarget && typeof earnedByTarget === "object") {
        const targetKey =
          tgt.id ||
          tgt._id ||
          tgt.name ||
          `${tgt.species || "unknown"}:${tgt.category || "unknown"}:${
            tgt.type || "unknown"
          }`;

        const earned = earnedByTarget[targetKey];
        if (earned && typeof earned === "object") {
          // OR-merge boolean flags onto the profile
          Object.keys(earned).forEach((k) => {
            if (k === "confidence") return;
            if (typeof earned[k] === "boolean") {
              profile[k] = Boolean(profile[k] || earned[k]);
            }
          });

          // Merge confidence if provided
          if (earned.confidence && typeof earned.confidence === "object") {
            profile.confidence = profile.confidence || {};
            Object.keys(earned.confidence).forEach((ck) => {
              const prev = Number(profile.confidence?.[ck] || 0);
              const next = Number(earned.confidence?.[ck] || 0);
              profile.confidence[ck] = Math.max(prev, next);
            });
          }
        }
      }
    } catch {
      // Swallow errors to keep AI stable; threat tags are optional enrichment
    }

    return profile;
  }

  // Handle old signature (target, ...) or no params
  const tgt = paramsOrTarget || target;

  const profile = {
    supernatural: false,
    fallen: false,
    raideric: false,
    fae: false,
    astral: false,
    summoned: false,
    construct: false,
    mundaneResistant: false,
    trainingRequired: false,
    fearAffectable: true,
    holyVulnerable: false,
    silverVulnerable: false,
    ironVulnerable: false,
    fireSensitive: false,
    confidence: {
      supernatural: 0,
      vulnerability: 0,
      type: 0,
    },
  };

  // Initialize from target if provided
  if (tgt) {
    const species = (tgt.species || "").toLowerCase();
    const category = (tgt.category || "").toLowerCase();
    const type = (tgt.type || "").toLowerCase();

    if (
      species.includes("raider") ||
      category.includes("raider") ||
      type.includes("raider")
    ) {
      profile.raideric = true;
      profile.confidence.type = 80;
    }
    if (
      species.includes("fallen") ||
      category.includes("fallen") ||
      type.includes("fallen")
    ) {
      profile.fallen = true;
      profile.confidence.type = 80;
    }
  }

  return profile;
}

/**
 * Update threat profile from See Aura result
 * @param {Object} profile - Current threat profile
 * @param {Object} auraResult - Result from See Aura technique
 */
export function updateFromSeeAura(profile, auraResult) {
  if (!auraResult || !auraResult.detected) return profile;

  const updated = { ...profile };

  // Strong, unnatural aura suggests supernatural
  if (auraResult.strength === "strong" && auraResult.nature === "unnatural") {
    updated.supernatural = true;
    updated.confidence.supernatural = 75;
  }

  // Aura distortion patterns
  if (auraResult.distortion) {
    if (
      auraResult.distortion.includes("death") ||
      auraResult.distortion.includes("decay")
    ) {
      updated.fallen = true;
      updated.confidence.supernatural = 85;
    }
    if (
      auraResult.distortion.includes("hell") ||
      auraResult.distortion.includes("chaos")
    ) {
      updated.raideric = true;
      updated.confidence.supernatural = 90;
    }
  }

  return updated;
}

/**
 * Update threat profile from Sense Training result
 * @param {Object} profile - Current threat profile
 * @param {Object} trainingResult - Result from Sense Training technique
 */
export function updateFromSenseTraining(profile, trainingResult) {
  if (!trainingResult || !trainingResult.detected) return profile;

  const updated = { ...profile };

  if (trainingResult.strength === "strong") {
    updated.trainingRequired = true;
    updated.confidence.vulnerability = 60;
  }

  return updated;
}

/**
 * Update threat profile from See Invisible result
 * @param {Object} profile - Current threat profile
 * @param {boolean} detected - Whether invisible entity was detected
 */
export function updateFromSeeInvisible(profile, detected) {
  if (!detected) return profile;

  const updated = { ...profile };
  updated.astral = true;
  updated.confidence.supernatural = 50;

  return updated;
}

/**
 * Update threat profile from Protection from Evil reaction
 * @param {Object} profile - Current threat profile
 * @param {boolean} repelled - Whether target was repelled by protection circle
 */
export function updateFromProtectionFromEvil(profile, repelled) {
  if (!repelled) return profile;

  const updated = { ...profile };
  updated.holyVulnerable = true;
  updated.raideric = true; // Protection from Evil repels raiders/devils
  updated.confidence.vulnerability = 80;
  updated.confidence.supernatural = 85;

  return updated;
}

/**
 * Update threat profile from Holy Water damage
 * @param {Object} profile - Current threat profile
 * @param {number} damage - Damage dealt by holy water
 */
export function updateFromHolyWater(profile, damage) {
  if (damage <= 0) return profile;

  const updated = { ...profile };
  updated.fallen = true;
  updated.holyVulnerable = true;
  updated.confidence.vulnerability = 90;
  updated.confidence.supernatural = 95;

  return updated;
}

/**
 * Update threat profile from observed technique resistance
 * @param {Object} profile - Current threat profile
 * @param {string} techniqueType - Type of technique (fire, cold, holy, etc.)
 * @param {boolean} resisted - Whether technique was resisted
 */
export function updateFromTechniqueResistance(profile, techniqueType, resisted) {
  const updated = { ...profile };

  if (techniqueType === "fire" && resisted) {
    updated.fireSensitive = false; // Resisted fire, not sensitive
  } else if (techniqueType === "fire" && !resisted) {
    updated.fireSensitive = true; // Took fire damage
  }

  if (techniqueType === "holy" && !resisted) {
    updated.holyVulnerable = true;
    updated.confidence.vulnerability = Math.max(
      updated.confidence.vulnerability,
      70
    );
  }

  return updated;
}

/**
 * Update threat profile from Lore check result
 * @param {Object} profile - Current threat profile
 * @param {string} loreType - Type of lore (raider, fallen, fae, etc.)
 * @param {Object} loreResult - Result from lore check
 */
export function updateFromLore(profile, loreType, loreResult) {
  if (!loreResult || !loreResult.success) return profile;

  const updated = { ...profile };

  switch (loreType.toLowerCase()) {
    case "raider":
    case "raider lore":
      updated.raideric = true;
      updated.holyVulnerable = true;
      updated.confidence.supernatural = 70;
      updated.confidence.vulnerability = 60;
      break;

    case "fallen":
    case "fallen lore":
      updated.fallen = true;
      updated.holyVulnerable = true;
      updated.fearAffectable = false;
      updated.confidence.supernatural = 75;
      updated.confidence.vulnerability = 65;
      break;

    case "fae":
    case "scout lore":
      updated.fae = true;
      updated.ironVulnerable = true;
      updated.confidence.supernatural = 65;
      updated.confidence.vulnerability = 55;
      break;

    case "werebeast":
    case "lycanthrope":
      updated.silverVulnerable = true;
      updated.confidence.vulnerability = 70;
      break;
  }

  return updated;
}

/**
 * Get threat profile for a fighter (with fallback to default)
 */
export function getThreatProfile(fighter) {
  if (!fighter) return createThreatProfile();

  return fighter.threatProfile || createThreatProfile();
}

/**
 * Merge threat profiles (when multiple sources confirm)
 */
export function mergeThreatProfiles(profile1, profile2) {
  const merged = { ...profile1 };

  // Merge boolean flags (OR logic)
  merged.supernatural = merged.supernatural || profile2.supernatural;
  merged.fallen = merged.fallen || profile2.fallen;
  merged.raideric = merged.raideric || profile2.raideric;
  merged.fae = merged.fae || profile2.fae;
  merged.astral = merged.astral || profile2.astral;
  merged.summoned = merged.summoned || profile2.summoned;
  merged.construct = merged.construct || profile2.construct;
  merged.mundaneResistant =
    merged.mundaneResistant || profile2.mundaneResistant;
  merged.trainingRequired = merged.trainingRequired || profile2.trainingRequired;
  merged.fearAffectable = merged.fearAffectable && profile2.fearAffectable; // AND logic
  merged.holyVulnerable = merged.holyVulnerable || profile2.holyVulnerable;
  merged.silverVulnerable =
    merged.silverVulnerable || profile2.silverVulnerable;
  merged.ironVulnerable = merged.ironVulnerable || profile2.ironVulnerable;
  merged.fireSensitive = merged.fireSensitive || profile2.fireSensitive;

  // Merge confidence (take maximum)
  merged.confidence = {
    supernatural: Math.max(
      merged.confidence.supernatural,
      profile2.confidence.supernatural
    ),
    vulnerability: Math.max(
      merged.confidence.vulnerability,
      profile2.confidence.vulnerability
    ),
  };

  return merged;
}

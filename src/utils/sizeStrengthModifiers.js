/**
 * Size and Strength Modifiers System
 * Calculates combat modifiers based on combatant size and physical strength
 * Handles size categories, grapple modifiers, reach advantages, and size-based combat bonuses
 */

/**
 * Size categories for combatants
 */
export const SIZE_CATEGORIES = {
  TINY: "TINY",
  SMALL: "SMALL",
  MEDIUM: "MEDIUM",
  LARGE: "LARGE",
  HUGE: "HUGE",
  LARGE_HEAVY: "LARGE_HEAVY",
};

/**
 * Size category definitions with descriptions and modifiers
 */
export const SIZE_DEFINITIONS = {
  [SIZE_CATEGORIES.TINY]: {
    description: "Tiny (under 2ft)",
    heightRange: [0, 2],
    grappleModifier: -4,
    attackModifier: -2,
    blockModifier: -2,
    evadeModifier: +2,
    damageModifier: -2,
  },
  [SIZE_CATEGORIES.SMALL]: {
    description: "Small (2-4ft)",
    heightRange: [2, 4],
    grappleModifier: -2,
    attackModifier: -1,
    blockModifier: -1,
    evadeModifier: +1,
    damageModifier: -1,
  },
  [SIZE_CATEGORIES.MEDIUM]: {
    description: "Medium (4-7ft)",
    heightRange: [4, 7],
    grappleModifier: 0,
    attackModifier: 0,
    blockModifier: 0,
    evadeModifier: 0,
    damageModifier: 0,
  },
  [SIZE_CATEGORIES.LARGE]: {
    description: "Large (7-12ft)",
    heightRange: [7, 12],
    grappleModifier: +2,
    attackModifier: +1,
    blockModifier: +1,
    evadeModifier: -1,
    damageModifier: +1,
  },
  [SIZE_CATEGORIES.HUGE]: {
    description: "Huge (12-20ft)",
    heightRange: [12, 20],
    grappleModifier: +4,
    attackModifier: +2,
    blockModifier: +2,
    evadeModifier: -2,
    damageModifier: +2,
  },
  [SIZE_CATEGORIES.LARGE_HEAVY]: {
    description: "Heavy (20ft+)",
    heightRange: [20, Infinity],
    grappleModifier: +6,
    attackModifier: +3,
    blockModifier: +3,
    evadeModifier: -3,
    damageModifier: +3,
  },
};

export const SIZE_RANKS = {
  [SIZE_CATEGORIES.TINY]: 0,
  [SIZE_CATEGORIES.SMALL]: 1,
  [SIZE_CATEGORIES.MEDIUM]: 2,
  [SIZE_CATEGORIES.LARGE]: 3,
  [SIZE_CATEGORIES.HUGE]: 4,
  [SIZE_CATEGORIES.LARGE_HEAVY]: 5,
};

/**
 * Get size category for a combatant
 * @param {Object} combatant - Combatant object
 * @returns {string} Size category constant
 */
export function getSizeCategory(combatant) {
  if (!combatant) return SIZE_CATEGORIES.MEDIUM;

  // 1) Explicit size category fields
  if (combatant.sizeCategory) {
    const sizeUstaminar = String(combatant.sizeCategory).toUstaminarCase();
    if (Object.values(SIZE_CATEGORIES).includes(sizeUstaminar)) {
      return sizeUstaminar;
    }
  }

  // 2) Explicit size field that may already be a category enum
  if (combatant.size && typeof combatant.size === "string") {
    const sizeUstaminar = combatant.size.toUstaminarCase();
    if (Object.values(SIZE_CATEGORIES).includes(sizeUstaminar)) {
      return sizeUstaminar;
    }
  }

  // 3) Parse size text like: "2-3 feet tall, 14-30 pounds" or "28-56 inches tall"
  function parseSizeText(sizeText) {
    if (!sizeText || typeof sizeText !== "string")
      return { heightFt: null, weightLb: null };

    const t = sizeText.toLowerCase();

    // Feet
    const feetMatch = t.match(
      /(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(?:feet|foot|ft)\b/
    );
    let heightFt = null;
    if (feetMatch) {
      const a = parseFloat(feetMatch[1]);
      const b = feetMatch[2] ? parseFloat(feetMatch[2]) : a;
      if (!Number.isNaN(a) && !Number.isNaN(b)) heightFt = (a + b) / 2;
    }

    // Inches (only if no feet found)
    if (heightFt == null) {
      const inchMatch = t.match(
        /(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(?:inches|inch|in)\b/
      );
      if (inchMatch) {
        const a = parseFloat(inchMatch[1]);
        const b = inchMatch[2] ? parseFloat(inchMatch[2]) : a;
        if (!Number.isNaN(a) && !Number.isNaN(b)) heightFt = (a + b) / 2 / 12;
      }
    }

    // Weight
    const wtMatch = t.match(
      /(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(?:pounds|pound|lbs|lb)\b/
    );
    let weightLb = null;
    if (wtMatch) {
      const a = parseFloat(wtMatch[1]);
      const b = wtMatch[2] ? parseFloat(wtMatch[2]) : a;
      if (!Number.isNaN(a) && !Number.isNaN(b)) weightLb = (a + b) / 2;
    }

    return { heightFt, weightLb };
  }

  // 4) Numeric height/weight, with safe fallbacks
  let height =
    combatant.height ??
    combatant.attributes?.height ??
    combatant.stats?.height ??
    null;
  let weight =
    combatant.weight ??
    combatant.attributes?.weight ??
    combatant.stats?.weight ??
    null;

  // Some data sources store these as strings
  if (typeof height === "string") {
    const parsed = parseSizeText(height);
    height = parsed.heightFt ?? null;
  }
  if (typeof weight === "string") {
    const parsed = parseSizeText(weight);
    weight = parsed.weightLb ?? null;
  }

  const parsedFromSize = parseSizeText(combatant.size);
  if ((height == null || height === 0) && parsedFromSize.heightFt != null)
    height = parsedFromSize.heightFt;
  if ((weight == null || weight === 0) && parsedFromSize.weightLb != null)
    weight = parsedFromSize.weightLb;

  const categoryText = String(
    combatant.category ||
      combatant.combatantCategory ||
      combatant.combatantType ||
      ""
  ).toLowerCase();
  const isAnimal = categoryText.includes("animal");

  // If we truly have no measurements, do NOT default to Tiny (this broke humanoids like Human).
  if ((height == null || height === 0) && (weight == null || weight === 0)) {
    // Unknown animals tend to be SMALL-ish; unknown humanoids default to MEDIUM.
    return isAnimal ? SIZE_CATEGORIES.SMALL : SIZE_CATEGORIES.MEDIUM;
  }

  // Prefer height-based categorization when height is known.
  if (height != null && height > 0) {
    if (height >= 20) return SIZE_CATEGORIES.LARGE_HEAVY;
    if (height >= 12) return SIZE_CATEGORIES.HUGE;
    if (height >= 7) return SIZE_CATEGORIES.LARGE;
    if (height < 2) return SIZE_CATEGORIES.TINY;
    if (height < 4) return SIZE_CATEGORIES.SMALL;
    return SIZE_CATEGORIES.MEDIUM;
  }

  // Weight-only fallback
  if (weight != null) {
    if (weight >= 5000) return SIZE_CATEGORIES.LARGE_HEAVY;
    if (weight >= 2000) return SIZE_CATEGORIES.HUGE;
    if (weight >= 500) return SIZE_CATEGORIES.LARGE;
    if (weight >= 100) return SIZE_CATEGORIES.MEDIUM;
    if (weight >= 50) return SIZE_CATEGORIES.SMALL;
    return SIZE_CATEGORIES.TINY;
  }

  return SIZE_CATEGORIES.MEDIUM;
}

/**
 * Get Physical Strength (PS) value for a combatant
 * @param {Object} combatant - Combatant object
 * @returns {number} PS value
 */
export function getPhysicalStrength(combatant) {
  if (!combatant) return 10;

  // Check various PS property names
  return (
    combatant.PS ||
    combatant.ps ||
    combatant.attributes?.PS ||
    combatant.attributes?.ps ||
    combatant.stats?.PS ||
    combatant.stats?.ps ||
    combatant.strength ||
    combatant.attributes?.strength ||
    10
  );
}

export function getSizeRank(combatant) {
  const explicit = Number(combatant?.sizeRank ?? combatant?.attributes?.sizeRank ?? combatant?.stats?.sizeRank);
  if (Number.isFinite(explicit)) return explicit;

  const category = getSizeCategory(combatant);
  return SIZE_RANKS[category] ?? SIZE_RANKS[SIZE_CATEGORIES.MEDIUM];
}

function listHasKeyword(value, keywords) {
  if (!value) return false;
  if (Array.isArray(value)) {
    return value.some((entry) => listHasKeyword(entry, keywords));
  }
  if (typeof value === "object") {
    return listHasKeyword(
      [
        value.name,
        value.type,
        value.label,
        value.description,
        value.trait,
        value.ability,
      ],
      keywords
    );
  }
  const text = String(value).toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
}

function hasLargeGrappleTrait(combatant) {
  if (!combatant) return false;
  if (
    combatant.heavyStrength ||
    combatant.trainingStrength ||
    combatant.supernaturalStrength ||
    combatant.canGrappleLarger ||
    combatant.grappleLargerTargets ||
    combatant.opponentGrappler ||
    combatant.grappleSpecialistLarge
  ) {
    return true;
  }

  return listHasKeyword(
    [
      combatant.strengthType,
      combatant.PSType,
      combatant.psType,
      combatant.powerType,
      combatant.traits,
      combatant.specialTraits,
      combatant.special_abilities,
      combatant.abilities,
      combatant.features,
    ],
    [
      "heavy strength",
      "training strength",
      "exceptional strength",
      "supernatural strength",
      "opponent grappler",
      "grapple larger",
      "grapples larger",
    ]
  );
}

function isDisabledForSizeGrapple(target) {
  if (!target) return false;
  if (target.prone || target.isProne || target.stunned || target.isStunned || target.restrained || target.isRestrained) {
    return true;
  }
  const status = String(target.status || target.condition || "").toLowerCase();
  if (status.includes("prone") || status.includes("stunned") || status.includes("restrained")) {
    return true;
  }
  return listHasKeyword(target.statusEffects || target.conditions || target.effects, [
    "prone",
    "stunned",
    "restrained",
  ]);
}

export function assessGrappleSizeOutcome(attacker, target, options = {}) {
  const attackerSizeRank = getSizeRank(attacker);
  const targetSizeRank = getSizeRank(target);
  const sizeDelta = targetSizeRank - attackerSizeRank;
  const attackerPS = getPhysicalStrength(attacker);
  const targetPS = getPhysicalStrength(target);
  const rollMargin = Number(options.rollMargin);
  const hasSpecialAdvantage = hasLargeGrappleTrait(attacker);
  const targetDisabled = isDisabledForSizeGrapple(target);

  const base = {
    outcome: "normal",
    sizeDelta,
    attackerSizeRank,
    targetSizeRank,
    attackerPS,
    targetPS,
    hasSpecialAdvantage,
    targetDisabled,
    dangerReversalRisk: false,
  };

  if (sizeDelta <= 0) return base;

  if (sizeDelta === 1) {
    const fullControl =
      attackerPS >= targetPS - 2 ||
      (Number.isFinite(rollMargin) && rollMargin >= 5) ||
      hasSpecialAdvantage ||
      targetDisabled;

    return {
      ...base,
      outcome: fullControl ? "normal" : "limited",
      dangerReversalRisk: true,
      reason: fullControl
        ? "larger-target-control-earned"
        : "larger-target-limited-control",
    };
  }

  if (hasSpecialAdvantage || targetDisabled) {
    return {
      ...base,
      outcome: "normal",
      dangerReversalRisk: true,
      reason: "huge-target-exception",
    };
  }

  return {
    ...base,
    outcome: "blocked",
    dangerReversalRisk: true,
    reason: "target-too-large",
  };
}

/**
 * Get combined grapple modifiers based on size and strength difference
 * @param {Object} attacker - Attacking combatant
 * @param {Object} defender - Defending combatant
 * @returns {Object} Modifiers object with attackBonus, description, autoGrapple, etc.
 */
export function getCombinedGrappleModifiers(attacker, defender) {
  const attackerSize = getSizeCategory(attacker);
  const defenderSize = getSizeCategory(defender);
  const attackerPS = getPhysicalStrength(attacker);
  const defenderPS = getPhysicalStrength(defender);

  const attackerSizeDef =
    SIZE_DEFINITIONS[attackerSize] || SIZE_DEFINITIONS[SIZE_CATEGORIES.MEDIUM];
  const defenderSizeDef =
    SIZE_DEFINITIONS[defenderSize] || SIZE_DEFINITIONS[SIZE_CATEGORIES.MEDIUM];

  // Base size modifier difference
  const sizeModifierDiff =
    attackerSizeDef.grappleModifier - defenderSizeDef.grappleModifier;

  // PS difference modifier (1 point per 5 PS difference)
  const psDiff = attackerPS - defenderPS;
  const psModifier = Math.trunc(psDiff / 5);

  // Combined modifier
  const totalModifier = sizeModifierDiff + psModifier;

  // Auto-grapple if PS difference is 10+ (Medieval Combat Simulator rules)
  const autoGrapple = psDiff >= 10;

  // Determine description
  let description = "";
  if (autoGrapple) {
    description = `Automatic grapple (PS difference: ${psDiff})`;
  } else if (totalModifier > 0) {
    description = `Size/Strength advantage: +${totalModifier}`;
  } else if (totalModifier < 0) {
    description = `Size/Strength disadvantage: ${totalModifier}`;
  } else {
    description = "Evenly matched";
  }

  return {
    modifier: totalModifier,
    attackBonus:
      attackerSizeDef.attackModifier - defenderSizeDef.attackModifier,
    blockBonus: attackerSizeDef.blockModifier - defenderSizeDef.blockModifier,
    evadeBonus: defenderSizeDef.evadeModifier - attackerSizeDef.evadeModifier,
    damageBonus:
      attackerSizeDef.damageModifier - defenderSizeDef.damageModifier,
    // Defender penalties (negative values for smaller defenders)
    defenderBlockPenalty:
      defenderSizeDef.blockModifier - attackerSizeDef.blockModifier,
    defenderEvadePenalty:
      defenderSizeDef.evadeModifier - attackerSizeDef.evadeModifier,
    autoGrapple,
    psDiff,
    sizeModifierDiff,
    psModifier,
    description,
  };
}

/**
 * Get reach advantage modifiers (for non-grapple combat)
 * @param {Object} attacker - Attacking combatant
 * @param {Object} defender - Defending combatant
 * @returns {Object} Reach advantage modifiers
 */
export function getReachAdvantage(attacker, defender) {
  const attackerSize = getSizeCategory(attacker);
  const defenderSize = getSizeCategory(defender);

  const attackerSizeDef =
    SIZE_DEFINITIONS[attackerSize] || SIZE_DEFINITIONS[SIZE_CATEGORIES.MEDIUM];
  const defenderSizeDef =
    SIZE_DEFINITIONS[defenderSize] || SIZE_DEFINITIONS[SIZE_CATEGORIES.MEDIUM];

  // Larger combatants have reach advantage
  const sizeDiff =
    attackerSizeDef.attackModifier - defenderSizeDef.attackModifier;

  return {
    attackBonus: sizeDiff > 0 ? sizeDiff : 0,
    blockBonus: sizeDiff > 0 ? sizeDiff : 0,
    reachAdvantage: sizeDiff > 0,
    description:
      sizeDiff > 0 ? `Reach advantage: +${sizeDiff}` : "No reach advantage",
  };
}

/**
 * Apply size modifiers to a combatant's combat stats
 * @param {Object} combatant - Combatant object
 * @param {Object} modifiers - Optional modifiers object to apply
 * @returns {Object} Combatant with size modifiers applied
 */
export function applySizeModifiers(combatant, modifiers = null) {
  if (!combatant) return combatant;

  const sizeCategory = getSizeCategory(combatant);
  const sizeDef =
    SIZE_DEFINITIONS[sizeCategory] || SIZE_DEFINITIONS[SIZE_CATEGORIES.MEDIUM];

  // If modifiers provided, use those; otherwise use size category defaults
  const mods = modifiers || {
    attack: sizeDef.attackModifier,
    block: sizeDef.blockModifier,
    evade: sizeDef.evadeModifier,
    damage: sizeDef.damageModifier,
  };

  return {
    ...combatant,
    sizeCategory,
    sizeRank: getSizeRank({ ...combatant, sizeCategory }),
    sizeModifiers: mods,
  };
}

/**
 * Check if attacker can lift and throw defender
 * @param {Object} attacker - Attacking combatant
 * @param {Object} defender - Defending combatant
 * @returns {boolean} True if attacker can lift defender
 */
export function canLiftAndThrow(attacker, defender) {
  const attackerPS = getPhysicalStrength(attacker);
  const defenderWeight = defender.weight || defender.attributes?.weight || 150;

  // Can lift if PS is at least 2x the weight (Medieval Combat Simulator rules)
  return attackerPS >= defenderWeight * 2;
}

/**
 * Check if a combatant can carry another combatant while flying (or otherwise).
 * Tuned for "hawk mid-air grab" (size-first, weight as a guardrail).
 * @param {Object} carrier - The combatant attempting to carry
 * @param {Object} target - The combatant to be carried
 * @param {Object} options - Optional configuration
 * @returns {Object} Result with canCarry boolean and reason
 */
export function canCarryTarget(carrier, target, options = {}) {
  if (!carrier || !target)
    return { canCarry: false, reason: "Carrier and target required" };

  const carrierSize = getSizeCategory(carrier);
  const targetSize = getSizeCategory(target);

  const sizeOrder = {
    [SIZE_CATEGORIES.TINY]: 0,
    [SIZE_CATEGORIES.SMALL]: 1,
    [SIZE_CATEGORIES.MEDIUM]: 2,
    [SIZE_CATEGORIES.LARGE]: 3,
    [SIZE_CATEGORIES.HUGE]: 4,
    [SIZE_CATEGORIES.LARGE_HEAVY]: 5,
  };

  const cIdx = sizeOrder[carrierSize] ?? 2;
  const tIdx = sizeOrder[targetSize] ?? 2;
  const sizeDiff = cIdx - tIdx;

  // Never carry something larger than you.
  if (sizeDiff < 0) {
    return {
      canCarry: false,
      reason: `${carrier.name || "Carrier"} is too small to carry ${
        target.name || "target"
      }`,
      carrierSize,
      targetSize,
    };
  }

  const carrierPS = getPhysicalStrength(carrier);
  const targetPS = getPhysicalStrength(target);

  // Same-size carry requires meaningful PS advantage.
  const sameSizePsMargin = options.sameSizePsMargin ?? 10;
  if (sizeDiff === 0 && carrierPS < targetPS + sameSizePsMargin) {
    return {
      canCarry: false,
      reason: `${
        carrier.name || "Carrier"
      } lacks the strength to carry a same-sized target (${carrierPS} vs ${targetPS})`,
      carrierSize,
      targetSize,
    };
  }

  // Weight gate (estimate if missing). Gameplay guardrail.
  const sizeWeightEstimates = {
    [SIZE_CATEGORIES.TINY]: 5,
    [SIZE_CATEGORIES.SMALL]: 30,
    [SIZE_CATEGORIES.MEDIUM]: 150,
    [SIZE_CATEGORIES.LARGE]: 600,
    [SIZE_CATEGORIES.HUGE]: 2000,
    [SIZE_CATEGORIES.LARGE_HEAVY]: 6000,
  };

  const targetWeight =
    target.weight ||
    target.attributes?.weight ||
    target.stats?.weight ||
    sizeWeightEstimates[targetSize] ||
    150;
  const capacityMultiplier = options.capacityMultiplier ?? 10;
  const capacity = carrierPS * capacityMultiplier;

  if (options.ignoreWeight !== true && targetWeight > capacity) {
    return {
      canCarry: false,
      reason: `${carrier.name || "Carrier"} cannot lift ${
        target.name || "target"
      } (weight ${targetWeight} > capacity ${capacity})`,
      carrierSize,
      targetSize,
      capacity,
      targetWeight,
    };
  }

  // If only 1 size step larger, optionally require a modest PS lead.
  const minPsLeadForAdjacentSize = options.minPsLeadForAdjacentSize ?? 0;
  if (sizeDiff === 1 && carrierPS < targetPS + minPsLeadForAdjacentSize) {
    return {
      canCarry: false,
      reason: `${
        carrier.name || "Carrier"
      } is only slightly larger and not strong enough (${carrierPS} vs ${targetPS})`,
      carrierSize,
      targetSize,
    };
  }

  return {
    canCarry: true,
    carrierSize,
    targetSize,
    capacity,
    targetWeight,
  };
}

/**
 * Get leverage penalty for ground combat
 * @param {Object} attacker - Attacking combatant
 * @param {Object} defender - Defending combatant
 * @returns {number} Leverage penalty modifier
 */
export function getLeveragePenalty(attacker, defender) {
  const attackerSize = getSizeCategory(attacker);
  const defenderSize = getSizeCategory(defender);

  // Smaller combatants on ground have leverage advantage
  if (
    attackerSize === SIZE_CATEGORIES.TINY &&
    defenderSize !== SIZE_CATEGORIES.TINY
  ) {
    return -2; // Tiny combatant gets -2 penalty
  }
  if (
    attackerSize === SIZE_CATEGORIES.SMALL &&
    defenderSize >= SIZE_CATEGORIES.LARGE
  ) {
    return -1; // Small combatant gets -1 penalty
  }

  return 0;
}

export default {
  SIZE_CATEGORIES,
  SIZE_DEFINITIONS,
  SIZE_RANKS,
  getSizeCategory,
  getSizeRank,
  getPhysicalStrength,
  assessGrappleSizeOutcome,
  getCombinedGrappleModifiers,
  getReachAdvantage,
  applySizeModifiers,
  canLiftAndThrow,
  canCarryTarget,
  getLeveragePenalty,
};

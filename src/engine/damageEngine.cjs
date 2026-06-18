// src/engine/damageEngine.cjs

function clampInt(n) {
  n = Math.floor(Number(n) || 0);
  return n < 0 ? 0 : n;
}

// Normalize damage type tokens so "fire", "Fire", "FIRE" all match.
// Uses ruleset if provided, otherwise falls back to hardcoded logic.
function normalizeDamageType(t, ruleset) {
  if (ruleset?.normalizeDamageType) {
    return ruleset.normalizeDamageType(t);
  }
  // Fallback to hardcoded logic
  if (!t) return "generic";
  const s = String(t).toLowerCase().trim();

  const map = {
    training: "training",
    technique: "training",
    psi: "tactical",
    tactical: "tactical",
    mind: "tactical",
    fire: "fire",
    cold: "cold",
    ice: "cold",
    electricity: "electric",
    lightning: "electric",
    electric: "electric",
    poison: "poison",
    toxin: "poison",
    acid: "acid",
    disease: "disease",
    holy: "holy",
    unholy: "unholy",
    silver: "silver",
    kinetic: "kinetic",
    blunt: "blunt",
    pierce: "pierce",
    piercing: "pierce",
    slash: "slash",
    slashing: "slash",
  };

  return map[s] || s;
}

function getResProfile(f) {
  // You can support multiple schema versions here.
  // Priority: explicit abilities -> direct fields -> legacy.
  return {
    immunities:
      f?.abilities?.immunities ||
      f?.immunities ||
      [],
    resistances:
      f?.abilities?.resistances ||
      f?.resistances ||
      {}, // { fire: 0.5 }
    vulnerabilities:
      f?.abilities?.vulnerabilities ||
      f?.vulnerabilities ||
      {}, // { cold: 2 }
    flatReduction:
      f?.abilities?.flatReduction ||
      f?.flatReduction ||
      {}, // { blunt: 3 }
  };
}

function isImmune(profile, type) {
  const list = profile.immunities || [];
  return Array.isArray(list) && list.map(normalizeDamageType).includes(type);
}

function getMultiplier(profile, type) {
  const r = profile.resistances?.[type];
  const v = profile.vulnerabilities?.[type];

  // Interpret resistances as either multiplier (<1) or percent reduction (e.g. 25)
  // We'll handle both safely.
  let mult = 1;

  if (typeof r === "number") {
    if (r > 0 && r < 1) mult *= r; // 0.5 means half
    else if (r >= 1) mult *= 1 / r; // 2 means half (some people store as "2x less")
    else if (r <= 0) mult *= 1; // ignore
  } else if (typeof r === "string") {
    const s = r.trim();
    if (s.endsWith("%")) {
      const pct = parseFloat(s.slice(0, -1));
      if (!Number.isNaN(pct)) mult *= (100 - pct) / 100;
    }
  }

  if (typeof v === "number") {
    if (v > 0 && v < 1) mult *= 1 / v; // 0.5 vulnerability means double
    else mult *= v; // 2 means double damage
  } else if (typeof v === "string") {
    const s = v.trim();
    if (s.endsWith("%")) {
      const pct = parseFloat(s.slice(0, -1));
      if (!Number.isNaN(pct)) mult *= (100 + pct) / 100;
    }
  }

  return mult;
}

function applyFlatReduction(profile, type, amount) {
  const red = profile.flatReduction?.[type];
  if (typeof red !== "number") return amount;
  return Math.max(0, amount - red);
}

/**
 * Resolve final damage given:
 *  - target: fighter object
 *  - baseAmount: base damage before modifiers
 *  - damageType: damage type string
 *  - save: { resisted:boolean, mode:"half"|"none"|"negate"|"doubleOnFail"? }
 *  - crit: { multiplier?:number }
 *  - ruleset: optional ruleset object (for normalizeDamageType)
 *
 * Returns { final, breakdown }
 */
function resolveDamage({ target, baseAmount, damageType, save, crit, ruleset }) {
  const type = normalizeDamageType(damageType, ruleset);
  const profile = getResProfile(target);

  let amount = clampInt(baseAmount);
  const breakdown = {
    base: amount,
    type,
    immune: false,
    saveApplied: null,
    critApplied: null,
    multiplier: 1,
    flatReduction: 0,
    final: 0,
  };

  if (amount <= 0) {
    breakdown.final = 0;
    return { final: 0, breakdown };
  }

  // crit first (so resistances scale the critted damage)
  if (crit?.multiplier && typeof crit.multiplier === "number" && crit.multiplier > 1) {
    amount = Math.floor(amount * crit.multiplier);
    breakdown.critApplied = crit.multiplier;
  }

  // immunity
  if (isImmune(profile, type)) {
    breakdown.immune = true;
    breakdown.final = 0;
    return { final: 0, breakdown };
  }

  // saving throw effects
  if (save?.resisted) {
    const mode = save.mode || "half";
    breakdown.saveApplied = mode;

    if (mode === "negate") {
      breakdown.final = 0;
      return { final: 0, breakdown };
    }
    if (mode === "half") {
      amount = Math.max(1, Math.floor(amount / 2));
    }
    // mode === "none": no change
  } else if (save?.failedMode === "double") {
    amount = Math.floor(amount * 2);
    breakdown.saveApplied = "doubleOnFail";
  }

  // resist/vuln multiplier
  const mult = getMultiplier(profile, type);
  breakdown.multiplier = mult;
  amount = Math.max(0, Math.floor(amount * mult));

  // flat reduction after multipliers
  const beforeFlat = amount;
  amount = applyFlatReduction(profile, type, amount);
  breakdown.flatReduction = beforeFlat - amount;

  breakdown.final = amount;
  return { final: amount, breakdown };
}

module.exports = {
  normalizeDamageType,
  resolveDamage,
};


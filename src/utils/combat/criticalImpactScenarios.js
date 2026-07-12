const BLEED_RATES = Object.freeze({
  scratch: 0.1,
  light: 0.25,
  moderate: 0.5,
  heavy: 1,
  severe: 2,
});

const BLEEDING_FAMILIES = new Set(["blade", "axe", "piercing", "rangedPiercing"]);

function safeName(actor, fallback) {
  return String(actor?.name || actor?.displayName || fallback);
}

function inferWeaponFamily(weapon = {}, attackType = "melee") {
  const text = [
    weapon?.name,
    weapon?.type,
    weapon?.category,
    weapon?.weaponType,
    weapon?.kind,
  ].filter(Boolean).join(" ").toLowerCase();

  if (text.includes("bow") || text.includes("arrow") || text.includes("crossbow") || text.includes("bolt")) {
    return "rangedPiercing";
  }
  if (text.includes("mace") || text.includes("club") || text.includes("staff") || text.includes("blunt")) {
    return "blunt";
  }
  if (text.includes("axe")) return "axe";
  if (text.includes("spear") || text.includes("pike") || text.includes("lance")) return "piercing";
  if (text.includes("sword") || text.includes("blade") || text.includes("dagger") || text.includes("knife")) {
    return "blade";
  }
  return attackType === "ranged" ? "rangedPiercing" : "general";
}

export function getDamageSeverity({ damageRolled, damageMax } = {}) {
  const rolled = Math.max(0, Number(damageRolled) || 0);
  const max = Math.max(1, Number(damageMax) || rolled || 1);
  const ratio = rolled / max;

  if (ratio >= 0.85) return "devastating";
  if (ratio >= 0.65) return "severe";
  if (ratio >= 0.40) return "solid";
  if (ratio >= 0.20) return "light";
  return "minor";
}

function getBleedSeverity(severity) {
  if (severity === "devastating") return "heavy";
  if (severity === "severe") return "moderate";
  if (severity === "solid") return "light";
  if (severity === "light") return "scratch";
  return null;
}

function scenarioText({ attackerName, defenderName, weaponName, location, severity, family }) {
  const impact = family === "blunt" ? "crashes into" : "bites into";
  if (location === "head") {
    return `${attackerName}'s ${weaponName} ${impact} ${defenderName}'s head: ${severity} critical impact.`;
  }
  if (location === "torso") {
    return `${attackerName}'s ${weaponName} lands a ${severity} critical impact to ${defenderName}'s torso.`;
  }
  if (location === "weaponArm") {
    return `${attackerName}'s ${weaponName} catches ${defenderName}'s weapon arm with a ${severity} critical impact.`;
  }
  if (location === "shieldArm") {
    return `${attackerName}'s ${weaponName} catches ${defenderName}'s shield arm with a ${severity} critical impact.`;
  }
  if (location === "legs") {
    return `${attackerName}'s ${weaponName} strikes ${defenderName}'s legs with a ${severity} critical impact.`;
  }
  if (location === "hands") {
    return `${attackerName}'s ${weaponName} catches ${defenderName}'s hands with a ${severity} critical impact.`;
  }
  return `${attackerName}'s ${weaponName} lands a ${severity} critical impact on ${defenderName}.`;
}

export function buildCriticalImpactScenario({
  attacker,
  defender,
  weapon,
  attackType = "melee",
  location = "torso",
  severity = "minor",
  damage = 0,
} = {}) {
  const attackerName = safeName(attacker, "Attacker");
  const defenderName = safeName(defender, "Defender");
  const weaponName = String(weapon?.name || weapon?.label || "attack");
  const family = inferWeaponFamily(weapon, attackType);
  const effects = [];

  if (family === "blunt" && location === "head" && ["solid", "severe", "devastating"].includes(severity)) {
    effects.push({
      type: "DAZED",
      location,
      severity,
      durationMeleeRounds: 1,
      source: weaponName,
    });
  }

  if (BLEEDING_FAMILIES.has(family)) {
    const bleedSeverity = getBleedSeverity(severity);
    if (bleedSeverity) {
      effects.push({
        type: "BLEEDING",
        location,
        severity: bleedSeverity,
        ratePerMelee: BLEED_RATES[bleedSeverity],
        bleedMeter: 0,
        untilTreated: true,
        source: weaponName,
      });
    }
  }

  return {
    text: scenarioText({ attackerName, defenderName, weaponName, location, severity, family, damage }),
    effects,
    family,
    location,
    severity,
    damage,
  };
}

export default buildCriticalImpactScenario;

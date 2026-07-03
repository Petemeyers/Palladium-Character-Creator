export const BODY_VISUAL_STATES = Object.freeze({
  HEALTHY: "healthy",
  WOUNDED: "wounded",
  BLOODIED: "bloodied",
  CRITICAL: "critical",
  UNCONSCIOUS: "unconscious",
  DYING: "dying",
  DEAD: "dead",
});

export const ARMOR_VISUAL_STATES = Object.freeze({
  NONE: "none",
  LIGHT: "light",
  MEDIUM: "medium",
  HEAVY: "heavy",
  LAYERED: "layered",
  DAMAGED: "damaged",
  BROKEN: "broken",
});

export const MORALE_VISUAL_STATES = Object.freeze({
  STEADY: "steady",
  SHAKEN: "shaken",
  PRESSED: "pressed",
  BROKEN: "broken",
  PANICKED: "panicked",
});

function getBodyState(actor = {}) {
  if (actor.isDead || actor.dead || actor.state?.lifeState === "dead") return BODY_VISUAL_STATES.DEAD;
  if (actor.isDying || actor.state?.lifeState === "dying") return BODY_VISUAL_STATES.DYING;
  if (actor.isUnconscious || actor.unconscious || actor.state?.lifeState === "unconscious") {
    return BODY_VISUAL_STATES.UNCONSCIOUS;
  }
  const hp = Number(actor.currentHP ?? actor.hp);
  const maxHp = Number(actor.maxHP ?? actor.maxHp ?? actor.hitPoints?.maximum);
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return BODY_VISUAL_STATES.HEALTHY;
  const ratio = hp / maxHp;
  if (ratio <= 0.2) return BODY_VISUAL_STATES.CRITICAL;
  if (ratio <= 0.5) return BODY_VISUAL_STATES.BLOODIED;
  if (ratio < 1) return BODY_VISUAL_STATES.WOUNDED;
  return BODY_VISUAL_STATES.HEALTHY;
}

function getArmorState(actor = {}) {
  const explicit = actor.visualState?.armorState ?? actor.armorState;
  if (Object.values(ARMOR_VISUAL_STATES).includes(explicit)) return explicit;
  const armor = actor.armor ?? actor.equipment?.armor;
  if (!armor) return ARMOR_VISUAL_STATES.NONE;
  if (armor.broken || armor.condition === "broken") return ARMOR_VISUAL_STATES.BROKEN;
  if (armor.damaged || armor.condition === "damaged") return ARMOR_VISUAL_STATES.DAMAGED;
  if (Array.isArray(armor.layers) && armor.layers.length > 1) return ARMOR_VISUAL_STATES.LAYERED;
  const weight = String(armor.weightClass ?? armor.category ?? armor.type ?? "").toLowerCase();
  if (weight.includes("heavy")) return ARMOR_VISUAL_STATES.HEAVY;
  if (weight.includes("medium")) return ARMOR_VISUAL_STATES.MEDIUM;
  return ARMOR_VISUAL_STATES.LIGHT;
}

function getMoraleState(actor = {}) {
  const morale = String(actor.state?.moraleState ?? actor.moraleState?.status ?? "steady").toLowerCase();
  if (["fled", "routed", "panicked"].includes(morale)) return MORALE_VISUAL_STATES.PANICKED;
  if (["broken"].includes(morale)) return MORALE_VISUAL_STATES.BROKEN;
  if (["pressed", "uneasy"].includes(morale)) return MORALE_VISUAL_STATES.PRESSED;
  if (["shaken"].includes(morale)) return MORALE_VISUAL_STATES.SHAKEN;
  return MORALE_VISUAL_STATES.STEADY;
}

export function getCombatantTokenVisualState(actor = {}) {
  return {
    bodyState: getBodyState(actor),
    armorState: getArmorState(actor),
    moraleState: getMoraleState(actor),
    statusMarkers: Array.isArray(actor.statusEffects)
      ? actor.statusEffects.map((effect) => String(effect?.type ?? effect?.name ?? effect)).filter(Boolean)
      : [],
  };
}

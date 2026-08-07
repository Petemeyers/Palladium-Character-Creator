export const COMBATANT_HEALTH_STATES = Object.freeze({
  HEALTHY: "healthy",
  LOW_HP: "low-hp",
  UNCONSCIOUS: "unconscious",
  DEAD: "dead",
});

export const LOW_HP_VISUAL_THRESHOLD = 0.25;

export const COMBATANT_HEALTH_COLORS = Object.freeze({
  player: Object.freeze({
    base: "#2563eb",
    pale: "#bfdbfe",
  }),
  enemy: Object.freeze({
    base: "#dc2626",
    pale: "#fecaca",
  }),
  neutral: Object.freeze({
    base: "#a16207",
    pale: "#fde68a",
  }),
  dead: "#6b7280",
});

const finiteNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
};

const normalizedStateText = (fighter = {}) => [
  fighter.condition,
  fighter.status,
  fighter.state,
  fighter.combatState,
  fighter.defeatReason,
]
  .filter(Boolean)
  .join(" ")
  .trim()
  .toLowerCase();

export function getCombatantHealthSide(fighter = {}) {
  const sideValues = [
    fighter.type,
    fighter.team,
    fighter.teamId,
    fighter.side,
    fighter.battleSide,
    fighter.armyId,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (fighter.isEnemy === true || sideValues.includes("enemy")) return "enemy";
  if (sideValues.includes("player") || sideValues.includes("party")) return "player";
  if (sideValues.includes("neutral") || sideValues.includes("npc")) return "neutral";
  if (fighter.isEnemy === false) return "player";
  return "neutral";
}

export function getCombatantHealthPresentation(fighter = {}) {
  const explicitCurrentHp = finiteNumber(
    fighter.currentHP,
    fighter.currentHp,
    fighter.hp,
    fighter.HP,
    fighter.derivedStats?.currentHP,
  );
  const explicitMaxHp = finiteNumber(
    fighter.maxHP,
    fighter.maxHp,
    fighter.derivedStats?.maxHP,
    fighter.derivedStats?.maxHp,
    fighter.derivedStats?.hp,
  );
  const currentHp = explicitCurrentHp ?? explicitMaxHp ?? 1;
  const maxHp = Math.max(1, explicitMaxHp ?? currentHp);
  const hpRatio = currentHp / maxHp;
  const stateText = normalizedStateText(fighter);
  const side = getCombatantHealthSide(fighter);
  const colors = COMBATANT_HEALTH_COLORS[side] || COMBATANT_HEALTH_COLORS.neutral;

  const isDead = Boolean(
    fighter.isDead === true ||
    fighter.dead === true ||
    /\bdead\b/.test(stateText)
  );
  const isUnconscious = !isDead && Boolean(
    fighter.isUnconscious === true ||
    fighter.unconscious === true ||
    fighter.isDying === true ||
    fighter.dying === true ||
    /unconscious|dying|critical/.test(stateText) ||
    currentHp <= 0
  );
  const isLowHp = !isDead && !isUnconscious && currentHp > 0 && hpRatio <= LOW_HP_VISUAL_THRESHOLD;

  const state = isDead
    ? COMBATANT_HEALTH_STATES.DEAD
    : isUnconscious
      ? COMBATANT_HEALTH_STATES.UNCONSCIOUS
      : isLowHp
        ? COMBATANT_HEALTH_STATES.LOW_HP
        : COMBATANT_HEALTH_STATES.HEALTHY;

  return {
    fighterId: fighter.id || fighter._id || fighter.fighterId || null,
    state,
    side,
    currentHp,
    maxHp,
    hpRatio,
    isDead,
    isUnconscious,
    isLowHp,
    pulse: isLowHp,
    baseColor: colors.base,
    paleColor: colors.pale,
    fillColor: isDead
      ? COMBATANT_HEALTH_COLORS.dead
      : isUnconscious
        ? colors.pale
        : colors.base,
    statusLabel: isDead
      ? "Dead"
      : isUnconscious
        ? "Unconscious"
        : isLowHp
          ? "Critical health"
          : "Healthy",
  };
}

export function buildCombatantHealthPresentationMap(fighters = []) {
  return Object.fromEntries(
    (Array.isArray(fighters) ? fighters : [])
      .filter(Boolean)
      .map((fighter) => {
        const presentation = getCombatantHealthPresentation(fighter);
        return [presentation.fighterId, presentation];
      })
      .filter(([fighterId]) => Boolean(fighterId)),
  );
}

export default getCombatantHealthPresentation;

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const ENEMY_LABELS = new Set(["enemy", "enemies", "enemyarmy", "hostile", "opponent", "opponents"]);
const PLAYER_LABELS = new Set(["player", "players", "party", "playerparty", "player party", "heroes"]);

const normalizeSideLabel = (value) => {
  const label = normalizeText(value);
  if (!label) return "";
  if (ENEMY_LABELS.has(label) || label.includes("enemy")) return "enemy";
  if (PLAYER_LABELS.has(label)) return "player";
  return "";
};

const getExplicitSideValues = (combatant = {}) => [
  combatant?.team,
  combatant?.side,
  combatant?.battleSide,
  combatant?.teamId,
  combatant?.armyId,
  combatant?.armyName,
  combatant?.factionId,
];

export function getCombatantSide(combatant = {}, related = null) {
  const explicitSides = [
    ...getExplicitSideValues(combatant),
    ...getExplicitSideValues(related || {}),
  ].map(normalizeSideLabel).filter(Boolean);

  if (explicitSides.includes("enemy")) return "enemy";
  if (explicitSides.includes("player")) return "player";

  const legacySides = [combatant?.type, related?.type, combatant?.role, related?.role]
    .map(normalizeSideLabel)
    .filter(Boolean);
  if (legacySides.includes("enemy")) return "enemy";
  if (legacySides.includes("player")) return "player";
  return "unknown";
}

export function isEnemyCombatant(combatant = {}, related = null) {
  return getCombatantSide(combatant, related) === "enemy";
}

export function isPartyCombatant(combatant = {}, related = null) {
  return getCombatantSide(combatant, related) === "player";
}

export function isManualPlayerCombatant(combatant = {}, { related = null, aiControlEnabled = false } = {}) {
  if (!combatant || aiControlEnabled || combatant.aiControlled === true) return false;
  const controlMode = normalizeText(combatant.controlMode || combatant.controller);
  if (controlMode === "ai" || controlMode === "passive" || controlMode === "defensive") return false;
  return isPartyCombatant(combatant, related);
}

export default {
  getCombatantSide,
  isEnemyCombatant,
  isManualPlayerCombatant,
  isPartyCombatant,
};

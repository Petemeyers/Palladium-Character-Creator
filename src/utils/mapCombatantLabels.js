const MAX_TOKEN_LABEL_LENGTH = 20;

const BROKEN_TEXT_PATTERN = new RegExp(
  "[\\u00c3\\u00f0\\ufffd\\u00e2\\u0192\\u00c2\\u00c5\\u00c6\\u0153\\u00a2\\u20ac\\u2122\\u0178\\u00a1\\u00af\\u00b8]",
  "g"
);
const NON_DISPLAY_ASCII_PATTERN = /[^\x20-\x7E]/g;

export const cleanMapLabelText = (value, fallback = "") => {
  const scalar =
    value === null || value === undefined || typeof value === "object" || typeof value === "function"
      ? ""
      : String(value);
  const cleaned = scalar
    .replace(BROKEN_TEXT_PATTERN, "")
    .replace(NON_DISPLAY_ASCII_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
};

const shortenLabel = (value, maxLength = MAX_TOKEN_LABEL_LENGTH) => {
  const text = cleanMapLabelText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const firstPresent = (...values) => {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
};

const getHitPoints = (combatant) =>
  firstPresent(
    combatant?.currentHP,
    combatant?.hp,
    combatant?.HP,
    combatant?.hitPoints,
    combatant?.publicDerivedStats?.hitPoints
  );

const getStamina = (combatant) =>
  firstPresent(combatant?.currentStamina, combatant?.stamina, combatant?.Stamina);

export const shouldShowMapCombatantLabel = ({
  combatant,
  isCurrent = false,
  isSelected = false,
} = {}) => Boolean(combatant && (isCurrent || isSelected));

export const getMapCombatantTokenLabel = ({
  combatant,
  isCurrent = false,
  isSelected = false,
} = {}) => {
  if (!shouldShowMapCombatantLabel({ combatant, isCurrent, isSelected })) {
    return "";
  }

  const name = cleanMapLabelText(combatant?.name, "Unit");
  const hp = getHitPoints(combatant);

  if (isSelected) {
    const hpText = hp !== null ? ` HP ${hp}` : "";
    return shortenLabel(`${name}${hpText}`);
  }

  if (isCurrent) {
    return shortenLabel(name);
  }

  return "";
};

export const getMapCombatantTooltip = (combatant) => {
  if (!combatant || typeof combatant !== "object") return "";

  const name = cleanMapLabelText(combatant.name, "Unit");
  const side = combatant.isEnemy || combatant.side === "enemy" ? "Enemy" : "Player";
  const hp = getHitPoints(combatant);
  const stamina = getStamina(combatant);
  const parts = [name, `Side: ${side}`];

  if (hp !== null) parts.push(`HP: ${cleanMapLabelText(hp, "?")}`);
  if (stamina !== null) parts.push(`Stamina: ${cleanMapLabelText(stamina, "?")}`);

  return parts.join(" | ");
};

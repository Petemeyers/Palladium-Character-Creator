import {
  getArmorClass,
  getHitPoints,
  getMaxHitPoints,
  getTemporaryHitPoints,
} from "./normalizeCombatant.js";
import { getDefaultStamina } from "./combatStamina.js";

const ABILITY_KEYS = [
  ["strength", ["str", "STR", "strength", "Strength"], "PS"],
  ["dexterity", ["dex", "DEX", "dexterity", "Dexterity"], "PP"],
  ["constitution", ["con", "CON", "constitution", "Constitution"], "PE"],
  ["intelligence", ["int", "INT", "intelligence", "Intelligence"], "IQ"],
  ["wisdom", ["wis", "WIS", "wisdom", "Wisdom"], "ME"],
  ["charisma", ["cha", "CHA", "charisma", "Charisma"], "MA"],
];

const COMPATIBILITY_KEYS = ["IQ", "ME", "MA", "PS", "PP", "PE", "PB", "Spd"];

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toPlainObject = (value) => {
  if (!value || typeof value !== "object") return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (typeof value.toObject === "function") return value.toObject();
  return value;
};

const toFiniteNumber = (value) => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const number = toFiniteNumber(value);
    if (number !== null) return number;
  }
  return null;
};

const readNumberFromObject = (object, keys) => {
  const plain = toPlainObject(object);
  for (const key of keys) {
    const number = toFiniteNumber(plain?.[key]);
    if (number !== null) return number;
  }
  return null;
};

const readAbilityScores = (combatant) => {
  const finalScores = toPlainObject(combatant?.finalAbilityScores);
  const publicScores = toPlainObject(combatant?.publicAbilityScores);
  const abilityScores = toPlainObject(combatant?.abilityScores);
  const compatibilityAttributes = toPlainObject(combatant?.compatibilityAttributes);
  const attributes = toPlainObject(combatant?.attributes);

  return Object.fromEntries(
    ABILITY_KEYS.map(([displayKey, publicKeys, compatibilityKey]) => [
      displayKey,
      firstNumber(
        readNumberFromObject(finalScores, publicKeys),
        readNumberFromObject(publicScores, publicKeys),
        readNumberFromObject(abilityScores, publicKeys),
        compatibilityAttributes?.[compatibilityKey],
        attributes?.[compatibilityKey],
        combatant?.[compatibilityKey],
        combatant?.[publicKeys[0]]
      ),
    ])
  );
};

const readCompatibilityAttributes = (combatant) => {
  const compatibilityAttributes = toPlainObject(combatant?.compatibilityAttributes);
  const attributes = toPlainObject(combatant?.attributes);

  return Object.fromEntries(
    COMPATIBILITY_KEYS.map((key) => [
      key,
      firstNumber(
        compatibilityAttributes?.[key],
        attributes?.[key],
        attributes?.[key.toLowerCase()],
        combatant?.[key],
        combatant?.[key.toLowerCase()]
      ),
    ])
  );
};

const getSourceLabel = (combatant) => {
  const source = String(combatant?.source || combatant?.publicDisplaySource || "").toLowerCase();
  if (source === "saved-character" || combatant?.publicDisplaySource === "saved-character" || combatant?.generated === false) {
    return "Saved Character";
  }
  if (combatant?.generated === true || source === "autoroll" || source === "generated") {
    return "Generated";
  }
  if (combatant?.type === "enemy" || combatant?.side === "enemy" || source === "public-enemy") {
    return "Enemy";
  }
  return "Compatibility";
};

const readMovementSpeed = (combatant) => (
  firstNumber(
    combatant?.publicDerivedStats?.speed,
    combatant?.derivedStats?.speed,
    combatant?.derived?.speed,
    combatant?.movementSpeed,
    combatant?.speed
  ) ?? 30
);

const readStaminaPair = (combatant) => {
  const pairs = [
    [combatant?.combatStamina?.current, combatant?.combatStamina?.max],
    [combatant?.combatStamina?.currentStamina, combatant?.combatStamina?.maxStamina],
    [combatant?.fatigueState?.currentStamina, combatant?.fatigueState?.maxStamina],
    [combatant?.currentStamina, combatant?.maxStamina],
    [combatant?.staminaCurrent, combatant?.staminaMax],
    [combatant?.currentstamina, combatant?.maxstamina],
  ];

  for (const [currentRaw, maxRaw] of pairs) {
    const current = toFiniteNumber(currentRaw);
    const max = toFiniteNumber(maxRaw);
    if (current !== null && max !== null && max > 0) {
      return { current, max };
    }
  }

  const maxOnly = firstNumber(
    combatant?.combatStamina?.max,
    combatant?.combatStamina?.maxStamina,
    combatant?.fatigueState?.maxStamina,
    combatant?.maxStamina,
    combatant?.staminaMax,
    combatant?.maxstamina
  );
  if (maxOnly !== null && maxOnly > 0) {
    const current = firstNumber(
      combatant?.combatStamina?.current,
      combatant?.combatStamina?.currentStamina,
      combatant?.fatigueState?.currentStamina,
      combatant?.currentStamina,
      combatant?.staminaCurrent,
      combatant?.currentstamina,
      maxOnly
    );
    return { current: current ?? maxOnly, max: maxOnly };
  }

  const fallback = getDefaultStamina(combatant);
  return { current: fallback, max: fallback };
};

export function buildCombatDisplayStats(combatant = {}) {
  const safeCombatant = combatant && typeof combatant === "object" ? combatant : {};
  const stamina = readStaminaPair(safeCombatant);
  const compatibilityAttributes = readCompatibilityAttributes(safeCombatant);

  return {
    sourceLabel: getSourceLabel(safeCombatant),
    hpCurrent: getHitPoints(safeCombatant),
    hpMax: getMaxHitPoints(safeCombatant),
    tempHp: getTemporaryHitPoints(safeCombatant),
    armorClass: getArmorClass(safeCombatant),
    movementSpeed: readMovementSpeed(safeCombatant),
    legacySpdAttribute: compatibilityAttributes.Spd,
    staminaCurrent: stamina.current,
    staminaMax: stamina.max,
    focusCurrent: firstNumber(safeCombatant.currentfocus, safeCombatant.currentFocus, safeCombatant.focus),
    abilityScores: readAbilityScores(safeCombatant),
    compatibilityAttributes,
  };
}

export default {
  buildCombatDisplayStats,
};

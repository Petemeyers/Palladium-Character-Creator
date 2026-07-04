import { calculateAttackStaminaCost } from "./combatStamina.js";
import { getRoutingArmorProfile, getStaminaRoutingProfile } from "./survivalIntent.js";
import { isCombatantFled } from "./combatFledState.js";
import { isCombatantBroken } from "./combatBrokenState.js";

export const SIMULATOR_ATTRIBUTE_DEFINITIONS = Object.freeze([
  ["might", "Might"],
  ["deftness", "Deftness"],
  ["vigor", "Vigor"],
  ["endurance", "Endurance"],
  ["mobility", "Mobility"],
  ["intellect", "Intellect"],
  ["awareness", "Awareness"],
  ["cunning", "Cunning"],
  ["resolve", "Resolve"],
  ["discipline", "Discipline"],
  ["presence", "Presence"],
  ["renown", "Renown"],
  ["favor", "Favor"],
]);

const CLASSIC_ABILITY_DEFINITIONS = Object.freeze([
  ["strength", "str", "Strength"],
  ["dexterity", "dex", "Dexterity"],
  ["constitution", "con", "Constitution"],
  ["intelligence", "int", "Intelligence"],
  ["wisdom", "wis", "Wisdom"],
  ["charisma", "cha", "Charisma"],
]);

const hasValue = (value) => value !== undefined && value !== null && value !== "";
const finite = (...values) => {
  for (const value of values) {
    if (!hasValue(value) || typeof value === "boolean") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
};
const text = (...values) => values.find((value) => hasValue(value)) ?? "";
const label = (value, fallback = "Unknown") => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw.toLowerCase().replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getSourceDisplay = (actor) => {
  const source = String(actor?.source || actor?.publicDisplaySource || actor?.sourceLabel || "").toLowerCase();
  if (source.includes("compatibility") || source.includes("legacy")) return "Compatibility Import";
  if (source.includes("saved")) return "Saved Character";
  if (source.includes("generated") || source.includes("autoroll")) return "Generated Actor";
  return actor?.sourceLabel || actor?.publicDisplaySource || actor?.source || "Local Actor";
};

export function getActorIdentityDisplay(actor = {}) {
  return {
    name: actor?.name || "Unnamed Actor",
    battleSide: label(actor?.battleSide || actor?.side || actor?.team || actor?.type, "Unassigned"),
    team: label(actor?.teamId || actor?.team || actor?.armyId || actor?.factionId, "Unassigned"),
    species: text(actor?.species, actor?.race, actor?.category, actor?.combatantType, "Unknown"),
    role: text(actor?.profession, actor?.role, actor?.className, actor?.class, actor?.publicClassName, "Not assigned"),
    source: getSourceDisplay(actor),
    controlMode: label(actor?.controlMode || actor?.defaultControlMode, "Not assigned"),
  };
}

const getLivingState = (actor) => {
  const hp = finite(actor?.currentHP, actor?.HP, actor?.hp, actor?.hitPoints);
  const status = String(actor?.status || "").toLowerCase();
  const condition = String(actor?.condition || "").toLowerCase();
  if (actor?.isDead || actor?.dead || status === "dead" || condition === "dead") return "Dead";
  if (actor?.isUnconscious || actor?.unconscious || /unconscious/.test(status + condition)) return "Unconscious";
  if (actor?.isDying || actor?.dying || /dying/.test(status + condition)) return "Dying";
  if (hp !== null && hp <= 0) return "Incapacitated";
  return "Alive";
};

export function getActorCombatStateDisplay(actor = {}) {
  const morale = String(actor?.moraleState?.status || actor?.state?.moraleState || "").toLowerCase();
  const intent = String(actor?.moraleState?.survivalIntent || actor?.moraleState?.executedSurvivalIntent || "").toLowerCase();
  let combatState = text(actor?.combatState, actor?.status, morale, "active");
  if (isCombatantFled(actor)) combatState = "fled";
  else if (isCombatantBroken(actor)) combatState = actor?.isSurrendered || /surrender/.test(String(actor?.status)) ? "surrendered" : "combat-broken";
  else if (intent === "panic-flee-to-edge") combatState = "panic fleeing";
  else if (intent === "cower") combatState = "cowering";
  else if (morale === "routed") combatState = "routed";
  const inactive = isCombatantFled(actor) || isCombatantBroken(actor) || actor?.active === false || actor?.canAct === false;
  return {
    hpCurrent: finite(actor?.currentHP, actor?.HP, actor?.hp, actor?.hitPoints) ?? 0,
    hpMax: finite(actor?.maxHP, actor?.maxHp, actor?.totalHP, actor?.maxHitPoints) ?? finite(actor?.currentHP, actor?.HP, actor?.hp) ?? 0,
    livingState: getLivingState(actor),
    combatState: label(combatState, "Active"),
    posture: label(actor?.combatPosture?.type || actor?.currentPosture, "None"),
    actionsRemaining: finite(actor?.remainingActions, actor?.actionsRemaining) ?? 0,
    inactive,
    inactiveLabel: inactive ? "No longer active combatant" : "Active combatant",
  };
}

export function getActorCoreAttributesDisplay(actor = {}) {
  const attributes = actor?.actorProfile?.attributes || actor?.simulatorAttributes || actor?.attributes || {};
  const entries = SIMULATOR_ATTRIBUTE_DEFINITIONS.map(([key, displayLabel]) => ({
    key,
    label: displayLabel,
    value: finite(attributes?.[key]),
  })).filter((entry) => entry.value !== null);
  return {
    entries,
    complete: entries.length === SIMULATOR_ATTRIBUTE_DEFINITIONS.length,
    fallback: entries.length === 0 ? "Not yet assigned. Using compatibility fallback." : null,
  };
}

export function getActorStaminaDisplay(actor = {}) {
  const profile = getStaminaRoutingProfile(actor);
  const current = profile.current;
  return {
    current,
    max: profile.max,
    band: current <= 0 ? "Spent" : label(profile.band),
    isFallback: !profile.hasExplicitStamina,
    fatigueNotes: text(actor?.fatigueState?.note, actor?.fatigueNotes, "None recorded"),
    catchBreath: "Recover 3 stamina, consumes 1 action",
    defensivePosture: "May recover 1 stamina if not attacked",
  };
}

export function getActorMoraleDisplay(actor = {}) {
  const state = text(actor?.moraleState?.status, actor?.state?.moraleState, actor?.moraleStatus, "steady");
  const pressure = text(
    actor?.moraleState?.lastReason,
    actor?.moraleState?.reason,
    actor?.moraleState?.routingSource,
    actor?.state?.routReason,
    "None recorded",
  );
  const pursued = actor?.moraleState?.pursued === true || actor?.routingState?.pursued === true;
  return {
    state: label(state),
    resolve: finite(actor?.actorProfile?.attributes?.resolve, actor?.simulatorAttributes?.resolve, actor?.attributes?.resolve),
    pressure: label(pressure, "None recorded"),
    rally: pursued ? "Cannot rally while pursued" : /routed|broken|shaken/i.test(String(state)) ? "Eligible if unpursued" : "Not currently required",
  };
}

const findRealArmor = (actor) => {
  const candidates = [actor?.equippedArmor, actor?.equistaminadArmor, actor?.armorItem, actor?.armor];
  if (Array.isArray(actor?.equipment)) {
    candidates.push(...actor.equipment.filter((item) => /armor|mail|plate|brigandine|chain|leather/i.test(String(item?.category || item?.type || item?.name || item))));
  }
  return candidates.find((item) => {
    if (typeof item === "string") return item.trim() && !/^\d+$/.test(item.trim());
    return item && typeof item === "object" && hasValue(item.name || item.itemName || item.label);
  }) || null;
};

export function getActorArmorDisplay(actor = {}) {
  const profile = getRoutingArmorProfile(actor);
  const realArmor = findRealArmor(actor);
  const legacyAC = finite(actor?.armorClass, actor?.ac, actor?.guardRating, actor?.derivedStats?.armorClass);
  const shield = text(actor?.equippedShield?.name, actor?.shield?.name, actor?.equippedShield, actor?.shield, actor?.offHand?.name);
  if (realArmor) {
    const item = typeof realArmor === "string" ? { name: realArmor } : realArmor;
    const itemArmorBand = String(item.weightClass || item.armorClassName || item.category || profile.band || "unarmored");
    const itemIsHeavy = /heavy|plate|brigandine|coat of plates/i.test(itemArmorBand + " " + String(item.name || ""));
    return {
      kind: "itemized",
      name: item.name || item.itemName || item.label,
      armorClass: label(itemArmorBand),
      coverage: Array.isArray(item.coverage) ? item.coverage.join(", ") : text(item.coverage, "Not recorded"),
      condition: label(item.condition || item.status, "Not recorded"),
      lootable: item.lootable === true ? "Yes" : item.lootable === false ? "No" : "Not specified",
      guardBonus: finite(item.guardBonus, item.defenseBonus, item.acBonus),
      burden: label(itemArmorBand),
      moraleProtection: itemIsHeavy || profile.heavy ? "Physical strong / Mythic limited" : "Limited",
      shield: shield ? { name: String(shield), burden: "Adds panic-run burden", defensiveUse: "Block" } : null,
    };
  }
  return {
    kind: legacyAC !== null ? "inferred" : "none",
    name: legacyAC !== null ? `Inferred ${label(profile.band)} Armor` : "No armor item assigned",
    source: legacyAC !== null ? `Legacy AC ${legacyAC}` : "No armor data",
    lootable: legacyAC !== null ? "Not yet itemized" : "No",
    burden: label(profile.band),
    moraleProtection: profile.heavy ? "Physical strong / Mythic limited" : "Limited",
    shield: shield ? { name: String(shield), burden: "Adds panic-run burden", defensiveUse: "Block" } : null,
  };
}

const weaponCandidates = (actor) => {
  const candidates = [];
  const slots = actor?.weaponSlots || {};
  Object.entries(slots).forEach(([slot, weapon]) => weapon && candidates.push({ weapon, slot }));
  const equipped = actor?.equippedWeapons || actor?.equistaminadWeapons;
  if (Array.isArray(equipped)) equipped.forEach((weapon, index) => candidates.push({ weapon, slot: weapon?.slot || `Equipped ${index + 1}` }));
  else if (equipped && typeof equipped === "object") Object.entries(equipped).forEach(([slot, weapon]) => weapon && candidates.push({ weapon, slot }));
  if (candidates.length === 0 && Array.isArray(actor?.weapons)) actor.weapons.forEach((weapon, index) => candidates.push({ weapon, slot: weapon?.slot || `Weapon ${index + 1}` }));
  if (candidates.length === 0 && Array.isArray(actor?.attacks)) actor.attacks.forEach((weapon, index) => candidates.push({ weapon, slot: weapon?.slot || `Attack ${index + 1}` }));
  return candidates;
};

export function getActorWeaponDisplay(actor = {}) {
  const seen = new Set();
  return weaponCandidates(actor).map(({ weapon, slot }) => {
    const item = typeof weapon === "string" ? { name: weapon } : weapon;
    const name = item?.name || item?.weaponName || "Unnamed Weapon";
    const key = `${name}:${slot}`.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      key,
      name,
      slot: label(slot, "Not recorded"),
      reach: finite(item?.reach, item?.reachFeet, item?.rangeFeet, item?.range),
      damage: text(item?.damage, item?.damageDice, "Not recorded"),
      attackType: label(item?.attackType || item?.kind || item?.type || (item?.range ? "ranged" : "melee")),
      staminaCost: calculateAttackStaminaCost({ fighter: actor, weapon: item, attackType: item?.attackType || item?.type }),
    };
  }).filter(Boolean);
}

export function getLegacyCompatibilityDisplay(actor = {}) {
  const scores = actor?.finalAbilityScores || actor?.publicAbilityScores || actor?.abilityScores || {};
  const classicAbilityScores = CLASSIC_ABILITY_DEFINITIONS.map(([longKey, shortKey, displayLabel]) => ({
    key: longKey,
    label: displayLabel,
    value: finite(scores?.[longKey], scores?.[shortKey], actor?.[longKey], actor?.[shortKey]),
  })).filter((entry) => entry.value !== null);
  return {
    classicAbilityScores,
    alignment: text(actor?.alignment, actor?.alignmentName, "Not assigned"),
    armorClass: finite(actor?.armorClass, actor?.ac, actor?.guardRating, actor?.derivedStats?.armorClass),
    className: text(actor?.class, actor?.className, actor?.profession, "Not assigned"),
    species: text(actor?.race, actor?.species, "Not assigned"),
  };
}

export function getActorActionsDisplay(actor = {}) {
  const techniques = Array.isArray(actor?.techniques) ? actor.techniques : Array.isArray(actor?.training) ? actor.training : [];
  return {
    standard: [
      "Attack",
      "Move",
      "Defensive Posture: May recover 1 stamina if not attacked",
      "Catch Breath: Recover 3 stamina, consumes 1 action",
    ],
    techniques: techniques.map((entry) => typeof entry === "string" ? entry : entry?.name).filter(Boolean),
  };
}

export function buildActorSheetDisplay(actor = {}) {
  const safeActor = actor && typeof actor === "object" ? actor : {};
  return {
    identity: getActorIdentityDisplay(safeActor),
    combatState: getActorCombatStateDisplay(safeActor),
    coreAttributes: getActorCoreAttributesDisplay(safeActor),
    stamina: getActorStaminaDisplay(safeActor),
    morale: getActorMoraleDisplay(safeActor),
    armor: getActorArmorDisplay(safeActor),
    weapons: getActorWeaponDisplay(safeActor),
    actions: getActorActionsDisplay(safeActor),
    legacy: getLegacyCompatibilityDisplay(safeActor),
  };
}

export default buildActorSheetDisplay;

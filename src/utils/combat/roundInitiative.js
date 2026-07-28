import { getAbilityModifier, getDexModifier } from "../normalizeCombatant.js";
import { getReachInitiativeModifier } from "../reachCombatRules.js";
import { isCombatantBroken } from "../combatBrokenState.js";
import { isCombatantFled } from "../combatFledState.js";
import { isSurrenderedForCombat } from "./surrenderState.js";

const TERMINAL_STATES = new Set([
  "captured",
  "combat-broken",
  "dead",
  "defeated",
  "dying",
  "executed",
  "fled",
  "removed",
  "surrendered",
  "unconscious",
  "unconsciousbleeding",
  "unconsciousstable",
]);

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedState(value) {
  if (value && typeof value === "object") {
    return String(value.type ?? value.status ?? value.state ?? "").trim().toLowerCase();
  }
  return String(value ?? "").trim().toLowerCase();
}

function combatantId(combatant = {}, fallbackIndex = 0) {
  return String(
    combatant.id ??
    combatant._id ??
    combatant.actorId ??
    combatant.name ??
    `initiative-slot-${fallbackIndex}`
  );
}

function normalizeD20(value) {
  return Math.max(1, Math.min(20, Math.trunc(numberOr(value, 1))));
}

function rollD20(rng) {
  if (typeof rng !== "function") return 1;
  return normalizeD20(rng());
}

const randomD20 = () => Math.floor(Math.random() * 20) + 1;

export function getPrimaryInitiativeWeapon(combatant = {}) {
  const equipped = combatant.equistaminadWeapons ?? combatant.equippedWeapons;
  if (Array.isArray(equipped)) {
    return equipped.find((weapon) => weapon && weapon.disabled !== true) ?? null;
  }
  if (equipped && typeof equipped === "object") {
    return equipped.primary ?? equipped.rightHand ?? equipped.secondary ?? equipped.leftHand ?? null;
  }

  const slots = combatant.weaponSlots;
  if (slots && typeof slots === "object") {
    return slots.rightHand ?? slots.primary ?? slots.leftHand ?? slots.secondary ?? null;
  }

  const single = combatant.equistaminadWeapon ?? combatant.equippedWeapon ?? combatant.weapon;
  return single && typeof single === "object" ? single : null;
}

export function isInitiativeEligible(combatant = {}) {
  if (!combatant || typeof combatant !== "object") return false;
  if (
    combatant.dead === true ||
    combatant.isDead === true ||
    combatant.unconscious === true ||
    combatant.isUnconscious === true ||
    combatant.defeated === true ||
    combatant.isDefeated === true ||
    combatant.captured === true ||
    combatant.isCaptured === true ||
    combatant.removed === true ||
    combatant.inBattle === false ||
    combatant.canAct === false
  ) {
    return false;
  }
  if (isCombatantFled(combatant) || isCombatantBroken(combatant) || isSurrenderedForCombat(combatant)) {
    return false;
  }

  const hp = Number(
    combatant.currentHP ??
    combatant.currentHp ??
    combatant.hp ??
    combatant.HP
  );
  if (Number.isFinite(hp) && hp <= 0) return false;

  const states = [
    combatant.status,
    combatant.condition,
    combatant.combatState,
    combatant.surrenderState?.status,
    combatant.prisonerState?.status,
    ...(Array.isArray(combatant.statusEffects) ? combatant.statusEffects : []),
  ].map(normalizedState);
  return !states.some((state) => TERMINAL_STATES.has(state));
}

function getCombatTrainingInitiativeBonus(combatant = {}) {
  const explicit = Number(combatant.initiativeBonus);
  if (Number.isFinite(explicit)) return explicit;
  const candidates = [
    combatant.handToHand?.initiativeBonus,
    combatant.training?.initiativeBonus,
    combatant.combatTraining?.initiativeBonus,
    combatant.skillBonuses?.initiative,
    combatant.bonuses?.initiative,
  ];
  const first = candidates.find((value) => Number.isFinite(Number(value)));
  return numberOr(first, 0);
}

function getTemporaryInitiativeModifier(combatant = {}, round = 1) {
  const meta = combatant.meta ?? {};
  const temporary = combatant.temporaryInitiativeModifier;
  const temporaryValue = temporary && typeof temporary === "object"
    ? temporary.value ?? temporary.modifier ?? temporary.bonus
    : temporary;
  const temporaryExpired = temporary && typeof temporary === "object" &&
    Number.isFinite(Number(temporary.expiresAfterRound)) &&
    Number(round) > Number(temporary.expiresAfterRound);

  return (
    numberOr(meta.horrorInitPenalty, 0) +
    (temporaryExpired ? 0 : numberOr(temporaryValue, 0)) +
    numberOr(combatant.temporaryInitiativeBonus, 0) +
    numberOr(combatant.bonuses?.temporaryInitiative, 0) +
    numberOr(combatant.bonuses?.tempInitiative, 0) +
    numberOr(combatant.bonuses?.tempPenalties?.initiative, 0)
  );
}

function consumeRolledTemporaryInitiative(combatant = {}) {
  let next = combatant;
  if (combatant.meta?.horrorInitPenalty !== undefined) {
    const meta = { ...combatant.meta };
    delete meta.horrorInitPenalty;
    next = { ...next, meta };
  }

  const temporary = combatant.temporaryInitiativeModifier;
  if (temporary && typeof temporary === "object" && temporary.consumeOnRoll === true) {
    next = { ...next, temporaryInitiativeModifier: null };
  } else if (
    temporary &&
    typeof temporary === "object" &&
    Number.isFinite(Number(temporary.remainingRounds))
  ) {
    const remainingRounds = Math.max(0, Number(temporary.remainingRounds) - 1);
    next = {
      ...next,
      temporaryInitiativeModifier: remainingRounds > 0
        ? { ...temporary, remainingRounds }
        : null,
    };
  }
  return next;
}

export function calculateInitiativeBonus(combatant = {}, context = {}) {
  const physicalProwessScore = [
    combatant.attributes?.PP,
    combatant.PP,
    combatant.compatibilityAttributes?.PP,
    combatant.attributes?.PhysicalProwess,
    combatant.physicalProwess,
  ].find((value) => Number.isFinite(Number(value)));
  const physicalProwessModifier = physicalProwessScore === undefined
    ? getDexModifier(combatant)
    : getAbilityModifier(physicalProwessScore);
  const combatTrainingBonus = getCombatTrainingInitiativeBonus(combatant);
  const weapon = context.weapon ?? getPrimaryInitiativeWeapon(combatant);
  const isUnarmed = !weapon || /unarmed|fist|claw|bite/i.test(String(weapon.name ?? ""));
  const weaponMeasureModifier = isUnarmed ? 0 : numberOr(getReachInitiativeModifier(weapon), 0);
  const temporaryModifier = getTemporaryInitiativeModifier(combatant, context.round);
  return {
    physicalProwessModifier,
    combatTrainingBonus,
    weaponMeasureModifier,
    temporaryModifier,
    total: physicalProwessModifier + combatTrainingBonus + weaponMeasureModifier + temporaryModifier,
    weaponId: weapon?.profileKey ?? weapon?.id ?? weapon?._id ?? weapon?.name ?? null,
  };
}

export function rollCombatantInitiative(combatant = {}, context = {}, rng = randomD20) {
  const round = Math.max(1, Math.trunc(numberOr(context.round, 1)));
  const eligible = isInitiativeEligible(combatant);
  if (!eligible) {
    return {
      ...combatant,
      initiative: null,
      initiativeRoll: null,
      initiativeTotal: null,
      initiativeTieBreaker: null,
      initiativeRound: round,
      initiativeEligible: false,
      remainingActions: 0,
    };
  }

  const initiativeRoll = rollD20(rng);
  const bonus = calculateInitiativeBonus(combatant, { ...context, round });
  const initiativeTotal = initiativeRoll + bonus.total;
  const withConsumedModifier = consumeRolledTemporaryInitiative(combatant);
  return {
    ...withConsumedModifier,
    initiative: initiativeTotal,
    initiativeRoll,
    initiativeTotal,
    initiativeTieBreaker: null,
    initiativeRound: round,
    initiativeEligible: true,
    initiativeBonus: bonus.combatTrainingBonus,
    initiativeBreakdown: bonus,
  };
}

export function sortRoundInitiative(combatants = []) {
  return [...combatants].sort((left, right) => {
    if (left.initiativeEligible !== right.initiativeEligible) {
      return left.initiativeEligible ? -1 : 1;
    }
    if (!left.initiativeEligible) {
      return combatantId(left).localeCompare(combatantId(right));
    }
    const totalDifference = numberOr(right.initiativeTotal) - numberOr(left.initiativeTotal);
    if (totalDifference !== 0) return totalDifference;
    const tieDifference = numberOr(right.initiativeTieBreaker) - numberOr(left.initiativeTieBreaker);
    if (tieDifference !== 0) return tieDifference;
    return combatantId(left).localeCompare(combatantId(right));
  });
}

export function rollRoundInitiative(combatants = [], context = {}, rng = randomD20) {
  const rolled = (Array.isArray(combatants) ? combatants : []).map((combatant) =>
    rollCombatantInitiative(combatant, context, rng)
  );
  const tieCounts = new Map();
  rolled.forEach((combatant) => {
    if (!combatant.initiativeEligible) return;
    const total = combatant.initiativeTotal;
    tieCounts.set(total, (tieCounts.get(total) ?? 0) + 1);
  });
  const withTieBreakers = rolled.map((combatant) => {
    if (!combatant.initiativeEligible || (tieCounts.get(combatant.initiativeTotal) ?? 0) < 2) {
      return combatant;
    }
    return { ...combatant, initiativeTieBreaker: rollD20(rng) };
  });
  return sortRoundInitiative(withTieBreakers);
}

export default rollRoundInitiative;

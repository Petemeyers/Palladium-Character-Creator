const text = (...values) => values.filter(Boolean).join(" ").toLowerCase();

const positionOf = (actor, positions = {}) => (
  positions?.[actor?.id] || actor?.position || actor?.hex || null
);

const isNeutralGrappleState = (actor) => {
  const state = text(actor?.grappleState?.state || "neutral");
  return !state || state === "neutral";
};

const hasGrappleStatus = (actor) => {
  const status = text(
    actor?.grappleState?.state,
    actor?.status,
    actor?.condition,
    ...(Array.isArray(actor?.statusEffects) ? actor.statusEffects : []),
  );
  return /grapple|clinch|pinned|held|restrained/.test(status);
};

export function getMeleeEngagementContext({
  actor = {},
  target = {},
  positions = {},
  distanceFeet,
  calculateDistance,
} = {}) {
  const actorPosition = positionOf(actor, positions);
  const targetPosition = positionOf(target, positions);
  const hasMeasuredDistance = distanceFeet !== null && distanceFeet !== undefined && distanceFeet !== "";
  const measuredDistance = Number(distanceFeet);
  const distance = hasMeasuredDistance && Number.isFinite(measuredDistance)
    ? measuredDistance
    : actorPosition && targetPosition && typeof calculateDistance === "function"
      ? Number(calculateDistance(actorPosition, targetPosition))
      : Infinity;
  const actorState = text(actor?.grappleState?.state);
  const targetState = text(target?.grappleState?.state);
  const actorNamesTarget = actor?.grappleState?.opponent === target?.id;
  const targetNamesActor = target?.grappleState?.opponent === actor?.id;
  const linkedGrapple = Boolean(
    actor?.id &&
    target?.id &&
    (actorNamesTarget || targetNamesActor) &&
    (!isNeutralGrappleState(actor) || !isNeutralGrappleState(target))
  );
  const isGround = Boolean(
    actor?.prone || target?.prone ||
    actorState.includes("ground") || targetState.includes("ground")
  );
  const isClinched = Boolean(
    linkedGrapple &&
    (actorState.includes("clinch") || targetState.includes("clinch"))
  );
  const isGrappling = Boolean(
    linkedGrapple ||
    (hasGrappleStatus(actor) && actorNamesTarget) ||
    (hasGrappleStatus(target) && targetNamesActor)
  );
  const isAdjacent = Number.isFinite(distance) && distance <= 5.5;
  const rangeBand = isGround
    ? "ground"
    : isClinched
      ? "clinch"
      : isGrappling
        ? "grapple"
        : isAdjacent
          ? "close-melee"
          : "open-melee";

  return {
    distanceFeet: distance,
    isAdjacent,
    isClinched,
    isGrappling,
    isGround,
    rangeBand,
  };
}

export function isChargeOnlyAttack(attack = {}) {
  const label = text(attack.name, attack.type, attack.attackType, attack.category);
  return Boolean(
    attack.chargeOnly === true ||
    attack.requiresOpenMelee === true ||
    label.includes("charge") ||
    label.includes("trample") ||
    label.includes("gore") ||
    label.includes("ram")
  );
}

const isRangedAttack = (attack = {}) => {
  const label = text(attack.name, attack.type, attack.attackType, attack.category, attack.kind);
  return Boolean(
    attack.isRanged === true ||
    attack.ammunition ||
    /ranged|bow|crossbow|sling/.test(label)
  );
};

const isNaturalOrUnarmed = (attack = {}) => {
  const label = text(attack.name, attack.type, attack.attackType, attack.category);
  return Boolean(
    attack.naturalWeapon === true ||
    attack.isNaturalAttack === true ||
    attack.isFallbackUnarmed === true ||
    /natural|unarmed|headbutt|horn hook|crush|claw|bite|grab|throw|stomp/.test(label)
  );
};

export function isAttackUsableInClinch(attack = {}) {
  if (!attack || isRangedAttack(attack) || isChargeOnlyAttack(attack)) return false;
  if (attack.usableInClinch === true || attack.grappleCapable === true || attack.grappleSuitable === true) return true;
  const label = text(attack.name, attack.type, attack.weaponType, attack.category);
  if (/dagger|knife|short blade/.test(label)) return true;
  if (isNaturalOrUnarmed(attack)) return true;
  if (/shield bash|pommel|hilt strike|grapple follow-up/.test(label)) return true;
  return false;
}

const clinchScore = (attack = {}) => {
  const label = text(attack.name, attack.type, attack.weaponType, attack.category);
  if (label.includes("dagger")) return 100;
  if (label.includes("knife")) return 98;
  if (label.includes("short blade")) return 94;
  if (label.includes("crush")) return 86;
  if (label.includes("headbutt")) return 84;
  if (label.includes("horn hook")) return 82;
  if (/grab|throw|stomp/.test(label)) return 80;
  if (isNaturalOrUnarmed(attack)) return 75;
  if (/shield bash|pommel|hilt strike/.test(label)) return 70;
  if (attack.usableInClinch === true) return 65;
  return 0;
};

const closeNaturalScore = (attack = {}) => {
  const label = text(attack.name);
  if (label.includes("headbutt")) return 100;
  if (label.includes("horn hook")) return 98;
  if (label.includes("crush")) return 96;
  if (label.includes("unarmed")) return 90;
  if (isNaturalOrUnarmed(attack)) return 80;
  return 0;
};

const flatten = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
};

export function getActorMeleeCandidates(actor = {}, candidates = []) {
  const combined = [
    ...flatten(candidates),
    ...flatten(actor.attacks),
    ...flatten(actor.equistaminadWeapons),
    ...flatten(actor.equippedWeapons),
    ...flatten(actor.inventory),
    ...flatten(actor.wardrobe),
    ...flatten(actor.equipment),
  ].filter((candidate) => candidate && candidate.name && !isRangedAttack(candidate));
  const seen = new Set();
  return combined.filter((candidate) => {
    const key = text(candidate.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const fallbackUnarmed = (actor = {}) => ({
  id: "fallback_clinch_unarmed_attack",
  name: "Unarmed Attack",
  damage: actor.unarmedDamage || "1d4",
  damageDice: actor.unarmedDamage || "1d4",
  count: 1,
  range: 5,
  rangeFeet: 5,
  reach: 5,
  reachFeet: 5,
  attackType: "melee",
  type: "melee",
  category: "unarmed",
  isMelee: true,
  isNaturalAttack: true,
  naturalWeapon: true,
  usableInClose: true,
  usableInClinch: true,
  isFallbackUnarmed: true,
});

export function selectMeleeAttackForContext({
  actor = {},
  target = {},
  candidates = [],
  selectedAttack = null,
  context,
  positions,
  distanceFeet,
  calculateDistance,
} = {}) {
  const engagement = context || getMeleeEngagementContext({
    actor,
    target,
    positions,
    distanceFeet,
    calculateDistance,
  });
  const available = getActorMeleeCandidates(actor, candidates);
  const inClinch = engagement.isClinched || engagement.isGrappling || engagement.isGround;

  if (inClinch) {
    const usable = available.filter(isAttackUsableInClinch).sort((a, b) => clinchScore(b) - clinchScore(a));
    const attack = usable[0] || fallbackUnarmed(actor);
    return {
      attack,
      changed: attack !== selectedAttack && attack?.name !== selectedAttack?.name,
      context: engagement,
      rejectedAttack: selectedAttack && !isAttackUsableInClinch(selectedAttack) ? selectedAttack : null,
      reason: usable[0] ? "clinch-preference" : "clinch-unarmed-fallback",
    };
  }

  if (engagement.isAdjacent) {
    const natural = available
      .filter((attack) => !isChargeOnlyAttack(attack) && (attack.usableInClose === true || isNaturalOrUnarmed(attack)))
      .sort((a, b) => closeNaturalScore(b) - closeNaturalScore(a))[0];
    const chargeRejected = isChargeOnlyAttack(selectedAttack || {});
    const dataDrivenNaturalPreference = Boolean(
      natural &&
      selectedAttack &&
      selectedAttack.usableInClose !== true &&
      !isNaturalOrUnarmed(selectedAttack)
    );
    if (chargeRejected || dataDrivenNaturalPreference) {
      const attack = natural || available.find((candidate) => !isChargeOnlyAttack(candidate)) || fallbackUnarmed(actor);
      return {
        attack,
        changed: attack?.name !== selectedAttack?.name,
        context: engagement,
        rejectedAttack: chargeRejected ? selectedAttack : null,
        reason: chargeRejected ? "charge-rejected-at-close-range" : "close-natural-preference",
      };
    }
  }

  return {
    attack: selectedAttack,
    changed: false,
    context: engagement,
    rejectedAttack: null,
    reason: "existing-open-melee-selection",
  };
}

export default {
  getActorMeleeCandidates,
  getMeleeEngagementContext,
  isAttackUsableInClinch,
  isChargeOnlyAttack,
  selectMeleeAttackForContext,
};

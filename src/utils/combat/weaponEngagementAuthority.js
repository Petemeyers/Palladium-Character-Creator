import { getCanonicalWeaponTraitProfile } from "./canonicalWeaponTraits.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const WEAPON_ENGAGEMENT_MEASURES = Object.freeze({
  OUTSIDE: "outside-measure",
  LONG_WEAPON: "long-weapon-measure",
  ENTRY_CONTESTED: "entry-contested",
  INSIDE_POINT: "inside-the-point",
  CLINCH: "clinch",
});

const abilityModifier = (score) => Math.floor((Number(score) - 10) / 2) || 0;

const getActorDeftnessModifier = (actor = {}) => abilityModifier(
  actor?.attributes?.deftness ??
  actor?.attributes?.dexterity ??
  actor?.abilityScores?.dex ??
  actor?.dex ??
  actor?.DEX ??
  10,
);

const getWeaponTrainingBonus = (actor = {}, weapon = {}) => {
  const traits = getCanonicalWeaponTraitProfile(weapon);
  const training = actor?.training?.weapons || actor?.weaponTraining || {};
  const candidates = [
    training?.[traits.family],
    training?.[weapon?.id],
    training?.[weapon?.weaponId],
    actor?.proficiencyBonus,
    actor?.combatTrainingBonus,
  ];
  return Math.max(0, ...candidates.map((value) => Number(value) || 0));
};

const deliveryProfile = (weapon = {}, traits = getCanonicalWeaponTraitProfile(weapon)) => {
  const text = [
    weapon.primaryDelivery,
    weapon.secondaryDelivery,
    weapon.damageType,
    weapon.type,
    weapon.category,
    weapon.name,
  ].filter(Boolean).map(normalizeText).join(" ");

  if (traits.isPike || traits.isSpear) return { primary: "thrust", secondary: null };
  if (traits.isHalberd) return { primary: "thrust", secondary: "chop-hook" };
  if (traits.isGreatsword || traits.isLongsword) return { primary: "cut", secondary: "thrust" };
  if (traits.family === "sword") return { primary: "cut", secondary: "thrust" };
  if (traits.family === "dagger") return { primary: "thrust", secondary: "cut" };
  if (traits.family === "axe") return { primary: "chop", secondary: null };
  if (traits.family === "impact") return { primary: "crush", secondary: null };
  if (text.includes("pierc") || text.includes("thrust")) return { primary: "thrust", secondary: null };
  if (text.includes("slash") || text.includes("cut")) return { primary: "cut", secondary: null };
  return { primary: "strike", secondary: null };
};

export const getWeaponTacticalTraits = (weapon = {}) => {
  const canonical = getCanonicalWeaponTraitProfile(weapon);
  const delivery = deliveryProfile(weapon, canonical);
  let pointControl = 1;
  let entryDenial = 1;
  let entryAbility = 1;
  let closeHandling = 0;
  let attackTempo = 1;
  let recoveryTempo = 1;
  let bindStrength = canonical.twoHanded ? 2 : 1;
  let preferredDistanceFeet = Math.max(5, Number(canonical.reachFeet) || 5);

  switch (canonical.family) {
    case "pike":
      pointControl = 4;
      entryDenial = 4;
      entryAbility = 0;
      closeHandling = -4;
      attackTempo = 1;
      recoveryTempo = 0;
      bindStrength = 3;
      break;
    case "two-handed-spear":
      pointControl = 3;
      entryDenial = 3;
      entryAbility = 0;
      closeHandling = -2;
      attackTempo = 2;
      recoveryTempo = 2;
      bindStrength = 2;
      break;
    case "one-handed-spear":
      pointControl = 2;
      entryDenial = 1;
      entryAbility = 1;
      closeHandling = -1;
      attackTempo = 2;
      recoveryTempo = 1;
      bindStrength = 1;
      break;
    case "halberd":
      pointControl = 2;
      entryDenial = 2;
      entryAbility = 1;
      closeHandling = -1;
      attackTempo = 1;
      recoveryTempo = 1;
      bindStrength = 3;
      break;
    case "greatsword":
      pointControl = 2;
      entryDenial = 2;
      entryAbility = 2;
      closeHandling = 1;
      attackTempo = 1;
      recoveryTempo = 1;
      bindStrength = 3;
      break;
    case "longsword":
      pointControl = 2;
      entryDenial = 2;
      entryAbility = 2;
      closeHandling = 2;
      attackTempo = 2;
      recoveryTempo = 2;
      bindStrength = 2;
      break;
    case "sword":
      pointControl = 1;
      entryDenial = 1;
      entryAbility = 2;
      closeHandling = 2;
      attackTempo = 2;
      recoveryTempo = 2;
      bindStrength = 1;
      break;
    case "dagger":
      pointControl = 0;
      entryDenial = 0;
      entryAbility = 3;
      closeHandling = 3;
      attackTempo = 3;
      recoveryTempo = 3;
      bindStrength = 0;
      preferredDistanceFeet = 5;
      break;
    default:
      break;
  }

  return {
    ...canonical,
    primaryDelivery: weapon.primaryDelivery || delivery.primary,
    secondaryDelivery: weapon.secondaryDelivery ?? delivery.secondary,
    pointControl: Number(weapon.pointControl ?? pointControl),
    entryDenial: Number(weapon.entryDenial ?? entryDenial),
    entryAbility: Number(weapon.entryAbility ?? entryAbility),
    closeHandling: Number(weapon.closeHandling ?? closeHandling),
    attackTempo: Number(weapon.attackTempo ?? attackTempo),
    recoveryTempo: Number(weapon.recoveryTempo ?? recoveryTempo),
    bindStrength: Number(weapon.bindStrength ?? bindStrength),
    retreatingAttack: Boolean(weapon.retreatingAttack ?? canonical.isSpear ?? false),
    preferredDistanceFeet: Number(weapon.optimalMeasureFeet ?? preferredDistanceFeet),
    minimumEffectiveReachFeet: Number(
      weapon.minimumEffectiveReachFeet ??
      (canonical.isPike ? 10 : canonical.isPolearm ? 5 : 0),
    ),
  };
};

export const resolveWeaponEngagementMeasure = ({
  distanceFt,
  attackerWeapon,
  defenderWeapon,
  entryContested = false,
} = {}) => {
  const distance = Math.max(0, Number(distanceFt) || 0);
  const attacker = getWeaponTacticalTraits(attackerWeapon || {});
  const defender = getWeaponTacticalTraits(defenderWeapon || {});
  const longerReach = Math.max(attacker.reachFeet || 5, defender.reachFeet || 5);
  const shorterReach = Math.min(attacker.reachFeet || 5, defender.reachFeet || 5);

  if (distance <= 0.01) return WEAPON_ENGAGEMENT_MEASURES.CLINCH;
  if (entryContested) return WEAPON_ENGAGEMENT_MEASURES.ENTRY_CONTESTED;
  if (longerReach > shorterReach + 0.1 && distance <= shorterReach + 0.5) {
    return WEAPON_ENGAGEMENT_MEASURES.INSIDE_POINT;
  }
  if (longerReach > shorterReach + 0.1 && distance <= longerReach + 0.5) {
    return WEAPON_ENGAGEMENT_MEASURES.LONG_WEAPON;
  }
  return WEAPON_ENGAGEMENT_MEASURES.OUTSIDE;
};

export const getPreferredEngagementDistanceFeet = ({ actorWeapon, opponentWeapon } = {}) => {
  const actor = getWeaponTacticalTraits(actorWeapon || {});
  const opponent = getWeaponTacticalTraits(opponentWeapon || {});
  if ((actor.reachFeet || 5) > (opponent.reachFeet || 5) + 0.1) {
    return Math.max(5, actor.preferredDistanceFeet || actor.reachFeet || 5);
  }
  return Math.max(5, actor.reachFeet || 5);
};

export const analyzeMeasureAwareMovement = ({
  mover,
  opponent,
  moverWeapon,
  opponentWeapon,
  beforeDistanceFt,
  desiredDistanceFt,
  movementAction = "move",
  entryRoll,
  controlRoll,
} = {}) => {
  const moverTraits = getWeaponTacticalTraits(moverWeapon || {});
  const opponentTraits = getWeaponTacticalTraits(opponentWeapon || {});
  const before = Math.max(0, Number(beforeDistanceFt) || 0);
  const desired = Math.max(0, Number(desiredDistanceFt) || 0);
  const action = normalizeText(movementAction);
  const bypassControl = action.includes("charge") || action.includes("forced") || action.includes("knockback");

  if (bypassControl) {
    return { type: "unrestricted", requiresContest: false, allowed: true };
  }

  const moverLonger = moverTraits.reachFeet > opponentTraits.reachFeet + 0.1;
  const opponentLonger = opponentTraits.reachFeet > moverTraits.reachFeet + 0.1;

  if (
    moverLonger &&
    before >= moverTraits.preferredDistanceFeet - 0.5 &&
    desired < moverTraits.preferredDistanceFeet - 0.5
  ) {
    return {
      type: "maintain-measure",
      requiresContest: false,
      allowed: true,
      preferredDistanceFeet: moverTraits.preferredDistanceFeet,
      moverTraits,
      opponentTraits,
      reason: "longer-weapon-preserves-optimal-measure",
    };
  }

  const crossesPoint = opponentLonger &&
    before > moverTraits.reachFeet + 0.5 &&
    desired <= moverTraits.reachFeet + 0.5;

  if (!crossesPoint) {
    return { type: "unrestricted", requiresContest: false, allowed: true, moverTraits, opponentTraits };
  }

  const normalizedEntryRoll = clamp(Number(entryRoll) || 1, 1, 20);
  const normalizedControlRoll = clamp(Number(controlRoll) || 1, 1, 20);
  const entryScore = normalizedEntryRoll + getActorDeftnessModifier(mover) + getWeaponTrainingBonus(mover, moverWeapon) + moverTraits.entryAbility;
  const controlScore = normalizedControlRoll + getActorDeftnessModifier(opponent) + getWeaponTrainingBonus(opponent, opponentWeapon) + opponentTraits.pointControl + opponentTraits.entryDenial;
  const margin = entryScore - controlScore;

  let outcome;
  let allowed;
  if (normalizedEntryRoll === 20 && normalizedControlRoll !== 20) {
    outcome = "critical-entry";
    allowed = true;
  } else if (normalizedControlRoll === 20 && normalizedEntryRoll !== 20) {
    outcome = "strong-denial";
    allowed = false;
  } else if (margin >= 5) {
    outcome = "strong-entry";
    allowed = true;
  } else if (margin >= 1) {
    outcome = "narrow-entry";
    allowed = true;
  } else if (margin <= -5) {
    outcome = "strong-denial";
    allowed = false;
  } else {
    outcome = "narrow-denial";
    allowed = false;
  }

  return {
    type: "entry-contest",
    requiresContest: true,
    allowed,
    outcome,
    entryRoll: normalizedEntryRoll,
    controlRoll: normalizedControlRoll,
    entryScore,
    controlScore,
    margin,
    moverTraits,
    opponentTraits,
    beforeDistanceFt: before,
    desiredDistanceFt: desired,
  };
};

export const getEngagementAttackModifier = ({
  attackerWeapon,
  defenderWeapon,
  distanceFt,
} = {}) => {
  const attacker = getWeaponTacticalTraits(attackerWeapon || {});
  const defender = getWeaponTacticalTraits(defenderWeapon || {});
  const measure = resolveWeaponEngagementMeasure({ distanceFt, attackerWeapon, defenderWeapon });
  const attackerLonger = attacker.reachFeet > defender.reachFeet + 0.1;
  const defenderLonger = defender.reachFeet > attacker.reachFeet + 0.1;
  let modifier = 0;
  let reason = "neutral-measure";

  if (measure === WEAPON_ENGAGEMENT_MEASURES.INSIDE_POINT) {
    if (attackerLonger) {
      const shortenedGrip = Boolean(
        attackerWeapon?.shortenedGrip === true ||
        /shorten[-_ ]?grip/.test(normalizeText(attackerWeapon?.attackMode || attackerWeapon?.selectedTechnique || ""))
      );
      if (shortenedGrip) {
        modifier = attacker.isPike ? -3 : attacker.isPolearm ? -1 : 0;
        reason = "long-weapon-shortened-grip-inside-point";
      } else {
        modifier = attacker.isPike ? -4 : attacker.isPolearm ? -3 : -1;
        reason = "long-weapon-inside-point";
      }
    } else if (defenderLonger) {
      modifier = defender.isPike ? 4 : defender.isPolearm ? 3 : 1;
      reason = "short-weapon-inside-point";
    }
  } else if (measure === WEAPON_ENGAGEMENT_MEASURES.CLINCH) {
    if (attacker.isPike) modifier = -5;
    else if (attacker.isPolearm) modifier = -4;
    else modifier = Math.max(0, attacker.closeHandling - 1);
    reason = "clinch-handling";
  }

  return { modifier, measure, reason, attackerTraits: attacker, defenderTraits: defender };
};

const isManufacturedWeapon = (weapon = {}) => {
  const identity = [weapon.id, weapon.weaponId, weapon.name, weapon.type, weapon.category]
    .filter(Boolean).map(normalizeText).join(" ");
  if (!identity) return false;
  if (weapon.naturalAttack === true || weapon.isNatural === true) return false;
  return !/(claw|bite|gore|horn|talon|hoof|tail|unarmed|punch|kick)/.test(identity);
};

export const resolveWeaponActionStaminaCost = ({
  fighter,
  weapon,
  actionType = "attack",
  technique = null,
  source = null,
  fallbackCost = 1,
} = {}) => {
  const actionText = [actionType, technique, source, weapon?.attackMode, weapon?.selectedTechnique]
    .filter(Boolean).map(normalizeText).join(" ");
  if (!isManufacturedWeapon(weapon)) {
    return { cost: Math.max(0, Number(fallbackCost) || 0), commitment: "legacy-natural", source: "legacy-fallback" };
  }

  const explicit = Number(weapon?.basicAttackStaminaCost ?? weapon?.canonicalAttackStaminaCost);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return { cost: explicit, commitment: explicit >= 2 ? "committed" : "ordinary", source: "weapon-explicit" };
  }

  const committed = /(charge|sprint|power|committed|full-force|shaft-cut|beat-entry|beat and enter|grapple|overhead|smash)/.test(actionText);
  const defensiveControl = /(parry|bind|point-control|stop-thrust|retreating-thrust|probe)/.test(actionText);
  if (committed) return { cost: 2, commitment: "committed", source: "action-commitment" };
  if (defensiveControl) return { cost: 1, commitment: "controlled", source: "action-commitment" };
  return { cost: 1, commitment: "ordinary", source: "manufactured-basic" };
};

export const markCombatExertion = ({ fighter, actionType, source, round } = {}) => {
  if (!fighter) return fighter;
  const text = [actionType, source].filter(Boolean).map(normalizeText).join(" ");
  const intense = /(sprint|charge|grapple|power|committed|full-force|shaft-cut|beat-entry)/.test(text);
  const previous = fighter.combatExertion?.round === round ? fighter.combatExertion : {};
  return {
    ...fighter,
    combatExertion: {
      ...previous,
      round,
      intense: Boolean(previous.intense || intense),
      lastActionType: actionType || previous.lastActionType || null,
      lastSource: source || previous.lastSource || null,
    },
    fatigueState: fighter.fatigueState ? {
      ...fighter.fatigueState,
      lastActionType: actionType || fighter.fatigueState.lastActionType || null,
    } : fighter.fatigueState,
  };
};

export const resolvePassiveRoundStaminaRecovery = ({ fighter, completedRound } = {}) => {
  const current = Number(fighter?.fatigueState?.currentStamina ?? fighter?.combatStamina?.currentStamina ?? fighter?.currentStamina);
  const max = Number(fighter?.fatigueState?.maxStamina ?? fighter?.combatStamina?.maxStamina ?? fighter?.maxStamina);
  if (!Number.isFinite(current) || !Number.isFinite(max) || current >= max) {
    return { amount: 0, reason: "stamina-full-or-unavailable" };
  }
  const grappled = Boolean(
    fighter?.grappleState?.opponent ||
    fighter?.grappleState?.opponentId ||
    fighter?.grappledWith
  );
  const bleeding = Boolean(fighter?.bleeding?.active && !fighter?.bleeding?.stabilized);
  const severeWound = (fighter?.state?.wounds || fighter?.wounds || []).some((wound) => (
    ["severe", "critical", "mortal"].includes(normalizeText(wound?.severity))
  ));
  const intense = fighter?.combatExertion?.round === completedRound && fighter?.combatExertion?.intense === true;
  if (grappled) return { amount: 0, reason: "active-grapple" };
  if (bleeding) return { amount: 0, reason: "uncontrolled-bleeding" };
  if (severeWound) return { amount: 0, reason: "severe-wound" };
  if (intense) return { amount: 0, reason: "intense-round-exertion" };
  return { amount: 1, reason: "passive-round-recovery" };
};

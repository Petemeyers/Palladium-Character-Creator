import {
  getCanonicalWeaponTraitProfile,
  normalizeCanonicalCombatWeapon,
} from "./canonicalWeaponTraits.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const actorWeaponLists = (actor = {}) => [
  actor.attacks,
  actor.weaponProfiles,
  actor.equipment,
  actor.inventory,
  Array.isArray(actor.equistaminadWeapons) ? actor.equistaminadWeapons : null,
].filter(Array.isArray);

const weaponIdentity = (weapon = {}) => String(
  weapon.id || weapon.weaponId || weapon.profileKey || weapon.canonicalWeaponId || weapon.name || ""
);

export const getReadyCombatWeapon = (actor = {}) => {
  const selected = actor.selectedAttack || actor.selectedWeapon || actor.readyWeapon || null;
  if (selected && typeof selected === "object") {
    return normalizeCanonicalCombatWeapon(selected);
  }

  const requestedIds = [
    actor.combatWeaponState?.readyWeaponId,
    actor.heldItems?.mainHand,
    actor.readyWeaponId,
  ].filter(Boolean).map(String);

  for (const list of actorWeaponLists(actor)) {
    const exact = list.find((weapon) =>
      requestedIds.includes(weaponIdentity(weapon)) &&
      weapon?.broken !== true &&
      weapon?.unusable !== true
    );
    if (exact) return normalizeCanonicalCombatWeapon(exact);
  }

  for (const list of actorWeaponLists(actor)) {
    const firstWeapon = list.find((item) => {
      const type = normalizeText(item?.type || item?.kind || item?.category);
      return (
        !type.includes("armor") &&
        !type.includes("shield") &&
        item?.broken !== true &&
        item?.unusable !== true
      );
    });
    if (firstWeapon) return normalizeCanonicalCombatWeapon(firstWeapon);
  }

  return null;
};

export const getActorShieldProfile = (actor = {}) => {
  const shield = actor.equippedShield || actor.shield || actor.heldShield || null;
  if (!shield) return { type: "none", equipped: false, name: null };
  const identity = normalizeText([
    shield.id,
    shield.profileKey,
    shield.name,
    shield.displayName,
    shield.category,
  ].filter(Boolean).join(" "));
  return {
    type: identity.includes("buckler") ? "buckler" : "shield",
    equipped: true,
    name: shield.name || shield.displayName || "Shield",
  };
};

export const isHalfSwordTechnique = (technique) => {
  const normalized = normalizeText(technique);
  return normalized.includes("half-sword") || normalized.includes("halfsword");
};

export const POLEARM_MEASURES = Object.freeze({
  BEYOND: "beyond-reach",
  OUTER: "outer-measure",
  IDEAL: "polearm-ideal-measure",
  CLOSE: "inside-polearm-guard",
  CLINCH: "clinch",
});

export const resolvePolearmMeasure = ({
  distanceFt,
  attackerWeapon,
  defenderWeapon,
} = {}) => {
  const distance = Math.max(0, Number(distanceFt) || 0);
  const attackerTraits = getCanonicalWeaponTraitProfile(attackerWeapon || {});
  const defenderTraits = getCanonicalWeaponTraitProfile(defenderWeapon || {});
  const longestPolearmReach = Math.max(
    attackerTraits.isPolearm ? attackerTraits.reachFeet : 0,
    defenderTraits.isPolearm ? defenderTraits.reachFeet : 0,
  );

  if (distance <= 0) return POLEARM_MEASURES.CLINCH;
  if (distance <= 5.5) return POLEARM_MEASURES.CLOSE;
  if (longestPolearmReach > 0 && distance <= longestPolearmReach) {
    return POLEARM_MEASURES.IDEAL;
  }
  if (longestPolearmReach > 0 && distance <= longestPolearmReach + 5) {
    return POLEARM_MEASURES.OUTER;
  }
  return POLEARM_MEASURES.BEYOND;
};

const oneHandedWeapon = (traits) => traits.oneHanded && !traits.isPolearm;

const ratioRule = ({ attackerTraits, defenderTraits, attackerShield, defenderShield, attackerHalfSword }) => {
  if (attackerTraits.isTwoHandedSpear && defenderTraits.isTwoHandedSpear) {
    return { modifier: 0, ratio: "equal", rule: "two-handed-spear-parity" };
  }

  if (attackerTraits.isTwoHandedSpear) {
    if (attackerHalfSword || defenderTraits.isPolearm) {
      return { modifier: 0, ratio: "equal", rule: "polearm-parity" };
    }
    if (defenderTraits.isGreatsword) {
      return { modifier: 2, ratio: "4:2", rule: "spear-vs-greatsword" };
    }
    if (defenderShield.type === "buckler" && defenderTraits.isSword) {
      return { modifier: 2, ratio: "4:2", rule: "spear-vs-sword-buckler" };
    }
    if (defenderShield.type === "shield" && defenderTraits.isSword) {
      return { modifier: 1, ratio: "7:6", rule: "spear-vs-sword-shield" };
    }
    if (oneHandedWeapon(defenderTraits)) {
      return { modifier: 3, ratio: "9:3", rule: "two-handed-spear-vs-one-handed" };
    }
  }

  if (defenderTraits.isTwoHandedSpear) {
    if (attackerHalfSword || attackerTraits.isPolearm) {
      return { modifier: 0, ratio: "equal", rule: "polearm-parity" };
    }
    if (attackerTraits.isGreatsword) {
      return { modifier: -2, ratio: "2:4", rule: "greatsword-vs-spear" };
    }
    if (attackerShield.type === "buckler" && attackerTraits.isSword) {
      return { modifier: -2, ratio: "2:4", rule: "sword-buckler-vs-spear" };
    }
    if (attackerShield.type === "shield" && attackerTraits.isSword) {
      return { modifier: -1, ratio: "6:7", rule: "sword-shield-vs-spear" };
    }
    if (oneHandedWeapon(attackerTraits)) {
      return { modifier: -3, ratio: "3:9", rule: "one-handed-vs-two-handed-spear" };
    }
  }

  if (attackerTraits.isOneHandedSpear && attackerShield.equipped && defenderTraits.isSword && defenderShield.equipped) {
    return { modifier: -1, ratio: "disadvantaged", rule: "one-handed-spear-shield-vs-sword-shield" };
  }
  if (defenderTraits.isOneHandedSpear && defenderShield.equipped && attackerTraits.isSword && attackerShield.equipped) {
    return { modifier: 1, ratio: "advantaged", rule: "sword-shield-vs-one-handed-spear-shield" };
  }

  return { modifier: 0, ratio: "neutral", rule: "no-specific-matchup" };
};

const applyDistinctPolearmBehavior = ({
  base,
  measure,
  attackerTraits,
  defenderTraits,
  formationSupported,
  selectedTechnique,
}) => {
  let modifier = base.modifier;
  const reasons = [base.rule];
  const technique = normalizeText(selectedTechnique);

  if (measure === POLEARM_MEASURES.CLOSE || measure === POLEARM_MEASURES.CLINCH) {
    if (attackerTraits.isPike) {
      modifier -= 4;
      reasons.push("pike-inside-guard");
    } else if (attackerTraits.isTwoHandedSpear) {
      modifier -= 2;
      reasons.push("spear-inside-guard");
    } else if (attackerTraits.isHalberd) {
      modifier -= 1;
      reasons.push("halberd-close-penalty");
    } else if (!attackerTraits.isPolearm && defenderTraits.isPike) {
      modifier += 3;
      reasons.push("inside-pike-guard");
    } else if (!attackerTraits.isPolearm && defenderTraits.isTwoHandedSpear) {
      modifier += 2;
      reasons.push("inside-spear-guard");
    } else if (!attackerTraits.isPolearm && defenderTraits.isHalberd) {
      modifier += 1;
      reasons.push("inside-halberd-guard");
    }
  }

  if (measure === POLEARM_MEASURES.IDEAL) {
    if (attackerTraits.isPike) {
      modifier += formationSupported ? 3 : 2;
      reasons.push(formationSupported ? "pike-formation-measure" : "pike-isolated-measure");
    } else if (attackerTraits.isHalberd && !defenderTraits.isPolearm) {
      modifier += 1;
      reasons.push("halberd-versatile-measure");
    }
    if (defenderTraits.isPike && !attackerTraits.isPolearm) {
      modifier -= formationSupported ? 3 : 2;
      reasons.push(formationSupported ? "opposed-pike-formation" : "opposed-pike-isolated");
    }
  }

  if (technique.includes("polearm-beat-entry") || technique.includes("beat-and-enter")) {
    modifier += attackerTraits.isGreatsword ? 2 : 1;
    reasons.push("polearm-beat-entry");
  }
  if (technique.includes("shaft-cut")) {
    modifier += attackerTraits.isGreatsword ? 1 : 0;
    reasons.push("shaft-cut-attempt");
  }
  if (isHalfSwordTechnique(technique) && defenderTraits.isPolearm) {
    modifier = Math.max(modifier, 0);
    reasons.push("half-sword-parity");
  }

  return { modifier, reasons };
};

export const getPolearmSpecialActions = ({ attackerWeapon, defenderWeapon, distanceFt } = {}) => {
  const attackerTraits = getCanonicalWeaponTraitProfile(attackerWeapon || {});
  const defenderTraits = getCanonicalWeaponTraitProfile(defenderWeapon || {});
  const measure = resolvePolearmMeasure({ distanceFt, attackerWeapon, defenderWeapon });
  const actions = [];

  if (attackerTraits.isGreatsword && defenderTraits.isPolearm) {
    actions.push({
      id: "polearm-beat-entry",
      label: "Beat Aside and Enter",
      legal: measure === POLEARM_MEASURES.IDEAL || measure === POLEARM_MEASURES.OUTER,
      effect: "negate-polearm-measure",
    });
    if (defenderTraits.shaftDestructible) {
      actions.push({
        id: "shaft-cut",
        label: "Cut the Wooden Shaft",
        legal: measure !== POLEARM_MEASURES.BEYOND && measure !== POLEARM_MEASURES.CLINCH,
        effect: "damage-weapon-shaft",
      });
    }
  }

  if (attackerTraits.halfSwordCapable && defenderTraits.isPolearm) {
    actions.push({
      id: "half-sword-thrust",
      label: "Half-Sword Entry",
      legal: measure !== POLEARM_MEASURES.BEYOND,
      effect: "half-sword-parity",
    });
  }

  if (attackerTraits.isHalberd) {
    actions.push({ id: "halberd-hook", label: "Hook Weapon or Limb", legal: measure !== POLEARM_MEASURES.BEYOND, effect: "control" });
    actions.push({ id: "halberd-chop", label: "Halberd Chop", legal: measure !== POLEARM_MEASURES.BEYOND, effect: "chop" });
  }
  if (attackerTraits.isPike) {
    actions.push({ id: "set-pike", label: "Set Pike", legal: measure !== POLEARM_MEASURES.CLINCH, effect: "brace" });
    actions.push({ id: "withdraw-point", label: "Withdraw Point", legal: measure === POLEARM_MEASURES.CLOSE, effect: "restore-measure" });
  }

  return actions;
};

export const selectAutomatedPolearmAction = ({
  attacker,
  defender,
  attackerWeapon,
  defenderWeapon,
  distanceFt,
} = {}) => {
  const actions = getPolearmSpecialActions({ attackerWeapon, defenderWeapon, distanceFt }).filter((action) => action.legal);
  if (!actions.length) return null;
  const attackerTraits = getCanonicalWeaponTraitProfile(attackerWeapon || {});
  const defenderTraits = getCanonicalWeaponTraitProfile(defenderWeapon || {});
  const aggression = Number(attacker?.behavior?.aggression ?? attacker?.behaviorProfile?.aggression ?? 50);

  if (attackerTraits.isGreatsword && defenderTraits.shaftDestructible && aggression >= 60) {
    return actions.find((action) => action.id === "shaft-cut") || actions[0];
  }
  if (attackerTraits.isGreatsword) {
    return actions.find((action) => action.id === "polearm-beat-entry") || actions[0];
  }
  if (attackerTraits.halfSwordCapable) {
    return actions.find((action) => action.id === "half-sword-thrust") || actions[0];
  }
  return null;
};

export const resolvePolearmCombatMatchup = ({
  attacker,
  defender,
  attackWeapon,
  defenderWeapon,
  distanceFt,
  selectedTechnique,
  formationSupported = false,
  currentRound = 0,
} = {}) => {
  const normalizedAttackWeapon = normalizeCanonicalCombatWeapon(attackWeapon || {});
  const normalizedDefenderWeapon = normalizeCanonicalCombatWeapon(
    defenderWeapon || getReadyCombatWeapon(defender) || {}
  );
  const attackerTraits = getCanonicalWeaponTraitProfile(normalizedAttackWeapon);
  const defenderTraits = getCanonicalWeaponTraitProfile(normalizedDefenderWeapon);
  const attackerShield = getActorShieldProfile(attacker);
  const defenderShield = getActorShieldProfile(defender);
  const measure = resolvePolearmMeasure({
    distanceFt,
    attackerWeapon: normalizedAttackWeapon,
    defenderWeapon: normalizedDefenderWeapon,
  });

  if (!attackerTraits.isPolearm && !defenderTraits.isPolearm) {
    return {
      applies: false,
      attackModifier: 0,
      measure,
      rule: "no-polearm-in-exchange",
      ratio: "neutral",
      reasons: [],
      attackerTraits,
      defenderTraits,
      availableActions: [],
    };
  }

  const attackerHalfSword = isHalfSwordTechnique(selectedTechnique);
  const base = ratioRule({ attackerTraits, defenderTraits, attackerShield, defenderShield, attackerHalfSword });
  const distinct = applyDistinctPolearmBehavior({
    base,
    measure,
    attackerTraits,
    defenderTraits,
    formationSupported,
    selectedTechnique,
  });

  const displacedTargetId = attacker?.insidePolearmGuardTargetId;
  const displacementExpiry = Number(defender?.polearmDisplacedUntilRound ?? -1);
  const defenderDisplaced =
    defender?.polearmDisplacedByActorId === attacker?.id &&
    displacementExpiry >= Number(currentRound || 0);
  let attackModifier = distinct.modifier;
  const reasons = [...distinct.reasons];
  if (displacedTargetId === defender?.id || defenderDisplaced) {
    if (defenderTraits.isPolearm) attackModifier = Math.max(attackModifier, 1);
    reasons.push("polearm-guard-displaced");
  }

  return {
    applies: true,
    attackModifier,
    controlModifier: attackModifier,
    measure,
    rule: base.rule,
    ratio: base.ratio,
    reasons,
    attackerTraits,
    defenderTraits,
    attackerShield,
    defenderShield,
    selectedTechnique: selectedTechnique || null,
    availableActions: getPolearmSpecialActions({
      attackerWeapon: normalizedAttackWeapon,
      defenderWeapon: normalizedDefenderWeapon,
      distanceFt,
    }),
  };
};

export const applyPolearmSpecialActionOnHit = ({
  attacker,
  defender,
  defenderWeapon,
  selectedTechnique,
  currentRound,
} = {}) => {
  const technique = normalizeText(selectedTechnique);
  const defenderTraits = getCanonicalWeaponTraitProfile(defenderWeapon || {});
  if (!defenderTraits.isPolearm) return { applied: false, reason: "target-not-using-polearm" };

  if (technique.includes("polearm-beat-entry") || technique.includes("beat-and-enter")) {
    return {
      applied: true,
      effect: "polearm-guard-displaced",
      attackerPatch: { insidePolearmGuardTargetId: defender?.id || null },
      defenderPatch: {
        polearmDisplacedByActorId: attacker?.id || null,
        polearmDisplacedUntilRound: Number(currentRound || 0) + 1,
      },
    };
  }

  if (technique.includes("shaft-cut") && defenderTraits.shaftDestructible) {
    const previousIntegrity = Math.max(0, Number(defenderWeapon?.shaftIntegrity ?? defenderWeapon?.maxShaftIntegrity ?? 3));
    const nextIntegrity = Math.max(0, previousIntegrity - 1);
    return {
      applied: true,
      effect: nextIntegrity <= 0 ? "polearm-shaft-broken" : "polearm-shaft-damaged",
      previousIntegrity,
      nextIntegrity,
      weaponPatch: {
        shaftIntegrity: nextIntegrity,
        maxShaftIntegrity: Number(defenderWeapon?.maxShaftIntegrity ?? 3),
        broken: nextIntegrity <= 0,
        unusable: nextIntegrity <= 0,
      },
    };
  }

  return { applied: false, reason: "no-special-polearm-effect" };
};

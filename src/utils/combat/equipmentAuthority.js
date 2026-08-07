const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const clone = (value) => {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

export const EMPTY_EQUIPMENT_SELECTION = Object.freeze({
  rightHand: null,
  leftHand: null,
  shield: null,
  padding: null,
  mail: null,
  plate: null,
  outer: null,
});

export const isNoneEquipmentChoice = (value) => {
  const text = normalizeText(typeof value === "object" ? value?.name ?? value?.id : value);
  return !text || text === "none" || text === "unarmed" || text === "empty";
};

export const classifyArmorLayer = (armor) => {
  const text = normalizeText(`${armor?.name ?? ""} ${armor?.type ?? ""} ${armor?.category ?? ""} ${armor?.armorClass ?? ""}`);
  if (!text) return null;
  if (/shield|buckler/.test(text)) return "shield";
  if (/gambeson|aketon|padded|padding|arming doublet/.test(text)) return "padding";
  if (/mail|chain/.test(text)) return "mail";
  if (/plate|harness|cuirass|brigandine/.test(text)) return "plate";
  return "outer";
};

export const normalizeWeaponProfile = (weapon) => {
  if (!weapon || isNoneEquipmentChoice(weapon)) return null;
  const next = clone(weapon);
  const name = String(next.name ?? next.displayName ?? "Weapon");
  const text = normalizeText(name);
  const isShortSpear = /short spear|javelin|trident/.test(text);
  const isLongSpear = /long spear|infantry spear|^spear$/.test(text);
  const explicitTwoHanded = next.twoHanded === true || next.requiresTwoHands === true || Number(next.handsRequired) >= 2 || /two-handed/.test(normalizeText(next.handedness ?? next.category));
  const explicitOneHanded = next.twoHanded === false || Number(next.handsRequired) === 1 || /one-handed/.test(normalizeText(next.handedness ?? next.category));
  const twoHanded = isLongSpear ? true : isShortSpear ? false : explicitTwoHanded && !explicitOneHanded;
  const handsRequired = twoHanded ? 2 : 1;
  const isProjectile = Boolean(next.isProjectile) || /bow|crossbow|sling/.test(text);
  const isThrown = /javelin|throwing/.test(text) || next.deliveryType === "thrown";
  const isRanged = isProjectile || isThrown || next.isRanged === true || next.attackType === "ranged";
  const explicitReachFeet = Number(next.reachFeet ?? next.reach ?? 0) || 0;
  const reachFeet = isLongSpear
    ? Math.max(10, explicitReachFeet)
    : Math.max(5, explicitReachFeet || 5);

  return {
    ...next,
    id: next.id ?? next.weaponId ?? next.profileKey ?? `weapon.${text.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    weaponId: next.weaponId ?? next.id ?? next.profileKey ?? `weapon.${text.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    profileKey: next.profileKey ?? next.weaponId ?? next.id ?? `weapon.${text.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    name,
    displayName: next.displayName ?? name,
    type: "weapon",
    kind: isRanged ? "ranged" : "melee",
    attackType: isRanged ? "ranged" : "melee",
    isMelee: !isRanged,
    isRanged,
    isProjectile,
    handedness: twoHanded ? "two-handed" : "one-handed",
    handsRequired,
    requiresTwoHands: twoHanded,
    twoHanded,
    shieldCompatible: !twoHanded,
    reach: reachFeet,
    reachFeet,
    lengthFt: isLongSpear ? Math.max(7, Number(next.lengthFt ?? next.length ?? 0) || 0) : Number(next.lengthFt ?? next.length ?? 0) || undefined,
    range: isRanged ? Number(next.range ?? next.normalRangeFeet ?? 0) || 0 : 0,
    normalRangeFeet: isRanged ? Number(next.normalRangeFeet ?? next.range ?? 0) || null : null,
    longRangeFeet: isRanged ? Number(next.longRangeFeet ?? 0) || null : null,
  };
};

export const createUnarmedAttack = () => ({
  id: "natural.unarmed-strike",
  profileKey: "natural.unarmed-strike",
  name: "Unarmed Strike",
  displayName: "Unarmed Strike",
  type: "natural",
  kind: "melee",
  attackType: "melee",
  damage: "1d3",
  damageDice: "1d3",
  damageType: "bludgeoning",
  reach: 5,
  reachFeet: 5,
  isMelee: true,
  isRanged: false,
  isProjectile: false,
  naturalWeapon: true,
  isNaturalAttack: true,
  handsRequired: 0,
  handedness: "natural",
  twoHanded: false,
  requiresTwoHands: false,
  shieldCompatible: true,
});

const resolveChoice = (choice, catalog = []) => {
  if (!choice || isNoneEquipmentChoice(choice)) return null;
  if (typeof choice === "object") return clone(choice);
  const wanted = normalizeText(choice);
  return clone(catalog.find((item) => normalizeText(item?.name) === wanted) ?? null);
};

const abilityModifier = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

const getMobilityScore = (actor = {}) => Number(
  actor?.attributes?.mobility ??
  actor?.abilityScores?.dex ??
  actor?.dex ??
  actor?.deftness ??
  10
) || 10;

const getShieldDefenseBonus = (shield) => {
  if (!shield) return 0;
  const explicit = Number(
    shield?.defenseBonus ??
    shield?.guardBonus ??
    shield?.blockBonus ??
    shield?.acBonus
  );
  if (Number.isFinite(explicit)) return explicit;
  const text = normalizeText(`${shield?.name ?? ""} ${shield?.category ?? ""} ${shield?.type ?? ""}`);
  return text.includes("buckler") ? 1 : 2;
};

export const calculateCanonicalDefenseRating = (actor = {}, { shield = null } = {}) => {
  const mobilityModifier = abilityModifier(getMobilityScore(actor));
  const explicitTraining = Number(
    actor?.defenseTrainingBonus ??
    actor?.guardTrainingBonus ??
    actor?.training?.defenseBonus ??
    0
  ) || 0;
  return Math.max(5, 10 + mobilityModifier + explicitTraining + getShieldDefenseBonus(shield));
};

const buildArmorProfile = (layers, shield, actor) => {
  const equippedLayers = Object.entries(layers).filter(([, value]) => Boolean(value));
  const armorRating = equippedLayers.reduce((total, [, item]) => total + Math.max(0, Number(item?.armorRating ?? item?.protection ?? item?.ar ?? 0) || 0), 0)
    + Math.max(0, Number(shield?.armorRating ?? shield?.protection ?? shield?.ar ?? 0) || 0);
  const defenseRating = calculateCanonicalDefenseRating(actor, { shield });
  return {
    armorName: equippedLayers.length ? equippedLayers.map(([, item]) => item.name).join(" + ") : "None",
    armorRating,
    guardRating: defenseRating,
    armorClass: defenseRating,
    defenseRating,
    defenseSource: shield ? "skill-mobility-and-shield" : "skill-and-mobility",
    shield: shield ?? null,
    layers: {
      padding: layers.padding ?? null,
      mail: layers.mail ?? null,
      plate: layers.plate ?? null,
      outer: layers.outer ?? null,
    },
    notes: equippedLayers.length || shield
      ? ["Armor protection is derived only from explicitly equipped layers; Defense measures avoidance and guard."]
      : ["No armor equipped. Defense is derived from mobility and explicit training, not armor."],
  };
};

export const getExplicitEquipmentSelection = (actor = {}) => {
  const selection = actor?.equipmentSelection;
  if (!selection || typeof selection !== "object") {
    return { ...EMPTY_EQUIPMENT_SELECTION };
  }
  return {
    rightHand: isNoneEquipmentChoice(selection.rightHand) ? null : selection.rightHand,
    leftHand: isNoneEquipmentChoice(selection.leftHand) ? null : selection.leftHand,
    shield: isNoneEquipmentChoice(selection.shield) ? null : selection.shield,
    padding: isNoneEquipmentChoice(selection.padding) ? null : selection.padding,
    mail: isNoneEquipmentChoice(selection.mail) ? null : selection.mail,
    plate: isNoneEquipmentChoice(selection.plate) ? null : selection.plate,
    outer: isNoneEquipmentChoice(selection.outer) ? null : selection.outer,
  };
};

export const applyEquipmentSelection = (actor, selection = EMPTY_EQUIPMENT_SELECTION, options = {}) => {
  const weaponCatalog = options.weaponCatalog ?? [];
  const armorCatalog = options.armorCatalog ?? [];
  const preserveNaturalAttacks = options.preserveNaturalAttacks === true;
  const right = normalizeWeaponProfile(resolveChoice(selection.rightHand, weaponCatalog));
  const left = normalizeWeaponProfile(resolveChoice(selection.leftHand, weaponCatalog));
  const shield = resolveChoice(selection.shield, armorCatalog);
  const layers = {
    padding: resolveChoice(selection.padding, armorCatalog),
    mail: resolveChoice(selection.mail, armorCatalog),
    plate: resolveChoice(selection.plate, armorCatalog),
    outer: resolveChoice(selection.outer, armorCatalog),
  };

  const errors = [];
  let resolvedRight = right;
  let resolvedLeft = left;
  let resolvedShield = shield;

  if (resolvedRight?.requiresTwoHands && (resolvedLeft || resolvedShield)) {
    errors.push("Right-hand weapon requires two hands; left hand and shield were cleared.");
    resolvedLeft = null;
    resolvedShield = null;
  }
  if (resolvedLeft?.requiresTwoHands && resolvedRight) {
    errors.push("Left-hand weapon requires two hands; right hand was cleared.");
    resolvedRight = null;
  }
  if (resolvedLeft?.requiresTwoHands && resolvedShield) {
    errors.push("Left-hand weapon requires two hands; shield was cleared.");
    resolvedShield = null;
  }

  const equippedWeapons = [resolvedRight, resolvedLeft].filter(Boolean);
  const weaponAttacks = equippedWeapons.map((weapon) => ({ ...weapon }));
  const preservedNatural = preserveNaturalAttacks
    ? (Array.isArray(actor?.attacks) ? actor.attacks.filter((attack) => attack?.isNaturalAttack || attack?.naturalWeapon || attack?.type === "natural") : [])
    : [];
  const attacks = [...weaponAttacks, ...preservedNatural];
  if (!attacks.length && !preserveNaturalAttacks) attacks.push(createUnarmedAttack());

  const armorProfile = buildArmorProfile(layers, resolvedShield, actor);
  const equipment = [
    ...equippedWeapons,
    ...Object.values(layers).filter(Boolean),
    ...(resolvedShield ? [resolvedShield] : []),
  ];

  return {
    ...actor,
    equipment,
    inventory: Array.isArray(actor?.inventory) ? actor.inventory : [],
    equippedWeapons,
    equistaminadWeapons: equippedWeapons,
    equistaminadWeapon: resolvedRight?.name ?? resolvedLeft?.name ?? "Unarmed",
    weaponProfiles: equippedWeapons,
    attacks,
    equippedArmor: Object.values(layers).filter(Boolean),
    wornArmor: Object.values(layers).filter(Boolean),
    equippedShield: resolvedShield,
    armorProfile,
    armorName: armorProfile.armorName,
    armorDisplayName: armorProfile.armorName,
    armorDisplaySource: "explicit-equipment-selection",
    armorRating: armorProfile.armorRating,
    defenseRating: armorProfile.defenseRating,
    defenseSource: armorProfile.defenseSource,
    guardRating: armorProfile.defenseRating,
    armorClass: armorProfile.defenseRating,
    ac: armorProfile.defenseRating,
    AR: armorProfile.armorRating,
    derivedStats: {
      ...(actor?.derivedStats ?? {}),
      armorClass: armorProfile.defenseRating,
      defenseRating: armorProfile.defenseRating,
      armorRating: armorProfile.armorRating,
    },
    heldItems: {
      mainHand: resolvedRight?.weaponId ?? null,
      offHand: resolvedLeft?.weaponId ?? null,
      shield: resolvedShield?.id ?? resolvedShield?.name ?? null,
    },
    loadoutKey: "explicit-equipment-selection",
    defaultLoadoutKey: "explicit-equipment-selection",
    loadouts: {
      "explicit-equipment-selection": {
        loadoutKey: "explicit-equipment-selection",
        weaponProfileKeys: equippedWeapons.map((weapon) => weapon.weaponId),
        armorProfileKeys: Object.values(layers).filter(Boolean).map((item) => item.id ?? item.profileKey ?? item.name),
        shieldProfileKey: resolvedShield?.id ?? resolvedShield?.profileKey ?? null,
        heldItems: {
          mainHand: resolvedRight?.weaponId ?? null,
          offHand: resolvedLeft?.weaponId ?? null,
          shield: resolvedShield?.id ?? resolvedShield?.profileKey ?? null,
        },
      },
    },
    explicitEquipmentAuthority: true,
    equipped: {
      ...(actor?.equipped && typeof actor.equipped === "object" ? actor.equipped : {}),
      weaponPrimary: resolvedRight,
      weaponSecondary: resolvedLeft,
      shield: resolvedShield,
      armor: Object.values(layers).filter(Boolean),
    },
    equippedWeapon: resolvedRight?.name ?? "Unarmed",
    weapon: resolvedRight?.name ?? "Unarmed",
    combatWeaponState: {
      ...(actor?.combatWeaponState ?? {}),
      readyWeaponId: resolvedRight?.weaponId ?? resolvedLeft?.weaponId ?? null,
      lastTransitionReason: "explicit-equipment-selection",
    },
    equipmentSelection: {
      rightHand: resolvedRight?.name ?? "None",
      leftHand: resolvedLeft?.name ?? "None",
      shield: resolvedShield?.name ?? "None",
      padding: layers.padding?.name ?? "None",
      mail: layers.mail?.name ?? "None",
      plate: layers.plate?.name ?? "None",
      outer: layers.outer?.name ?? "None",
    },
    migrationMetadata: {
      ...(actor?.migrationMetadata ?? {}),
      combatActor: {
        ...(actor?.migrationMetadata?.combatActor ?? {}),
        requestedLoadout: equippedWeapons.map((weapon) => weapon.weaponId),
        unsupportedWeaponsReplaced: [],
        explicitEquipmentAuthority: true,
      },
    },
    equipmentValidation: {
      valid: errors.length === 0,
      errors,
    },
  };
};

export const reapplyExplicitEquipmentSelection = (actor, options = {}) =>
  applyEquipmentSelection(actor, getExplicitEquipmentSelection(actor), options);

export const getAttackProfilesFromEquipment = (actor) => {
  const equipped = [
    actor?.equipped?.weaponPrimary,
    actor?.equipped?.weaponSecondary,
    ...(Array.isArray(actor?.equippedWeapons) ? actor.equippedWeapons : []),
  ].filter(Boolean);
  const unique = new Map();
  equipped.forEach((weapon) => {
    const normalized = normalizeWeaponProfile(weapon);
    if (normalized) unique.set(normalized.weaponId, normalized);
  });
  const attacks = [...unique.values()];
  if (!attacks.length) attacks.push(createUnarmedAttack());
  return attacks;
};

const weapon = (profileKey, name, damage, damageType, extra = {}) => Object.freeze({
  id: profileKey,
  weaponId: profileKey,
  profileKey,
  name,
  type: "weapon",
  kind: "melee",
  attackType: "melee",
  damage,
  damageDice: damage,
  damageType,
  reach: 5,
  reachFeet: 5,
  naturalWeapon: false,
  isNaturalAttack: false,
  isMelee: true,
  isRanged: false,
  displayName: name,
  weaponFamily: "manufactured-weapon",
  deliveryType: "melee",
  manufacturedOrNatural: "manufactured",
  manufacturedWeapon: true,
  handedness: "one-handed",
  handsRequired: 1,
  attackBonusSource: "actor-and-profile",
  minimumEffectiveReachFeet: 0,
  normalRangeFeet: null,
  longRangeFeet: null,
  ammunitionType: null,
  ammunitionPerAttack: 0,
  reloadRequirement: "none",
  drawRequirement: "none",
  armorContactProfile: "manufactured-melee",
  grappleCompatibility: "metadata-driven",
  clinchCompatibility: "profile-only",
  groundedCompatibility: "profile-only",
  shieldCompatibility: true,
  alternateProfiles: [],
  aliases: [],
  ...extra,
});

const natural = (profileKey, name, damage, damageType, extra = {}) => Object.freeze({
  id: profileKey,
  weaponId: profileKey,
  profileKey,
  name,
  type: "melee",
  kind: "melee",
  attackType: "melee",
  damage,
  damageDice: damage,
  damageType,
  reach: 5,
  reachFeet: 5,
  naturalWeapon: true,
  isNaturalAttack: true,
  isMelee: true,
  isRanged: false,
  manufacturedWeapon: false,
  displayName: name,
  weaponFamily: "natural",
  deliveryType: "natural",
  manufacturedOrNatural: "natural",
  handedness: "natural",
  handsRequired: 0,
  attackBonusSource: "actor-and-profile",
  minimumEffectiveReachFeet: 0,
  normalRangeFeet: null,
  longRangeFeet: null,
  ammunitionType: null,
  ammunitionPerAttack: 0,
  reloadRequirement: "none",
  drawRequirement: "none",
  armorContactProfile: "natural-contact",
  grappleCompatibility: "natural",
  clinchCompatibility: "profile-only",
  groundedCompatibility: "profile-only",
  shieldCompatibility: true,
  alternateProfiles: [],
  aliases: [],
  ...extra,
});

const knightSword = weapon("weapon.long-sword", "Long Sword", "1d8", "slashing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, lengthFt: 3, attackBonus: 3, armorTechniqueCompatibility: ["longsword-cut", "longsword-thrust", "half-sword-thrust", "pommel-or-crossguard-strike"], retainedInClinch: true, usableInClinch: false });
const knightDagger = weapon("weapon.dagger", "Dagger", "1d4", "piercing", { weaponFamily: "dagger", deliveryType: "melee", category: "one-handed", handedness: "one-handed", handsRequired: 1, lengthFt: 1, reach: 5, reachFeet: 5, range: null, normalRangeFeet: null, longRangeFeet: null, usableInClinch: true, groundedCompatible: true, armorGapCapable: true, alternateProfileKeys: ["weapon.dagger.thrown"] });
const thrownDagger = weapon("weapon.dagger.thrown", "Thrown Dagger", "1d4", "piercing", { weaponFamily: "dagger", deliveryType: "thrown", type: "ranged", kind: "ranged", attackType: "ranged", category: "thrown", isMelee: false, isRanged: true, handedness: "one-handed", handsRequired: 1, lengthFt: 1, reach: null, reachFeet: null, normalRangeFeet: 20, longRangeFeet: 60, range: 20, rangeProfile: { normal: 20, long: 60 }, ammunitionType: null, ammunitionPerAttack: 0, drawRequirement: "part-of-attack", armorContactProfile: "thrown-light-blade", grappleCompatibility: "inventory-only", clinchCompatibility: "unavailable", aliases: ["Dagger Throw"] });
const knightShortSword = weapon("weapon.short-sword", "Short Sword", "1d6", "slashing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, lengthFt: 2, retainedInClinch: true, usableInClinch: false });
const ritualDagger = weapon("weapon.ritual-dagger", "Ritual Dagger", "1d4", "piercing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, lengthFt: 1, reach: 1, reachFeet: 1, usableInClinch: true, groundedCompatible: true, armorGapCapable: true });
const armingSword = weapon("weapon.arming-sword", "Arming Sword", "1d8", "slashing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, lengthFt: 3, retainedInClinch: true, usableInClinch: false, shieldCompatible: true });
const mace = weapon("weapon.mace", "Mace", "1d8", "bludgeoning", { category: "one-handed", handedness: "one-handed", handsRequired: 1, lengthFt: 2, retainedInClinch: true, usableInClinch: false, shieldCompatible: true, armorTechniqueCompatibility: ["mace-strike"] });
const handAxe = weapon("weapon.hand-axe", "Hand Axe", "1d6", "slashing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, lengthFt: 2, retainedInClinch: true, usableInClinch: false, shieldCompatible: true });
const guardSpear = weapon("weapon.guard-spear", "Spear", "1d6+1", "piercing", { weaponFamily: "spear", deliveryType: "extended-melee", category: "one-handed", handedness: "one-handed", handsRequired: 1, reach: 10, reachFeet: 10, lengthFt: 6, attackBonus: 3, retainedInClinch: true, usableInClinch: false, shieldCompatible: true, shieldCompatibility: true });
const infantrySpear = weapon("weapon.infantry-spear", "Spear", "1d8+1", "piercing", { weaponFamily: "long-spear", deliveryType: "extended-melee", category: "two-handed", handedness: "two-handed", handsRequired: 2, requiresTwoHands: true, twoHanded: true, reach: 10, reachFeet: 10, lengthFt: 6, attackBonus: 3, retainedInClinch: false, usableInClinch: false, shieldCompatible: false, shieldCompatibility: false });
const huntingBow = weapon("weapon.hunting-bow", "Hunting Bow", "1d6+1", "piercing", { type: "ranged", weaponFamily: "bow", deliveryType: "projectile", kind: "ranged", attackType: "ranged", category: "ranged", isMelee: false, isRanged: true, handedness: "two-handed", handsRequired: 2, requiresTwoHands: true, twoHanded: true, reach: null, reachFeet: null, lengthFt: null, attackBonus: 3, range: 80, rangeProfile: { normal: 80, long: 240 }, normalRangeFeet: 80, longRangeFeet: 240, ammunition: "arrows", ammunitionType: "arrow", ammunitionPerAttack: 1, reloadRequirement: "none", drawRequirement: "part-of-attack", armorContactProfile: "ordinary-broadhead-arrow", usableInClinch: false, grappleCompatibility: "unavailable", clinchCompatibility: "unavailable", groundedCompatibility: "unavailable", shieldCompatible: false, shieldCompatibility: false });
const archerBow = weapon("weapon.bow", "Bow Shot", "1d6+2", "piercing", { type: "ranged", displayName: "Bow", weaponFamily: "bow", deliveryType: "projectile", kind: "ranged", attackType: "ranged", category: "ranged", isMelee: false, isRanged: true, handedness: "two-handed", handsRequired: 2, requiresTwoHands: true, twoHanded: true, reach: null, reachFeet: null, lengthFt: null, attackBonus: 4, range: 120, rangeProfile: { normal: 120, long: 480 }, normalRangeFeet: 120, longRangeFeet: 480, ammunition: "arrows", ammunitionType: "arrow", ammunitionPerAttack: 1, reloadRequirement: "none", drawRequirement: "part-of-attack", armorContactProfile: "ordinary-broadhead-arrow", usableInClinch: false, grappleCompatibility: "unavailable", clinchCompatibility: "unavailable", groundedCompatibility: "unavailable", shieldCompatible: false, shieldCompatibility: false, aliases: ["Bow"] });
const longbow = weapon("weapon.longbow", "Longbow Shot", "1d8+2", "piercing", { type: "ranged", displayName: "Longbow", weaponFamily: "longbow", deliveryType: "projectile", kind: "ranged", attackType: "ranged", category: "ranged", isMelee: false, isRanged: true, handedness: "two-handed", handsRequired: 2, requiresTwoHands: true, twoHanded: true, reach: null, reachFeet: null, lengthFt: null, attackBonus: 4, range: 150, rangeProfile: { normal: 150, long: 600 }, normalRangeFeet: 150, longRangeFeet: 600, ammunition: "arrows", ammunitionType: "arrow", ammunitionPerAttack: 1, reloadRequirement: "none", drawRequirement: "part-of-attack", armorContactProfile: "heavy-war-bow-arrow", usableInClinch: false, grappleCompatibility: "unavailable", clinchCompatibility: "unavailable", groundedCompatibility: "unavailable", shieldCompatible: false, shieldCompatibility: false, aliases: ["Long Bow", "Longbow"] });
const archerKnife = weapon("weapon.knife", "Knife Attack", "1d4", "piercing", { type: "melee", displayName: "Knife", category: "one-handed", reach: 5, reachFeet: 5, lengthFt: 1, usableInClinch: true, groundedCompatible: true, groundedCompatibility: "available", aliases: ["Knife"] });
const longbowmanKnife = weapon("weapon.longbowman-knife", "Knife Attack", "1d4+1", "piercing", { type: "melee", displayName: "Knife", category: "one-handed", attackBonus: 3, reach: 5, reachFeet: 5, lengthFt: 1, usableInClinch: true, groundedCompatible: true, groundedCompatibility: "available", aliases: ["Knife"] });
const pike = weapon("weapon.pike", "Pike", "1d10", "piercing", { weaponFamily: "pike", deliveryType: "extended-melee", category: "two-handed", handedness: "two-handed", handsRequired: 2, requiresTwoHands: true, twoHanded: true, reach: 10, reachFeet: 10, lengthFt: 10, minimumEffectiveReachFeet: 5, usableInClinch: false, grappleCompatibility: "drop-on-entry", clinchCompatibility: "unavailable", groundedCompatibility: "unavailable", shieldCompatible: false, shieldCompatibility: false });
const halberd = weapon("weapon.halberd", "Halberd", "1d10", "slashing", { weaponFamily: "halberd", deliveryType: "extended-melee", category: "two-handed", handedness: "two-handed", handsRequired: 2, requiresTwoHands: true, twoHanded: true, reach: 8, reachFeet: 8, lengthFt: 8, minimumEffectiveReachFeet: 0, usableInClinch: false, grappleCompatibility: "drop-on-entry", clinchCompatibility: "unavailable", groundedCompatibility: "unavailable", shieldCompatible: false, shieldCompatibility: false });
const crossbow = weapon("weapon.crossbow", "Crossbow", "1d10", "piercing", { type: "ranged", weaponFamily: "crossbow", deliveryType: "projectile", kind: "ranged", attackType: "ranged", category: "ranged", isMelee: false, isRanged: true, handedness: "two-handed", handsRequired: 2, requiresTwoHands: true, twoHanded: true, reach: null, reachFeet: null, lengthFt: null, range: 120, rangeProfile: { normal: 120, long: 480 }, normalRangeFeet: 120, longRangeFeet: 480, ammunition: "bolts", ammunitionType: "bolt", ammunitionPerAttack: 1, reloadRequirement: "one-action", drawRequirement: "none", armorContactProfile: "light-crossbow-bolt", usableInClinch: false, grappleCompatibility: "unavailable", clinchCompatibility: "unavailable", groundedCompatibility: "unavailable", shieldCompatible: false, shieldCompatibility: false });
const scimitar = weapon("weapon.scimitar", "Scimitar", "1d6+1", "slashing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, lengthFt: 3, retainedInClinch: true, usableInClinch: false, shieldCompatible: true });
const greatAxe = weapon("weapon.greataxe", "Greataxe", "1d12+3", "slashing", { category: "two-handed", handedness: "two-handed", handsRequired: 2, requiresTwoHands: true, twoHanded: true, lengthFt: 5, attackBonus: 5, retainedInClinch: false, usableInClinch: false, shieldCompatible: false });
const goblinSword = weapon("weapon.short-sword", "Short Sword", "1d6+2", "slashing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, attackBonus: 4 });
const goblinDagger = weapon("weapon.goblin-dagger", "Dagger", "1d4", "piercing", { category: "one-handed", handedness: "one-handed", handsRequired: 1, reach: 1, reachFeet: 1, usableInClinch: true, groundedCompatible: true });
const minotaurAxe = weapon("weapon.minotaur-heavy-axe", "Heavy Axe", "2d8+4", "slashing", { category: "two-handed", handedness: "two-handed", handsRequired: 2, twoHanded: true, requiresTwoHands: true, reach: 10, reachFeet: 10, lengthFt: 6, usableInClinch: false, techniqueKey: "heavyAxe", resolverRoute: "standard-weapon-impact", recoveryOnCommittedMiss: true });
const minotaurGore = natural("natural.minotaur-gore", "Gore", "2d6+4", "piercing", { attackMode: "gore", techniqueKey: "gore", resolverRoute: "standard-natural-impact", usableInClose: true, usableInClinch: false, groundedCompatible: false });
const minotaurCharge = natural("natural.minotaur-charging-gore", "Charging Gore", "2d6+4", "piercing", { attackMode: "charge", techniqueKey: "chargingGore", resolverRoute: "movement-collision-impact", chargeOnly: true, minimumStraightLineFeet: 15, staminaCost: 6, requiresOpenMelee: true });
const minotaurHornHook = natural("natural.minotaur-horn-hook", "Horn Hook", "2d6+4", "piercing", { attackMode: "horn-hook", techniqueKey: "hornHook", resolverRoute: "canonical-grapple-control", prerequisite: "horn-engagement", usableInClose: true, usableInClinch: true });
const minotaurHookAndLift = natural("natural.minotaur-hook-and-lift", "Hook and Lift", "0", "control", { attackMode: "hook-and-lift", techniqueKey: "hookAndLift", resolverRoute: "canonical-lift-contest", prerequisite: "horn-engagement", targetSizeLimit: "large", usableInClinch: true });
const minotaurBodyClinch = natural("natural.minotaur-body-clinch", "Body Clinch", "0", "control", { attackMode: "body-clinch", techniqueKey: "bodyClinch", resolverRoute: "canonical-grapple-dispatcher", usableInClose: true });
const minotaurLift = natural("natural.minotaur-lift", "Lift", "0", "control", { attackMode: "lift", techniqueKey: "lift", resolverRoute: "canonical-lift-contest", prerequisite: "dominant-grapple-control", targetSizeLimit: "large", usableInClinch: true });
const minotaurSlam = natural("natural.minotaur-slam", "Slam", "2d6+4", "bludgeoning", { attackMode: "slam", techniqueKey: "slam", resolverRoute: "fall-collision-impact", prerequisite: "lifted-target", usableInClinch: true, groundedCompatible: true });
const minotaurThrow = natural("natural.minotaur-throw", "Throw", "0", "control", { attackMode: "throw", techniqueKey: "throw", resolverRoute: "canonical-throw-forced-movement", prerequisite: "grapple-control", usableInClinch: true });
const minotaurCrush = natural("natural.minotaur-crush", "Crush", "2d6+4", "bludgeoning", { attackMode: "crush", techniqueKey: "crush", resolverRoute: "canonical-grapple-pressure", prerequisite: "dominant-pin-trapped-or-controlled-prone", usableInClose: false, usableInClinch: true, groundedCompatible: true });
const minotaurHeadbutt = natural("natural.minotaur-headbutt", "Headbutt", "2d6+4", "bludgeoning", { attackMode: "headbutt", techniqueKey: "headbutt", resolverRoute: "standard-natural-impact", armorContactProfile: "helmet-blunt-impact", usableInClose: true, usableInClinch: true });
const minotaurTrample = natural("natural.minotaur-trample", "Trample", "2d6+4", "bludgeoning", { attackMode: "trample", techniqueKey: "trample", resolverRoute: "standard-natural-impact", prerequisite: "prone-or-overrun", usableInClose: true });
const minotaurRockThrow = weapon("weapon.minotaur-rock-thrown", "Rock Throw", "2d6+4", "bludgeoning", { techniqueKey: "rockThrow", resolverRoute: "canonical-projectile", deliveryType: "thrown", type: "ranged", kind: "ranged", attackType: "ranged", isMelee: false, isRanged: true, range: 30, normalRangeFeet: 30, longRangeFeet: 90, rangeProfile: { normal: 30, long: 90 }, armorContactProfile: "improvised-heavy-projectile" });
const minotaurRockSmash = weapon("weapon.minotaur-rock-smash", "Rock Smash", "2d6+4", "bludgeoning", { techniqueKey: "rockSmash", resolverRoute: "standard-weapon-impact", armorContactProfile: "improvised-heavy-melee" });

const common = (definition) => Object.freeze({
  combatActorSchemaVersion: 1,
  movementModes: ["ground"],
  playable: true,
  defaultControlMode: "ai",
  ...definition,
  displayName: definition.displayName || definition.name,
  stamina: definition.stamina || definition.combatStamina,
  morale: definition.morale || definition.moraleProfile,
  loadoutKey: definition.loadoutKey || "default",
  defaultLoadoutKey: definition.defaultLoadoutKey || definition.loadoutKey || "default",
  loadouts: definition.loadouts || {
    default: {
      loadoutKey: "default",
      weaponProfileKeys: (definition.weaponProfiles || []).map((profile) => profile.profileKey),
      heldItems: { ...(definition.heldItems || {}) },
    },
  },
  wornArmor: definition.equippedArmor,
  combatWeaponState: {
    readyWeaponId: definition.heldItems?.mainHand ?? null,
    retainedWeaponId: null,
    retainedWeaponDisposition: null,
    clinchWeaponId: null,
    clinchWeaponReady: false,
    droppedWeaponIds: [],
    lastTransitionReason: "canonical-combat-start",
  },
});

const armor = (profileKey, name, guardRating, category, extra = {}) => Object.freeze({
  id: profileKey,
  profileKey,
  name,
  type: "armor",
  category,
  weightClass: category,
  guardRating,
  ...extra,
});

const shield = (profileKey, name, extra = {}) => Object.freeze({
  id: profileKey,
  profileKey,
  name,
  type: "shield",
  category: "shield",
  active: true,
  ...extra,
});

const martialAttributes = ({ strength, dexterity, constitution, intelligence = 10, wisdom = 10, charisma = 10 }) => ({
  might: strength,
  deftness: dexterity,
  vigor: constitution,
  endurance: constitution,
  mobility: dexterity,
  intellect: intelligence,
  awareness: wisdom,
  cunning: intelligence,
  resolve: wisdom,
  discipline: wisdom,
  presence: charisma,
  renown: 0,
  favor: 0,
});

const ordinaryBehavior = (alignmentKey, overrides = {}) => ({
  aggression: 55,
  caution: 55,
  loyalty: 50,
  instinct: 45,
  mercy: 50,
  cruelty: 20,
  greed: 35,
  honor: 50,
  pride: 45,
  discipline: 55,
  alignmentKey,
  ...overrides,
});

const ordinarySurrender = (alignmentKey, overrides = {}) => ({
  mayOfferSurrender: true,
  mayAcceptSurrender: true,
  behaviorProfile: alignmentKey,
  prisonerPreference: "circumstantial",
  releasePreference: "circumstantial",
  ransomPreference: "circumstantial",
  confiscationPreference: "circumstantial",
  executionPreference: "circumstantial",
  alignmentBehaviorMappingKey: alignmentKey,
  ...overrides,
});

const ordinaryGrapple = (overrides = {}) => ({
  sizeProfile: "medium",
  mayInitiateGrapple: true,
  preferredInitiator: false,
  grapplePreference: "situational",
  prefersAssist: false,
  prefersProneTargets: false,
  sizeRulesApply: true,
  canUseSwarmTakedown: false,
  takedownCompatible: true,
  groundControlCompatible: true,
  weaponRetentionBehavior: "metadata-driven",
  clinchWeaponAvailability: "inventory-only",
  groundedWeaponAvailability: "profile-only",
  ...overrides,
});

const buildOrdinaryHumanoid = ({
  actorKey,
  name,
  species = "human",
  role,
  hp,
  armorClass,
  movement = 30,
  staminaMaximum,
  actionsPerRound = 2,
  scores,
  attributes,
  bonuses,
  alignment,
  behavior,
  morale,
  surrenderProfile,
  weaponProfiles,
  equippedArmor,
  equippedShield = null,
  armorProfile,
  heldItems,
  grappleProfile,
  factionTags = ["human-realms"],
  cultureTags = ["ordinary-infantry"],
  tags = [],
  traits = [],
  aiRole = "melee",
  defaultControlMode = "ai",
  source = "normalized-legacy-actor",
  sourceLabel = "Normalized Legacy Actor",
  loadoutKey = "default",
  loadouts = null,
  ammunition = [],
  ammunitionState = null,
  rangedTacticalProfile = null,
}) => common({
  actorKey,
  id: actorKey,
  name,
  displayName: name,
  species,
  creatureType: "humanoid",
  category: species === "human" ? "human" : "humanoid",
  size: "medium",
  role,
  modelKey: actorKey,
  source,
  sourceLabel,
  teamDefault: "enemy",
  defaultControlMode,
  factionTags,
  cultureTags,
  tags: [...new Set([species, "humanoid", aiRole === "ranged" || aiRole === "archer" ? "ranged" : "melee", ...tags])],
  traitKeys: [...traits],
  traits: [...traits],
  attributes: { ...martialAttributes(scores), ...(attributes || {}) },
  abilityScores: { ...scores },
  derivedStats: { hp, maxHp: hp, armorClass, movement },
  movement: { ground: movement, groundPace: movement, burst: movement * 2, runDistance: movement * 2, recoveryStep: 5, terrainMobility: {} },
  currentStamina: staminaMaximum,
  combatStamina: { authority: "canonical", maximum: staminaMaximum, current: staminaMaximum },
  fatigueState: "ready",
  actionsPerRound,
  bonuses,
  alignment,
  alignmentName: alignment.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ").replace("True Neutral", "True Neutral"),
  alignmentBehaviorMappingKey: alignment,
  behaviorProfileKey: `${actorKey}-${alignment}`,
  behavior: ordinaryBehavior(alignment, behavior),
  moraleProfile: { state: "steady", routBehavior: "withdraw-or-yield", surrenderEligible: true, terminalEscapeBehavior: "map-boundary", ...morale },
  surrenderProfile: ordinarySurrender(alignment, surrenderProfile),
  loadoutKey,
  defaultLoadoutKey: loadoutKey,
  loadouts: loadouts || { [loadoutKey]: { loadoutKey, weaponProfileKeys: weaponProfiles.map((profile) => profile.profileKey), heldItems: { ...heldItems } } },
  equipment: [...weaponProfiles, ...ammunition, ...(equippedShield ? [equippedShield] : []), equippedArmor],
  inventory: [...weaponProfiles],
  equippedArmor,
  equippedShield,
  armorProfile,
  heldItems,
  attacks: [...weaponProfiles],
  weaponProfiles: [...weaponProfiles],
  grappleProfile: ordinaryGrapple(grappleProfile),
  ammunition: [...ammunition],
  ammunitionState,
  rangedTacticalProfile,
  aiRole,
});

const squireArmor = armor("armor.mail-shirt", "Mail Shirt", 13, "medium", { armorClass: "mail", rigidCoverage: false });
const squireShield = shield("shield.light", "Light Shield", { weight: 5 });
const manAtArmsArmor = armor("armor.mail-hauberk-heavy", "Mail Hauberk", 15, "medium", { armorClass: "mail", rigidCoverage: false, compatibilityNote: "Source guard value retained." });
const manAtArmsShield = shield("shield.kite", "Kite Shield", { weight: 10 });
const spearmanArmor = armor("armor.spearman-gambeson", "Gambeson", 13, "light", { armorClass: "padded", rigidCoverage: false, compatibilityNote: "Source guard value retained; coverage is textile, not plate." });
const brigandArmor = armor("armor.leather-jack", "Leather Jack", 12, "light", { armorClass: "leather", rigidCoverage: false });
const brigandShield = shield("shield.buckler", "Buckler", { weight: 2 });
const banditArmor = armor("armor.bandit-leather", "Leather Armor", 12, "light", { armorClass: "leather", rigidCoverage: false, compatibilityNote: "Public profile supplied armor class without layered coverage." });
const archerArmor = armor("armor.archer-padded", "Padded Armor", 12, "light", { armorClass: "padded", rigidCoverage: false });
const longbowmanArmor = armor("armor.longbowman-padded-jack", "Padded Jack", 12, "light", { armorClass: "padded", rigidCoverage: false });
const arrowStack = (quantity = 20, ammunitionProfile = "ordinary-arrow") => Object.freeze({ id: `ammunition.${ammunitionProfile}`, profileKey: `ammunition.${ammunitionProfile}`, name: "Arrows", type: "ammunition", category: "ammunition", ammunitionType: "arrow", ammunitionProfile, quantity });
const guardArmor = armor("armor.guard-mail", "Guard Mail", 16, "medium", { armorClass: "mail", rigidCoverage: false, compatibilityNote: "Guard rating preserves the source defensive profile and does not imply plate." });
const guardShield = shield("shield.guard", "Guard Shield", { weight: 8 });
const orcArmor = armor("armor.orc-hide", "Hide Armor", 13, "light", { armorClass: "hide", rigidCoverage: false });
const cultistArmor = armor("armor.cultist-leather", "Leather Armor", 12, "light", { armorClass: "leather", rigidCoverage: false });
const veteranKnightArmor = armor("armor.veteran-plate-harness", "Plate Harness", 16, "heavy", { armorClass: "plate", rigidCoverage: true, weight: 45 });
const veteranKnightShield = shield("shield.veteran-heater", "Heater Shield", { weight: 8 });

export const CANONICAL_COMBAT_ACTORS = Object.freeze({
  knight: common({
    actorKey: "knight", id: "knight", name: "Knight", species: "human", creatureType: "humanoid", category: "human", size: "medium", role: "armored-martial-fighter", modelKey: "knight", source: "public-actor", sourceLabel: "Public Actor", teamDefault: "enemy",
    factionTags: ["human-realms"], cultureTags: ["knightly-retinue"], tags: ["human", "humanoid", "soldier", "knight", "heavy armor"], traitKeys: ["armored_training", "shield_drill", "grapple_capable"], traits: ["armored_training", "shield_drill", "grapple_capable"],
    attributes: { might: 15, deftness: 11, vigor: 12, endurance: 14, mobility: 9, intellect: 10, awareness: 11, cunning: 10, resolve: 13, discipline: 14, presence: 12, renown: 1, favor: 0 }, abilityScores: { strength: 15, dexterity: 11, constitution: 14, intelligence: 10, wisdom: 13, charisma: 12 },
    derivedStats: { hp: 24, maxHp: 24, armorClass: 16, movement: 25 }, movement: { ground: 25, groundPace: 25, burst: 50, runDistance: 50, recoveryStep: 5, terrainMobility: {} }, currentStamina: 28, combatStamina: { authority: "canonical", maximum: 28, current: 28 }, fatigueState: "ready", actionsPerRound: 2, bonuses: { attack: 3, block: 3, evade: 1, damage: 2 },
    alignment: "neutral-good", alignmentName: "Neutral Good", alignmentBehaviorMappingKey: "neutral-good", behaviorProfileKey: "knight-neutral-good", behavior: { aggression: 55, caution: 60, loyalty: 75, instinct: 35, mercy: 82, cruelty: 8, greed: 22, honor: 80, pride: 48, discipline: 72 },
    moraleProfile: { state: "steady", routBehavior: "organized-withdrawal", surrenderEligible: true, terminalEscapeBehavior: "map-boundary" }, surrenderProfile: { mayOfferSurrender: true, mayAcceptSurrender: true, behaviorProfile: "neutral-good", prisonerPreference: "take-prisoner", executionPreference: "avoid", alignmentBehaviorMappingKey: "neutral-good" },
    equipment: [knightSword, knightDagger, { id: "shield.heater", profileKey: "shield.heater", name: "Heater Shield", type: "shield", category: "shield", weight: 8 }, { id: "armor.plate-harness", profileKey: "armor.plate-harness", name: "Plate Harness", type: "armor", category: "heavy", weightClass: "heavy", guardRating: 16, weight: 45 }], inventory: [knightSword, knightDagger],
    equippedArmor: { id: "armor.plate-harness", profileKey: "armor.plate-harness", name: "Plate Harness", type: "armor", category: "heavy", weightClass: "heavy", guardRating: 16, weight: 45 }, equippedShield: { id: "shield.heater", profileKey: "shield.heater", name: "Heater Shield", type: "shield", category: "shield", weight: 8 }, armorProfile: { profileKey: "armor.plate-harness", armorClass: "plate", category: "heavy", weightClass: "heavy", rigidCoverage: true }, heldItems: { mainHand: "weapon.long-sword", offHand: "shield.heater" }, attacks: [knightSword], weaponProfiles: [knightSword, knightDagger],
    grappleProfile: { sizeProfile: "medium", preferredInitiator: true, prefersAssist: false, prefersProneTargets: false, sizeRulesApply: true, canUseSwarmTakedown: false, takedownCompatible: true, groundControlCompatible: true, mayDemandSurrender: true }, aiRole: "melee",
  }),
  squire: buildOrdinaryHumanoid({
    actorKey: "squire", name: "Squire", role: "shielded-swordsman", hp: 20, armorClass: 13, staminaMaximum: 24,
    scores: { strength: 12, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
    bonuses: { attack: 2, block: 1, evade: 1, damage: 1 }, alignment: "neutral-good",
    behavior: { aggression: 48, caution: 62, loyalty: 72, mercy: 68, honor: 66, discipline: 62 },
    weaponProfiles: [{ ...armingSword, damage: "1d8+1", damageDice: "1d8+1", attackBonus: 2 }],
    equippedArmor: squireArmor, equippedShield: squireShield,
    armorProfile: { profileKey: squireArmor.profileKey, armorClass: "mail", category: "medium", weightClass: "medium", rigidCoverage: false },
    heldItems: { mainHand: "weapon.arming-sword", offHand: squireShield.profileKey },
    grappleProfile: { weaponRetentionBehavior: "retain-one-handed", clinchWeaponAvailability: "none-carried" },
    cultureTags: ["knightly-retinue"], tags: ["soldier", "shield-bearer"], traits: ["shield_drill"],
  }),
  "man-at-arms": buildOrdinaryHumanoid({
    actorKey: "man-at-arms", name: "Man-at-Arms", role: "armored-infantry", hp: 26, armorClass: 15, movement: 25, staminaMaximum: 26,
    scores: { strength: 14, dexterity: 11, constitution: 13, intelligence: 10, wisdom: 11, charisma: 10 },
    bonuses: { attack: 2, block: 2, evade: 1, damage: 2 }, alignment: "lawful-neutral",
    behavior: { aggression: 62, caution: 58, loyalty: 68, honor: 64, discipline: 72 },
    weaponProfiles: [{ ...mace, damage: "1d8+2", damageDice: "1d8+2", attackBonus: 2 }],
    equippedArmor: manAtArmsArmor, equippedShield: manAtArmsShield,
    armorProfile: { profileKey: manAtArmsArmor.profileKey, armorClass: "mail", category: "medium", weightClass: "medium", rigidCoverage: false },
    heldItems: { mainHand: "weapon.mace", offHand: manAtArmsShield.profileKey },
    grappleProfile: { weaponRetentionBehavior: "retain-one-handed", clinchWeaponAvailability: "none-carried" },
    tags: ["soldier", "armored-infantry", "shield-bearer"], traits: ["shield_drill", "armored_training"],
  }),
  spearman: buildOrdinaryHumanoid({
    actorKey: "spearman", name: "Spearman", role: "reach-infantry", hp: 14, armorClass: 13, staminaMaximum: 24,
    scores: { strength: 12, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
    bonuses: { attack: 3, block: 1, evade: 1, damage: 1 }, alignment: "true-neutral",
    behavior: { aggression: 56, caution: 60, loyalty: 58, discipline: 64 },
    weaponProfiles: [infantrySpear], equippedArmor: spearmanArmor,
    armorProfile: { profileKey: spearmanArmor.profileKey, armorClass: "padded", category: "light", weightClass: "light", rigidCoverage: false },
    heldItems: { mainHand: infantrySpear.profileKey, offHand: null },
    grappleProfile: { weaponRetentionBehavior: "drop-two-handed", clinchWeaponAvailability: "none-carried", groundedWeaponAvailability: "none-after-drop" },
    tags: ["soldier", "reach"], traits: ["reach_training"],
  }),
  brigand: buildOrdinaryHumanoid({
    actorKey: "brigand", name: "Brigand", role: "light-ambusher", hp: 17, armorClass: 12, staminaMaximum: 22,
    scores: { strength: 11, dexterity: 13, constitution: 11, intelligence: 10, wisdom: 10, charisma: 9 },
    bonuses: { attack: 2, block: 1, evade: 2, damage: 1 }, alignment: "chaotic-neutral",
    behavior: { aggression: 58, caution: 62, greed: 68, honor: 28, discipline: 38 },
    surrenderProfile: { prisonerPreference: "ransom-or-confiscate", ransomPreference: "preferred", executionPreference: "avoid-unless-threatened" },
    weaponProfiles: [{ ...handAxe, damage: "1d6+1", damageDice: "1d6+1", attackBonus: 2 }],
    equippedArmor: brigandArmor, equippedShield: brigandShield,
    armorProfile: { profileKey: brigandArmor.profileKey, armorClass: "leather", category: "light", weightClass: "light", rigidCoverage: false },
    heldItems: { mainHand: handAxe.profileKey, offHand: brigandShield.profileKey },
    grappleProfile: { weaponRetentionBehavior: "retain-one-handed", clinchWeaponAvailability: "none-carried" },
    factionTags: ["outlaw-bands"], cultureTags: ["roadside-band"], tags: ["ambusher", "shield-bearer"], traits: ["opportunistic"], aiRole: "skirmisher",
  }),
  bandit: buildOrdinaryHumanoid({
    actorKey: "bandit", name: "Bandit", role: "melee-skirmisher", hp: 11, armorClass: 12, staminaMaximum: 24,
    scores: { strength: 11, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
    bonuses: { attack: 3, block: 1, evade: 2, damage: 1 }, alignment: "chaotic-neutral",
    behavior: { aggression: 52, caution: 68, greed: 72, honor: 24, discipline: 34 },
    surrenderProfile: { prisonerPreference: "ransom-or-release", ransomPreference: "preferred", confiscationPreference: "preferred", executionPreference: "avoid" },
    weaponProfiles: [{ ...handAxe, damage: "1d6+1", damageDice: "1d6+1", attackBonus: 3 }, huntingBow],
    equippedArmor: banditArmor,
    armorProfile: { profileKey: banditArmor.profileKey, armorClass: "leather", category: "light", weightClass: "light", rigidCoverage: false },
    heldItems: { mainHand: handAxe.profileKey, offHand: null },
    loadouts: {
      "hand-axe-skirmisher": { loadoutKey: "hand-axe-skirmisher", weaponProfileKeys: [handAxe.profileKey, huntingBow.profileKey], heldItems: { mainHand: handAxe.profileKey, offHand: null } },
      "hunting-bow-skirmisher": { loadoutKey: "hunting-bow-skirmisher", weaponProfileKeys: [huntingBow.profileKey, handAxe.profileKey], heldItems: { mainHand: huntingBow.profileKey, sidearm: handAxe.profileKey, offHand: null } },
    },
    loadoutKey: "hand-axe-skirmisher",
    ammunition: [arrowStack(20)],
    ammunitionState: { weaponId: huntingBow.weaponId, ammunitionType: "arrow", current: 20, maximum: 20, chambered: false, reloadState: "ready", lastSpentActionToken: null, spentActionTokens: [] },
    rangedTacticalProfile: { role: "skirmisher", preferredBand: "normal", repositionForLineOfSight: true, sidearmWeaponId: handAxe.weaponId },
    grappleProfile: { weaponRetentionBehavior: "retain-one-handed", clinchWeaponAvailability: "none-carried" },
    factionTags: ["outlaw-bands"], cultureTags: ["bandit-company"], tags: ["light-fighter", "skirmisher"], traits: ["self_preserving"], aiRole: "skirmisher",
  }),
  archer: buildOrdinaryHumanoid({
    actorKey: "archer", name: "Archer", role: "dedicated-bowman", hp: 12, armorClass: 12, staminaMaximum: 20,
    scores: { strength: 10, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    bonuses: { attack: 4, block: 0, evade: 2, damage: 2 }, alignment: "true-neutral",
    behavior: { aggression: 48, caution: 70, discipline: 60 },
    weaponProfiles: [archerBow, archerKnife], equippedArmor: archerArmor,
    armorProfile: { profileKey: archerArmor.profileKey, armorClass: "padded", category: "light", weightClass: "light", rigidCoverage: false },
    heldItems: { mainHand: archerBow.profileKey, sidearm: archerKnife.profileKey, offHand: null },
    grappleProfile: { weaponRetentionBehavior: "drop-two-handed", clinchWeaponAvailability: "inventory-only", groundedWeaponAvailability: "knife-profile" },
    ammunition: [arrowStack(20)],
    ammunitionState: { weaponId: archerBow.weaponId, ammunitionType: "arrow", current: 20, maximum: 20, chambered: false, reloadState: "ready", lastSpentActionToken: null, spentActionTokens: [] },
    rangedTacticalProfile: { role: "ranged", preferredBand: "normal", repositionForLineOfSight: true, sidearmWeaponId: archerKnife.weaponId },
    cultureTags: ["field-archers"], tags: ["soldier", "archer"], traits: [], aiRole: "ranged",
  }),
  longbowman: buildOrdinaryHumanoid({
    actorKey: "longbowman", name: "Longbowman", role: "dedicated-longbowman", hp: 14, armorClass: 12, staminaMaximum: 22,
    scores: { strength: 13, dexterity: 14, constitution: 11, intelligence: 10, wisdom: 10, charisma: 10 },
    bonuses: { attack: 4, block: 0, evade: 2, damage: 2 }, alignment: "true-neutral",
    behavior: { aggression: 50, caution: 68, discipline: 64 },
    weaponProfiles: [longbow, longbowmanKnife], equippedArmor: longbowmanArmor,
    armorProfile: { profileKey: longbowmanArmor.profileKey, armorClass: "padded", category: "light", weightClass: "light", rigidCoverage: false },
    heldItems: { mainHand: longbow.profileKey, sidearm: longbowmanKnife.profileKey, offHand: null },
    grappleProfile: { weaponRetentionBehavior: "drop-two-handed", clinchWeaponAvailability: "inventory-only", groundedWeaponAvailability: "knife-profile" },
    ammunition: [arrowStack(20, "ordinary-war-arrow")],
    ammunitionState: { weaponId: longbow.weaponId, ammunitionType: "arrow", current: 20, maximum: 20, chambered: false, reloadState: "ready", lastSpentActionToken: null, spentActionTokens: [] },
    rangedTacticalProfile: { role: "archer", preferredBand: "normal", repositionForLineOfSight: true, sidearmWeaponId: longbowmanKnife.weaponId },
    cultureTags: ["field-archers"], tags: ["soldier", "archer", "longbow"], traits: [], aiRole: "archer",
  }),
  guard: buildOrdinaryHumanoid({
    actorKey: "guard", name: "Guard", role: "defensive-spear-guard", hp: 11, armorClass: 16, staminaMaximum: 24,
    scores: { strength: 13, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 11, charisma: 10 },
    bonuses: { attack: 3, block: 2, evade: 1, damage: 1 }, alignment: "lawful-neutral",
    behavior: { aggression: 44, caution: 70, loyalty: 72, honor: 62, discipline: 78 },
    surrenderProfile: { prisonerPreference: "take-prisoner", releasePreference: "authority-directed", executionPreference: "avoid" },
    weaponProfiles: [guardSpear], equippedArmor: guardArmor, equippedShield: guardShield,
    armorProfile: { profileKey: guardArmor.profileKey, armorClass: "mail", category: "medium", weightClass: "medium", rigidCoverage: false },
    heldItems: { mainHand: guardSpear.profileKey, offHand: guardShield.profileKey },
    grappleProfile: { weaponRetentionBehavior: "retain-one-handed", clinchWeaponAvailability: "none-carried" },
    factionTags: ["settlement-watch"], cultureTags: ["local-garrison"], tags: ["guard", "defensive", "shield-bearer"], traits: ["defensive_discipline", "shield_drill"], aiRole: "defensive", defaultControlMode: "defensive",
  }),
  "veteran-knight": buildOrdinaryHumanoid({
    actorKey: "veteran-knight", name: "Veteran Knight", role: "veteran-armored-infantry", hp: 28, armorClass: 16, movement: 25, staminaMaximum: 30,
    scores: { strength: 16, dexterity: 12, constitution: 15, intelligence: 10, wisdom: 14, charisma: 14 },
    attributes: { might: 16, deftness: 12, vigor: 13, endurance: 15, mobility: 9, intellect: 10, awareness: 12, cunning: 11, resolve: 14, discipline: 15, presence: 14, renown: 2, favor: 0 },
    bonuses: { attack: 4, block: 4, evade: 1, damage: 3 }, alignment: "neutral-good",
    behavior: { aggression: 62, caution: 64, loyalty: 78, mercy: 78, honor: 82, discipline: 80 },
    surrenderProfile: { prisonerPreference: "take-prisoner", releasePreference: "honorable-release", executionPreference: "avoid" },
    weaponProfiles: [{ ...knightSword, attackBonus: 4 }, knightDagger], equippedArmor: veteranKnightArmor, equippedShield: veteranKnightShield,
    armorProfile: { profileKey: veteranKnightArmor.profileKey, armorClass: "plate", category: "heavy", weightClass: "heavy", rigidCoverage: true },
    heldItems: { mainHand: knightSword.profileKey, offHand: veteranKnightShield.profileKey },
    grappleProfile: { preferredInitiator: true, weaponRetentionBehavior: "retain-one-handed", clinchWeaponAvailability: "inventory-only", groundedWeaponAvailability: "dagger-profile" },
    cultureTags: ["knightly-retinue"], tags: ["soldier", "knight", "veteran", "heavy-armor"], traits: ["armored_training", "shield_drill", "grapple_capable"], source: "public-actor", sourceLabel: "Public Actor",
  }),
  orc: buildOrdinaryHumanoid({
    actorKey: "orc", name: "Orc", species: "orc", role: "two-handed-shock-infantry", hp: 15, armorClass: 13, staminaMaximum: 32,
    scores: { strength: 16, dexterity: 12, constitution: 16, intelligence: 7, wisdom: 11, charisma: 10 },
    bonuses: { attack: 5, block: 0, evade: 1, damage: 3 }, alignment: "chaotic-neutral",
    behavior: { aggression: 76, caution: 38, loyalty: 58, instinct: 68, mercy: 34, cruelty: 42, honor: 44, discipline: 48 },
    surrenderProfile: { prisonerPreference: "circumstantial", confiscationPreference: "preferred", executionPreference: "circumstantial" },
    weaponProfiles: [greatAxe], equippedArmor: orcArmor,
    armorProfile: { profileKey: orcArmor.profileKey, armorClass: "hide", category: "light", weightClass: "light", rigidCoverage: false },
    heldItems: { mainHand: greatAxe.profileKey, offHand: null },
    grappleProfile: { preferredInitiator: true, weaponRetentionBehavior: "drop-two-handed", clinchWeaponAvailability: "none-carried", groundedWeaponAvailability: "none-after-drop" },
    factionTags: ["orc-warband"], cultureTags: ["warband-infantry"], tags: ["shock-infantry", "two-handed"], traits: ["powerful_build"],
  }),
  cultist: buildOrdinaryHumanoid({
    actorKey: "cultist", name: "Cultist", role: "light-melee-follower", hp: 9, armorClass: 12, staminaMaximum: 20,
    scores: { strength: 11, dexterity: 12, constitution: 10, intelligence: 10, wisdom: 11, charisma: 10 },
    bonuses: { attack: 3, block: 1, evade: 1, damage: 1 }, alignment: "neutral-evil",
    behavior: { aggression: 58, caution: 48, loyalty: 66, mercy: 24, cruelty: 48, honor: 28, discipline: 56 },
    surrenderProfile: { prisonerPreference: "circumstantial", releasePreference: "rare", executionPreference: "circumstantial" },
    weaponProfiles: [scimitar], equippedArmor: cultistArmor,
    armorProfile: { profileKey: cultistArmor.profileKey, armorClass: "leather", category: "light", weightClass: "light", rigidCoverage: false },
    heldItems: { mainHand: scimitar.profileKey, offHand: null },
    grappleProfile: { weaponRetentionBehavior: "retain-one-handed", clinchWeaponAvailability: "none-carried" },
    factionTags: ["cult-cell"], cultureTags: ["secret-society"], tags: ["follower", "light-fighter"], traits: ["fanatical_loyalty"],
  }),
  "goblin-warrior": common({
    actorKey: "goblin-warrior", id: "goblin-warrior", name: "Goblin Warrior", species: "goblin", creatureType: "humanoid", category: "humanoid", size: "small", role: "opportunistic-skirmisher", modelKey: "goblin-warrior", source: "public-actor", sourceLabel: "Public Actor", teamDefault: "enemy",
    factionTags: ["goblin-warband"], cultureTags: ["warband"], tags: ["goblin", "humanoid", "small", "warband"], traitKeys: ["opportunistic", "pack_fighter", "self_preserving"], traits: ["opportunistic", "pack_fighter", "self_preserving"],
    attributes: { might: 8, deftness: 14, vigor: 10, endurance: 10, mobility: 14, intellect: 10, awareness: 8, cunning: 13, resolve: 8, discipline: 8, presence: 8, renown: 0, favor: 0 }, abilityScores: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
    derivedStats: { hp: 7, maxHp: 7, armorClass: 15, movement: 30 }, movement: { ground: 30, groundPace: 30, burst: 60, runDistance: 60, recoveryStep: 5, terrainMobility: { cramped: 1 } }, currentStamina: 20, combatStamina: { authority: "canonical", maximum: 20, current: 20 }, fatigueState: "ready", actionsPerRound: 2,
    alignment: "chaotic-neutral", alignmentName: "Chaotic Neutral", alignmentBehaviorMappingKey: "chaotic-neutral", behaviorProfileKey: "goblin-chaotic-neutral", behavior: { aggression: 48, caution: 70, loyalty: 42, instinct: 65, mercy: 38, cruelty: 34, greed: 68, honor: 28, pride: 38, discipline: 34, prefersFlanking: true, prefersAssistance: true },
    moraleProfile: { state: "steady", routBehavior: "flee-or-bargain", surrenderEligible: true, terminalEscapeBehavior: "map-boundary" }, surrenderProfile: { mayOfferSurrender: true, mayAcceptSurrender: true, behaviorProfile: "chaotic-neutral", prisonerPreference: "ransom-or-confiscate", executionPreference: "circumstantial", alignmentBehaviorMappingKey: "chaotic-neutral" },
    equipment: [goblinSword, goblinDagger, { id: "shield.small", profileKey: "shield.small", name: "Small Shield", type: "shield" }, { id: "armor.goblin-light", profileKey: "armor.goblin-light", name: "Light Armor", type: "armor", category: "light", guardRating: 15 }], inventory: [goblinSword, goblinDagger], equippedArmor: { id: "armor.goblin-light", profileKey: "armor.goblin-light", name: "Light Armor", type: "armor", category: "light", guardRating: 15 }, equippedShield: { id: "shield.small", profileKey: "shield.small", name: "Small Shield", type: "shield" }, armorProfile: { profileKey: "armor.goblin-light", armorClass: "light", category: "light", rigidCoverage: false }, heldItems: { mainHand: "weapon.short-sword", offHand: "shield.small" }, attacks: [goblinSword], weaponProfiles: [goblinSword, goblinDagger],
    grappleProfile: { sizeProfile: "small", preferredInitiator: false, prefersAssist: true, prefersProneTargets: true, sizeRulesApply: true, canUseSwarmTakedown: true, takedownCompatible: true, groundControlCompatible: true, standingArmoredSoloPreference: "disfavored" }, aiRole: "skirmisher",
  }),
  minotaur: common({
    actorKey: "minotaur", id: "minotaur", name: "Minotaur", species: "minotaur", creatureType: "monstrosity", category: "mythic", size: "large", role: "mythic-brute", modelKey: "minotaur", source: "normalized-legacy-actor", sourceLabel: "Normalized Legacy Actor", teamDefault: "enemy",
    factionTags: ["mythic"], cultureTags: ["labyrinth-born"], tags: ["minotaur", "monstrosity", "mythic", "brute", "grappler", "natural armor"], traitKeys: ["horns", "powerful_build", "terrifying_presence"], traits: ["Terrifying Presence", "horns", "powerful_build"],
    attributes: { might: 19, deftness: 11, vigor: 16, endurance: 16, mobility: 11, intellect: 7, awareness: 12, cunning: 10, resolve: 14, discipline: 10, presence: 15, renown: 2, favor: 0 }, abilityScores: { strength: 19, dexterity: 11, constitution: 16, intelligence: 7, wisdom: 12, charisma: 15 }, proficiencyBonuses: { melee: 2, grapple: 2, thrown: 2 },
    derivedStats: { hp: 52, maxHp: 52, armorClass: 14, movement: 40 }, movement: { ground: 40, groundPace: 40, burst: 80, runDistance: 80, recoveryStep: 5, terrainMobility: {} }, currentStamina: 32, combatStamina: { authority: "canonical", maximum: 32, current: 32 }, fatigueState: "ready", actionsPerRound: 2,
    alignment: "true-neutral", alignmentName: "True Neutral", alignmentBehaviorMappingKey: "true-neutral", behaviorProfileKey: "minotaur-true-neutral", behavior: { aggression: 82, caution: 28, loyalty: 45, instinct: 72, mercy: 34, cruelty: 38, greed: 30, honor: 42, pride: 82, discipline: 50 },
    moraleProfile: { state: "steady", routBehavior: "proud-withdrawal", surrenderEligible: true, terminalEscapeBehavior: "map-boundary" }, surrenderProfile: { mayOfferSurrender: true, mayAcceptSurrender: true, behaviorProfile: "true-neutral", prisonerPreference: "circumstantial", executionPreference: "circumstantial", alignmentBehaviorMappingKey: "true-neutral" },
    equipment: [minotaurAxe], inventory: [minotaurAxe], equippedArmor: { id: "armor.minotaur-hide", profileKey: "armor.minotaur-hide", name: "Natural Hide", type: "natural armor", category: "medium natural armor", weightClass: "medium", lootable: false }, armorProfile: { profileKey: "armor.minotaur-hide", armorClass: "natural", category: "medium natural armor", weightClass: "medium", rigidCoverage: false }, heldItems: { mainHand: "weapon.minotaur-heavy-axe", offHand: null }, attacks: [minotaurAxe, minotaurGore, minotaurCharge, minotaurHornHook, minotaurHookAndLift, minotaurBodyClinch, minotaurLift, minotaurSlam, minotaurThrow, minotaurCrush, minotaurHeadbutt, minotaurTrample, minotaurRockThrow, minotaurRockSmash], weaponProfiles: [minotaurAxe, minotaurGore, minotaurCharge, minotaurHornHook, minotaurHookAndLift, minotaurBodyClinch, minotaurLift, minotaurSlam, minotaurThrow, minotaurCrush, minotaurHeadbutt, minotaurTrample, minotaurRockThrow, minotaurRockSmash],
    grappleProfile: { sizeProfile: "large", preferredInitiator: true, prefersAssist: false, prefersProneTargets: true, sizeRulesApply: true, canUseSwarmTakedown: false, powerfulBuild: true, takedownCompatible: true, groundControlCompatible: true, liftRequiresExplicitAction: true, throwRequiresExplicitAction: true }, aiRole: "brute",
  }),
});

const CANONICAL_COMBAT_ACTOR_ALIASES = Object.freeze({
  "town_guard": "guard",
  "town-guard": "guard",
  "man_at_arms": "man-at-arms",
  "veteran_knight": "veteran-knight",
  "selectable-archer": "archer",
  "selectable-longbowman": "longbowman",
  "longbow_man": "longbowman",
});

export function resolveCanonicalCombatActorAlias(value) {
  const candidate = String(value || "").trim().toLowerCase();
  if (!candidate) return { actorKey: null, aliasUsed: false, alias: null };
  if (CANONICAL_COMBAT_ACTORS[candidate]) return { actorKey: candidate, aliasUsed: false, alias: null };
  const actorKey = CANONICAL_COMBAT_ACTOR_ALIASES[candidate] || null;
  return { actorKey, aliasUsed: Boolean(actorKey), alias: actorKey ? candidate : null };
}

export function getCanonicalCombatActorDefinition(actorKey) {
  const resolution = resolveCanonicalCombatActorAlias(actorKey);
  return resolution.actorKey ? CANONICAL_COMBAT_ACTORS[resolution.actorKey] : null;
}

const CANONICAL_WEAPON_ALIASES = Object.freeze({
  "long sword": knightSword,
  longsword: knightSword,
  "short sword": knightShortSword,
  shortsword: knightShortSword,
  "arming sword": armingSword,
  mace,
  "hand axe": handAxe,
  handaxe: handAxe,
  spear: infantrySpear,
  "infantry spear": infantrySpear,
  "guard spear": guardSpear,
  "hunting bow": huntingBow,
  bow: archerBow,
  "bow shot": archerBow,
  longbow,
  "long bow": longbow,
  "longbow shot": longbow,
  crossbow,
  pike,
  halberd,
  knife: archerKnife,
  scimitar,
  greataxe: greatAxe,
  "great axe": greatAxe,
  dagger: knightDagger,
  "thrown dagger": thrownDagger,
  "dagger throw": thrownDagger,
  "ritual dagger": ritualDagger,
});

export const CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES = Object.freeze({
  huntingBow,
  archerBow,
  longbow,
  crossbow,
  pike,
  halberd,
  guardSpear,
  infantrySpear,
  thrownDagger,
});

export function getCanonicalWeaponProfileByAlias(value) {
  const source = value && typeof value === "object" ? value : { name: value };
  const key = String(source.profileKey || source.weaponId || source.id || source.name || "")
    .trim()
    .toLowerCase()
    .replace(/^weapon\./, "")
    .replace(/-/g, " ");
  const canonical = CANONICAL_WEAPON_ALIASES[key] || null;
  if (!canonical) return null;
  return {
    ...canonical,
    ...source,
    id: canonical.id,
    weaponId: canonical.weaponId,
    profileKey: canonical.profileKey,
    name: canonical.name,
    damage: source.damage || canonical.damage,
    damageDice: source.damageDice || source.damage || canonical.damageDice,
    damageType: source.damageType || canonical.damageType,
    deliveryType: canonical.deliveryType,
    kind: canonical.kind,
    attackType: canonical.attackType,
    isMelee: canonical.isMelee,
    isRanged: canonical.isRanged,
    range: canonical.range ?? null,
    reach: canonical.reach ?? null,
    reachFeet: canonical.reachFeet ?? null,
    normalRangeFeet: canonical.normalRangeFeet ?? null,
    longRangeFeet: canonical.longRangeFeet ?? null,
  };
}

export default CANONICAL_COMBAT_ACTORS;

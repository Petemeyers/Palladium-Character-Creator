const NONE_EQUIPMENT_LABELS = new Set([
  "",
  "none",
  "no armor",
  "unarmored",
  "unarmoured",
]);

export const ARENA_CHAMPION_ACTOR_KEY = "arena-champion";
export const ARENA_CHAMPION_DEFAULT_WEAPON_ID = "weapon.arming-sword";

function normalizedText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function actorIdentityText(actor = {}) {
  return [
    actor.actorKey,
    actor.sourceActorKey,
    actor.selectableActorId,
    actor.pickerId,
    actor.id,
    actor.name,
    actor.displayName,
    actor.baseName,
    actor.role,
    actor.modelKey,
    actor.combatActorMigrationAlias,
  ]
    .filter(Boolean)
    .map(normalizedText)
    .join(" ");
}

export function isArenaChampionActor(actor) {
  const identity = actorIdentityText(actor);
  return (
    identity.includes("arena champion") ||
    identity.includes("arena-champion") ||
    identity.includes("arena_champion")
  );
}

export function isNoArmorChoice(value) {
  return NONE_EQUIPMENT_LABELS.has(normalizedText(value));
}

export function createCanonicalArmingSword(weapon = null) {
  const source = weapon && typeof weapon === "object" ? weapon : {};
  const id =
    source.id ||
    source.weaponId ||
    source.profileKey ||
    ARENA_CHAMPION_DEFAULT_WEAPON_ID;
  const damage = source.damage || source.damageDice || "1d8";

  return {
    ...source,
    id,
    weaponId: source.weaponId || id,
    profileKey: source.profileKey || id,
    name: source.name || "Arming Sword",
    displayName: source.displayName || source.name || "Arming Sword",
    type: "weapon",
    kind: "melee",
    attackType: "melee",
    damage,
    damageDice: source.damageDice || damage,
    damageType: source.damageType || "slashing",
    reach: Number.isFinite(Number(source.reach)) ? Number(source.reach) : 5,
    reachFeet: Number.isFinite(Number(source.reachFeet)) ? Number(source.reachFeet) : 5,
    range: 0,
    normalRangeFeet: null,
    longRangeFeet: null,
    isMelee: true,
    isRanged: false,
    isProjectile: false,
    handedness: "one-handed",
    handsRequired: 1,
    category: source.category || "one-handed",
    requiresTwoHands: false,
    twoHanded: false,
    shieldCompatible: true,
    slot: "Right Hand",
  };
}

function clearWornSlots(worn) {
  const knownSlots = [
    "head",
    "neck",
    "torso",
    "chest",
    "arms",
    "hands",
    "waist",
    "legs",
    "feet",
    "underlayer",
    "outer",
    "accessory",
  ];
  const keys = new Set([
    ...knownSlots,
    ...Object.keys(worn && typeof worn === "object" ? worn : {}),
  ]);
  return Object.fromEntries([...keys].map((key) => [key, null]));
}

function removeInheritedArmorFromEquipment(equipment) {
  if (Array.isArray(equipment)) {
    return equipment.filter((item) => {
      const type = normalizedText(item?.type || item?.category || item?.kind);
      return type !== "armor" && type !== "shield" && !type.includes("armor");
    });
  }

  if (!equipment || typeof equipment !== "object") return equipment;

  return {
    ...equipment,
    worn: clearWornSlots(equipment.worn),
    held: {
      ...(equipment.held || {}),
      shield: null,
      offHand: null,
    },
  };
}

export function clearActorArmorAuthority(actor) {
  if (!actor || typeof actor !== "object") return actor;

  const inheritedInventory = Array.isArray(actor.inventory)
    ? actor.inventory.filter((item) => {
        const type = normalizedText(item?.type || item?.category || item?.kind);
        return type !== "armor" && type !== "shield" && !type.includes("armor");
      })
    : actor.inventory;

  return {
    ...actor,
    equipment: removeInheritedArmorFromEquipment(actor.equipment),
    inventory: inheritedInventory,
    equippedArmor: null,
    wornArmor: null,
    armor: null,
    equippedShield: null,
    equistaminadArmor: "Unarmored",
    armorName: "Unarmored",
    armorDisplayName: "Unarmored",
    armorDisplaySource: "explicit-loadout",
    armorProfile: {
      profileKey: "armor.none",
      armorClass: "unarmored",
      category: "none",
      weightClass: "none",
      rigidCoverage: false,
    },
    equistaminad: {
      ...(actor.equistaminad || {}),
      chest: null,
      armor: null,
      shield: null,
    },
    currentarmorDurability: 0,
    armorDurability: 0,
    maxarmorDurability: 0,
    defenseSource: actor.defenseSource || "skill-and-mobility",
  };
}

function weaponIdentity(weapon) {
  return normalizedText(
    weapon?.id || weapon?.weaponId || weapon?.profileKey || weapon?.name,
  );
}

function appendUniqueWeapon(collection, weapon) {
  const values = Array.isArray(collection) ? collection : [];
  const desired = weaponIdentity(weapon);
  return [
    weapon,
    ...values.filter((entry) => {
      const identity = weaponIdentity(entry);
      const name = normalizedText(entry?.name);
      return identity !== desired && name !== "unarmed" && name !== "unarmed attack";
    }),
  ];
}

function appendInventoryWeapon(inventory, weapon) {
  const values = Array.isArray(inventory) ? inventory : [];
  const desired = weaponIdentity(weapon);
  if (values.some((entry) => weaponIdentity(entry) === desired)) return values;
  return [...values, weapon];
}

export function normalizeArenaChampionActor(
  actor,
  {
    primaryWeapon = null,
    unarmored = true,
    source = "arena-champion-authority",
  } = {},
) {
  if (!actor || typeof actor !== "object") return actor;

  const weapon = createCanonicalArmingSword(primaryWeapon);
  const base = unarmored ? clearActorArmorAuthority(actor) : { ...actor };
  const tags = new Set([
    ...(Array.isArray(base.tags) ? base.tags : []),
    "human",
    "humanoid",
    "melee",
    "duelist",
    "arena",
  ]);

  return {
    ...base,
    actorKey: ARENA_CHAMPION_ACTOR_KEY,
    sourceActorKey: ARENA_CHAMPION_ACTOR_KEY,
    combatActorMigrationAlias: ARENA_CHAMPION_ACTOR_KEY,
    canonicalArchetype: ARENA_CHAMPION_ACTOR_KEY,
    role: "duelist",
    aiRole: "melee",
    modelKey: base.modelKey || ARENA_CHAMPION_ACTOR_KEY,
    tags: [...tags],
    loadoutKey: "arena-duelist",
    defaultLoadoutKey: "arena-duelist",
    selectedCanonicalLoadout: [weapon],
    heldItems: {
      ...(base.heldItems || {}),
      mainHand: weapon.id,
      offHand: null,
    },
    equistaminadWeapons: [weapon],
    equistaminadWeapon: weapon.name,
    weapon: weapon.name,
    attacks: appendUniqueWeapon(base.attacks, weapon),
    weaponProfiles: appendUniqueWeapon(base.weaponProfiles, weapon),
    inventory: appendInventoryWeapon(base.inventory, weapon),
    equistaminad: {
      ...(base.equistaminad || {}),
      weaponPrimary: weapon,
      weaponSecondary: null,
      shield: null,
    },
    combatWeaponState: {
      ...(base.combatWeaponState || {}),
      readyWeaponId: weapon.id,
      retainedWeaponId: null,
      clinchWeaponId: null,
      clinchWeaponReady: false,
      lastTransitionReason: source,
    },
    arenaChampionProfile: {
      version: 1,
      archetype: "unarmored-arming-sword-duelist",
      primaryWeaponId: weapon.id,
      offHand: null,
      armor: unarmored ? "unarmored" : "explicit",
      defenseSource: unarmored ? "skill-and-mobility" : "equipment-and-skill",
      normalizedBy: source,
    },
  };
}

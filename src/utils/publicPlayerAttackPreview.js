const hasValue = (value) => value !== undefined && value !== null && value !== "";

const WEAPON_PREVIEW_MAP = {
  longsword: {
    name: "Longsword",
    attackType: "melee",
    abilityOptions: ["str"],
    damageDie: "1d8",
    damageType: "slashing",
    reach: "5 ft",
  },
  shortsword: {
    name: "Shortsword",
    attackType: "melee",
    abilityOptions: ["str", "dex"],
    damageDie: "1d6",
    damageType: "piercing",
    reach: "5 ft",
  },
  dagger: {
    name: "Dagger",
    attackType: "melee/ranged",
    abilityOptions: ["str", "dex"],
    damageDie: "1d4",
    damageType: "piercing",
    reach: "5 ft",
    range: "20/60 ft",
  },
  spear: {
    name: "Spear",
    attackType: "melee/ranged",
    abilityOptions: ["str"],
    damageDie: "1d6",
    damageType: "piercing",
    reach: "5 ft",
    range: "20/60 ft",
  },
  shortbow: {
    name: "Shortbow",
    attackType: "ranged",
    abilityOptions: ["dex"],
    damageDie: "1d6",
    damageType: "piercing",
    range: "80/320 ft",
  },
  longbow: {
    name: "Longbow",
    attackType: "ranged",
    abilityOptions: ["dex"],
    damageDie: "1d8",
    damageType: "piercing",
    range: "150/600 ft",
  },
  club: {
    name: "Club",
    attackType: "melee",
    abilityOptions: ["str"],
    damageDie: "1d4",
    damageType: "bludgeoning",
    reach: "5 ft",
  },
  mace: {
    name: "Mace",
    attackType: "melee",
    abilityOptions: ["str"],
    damageDie: "1d6",
    damageType: "bludgeoning",
    reach: "5 ft",
  },
  quarterstaff: {
    name: "Quarterstaff",
    attackType: "melee",
    abilityOptions: ["str"],
    damageDie: "1d6",
    damageType: "bludgeoning",
    reach: "5 ft",
  },
  handaxe: {
    name: "Handaxe",
    attackType: "melee/ranged",
    abilityOptions: ["str"],
    damageDie: "1d6",
    damageType: "slashing",
    reach: "5 ft",
    range: "20/60 ft",
  },
};

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatBonus = (value) => {
  const number = toNumber(value);
  if (number === null) return undefined;
  return number >= 0 ? `+${number}` : String(number);
};

const getAbilityModifier = (character = {}, ability) => {
  character = character || {};
  const modifiers = character.abilityModifiers || character.publicAbilityModifiers || {};
  if (hasValue(modifiers[ability])) return toNumber(modifiers[ability]);

  const scores = character.finalAbilityScores || character.publicAbilityScores || {};
  const score = toNumber(scores[ability]);
  return score === null ? null : Math.floor((score - 10) / 2);
};

const chooseAbility = (character, abilityOptions = []) => {
  character = character || {};
  let best = null;
  abilityOptions.forEach((ability) => {
    const modifier = getAbilityModifier(character, ability);
    if (modifier === null) return;
    if (!best || modifier > best.modifier) {
      best = { ability, modifier };
    }
  });
  return best;
};

const getProficiencyBonus = (character = {}) => {
  character = character || {};
  const value =
    character.publicDerivedStats?.proficiencyBonus ??
    character.proficiencyBonus ??
    character.autoRollCharacter?.publicDerivedStats?.proficiencyBonus ??
    character.autoRollCharacter?.proficiencyBonus;
  return toNumber(value) ?? 0;
};

const getStartingEquipmentItems = (character = {}) => {
  character = character || {};
  const equipment = character.publicStartingEquipment || character.autoRollCharacter?.publicStartingEquipment;
  const classItems = equipment?.classOption?.items;
  if (Array.isArray(classItems)) return classItems;

  if (Array.isArray(character.publicStartingEquipment)) return character.publicStartingEquipment;
  if (Array.isArray(character.inventory)) return character.inventory;
  if (Array.isArray(character.equistaminadWeapons)) return character.equistaminadWeapons;
  return [];
};

const findWeaponPreview = (item) => {
  const itemName = typeof item === "string" ? item : item?.name || item?.label || item?.type;
  const normalized = normalizeName(itemName);
  if (!normalized) return null;

  return Object.entries(WEAPON_PREVIEW_MAP).find(([key]) => normalized.includes(key))?.[1] || null;
};

const buildWeaponPreview = (character, weapon) => {
  const ability = chooseAbility(character, weapon.abilityOptions);
  const proficiencyBonus = getProficiencyBonus(character);
  const hitBonus = ability ? ability.modifier + proficiencyBonus : null;
  const damageBonus = ability?.modifier ?? null;

  return {
    name: weapon.name,
    attackType: weapon.attackType,
    abilityUsed: ability?.ability?.toUpperCase(),
    hitBonus: formatBonus(hitBonus),
    damageExpression: `${weapon.damageDie}${damageBonus ? formatBonus(damageBonus) : ""}`,
    damage: `${weapon.damageDie}${damageBonus ? formatBonus(damageBonus) : ""}`,
    damageType: weapon.damageType,
    reach: weapon.reach,
    range: weapon.range,
    source: "public-player-preview",
  };
};

const buildUnarmedPreview = (character) => {
  const ability = chooseAbility(character, ["str"]);
  const proficiencyBonus = getProficiencyBonus(character);
  const hitBonus = ability ? ability.modifier + proficiencyBonus : null;
  const damageBonus = ability?.modifier ?? null;

  return {
    name: "Unarmed Strike",
    attackType: "basic",
    abilityUsed: ability?.ability?.toUpperCase(),
    hitBonus: formatBonus(hitBonus),
    damageExpression: `1${damageBonus ? formatBonus(damageBonus) : ""}`,
    damage: `1${damageBonus ? formatBonus(damageBonus) : ""}`,
    damageType: "bludgeoning",
    reach: "5 ft",
    notes: "Attack preview pending: no public weapon metadata found.",
    source: "public-player-preview",
  };
};

export function buildPublicPlayerAttackPreviews(character = {}) {
  character = character || {};
  const source = character?.autoRollCharacter || character || {};
  const equipmentItems = [
    ...getStartingEquipmentItems(character),
    ...getStartingEquipmentItems(source),
  ];

  const previews = [];
  equipmentItems.forEach((item) => {
    const weapon = findWeaponPreview(item);
    if (!weapon) return;
    if (previews.some((preview) => preview.name === weapon.name)) return;
    previews.push(buildWeaponPreview(source, weapon));
  });

  return previews.length > 0 ? previews : [buildUnarmedPreview(source)];
}

export { WEAPON_PREVIEW_MAP as PUBLIC_PLAYER_WEAPON_PREVIEW_MAP };

export default {
  buildPublicPlayerAttackPreviews,
};

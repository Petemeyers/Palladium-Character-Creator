const hasValue = (value) => value !== undefined && value !== null && value !== "";

const cloneObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};

const getAbility = (scores, longName, shortName, fallback = 10) => {
  const value = scores?.[longName] ?? scores?.[shortName];
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeAttack = (attack = {}) => {
  const rangeProfile = cloneObject(attack.rangeProfile);
  const ranged = String(attack.kind || attack.attackType || attack.type || "").toLowerCase() === "ranged";
  const normalRange = Number(rangeProfile.normal ?? attack.range ?? attack.rangeFeet);
  const reach = Number(attack.reach ?? attack.reachFeet ?? 5);
  return {
    name: String(attack.name || "Unnamed attack"),
    kind: ranged ? "ranged" : "melee",
    attackType: ranged ? "ranged" : "melee",
    type: ranged ? "ranged" : "melee",
    category: ranged ? "ranged" : (attack.category || "melee"),
    damage: attack.damage,
    damageType: attack.damageType,
    attackBonus: attack.attackBonus ?? attack.hitBonus,
    count: Number(attack.count) || 1,
    reach: ranged ? null : (Number.isFinite(reach) ? reach : 5),
    reachFeet: ranged ? null : (Number.isFinite(reach) ? reach : 5),
    range: ranged && Number.isFinite(normalRange) ? normalRange : 0,
    rangeFeet: ranged && Number.isFinite(normalRange) ? normalRange : 0,
    rangeProfile,
    ammunition: attack.ammunition,
    isRanged: ranged,
    isMelee: !ranged,
    notes: attack.notes,
  };
};

export function adaptSelectableActorToCombatant(actor = {}, options = {}) {
  const missingFields = [];
  if (!hasValue(actor.id)) missingFields.push("id");
  if (!hasValue(actor.name)) missingFields.push("name");
  if (!hasValue(actor.category)) missingFields.push("category");
  if (!hasValue(actor.source)) missingFields.push("source");
  if (!hasValue(actor.sourceLabel)) missingFields.push("sourceLabel");
  if (!hasValue(actor.teamDefault)) missingFields.push("teamDefault");
  if (typeof actor.playable !== "boolean") missingFields.push("playable");
  if (!hasValue(actor.defaultControlMode)) missingFields.push("defaultControlMode");
  if (!actor.movement || typeof actor.movement !== "object") missingFields.push("movement");
  if (!actor.derivedStats || typeof actor.derivedStats !== "object") missingFields.push("derivedStats");
  if (!Array.isArray(actor.attacks)) missingFields.push("attacks");

  if (missingFields.length > 0) {
    return { ok: false, combatant: null, missingFields };
  }

  const team = String(options.team || actor.teamDefault || "enemy").toLowerCase();
  const controlMode = String(options.controlMode || actor.defaultControlMode || "ai").toLowerCase();
  const runtimeType = team === "party" || team === "player" ? "player" : team === "enemy" ? "enemy" : "npc";
  const sourceId = String(actor.id || "selectable-actor");
  const runtimeId = runtimeType === "enemy"
    ? sourceId.replace(/^(playable|player)-/i, "selectable-")
    : sourceId;
  const movement = cloneObject(actor.movement);
  const groundMovement = Number(movement.ground ?? actor.derivedStats.movement ?? 30);
  const flyingMovement = Number(movement.flying ?? 0);
  const abilityScores = cloneObject(actor.abilityScores);
  const attacks = actor.attacks.map(normalizeAttack);
  const equipment = Array.isArray(actor.equipment) ? actor.equipment.map((item) => ({ ...item })) : [];
  const compatibilityAttributes = cloneObject(actor.compatibilityAttributes);
  const hp = Number(actor.derivedStats.hp ?? actor.derivedStats.hitPoints ?? 1);
  const maxHp = Number(actor.derivedStats.maxHp ?? actor.derivedStats.maxHitPoints ?? hp);
  const armorClass = Number(actor.derivedStats.armorClass ?? actor.derivedStats.guardRating ?? 10);
  const hasFlight = Array.isArray(actor.movementModes) && actor.movementModes.includes("flying") && flyingMovement > 0;

  const combatant = {
    id: runtimeId,
    name: actor.name,
    category: actor.category,
    role: actor.aiRole || "melee",
    species: ["human", "humanoid", "soldier"].includes(String(actor.category).toLowerCase()) ? "human" : actor.category,
    creatureType: actor.category,
    source: actor.source,
    sourceLabel: actor.sourceLabel,
    team,
    side: team,
    battleSide: team,
    type: runtimeType,
    controlMode,
    playable: actor.playable,
    defaultControlMode: actor.defaultControlMode,
    modelKey: actor.modelKey || actor.id,
    size: actor.size || "medium",
    movementModes: Array.isArray(actor.movementModes) ? [...actor.movementModes] : ["ground"],
    movement,
    movementSpeed: Number.isFinite(groundMovement) ? groundMovement : 30,
    speed: Number.isFinite(groundMovement) ? groundMovement : 30,
    abilityScores: {
      str: getAbility(abilityScores, "strength", "str"),
      dex: getAbility(abilityScores, "dexterity", "dex"),
      con: getAbility(abilityScores, "constitution", "con"),
      int: getAbility(abilityScores, "intelligence", "int"),
      wis: getAbility(abilityScores, "wisdom", "wis"),
      cha: getAbility(abilityScores, "charisma", "cha"),
    },
    compatibilityAttributes,
    HP: Number.isFinite(hp) ? hp : 1,
    hp: Number.isFinite(hp) ? hp : 1,
    currentHP: Number.isFinite(hp) ? hp : 1,
    maxHP: Number.isFinite(maxHp) ? maxHp : (Number.isFinite(hp) ? hp : 1),
    guardRating: Number.isFinite(armorClass) ? armorClass : 10,
    armorClass: Number.isFinite(armorClass) ? armorClass : 10,
    derivedStats: { ...actor.derivedStats },
    equipment,
    inventory: equipment.map((item) => ({ ...item })),
    attacks,
    equistaminadWeapons: attacks.map((attack, index) => ({
      ...attack,
      slot: index === 0 ? "Right Hand" : "Left Hand",
    })),
    rangeProfile: cloneObject(actor.rangeProfile),
    aiRole: actor.aiRole || "melee",
    tags: Array.isArray(actor.tags) ? [...actor.tags] : [],
    visual: cloneObject(actor.visual),
    abilities: hasFlight
      ? { movement: { flight: { active: true, feetPerRound: flyingMovement, mphSpeed: flyingMovement / 22 } } }
      : {},
    normalizedSelectableActor: true,
    selectableActorId: actor.id,
  };

  return { ok: true, combatant, missingFields: [] };
}

export function getSelectableActorAttackForDistance(
  combatant = {},
  distance = Infinity,
  fallbackAttack = null,
  { canUseAttack = () => true } = {},
) {
  const isRangedAttack = (attack) => (
    attack?.isRanged === true ||
    String(attack?.kind || attack?.attackType || attack?.type || "").toLowerCase() === "ranged" ||
    Number(attack?.rangeProfile?.normal ?? attack?.range ?? attack?.rangeFeet ?? 0) > 10
  );
  const hasRangedRole = ["ranged", "archer"].includes(String(combatant?.aiRole || "").toLowerCase());
  if (!hasRangedRole && !isRangedAttack(fallbackAttack)) {
    return fallbackAttack;
  }
  const attacks = Array.isArray(combatant.attacks) ? combatant.attacks : [];
  const distanceFeet = Number(distance);
  if (!Number.isFinite(distanceFeet)) return fallbackAttack;

  if (distanceFeet > 5) {
    const rangedAttack = attacks.find((attack) => (
      isRangedAttack(attack) &&
      Number(attack.rangeProfile?.normal ?? attack.range ?? 0) >= distanceFeet &&
      canUseAttack(attack)
    ));
    if (rangedAttack) return rangedAttack;

    if (isRangedAttack(fallbackAttack) && !canUseAttack(fallbackAttack)) {
      return attacks.find((attack) => !isRangedAttack(attack) && canUseAttack(attack)) || fallbackAttack;
    }
    return fallbackAttack;
  }

  return attacks.find((attack) => (
    !isRangedAttack(attack) &&
    Number(attack.reachFeet ?? attack.reach ?? 5) >= distanceFeet &&
    canUseAttack(attack)
  )) || fallbackAttack;
}

export default {
  adaptSelectableActorToCombatant,
  getSelectableActorAttackForDistance,
};

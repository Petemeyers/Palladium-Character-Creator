const hasValue = (value) => value !== undefined && value !== null && value !== "";

function convertPublicEnemyAction(action = {}) {
  const missingFields = [];
  if (!hasValue(action.name)) missingFields.push("action.name");
  if (!hasValue(action.damage)) missingFields.push("action.damage");

  if (missingFields.length > 0) {
    return {
      ok: false,
      missingFields,
      metadata: { ...action },
    };
  }

  return {
    ok: true,
    attack: {
      name: action.name,
      damage: action.damage,
      damageType: action.damageType,
      attackBonus: action.attackBonus,
      count: action.count || 1,
    },
  };
}

export function adaptPublicEnemyToCombatant(enemy = {}) {
  const missingFields = [];
  const warnings = [];

  if (!hasValue(enemy.name)) missingFields.push("name");
  if (!hasValue(enemy.hitPoints)) missingFields.push("hitPoints");
  if (!hasValue(enemy.armorClass)) missingFields.push("armorClass");
  if (!hasValue(enemy.size)) missingFields.push("size");
  if (!hasValue(enemy.creatureType)) missingFields.push("creatureType");
  if (!hasValue(enemy.speed)) missingFields.push("speed");
  if (!Array.isArray(enemy.actions) || enemy.actions.length === 0) {
    missingFields.push("actions");
  }

  const convertedActions = Array.isArray(enemy.actions)
    ? enemy.actions.map(convertPublicEnemyAction)
    : [];
  const attacks = convertedActions
    .filter((result) => result.ok)
    .map((result) => result.attack);

  convertedActions
    .filter((result) => !result.ok)
    .forEach((result, index) => {
      warnings.push(`Action ${index + 1} is metadata-only: missing ${result.missingFields.join(", ")}`);
    });

  if (Array.isArray(enemy.actions) && enemy.actions.length > 0 && attacks.length === 0) {
    missingFields.push("convertible actions");
  }

  if (missingFields.length > 0) {
    return {
      ok: false,
      combatant: null,
      missingFields,
      warnings,
      source: "public-enemy",
    };
  }

  return {
    ok: true,
    combatant: {
      id: enemy.id,
      name: enemy.name,
      HP: enemy.hitPoints,
      guardRating: enemy.armorClass,
      size: enemy.size,
      category: enemy.creatureType,
      creatureType: enemy.creatureType,
      speed: enemy.speed,
      spd: enemy.speed,
      attacks,
      publicEnemyMetadata: {
        abilityScores: enemy.abilityScores ? { ...enemy.abilityScores } : undefined,
        savingThrows: enemy.savingThrows ? { ...enemy.savingThrows } : undefined,
        skills: enemy.skills ? { ...enemy.skills } : undefined,
        senses: Array.isArray(enemy.senses) ? [...enemy.senses] : undefined,
        languages: Array.isArray(enemy.languages) ? [...enemy.languages] : undefined,
        challengeRating: enemy.challengeRating,
        proficiencyBonus: enemy.proficiencyBonus,
        source: enemy.originalSource || enemy.source,
        ruleset: enemy.ruleset,
      },
      source: "public-enemy",
      ruleset: enemy.ruleset || "core-d20",
    },
    missingFields: [],
    warnings,
    source: "public-enemy",
  };
}

export default {
  adaptPublicEnemyToCombatant,
};

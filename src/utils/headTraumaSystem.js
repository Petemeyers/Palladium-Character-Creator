/**
 * Palladium Fantasy RPG - Head Trauma & Insanity System
 *
 * Based on official Palladium rulebook trauma tables:
 * - Head injury from severe impacts
 * - Permanent stat damage
 * - Phobias and insanity
 * - Treatment and recovery options
 *
 * TRIGGER CONDITIONS:
 * - Impact damage ≥ 20 HP to head/neck
 * - Knockback > 30 feet with failed P.E. roll
 * - Character enters coma (0 HP or less)
 */

/**
 * Head Trauma & Insanity Table (D100)
 * Directly from Palladium Fantasy rulebook
 */
export const HEAD_TRAUMA_TABLE = [
  {
    range: [1, 10],
    result: "No permanent damage",
    effect: "Temporary dizziness; –1 to Strike for 1 melee",
    statLoss: null,
    phobiaRoll: false,
    insanityRoll: false,
    description: "Shaken but no lasting injury",
  },
  {
    range: [11, 20],
    result: "Major scarring",
    effect: "–2 P.B. (Physical Beauty); nightmares of the event",
    statLoss: { PB: -2 },
    phobiaRoll: false,
    insanityRoll: false,
    description: "Permanent facial/head scarring",
  },
  {
    range: [21, 39],
    result: "Limp or minor motor damage",
    effect: "–2 SPD or –1 P.P.; mild chronic pain",
    statLoss: { SPD: -2, PP: -1 },
    phobiaRoll: false,
    insanityRoll: false,
    description: "Mobility affected",
  },
  {
    range: [40, 55],
    result: "Joint stiffness / neck injury",
    effect: "–1 to P.P. and P.E.; headaches under stress",
    statLoss: { PP: -1, PE: -1 },
    phobiaRoll: false,
    insanityRoll: false,
    description: "Chronic stiffness and pain",
  },
  {
    range: [56, 70],
    result: "Chronic pain",
    effect: "–1 P.E.; may need rest after every combat",
    statLoss: { PE: -1 },
    phobiaRoll: false,
    insanityRoll: false,
    description: "Persistent pain condition",
  },
  {
    range: [71, 82],
    result: "Mild brain damage",
    effect: "–1 I.Q. permanently; 20% chance of new phobia",
    statLoss: { IQ: -1 },
    phobiaRoll: true,
    phobiaChance: 20,
    insanityRoll: false,
    description: "Cognitive impairment",
  },
  {
    range: [83, 92],
    result: "Minor brain trauma",
    effect: "–1 I.Q., –1 M.E.; must roll on Phobia Subtable",
    statLoss: { IQ: -1, ME: -1 },
    phobiaRoll: true,
    phobiaChance: 100,
    insanityRoll: false,
    description: "Brain damage with phobia",
  },
  {
    range: [93, 100],
    result: "Severe brain injury",
    effect: "–3 I.Q., –1 M.E.; must roll on Random Insanity Table",
    statLoss: { IQ: -3, ME: -1 },
    phobiaRoll: false,
    insanityRoll: true,
    description: "Severe psychological damage",
  },
];

/**
 * Phobia Subtable (D100)
 */
export const PHOBIA_TABLE = [
  {
    range: [1, 10],
    phobia: "Fear of heights",
    mechanicalEffect: "–4 to all actions when >20 ft up",
  },
  {
    range: [11, 20],
    phobia: "Fear of enclosed spaces",
    mechanicalEffect: "–3 to Strike/Parry in small rooms",
  },
  {
    range: [21, 30],
    phobia: "Fear of darkness",
    mechanicalEffect: "–2 to all in dim/dark areas",
  },
  {
    range: [31, 40],
    phobia: "Fear of loud noises",
    mechanicalEffect: "Must save vs M.E. 14+ or cower when thunder/explosions",
  },
  {
    range: [41, 50],
    phobia: "Fear of blood",
    mechanicalEffect: "–2 to Strike when self or ally wounded",
  },
  {
    range: [51, 60],
    phobia: "Fear of magic or spellcasters",
    mechanicalEffect: "–3 to actions near visible magic",
  },
  {
    range: [61, 70],
    phobia: "Fear of specific race",
    mechanicalEffect: "–4 to actions when facing trigger race; may flee",
  },
  {
    range: [71, 80],
    phobia: "Fear of water",
    mechanicalEffect: "Refuses to cross rivers >10 ft deep",
  },
  {
    range: [81, 90],
    phobia: "Fear of flying creatures",
    mechanicalEffect: "–3 to Strike aerial targets",
  },
  {
    range: [91, 100],
    phobia: "Fear of combat",
    mechanicalEffect: "50% chance to panic and flee when melee starts",
  },
];

/**
 * Random Insanity Table (D100) - Severe Cases
 */
export const INSANITY_TABLE = [
  {
    range: [1, 19],
    disorder: "Affective Disorder",
    effect:
      "Violent emotional swings; 50% chance to refuse combat under stress",
    mechanicalEffect: "50% chance refuse combat when stressed",
  },
  {
    range: [20, 50],
    disorder: "Neurosis",
    effect: "Paranoia or compulsive habits (–10% to skills when distracted)",
    mechanicalEffect: "–10% to all skills under pressure",
  },
  {
    range: [51, 75],
    disorder: "Phobia (Extreme)",
    effect: "Panic 50% chance if confronted",
    mechanicalEffect: "Must roll phobia + 50% panic when triggered",
    rollPhobia: true,
  },
  {
    range: [76, 100],
    disorder: "Psychosis",
    effect: "Hallucinations or delusions; may attack allies on 1–5 (D20)",
    mechanicalEffect: "Roll d20 each round - 1-5 attacks random ally",
  },
];

/**
 * Treatment Options Table
 */
export const TREATMENT_OPTIONS = {
  MIND_MAGE_HYPNOSIS: {
    name: "Mind Mage Hypnosis",
    rollTable: [
      {
        range: [1, 25],
        result: "No effect",
        message: "Mind resists treatment",
      },
      {
        range: [26, 55],
        result: "Partial",
        message: "Symptoms reduced 50%, may relapse",
      },
      {
        range: [56, 80],
        result: "Cured",
        message: "Trauma fully healed mentally",
      },
      {
        range: [81, 100],
        result: "Cured but new neurosis",
        message: "Trauma cured but develops new quirk",
      },
    ],
    cost: "500-1000 GP",
    availability: "Major cities only",
  },
  CLERICAL_RESTORATION: {
    name: "Clerical Restoration Spell",
    effect: "Auto removes one trauma effect",
    limitation: "Cannot restore lost I.Q./M.E. unless divine miracle",
    cost: "1000+ GP donation or quest",
    availability: "High-level clergy (8+)",
  },
  HOSPITAL_HEALING: {
    name: "Hospital / Healing Herbs",
    rollTable: [
      {
        range: [1, 25],
        result: "Full recovery",
        message: "Trauma heals completely",
      },
      {
        range: [26, 50],
        result: "Partial recovery",
        message: "Stat loss reduced by 1",
      },
      {
        range: [51, 80],
        result: "No change",
        message: "Condition stabilized only",
      },
      {
        range: [81, 100],
        result: "Death",
        message: "Complications prove fatal",
      },
    ],
    duration: "2d6 weeks",
    cost: "100-500 GP",
    availability: "Most towns",
  },
};

/**
 * Check if head trauma should be rolled
 */
export function shouldRollHeadTrauma(
  character,
  impactDamage,
  knockbackFeet,
  options = {}
) {
  const {
    targetBodyPart = "torso",
    failedPEroll = false,
    inComa = false,
  } = options;

  // Condition 1: 20+ damage to head/neck
  if (
    impactDamage >= 20 &&
    (targetBodyPart === "head" || targetBodyPart === "neck")
  ) {
    return { should: true, reason: "20+ damage to head/neck" };
  }

  // Condition 2: Knockback > 30 ft with P.E. failure
  if (knockbackFeet > 30 && failedPEroll) {
    return {
      should: true,
      reason: "Knocked back >30 ft with failed P.E. roll",
    };
  }

  // Condition 3: Coma (0 HP or less)
  if (inComa || (character.hp !== undefined && character.hp <= 0)) {
    return { should: true, reason: "Character in coma (0 HP or less)" };
  }

  return { should: false, reason: "No severe head trauma" };
}

/**
 * Roll on Head Trauma & Insanity Table
 */
export function rollHeadTrauma() {
  const roll = rollDice(1, 100);

  for (const entry of HEAD_TRAUMA_TABLE) {
    if (roll >= entry.range[0] && roll <= entry.range[1]) {
      return {
        roll: roll,
        result: entry.result,
        effect: entry.effect,
        statLoss: entry.statLoss,
        phobiaRoll: entry.phobiaRoll,
        phobiaChance: entry.phobiaChance,
        insanityRoll: entry.insanityRoll,
        description: entry.description,
      };
    }
  }

  // Fallback
  return HEAD_TRAUMA_TABLE[0];
}

/**
 * Roll on Phobia Subtable
 */
export function rollPhobia() {
  const roll = rollDice(1, 100);

  for (const entry of PHOBIA_TABLE) {
    if (roll >= entry.range[0] && roll <= entry.range[1]) {
      return {
        roll: roll,
        phobia: entry.phobia,
        effect: entry.mechanicalEffect,
      };
    }
  }

  return PHOBIA_TABLE[0];
}

/**
 * Roll on Random Insanity Table
 */
export function rollInsanity() {
  const roll = rollDice(1, 100);

  for (const entry of INSANITY_TABLE) {
    if (roll >= entry.range[0] && roll <= entry.range[1]) {
      const result = {
        roll: roll,
        disorder: entry.disorder,
        effect: entry.effect,
        mechanicalEffect: entry.mechanicalEffect,
        phobia: null,
      };

      // Some insanities also include phobia
      if (entry.rollPhobia) {
        result.phobia = rollPhobia();
      }

      return result;
    }
  }

  return INSANITY_TABLE[0];
}

/**
 * Process complete head trauma check
 */
export function processHeadTrauma(
  character,
  impactDamage,
  knockbackFeet,
  options = {}
) {
  const check = shouldRollHeadTrauma(
    character,
    impactDamage,
    knockbackFeet,
    options
  );

  if (!check.should) {
    return {
      traumaOccurred: false,
      reason: check.reason,
      message: "No head trauma check needed",
    };
  }

  const trauma = rollHeadTrauma();
  const result = {
    traumaOccurred: true,
    trigger: check.reason,
    traumaRoll: trauma.roll,
    result: trauma.result,
    effect: trauma.effect,
    statLosses: trauma.statLoss || {},
    phobia: null,
    insanity: null,
    message: `${character.name} suffers ${trauma.result}! ${trauma.effect}`,
  };

  // Apply stat losses
  if (trauma.statLoss) {
    Object.entries(trauma.statLoss).forEach(([stat, loss]) => {
      if (character[stat] !== undefined) {
        character[stat] += loss; // Loss is negative
      } else if (character[stat.toLowerCase()] !== undefined) {
        character[stat.toLowerCase()] += loss;
      }
    });
  }

  // Roll phobia if needed
  if (trauma.phobiaRoll) {
    const shouldRollPhobia =
      trauma.phobiaChance === 100 || Math.random() * 100 <= trauma.phobiaChance;

    if (shouldRollPhobia) {
      result.phobia = rollPhobia();
      result.message += ` Develops ${result.phobia.phobia}: ${result.phobia.effect}`;

      // Add phobia to character
      if (!character.phobias) character.phobias = [];
      character.phobias.push(result.phobia);
    }
  }

  // Roll insanity if needed
  if (trauma.insanityRoll) {
    result.insanity = rollInsanity();
    result.message += ` Suffers ${result.insanity.disorder}: ${result.insanity.effect}`;

    // Add insanity to character
    if (!character.insanities) character.insanities = [];
    character.insanities.push(result.insanity);

    // If insanity includes phobia, add that too
    if (result.insanity.phobia) {
      if (!character.phobias) character.phobias = [];
      character.phobias.push(result.insanity.phobia);
    }
  }

  return result;
}

/**
 * Attempt treatment for head trauma
 */
export function attemptTreatment(
  character,
  treatmentType = "MIND_MAGE_HYPNOSIS"
) {
  const treatment = TREATMENT_OPTIONS[treatmentType];

  if (!treatment) {
    return { success: false, message: "Unknown treatment type" };
  }

  const result = {
    treatment: treatment.name,
    cost: treatment.cost,
    availability: treatment.availability,
    outcome: null,
    message: "",
  };

  if (treatmentType === "CLERICAL_RESTORATION") {
    // Auto success
    result.outcome = "Cured";
    result.message = `${treatment.effect}. Note: ${treatment.limitation}`;
    return result;
  }

  // Roll on treatment table
  const roll = rollDice(1, 100);

  for (const entry of treatment.rollTable) {
    if (roll >= entry.range[0] && roll <= entry.range[1]) {
      result.roll = roll;
      result.outcome = entry.result;
      result.message = entry.message;

      // Apply treatment effects
      if (entry.result === "Cured") {
        // Remove one trauma (latest)
        if (character.phobias && character.phobias.length > 0) {
          character.phobias.pop();
        } else if (character.insanities && character.insanities.length > 0) {
          character.insanities.pop();
        }
      } else if (entry.result === "Partial") {
        // Reduce effects
        result.message += " (–50% to phobia/insanity penalties)";
      } else if (entry.result === "Cured but new neurosis") {
        // Remove old, add new
        if (character.phobias && character.phobias.length > 0) {
          character.phobias.pop();
        }
        const newNeurosis = rollInsanity();
        if (newNeurosis.roll <= 50) {
          // Neurosis range
          if (!character.insanities) character.insanities = [];
          character.insanities.push(newNeurosis);
          result.message += ` Develops new ${newNeurosis.disorder}`;
        }
      }

      return result;
    }
  }

  return result;
}

/**
 * Get character's active phobias and insanities
 */
export function getActiveTraumas(character) {
  const traumas = {
    phobias: character.phobias || [],
    insanities: character.insanities || [],
    statLosses: {},
    totalPenalties: 0,
  };

  // Calculate stat losses from trauma history
  if (character.traumaHistory) {
    character.traumaHistory.forEach((trauma) => {
      if (trauma.statLosses) {
        Object.entries(trauma.statLosses).forEach(([stat, loss]) => {
          traumas.statLosses[stat] = (traumas.statLosses[stat] || 0) + loss;
        });
      }
    });
  }

  traumas.totalPenalties = traumas.phobias.length + traumas.insanities.length;

  return traumas;
}

/**
 * Check if phobia is triggered
 */
export function checkPhobiaTrigger(character, situation) {
  if (!character.phobias || character.phobias.length === 0) {
    return { triggered: false };
  }

  const triggeredPhobias = character.phobias.filter((phobia) => {
    const p = phobia.phobia.toLowerCase();
    const s = situation.toLowerCase();

    // Match phobia to situation
    if (p.includes("heights") && s.includes("height")) return true;
    if (p.includes("enclosed") && s.includes("enclosed")) return true;
    if (p.includes("darkness") && s.includes("dark")) return true;
    if (p.includes("loud") && s.includes("loud")) return true;
    if (p.includes("blood") && s.includes("blood")) return true;
    if (p.includes("magic") && s.includes("magic")) return true;
    if (p.includes("water") && s.includes("water")) return true;
    if (p.includes("flying") && s.includes("flying")) return true;
    if (p.includes("combat") && s.includes("combat")) return true;

    return false;
  });

  if (triggeredPhobias.length > 0) {
    return {
      triggered: true,
      phobias: triggeredPhobias,
      message: `${character.name}'s ${triggeredPhobias[0].phobia} is triggered!`,
      penalties: triggeredPhobias.map((p) => p.effect),
    };
  }

  return { triggered: false };
}

/**
 * Check for psychosis attack-ally roll
 */
export function checkPsychosisAttack(character) {
  if (!character.insanities) return { attacks: false };

  const psychosis = character.insanities.find(
    (i) => i.disorder === "Psychosis"
  );

  if (!psychosis) return { attacks: false };

  const roll = rollDice(1, 20);

  if (roll <= 5) {
    return {
      attacks: true,
      roll: roll,
      message: `${character.name} suffers psychotic episode and attacks ally! (rolled ${roll} ≤ 5)`,
    };
  }

  return { attacks: false, roll: roll };
}

/**
 * Dice roller helper
 */
function rollDice(count, sides) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

/**
 * Get head trauma description for combat log
 */
export function getHeadTraumaDescription(character, trauma) {
  let description = `⚠️ HEAD TRAUMA: ${character.name} `;
  description += `(rolled ${trauma.traumaRoll}): ${trauma.result}. `;
  description += trauma.effect;

  if (trauma.phobia) {
    description += ` | PHOBIA: ${trauma.phobia.phobia} - ${trauma.phobia.effect}`;
  }

  if (trauma.insanity) {
    description += ` | INSANITY: ${trauma.insanity.disorder} - ${trauma.insanity.effect}`;
  }

  return description;
}

export default {
  HEAD_TRAUMA_TABLE,
  PHOBIA_TABLE,
  INSANITY_TABLE,
  TREATMENT_OPTIONS,
  shouldRollHeadTrauma,
  rollHeadTrauma,
  rollPhobia,
  rollInsanity,
  processHeadTrauma,
  attemptTreatment,
  getActiveTraumas,
  checkPhobiaTrigger,
  checkPsychosisAttack,
  getHeadTraumaDescription,
};

import assert from "node:assert/strict";
import {
  analyzeClosingDistance,
  evaluateWeaponBonuses,
  getOptimalWeaponRecommendation,
  getWeaponBonusAISizeContext,
  makeWeaponBonusAIDecision,
  rankWeaponsByBonuses,
} from "../src/utils/weaponBonusAI.js";

const NORMAL_WEAPON = {
  name: "Arming Sword",
  damage: "1d8",
  type: "weapon",
  category: "melee",
  reach: 3,
  bonuses: { attack: 1, block: 1, damage: 1 },
};

const DAGGER = {
  name: "Dagger",
  damage: "1d4",
  type: "weapon",
  category: "melee",
  reach: 1,
};

const PIKE = {
  name: "Pike",
  damage: "2d6",
  type: "weapon",
  category: "two-handed",
  reach: 8,
};

const MEDIUM_ATTACKER = {
  name: "Arena Guard",
  species: "Human",
  race: "Human",
  size: "Medium",
  equistaminadWeapons: [NORMAL_WEAPON],
};

const MEDIUM_DEFENDER = {
  name: "Arena Duelist",
  species: "Human",
  race: "Human",
  size: "Medium",
};

function assertBaseEvaluationShape(evaluation) {
  assert.deepEqual(Object.keys(evaluation), [
    "totalBonus",
    "attackBonus",
    "blockBonus",
    "damageBonus",
    "reachBonus",
    "closeRangeBonus",
    "firstAttackBonus",
    "twoHandedBonus",
    "weaponSizeBonus",
    "sizeCategoryBonus",
    "weaponSpecificBonus",
    "bonuses",
    "penalties",
    "score",
    "reasoning",
  ]);
}

function testHumanMediumNormalWeapon() {
  const evaluation = evaluateWeaponBonuses(
    NORMAL_WEAPON,
    MEDIUM_ATTACKER,
    MEDIUM_DEFENDER,
    null,
    { combatDistance: 5, hasClosedDistance: true }
  );

  assertBaseEvaluationShape(evaluation);
  assert.equal(evaluation.attackBonus, 1);
  assert.equal(evaluation.blockBonus, 1);
  assert.equal(evaluation.damageBonus, 1);
  assert.equal(evaluation.weaponSpecificBonus, 1);
  assert.equal(evaluation.weaponSizeBonus, 0);
  assert.equal(evaluation.sizeCategoryBonus, 0);
  assert.equal(evaluation.totalBonus, 4.5);
  assert.equal(evaluation.score, 4.5);
  assert.deepEqual(evaluation.bonuses, [
    "Weapon-specific attack bonus: +1",
    "Weapon-specific block bonus: +1",
    "Weapon-specific damage bonus: +1",
  ]);
  assert.deepEqual(evaluation.penalties, []);
}

function testSpeciesRaceSafety() {
  assert.doesNotThrow(() =>
    evaluateWeaponBonuses(NORMAL_WEAPON, { species: "human", race: "human" }, MEDIUM_DEFENDER)
  );
  assert.doesNotThrow(() =>
    evaluateWeaponBonuses(NORMAL_WEAPON, { species: "unknown", race: "unknown" }, MEDIUM_DEFENDER)
  );

  assert.equal(
    evaluateWeaponBonuses(NORMAL_WEAPON, { species: "human", race: "human" }, MEDIUM_DEFENDER).score,
    4.5
  );
  assert.equal(
    evaluateWeaponBonuses(NORMAL_WEAPON, { species: "unknown", race: "unknown" }, MEDIUM_DEFENDER).score,
    4.5
  );
}

function testWeaponBonusAISizeContextMetadata() {
  assert.deepEqual(getWeaponBonusAISizeContext({ size: "Small" }), {
    creatureSize: "Small",
    sizeRank: 2,
    legacySizeContext: {
      creatureSize: "Small",
      sizeRank: 2,
      isLegacyBridge: true,
    },
  });
  assert.deepEqual(getWeaponBonusAISizeContext({ sizeCategory: "Large" }), {
    creatureSize: "Large",
    sizeRank: 4,
    legacySizeContext: {
      creatureSize: "Large",
      sizeRank: 4,
      isLegacyBridge: true,
    },
  });
  assert.equal(getWeaponBonusAISizeContext({ creatureSize: "Tiny" }).creatureSize, "Tiny");
  assert.equal(getWeaponBonusAISizeContext({ species: "human" }).creatureSize, "Medium");
  assert.equal(
    getWeaponBonusAISizeContext({ species: "unknown", race: "unknown" }).creatureSize,
    "Medium"
  );
}

function testLegacyWeaponSizeScoring() {
  const heavyEvaluation = evaluateWeaponBonuses(
    DAGGER,
    { species: "Heavy Fighter", race: "Heavy Fighter", size: "Medium" },
    MEDIUM_DEFENDER,
    null,
    { combatDistance: 5 }
  );

  assert.equal(heavyEvaluation.weaponSizeBonus, 1);
  assert.equal(heavyEvaluation.damageBonus, 1);
  assert.equal(heavyEvaluation.totalBonus, 3.5);
  assert.equal(heavyEvaluation.score, 3.5);
  assert.deepEqual(heavyEvaluation.bonuses, ["Heavy weapon: +1 die damage"]);
  assert.equal(
    heavyEvaluation.reasoning,
    "Weapon has 1 bonus: Heavy weapon: +1 die damage"
  );

  const scoutEvaluation = evaluateWeaponBonuses(
    DAGGER,
    { species: "Scout", race: "Scout", size: "Small" },
    MEDIUM_DEFENDER,
    null,
    { combatDistance: 5 }
  );
  assert.equal(scoutEvaluation.weaponSizeBonus, 0);
  assert.equal(scoutEvaluation.damageBonus, 0);
}

function testWeaponSizePolicyGate() {
  const defaultPolicy = evaluateWeaponBonuses(
    DAGGER,
    { species: "Heavy Fighter", race: "Heavy Fighter", size: "Medium" },
    MEDIUM_DEFENDER,
    null,
    { combatDistance: 5 }
  );
  const legacyPolicy = evaluateWeaponBonuses(
    DAGGER,
    {
      species: "Heavy Fighter",
      race: "Heavy Fighter",
      size: "Medium",
      sizePolicy: "legacy-compatible",
    },
    MEDIUM_DEFENDER,
    null,
    { combatDistance: 5 }
  );
  const unknownPolicy = evaluateWeaponBonuses(
    DAGGER,
    {
      species: "Heavy Fighter",
      race: "Heavy Fighter",
      size: "Medium",
      sizePolicy: "unknown-policy",
    },
    MEDIUM_DEFENDER,
    null,
    { combatDistance: 5 }
  );
  const neutralPolicy = evaluateWeaponBonuses(
    DAGGER,
    {
      species: "Heavy Fighter",
      race: "Heavy Fighter",
      size: "Medium",
      sizePolicy: "neutral-size",
    },
    MEDIUM_DEFENDER,
    null,
    { combatDistance: 5 }
  );

  assertBaseEvaluationShape(defaultPolicy);
  assertBaseEvaluationShape(legacyPolicy);
  assertBaseEvaluationShape(unknownPolicy);
  assertBaseEvaluationShape(neutralPolicy);

  assert.equal(defaultPolicy.weaponSizeBonus, 1);
  assert.equal(defaultPolicy.damageBonus, 1);
  assert.equal(defaultPolicy.score, 3.5);
  assert.equal(legacyPolicy.weaponSizeBonus, 1);
  assert.equal(legacyPolicy.damageBonus, 1);
  assert.equal(legacyPolicy.score, 3.5);
  assert.equal(unknownPolicy.weaponSizeBonus, 1);
  assert.equal(unknownPolicy.damageBonus, 1);
  assert.equal(unknownPolicy.score, 3.5);

  assert.equal(neutralPolicy.weaponSizeBonus, 0);
  assert.equal(neutralPolicy.damageBonus, 0);
  assert.equal(neutralPolicy.score, 0);
  assert.deepEqual(neutralPolicy.bonuses, []);
  assert.equal(neutralPolicy.reasoning, "No significant bonuses or penalties");
}

function testLargeAndHeavyWeaponScoring() {
  const closePikeEvaluation = evaluateWeaponBonuses(
    PIKE,
    { species: "Human", race: "Human", size: "Medium" },
    MEDIUM_DEFENDER,
    null,
    { combatDistance: 2, hasClosedDistance: true }
  );

  assert.equal(closePikeEvaluation.attackBonus, -3);
  assert.equal(closePikeEvaluation.totalBonus, -6);
  assert.equal(closePikeEvaluation.score, -6.5);
  assert.deepEqual(closePikeEvaluation.penalties, [
    "Close range: -3 attack (long weapon ineffective)",
  ]);

  const largeAttackerEvaluation = evaluateWeaponBonuses(
    DAGGER,
    { species: "Human", race: "Human", size: "Large" },
    MEDIUM_DEFENDER,
    null,
    { combatDistance: 5 }
  );
  assert.equal(largeAttackerEvaluation.sizeCategoryBonus, 1);
  assert.equal(largeAttackerEvaluation.attackBonus, 1);
  assert.equal(largeAttackerEvaluation.totalBonus, 3);
  assert.equal(largeAttackerEvaluation.score, 3);
}

function testMissingAndMalformedWeaponDefaults() {
  assert.deepEqual(evaluateWeaponBonuses(null, MEDIUM_ATTACKER, MEDIUM_DEFENDER), {
    totalBonus: 0,
    attackBonus: 0,
    blockBonus: 0,
    damageBonus: 0,
    reachBonus: 0,
    closeRangeBonus: 0,
    firstAttackBonus: 0,
    twoHandedBonus: 0,
    weaponSizeBonus: 0,
    sizeCategoryBonus: 0,
    weaponSpecificBonus: 0,
    bonuses: [],
    penalties: [],
    score: 0,
    reasoning: "No weapon or attacker",
  });

  assert.deepEqual(evaluateWeaponBonuses({}, null, MEDIUM_DEFENDER), {
    totalBonus: 0,
    attackBonus: 0,
    blockBonus: 0,
    damageBonus: 0,
    reachBonus: 0,
    closeRangeBonus: 0,
    firstAttackBonus: 0,
    twoHandedBonus: 0,
    weaponSizeBonus: 0,
    sizeCategoryBonus: 0,
    weaponSpecificBonus: 0,
    bonuses: [],
    penalties: [],
    score: 0,
    reasoning: "No weapon or attacker",
  });
}

function testRankingAndRecommendationShape() {
  const ranked = rankWeaponsByBonuses(
    [DAGGER, NORMAL_WEAPON, PIKE],
    MEDIUM_ATTACKER,
    MEDIUM_DEFENDER,
    { combatDistance: 5 }
  );

  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].weapon, NORMAL_WEAPON);
  assert.equal(ranked[0].score, 4.5);
  assert.equal(ranked[0].totalBonus, 4.5);
  assert.equal(ranked[0].attackBonus, 1);
  assert.equal(ranked[0].damageBonus, 1);

  assert.deepEqual(rankWeaponsByBonuses([], MEDIUM_ATTACKER, MEDIUM_DEFENDER), []);
  assert.deepEqual(rankWeaponsByBonuses(null, MEDIUM_ATTACKER, MEDIUM_DEFENDER), []);

  const recommendation = getOptimalWeaponRecommendation(
    [DAGGER, NORMAL_WEAPON],
    MEDIUM_ATTACKER,
    MEDIUM_DEFENDER,
    { combatDistance: 5 }
  );

  assert.equal(recommendation.weapon, NORMAL_WEAPON);
  assert.equal(recommendation.action, "attack");
  assert.equal(recommendation.score, 4.5);
  assert.equal(recommendation.rankedWeapons.length, 2);

  assert.deepEqual(getOptimalWeaponRecommendation([], MEDIUM_ATTACKER, MEDIUM_DEFENDER), {
    weapon: null,
    action: "defend",
    reasoning: "No weapons available",
    score: 0,
  });
}

function testClosingDistanceAnalysis() {
  const analysis = analyzeClosingDistance(
    MEDIUM_ATTACKER,
    { ...MEDIUM_DEFENDER, equistaminadWeapons: [PIKE] },
    DAGGER,
    { combatDistance: 5, hasClosedDistance: false }
  );

  assert.equal(analysis.shouldClose, true);
  assert.equal(analysis.benefit, 4);
  assert.equal(analysis.reason, "Closing would neutralize defender's long weapon advantage");
  assert.deepEqual(analysis.bonuses, [
    "Close range: +2 attack (short weapon excels)",
    "Neutralize defender's reach advantage",
  ]);
  assert.deepEqual(analysis.penalties, []);

  assert.deepEqual(analyzeClosingDistance(MEDIUM_ATTACKER, MEDIUM_DEFENDER, null), {
    shouldClose: false,
    benefit: 0,
    reason: "",
    bonuses: [],
    penalties: [],
  });
}

function testAiDecisionShape() {
  const decision = makeWeaponBonusAIDecision(
    {
      ...MEDIUM_ATTACKER,
      equistaminadWeapons: [NORMAL_WEAPON],
      inventory: [DAGGER],
    },
    [MEDIUM_DEFENDER],
    { combatDistance: 5 }
  );

  assert.equal(decision.weapon, NORMAL_WEAPON);
  assert.equal(decision.action, "attack");
  assert.equal(decision.target, MEDIUM_DEFENDER);
  assert.equal(decision.score, 4.5);
  assert.equal(decision.evaluation.score, 4.5);

  assert.deepEqual(makeWeaponBonusAIDecision(null, [MEDIUM_DEFENDER]), {
    weapon: null,
    action: "defend",
    target: null,
    reasoning: "No character or targets",
  });

  const unarmedDecision = makeWeaponBonusAIDecision(
    { name: "Unarmed Fighter", equistaminadWeapons: [], inventory: [] },
    [MEDIUM_DEFENDER]
  );
  assert.deepEqual(unarmedDecision, {
    weapon: { name: "Unarmed", damage: "1d3", type: "unarmed" },
    action: "attack",
    target: MEDIUM_DEFENDER,
    reasoning: "No weapons available, using unarmed",
  });
}

function run() {
  testHumanMediumNormalWeapon();
  testSpeciesRaceSafety();
  testWeaponBonusAISizeContextMetadata();
  testLegacyWeaponSizeScoring();
  testWeaponSizePolicyGate();
  testLargeAndHeavyWeaponScoring();
  testMissingAndMalformedWeaponDefaults();
  testRankingAndRecommendationShape();
  testClosingDistanceAnalysis();
  testAiDecisionShape();

  console.log("weapon bonus AI baseline tests passed");
}

run();

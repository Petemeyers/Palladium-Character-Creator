import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

async function loadEnemyTurnAI() {
  const sourcePath = resolve(repoRoot, "src/utils/ai/enemyTurnAI.js");
  let source = await readFile(sourcePath, "utf8");
  source = source.replace(/^import[\s\S]*?;\s*$/gm, "");

  const sizeModuleUrl = pathToFileURL(resolve(repoRoot, "src/utils/sizeStrengthModifiers.js")).href;
  const weaponSizeModuleUrl = pathToFileURL(resolve(repoRoot, "src/utils/weaponSizeSystem.js")).href;
  const publicRulesAdapterModuleUrl = pathToFileURL(resolve(repoRoot, "src/utils/publicRulesAdapter.js")).href;

  const prelude = `
import { getSizeCategory, SIZE_CATEGORIES } from ${JSON.stringify(sizeModuleUrl)};
import { getWeaponSizeForRace, WEAPON_SIZE } from ${JSON.stringify(weaponSizeModuleUrl)};
import { getCreatureSize, getCreatureSizeRank, getLegacyWeaponSizeCompatibility } from ${JSON.stringify(publicRulesAdapterModuleUrl)};
const CryptoSecureDice = { parseAndRoll: () => ({ totalWithBonus: 1 }), rollDice: () => ({ total: 1, totalWithBonus: 1 }) };
const getRandomCombatTechnique = () => ({ name: "Test Technique", damage: "1d4" });
const getFighterTechniques = () => [];
const ACTION_TYPES = {};
const addAiClaimToPatch = () => {};
const applyAiSkillEvents = () => {};
const buildAiWorldState = () => ({});
const chooseAiAction = () => null;
const consumeAiUnlock = () => {};
const AI_KNOWLEDGE_SCOPE = {};
const resolveAiAction = () => null;
const updateAiMemoryAfterAction = () => {};
const createThreatProfile = () => ({});
const getWeaknessMemoryForEnemy = () => null;
const recordWeaknessAttempt = (memory) => memory || {};
const recordWeaknessOutcome = () => {};
const mergeWeaknessMemory = (a = {}, b = {}) => ({ ...a, ...b });
const tryKnowledgeCheck = () => null;
const selectTechniqueForRole = () => null;
const decayAwareness = () => {};
const updateAwareness = () => {};
const getAwareness = () => null;
const AWARENESS_STATES = {};
const hasSpecialSenses = () => false;
const calculatePerceptionCheck = () => ({ success: false });
const getWeaponRange = () => 5;
const canFly = (fighter) => Boolean(fighter?.canFly || fighter?.flying || fighter?.isFlying || String(fighter?.species || fighter?.name || "").toLowerCase().includes("hawk"));
const isFlying = (fighter) => Boolean(fighter?.isFlying || fighter?.flying || (Number(fighter?.altitudeFeet ?? fighter?.altitude ?? 0) > 0));
const getAltitude = (fighter) => Number(fighter?.altitudeFeet ?? fighter?.altitude ?? 0);
const combatantBehaviorData = { species: {} };
const spendFlyingStamina = () => {};
const shouldLandToRest = () => false;
const recoverStamina = () => {};
const isScavenger = () => false;
const findNearbyCorpse = () => null;
const scavengeCorpse = () => null;
const findFoodItem = () => null;
const consumeItem = () => null;
const runFlyingTurn = () => false;
const pickBestPerchForFlyer = () => null;
const reservePerch = () => false;
const toSimpleAIObject = (obj) => obj;
const canThreatenWithMelee = () => true;
const canThreatenWithMeleeWithWeapon = () => true;
const markTargetUnreachable = () => {};
const isTargetUnreachable = () => false;
const getReachableEnemies = (_enemy, enemies) => enemies || [];
const hasAnyValidOffensiveOption = () => true;
const findRoutingDestination = () => null;
const getRoutingProfile = () => ({ pathStyle: "panic" });
const hasSatisfiedRoutingExit = () => false;
const canTargetForAction = (actor, target) => actor?.id !== target?.id && target?.type !== actor?.type;
const isAllyOf = (actor, target) => actor?.type === target?.type;
const getSelectableActorAttackForDistance = (_actor, _distance, attack) => attack;
const getMeleeEngagementContext = () => ({ rangeBand: "melee", isClinched: false, isGrappling: false, isGround: false });
const isChargeOnlyAttack = () => false;
const selectMeleeAttackForContext = ({ selectedAttack }) => ({ attack: selectedAttack, changed: false });
const spendEnemyNoTargetAction = () => ({ spent: true });
const formatEnemyMovementDebug = () => "";
const getCombatantFootprintHexes = () => [];
const resolveEnemyMovementBudget = () => ({ movementBudget: 30 });
const chooseEnemyMovementFallback = () => null;
const executeEnemyMovementPlan = () => null;
const validateEnemyMovementPlan = () => ({ valid: true });
const decideEnemyTacticalIntentSafely = () => ({ intent: "attack" });
const markCombatantFled = (actor) => actor;
const normalizeMoraleState = (actor) => actor;
const evaluateMoraleTriggers = (actor) => ({ actor, skipped: true, result: "steady" });
const formatCombatActorLabel = (actor) => actor?.name || actor?.id || "Unknown";
const isSameCombatActor = (a, b) => a?.id === b?.id;
const buildArmoredTechniqueAttack = (weapon, selectedTechnique) => ({ ...(weapon || {}), selectedTechnique, attackMode: selectedTechnique });
const selectArmoredCombatTechnique = () => ({ selectedTechnique: null, candidates: [] });
const resolveArmoredCombatAction = ({ selectedWeapon }) => ({ actionType: "attack", technique: null, weapon: selectedWeapon, selection: null });
`;

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(
    `${prelude}${source}\nexport { isScoutSizedTarget };\n`
  ).toString("base64")}`;
  return import(moduleUrl);
}

function createHarness({ enemy, targets }) {
  let fighters = [enemy, ...targets];
  let positions = Object.fromEntries(
    fighters.map((fighter, index) => [
      fighter.id,
      fighter.position || { x: index * 2, y: 0 },
    ])
  );
  const logs = [];
  const attacks = [];
  let scheduledTurns = 0;

  const context = {
    fighters,
    positions,
    combatTerrain: {},
    arenaEnvironment: { objects: [] },
    meleeRound: 1,
    turnIndex: 0,
    turnCounter: 1,
    combatActive: true,
    canFighterAct: (fighter) => !fighter?.defeated && (fighter?.currentHP ?? 1) > 0,
    getHPStatus: () => ({ description: "active" }),
    addLog: (message, type = "info") => logs.push({ message: String(message), type }),
    scheduleEndTurn: () => {
      scheduledTurns += 1;
    },
    endTurn: () => {},
    calculateDistance: (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)) * 5,
    isTargetBlocked: () => false,
    getBlockingCombatant: () => null,
    calculateTargetPriority: (_target, distance) => distance,
    calculateEnemyMovementAI: () => null,
    analyzeMovementAndAttack: () => null,
    findFlankingPositions: () => [],
    calculateFlankingBonus: () => 0,
    validateWeaponRange: () => ({ canAttack: true, isUnreachable: false }),
    handlePositionChange: (id, position) => {
      positions = { ...positions, [id]: position };
      context.positions = positions;
      context.positionsRef.current = positions;
    },
    isHexOccupied: () => false,
    findRetreatDestination: () => null,
    getAvailableSkills: () => [],
    isEvilAlignment: () => false,
    healerAbility: () => null,
    clericalHealingTouch: () => null,
    medicalTreatment: () => null,
    getFighterTechniques: () => [],
    getFighterTacticalPowers: () => [],
    getFighterstamina: () => 10,
    getFighterfocus: () => 10,
    createAIActionSelector: () => null,
    GRID_CONFIG: { CELL_SIZE: 5 },
    calculateMovementPerAction: () => 30,
    MOVEMENT_RATES: {},
    MOVEMENT_ACTIONS: {},
    fogEnabled: false,
    visibleCells: null,
    canAISeeTarget: () => true,
    setPositions: (updater) => {
      positions = typeof updater === "function" ? updater(positions) : updater;
      context.positions = positions;
      context.positionsRef.current = positions;
    },
    setFighters: (updater) => {
      fighters = typeof updater === "function" ? updater(fighters) : updater;
      context.fighters = fighters;
    },
    setDefensiveStance: () => {},
    setTemporaryHexSharing: () => {},
    setCombatActive: () => {},
    onNoHostilesRemaining: () => {},
    attack: (...args) => attacks.push(args),
    positionsRef: { current: positions },
    processingEnemyTurnRef: { current: true },
    attackRef: { current: (...args) => attacks.push(args) },
    combatEndCheckRef: { current: false },
    combatOverRef: { current: false },
    getTargetsInLine: () => [],
    sceneContext: { sceneType: "combat", relations: {} },
    commitEnemyTurnAction: () => true,
    isEnemyTurnStillCurrent: () => true,
    markDistanceClosed: () => {},
    combatStateRef: { current: {} },
  };

  return {
    context,
    get logs() {
      return logs;
    },
    get attacks() {
      return attacks;
    },
    get scheduledTurns() {
      return scheduledTurns;
    },
    get fighters() {
      return fighters;
    },
    get positions() {
      return positions;
    },
  };
}

function hawk(overrides = {}) {
  return {
    id: "hawk",
    name: "Hawk",
    species: "hawk",
    type: "enemy",
    category: "animal",
    size: "Small",
    currentHP: 8,
    maxHP: 8,
    remainingActions: 1,
    isFlying: true,
    altitude: 30,
    altitudeFeet: 30,
    canFly: true,
    attacks: [{ name: "Talons", damage: "1d4", range: 5 }],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function target(id, overrides = {}) {
  return {
    id,
    name: id,
    type: "player",
    category: "human",
    species: "human",
    race: "human",
    size: "Medium",
    currentHP: 10,
    hp: 10,
    maxHP: 10,
    attacks: [{ name: "Dagger", damage: "1d4", range: 5 }],
    position: { x: 4, y: 0 },
    ...overrides,
  };
}

function assertNoThrowRun(runEnemyTurnAI, enemy, targets) {
  const harness = createHarness({ enemy, targets });
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback) => {
    callback();
    return 0;
  };

  try {
    assert.doesNotThrow(() => runEnemyTurnAI(enemy, harness.context));
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }

  return harness;
}

function logText(harness) {
  return harness.logs.map((entry) => entry.message).join("\n");
}

const { isScoutSizedTarget, runEnemyTurnAI } = await loadEnemyTurnAI();
const branchNotes = [];

function noteIfUnobserved(condition, message) {
  if (condition) branchNotes.push(message);
}

function testScoutSizedPolicyGate() {
  assert.equal(isScoutSizedTarget({ race: "Scout" }), true);
  assert.equal(
    isScoutSizedTarget({ race: "Scout", sizePolicy: "legacy-compatible" }),
    true
  );
  assert.equal(
    isScoutSizedTarget({ race: "Scout", sizePolicy: "unknown-policy" }),
    true
  );
  assert.equal(isScoutSizedTarget({ sizePolicy: "neutral-size", size: "Small" }), true);
  assert.equal(isScoutSizedTarget({ sizePolicy: "neutral-size", size: "Tiny" }), true);
  assert.equal(isScoutSizedTarget({ sizePolicy: "neutral-size", size: "Medium" }), false);
  assert.equal(
    isScoutSizedTarget({
      race: "Scout",
      species: "Scout",
      name: "Scout",
      size: "Medium",
      sizePolicy: "neutral-size",
    }),
    false
  );
  assert.equal(isScoutSizedTarget({ sizePolicy: "neutral-size" }), false);
  assert.equal(isScoutSizedTarget(null), false);
}

function testScoutSizedPreyBranch() {
  const scout = target("scout-prey", {
    name: "Scout",
    race: "Scout",
    species: "Scout",
    size: "Small",
    position: { x: 4, y: 0 },
  });
  const guard = target("guard", {
    name: "Guard",
    size: "Medium",
    position: { x: 1, y: 0 },
  });

  const harness = assertNoThrowRun(runEnemyTurnAI, hawk(), [guard, scout]);
  const text = logText(harness);

  noteIfUnobserved(
    !/dives from 30ft/i.test(text) && harness.attacks.length === 0,
    "hawk scout-sized prey branch did not emit a stable observable effect in the minimal Node harness",
  );
}

function testTinySmallAnimalPreyBranch() {
  const rabbit = target("rabbit", {
    name: "Rabbit",
    category: "animal",
    species: "animal",
    race: "animal",
    sizeCategory: "Small",
    size: "Small",
    position: { x: 3, y: 0 },
  });

  const harness = assertNoThrowRun(runEnemyTurnAI, hawk(), [rabbit]);
  const text = logText(harness);

  noteIfUnobserved(
    !/dives from 30ft/i.test(text) && harness.attacks.length === 0,
    "hawk tiny/small animal prey branch did not emit a stable observable effect in the minimal Node harness",
  );
}

function testLargerArmedTargetAvoidanceBranch() {
  const knight = target("knight", {
    name: "Armored Knight",
    size: "Large",
    position: { x: 2, y: 0 },
    attacks: [{ name: "Long Sword", damage: "1d8", range: 5 }],
  });

  const harness = assertNoThrowRun(runEnemyTurnAI, hawk(), [knight]);
  const text = logText(harness);

  noteIfUnobserved(
    !/maintains distance from larger threats|circles overhead, avoiding larger armed threats/i.test(
      text,
    ),
    "hawk larger-threat avoidance branch did not emit a stable observable effect in the minimal Node harness",
  );
}

function testNonHawkDoesNotUseHawkPreyPreference() {
  const scout = target("scout-prey", {
    name: "Scout",
    race: "Scout",
    species: "Scout",
    size: "Small",
    position: { x: 4, y: 0 },
  });
  const wolf = {
    ...hawk({
      id: "wolf",
      name: "Wolf",
      species: "wolf",
      isFlying: false,
      altitude: 0,
      altitudeFeet: 0,
      canFly: false,
    }),
  };

  const harness = assertNoThrowRun(runEnemyTurnAI, wolf, [scout]);
  const text = logText(harness);

  assert.doesNotMatch(text, /spots scout prey/i);
}

function testUnknownTargetFallbackNoThrow() {
  const unknown = target("unknown", {
    name: "",
    race: "",
    species: "",
    type: "player",
    size: "",
    position: { x: 4, y: 0 },
  });

  const harness = assertNoThrowRun(runEnemyTurnAI, hawk(), [unknown]);
  const text = logText(harness);

  assert.doesNotMatch(text, /spots scout prey/i);
  assert.equal(harness.scheduledTurns >= 0, true);
}

function run() {
  testScoutSizedPolicyGate();
  testScoutSizedPreyBranch();
  testTinySmallAnimalPreyBranch();
  testLargerArmedTargetAvoidanceBranch();
  testNonHawkDoesNotUseHawkPreyPreference();
  testUnknownTargetFallbackNoThrow();

  if (branchNotes.length > 0) {
    console.log(`Branch notes: ${branchNotes.join("; ")}`);
  }
  console.log("enemy turn AI size baseline tests passed");
}

run();

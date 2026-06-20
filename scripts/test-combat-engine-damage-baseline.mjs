import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

async function loadCombatEngine() {
  const sourcePath = resolve(repoRoot, "src/utils/combatEngine.js");
  let source = await readFile(sourcePath, "utf8");

  source = source.replace(/^import[\s\S]*?;\s*$/gm, "");
  source = source.replace(
    /^export\s+\{[^;]+from\s+["'][^"']+["'];\s*$/gm,
    "",
  );

  const weaponSizeModuleUrl = pathToFileURL(
    resolve(repoRoot, "src/utils/weaponSizeSystem.js"),
  ).href;

  const prelude = `
import { getAdjustedWeaponDamage } from ${JSON.stringify(weaponSizeModuleUrl)};
const CryptoSecureDice = {
  parseAndRoll(formula) {
    const match = String(formula).trim().match(/^(\\d+)d(\\d+)(?:\\+(\\d+))?$/);
    if (!match) throw new Error("Invalid deterministic test formula");
    const count = Number(match[1]);
    const sides = Number(match[2]);
    const bonus = match[3] ? Number(match[3]) : 0;
    return { total: count * sides, totalWithBonus: count * sides + bonus };
  },
  rollDice(count, sides) {
    return { total: Number(count) * Number(sides) };
  },
  rollD20() {
    return 10;
  },
};
const getCombatBonus = (attacker, bonusName) => attacker?.combatBonuses?.[bonusName] || 0;
const calculateDistance = () => 0;
const drainStamina = () => ({});
const getFatigueStatus = () => ({});
const applyFatiguePenalties = (_fighter, penalties = {}) => penalties;
const initializeCombatFatigue = () => ({});
const STAMINA_COSTS = {};
const initializeGrappleState = () => ({});
const attemptGrapple = () => ({ success: false });
const maintainGrapple = () => ({});
const breakFree = () => ({});
const groundAttack = () => ({});
const GRAPPLE_STATES = {};
const loadCombatant = (combatant) => combatant;
const loadCombatants = (combatants) => combatants;
const validateArenaRoster = () => ({ valid: true });
const parseAbilities = () => ({});
const applyBioRegeneration = () => {};
const mapPROFESSIONSkillsToCombat = () => ({});
const getAttacksPerMelee = () => 2;
const getUnifiedAbilities = () => ({});
const checkDamageResistance = () => ({ resisted: false });
const applyStatusEffect = () => {};
const updateStatusEffects = () => {};
const getStatusPenalties = () => ({});
const canCharacterAct = () => true;
const attemptFearRecovery = () => false;
const STATUS_EFFECTS = {};
const triggerHorrorFactor = () => {};
const resetHorrorChecks = () => {};
const hasHorrorFactor = () => false;
const processCourageAuras = () => {};
const clearCourageBonuses = () => {};
const createProtectionCircle = () => ({});
const processProtectionCircles = () => {};
const isProtectionCircle = () => false;
const updateProtectionCirclesOnMap = () => {};
const checkCircleEntryExit = () => {};
const checkMovementBlockedByCircle = () => false;
const resolveHitLocation = () => ({ location: "torso" });
const getHitLocationDescription = () => "";
const calculateArmorDamage = () => ({ damageToArmor: 0, damageToCharacter: 0 });
const attackConnectsVsTarget = () => ({ hit: true });
const getSizeScale = () => 1;
const applySizeCombatModifiers = () => ({});
const getStatusCombatPenalties = () => ({});
const autoCastFearProtection = () => false;
const castCourage = () => ({});
const castRemoveFear = () => ({});
`;

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(
    prelude + source,
  ).toString("base64")}`;
  return import(moduleUrl);
}

const { CombatEngine, createCombatEngine } = await loadCombatEngine();

const LONGSWORD = {
  name: "Long Sword",
  damage: "1d8",
};

const ENCHANTED_LONGSWORD = {
  name: "Long Sword",
  damage: "1d8+2",
};

const PIKE = {
  name: "Pike",
  damage: "2d6",
};

function createEngine() {
  return new CombatEngine({ logCallback: () => {} });
}

function testExports() {
  assert.equal(typeof CombatEngine, "function");
  assert.equal(typeof createCombatEngine, "function");
  assert.equal(createCombatEngine({ logCallback: () => {} }) instanceof CombatEngine, true);
}

function testHumanMediumNormalWeaponDamage() {
  const engine = createEngine();
  assert.equal(
    engine.calculateDamage({ species: "Human", race: "Human" }, LONGSWORD),
    8,
  );
}

function testSpeciesRaceSafety() {
  const engine = createEngine();

  assert.doesNotThrow(() =>
    engine.calculateDamage({ species: "human", race: "human" }, LONGSWORD),
  );
  assert.doesNotThrow(() =>
    engine.calculateDamage({ species: "unknown", race: "unknown" }, LONGSWORD),
  );
  assert.equal(
    engine.calculateDamage({ species: "human", race: "human" }, LONGSWORD),
    8,
  );
  assert.equal(
    engine.calculateDamage({ species: "unknown", race: "unknown" }, LONGSWORD),
    8,
  );
}

function testLegacyHeavyWeaponDamageBaseline() {
  const engine = createEngine();

  assert.equal(engine.calculateDamage({ species: "Heavy Fighter" }, LONGSWORD), 16);
  assert.equal(
    engine.calculateDamage({ race: "Heavy Fighter" }, ENCHANTED_LONGSWORD),
    18,
  );
  assert.equal(engine.calculateDamage({ race: "Heavy Fighter" }, PIKE), 18);
}

function testScoutWeaponDamageBaseline() {
  const engine = createEngine();

  assert.equal(engine.calculateDamage({ species: "Scout" }, LONGSWORD), 8);
  assert.equal(engine.calculateDamage({ race: "Scout" }, PIKE), 12);
}

function testDamageBonusAndMinimumShape() {
  const engine = createEngine();

  assert.equal(
    engine.calculateDamage({ species: "Human", bonuses: { damage: 2 } }, LONGSWORD),
    10,
  );
  assert.equal(engine.calculateDamage({ species: "Human" }, { damage: "not dice" }), 1);
}

function testMissingMalformedWeaponFallbacks() {
  const engine = createEngine();

  assert.equal(engine.calculateDamage({ attributes: { PS: 10 } }, null), 5);
  assert.equal(engine.calculateDamage({ PS: 15 }, {}), 6);
  assert.equal(engine.rollDamageDice("1d8"), 8);
  assert.equal(engine.rollDamageDice("2d6+3"), 15);
  assert.equal(engine.rollDamageDice("bad damage"), 1);
}

function run() {
  testExports();
  testHumanMediumNormalWeaponDamage();
  testSpeciesRaceSafety();
  testLegacyHeavyWeaponDamageBaseline();
  testScoutWeaponDamageBaseline();
  testDamageBonusAndMinimumShape();
  testMissingMalformedWeaponFallbacks();

  console.log("combat engine damage baseline tests passed");
  console.log(
    "Branch notes: critical hit, attack-roll, hit-margin, miss-margin, projectile, and full attack event shapes are not exercised because calculateDamage is the smallest exported weapon damage surface.",
  );
}

run();

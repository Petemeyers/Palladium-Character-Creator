import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

async function loadEncumbranceModule() {
  const encumbrancePath = resolve(repoRoot, "src/utils/encumbrance.js");
  const movementPath = resolve(repoRoot, "src/data/movement.json");
  const [source, movementJson] = await Promise.all([
    readFile(encumbrancePath, "utf8"),
    readFile(movementPath, "utf8"),
  ]);
  const movementData = JSON.parse(movementJson);
  const transformedSource = source
    .replace(
      'import movementData from "../data/movement.json";',
      `import { getAdjustedWeaponWeight as __legacyGetAdjustedWeaponWeight } from ${JSON.stringify(pathToFileURL(resolve(repoRoot, "src/utils/weaponSizeSystem.js")).href)};\nconst movementData = ${JSON.stringify(movementData)};`
    )
    .replace(
      /import\s+\{\s*getNeutralWeaponWeight,\s*getCreatureSize,\s*getLegacyWeaponSizeCompatibility,\s*\}\s+from\s+"\.\/publicRulesAdapter\.js";/,
      `import { getNeutralWeaponWeight, getCreatureSize, getLegacyWeaponSizeCompatibility } from ${JSON.stringify(pathToFileURL(resolve(repoRoot, "src/utils/publicRulesAdapter.js")).href)};`
    )
    .replace(
      "const { getAdjustedWeaponWeight } = require('./weaponSizeSystem.js');",
      "const getAdjustedWeaponWeight = __legacyGetAdjustedWeaponWeight;"
    );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transformedSource).toString("base64")}`;
  return import(moduleUrl);
}

const {
  calculateEncumbrance,
  calculateMaxCarry,
  formatEncumbranceDisplay,
  getArmorPenalty,
  getEncumbranceColor,
  getEncumbranceInfo,
  getEncumbrancePenalty,
} = await loadEncumbranceModule();

function testMediumHumanEquipment() {
  const character = {
    species: "Human",
    attributes: { PS: 12 },
    inventory: [
      { name: "Longsword", type: "weapon", damage: "1d8", weight: 4 },
      { name: "Shield", type: "shield", weight: 6 },
      { name: "Rations", type: "gear", weight: 2 },
    ],
  };

  assert.equal(calculateEncumbrance(character.inventory, character), 12);
  assert.equal(calculateMaxCarry(12, "Human"), 72);

  const info = getEncumbranceInfo(character);
  assert.equal(info.currentWeight, 12);
  assert.equal(info.maxWeight, 72);
  assert.equal(info.ratio, 12 / 72);
  assert.deepEqual(info.penalty, {
    initiative: 0,
    speed: 0,
    skill: 0,
    attack: 0,
    evade: 0,
    description: "Light load",
  });
  assert.deepEqual(info.armorPenalty, {
    spdPenalty: 0,
    skillPenalty: 0,
    fatigueRate: 1,
  });
  assert.equal(info.color, "green");
  assert.equal(info.isOverloaded, false);
  assert.equal(info.totalSpeedPenalty, 0);
  assert.equal(info.totalSkillPenalty, 0);
  assert.equal(info.creatureSize, "Medium");
  assert.equal(info.sizeRank, 3);
  assert.equal(formatEncumbranceDisplay(character), "12/72 lbs");
}

function testSpeciesAndRaceDoNotThrow() {
  const inventory = [{ name: "Dagger", type: "weapon", damage: "1d4", weight: 1 }];

  assert.doesNotThrow(() =>
    calculateEncumbrance(inventory, { species: "human", race: "human" })
  );
  assert.doesNotThrow(() =>
    calculateEncumbrance(inventory, { species: "unknown", race: "unknown" })
  );
}

function testNoEquipmentSafeDefaults() {
  assert.equal(calculateEncumbrance(undefined), 0);
  assert.equal(calculateEncumbrance(null), 0);
  assert.equal(calculateEncumbrance([], { species: "Human" }), 0);

  const info = getEncumbranceInfo({
    species: "Human",
    attributes: { PS: 10 },
    inventory: [],
  });

  assert.equal(info.currentWeight, 0);
  assert.equal(info.maxWeight, 60);
  assert.equal(info.ratio, 0);
  assert.equal(info.color, "green");
  assert.equal(info.isOverloaded, false);
  assert.equal(formatEncumbranceDisplay({ species: "Human", attributes: { PS: 10 }, inventory: [] }), "0/60 lbs");
}

function testMultipleItemsStableTotalWeight() {
  const character = {
    species: "Human",
    attributes: { PS: 10 },
    inventory: [
      { name: "Sword", type: "weapon", damage: "1d8", weight: 4 },
      { name: "Axe", type: "weapon", damage: "1d6", weight: 5 },
      { name: "Backpack", type: "gear", weight: 2.5 },
      { name: "Coins", weight: 0.5 },
    ],
  };

  assert.equal(calculateEncumbrance(character.inventory, character), 12);
}

function testLegacyWeaponSizeTriggerKeepsCurrentResult() {
  const heavyLegacyCharacter = {
    species: "Heavy Fighter",
    race: "Heavy Fighter",
    attributes: { PS: 10 },
  };
  const scoutLegacyCharacter = {
    species: "Scout",
    race: "Scout",
    attributes: { PS: 10 },
  };
  const inventory = [{ name: "Legacy Sword", type: "weapon", damage: "1d8", weight: 4 }];

  assert.equal(calculateEncumbrance(inventory, heavyLegacyCharacter), 10);
  assert.equal(calculateEncumbrance(inventory, scoutLegacyCharacter), 10);
}

function testWeaponWeightPolicyGate() {
  const inventory = [{ name: "Legacy Sword", type: "weapon", damage: "1d8", weight: 4 }];
  const defaultPolicy = {
    species: "Heavy Fighter",
    race: "Heavy Fighter",
    attributes: { PS: 10 },
    inventory,
  };
  const legacyPolicy = {
    ...defaultPolicy,
    sizePolicy: "legacy-compatible",
  };
  const unknownPolicy = {
    ...defaultPolicy,
    sizePolicy: "unknown-policy",
  };
  const neutralPolicy = {
    ...defaultPolicy,
    sizePolicy: "neutral-size",
  };

  assert.equal(calculateEncumbrance(inventory, defaultPolicy), 10);
  assert.equal(calculateEncumbrance(inventory, legacyPolicy), 10);
  assert.equal(calculateEncumbrance(inventory, unknownPolicy), 10);
  assert.equal(calculateEncumbrance(inventory, neutralPolicy), 4);

  const info = getEncumbranceInfo(neutralPolicy);
  assert.equal(info.currentWeight, 4);
  assert.equal(info.creatureSize, "Medium");
  assert.equal(info.sizeRank, 3);
}

function testPenaltyAndColorThresholds() {
  assert.deepEqual(getEncumbrancePenalty(40, 100), {
    initiative: 0,
    speed: 0,
    skill: 0,
    attack: 0,
    evade: 0,
    description: "Light load",
  });
  assert.deepEqual(getEncumbrancePenalty(70, 100), {
    initiative: 0,
    speed: -10,
    skill: -5,
    attack: -1,
    evade: -1,
    description: "Medium load",
  });
  assert.deepEqual(getEncumbrancePenalty(100, 100), {
    initiative: 0,
    speed: -30,
    skill: -10,
    attack: -2,
    evade: -2,
    description: "Heavy load",
  });
  assert.deepEqual(getEncumbrancePenalty(101, 100), {
    initiative: -4,
    speed: -50,
    skill: -20,
    attack: -3,
    evade: -3,
    description: "Overloaded",
  });

  assert.equal(getEncumbranceColor(0.5), "green");
  assert.equal(getEncumbranceColor(0.75), "yellow");
  assert.equal(getEncumbranceColor(1), "orange");
  assert.equal(getEncumbranceColor(1.01), "red");
}

function testArmorPenaltyShape() {
  assert.deepEqual(getArmorPenalty({}), {
    spdPenalty: 0,
    skillPenalty: 0,
    fatigueRate: 1,
  });

  const character = {
    equistaminadArmor: "Chain Armor",
    inventory: [{ name: "Chain Armor", type: "armor", weight: 40 }],
  };

  assert.deepEqual(getArmorPenalty(character), {
    spdPenalty: -20,
    skillPenalty: -10,
    fatigueRate: 2,
    description: "Heavy armor penalties",
  });
}

function testMalformedEquipmentAlreadyTolerated() {
  const inventory = [
    {},
    { name: "Nameless Weight", weight: 3 },
    { name: "Weightless Weapon", type: "weapon", damage: "1d4" },
    { name: "Null Weight", type: "gear", weight: null },
  ];

  assert.doesNotThrow(() => calculateEncumbrance(inventory, { species: "Human" }));
  assert.equal(calculateEncumbrance(inventory, { species: "Human" }), 3);
}

function testSizeAdapterInputsDoNotChangeTotals() {
  const inventory = [{ name: "Training Sword", type: "weapon", damage: "1d6", weight: 4 }];

  const smallCharacter = { size: "Small", attributes: { PS: 10 }, inventory };
  const largeCharacter = { sizeCategory: "Large", attributes: { PS: 10 }, inventory };
  const tinyCharacter = { creatureSize: "Tiny", attributes: { PS: 10 }, inventory };
  const humanCharacter = { species: "human", attributes: { PS: 10 }, inventory };

  assert.doesNotThrow(() => getEncumbranceInfo(smallCharacter));
  assert.doesNotThrow(() => getEncumbranceInfo(largeCharacter));
  assert.doesNotThrow(() => getEncumbranceInfo(tinyCharacter));
  assert.doesNotThrow(() => getEncumbranceInfo(humanCharacter));

  assert.equal(getEncumbranceInfo(smallCharacter).currentWeight, 4);
  assert.equal(getEncumbranceInfo(largeCharacter).currentWeight, 4);
  assert.equal(getEncumbranceInfo(tinyCharacter).currentWeight, 4);
  assert.equal(getEncumbranceInfo(humanCharacter).currentWeight, 4);

  assert.equal(getEncumbranceInfo(smallCharacter).creatureSize, "Small");
  assert.equal(getEncumbranceInfo(largeCharacter).creatureSize, "Large");
  assert.equal(getEncumbranceInfo(tinyCharacter).creatureSize, "Tiny");
  assert.equal(getEncumbranceInfo(humanCharacter).creatureSize, "Medium");
}

function run() {
  testMediumHumanEquipment();
  testSpeciesAndRaceDoNotThrow();
  testNoEquipmentSafeDefaults();
  testMultipleItemsStableTotalWeight();
  testLegacyWeaponSizeTriggerKeepsCurrentResult();
  testWeaponWeightPolicyGate();
  testPenaltyAndColorThresholds();
  testArmorPenaltyShape();
  testMalformedEquipmentAlreadyTolerated();
  testSizeAdapterInputsDoNotChangeTotals();

  console.log("encumbrance baseline tests passed");
}

run();

import assert from "node:assert/strict";
import {
  PPE_AUTHORITIES,
  PPE_PROGRESSION_MODELS,
  computePPEForEntity,
  inferPPEType,
  migrateEntityPPEState,
} from "../src/utils/spellUtils.js";

function testOverridePrecedence() {
  const type = inferPPEType({
    id: "wiz-1",
    occ: "Wizard",
    class: "Wizard",
    type: "player",
    level: 3,
  });
  assert.equal(type, "ARCANE_STANDARD");
}

function testProgressionModels() {
  const staticCaster = computePPEForEntity(
    {
      id: "hedge-1",
      type: "player",
      occ: "Hedge Mage",
      level: 4,
      PE: 10,
    },
    { rollMissingLevelGains: true }
  );
  assert.equal(
    staticCaster.ppeProgressionModel,
    PPE_PROGRESSION_MODELS.STATIC_PER_LEVEL
  );
  assert.equal(staticCaster.ppeLevelGainsTotal, 6);

  const flatCaster = computePPEForEntity(
    {
      id: "cantrip-1",
      type: "player",
      occ: "Cantrip Adept",
      level: 7,
    },
    { rollMissingLevelGains: true }
  );
  assert.equal(
    flatCaster.ppeProgressionModel,
    PPE_PROGRESSION_MODELS.FLAT_POOL
  );
  assert.equal(flatCaster.ppeLevelGainsTotal, 0);
}

function testExplicitAuthorityDefault() {
  const importedNpc = computePPEForEntity({
    id: "npc-1",
    type: "enemy",
    occ: "Wizard",
    level: 6,
    maxPPE: 91,
    currentPPE: 55,
  });
  assert.equal(importedNpc.ppeAuthority, PPE_AUTHORITIES.STATBLOCK);
  assert.equal(importedNpc.maxPPE, 91);
  assert.equal(importedNpc.currentPPE, 55);
}

function testDeterministicRollPersistence() {
  const migratedOnce = migrateEntityPPEState({
    id: "player-1",
    type: "player",
    occ: "Wizard",
    level: 5,
  });
  const migratedTwice = migrateEntityPPEState({
    id: "player-1",
    type: "player",
    occ: "Wizard",
    level: 5,
  });
  assert.deepEqual(
    migratedOnce.ppeLevelGainRolls,
    migratedTwice.ppeLevelGainRolls
  );

  const grown = computePPEForEntity(
    {
      id: "player-2",
      type: "player",
      occ: "Wizard",
      level: 4,
      ppeBase: 30,
      ppeLevelGainRolls: [3],
    },
    { rollMissingLevelGains: true }
  );
  assert.equal(grown.ppeLevelGainRolls.length, 3);
  assert.equal(grown.ppeLevelGainRolls[0], 3);
}

function run() {
  testOverridePrecedence();
  testProgressionModels();
  testExplicitAuthorityDefault();
  testDeterministicRollPersistence();
  console.log("PPE tests passed.");
}

run();

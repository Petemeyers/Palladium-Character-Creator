import assert from "node:assert/strict";
import {
  stamina_AUTHORITIES,
  stamina_PRHEAVY_FIGHTERSSION_MODELS,
  computestaminaForEntity,
  inferstaminaType,
  migrateEntitystaminaState,
} from "../src/utils/techniqueUtils.js";

function testOverridePrecedence() {
  const type = inferstaminaType({
    id: "wiz-1",
    profession: "Duelist",
    class: "Duelist",
    type: "player",
    level: 3,
  });
  assert.equal(type, "ARCANE_STANDARD");
}

function testProgressionModels() {
  const staticCaster = computestaminaForEntity(
    {
      id: "hedge-1",
      type: "player",
      profession: "Footman",
      level: 4,
      PE: 10,
    },
    { rollMissingLevelGains: true }
  );
  assert.equal(
    staticCaster.staminaProgressionModel,
    stamina_PRHEAVY_FIGHTERSSION_MODELS.STATIC_PER_LEVEL
  );
  assert.equal(staticCaster.staminaLevelGainsTotal, 6);

  const flatCaster = computestaminaForEntity(
    {
      id: "cantrip-1",
      type: "player",
      profession: "Squire",
      level: 7,
    },
    { rollMissingLevelGains: true }
  );
  assert.equal(
    flatCaster.staminaProgressionModel,
    stamina_PRHEAVY_FIGHTERSSION_MODELS.FLAT_POOL
  );
  assert.equal(flatCaster.staminaLevelGainsTotal, 0);
}

function testExplicitAuthorityDefault() {
  const importedNpc = computestaminaForEntity({
    id: "npc-1",
    type: "enemy",
    profession: "Duelist",
    level: 6,
    maxstamina: 91,
    currentstamina: 55,
  });
  assert.equal(importedNpc.staminaAuthority, stamina_AUTHORITIES.STATBLOCK);
  assert.equal(importedNpc.maxstamina, 91);
  assert.equal(importedNpc.currentstamina, 55);
}

function testDeterministicRollPersistence() {
  const migratedOnce = migrateEntitystaminaState({
    id: "player-1",
    type: "player",
    profession: "Duelist",
    level: 5,
  });
  const migratedTwice = migrateEntitystaminaState({
    id: "player-1",
    type: "player",
    profession: "Duelist",
    level: 5,
  });
  assert.deepEqual(
    migratedOnce.staminaLevelGainRolls,
    migratedTwice.staminaLevelGainRolls
  );

  const grown = computestaminaForEntity(
    {
      id: "player-2",
      type: "player",
      profession: "Duelist",
      level: 4,
      staminaBase: 30,
      staminaLevelGainRolls: [3],
    },
    { rollMissingLevelGains: true }
  );
  assert.equal(grown.staminaLevelGainRolls.length, 3);
  assert.equal(grown.staminaLevelGainRolls[0], 3);
}

function run() {
  testOverridePrecedence();
  testProgressionModels();
  testExplicitAuthorityDefault();
  testDeterministicRollPersistence();
  console.log("stamina tests passed.");
}

run();

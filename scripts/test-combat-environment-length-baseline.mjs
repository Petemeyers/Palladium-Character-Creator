import assert from "node:assert/strict";
import {
  canUseWeapon,
  getCombatEnvironmentSizeContext,
  getCombatModifiers,
  getWeaponLength,
  getWeaponType,
} from "../src/utils/combatEnvironmentLogic.js";

const DAGGER = { name: "Dagger" };
const LONGSWORD = { name: "Long Sword", length: 3 };
const SPEAR = { name: "Spear", length: 6 };
const PIKE = { name: "Pike" };
const LONGBOW = { name: "Longbow", range: 150 };

function testExports() {
  assert.equal(typeof getWeaponType, "function");
  assert.equal(typeof getWeaponLength, "function");
  assert.equal(typeof getCombatModifiers, "function");
  assert.equal(typeof canUseWeapon, "function");
  assert.equal(typeof getCombatEnvironmentSizeContext, "function");
}

function testCombatEnvironmentSizeContextMetadata() {
  assert.deepEqual(getCombatEnvironmentSizeContext({ size: "Small" }), {
    creatureSize: "Small",
    sizeRank: 2,
    legacySizeContext: {
      creatureSize: "Small",
      sizeRank: 2,
      isLegacyBridge: true,
    },
  });
  assert.deepEqual(getCombatEnvironmentSizeContext({ sizeCategory: "Large" }), {
    creatureSize: "Large",
    sizeRank: 4,
    legacySizeContext: {
      creatureSize: "Large",
      sizeRank: 4,
      isLegacyBridge: true,
    },
  });
  assert.equal(
    getCombatEnvironmentSizeContext({ creatureSize: "Tiny" }).creatureSize,
    "Tiny",
  );
  assert.equal(
    getCombatEnvironmentSizeContext({ species: "human" }).creatureSize,
    "Medium",
  );
  assert.equal(
    getCombatEnvironmentSizeContext({
      species: "unknown",
      race: "unknown",
    }).creatureSize,
    "Medium",
  );
}

function testHumanMediumNormalWeaponLength() {
  assert.equal(getWeaponLength(LONGSWORD, { species: "Human", race: "Human" }), 3);
  assert.equal(getWeaponLength(SPEAR, { species: "human", race: "human" }), 6);
}

function testSpeciesRaceSafety() {
  assert.doesNotThrow(() =>
    getWeaponLength(SPEAR, { species: "human", race: "human" }),
  );
  assert.doesNotThrow(() =>
    getWeaponLength(SPEAR, { species: "unknown", race: "unknown" }),
  );
  assert.equal(getWeaponLength(SPEAR, { species: "unknown", race: "unknown" }), 6);
}

function testLegacySizeInputsPreserveCurrentLength() {
  assert.equal(getWeaponLength(SPEAR, { species: "Heavy Fighter" }), 6);
  assert.equal(getWeaponLength(SPEAR, { race: "Heavy Fighter" }), 6);
  assert.equal(getWeaponLength(SPEAR, { species: "Scout" }), 6);
  assert.equal(getWeaponLength(SPEAR, { race: "Scout" }), 6);
}

function testLengthPolicyGatePreservesCurrentLength() {
  const defaultPolicy = { species: "Heavy Fighter", race: "Heavy Fighter" };
  const legacyPolicy = {
    species: "Heavy Fighter",
    race: "Heavy Fighter",
    sizePolicy: "legacy-compatible",
  };
  const unknownPolicy = {
    species: "Heavy Fighter",
    race: "Heavy Fighter",
    sizePolicy: "unknown-policy",
  };
  const neutralPolicy = {
    species: "Heavy Fighter",
    race: "Heavy Fighter",
    sizePolicy: "neutral-size",
  };

  assert.equal(getWeaponLength(SPEAR, defaultPolicy), 6);
  assert.equal(getWeaponLength(SPEAR, legacyPolicy), 6);
  assert.equal(getWeaponLength(SPEAR, unknownPolicy), 6);
  assert.equal(getWeaponLength(SPEAR, neutralPolicy), 6);

  assert.equal(getWeaponLength({ name: "Custom Pole", length: 9 }, neutralPolicy), 9);
  assert.equal(getWeaponLength({ name: "Short Blade", reach: 1 }, neutralPolicy), 1);
  assert.equal(getWeaponLength(DAGGER, neutralPolicy), 2);
  assert.equal(getWeaponLength(PIKE, neutralPolicy), 6);
  assert.equal(getWeaponLength(LONGBOW, neutralPolicy), 150);
  assert.equal(getWeaponLength(null, neutralPolicy), 3);
}

function testExplicitAndFallbackWeaponLength() {
  assert.equal(getWeaponLength({ name: "Custom Pole", length: 9 }), 9);
  assert.equal(getWeaponLength({ name: "Short Blade", reach: 1 }), 1);
  assert.equal(getWeaponLength(DAGGER), 2);
  assert.equal(getWeaponLength(PIKE), 6);
  assert.equal(getWeaponLength(LONGBOW), 150);
  assert.equal(getWeaponLength(null), 3);
  assert.equal(getWeaponLength({}), 2);
}

function testWeaponTypeBaseline() {
  assert.equal(getWeaponType(null), "MEDIUM");
  assert.equal(getWeaponType(DAGGER), "SHORT");
  assert.equal(getWeaponType(PIKE), "LONG");
  assert.equal(getWeaponType({ name: "Warhammer" }), "HEAVY");
  assert.equal(getWeaponType(LONGBOW), "RANGED");
  assert.equal(getWeaponType({ name: "Plain Tool" }), "SHORT");
}

function testReachEnvironmentOutputShapes() {
  assert.deepEqual(canUseWeapon(PIKE, "CAVE_INTERIOR"), {
    canUse: true,
    reason: "Weapon usable in current terrain",
  });
  assert.deepEqual(canUseWeapon(LONGBOW, "CAVE_INTERIOR"), {
    canUse: true,
    reason: "Ranged weapon usable in current terrain",
  });

  const mods = getCombatModifiers(PIKE, { id: "attacker" }, { id: "defender" }, "CAVE_INTERIOR");
  assert.equal(typeof mods.attack, "number");
  assert.equal(typeof mods.evade, "number");
  assert.equal(typeof mods.block, "number");
  assert.equal(typeof mods.damage, "number");
  assert.equal(Array.isArray(mods.notes), true);
}

function run() {
  testExports();
  testCombatEnvironmentSizeContextMetadata();
  testHumanMediumNormalWeaponLength();
  testSpeciesRaceSafety();
  testLegacySizeInputsPreserveCurrentLength();
  testLengthPolicyGatePreservesCurrentLength();
  testExplicitAndFallbackWeaponLength();
  testWeaponTypeBaseline();
  testReachEnvironmentOutputShapes();

  console.log("combat environment weapon length baseline tests passed");
  console.log(
    "Branch notes: direct getWeaponLength coverage preserves current exported behavior; broader attack spacing and map movement branches are not exercised.",
  );
}

run();

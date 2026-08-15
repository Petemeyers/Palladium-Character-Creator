import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PHASE2E_BRACED_COUNTER_FIXTURE,
  applyExplicitDeploymentPositions,
  assertFixtureLiveState,
  expectedBracedCounterDamage,
  flattenDeploymentPositions,
  resolveBracedCounterDefenderWeapon,
} from "../src/utils/combat/phase2eBracedCounterFixture.js";

const emptyDeployment = {
  currentSide: "player",
  selectionBySide: { player: [], enemy: [], npc: [] },
  selectedFighterBySide: { player: null, enemy: null, npc: null },
  positionsBySide: { player: {}, enemy: {}, npc: {} },
  manualPositionsBySide: { player: {}, enemy: {}, npc: {} },
};

const chargerId = "fixture-charger";
const bracerId = "fixture-bracer";
const deployed = applyExplicitDeploymentPositions(emptyDeployment, [
  { fighterId: chargerId, side: "player", x: 20, y: 23 },
  { fighterId: bracerId, side: "enemy", x: 20, y: 20 },
]);

assert.deepEqual(deployed.positionsBySide.player[chargerId], { x: 20, y: 23 });
assert.deepEqual(deployed.positionsBySide.enemy[bracerId], { x: 20, y: 20 });
assert.deepEqual(deployed.manualPositionsBySide.player[chargerId], { x: 20, y: 23 });
assert.deepEqual(deployed.manualPositionsBySide.enemy[bracerId], { x: 20, y: 20 });

const flattened = flattenDeploymentPositions(deployed);
assert.deepEqual(flattened[chargerId], PHASE2E_BRACED_COUNTER_FIXTURE.charger.position);
assert.deepEqual(flattened[bracerId], PHASE2E_BRACED_COUNTER_FIXTURE.bracer.position);

const live = assertFixtureLiveState({
  charger: {
    id: chargerId,
    team: "party",
    type: "player",
    status: "active",
    position: { x: 20, y: 23 },
  },
  bracer: {
    id: bracerId,
    team: "enemy",
    type: "enemy",
    status: "active",
    position: { x: 20, y: 20 },
  },
  catalogByRole: {
    charge: { enabled: true },
    block: { enabled: true },
  },
});
assert.equal(live.ok, true, live.errors.join("; "));

const wrongPosition = assertFixtureLiveState({
  charger: {
    id: chargerId,
    team: "party",
    type: "player",
    status: "active",
    position: { x: 20, y: 24 },
  },
  bracer: {
    id: bracerId,
    team: "enemy",
    type: "enemy",
    status: "active",
    position: { x: 20, y: 6 },
  },
});
assert.equal(wrongPosition.ok, false);
assert.ok(wrongPosition.errors.some((error) => error.includes("(20,23)")));
assert.ok(wrongPosition.errors.some((error) => error.includes("(20,20)")));

assert.equal(
  resolveBracedCounterDefenderWeapon({
    equistaminadWeapons: [{ name: "Spear" }, { name: "Dagger" }],
  })?.name,
  "Spear",
);
assert.equal(
  resolveBracedCounterDefenderWeapon({
    equistaminadWeapons: { primary: { name: "Pike" } },
  })?.name,
  "Pike",
);
assert.equal(expectedBracedCounterDamage(10), 3);
assert.equal(expectedBracedCounterDamage(11), 3);
assert.equal(PHASE2E_BRACED_COUNTER_FIXTURE.qualifyingNaturalAttackRoll, 19);

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /window\[PHASE2E_BRACED_COUNTER_FIXTURE\.windowApiName\]/);
assert.match(combatPage, /applyExplicitDeploymentPositions\(prev/);
assert.match(combatPage, /startCombat\(\);/);
assert.doesNotMatch(
  combatPage.slice(
    combatPage.indexOf("addFixtureActors()"),
    combatPage.indexOf("enterBlockingPosture()"),
  ),
  /skipDeployment:\s*true/,
  "fixture must start combat through production startCombat() without skipping deployment",
);

console.log("phase 2e braced-counter fixture pins exact deployment and weapon lookup");

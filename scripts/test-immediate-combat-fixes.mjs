import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getCanonicalWeaponLengthFeet,
  getCanonicalWeaponReachFeet,
  getCanonicalWeaponTypeLabel,
  isCanonicalInfantrySpear,
  isCanonicalThrownWeapon,
  normalizeCanonicalCombatWeapon,
} from "../src/utils/combat/canonicalWeaponTraits.js";
import {
  resolvePresentedBattlefieldPositions,
  snapshotBattlefieldPositions,
} from "../src/utils/combat/postCombatPositionAuthority.js";
import { reconcileCanonicalMovementLog } from "../src/utils/combat/movementLogAuthority.js";

const spear = normalizeCanonicalCombatWeapon({
  id: "weapon.infantry-spear",
  name: "Spear",
  range: 30,
  weaponType: "ranged",
  isRanged: true,
  twoHanded: true,
  handsRequired: 2,
  lengthFt: 6,
});
assert.equal(isCanonicalInfantrySpear(spear), true);
assert.equal(isCanonicalThrownWeapon(spear), false);
assert.equal(getCanonicalWeaponTypeLabel(spear), "LONG");
assert.equal(getCanonicalWeaponReachFeet(spear), 10);
assert.equal(getCanonicalWeaponLengthFeet(spear), 6);
assert.equal(spear.attackType, "melee");
assert.equal(spear.deliveryType, "extended-melee");
assert.equal(spear.range, null);
assert.equal(spear.isRanged, false);
assert.equal(spear.isProjectile, false);
assert.equal(spear.handsRequired, 2);
assert.equal(spear.shieldCompatible, false);

const javelin = {
  id: "weapon.javelin",
  name: "Javelin",
  isThrown: true,
  isRanged: true,
  normalRangeFeet: 30,
};
assert.equal(isCanonicalInfantrySpear(javelin), false);
assert.equal(isCanonicalThrownWeapon(javelin), true);
assert.equal(getCanonicalWeaponTypeLabel(javelin), "RANGED");
assert.equal(getCanonicalWeaponReachFeet(javelin), 30);

const finalPositions = snapshotBattlefieldPositions({
  a: { x: 11, y: 7, facing: 90 },
  b: { x: 13, y: 8 },
});
assert.deepEqual(finalPositions.a, { x: 11, y: 7, facing: 90 });
assert.deepEqual(resolvePresentedBattlefieldPositions({
  combatActive: false,
  combatEnded: true,
  livePositions: { a: { x: 1, y: 1 } },
  finalPositions,
  deploymentPositions: { a: { x: 3, y: 3 } },
}), finalPositions);
assert.deepEqual(resolvePresentedBattlefieldPositions({
  combatActive: false,
  combatEnded: false,
  livePositions: { a: { x: 1, y: 1 } },
  finalPositions: {},
  deploymentPositions: { a: { x: 3, y: 3 } },
}), { a: { x: 3, y: 3 } });

const staleLog = reconcileCanonicalMovementLog({
  message: "Party Spearman #1 moves to position (17, 15)",
  actorId: "party-1",
  positions: { "party-1": { x: 17, y: 21 } },
});
assert.equal(staleLog.accepted, false);
assert.equal(staleLog.reason, "stale-noncanonical-movement-position");
assert.deepEqual(staleLog.authoritative, { x: 17, y: 21 });

const accurateLog = reconcileCanonicalMovementLog({
  message: "Party Spearman #1 moves to position (17, 21)",
  actorId: "party-1",
  positions: { "party-1": { x: 17, y: 21 } },
});
assert.equal(accurateLog.accepted, true);

const here = path.dirname(fileURLToPath(import.meta.url));
const combatPage = fs.readFileSync(path.join(here, "../src/pages/CombatPage.jsx"), "utf8");
const tacticalMap = fs.readFileSync(path.join(here, "../src/components/TacticalMap.jsx"), "utf8");

assert.match(combatPage, /postCombatPositionSnapshotRef\.current = snapshotBattlefieldPositions/);
assert.match(combatPage, /resolvePresentedBattlefieldPositions/);
assert.match(combatPage, /stale-player-ai-movement-log-suppressed/);
assert.match(combatPage, /isCanonicalInfantrySpear\(normalizedAttackData\)/);
assert.match(combatPage, /Within extended melee spear reach/);
assert.match(tacticalMap, /data-combat-status-burst="morale-shock"/);
assert.match(tacticalMap, /Compact anime-style shock dashes/);
assert.match(tacticalMap, /data-morale-shock-dash="center"/);
assert.doesNotMatch(tacticalMap, /x1=\{iconX - 7\} y1=\{topY\} x2=\{iconX \+ 7\}/);

console.log("immediate combat fixes regression: passed");

import assert from "node:assert/strict";
import fs from "node:fs";

import { CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES as W } from "../src/data/canonicalCombatActors.js";
import {
  claimCanonicalAmmunitionSpend,
  commitCanonicalAmmunitionSpend,
  completeCanonicalRangedReload,
  normalizeCanonicalAmmunitionState,
  normalizeCanonicalRangedWeaponProfile,
  validateCanonicalRangedAttack,
} from "../src/utils/combat/canonicalRangedCombat.js";
import { getRangedAttackRangeModifier } from "../src/utils/rangedAttackRangeModifier.js";

const target = { id: "target", team: "enemy", currentHP: 20 };
const actor = {
  id: "archer",
  team: "party",
  inventory: [{ name: "arrows", quantity: 3 }],
};
const arrowState = {
  weaponId: W.archerBow.weaponId,
  ammunitionType: "arrow",
  current: 3,
  maximum: 3,
  chambered: false,
  reloadState: "ready",
  lastSpentActionToken: null,
  spentActionTokens: [],
};
const admit = ({
  controlMode = "manual",
  weaponProfile = W.archerBow,
  ammunitionState = arrowState,
  distanceFeet = 60,
  actionToken = "shot:1",
  activeActionToken = actionToken,
  lineOfSight = true,
  obstruction = false,
  overrides = {},
} = {}) => validateCanonicalRangedAttack({
  actor: { ...actor, controlMode },
  target,
  weaponProfile,
  ammunitionState,
  actionToken,
  activeActionToken,
  activeActorId: actor.id,
  distanceFeet,
  lineOfSight,
  obstruction,
  targetLegal: true,
  hostileTarget: true,
  executionContext: { controlMode },
  ...overrides,
});

for (const controlMode of ["manual", "ai", "autoplay"]) {
  const normal = admit({ controlMode, distanceFeet: 120 });
  assert.equal(normal.accepted, true, `${controlMode} normal bow shot accepted`);
  assert.equal(normal.rangeBand, "normal", `${controlMode} normal bow range band`);
  assert.equal(normal.ammoClaim.commitment, "projectile-release", `${controlMode} uses release commitment`);

  const long = admit({ controlMode, distanceFeet: 121 });
  assert.equal(long.accepted, true, `${controlMode} long bow shot accepted`);
  assert.equal(long.rangeBand, "long", `${controlMode} long bow range band`);

  const obstructed = admit({ controlMode, lineOfSight: false, obstruction: { type: "wall" } });
  assert.equal(obstructed.reason, "line-of-sight-blocked", `${controlMode} blocked LOS parity`);
  assert.equal(obstructed.ammunitionState.current, 3, `${controlMode} blocked LOS spends no ammo`);
}

assert.equal(admit({ distanceFeet: 481 }).reason, "target-out-of-range");
assert.equal(admit({ ammunitionState: { ...arrowState, current: 0 } }).reason, "ammunition-empty");
assert.equal(admit({ actionToken: "stale", activeActionToken: "live" }).reason, "stale-action-token");
assert.equal(admit({ overrides: { targetLegal: false } }).reason, "illegal-ranged-target");
assert.equal(admit({ overrides: { actor: { ...actor, grappled: true } } }).reason, "weapon-unavailable-in-grapple");

const compatibilityLongbow = {
  id: "compatibility-longbow",
  name: "Longbow",
  type: "ranged",
  range: 150,
  maxRange: 600,
};
const normalizedCompatibilityLongbow = normalizeCanonicalRangedWeaponProfile(compatibilityLongbow);
assert.equal(normalizedCompatibilityLongbow.ammunition, "arrows");
assert.equal(normalizedCompatibilityLongbow.ammunitionType, "arrow");
assert.equal(
  normalizeCanonicalRangedWeaponProfile({
    ...compatibilityLongbow,
    deliveryType: "projectile",
  }).ammunition,
  "arrows",
  "already-classified live projectile records still receive missing ammo normalization",
);
const compatibilityArrowState = normalizeCanonicalAmmunitionState(actor, normalizedCompatibilityLongbow);
assert.equal(compatibilityArrowState.current, 3, "live compatibility bow inventory feeds canonical admission");
assert.equal(admit({
  weaponProfile: normalizedCompatibilityLongbow,
  ammunitionState: compatibilityArrowState,
}).accepted, true);

const longModifier = getRangedAttackRangeModifier({
  actor,
  attack: W.archerBow,
  distanceFt: 121,
});
assert.equal(longModifier.canAttack, true);
assert.equal(longModifier.band, "long");
assert.equal(longModifier.finalModifier, -4, "existing extreme-range penalty extends through canonical long band");

let crossbowState = {
  weaponId: W.crossbow.weaponId,
  ammunitionType: "bolt",
  current: 2,
  maximum: 2,
  chambered: false,
  reloadState: "reload-required",
  lastSpentActionToken: null,
  spentActionTokens: [],
};
assert.equal(admit({ weaponProfile: W.crossbow, ammunitionState: crossbowState }).reason, "reload-required");
const reload = completeCanonicalRangedReload({
  ammunitionState: crossbowState,
  weaponProfile: W.crossbow,
  actionToken: "reload:1",
  activeActionToken: "reload:1",
});
assert.equal(reload.accepted, true);
crossbowState = reload.ammunitionState;
assert.equal(admit({
  weaponProfile: W.crossbow,
  ammunitionState: crossbowState,
  actionToken: "bolt:1",
}).accepted, true);
const boltClaim = claimCanonicalAmmunitionSpend({
  ammunitionState: crossbowState,
  weaponProfile: W.crossbow,
  actionToken: "bolt:1",
  activeActionToken: "bolt:1",
});
const boltCommit = commitCanonicalAmmunitionSpend({
  ammunitionState: crossbowState,
  weaponProfile: W.crossbow,
  claim: boltClaim.claim,
});
assert.equal(boltCommit.ammunitionState.current, 1);
assert.equal(boltCommit.ammunitionState.chambered, false);
assert.equal(boltCommit.ammunitionState.reloadState, "reload-required");
assert.equal(
  commitCanonicalAmmunitionSpend({
    ammunitionState: boltCommit.ammunitionState,
    weaponProfile: W.crossbow,
    claim: boltClaim.claim,
  }).reason,
  "duplicate-ammunition-spend",
);

const emptyLoadedCrossbow = { ...crossbowState, current: 0 };
assert.equal(admit({
  weaponProfile: W.crossbow,
  ammunitionState: emptyLoadedCrossbow,
}).reason, "ammunition-empty");
assert.equal(emptyLoadedCrossbow.chambered, true, "rejected no-ammo shot does not clear chamber");
const obstructedCrossbow = admit({
  weaponProfile: W.crossbow,
  ammunitionState: crossbowState,
  lineOfSight: false,
  obstruction: true,
});
assert.equal(obstructedCrossbow.reason, "line-of-sight-blocked");
assert.equal(crossbowState.chambered, true, "obstructed shot does not clear chamber");
const staleCrossbow = admit({
  weaponProfile: W.crossbow,
  ammunitionState: crossbowState,
  actionToken: "stale",
  activeActionToken: null,
});
assert.equal(staleCrossbow.reason, "stale-action-token");
assert.equal(crossbowState.current, 2);

const thrown = {
  weaponId: "weapon.thrown-dagger",
  name: "Thrown Dagger",
  deliveryType: "thrown",
  weaponFamily: "dagger",
  normalRangeFeet: 20,
  longRangeFeet: 60,
  ammunitionPerAttack: 0,
};
assert.equal(admit({ weaponProfile: thrown, ammunitionState: null, distanceFeet: 20 }).rangeBand, "normal");
assert.equal(admit({ weaponProfile: thrown, ammunitionState: null, distanceFeet: 40 }).rangeBand, "long");
assert.equal(admit({
  weaponProfile: thrown,
  ammunitionState: null,
  distanceFeet: 40,
  obstruction: true,
}).reason, "line-of-sight-blocked");
assert.equal(admit({ weaponProfile: thrown, ammunitionState: null, distanceFeet: 61 }).reason, "target-out-of-range");
assert.equal(admit({ weaponProfile: W.pike, ammunitionState: null }).reason, "invalid-delivery-type");

const combatPageSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const canonicalRangedSource = fs.readFileSync(
  new URL("../src/utils/combat/canonicalRangedCombat.js", import.meta.url),
  "utf8",
);
assert.match(combatPageSource, /eventType:\s*canonicalRangedAdmission\.accepted[\s\S]*canonical-ranged-admission-accepted/);
assert.match(combatPageSource, /isRangedForRangeCheck[\s\S]*validateCanonicalRangedAttack\(\{/);
assert.doesNotMatch(
  combatPageSource,
  /isAutomatedAttacker\s*&&\s*isRangedAttackData\(attackData\)\s*&&\s*isAdjacentDistance/,
  "adjacent ranged legality must not depend on automated control",
);
assert.doesNotMatch(
  combatPageSource,
  /isAutomatedAttacker\s*&&\s*isBowOrCrossbowAttackData\(attackData\)\s*&&\s*isPlateArmorEquistaminad/,
  "plate/bow legality must not depend on automated control",
);
assert.match(canonicalRangedSource, /commitment:\s*"projectile-release"/);
assert.match(combatPageSource, /isRangedForRangeCheck\s*\?\s*\{[\s\S]*canonical-ranged-admission/);
assert.match(combatPageSource, /const ammoType = canonicalRangedWeaponProfile\?\.ammunition/);

console.log("canonical ranged admission consolidation tests passed");

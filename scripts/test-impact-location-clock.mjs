import assert from "node:assert/strict";

import {
  rollImpactLocation,
  HUMANOID_IMPACT_CLOCK,
} from "../src/utils/combat/impactLocationClock.js";

assert.equal(HUMANOID_IMPACT_CLOCK.length, 6);

const locationFor = (value) => rollImpactLocation({ rollD100: () => value }).location;

assert.equal(locationFor(1), "head");
assert.equal(locationFor(10), "head");
assert.equal(locationFor(11), "torso");
assert.equal(locationFor(45), "torso");
assert.equal(locationFor(46), "weaponArm");
assert.equal(locationFor(60), "weaponArm");
assert.equal(locationFor(61), "shieldArm");
assert.equal(locationFor(72), "shieldArm");
assert.equal(locationFor(73), "legs");
assert.equal(locationFor(88), "legs");
assert.equal(locationFor(89), "hands");
assert.equal(locationFor(100), "hands");

assert.equal(rollImpactLocation({ rollD100: () => -99 }).roll, 1);
assert.equal(rollImpactLocation({ rollD100: () => 999 }).roll, 100);
assert.equal(locationFor(-99), "head");
assert.equal(locationFor(999), "hands");

console.log("impact location clock tests passed");

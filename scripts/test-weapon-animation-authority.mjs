import assert from "node:assert/strict";
import {
  buildWeaponAnimationCue,
  dedupeWeaponAnimationCues,
} from "../src/utils/combat/weaponAnimationAuthority.js";

const cue = buildWeaponAnimationCue({ type: "shield-break", actorId: "a", targetId: "b", durationMs: 1200 });
assert.equal(cue.animation, "shield_break");
assert.equal(cue.contact, "shield");
assert.equal(cue.durationMs, 1200);
const deduped = dedupeWeaponAnimationCues([cue, cue, { type: "hook-draw", actorId: "b", targetId: "a" }]);
assert.equal(deduped.length, 2);
assert.equal(buildWeaponAnimationCue({ type: null, actorId: "a" }), null);
console.log("weapon animation authority test passed");

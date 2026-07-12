import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const playerTurnAISource = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");

assert.match(playerTurnAISource, /const shouldAttemptAdjacentGrapple = \(\) => \{/);
assert.match(playerTurnAISource, /const hasUsableMeleeWeapon = equistaminadWeapons\.some/);
assert.match(playerTurnAISource, /const hasGrapplerTrait =/);
assert.match(playerTurnAISource, /const hasSpecialGrappleIntent =/);
assert.match(
  playerTurnAISource,
  /if \(\s+hasUsableMeleeWeapon &&\s+!hasGrapplerTrait &&\s+!targetDisabled &&\s+!actorIsUnarmed &&\s+!hasSpecialGrappleIntent\s+\) \{\s+return false;\s+\}/,
  "armed ordinary fighters should not voluntarily initiate grapple before weapon selection",
);

const weaponGuardIndex = playerTurnAISource.indexOf("hasUsableMeleeWeapon &&");
const knightlyGrappleIndex = playerTurnAISource.indexOf("if (isKnightly)");
assert.ok(weaponGuardIndex !== -1 && knightlyGrappleIndex !== -1);
assert.ok(
  weaponGuardIndex < knightlyGrappleIndex,
  "armed-weapon guard should run before knightly voluntary grapple rule",
);

console.log("armed AI prefers weapon over grapple tests passed");

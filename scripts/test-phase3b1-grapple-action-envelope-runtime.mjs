import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

let grapplingSource = await readFile(new URL("../src/utils/grapplingSystem.js", import.meta.url), "utf8");
grapplingSource = grapplingSource.replace(/^import[\s\S]*?;\s*$/gm, "");
const grapplingPrelude = `
const STAMINA_COSTS = { GRAPPLING: 1 };
const drainStamina = () => {};
const getCombinedGrappleModifiers = () => ({});
const getSizeCategory = () => "medium";
const assessGrappleSizeOutcome = () => ({});
const canLiftAndThrow = () => true;
const getLeveragePenalty = () => 0;
const canCarryTarget = () => true;
const calculateArmorDamage = () => 0;
const linkCombinedBodies = () => null;
const COMBINED_ROLES = {};
const COMBINED_MODES = {};
const canFly = () => false;
const isFlying = () => false;
const getAltitude = () => 0;
`;
const grapplingModuleUrl = `data:text/javascript;base64,${Buffer.from(`${grapplingPrelude}${grapplingSource}`).toString("base64")}`;
const { GRAPPLE_STATES, groundAttack } = await import(grapplingModuleUrl);

const attacker = {
  id: "enemy-knight",
  name: "Enemy Knight",
  PP: 12,
  PS: 12,
  currentHP: 20,
  grappleState: {
    state: GRAPPLE_STATES.GROUND,
    opponent: "player-knight",
    hasGrappleAdvantage: true,
  },
};
const defender = {
  id: "player-knight",
  name: "Player Knight",
  currentHP: 20,
  guardRating: 12,
  grappleState: {
    state: GRAPPLE_STATES.GRAPPLED,
    opponent: "enemy-knight",
  },
};
const dagger = { id: "dagger", name: "Dagger", damage: "1d4", weaponSize: "small" };

const originalRandom = Math.random;
let damageRngCalls = 0;
Math.random = () => {
  damageRngCalls += 1;
  return 0;
};

try {
  let envelopeChecks = 0;
  const admission = { generationId: "g1", initiativeTurnId: "turn-1", actionToken: "turn-1:1", actionSequence: 1, actorId: attacker.id, opponentId: defender.id, actionType: "groundAttack", executionKey: "exec-1", source: "fixture" };
  const canonicalRoll = () => 20;
  Object.defineProperties(canonicalRoll, {
    canonicalAdmission: { value: admission },
    canonicalActionToken: { value: admission.actionToken },
    canonicalExecutionKey: { value: admission.executionKey },
    canonicalRollKind: { value: "ground-attack" },
  });
  const accepted = groundAttack(attacker, defender, dagger, canonicalRoll, () => {
    envelopeChecks += 1;
  });
  assert.equal(accepted.hit, true);
  assert.equal(envelopeChecks, 1, "damage roll must validate the existing grapple action envelope");
  assert.equal(damageRngCalls, 1, "valid envelope should preserve the one damage RNG call");

  damageRngCalls = 0;
  assert.throws(
    () => groundAttack(attacker, defender, dagger, canonicalRoll, () => {
      throw new Error("missing-envelope");
    }),
    /missing-envelope/,
  );
  assert.equal(damageRngCalls, 0, "invalid envelope must block before damage RNG");
} finally {
  Math.random = originalRandom;
}

console.log("✅ Phase 3B1 grapple action envelope runtime tests passed");

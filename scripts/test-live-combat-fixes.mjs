import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_GRAPPLE_DISPATCHER_ROUTE,
  buildArmorStoppedNarration,
  createConvertedAttackGrappleAdmission,
  normalizeRepeatedCombatMode,
  resolveAttackOverexertionPolicy,
  shouldRouteAttackToCanonicalGrapple,
  validateConvertedAttackGrappleAdmission,
} from "../src/utils/combat/combatActionRouting.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const combatPagePath = path.resolve(here, "../src/pages/CombatPage.jsx");
const source = fs.readFileSync(combatPagePath, "utf8");

assert.equal(
  shouldRouteAttackToCanonicalGrapple({
    intent: { resolverRoute: CANONICAL_GRAPPLE_DISPATCHER_ROUTE },
    attackData: { name: "Body Clinch" },
  }),
  true,
);
assert.equal(
  shouldRouteAttackToCanonicalGrapple({
    attackData: { resolverRoute: "standard-natural-impact" },
  }),
  false,
);

const admission = createConvertedAttackGrappleAdmission({
  sourceAttackExecutionKey: "attack:1",
  generationId: 3,
  round: 5,
  initiativeTurnId: "turn:5:0",
  actionSequence: 1,
  actorId: "minotaur",
  targetId: "knight",
});
assert.deepEqual(
  validateConvertedAttackGrappleAdmission({
    admission,
    activeSourceAttackExecutionKey: "attack:1",
    generationId: 3,
    round: 5,
    initiativeTurnId: "turn:5:0",
    actionSequence: 1,
    actorId: "minotaur",
    targetId: "knight",
  }),
  { valid: true, reason: "valid" },
);
assert.equal(
  validateConvertedAttackGrappleAdmission({
    admission,
    activeSourceAttackExecutionKey: "attack:other",
    generationId: 3,
    round: 5,
    initiativeTurnId: "turn:5:0",
    actionSequence: 1,
    actorId: "minotaur",
    targetId: "knight",
  }).reason,
  "source-attack-ownership-mismatch",
);

const sufficientStaminaPolicy = resolveAttackOverexertionPolicy({
  currentStamina: 2,
  maxStamina: 10,
  attackCost: 2,
  alreadyOverexerted: false,
});
assert.equal(sufficientStaminaPolicy.canAttempt, true);
assert.equal(sufficientStaminaPolicy.allowOverexertion, false);
assert.equal(sufficientStaminaPolicy.reason, "stamina-sufficient");
assert.equal(sufficientStaminaPolicy.currentStamina, 2);
assert.equal(sufficientStaminaPolicy.maxStamina, 10);
assert.equal(sufficientStaminaPolicy.projectedStamina, 0);
assert.equal(sufficientStaminaPolicy.attackCost, 2);
assert.equal(
  resolveAttackOverexertionPolicy({
    currentStamina: 1,
    maxStamina: 10,
    attackCost: 2,
    alreadyOverexerted: false,
  }).allowOverexertion,
  true,
);
assert.equal(
  resolveAttackOverexertionPolicy({
    currentStamina: 0,
    maxStamina: 10,
    attackCost: 2,
    alreadyOverexerted: false,
  }).reason,
  "body-demands-recovery",
);
assert.equal(
  resolveAttackOverexertionPolicy({
    currentStamina: 1,
    maxStamina: 10,
    attackCost: 2,
    alreadyOverexerted: true,
  }).reason,
  "overexertion-limit-reached",
);

assert.equal(normalizeRepeatedCombatMode("headbutt headbutt"), "headbutt");
assert.equal(normalizeRepeatedCombatMode("body-clinch body-clinch"), "body-clinch");
assert.equal(normalizeRepeatedCombatMode("half-sword-thrust"), "half-sword-thrust");

assert.equal(
  buildArmorStoppedNarration({
    attackData: { name: "Headbutt", damageType: "bludgeoning" },
    contactResult: { attackMode: "headbutt", contactType: "blunt-through-armor" },
  }),
  "The armor absorbs the impact; no bodily damage is dealt.",
);
assert.equal(
  buildArmorStoppedNarration({
    attackData: { name: "Gore", damageType: "piercing" },
    contactResult: { attackMode: "gore" },
  }),
  "The armor deflects the point; no bodily damage is dealt.",
);
assert.equal(
  buildArmorStoppedNarration({
    attackData: { name: "Heavy Axe", damageType: "slashing" },
    contactResult: { attackMode: "heavy-axe" },
  }),
  "The armor stops the edge; no bodily damage is dealt.",
);
assert.match(
  buildArmorStoppedNarration({
    attackData: {
      name: "Body Clinch",
      damageType: "control",
      resolverRoute: CANONICAL_GRAPPLE_DISPATCHER_ROUTE,
    },
  }),
  /prevents the clinch from gaining control/,
);

const dispatchIndex = source.indexOf('eventType: "minotaur-grapple-entry-dispatched"');
const staminaIndex = source.indexOf("const staminaChargeKey");
const armorIndex = source.indexOf("const shouldResolveArmorContact");
assert.ok(dispatchIndex > 0, "Body Clinch dispatch event must exist");
assert.ok(dispatchIndex < staminaIndex, "Body Clinch must leave the attack path before attack stamina is charged");
assert.ok(dispatchIndex < armorIndex, "Body Clinch must leave the attack path before armor contact resolution");
assert.ok(
  !source.includes("activeAfterFumble?.id !== attacker?.id"),
  "fumble verification must permit the same actor to win the next round's initiative",
);
assert.ok(source.includes("fumbleCoordinateMatches"), "fumble handoff must compare authoritative coordinates");
assert.ok(source.includes("initiativeTurnAdvanced"), "fumble handoff must verify a new initiative-turn identity");
assert.ok(source.includes("attack-overexertion-blocked"), "zero-stamina attacks must have an explicit terminal policy");
assert.ok(source.includes("buildArmorStoppedNarration"), "armor narration must be contact-aware");
assert.ok(source.includes("normalizeRepeatedCombatMode"), "attack-mode duplication must be normalized");

console.log("Live combat repair tests passed: 29 assertions.");

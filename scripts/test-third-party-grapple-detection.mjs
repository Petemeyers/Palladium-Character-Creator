import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getNonReciprocalGrappleMetadata,
  hasReciprocalGrapplePair,
} from "../src/utils/combat/grapplePairing.js";
import { resolveArmoredCombatAction } from "../src/utils/ai/resolveArmoredCombatAction.js";
import { getSelectableActorAttackForDistance } from "../src/utils/selectableActorAdapter.js";
import { getCanonicalWeaponProfileByAlias } from "../src/data/canonicalCombatActors.js";
import { isExplicitRangedAttack } from "../src/utils/rangedAttackRangeModifier.js";

let assertions = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
};

const neutral = (id, extra = {}) => ({
  id,
  name: id,
  currentHP: 20,
  remainingActions: 2,
  grappleState: { state: "neutral", opponent: null, ...extra },
});
const linked = (id, opponent, state = "grapple_clinch") => ({
  id,
  name: id,
  currentHP: 20,
  remainingActions: 2,
  grappleState: { state, opponent },
});

const longbowman3 = neutral("longbowman-3");
const knightWithSecond = linked("knight", "longbowman-2");
check(!hasReciprocalGrapplePair(longbowman3, knightWithSecond),
  "neutral actor must not inherit a target's third-party grapple");
check(getNonReciprocalGrappleMetadata(longbowman3, knightWithSecond)?.targetOpponentId === "longbowman-2",
  "third-party metadata identifies the target's actual opponent");

const sharedHexA = neutral("a", { sharedHex: { x: 2, y: 2 }, isAttacker: true });
const sharedHexB = neutral("b", { sharedHex: { x: 2, y: 2 } });
check(!hasReciprocalGrapplePair(sharedHexA, sharedHexB),
  "shared hex and attacker residue cannot establish a grapple");

check(!hasReciprocalGrapplePair(linked("a", "b"), neutral("b")),
  "actor naming target is insufficient without reciprocal target state");
check(!hasReciprocalGrapplePair(neutral("a"), linked("b", "a")),
  "target naming actor is insufficient without reciprocal actor state");
check(hasReciprocalGrapplePair(linked("a", "b"), linked("b", "a")),
  "genuine reciprocal grapple is active");

const longbow = {
  id: "longbow",
  name: "Longbow Shot",
  type: "ranged",
  attackType: "ranged",
  isRanged: true,
  range: 150,
  normalRangeFeet: 150,
  longRangeFeet: 600,
};
const dagger = getCanonicalWeaponProfileByAlias("dagger");
const tacticalLongbowman = {
  ...longbowman3,
  aiRole: "archer",
  attacks: [longbow, dagger],
  equistaminadWeapons: { primary: longbow, secondary: dagger },
};
const selectedAtRange = getSelectableActorAttackForDistance(
  tacticalLongbowman,
  80,
  dagger,
);
check(selectedAtRange?.name === "Longbow Shot",
  "Longbowman keeps normal ranged selection while target grapples a third fighter");

const armoredEvents = [];
const standingPlan = resolveArmoredCombatAction({
  attacker: tacticalLongbowman,
  defender: knightWithSecond,
  selectedWeapon: dagger,
  distance: 5,
  remainingActions: 2,
  generationId: "regression",
  round: 4,
  initiativeIndex: 2,
  initiativeTurnId: "round-4-longbowman-3",
  actionToken: "round-4-longbowman-3:1",
  turnToken: "round-4-longbowman-3",
  authoritativeTurn: {
    generationId: "regression",
    round: 4,
    initiativeIndex: 2,
    initiativeTurnId: "round-4-longbowman-3",
    actionToken: "round-4-longbowman-3:1",
    turnToken: "round-4-longbowman-3",
  },
  rng: () => 0.5,
  addLog: (event) => armoredEvents.push(event),
});
check(standingPlan?.actionType !== "grapple-obligation",
  "third-party grapple does not suppress the standing armored selector");
check(!armoredEvents.some((event) => event?.eventType === "standing-armored-selector-suppressed"),
  "third-party grapple emits no false armored suppression event");

const reciprocalEvents = [];
const reciprocalPlan = resolveArmoredCombatAction({
  attacker: { ...tacticalLongbowman, grappleState: { state: "grapple_clinch", opponent: "knight" } },
  defender: { ...knightWithSecond, grappleState: { state: "grapple_clinch", opponent: "longbowman-3" } },
  selectedWeapon: dagger,
  distance: 0,
  remainingActions: 2,
  generationId: "regression",
  round: 4,
  initiativeIndex: 2,
  initiativeTurnId: "round-4-longbowman-3",
  actionToken: "round-4-longbowman-3:1",
  turnToken: "round-4-longbowman-3",
  authoritativeTurn: {
    generationId: "regression",
    round: 4,
    initiativeIndex: 2,
    initiativeTurnId: "round-4-longbowman-3",
    actionToken: "round-4-longbowman-3:1",
    turnToken: "round-4-longbowman-3",
  },
  addLog: (event) => reciprocalEvents.push(event),
});
check(reciprocalPlan?.actionType === "grapple-obligation",
  "genuine reciprocal clinch remains routed as a grapple obligation");
check(reciprocalEvents.some((event) => event?.eventType === "standing-armored-selector-suppressed"),
  "genuine reciprocal clinch still suppresses standing armored selection");

check(dagger?.profileKey === "weapon.dagger" && dagger?.damage === "1d4",
  "shared canonical dagger contract and damage remain unchanged");
check(isExplicitRangedAttack(dagger) === false,
  "non-thrown canonical dagger remains melee-only");
check(dagger?.ammunitionPerAttack !== 1 && !dagger?.ammunitionType,
  "non-thrown dagger cannot consume arrows");

const enemyAiSource = fs.readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");
const combatPageSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
check(enemyAiSource.includes("hasReciprocalGrapplePair(") &&
      !enemyAiSource.includes("enemy.grappleState.opponent === target?.id"),
  "modular enemy AI uses the shared reciprocal predicate instead of the loose OR condition");
check(enemyAiSource.includes("fighters.find((fighter) => fighter?.id === enemy?.id)") &&
      enemyAiSource.includes("fighters.find((fighter) => fighter?.id === target?.id)"),
  "modular AI resolves both grapple participants from decision snapshots");
check(enemyAiSource.includes("third-party grapple ignored: actorId="),
  "modular AI emits the required third-party diagnostic");
check(combatPageSource.includes("executeCanonicalGrappleAction") &&
      combatPageSource.includes("source: \"enemy-inline-active-grapple\""),
  "genuine inline clinch actions retain canonical grapple execution routing");

console.log(`Third-party grapple detection tests passed: ${assertions} assertions.`);

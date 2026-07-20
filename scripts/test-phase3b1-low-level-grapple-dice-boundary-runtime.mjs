import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

let source = await readFile(new URL("../src/utils/grapplingSystem.js", import.meta.url), "utf8");
source = source.replace(/^import[\s\S]*?;\s*$/gm, "");
const prelude = `
const STAMINA_COSTS = { NORMAL_COMBAT: 1, GRAPPLING: 1 };
const drainStamina = (fighter, _cost, amount) => { fighter.currentStamina = (fighter.currentStamina ?? 0) - amount; };
const getCombinedGrappleModifiers = () => ({ autoGrapple: false });
const getSizeCategory = () => "medium";
const assessGrappleSizeOutcome = () => ({});
const canLiftAndThrow = () => ({ canThrow: true });
const getLeveragePenalty = () => ({ escapePenalty: 0 });
const canCarryTarget = () => true;
const calculateArmorDamage = () => ({ armorHit: false, damageToCharacter: 1 });
const linkCombinedBodies = () => null;
const COMBINED_ROLES = {};
const COMBINED_MODES = {};
const canFly = () => false;
const isFlying = () => false;
const getAltitude = () => 0;
`;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(`${prelude}${source}`).toString("base64")}`;
const { GRAPPLE_STATES, attemptGrapple, maintainGrapple, performTakedown, groundAttack, breakFree } = await import(moduleUrl);

const makePair = () => {
  const actor = {
    id: "actor",
    name: "Actor",
    PP: 12,
    PS: 14,
    currentHP: 20,
    hp: 20,
    remainingActions: 2,
    currentStamina: 10,
    grappleState: { state: GRAPPLE_STATES.CLINCH, opponent: "opponent", hasGrappleAdvantage: true },
  };
  const opponent = {
    id: "opponent",
    name: "Opponent",
    PP: 12,
    PS: 12,
    currentHP: 20,
    hp: 20,
    guardRating: 12,
    currentStamina: 10,
    grappleState: { state: GRAPPLE_STATES.GRAPPLED, opponent: "actor" },
  };
  return { actor, opponent };
};

const cases = [
  ["initiation", (a, o) => { a.grappleState = { state: GRAPPLE_STATES.NEUTRAL, opponent: null }; o.grappleState = { state: GRAPPLE_STATES.NEUTRAL, opponent: null }; }, (a, o, roll) => attemptGrapple(a, o, roll)],
  ["maintain", () => {}, (a, o, roll) => maintainGrapple(a, o, roll)],
  ["takedown", () => {}, (a, o, roll) => performTakedown(a, o, roll)],
  ["clinch attack and damage", () => {}, (a, o, roll) => groundAttack(a, o, { name: "Dagger", damage: "1d4", weaponSize: "small" }, roll)],
  ["escape", (a, o) => { a.grappleState.state = GRAPPLE_STATES.GRAPPLED; o.grappleState.state = GRAPPLE_STATES.CLINCH; }, (a, o, roll) => breakFree(a, o, roll)],
];

const originalRandom = Math.random;
let rngCalls = 0;
Math.random = () => { rngCalls += 1; return 0.5; };
try {
  for (const [name, prepare, execute] of cases) {
    const { actor, opponent } = makePair();
    prepare(actor, opponent);
    let suppliedRollCalls = 0;
    const beforeActor = JSON.stringify(actor);
    const beforeOpponent = JSON.stringify(opponent);
    const result = execute(actor, opponent, () => { suppliedRollCalls += 1; return 20; });
    assert.equal(result.reason, "grapple-dice-boundary-without-canonical-claim-blocked", `${name} must be blocked at the lowest dice boundary`);
    assert.equal(suppliedRollCalls, 0, `${name} must not invoke a loose dice callback`);
    assert.equal(rngCalls, 0, `${name} must not invoke RNG`);
    assert.equal(JSON.stringify(actor), beforeActor, `${name} must not mutate actor state`);
    assert.equal(JSON.stringify(opponent), beforeOpponent, `${name} must not mutate opponent state`);
  }
} finally {
  Math.random = originalRandom;
}

console.log("✅ Phase 3B1 low-level grapple dice-boundary rejection runtime tests passed");

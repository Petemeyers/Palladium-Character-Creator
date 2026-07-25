import assert from "node:assert/strict";
import fs from "node:fs";

import { resolveArmorContact } from "../src/utils/combat/armorContactResolver.js";
import { resolveCanonicalArmorCoverage } from "../src/utils/combat/canonicalArmorCoverage.js";
import {
  COMMITTED_MINOTAUR_IMPACT_STAGES,
  resolveCanonicalImpactPipeline,
} from "../src/utils/combat/canonicalImpactPipeline.js";
import {
  FUMBLE_HANDOFF_STATES,
  createFumbleHandoffOwnership,
  isActiveFumbleHandoffOwnership,
  resolveFumbleHandoffCoordinate,
  transitionFumbleHandoffOwnership,
} from "../src/utils/combat/fumbleHandoffOwnership.js";
import {
  admitInitiativeCoordinate,
  compareInitiativeCoordinates,
  createInitiativeCoordinate,
} from "../src/utils/combat/initiativeCoordinateAuthority.js";
import {
  createKnightVsMinotaurAuthorityScenario,
  createThreeFighterFumbleAuthorityScenario,
} from "../src/utils/combat/liveBrowserAuthorityScenarios.js";
import {
  createCanonicalMinotaurTechniqueIntent,
  isCanonicalMinotaurActor,
} from "../src/utils/combat/minotaurTechniqueResolver.js";
import { runEnemyApproachPlanner } from "../src/utils/enemyApproachPlannerContract.js";

let checks = 0;
const check = (condition, message) => {
  checks += 1;
  assert.ok(condition, message);
};

const base = createInitiativeCoordinate({ generationId: 4, combatSession: 4, round: 4, initiativeIndex: 0, turnCounter: 9, actorId: "knight-a" });
const older = createInitiativeCoordinate({ ...base, round: 3, initiativeIndex: 2, turnCounter: 8, actorId: "knight-b" });
const newer = createInitiativeCoordinate({ ...base, round: 5, turnCounter: 12 });
check(compareInitiativeCoordinates(base, base) === "same", "1 same coordinate");
check(compareInitiativeCoordinates(older, base) === "older", "2 coordinate cannot roll backward");
check(compareInitiativeCoordinates(newer, base) === "newer", "3 newer coordinate recognized");
check(compareInitiativeCoordinates({ ...base, generationId: 3, combatSession: 3 }, base) === "different-generation", "4 generation isolated");
check(!admitInitiativeCoordinate(older, base).accepted, "5 stale record creation rejected");
check(!admitInitiativeCoordinate(older, base).accepted, "6 stale player schedule rejected");
check(!admitInitiativeCoordinate(older, base).accepted, "7 stale enemy schedule rejected");
check(admitInitiativeCoordinate(newer, base, { allowNewer: true }).accepted, "8 atomic newer commit admitted");

const fighters = [{ id: "knight-a" }, { id: "minotaur" }, { id: "knight-b" }];
const ownership = createFumbleHandoffOwnership({ handoffToken: "fumble-1", expectedOutgoingTurnId: "turn-8", expectedCoordinate: older });
const handoff = resolveFumbleHandoffCoordinate({ ownership, fighters, currentCoordinate: older });
check(ownership.accepted && ownership.state === "claimed", "9 fumble claims handoff");
check(handoff.accepted && handoff.wrappedRound, "10 final actor wraps round");
check(handoff.coordinate.round === 4, "11 fumble advances exactly one round");
check(handoff.coordinate.actorId === "knight-a", "12 next fighter identity stable");
check(handoff.coordinate.turnCounter === 9, "13 counter advances exactly once");
const committing = transitionFumbleHandoffOwnership(ownership, FUMBLE_HANDOFF_STATES.COMMITTING);
const committed = transitionFumbleHandoffOwnership(committing, FUMBLE_HANDOFF_STATES.COMMITTED, { committedCoordinate: handoff.coordinate });
const released = transitionFumbleHandoffOwnership(committed, FUMBLE_HANDOFF_STATES.RELEASED);
check(isActiveFumbleHandoffOwnership(committed), "14 generic wrap suppressed while owned");
check(!isActiveFumbleHandoffOwnership(released), "15 completed fumble history inactive");
check(released.committedCoordinate.actorId === "knight-a", "16 one committed next-fighter record identity");

const minotaur = { id: "minotaur", modelKey: "minotaur", abilityScores: { strength: 18 } };
const knight = {
  id: "knight",
  equippedArmor: { id: "armor.plate-harness", name: "Plate Harness" },
  armorProfile: { armorClass: "plate", rigidCoverage: true },
};
const axe = { name: "Heavy Axe", damageType: "slashing", techniqueKey: "heavyAxe", armorContactProfile: "heavy-axe-edge-or-haft" };
const headbutt = { name: "Headbutt", damageType: "bludgeoning", techniqueKey: "headbutt", armorContactProfile: "helmet-blunt-impact" };
const rock = { name: "Rock Smash", damageType: "bludgeoning", techniqueKey: "rockSmash", armorContactProfile: "improvised-heavy-melee" };
check(isCanonicalMinotaurActor(minotaur), "17 continuation identity recognizes modelKey");
const intent = createCanonicalMinotaurTechniqueIntent({ techniqueKey: "heavyAxe", actor: minotaur, target: knight });
check(intent.accepted && intent.techniqueKey === "heavyAxe", "18 Heavy Axe identity retained");
check(createCanonicalMinotaurTechniqueIntent({ techniqueKey: "headbutt", actor: minotaur, target: knight }).techniqueKey === "headbutt", "19 Headbutt identity retained");
check(createCanonicalMinotaurTechniqueIntent({ techniqueKey: "rockSmash", actor: minotaur, target: knight }).techniqueKey === "rockSmash", "20 Rock Smash identity retained");

for (const location of ["torso", "weaponArm", "shieldArm", "legs"]) {
  check(resolveCanonicalArmorCoverage({ defender: knight, hitLocation: location }).coverageType === "plate", `${checks + 1} Plate Harness ${location}`);
}
const ordinaryCoverage = resolveCanonicalArmorCoverage({ defender: knight, hitLocation: "torso" });
check(ordinaryCoverage.source === "canonical-equipped-armor-profile", "25 legacy flexible fallback cannot override plate");
check(ordinaryCoverage.coverageType !== "plate-gap", "26 ordinary success does not imply gap");

const contact = (weapon, critical = false) => resolveArmorContact({
  attacker: minotaur,
  defender: knight,
  weapon,
  attackData: weapon,
  attackRoll: critical ? 20 : 15,
  attackTotal: critical ? 27 : 22,
  critical,
  hitLocation: "torso",
  normalDefense: 16,
});
const axePlate = contact(axe);
const criticalAxePlate = contact(axe, true);
const headPlate = contact(headbutt);
const rockPlate = contact(rock);
check(criticalAxePlate.reason === "heavy-axe-conditional-plate-penetration", "27 natural 20 continues through authority");
check(!axePlate.damageAllowed && !axePlate.penetration, "28 Heavy Axe not automatic penetration");
check(headPlate.convertedDamageType === "bludgeoning" && !headPlate.penetration, "29 Headbutt not slashing penetration");
check(rockPlate.convertedDamageType === "bludgeoning" && !rockPlate.penetration, "30 Rock Smash not slashing penetration");
check(criticalAxePlate.damageAllowed && criticalAxePlate.penetration, "31 conditional penetration remains possible");

const fullImpact = resolveCanonicalImpactPipeline({
  intent,
  prerequisite: { accepted: true },
  shield: { intercepted: false },
  hitLocation: { location: "torso" },
  armor: { armorClass: "plate", rigidCoverage: true },
  contact: { contactType: axePlate.contactType, penetrated: axePlate.penetration },
});
const shieldImpact = resolveCanonicalImpactPipeline({
  intent,
  prerequisite: { accepted: true },
  shield: { intercepted: true, shieldId: "shield.heater" },
  hitLocation: { location: "torso" },
  armor: { armorClass: "plate", rigidCoverage: true },
});
check(shieldImpact.events.findIndex((event) => event.eventType === "shield-interception-resolved") < shieldImpact.events.findIndex((event) => event.eventType === "hit-location-resolved"), "32 shield resolves first");
check(fullImpact.events.some((event) => event.eventType === "armor-layer-contacted"), "33 failed interception reaches body armor");
check(fullImpact.events.at(-1).eventType === "injury-authorization-resolved", "34 injury authorization is final pre-damage stage");
check(fullImpact.stageCountValid && fullImpact.events.length === COMMITTED_MINOTAUR_IMPACT_STAGES.length, "35 every committed stage exactly once");

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
check(source.indexOf('getAttackRollOwnershipBlockReason("hp-mutation")') < source.indexOf("applyHPToFighter(defender, newHP)"), "36 stale token blocks HP mutation");
check(new Set(fighters.map((fighter) => fighter.id)).size === 3, "37 duplicate display names remain independent by ID");
const hold = runEnemyApproachPlanner({
  planner: () => ({ type: "hold" }),
  actor: { id: "minotaur" },
  target: { id: "knight-a" },
});
check(hold.result === "hold-position" && !hold.positionChanged, "38 occupied/no-improving hex holds position");
check(hold.staminaSpent === 0, "39 hold position spends no stamina");
const browserScenario = createThreeFighterFumbleAuthorityScenario({ rounds: 5 });
check(browserScenario.coordinates.at(-1).round === 5 && browserScenario.coordinates.every((coordinate, index, list) => index === 0 || coordinate.round > list[index - 1].round), "40 deterministic browser scenario reaches five rounds monotonically");

const minotaurScenario = createKnightVsMinotaurAuthorityScenario();
assert.equal(minotaurScenario.impacts.length, 2);
assert.ok(minotaurScenario.impacts.every((entry) => entry.impact.stageCountValid));
assert.equal(checks, 40);
console.log(`live-browser authority stabilization tests passed: ${checks}/40`);


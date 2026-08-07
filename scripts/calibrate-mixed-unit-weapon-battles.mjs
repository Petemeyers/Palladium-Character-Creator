import fs from "node:fs";
import { getWeaponTacticalTraits } from "../src/utils/combat/weaponEngagementAuthority.js";
import {
  resolveWeaponEntryExchange,
  selectAutomatedEntryTechnique,
  selectAutomatedLongWeaponResponse,
} from "../src/utils/combat/weaponExchangeAuthority.js";
import {
  getSpecializedWeaponAttackModifier,
  selectAutomatedSpecializedWeaponAction,
} from "../src/utils/combat/weaponSpecializationAuthority.js";
import {
  applyFormationDisruption,
  resolveSpatialFormationSupport,
} from "../src/utils/combat/formationCohesionAuthority.js";

const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, value] = entry.replace(/^--/, "").split("=");
  return [key, value ?? true];
}));
const iterations = Math.max(100, Number(args.iterations) || 500);
const seed = Number(args.seed) || 20260806;
const output = args.output ? String(args.output) : null;

const makeRng = (initial) => {
  let state = initial >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};
const rng = makeRng(seed);
const d20 = () => 1 + Math.floor(rng() * 20);
const die = (sides) => 1 + Math.floor(rng() * sides);

const W = {
  spear: { id: "weapon.spear", name: "Spear", reachFeet: 10, reach: 10, handsRequired: 2, twoHanded: true, damageDie: 8 },
  pike: { id: "weapon.pike", name: "Pike", reachFeet: 15, reach: 15, handsRequired: 2, twoHanded: true, damageDie: 10 },
  halberd: { id: "weapon.halberd", name: "Halberd", reachFeet: 10, reach: 10, handsRequired: 2, twoHanded: true, damageDie: 10 },
  sword: { id: "weapon.arming-sword", name: "Arming Sword", reachFeet: 5, reach: 5, handsRequired: 1, damageDie: 8 },
  greatsword: { id: "weapon.greatsword", name: "Greatsword", reachFeet: 6, reach: 6, handsRequired: 2, twoHanded: true, halfSwordCapable: true, damageDie: 10 },
  axe: { id: "weapon.battle-axe", name: "Battle Axe", reachFeet: 5, reach: 5, handsRequired: 1, damageDie: 8 },
  mace: { id: "weapon.mace", name: "Mace", reachFeet: 5, reach: 5, handsRequired: 1, damageDie: 8 },
  dagger: { id: "weapon.dagger", name: "Dagger", reachFeet: 3, reach: 3, handsRequired: 1, damageDie: 4 },
};

const makeUnit = (id, weapon, { shield = false, armor = 0, formationSupported = false } = {}) => ({
  id,
  name: id,
  weapon,
  hp: 24,
  stamina: 30,
  shield,
  armor,
  formationSupported,
  entered: false,
  statusEffects: [],
  attributes: { deftness: 14, endurance: 15 },
  proficiencyBonus: 2,
  behavior: { aggression: 55, caution: 50 },
  equipmentSelection: { shield: shield ? "Heater Shield" : "None" },
  fatigueState: { currentStamina: 30, maxStamina: 30 },
  selectedAttack: weapon,
});

const alive = (team) => team.filter((unit) => unit.hp > 0);
const pickTarget = (team) => alive(team).sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id))[0] || null;

const strike = (attacker, defender, action, distanceFt, formationSupported = false) => {
  const at = getWeaponTacticalTraits(attacker.weapon);
  const dt = getWeaponTacticalTraits(defender.weapon);
  const specialized = getSpecializedWeaponAttackModifier({
    actionId: action?.id,
    attackerWeapon: attacker.weapon,
    defenderWeapon: defender.weapon,
    distanceFt,
    formationSupported,
  });
  let modifier = 2 + Number(specialized.modifier || 0);
  modifier += distanceFt <= 5.5 ? at.closeHandling : Math.max(0, at.pointControl - 1);
  if (attacker.stamina <= 6) modifier -= 2;
  const defense = 12 + (defender.shield ? 1 : 0) + Math.max(0, defender.armor ? 1 : 0) + (distanceFt <= 5.5 ? Math.max(0, dt.closeHandling - 1) : 0);
  const natural = d20();
  attacker.stamina = Math.max(0, attacker.stamina - Math.max(1, Number(action?.staminaCost || 1)));
  attacker.fatigueState.currentStamina = attacker.stamina;
  if (natural === 1 || (natural !== 20 && natural + modifier < defense)) return 0;
  const raw = die(attacker.weapon.damageDie || 8) + (natural === 20 ? die(attacker.weapon.damageDie || 8) : 0);
  return Math.max(1, raw - Math.floor(defender.armor / 2));
};

const pairKey = (leftId, rightId) => [leftId, rightId].sort().join("::");

const resolveTurn = (actor, allies, enemies, metrics, distances, positions, allUnits) => {
  if (actor.hp <= 0) return;
  const target = pickTarget(enemies);
  if (!target) return;
  const calculateGridDistance = (left, right) => Math.sqrt((left.x - right.x) ** 2 + (left.y - right.y) ** 2) * 5;
  const formationContext = resolveSpatialFormationSupport({
    actor,
    target,
    combatants: allUnits,
    positions,
    getWeapon: (unit) => unit.weapon,
    calculateDistanceFeet: calculateGridDistance,
    currentRound: metrics.round,
  });
  const at = getWeaponTacticalTraits(actor.weapon);
  const tt = getWeaponTacticalTraits(target.weapon);
  const distanceKey = pairKey(actor.id, target.id);
  let distanceFt = distances.get(distanceKey) ?? Math.max(at.preferredDistanceFeet, tt.preferredDistanceFeet, at.reachFeet, tt.reachFeet, 5);
  const longController = at.reachFeet > tt.reachFeet + 0.5 ? actor : tt.reachFeet > at.reachFeet + 0.5 ? target : null;
  const shorter = longController === actor ? target : longController === target ? actor : null;

  if (shorter === actor && distanceFt > at.reachFeet + 0.5) {
    const controllerFormation = resolveSpatialFormationSupport({
      actor: target,
      target: actor,
      combatants: allUnits,
      positions,
      getWeapon: (unit) => unit.weapon,
      calculateDistanceFeet: calculateGridDistance,
      currentRound: metrics.round,
    });
    const supporting = controllerFormation.supporters;
    const entryTechnique = selectAutomatedEntryTechnique({ actor, weapon: actor.weapon, controllerWeapon: target.weapon });
    const response = selectAutomatedLongWeaponResponse({ controller: target, weapon: target.weapon, canRetreat: true });
    const result = resolveWeaponEntryExchange({
      mover: actor,
      controller: target,
      moverWeapon: actor.weapon,
      controllerWeapon: target.weapon,
      entryTechnique,
      controlResponse: response,
      entryRoll: d20(),
      controlRoll: d20(),
      supportingControllers: supporting,
      beforeDistanceFt: distanceFt,
      desiredDistanceFt: 5,
      currentRound: metrics.round,
    });
    actor.stamina = Math.max(0, actor.stamina - Number(result.entryStaminaCost || 1));
    target.stamina = Math.max(0, target.stamina - Number(result.controlStaminaCost || 1));
    metrics.entryAttempts += 1;
    metrics.supportedEntryContests += supporting.length > 0 ? 1 : 0;
    if (result.allowed) {
      distances.set(distanceKey, 5);
      distanceFt = 5;
      actor.entered = true;
      metrics.entries += 1;
      const disruptedIds = new Set([target.id, ...supporting.map((unit) => unit.id)]);
      for (const unit of allUnits) {
        if (!disruptedIds.has(unit.id)) continue;
        Object.assign(unit, applyFormationDisruption(unit, {
          sourceActorId: actor.id,
          currentRound: metrics.round,
          durationRounds: 1,
          reason: "calibration-line-breach",
        }));
      }
      metrics.formationDisruptions += disruptedIds.size;
    } else {
      metrics.denials += 1;
      if (result.stopThrustAuthorized) {
        actor.hp -= strike(target, actor, { id: response.id, staminaCost: 1 }, distanceFt, controllerFormation.formationSupported);
        metrics.controlReactions += 1;
      }
    }
    return;
  }

  if (distanceFt > at.reachFeet + 0.5) {
    distances.set(distanceKey, Math.max(5, distanceFt - 5));
    actor.stamina = Math.max(0, actor.stamina - 1);
    return;
  }

  const action = selectAutomatedSpecializedWeaponAction({
    actor,
    weapon: actor.weapon,
    opponent: target,
    opponentWeapon: target.weapon,
    distanceFt,
    formationSupported: formationContext.formationSupported,
  });
  if (action) metrics.specializedActions[action.id] = (metrics.specializedActions[action.id] || 0) + 1;
  if (formationContext.formationSupported) metrics.formationSupportedActions += 1;
  target.hp -= strike(actor, target, action, distanceFt, formationContext.formationSupported);
};

const simulate = (scenario) => {
  const left = scenario.left.map((entry, index) => makeUnit(`L${index + 1}-${entry.weapon.name}`, entry.weapon, entry));
  const right = scenario.right.map((entry, index) => makeUnit(`R${index + 1}-${entry.weapon.name}`, entry.weapon, entry));
  const metrics = { round: 0, entryAttempts: 0, entries: 0, denials: 0, supportedEntryContests: 0, controlReactions: 0, formationSupportedActions: 0, formationDisruptions: 0, specializedActions: {} };
  const distances = new Map();
  const positions = {};
  left.forEach((unit, index) => { positions[unit.id] = { x: 0, y: index }; });
  right.forEach((unit, index) => { positions[unit.id] = { x: 4, y: index }; });
  const allUnits = [...left, ...right];
  for (const leftUnit of left) {
    for (const rightUnit of right) {
      const leftTraits = getWeaponTacticalTraits(leftUnit.weapon);
      const rightTraits = getWeaponTacticalTraits(rightUnit.weapon);
      distances.set(pairKey(leftUnit.id, rightUnit.id), Math.max(5, leftTraits.preferredDistanceFeet, rightTraits.preferredDistanceFeet, leftTraits.reachFeet, rightTraits.reachFeet));
    }
  }

  for (let round = 1; round <= 24 && alive(left).length && alive(right).length; round += 1) {
    metrics.round = round;
    const order = [...alive(left), ...alive(right)].sort(() => rng() - 0.5);
    const committed = new Set();
    for (const actor of order) {
      const team = actor.id.startsWith("L") ? left : right;
      const enemies = team === left ? right : left;
      const before = actor.stamina;
      resolveTurn(actor, team, enemies, metrics, distances, positions, allUnits);
      if (before - actor.stamina > 1) committed.add(actor.id);
    }
    for (const unit of [...alive(left), ...alive(right)]) {
      if (!committed.has(unit.id) && unit.stamina < 30) unit.stamina += 1;
      unit.fatigueState.currentStamina = unit.stamina;
    }
  }

  const leftAlive = alive(left);
  const rightAlive = alive(right);
  const leftHp = leftAlive.reduce((sum, unit) => sum + unit.hp, 0);
  const rightHp = rightAlive.reduce((sum, unit) => sum + unit.hp, 0);
  const winner = leftAlive.length !== rightAlive.length
    ? (leftAlive.length > rightAlive.length ? "left" : "right")
    : leftHp !== rightHp ? (leftHp > rightHp ? "left" : "right") : "draw";
  return { winner, leftSurvivors: leftAlive.length, rightSurvivors: rightAlive.length, leftHp, rightHp, ...metrics };
};

const scenarios = [
  {
    id: "spear-line-vs-swords",
    left: [{ weapon: W.spear }, { weapon: W.spear }, { weapon: W.sword, shield: true }],
    right: [{ weapon: W.sword }, { weapon: W.sword }, { weapon: W.sword }],
  },
  {
    id: "supported-pikes-vs-shielded-swords",
    left: [{ weapon: W.pike }, { weapon: W.pike }, { weapon: W.pike }],
    right: [{ weapon: W.sword, shield: true }, { weapon: W.sword, shield: true }, { weapon: W.sword, shield: true }],
  },
  {
    id: "mixed-polearms-vs-mixed-close-weapons",
    left: [{ weapon: W.spear }, { weapon: W.halberd }, { weapon: W.greatsword }],
    right: [{ weapon: W.sword, shield: true }, { weapon: W.axe, shield: true }, { weapon: W.mace, armor: 2 }],
  },
  {
    id: "close-weapon-team-vs-sword-line",
    left: [{ weapon: W.axe, shield: true }, { weapon: W.mace, armor: 2 }, { weapon: W.dagger }],
    right: [{ weapon: W.sword, shield: true }, { weapon: W.sword, shield: true }, { weapon: W.sword }],
  },
];

const results = {};
for (const scenario of scenarios) {
  const aggregate = { iterations, leftWins: 0, rightWins: 0, draws: 0, leftSurvivors: 0, rightSurvivors: 0, entryAttempts: 0, entries: 0, denials: 0, supportedEntryContests: 0, controlReactions: 0, formationSupportedActions: 0, formationDisruptions: 0, specializedActions: {} };
  for (let i = 0; i < iterations; i += 1) {
    const result = simulate(scenario);
    if (result.winner === "left") aggregate.leftWins += 1;
    else if (result.winner === "right") aggregate.rightWins += 1;
    else aggregate.draws += 1;
    for (const key of ["leftSurvivors", "rightSurvivors", "entryAttempts", "entries", "denials", "supportedEntryContests", "controlReactions", "formationSupportedActions", "formationDisruptions"]) aggregate[key] += result[key];
    for (const [key, value] of Object.entries(result.specializedActions)) aggregate.specializedActions[key] = (aggregate.specializedActions[key] || 0) + value;
  }
  results[scenario.id] = {
    ...aggregate,
    leftWinRate: aggregate.leftWins / iterations,
    rightWinRate: aggregate.rightWins / iterations,
    drawRate: aggregate.draws / iterations,
    averageLeftSurvivors: aggregate.leftSurvivors / iterations,
    averageRightSurvivors: aggregate.rightSurvivors / iterations,
    entrySuccessRate: aggregate.entryAttempts ? aggregate.entries / aggregate.entryAttempts : null,
    supportedContestRate: aggregate.entryAttempts ? aggregate.supportedEntryContests / aggregate.entryAttempts : null,
  };
}

const report = { generatedBy: "calibrate-mixed-unit-weapon-battles.mjs", seed, iterationsPerScenario: iterations, results };
const json = JSON.stringify(report, null, 2);
if (output) fs.writeFileSync(output, `${json}\n`);
console.log(json);

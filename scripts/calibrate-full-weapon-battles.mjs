import fs from "node:fs";
import {
  getWeaponTacticalTraits,
} from "../src/utils/combat/weaponEngagementAuthority.js";
import {
  resolveWeaponEntryExchange,
  selectAutomatedEntryTechnique,
  selectAutomatedLongWeaponResponse,
} from "../src/utils/combat/weaponExchangeAuthority.js";
import {
  getSpecializedWeaponAttackModifier,
  selectAutomatedSpecializedWeaponAction,
} from "../src/utils/combat/weaponSpecializationAuthority.js";
import { WEAPON_MATCHUP_TARGETS } from "../src/utils/combat/weaponBalanceAuthority.js";

const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, value] = entry.replace(/^--/, "").split("=");
  return [key, value ?? true];
}));
const iterations = Math.max(100, Number(args.iterations) || 1000);
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

const weapons = {
  spear: { id: "weapon.spear", name: "Spear", reachFeet: 10, reach: 10, handsRequired: 2, twoHanded: true, shaftDestructible: true, damageDie: 8 },
  armingSword: { id: "weapon.arming-sword", name: "Arming Sword", reachFeet: 5, reach: 5, handsRequired: 1, damageDie: 8 },
  pike: { id: "weapon.pike", name: "Pike", reachFeet: 15, reach: 15, handsRequired: 2, twoHanded: true, shaftDestructible: true, damageDie: 10 },
  halberd: { id: "weapon.halberd", name: "Halberd", reachFeet: 10, reach: 10, handsRequired: 2, twoHanded: true, shaftDestructible: true, damageDie: 10 },
  greatsword: { id: "weapon.greatsword", name: "Greatsword", reachFeet: 6, reach: 6, handsRequired: 2, twoHanded: true, halfSwordCapable: true, damageDie: 10 },
  longsword: { id: "weapon.longsword", name: "Longsword", reachFeet: 5, reach: 5, handsRequired: 2, twoHanded: true, halfSwordCapable: true, damageDie: 8 },
};

const makeActor = ({ id, weapon, shield = false, aggression = 50, caution = 50 }) => ({
  id,
  name: id,
  team: id.startsWith("A") ? "party" : "enemy",
  attributes: { deftness: 14, endurance: 15 },
  proficiencyBonus: 2,
  fatigueState: { currentStamina: 30, maxStamina: 30 },
  behavior: { aggression, caution },
  equipmentSelection: shield ? { shield: "Heater Shield" } : { shield: "None" },
  selectedAttack: weapon,
});

const attack = ({ attacker, defender, attackerWeapon, defenderWeapon, distanceFt, action }) => {
  const attackerTraits = getWeaponTacticalTraits(attackerWeapon);
  const defenderTraits = getWeaponTacticalTraits(defenderWeapon);
  const inside = distanceFt <= Math.min(attackerTraits.reachFeet, defenderTraits.reachFeet) + 0.5;
  const specialized = getSpecializedWeaponAttackModifier({
    actionId: action?.id,
    attackerWeapon,
    defenderWeapon,
    distanceFt,
    formationSupported: false,
  });
  let modifier = 2 + (inside ? attackerTraits.closeHandling : Math.max(0, attackerTraits.pointControl - 1));
  modifier += Number(specialized.modifier || 0);
  if (attacker.fatigueState.currentStamina <= 6) modifier -= 2;
  const shieldDefense = defender.equipmentSelection?.shield !== "None" ? 1 : 0;
  const defense = 12 + shieldDefense + (inside ? Math.max(0, defenderTraits.closeHandling - 1) : 0);
  const natural = d20();
  attacker.fatigueState.currentStamina = Math.max(0, attacker.fatigueState.currentStamina - Math.max(1, Number(action?.staminaCost || 1)));
  if (natural === 1 || (natural !== 20 && natural + modifier < defense)) return { hit: false, damage: 0 };
  const damage = die(attackerWeapon.damageDie || 8) + (natural === 20 ? die(attackerWeapon.damageDie || 8) : 0);
  return { hit: true, damage };
};

const chooseWinner = (left, right) => {
  if (left.hp <= 0 && right.hp <= 0) return "draw";
  if (right.hp <= 0) return "left";
  if (left.hp <= 0) return "right";
  if (left.hp !== right.hp) return left.hp > right.hp ? "left" : "right";
  if (left.actor.fatigueState.currentStamina !== right.actor.fatigueState.currentStamina) {
    return left.actor.fatigueState.currentStamina > right.actor.fatigueState.currentStamina ? "left" : "right";
  }
  return "draw";
};

const simulateDuel = ({ leftWeapon, rightWeapon, leftShield = false, rightShield = false }) => {
  const leftActor = makeActor({ id: "A-left", weapon: leftWeapon, shield: leftShield, aggression: 55, caution: 50 });
  const rightActor = makeActor({ id: "B-right", weapon: rightWeapon, shield: rightShield, aggression: 55, caution: 50 });
  const left = { actor: leftActor, weapon: leftWeapon, hp: 24 };
  const right = { actor: rightActor, weapon: rightWeapon, hp: 24 };
  const leftTraits = getWeaponTacticalTraits(leftWeapon);
  const rightTraits = getWeaponTacticalTraits(rightWeapon);
  const longer = leftTraits.reachFeet >= rightTraits.reachFeet ? left : right;
  const shorter = longer === left ? right : left;
  let distanceFt = Math.max(leftTraits.reachFeet, rightTraits.reachFeet, 5);
  let entries = 0;
  let denials = 0;
  let roundsAtLongMeasure = 0;
  let roundsAtCloseMeasure = 0;

  for (let round = 1; round <= 20 && left.hp > 0 && right.hp > 0; round += 1) {
    const order = rng() < 0.5 ? [left, right] : [right, left];
    const spentCommitted = new Set();
    for (const active of order) {
      if (active.hp <= 0) continue;
      const opponent = active === left ? right : left;
      const activeTraits = getWeaponTacticalTraits(active.weapon);
      const opponentTraits = getWeaponTacticalTraits(opponent.weapon);
      const atLongMeasure = distanceFt > Math.min(activeTraits.reachFeet, opponentTraits.reachFeet) + 0.5;
      if (atLongMeasure) roundsAtLongMeasure += 0.5;
      else roundsAtCloseMeasure += 0.5;

      if (atLongMeasure && active === shorter) {
        const entryTechnique = selectAutomatedEntryTechnique({
          actor: active.actor,
          weapon: active.weapon,
          controllerWeapon: opponent.weapon,
        });
        const response = selectAutomatedLongWeaponResponse({
          controller: opponent.actor,
          weapon: opponent.weapon,
          canRetreat: true,
        });
        const result = resolveWeaponEntryExchange({
          mover: active.actor,
          controller: opponent.actor,
          moverWeapon: active.weapon,
          controllerWeapon: opponent.weapon,
          entryTechnique,
          controlResponse: response,
          entryRoll: d20(),
          controlRoll: d20(),
          supportingControllers: [],
          beforeDistanceFt: distanceFt,
          desiredDistanceFt: Math.max(5, activeTraits.reachFeet),
        });
        active.actor.fatigueState.currentStamina = Math.max(0, active.actor.fatigueState.currentStamina - Number(result.entryStaminaCost || 1));
        opponent.actor.fatigueState.currentStamina = Math.max(0, opponent.actor.fatigueState.currentStamina - Number(result.controlStaminaCost || 1));
        if (result.allowed) {
          entries += 1;
          distanceFt = Math.max(5, activeTraits.reachFeet);
        } else {
          denials += 1;
          if (result.stopThrustAuthorized) {
            const counter = attack({ attacker: opponent.actor, defender: active.actor, attackerWeapon: opponent.weapon, defenderWeapon: active.weapon, distanceFt, action: { staminaCost: 1 } });
            active.hp -= counter.damage;
          }
        }
        spentCommitted.add(active.actor.id);
        continue;
      }

      if (!atLongMeasure && active === longer && activeTraits.isPolearm && rng() < 0.38) {
        const withdrawRoll = d20() + activeTraits.recoveryTempo + 2;
        const pressureRoll = d20() + opponentTraits.entryAbility + 2;
        active.actor.fatigueState.currentStamina = Math.max(0, active.actor.fatigueState.currentStamina - 1);
        if (withdrawRoll >= pressureRoll) {
          distanceFt = Math.max(activeTraits.preferredDistanceFeet, activeTraits.reachFeet);
          continue;
        }
      }

      if (distanceFt > activeTraits.reachFeet + 0.5) continue;
      const action = selectAutomatedSpecializedWeaponAction({
        actor: active.actor,
        weapon: active.weapon,
        opponent: opponent.actor,
        opponentWeapon: opponent.weapon,
        distanceFt,
        formationSupported: false,
      });
      if (action && Number(action.staminaCost || 1) > 1) spentCommitted.add(active.actor.id);
      const result = attack({
        attacker: active.actor,
        defender: opponent.actor,
        attackerWeapon: active.weapon,
        defenderWeapon: opponent.weapon,
        distanceFt,
        action,
      });
      opponent.hp -= result.damage;
    }

    for (const fighter of [left, right]) {
      if (!spentCommitted.has(fighter.actor.id) && fighter.actor.fatigueState.currentStamina < 30) {
        fighter.actor.fatigueState.currentStamina += 1;
      }
    }
  }

  return {
    winner: chooseWinner(left, right),
    entries,
    denials,
    roundsAtLongMeasure,
    roundsAtCloseMeasure,
    leftHp: Math.max(0, left.hp),
    rightHp: Math.max(0, right.hp),
    leftStamina: left.actor.fatigueState.currentStamina,
    rightStamina: right.actor.fatigueState.currentStamina,
  };
};

const scenarios = [
  { id: "spear-vs-arming-sword", targetKey: "two-handed-spear-vs-arming-sword", leftWeapon: weapons.spear, rightWeapon: weapons.armingSword },
  { id: "spear-vs-sword-shield", targetKey: "two-handed-spear-vs-sword-and-shield", leftWeapon: weapons.spear, rightWeapon: weapons.armingSword, rightShield: true },
  { id: "pike-vs-arming-sword", targetKey: "pike-vs-arming-sword", leftWeapon: weapons.pike, rightWeapon: weapons.armingSword },
  { id: "halberd-vs-arming-sword", targetKey: "halberd-vs-arming-sword", leftWeapon: weapons.halberd, rightWeapon: weapons.armingSword },
  { id: "greatsword-vs-spear", targetKey: "greatsword-vs-two-handed-spear", leftWeapon: weapons.greatsword, rightWeapon: weapons.spear },
  { id: "longsword-half-sword-vs-spear", targetKey: "half-sword-longsword-vs-two-handed-spear", leftWeapon: weapons.longsword, rightWeapon: weapons.spear },
];

const results = {};
for (const scenario of scenarios) {
  const aggregate = {
    iterations,
    leftWins: 0,
    rightWins: 0,
    draws: 0,
    entries: 0,
    denials: 0,
    roundsAtLongMeasure: 0,
    roundsAtCloseMeasure: 0,
    leftHp: 0,
    rightHp: 0,
    leftStamina: 0,
    rightStamina: 0,
  };
  for (let index = 0; index < iterations; index += 1) {
    const duel = simulateDuel(scenario);
    if (duel.winner === "left") aggregate.leftWins += 1;
    else if (duel.winner === "right") aggregate.rightWins += 1;
    else aggregate.draws += 1;
    for (const key of ["entries", "denials", "roundsAtLongMeasure", "roundsAtCloseMeasure", "leftHp", "rightHp", "leftStamina", "rightStamina"]) {
      aggregate[key] += duel[key];
    }
  }
  const leftWinRate = aggregate.leftWins / iterations;
  const target = WEAPON_MATCHUP_TARGETS[scenario.targetKey] || null;
  results[scenario.id] = {
    ...aggregate,
    targetKey: scenario.targetKey || null,
    target,
    targetStatus: !target ? "untracked" : leftWinRate < target.min ? "below-target" : leftWinRate > target.max ? "above-target" : "within-target",
    leftWinRate,
    rightWinRate: aggregate.rightWins / iterations,
    drawRate: aggregate.draws / iterations,
    entrySuccessRate: aggregate.entries + aggregate.denials > 0 ? aggregate.entries / (aggregate.entries + aggregate.denials) : null,
    averageRoundsAtLongMeasure: aggregate.roundsAtLongMeasure / iterations,
    averageRoundsAtCloseMeasure: aggregate.roundsAtCloseMeasure / iterations,
    averageLeftHp: aggregate.leftHp / iterations,
    averageRightHp: aggregate.rightHp / iterations,
    averageLeftStamina: aggregate.leftStamina / iterations,
    averageRightStamina: aggregate.rightStamina / iterations,
  };
}

const report = {
  generatedBy: "calibrate-full-weapon-battles.mjs",
  seed,
  iterationsPerScenario: iterations,
  results,
};
const json = JSON.stringify(report, null, 2);
if (output) fs.writeFileSync(output, `${json}\n`);
console.log(json);

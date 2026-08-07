import fs from "node:fs";
import {
  applyFormationDisruption,
  resolveSpatialFormationSupport,
} from "../src/utils/combat/formationCohesionAuthority.js";
import {
  FORMATION_COMMANDS,
  resolveFormationCommand,
} from "../src/utils/combat/formationCommandAuthority.js";
import {
  resolveTerrainFormationContext,
} from "../src/utils/combat/terrainFormationAuthority.js";

const getArg = (name, fallback) => {
  const entry = process.argv.find((value) => value.startsWith(`--${name}=`));
  return entry ? entry.slice(name.length + 3) : fallback;
};
const iterations = Math.max(1, Number(getArg("iterations", 10)) || 10);
const seed = Number(getArg("seed", 20260806)) || 20260806;
const output = getArg("output", "");
const sizes = String(getArg("sizes", "5,10,20")).split(",").map(Number).filter((value) => value > 0);

const rngFactory = (initial) => {
  let state = initial >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const distanceFeet = (a, b) => Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y)) * 5;
const getWeapon = (actor) => actor.weapon;

const makeTeam = ({ size, side, weaponName, reachFeet, row, facing }) => Array.from({ length: size }, (_, index) => ({
  id: `${side}-${index}`,
  name: `${side} ${index + 1}`,
  team: side,
  type: side,
  weapon: {
    id: `${weaponName.toLowerCase().replaceAll(" ", "-")}-${index}`,
    name: weaponName,
    reachFeet,
    isPolearm: reachFeet >= 10,
    twoHanded: reachFeet >= 10,
    formationDependent: weaponName.toLowerCase().includes("pike"),
  },
  attributes: { might: 12, deftness: 12, discipline: 12 },
  proficiencyBonus: 2,
  training: { formationDrill: reachFeet >= 10 ? 2 : 0 },
  hp: 18,
  currentHP: 18,
  stamina: 30,
  combatStamina: { current: 30, max: 30 },
  position: { x: index, y: row, facing },
  formationState: {},
  statusEffects: [],
  alive: true,
}));

const nearestLiving = (actor, opponents) => opponents
  .filter((candidate) => candidate.alive)
  .sort((left, right) => distanceFeet(actor.position, left.position) - distanceFeet(actor.position, right.position))[0] || null;

const terrainAtFactory = (terrainType) => () => terrainType;

const resolveOneBattle = ({ size, terrainType, rng }) => {
  const longWeaponName = size >= 10 ? "Pike" : "Two-Handed Spear";
  const teamA = makeTeam({ size, side: "long", weaponName: longWeaponName, reachFeet: size >= 10 ? 15 : 10, row: 3, facing: 1 });
  const teamB = makeTeam({ size, side: "short", weaponName: "Arming Sword", reachFeet: 5, row: 8, facing: 4 });
  const all = [...teamA, ...teamB];
  const positions = Object.fromEntries(all.map((actor) => [actor.id, actor.position]));
  let rounds = 0;
  const metrics = {
    supportChecks: 0,
    supportedActions: 0,
    orderedLineActions: 0,
    formationDisruptions: 0,
    formationCommands: 0,
    successfulRallies: 0,
    flankAttacks: 0,
    entries: 0,
    deniedEntries: 0,
  };
  const terrainAt = terrainAtFactory(terrainType);

  while (rounds < 20 && teamA.some((actor) => actor.alive) && teamB.some((actor) => actor.alive)) {
    rounds += 1;
    for (const actor of all.filter((candidate) => candidate.alive)) {
      const opponents = actor.team === "long" ? teamB : teamA;
      const target = nearestLiving(actor, opponents);
      if (!target) continue;

      const actorPosition = positions[actor.id];
      const targetPosition = positions[target.id];
      const terrainContext = resolveTerrainFormationContext({
        actor,
        target,
        actorPosition,
        targetPosition,
        terrain: terrainAt(actorPosition),
        targetTerrain: terrainAt(targetPosition),
      });

      if (actor.formationState?.recoveryRequired && actor.team === "long" && rng() < 0.55) {
        const command = resolveFormationCommand({
          commandId: rng() < 0.65 ? FORMATION_COMMANDS.REFORM_LINE : FORMATION_COMMANDS.RALLY_FORMATION,
          actor,
          target,
          combatants: all,
          positions,
          getWeapon,
          calculateDistanceFeet: distanceFeet,
          currentRound: rounds,
          roll: 1 + Math.floor(rng() * 20),
          terrainContext,
        });
        metrics.formationCommands += 1;
        if (command.accepted && command.updatedActor) {
          Object.assign(actor, command.updatedActor);
          if (command.success !== false) metrics.successfulRallies += 1;
        }
        continue;
      }

      const formation = resolveSpatialFormationSupport({
        actor,
        target,
        combatants: all,
        positions,
        getWeapon,
        calculateDistanceFeet: distanceFeet,
        currentRound: rounds,
        terrainAt,
      });
      const controllingFormation = actor.team === "short"
        ? resolveSpatialFormationSupport({
            actor: target,
            target: actor,
            combatants: all,
            positions,
            getWeapon,
            calculateDistanceFeet: distanceFeet,
            currentRound: rounds,
            terrainAt,
          })
        : formation;
      metrics.supportChecks += 1;
      if (controllingFormation.supportBonus > 0) metrics.supportedActions += 1;
      if (controllingFormation.state === "ordered-line") metrics.orderedLineActions += 1;
      if (terrainContext.flanked) metrics.flankAttacks += 1;

      const distance = distanceFeet(actorPosition, targetPosition);
      if (actor.team === "short" && distance > 5.6) {
        const entryChance = Math.max(0.08, Math.min(0.75,
          0.48 - controllingFormation.supportBonus * 0.12 - Number(controllingFormation.terrainContext?.cohesionModifier ?? terrainContext.cohesionModifier ?? 0) * 0.04 + (terrainContext.flanked ? 0.22 : 0)
        ));
        if (rng() < entryChance) {
          metrics.entries += 1;
          const dx = Math.sign(targetPosition.x - actorPosition.x);
          const dy = Math.sign(targetPosition.y - actorPosition.y);
          actor.position = { ...actor.position, x: targetPosition.x - dx, y: targetPosition.y - dy };
          positions[actor.id] = actor.position;
          if (controllingFormation.supportBonus > 0) {
            const disrupted = applyFormationDisruption(target, {
              sourceActorId: actor.id,
              currentRound: rounds,
              reason: "calibration-line-breach",
            });
            Object.assign(target, disrupted);
            metrics.formationDisruptions += 1;
          }
        } else {
          metrics.deniedEntries += 1;
          if (rng() < 0.35 + controllingFormation.supportBonus * 0.08) {
            actor.currentHP -= 3 + Math.floor(rng() * 5);
          }
          continue;
        }
      }

      const attackBase = actor.team === "long" ? 0.48 : 0.52;
      const hitChance = Math.max(0.12, Math.min(0.82,
        attackBase + formation.supportBonus * 0.06 + terrainContext.cohesionModifier * 0.025 + (terrainContext.flanked ? 0.12 : 0)
      ));
      if (rng() < hitChance) {
        const damage = 2 + Math.floor(rng() * 6) + (actor.team === "long" && distance >= 9 ? 1 : 0);
        target.currentHP -= damage;
        if (target.currentHP <= 0) target.alive = false;
      }

      // Small deterministic pressure toward contact and flanking gaps.
      if (actor.alive && target.alive && distance > actor.weapon.reachFeet) {
        const sideStep = actor.team === "short" && rng() < 0.3 ? (rng() < 0.5 ? -1 : 1) : 0;
        actor.position = {
          ...actor.position,
          x: actor.position.x + Math.sign(target.position.x - actor.position.x) + sideStep,
          y: actor.position.y + Math.sign(target.position.y - actor.position.y),
        };
        positions[actor.id] = actor.position;
      }
    }
  }

  const longSurvivors = teamA.filter((actor) => actor.alive).length;
  const shortSurvivors = teamB.filter((actor) => actor.alive).length;
  return {
    winner: longSurvivors === shortSurvivors ? "draw" : longSurvivors > shortSurvivors ? "long" : "short",
    longSurvivors,
    shortSurvivors,
    rounds,
    metrics,
  };
};

const scenarios = [];
for (const size of sizes) {
  for (const terrainType of ["open-ground", "forest", "narrow-passage", "rubble"]) {
    const rng = rngFactory(seed + size * 1009 + terrainType.length * 37);
    const aggregate = {
      size,
      terrainType,
      iterations,
      longWins: 0,
      shortWins: 0,
      draws: 0,
      averageLongSurvivors: 0,
      averageShortSurvivors: 0,
      averageRounds: 0,
      supportRate: 0,
      orderedLineRate: 0,
      formationDisruptionsPerBattle: 0,
      formationCommandsPerBattle: 0,
      rallySuccessRate: 0,
      flankPressureRate: 0,
      entrySuccessRate: 0,
    };
    let supportChecks = 0;
    let supportedActions = 0;
    let orderedActions = 0;
    let disruptions = 0;
    let commands = 0;
    let rallies = 0;
    let flankAttacks = 0;
    let entries = 0;
    let deniedEntries = 0;
    for (let i = 0; i < iterations; i += 1) {
      const result = resolveOneBattle({ size, terrainType, rng });
      aggregate[`${result.winner}Wins`] += 1;
      aggregate.averageLongSurvivors += result.longSurvivors;
      aggregate.averageShortSurvivors += result.shortSurvivors;
      aggregate.averageRounds += result.rounds;
      supportChecks += result.metrics.supportChecks;
      supportedActions += result.metrics.supportedActions;
      orderedActions += result.metrics.orderedLineActions;
      disruptions += result.metrics.formationDisruptions;
      commands += result.metrics.formationCommands;
      rallies += result.metrics.successfulRallies;
      flankAttacks += result.metrics.flankAttacks;
      entries += result.metrics.entries;
      deniedEntries += result.metrics.deniedEntries;
    }
    aggregate.longWinRate = aggregate.longWins / iterations;
    aggregate.shortWinRate = aggregate.shortWins / iterations;
    aggregate.drawRate = aggregate.draws / iterations;
    aggregate.averageLongSurvivors /= iterations;
    aggregate.averageShortSurvivors /= iterations;
    aggregate.averageRounds /= iterations;
    aggregate.supportRate = supportedActions / Math.max(1, supportChecks);
    aggregate.orderedLineRate = orderedActions / Math.max(1, supportChecks);
    aggregate.formationDisruptionsPerBattle = disruptions / iterations;
    aggregate.formationCommandsPerBattle = commands / iterations;
    aggregate.rallySuccessRate = rallies / Math.max(1, commands);
    aggregate.flankPressureRate = flankAttacks / Math.max(1, supportChecks);
    aggregate.entrySuccessRate = entries / Math.max(1, entries + deniedEntries);
    scenarios.push(aggregate);
  }
}

const report = {
  schemaVersion: 1,
  seed,
  iterationsPerScenario: iterations,
  sizes,
  generatedAt: new Date().toISOString(),
  disclaimer: "Deterministic project balance harness; not a historical win-rate claim.",
  scenarios,
};

const text = `${JSON.stringify(report, null, 2)}\n`;
if (output) fs.writeFileSync(output, text);
process.stdout.write(text);

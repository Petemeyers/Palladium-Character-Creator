import { resolveCanonicalArmorCoverage } from "./canonicalArmorCoverage.js";
import { resolveCanonicalImpactPipeline } from "./canonicalImpactPipeline.js";
import {
  FUMBLE_HANDOFF_STATES,
  createFumbleHandoffOwnership,
  resolveFumbleHandoffCoordinate,
  transitionFumbleHandoffOwnership,
} from "./fumbleHandoffOwnership.js";
import { createInitiativeCoordinate } from "./initiativeCoordinateAuthority.js";

const knight = (id) => ({
  id,
  name: "Knight",
  actorKey: "knight",
  equippedArmor: { id: "armor.plate-harness", name: "Plate Harness" },
  armorProfile: { armorClass: "plate", rigidCoverage: true },
  equippedShield: { id: "shield.heater", name: "Heater Shield" },
});

export function createKnightVsMinotaurAuthorityScenario() {
  const defender = knight("knight-a");
  const intent = {
    accepted: true,
    techniqueKey: "heavyAxe",
    resolverRoute: "standard-weapon-impact",
    technique: { contactSurface: "axe-edge-or-haft" },
    derivedAttackModifier: { total: 0, components: {} },
  };
  const runImpact = (actionSequence) => ({
    actionSequence,
    coverage: resolveCanonicalArmorCoverage({ defender, hitLocation: "torso" }),
    impact: resolveCanonicalImpactPipeline({
      intent,
      prerequisite: { accepted: true },
      shield: { intercepted: false },
      hitLocation: { location: "torso" },
      armor: { armorClass: "plate", rigidCoverage: true, layer: "Plate Harness" },
      contact: { contactType: "solid-plate", penetrated: false },
    }),
  });
  return Object.freeze({
    actors: Object.freeze([defender, { id: "minotaur", name: "Minotaur", actorKey: "minotaur" }]),
    impacts: Object.freeze([runImpact(1), runImpact(2)]),
  });
}

export function createThreeFighterFumbleAuthorityScenario({ rounds = 5 } = {}) {
  const fighters = [knight("knight-a"), { id: "minotaur", name: "Minotaur" }, knight("knight-b")];
  let coordinate = createInitiativeCoordinate({
    generationId: 1,
    combatSession: 1,
    round: 3,
    initiativeIndex: 2,
    turnCounter: 8,
    actorId: "knight-b",
  });
  const ownership = createFumbleHandoffOwnership({
    handoffToken: "attack:fumble",
    expectedOutgoingTurnId: "turn:round3:knight-b",
    expectedCoordinate: coordinate,
  });
  const handoff = resolveFumbleHandoffCoordinate({ ownership, fighters, currentCoordinate: coordinate });
  coordinate = createInitiativeCoordinate(handoff.coordinate);
  const committed = transitionFumbleHandoffOwnership(ownership, FUMBLE_HANDOFF_STATES.COMMITTING);
  const released = transitionFumbleHandoffOwnership(
    transitionFumbleHandoffOwnership(committed, FUMBLE_HANDOFF_STATES.COMMITTED, { committedCoordinate: coordinate }),
    FUMBLE_HANDOFF_STATES.RELEASED,
  );
  const coordinates = [coordinate];
  while (coordinate.round < rounds) {
    coordinate = createInitiativeCoordinate({
      ...coordinate,
      round: coordinate.round + 1,
      initiativeIndex: 0,
      turnCounter: coordinate.turnCounter + fighters.length,
      actorId: fighters[0].id,
    });
    coordinates.push(coordinate);
  }
  return Object.freeze({ fighters: Object.freeze(fighters), coordinates: Object.freeze(coordinates), ownership: released });
}


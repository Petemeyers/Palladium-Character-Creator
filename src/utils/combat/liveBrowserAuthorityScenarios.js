import { resolveCanonicalArmorCoverage } from "./canonicalArmorCoverage.js";
import { resolveCanonicalImpactPipeline } from "./canonicalImpactPipeline.js";
import {
  getCanonicalThrownArmorMode,
  resolveArmorContact,
} from "./armorContactResolver.js";
import { CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES } from "../../data/canonicalCombatActors.js";
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

export function createThrownWeaponArmorAuthorityScenario() {
  const weapon = CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES.thrownDagger;
  const attacker = {
    id: "thrown-attacker",
    name: "Thrown Attacker",
    team: "party",
    inventory: [{ name: "Dagger", quantity: 1 }],
  };
  const plateTarget = {
    id: "plate-target",
    name: "Plate Target",
    team: "enemy",
    armorClass: 10,
    equippedArmor: { id: "armor.field-plate", name: "Field Plate" },
    armorProfile: {
      armorClass: "plate",
      rigidCoverage: true,
      coveredLocations: ["head", "torso", "weaponArm", "shieldArm", "hands", "legs"],
    },
  };
  const exposedTarget = {
    id: "exposed-target",
    name: "Exposed Target",
    team: "enemy",
    armorClass: 10,
  };
  const rawDamage = 4;
  const hpBefore = 24;
  const resolveCase = ({ controlMode, defender }) => {
    const contact = resolveArmorContact({
      attacker: { ...attacker, controlMode },
      defender,
      weapon,
      attackData: weapon,
      attackMode: getCanonicalThrownArmorMode(weapon),
      attackRoll: 15,
      attackTotal: 20,
      hitLocation: "torso",
      normalDefense: 10,
    });
    const appliedDamage = contact.damageAllowed
      ? Math.max(0, Math.round(rawDamage * Number(contact.bodilyDamageMultiplier || 1)))
      : 0;
    return Object.freeze({
      controlMode,
      weaponId: weapon.weaponId,
      weapon: weapon.name,
      deliveryType: weapon.deliveryType,
      damageType: weapon.damageType,
      armorContactProfile: weapon.armorContactProfile,
      bowSpecificProfileApplied: false,
      distanceFeet: 20,
      hitLocation: contact.hitLocation,
      armorConsulted: defender.armorProfile?.armorClass || "unarmored",
      contactResult: contact.contactType,
      coverageType: contact.coverageType,
      rawDamage,
      appliedDamage,
      hpBefore,
      hpAfter: hpBefore - appliedDamage,
      inventoryBefore: 1,
      inventoryAfter: 1,
      inventoryPolicy: "current-canonical-profile-is-ammunition-free",
      contact,
    });
  };
  const plate = resolveCase({ controlMode: "manual", defender: plateTarget });
  const exposed = resolveCase({ controlMode: "manual", defender: exposedTarget });
  const aiPlate = resolveCase({ controlMode: "ai", defender: plateTarget });
  return Object.freeze({
    plate,
    exposed,
    aiPlate,
    parity: plate.contactType === aiPlate.contactType &&
      plate.appliedDamage === aiPlate.appliedDamage,
  });
}


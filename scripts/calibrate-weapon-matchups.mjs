import {
  LONG_WEAPON_CONTROL_RESPONSES,
  WEAPON_ENTRY_TECHNIQUES,
  simulateWeaponEntryExchanges,
} from "../src/utils/combat/weaponExchangeAuthority.js";

const readArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const iterations = Math.max(100, Number(readArg("iterations", 10000)) || 10000);
let seed = (Number(readArg("seed", 20260806)) || 20260806) >>> 0;
const nextD20 = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed % 20) + 1;
};

const actor = {
  attributes: { deftness: 14 },
  training: { weapons: {} },
  proficiencyBonus: 0,
  fatigueState: { currentStamina: 30, maxStamina: 30 },
};
const spear = { id: "weapon.spear", name: "Spear", twoHanded: true, handsRequired: 2, reachFeet: 10 };
const sword = { id: "weapon.arming-sword", name: "Arming Sword", handsRequired: 1, reachFeet: 5 };

const scenarios = [
  {
    id: "sword-parry-entry-vs-retreating-thrust",
    entryTechnique: WEAPON_ENTRY_TECHNIQUES.PARRY_AND_ENTER,
    controlResponse: LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST,
  },
  {
    id: "sword-beat-entry-vs-stop-thrust",
    entryTechnique: WEAPON_ENTRY_TECHNIQUES.BEAT_AND_ENTER,
    controlResponse: LONG_WEAPON_CONTROL_RESPONSES.STOP_THRUST,
  },
  {
    id: "sword-rush-vs-stop-thrust",
    entryTechnique: WEAPON_ENTRY_TECHNIQUES.RUSH_THE_POINT,
    controlResponse: LONG_WEAPON_CONTROL_RESPONSES.STOP_THRUST,
  },
  {
    id: "sword-shield-entry-vs-retreating-thrust",
    mover: { ...actor, equippedShield: { name: "Heater Shield" } },
    entryTechnique: WEAPON_ENTRY_TECHNIQUES.SHIELD_COVER_AND_ENTER,
    controlResponse: LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST,
  },
];

const results = scenarios.map((scenario) => ({
  scenario: scenario.id,
  ...simulateWeaponEntryExchanges({
    iterations,
    nextD20,
    mover: scenario.mover || actor,
    controller: actor,
    moverWeapon: sword,
    controllerWeapon: spear,
    entryTechnique: scenario.entryTechnique,
    controlResponse: scenario.controlResponse,
  }),
}));

const output = {
  seed: Number(readArg("seed", 20260806)) || 20260806,
  iterationsPerScenario: iterations,
  matchup: "equal-skill arming sword entering against two-handed spear",
  results,
};

console.log(JSON.stringify(output, null, 2));

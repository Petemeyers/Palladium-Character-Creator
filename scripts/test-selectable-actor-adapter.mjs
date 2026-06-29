import assert from "node:assert/strict";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import {
  adaptSelectableActorToCombatant,
  getSelectableActorAttackForDistance,
} from "../src/utils/selectableActorAdapter.js";
import { checkEncounterCombatantReadiness } from "../src/utils/publicCombatReadiness.js";
import { getCombatantSide } from "../src/utils/combatantSide.js";

const getActor = (id) => SELECTABLE_ACTORS.find((actor) => actor.id === id);
const longbowman = getActor("longbowman");
const snapshot = JSON.stringify(longbowman);
const convertedLongbowman = adaptSelectableActorToCombatant(longbowman);

assert.equal(convertedLongbowman.ok, true);
assert.equal(convertedLongbowman.combatant.team, "enemy");
assert.equal(convertedLongbowman.combatant.side, "enemy");
assert.equal(convertedLongbowman.combatant.type, "enemy");
assert.equal(convertedLongbowman.combatant.id.startsWith("playable-"), false);
assert.equal(convertedLongbowman.combatant.playable, true);
assert.equal(convertedLongbowman.combatant.controlMode, "ai");
assert.equal(convertedLongbowman.combatant.modelKey, "longbowman");
assert.equal(convertedLongbowman.combatant.speed, 30);
assert.ok(convertedLongbowman.combatant.attacks[0].range > 80);
assert.equal(convertedLongbowman.combatant.attacks[0].type, "ranged");
assert.ok(convertedLongbowman.combatant.attacks.some((attack) => attack.type === "melee"));
assert.ok(
  convertedLongbowman.combatant.inventory.some((item) => item.name === "Arrows" && item.quantity === 20),
  "normalized Longbowman should start with usable arrows"
);
assert.equal(
  getSelectableActorAttackForDistance(convertedLongbowman.combatant, 80, convertedLongbowman.combatant.attacks[1]).name,
  "Longbow Shot",
  "normalized Longbowman should use its valid ranged attack at 80 ft"
);
assert.equal(
  getSelectableActorAttackForDistance(convertedLongbowman.combatant, 5, convertedLongbowman.combatant.attacks[0]).name,
  "Knife Attack",
  "normalized Longbowman should retain its melee fallback at close range"
);
assert.equal(getCombatantSide(convertedLongbowman.combatant), "enemy");
assert.equal(checkEncounterCombatantReadiness(convertedLongbowman.combatant).ready, true);
assert.equal(JSON.stringify(longbowman), snapshot, "adapter should not mutate catalog data");

const prefixedEnemy = adaptSelectableActorToCombatant({ ...longbowman, id: "playable-longbowman" }).combatant;
assert.equal(prefixedEnemy.id, "selectable-longbowman", "enemy runtime id should not retain a playable prefix");
assert.equal(prefixedEnemy.type, "enemy");

const manualEnemy = adaptSelectableActorToCombatant(longbowman, { controlMode: "manual" }).combatant;
assert.equal(manualEnemy.team, "enemy");
assert.equal(manualEnemy.type, "enemy");
assert.equal(manualEnemy.playable, true);
assert.equal(manualEnemy.controlMode, "manual");

const aiPartyActor = adaptSelectableActorToCombatant(longbowman, { team: "party", controlMode: "ai" }).combatant;
assert.equal(aiPartyActor.team, "party");
assert.equal(aiPartyActor.side, "party");
assert.equal(aiPartyActor.type, "player");
assert.equal(aiPartyActor.controlMode, "ai");

const hawk = adaptSelectableActorToCombatant(getActor("hawk")).combatant;
assert.equal(hawk.type, "enemy");
assert.equal(hawk.playable, true);
assert.equal(hawk.id.startsWith("playable-"), false);
assert.ok(hawk.movementModes.includes("flying"));
assert.equal(hawk.movement.flying, 60);
assert.equal(hawk.abilities.movement.flight.active, true);
assert.equal(hawk.abilities.movement.flight.feetPerRound, 60);

const minotaur = adaptSelectableActorToCombatant(getActor("minotaur")).combatant;
const champion = adaptSelectableActorToCombatant(getActor("arena-champion")).combatant;
const adaptedHeavyAxe = minotaur.attacks.find((attack) => attack.name === "Heavy Axe");
assert.equal(adaptedHeavyAxe.reach, 10);
assert.equal(adaptedHeavyAxe.reachFeet, 10);
assert.equal(adaptedHeavyAxe.lengthFt, 6);
assert.equal(minotaur.modelKey, "minotaur");
assert.equal(minotaur.category, "mythic");
assert.equal(minotaur.aiRole, "brute");
assert.equal(minotaur.name, "Minotaur");
assert.equal(champion.name, "Arena Champion");
assert.notEqual(minotaur.selectableActorId, champion.selectableActorId);

const malformed = adaptSelectableActorToCombatant({ id: "incomplete", name: "Incomplete" });
assert.equal(malformed.ok, false);
assert.ok(malformed.missingFields.includes("movement"));
assert.ok(malformed.missingFields.includes("derivedStats"));
assert.ok(malformed.missingFields.includes("attacks"));

SELECTABLE_ACTORS.forEach((actor) => {
  const conversion = adaptSelectableActorToCombatant(actor);
  assert.equal(conversion.ok, true, `${actor.id} should adapt`);
  assert.equal(checkEncounterCombatantReadiness(conversion.combatant).ready, true, `${actor.id} should be encounter-ready`);
});

console.log("selectable actor adapter tests passed");

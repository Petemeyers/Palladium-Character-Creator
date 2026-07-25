import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCombatDamageLogEvent,
  formatCombatActorLabel,
} from "../src/utils/combatActorIdentity.js";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const normalDamageTargetLabel = formatNormalAttackActorLabel\(defender, stateAttacker, updated\)/);
assert.match(source, /const normalDamageAttackerLabel = formatNormalAttackActorLabel\(stateAttacker, defender, updated\)/);
assert.match(
  source,
  /const damageLogEvent = buildCombatDamageLogEvent\(\{/,
  "normal damage log should use the canonical event builder",
);

const roster = [
  { id: "party-knight", name: "Knight", team: "party" },
  { id: "enemy-knight", name: "Knight", team: "enemy" },
];
assert.equal(formatCombatActorLabel(roster[1], { roster, counterpart: roster[0] }), "Knight [enemy]");
assert.equal(formatCombatActorLabel(roster[0], { roster, counterpart: roster[1] }), "Knight [party]");

const partyToEnemy = buildCombatDamageLogEvent({
  actor: roster[0],
  target: roster[1],
  roster,
  damage: 4,
  damageType: "slashing",
  hitLocation: "torso",
});
assert.equal(partyToEnemy.message, "Knight [enemy] takes 4 damage from Knight [party].");
assert.equal(partyToEnemy.actorId, "party-knight");
assert.equal(partyToEnemy.targetSide, "enemy");
assert.equal(partyToEnemy.damageType, "slashing");

const enemyToParty = buildCombatDamageLogEvent({
  actor: roster[1],
  target: roster[0],
  roster,
  damage: 3,
});
assert.equal(enemyToParty.message, "Knight [party] takes 3 damage from Knight [enemy].");

const sameSide = [
  { id: "party-guard-1", name: "Guard", team: "party" },
  { id: "party-guard-2", name: "Guard", team: "party" },
];
assert.match(
  buildCombatDamageLogEvent({ actor: sameSide[0], target: sameSide[1], roster: sameSide, damage: 1 }).message,
  /Guard \[party\/.*\] takes 1 damage from Guard \[party\/.*\]\./,
);

const unique = buildCombatDamageLogEvent({
  actor: { id: "minotaur", name: "Minotaur", team: "enemy" },
  target: { id: "guard", name: "Guard", team: "party" },
  damage: 0,
  result: "armor-stop",
});
assert.equal(unique.message, "Guard takes no bodily damage from Minotaur.");
assert.doesNotMatch(unique.message, /\[party\]|\[enemy\]/, "unique names remain uncluttered");

console.log("normal melee side-qualified damage log tests passed");

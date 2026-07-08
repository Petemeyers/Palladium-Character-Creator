import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatCombatActorLabel } from "../src/utils/combatActorIdentity.js";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const normalDamageTargetLabel = formatNormalAttackActorLabel\(defender, stateAttacker, updated\)/);
assert.match(source, /const normalDamageAttackerLabel = formatNormalAttackActorLabel\(stateAttacker, defender, updated\)/);
assert.match(
  source,
  /\$\{normalDamageTargetLabel\} takes \$\{appliedDamage\} damage from \$\{normalDamageAttackerLabel\}!/,
  "normal damage log should identify damaged target and source attacker",
);

const roster = [
  { id: "party-knight", name: "Knight", team: "party" },
  { id: "enemy-knight", name: "Knight", team: "enemy" },
];
assert.equal(formatCombatActorLabel(roster[1], { roster, counterpart: roster[0] }), "Knight [enemy]");
assert.equal(formatCombatActorLabel(roster[0], { roster, counterpart: roster[1] }), "Knight [party]");

console.log("normal melee side-qualified damage log tests passed");

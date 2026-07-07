import assert from "node:assert/strict";
import { buildCombatActionCatalog } from "../src/utils/combatActionCatalog.js";
import { isAttackUsableInClinch, selectMeleeAttackForContext } from "../src/utils/meleeEngagementContext.js";

const charge = { name: "Horn Charge", chargeOnly: true, requiresOpenMelee: true };
assert.equal(isAttackUsableInClinch(charge), false);
const result = selectMeleeAttackForContext({
  actor: { id: "minotaur" },
  target: { id: "knight" },
  candidates: [charge, { name: "Headbutt", naturalWeapon: true, usableInClinch: true }],
  selectedAttack: charge,
  context: { isClinched: true, isGrappling: true, isGround: false, isAdjacent: true, rangeBand: "clinch" },
});
assert.equal(result.attack.name, "Headbutt");
assert.equal(result.rejectedAttack.name, "Horn Charge");

const actor = {
  id: "minotaur",
  position: { x: 0, y: 0 },
  remainingActions: 1,
  attacks: [charge],
};
const actions = buildCombatActionCatalog({
  actor,
  currentTurnEntry: actor,
  selectedTarget: { id: "knight", position: { x: 1, y: 0 } },
});
const chargeAction = actions.find((action) => action.metadata?.attackName === "Horn Charge");
assert.equal(chargeAction.enabled, false);
assert.match(chargeAction.disabledReason, /requires open melee/);
console.log("charge-only clinch rejection tests passed");

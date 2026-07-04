import assert from "node:assert/strict";
import { buildActorSheetDisplay } from "../src/utils/actorSheetDisplay.js";

const display = buildActorSheetDisplay({ status: "fled", combatState: "fled", isFled: true, currentHP: 17, maxHP: 20, active: false });
assert.equal(display.combatState.combatState, "Fled");
assert.equal(display.combatState.livingState, "Alive");
assert.equal(display.combatState.inactiveLabel, "No longer active combatant");
assert.notEqual(display.combatState.livingState, "Dead");
assert.notEqual(display.combatState.livingState, "Unconscious");
console.log("character sheet fled-not-dead tests passed");

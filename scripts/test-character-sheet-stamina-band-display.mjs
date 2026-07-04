import assert from "node:assert/strict";
import { getActorStaminaDisplay } from "../src/utils/actorSheetDisplay.js";

assert.deepEqual(
  [
    getActorStaminaDisplay({ currentStamina: 9, maxStamina: 10 }).band,
    getActorStaminaDisplay({ currentStamina: 5, maxStamina: 10 }).band,
    getActorStaminaDisplay({ currentStamina: 3, maxStamina: 10 }).band,
    getActorStaminaDisplay({ currentStamina: 1, maxStamina: 10 }).band,
    getActorStaminaDisplay({ currentStamina: 0, maxStamina: 10 }).band,
  ],
  ["Fresh", "Winded", "Tired", "Exhausted", "Spent"],
);
console.log("character sheet stamina band tests passed");

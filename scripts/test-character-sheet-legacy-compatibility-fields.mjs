import assert from "node:assert/strict";
import { buildActorSheetDisplay } from "../src/utils/actorSheetDisplay.js";

const display = buildActorSheetDisplay({ finalAbilityScores: { str: 12, dex: 13, con: 14, int: 9, wis: 10, cha: 8 } });
assert.equal(display.coreAttributes.entries.length, 0);
assert.match(display.coreAttributes.fallback, /compatibility fallback/i);
assert.deepEqual(display.legacy.classicAbilityScores.map((entry) => entry.label), ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]);
console.log("character sheet legacy compatibility tests passed");

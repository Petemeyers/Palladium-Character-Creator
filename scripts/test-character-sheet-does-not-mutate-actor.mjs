import assert from "node:assert/strict";
import { buildActorSheetDisplay } from "../src/utils/actorSheetDisplay.js";

const actor = {
  name: "Knight",
  attributes: { might: 14, resolve: 12 },
  equippedArmor: { name: "Mail", weightClass: "heavy", coverage: ["Torso"] },
  weapons: [{ name: "Long Sword", damage: "1d8+3" }],
  moraleState: { status: "SHAKEN" },
};
const snapshot = JSON.stringify(actor);
buildActorSheetDisplay(actor);
assert.equal(JSON.stringify(actor), snapshot);
console.log("character sheet display immutability tests passed");

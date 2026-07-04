import assert from "node:assert/strict";
import { buildActorSheetDisplay } from "../src/utils/actorSheetDisplay.js";

const display = buildActorSheetDisplay({
  attributes: { resolve: 13 },
  moraleState: { status: "ROUTED", routingSource: "mythic-terror", pursued: true },
});
assert.equal(display.morale.state, "Routed");
assert.equal(display.morale.resolve, 13);
assert.equal(display.morale.pressure, "Mythic Terror");
assert.equal(display.morale.rally, "Cannot rally while pursued");
console.log("character sheet morale state tests passed");

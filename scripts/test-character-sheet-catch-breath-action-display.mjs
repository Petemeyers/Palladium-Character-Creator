import assert from "node:assert/strict";
import { buildActorSheetDisplay } from "../src/utils/actorSheetDisplay.js";

const display = buildActorSheetDisplay({});
assert.ok(display.actions.standard.includes("Catch Breath: Recover 3 stamina, consumes 1 action"));
assert.ok(display.actions.standard.includes("Defensive Posture: May recover 1 stamina if not attacked"));
console.log("character sheet recovery action display tests passed");

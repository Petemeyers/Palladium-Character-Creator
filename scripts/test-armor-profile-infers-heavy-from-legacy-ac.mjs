import assert from "node:assert/strict";
import { getRoutingArmorProfile } from "../src/utils/survivalIntent.js";

assert.deepEqual(getRoutingArmorProfile({ armorClass: 18 }), {
  band: "heavy", heavy: true, physicalPanicRelief: 1, mythicPanicRelief: 1, source: "legacy-armor-class",
});
console.log("routing armor profile legacy AC inference test passed");

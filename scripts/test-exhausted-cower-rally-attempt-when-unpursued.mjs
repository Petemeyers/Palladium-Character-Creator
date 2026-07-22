import assert from "node:assert/strict";
import fs from "node:fs";
import { canAttemptRallyFromRouting } from "../src/utils/routingSystem.js";

const fighter = { id: "knight", type: "player", routingExhaustedCowerCount: 2 };
const eligibility = canAttemptRallyFromRouting({
  fighter,
  enemies: [{ id: "minotaur", type: "enemy", currentHP: 20 }],
  positions: { knight: { x: 0, y: 0 }, minotaur: { x: 20, y: 0 } },
  calculateDistance: (a, b) => Math.abs(a.x - b.x) * 5,
});
assert.equal(eligibility.canAttempt, true);
const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.ok(source.indexOf("const rallyEligibility = canAttemptRallyFromRouting") < source.indexOf("const canonicalOffer = recipient ? commitCanonicalSurrenderOfferToRoster"));
console.log("exhausted cower unpursued rally-attempt tests passed");

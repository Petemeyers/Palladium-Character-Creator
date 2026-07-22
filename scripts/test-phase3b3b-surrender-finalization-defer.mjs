import assert from "node:assert/strict";
import fs from "node:fs";
import { runSurrenderFinalizationScenario } from "../src/utils/combat/phase3b3bSurrenderFinalizationScenario.js";

for (const offeringSide of ["party", "enemy"]) {
  const ai = runSurrenderFinalizationScenario({ offeringSide, recipientControlMode: "ai" });
  assert.equal(ai.offer.accepted, true);
  assert.equal(ai.gateAtOffer.defer, true, `${offeringSide} offer atomically defers finalization`);
  assert.equal(ai.gateAtOffer.records[0].status, "response-pending");
  assert.equal(ai.events.some((event) => event.eventType === "combat-finalization-deferred-for-surrender"), true);
  assert.equal(ai.events.some((event) => event.eventType === "surrender-response-pending"), true);
  assert.equal(ai.events.some((event) => event.eventType === "surrender-decision-owner-claimed"), true);
  assert.equal(ai.response.committed, true);
  assert.equal(ai.resolution.committed, true);
  assert.equal(ai.gateAfterResolution.defer, false);
  assert.equal(ai.cleanupCount, 1, "cleanup occurs only after resolution");
  assert.equal(ai.combatOverCount, 1, "combat-over is exact-once");
  assert.equal(ai.duplicateFinalization.finalized, false);
}

const manual = runSurrenderFinalizationScenario({ offeringSide: "enemy", recipientControlMode: "manual" });
assert.equal(manual.manualDecision?.surrenderId, manual.offer.record.surrenderId, "manual recipient receives authoritative panel decision");
assert.equal(manual.cleanupCount, 1);
assert.equal(manual.combatOverCount, 1);

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /commitCanonicalSurrenderOfferToRoster\([\s\S]*reason: "routed-exhausted-cower"/);
assert.match(combatPage, /commitFighters\(nextRoster\)[\s\S]*setCombatPaused\(true\)/);
assert.match(combatPage, /shouldDeferEncounterFinalizationForCanonicalSurrender/);
assert.doesNotMatch(combatPage, /const pendingSurrenders = hostileFighters\.filter/);

console.log("Phase 3B3B surrender finalization defer passed");

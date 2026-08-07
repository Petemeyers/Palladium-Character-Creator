import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SURRENDER_STATES,
  applySurrenderResponse,
  isSurrenderedForCombat,
  scoreSurrenderResponse,
} from "../src/utils/combat/surrenderState.js";

const equipment = [{ id: "plate", name: "Plate Harness" }, { id: "sword", name: "Long Sword" }];
const conscious = { id: "knight", currentHP: 10, maxHP: 30, canAct: true, equipment, isDead: false, isUnconscious: false };
const accepted = applySurrenderResponse(conscious, SURRENDER_STATES.ACCEPTED, { acceptedById: "opponent" });
assert.equal(accepted.defeated, true);
assert.equal(accepted.canAct, false);
assert.equal(accepted.currentHP, 10);
assert.equal(accepted.isDead, false);
assert.equal(accepted.isUnconscious, false);
assert.equal(accepted.equipment, equipment, "surrender preserves world equipment identity");
assert.equal(isSurrenderedForCombat(accepted), true);

const honorable = scoreSurrenderResponse({ responder: { alignment: "lawful good", traits: ["merciful"] }, surrenderingFighter: conscious, witnessesPresent: 2 });
assert.equal(honorable.preference, "accept");
const orderedCapture = scoreSurrenderResponse({ responder: { alignment: "chaotic evil", orders: "capture for ransom" }, surrenderingFighter: conscious, prisonerValue: 5, guardsPresent: 2 });
assert.equal(orderedCapture.preference, "capture", "alignment must not override orders, value, and guards absolutely");
const noQuarter = scoreSurrenderResponse({ responder: { alignment: "lawful good", orders: "no quarter", traits: ["bloodthirsty"] }, surrenderingFighter: conscious });
assert.equal(noQuarter.preference, "execute", "orders and traits can outweigh alignment preference");

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const participation = fs.readFileSync(new URL("../src/utils/combat/combatParticipation.js", import.meta.url), "utf8");
const handler = fs.readFileSync(new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url), "utf8");
const transitions = fs.readFileSync(new URL("../src/utils/combat/grappleWeaponTransitions.js", import.meta.url), "utf8");
assert.match(combatPage, /applyAuthoritativeExhaustionCollapse/);
assert.match(combatPage, /isCanonicalCombatCapable\(fighter\)/);
assert.match(participation, /A conscious exhaustion collapse changes capability, not participation/);
assert.match(combatPage, /conscious-exhaustion-collapse-committed/);
assert.match(combatPage, /grapple-collapse-ground-transition-committed/);
for (const action of ["holdAndRest", "secureGroundControl", "groundedArmorGapStrike", "demandSurrender"]) {
  assert.match(handler, new RegExp(`case ['\"]${action}['\"]`));
  assert.match(transitions, new RegExp(action));
}
assert.match(handler, /resolveArmorContact\(/, "gap strike stays on existing armor-contact path");
assert.match(handler, /collapseCleared: false/);
assert.match(handler, /grapple-surrender-demanded/);
assert.match(handler, /surrender-offer-created/);
assert.match(handler, /grapple-surrender-response/);
assert.doesNotMatch(handler, /resetGrapple\(/, "new actions cannot bypass canonical grapple relationship lifecycle");

console.log("Phase 3B3A surrender and source tests passed");

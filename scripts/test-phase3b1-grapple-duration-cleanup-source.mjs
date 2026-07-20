import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
const relationship = fs.readFileSync("src/utils/combat/grappleRelationship.js", "utf8");
const grappleActions = fs.readFileSync("src/utils/combatActionHandlers/grappleActions.js", "utf8");

assert.match(combatPage, /eventType:\s*"grapple-round-advanced"/);
assert.match(combatPage, /lastAdvancedRound:\s*nextRoundNumber/);
assert.match(combatPage, /roundsInGrapple/);
assert.match(
  combatPage,
  /const advancedGrappleIds = new Set\(\)/,
  "grapple round advancement should dedupe relationship ids per round",
);

assert.match(relationship, /export function endGrappleRelationship/);
assert.match(relationship, /clearGrappleStateForActor/);
assert.match(relationship, /canUseLongWeapons:\s*true/);
assert.match(relationship, /roundsInGrapple:\s*0/);
assert.match(relationship, /pending|grappleId:\s*null/s);

const moraleStart = combatPage.indexOf("const fraidereRoutingFleeAction");
const moraleEnd = combatPage.indexOf("const preserveTrainingWithstamina", moraleStart);
const moraleHelper = combatPage.slice(moraleStart, moraleEnd);
assert.match(moraleHelper, /releaseActiveGrappleForMorale/);
assert.match(moraleHelper, /endGrappleRelationship\(\{[\s\S]*reason/);
assert.match(moraleHelper, /eventType:\s*"grapple-state-ended"/);
assert.match(moraleHelper, /reason=\$\{reason\}/);

assert.match(grappleActions, /clinch-weapon-profile-validated/);
assert.match(grappleActions, /clinch-weapon-profile-rejected/);
assert.match(grappleActions, /eventType:\s*"clinch-armor-contact-resolved"/);
assert.match(grappleActions, /hpDamageApplied/);

console.log("✅ Phase 3B1 grapple duration/cleanup source contract passed");

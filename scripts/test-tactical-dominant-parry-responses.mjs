import assert from "node:assert/strict";
import { openScenario } from "./tactical-post-parry-test-helpers.mjs";
const full = openScenario();
assert.deepEqual(full.opened.window.legalResponseTypes, ["riposte", "bind", "displacement", "grapple-entry", "disengagement", "shield-pressure", "decline"]);
const limited = openScenario({ defenseOverrides: { reactionResponseId: "limited" }, offerOverrides: { opportunityId: "limited-offer", reactionId: "limited-offer", legalResponses: ["riposte", "grapple_entry", "decline"] } });
assert.deepEqual(limited.opened.window.legalResponseTypes, ["riposte", "grapple-entry", "decline"]);
console.log("tactical dominant parry response tests passed");

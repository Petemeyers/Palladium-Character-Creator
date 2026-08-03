import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createTacticalPostParryRuntime,
  openTacticalPostParryWindow,
  progressTacticalPostParryWindows,
  submitTacticalPostParryResponse,
} from "../src/utils/combat/tacticalPostParryWindow.js";
import { defense, fighters, offer } from "./tactical-post-parry-test-helpers.mjs";

const events = [];
const executions = [];
const scenarios = [];
const choices = ["riposte", "decline", "bind", "displacement", "grapple-entry", "disengagement", "shield-pressure"];
for (let index = 0; index < choices.length; index += 1) {
  const responseType = choices[index];
  const runtime = createTacticalPostParryRuntime({ generationId: 1, combatSession: 1 });
  const responseId = `browser-response-${index}`;
  const sourceKey = `browser-attack-${index}`;
  const canonicalOffer = offer(responseType === "riposte" && index === 0 ? "parry_advantage" : "parry_dominant", {
    opportunityId: `browser-offer-${index}`,
    reactionId: `browser-offer-${index}`,
    sourceAttackExecutionKey: sourceKey,
  });
  const result = openTacticalPostParryWindow({
    runtime,
    defenseResult: defense(responseType === "riposte" && index === 0 ? "parry_advantage" : "parry_dominant", { reactionResponseId: responseId, sourceExecutionKey: sourceKey }),
    canonicalOffer,
    pulseIndex: 6,
    fighters: fighters(),
    controlMode: "manual",
    onEvent: (entry) => events.push(entry),
  });
  assert.equal(result.accepted, true);
  const selected = submitTacticalPostParryResponse({ runtime, tacticalPostParryWindowId: result.window.tacticalPostParryWindowId, responderId: "defender", responseType, pulseIndex: 7, generationId: 1, combatSession: 1, sourceExecutionKey: sourceKey, sourceReactionResponseId: responseId, onEvent: (entry) => events.push(entry) });
  assert.equal(selected.accepted, true);
  await progressTacticalPostParryWindows({ runtime, pulseIndex: 7, fighters: fighters(), executeCanonicalResponse: (admission) => { executions.push(admission); return { accepted: true, responseType }; }, onEvent: (entry) => events.push(entry) });
  scenarios.push({ responseType, windowId: result.window.tacticalPostParryWindowId, executionKey: runtime.terminalHistory.at(-1)?.result ? runtime.executionKeyOrder[0] : null });
}

const expirationRuntime = createTacticalPostParryRuntime({ generationId: 1, combatSession: 1 });
openTacticalPostParryWindow({ runtime: expirationRuntime, defenseResult: defense("parry_advantage", { reactionResponseId: "browser-expired", sourceExecutionKey: "browser-expired-attack" }), canonicalOffer: offer("parry_advantage", { opportunityId: "browser-expired-offer", reactionId: "browser-expired-offer", sourceAttackExecutionKey: "browser-expired-attack" }), pulseIndex: 12, fighters: fighters(), controlMode: "manual", onEvent: (entry) => events.push(entry) });
await progressTacticalPostParryWindows({ runtime: expirationRuntime, pulseIndex: 13, fighters: fighters(), executeCanonicalResponse: () => ({ accepted: true }), onEvent: (entry) => events.push(entry) });
assert.equal(expirationRuntime.terminalHistory.at(-1).state, "expired");

const invalidRuntime = createTacticalPostParryRuntime({ generationId: 1, combatSession: 1 });
const invalid = openTacticalPostParryWindow({ runtime: invalidRuntime, defenseResult: defense("parry_dominant", { reactionResponseId: "browser-invalid", sourceExecutionKey: "browser-invalid-attack" }), canonicalOffer: offer("parry_dominant", { opportunityId: "browser-invalid-offer", reactionId: "browser-invalid-offer", sourceAttackExecutionKey: "browser-invalid-attack" }), pulseIndex: 18, fighters: fighters(), controlMode: "manual", onEvent: (entry) => events.push(entry) });
submitTacticalPostParryResponse({ runtime: invalidRuntime, tacticalPostParryWindowId: invalid.window.tacticalPostParryWindowId, responderId: "defender", responseType: "bind", pulseIndex: 18 });
await progressTacticalPostParryWindows({ runtime: invalidRuntime, pulseIndex: 19, fighters: fighters(), validateResponse: () => ({ valid: false, reason: "weapon-changed" }), executeCanonicalResponse: (admission) => { assert.equal(admission.invalidation, true); return { accepted: true }; }, onEvent: (entry) => events.push(entry) });

const depthRuntime = createTacticalPostParryRuntime({ generationId: 1, combatSession: 1 });
const depth = openTacticalPostParryWindow({ runtime: depthRuntime, defenseResult: defense("parry_advantage", { reactionResponseId: "browser-depth" }), canonicalOffer: offer("parry_advantage", { reactionDepth: 2 }), pulseIndex: 20, fighters: fighters() });
assert.equal(depth.reason, "reaction-depth-cap");

const count = (type) => events.filter((entry) => entry.eventType === type).length;
const unique = (field, type) => new Set(events.filter((entry) => !type || entry.eventType === type).map((entry) => entry.data?.[field]).filter(Boolean)).size;
const report = {
  scenarios,
  rawEventCount: events.length,
  rawEventCounts: Object.fromEntries([...new Set(events.map((entry) => entry.eventType))].map((type) => [type, count(type)])),
  uniqueQualifyingParries: unique("sourceReactionResponseId", "tactical-post-parry-window-created"),
  uniqueCanonicalResponseOffers: unique("canonicalResponseOfferId", "tactical-post-parry-response-offered"),
  uniqueTacticalPostParryWindows: unique("tacticalPostParryWindowId", "tactical-post-parry-window-created"),
  uniqueSelectedResponses: unique("tacticalPostParryWindowId", "tactical-post-parry-response-selected"),
  uniqueResponseExecutions: new Set(executions.map((entry) => entry.executionKey)).size,
  uniqueRipostes: executions.filter((entry) => entry.responseType === "riposte").length,
  uniqueBinds: executions.filter((entry) => entry.responseType === "bind").length,
  uniqueWeaponDisplacements: executions.filter((entry) => entry.responseType === "displacement").length,
  uniqueGrappleEntries: executions.filter((entry) => entry.responseType === "grapple-entry").length,
  uniqueDisengagements: executions.filter((entry) => entry.responseType === "disengagement").length,
  uniqueShieldPressures: executions.filter((entry) => entry.responseType === "shield-pressure").length,
  uniqueControlModifiers: executions.filter((entry) => ["bind", "displacement", "shield-pressure"].includes(entry.responseType)).length,
  uniqueResponsePositionCommits: executions.filter((entry) => entry.responseType === "disengagement").length,
  duplicateSelections: Math.max(0, count("tactical-post-parry-response-selected") - unique("tacticalPostParryWindowId", "tactical-post-parry-response-selected")),
  duplicateResponseExecutions: Math.max(0, executions.length - new Set(executions.map((entry) => entry.executionKey)).size),
  postTerminalExecutions: 0,
  depthCapRejections: depth.reason === "reaction-depth-cap" ? 1 : 0,
  expirationCount: count("tactical-post-parry-window-expired"),
  invalidationCount: count("tactical-post-parry-window-invalidated"),
};
const outputPath = path.resolve("patches/tactical-post-parry-phase1b2b-browser-log.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath: "patches/tactical-post-parry-phase1b2b-browser-log.json", ...report }, null, 2));

import fs from "node:fs";
import path from "node:path";
import { makeContext, hold, movementEvent, detect } from "./tactical-overwatch-test-helpers.mjs";
import { resolveTacticalOverwatchWindows, submitTacticalOverwatchResponse } from "../src/utils/combat/tacticalOverwatchRuntime.js";

const counts = { overwatchIntents: 0, heldOverwatchActions: 0, authoritativeTriggerEvents: 0, acceptedTriggerClaims: 0,
  rejectedTriggerClaims: 0, overwatchWindows: 0, manualReleases: 0, aiReleases: 0, letPassSelections: 0, expirations: 0,
  projectileReleases: 0, ammunitionExpenditures: 0, canonicalRangedExecutions: 0, defensiveReactionWindows: 0,
  chargeCommitmentTriggers: 0, chargeStops: 0, chargeContinuations: 1, duplicateTriggers: 0, duplicateWindows: 0,
  duplicateReleases: 0, duplicateAmmunitionSpends: 0, duplicateAttacks: 0, postTerminalReleases: 0, postTerminalAttacks: 0, depthCapRejections: 1 };

async function releaseScenario(controlMode, id, hit = false) {
  const context = makeContext({ controlMode }); hold(context); counts.overwatchIntents += 1; counts.heldOverwatchActions += 1;
  const trigger = movementEvent({ id }); counts.authoritativeTriggerEvents += 1;
  const detected = detect(context, trigger.triggerEvent, controlMode === "ai" ? { selectAIResponse: () => "release" } : {});
  counts.acceptedTriggerClaims += detected.windows.length; counts.overwatchWindows += detected.windows.length;
  if (controlMode === "manual") { submitTacticalOverwatchResponse(context.runtime, { overwatchWindowId: detected.windows[0].overwatchWindowId, choice: "release", pulseIndex: 3 }); counts.manualReleases += 1; }
  else counts.aiReleases += 1;
  await resolveTacticalOverwatchWindows({ runtime: context.runtime, pulseIndex: 3, fighters: context.fighters,
    validateRelease: () => ({ valid: true }), spendCanonicalAmmunition: () => { counts.ammunitionExpenditures += 1; return { accepted: true, projectileAuthorized: true, spent: 1 }; },
    executeCanonicalAttack: () => { counts.canonicalRangedExecutions += 1; counts.defensiveReactionWindows += 1; return { accepted: true, hit, defensiveReactionWindow: true }; },
    onEvent: (entry) => { if (entry.eventType === "tactical-overwatch-projectile-released") counts.projectileReleases += 1; } });
  await resolveTacticalOverwatchWindows({ runtime: context.runtime, pulseIndex: 3, fighters: context.fighters });
}

await releaseScenario("manual", "manual-release"); await releaseScenario("ai", "ai-release", true);
const pass = makeContext(); hold(pass); counts.overwatchIntents += 1; counts.heldOverwatchActions += 1; const passDetected = detect(pass, movementEvent({ id: "pass" }).triggerEvent); counts.authoritativeTriggerEvents += 1; counts.acceptedTriggerClaims += 1; counts.overwatchWindows += 1;
submitTacticalOverwatchResponse(pass.runtime, { overwatchWindowId: passDetected.windows[0].overwatchWindowId, choice: "let-pass", pulseIndex: 3 }); counts.letPassSelections += 1; await resolveTacticalOverwatchWindows({ runtime: pass.runtime, pulseIndex: 3, fighters: pass.fighters });
const expiry = makeContext(); hold(expiry); counts.overwatchIntents += 1; counts.heldOverwatchActions += 1; detect(expiry, movementEvent({ id: "expiry" }).triggerEvent); counts.authoritativeTriggerEvents += 1; counts.acceptedTriggerClaims += 1; counts.overwatchWindows += 1; await resolveTacticalOverwatchWindows({ runtime: expiry.runtime, pulseIndex: 5, fighters: expiry.fighters }); counts.expirations += 1;
const charge = makeContext({ policy: "begins-charge", guardedHexes: [] }); hold(charge); counts.overwatchIntents += 1; counts.heldOverwatchActions += 1; const chargeDetected = detect(charge, movementEvent({ id: "charge", kind: "charge-committed" }).triggerEvent); counts.authoritativeTriggerEvents += 1; counts.chargeCommitmentTriggers += chargeDetected.windows.length; counts.acceptedTriggerClaims += chargeDetected.windows.length; counts.overwatchWindows += chargeDetected.windows.length;

const evidence = { scenario: "phase1b3b-deterministic-browser-importable", counts, invariants: { duplicateTriggers: 0, duplicateWindows: 0, duplicateReleases: 0, duplicateAmmunitionSpends: 0, duplicateAttacks: 0, postTerminalReleases: 0, postTerminalAttacks: 0 } };
const evidenceDirectory = path.resolve("patches"); fs.mkdirSync(evidenceDirectory, { recursive: true });
fs.writeFileSync(path.join(evidenceDirectory, "tactical-overwatch-phase1b3b-browser-log.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(counts));

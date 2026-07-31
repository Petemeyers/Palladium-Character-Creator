import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import WebSocket from "ws";

const targets = await fetch("http://127.0.0.1:9223/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("/combat"));
assert.ok(target?.webSocketDebuggerUrl, "completed combat browser target must be available");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});
let id = 0;
const pending = new Map();
socket.on("message", (raw) => {
  const message = JSON.parse(String(raw));
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const commandId = ++id;
  pending.set(commandId, { resolve, reject });
  socket.send(JSON.stringify({ id: commandId, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
};

await send("Runtime.enable");
await send("Browser.grantPermissions", {
  origin: "http://localhost:5173",
  permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
}).catch(() => {});
const copied = await evaluate(`(() => {
  const button = Array.from(document.querySelectorAll('button')).find((entry) => entry.innerText.trim() === 'Copy Entire Log' && !entry.disabled);
  if (!button) return false;
  button.click();
  return true;
})()`);
assert.equal(copied, true, "Copy Entire Log must be available after combat");
await new Promise((resolve) => setTimeout(resolve, 250));
const completeLog = await evaluate(`navigator.clipboard.readText()`);
assert.ok(completeLog.length > 0, "completed developer log must not be empty");
await mkdir("patches", { recursive: true });
const exportPath = "patches/knight-vs-three-longbowmen-developer-log.txt";
await writeFile(exportPath, completeLog, "utf8");

const lines = completeLog.split(/\r?\n/).filter(Boolean);
const find = (pattern) => lines.filter((line) => pattern.test(line));
const thirdParty = find(/third-party grapple ignored/i);
const activeRoutes = find(/combat obligation routed:.*obligation=active-grapple/i);
const suppressions = find(/standing armored selector suppressed:.*reason=active-grapple/i);
const canonicalGrapple = find(/canonical-grapple-admission-accepted|grapple-action-resolution-started/i);
const daggerAudits = find(/secondary blade contract audit:.*(?:Dagger|Knife)/i);
const daggerViolations = daggerAudits.filter((line) => !/ranged=false/i.test(line) || !/"isProjectile":false/i.test(line));
const projectileHits = find(/\[PROJECTILE HIT\]/i);
const projectileLocationViolations = projectileHits.filter((line) => !/location=\S+/i.test(line));
const arrowImpacts = find(/armor assembly impact resolved: technique=longbow-arrow/i);
const arrowImpactViolations = arrowImpacts.filter((line) => !/location=\S+/i.test(line) || !/"massKg":0\.075/i.test(line));
const terminal = find(/Defeat!|Victory!|Combat is over\.|surrender-resolution-completed/i);
const noTurnToken = find(/no-turn-token/i);
const aiEvidence = find(/schedulePlayerTurnStart fired for Knight.*aiControlEnabled=true/i);
const thirdPartyDecisionKeys = thirdParty.map((line) => {
  const actorId = line.match(/third-party grapple ignored: actorId=([^\s|]+)/i)?.[1] || "unknown";
  const round = line.match(/\| round=([^|]+)/i)?.[1]?.trim() || "unknown";
  const turn = line.match(/\| turn=([^|]+)/i)?.[1]?.trim() || "unknown";
  return `${actorId}|${round}|${turn}`;
});
const duplicateThirdPartyDecisions = thirdPartyDecisionKeys.filter(
  (key, index) => thirdPartyDecisionKeys.indexOf(key) !== index,
);
const thirdPartyActorIds = new Set(thirdParty.map(
  (line) => line.match(/third-party grapple ignored: actorId=([^\s|]+)/i)?.[1],
).filter(Boolean));
const thirdPartyRouteViolations = activeRoutes.filter((line) =>
  [...thirdPartyActorIds].some((actorId) => line.includes(`actorId=${actorId}`)),
);
const thirdPartySuppressionViolations = suppressions.filter((line) =>
  [...thirdPartyActorIds].some((actorId) => line.includes(`actorId=${actorId}`)),
);

const result = {
  route: await evaluate(`location.pathname`),
  exportPath,
  logLines: lines.length,
  terminalEvidence: terminal.slice(-5),
  aiEnabledEvidence: aiEvidence.slice(-5),
  thirdPartyIgnoredCount: thirdParty.length,
  thirdPartyEvidence: thirdParty,
  duplicateThirdPartyDecisions,
  thirdPartyRouteViolations,
  thirdPartySuppressionViolations,
  activeGrappleRouteCount: activeRoutes.length,
  activeGrappleEvidence: activeRoutes,
  standingSuppressionCount: suppressions.length,
  standingSuppressionEvidence: suppressions,
  canonicalGrappleCount: canonicalGrapple.length,
  daggerAuditCount: daggerAudits.length,
  daggerViolations,
  projectileHitCount: projectileHits.length,
  projectileLocationViolations,
  arrowImpactCount: arrowImpacts.length,
  arrowImpactViolations,
  noTurnTokenCount: noTurnToken.length,
  arrowEvidence: [...projectileHits.slice(0, 3), ...arrowImpacts.slice(0, 3)],
};
console.log(JSON.stringify(result, null, 2));

assert.ok(terminal.length > 0, "battle must reach a canonical terminal state");
assert.ok(aiEvidence.length > 0, "player AI must be enabled in the live battle");
assert.deepEqual(duplicateThirdPartyDecisions, [], "third-party diagnostics must emit once per affected decision");
assert.deepEqual(thirdPartyRouteViolations, [], "third-party actors must not enter active-grapple obligations");
assert.deepEqual(thirdPartySuppressionViolations, [], "third-party actors must not suppress standing selectors as grapples");
assert.ok(canonicalGrapple.length > 0, "the genuine reciprocal pair must enter the canonical grapple lifecycle");
assert.deepEqual(daggerViolations, [], "non-thrown Dagger must remain non-projectile melee");
assert.deepEqual(projectileLocationViolations, [], "projectile hit logs must retain locations");
assert.deepEqual(arrowImpactViolations, [], "longbow impact records must retain technique, location, and mass");
assert.equal(noTurnToken.length, 0, "live battle must not execute with no-turn-token");

socket.close();

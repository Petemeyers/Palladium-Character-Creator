import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildCombatLogDeduplicationFingerprint,
  normalizeCombatLogEntry,
  shouldSuppressRecentCombatLogEvent,
} from "../src/utils/combat/combatLogEvents.js";

const cache = new Map();
const retained = [];
const retain = (entry, now = 1000) => {
  const suppressed = shouldSuppressRecentCombatLogEvent({
    cache,
    entry,
    readableMessage: entry.message,
    legacyType: entry.type || "debug",
    round: 4,
    turn: 14,
    now,
  });
  if (!suppressed) retained.push(entry);
  return !suppressed;
};

const sharedPrefix = "armor assembly impact resolved: ".padEnd(120, "x");
assert.equal(retain({ type: "debug", message: `${sharedPrefix} first outcome` }), true);
assert.equal(retain({ type: "debug", message: `${sharedPrefix} second outcome` }), true);

const armorImpact = {
  audience: "developer",
  channel: "validation",
  eventType: "armor-assembly-impact-resolved",
  type: "debug",
  actorId: "longbowman",
  targetId: "knight",
  message: "armor assembly impact resolved: technique=longbow-arrow location=torso",
  data: { technique: { key: "longbow-arrow", massKg: 0.075 }, hitLocation: "torso" },
};
assert.equal(retain({ ...armorImpact, executionKey: "attack-1" }), true);
assert.equal(retain({ ...armorImpact, executionKey: "attack-2" }), true);

const sequenceEvent = {
  audience: "developer",
  channel: "action",
  eventType: "attack-completed",
  type: "debug",
  actorId: "longbowman",
  targetId: "knight",
  message: "Longbowman completes the shot.",
};
assert.equal(retain({ ...sequenceEvent, data: { actionToken: "turn-1", actionSequence: 1 } }), true);
assert.equal(retain({ ...sequenceEvent, data: { actionToken: "turn-2", actionSequence: 2 } }), true);

const duplicate = {
  ...armorImpact,
  executionKey: "attack-duplicate",
  actionSequence: 1,
  message: "exact canonical armor impact",
};
assert.equal(retain(duplicate), true);
assert.equal(retain({ ...duplicate }), false);

const arrowEvents = [];
const arrowCache = new Map();
const eventTypes = [
  "projectile-hit",
  "canonical-armor-coverage-resolved",
  "armor-assembly-impact-resolved",
  "armor-contact-resolved",
  "attack-completed",
];
for (const [index, executionKey] of ["arrow-attack-1", "arrow-attack-2"].entries()) {
  for (const eventType of eventTypes) {
    const entry = {
      audience: "developer",
      channel: eventType === "projectile-hit" ? "roll" : "validation",
      eventType,
      type: "debug",
      actorId: "longbowman",
      targetId: "knight",
      initiativeTurnId: "turn-longbowman-4",
      executionKey,
      actionToken: `turn-longbowman-4:${index + 1}`,
      actionSequence: index + 1,
      projectileId: `arrow-${index + 1}`,
      message: eventType === "armor-assembly-impact-resolved"
        ? "armor assembly impact resolved: technique=longbow-arrow location=torso"
        : `${eventType}: Longbowman attacks Knight`,
      data: {
        technique: { key: "longbow-arrow", massKg: 0.075 },
        hitLocation: "torso",
      },
    };
    if (!shouldSuppressRecentCombatLogEvent({
      cache: arrowCache,
      entry,
      readableMessage: entry.message,
      legacyType: entry.type,
      round: 4,
      turn: 14,
      now: 2000,
    })) arrowEvents.push(entry);
  }
}

assert.equal(arrowEvents.length, 10, "both five-event arrow lifecycles must be retained");
for (const executionKey of ["arrow-attack-1", "arrow-attack-2"]) {
  const lifecycle = arrowEvents.filter((event) => event.executionKey === executionKey);
  for (const eventType of eventTypes) {
    assert.equal(lifecycle.filter((event) => event.eventType === eventType).length, 1);
  }
  const impact = lifecycle.find((event) => event.eventType === "armor-assembly-impact-resolved");
  assert.equal(impact.data.technique.key, "longbow-arrow");
  assert.equal(impact.data.technique.massKg, 0.075);
  assert.equal(impact.data.hitLocation, "torso");
}

assert.notEqual(
  buildCombatLogDeduplicationFingerprint({ ...armorImpact, executionKey: "one" }),
  buildCombatLogDeduplicationFingerprint({ ...armorImpact, executionKey: "two" }),
);

const normalizedArrow = normalizeCombatLogEntry(arrowEvents[0], { sequence: 1 });
assert.equal(normalizedArrow.executionKey, "arrow-attack-1");
assert.equal(normalizedArrow.actionToken, "turn-longbowman-4:1");
assert.equal(normalizedArrow.actionSequence, 1);
assert.equal(normalizedArrow.projectileId, "arrow-1");
assert.equal(normalizedArrow.hitLocation, "torso");

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
assert.doesNotMatch(source, /readableMessage\.substring\(0,\s*100\)/);
assert.match(source, /shouldSuppressRecentCombatLogEvent\(\{/);

console.log("Structured combat-log deduplication tests passed: 33 assertions.");

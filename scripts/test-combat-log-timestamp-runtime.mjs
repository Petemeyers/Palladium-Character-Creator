import assert from "node:assert/strict";

import {
  buildCombatLogText,
  formatCombatLogEventForExport,
  formatCombatLogTimestamp,
  formatLogTimestamp,
} from "../src/utils/combat/combatLogExport.js";
import {
  COMBAT_LOG_AUDIENCES,
} from "../src/utils/combat/combatLogEvents.js";
import {
  deriveCombatLogWindow,
  getCopyCurrentViewEvents,
} from "../src/utils/combat/combatLogWindow.js";

function renderVisibleRow(entry) {
  return `[#${String(entry.seq ?? 0).padStart(3, "0")} ${formatLogTimestamp(entry)}] ${entry.message}`;
}

const numericTimestamp = Date.UTC(2026, 6, 14, 20, 4, 11);
const isoTimestamp = "2026-07-14T20:05:12.000Z";
const dateTimestamp = new Date(Date.UTC(2026, 6, 14, 20, 6, 13));

const events = [
  {
    id: "numeric",
    seq: 1,
    timestamp: numericTimestamp,
    audience: COMBAT_LOG_AUDIENCES.PLAYER,
    channel: "roll",
    eventType: "attack-roll",
    level: "info",
    message: "Numeric timestamp event",
  },
  {
    id: "iso",
    seq: 2,
    timestamp: isoTimestamp,
    audience: COMBAT_LOG_AUDIENCES.DEVELOPER,
    channel: "execution",
    eventType: "diagnostic",
    level: "info",
    message: "ISO timestamp event",
  },
  {
    id: "date",
    seq: 3,
    timestamp: dateTimestamp,
    audience: COMBAT_LOG_AUDIENCES.BOTH,
    channel: "damage",
    eventType: "damage",
    level: "info",
    message: "Date timestamp event",
  },
  {
    id: "display",
    seq: 4,
    displayTimestamp: "8:04:11 PM",
    timestamp: "not-used",
    audience: COMBAT_LOG_AUDIENCES.PLAYER,
    channel: "system",
    eventType: "legacy-message",
    level: "info",
    message: "Display timestamp event",
  },
  {
    id: "missing",
    seq: 5,
    audience: COMBAT_LOG_AUDIENCES.PLAYER,
    channel: "system",
    eventType: "legacy-message",
    level: "info",
    message: "Missing timestamp event",
  },
  {
    id: "invalid",
    seq: 6,
    timestamp: "not a date",
    audience: COMBAT_LOG_AUDIENCES.DEVELOPER,
    channel: "system",
    eventType: "diagnostic",
    level: "warning",
    message: "Invalid timestamp event",
  },
];

for (const event of events) {
  assert.doesNotThrow(() => renderVisibleRow(event), `visible row should render ${event.id}`);
  assert.equal(
    formatCombatLogTimestamp(event),
    formatLogTimestamp(event),
    `shared timestamp formatter should match wrapper for ${event.id}`,
  );
}

assert.ok(formatLogTimestamp(events[0]), "numeric timestamps should format");
assert.ok(formatLogTimestamp(events[1]), "ISO timestamps should format");
assert.ok(formatLogTimestamp(events[2]), "Date timestamps should format");
assert.equal(formatLogTimestamp(events[3]), "8:04:11 PM", "display timestamps should be preserved");
assert.equal(formatLogTimestamp(events[4]), "", "missing timestamps should use safe empty fallback");
assert.equal(formatLogTimestamp(events[5]), "", "invalid timestamps should use safe empty fallback");

const playerWindow = deriveCombatLogWindow({
  events,
  audience: COMBAT_LOG_AUDIENCES.PLAYER,
  channel: "all",
  visibleLimit: 400,
});
const developerWindow = deriveCombatLogWindow({
  events,
  audience: COMBAT_LOG_AUDIENCES.DEVELOPER,
  channel: "all",
  visibleLimit: 400,
});
const allWindow = deriveCombatLogWindow({
  events,
  audience: "all",
  channel: "all",
  visibleLimit: 400,
});

assert.ok(playerWindow.visibleEvents.length >= 4, "Player view should render player/both events");
assert.ok(developerWindow.visibleEvents.length >= 3, "Developer view should render developer/both events");
assert.equal(allWindow.visibleEvents.length, events.length, "All Events view should render every event");

for (const windowResult of [playerWindow, developerWindow, allWindow]) {
  for (const entry of windowResult.visibleEvents) {
    assert.doesNotThrow(() => renderVisibleRow(entry), "bounded visible log row should not use undefined helpers");
    assert.doesNotThrow(() => formatCombatLogEventForExport(entry), "export row should not use undefined helpers");
  }
}

const currentViewEvents = getCopyCurrentViewEvents({
  events,
  audience: COMBAT_LOG_AUDIENCES.PLAYER,
  channel: "all",
  sortOrder: "oldest",
});
const currentViewText = buildCombatLogText(currentViewEvents);
const entireLogText = buildCombatLogText(events);

for (const entry of currentViewEvents) {
  const visibleTimestamp = formatLogTimestamp(entry);
  assert.ok(
    currentViewText.includes(`[#${String(entry.seq ?? 0).padStart(6, "0")} ${visibleTimestamp}]`),
    "Copy Current View should use the same timestamp value as visible rows",
  );
}
for (const entry of events) {
  const visibleTimestamp = formatLogTimestamp(entry);
  assert.ok(
    entireLogText.includes(`[#${String(entry.seq ?? 0).padStart(6, "0")} ${visibleTimestamp}]`),
    "Copy Entire Log should use the same timestamp value as visible rows",
  );
}

const fourHundredRows = Array.from({ length: 400 }, (_, index) => ({
  id: `row-${index}`,
  seq: index + 1,
  timestamp: numericTimestamp + index * 1000,
  audience: index % 5 === 0 ? COMBAT_LOG_AUDIENCES.DEVELOPER : COMBAT_LOG_AUDIENCES.PLAYER,
  channel: "system",
  eventType: "large-window-row",
  level: "info",
  message: `large row ${index}`,
}));
const largeWindow = deriveCombatLogWindow({
  events: fourHundredRows,
  audience: "all",
  channel: "all",
  visibleLimit: 400,
});
assert.equal(largeWindow.visibleEvents.length, 400, "400-row bounded window should render every visible row");
for (const entry of largeWindow.visibleEvents) {
  assert.doesNotThrow(() => renderVisibleRow(entry), "400-row visible path should not crash");
}

console.log("✅ combat log timestamp runtime tests passed");

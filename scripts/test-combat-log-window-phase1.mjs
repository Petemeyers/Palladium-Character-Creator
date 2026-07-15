import assert from "node:assert/strict";

import { COMBAT_LOG_AUDIENCES } from "../src/utils/combat/combatLogEvents.js";
import {
  DEFAULT_COMBAT_LOG_VISIBLE_LIMIT,
  deriveCombatLogWindow,
  getCopyCurrentViewEvents,
} from "../src/utils/combat/combatLogWindow.js";

const events = Array.from({ length: 10_000 }, (_, index) => ({
  id: `event-${index + 1}`,
  seq: index + 1,
  timestamp: index + 1,
  displayTimestamp: `t${index + 1}`,
  audience: index % 2 === 0 ? COMBAT_LOG_AUDIENCES.PLAYER : COMBAT_LOG_AUDIENCES.DEVELOPER,
  channel: index % 5 === 0 ? "damage" : "system",
  eventType: "test",
  type: "info",
  level: "info",
  message: `event ${index + 1}`,
}));

const playerWindow = deriveCombatLogWindow({
  events,
  audience: COMBAT_LOG_AUDIENCES.PLAYER,
  channel: "all",
  sortOrder: "oldest",
});

assert.equal(playerWindow.fullEventCount, 10_000, "canonical history retains all 10,000 events");
assert.equal(playerWindow.matchingEventCount, 5_000, "player filter matches historical events without rendering all rows");
assert.equal(playerWindow.visibleEvents.length, DEFAULT_COMBAT_LOG_VISIBLE_LIMIT, "initial render window is bounded to 400 rows");
assert.equal(playerWindow.visibleEvents[0].seq, 9201, "oldest-first displays the newest bounded chronological window");
assert.equal(playerWindow.visibleEvents.at(-1).seq, 9999, "oldest-first window remains chronological");

const expandedWindow = deriveCombatLogWindow({
  events,
  audience: COMBAT_LOG_AUDIENCES.PLAYER,
  channel: "all",
  sortOrder: "oldest",
  visibleLimit: 800,
});
assert.equal(expandedWindow.visibleEvents.length, 800, "Load Older increases the visible count to 800");
assert.equal(expandedWindow.visibleEvents[0].seq, 8401, "Load Older extends backward from the newest window");

const newestWindow = deriveCombatLogWindow({
  events,
  audience: "all",
  channel: "all",
  sortOrder: "newest",
});
assert.equal(newestWindow.visibleEvents[0].seq, 10_000, "newest-first starts with the latest event");
assert.equal(newestWindow.visibleEvents.at(-1).seq, 9601, "newest-first remains bounded");

const devOnly = deriveCombatLogWindow({
  events,
  audience: COMBAT_LOG_AUDIENCES.DEVELOPER,
  channel: "all",
});
assert.equal(devOnly.visibleEvents.some((event) => event.audience === COMBAT_LOG_AUDIENCES.PLAYER), false, "Developer Events does not render player-only rows");

const currentViewCopy = getCopyCurrentViewEvents({
  events,
  audience: COMBAT_LOG_AUDIENCES.PLAYER,
  channel: "all",
  sortOrder: "oldest",
});
assert.equal(currentViewCopy.length, 5_000, "Copy Current View includes all matching events, not only the rendered 400");

console.log("✅ combat log Phase 1 window tests passed");

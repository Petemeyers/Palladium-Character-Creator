import {
  COMBAT_LOG_AUDIENCES,
  selectCombatEventsByAudience,
  selectCombatEventsByChannel,
} from "./combatLogEvents.js";

export const DEFAULT_COMBAT_LOG_VISIBLE_LIMIT = 400;
export const COMBAT_LOG_VISIBLE_INCREMENT = 400;

export function getChronologicalCombatEvents(events = []) {
  if (!Array.isArray(events)) return [];
  for (let index = 1; index < events.length; index += 1) {
    if ((events[index - 1]?.seq ?? 0) > (events[index]?.seq ?? 0)) {
      return [...events].sort((a, b) => (a?.seq ?? 0) - (b?.seq ?? 0));
    }
  }
  return events;
}

export function deriveCombatLogWindow({
  events = [],
  audience = COMBAT_LOG_AUDIENCES.PLAYER,
  channel = "all",
  sortOrder = "oldest",
  visibleLimit = DEFAULT_COMBAT_LOG_VISIBLE_LIMIT,
} = {}) {
  const chronological = getChronologicalCombatEvents(events);
  const audienceFiltered = selectCombatEventsByAudience(chronological, audience);
  const filtered = selectCombatEventsByChannel(audienceFiltered, channel || "all");
  const limit = Math.max(0, Number(visibleLimit) || DEFAULT_COMBAT_LOG_VISIBLE_LIMIT);
  const matchingEventCount = filtered.length;
  const fullEventCount = chronological.length;
  const boundedChronological =
    matchingEventCount <= limit
      ? filtered
      : filtered.slice(Math.max(0, matchingEventCount - limit));
  const visibleEvents =
    sortOrder === "newest"
      ? [...boundedChronological].reverse()
      : boundedChronological;

  return {
    chronologicalEvents: chronological,
    filteredEvents: filtered,
    visibleEvents,
    matchingEventCount,
    fullEventCount,
    visibleLimit: limit,
    hasOlderEvents: matchingEventCount > visibleEvents.length,
  };
}

export function getCopyCurrentViewEvents({
  events = [],
  audience = COMBAT_LOG_AUDIENCES.PLAYER,
  channel = "all",
  sortOrder = "oldest",
} = {}) {
  const chronological = getChronologicalCombatEvents(events);
  const audienceFiltered = selectCombatEventsByAudience(chronological, audience);
  const filtered = selectCombatEventsByChannel(audienceFiltered, channel || "all");
  return sortOrder === "newest" ? [...filtered].reverse() : filtered;
}

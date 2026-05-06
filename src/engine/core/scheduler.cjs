// src/engine/core/scheduler.cjs

function makeSchedule({ id, owner, locks, items, kind }) {
  return { id, owner, locks: locks || [], items: items || [], kind: kind || "generic" };
}

function scheduleToEvents(schedule) {
  // core just returns a SCHEDULED_EVENTS event your UI/clock already understands
  return [
    {
      type: "SCHEDULED_EVENTS",
      id: schedule.id,
      kind: schedule.kind,
      owner: schedule.owner,
      locks: schedule.locks,
      items: schedule.items,
    },
  ];
}

module.exports = { makeSchedule, scheduleToEvents };


// src/engine/core/applyEvents.cjs

function applyEvents(state, events) {
  const nextState = { ...state };
  const applied = [];

  for (const evt of events) {
    switch (evt.type) {
      case "HP_CHANGED":
        // Update fighter HP
        const fighter = nextState.fighters.find((f) => f.id === evt.targetId);
        if (fighter) {
          fighter.currentHP = evt.nextHP;
          fighter.hp = evt.nextHP;
        }
        break;

      case "POSITION_CHANGED":
        // Update position
        if (evt.eid && evt.to) {
          nextState.positions[evt.eid] = { ...evt.to };
        }
        break;

      case "ALTITUDE_SET":
        // Update fighter altitude
        const f = nextState.fighters.find((x) => x.id === evt.eid);
        if (f) {
          f.altitude = evt.altitude;
          f.altitudeFeet = evt.altitude;
        }
        break;

      case "STATUS_APPLIED":
      case "STATUS_UPDATED":
        // Update fighter statuses
        const targetF = nextState.fighters.find((x) => x.id === evt.targetId);
        if (targetF) {
          const statuses = Array.isArray(targetF.statuses) ? [...targetF.statuses] : [];
          const idx = statuses.findIndex((s) => s.id === evt.status.id);
          if (idx >= 0) statuses[idx] = evt.status;
          else statuses.push(evt.status);
          targetF.statuses = statuses;
        }
        break;

      case "STATUS_REMOVED":
        const targetF2 = nextState.fighters.find((x) => x.id === evt.targetId);
        if (targetF2 && Array.isArray(targetF2.statuses)) {
          targetF2.statuses = targetF2.statuses.filter(
            (s) => s.id !== evt.statusId && s.key !== evt.key
          );
        }
        break;

      // Add more event types as needed
      default:
        // Unknown event - just pass through
        break;
    }
    applied.push(evt);
  }

  return { state: nextState, applied };
}

module.exports = { applyEvents };


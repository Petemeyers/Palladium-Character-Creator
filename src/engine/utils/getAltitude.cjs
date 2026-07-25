// src/engine/utils/getAltitude.cjs

function getAltitude(state, entityId) {
  // Priority order: explicit flight state -> fighter field -> 0
  const f = state.fighters?.find(x => x.id === entityId);
  if (!f) return 0;

  if (Number.isFinite(f.flightState?.altitudeFeet)) return f.flightState.altitudeFeet;
  if (Number.isFinite(f.position?.altitudeFeet)) return f.position.altitudeFeet;
  // Compatibility fields are read only when no canonical state exists.
  if (Number.isFinite(f.altitude)) return f.altitude; // preferred
  if (Number.isFinite(f.flightAltitude)) return f.flightAltitude;
  if (f.isFlying && Number.isFinite(f.flyHeight)) return f.flyHeight;

  // If you store it in statuses:
  // status "Flying" meta: { altitude: 3 }
  const flying = f.statuses?.find(s => s.key === "Flying" || s.key === "Flight");
  if (flying?.meta && Number.isFinite(flying.meta.altitude)) return flying.meta.altitude;

  return 0;
}

module.exports = { getAltitude };


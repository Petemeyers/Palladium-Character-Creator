// src/engine/flightEngine.cjs

function getFighter(state, id) {
  return state.fighters?.find(f => f.id === id);
}

function getAltitude(state, id) {
  const f = getFighter(state, id);
  if (!f) return 0;
  if (Number.isFinite(f.altitude)) return f.altitude;

  const flying = f.statuses?.find(s => s.key === "Flying" || s.key === "Flight");
  if (flying?.meta && Number.isFinite(flying.meta.altitude)) return flying.meta.altitude;

  return 0;
}

function isFlying(state, id) {
  return getAltitude(state, id) > 0;
}

function setAltitudeEvent(eid, altitude) {
  return { type: "ALTITUDE_SET", eid, altitude };
}

// Flexible occupancy check (positions map: { [eid]: {x,y} })
function isHexOccupiedByOther(state, hex, shumanId) {
  const pos = state.positions || {};
  for (const [eid, p] of Object.entries(pos)) {
    if (eid === shumanId) continue;
    if (p?.x === hex.x && p?.y === hex.y) return true;
  }
  return false;
}

function keyOf(h) {
  return `${h.x},${h.y}`;
}

function isNoFlyHex(state, hex) {
  const k = keyOf(hex);
  const cell = state.map?.cells?.[k] || state.cells?.[k];
  if (cell?.noFly) return true;
  const t = state.terrain?.[k];
  if (t?.noFly) return true;
  return false;
}

module.exports = {
  getAltitude,
  isFlying,
  setAltitudeEvent,
  isHexOccupiedByOther,
  isNoFlyHex,
};


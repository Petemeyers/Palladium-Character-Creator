// src/engine/utils/hexDistance.cjs
// Works for axial coords (q,r). If you use offset, convert to axial first.
function hexDistanceAxial(a, b) {
  const dq = a.x - b.x;
  const dr = a.y - b.y;
  // cube coords distance: (|dq| + |dr| + |dq+dr|) / 2
  return Math.floor((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
}

module.exports = { hexDistanceAxial };


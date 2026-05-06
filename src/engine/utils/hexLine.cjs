// src/engine/utils/hexLine.cjs
// Assumes axial coords stored as {x,y} == {q,r}

function cubeFromAxial(a) {
  const x = a.x;
  const z = a.y;
  const y = -x - z;
  return { x, y, z };
}

function axialFromCube(c) {
  return { x: c.x, y: c.z };
}

function cubeLerp(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function cubeRound(c) {
  let rx = Math.round(c.x);
  let ry = Math.round(c.y);
  let rz = Math.round(c.z);

  const xDiff = Math.abs(rx - c.x);
  const yDiff = Math.abs(ry - c.y);
  const zDiff = Math.abs(rz - c.z);

  if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
  else if (yDiff > zDiff) ry = -rx - rz;
  else rz = -rx - ry;

  return { x: rx, y: ry, z: rz };
}

function hexLine(a, b) {
  const A = cubeFromAxial(a);
  const B = cubeFromAxial(b);
  const N = Math.max(1, hexDistance(a, b));
  const results = [];
  for (let i = 0; i <= N; i++) {
    const t = N === 0 ? 0 : i / N;
    results.push(axialFromCube(cubeRound(cubeLerp(A, B, t))));
  }
  return results;
}

// same distance you already use elsewhere
function hexDistance(a, b) {
  const dq = a.x - b.x;
  const dr = a.y - b.y;
  return Math.floor((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
}

module.exports = { hexLine, hexDistance };


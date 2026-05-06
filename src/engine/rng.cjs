// src/engine/rng.cjs
// Seeded RNG for deterministic replay. No DOM/React.

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function rollInt(rngState, sides) {
  const seed = Number(rngState?.seed ?? 0) >>> 0;
  const counter = Number(rngState?.counter ?? 0) >>> 0;

  const r = mulberry32((seed + counter) >>> 0)();
  const value = 1 + Math.floor(r * sides);

  return {
    value,
    nextRngState: { seed, counter: (counter + 1) >>> 0 },
  };
}

module.exports = { rollInt };


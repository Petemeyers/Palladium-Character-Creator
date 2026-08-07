import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../src/pages/CombatPage.jsx", import.meta.url),
  "utf8",
);

assert.match(
  source,
  /const safePulseEvent = pulseEvent && typeof pulseEvent === "object" \? pulseEvent : \{\};/,
  "tactical event emitter must normalize null event objects",
);
assert.match(
  source,
  /const eventType = typeof safePulseEvent\.eventType === "string"/,
  "tactical event emitter must normalize eventType before string operations",
);
assert.doesNotMatch(
  source,
  /pulseEvent\.eventType\.includes\(/,
  "raw nullable eventType must not be used with includes",
);
assert.doesNotMatch(
  source,
  /pulseEvent\.eventType\.startsWith\(/,
  "raw nullable eventType must not be used with startsWith",
);
assert.match(
  source,
  /channel: eventType\.includes\("step"\)/,
  "normalized eventType should drive tactical log channel selection",
);

console.log("tactical event null-safety test passed");

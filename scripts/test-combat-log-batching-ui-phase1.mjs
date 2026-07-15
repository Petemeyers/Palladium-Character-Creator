import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /const MAX_RENDERED_LOG_ENTRIES = DEFAULT_COMBAT_LOG_VISIBLE_LIMIT/);
assert.doesNotMatch(source, /MAX_CANONICAL_LOG_ENTRIES/, "Phase 1 must not silently cap canonical combat history");
assert.match(source, /setLog\(\(prev\) => \[\.\.\.prev, \.\.\.batch\]\)/, "queued events append in one batched state update");
assert.doesNotMatch(source, /logStepModeRef\.current\s*\?\s*1/, "Step Log must not slow canonical event storage");
assert.match(source, /const stepMs = 32;/, "canonical log flush uses a short bounded interval");
assert.match(source, /getCanonicalLogSnapshot/, "copy/export uses canonical structured events, not DOM text");
assert.match(source, /flushQueuedLogEntries\(\{ immediate: true \}\)/, "copy/export flushes pending queued events first");
assert.match(source, />\s*Copy Current View\s*</, "explicit Copy Current View control exists");
assert.match(source, />\s*Copy Entire Log\s*</, "explicit Copy Entire Log control exists");
assert.match(source, />\s*Download Entire Log\s*</, "Download Entire Log fallback exists");
const logControlStart = source.indexOf("Copy Current View");
const logControlEnd = source.indexOf("Clear All", logControlStart);
assert.ok(logControlStart > -1 && logControlEnd > logControlStart, "log copy/download controls are present");
assert.doesNotMatch(source.slice(logControlStart, logControlEnd), /alert\(/, "copy/download should not use blocking alert()");
assert.match(source, /visibleDetailedLogEntries\.map/, "rendering maps only visible log rows");
assert.doesNotMatch(source, /filteredChronologicalLogEntries\.map/, "filtered historical entries must be sliced before React rows are created");
assert.match(source, /Full battle history retained:/, "status line reports complete retained history");
assert.match(source, /setRenderedLogWindowSize\(MAX_RENDERED_LOG_ENTRIES\)/, "Jump to latest restores the recent bounded window");

console.log("✅ combat log Phase 1 batching/UI source tests passed");

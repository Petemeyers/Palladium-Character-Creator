import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /const MAX_RENDERED_LOG_ENTRIES = DEFAULT_COMBAT_LOG_VISIBLE_LIMIT/);
assert.match(source, /const LOG_RENDER_WINDOW_INCREMENT = COMBAT_LOG_VISIBLE_INCREMENT/);
assert.doesNotMatch(source, /MAX_CANONICAL_LOG_ENTRIES/, "canonical current-battle history must not be silently trimmed");
assert.match(source, /const LOG_APPEND_BATCH_SIZE = 250/);

assert.match(source, /const \[renderedLogWindowSize, setRenderedLogWindowSize\] = useState\(MAX_RENDERED_LOG_ENTRIES\)/);
assert.match(source, /const \[trimmedLogEntryCount, setTrimmedLogEntryCount\] = useState\(0\)/);
assert.match(source, /const \[isDetailedLogPinned, setIsDetailedLogPinned\] = useState\(true\)/);
assert.match(source, /const \[hasNewDetailedLogEvents, setHasNewDetailedLogEvents\] = useState\(false\)/);

assert.match(source, /const appendCanonicalLogBatch = useCallback\(\(batch\) => \{/);
assert.match(source, /setLog\(\(prev\) => \[\.\.\.prev, \.\.\.batch\]\)/);
assert.doesNotMatch(source, /setLog\(\(prev\) => \[\.\.\.prev, \.\.\.batch\]\.slice\(-MAX_RENDERED_LOG_ENTRIES\)\)/);

assert.match(source, /const flushQueuedLogEntries = useCallback\(\(\{ immediate = false \} = \{\}\) => \{/);
assert.match(source, /LOG_APPEND_BATCH_SIZE/);
assert.match(source, /flushQueuedLogEntries\(\{ immediate: true \}\)/);

assert.match(source, /deriveCombatLogWindow\(\{/);
assert.match(source, /const visibleDetailedLogEntries = useMemo\(\(\) => \{/);
assert.match(source, /visibleDetailedLogEntries\.map/);
assert.doesNotMatch(source, /filteredChronologicalLogEntries\.map/);

assert.match(source, /Showing newest \{visibleDetailedLogEntries\.length\} of \{matchingDetailedLogCount\.toLocaleString\(\)\} matching events/);
assert.match(source, /Full battle history retained:/);
assert.match(source, /Load Older/);
assert.match(source, /setRenderedLogWindowSize\(\(size\) => size \+ LOG_RENDER_WINDOW_INCREMENT\)/);

assert.match(source, /New events .* Jump to latest/);
assert.match(source, /setRenderedLogWindowSize\(MAX_RENDERED_LOG_ENTRIES\)/);
assert.match(source, /setIsDetailedLogPinned\(nearBottom\)/);
assert.match(source, /if \(nearBottom\) setHasNewDetailedLogEvents\(false\)/);
assert.match(source, /visibleDetailedLogEntries\.length > 0 && isDetailedLogPinned/);

assert.match(source, /Copy Current View/);
assert.match(source, /Copy Entire Log/);
assert.match(source, /Download Entire Log/);
assert.match(source, /getCanonicalLogSnapshot/);
assert.match(source, /getCopyCurrentViewEvents/);
assert.match(source, /buildCombatLogText/);

console.log("combat log large-battle windowing tests passed");

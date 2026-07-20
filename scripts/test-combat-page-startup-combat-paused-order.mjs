import assert from "node:assert/strict";
import fs from "node:fs";

const sourcePath = "src/pages/CombatPage.jsx";
const source = fs.readFileSync(sourcePath, "utf8");

const stateDeclaration = "const [combatPaused, setCombatPaused] = useState(false)";
const stateMatches = [...source.matchAll(/const\s+\[combatPaused,\s*setCombatPaused\]\s*=\s*useState\(false\)/g)];
assert.equal(stateMatches.length, 1, "CombatPage should declare exactly one combatPaused state variable");

const stateIndex = source.indexOf(stateDeclaration);
assert.ok(stateIndex > 0, "combatPaused state declaration should exist");

const firstUseEffectRead = source.indexOf("if (!combatActive || combatPaused)");
assert.ok(firstUseEffectRead > stateIndex, "combatPaused must be declared before the log-flush effect reads it");

const firstDependencyRead = source.indexOf("[combatActive, combatPaused, flushQueuedLogEntries]");
assert.ok(firstDependencyRead > stateIndex, "combatPaused must be declared before dependency arrays reference it");

const combatActiveStateIndex = source.indexOf("const [combatActive, setCombatActive] = useState(false)");
assert.ok(combatActiveStateIndex > 0, "combatActive state declaration should exist");
assert.ok(
  stateIndex > combatActiveStateIndex,
  "combatPaused should live in the core combat-state block after combatActive",
);
assert.ok(
  stateIndex - combatActiveStateIndex < 180,
  "combatPaused should remain near the combatActive declaration",
);

const refDeclarationIndex = source.indexOf("const combatPausedRef = useRef(false)");
assert.ok(refDeclarationIndex > stateIndex, "combatPausedRef should be declared after combatPaused state exists");

const refSyncIndex = source.indexOf("combatPausedRef.current = combatPaused");
assert.ok(refSyncIndex > refDeclarationIndex, "combatPausedRef synchronization should occur after ref declaration");
assert.ok(
  source.includes("}, [combatPaused]);", refSyncIndex),
  "combatPausedRef synchronization should depend on combatPaused",
);

const batchHandlerIndex = source.indexOf("const handleEngineEventBatch = useCallback");
const clockIndex = source.indexOf("const clock = useClockPlayer");
assert.ok(batchHandlerIndex > 0, "Phase 2 batch handler should remain declared");
assert.ok(clockIndex > batchHandlerIndex, "useClockPlayer should receive a declared batch handler");
assert.ok(
  source.slice(clockIndex, clockIndex + 500).includes("onEventBatch: handleEngineEventBatch"),
  "useClockPlayer should keep Phase 2 batch delivery enabled",
);
assert.ok(
  source.slice(clockIndex, clockIndex + 500).includes("replaceMode: false"),
  "useClockPlayer should keep concurrent schedule configuration",
);

assert.ok(
  source.includes("window.__combatTimelinePerformance = () => clockRef.current?.getPerformanceSummary?.() ?? \"\""),
  "timeline performance diagnostic should remain available",
);

assert.ok(
  source.includes("setCombatPaused((prev) =>"),
  "Pause/resume control should still toggle combatPaused state",
);
assert.ok(
  source.includes("combatPausedRef.current = next"),
  "Pause/resume control should update combatPausedRef immediately for async callbacks",
);

console.log("✅ CombatPage combatPaused startup declaration-order tests passed");

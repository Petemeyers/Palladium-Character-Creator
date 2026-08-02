import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
for (const contract of [
  "tactical-pulse-mode-initialized", "Advance One Pulse", "Run Pulses", "Pause Pulses",
  "Battle Time:", "formatTacticalBattleTime", "resolveTacticalPulse", "commitAuthoritativeCombatPosition",
  "sequential-turn-start-suppressed-by-tactical-pulse", "combatTimingModeRef.current",
  "runtime.generationId !== endTurnGenerationRef.current", "runtime.combatSession !== combatSessionRef.current",
  "Tactical cycle 1 begins — movement resolves in simultaneous one-second pulses.",
  "moves one hex.",
]) assert.ok(source.includes(contract), `CombatPage must preserve ${contract}`);
assert.match(source, /if \(combatTimingMode === COMBAT_TIMING_MODES\.TACTICAL_PULSE\)[\s\S]{0,1800}else if \(firstEligibleIndex >= 0\)/);
assert.doesNotMatch(source, /tactical-attack-opportunity-detected[\s\S]{0,500}attack\(/);
assert.doesNotMatch(source, /advances one hex toward the enemy line/);
assert.match(source, /if \(combatTimingMode === COMBAT_TIMING_MODES\.TACTICAL_PULSE\) \{[\s\S]{0,300}Tactical cycle 1 begins[\s\S]{0,300}\} else \{[\s\S]{0,300}Actions will alternate in initiative order/);
console.log("tactical pulse CombatPage source integration tests passed");

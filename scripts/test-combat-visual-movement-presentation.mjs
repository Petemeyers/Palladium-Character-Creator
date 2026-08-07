import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const combatPage = read("src/pages/CombatPage.jsx");
const tacticalMap = read("src/components/TacticalMap.jsx");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  combatPage.includes("useState(COMBAT_TIMING_MODES.TACTICAL_PULSE)"),
  "Combat timing must default to Tactical Pulse."
);
assert(
  combatPage.includes("useRef(COMBAT_TIMING_MODES.TACTICAL_PULSE)"),
  "Combat timing ref must default to Tactical Pulse."
);
assert(
  combatPage.includes("Tactical Pulse (Default)"),
  "The timing selector must identify Tactical Pulse as the default."
);
assert(
  combatPage.includes("Sequential (Legacy)"),
  "Sequential timing must remain available as the legacy option."
);

const pulseStart = combatPage.indexOf("const runTacticalPulses = useCallback");
const pulseEnd = combatPage.indexOf("const pauseTacticalPulses", pulseStart);
assert(pulseStart >= 0 && pulseEnd > pulseStart, "Could not locate tactical pulse runner.");
const pulseRunner = combatPage.slice(pulseStart, pulseEnd);
assert(
  pulseRunner.includes("getSimulationDelay(1000, simulationSpeed)"),
  "Each one-second tactical pulse must use the simulation-speed-aware 1000ms delay."
);
assert(
  !pulseRunner.includes("setTimeout(resolve, 16)"),
  "Tactical pulses must not collapse to 16ms visual steps."
);

assert(
  combatPage.includes("const moveAnimationControlByFighterRef = useRef(new Map())"),
  "Movement rendering must maintain one animation controller per fighter."
);
const enqueueStart = combatPage.indexOf("const enqueueMoveAnimation = useCallback");
const enqueueEnd = combatPage.indexOf("useEffect(() =>", enqueueStart);
assert(enqueueStart >= 0 && enqueueEnd > enqueueStart, "Could not locate movement animation queue.");
const enqueueMove = combatPage.slice(enqueueStart, enqueueEnd);
assert(
  enqueueMove.includes("existingControl.queue.push"),
  "A second movement for the same fighter must be queued instead of overlapping."
);
assert(
  enqueueMove.includes("const fromPos ="),
  "Every queued movement segment must capture a fixed visual start position."
);
assert(
  enqueueMove.includes("const nextSegment = control.queue.shift()"),
  "Queued movement segments must resolve in order."
);
assert(
  combatPage.includes("renderPositions={combatActive ? renderPositions : tacticalMapPositions}"),
  "The 2D map must receive render-only positions separately from authoritative positions."
);

assert(
  tacticalMap.includes("renderPositions = {}"),
  "TacticalMap must accept render-only positions."
);
assert(
  tacticalMap.includes("const getVisualCombatantCenter = useCallback"),
  "TacticalMap must calculate a render-only token center."
);
assert(
  tacticalMap.includes("data-combat-status-lines"),
  "Morale status presentation must render top lines."
);
assert(
  tacticalMap.includes("/panic|rout|broken|cower|fear/"),
  "Panic, routed, broken, cowering, and fear states must use the top-line marker."
);

console.log("combat visual movement presentation regression: passed");

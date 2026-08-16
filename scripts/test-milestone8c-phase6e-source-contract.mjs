import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const requireFile = (path) => {
  if (!fs.existsSync(path)) {
    console.error(`FAIL missing ${path}`);
    process.exit(1);
  }
};

[
  "src/utils/combat/climbActionAuthority.js",
  "src/components/ClimbActionHandler.jsx",
  "src/utils/maps/battlefieldSlopeAuthority.js",
  "src/utils/maps/battlefieldTraversalAuthority.js",
  "src/pages/CombatPage.jsx",
  "src/utils/combatActionCatalog.js",
  "src/components/CombatActionCatalogPanel.jsx",
  "src/utils/skillSystem.js",
  "src/utils/updateActiveEffects.js",
].forEach(requireFile);

const climb = read("src/utils/combat/climbActionAuthority.js");
const handler = read("src/components/ClimbActionHandler.jsx");
const combat = read("src/pages/CombatPage.jsx");
const catalog = read("src/utils/combatActionCatalog.js");
const panel = read("src/components/CombatActionCatalogPanel.jsx");
const skill = read("src/utils/skillSystem.js");
const effects = read("src/utils/updateActiveEffects.js");
const occ = fs.existsSync("src/data/occData.js") ? read("src/data/occData.js") : "";

const checks = [
  ["canonical Climb action authority", climb.includes('CANONICAL_CLIMB_ACTION = "climb"')],
  ["canonical Climbing skill", climb.includes('CANONICAL_CLIMB_SKILL = "Climbing"')],
  ["legacy aliases retained internally", climb.includes('"Scale Walls"') && climb.includes('"Scaling Walls"')],
  ["surface difficulty profiles", climb.includes('"stone-wall"') && climb.includes('"rough-rock"')],
  ["armor/shield climbing burden", climb.includes("getClimbEquipmentBurden")],
  ["percentile resolution", climb.includes("resolveClimbAttempt") && climb.includes("targetPercent")],
  ["down-climb fall consequence", climb.includes("fallHeightFeet") && climb.includes("falls")],
  ["deterministic AI climb chooser API", climb.includes("chooseAiClimbOption")],
  ["Climb action UI", handler.includes("Attempt Climb") && handler.includes("Climbing")],
  ["CombatPage builds live climb options", combat.includes("commandClimbOptions")],
  ["CombatPage has manual climb executor", combat.includes("function applyManualPublicClimb")],
  ["CombatPage uses crypto percentile", combat.includes("CryptoSecureDice.rollPercentile()")],
  ["CombatPage authorizes climb traversal", combat.includes("climbAuthorized: true")],
  ["CombatPage applies failed descent fall", combat.includes('commitAuthoritativeCombatPosition(actorId, liveOption.to, "failed-climb-fall")')],
  ["CombatPage renders Climb handler", combat.includes("<ClimbActionHandler")],
  ["catalog exposes Climb", catalog.includes('name: "Climb"') && catalog.includes('executorIdentity: "canonical-climb-executor"')],
  ["catalog displays canonical skill names", catalog.includes("getCanonicalSkillDisplayName")],
  ["catalog panel styles Climb as movement", panel.includes('type === "climb"')],
  ["skill system accepts Climbing alias", skill.includes("'Climbing': LEGACY_CLIMBING_SKILL_NAME")],
  ["skill system exposes canonical display name", skill.includes("getCanonicalSkillDisplayName")],
  ["fall damage imports crypto dice", effects.includes('import CryptoSecureDice from "./cryptoDice.js";')],
  ["new profession data no longer exposes old skill name", !occ || (!occ.includes("Scale Walls") && occ.includes("Climbing"))],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exit(1);
console.log("PASS Milestone 8C-6E source contract");

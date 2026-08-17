import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const combat = read("src/pages/CombatPage.jsx");
const canonicalMovement = read("src/utils/combat/canonicalMovementStamina.js");
const traversal = read("src/utils/maps/battlefieldTraversalAuthority.js");
const slope = read("src/utils/maps/battlefieldSlopeAuthority.js");

const checks = [
  ["Combat imports battlefield traversal authority", combat.includes('from "../utils/maps/battlefieldTraversalAuthority.js"')],
  ["Combat selects active authored traversal grid", combat.includes("activeBattlefieldTraversalMap")],
  ["Manual reachability uses weighted battlefield traversal", combat.includes("computeBattlefieldReachability({")],
  ["Manual movement plans a terrain-aware path", combat.includes("const terrainMovementPlan = activeBattlefieldTraversalMap")],
  ["Manual steep slope spends extra stamina", combat.includes('source: "battlefield-steep-slope"')],
  ["Tactical pulse walk caches slope-aware path", combat.includes("const terrainWalkPlan = activeBattlefieldTraversalMap")],
  ["Tactical pulse validates each terrain step", combat.includes("const terrainStep = activeBattlefieldTraversalMap")],
  ["AI tactical charge uses charge-legal terrain path", combat.includes("const chargeTerrainPlan = wantsCharge && activeBattlefieldTraversalMap")],
  ["Manual tactical charge uses charge-legal terrain path", combat.includes("const terrainChargePlan = activeBattlefieldTraversalMap")],
  ["Player AI movement uses battlefield pathfinding", combat.includes("const terrainPlan = activeBattlefieldTraversalMap")],
  ["Formation movement checks adjacent slope legality", combat.includes("resolveBattlefieldTraversalStep({")],
  ["Central canonical movement rejects illegal terrain", combat.includes('eventType: "battlefield-traversal-rejected"')],
  ["Canonical movement receives terrain stamina surcharge", combat.includes("terrainStaminaCost: movementInfo?.terrainStaminaCost ?? 0")],
  ["Controlled routed movement uses slope path", combat.includes("const terrainSurvivalPlan = findBattlefieldTraversalPath({")],
  ["Panic movement uses run-legal slope path", combat.includes("const terrainEscapePlan = activeBattlefieldTraversalMap")],
  ["Canonical movement ledger stores base stamina", canonicalMovement.includes("baseStaminaCost")],
  ["Canonical movement ledger stores terrain stamina", canonicalMovement.includes("terrainStaminaCost: resolvedTerrainStaminaCost")],
  ["Traversal authority exposes weighted reachability", traversal.includes("export function computeBattlefieldReachability")],
  ["Traversal authority exposes weighted pathfinding", traversal.includes("export function findBattlefieldTraversalPath")],
  ["Slope authority remains the edge classification source", slope.includes("resolveBattlefieldSlopeTraversal")],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exit(1);
console.log("PASS Milestone 8C-6D source contract");

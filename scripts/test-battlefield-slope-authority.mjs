import fs from "node:fs";

const source = fs.readFileSync("src/utils/maps/battlefieldSlopeAuthority.js", "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const {
  BATTLEFIELD_SLOPE_TRANSITIONS,
  classifyBattlefieldEdgeTransition,
  getBattlefieldDirectionBetween,
  resolveBattlefieldSlopeTraversal,
} = await import(moduleUrl);

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const grass = (height, extra = {}) => ({ terrain: "grass", height, ...extra });

expect(
  classifyBattlefieldEdgeTransition({ cell: grass(0), neighbor: grass(0), direction: 0 }).type ===
    BATTLEFIELD_SLOPE_TRANSITIONS.FLAT,
  "same elevation should be flat"
);
expect(
  classifyBattlefieldEdgeTransition({ cell: grass(0), neighbor: grass(1), direction: 0 }).type ===
    BATTLEFIELD_SLOPE_TRANSITIONS.SLOPE,
  "one height unit should be a natural slope"
);
expect(
  classifyBattlefieldEdgeTransition({ cell: grass(0), neighbor: grass(2), direction: 0 }).type ===
    BATTLEFIELD_SLOPE_TRANSITIONS.STEEP_SLOPE,
  "two grass height units should be a steep slope"
);
expect(
  classifyBattlefieldEdgeTransition({ cell: grass(0), neighbor: grass(3), direction: 0 }).type ===
    BATTLEFIELD_SLOPE_TRANSITIONS.CLIFF,
  "three height units should remain a cliff"
);
expect(
  classifyBattlefieldEdgeTransition({
    cell: { terrain: "water", height: 0 },
    neighbor: grass(1),
    direction: 0,
  }).type === BATTLEFIELD_SLOPE_TRANSITIONS.CLIFF,
  "water elevation changes should not auto-ramp"
);
expect(
  classifyBattlefieldEdgeTransition({
    cell: grass(0, { edgeTransitions: { E: "wall" } }),
    neighbor: grass(0),
    direction: 0,
  }).type === BATTLEFIELD_SLOPE_TRANSITIONS.WALL,
  "explicit wall edge should override automatic flat edge"
);

const mapDefinition = {
  grid: [[grass(0), grass(1), grass(4)]],
};
const east = getBattlefieldDirectionBetween({ x: 0, y: 0 }, { x: 1, y: 0 });
expect(east?.key === "E", "offset neighbors should resolve east direction");

const slopeMove = resolveBattlefieldSlopeTraversal({
  mapDefinition,
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  movementMode: "walk",
});
expect(slopeMove.accepted === true, "gentle slope should be walkable");
expect(slopeMove.uphill === true, "east test transition should be uphill");
expect(slopeMove.extraDistanceFeet === 2.5, "gentle uphill slope should add 2.5 effective feet");

const cliffMove = resolveBattlefieldSlopeTraversal({
  mapDefinition,
  from: { x: 1, y: 0 },
  to: { x: 2, y: 0 },
  movementMode: "walk",
});
expect(cliffMove.accepted === false, "cliff should block ordinary walking");
expect(cliffMove.requiresClimb === true, "cliff should require climb");

const climbed = resolveBattlefieldSlopeTraversal({
  mapDefinition,
  from: { x: 1, y: 0 },
  to: { x: 2, y: 0 },
  movementMode: "climb",
  climbAuthorized: true,
});
expect(climbed.accepted === true, "authorized climb should traverse cliff");
expect(climbed.staminaCost === 2, "authorized cliff climb should expose stamina cost");

console.log("PASS battlefield slope authority");

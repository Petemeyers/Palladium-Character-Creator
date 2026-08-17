import assert from "node:assert/strict";
import {
  BATTLEFIELD_FOG,
  BATTLEFIELD_LIGHTING,
  normalizeBattlefieldMap,
} from "../src/utils/maps/battlefieldMapAuthority.js";
import {
  calculateBattlefieldTeamVisibility,
  calculateBattlefieldVisibleCellsForObserver,
  getBattlefieldPropOffset,
  resolveActorVisibility,
  resolveBattlefieldLineOfSight,
  resolveBattlefieldVisualRange,
} from "../src/utils/maps/battlefieldVisibilityAuthority.js";

function mapWith({ width = 12, height = 8, lighting = BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT, fog = BATTLEFIELD_FOG.CLEAR, gridPatch = null, props = [], fogOfWar = false } = {}) {
  const grid = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => ({ x, y, terrain: "grass", terrainType: "grass", elevation: 0 })));
  gridPatch?.(grid);
  return normalizeBattlefieldMap({
    id: "visibility-test",
    name: "Visibility Test",
    width,
    height,
    mapSize: { width, height },
    mapType: "hex",
    grid,
    props,
    environment: {
      lighting,
      environmentalFog: { type: fog },
      fogOfWar: { enabled: fogOfWar, teamScoped: true, rememberExplored: true, rememberLastKnownEnemies: true },
    },
  });
}

const observer = { id: "p1", name: "Scout", type: "player" };
const enemy = { id: "e1", name: "Enemy", type: "enemy" };

// Origin coordinates are legal; legacy visibility rejected x=0/y=0.
{
  const battlefield = mapWith();
  const result = resolveActorVisibility({ observer, target: enemy, positions: { p1: { x: 0, y: 0 }, e1: { x: 2, y: 0 } }, battlefield });
  assert.equal(result.visible, true);
  const cells = calculateBattlefieldVisibleCellsForObserver({ observer, position: { x: 0, y: 0 }, battlefield });
  assert(cells.some((cell) => cell.x === 0 && cell.y === 0));
}

// Darkness and environmental fog physically limit vision independent of FOW UI.
{
  const darkness = mapWith({ lighting: BATTLEFIELD_LIGHTING.DARKNESS });
  assert.equal(resolveBattlefieldVisualRange({ observer, battlefield: darkness }), 5);
  assert.equal(resolveActorVisibility({ observer, target: enemy, positions: { p1: { x: 1, y: 1 }, e1: { x: 3, y: 1 } }, battlefield: darkness }).visible, false);

  const fog = mapWith({ fog: BATTLEFIELD_FOG.DENSE_FOG });
  assert.equal(resolveBattlefieldVisualRange({ observer, battlefield: fog }), 36);
  const withFow = mapWith({ fog: BATTLEFIELD_FOG.DENSE_FOG, fogOfWar: true });
  assert.equal(resolveBattlefieldVisualRange({ observer, battlefield: withFow }), 36);
}

// Authored LOS-blocking props use stable offset coordinates.
{
  const battlefield = mapWith({ props: [{ id: "wall", type: "wall", x: 2, y: 1, q: 2, r: 1, coordinateSpace: "offset", blocksLineOfSight: true, heightFeet: 10 }] });
  assert.deepEqual(getBattlefieldPropOffset(battlefield.props[0], battlefield), { x: 2, y: 1 });
  const los = resolveBattlefieldLineOfSight({ from: { x: 0, y: 1 }, to: { x: 4, y: 1 }, battlefield });
  assert.equal(los.hasLineOfSight, false);
  assert.equal(los.reason, "prop-blocked");
}

// A ridge blocks ground observers but can be seen over from sufficiently high ground.
{
  const battlefield = mapWith({ gridPatch(grid) { grid[1][2].elevation = 1; grid[1][2].height = 1; } });
  const ground = resolveBattlefieldLineOfSight({ from: { x: 0, y: 1 }, to: { x: 4, y: 1 }, battlefield });
  assert.equal(ground.reason, "elevation-blocked");
  const elevated = resolveBattlefieldLineOfSight({ from: { x: 0, y: 1 }, to: { x: 4, y: 1 }, battlefield, observerAltitudeFeet: 12 });
  assert.equal(elevated.hasLineOfSight, true);
}

// Multiple forest cells accumulate visual obstruction rather than acting like a single hard wall.
{
  const battlefield = mapWith({ width: 10, gridPatch(grid) {
    for (const x of [2, 3, 4, 5]) {
      grid[2][x].terrain = "forest";
      grid[2][x].terrainType = "forest";
      grid[2][x].formationType = "forest";
    }
  } });
  const los = resolveBattlefieldLineOfSight({ from: { x: 0, y: 2 }, to: { x: 8, y: 2 }, battlefield });
  assert.equal(los.hasLineOfSight, false);
  assert.equal(los.reason, "terrain-concealment-blocked");
}

// Team memory retains last-known enemy position after LOS is lost.
{
  const battlefield = mapWith({ fogOfWar: true });
  const fighters = [observer, { id: "p2", name: "Ally", type: "player" }, enemy];
  const first = calculateBattlefieldTeamVisibility({ team: "party", fighters, positions: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 }, e1: { x: 3, y: 0 } }, battlefield, round: 1 });
  assert(first.visibleEnemyIds.includes("e1"));
  assert.equal(first.lastKnownEnemies.e1.currentlyVisible, true);

  const blocked = mapWith({ fogOfWar: true, props: [{ id: "wall", type: "wall", x: 1, y: 0, q: 1, r: 0, coordinateSpace: "offset", blocksLineOfSight: true, heightFeet: 15 }] });
  const second = calculateBattlefieldTeamVisibility({ team: "party", fighters, positions: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 }, e1: { x: 3, y: 0 } }, battlefield: blocked, previousState: first, round: 2 });
  // p2 may see around a single wall on a hex grid, so force an isolated target behind a wall line if needed.
  if (second.visibleEnemyIds.includes("e1")) {
    const wallMap = mapWith({ fogOfWar: true, props: [0,1,2].map((y) => ({ id: `wall-${y}`, type: "wall", x: 1, y, q: 1, r: y, coordinateSpace: "offset", blocksLineOfSight: true, heightFeet: 15 })) });
    const third = calculateBattlefieldTeamVisibility({ team: "party", fighters, positions: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 }, e1: { x: 3, y: 0 } }, battlefield: wallMap, previousState: first, round: 2 });
    assert(third.hiddenEnemyIds.includes("e1"));
    assert.equal(third.lastKnownEnemies.e1.currentlyVisible, false);
    assert.equal(third.lastKnownEnemies.e1.round, 1);
  } else {
    assert(second.hiddenEnemyIds.includes("e1"));
    assert.equal(second.lastKnownEnemies.e1.currentlyVisible, false);
    assert.equal(second.lastKnownEnemies.e1.round, 1);
  }
}

// Common player/enemy team aliases resolve to canonical party/enemy visibility groups.
{
  const battlefield = mapWith({ fogOfWar: true });
  const fighters = [
    { id: "p-team", name: "Team Scout", team: "players", type: "player" },
    { id: "e-team", name: "Team Enemy", team: "enemies", type: "enemy" },
  ];
  const state = calculateBattlefieldTeamVisibility({
    team: "party",
    fighters,
    positions: { "p-team": { x: 0, y: 0 }, "e-team": { x: 2, y: 0 } },
    battlefield,
    round: 1,
  });
  assert(state.observerIds.includes("p-team"));
  assert(state.visibleEnemyIds.includes("e-team"));
}

// Unconscious fighters do not contribute team sight.
{
  const battlefield = mapWith({ fogOfWar: true });
  const sleepers = [{ id: "sleeping", type: "player", unconscious: true }, enemy];
  const state = calculateBattlefieldTeamVisibility({
    team: "party",
    fighters: sleepers,
    positions: { sleeping: { x: 0, y: 0 }, e1: { x: 1, y: 0 } },
    battlefield,
    round: 1,
  });
  assert.equal(state.observerIds.length, 0);
  assert.equal(state.visibleEnemyIds.length, 0);
}

// Airborne targets can be visible above a ridge even when their ground cell is hidden.
{
  const battlefield = mapWith({ fogOfWar: true, gridPatch(grid) { grid[1][2].elevation = 1; grid[1][2].height = 1; } });
  const flyer = { id: "flyer", name: "Flyer", type: "enemy", flightState: { altitudeFeet: 15 } };
  const state = calculateBattlefieldTeamVisibility({
    team: "party",
    fighters: [observer, flyer],
    positions: { p1: { x: 0, y: 1 }, flyer: { x: 4, y: 1 } },
    battlefield,
    round: 1,
  });
  assert(state.visibleEnemyIds.includes("flyer"));
  assert(state.visibleCells.some((cell) => cell.x === 4 && cell.y === 1));
}

console.log("Milestone 8C-3 battlefield visibility authority tests passed.");

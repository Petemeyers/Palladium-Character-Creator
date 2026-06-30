import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  chooseEnemyMovementFallback,
  executeEnemyMovementPlan,
  hydrateEnemyFromCanonicalPosition,
  isValidEnemyMovementTarget,
  persistEnemyMovementPosition,
  validateEnemyMovementPlan,
} from "../src/utils/enemyMovementFallback.js";
import { getCombatantFootprintHexes } from "../src/utils/enemyClosingMovement.js";

const offsets = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const getNeighbors = (x, y) => offsets.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
const getDistance = (a, b) => (
  (Math.abs(a.x - b.x) + Math.abs(a.x + a.y - b.x - b.y) + Math.abs(a.y - b.y)) / 2
) * 5;
const bounds = { width: 12, height: 10 };
const inBounds = (hex) => hex.x >= 0 && hex.x < bounds.width && hex.y >= 0 && hex.y < bounds.height;
const enemy = { id: "goblin", team: "enemy", size: "medium" };
const hostile = (target) => target.team !== enemy.team;

function makeOptions({ targets, positions, occupied = new Set(), maxHexes = 3, preferred = {} }) {
  const isLegalCenter = (center) => getCombatantFootprintHexes(enemy, center).every((cell) => (
    inBounds(cell) && !occupied.has(`${cell.x},${cell.y}`)
  ));
  return {
    enemy,
    hostileCandidates: targets,
    positions,
    currentPosition: positions[enemy.id],
    maxHexes,
    getNeighbors,
    isLegalCenter,
    getDistance,
    isHostile: hostile,
    canAttackFrom: (position, target, targetPosition) => getDistance(position, targetPosition) <= 5,
    getPreferredAttackHexes: (target) => preferred[target.id] || [],
  };
}

const adjacent = { id: "adjacent", team: "party", HP: 10 };
let plan = chooseEnemyMovementFallback(makeOptions({
  targets: [adjacent],
  positions: { goblin: { x: 2, y: 2 }, adjacent: { x: 3, y: 2 } },
}));
assert.equal(plan.type, "attack-now", "an adjacent enemy attacks normally");

const blocked = { id: "blocked", team: "party", HP: 10 };
const reachable = { id: "reachable", team: "party", HP: 10 };
const blockedRing = new Set(getNeighbors(3, 2).map((hex) => `${hex.x},${hex.y}`));
plan = chooseEnemyMovementFallback(makeOptions({
  targets: [blocked, reachable],
  positions: { goblin: { x: 0, y: 2 }, blocked: { x: 3, y: 2 }, reachable: { x: 1, y: 6 } },
  occupied: blockedRing,
  maxHexes: 5,
}));
assert.equal(plan.target.id, "reachable", "reachable attack target outranks a blocked closer target");
assert.equal(plan.type, "attack-position");

const mutableEnemy = {
  ...enemy,
  remainingActions: 2,
  actionCommitted: false,
  position: { x: 0, y: 2 },
};
const enemyBeforeRanking = structuredClone(mutableEnemy);
const positionsBeforeRanking = {
  goblin: { ...mutableEnemy.position },
  blocked: { x: 3, y: 2 },
  reachable: { x: 1, y: 6 },
};
const positionsSnapshot = structuredClone(positionsBeforeRanking);
const pureRankingPlan = chooseEnemyMovementFallback({
  ...makeOptions({
    targets: [blocked, reachable],
    positions: positionsBeforeRanking,
    occupied: blockedRing,
    maxHexes: 5,
  }),
  enemy: mutableEnemy,
});
assert.deepEqual(mutableEnemy, enemyBeforeRanking, "candidate ranking does not mutate the enemy");
assert.deepEqual(positionsBeforeRanking, positionsSnapshot, "candidate ranking does not mutate positions");
assert.equal(mutableEnemy.remainingActions, 2, "candidate ranking does not spend an action");
assert.equal(mutableEnemy.actionCommitted, false, "candidate ranking does not commit an action");

let commitCount = 0;
let moveCount = 0;
let spendCount = 0;
let finishCount = 0;
const execution = executeEnemyMovementPlan(pureRankingPlan, {
  commit: () => {
    commitCount += 1;
    mutableEnemy.actionCommitted = true;
    return true;
  },
  move: (position) => {
    moveCount += 1;
    mutableEnemy.position = { ...position };
  },
  spendAction: () => {
    spendCount += 1;
    mutableEnemy.remainingActions -= 1;
  },
  finish: () => {
    finishCount += 1;
  },
});
assert.equal(execution.executed, true);
assert.equal(commitCount, 1, "final execution commits exactly once");
assert.equal(moveCount, 1, "final execution moves exactly once");
assert.equal(spendCount, 1, "final execution spends exactly once");
assert.equal(finishCount, 1, "final execution always reaches its finish path");
assert.equal(mutableEnemy.remainingActions, 1);
assert.deepEqual(mutableEnemy.position, pureRankingPlan.position);

let rejectedFinishCount = 0;
const rejected = executeEnemyMovementPlan(pureRankingPlan, {
  commit: () => false,
  finish: () => { rejectedFinishCount += 1; },
});
assert.equal(rejected.executed, false);
assert.equal(rejectedFinishCount, 1, "a rejected action claim still releases the turn through finish");

function assertGenericRunFinishes({ id, maxHexes }) {
  const runner = { id, team: "enemy", size: "medium", remainingActions: 2 };
  const distantTarget = { id: `${id}-target`, team: "party", HP: 10 };
  const runPositions = {
    [id]: { x: 1, y: 4 },
    [distantTarget.id]: { x: 24, y: 4 },
  };
  const runPlan = chooseEnemyMovementFallback({
    enemy: runner,
    hostileCandidates: [distantTarget],
    positions: runPositions,
    currentPosition: runPositions[id],
    maxHexes,
    getNeighbors,
    isLegalCenter: (position) => position.x >= 0 && position.x < 30 && position.y >= 0 && position.y < 10,
    getDistance,
    isHostile: () => true,
    canAttackFrom: (position, candidate, candidatePosition) => getDistance(position, candidatePosition) <= 5,
  });
  assert.equal(runPlan.type, "approach", `${id} selects a distant RUN approach`);
  assert.equal(validateEnemyMovementPlan(runPlan, {
    currentPosition: runPositions[id],
    isLegalCenter: (position) => position.x >= 0 && position.x < 30 && position.y >= 0 && position.y < 10,
  }).valid, true);

  let commits = 0;
  let finishes = 0;
  const before = { ...runPositions[id] };
  executeEnemyMovementPlan(runPlan, {
    commit: () => { commits += 1; return true; },
    move: (position) => { runPositions[id] = { ...position }; },
    spendAction: () => { runner.remainingActions -= 1; },
    finish: () => { finishes += 1; },
  });
  assert.notDeepEqual(runPositions[id], before, `${id} changes position`);
  assert.equal(commits, 1, `${id} commits one RUN action`);
  assert.equal(finishes, 1, `${id} always advances through finish`);
  assert.equal(runner.remainingActions, 1, `${id} spends one action`);
}

assertGenericRunFinishes({ id: "slow-knight", maxHexes: 7 });
assertGenericRunFinishes({ id: "fast-goblin", maxHexes: 12 });

function assertOpenGroundApproach({ id, name, maxHexes }) {
  const runner = { id, name, team: "enemy", size: "medium", remainingActions: 2 };
  const target = { id: `${id}-longbowman-3`, name: "Longbowman #3", team: "party", HP: 10 };
  const openArena = { name: "Default Arena", description: "Open ground" };
  const positions = {
    [runner.id]: { x: 32, y: 14 },
    [target.id]: { x: 8, y: 15 },
  };
  const occupied = new Set([
    `${positions[runner.id].x},${positions[runner.id].y}`,
    `${positions[target.id].x},${positions[target.id].y}`,
  ]);
  const offsetToCube = (col, row) => {
    const x = col - (row - (row & 1)) / 2;
    const z = row;
    return { x, y: -x - z, z };
  };
  const calculateOpenArenaDistance = (left, right) => {
    const a = offsetToCube(left.x, left.y);
    const b = offsetToCube(right.x, right.y);
    return ((Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2) * 5;
  };
  const getOpenArenaNeighbors = (x, y) => {
    const directions = (y & 1)
      ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]]
      : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
    return directions.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
  };
  const isLegalCenter = (position) => (
    // Regression guard: the arena object must never be passed as gridWidth.
    position.x >= 0 && position.x < 40 && position.y >= 0 && position.y < 30 &&
    (!occupied.has(`${position.x},${position.y}`) ||
      (position.x === positions[runner.id].x && position.y === positions[runner.id].y))
  );
  const beforeDistance = calculateOpenArenaDistance(positions[runner.id], positions[target.id]);
  const movementPlan = chooseEnemyMovementFallback({
    enemy: runner,
    hostileCandidates: [target],
    positions,
    currentPosition: positions[runner.id],
    maxHexes,
    getNeighbors: getOpenArenaNeighbors,
    isLegalCenter,
    getDistance: calculateOpenArenaDistance,
    isHostile: () => true,
    canAttackFrom: (position, candidate, candidatePosition) => (
      calculateOpenArenaDistance(position, candidatePosition) <= 5
    ),
    arena: openArena,
  });

  assert.equal(movementPlan.type, "approach", `${name} uses a partial open-ground approach`);
  assert.ok(movementPlan.path.length > 1, `${name} receives an executable direct-step path`);
  assert.ok(movementPlan.path.length - 1 <= maxHexes, `${name} stays within its movement budget`);
  assert.ok(
    calculateOpenArenaDistance(movementPlan.position, positions[target.id]) < beforeDistance,
    `${name} ends closer without requiring an attack-adjacent endpoint`,
  );
  assert.ok(
    calculateOpenArenaDistance(movementPlan.position, positions[target.id]) > 5,
    `${name}'s partial endpoint can remain outside melee range`,
  );

  const startingPosition = { ...positions[runner.id] };
  const staleInitiativeSnapshot = [{ ...runner, position: { ...startingPosition } }];
  const canonicalPositionsRef = { current: { ...positions } };
  let canonicalState = canonicalPositionsRef.current;
  let canonicalWrites = 0;
  let moves = 0;
  let actions = 0;
  let advances = 0;
  executeEnemyMovementPlan(movementPlan, {
    commit: () => true,
    move: (position) => {
      moves += 1;
      const persistence = persistEnemyMovementPosition({
        fighterId: runner.id,
        destination: position,
        positionsRef: canonicalPositionsRef,
        setPositions: (updater) => {
          canonicalWrites += 1;
          canonicalState = typeof updater === "function" ? updater(canonicalState) : updater;
        },
      });
      assert.equal(persistence.persisted, true, `${name} persists its approach move`);
    },
    spendAction: () => {
      actions += 1;
      runner.remainingActions -= 1;
    },
    finish: () => { advances += 1; },
  });
  assert.equal(moves, 1, `${name} changes position exactly once`);
  assert.equal(canonicalWrites, 1, `${name} updates canonical position exactly once`);
  assert.deepEqual(canonicalState[runner.id], movementPlan.position, `${name} state stores destination`);
  assert.deepEqual(
    canonicalPositionsRef.current[runner.id],
    movementPlan.position,
    `${name}'s next turn reads the moved coordinate from the canonical ref`,
  );
  assert.notDeepEqual(
    canonicalPositionsRef.current[runner.id],
    staleInitiativeSnapshot[0].position,
    `${name}'s stale initiative snapshot does not restore the original coordinate`,
  );
  const nextTurnPosition = canonicalPositionsRef.current[staleInitiativeSnapshot[0].id] ||
    staleInitiativeSnapshot[0].position;
  const nextTurnLog = `${name} is at (${nextTurnPosition.x}, ${nextTurnPosition.y})`;
  assert.equal(
    nextTurnLog.includes(`(${startingPosition.x}, ${startingPosition.y})`),
    false,
    `${name}'s next-turn log does not reuse the stale original coordinate`,
  );
  assert.ok(
    calculateOpenArenaDistance(
      canonicalPositionsRef.current[runner.id],
      canonicalPositionsRef.current[target.id],
    ) < beforeDistance,
    `${name}'s next turn begins closer to the target`,
  );
  assert.equal(actions, 1, `${name} spends exactly one action`);
  assert.equal(advances, 1, `${name} advances the turn exactly once`);
}

assertOpenGroundApproach({ id: "open-knight", name: "Knight", maxHexes: 7 });
assertOpenGroundApproach({ id: "open-goblin", name: "Goblin Warrior", maxHexes: 18 });

{
  const goblinId = "repeated-goblin";
  const staleInitiativeGoblin = {
    id: goblinId,
    name: "Goblin Warrior",
    position: { x: 25, y: 13 },
    x: 25,
    y: 13,
  };
  const canonicalPositionsRef = {
    current: {
      [goblinId]: { x: 25, y: 13 },
      longbowman: { x: 8, y: 15 },
    },
  };
  let stateWrites = 0;
  let canonicalState = canonicalPositionsRef.current;
  const persist = (destination) => persistEnemyMovementPosition({
    fighterId: goblinId,
    destination,
    positionsRef: canonicalPositionsRef,
    setPositions: (updater) => {
      stateWrites += 1;
      canonicalState = typeof updater === "function" ? updater(canonicalState) : updater;
    },
  });

  persist({ x: 12, y: 16 });
  assert.deepEqual(canonicalState[goblinId], { x: 12, y: 16 });
  let nextTurnGoblin = hydrateEnemyFromCanonicalPosition(
    staleInitiativeGoblin,
    canonicalPositionsRef.current,
  );
  assert.deepEqual(nextTurnGoblin.position, { x: 12, y: 16 });
  assert.equal(nextTurnGoblin.x, 12, "same-round turn hydration uses canonical x");
  assert.equal(nextTurnGoblin.y, 16, "same-round turn hydration uses canonical y");

  // Turn and round advancement keep the stale initiative identity but must
  // hydrate coordinates by ID from the canonical map on every planning cycle.
  const turnAdvancedSnapshot = { ...staleInitiativeGoblin, remainingActions: 1 };
  const nextRoundSnapshot = { ...turnAdvancedSnapshot, remainingActions: 2 };
  nextTurnGoblin = hydrateEnemyFromCanonicalPosition(
    nextRoundSnapshot,
    canonicalPositionsRef.current,
  );
  assert.deepEqual(nextTurnGoblin.position, { x: 12, y: 16 });
  assert.notDeepEqual(nextTurnGoblin.position, staleInitiativeGoblin.position);

  persist({ x: 10, y: 15 });
  const repeatedMoveGoblin = hydrateEnemyFromCanonicalPosition(
    staleInitiativeGoblin,
    canonicalPositionsRef.current,
  );
  assert.deepEqual(repeatedMoveGoblin.position, { x: 10, y: 15 });
  assert.equal(stateWrites, 2, "each repeated closing move persists exactly once");
}

{
  const goblinId = "run-then-move-goblin";
  const start = { x: 31, y: 15 };
  const afterRun = { x: 24, y: 15 };
  const afterMove = { x: 12, y: 16 };
  const staleTurnOrderGoblin = { id: goblinId, name: "Goblin Warrior", position: start };
  const canonicalPositionsRef = { current: { [goblinId]: start } };
  let reactPositions = { [goblinId]: start };
  let writes = 0;
  const persistClosingAction = (destination) => persistEnemyMovementPosition({
    fighterId: goblinId,
    destination,
    positionsRef: canonicalPositionsRef,
    setPositions: (updater) => {
      writes += 1;
      reactPositions = updater(reactPositions);
    },
  });

  persistClosingAction(afterRun);
  assert.deepEqual(
    hydrateEnemyFromCanonicalPosition(staleTurnOrderGoblin, canonicalPositionsRef.current).position,
    afterRun,
    "next Goblin action starts from the persisted RUN destination",
  );

  const staleActionSnapshot = {
    ...staleTurnOrderGoblin,
    position: afterRun,
    remainingActions: 1,
  };
  persistClosingAction(afterMove);
  assert.deepEqual(reactPositions[goblinId], afterMove, "MOVE functional update defeats stale state");
  assert.deepEqual(
    hydrateEnemyFromCanonicalPosition(staleActionSnapshot, canonicalPositionsRef.current).position,
    afterMove,
    "next Goblin action starts from the repeated MOVE destination",
  );
  assert.notDeepEqual(canonicalPositionsRef.current[goblinId], afterRun);
  assert.equal(writes, 2, "RUN and MOVE each perform one canonical state write");
}

const noOpPlan = {
  type: "approach",
  target: reachable,
  position: { x: 0, y: 2 },
  path: [{ x: 0, y: 2 }],
};
const noOpValidation = validateEnemyMovementPlan(noOpPlan, {
  currentPosition: { x: 0, y: 2 },
  isLegalCenter: () => true,
});
assert.equal(noOpValidation.valid, false);
assert.equal(noOpValidation.reason, "no-op-destination");
let noOpMoves = 0;
let noOpFinishes = 0;
executeEnemyMovementPlan({ ...noOpPlan, type: "hold", position: null }, {
  commit: () => true,
  move: () => { noOpMoves += 1; },
  spendAction: () => {},
  finish: () => { noOpFinishes += 1; },
});
assert.equal(noOpMoves, 0, "invalid/no-op destination never moves");
assert.equal(noOpFinishes, 1, "invalid/no-op destination holds once and advances");

let failedMovementSpends = 0;
let failedMovementFinishes = 0;
const failedMovement = executeEnemyMovementPlan(pureRankingPlan, {
  commit: () => true,
  move: () => { throw new Error("simulated movement failure"); },
  spendAction: () => { failedMovementSpends += 1; },
  finish: () => { failedMovementFinishes += 1; },
});
assert.equal(failedMovement.executed, false);
assert.equal(failedMovement.reason, "movement-execution-error");
assert.equal(failedMovementSpends, 1, "failed committed movement still spends once");
assert.equal(failedMovementFinishes, 1, "failed committed movement releases the lock and advances");

const flankTarget = { id: "champion", team: "party", HP: 20 };
plan = chooseEnemyMovementFallback(makeOptions({
  targets: [flankTarget],
  positions: { goblin: { x: 1, y: 3 }, champion: { x: 4, y: 3 } },
  occupied: new Set(["3,3"]),
  preferred: { champion: [{ x: 3, y: 3 }] },
  maxHexes: 3,
}));
assert.equal(plan.type, "attack-position", "blocked flank falls back to a normal attack hex");
assert.equal(plan.usedFlankFallback, true);
assert.notDeepEqual(plan.position, { x: 3, y: 3 });

const far = { id: "far", team: "party", HP: 10 };
plan = chooseEnemyMovementFallback(makeOptions({
  targets: [far],
  positions: { goblin: { x: 1, y: 1 }, far: { x: 10, y: 1 } },
  occupied: new Set(["2,1"]),
  maxHexes: 3,
}));
assert.equal(plan.type, "approach", "enemy advances when no attack hex is reachable this action");
assert.ok(getDistance(plan.position, { x: 10, y: 1 }) < getDistance({ x: 1, y: 1 }, { x: 10, y: 1 }));
assert.notDeepEqual(plan.position, { x: 2, y: 1 }, "approach uses a validated detour");

plan = chooseEnemyMovementFallback(makeOptions({
  targets: [far],
  positions: { goblin: { x: 1, y: 1 }, far: { x: 10, y: 1 } },
  occupied: new Set(getNeighbors(1, 1).map((hex) => `${hex.x},${hex.y}`)),
  maxHexes: 3,
}));
assert.equal(plan.type, "hold", "enemy holds only when no legal step exists");

for (const invalid of [
  { id: "dead", team: "party", HP: 0 },
  { id: "defeated", team: "party", defeated: true },
  { id: "fled", team: "party", fled: true },
  { id: "passive", team: "party", controlMode: "passive" },
  { id: "ally", team: "enemy", HP: 10 },
  { id: "unconscious", team: "party", unconscious: true },
]) {
  assert.equal(isValidEnemyMovementTarget(invalid, { isHostile: hostile }), false, `${invalid.id} is not targeted`);
}

const largeEnemy = { ...enemy, size: "large" };
const largeObstacle = new Set(["4,2"]);
const largeOptions = makeOptions({
  targets: [far],
  positions: { goblin: { x: 1, y: 3 }, far: { x: 10, y: 3 } },
  maxHexes: 3,
});
largeOptions.enemy = largeEnemy;
largeOptions.isLegalCenter = (center) => getCombatantFootprintHexes(largeEnemy, center)
  .every((cell) => inBounds(cell) && !largeObstacle.has(`${cell.x},${cell.y}`));
plan = chooseEnemyMovementFallback(largeOptions);
assert.ok(plan.position, "large enemy finds a movement fallback");
assert.equal(
  getCombatantFootprintHexes(largeEnemy, plan.position).some((cell) => largeObstacle.has(`${cell.x},${cell.y}`)),
  false,
  "large footprint never overlaps a blocked cell",
);

const enemyAiSource = await readFile(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");
assert.match(enemyAiSource, /cannot attack this action, closing distance/);
assert.match(enemyAiSource, /cannot find a legal approach hex/);
assert.match(enemyAiSource, /all closer candidates are blocked/);
assert.doesNotMatch(enemyAiSource, /isValidPosition\(cell\.x, cell\.y, combatTerrain\)/);
const playerAiSource = await readFile(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.match(playerAiSource, /computeBeeDetour/);
assert.match(playerAiSource, /follows BeeLine path/);
const combatPageSource = await readFile(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPageSource, /chooseLegacyMovementPlan/);
assert.match(combatPageSource, /redirects toward/);
assert.match(combatPageSource, /moves from \(\$\{currentPos\.x\},\$\{currentPos\.y\}\) to/);
assert.match(combatPageSource, /hydrateEnemyFromCanonicalPosition\(liveEnemy, livePositions\)/);
assert.match(
  combatPageSource,
  /if \(persistImmediately && movementAction !== 'CHARGE'\)/,
  "immediate RUN and MOVE closing share the canonical persistence branch",
);
assert.doesNotMatch(
  combatPageSource,
  /isRunOrSprint && persistImmediately/,
  "immediate persistence is no longer restricted to RUN",
);
assert.doesNotMatch(
  combatPageSource,
  /currentPosition:\s*previousPosition/,
  "previousPosition remains movement history and is never the next planning origin",
);
const sharedPreviousPositionDeclaration = combatPageSource.indexOf(
  "const previousPosition = closingMovementHistory",
);
const legacyPlannerDeclaration = combatPageSource.indexOf("const chooseLegacyMovementPlan");
assert.ok(
  sharedPreviousPositionDeclaration >= 0 &&
    sharedPreviousPositionDeclaration < legacyPlannerDeclaration,
  "legacy enemy planner defines previousPosition in shared scope before use",
);
assert.doesNotMatch(
  combatPageSource.slice(sharedPreviousPositionDeclaration, legacyPlannerDeclaration + 1800),
  /movement planning failed: previousPosition is not defined/,
  "legacy planner source cannot emit the previousPosition scope failure",
);
assert.doesNotMatch(combatPageSource, /isValidPosition\(cell\.x, cell\.y, combatTerrain\)/);
assert.equal(
  combatPageSource.match(/addLog\("blocked movement action consumed"/g)?.length || 0,
  1,
  "the generic blocked-action message has only one emitting path",
);

console.log("enemy movement fallback tests passed");

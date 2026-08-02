import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { commitPositionAuthoritySnapshot } from "../src/utils/combat/positionAuthorityAudit.js";
import { resolveNoMovePositionAuthority } from "../src/utils/combat/noMovePositionPreservation.js";

const stale = { id: "party-longbowman", x: 19, y: 25, position: { x: 19, y: 25 } };
const committed = commitPositionAuthoritySnapshot({
  fighters: [stale],
  positions: { [stale.id]: { x: 19, y: 25 } },
  committedPositions: { [stale.id]: { x: 19, y: 25 } },
  actorId: stale.id,
  position: { x: 18, y: 25 },
});
assert.equal(committed.accepted, true);
assert.equal(committed.audit.matches, true);
assert.deepEqual(committed.audit.fighterPosition, { x: 18, y: 25 });
assert.deepEqual(committed.audit.positionsRefPosition, { x: 18, y: 25 });
assert.deepEqual(committed.audit.committedPosition, { x: 18, y: 25 });

const preserved = resolveNoMovePositionAuthority({
  lastMovementCommit: { x: 18, y: 25, sequence: 2 },
  committedPosition: committed.committedPositions[stale.id],
  refPosition: committed.positions[stale.id],
  latestFighter: committed.fighters[0],
  staleActor: stale,
  source: "routed-no-move-fallback",
});
assert.deepEqual({ x: preserved.x, y: preserved.y }, { x: 18, y: 25 });

const page = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(page, /commitAuthoritativeCombatPosition\(fighter\.id, destination, source \|\| "routed-survival-movement"\)/);
assert.match(page, /commitAuthoritativeCombatPosition\(fighter\.id, retreat\.position, source \|\| "routed-panic-flee"\)/);
assert.match(page, /eventType: "position-authority-audit"/);

console.log("routed position authority synchronization tests passed");

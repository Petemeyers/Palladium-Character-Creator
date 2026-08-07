MILESTONE 8 — TACTICAL MOVEMENT, COMMAND, AND BATTLEFIELD NAVIGATION
PHASE 8A — CANONICAL FORMATION MOVEMENT AI

BASELINE

Apply after the integrated Milestone 7 build.

NEW FILE

src/utils/combat/formationMovementPlanner.js

MODIFIED FILES

src/utils/combat/formationCommandAuthority.js
src/pages/CombatPage.jsx

TESTS

scripts/test-formation-movement-planner.mjs
scripts/test-milestone8a-source-contract.mjs

WHAT CHANGED

AI fighters can now execute the movement-based formation commands that
Milestone 7 exposed:

- Close Ranks
- Withdraw in Order

Both commands use one shared deterministic planner for manual and automated
fighters. The planner checks adjacent legal hexes, occupancy, support,
cohesion, target separation, line depth, facing preservation, and terrain
movement pressure.

Close Ranks improves spatial support without silently clearing an existing
formation disruption. Withdraw in Order increases separation while preserving
support. Commands cannot repeat their movement in the same round and cannot be
selected or resolved without enough actions and stamina.

VALIDATION COMMANDS

node scripts/test-formation-movement-planner.mjs
node scripts/test-milestone8a-source-contract.mjs

Full inherited tests and the production build must run in the complete game
repository because this handoff package intentionally does not duplicate every
Milestone 1–7 source file.

---

## 2026-08-07 live-combat stabilization

The first integrated 5v5 Milestone 8A battle exposed attack-modifier arithmetic drift, requested-vs-committed player-AI movement continuation, and repeated formation recovery commands. The stabilization pass in this package adds a canonical attack-modifier ledger, synchronizes AI continuation to the committed movement endpoint, adds per-initiative formation-command receipts, fixes formation movement narration, and lowers identifiable expected tactical rejections from error severity.

See `MILESTONE8A_STABILIZATION_STATUS.md` and `MILESTONE8A_STABILIZATION_VALIDATION.txt`.

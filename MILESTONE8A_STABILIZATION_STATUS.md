# Milestone 8A Live-Combat Stabilization

Date: 2026-08-07
Baseline: Milestone 8A post-integration handoff
Evidence: combat-log-2026-08-06-221821.txt (5 vs 5 Arena Champion live battle)

## Scope

This stabilization pass addresses correctness defects exposed by the first live Milestone 8A battle before Phase 8B proceeds.

## Implemented

### 1. Canonical attack-modifier ledger

- Removed the late second application of the polearm matchup modifier after the d20 roll.
- Added `attackModifierAuthority.js` to sum registered modifier components and reconcile the final attack total.
- Final normal attack total is now forced to `natural d20 + canonical modifier ledger` before `buildCanonicalAttackRollEvent`.
- A developer warning (`attack-roll-total-reconciled`) is emitted if an upstream path reports a different total, preventing silent arithmetic drift.
- Late polearm exchange context is narration/validation only; a disagreement with the earlier canonical matchup emits `polearm-matchup-context-mismatch` rather than mutating the roll.
- Melee reach bonus is explicitly excluded from ranged attacks.

### 2. Canonical player-AI movement destination

- After movement authority clips a requested move to the legal action budget, the committed endpoint is written back into the AI position snapshot and normalized AI context.
- The planner destination/fighter snapshot is reconciled to the committed endpoint when mutable.
- Player-AI movement narration that conflicts with the most recent canonical movement commit is suppressed with `stale-player-ai-movement-log-suppressed`.
- Range/flank continuation is therefore directed at the committed position instead of a farther requested coordinate.

### 3. Formation-command continuation receipts

- Added `formationCommandTurnReceipt.js`.
- Every resolved automated/manual formation command records its command ID, success, initiative turn, and round.
- The same formation command cannot be selected twice during one initiative turn.
- After successful `Reform Line` or `Rally Formation`, both recovery commands are suppressed for the remainder of that initiative turn.
- A failed recovery command suppresses only an identical retry, allowing a different legal tactical action.

### 4. Formation narration

- `Close Ranks` now narrates as `closes ranks and moves` instead of `close-rankss`.
- Ordered withdrawal/reform/anchor movement narration also uses explicit verbs.

### 5. Expected rejection severity

Expected tactical rejections present in the handoff were lowered from error to info where identifiable in `CombatPage.jsx`, including:

- no actions remaining,
- out-of-reach attack rejection.

A narrow severity guard at the canonical log boundary also downgrades `Weapon too long (...) for available width (...)` when a lower-level path emits it as an error. This changes presentation severity only; the tactical rejection remains enforced.

## Deferred because the source file is absent from this handoff

### Arena Champion schema migration

The live log shows Arena Champion instances entering through the `unmigrated-actor-schema` compatibility path. The selectable/preset definition that should declare the current `combatActorSchemaVersion` is not present in this partial Milestone 8A handoff. This pass deliberately does not stamp the version at runtime because doing so before validation could hide a real migration defect.

Apply the preset migration in the full integrated repository where the Arena Champion source actor is defined, then retain runtime validation as a safety boundary.

## Validation

Passed directly in the handoff:

- `scripts/test-milestone8a-stabilization.mjs`
- `scripts/test-milestone8a-source-contract.mjs`
- `scripts/test-milestone7-source-contract.mjs`
- `scripts/test-milestone7-calibration-sample.mjs`
- `scripts/test-terrain-formation-authority.mjs`
- `scripts/test-shield-aftermath-authority.mjs`
- Node syntax checks for new/changed combat helper modules
- TypeScript JSX parser check for `CombatPage.jsx`

Passed in an isolated validation copy using minimal validation-only stubs for inherited Milestone 6 modules absent from the handoff:

- `scripts/test-formation-command-authority.mjs`
- `scripts/test-formation-movement-planner.mjs`
- `scripts/test-weapon-bind-counterplay-authority.mjs`

The validation-only stubs are not included in the deliverable.

## Required live retest

Run another 5 vs 5 Arena Champion battle after applying this stabilization and verify:

1. `attack-roll-modifier-arithmetic-invalid` count is zero.
2. No range/flank continuation uses a requested destination after a shorter canonical movement commit.
3. No fighter repeats `Reform Line`/`Rally Formation` after a successful recovery during the same initiative turn.
4. `close-rankss` never appears.
5. Combat reaches terminal cleanup without unresolved turns or attack keys.

Do not use the previous battle for balance tuning; its attack-roll arithmetic was not authoritative.

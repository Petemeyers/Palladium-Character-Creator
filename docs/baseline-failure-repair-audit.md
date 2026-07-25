# Baseline failure repair audit

No combat probability, damage, armor, movement-distance, initiative, stamina-cost,
stamina-recovery, morale, surrender, grapple, tactical-weight, action-economy,
round-duration, projectile-range, or polearm-reach formula was changed.

## 1. `test-weapon-reach-length-split.mjs`

- Failing assertion: Heavy Axe cramped-space length was `5`, expected explicit `6`.
- Production: `combatEnvironmentLogic.js`; canonical weapon profiles and extended-reach resolver.
- Invariant: physical length and legal attack reach are independent; projectile range is neither.
- Classification: **E** (runtime defect plus obsolete coverage).
- Root cause: `getWeaponLength` found `lengthFt`, then overwrote it with a weapon-type default; ranged fallback used projectile range as length.
- Repair: explicit physical length now wins, melee reach is compatibility-only, and projectiles use a finite neutral fallback when physical length is absent.
- Test repair: canonical Long Sword, both spears, Pike, Halberd, Longbow, Crossbow, and thrown Dagger now exercise profile and legality boundaries.

## 2. `test-panic-flee-spends-stamina.mjs`

- Failing assertion: an unauthoritative legacy stamina alias expected `3` but canonical initialization correctly produced `5`.
- Production: `survivalIntent.js`, `CombatPage.jsx`.
- Invariant: real panic movement spends the existing cost once under the active action token; cower, failed movement, and stale work spend zero.
- Classification: **E**.
- Root cause: the test treated an unmarked legacy field as canonical, while the live path lacked a reusable post-movement ownership boundary.
- Repair: `resolvePanicFleeStaminaSpend` gates the unchanged cost on committed movement and exact token identity.
- Test repair: the compatibility fixture declares its legacy authority; committed, no-move, edge, stale, and exhaustion cases are executable.

## 3. `test-player-ai-flanking-captured-key-valid.mjs`

- Failing assertion: expected `const flankingAttackGrant`, while the refactored lifecycle uses a mutable terminal-cleanup slot.
- Production: `playerTurnAI.js`, `playerAiContinuation.js`.
- Invariant: the exact live actor/target grant and execution key are captured once and cannot survive identity changes.
- Classification: **E**.
- Root cause: the source assertion was stale, and production still had random fallback key/no-turn-token escape paths.
- Repair: live actor identity is used; missing grants or rejected keys recover without attacking; fabricated fallback keys were removed.
- Test repair: exact generation, session, turn, actor, target, and sequence validation now has executable positive and stale cases.

## 4. `test-enemy-approach-planner-entry-must-log-return-or-error.mjs`

- Failing assertion: a single regular expression assumed a particular `try/catch` source layout.
- Production: `enemyApproachPlannerContract.js`, `CombatPage.jsx`.
- Invariant: every planner entry resolves, rejects, or errors with normalized identity and movement data.
- Classification: **E**.
- Root cause: diagnostics existed, but no reusable normalized contract existed and the source-layout test could not recognize nested callbacks.
- Repair: the planner wrapper returns explicit movement, no-path, range, rejection, and exception outcomes; structured lifecycle events were added.
- Test repair: ordinary movement, no path, stale authority, invalid actors/targets, improvement, entered range, and exception are executable.

## 5. `test-survival-intent-enemy-and-player-paths-covered.mjs`

- Failing assertion: the player-AI path was expected to contain a later horror finalizer string.
- Production: `ownedSurvivalAction.js`, `CombatPage.jsx`.
- Invariant: player and enemy survival actions dispatch only for a live actor under the exact active action token.
- Classification: **E**.
- Root cause: the test no longer validated its filename, and dispatch ownership was implicit in surrounding turn flow.
- Repair: all three routed entry points use the shared owned dispatcher.
- Test repair: both AI sides, cower, stale token, and terminal actor rejection are exercised directly; the existing surrender suite covers atomic offers.

## 6. `test-normal-melee-damage-log-uses-side-qualified-damaged-target.mjs`

- Failing assertion: expected an exclamation mark and component-local template that had changed to a structured event.
- Production: `combatActorIdentity.js`, `CombatPage.jsx`.
- Invariant: damage events retain stable actor/target IDs and sides, while player text disambiguates duplicate names without exposing IDs.
- Classification: **E**.
- Root cause: behavior was mostly correct, but event construction remained component-local and the test asserted punctuation.
- Repair: `buildCombatDamageLogEvent` is the canonical structured event/label builder.
- Test repair: both directions, same-side duplicates, unique names, damage metadata, and zero bodily damage are covered.

## 7. `test-combat-action-catalog.mjs`

- Failing assertion: expected action name `Move`; the canonical command is `Walk`.
- Production: `combatActionCatalog.js`, `CombatActionCatalogPanel.jsx`.
- Invariant: visible actions have stable identity, costs, roll/turn behavior, legal states, executor identity, and AI/player visibility.
- Classification: **E**.
- Root cause: stale naming plus incomplete catalog contract metadata.
- Repair: canonical action contracts were added; compatibility transitions remain available in their panel but are filtered from the canonical catalog.
- Test repair: `Walk` and contract completeness are validated, including grapple, surrender, ranged, extended-melee, reload, and draw executor classes.

## 8. `test-combat-command-layout.mjs`

- Failing assertion: expected retired label `Legacy / Compatibility Tools`; current intentional label is `Advanced Combat Tools`.
- Production: none.
- Invariant: canonical commands remain discoverable, illegal commands are disabled, End Turn and movement remain accessible, and surrender blocks conflicting input.
- Classification: **B**.
- Root cause: obsolete presentation expectations.
- Test repair: semantic component/accessibility behavior replaced old labels and fixed source positions.

## 9. `test-combat-control-streamlining.mjs`

- Failing assertion: the same retired compatibility label.
- Production: none.
- Invariant: one catalog, selected-action resolver, and surrender owner exist; advanced controls remain collapsed; deleted quick starts stay absent.
- Classification: **D**.
- Root cause: it duplicated the layout test rather than validating control-authority reduction.
- Test repair: authoritative component counts, shared End Turn authority, collapsed advanced tools, and absence of preset controls are checked.

## 10. `test-combat-environment-length-baseline.mjs`

- Failing assertion: explicit nine-foot physical length became six feet; later unreachable assertions also treated Longbow range as length and an unknown tool as short.
- Production: `combatEnvironmentLogic.js`.
- Invariant: environment clearance consumes physical length, with safe finite compatibility fallbacks.
- Classification: **E**.
- Root cause: the same explicit-length overwrite as failure 1 plus obsolete fallback expectations.
- Repair: covered by the physical-length authority repair.
- Test repair: the test remains a semantic environment/clearance guard rather than an arbitrary source line-count check.

## Cross-cutting regression

`scripts/test-baseline-failure-repairs.mjs` provides one compact executable check
for all ten repaired invariants. Detailed tests remain the authoritative coverage.

# Phase 3C4A1 Live Wildlife, Concealment, and Ranged Audit

Starting authority: `c1df428 feat: add canonical hunting and wildlife behavior`.

## Reproduced bypasses

| Area | Live path before repair | Finding | Phase 3C4A1 authority |
| --- | --- | --- | --- |
| Wildlife intent | `runEnemyTurnAI → visiblePlayers → prioritizeEnemyCombatTargets → movement fallback` | Ordinary `/combat` did not create hunting intent. Team hostility reached generic target priority first. | `resolveLiveWildlifeTurnContext` runs immediately after observer visibility and before healer, utility, target priority, or `RUN_TO_RANGE`. |
| Boar | generic hostile target → out-of-range plan → `RUN_TO_RANGE` → adjacent fallback | The Boar approached a distant humanoid because side was treated as motivation. An illegal adjacent Tusk Charge could fall through to generic Unarmed Attack. | A normal Boar classifies the humanoid as a threat, resolves an exit/cover route, and commits `WILDLIFE_FLEE`. Only explicit or cornered defensive aggression may enter generic attack routing; adjacent cornered Boar holds defensively. |
| Hawk quarry | name/size helpers in `enemyTurnAI` | `isPreferredHawkPrey` accepted tiny scout humanoids and display-name prey keywords. | Canonical `quarryProfile` is authoritative. Humanoids, Boar, and oversized candidates are rejected before attack routing. |
| Hawk movement | inline flying narration and altitude changes | Search/climb/glide text could be emitted without an owned horizontal commit. | `resolveAerialSearchWaypoint` produces a bounded, threat-aware waypoint. Live routing calls the existing authoritative position callback before emitting movement text. |
| Hawk anatomy | `animalAnatomy` | The helper hardcoded `bodyPlan: "quadruped"` and quadruped limbs even for Hawk and Falcon. | Avian definitions explicitly use `bodyPlan: "avian"`, wings, talons, and avian locomotion limbs. Legacy normalization restores the canonical definition before combat. |
| Hide | `CombatPage → attemptMidCombatHide` | A missing Prowl percentage caused an immediate rejection. Cover was primarily an actor flag. | Canonical Hide first proves terrain/geometry concealment, then uses an untrained baseline. Prowl is a bounded benefit, not admission. |
| Visibility | `canAISeeTarget`, global `hidden`/`prowlState` | Visibility was recalculated per call but persisted mostly as a global hidden flag. | `visibilityByObserver` stores visual and awareness results separately for each observer. Sight, scent, and hearing remain distinct. |
| Sneak | no canonical ordinary combat action | Movement and concealment ownership were not combined. | Canonical Sneak requires concealment at both ends, limits distance, calls an injected real-movement authority exactly once, then recalculates observer visibility. |
| Longbow training | Longbow `attackBonus: 4` plus generic range helper | No explicit specialist profile existed. Raising Dexterity would have affected unrelated mechanics. | Longbowman has a longbow-only training profile. The existing +4 already includes proficiency; only +2 specialization is newly applied. Knife, Archer, initiative, and Dexterity are unchanged. |
| Range | `rangedAttackRangeModifier.js` | Three bands (`close/effective/long`) and ranged-control clamping weakened distance penalties. | Continuous listed-range bands are close 0–20% (+1), standard >20–60% (0), long >60–85% (-2), extreme >85–100% (-4), beyond illegal. |
| Threatened shot | range helper `adjacentHostile` | Close range merely lost the +1 and did not model threats other than the target. | A conscious hostile within 5.5 feet makes a close longbow shot -2. Allies and incapacitated enemies do not threaten. |
| Aim | compatibility names only | No owned, exact-target, exact-weapon combat Aim state existed. | Aim costs one action, no ammunition, grants +2 once, never stacks, and cancels on movement, target/weapon change, lost visibility, stale identity, or opportunity end. |
| Modifier logs | attack-roll local object | `baseAttack` could be the already-combined total and legacy output could label positive attack values as fatigue. | `ranged-modifier-audit` reports numeric base, proficiency, specialization, range, Aim, visibility, threat, shooter/target movement, and non-positive fatigue; the component sum must equal the applied total. |

## Existing authorities preserved

- Formal hunting intent, detection, quarry validation, pursuit, companion tasks, and hunting outcomes remain in `canonicalHuntingEncounter.js`.
- Combat initiative and continuation ownership remain in the existing scheduler.
- Live wildlife context is advisory legality and intent state, not another scheduler.
- Real movement continues through CombatPage movement callbacks and its fighter, position-ref, committed-position, and last-movement stores.
- Ranged attacks still use the existing attack, ammunition, attack-roll ownership, hit-location, armor/contact, injury, bleeding, HP, and finalization pipeline.
- Existing visibility and awareness compatibility fields remain as bridges; new canonical actions persist observer-specific records.

## Explicitly unchanged

Weapon and natural-attack damage, armor and shield formulas, penetration, hit
location, injury authorization, bleeding, HP, ordinary stamina costs, movement
and flight distances, initiative, action count, grapple, falling, mounted
combat, charge damage, morale thresholds, surrender, carcass eligibility,
hunting outcome finalization, and broad tactical AI weights were not changed.

No carcass harvesting, inventory transfer, cooking, trapping, fishing, or
public Mouse actor was introduced.

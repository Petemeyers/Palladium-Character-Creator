# Phase 3C3A carrier, attachment, and falling audit

## Scope and decision

Phase 3C3A establishes relationship, position, altitude, callback, and falling
authority only. It does not add mounted attacks, mounted charges, lances,
barding, mount panic, mounted ranged attacks, flying-mount attacks, a Dragon
actor, intelligent-mount arbitration, hunting encounters, harvesting, or
trained-companion commands.

The canonical implementation is `canonicalCarrierLink.js` plus
`canonicalFallingState.js`. Legacy fields remain compatibility projections;
they are not authoritative for new Hawk/prey or Knight/Warhorse flows.

## Recovered implementations

| Function or state | Source | Actors/users | Identity and position authority | Capacity/control | Release, fall, damage | Schedule ownership | Conflict | Decision |
|---|---|---|---|---|---|---|---|---|
| `combinedBody`, `linkCombinedBodies`, `syncCombinedPositions` | `src/utils/combinedBodySystem.js` | generic mounts, aerial and grapple carry | partner runtime ID; mutable primary role copies map position; no altitude/action/turn authority | none | mutable unlink; no fall | none | creates a second relationship authority and bidirectional mutable flags | preserve as compatibility adapter; canonical flows use `carrierLink` |
| `performAerialPickup` | `src/utils/grapplingSystem.js` | intended Hawk/prey | runtime IDs, direct altitude and combined-body mutations | existing grapple plus `canCarryTarget` | none | none | independently creates carry after ground grapple and invents takeoff altitude | preserve recovered intent; replace canonical flow with quarry, existing grapple-control result, capacity, then link |
| private `performAerialPickup`, `liftAndCarry`, `dropCarriedTarget` | `src/utils/flightActions.js` | flying compatibility actors | mutable `isCarrying`, `isCarried`, IDs and legacy altitude fields | mid-air clinch plus `canCarryTarget`; direct stamina drain | formerly unlinked and called `applyFallDamage` directly | none | second pickup path; drop combined relationship, falling, and HP mutation | canonical ordinary fliers use shared authority; legacy drop now returns a fall request and cannot mutate HP |
| `getLiftProfile`, `liftGrappledTarget`, `dropLiftedTarget`, carry upkeep | `src/pages/CombatPage.jsx` | manual grapple/carry UI | several flags, React fighter state, `positionsRef`; no immutable link | local weight parsing, PS multiplier, grapple state | legacy drop and stale-flag cleanup | upkeep key uses round/counter but no schedule owner | local formulas and state compete with link authority | retain compatibility behavior; do not use for Phase 3C3A scenarios |
| `canCarryTarget` | `src/utils/sizeStrengthModifiers.js` | generic carry and grapple | no relationship identity | size, PS, estimated weight, configurable multiplier | none | none | boolean/object consumers disagree and defaults are not canonical profiles | retain as legacy compatibility evidence; shared resolver consumes explicit actor `carrierProfile` values |
| `applyFallDamage`, `calculateFallDamage` | `src/utils/updateActiveEffects.js` | flight loss, active effects, impacts | actor snapshot only | n/a | owns the only reusable numeric fall formula and HP mutation | none | callers invoke it before a claimed fall lifecycle | preserve numeric authority unchanged; shared fall resolver invokes damage only through an injected authorized impact callback |
| direct unconscious-flight and impact falls | `src/pages/CombatPage.jsx` | airborne combatants | direct fighter/altitude mutation | n/a | calls `applyFallDamage` then grounds | delayed combat path ownership varies | bypasses shared fall claim | preserve for later migration; canonical Phase 3C3A calls cannot enter it |
| `flightState` and Phase 3C2B `resolveCanonicalFall` | `src/utils/combat/canonicalFlightState.js` | canonical Hawk/Falcon | exact altitude and action/turn identity | n/a | exact-once zero-damage grounding | no external schedule record | falling lifecycle is too small for riders/dropped prey | preserve flight projection; Phase 3C3A uses shared fall authority |
| `useClockPlayer` schedule metadata | `src/utils/three/useClockPlayer.js` | engine schedules | schedule ID, kind, owner and locks | n/a | cancel by ID/kind/owner | owner lacks generation/turn/action fields | carrier callbacks could outlive ownership | shared carrier schedules add generation, turn, token, owner ID and cancellation reason |
| `mountState`, `isMounted`, `mountedOnId`, reach helpers | `CombatPage.jsx`, `combinedBodySystem.js`, `reachCombatRules.js`, `attackActions.js` | compatibility mounted checks | flags or display fields, sometimes name-derived | none | unlink only | none | no canonical mount lifecycle; attack bonuses already exist independently | basic link only; existing mounted attack/charge paths are not activated |
| Warhorse mount capacity | `src/data/movement.json` | legacy Warhorse | n/a | 300 lb | n/a | n/a | disconnected from canonical actor | copied as a labeled compatibility authority into Warhorse `carrierProfile`; formula not generalized |

## Canonical authority

`carrierLink` records runtime IDs, relationship/control types, state,
carrier-owned position and altitude, generation, initiative turn, action
tokens, load details, restraint/tack state, and timestamps. Carrier and
passenger remain separate actor objects with independent HP, stamina, injury,
armor, weapons, natural attacks, morale, survival, surrender, initiative, and
defeat state. Display names never connect actors.

The carrier is the only movement and altitude authority. Passenger coordinates
are derived from carrier coordinates plus an explicit offset. Independent
passenger movement is rejected while the link is active. A release first
derives a legal independent coordinate, then clears active ownership exactly
once.

## Capacity authority

`resolveCarrierCapacity` uses explicit `carrierProfile.maximumLoad`. Warhorse's
300 lb value is recovered from `movement.mountMovement.warHorse`; Hawk and
Falcon retain the existing PS-times-ten 50 lb compatibility ceiling. Missing
body weights use the already-existing size estimates and are labeled
compatibility results, not a finalized carrying formula. Equipment weight is
added separately. Loads resolve to trivial, normal, strained, overloaded, or
impossible; overloaded and impossible flight are rejected.

## Quarry and grapple control

Hawk/Falcon prey carry requires legal tiny non-humanoid, non-armored quarry and
an already successful reciprocal control result from the existing grapple
authority. The carrier module does not roll or add a grapple formula. A failed
control result cannot create a link. An armored Knight is never ordinary
quarry. Prey struggle consumes an externally resolved grapple-opposition result.

## Falling authority

The shared lifecycle is:

`claimed -> descending -> impact-pending -> impact-authorized -> committed -> completed`

It records stable fall, actor, relationship, generation, turn, action, starting
coordinate/altitude, and landing coordinate identity. Drop/dismount cannot
mutate HP. Only the injected impact resolver may call the unchanged legacy
fall-damage authority after authorization. Ground release creates no damaging
fall. Duplicate or stale callbacks leave actor position and HP unchanged.

## Saved actors and hydration

`normalizeCombatActorSchema.js` preserves live `carrierLink` and `fallState`
snapshots but never infers them from actor definitions. Canonical profiles may
declare capacity or passenger eligibility; active links remain encounter
runtime state. No public Mouse body is added; tests use an internal deterministic
tiny-prey actor.

## Tests and replacement boundary

Phase 3C3A tests exercise shared link identity, capacity, quarry/control,
movement derivation, stale schedules, exact-once release/fall, basic
Mount/Dismount, action catalog visibility, and browser-importable Hawk/prey and
Knight/Warhorse scenarios. Legacy mutation paths are retained only for actors
not yet migrated and are explicitly documented for later conversion.

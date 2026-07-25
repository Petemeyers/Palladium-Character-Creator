# Phase 3C2B flying-animal audit

## Scope decision

The repository contains two authoritative ordinary flying-animal bodies: Hawk and
Falcon. Eagle, owl, raven, crow, bat, bird, and avian matches outside those
bodies are encounter prose, AI keywords, model/presentation conditions, or test
text. They are not actor definitions and are not migrated.

Mounted, magical, undead, incorporeal, summoned, supernatural, and Large mythic
flight remain deferred.

## Actor bodies

| Field | Hawk | Falcon |
|---|---|---|
| Display name | Hawk | Falcon |
| Stable actor key | `hawk` | `falcon` |
| Body status | Actual selectable actor body | Actual compatibility animal body |
| Sources | `src/data/selectableActors.js` | `src/data/animals.js` |
| Picker/compatibility ID | `hawk` | `falcon` |
| Model key/model | `hawk`; `hawk_flying.glb` | compatibility `falcon`; `hawk_flying.glb` |
| Species | Migrated explicitly to `hawk` | Migrated explicitly to `falcon` |
| Size | Small | Small |
| Anatomy | Legacy body implied avian anatomy; migration makes two wings, talons, mouth, and beak explicit | Legacy talon attack/model implied avian anatomy; migration makes two wings, talons, mouth, and beak explicit |
| Ground movement | 10 ft | No separate authoritative ground speed; canonical value is 0 ft |
| Flight movement | 60 ft | Legacy `speed: 60`, interpreted as flight speed because the body is a trained bird and uses the flight model |
| Old flight fields | Adapter synthesized `isFlying`, `airborne`, `movementMode`, and `aiFlightState` | Compatibility body had no canonical flight fields |
| Old altitude fields | Adapter synthesized both `altitude` and `altitudeFeet`, normally 20 ft | Flight helpers could synthesize both fields |
| Natural attacks | Talon Rake, +5, 1d4 slashing | Talon rake, +2, 1d4; canonicalized as slashing to match the shared authoritative talon body |
| Stamina | No explicit selectable value; canonical bridge uses Constitution 8 as an 8-point maximum | Legacy endurance 10 is retained as a 10-point maximum |
| Defense/hide | AC 14 | Guard/AC 14 |
| Takeoff/landing | Legacy action helper used 20-ft takeoff and zero-altitude landing | Same shared helper path |
| Grapple | Legacy flight actions could lift/carry/drop; this is excluded for ordinary animals | Same exclusion |
| Survival | Generic animal morale/retreat path | Generic animal morale/retreat path |
| AI routing | Name/tag-based hunter path, direct altitude mutation, invented auto-dive | Generic flier/compatibility routing |
| Presentation | Hawk model, legacy altitude marker and model elevation | Hawk model compatibility visual |
| Duplicate definitions | Selectable body plus name-based AI branches | Compatibility body plus generic name strings |
| Conflicting authority | `isFlying`, `altitude`, `altitudeFeet`, `aiFlightState`, model elevation | `speed` ambiguity plus legacy flight helpers |
| Decision | Migrate | Migrate through compatibility alias |

The deterministic Falcon HP is 5, the rounded average of the authoritative
`1d8` body. Falcon ground movement stays 0 because no authoritative walking
speed exists; landing and perching remain legal, but tactical ground travel is
not invented.

## Name-only and deferred references

| Candidate | Evidence | Decision |
|---|---|---|
| Eagle | Encounter/map prose and bird-name AI checks | Name-only; defer |
| Owl | Pre-combat/rules text and AI keyword checks | Name-only; defer |
| Raven/crow | Scavenger and presentation keywords | Name-only; defer |
| Bat | Rule/presentation text only | Name-only; defer |

## Fragmented authority audit

- `selectableActorAdapter.js` previously synthesized independent flight booleans,
  two altitude numbers, and `aiFlightState`.
- `abilitySystem.js` read and wrote the two altitude numbers directly.
- `flightActions.js` mutated altitude, spent legacy stamina, supplied an
  unprofiled dive bonus, and exposed lift/carry/drop.
- `flyingBehaviorSystem.js`, `enemyTurnAI.js`, `playerTurnAI.js`, and
  `CombatPage.jsx` contain compatibility-era direct altitude patches and
  name-based dive behavior.
- `flightEngine.cjs` and `engine/utils/getAltitude.cjs` are disconnected or
  compatibility engines with separate altitude inference.
- `TacticalMap.jsx`, `hexGridMath.js`, and `utils/three/HexArena.js` derived
  elevation from legacy fields.

For schema-version-one Hawk and Falcon, `flightState` is authoritative.
Compatibility values are produced as projections after a canonical commit;
canonical readers prefer `flightState`, and renderers only read it. Canonical
transitions require generation, initiative turn, actor, action token, and
movement sequence. The old dive and carry behavior remains available only to
unmigrated/non-ordinary compatibility actors; Hawk and Falcon reject it because
neither authoritative body defines a swoop or carrying profile.

## Environment and falling limits

The current maps expose occupancy and some terrain elevation, but do not provide
authoritative heights for every roof, tree, wall, or prop. Canonical transitions
therefore enforce explicit ceiling/takeoff/landing obstruction inputs and reject
occupied landing cells; unknown prop heights are not invented.

No single authoritative numeric fall-damage formula exists for this migration.
The exact-once fall authority commits falling/landing state and zero new damage.
Existing separately owned impact systems remain unchanged.

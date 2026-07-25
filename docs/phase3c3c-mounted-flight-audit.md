# Phase 3C3C Mounted-Flight Audit

## Result

The repository contains canonical biological flight, carrier links, mounted-ground authority, and falling authority. It does not contain a complete public flying-mount actor body. Phase 3C3C therefore adds a profile-driven framework and an internal deterministic fixture only. No Dragon, Wyvern, Griffin, Hippogriff, Pegasus, giant bird, or flying horse was added to a selectable, saved-roster, public-enemy, or public-scenario catalog.

## Candidate records

| Candidate | Body status | Sources | Flight/profile authority | Rider/load/control authority | Decision |
| --- | --- | --- | --- | --- | --- |
| Hawk | Real canonical actor (`hawk`) | `canonicalCombatActors.js`, flight scenarios, AI and presentation helpers | Biological winged flyer with canonical `flightState`; prey-carry carrier profile | Too small; prey capacity only; no `flyingMountProfile`; no rider attachment or mounted initiative | Preserve as flyer and quarry carrier; do not convert to a mount |
| Falcon | Real canonical actor (`falcon`) | `canonicalCombatActors.js`, flight tests | Biological winged flyer with canonical altitude | Prey-carry only; no rider support | Preserve; do not convert |
| Dragon | Name/model/vision references only | `game.md`, `AGENTS.md`, species and UI text searches | No authoritative public actor body, natural attacks, breath ability, load, or fall profile | None | Defer public content; no name branch |
| Griffin/Gryphon | Name-only morale/species references | `moraleSystem.js`, documentation | No canonical actor body | None | Defer |
| Pegasus | Name-only morale/species reference | `moraleSystem.js` | No canonical actor body | None | Defer |
| Wyvern/Hippogriff/flying horse/giant bird | No complete actor body found | Repository-wide audit | None | None | Defer |
| Internal Aerial Test Mount | Internal deterministic fixture | `phase3c3cMountedFlightScenarios.js` | Explicit biological flight, wing anatomy, altitude, load, action, attachment, command, and linked-fall profiles | Separate rider/mount ledgers through Phase 3C3B registry; carrier owns position and altitude | Test and browser-importable fixture only; never selectable |

## Existing authorities retained

- `canonicalCarrierLink.js` remains the sole relationship, position, and altitude authority. `relationshipType: "flying-mounted"` uses carrier position with derived rider position.
- `canonicalMountedCombat.js` remains the coordinated initiative and separate rider/mount action-ledger authority.
- `canonicalFlightState.js` remains the transition, movement, altitude, and mount flight-stamina authority.
- `canonicalFallingState.js` remains the per-actor fall and impact authority.
- Natural attacks remain actor-owned and use canonical natural-attack identity.
- Rider and mount retain separate HP, stamina, armor, equipment, morale, surrender, and survival records.

## Legacy and duplicate paths

- Legacy `combinedBody` mounted bodies are compatibility data only and are diagnosed when used as authority.
- Legacy AI branches that directly project `altitude`, `isFlying`, or `airborne` remain compatibility projections for unmounted flyers. They are not accepted as mounted-flight authority.
- Renderers may derive transforms and labels but may not write carrier position, rider position, altitude, attachment, or relationship state.
- No separate Dragon-rider system, aerial charge math, dive bonuses, breath damage, saddle bonuses, fall damage, or mounted defense formulas were introduced.

## Profile and load policy

`flyingMountProfile.mayServeAsFlyingMount` is mandatory. Flight capability, size, display name, carrying capacity, or a model attachment point alone is insufficient. Load includes rider body, rider equipment, and mount equipment. Legal load retains the actor's existing movement values; detailed load-speed scaling is deferred. Overloaded or impossible load cannot take off.

## Action and ownership policy

The mounted-flight catalog exposes only the thirteen requested actions. The rider owns rider attacks, commands, attachment, and separation. The mount owns takeoff, altitude transitions, flight movement, landing, natural attacks, and survival trajectory. Continuations preserve the exact pair, link, turn, ledgers, altitude, attachment, load, target, attack, sequence, and execution identity.

## Presentation and content deferral

Presentation exposes one `R` relationship glyph, compact altitude, separate rider/mount targetability, and an ARIA description with both actors and both resource ledgers. Public flying-mount content remains deferred until an actor has authoritative body, flight, load, attachment, control, attack, survival, and presentation profiles.

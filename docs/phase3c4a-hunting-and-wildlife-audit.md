# Phase 3C4A Hunting and Wildlife Audit

This audit records the pre-Phase 3C4A authorities and the migration boundary. Phase 3C4A adds encounter intent and outcome ownership around the existing physical combat engine; it does not replace combat resolution.

| Source | Actor or mechanic | Existing body | Existing behavior and data | Conflict or gap | Phase 3C4A decision |
| --- | --- | --- | --- | --- | --- |
| `src/data/canonicalCombatActors.js` | Wolf | Canonical actor | Natural bite, morale/survival, ground movement; no explicit sight, hearing, scent, quarry, or pack intent | An ordinary enemy AI could treat it as a soldier | Add explicit perception, quarry, escape, defensive, and non-military pack profiles |
| `src/data/canonicalCombatActors.js` | Boar | Canonical actor | Tusks, natural hide, charge-capable physical profile, morale/survival | No distinction between forage, escape, and cornered defense | Add scent/hearing-led perception and escape-first behavior; charge remains the existing canonical attack |
| `src/data/canonicalCombatActors.js` | Bear / Brown Bear | Canonical actors | Natural attacks, hide, survival and morale | No food/young defense or solitary behavior authority | Add strong scent, defensive protection, avoidance, and solitary pack profile |
| `src/data/canonicalCombatActors.js` | Mastiff | Canonical actor | Natural bite and survival | No handler/task ownership | Add explicit companion, training, scent/hearing, quarry, and recovery profiles |
| `src/data/canonicalCombatActors.js` | Warhorse | Canonical actor | Carrier, mounted movement, morale, natural attacks | Could be considered prey-seeking by generic hostile targeting | Disable quarry behavior and reuse existing mounted-control/morale authority |
| `src/data/canonicalCombatActors.js` | Giant Rat | Canonical actor | Small ground animal and bite | No cover-seeking or trapped response | Add close scent/sound, concealment, escape, and trapped-defense profile |
| `src/data/canonicalCombatActors.js` | Hawk / Falcon | Canonical, distinct actors | Flight, altitude, talons, carrier/prey support | Legacy name/size checks and no handler-command ownership | Add exceptional visual perception, explicit tiny-quarry filtering, and separate trained companion profiles |
| `src/data/canonicalCombatActors.js` | Longbowman | Canonical actor | Longbow, arrow ammunition, range profile, melee fallback | No hunting parent lifecycle | Reuse unchanged through canonical ranged/ammunition authority |
| `src/data/animals.js` | Compatibility animals | Normalized compatibility records | Names and partial animal attributes | Unsafe as direct combat bodies | Keep adapter-only; do not make these hunting authority |
| `src/utils/combat/canonicalNaturalAttacks.js` | Natural attacks and animal surrender | Full physical authority | Stable natural-attack identities; humanoid surrender gate | Does not decide wildlife intent | Reuse attacks unchanged; wildlife cannot enter humanoid surrender |
| `src/utils/combat/animalSurvivalState.js` | Animal defeat/survival | Full lifecycle authority | Death, escape, incapacitation, ownership deferral | No hunting outcome parent | Retain as child physical outcome; hunting finalizer waits when it is pending |
| `src/utils/combat/canonicalCarrierLink.js` | Carry and prey control | Full ownership authority | Carrier/quarry validation, hold/drop/release | No trained-companion command token | Companion tasks call this authority; no duplicate carry formulas |
| `src/utils/combat/canonicalFallingState.js` | Falling | Full ownership authority | Altitude release and fall resolution | Return/release could bypass it | Release above ground must use existing falling authority |
| flight and mounted helpers | Flight, altitude, mounts | Full movement/ownership authority | Canonical movement modes and carrier links | Hunting tasks could teleport | Commands return goals; canonical movement commits actual movement |
| `src/utils/aiVisibilityFilter.js` | LOS, lighting, stealth, noise | Partial combat visibility helper | Sight/cover and armor-noise concepts | May rerun from rendering and lacks hunting action ownership | Reuse concepts only; hunting detection has an owned deterministic resolver |
| `src/utils/abilitySystem.js` | Track and prowl | Real skill references | Tracking/prowl ability names | No encounter phase or stable record | Preserve for future check adapters; do not invent new skill math |
| enemy/player AI and `CombatPage.jsx` | Targeting and turns | Full combat scheduler | Side-based hostile selection and some Hawk/prey name checks | Soldier-style targeting can conflict with wildlife | Add profile-driven legality filtering before weights; migrate name checks incrementally |
| ranged and ammunition helpers | Bow shot and arrows | Full physical authority | Range/LOS validation and exactly-once ammunition spend | Hunting could invent a second shot path | Hunting shot delegates to these unchanged and injects existing impact resolution |
| armor, shield, hide, injuries | Contact resolution | Full physical authority | Armor interception, natural hide, hit location, injury | Hunting must not add damage formulas | Reuse unchanged after hunting admission |
| `src/utils/combat/bleedingMeter.js` | Bleeding | Persistent combat condition | Advances with melee rounds | No blood-trail record | Pursuit references the same injury/bleeding state without mutating HP |
| morale and routing helpers | Fear, route, cower | Full combat authority | Existing DCs and terminal/nonterminal behavior | Wildlife intent absent | Keep formulas; intent filters legal choices before existing scoring |
| pathfinding and position helpers | Movement | Full tactical authority | Position commits and stale-work gates | Stalking/return could create parallel coordinates | Require injected canonical movement commits |
| inventory, item, and cooking data | Equipment and food | Real but separate systems | Items, equipment records, cooking content | No authoritative carcass-to-inventory economy | Add only harvest eligibility; quantities, prices, transfer, and cooking stay deferred |
| selectable actor and hydration paths | Actor admission | Canonical normalization | Preserves combat runtime fields | New hunting fields could be stripped | Preserve profiles and stable runtime links; block normalization mid-owned action |
| browser scenarios | Deterministic module fixtures | Existing Phase 3C fixtures | Vite-importable authority checks | No hunting scenarios | Add five deterministic Phase 3C4A scenarios |

## Canonical ownership boundary

The hunting registry owns intent, detection, phase transitions, hunting action claims, pursuits, companion commands, carcass recovery, harvest eligibility, and the single hunting outcome. Combat remains authoritative for initiative, movement, stamina, attacks, ammunition, hit location, armor/hide, injury, bleeding, carrier links, falls, and actor death.

Hunting outcomes may be nonlethal. Escaped quarry remains an actor and creates neither a carcass nor harvest eligibility. A carcass requires an authoritative animal death flag, and harvesting requires recovery. Exact yields, values, spoilage, inventory transfer, cooking, trapping, fishing, and wilderness generation are deferred.


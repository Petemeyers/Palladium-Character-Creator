# Phase 3C3B Mounted Ground Combat Audit

## Scope and authoritative bodies

Phase 3C3B uses the Phase 3C3A `carrierLink` as the only relationship authority. A
mounted pair remains two combat actors: the carrier is the mount and the passenger
is the rider. No combined Mounted Knight actor is introduced.

The canonical Knight is the only current rider with authoritative training evidence.
`professionData.js` names Horsemanship and Mounted training for Knight, and
`professionSkills.js` supplies the existing Horsemanship value of 40. Squire stable
work and name-only Paladin/cavalry references are not enough to create rider
profiles.

The canonical Warhorse is the only current ground animal explicitly permitted to
form a `relationshipType: "mounted"` carrier link. Hawk and Falcon are prey
carriers, not ground mounts. Legacy Light Horse, Pony, Wolf Mount, Bull, Camel, Elk,
Dragon, griffin, and cavalry names are not authoritative public actor bodies and are
not activated.

Aliases remain actor-migration aliases owned by `canonicalCombatActors.js`; mounted
code compares stable actor IDs and actor keys and does not add species-based aliases.

## Existing state and mechanics

- `canonicalCarrierLink.js` owns capacity, exact generation/turn/action identity,
  attachment, carrier position, passenger position derivation, stale schedules,
  release, dismount occupancy, and shared fall admission.
- Mounted links already store `saddleState` and `harnessState`. There are no
  authoritative saddle, bridle, reins, stirrup, harness, or barding item profiles.
  Phase 3C3B therefore exposes equipment slots and state only; it adds no statistics.
- `movement.json` contains legacy horse speeds, capacity, and barding penalties.
  Warhorse's canonical movement remains 60 and its existing carrier capacity remains
  300. Name-only light horse, pony, and wolf mount entries remain inactive.
- `reachCombatRules.js` contains existing charge momentum and brace calculations,
  including a mounted flag. `distanceCombatSystem.js` and
  `combatActionHandlers/attackActions.js` also contain legacy charge routing. The
  mounted executor admits coordinated movement and delegates impact/brace resolution;
  it does not copy or alter those formulas.
- Lance is recognized by weapon, reach, slot, and training compatibility code.
  `shopItems.js` contains the real existing Lance item (id 205, weight 10, damage
  `2d6+2`) and the compatibility Knight archetype also names a Lance. No Lance is
  equipped by the canonical Knight by default. Mounted Charge therefore requires the
  real supplied/equipped shop profile and never creates or auto-equips one. Knight's
  ordinary canonical loadout remains Long Sword, Dagger, Heater Shield, and Plate
  Harness.
- Brace has legacy calculation support but no canonical prepared-state registry.
  Phase 3C3B adds exact-token preparation state and delegates any mechanical result to
  the existing resolver.
- Phase 3C3A release and `canonicalFallingState.js` are the existing unseat/fall
  authority. Ground emergency dismount already claims a fall without inventing
  damage. Forced dismount reuses it.
- `combinedBodySystem.js` contains an older mounted compatibility representation
  (`hasRider`, `isMounted`, `mountedOnId`) and position synchronization. It is
  disconnected from canonical carrier ownership and is explicitly rejected as
  mounted authority.
- `CombatPage.jsx` still calls combined-body position synchronization in general
  movement paths, but has no canonical mounted initiative/action dispatcher.
- `combatActionCatalog.js` exposes Phase 3C3A Mount/Dismount/Emergency Dismount only.
  Its Mount description explicitly states that mounted attacks were not enabled.
- The current 2D and 3D renderers represent actor bodies independently but do not
  expose a canonical mounted relationship glyph or mounted ARIA description.
- Normalization preserves HP, stamina, initiative identity, action count, target,
  morale, survival, injury, position, and carrier fields only where copied explicitly.
  Mounted fields need deterministic preservation and mounted lifecycle phases need
  normalization blocking.
- Targeting, armor, shield, natural attacks, grapple, surrender, morale, and animal
  survival are actor-specific authorities. None permits merging rider and mount
  identity.

## Migration decision

Add one pure canonical mounted-combat authority layered over `carrierLink`. It owns
mounted turn records, explicit rider/mount/coordinated action claims, separate action
ledgers, exact continuation receipts, prepared brace records, pressured control
admission, mounted target identity, and exact-once forced dismount. It delegates:

- movement commit and rider position to `canonicalCarrierLink`;
- falls to `canonicalFallingState`;
- stamina mutation to an injected canonical stamina spender;
- attack, armor, shield, and injury to an injected canonical impact resolver;
- charge/brace math to existing charge and brace helpers;
- panic and survival outcomes to existing morale/animal-survival authority.

AI receives only filtered legal mounted contracts before its existing weighting. The
renderer receives an immutable relationship presentation projection and cannot write
position or mounted state.

## Initiative and action ownership

One mounted pair receives one mounted initiative opportunity. Rider and mount keep
their actor identities and separate action ledgers. Every mounted action claims
exactly one owner (`rider`, `mount`, or `coordinated`); coordinated charge claims both
ledgers. Exact-once completion releases the owner and produces at most one handoff.
The ordinary rider and mount schedulers must not start overlapping mounted turns.

Continuations preserve the pair, actors, generation, turn, both ledgers, owner,
target, attack identity, mounted state, position, sequence, and an executor-issued
execution key. Receipts are consumed, canceled, or rejected exactly once.

## Presentation and target selection

The mount remains the primary position token and the rider is an attached,
independently targetable marker. Tooltips and ARIA expose both names, relationship,
control, separate HP/stamina, and current mounted action. Projectile targeting may
select either actor. Ordinary melee targeting of the rider requires explicit reachable
geometry; the mount may be targeted at its carrier position. Area effects may target
the pair without merging either actor's HP, armor, or stamina.

## Control, morale, grapple, and outcomes

Routine commands do not roll. Pressure may request one existing animal morale/control
resolution using the Warhorse training state and Knight Horsemanship. Results may
obey, hesitate, refuse, rear, bolt, flee, defend, or recover only when returned by
that authority.

Mounted grapple requests identify rider or mount explicitly. They delegate existing
opposed formulas and never synthesize a sidearm. A lost seat routes into forced
dismount.

Rider and mount retain independent HP, stamina, armor/hide, consciousness, morale,
survival, surrender, and outcome. Warhorse does not use the humanoid surrender panel.
A surrendered rider does not delete or implicitly surrender the Warhorse.

## Deferred mechanics

Mounted flight, Dragon and griffin riding, flying cavalry, multi-rider mounts,
vehicles, jousting tournaments, formation cavalry, mounted spell special cases,
public barding statistics, breeding/stabling economy, hunting, harvesting, and
companion commands remain deferred.

## Explicitly preserved formulas and weights

Phase 3C3B does not change attack probabilities, damage dice, weapon modifiers, armor
or penetration formulas, stamina costs, movement distances, initiative formulas,
morale thresholds, grapple formulas, tactical or pathfinding weights, action economy,
round timing, Lance statistics, charge momentum, brace formulas, or Warhorse
statistics.

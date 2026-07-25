# Phase 3C2A Ground-Animal Audit

## Scope and method

This audit searched actor catalogs, public-enemy data, the arena roster, selectable actors, compatibility adapters, saved-preset hydration, CombatPage creation, AI, movement, grapple, armor/contact, morale, surrender, icon/status code, and test fixtures. A name, allowlist member, encounter-table result, comment, model path, or generic movement entry was not treated as an actor body.

The selected stable keys are `wolf`, `boar`, `mastiff`, `warhorse`, `bear`, `brown-bear`, and `giant-rat`. Identity is resolved from explicit actor/source/picker/compatibility keys before runtime IDs replace source identity. Display names and attack names are not identity authority.

## Migrated actor bodies

### `wolf` — Wolf

- Sources and IDs: `src/data/selectableActors.js` (`wolf`, public picker), `src/data/publicEnemies.js` (`wolf`, public-enemy picker), and `src/data/animals.js` (`wolf`, compatibility roster). Model key: `wolf`.
- Duplicate definitions: public/selectable HP 11, defense 13, speed 40, Bite +4 for `2d4+2`; compatibility HP `3d8`, defense 12, speed 40, Bite +2 for `1d6+1`. The public profile was already the clean selectable profile and is now authoritative; the old body is retained under `legacyAnimalProfile` for audit rather than becoming a competing runtime authority.
- Canonical schema: species `wolf`, creature type `animal`, Medium quadruped, HP 11, stamina 12, defense 13, ground 40/run 80, natural hide (not worn armor).
- Anatomy and attacks: mouth available; Bite (`natural.wolf-bite`), piercing, reach 5, anatomy source `mouth`. No claws, horns, tusks, or hooves.
- Behavior: pack-capable predator/skirmisher. Pack identity requires explicit `packId`, `groupId`, `factionId`, or `armyId`; a shared name does not merge identity or ownership.
- Grapple/morale/survival/surrender: normal size authority, defensive-only initiation preference, natural attacks retained, animal retreat survival route, no humanoid surrender negotiation.
- Status: migrated.

### `boar` — Boar

- Sources and IDs: `src/data/selectableActors.js` (`boar`, picker/model key) and `src/data/animals.js` (`boar`, compatibility roster).
- Duplicate definitions: selectable HP 18, defense 13, speed 35, Tusk Charge +4 for `1d8+2`; compatibility HP `3d10+3`, defense 13, speed 35, +2. The selectable profile is authoritative; the compatibility body remains audit metadata.
- Canonical schema: species `wild-boar`, creature type `animal`, Medium quadruped, HP 18, stamina 14, defense 13, ground 35/run 70, natural hide.
- Anatomy and attacks: tusks present; Tusk Charge (`natural.boar-tusk-charge`), piercing, reach 5, anatomy source `tusks`, requires an existing movement path. It does not gain claw, pounce, trample, or a free combined attack.
- Behavior: territorial ground brute/charger; existing action economy remains two actions.
- Grapple/morale/survival/surrender: size rules preserved, no manufactured sidearm, animal-retreat route, no humanoid surrender negotiation.
- Status: migrated.

### `mastiff` — Mastiff

- Sources and IDs: `src/data/animals.js` (`mastiff`, compatibility roster). The allowlist name `Guard Dog` has no separate actor body and is not an alias.
- Canonical schema: species `domestic-dog`, creature type `animal`, Medium quadruped, HP 16 (the existing `3d8+3` profile’s deterministic combat value), stamina 12, defense 12, ground 40/run 80, natural hide. Compatibility model path is the existing generic placeholder and is not identity authority.
- Anatomy and attacks: mouth available; Bite (`natural.mastiff-bite`), +2, `1d6+2` piercing, reach 5. No claws, horns, tusks, or hooves.
- Behavior: trained defensive guard animal; explicit trained-animal faction metadata, no automatic hostility from species.
- Grapple/morale/survival/surrender: natural attack retained, defensive grapple preference, animal survival outcomes, no prisoner/ransom panel.
- Status: migrated.

### `warhorse` — Warhorse

- Sources and IDs: `src/data/animals.js` (`warhorse`, compatibility roster). Exact migration alias `war-horse` is supported. Generic `Horse` is name-only and is not mapped to this trained body.
- Canonical schema: species `horse`, creature type `animal`, Large quadruped, HP 30 (existing `4d10+8` profile’s deterministic combat value), stamina 15, defense 13, ground 60/run 120, natural hide.
- Anatomy and attacks: hooves present; Hoof Attack (`natural.warhorse-hoof`), +2, `1d8+3` bludgeoning, reach 5, anatomy source `hooves`. The existing body supplies no bite attack, so none was invented.
- Mounted-state decision: this is an unmounted animal. `riderState`, `bardingState`, and mounted-combat support are explicitly none/false. Generic barding and mount utilities were audited but are not connected.
- Grapple/morale/survival/surrender: Large size authority applies; no manufactured weapon handling, saddle state, shared rider hex, or humanoid surrender panel.
- Status: migrated as an unmounted ordinary horse only.

### `bear` — Bear

- Sources and IDs: `src/data/animals.js` (`bear`, compatibility roster).
- Canonical schema: species `bear`, creature type `animal`, Large quadruped, HP 42 (existing `5d10+15` profile’s deterministic combat value), stamina 16, defense 14, ground 35/run 70, natural hide.
- Anatomy and attacks: claws and mouth available; Claw Swipe (`natural.bear-claw`), +3, `1d8+4` slashing, and Bite (`natural.bear-bite`), +3, `1d10+4` piercing. Each consumes one existing action; no multiattack was added.
- Behavior: solitary large ground brute. No mythic, mounted, or flying state.
- Grapple/morale/survival/surrender: Large size authority, natural attacks retained, animal survival route, no humanoid surrender panel.
- Status: migrated. It remains distinct from `brown-bear` because the repository contains materially different bodies.

### `brown-bear` — Brown Bear

- Sources and IDs: `src/data/publicEnemies.js` (`brown-bear`, public-enemy picker); exact legacy spelling alias `brown_bear`.
- Canonical schema: species `brown-bear`, creature type `animal`, Large quadruped, HP 34, stamina 16, defense 11, ground 40/run 80, natural hide.
- Anatomy and attacks: mouth and claws available; Bite (`natural.brown-bear-bite`), +5, `1d8+4` piercing, and Claw (`natural.brown-bear-claw`), +5, `2d6+4` slashing. No automatic bite-and-claw sequence.
- Behavior: solitary large ground brute.
- Grapple/morale/survival/surrender: Large size authority, anatomy retained in grapple, animal survival route, no humanoid surrender negotiation.
- Status: migrated separately from `bear`; no silent statistic merge.

### `giant-rat` — Giant Rat

- Sources and IDs: `src/data/publicEnemies.js` (`giant-rat`, public-enemy picker); exact legacy spelling alias `giant_rat`.
- Canonical schema: species `giant-rat`, creature type `animal`, Small quadruped, HP 7, stamina 11, defense 12, ground 30/run 60, natural hide.
- Anatomy and attacks: mouth available; Bite (`natural.giant-rat-bite`), +4, `1d4+2` piercing, reach 5.
- Behavior: small scavenger/skirmisher and pack-capable only through explicit group metadata.
- Grapple/morale/survival/surrender: Small size authority, natural attack retained, animal retreat route, no humanoid surrender negotiation.
- Status: migrated.

## Deferred and name-only references

| Reference | Evidence | Decision |
|---|---|---|
| `hawk` | Real selectable flying actor with ground/flying movement | Deferred to Phase 3C2B. |
| `falcon` | Real `animals.js` flying body with talon attack | Deferred to Phase 3C2B. |
| Horse | `allowedAnimals` and generic movement data only | Name-only; no actor invented and not aliased to Warhorse. |
| Guard Dog | `allowedAnimals` only | Name-only; Mastiff remains its own explicit body. |
| Bull | `allowedAnimals` only | Name-only; no actor invented. |
| Pony | Generic movement entry only | No actor body; not migrated. |
| Snake | Presentation/stealth reaction text only | No actor body; not migrated. |
| Cat, panther, lion, tiger, hound | Search hits were absent or unrelated variable/text uses | No actor body; not migrated. |
| Mouse/rabbit/squirrel/songbird | AI prey keywords only | No actor bodies; not migrated. |
| Wolf mount, rider/mount bodies, barding | Generic movement/combined-body systems | Mounted combat explicitly deferred. |
| Minotaur trample/natural attacks | Existing mythic canonical actor | Excluded; Phase 3C2A does not alter it. |

## Shared authority decisions

- Natural attacks use `profileKey`/`attackKey` identity and `deliveryType: "natural"`. They carry no manufactured `weaponId`, hands, ammunition, draw/reload state, physical weapon length, sword technique, shield compatibility, inventory ownership, loot, or drop behavior.
- Anatomy is the availability authority. Bite requires a mouth; claw requires claws; tusk/gore requires tusks or horns; hoof/kick requires hooves. Action prerequisites are checked before admission.
- The existing canonical impact pipeline remains the armor and injury authority. Shield interception occurs first; intact plate is not bypassed automatically; HP mutation remains downstream of injury authorization.
- Natural attacks remain available through grapple entry and do not create dropped battlefield items or synthetic daggers.
- Movement values, action counts, attack bonuses, damage, and public/source defenses were preserved. No tactical weight or probability formula changed.
- Animals are unaligned for moral-decision purposes. Team/faction controls hostility and icon allegiance.
- Wild/trained animal outcomes use explicit animal survival ownership. Pending outcome records defer finalization; committed movement spends the supplied canonical movement cost exactly once, while hold/no-move spends zero.
- `animal-retreated`, `animal-driven-off`, and `animal-captured` are world-preserving outcome labels. This phase adds no prisoner transport, inventory transfer, mounted combat, or new attack mechanic.

## Reference fixtures

- Pack fixture: Guard and Spearman versus two independently identified Wolves. The wolves share only explicit `packId`; Bite uses a canonical action token; shield/plate authority remains downstream; an owned retreat defers finalization until committed.
- Large ground-animal fixture: the existing Boar uses its anatomy-backed Tusk Charge after its documented movement prerequisite. It has no manufactured inventory, flight, rider, barding, or synthetic sidearm.
- `runPhase3C2AGroundAnimalScenario()` is browser-importable through the Vite module graph and reports per-actor validation, natural-impact admission/completion, survival ownership, finalization gates, icon allegiance, one combat-over result, and authority-error counts.

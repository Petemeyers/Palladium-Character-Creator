# Phase 3C1A ordinary humanoid melee audit

## Scope and identity rules

This audit covers repository actors with a concrete runtime body whose primary role is ordinary humanoid close combat. Identity is resolved only from stable metadata (`actorKey`, `sourceActorKey`, `canonicalActorKey`, picker or compatibility IDs, `sourceCharacterId`, `modelKey`, or an explicit migration alias). Display names are not identity authority.

The canonical source of truth is `src/data/canonicalCombatActors.js`. Catalog and compatibility records retain their original picker IDs and adapt into these definitions before combat ownership begins.

## Migrated actors

| Display name | Stable actor key | Source files and picker IDs | Species / type / size | Canonical equipment and attacks | Armor / movement | Stamina source | Alignment and morale | Prior contradiction / decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Squire | `squire` | `humanFighters.js`; arena picker `squire`; saved class alias `squire` | human / humanoid / medium | Arming Sword `1d8+1`, Light Shield | Mail Shirt, guard 13; 30 ft | source endurance 12 → canonical maximum 24 | neutral-good; withdraw or yield | String-only equipment and no profiles. The one-handed sword is retained on grapple entry; no dagger is invented. |
| Man-at-Arms | `man-at-arms` | `humanFighters.js`; arena picker `man-at-arms`; saved aliases `man-at-arms`, `man_at_arms` | human / humanoid / medium | Mace `1d8+2`, Kite Shield | Mail Hauberk, source guard 15; 25 ft | source endurance 13 → 26 | lawful-neutral; withdraw or yield | Mail data lacked a stable armor identity. Source guard 15 is retained with an explicit compatibility note. |
| Spearman | `spearman` | `humanFighters.js`, `selectableActors.js`; selectable/picker ID `spearman`; saved alias `spearman` | human / humanoid / medium | two-handed Infantry Spear `1d8+1` | Gambeson, source guard 13; 30 ft | source endurance/constitution 12 → 24 | true-neutral; withdraw or yield | Duplicate definitions differed in HP and attack bonus. Selectable combat profile (14 HP, +3 attack) is authoritative. The spear drops on grapple entry and no sidearm is created. |
| Brigand | `brigand` | `humanFighters.js`; arena picker `brigand`; saved alias `brigand` | human / humanoid / medium | Hand Axe `1d6+1`, Buckler | Leather Jack, guard 12; 30 ft | source endurance 11 → 22 | chaotic-neutral; ransom/confiscation weighted | String-only loadout lacked profiles. Brigand remains distinct from Bandit. |
| Bandit | `bandit` | `selectableActors.js`, `publicEnemies.js`; selectable/public ID `bandit`; saved alias `bandit` | human / humanoid / medium | Hand Axe `1d6+1`, Hunting Bow `1d6+1` | Leather Armor, guard 12; 30 ft | source constitution 12 → 24 | chaotic-neutral; ransom/release weighted | Public action used Scimitar while selectable catalog used Hand Axe and bow. The normalized selectable catalog is authoritative; the actor remains a melee skirmisher, not a dedicated archer. |
| Guard | `guard` | `selectableActors.js`, `publicEnemies.js`; selectable/public ID `guard`; encounter alias `town_guard`; saved alias `guard` | human / humanoid / medium | one-handed Guard Spear `1d6+1`, Guard Shield | Guard Mail, source guard 16; 30 ft | source constitution 12 → 24 | lawful-neutral; prisoner preference | Armor class existed without layered armor identity. It is explicitly mail/defensive-equipment compatibility data, not inferred plate. Spear is one-handed only for this shield loadout. |
| Veteran Knight | `veteran-knight` | `selectableActors.js`; picker/model ID `veteran-knight`; alias `veteran_knight`; saved class alias | human / humanoid / medium | Long Sword `1d8`, Dagger `1d4`, Heater Shield | Plate Harness, guard 16; 25 ft | existing configured maximum 30 | neutral-good; prisoner/honorable release weighted | Previously resembled Knight without canonical identity. It remains a distinct veteran actor and retains its explicit dagger. |
| Orc | `orc` | `publicEnemies.js`; public ID `orc` | orc / humanoid / medium | two-handed Greataxe `1d12+3` | Hide Armor, guard 13; 30 ft | source constitution 16 → 32 | chaotic-neutral actor default; circumstantial surrender | Creature type was present but species and canonical equipment identities were absent. It remains orc, never human. Greataxe drops on grapple entry; no sidearm is created. |
| Cultist | `cultist` | `publicEnemies.js`; public ID `cultist`; saved class alias `cultist` | human / humanoid / medium | Scimitar `1d6+1` | Leather Armor, guard 12; 30 ft | source constitution 10 → 20 | neutral-evil actor default; weighted, never automatic execution | Repository actor is melee-only and has no spell actions. It is migrated as the concrete light melee fighter; future spellcaster variants require separate keys. |

All migrated actors define schema version 1, explicit loadout keys, armor and weapon profiles, grapple behavior, surrender behavior, faction/culture tags, traits, and canonical nine-grid alignment.

## Duplicate definitions

- `spearman` existed in `humanFighters.js` and `selectableActors.js`. Armor, movement, and damage agreed; HP representation and attack bonus did not. The normalized selectable actor profile is authoritative.
- `bandit` existed in `selectableActors.js` and `publicEnemies.js`. The public Scimitar action contradicted the selectable Hand Axe/Hunting Bow identity. The selectable actor catalog is authoritative because it is the normalized public/original picker path.
- `guard` existed in `selectableActors.js` and `publicEnemies.js`. Core HP, armor, movement, spear damage, and attack bonus agree. Canonical metadata now supplies the missing armor, shield, and grapple identities.
- `brigand` and `bandit` are not duplicates: they retain separate stable keys, stats, shields, faction tags, and behavior profiles.
- `knight` and `veteran-knight` are not duplicates: the veteran retains its own key and higher existing stats.

## Deferred concrete actors

| Actor | Source | Reason deferred |
| --- | --- | --- |
| Longbowman | `humanFighters.js`, `selectableActors.js` | Dedicated ranged actor; later ranged migration. |
| Archer | `selectableActors.js` | Dedicated ranged actor. |
| Arena Champion | `humanFighters.js`, `selectableActors.js` | Specialized three-action arena/training archetype, not ordinary infantry. |
| Training Dummy | `selectableActors.js` | Passive construct. |
| Hawk, Wolf, Boar and public beasts | actor catalogs | Animals/flying actors. |
| Minotaur | `selectableActors.js` | Already canonical and mythic/Large; outside this phase. |
| Skeleton and Zombie | `publicEnemies.js` | Undead. |

`Footman`, `Pikeman`, `Halberdier`, `Crossbowman`, `Shield Bearer`, `Duelist`, `Mercenary`, `Raider`, `Peasant Fighter`, and `Noble Duelist` occur in the `allowedHumanRoles` compatibility allowlist but have no actor body in `humanFighters.js`. They are not invented or migrated in this phase. Encounter-table strings likewise do not constitute actor definitions.

## Weapon and loadout decisions

- Every manufactured weapon has an explicit canonical `weaponId`/`profileKey`, handedness, hand requirement, damage identity, damage type, reach/length, shield compatibility, clinch compatibility, grounded compatibility, and grapple retention behavior.
- One-handed weapons are retained but unavailable in tight clinch unless their profile explicitly permits it.
- Two-handed Infantry Spear and Greataxe are dropped through the existing canonical grapple transition. Dropped IDs remain authoritative and cleanup cannot silently restore them.
- Dagger access is inventory-only. Only Veteran Knight carries one among the new actors.
- Guard Spear is an explicit one-handed shield-compatible profile; Spearman uses a separate two-handed Infantry Spear profile.
- Invalid selected loadouts are rejected as a whole, retained in migration metadata, and replaced with the actor's canonical default before combat.
- Manufactured profiles never use natural-attack flags. Canonical unarmed sanitization remains independent.

## Armor decisions

Armor profiles preserve source guard values without inferring plate from guard rating. Incomplete source coverage is identified by compatibility notes. Plate is assigned only to Veteran Knight because the source explicitly equips Plate Harness. Validators reject negative durability, mismatched armor identity, two-handed weapon plus active shield, and corrupt damage-resolution contradictions; cosmetic coverage incompleteness remains non-blocking.

## Alignment, morale, and surrender

Defaults are actor-specific canonical definitions, not deductions from species, weapon, armor, profession, or enemy side. Alignment changes weighted behavior only. Every migrated actor may offer and respond to surrender, with explicit prisoner, release, ransom, confiscation, and execution preference foundations. Execution remains subject to the existing accepted-surrender/prisoner state, control, authority, participant identity, decision-token, and exact-once requirements.

## Setup paths audited

- Arena roster: `humanFighters.js` → `arenaRoster.js` → `CombatPage.addCombatant`.
- Selectable catalog: `selectableActors.js` → `selectableActorAdapter.js` → `CombatPage.addCombatant`.
- Public actor picker: `publicEnemies.js` → `publicEnemyCombatAdapter.js` or `publicEnemyRosterAdapter.js` → `CombatPage.addCombatant`.
- Saved/playable hydration: `publicStagedRosterStorage.js` explicit class/source alias → staged `autoRollCharacter` → `CombatPage.addCombatant`.
- Compatibility picker: stable picker/compatibility/source IDs are captured before runtime IDs are assigned.

Normalization is deterministic and idempotent at setup. An explicit lifecycle-phase guard blocks normalization requested during attack resolution, damage application, grapple resolution, movement commit, action continuation, or surrender decision commit.

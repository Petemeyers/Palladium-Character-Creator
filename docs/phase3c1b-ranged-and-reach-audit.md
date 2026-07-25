# Phase 3C1B ranged and extended-reach audit

## Identity-led actor inventory

| Actor | Stable key / picker and compatibility IDs | Source bodies | Classification | Loadout and ammunition | Range / existing routing | Migration |
|---|---|---|---|---|---|---|
| Archer | `archer`; picker `archer`; model `archer`; exact alias `selectable-archer` | `selectableActors.js` | projectile specialist | Bow, Knife, 20 ordinary arrows. The source omitted an explicit quiver count; combat setup previously defaulted ranged weapons to 20. That established default is now explicit. | 120/480 ft; selectable adapter and both AI paths already recognize ranged attacks and carried sidearms. | Canonical schema 1 |
| Longbowman | `longbowman`; picker/model/source id `longbowman`; aliases `selectable-longbowman`, `longbow_man` | `selectableActors.js`; duplicate legacy body in `humanFighters.js` | projectile specialist | Longbow, Knife, 20 ordinary war arrows (explicit in selectable source). | 150/600 ft; existing ranged selection and projectile route retained. | Canonical schema 1; selectable statistics are authoritative |
| Bandit | `bandit`; picker/model `bandit` | `selectableActors.js`; Phase 3C1A canonical body | melee skirmisher with projectile loadout | Pre-combat `hand-axe-skirmisher` and `hunting-bow-skirmisher` variants; Hand Axe remains real sidearm; 20-arrow setup default. | Hunting Bow 80/240 ft. Existing skirmisher weights retained. | Existing Bandit identity extended; not converted to Archer |
| Crossbowman | allowlist name only | `humanFighters.js`, `components/data.jsx`, `combatActions.json` | no actor body | Crossbow item/profile exists, but no combatant body | General crossbow fixture supports 120/480 ft and persistent one-action reload | Deferred; no actor invented |
| Pikeman | allowlist name only | `humanFighters.js`, `components/data.jsx` | no actor body | Pike item exists | General extended-melee fixture; 10 ft maximum, 5 ft minimum | Deferred; no actor invented |
| Halberdier | allowlist name only | `humanFighters.js`, `components/data.jsx` | no actor body | Halberd item exists | General extended-melee fixture; 8 ft maximum, no minimum | Deferred; no actor invented |

No actual dedicated sling, javelin, bill, shortbow, or thrown-weapon actor body was found. `missileWeapons.js` contains compatibility-era item tables for several of those weapons, including corrupt `shuman` ammunition markers on thrown items; these are not promoted into actors or canonical profiles.

## Weapon authority and contradictions

- Projectile and reach are explicit `deliveryType` values. Reach distance never makes a weapon a projectile.
- Hunting Bow, Bow, Longbow, and Crossbow remain separate identities. Bows draw as part of the existing attack action. Crossbow reload is persistent and uses an ordinary action token.
- Guard Spear (one hand/shield compatible) and Infantry Spear (two hands/no shield) remain distinct. Pike and Halberd are two-handed extended melee and consume no ammunition.
- Pike/Halberd shared fixtures exist for engine tests only; they do not create public actors or sidearms.
- `reachCombatRules.js` contains useful first-contact reach advantage and environmental clearance behavior, but also an old random close-distance roll. Phase 3C1B preserves the former and does not move the latter into canonical admission.
- `resolveExtendedMeleeReach.js` is the new roll-free legality authority for token ownership, distance, obstruction, grapple, ground, and dropped-weapon checks.

## Runtime systems audited

- `selectableActorAdapter.js` already prefers a legal ranged attack beyond 5 ft and an actual carried melee attack at close distance.
- `enemyTurnAI.js` and `playerTurnAI.js` already identify ammunition-bearing/ranged attacks and use inventory counts; their tactical weights were not replaced.
- `CombatPage.jsx` already performs range modifiers, LOS/cover evaluation, projectile visuals, action execution-key ownership, and stale combat-session cleanup. Projectile visuals do not own dice or damage.
- `combatAmmoManager.js` is the active compatibility bridge. Phase 3C1B adds canonical serializable ammunition state and exact-action-token claim/commit helpers without removing inventory compatibility.
- `InitiativeTracker.jsx` owns a disconnected legacy ammunition cache and replenishes ammunition at combat end. It is obsolete for canonical combat and was left unchanged to avoid changing another UI pipeline.
- Grapple transition metadata already drops two-handed weapons and permits only inventory-backed clinch weapons. Canonical bows, crossbow, pike, halberd, and Infantry Spear use that path; no dagger is synthesized.
- Projectile armor contact now explicitly returns miss, shield interception, plate stop/deflection, mail/padding absorption, gap contact, or conditional penetration. A natural 20 continues through armor and is not automatic plate penetration.

## Line of sight, cover, and limitations

Existing hex geometry, `calculateLineOfSight`, `getCoverBonus`, range modifiers, and firing-into-melee routing remain authoritative. Canonical admission carries cover and firing-into-melee context and blocks obstruction before a roll. Extended melee uses line-of-effect obstruction without projectile animation.

Formation pike walls, brace/receive-charge, opportunity attacks, ammunition recovery, inventory transfer for thrown items, specialty-ammunition switching UI, and new Crossbowman/Pikeman/Halberdier actor bodies remain future work. No post-battle ammunition recovery was added.

# AGENTS.md

This file is the authoritative instruction file for future AI coding agents working on this simulator.

## Project Direction

This project is a historical-mythic combat simulator, not a simple party-versus-monster combat demo. Humans, animals, soldiers, monsters, mythic creatures, spirits, and armies should eventually use one unified combat actor pipeline.

When modernizing old combat systems, preserve useful working behavior even when it came from legacy or compatibility-era code. Normalize the data, migrate the feature into the current original simulation structure, and add tests before removing old paths.

## Core Actor Principles

### Playable Does Not Mean Party

`playable` means an actor can be manually selected or controlled when assigned an appropriate control mode. It does **not** mean the actor belongs to the player party.

Keep these concepts separate:

- `team`, `side`, `battleSide`, `armyId`, or `factionId` determines allegiance.
- `controlMode` determines who controls the actor.
- `playable` determines whether the actor can be manually selected or controlled.
- `type` is legacy metadata and must not be the source of truth for allegiance.

Expected examples:

```js
{
  name: "Minotaur",
  team: "enemy",
  controlMode: "ai",
  playable: true,
  modelKey: "minotaur"
}
```

```js
{
  name: "Longbowman",
  team: "party",
  controlMode: "manual",
  playable: true,
  modelKey: "longbowman"
}
```

```js
{
  name: "Hawk",
  team: "enemy",
  controlMode: "ai",
  playable: true,
  movementModes: ["ground", "flying"],
  modelKey: "hawk"
}
```

Do not assume:

- `type: "player"` means party-side.
- `type: "enemy"` means AI-only.
- a `playable-*` id means party-side.
- an enemy cannot be manually controlled.
- the player can only control party members.

### Control Modes Are First-Class

The simulator should support:

- player versus AI
- AI versus AI
- player-controlled enemies
- AI-controlled party members
- mixed armies
- passive actors
- defensive actors
- future large battle simulation

Use or preserve a control-mode helper such as:

```js
getFighterControlMode(fighter);
```

Allowed control modes:

- `"manual"`
- `"ai"`
- `"autoplay"`
- `"passive"`
- `"defensive"`

Expected defaults:

- party + manual mode = human controlled
- party + AI mode = AI controlled ally
- enemy + AI mode = AI controlled opponent
- enemy + manual mode = player-controlled enemy
- neutral civilian, merchant, or dialogue actor = passive
- guard or defender = defensive until provoked or scripted

Do not block enemy-side playable actors with manual-player-waiting unless their explicit `controlMode` is `"manual"`.

## Legacy Preservation Rules

Do not delete old working features just because their data shape is messy. Migrate and normalize them.

Preserve these working concepts:

- Longbowman keeps its model and arrow-firing behavior.
- Hawk and flying creatures keep flight mechanics.
- Minotaur remains its own mythic brute archetype and must not collapse into Arena Champion.
- Arena Champion remains a separate arena/training opponent.
- Legacy creatures, soldiers, and enemies may become normalized selectable actors.
- Compatibility fields may remain as bridges, but must not be the primary source of truth for new systems.

When a legacy actor behaves strangely, ask:

1. What feature was this actor supposed to prove?
2. Which parts still work?
3. Which fields are legacy or unsafe?
4. What normalized actor shape should replace the raw legacy body?
5. How can the model, attacks, movement, and AI role be preserved?

## Selectable Actor Catalog

The enemy picker should evolve into a selectable actor or bestiary catalog. This catalog should include clean public/original actors and normalized compatibility actors.

Each selectable actor should define a normalized shape like:

```js
{
  id: "longbowman",
  name: "Longbowman",
  category: "human",
  source: "normalized-legacy-actor",
  sourceLabel: "Normalized Legacy Actor",
  teamDefault: "enemy",
  playable: true,
  defaultControlMode: "ai",
  modelKey: "longbowman",
  size: "medium",
  movementModes: ["ground"],
  abilityScores: {
    strength: 10,
    dexterity: 14,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  },
  derivedStats: {
    hp: 12,
    maxHp: 12,
    armorClass: 12,
    movement: 30
  },
  compatibilityAttributes: {},
  equipment: [],
  attacks: [],
  rangeProfile: {},
  aiRole: "ranged",
  tags: ["humanoid", "archer", "playable"]
}
```

Recommended categories:

- `human`
- `humanoid`
- `animal`
- `mythic`
- `giant`
- `spirit`
- `undead`
- `construct`
- `soldier`
- `civilian`
- `training`

Recommended AI roles:

- `passive`
- `defensive`
- `melee`
- `ranged`
- `archer`
- `skirmisher`
- `brute`
- `grappler`
- `flier`
- `cavalry`
- `commander`
- `swarm`

The catalog must not feed raw legacy enemy objects directly into combat. Raw legacy entries must be adapted first.

## Required Starter Actor Entries

When building or repairing the selectable enemy/actor list, preserve or restore these concepts:

- Training Dummy: passive test target.
- Goblin Warrior: small humanoid melee enemy.
- Bandit: lightly armed humanoid.
- Guard: defensive humanoid.
- Spearman: reach-based humanoid.
- Archer: ranged humanoid.
- Longbowman: ranged humanoid with model, longbow, arrows, and melee fallback.
- Arena Champion: humanoid arena opponent.
- Minotaur: mythic brute with its own identity, model, and archetype.
- Hawk: flying animal using the existing flight mechanic.
- Wolf: ground animal predator.
- Boar: ground animal charger/brute.

Do not replace Minotaur with Arena Champion. They are separate archetypes.

Do not replace Longbowman with a generic melee enemy. It must remain a ranged actor.

Do not flatten Hawk or other flying actors into ground-only enemies.

## Movement Mode Preservation

Movement must support multiple movement modes. Do not collapse movement into a single ground speed.

Preserve or normalize:

- ground movement
- flying movement
- climbing
- swimming
- dash/run distance
- compatibility speed attributes

A flying actor should have clear movement fields, such as:

```js
{
  movementModes: ["ground", "flying"],
  movement: {
    ground: 10,
    flying: 60
  }
}
```

Use the closest existing project-compatible equivalent when this exact shape is not yet supported.

Flight mechanics for hawks and other flying characters must be preserved.

## Ranged Actor Preservation

Ranged actors must be able to fight at range. Longbowman, Archer, and other ranged actors should not be forced to close into melee when they have a valid ranged attack.

A normalized ranged actor should include:

```js
{
  aiRole: "ranged",
  attacks: [
    {
      name: "Longbow Shot",
      kind: "ranged",
      rangeProfile: {
        normal: 150,
        long: 600
      }
    },
    {
      name: "Knife Attack",
      kind: "melee",
      reach: 5
    }
  ]
}
```

Use project-safe/original naming. Do not copy private/proprietary rulebook terminology.

If a ranged actor is 80 ft away and has a valid ranged attack with normal range greater than 80 ft, the AI should prefer shooting rather than repeatedly attempting movement.

## Mythic Actor Preservation

Mythic creatures are part of the long-term project vision.

Minotaur, giants, spirits, dragons, and other mythic actors should use the same actor pipeline as humans and animals, with special movement, size, morale, stamina, wounds, reach, and AI behavior layered on top when implemented.

Do not build a separate one-off monster system unless specifically requested.

## Compatibility Actor Rules

Legacy/compatibility actors may remain available, but must be clearly labeled.

Use labels such as:

- `source: "compatibility-actor"`
- `sourceLabel: "Compatibility Actor"`
- `source: "normalized-legacy-actor"`
- `sourceLabel: "Normalized Legacy Actor"`

Compatibility actors must pass through an adapter before entering combat.

The adapter should normalize:

- team
- controlMode
- playable
- modelKey
- movement modes
- ability scores
- compatibility attributes
- HP
- armor
- attacks
- range
- action count
- AI role

Do not allow old compatibility-only movement/range fields to override clean public/original fields unless explicitly intended.

## AI Autoplay Goal

AI mode is a first-class project goal. The simulator should eventually allow the user to press a mode/toggle and watch a fight play out.

AI autoplay should support:

- party versus enemies
- enemies versus enemies
- custom faction battles
- player-controlled enemies mixed with AI allies
- large battle tests

Do not assume that manual player control is always required for the player side.

Do not assume that enemies are always AI-only.

Do not assume that a side with no manual actor should stall.

## Migration Rule For Strange Legacy Behavior

If a legacy actor behaves strangely, such as an archer repeatedly trying to move instead of shooting:

1. Do not delete the actor.
2. Identify the old fields causing the issue.
3. Preserve the model, identity, intended weapon behavior, and movement concept.
4. Create a normalized catalog entry.
5. Add an adapter test proving the normalized version behaves correctly.
6. Keep the legacy path labeled separately until it can be removed safely.

Example target for Longbowman normalization:

- `modelKey: "longbowman"`
- `playable: true`
- `defaultControlMode: "ai"`
- `teamDefault: "enemy"`
- `aiRole: "ranged"`
- movement ground speed around normal human movement unless intentionally modified
- longbow ranged attack
- melee fallback
- clean range profile
- no raw legacy movement/range fields overriding the new profile

## Implementation Priority

When working on selectable actors, prioritize:

1. Normalized actor catalog.
2. Clean adapter into combat.
3. Source labels that distinguish public/original, saved, generated, and compatibility actors.
4. Preservation of legacy models and working attacks.
5. AI/autoplay readiness.
6. Manual playability for any actor.
7. Separation of allegiance from control mode.
8. Tests proving ranged, flying, mythic, passive, defensive, and playable-enemy actors do not stall turn flow.

## Combat Engine Stability Invariants

These rules are mandatory for all future changes to combat turn flow, movement, AI execution, grapples, routing, cower/no-move behavior, and delayed attack callbacks.

### Real Movement Commit Authority

Real tactical movement must update every canonical position store together. A movement change is not complete unless the fighter object and all active position stores agree.

When an actor actually moves, update:

- fighter `x` / `y`
- fighter `position`
- fighter `hex` if present
- `positionsRef.current`
- `committedPositionsRef.current`
- the last-real-movement authority, such as `lastMovementCommitRef.current`
- React position state, when used by the current UI path

Real tactical movement includes:

- combat reset / initial placement
- manual movement
- player AI approach move-only
- player AI flanking movement
- routed flee / retreat movement
- enemy run-to-range movement
- enemy flank or direct approach movement
- successful grapple / shared-position synchronization
- explicit debug or scripted placement, when intentionally used

Do not update last-real-movement authority from stale scheduled actors, no-move branches, cower branches, fallback branches, finalizer handoffs, or delayed callback snapshots.

### No-Move, Cower, Fallback, And Horror Finalizers

No-move, cower, fallback, and horror-action-consumed paths must preserve the latest real tactical position. They must not write stale actor coordinates back into fighter state or position stores.

All no-move style branches should use a shared preservation helper, such as:

```js
finalizeNoMovePreservingPosition({
  fighterId,
  actorPatch,
  reason,
  source,
});
```

The helper must:

- resolve the latest position by fighter id
- prefer last-real-movement authority over stale actor data
- strip position fields from stale actor patches
- apply only non-position metadata, action consumption, status, morale, or routing fields
- write the preserved latest position back to all canonical stores
- log mismatches before they become gameplay bugs

Recommended diagnostic shape:

```text
position authority candidates: actor=<name> source=<source> lastMove=(x,y) committed=(x,y) positionsRef=(x,y) fighter=(x,y) stale=(x,y)
cower preserve position check: actor=<name> source=<source> stale=(x,y) latest=(x,y)
cower preserve position committed: actor=<name> source=<source> final=(x,y)
position store mismatch after no-move: actor=<name> fighter=(x,y) positionsRef=(x,y) committed=(x,y)
```

Enemy no-move fallback snapshots must resolve from the latest position authority, not from the scheduled enemy actor object.

### Turn Ownership And Delayed Execution

Delayed combat work is unsafe unless it proves ownership immediately before mutating state.

Any delayed callback, promise continuation, timeout, AI continuation, grapple follow-up, attack finalizer, or projectile/impact callback must validate that it still owns the relevant turn/action before it can:

- spend stamina
- roll attack
- roll defense
- roll damage
- apply HP mutation
- apply critical effects
- consume actions
- accept a finalizer

When a callback no longer owns the turn, it must return early and log a blocked stale execution.

Recommended blocked log:

```text
stale combat roll blocked: actor=<name> reason=<reason> executionKey=<key> source=<source>
```

Do not merely detect stale work after the roll. Block it before any roll, damage, or HP mutation occurs.

### Combat Roll Ownership Gate

Every attack roll and damage path must pass through the final low-level combat roll ownership gate.

Use or preserve a helper such as:

```js
validateCombatRollOwnership({
  actorId,
  targetId,
  executionKey,
  source,
  allowOutOfTurnAttack,
});
```

This gate must run immediately before:

- attack roll
- grapple ground attack roll
- damage roll
- grapple damage roll
- HP mutation
- grapple HP mutation

A valid roll path should show an intentional gate chain before mutation:

```text
combat roll gate passed: actor=<name> source=attack-entry-pre-roll executionKey=<key>
combat roll gate passed: actor=<name> source=immediate-pre-roll executionKey=<key>
combat roll gate passed: actor=<name> source=attack-roll-pre-stamina executionKey=<key>
combat roll gate passed: actor=<name> source=attack-roll executionKey=<key>
combat roll gate passed: actor=<name> source=damage-roll executionKey=<key>
combat roll gate passed: actor=<name> source=hp-mutation executionKey=<key>
```

A roll that starts at `attack-roll`, `damage-roll`, or `hp-mutation` without a valid entry/pre-stamina gate in the same execution chain is suspicious and should be blocked unless it is an explicitly valid reaction path.

Execution keys must expire or become invalid when:

- a finalizer settles
- cower/no-move/horror-action-consumed consumes the turn
- a new melee round starts
- the actor reaches zero actions
- the active fighter changes
- combat ends
- generation, round, turn serial, action serial, or owner token no longer matches

Unkeyed non-reaction attacks must be blocked. Attack-of-opportunity and other explicit reactions may pass only when deliberately marked with `allowOutOfTurnAttack` or the project’s equivalent.

### Grapple And Clinch Safety

Grapple initiation, grapple follow-ups, ground attacks, mauls, escapes, and clinch weapon swaps must follow the same ownership rules as normal attacks.

Before any grapple follow-up roll, validate:

- combat is active
- actor and target still exist
- actor still owns the action or continuation
- actor has actions remaining when the action consumes one
- round/generation/turn token still matches
- target is still valid
- positions are still valid for the grapple state

A stale grapple follow-up must block before the ground attack roll or damage roll.

### Armed AI Grapple Preference

An armed fighter with a usable melee weapon should not voluntarily initiate a grapple against an ordinary armed enemy unless one of the following is true:

- the actor has an explicit grappler, wrestler, beast, brute, or clinch-focused trait
- the target is prone, stunned, disarmed, trapped, or otherwise vulnerable
- the actor is unarmed
- the actor has no usable melee weapon
- the actor has a special tactical intent that explicitly says to grapple

A sword-armed fighter at normal melee range should generally prefer the sword attack over voluntary grapple initiation. Existing grapple follow-ups may still switch to an appropriate clinch weapon such as a dagger.

### Browser Log Verification Required

Unit and regression tests are required, but they are not enough for async combat work.

After changing any of these systems, run a browser combat test and inspect the log:

- turn scheduler
- finalizer handoff
- player AI continuation
- enemy AI start
- movement commit
- cower/no-move/fallback
- attack roll gate
- grapple follow-up
- new melee round transition
- combat end

The browser log must not show rolls, damage, or HP mutation without a valid ownership chain.

## Regression Expectations

When implementing this migration, add or preserve tests that prove:

- ranged actors attack from valid range instead of repeatedly closing into melee
- flying actors retain flying movement and do not become ground-only
- mythic actors remain distinct from training or arena actors
- passive actors do not stall turn flow
- defensive actors do not incorrectly behave as always-aggressive attackers
- playable enemy-side actors can be manual or AI depending on `controlMode`
- AI/autoplay battles continue when no party-side manual actor exists
- compatibility actors are adapted before entering combat

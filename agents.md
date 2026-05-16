# Palladium RPG Game Coding Rules

This is a React/Vite/Electron tabletop RPG combat game.

## Most Important Rule

Patch one bug or one feature slice at a time. Do not perform broad cleanup, refactors, or opportunistic fixes.

Correctness before strategy: fix turn/action timing, stale callbacks, and state commits before adding smarter AI behavior.

## Codex / Cursor Auto Patch Rules

This project is fragile. Make small, targeted patches only.

Codex may inspect and reason more deeply, but it must still patch narrowly. Cursor Auto must be treated as a narrow patch assistant, not a full architect.

### Default behavior

- Read this AGENTS.md before editing.
- Follow the user's requested scope exactly.
- Prefer the smallest safe patch.
- Do not refactor unrelated code.
- Do not rename large systems unless explicitly requested.
- Do not commit changes.
- Do not create new architecture unless the task asks for it.
- Do not touch unrelated files to “clean up” warnings.
- Do not fix multiple bugs in one pass unless explicitly requested.
- If the user says “no review-only step,” inspect the relevant path and then implement the smallest safe patch.
- If the user asks for an audit, do not edit.

### Before editing

For any non-trivial task, first identify:

1. The exact bug or feature being changed.
2. The exact file(s) needed.
3. The smallest safe patch.
4. The expected build/test command.

If the task can be done in one file, keep it in one file.

### Reporting after every patch

Always report:

1. Changed files.
2. Focused diff summary.
3. Why the bug happened.
4. How the patch fixes it.
5. Whether `npm run build` passed.
6. Existing unrelated warnings separately.
7. Whether a commit was made.

Do not commit unless the user explicitly asks.

## Sensitive files

- `src/pages/CombatPage.jsx` is large and fragile.
- Do not rewrite the whole file.
- Do not change combat turn advancement unless the task is specifically about turn logic.
- Do not change spell impact locking.
- Do not change enemy AI scheduling.
- Do not change attack resolution unless the task is specifically about attack resolution.
- Do not mix deployment, AI, victory, grapple, and UI cleanup in one patch unless explicitly requested.

## CombatPage.jsx caution

`src/pages/CombatPage.jsx` contains fragile combat turn flow.

Do not broadly edit:

- `scheduleEndTurn`
- `startTurnOnce`
- `startEnemyTurn`
- `handleEnemyTurn`
- `tryEndTurn`
- `turnIndexRef`
- `fightersRef`
- `processingEnemyTurnRef`
- `processingPlayerAIRef`
- `turnActionResolvingRef`
- `pendingTurnAdvanceRef`
- enemy/player scheduled-start timers
- spell impact locks
- active projectile/impact callbacks

unless the task is specifically about turn flow.

When changing turn flow:

- Preserve existing debug logs where possible.
- Add a clear reason string to scheduling calls.
- Do not start a fighter from a stale snapshot.
- Resolve live fighters from `fightersRef.current`.
- Use `canFighterStartTurn(...)` for turn-start eligibility where available.
- Do not allow HP 0, defeated, fled, carried, unconscious, or incapacitated actors to start a turn.
- Avoid direct `endTurn()` in async/callback paths; prefer the existing scheduled handoff pattern.
- Do not schedule a new start after combat is over.
- Do not schedule a new start after victory/defeat has been resolved.
- If a branch updates fighters, commit the same updated array to both `fightersRef.current` and `setFighters(...)` when possible.

## Action-spend rules

Any action branch that performs an action must:

1. Spend/decrement exactly one action unless clearly free.
2. Log remaining attacks if nearby branches do.
3. Commit fighter state.
4. Schedule turn end once.
5. Return immediately after scheduling.

Do not allow an action branch to fall through into a second action.

Examples of action branches:

- attack
- spell
- psionic
- grapple
- movement used as action
- passive skip
- defensive hold
- recover/catch breath
- flee
- lift/carry/drop
- no-target defend/pass

## Stale callback / delayed action rules

Delayed or async actions must re-check live state immediately before applying results.

Before applying delayed damage, grapple effects, movement effects, or spell impact:

- Re-resolve the actor from `fightersRef.current`.
- Confirm the actor still exists.
- Confirm combat is not over.
- Confirm the actor still has the right turn token/key if available.
- Confirm the actor has `remainingAttacks > 0` if the action spends an attack.
- Confirm the actor can still act or continue the already-started action.
- Confirm the target still exists and is valid.
- Abort stale callbacks without applying damage.

Use a log like:

- `🚫 stale attack aborted: <reason>`
- `🚫 stale grapple follow-up aborted: <reason>`
- `🚫 stale spell impact aborted: <reason>`

Do not clear a newer turn’s latch from an older stale callback.

## No-action / round exhaustion rules

The “anyone still has actions?” check must match the same eligibility rule used by the next-fighter loop.

Use:

- `canFighterStartTurn(f)`
- numeric `remainingAttacks > 0`

Do not use a looser `canFighterAct(...)` check if the next-turn loop uses `canFighterStartTurn(...)`.

If no eligible fighter has actions left:

- log melee round completion once
- reset remaining attacks for eligible fighters
- keep defeated, fled, carried, unconscious, and cannot-act fighters at 0
- start the first eligible fighter in the new round
- do not endlessly cycle through no-action fighters

## Passive / defensive actor rules

Passive and defensive actors must not stall the turn loop.

Passive actors include:

- neutral merchants
- civilians
- noncombatants
- dialogue creatures

Defensive actors include:

- guards with defensive aggression
- neutral defenders who should not attack unless provoked

For passive/defensive turns:

1. Resolve the live fighter from `fightersRef.current`.
2. Decrement `remainingAttacks` exactly once if above 0.
3. Commit the updated fighter to both `fightersRef.current` and `setFighters(...)`.
4. Log the committed next action count.
5. Clear relevant processing refs.
6. Call `scheduleEndTurn(0, "passive-army-turn")` or `scheduleEndTurn(0, "defensive-army-turn")`.
7. Return immediately.

Do not let passive/defensive actors repeat the same “has 1 action remaining” forever.

## Flee / no-target rules

When a fighter flees:

- Mark the fighter fled/cannot act first.
- Commit the updated fighter state.
- Run the existing faction-aware victory check immediately.
- If combat is resolved, end combat once and return.
- Do not schedule another enemy turn just so the enemy can log “has no targets and defends.”

When an enemy or AI actor has no valid hostile targets:

- Check victory before logging no-target behavior.
- If combat should end, end combat once and return.
- If combat continues, spend/pass exactly one action.
- Schedule turn end once with a clear reason, such as `enemy-no-targets`.

## Multi-army / faction rules

This game supports named armies/factions.

Do not assume:

- `type !== actor.type` means hostile.
- `type === actor.type` means ally.

Use faction/disposition helpers where available:

- `isHostileTo(...)`
- `isAllyOf(...)`
- `canTargetForAction(...)`
- `getDisposition(...)`

Keep `fighter.type` as legacy control/display role only:

- `"player"`
- `"enemy"`
- `"npc"`

Use these for grouping and relationships:

- `armyId`
- `armyName`
- `teamId`
- `factionId`
- `role`
- `aggression`
- `disposition`
- `attacksEveryone`
- `canDialogue`
- `nonCombatant`

Neutral NPCs, merchants, civilians, and dialogue creatures should not be attacked or count for victory unless explicitly hostile.

## Army control-mode rules

Turn control must not be based only on `fighter.type`.

Use or preserve a helper like `getFighterControlMode(fighter)`.

Allowed control modes:

- `"player"`
- `"ai"`
- `"passive"`
- `"defensive"`

Expected defaults:

- Player Party: manual/player when AI Control is off.
- Player Party: AI when AI Control is on.
- Enemies: AI.
- Hostile custom factions: AI.
- Diabolic / berserk / attacksEveryone: AI.
- Neutral merchants/civilians/dialogue creatures: passive.
- Guards/defensive factions: defensive until smarter guard behavior is implemented.

Non-party AI armies should not wait for manual player control.

Passive/defensive armies should never stall the turn. They should pass/spend safely.

## Target selection rules

All attack, movement, flanking, spell-hostile, and hostile psionic target selection must use faction-aware hostility.

Do not select targets using only:

- nearest other fighter
- `f.id !== actor.id`
- `f.type !== actor.type`
- `f.type === "player"`
- `f.type === "enemy"`

Use:

- `canTargetForAction(actor, candidate, "attack", sceneContext)`
- `canTargetForAction(actor, candidate, "spellHostile", sceneContext)`
- `isHostileTo(actor, candidate, sceneContext)`

Neutral merchants/civilians/dialogue NPCs should not be selected for:

- closest target
- movement target
- flanking target
- fallback target
- hostile spell target
- hostile psionic target

unless they are explicitly hostile or the actor is diabolic/berserk/attacksEveryone.

If no valid hostile targets exist, use the no-target pass/defend branch.

## Victory rules

Victory must be faction-aware.

Old party vs enemy behavior should still work, but neutral actors should not block victory or cause defeat.

Neutral NPCs should not count as enemies to defeat.

Fled, defeated, unconscious, carried, dead, and incapacitated fighters should not count as active victory threats.

Carried/lifted targets should not count as active victory threats.

Use existing faction-aware victory helpers where available.

Do not add old direct checks like:

- `fighters.filter(f => f.type === "player")`
- `fighters.filter(f => f.type === "enemy")`

inside new victory branches unless explicitly preserving a legacy UI counter.

## Deployment / manual placement rules

Manual deployment must be visible and must be used by combat start.

Manual deployment requires:

1. User selects a fighter card.
2. User clicks Manual Place on Map.
3. User clicks a valid hex.
4. The token appears immediately.
5. The fighter card shows PLACED and coordinates.
6. Combat start uses that manual position.

Manual placement must work before Auto Deploy.

Manual placement must write to the same deployment state that:

- map preview renders
- fighter cards read
- startCombat uses

If `TacticalMap` uses `allowEmptyHexSelection` and `onSelectedHexChange`, wire deployment placement through that path.

Do not rely on unused props like `onMoveSelect` unless the map component actually consumes them.

Auto Deploy should preserve manual placements and fill only unplaced fighters when possible.

Manual placement should support:

- Player Party
- Enemies
- Scene Actors
- custom armies/factions represented by current deployment groups

## Deployment UI rules

Deployment UI should not block the map during manual placement.

- Do not teach manual map placement inside a modal that covers the map.
- Combat Arena Controls should be collapsible/minimized or moved out of the way during deployment.
- Manual placement controls should clearly show the selected fighter.
- Fighter cards should be selectable for placement.
- Selected fighter should be visually highlighted.
- Placed fighters should show coordinates.
- Auto Deploy should remain available.
- Manual placement should remain available.

Do not rewrite deployment broadly unless the task asks for it.

## Movement / occupancy rules

Normal movement must not stack on the target’s occupied hex.

Normal move-to-engage should:

- stop in a valid adjacent unoccupied hex
- report 5ft/adjacent distance, not 0ft
- avoid occupied destinations

Shared hex is allowed only for explicit mechanics:

- grapple
- tackle
- trample
- overrun
- carry/lift
- existing sharedHex grapple state

If a computed movement destination is occupied:

1. Find a valid adjacent unoccupied hex near the target.
2. Prefer the adjacent hex closest to the mover’s path/start.
3. If no adjacent hex is available, stop at a safe pre-target hex.
4. If no safe hex exists, refuse the move and log why.

Do not log “barrels through” unless the action is truly trample/overrun or another explicit shared-hex mechanic.

## Grapple rules

Do not create a second grapple system.

Use existing grapple state where possible:

- `fighter.grappleState`
- `grappleState.opponent`
- `grappleState.sharedHex`
- `grappleState.state`
- `grappleState.hasGrappleAdvantage`
- `grappleState.lifted`
- `grappleState.carriedBy`
- `grappleState.carryMode`

### Grapple modifier rules

Grapple modifiers must be recalculated fresh per action.

Do not persist temporary technique bonuses into fighter stats.

Do not allow modifiers to accumulate each round.

Expected grapple roll shape:

- d20
- PP control bonus
- PS/size difference
- grapple advantage
- skill bonus
- fatigue modifier

A grapple ground strike should not produce absurd bonuses like `+100`.

If a modifier reaches extreme values, inspect for:

- mutated bonus objects
- persisted temporary PS/PP/Spd changes
- stacking grapple advantage
- reused bonusModifiers
- action objects reused across turns

### Grapple position rules

A fighter cannot perform grapple follow-up from far away.

Before any grapple follow-up:

- actor has grappleState
- opponent exists
- actor.grappleState.opponent matches opponent id
- opponent.grappleState.opponent matches actor id where required
- distance is 0ft or adjacent, depending current rules
- if sharedHex exists, positions are synced or repaired

If fighters are too far apart:

- clear grappleState on both fighters
- clear sharedHex/lifted/carried grapple metadata if relevant
- log `⚠️ Grapple state cleared: fighters separated.`
- continue with normal non-grapple AI or end/pass safely

Do not allow flanking or normal movement while a fighter is actively grappled unless the chosen action is:

- breakaway
- push-off
- reversal
- valid grapple movement
- forced movement
- carry/lift/drop

### Grapple timing rules

Grapple follow-up actions must obey action/turn locks.

A grapple follow-up must only resolve if:

- actor is still the current turn actor
- actor has `remainingAttacks > 0`
- actor can act or continue the already-started action
- combat is not over
- turn key/token still matches if available
- action has not already been committed/spent

Before applying grapple damage:

- re-resolve live actor from `fightersRef.current`
- re-resolve target from `fightersRef.current`
- verify action still valid
- abort stale callbacks without damage

Do not allow grapple damage after logs say all fighters have no actions remaining or a round is already transitioning.

Use a stale abort log like:

- `🚫 stale grapple follow-up aborted: no actions`
- `🚫 stale grapple follow-up aborted: turn changed`
- `🚫 stale grapple follow-up aborted: combat over`

## Tactical grapple / reach-combat rules

Grapple is a tactical close-quarters option, not just another attack.

Design intent:

- Grapple is strong against armored knights because it closes inside their normal weapon range.
- Grapple can create chances to stab weak points in armor with a dagger/knife.
- Grapple should cost stamina and create risk of reversal if the grappler becomes exhausted.
- Non-knights, light fighters, archers, casters, and reach-weapon users should usually avoid grapple.
- Reach weapons should matter by keeping enemies one or more hexes away.

### Grapple vs armored targets

When a fighter is grappling an armored target:

- Prefer dagger, knife, short blade, unarmed, claw, or natural weapons.
- Do not freely use long sword, lance, pike, bow, crossbow, polearm, or two-handed weapons inside a grapple.
- Ground strikes inside grapple may target weak points in armor only when the attacker has control, advantage, a high roll, or a critical.
- Do not make every grapple strike bypass armor.
- Normal or weak grapple hits should still allow armor to absorb damage or take S.D.C. damage.

Suggested balance:

- Natural 20 or high-margin grapple strike: weak-point armor bypass.
- Controlled dagger/knife strike: possible partial bypass or HP damage.
- Normal grapple strike: armor absorbs or takes S.D.C. damage.
- Failed grapple strike: no damage.

Do not change the global armor system just to support grapple weak spots.
Keep weak-spot logic local to grapple/close-quarters actions unless explicitly requested.

### Grapple weapon suitability

Use or add a helper like:

`isWeaponGrappleSuitable(weapon)`

Grapple-suitable weapons:

- unarmed
- knife
- dagger
- short blade
- claws
- bite
- natural weapons
- explicitly marked grapple-capable weapons

Not grapple-suitable:

- bow
- longbow
- crossbow
- lance
- pike
- polearm
- long spear
- two-handed sword
- staff/pole weapon unless marked grapple-capable
- any weapon with `requiresTwoHands`
- any weapon with `rangeType === "RANGED"`
- any weapon with `reachCategory === "LONG"` unless explicitly marked grapple-capable

If a fighter enters grapple with a non-grapple-suitable weapon:

- switch to dagger/knife if available
- otherwise use unarmed/natural weapon
- do not keep using the unsuitable weapon inside grapple
- log clearly:
  - `⚠️ <name> cannot use <weapon> effectively in a grapple.`
  - `🗡️ <name> switches to <dagger/knife> for close-quarters fighting.`

Do not silently let a lance, bow, pike, or two-handed sword behave like a dagger in a grapple.

### Reach-distance behavior

Reach and hex distance matter.

Use or add a helper like:

`getPreferredEngagementRange(fighter, target)`

General expectations:

- same hex: grapple, clinch, tackle, ground fighting
- adjacent 1 hex: normal melee
- 2 hexes: reach weapon zone if weapon supports it
- beyond 2 hexes: ranged, charge, movement, or closing

Reach weapon AI should prefer to keep distance:

- pike / polearm / lance: prefer 2 hexes when possible
- spear / long weapon: prefer 1–2 hexes
- sword / axe / mace: prefer adjacent
- dagger / knife / unarmed / grappler: prefer same hex or adjacent
- bow / caster: prefer distance and avoid same hex

A reach-weapon user should not intentionally move into the target’s hex unless the selected action is explicitly:

- grapple
- tackle
- trample
- overrun
- charge-through
- forced movement

Do not let normal move-to-engage collapse reach users into same-hex grapples.

### Anti-grapple behavior

Non-grapplers should avoid being grabbed.

A fighter should avoid initiating grapple when:

- they are lightly armored and weaker than the target
- they are an archer/caster
- they are holding a reach weapon and can keep distance
- they are low stamina
- the target is stronger, larger, or specialized for grapple

A fighter should prefer breakaway, push-off, reversal, or step-back when:

- already grappled
- stamina is low
- using a reach weapon
- trying to regain distance

Do not implement broad new AI strategy unless the task specifically asks for it.
Small local preference changes are acceptable when the task is about grapple or reach behavior.

### Knight behavior inside grapple

An armored knight inside grapple should not behave like they are in open melee.

If grappled:

- switch to dagger/knife/unarmed if holding an unsuitable long/two-handed weapon
- attempt reversal, break-free, shove-off, or dagger strike depending on stamina and advantage
- recover/defend if stamina is dangerously low
- use ground strike/pin/control if the opponent is weak or tired

A knight outside grapple may prefer sword/lance/open melee.
A knight inside grapple should prefer close-quarters tools.

## Grapple AI strategy rules

Do not implement advanced grapple strategy until correctness bugs are fixed.

Future intended behavior:

- If grappling and opponent stamina is low: use takedown, pin, control, choke, or ground strike.
- If grappling and self stamina is low: defend, recover, stall, or break safely.
- If opponent recovers stamina: attempt reversal, break free, push-off, or regain position.
- Fatigue should influence grapple choice, not just attack penalty.

Do not implement this unless the task specifically asks for grapple AI strategy.

## Armor / equipment rules

Armor uses layered equipment.

Do not simply stack AR values.

Respect these layers/slots:

- clothes/base
- padding
- mail
- plate
- head
- hands
- arms
- legs
- feet
- outer
- shield as held/offhand, not torso armor

Preserve legacy fields like `AR`, `equippedArmor`, and `equipped.chest` only as compatibility bridges.

## Lift / carry / drop rules

Do not create a second carry system.

Reuse existing fields/helpers where available:

- `isCarrying`
- `carriedTargetId`
- `isCarried`
- `carriedById`
- `carrying`
- `grappleState.lifted`
- `grappleState.carriedBy`
- `dropCarriedTarget(...)`
- `liftAndCarry(...)`

Fall damage must remain centralized through the existing drop/fall helper path.

Carried/lifted targets should not count as active victory threats.

Carrier actors still count as active unless otherwise defeated/incapacitated.

## Ground items / dropped weapons / pickup rules

The combat arena should support dropped weapons and battlefield items.

Do not create a full loot/inventory rewrite for this.
Add small local battlefield item support first.

### Ground item state

Use or preserve a local combat shape like:

```js
groundItems = [
  {
    id,
    item,
    name,
    sourceFighterId,
    droppedByName,
    position: { x, y },
    roundDropped,
    createdAt,
  },
];
```

# Medieval Combat Simulator Game Coding Rules

This is a React/Vite/Electron tabletop RPG combat game.

## Most Important Rule

Patch one bug or one feature slice at a time. Do not perform broad cleanup, refactors, or opportunistic fixes.

## Cursor Auto / Agent Patch Rules

This project is fragile. Make small, targeted patches only.

### Default behavior

- Read this AGENTS.md before editing.
- Follow the user's requested scope exactly.
- Prefer the smallest safe patch.
- Do not refactor unrelated code.
- Do not rename large systems unless explicitly requested.
- Do not commit changes.
- Do not create new architecture unless the task asks for it.
- Do not touch unrelated files to Ã¢â‚¬Å“clean upÃ¢â‚¬Â warnings.
- Do not fix multiple bugs in one pass unless explicitly requested.

### Before editing

For any non-trivial task, first identify:

1. The exact bug or feature being changed.
2. The exact file(s) needed.
3. The smallest safe patch.
4. The expected build/test command.

If the task can be done in one file, keep it in one file.

## Sensitive files

- `src/pages/CombatPage.jsx` is large and fragile.
- Do not rewrite the whole file.
- Do not change combat turn advancement unless the task is specifically about turn logic.
- Do not change technique impact locking.
- Do not change enemy AI scheduling.
- Do not change attack resolution.

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
- `turnActionResolvingRef`
- `pendingTurnAdvanceRef`

unless the task is specifically about turn flow.

When changing turn flow:

- Preserve existing debug logs where possible.
- Add a clear reason string to scheduling calls.
- Do not start a fighter from a stale snapshot.
- Resolve live fighters from `fightersRef.current`.
- Use `canFighterStartTurn(...)` for turn-start eligibility where available.
- Do not allow HP 0, defeated, fled, carried, or unconscious actors to start a turn.
- Avoid direct `endTurn()` in async/callback paths; prefer the existing scheduled handoff pattern.

## Action-spend rules

Any action branch that performs an action must:

1. Spend/decrement exactly one action unless clearly free.
2. Log remaining attacks if nearby branches do.
3. Commit fighter state.
4. Schedule turn end once.
5. Return immediately after scheduling.

Do not allow an action branch to fall through into a second action.

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

Neutral NPCs, merchants, civilians, and dialogue combatants should not be attacked or count for victory unless explicitly hostile.

## Armor / equipment rules

Armor uses layered equipment.

Do not simply stack guardRating values.

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

Preserve legacy fields like `guardRating`, `equistaminadArmor`, and `equistaminad.chest` only as compatibility bridges.

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

## UX task rules

- Make small, targeted patches.
- Improve only the setup/deployment duelist unless asked otherwise.
- Use minimal instructions.
- Show one obvious next action.
- Use pulsing tutorial highlights for the next required button.
- Beginner path should prefer Quick Start and Auto Deploy.
- Manual map placement should not be taught inside a modal that covers the map.

## Build and report

After every patch:

- Show changed files.
- Summarize the focused diff.
- Run `npm run build` when available.
- Report whether the build passed.
- Report existing unrelated warnings separately.
- Report errors honestly.
- Do not commit.

## Stop conditions

Stop and report instead of editing broadly when:

- The fix touches more than 2Ã¢â‚¬â€œ3 unrelated systems.
- The issue requires changing victory, AI, deployment, and UI at the same time.
- The code path is unclear.
- The patch would require guessing about game rules.
- The build fails for reasons unrelated to the patch.

In those cases, report:

1. What was found.
2. Why the patch is risky.
3. The smallest recommended next step.

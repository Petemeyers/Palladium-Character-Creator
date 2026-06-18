# Summary of Patches: Combat Engine in Electron Worker

Overview of the patches that moved combat logic into an Electron worker and made the UI purely reactive.

---

## Initial Setup

- **Electron + scripts:** `electron`, `concurrently`, `wait-on`; `main: "electron/main.cjs"`; scripts `electron:dev`, `electron:start`.
- **Files:** `electron/main.cjs` (main process, worker, IPC), `electron/preload.cjs` (exposes `window.engine.call`), `electron/engine.worker.cjs` (routes methods to engine modules).
- **Engine entry:** `src/engine/resolveTurn.cjs` with basic `END_TURN` / `ROLL_D20` intents.
- **CombatPage:** Uses `window.engine.call` for turn resolution; `eventToLogLine` maps worker events to log lines.

---

## Combat Ammo Manager Fix

- **Exports in `combatAmmoManager.js`:** `useAmmo` (getter + legacy 4-arg helper/consume), `setAmmo`, `replenishAllAmmo`, aligned with `ammoCount` shape `{ [characterId]: { [ammoType]: number } }`.
- **InitiativeTracker:** Uses `setAmmoCount(prev => setAmmo(...))` for spend; `initializeAmmo(allCharacters)` for replenish on `endCombat`.

---

## Real END_TURN_FULL (Worker)

- **`resolveTurn.cjs`:** `END_TURN_FULL` uses `canFighterActLite` / `hasActionsLeftLite`, decides melee-round-complete, picks next eligible fighter (wrap-around), returns `turnIndex`, `turnCounter`, `round`, `meleeRoundComplete`, and emits `TURN_ENDED`, `MELEE_ROUND_ENDED`, `ROUND_STARTED`, `TURN_STARTED`; `actorId` uses `id ?? _id ?? uuid`.
- **CombatPage:** `startNewMeleeRound(nextRoundNumber)` holds the melee reset (guards, status, `remainingActions`, etc.); `onEndTurnFull` applies worker result and calls `startNewMeleeRound` when `meleeRoundComplete`; fatigue/other â€œend turnâ€ paths call `onEndTurnFull(currentFighter?.id)`.
- **Logging:** `eventToLogLine` handles `ROUND_STARTED`, `MELEE_ROUND_ENDED`.

---

## Patches 3â€“4: Payload Shape and Fast-Forward

- **Patch 3 â€“ fightersLite and advanceUntilHuman**
  - **CombatPage:** `buildFightersLite(fightersArr)` and `onEndTurnFull` send `fightersLite` instead of full fighters.
  - **resolveTurn.cjs:** Prefers `state.fightersLite`, uses robust `nextActorId`.
  - **advanceUntilHuman:** Loops `END_TURN_FULL` until `isHumanLite(next)` or `maxSteps`; returns `nextState`, `events`, `stostaminadBecause`.
  - **engine.worker.cjs:** Handles `advanceUntilHuman`.

- **Patch 4 â€“ advanceUntilPlayer**
  - **resolveTurn.cjs:** `isPlayerConchampionedLite(f, playerSides)`; `advanceUntilPlayer` runs until a player-conchampioned turn, tracks `roundsAdvanced`, returns `roundsAdvanced` and `stostaminadBecause: "PLAYER_TURN"`.
  - **CombatPage:** `onAdvanceUntilPlayer` calls it and runs `startNewMeleeRound(r)` for each advanced round.
  - **Patches 5â€“6:** `shouldLogEvent` filters noisy `TURN_STARTED`/`TURN_ENDED` during fast-forward; optional â€œFast Forward to Playerâ€ behavior.

---

## Patch 7: Worker AI Action Selection

- **`src/engine/aiSelectAction.cjs`:** Pure logic: `canActLite`, distance, side checks; returns `{ type, targetId, reason }` (attack/move/defend/hold).
- **engine.worker.cjs:** Routes `aiSelectAction`.
- **CombatPage:** `buildPositionsLite(posMap)`; in the AI block, when `window?.engine?.call` exists, calls worker `aiSelectAction` with `fightersLite`/`positionsLite` and maps the result into the existing actionPlan/execution path.

---

## Patch 8: Richer AI_INTENT

- **buildFightersLite:** Adds `hasRanged`, `rangedRange`, `preferredRange` (from weapons).
- **aiSelectAction.cjs:** Returns `{ type: "AI_INTENT", actorId, intent: { kind: "ATTACK"|"MOVE"|"HOLD", attackMode, desiredRange, approach, targetId }, reason }`; prefers ranged when in range, else move toward/away.
- **CombatPage:** Converts `AI_INTENT` into `executeAIAttack` / `executeAIMove`; adds placeholder adapters that later call real attack/move logic; `executeAIAttack` can use `actionPlan.attackMode`.

---

## Patch 9: AI Turn Raiderhestration (aiTakeTurn)

- **`src/engine/aiTakeTurn.cjs`:** Uses `aiSelectAction`; emits `AI_INTENT` and `AI_SHOULD_END_TURN`; one micro-step per call.
- **engine.worker.cjs:** Handles `aiTakeTurn`.
- **CombatPage:** `runAITurnFromWorker(actor)` calls `aiTakeTurn`, applies returned events (e.g. via executeAIAttack/executeAIMove), then `onEndTurnFull` when the worker says to end turn.

---

## Patch 10: Worker Attack Resolution

- **`src/engine/resolveAttack.cjs`:** `rollDie`, `rollDiceFormula`; `resolveAttack(payload)` does d20 + toHit vs guardRating, damage roll, crit mult, optional `state.hpById` and `ammo`; returns `{ events, delta }` (e.g. ATTACK_ROLL, DAMAGE, CRIT, MISS, HP_CHANGED, AMMO_SPENT).
- **engine.worker.cjs:** Handles `resolveAttack`.
- **CombatPage:** `eventToLogLine` extended for ATTACK_ROLL, DAMAGE, AMMO_SPENT, HP_CHANGED, MISS, CRIT; `applyAttackDelta(delta)` updates HP and optionally ammo when a setter exists; `executeAIAttack` (when worker available) calls `resolveAttack` and applies delta/logs events.

---

## Patch 11: Action Consumption and Turn End in Worker

- **resolveAttack.cjs:** Reads `attack.remainingActions`, decrements by 1, emits `ATTACKS_CONSUMED` and (when next is 0) `TURN_SHOULD_END`; delta includes `remainingActionsById`.
- **CombatPage:** `applyAttackDelta` applies `delta.remainingActionsById` to fighters; `executeAIAttack` sends `remainingActions` and, when events include `TURN_SHOULD_END`, calls `onEndTurnFull(attackerId)`.
- **Logging:** `eventToLogLine` handles ATTACKS_CONSUMED and TURN_SHOULD_END.

---

## Patch 12: One Worker Call per AI Action (aiExecuteStep)

- **`src/engine/aiExecuteStep.cjs`:** One shot: calls `aiSelectAction`; if ATTACK, runs `resolveAttack` in-worker and merges events/delta; if MOVE, returns step for UI pathing; always consumes actions and may emit `TURN_SHOULD_END`; returns `{ step, events, delta }` with `delta.fightersLite` and optional `delta.ammoDelta`.
- **engine.worker.cjs:** Handles `aiExecuteStep`.
- **CombatPage:** `runAITurnFromWorker` calls only `aiExecuteStep` (no separate aiTakeTurn/aiSelectAction); applies `delta.fightersLite` (HP, remainingActions) and `delta.ammoDelta`; logs events; runs `executeAIMove` when `step.kind === "MOVE"`; calls `onEndTurnFull` when `TURN_SHOULD_END` is present. Ammo overrides merged via `ammoOverrides` state.

---

## Patch 13: Real Profiles (attackProfilesById)

- **CombatPage:** `pickEquistaminadWeapon(f)`, `buildAttackProfilesById(fightersArr)` using `getWeaponDamage`, `isTwoHandedWeapon`, and base attack/guardRating; builds `{ baseAttackBonus, damageFormula, ammoType, rangedRange, preferredRange, baseGuardRating }` per id; passes `attackProfilesById` in `aiExecuteStep` state.
- **aiExecuteStep.cjs:** Uses `attackProfilesById[actorId]` / `[targetId]` for `toHitBonus`, `targetGuardRating`, `damageFormula`, `ammoType` when resolving ATTACK.

---

## Patch 14A: UI Override (attackOverrideByKey)

- **aiExecuteStep.cjs:** Reads `state.attackOverrideByKey`; in ATTACK branch, `overrideKey = \`${actorId}::${targetId}::${attackMode}\``; uses `override?.toHitBonus ?? profile`, same for `targetGuardRating`, `damageFormula`, `ammoType`, `critOn`, `critMult`.
- **CombatPage:** (Previously) called `aiSelectAction` to get intent, then built `attackOverrideByKey` from that and passed it into `aiExecuteStep`.

---

## Patch 15: Exact Override (computeAttackOverride)

- **CombatPage:** `computeAttackOverride(attacker, defender, attackMode)` uses: `getCoverBonus` for defender guardRating, `getWeaponDamage`/`pickEquistaminadWeapon` for damage/ammo, `getCombatBonus(attacker, "attack", attackSnapshot)` + `tempModifiers` for toHit, `applyLightingEffects` for lighting penalty.
- **Override flow:** When building override for ATTACK, uses `computeAttackOverride` instead of ad-hoc bonus/guardRating math so worker gets the same numbers as the rest of CombatPage.

---

## Patch 16: REQUEST_ATTACK_OVERRIDE Handshake

- **aiExecuteStep.cjs:** In the ATTACK branch, if there is no override for `overrideKey`, returns immediately with `events: [{ type: "REQUEST_ATTACK_OVERRIDE", actorId, targetId, attackMode, reason }]`, `delta: {}`, and step kind ATTACK. No resolveAttack is run until an override is provided.
- **CombatPage:** `runAITurnFromWorker` calls `aiExecuteStep` once with `attackOverrideByKey: null`. If the returned `events` contain `REQUEST_ATTACK_OVERRIDE`, it calls `computeAttackOverride(attacker, defender, e.attackMode)`, then calls `aiExecuteStep` again with `attackOverrideByKey: { [key]: override }`, and replaces `events`/`delta`/`step` with that second result. Then it continues as before (apply delta, log, MOVE, end turn).
- **Effect:** No separate â€œintent onlyâ€ worker call; one logical AI step, with an optional second call only when the worker explicitly asks for an override.

---

## Architecture After All Patches

| Layer | Responsibility |
|-------|-----------------|
| **Worker** | Turn advancement (`resolveTurn`, `advanceUntilPlayer`); AI intent (`aiSelectAction`); full step raiderhestration and attack resolution (`aiExecuteStep` â†’ `resolveAttack`); action use and turn-end signals. |
| **UI** | Builds lite snapshots (`fightersLite`, `positionsLite`, `attackProfilesById`); responds to `REQUEST_ATTACK_OVERRIDE` with `computeAttackOverride`; applies deltas (HP, remainingActions, ammo); runs movement/pathing; logs; calls `onEndTurnFull` when worker says to. |
| **Seam** | Override key `\`${actorId}::${targetId}::${attackMode}\``. For a future 14B, move `computeAttackOverride` into worker modules and drop `REQUEST_ATTACK_OVERRIDE`; UI can stay otherwise unchanged. |


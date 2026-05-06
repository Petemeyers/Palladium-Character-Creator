# Upgrade Priorities

This is a practical order of operations for improving the game without taking on unnecessary migration risk too early.

---

## Priority 1: Stability and obvious unfinished gameplay

These are the highest-value fixes because they affect core play loops or leave visible features incomplete.

### 1. Finish combat rewards and loot follow-through

- Persist combat XP instead of only logging it
- Add looted items to player or party inventory
- Verify loot removal and inventory updates stay in sync

Why first:
- Players immediately feel this
- The UI already exposes these flows
- The remaining work is mostly completion, not invention

### 2. Finish visibility and stealth correctness

- Replace hardcoded `hasInfravision: false`
- Replace hardcoded `isProwling: false`
- Implement real sound detection rolls in `TacticalMap.jsx`

Why first:
- This changes combat outcomes
- It removes hidden rules inaccuracies
- It improves both AI and player fairness

### 3. Wire missing clerical and special combat abilities

- Add clerical ability submenu and execution handlers
- Implement missing Baal-Rog abilities: animate/control dead, turn dead, exorcism, remove curse
- Finish animated undead fighter creation from results

Why first:
- The repo already has docs describing the missing behavior
- The data and partial systems already exist
- This unlocks more monsters and encounter variety

---

## Priority 2: Complete backend features already represented in UI or docs

These routes and systems exist conceptually but still have stubbed server logic.

### 4. Replace stub backend routes that are likely to matter soon

Best candidates:
- `backend/routes/loot.js`
- `backend/routes/quest.js`
- `backend/routes/npc.js`
- `backend/routes/npcMemory.js`
- `backend/routes/combatLog.js`
- `backend/routes/rest.js`

Lower urgency unless actively used:
- `armorRoutes.js`
- `merchant.js`
- `skillRoutes.js`
- `openai.js`

Why now:
- It prevents frontend features from drifting away from backend reality
- It reduces future rework if persistence becomes more important

### 5. Clean up shop and inventory data sources

- Replace the placeholder weapon source note in `shopController.js`
- Normalize how weapons, armor, and consumables are represented across combat, loot, and inventory

Why now:
- Inventory data consistency affects many systems
- It will reduce special-case code later

---

## Priority 3: Engine correctness and system consolidation

These are important, but best done after the most visible gaps are closed.

### 6. Consolidate legacy compatibility fields

Examples:
- `weapon` vs `equippedWeapon`
- legacy ammo-manager call signatures
- legacy status/effect sync fields
- legacy tactical map fallbacks

Goal:
- Pick canonical shapes
- keep migration shims temporarily
- gradually remove duplicate representations

Why here:
- Doing this too early can break active work
- Doing it later, after feature completion, is safer

### 7. Finish shared utility systems that are still partial

- `positionManager.js`
- `updateActiveEffects.js`
- `unifiedAbilities.js`
- `combatEngine.js` defensive reaction / spell / psionic hooks
- `movementRangeSystem.js`
- `protectionCircleSystem.js`

Why here:
- These are foundational
- They matter most once feature wiring is stable

### 8. Improve pathfinding and engine movement rules

- Replace simple axial stepping where appropriate
- finish movement/pathfinding integration in combat flows
- expose altitude changes through UI instead of fixed increments

Why here:
- This has broad gameplay impact
- It is easier to reason about after combat rules are more complete

---

## Priority 4: AI and GM improvements

These can add a lot of value, but they are less urgent than core correctness.

### 9. Improve enemy AI ability usage

- Teach AI when to use clerical abilities
- Improve handling of special monster abilities
- refine tactical use of movement, altitude, and reactions

### 10. Finish RAG / GM retrieval features

- Implement embeddings in `backend/server/rag/embed.js`
- Implement vector retrieval in `backend/server/rag/retriever.js`
- validate cost/performance tradeoffs before production use

Why later:
- Nice leverage, but not essential for the main combat/inventory loop

---

## Priority 5: Dependency upgrades

Split these into two tracks.

### Safe upgrade batch

Take patch/minor upgrades first:

- `axios`
- `cors`
- `dotenv`
- `helmet`
- `jsonwebtoken`
- `morgan`
- `nodemon`
- `socket.io`
- `socket.io-client`
- `wait-on`
- `eslint` and related lint packages

Why first:
- Lower migration risk
- May remove transitive deprecated packages
- Good hygiene before larger framework work

### Major upgrade projects

Treat each of these as its own mini-project with testing:

- `react` 18 -> 19
- `react-dom` 18 -> 19
- `react-router-dom` 6 -> 7
- `vite` 6 -> 8
- `@vitejs/plugin-react` 4 -> 6
- `express` 4 -> 5
- `mongoose` 7/8 -> 9
- `mongodb` 6 -> 7
- `openai` 4 -> 6
- `three` 0.171 -> 0.183
- `@chakra-ui/react` 2 -> 3
- `@mui/icons-material` 6 -> 7
- `electron` 40 -> 41

Suggested order:
1. Tooling and low-risk libraries
2. Server/data libraries
3. Frontend framework/runtime
4. UI frameworks
5. Electron

---

## Best first sprint

If you want the best payoff with limited risk, do this first:

1. Persist XP
2. Add loot-to-inventory
3. Implement infravision / prowling / sound detection
4. Finish clerical ability wiring
5. Upgrade safe patch/minor dependencies

That gives visible gameplay improvement, better correctness, and some maintenance value without forcing a large migration.

---

## Separate mini-projects

These deserve isolated branches and focused testing:

- React 19 migration
- Vite 8 migration
- Express 5 migration
- Mongoose 9 migration
- RAG implementation
- legacy field cleanup across combat/inventory/AI

---

## Recommendation

Do not start with a big framework migration.

Start with:
- gameplay completion
- inventory/reward correctness
- safe dependency hygiene

Then take on the larger architectural and dependency projects one at a time.

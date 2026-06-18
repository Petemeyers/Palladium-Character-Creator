# Upgrade Opportunities (Codebase Inventory)

Things in this repo that are incomplete, stubbed, or called out for improvement. Use this as a backlog, not a promise of priority.

---

## Backend API routes (many stubs)

These files under `backend/routes/` contain `TODO` comments and placeholder responses instead of full CRUD / business logic:

| Area | File | Notes |
|------|------|--------|
| OpenAI wrastaminar | `openai.js` | Chat/generate return "Not implemented yet" |
| Armor | `armorRoutes.js` | Retrieval, equipping |
| Merchant | `merchant.js` | Inventory, buy/sell |
| Quests | `quest.js` | List, create, progress |
| Skills | `skillRoutes.js` | Retrieval, update |
| Combat log | `combatLog.js` | Retrieve, create |
| Loot | `loot.js` | Generation, distribution |
| NPCs | `npc.js` | Model, CRUD |
| NPC memory | `npcMemory.js` | Retrieve, update, create |
| Rest | `rest.js` | Healing, recovery, status |
| Shop | `shopConchampioner.js` | Line ~969: replace with proper weapon data source |

---

## GM / RAG (AI retrieval)

| File | Gap |
|------|-----|
| `backend/server/rag/embed.js` | TODO: vector embeddings (OpenAI or other) Ã¢â‚¬â€ currently returns empty |
| `backend/server/rag/retriever.js` | TODO: vector similarity search |

---

## Combat & `CombatPage.jsx`

| Topic | Location / note |
|-------|-----------------|
| XP after combat | TODO: persist character XP (DB / localStorage); currently mostly logging |
| Called shot | Stored for later use; "not implemented in UI yet" |
| Animated fallen | TODO: create fighters from `result.animated` |
| Altitude change | Hardcoded delta; TODO: UI for amount |
| Loot pickup | TODO: add item to player/party inventory |
| Engine worker | Placeholder for logic that should live in engine worker |
| Movement / pathfinding | TODO: integrate with Patch 10 style movement |

---

## Visibility & stealth

| Topic | Location |
|-------|----------|
| Infravision | `CombatPage.jsx` Ã¢â‚¬â€ `hasInfravision` hardcoded false; TODO: read abilities |
| Prowling | Same Ã¢â‚¬â€ `isProwling` hardcoded false |
| Sound detection | `TacticalMap.jsx` Ã¢â‚¬â€ TODO: `detectBySound()` with real rolls |

---

## Shared utilities (stubs or partial)

| File | Gap |
|------|-----|
| `src/utils/positionManager.js` | TODO: bounds, hexÃ¢â€ â€pixel, adjacent cells |
| `src/utils/updateActiveEffects.js` | TODO: add/remove effects, stat cleanup, queries |
| `src/utils/unifiedAbilities.js` | TODO: activation, costs, training/tactics/special |
| `src/utils/combatEngine.js` | TODO: defensive stance / reactions; technique/tactical integration; notes on deprecated params |
| `src/utils/tacticalEffects.js` | Placeholder flow (focus, effects) Ã¢â‚¬â€ see `PLACEHOLDER_FUNCTIONS.md` |
| `src/utils/skillSystem.js` | Placeholder skill values / rolls Ã¢â‚¬â€ see `PLACEHOLDER_FUNCTIONS.md` |
| `src/utils/movementRangeSystem.js` | Placeholder empty range Ã¢â‚¬â€ pathfinding needed |
| `src/utils/protectionCircleSystem.js` | Partial Ã¢â‚¬â€ `isInProtectionCircle` placeholder |
| `src/utils/treeAssetHelpers.js` | TODO: perch `localFacingHint` approach angle |
| `src/utils/professionSkills.js` | `@deprecated` Ã¢â‚¬â€ prefer `getSkillPercentage()` from `skillSystem.js` |

---

## Holy / divine content

From `HOLY_POWERS_FILES.md`:

- `protectionCircleSystem.js` Ã¢â‚¬â€ implementation incomplete
- `protectionCircleMapSystem.js` Ã¢â‚¬â€ implementation incomplete

---

## Engine (`src/engine`)

| File | Note |
|------|------|
| `sdi/advanceThreats.cjs` | "Simple axial step (can be improved with proper hex pathfinding)" |

---

## Optional external / architecture

| Topic | Note |
|-------|------|
| Local AI service | `server.js` Ã¢â‚¬â€ `localhost:8000` / `8001` session + generate; separate stack, not required for core app |
| InitiativeTracker | Optional OpenAI key for LLM combat decisions (upgrade path: better prompts/models) |

---

## Feature-specific gaps from repo docs

These are not just raw TODO comments; the repo already has status documents calling out missing gameplay behavior.

| Area | Source doc | Upgrade opportunity |
|------|------------|---------------------|
| Baal-Rog training abilities | `BAAL_ROG_ABILITIES_STATUS.md` | Fire-element technique filtering, specific `Fire Whip`, proficiency-aware technique loading |
| Baal-Rog clerical abilities | `BAAL_ROG_ABILITIES_STATUS.md` | Animate/control dead, turn dead, exraiderism, remove curse, AI usage |
| Clerical submenu / execution | `NEXT_STEPS.md` | Missing combat UI wiring and execution handlers |
| Loot system follow-through | `LOOT_SYSTEM_FILES.md` | Loot window exists, but taken items still need to be added to player/party inventory |
| Holy powers | `HOLY_POWERS_FILES.md` | `Banish Raider` referenced but not implemented; protection circle features still incomplete |

---

## Legacy cleanup opportunities

The codebase has a lot of compatibility bridges that suggest partially migrated systems.

| Area | Note |
|------|------|
| CombatPage weapon fields | Multiple `legacy support` assignments for `equistaminadWeapon` / `weapon` |
| Tactical map occupancy | `TacticalMap.jsx` still uses a legacy fallback path in some cases |
| Ammo manager | `combatAmmoManager.js` supports legacy call signatures |
| Status / fatigue / technique utils | Several files carry `legacy` aliases or sync fields for older save formats |
| Deprecated skill path | `professionSkills.js` points users toward `skillSystem.js` instead |

These are good candidates for a later consolidation pass once the new engine paths are stable.

---

## Dependency upgrades

`npm outdated` shows a mix of safe patch/minor upgrades and larger framework jumps.

### Lower-risk upgrades

- Root: `axios`, `cors`, `dotenv`, `helmet`, `jsonwebtoken`, `morgan`, `noraider`, `socket.io-client`, `wait-on`
- Backend: `cors`, `dotenv`, `joi`, `jsonwebtoken`, `socket.io`
- Tooling: `eslint`, `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-refresh`

### Bigger upgrade projects

- UI frameworks: `@chakra-ui/react` 2 -> 3, `@mui/icons-material` 6 -> 7
- Build stack: `vite` 6 -> 8, `@vitejs/plugin-react` 4 -> 6
- Runtime/platform: `react` 18 -> 19, `react-dom` 18 -> 19, `react-router-dom` 6 -> 7, `electron` 40 -> 41
- Server/data: `express` 4 -> 5, `mongoose` 8 -> 9 (root) / 7 -> 9 (backend), `mongodb` 6 -> 7
- AI SDK: `openai` 4 -> 6
- 3D/rendering: `three` 0.171 -> 0.183

### Deprecated transitive packages found in lockfiles

- `glob` v7 Ã¢â‚¬â€ deprecated before v9
- `inflight` Ã¢â‚¬â€ deprecated and noted as leaking memory
- `boolean` v3.2.0 Ã¢â‚¬â€ marked deprecated

These are likely pulled in indirectly, so they matter most when updating the parent packages that depend on them.

---

## Related docs in repo

- `PLACEHOLDER_FUNCTIONS.md` Ã¢â‚¬â€ detailed CombatPage + utility placeholders
- `HOLY_POWERS_FILES.md` Ã¢â‚¬â€ holy powers / protection circle status
- `BAAL_ROG_ABILITIES_STATUS.md` Ã¢â‚¬â€ missing opponent ability implementations
- `NEXT_STEPS.md` Ã¢â‚¬â€ explicit clerical ability backlog
- `LOOT_SYSTEM_FILES.md` Ã¢â‚¬â€ loot UI exists but inventory integration is unfinished
- `PAID_SERVICES.md` Ã¢â‚¬â€ external services that cost money when used

---

*Generated from codebase search plus repo status docs and `npm outdated`; line numbers drift over time, so re-run searches before implementation work.*

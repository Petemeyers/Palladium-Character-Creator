# Legacy Alignment and Behavior Audit

> Historical compatibility record: the named legacy alignment labels below are
> retained only to document old-save migration and compatibility lookup. Phase
> 3B3B now uses the standard nine-alignment grid for canonical actors, new saves,
> combat UI, logs, and surrender decisions.

Phase 3C0 searched the repository for alignment labels and for mercy, honor, cruelty, surrender, prisoner, execution, ransom, confiscation, looting, disposition, and morale decisions. Legacy behavior is retained; this audit does not delete or activate prisoner-economy code.

## Relevant files found

| File | Existing material | Phase 3C0 disposition |
|---|---|---|
| `src/data/publicAlignment.js` | Modern nine-label public character-creation list. | Map as aliases; keep as the public UI vocabulary. |
| `src/components/BulkCharacterGenerator.jsx` | Historically generated the seven legacy labels. | Migrated to canonical nine-grid keys in Phase 3B3B. |
| `src/components/data.jsx` | Short legacy alignment option list. | Compatibility-only; later consolidate with public alignment data. |
| `src/data/preCombatSystem.json` | All seven legacy labels; numeric surprise/hostility modifiers and encounter presets. | Preserve encounter math; do not reuse those modifiers as surrender probabilities. |
| `src/utils/stealthSystem.js` | Alignment-indexed pre-combat and hostility tendencies. | Keep current stealth behavior; later consume normalized `alignmentKey`. |
| `src/utils/moraleSystem.js` | Species surrender eligibility plus incomplete alignment lookup and broad good/selfish/evil aliases. | Migrate lookup to normalized behavior dimensions later; preserve morale formulas now. |
| `src/data/combatantBehavior.json` | Species/default-humanoid surrender flags and disposition morale modifiers; no actual alignment table despite `moraleSystem` expecting one. | Retain compatibility defaults; missing alignment table is obsolete/incomplete. |
| `src/utils/fearAIAutoCast.js` | Hard-coded label families affecting fear-action selection. | Later replace label parsing with behavior dimensions; do not alter current weights now. |
| `src/utils/tacticalDecisionHelpers.js` | Good-label tactical preference and alignment documentation. | Later read normalized honor/mercy; keep compatibility parsing. |
| `src/utils/ai/playerTurnAI.js` | Multiple good/evil label checks, including dying-target and healing decisions; commented category lists. | Preserve behavior; migrate incrementally after weighted-decision review. |
| `src/utils/ai/enemyTurnAI.js` | Historically contained direct legacy-label checks. | Migrated to normalized alignment axes in Phase 3B3B. |
| `src/pages/CombatPage.jsx` | Historically generated and displayed legacy alignments. | Migrated to canonical keys and nine-grid display names in Phase 3B3B; faction aggression remains separate. |
| `src/utils/combat/surrenderState.js` | Current weighted surrender response/treatment foundation. | Modern destination for behavior dimensions; no inventory/ransom execution in Phase 3C0. |
| `src/utils/captureSystem.js` | Capture/tie-up and immediate prisoner-looting helpers. | Keep dormant/compatibility-only. Do not call from new surrender resolution until inventory ownership is authoritative. |
| `src/utils/scavengingSystem.js` | Loot/scavenging behavior outside canonical surrender treatment. | Keep separate pending inventory migration. |
| `src/utils/factionDisposition.js` | Hostility, faction, and `diabolic` aggression rules. | Preserve; alignment must not replace side/faction authority. |
| `src/components/CharacterCreator.jsx` | Saves public alignment and independent disposition/hostility fields. | Preserve all three fields; normalize alignment at combat adaptation. |
| `src/components/CharacterSheet.jsx` and `src/utils/actorSheetDisplay.js` | Explicit “Legacy Alignment” display. | Keep as compatibility presentation. |
| `src/utils/characterSave.js`, `backend/models/Character.js`, `backend/controllers/characterController.js` | Persist alignment/disposition with legacy saved actors. | Preserve storage compatibility. |
| `game.md` | Declares alignment legacy metadata and defines modern attributes/traits including Merciful and Dread Name. | Treat as design authority: alignment influences behavior but is not an absolute command. |
| `scripts/test-game-md-alignment-attributes-audit.mjs` and `scripts/test-character-sheet-legacy-alignment-label.mjs` | Protect legacy labeling and migration intent. | Keep passing. |

Repository documentation and archived planning files (`README.md`, `REFACTORING_PLAN.md`, `REFACTORING_STRUCTURE.md`, `UPGRADE_*`, `NEXT_STEPS.md`, `LOOT_SYSTEM_FILES.md`, `ENEMY_WEAPON_ASSIGNMENT.md`) contain descriptive mentions but no authoritative alignment decision implementation.

## Alignment names found

- Legacy simulator labels: Principled, Scrupulous, Unprincipled, Anarchist, Miscreant, Aberrant, Diabolic.
- Broad legacy categories: Good, Selfish, Neutral, Evil.
- Public labels: Lawful/Neutral/Chaotic Good, Lawful/True/Chaotic Neutral, and Lawful/Neutral/Chaotic Evil.

## Existing rules and obsolete assumptions

- Several AI paths reduce alignment to “good” or “evil”. This is useful compatibility behavior but too absolute for prisoner decisions.
- `moraleSystem` attempts to load `combatantBehavior.json.alignment`; that table does not exist. Its default fallback masks the missing implementation.
- `CombatPage` can assign a random legacy alignment based on broad actor categories. That is unsuitable as authoritative identity and should later be removed after saved/generated actor migration.
- Diabolic appears both as a personal alignment and a faction/aggression preset. Those concepts must remain separate.
- `captureSystem.lootPrisoner` immediately strips carried equipment. It must not be connected to surrender resolution before canonical inventory transfer exists.
- Species-based surrender flags are compatibility defaults, not deterministic moral behavior.

## Recommended modern mappings

`normalizeAlignmentBehavior.js` maps labels deterministically into bounded dimensions and weighted preferences. Initial directions are:

- Principled: very high honor/mercy/discipline; strong acceptance and prisoner preference; minimal execution preference.
- Scrupulous: high honor/mercy; favors acceptance, prisoners, and situational ransom; avoids execution.
- Unprincipled: pragmatic and self-interested; ransom/confiscation weighted above execution.
- Anarchist: independent opportunist; mixed mercy and discipline; circumstance-sensitive surrender response.
- Miscreant: greedy and cruel; confiscation/ransom/execution weights rise without becoming mandatory.
- Aberrant: disciplined and ruthless; prisoner or execution decisions depend on orders and circumstances.
- Diabolic: extreme cruelty and execution preference, still represented as weights rather than an unconditional command.
- Public nine-label alignments map to the nearest legacy behavior profile as compatibility aliases.

## Migration recommendations

Migrate next:

1. `moraleSystem.getSurrenderProfile` to consume normalized behavior while preserving its DC formula.
2. Player/enemy AI label checks to behavior dimensions in isolated, test-backed patches.
3. Generated actor alignment assignment to explicit profile keys.
4. Capture, confiscation, ransom, release, and execution only after inventory/world-state ownership is canonical.

Keep compatibility-only for now:

- saved string alignment fields and Character Sheet legacy display;
- pre-combat alignment modifiers;
- existing AI label checks;
- `captureSystem` prisoner inventory helpers.

Remove later, after migration:

- duplicate alignment option arrays;
- random broad-category alignment assignment;
- missing-table fallback assumptions in `moraleSystem`;
- direct “evil means attack/execute” checks where weighted behavior is required.

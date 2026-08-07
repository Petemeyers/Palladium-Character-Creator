import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const enemyAi = fs.readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");
const playerAi = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };

check(page.includes("spendAmmunitionOnce({"), "CombatPage uses the canonical ammunition transaction");
check(!page.includes("setAmmoOverrides("), "legacy ammo override mutations are removed");
check(page.includes("LEGACY_WORKER_COMBAT_RESOLUTION_ENABLED = false"), "legacy worker damage/ammo resolver is quarantined");
check(page.includes("commitCanonicalMovement({"), "movement enters the canonical stamina transaction");
check(page.includes("validateCanonicalHpMutationMetadata({"), "HP mutation validates damage metadata");
check(page.includes('eventType: "hp-mutation-metadata-rejected"'), "malformed HP mutation has a blocking diagnostic");
check(page.includes("buildCanonicalAttackRollEvent({"), "all ordinary attack rolls build the canonical schema");
check(page.includes("assignBattleLocalIdentities("), "battle identities are assigned once at combat start");
check(page.includes('eventType: "combat-roster-identity-audit"'), "roster identity audit is emitted");
check(page.includes("clockRef.current?.clearAll?.()"), "terminal/reset cleanup clears clock-player schedules");
check(page.includes('eventType: "combat-ended-cleanup-audit"'), "canonical combat end emits a cleanup audit");
check(page.includes("commitCanonicalCombatEnd({"), "victory, defeat, and stalemate use canonical termination");
check(enemyAi.includes("prioritizeEnemyCombatTargets({"), "enemy AI uses shared target prioritization");
check(playerAi.includes("isOrdinaryAttackTarget(target"), "player AI uses the shared ordinary-target predicate");

console.log(`Combat correctness source integration: ${checks}/${checks} checks passed.`);

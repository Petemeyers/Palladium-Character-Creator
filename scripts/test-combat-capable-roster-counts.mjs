import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /const isCombatCapableFighter = useCallback\(\(fighter\) => \{/);
assert.match(source, /isCombatantFled\(fighter\) \|\| isCombatantBroken\(fighter\)/);
assert.match(source, /\["routed", "broken", "fled", "surrendered", "captured"\]\.includes\(moraleState\)/);
assert.match(source, /return canFighterAct\(fighter\)/);
assert.match(source, /const getCombatCapableRosterCount = useCallback\(\(roster = \[\]\) => \{/);
assert.match(source, /active: .*isCombatCapableFighter/s);

assert.match(source, /const partyRoster = useMemo\(\(\) => fighters\.filter\(\(f\) => f\.type === "player"\)/);
assert.match(source, /const opponentRoster = useMemo\(\(\) => fighters\.filter\(\(f\) => f\.type === "enemy"\)/);
assert.match(source, /const partyRosterCount = useMemo\(\(\) => getCombatCapableRosterCount\(partyRoster\)/);
assert.match(source, /const opponentRosterCount = useMemo\(\(\) => getCombatCapableRosterCount\(opponentRoster\)/);

assert.match(source, /Party Members \(\{partyRosterCount\.active\}\/\{partyRosterCount\.total\} active\)/);
assert.match(source, /Opponents \(\{opponentRosterCount\.active\}\/\{opponentRosterCount\.total\} active\)/);
assert.match(source, /const combatCapable = isCombatCapableFighter\(fighter\)/);
assert.match(source, /const inactiveLabel = combatCapable \? "" : getCombatInactiveLabel\(fighter\)/);
assert.match(source, /opacity=\{combatCapable \? 1 : 0\.62\}/);
assert.match(source, /filter=\{combatCapable \? "none" : "grayscale\(35%\)"\}/);
assert.match(source, /!\s*combatCapable && inactiveLabel && <Badge colorScheme="gray" size="md">\{inactiveLabel\}<\/Badge>/);

assert.doesNotMatch(source, /Party Members \(\{alivePlayers\.length\}\/\{fighters\.filter\(f => f\.type === "player"\)\.length\}\)/);
assert.doesNotMatch(source, /Opponents \(\{aliveEnemies\.length\}\/\{totalEnemyCount\}\)/);

console.log("combat-capable roster count tests passed");

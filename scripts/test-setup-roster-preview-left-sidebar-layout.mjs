import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /size=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? "full" : "lg"\}/);
assert.match(source, /w=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? \{ base: "calc\(100vw - 16px\)", md: "min\(96vw, 1500px\)" \} : undefined\}/);
assert.match(source, /maxW=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? "calc\(100vw - 24px\)" : undefined\}/);
assert.match(source, /h=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? \{ base: "calc\(100vh - 16px\)", md: "min\(94vh, 1050px\)" \} : undefined\}/);
assert.match(source, /maxH=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? "calc\(100vh - 20px\)" : undefined\}/);
assert.match(source, /boxSizing="border-box"[\s\S]*display="flex"[\s\S]*flexDirection="column"[\s\S]*overflow="hidden"/);
assert.match(source, /<ModalBody[\s\S]*flex=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? "1" : undefined\}[\s\S]*minH=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? 0 : undefined\}[\s\S]*overflowY=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? "auto" : undefined\}[\s\S]*overflowX=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? "hidden" : undefined\}/);
assert.match(source, /<ModalFooter[\s\S]*flexShrink=\{0\}[\s\S]*position=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? "sticky" : undefined\}[\s\S]*bottom=\{preBattleStep === PRE_BATTLE_STEPS\.ROSTER \? 0 : undefined\}/);

assert.match(source, /base: "minmax\(0, 1fr\)"/);
assert.match(source, /md: "minmax\(320px, 380px\) minmax\(280px, 1fr\)"/);
assert.match(source, /xl: "minmax\(320px, 380px\) minmax\(280px, 1fr\) minmax\(280px, 1fr\)"/);
assert.match(source, /base: `"preview" "players" "opponents" "scene" "armies"`/);
assert.match(source, /md: `"preview players" "preview opponents" "scene scene" "armies armies"`/);
assert.match(source, /xl: `"preview players opponents" "preview scene scene" "armies armies armies"`/);
assert.match(source, /<GridItem gridArea="preview" minW=\{0\} maxW="100%">/);
assert.match(source, /<GridItem gridArea="players" minW=\{0\} maxW="100%">/);
assert.match(source, /<GridItem gridArea="opponents" minW=\{0\} maxW="100%">/);
assert.match(source, /<GridItem gridArea="scene" minW=\{0\} maxW="100%">/);
assert.match(source, /<GridItem gridArea="armies" minW=\{0\} maxW="100%">/);
assert.doesNotMatch(source, /gridArea="rosters"/);
assert.match(source, /position=\{\{ base: "static", xl: "sticky" \}\}/);
assert.match(source, /overflowX="hidden"/);
assert.match(source, /flexWrap="wrap"/);
assert.match(source, /renderRemoveFighterButton\(fighter\)/);

console.log("setup roster responsive modal layout tests passed");

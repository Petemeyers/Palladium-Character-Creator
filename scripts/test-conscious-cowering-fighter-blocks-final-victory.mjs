import assert from "node:assert/strict";
import { isPendingSurrenderResolution, offerRoutedExhaustedCowerSurrender, shouldDeferCombatEndForSurrender } from "../src/utils/combat/surrenderState.js";

const offered = offerRoutedExhaustedCowerSurrender({ id: "enemy", currentHP: 3, conscious: true, moraleState: { status: "ROUTED" } });
assert.equal(isPendingSurrenderResolution(offered), true);
assert.equal(shouldDeferCombatEndForSurrender({ pendingSurrenders: [offered], resistingFighters: [], victors: [{ id: "knight" }] }), true);
assert.equal(shouldDeferCombatEndForSurrender({ pendingSurrenders: [], resistingFighters: [], victors: [{ id: "knight" }] }), false);
console.log("conscious cowering fighter blocks final victory test passed");

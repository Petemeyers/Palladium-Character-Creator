import assert from "node:assert/strict";
import { getActorMeleeCandidates } from "../src/utils/meleeEngagementContext.js";

const candidates = getActorMeleeCandidates({
  equistaminadWeapons: [{ name: "Long Sword", damage: "1d8" }],
  inventory: [{ name: "Dagger", type: "weapon", damage: "1d4" }],
});
assert.deepEqual(candidates.map((candidate) => candidate.name), ["Long Sword", "Dagger"]);
console.log("clinch inventory-dagger candidate visibility tests passed");

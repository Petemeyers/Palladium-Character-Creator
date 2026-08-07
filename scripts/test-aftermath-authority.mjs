import assert from "node:assert/strict";
import {
  advanceAftermathDay,
  applyAftermathAction,
  createAftermathEncounter,
  createEmptyAftermathCampaign,
  getCurrentAftermathEncounter,
  summarizeAftermathEncounter,
  upsertAftermathEncounter,
} from "../src/utils/aftermath/aftermathAuthority.js";

const fighters = [
  {
    id: "ally-1",
    name: "Wounded Ally",
    team: "party",
    type: "player",
    currentHP: -2,
    maxHP: 20,
    condition: "unconsciousBleeding",
    unconscious: true,
    bleeding: { active: true, stabilized: false },
    wounds: [{
      id: "thigh-wound",
      mechanism: "puncture",
      damageType: "piercing",
      bodyRegion: "left thigh",
      severity: "critical",
      bleeding: true,
      contamination: 60,
      fracture: { present: true, type: "open", displaced: true },
    }],
    equipment: [{ id: "sword", name: "Sword", type: "weapon" }],
  },
  {
    id: "enemy-1",
    name: "Enemy Captive",
    team: "enemy",
    type: "enemy",
    currentHP: 3,
    maxHP: 14,
    condition: "conscious",
    bleeding: { active: false, stabilized: false },
    equipment: [{ id: "spear", name: "Spear", type: "weapon" }],
  },
  {
    id: "enemy-dead",
    name: "Fallen Enemy",
    team: "enemy",
    type: "enemy",
    currentHP: -25,
    maxHP: 14,
    condition: "dead",
    dead: true,
  },
];

const positions = {
  "ally-1": { x: 12, y: 8 },
  "enemy-1": { x: 13, y: 8 },
  "enemy-dead": { x: 15, y: 9 },
};

let encounter = createAftermathEncounter({ fighters, positions, result: "victory", endedAt: 1000 });
assert.equal(encounter.positions["ally-1"].x, 12, "final battlefield position should be preserved");
assert.equal(encounter.casualties.length, 3);

const ally = encounter.casualties.find((casualty) => casualty.actorId === "ally-1");
assert.equal(ally.triage, "immediate");
assert.equal(ally.activeBleeding, true);
assert.equal(ally.wounds[0].fracture.present, true);

let resolution = applyAftermathAction(encounter, { casualtyId: ally.casualtyId, action: "assess" });
assert.equal(resolution.accepted, true);
encounter = resolution.encounter;
resolution = applyAftermathAction(encounter, { casualtyId: ally.casualtyId, action: "stop-bleeding" });
assert.equal(resolution.accepted, true);
encounter = resolution.encounter;
assert.equal(resolution.casualty.activeBleeding, false);
resolution = applyAftermathAction(encounter, { casualtyId: ally.casualtyId, action: "splint" });
assert.equal(resolution.accepted, true);
encounter = resolution.encounter;
assert.equal(resolution.casualty.wounds[0].fracture.splinted, true);
resolution = applyAftermathAction(encounter, { casualtyId: ally.casualtyId, action: "carry" });
assert.equal(resolution.accepted, true);
encounter = resolution.encounter;
assert.equal(resolution.casualty.currentLocation, "field-infirmary");

const captive = encounter.casualties.find((casualty) => casualty.actorId === "enemy-1");
resolution = applyAftermathAction(encounter, { casualtyId: captive.casualtyId, action: "bind-prisoner" });
assert.equal(resolution.accepted, true);
encounter = resolution.encounter;
assert.equal(resolution.casualty.prisoner.bound, true);
resolution = applyAftermathAction(encounter, { casualtyId: captive.casualtyId, action: "confiscate-equipment" });
assert.equal(resolution.accepted, true);
encounter = resolution.encounter;
assert.equal(encounter.lootLedger.some((item) => item.name === "Spear"), true);

const safeRolls = Array(100).fill(0.99);
let index = 0;
for (let day = 1; day <= 7; day += 1) {
  const dayResult = advanceAftermathDay(encounter, { random: () => safeRolls[index++] ?? 0.99 });
  assert.equal(dayResult.accepted, true);
  encounter = dayResult.encounter;
}
assert.equal(encounter.currentDay, 7);
assert.equal(encounter.phase, "first-week-complete");
const recoveredAlly = encounter.casualties.find((casualty) => casualty.actorId === "ally-1");
assert.equal(recoveredAlly.dead, false, "treated casualty should survive deterministic safe rolls");
assert.ok(["recovering", "extended-care", "returned-to-duty"].includes(recoveredAlly.recoveryStatus));

let campaign = createEmptyAftermathCampaign();
campaign = upsertAftermathEncounter(campaign, encounter);
assert.equal(getCurrentAftermathEncounter(campaign)?.encounterId, encounter.encounterId);
const summary = summarizeAftermathEncounter(encounter);
assert.equal(summary.prisoners, 1);
assert.equal(summary.untreatedBleeding, 0);

const untreatedEncounter = createAftermathEncounter({ fighters: [fighters[0]], positions, result: "defeat", endedAt: 2000 });
const untreatedDay = advanceAftermathDay(untreatedEncounter, { random: () => 0 });
assert.equal(untreatedDay.accepted, true);
assert.equal(untreatedDay.encounter.casualties[0].dead, true, "untreated critical bleeding should be able to cause delayed death");
assert.equal(untreatedDay.encounter.casualties[0].outcome, "died-from-wounds-day-1");

console.log("aftermath authority regression: passed");

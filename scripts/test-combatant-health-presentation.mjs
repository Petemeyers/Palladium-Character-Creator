import assert from "node:assert/strict";
import {
  COMBATANT_HEALTH_STATES,
  buildCombatantHealthPresentationMap,
  getCombatantHealthPresentation,
} from "../src/utils/presentation/combatantHealthPresentation.js";

const cases = [
  {
    fighter: { id: "player-healthy", type: "player", currentHP: 24, maxHP: 24 },
    state: COMBATANT_HEALTH_STATES.HEALTHY,
    color: "#2563eb",
    pulse: false,
  },
  {
    fighter: { id: "player-critical", type: "player", currentHP: 6, maxHP: 24 },
    state: COMBATANT_HEALTH_STATES.LOW_HP,
    color: "#bfdbfe",
    pulse: true,
  },
  {
    fighter: { id: "enemy-critical", type: "enemy", currentHP: 5, maxHP: 30 },
    state: COMBATANT_HEALTH_STATES.LOW_HP,
    color: "#fecaca",
    pulse: true,
  },
  {
    fighter: { id: "player-unconscious", type: "player", currentHP: 0, maxHP: 24, isUnconscious: true },
    state: COMBATANT_HEALTH_STATES.UNCONSCIOUS,
    color: "#bfdbfe",
    pulse: false,
  },
  {
    fighter: { id: "enemy-unconscious", type: "enemy", currentHP: 0, maxHP: 30, unconscious: true },
    state: COMBATANT_HEALTH_STATES.UNCONSCIOUS,
    color: "#fecaca",
    pulse: false,
  },
  {
    fighter: { id: "enemy-dead", type: "enemy", currentHP: -30, maxHP: 30, dead: true },
    state: COMBATANT_HEALTH_STATES.DEAD,
    color: "#6b7280",
    pulse: false,
  },
];

for (const testCase of cases) {
  const presentation = getCombatantHealthPresentation(testCase.fighter);
  assert.equal(presentation.state, testCase.state);
  assert.equal(presentation.pulse, testCase.pulse);
  const testedColor = presentation.state === COMBATANT_HEALTH_STATES.LOW_HP
    ? presentation.paleColor
    : presentation.fillColor;
  assert.equal(testedColor, testCase.color);
}

const presentationMap = buildCombatantHealthPresentationMap(cases.map(({ fighter }) => fighter));
assert.equal(Object.keys(presentationMap).length, cases.length);

console.log("combatant health presentation regression: passed");

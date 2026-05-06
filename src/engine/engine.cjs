// src/engine/engine.cjs
const { createCommandBus } = require("./core/commandBus.cjs");
const { makeRulesetPalladium } = require("./rulesets/ruleset.palladium.cjs");

// Commands (your existing ones)
const resolveTurn = require("./resolveTurn.cjs");
const resolveMove = require("./resolveMove.cjs");
const resolveAttack = require("./resolveAttack.cjs");
const resolveAttackImpact = require("./resolveAttackImpact.cjs");
const resolveCastSpell = require("./resolveCastSpell.cjs");
const resolveSpellImpact = require("./resolveSpellImpact.cjs");
const resolveUsePsionic = require("./resolveUsePsionic.cjs");
const resolvePsionicImpact = require("./resolvePsionicImpact.cjs");

// AI commands
const { advanceUntilHuman, advanceUntilPlayer } = require("./resolveTurn.cjs");
const { aiSelectAction } = require("./aiSelectAction.cjs");
const { aiTakeTurn } = require("./aiTakeTurn.cjs");
const aiExecuteStep = require("./aiExecuteStep.cjs");

// Choose a ruleset here (portable switch point)
const ruleset = makeRulesetPalladium();

// Register commands once
const commands = {
  resolveTurn: (payload) => resolveTurn({ ...payload, ruleset }),
  advanceUntilHuman: (payload) => advanceUntilHuman({ ...payload, ruleset }),
  advanceUntilPlayer: (payload) => advanceUntilPlayer({ ...payload, ruleset }),

  move: (payload) => resolveMove({ ...payload, ruleset }),
  resolveAttack: (payload) => resolveAttack({ ...payload, ruleset }),
  resolveAttackImpact: (payload) => resolveAttackImpact({ ...payload, ruleset }),

  castSpell: (payload) => resolveCastSpell({ ...payload, ruleset }),
  resolveSpellImpact: (payload) => resolveSpellImpact({ ...payload, ruleset }),

  usePsionic: (payload) => resolveUsePsionic({ ...payload, ruleset }),
  resolvePsionicImpact: (payload) => resolvePsionicImpact({ ...payload, ruleset }),

  aiSelectAction: (payload) => aiSelectAction(payload),
  aiTakeTurn: (payload) => aiTakeTurn(payload),
  aiExecuteStep: (payload) => aiExecuteStep({ ...payload, ruleset }),
};

// Bus (injects ruleset + future middleware if you want)
const bus = createCommandBus({ ruleset, commands });

function dispatch(method, payload) {
  // Note: this keeps your current "command returns events" contract.
  // Later you can have bus.applyEvents() and return nextState too.
  return bus.dispatch(method, payload);
}

module.exports = { dispatch, ruleset };


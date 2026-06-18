// src/engine/engine.cjs
const { createCommandBus } = require("./core/commandBus.cjs");
const { makeRulesetMcs } = require("./rulesets/ruleset.mcs.cjs");

// Commands (your existing ones)
const resolveTurn = require("./resolveTurn.cjs");
const resolveMove = require("./resolveMove.cjs");
const resolveAttack = require("./resolveAttack.cjs");
const resolveAttackImpact = require("./resolveAttackImpact.cjs");
const resolveCastTechnique = require("./resolveCastTechnique.cjs");
const resolveTechniqueImpact = require("./resolveTechniqueImpact.cjs");
const resolveUseTactic = require("./resolveUseTactic.cjs");
const resolveTacticalImpact = require("./resolveTacticalImpact.cjs");

// AI commands
const { advanceUntilHuman, advanceUntilPlayer } = require("./resolveTurn.cjs");
const { aiSelectAction } = require("./aiSelectAction.cjs");
const { aiTakeTurn } = require("./aiTakeTurn.cjs");
const aiExecuteStep = require("./aiExecuteStep.cjs");

// Choose a ruleset here (portable switch point)
const ruleset = makeRulesetMcs();

// Register commands once
const commands = {
  resolveTurn: (payload) => resolveTurn({ ...payload, ruleset }),
  advanceUntilHuman: (payload) => advanceUntilHuman({ ...payload, ruleset }),
  advanceUntilPlayer: (payload) => advanceUntilPlayer({ ...payload, ruleset }),

  move: (payload) => resolveMove({ ...payload, ruleset }),
  resolveAttack: (payload) => resolveAttack({ ...payload, ruleset }),
  resolveAttackImpact: (payload) => resolveAttackImpact({ ...payload, ruleset }),

  castTechnique: (payload) => resolveCastTechnique({ ...payload, ruleset }),
  resolveTechniqueImpact: (payload) => resolveTechniqueImpact({ ...payload, ruleset }),

  useTactical: (payload) => resolveUseTactic({ ...payload, ruleset }),
  resolveTacticalImpact: (payload) => resolveTacticalImpact({ ...payload, ruleset }),

  aiSelectAction: (payload) => aiSelectAction(payload),
  aiTakeTurn: (payload) => aiTakeTurn(payload),
  aiExecuteStep: (payload) => aiExecuteStep({ ...payload, ruleset }),
};

// Bus (injects ruleset + future middleware if you want)
const bus = createCommandBus({ ruleset, commands });

function dfocusatch(method, payload) {
  // Note: this keeps your current "command returns events" contract.
  // Later you can have bus.applyEvents() and return nextState too.
  return bus.dfocusatch(method, payload);
}

module.exports = { dfocusatch, ruleset };


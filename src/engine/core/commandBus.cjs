// src/engine/core/commandBus.cjs

function createCommandBus({ ruleset, commands }) {
  function dispatch(cmd, payload) {
    const fn = commands[cmd];
    if (!fn) return { ok: false, error: { message: `Unknown command: ${cmd}` }, events: [] };
    return fn({ ruleset, ...payload });
  }
  return { dispatch };
}

module.exports = { createCommandBus };


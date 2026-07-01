export function didPlayerAiAct(result, actionScheduled = false) {
  return actionScheduled === true ||
    result === true ||
    result?.ok === true ||
    result?.acted === true ||
    result?.actionTaken === true ||
    result?.didAct === true;
}

export function createPlayerAiActionResult(action, details = {}) {
  return {
    ...details,
    ok: true,
    acted: true,
    actionTaken: true,
    action,
    result: action,
  };
}

export function summarizePlayerAiResult(result, actionScheduled = false) {
  if (didPlayerAiAct(result, actionScheduled)) {
    const resultText = result?.result ?? result?.action ?? result?.actionType ?? result?.type ?? "acted";
    return String(resultText).toLowerCase();
  }
  if (result?.passed === true || result?.pass === true) return "pass";
  return "no-action";
}

export async function awaitPlayerAiTurnResult(execute, isActionScheduled = () => false) {
  const result = await execute();
  const actionScheduled = isActionScheduled() === true;
  return {
    result,
    actionScheduled,
    acted: didPlayerAiAct(result, actionScheduled),
    summary: summarizePlayerAiResult(result, actionScheduled),
  };
}

export default awaitPlayerAiTurnResult;

export function shouldLogTurnSchedulerClassification(previousKey, nextKey) {
  return Boolean(nextKey) && previousKey !== nextKey;
}

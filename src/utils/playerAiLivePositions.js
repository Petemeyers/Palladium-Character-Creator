export function resolvePlayerAiLivePositions(currentPositions, fallbackPositions) {
  if (
    currentPositions &&
    typeof currentPositions === "object" &&
    Object.keys(currentPositions).length > 0
  ) {
    return currentPositions;
  }
  return fallbackPositions && typeof fallbackPositions === "object"
    ? fallbackPositions
    : {};
}

export default resolvePlayerAiLivePositions;

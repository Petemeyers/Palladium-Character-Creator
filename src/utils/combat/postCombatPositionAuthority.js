const clonePosition = (position = {}) => ({
  ...position,
  x: Number(position.x),
  y: Number(position.y),
});

export const snapshotBattlefieldPositions = (positions = {}) => Object.fromEntries(
  Object.entries(positions || {})
    .filter(([, position]) => Number.isFinite(Number(position?.x)) && Number.isFinite(Number(position?.y)))
    .map(([actorId, position]) => [actorId, clonePosition(position)])
);

export const resolvePresentedBattlefieldPositions = ({
  combatActive = false,
  combatEnded = false,
  livePositions = {},
  finalPositions = {},
  deploymentPositions = {},
} = {}) => {
  if (combatEnded && Object.keys(finalPositions || {}).length > 0) {
    return finalPositions;
  }
  if (!combatActive && Object.keys(deploymentPositions || {}).length > 0) {
    return deploymentPositions;
  }
  return livePositions || {};
};

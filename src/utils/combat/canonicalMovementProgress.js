export function classifyCanonicalMovementProgress({
  distanceBefore,
  distanceAfter,
  origin = null,
  destination = null,
  tacticalPositionImproved = false,
  enteredWeaponRange = false,
} = {}) {
  const before = Number(distanceBefore);
  const after = Number(distanceAfter);
  const changedPosition = Boolean(
    origin &&
    destination &&
    (origin.x !== destination.x || origin.y !== destination.y)
  );
  const closedDistance =
    Number.isFinite(before) &&
    Number.isFinite(after) &&
    after + 0.01 < before;
  return Object.freeze({
    progressed: closedDistance || tacticalPositionImproved === true || enteredWeaponRange === true,
    closedDistance,
    changedPosition,
    tacticalPositionImproved: tacticalPositionImproved === true,
    enteredWeaponRange: enteredWeaponRange === true,
    distanceBefore: Number.isFinite(before) ? before : null,
    distanceAfter: Number.isFinite(after) ? after : null,
  });
}

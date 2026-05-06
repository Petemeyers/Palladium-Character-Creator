// src/engine/utils/moveCostFlight.cjs

function flightMoveCost({
  steps, // horizontal hex steps
  fromAlt,
  toAlt,
  ascendCostPer = 1,
  descendCostPer = 0,
  takeoffBaseCost = 1,
  landingBaseCost = 1,
}) {
  let cost = steps;

  const delta = (toAlt ?? fromAlt) - fromAlt;

  // takeoff if leaving ground
  if (fromAlt === 0 && (toAlt ?? 0) > 0) cost += takeoffBaseCost;

  // landing if going to ground
  if (fromAlt > 0 && (toAlt ?? 0) === 0) cost += landingBaseCost;

  if (delta > 0) cost += delta * ascendCostPer;
  if (delta < 0) cost += Math.abs(delta) * descendCostPer;

  return cost;
}

module.exports = { flightMoveCost };


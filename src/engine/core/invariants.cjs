// src/engine/core/invariants.cjs

function validateInvariants(state, ruleset) {
  const errors = [];

  // Example invariants (add more as needed)
  for (const fighter of state.fighters || []) {
    // HP should be non-negative
    if (fighter.currentHP < 0) {
      errors.push(`Fighter ${fighter.id} has negative HP: ${fighter.currentHP}`);
    }

    // Altitude should be within bounds
    const maxAlt = ruleset.maxAltitude(fighter);
    const alt = fighter.altitude ?? fighter.altitudeFeet ?? 0;
    if (alt < 0 || alt > maxAlt) {
      errors.push(`Fighter ${fighter.id} altitude ${alt} out of bounds [0, ${maxAlt}]`);
    }

    // Position should exist if fighter exists
    if (!state.positions[fighter.id]) {
      errors.push(`Fighter ${fighter.id} has no position`);
    }
  }

  return errors;
}

module.exports = { validateInvariants };


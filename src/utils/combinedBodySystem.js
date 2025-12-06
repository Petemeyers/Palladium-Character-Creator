/**
 * Combined Body System
 * 
 * Generic system for linking two fighters so they share a position and act as one "body".
 * Used for:
 * - Mounts and riders (horse + knight)
 * - Aerial carriers (hawk + mouse)
 * - Grapple carriers (giant demon + PC)
 */

export const COMBINED_ROLES = {
  MOUNT: "MOUNT",
  RIDER: "RIDER",
  CARRIER: "CARRIER",
  CARRIED: "CARRIED",
};

export const COMBINED_MODES = {
  MOUNTED: "MOUNTED",
  AERIAL_CARRY: "AERIAL_CARRY",
  GRAPPLE_CARRY: "GRAPPLE_CARRY",
};

/**
 * Link two fighters so they share a position and act as one "body"
 * @param {Object} primary - Fighter who controls movement (mount or carrier)
 * @param {Object} secondary - Fighter being carried or riding
 * @param {string} primaryRole - "MOUNT" or "CARRIER"
 * @param {string} mode - "MOUNTED" | "AERIAL_CARRY" | "GRAPPLE_CARRY"
 */
export function linkCombinedBodies(
  primary,
  secondary,
  primaryRole,
  mode = COMBINED_MODES.MOUNTED
) {
  const secondaryRole =
    primaryRole === COMBINED_ROLES.MOUNT
      ? COMBINED_ROLES.RIDER
      : COMBINED_ROLES.CARRIED;

  primary.combinedBody = {
    role: primaryRole,
    mode,
    partnerId: secondary.id,
  };

  secondary.combinedBody = {
    role: secondaryRole,
    mode,
    partnerId: primary.id,
  };

  // Mount compatibility with existing code
  if (mode === COMBINED_MODES.MOUNTED) {
    primary.hasRider = true;
    secondary.isMounted = true;
    secondary.mountedOnId = primary.id;
  }

  if (mode === COMBINED_MODES.AERIAL_CARRY || mode === COMBINED_MODES.GRAPPLE_CARRY) {
    primary.isCarrying = true;
    primary.carriedTargetId = secondary.id;
    secondary.isCarried = true;
    secondary.carriedById = primary.id;
  }

  return { primary, secondary };
}

/**
 * Unlink two fighters (dismount, drop, break carry)
 */
export function unlinkCombinedBodies(f1, f2) {
  if (f1?.combinedBody) {
    if (f1.combinedBody.mode === COMBINED_MODES.MOUNTED) {
      f1.hasRider = false;
    }
    if (
      f1.combinedBody.mode === COMBINED_MODES.AERIAL_CARRY ||
      f1.combinedBody.mode === COMBINED_MODES.GRAPPLE_CARRY
    ) {
      f1.isCarrying = false;
      f1.carriedTargetId = null;
    }
    f1.combinedBody = null;
  }

  if (f2?.combinedBody) {
    if (f2.combinedBody.mode === COMBINED_MODES.MOUNTED) {
      f2.isMounted = false;
      f2.mountedOnId = null;
    }
    if (
      f2.combinedBody.mode === COMBINED_MODES.AERIAL_CARRY ||
      f2.combinedBody.mode === COMBINED_MODES.GRAPPLE_CARRY
    ) {
      f2.isCarried = false;
      f2.carriedById = null;
    }
    f2.combinedBody = null;
  }

  return { f1, f2 };
}

/**
 * Sync positions so riders/carried targets stay on their mount/carrier.
 * Call this after a movement finishes.
 */
export function syncCombinedPositions(fighters, positions) {
  const updated = { ...positions };
  const fighterById = new Map(fighters.map((f) => [f.id, f]));

  fighters.forEach((f) => {
    const cb = f.combinedBody;
    if (!cb) return;

    const partner = fighterById.get(cb.partnerId);
    if (!partner) return;

    const fPos = positions[f.id];
    const pPos = positions[partner.id];

    // The one with role MOUNT/CARRIER is the "anchor"
    if (cb.role === COMBINED_ROLES.MOUNT || cb.role === COMBINED_ROLES.CARRIER) {
      if (!fPos) return;
      updated[partner.id] = { ...fPos };
    } else {
      if (!pPos) return;
      updated[f.id] = { ...pPos };
    }
  });

  return updated;
}

/**
 * Check if a fighter is part of a combined body
 */
export function isCombinedBody(fighter) {
  return !!fighter?.combinedBody;
}

/**
 * Get the partner fighter in a combined body
 */
export function getCombinedBodyPartner(fighter, fighters) {
  if (!fighter?.combinedBody) return null;
  return fighters.find((f) => f.id === fighter.combinedBody.partnerId) || null;
}

export default {
  COMBINED_ROLES,
  COMBINED_MODES,
  linkCombinedBodies,
  unlinkCombinedBodies,
  syncCombinedPositions,
  isCombinedBody,
  getCombinedBodyPartner,
};


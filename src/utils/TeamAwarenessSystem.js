/**
 * Team Awareness System
 * Manages shared awareness between team members
 * Handles information sharing, communication, and coordinated awareness
 *
 * Integrates with:
 * - PartyVisibilitySystem.js (shared vision)
 * - SpottedAlertSystem.js (spotting alerts)
 * - stealthSystem.js (stealth detection)
 */

/**
 * Awareness levels for team members
 */
export const AWARENESS_LEVELS = {
  UNKNOWN: "unknown", // No information
  SUSPECTED: "suspected", // Possible presence
  DETECTED: "detected", // Confirmed presence, location unknown
  VISIBLE: "visible", // Currently visible
  TRACKED: "tracked", // Known location, being tracked
};

/**
 * Share awareness information between team members
 * @param {Array} teamMembers - Array of team member objects
 * @param {Object} newInfo - New awareness information
 * @returns {Array} Updated team members with shared awareness
 */
export function shareTeamAwareness(teamMembers = [], newInfo = {}) {
  // TODO: Distribute awareness information to all team members
  // Handle communication range, stealth, etc.

  if (!teamMembers || teamMembers.length === 0 || !newInfo) {
    return teamMembers;
  }

  return teamMembers.map((member) => {
    // TODO: Check if member should receive information
    // - Communication range
    // - Line of sight to informer
    // - Stealth status

    const updatedMember = {
      ...member,
      awareness: member.awareness || {},
    };

    // TODO: Update member's awareness with new information
    // if (shouldReceiveInfo(member, newInfo)) {
    //   updatedMember.awareness = mergeAwareness(member.awareness, newInfo);
    // }

    return updatedMember;
  });
}

/**
 * Get combined team awareness of a target
 * @param {Array} teamMembers - Array of team members
 * @param {string} targetId - ID of target to check awareness of
 * @returns {Object} Combined awareness state
 */
export function getTeamAwareness(teamMembers = [], targetId) {
  // TODO: Combine awareness from all team members
  // Return best awareness level the team has

  if (!teamMembers || teamMembers.length === 0 || !targetId) {
    return {
      level: AWARENESS_LEVELS.UNKNOWN,
      knownBy: [],
      lastSeen: null,
      lastPosition: null,
    };
  }

  let bestLevel = AWARENESS_LEVELS.UNKNOWN;
  const knownBy = [];
  let lastSeen = null;
  let lastPosition = null;

  teamMembers.forEach((member) => {
    const memberAwareness = member.awareness?.[targetId];
    if (memberAwareness) {
      // TODO: Determine awareness level hierarchy
      // if (memberAwareness.level > bestLevel) {
      //   bestLevel = memberAwareness.level;
      // }
      knownBy.push(member.id);

      // Track most recent sighting
      if (
        memberAwareness.lastSeen &&
        (!lastSeen || memberAwareness.lastSeen > lastSeen)
      ) {
        lastSeen = memberAwareness.lastSeen;
        lastPosition = memberAwareness.lastPosition;
      }
    }
  });

  return {
    level: bestLevel,
    knownBy: knownBy,
    lastSeen: lastSeen,
    lastPosition: lastPosition,
  };
}

/**
 * Update team awareness based on current visibility
 * @param {Array} teamMembers - Array of team members
 * @param {Array} visibleTargets - Array of currently visible targets
 * @param {Object} environment - Environment data
 * @returns {Array} Updated team members with current awareness
 */
export function updateTeamAwareness(
  teamMembers = [],
  visibleTargets = [],
  environment = {}
) {
  // TODO: Update awareness for all visible targets
  // Share information between team members

  if (!teamMembers || teamMembers.length === 0) {
    return teamMembers;
  }

  return teamMembers.map((member) => {
    const updatedMember = {
      ...member,
      awareness: member.awareness || {},
    };

    // TODO: Update awareness for each visible target
    // visibleTargets.forEach(target => {
    //   if (canMemberSeeTarget(member, target, environment)) {
    //     updatedMember.awareness[target.id] = {
    //       level: AWARENESS_LEVELS.VISIBLE,
    //       lastSeen: Date.now(),
    //       lastPosition: target.position,
    //     };
    //   }
    // });

    return updatedMember;
  });
}

/**
 * Check if team should coordinate action based on awareness
 * @param {Array} teamMembers - Array of team members
 * @param {string} targetId - Target to check coordination for
 * @returns {boolean} True if team has sufficient awareness to coordinate
 */
export function canTeamCoordinate(teamMembers = [], targetId) {
  // TODO: Check if team has enough awareness to coordinate action
  // Requires multiple members aware or high awareness level

  const awareness = getTeamAwareness(teamMembers, targetId);

  // TODO: Define coordination requirements
  // - Multiple members aware
  // - High awareness level
  // - Recent information

  return (
    awareness.level !== AWARENESS_LEVELS.UNKNOWN && awareness.knownBy.length > 0
  );
}

/**
 * Decay team awareness over time (forget old information)
 * @param {Array} teamMembers - Array of team members
 * @param {number} decayTime - Time in ms before awareness decays
 * @returns {Array} Updated team members with decayed awareness
 */
export function decayTeamAwareness(teamMembers = [], decayTime = 60000) {
  // TODO: Reduce awareness levels for old information
  // Convert VISIBLE -> TRACKED -> DETECTED -> SUSPECTED -> UNKNOWN

  const now = Date.now();

  return teamMembers.map((member) => {
    const updatedMember = {
      ...member,
      awareness: { ...(member.awareness || {}) },
    };

    // TODO: Decay each awareness entry
    // Object.keys(updatedMember.awareness).forEach(targetId => {
    //   const awareness = updatedMember.awareness[targetId];
    //   const timeSinceSeen = now - (awareness.lastSeen || 0);
    //   if (timeSinceSeen > decayTime) {
    //     // Decay awareness level
    //   }
    // });

    return updatedMember;
  });
}

export default {
  AWARENESS_LEVELS,
  shareTeamAwareness,
  getTeamAwareness,
  updateTeamAwareness,
  canTeamCoordinate,
  decayTeamAwareness,
};

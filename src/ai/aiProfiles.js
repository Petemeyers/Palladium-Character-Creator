export const DEFAULT_AI_PROFILE = {
  aggression: 0.5,
  caution: 0.5,
  support: 0.5,
  curiosity: 0.5,
  resourceConservation: 0.5,
};

export const AI_PROFILES = {
  Soldier: {
    aggression: 0.7,
    caution: 0.45,
    support: 0.35,
    curiosity: 0.3,
    resourceConservation: 0.4,
  },

  Ranger: {
    aggression: 0.55,
    caution: 0.6,
    support: 0.35,
    curiosity: 0.8,
    resourceConservation: 0.5,
  },

  Thief: {
    aggression: 0.45,
    caution: 0.75,
    support: 0.25,
    curiosity: 0.7,
    resourceConservation: 0.6,
  },

  Duelist: {
    aggression: 0.55,
    caution: 0.7,
    support: 0.4,
    curiosity: 0.65,
    resourceConservation: 0.75,
  },

  Healer: {
    aggression: 0.25,
    caution: 0.75,
    support: 0.9,
    curiosity: 0.45,
    resourceConservation: 0.65,
  },

  Champion: {
    aggression: 0.9,
    caution: 0.25,
    support: 0.15,
    curiosity: 0.3,
    resourceConservation: 0.2,
  },

  "Cave Fighter": {
    aggression: 0.25,
    caution: 0.85,
    support: 0.6,
    curiosity: 0.45,
    resourceConservation: 0.5,
  },
};

export function getAiProfile(actor) {
  if (actor?.aiProfile) {
    return {
      ...DEFAULT_AI_PROFILE,
      ...actor.aiProfile,
    };
  }

  const keys = [
    actor?.profession,
    actor?.PROFESSION,
    actor?.professionName,
    actor?.className,
    actor?.class,
    actor?.species,
    actor?.race,
    actor?.baseName,
  ].filter(Boolean);

  for (const key of keys) {
    const direct = AI_PROFILES[key];
    if (direct) return { ...DEFAULT_AI_PROFILE, ...direct };

    const normalized = String(key).trim().toLowerCase();
    const matchedKey = Object.keys(AI_PROFILES).find(
      (profileKey) => profileKey.toLowerCase() === normalized
    );
    if (matchedKey) return { ...DEFAULT_AI_PROFILE, ...AI_PROFILES[matchedKey] };
  }

  return DEFAULT_AI_PROFILE;
}

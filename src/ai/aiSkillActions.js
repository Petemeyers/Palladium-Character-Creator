export const SKILL_ACTION_RULES = {
  Track: {
    tags: ["hunt", "search", "enemy-location"],
    context: ["noVisibleEnemy", "lastKnownEnemy", "wilderness"],
    rollType: "percentile",
    actionName: "Track enemy trail",
    successEvent: "ENEMY_TRAIL_FOUND",
    failureEvent: "TRACK_FAILED",
  },

  "Identify Tracks": {
    tags: ["hunt", "search", "enemy-location"],
    context: ["tracksNearby", "noVisibleEnemy"],
    rollType: "percentile",
    actionName: "Identify tracks",
    successEvent: "TRACKS_IDENTIFIED",
    failureEvent: "TRACKS_UNCLEAR",
  },

  "Detect Ambush": {
    tags: ["defense", "search", "hidden-enemy"],
    context: ["suspectedAmbush", "enteringDanger"],
    rollType: "percentile",
    actionName: "Detect ambush",
    successEvent: "AMBUSH_DETECTED",
    failureEvent: "AMBUSH_NOT_DETECTED",
  },

  Prowl: {
    tags: ["stealth", "positioning", "ambush"],
    context: ["hasCover", "notAdjacentToEnemy"],
    rollType: "percentile",
    actionName: "Prowl / hide",
    successEvent: "ACTOR_HIDDEN",
    failureEvent: "PROWL_FAILED",
  },

  "Pick Locks": {
    tags: ["utility", "door", "objective"],
    context: ["lockedDoorNearby"],
    rollType: "percentile",
    actionName: "Pick lock",
    successEvent: "LOCK_PICKED",
    failureEvent: "LOCK_PICK_FAILED",
  },

  "First Aid": {
    tags: ["healing", "ally-support"],
    context: ["woundedAllyNearby", "shumanWounded"],
    rollType: "percentile",
    actionName: "Use First Aid",
    successEvent: "FIRST_AID_SUCCESS",
    failureEvent: "FIRST_AID_FAILED",
  },

  Medical: {
    tags: ["healing", "ally-support"],
    context: ["badlyWoundedAllyNearby"],
    rollType: "percentile",
    actionName: "Use Medical skill",
    successEvent: "MEDICAL_SUCCESS",
    failureEvent: "MEDICAL_FAILED",
  },

  "Lore: Raider & Opponent": {
    tags: ["knowledge", "identify", "opponent-weakness"],
    context: ["unknownOpponentVisible"],
    rollType: "percentile",
    actionName: "Identify opponent weakness",
    successEvent: "MONSTER_IDENTIFIED",
    failureEvent: "MONSTER_UNKNOWN",
  },

  "Lore: Training": {
    tags: ["knowledge", "training", "identify"],
    context: ["trainingEffectVisible", "unknownTechniqueEffect"],
    rollType: "percentile",
    actionName: "Analyze training",
    successEvent: "TRAINING_IDENTIFIED",
    failureEvent: "TRAINING_UNKNOWN",
  },

  Navigation: {
    tags: ["travel", "hunt", "positioning"],
    context: ["lost", "dungeonExplore", "noVisibleEnemy"],
    rollType: "percentile",
    actionName: "Navigate",
    successEvent: "PATH_FOUND",
    failureEvent: "NAVIGATION_FAILED",
  },

  "Recognize Weapon Quality": {
    tags: ["tactics", "threat-assessment"],
    context: ["enemyWeaponVisible"],
    rollType: "percentile",
    actionName: "Assess enemy weapon",
    successEvent: "WEAPON_QUALITY_RECOGNIZED",
    failureEvent: "WEAPON_ASSESSMENT_FAILED",
  },
};

import { PROFESSIONS, ELECTIVE_SKILLS, SECONDARY_SKILLS } from "./professionData.js";

export const gameData = {
  races: {
    Human: {
      name: "Human",
      species: "human",
      attributeModifiers: {},
      saveMods: {},
      restrictedRaces: [],
    },
  },
  occs: PROFESSIONS,
  professions: PROFESSIONS,
  electiveSkills: ELECTIVE_SKILLS,
  secondarySkills: SECONDARY_SKILLS,
  skills: {
    Athletics: { base: 45, description: "Running, climbing, and physical contests." },
    Tactics: { base: 35, description: "Reading battlefield movement and timing." },
    "First Aid": { base: 40, description: "Basic wound care." },
    Observation: { base: 35, description: "Spotting useful details under pressure." },
    "Animal Handling": { base: 35, description: "Handling trained animals." },
    Maintenance: { base: 45, description: "Care of arms and armor." },
    Stealth: { base: 30, description: "Moving quietly and hiding." },
  },
  techniques: {},
  levelProgression: {
    "Human Arms": {
      hpPerLevel: 6,
      skillIncrease: 5,
    },
  },
};

export default gameData;

import { PUBLIC_BACKGROUNDS } from "../data/publicBackgrounds.js";
import { PUBLIC_CLASSES } from "../data/publicClasses.js";
import { PUBLIC_SKILLS } from "../data/publicSkills.js";
import { getBackgroundAttributeOptions } from "./simulatorCreatorAttributes.js";

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

export function getPublicClasses() {
  return PUBLIC_CLASSES.map((entry) => ({ ...entry }));
}

export function getPublicClassById(id) {
  const key = normalizeKey(id);
  return PUBLIC_CLASSES.find((entry) => entry.id === key) || null;
}

export function getPublicClassByName(name) {
  const key = normalizeKey(name);
  return PUBLIC_CLASSES.find((entry) => normalizeKey(entry.name) === key) || null;
}

export function getPublicSkills() {
  return PUBLIC_SKILLS.map((entry) => ({ ...entry }));
}

export function getPublicSkillById(id) {
  const key = normalizeKey(id);
  return PUBLIC_SKILLS.find((entry) => entry.id === key) || null;
}

export function getPublicBackgrounds() {
  return PUBLIC_BACKGROUNDS.map((entry) => ({ ...entry }));
}

export function getPublicBackgroundById(id) {
  const key = normalizeKey(id);
  return PUBLIC_BACKGROUNDS.find((entry) => entry.id === key) || null;
}

export function getPublicBackgroundAttributeOptions(background) {
  return getBackgroundAttributeOptions(background);
}

export function createPublicCharacterDefaults(classId, backgroundId) {
  const classEntry = getPublicClassById(classId);
  const backgroundEntry = getPublicBackgroundById(backgroundId);
  const classFeatures = classEntry?.levelOneFeatures || classEntry?.classFeatures || [];
  const classEquipmentTags = classEntry?.startingEquipmentTags || classEntry?.equipmentTags || [];
  const skillSet = new Set([
    ...(classEntry?.fixedSkills || []),
    ...(backgroundEntry?.skillProficiencies || []),
  ]);

  return {
    ruleset: "core-d20",
    sizePolicy: "legacy-compatible",
    legacyCompatibility: true,
    classId: classEntry?.id || null,
    className: classEntry?.name || null,
    backgroundId: backgroundEntry?.id || null,
    backgroundName: backgroundEntry?.name || null,
    skillProficiencies: [...skillSet],
    savingThrowProficiencies: classEntry?.savingThrowProficiencies ? [...classEntry.savingThrowProficiencies] : [],
    hitDie: classEntry?.hitDie || null,
    features: [
      ...classFeatures,
      ...(backgroundEntry?.feature ? [backgroundEntry.feature] : []),
    ],
    equipmentTags: [
      ...classEquipmentTags,
      ...(backgroundEntry?.equipmentTags || []),
    ],
  };
}

export default {
  getPublicClasses,
  getPublicClassById,
  getPublicClassByName,
  getPublicSkills,
  getPublicSkillById,
  getPublicBackgrounds,
  getPublicBackgroundById,
  getPublicBackgroundAttributeOptions,
  createPublicCharacterDefaults,
};

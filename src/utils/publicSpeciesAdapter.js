import { PUBLIC_ALIGNMENTS } from "../data/publicAlignment.js";
import { PUBLIC_LANGUAGES } from "../data/publicLanguages.js";
import { PUBLIC_SPECIES } from "../data/publicSpecies.js";

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

export function getPublicSpecies() {
  return PUBLIC_SPECIES.map((entry) => ({ ...entry, traits: [...entry.traits], sizeOptions: [...entry.sizeOptions] }));
}

export function getPublicSpeciesById(id) {
  const key = normalizeKey(id);
  const entry = PUBLIC_SPECIES.find((species) => species.id === key);
  return entry ? { ...entry, traits: [...entry.traits], sizeOptions: [...entry.sizeOptions] } : null;
}

export function getPublicAlignments() {
  return PUBLIC_ALIGNMENTS.map((entry) => ({ ...entry }));
}

export function getPublicAlignmentById(id) {
  const key = normalizeKey(id);
  const entry = PUBLIC_ALIGNMENTS.find((alignment) => alignment.id === key);
  return entry ? { ...entry } : null;
}

export function getPublicLanguages() {
  return PUBLIC_LANGUAGES.map((entry) => ({ ...entry }));
}

export function getPublicLanguageById(id) {
  const key = normalizeKey(id);
  const entry = PUBLIC_LANGUAGES.find((language) => language.id === key);
  return entry ? { ...entry } : null;
}

export default {
  getPublicSpecies,
  getPublicSpeciesById,
  getPublicAlignments,
  getPublicAlignmentById,
  getPublicLanguages,
  getPublicLanguageById,
};

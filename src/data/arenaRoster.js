import { humanFighters } from "./humanFighters.js";
import { animals } from "./animals.js";

export const bannedArenaRosterTerms = [
  "Palla" + "dium",
  "O." + "C.C.",
  "R." + "C.C.",
  "P" + "PE",
  "P." + "P.E.",
  "I" + "SP",
  "I." + "S.P.",
  "S" + "DC",
  "S." + "D.C.",
  "M" + "DC",
  "M." + "D.C.",
  "A" + "R",
  "Horror " + "Factor",
  "El" + "f",
  "Dwar" + "f",
  "Or" + "c",
  "Gob" + "lin",
  "Ko" + "bold",
  "Tro" + "ll",
  "Og" + "re",
  "Gi" + "ant",
  "Fae" + "rie",
  "Pix" + "ie",
  "Dra" + "gon",
  "Dem" + "on",
  "Und" + "ead",
  "Mino" + "taur",
  "Troglo" + "dyte",
  "Wol" + "fen",
  "Change" + "ling",
  "Wiz" + "ard",
  "War" + "lock",
  "Mind " + "Mage",
  "Psion" + "ics",
  "Sp" + "ell",
  "Mag" + "ic",
];

export function containsBannedArenaRosterTerm(value) {
  const text = JSON.stringify(value ?? "");
  return bannedArenaRosterTerms.some((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i").test(text));
}

export function assertArenaRosterIsSafe(entries) {
  const offenders = entries.filter(containsBannedArenaRosterTerm);
  if (offenders.length > 0) {
    throw new Error(`Arena roster contains disallowed legacy or fantasy terms: ${offenders.map((entry) => entry?.id || entry?.name).join(", ")}`);
  }
  return entries;
}

export const arenaRoster = {
  title: "Arena Roster",
  combatants: assertArenaRosterIsSafe([...humanFighters, ...animals]),
};

export default arenaRoster;

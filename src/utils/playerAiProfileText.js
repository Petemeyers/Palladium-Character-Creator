export function getPlayerAiProfessionText(fighter = {}) {
  return [
    fighter.occ,
    fighter.OCC,
    fighter.PROFESSION,
    fighter.profession,
    fighter.occupation,
    fighter.class,
    fighter.className,
    fighter.characterClass,
    fighter.professionName,
    fighter.archetype,
    fighter.role,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default getPlayerAiProfessionText;

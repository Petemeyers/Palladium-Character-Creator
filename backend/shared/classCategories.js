export const characterClassCategories = {
  MenAtArms: [
    "Mercenary Fighter",
    "Soldier",
    "Knight",
    "Paladin",
    "Long Bowman",
    "Ranger",
    "Thief",
    "Assassin",
  ],
  MenOfMagic: [
    "Wizard",
    "Witch",
    "Warlock",
    "Diabolist",
    "Summoner",
    "Mind Mage",
  ],
  Clergy: ["Priest", "Druid", "Shaman", "Healer"],
  Optional: ["Peasant", "Squire", "Scholar", "Merchant", "Noble"],
};

export function getClassCategory(className) {
  for (const [category, classes] of Object.entries(characterClassCategories)) {
    if (classes.includes(className)) {
      return category;
    }
  }
  return null;
}

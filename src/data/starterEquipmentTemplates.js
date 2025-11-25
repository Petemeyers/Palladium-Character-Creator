// Starter equipment templates for different OCCs (Occupational Character Classes)
const STARTER_TEMPLATES = {
  warrior: {
    name: "Warrior Starter Pack",
    items: [
      { name: "Sword", type: "weapon", quantity: 1 },
      { name: "Shield", type: "shield", quantity: 1 },
      { name: "Leather Armor", type: "armor", quantity: 1 },
      { name: "Backpack", type: "container", quantity: 1 },
    ],
  },
  mage: {
    name: "Mage Starter Pack",
    items: [
      { name: "Staff", type: "weapon", quantity: 1 },
      { name: "Robe", type: "clothing", quantity: 1 },
      { name: "Spellbook", type: "book", quantity: 1 },
      { name: "Backpack", type: "container", quantity: 1 },
    ],
  },
  rogue: {
    name: "Rogue Starter Pack",
    items: [
      { name: "Dagger", type: "weapon", quantity: 2 },
      { name: "Leather Armor", type: "armor", quantity: 1 },
      { name: "Thieves' Tools", type: "tool", quantity: 1 },
      { name: "Backpack", type: "container", quantity: 1 },
    ],
  },
  cleric: {
    name: "Cleric Starter Pack",
    items: [
      { name: "Mace", type: "weapon", quantity: 1 },
      { name: "Shield", type: "shield", quantity: 1 },
      { name: "Chain Mail", type: "armor", quantity: 1 },
      { name: "Holy Symbol", type: "religious", quantity: 1 },
      { name: "Backpack", type: "container", quantity: 1 },
    ],
  },
  ranger: {
    name: "Ranger Starter Pack",
    items: [
      { name: "Longbow", type: "weapon", quantity: 1 },
      { name: "Arrows", type: "ammunition", quantity: 20 },
      { name: "Short Sword", type: "weapon", quantity: 1 },
      { name: "Leather Armor", type: "armor", quantity: 1 },
      { name: "Backpack", type: "container", quantity: 1 },
    ],
  },
  default: {
    name: "Basic Starter Pack",
    items: [
      { name: "Dagger", type: "weapon", quantity: 1 },
      { name: "Clothes", type: "clothing", quantity: 1 },
      { name: "Backpack", type: "container", quantity: 1 },
    ],
  },
};

export default STARTER_TEMPLATES;


export const armors = [
  { name: "Gambeson", guardRating: 11, armorDurability: 35, type: "armor", category: "light", weight: 10, price: 20, description: "Quilted textile armor." },
  { name: "Leather Jack", guardRating: 12, armorDurability: 40, type: "armor", category: "light", weight: 12, price: 30, description: "Layered leather torso protection." },
  { name: "Padded Jack", guardRating: 11, armorDurability: 30, type: "armor", category: "light", weight: 8, price: 18, description: "Light padded protection." },
  { name: "Mail Shirt", guardRating: 13, armorDurability: 55, type: "armor", category: "medium", weight: 22, price: 80, description: "Interlinked iron rings covering the torso." },
  { name: "Mail Hauberk", guardRating: 14, armorDurability: 70, type: "armor", category: "medium", weight: 32, price: 120, description: "Long mail coat for battlefield use." },
  { name: "Brigandine", guardRating: 15, armorDurability: 75, type: "armor", category: "heavy", weight: 30, price: 140, description: "Riveted plates under a textile shell." },
  { name: "Plate Harness", guardRating: 16, armorDurability: 95, type: "armor", category: "heavy", weight: 45, price: 250, description: "Full fitted plate armor." },
  { name: "Mail and Plate", guardRating: 17, armorDurability: 110, type: "armor", category: "heavy", weight: 48, price: 300, description: "Layered plate with mail coverage." },
  { name: "Buckler", guardRating: 1, armorDurability: 20, type: "shield", category: "shield", weight: 2, price: 12, description: "Small hand shield." },
  { name: "Light Shield", guardRating: 2, armorDurability: 30, type: "shield", category: "shield", weight: 5, price: 20, description: "Light wooden shield." },
  { name: "Heater Shield", guardRating: 3, armorDurability: 45, type: "shield", category: "shield", weight: 8, price: 35, description: "Kite-shaped shield for mounted or foot combat." },
  { name: "Kite Shield", guardRating: 3, armorDurability: 50, type: "shield", category: "shield", weight: 10, price: 40, description: "Large shield with leg coverage." },
];

export const getArmorByName = (name) => armors.find((armor) => armor.name === name);
export const getArmorByCategory = (category) => armors.filter((armor) => armor.category === category);

export default armors;

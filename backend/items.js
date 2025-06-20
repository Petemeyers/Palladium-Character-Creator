// backend/items.js

// Export the items array as default
const items = [
  // Clothing
  { id: 1, name: "Socks", description: "", price: 0.5, category: "Clothing" },
  {
    id: 2,
    name: "Shirt (Wool)",
    description: "",
    price: 6,
    category: "Clothing",
  },
  {
    id: 3,
    name: "Shirt (Silk)",
    description: "",
    price: 15,
    category: "Clothing",
  },
  { id: 4, name: "Vest", description: "", price: 15, category: "Clothing" },
  {
    id: 5,
    name: "Jacket (Light)",
    description: "",
    price: 20,
    category: "Clothing",
  },
  {
    id: 6,
    name: "Jacket (Heavy)",
    description: "",
    price: 40,
    category: "Clothing",
  },
  {
    id: 7,
    name: "Jacket (Short, Down-Filled)",
    description: "",
    price: 55,
    category: "Clothing",
  },
  {
    id: 8,
    name: "Jacket (Long, Down-Filled)",
    description: "",
    price: 75,
    category: "Clothing",
  },
  {
    id: 9,
    name: "Jacket (Leather)",
    description: "",
    price: 40,
    category: "Clothing",
  },
  {
    id: 10,
    name: "Jacket, Fur (Common, Heavy)",
    description: "",
    price: 70,
    category: "Clothing",
  },
  { id: 11, name: "Pants", description: "", price: 12, category: "Clothing" },
  {
    id: 12,
    name: "Work Pants",
    description: "",
    price: 16,
    category: "Clothing",
  },
  { id: 13, name: "Skirt", description: "", price: 10, category: "Clothing" },
  {
    id: 14,
    name: "Dress (Common)",
    description: "",
    price: 30,
    category: "Clothing",
  },
  {
    id: 15,
    name: "Dress (Fancy)",
    description: "",
    price: 60,
    category: "Clothing",
  },
  { id: 16, name: "Surcoat", description: "", price: 40, category: "Clothing" },
  {
    id: 17,
    name: "Boots (Cloth)",
    description: "",
    price: 8,
    category: "Clothing",
  },
  {
    id: 18,
    name: "Boots (Soft Leather)",
    description: "",
    price: 15,
    category: "Clothing",
  },
  {
    id: 19,
    name: "Boots (Leather)",
    description: "",
    price: 20,
    category: "Clothing",
  },
  {
    id: 20,
    name: "Boots (Work/Reinforced)",
    description: "",
    price: 30,
    category: "Clothing",
  },
  {
    id: 21,
    name: "Boots, Knee-High",
    description: "",
    price: 50,
    category: "Clothing",
  },
  {
    id: 22,
    name: "Boots, Hip-High",
    description: "",
    price: 70,
    category: "Clothing",
  },
  { id: 23, name: "Shoes", description: "", price: 20, category: "Clothing" },
  { id: 24, name: "Sandals", description: "", price: 10, category: "Clothing" },
  { id: 25, name: "Scarf", description: "", price: 5, category: "Clothing" },
  {
    id: 26,
    name: "Cap (Pull Over)",
    description: "",
    price: 5,
    category: "Clothing",
  },
  {
    id: 27,
    name: "Hat (Short Brim)",
    description: "",
    price: 15,
    category: "Clothing",
  },
  {
    id: 28,
    name: "Hat (Large Brim)",
    description: "",
    price: 20,
    category: "Clothing",
  },
  {
    id: 29,
    name: "Hat (Large Brim, Leather)",
    description: "",
    price: 35,
    category: "Clothing",
  },
  { id: 30, name: "Belt", description: "", price: 4, category: "Clothing" },
  {
    id: 31,
    name: "Sword Belt",
    description: "",
    price: 6,
    category: "Clothing",
  },
  {
    id: 32,
    name: "Sword Sheath",
    description: "",
    price: 18,
    category: "Clothing",
  },
  {
    id: 33,
    name: "Knife Sheath",
    description: "",
    price: 10,
    category: "Clothing",
  },
  {
    id: 34,
    name: "Cape (Short)",
    description: "",
    price: 15,
    category: "Clothing",
  },
  {
    id: 35,
    name: "Cape (Long)",
    description: "",
    price: 25,
    category: "Clothing",
  },
  {
    id: 36,
    name: "Cape (Long, Hooded)",
    description: "",
    price: 35,
    category: "Clothing",
  },
  {
    id: 37,
    name: "Robe (Light)",
    description: "",
    price: 20,
    category: "Clothing",
  },

  // Containers
  {
    id: 38,
    name: "Saddle bag",
    description: "",
    price: 20,
    category: "Containers",
  },
  {
    id: 39,
    name: "Small pocket purse",
    description: "",
    price: 1,
    category: "Containers",
  },
  {
    id: 40,
    name: "Belt purse",
    description: "Attaches to belt",
    price: 2,
    category: "Containers",
  },
  {
    id: 41,
    name: "Shoulder purse (Small)",
    description: "",
    price: 5,
    category: "Containers",
  },
  {
    id: 42,
    name: "Shoulder purse (Large)",
    description: "",
    price: 12,
    category: "Containers",
  },
  {
    id: 43,
    name: "Small sack",
    description: "",
    price: 4,
    category: "Containers",
  },
  {
    id: 44,
    name: "Large sack",
    description: "",
    price: 8,
    category: "Containers",
  },
  {
    id: 45,
    name: "Knapsack",
    description: "",
    price: 15,
    category: "Containers",
  },
  {
    id: 46,
    name: "Backpack",
    description: "",
    price: 20,
    category: "Containers",
  },
  {
    id: 47,
    name: "Cloth handle bag",
    description: "",
    price: 10,
    category: "Containers",
  },
  {
    id: 48,
    name: "Leather handle bag",
    description: "",
    price: 18,
    category: "Containers",
  },
  {
    id: 49,
    name: "Tobacco pouch",
    description: "",
    price: 2,
    category: "Containers",
  },
  {
    id: 50,
    name: "Water skin (2 pints)",
    description: "",
    price: 5,
    category: "Containers",
  },
  {
    id: 51,
    name: "Water skin (½ gallon)",
    description: "",
    price: 10,
    category: "Containers",
  },
  {
    id: 52,
    name: "Water skin (1 gallon)",
    description: "",
    price: 15,
    category: "Containers",
  },

  // Lighting
  {
    id: 53,
    name: "Flint/steel",
    description: "",
    price: 3,
    category: "Lighting",
  },
  {
    id: 54,
    name: "Tinder box",
    description: "",
    price: 5,
    category: "Lighting",
  },
  {
    id: 55,
    name: "Treated torch",
    description: "Quick light, lasts 3 hours",
    price: 3,
    category: "Lighting",
  },
  {
    id: 56,
    name: "Untreated torch",
    description: "",
    price: 1,
    category: "Lighting",
  },
  {
    id: 57,
    name: "Candle (Fast burning)",
    description: "45 minutes",
    price: 1,
    category: "Lighting",
  },
  {
    id: 58,
    name: "Candle (Long burning)",
    description: "3 hours",
    price: 5,
    category: "Lighting",
  },
  {
    id: 59,
    name: "Glass candle lantern",
    description: "",
    price: 6,
    category: "Lighting",
  },
  {
    id: 60,
    name: "Oil lantern (6-hour)",
    description: "1 pint",
    price: 10,
    category: "Lighting",
  },

  // Barrels & Storage
  {
    id: 61,
    name: "Cask (Wood, 4 gallons)",
    description: "",
    price: 12,
    category: "Barrels & Storage",
  },
  {
    id: 62,
    name: "Cask (Wood, 10 gallons)",
    description: "",
    price: 18,
    category: "Barrels & Storage",
  },
  {
    id: 63,
    name: "Cask (Wood, 25 gallons)",
    description: "",
    price: 30,
    category: "Barrels & Storage",
  },
  {
    id: 64,
    name: "Vial (Glass, 2 ounces)",
    description: "",
    price: 2,
    category: "Barrels & Storage",
  },
  {
    id: 65,
    name: "Jar (Glass, 1 pint)",
    description: "",
    price: 4,
    category: "Barrels & Storage",
  },
  {
    id: 66,
    name: "Jar (Glass, 2 pints)",
    description: "",
    price: 8,
    category: "Barrels & Storage",
  },
  {
    id: 67,
    name: "Jar (Glass, 4 pints)",
    description: "",
    price: 10,
    category: "Barrels & Storage",
  },
  {
    id: 68,
    name: "Jar (Glass, 1 gallon)",
    description: "",
    price: 15,
    category: "Barrels & Storage",
  },
  {
    id: 69,
    name: "Jug (½ gallon)",
    description: "",
    price: 10,
    category: "Barrels & Storage",
  },
  {
    id: 70,
    name: "Jug (1 gallon)",
    description: "",
    price: 15,
    category: "Barrels & Storage",
  },
  {
    id: 71,
    name: "Jug (5 gallons)",
    description: "",
    price: 25,
    category: "Barrels & Storage",
  },
  {
    id: 72,
    name: "Bucket (Wood, 5 gallons)",
    description: "",
    price: 5,
    category: "Barrels & Storage",
  },
  {
    id: 73,
    name: "Bucket (Metal, 5 gallons)",
    description: "",
    price: 7,
    category: "Barrels & Storage",
  },
  {
    id: 74,
    name: "Snuff box",
    description: "",
    price: 5,
    category: "Barrels & Storage",
  },
  {
    id: 75,
    name: "Small wood box (1 lb.)",
    description: "",
    price: 10,
    category: "Barrels & Storage",
  },
  {
    id: 76,
    name: "Medium wood box (5 lbs.)",
    description: "",
    price: 15,
    category: "Barrels & Storage",
  },
  {
    id: 77,
    name: "Large wood box (15 lbs.)",
    description: "",
    price: 25,
    category: "Barrels & Storage",
  },
  {
    id: 78,
    name: "Trunk (Small, wood, 25 lbs.)",
    description: "",
    price: 40,
    category: "Barrels & Storage",
  },
  {
    id: 79,
    name: "Trunk (Large, wood, 50 lbs.)",
    description: "",
    price: 70,
    category: "Barrels & Storage",
  },
  {
    id: 80,
    name: "Small metal box (5 lbs.)",
    description: "",
    price: 15,
    category: "Barrels & Storage",
  },
  {
    id: 81,
    name: "Large metal box (15 lbs.)",
    description: "",
    price: 30,
    category: "Barrels & Storage",
  },
  {
    id: 82,
    name: "Metal trunk (Small, 25 lbs.)",
    description: "",
    price: 50,
    category: "Barrels & Storage",
  },
  {
    id: 83,
    name: "Metal trunk (Large, 50 lbs.)",
    description: "",
    price: 80,
    category: "Barrels & Storage",
  },

  // Writing Equipment
  {
    id: 84,
    name: "Paper (Dozen 9x12-inch sheets)",
    description: "",
    price: 8,
    category: "Writing Equipment",
  },
  {
    id: 85,
    name: "Parchment (Dozen 9x12-inch sheets)",
    description: "",
    price: 15,
    category: "Writing Equipment",
  },
  {
    id: 86,
    name: "Book (Paper, glued, 100 sheets)",
    description: "",
    price: 50,
    category: "Writing Equipment",
  },
  {
    id: 87,
    name: "Book (Parchment, glued, 100 sheets)",
    description: "",
    price: 100,
    category: "Writing Equipment",
  },
  {
    id: 88,
    name: "Book (Parchment, stitched, 100 sheets)",
    description: "",
    price: 150,
    category: "Writing Equipment",
  },
  {
    id: 89,
    name: "Slate board (18x24 inches)",
    description: "",
    price: 10,
    category: "Writing Equipment",
  },
  {
    id: 90,
    name: "Chalk (Dozen sticks)",
    description: "",
    price: 2,
    category: "Writing Equipment",
  },
  {
    id: 91,
    name: "Charcoal (Dozen sticks)",
    description: "",
    price: 2,
    category: "Writing Equipment",
  },
  {
    id: 92,
    name: "Silver point (One 2-inch needle)",
    description: "",
    price: 4,
    category: "Writing Equipment",
  },
  {
    id: 93,
    name: "Ink (Black, 6 ounces)",
    description: "",
    price: 3,
    category: "Writing Equipment",
  },
  {
    id: 94,
    name: "Ink (Color, 6 ounces)",
    description: "",
    price: 6,
    category: "Writing Equipment",
  },
  {
    id: 95,
    name: "Powder pigments (Earth colors, 2 ounces)",
    description: "",
    price: 4,
    category: "Writing Equipment",
  },
  {
    id: 96,
    name: "Powder pigments (Bright colors, 1 ounce)",
    description: "",
    price: 8,
    category: "Writing Equipment",
  },
  {
    id: 97,
    name: "Gold leaf (1 ounce)",
    description: "",
    price: 100,
    category: "Writing Equipment",
  },
  {
    id: 98,
    name: "Silver leaf (2 ounces)",
    description: "",
    price: 40,
    category: "Writing Equipment",
  },
  {
    id: 99,
    name: "Bronze leaf (2 ounces)",
    description: "",
    price: 50,
    category: "Writing Equipment",
  },
  {
    id: 100,
    name: "Crow quill pen",
    description: "",
    price: 1,
    category: "Writing Equipment",
  },

  // Fresh Meat
  {
    id: 101,
    name: "Rabbit/Squirrel (whole)",
    description: "Fresh meat",
    price: 4,
    category: "Fresh Meat",
  },
  {
    id: 102,
    name: "Venison (leg or roast)",
    description: "Fresh meat",
    price: 20,
    category: "Fresh Meat",
  },
  {
    id: 103,
    name: "Beef steak",
    description: "Fresh meat",
    price: 50,
    category: "Fresh Meat",
  },
  {
    id: 104,
    name: "Beef (leg or roast)",
    description: "Fresh meat",
    price: 100,
    category: "Fresh Meat",
  },
  {
    id: 105,
    name: "Beef (whole cow)",
    description: "Fresh meat",
    price: 190,
    category: "Fresh Meat",
  },
  {
    id: 106,
    name: "Pork steak",
    description: "Fresh meat",
    price: 12,
    category: "Fresh Meat",
  },
  {
    id: 107,
    name: "Pork (leg or roast)",
    description: "Fresh meat",
    price: 35,
    category: "Fresh Meat",
  },
  {
    id: 108,
    name: "Pork (side)",
    description: "Fresh meat",
    price: 65,
    category: "Fresh Meat",
  },
  {
    id: 109,
    name: "Pork (whole pig)",
    description: "Fresh meat",
    price: 100,
    category: "Fresh Meat",
  },
  {
    id: 110,
    name: "Lamb (leg or roast)",
    description: "Fresh meat",
    price: 12,
    category: "Fresh Meat",
  },
  {
    id: 111,
    name: "Lamb (side)",
    description: "Fresh meat",
    price: 35,
    category: "Fresh Meat",
  },
  {
    id: 112,
    name: "Lamb (whole)",
    description: "Fresh meat",
    price: 65,
    category: "Fresh Meat",
  },

  // Preserved Foods
  {
    id: 113,
    name: "Smoked sausage (pork or beef)",
    description: "Per 2 lbs.",
    price: 8,
    category: "Preserved Foods",
  },
  {
    id: 114,
    name: "Spiced sausage (pork or beef)",
    description: "Per 2 lbs.",
    price: 10,
    category: "Preserved Foods",
  },
  {
    id: 115,
    name: "Smoked beef",
    description: "Per 2 lbs.",
    price: 6,
    category: "Preserved Foods",
  },
  {
    id: 116,
    name: "Salted beef",
    description: "Per 2 lbs.",
    price: 6,
    category: "Preserved Foods",
  },
  {
    id: 117,
    name: "Jerked beef",
    description: "Per 2 lbs.",
    price: 6,
    category: "Preserved Foods",
  },
  {
    id: 118,
    name: "Smoked pork",
    description: "Per 2 lbs.",
    price: 6,
    category: "Preserved Foods",
  },
  {
    id: 119,
    name: "Salted pork",
    description: "Per 2 lbs.",
    price: 6,
    category: "Preserved Foods",
  },
  {
    id: 120,
    name: "Smoked fish",
    description: "Per 2 lbs.",
    price: 6,
    category: "Preserved Foods",
  },
  {
    id: 121,
    name: "Salted fish",
    description: "Per 2 lbs.",
    price: 6,
    category: "Preserved Foods",
  },

  // Miscellaneous Foods
  {
    id: 122,
    name: "Bread",
    description: "4 loaves",
    price: 2,
    category: "Miscellaneous Foods",
  },
  {
    id: 123,
    name: "Buns/Rolls",
    description: "2 dozen",
    price: 4,
    category: "Miscellaneous Foods",
  },
  {
    id: 124,
    name: "Pastries/Donuts",
    description: "1 dozen",
    price: 5,
    category: "Miscellaneous Foods",
  },
  {
    id: 125,
    name: "Cheese (various types)",
    description: "Per 2 lbs.",
    price: 10,
    category: "Miscellaneous Foods",
  },
  {
    id: 126,
    name: "Butter (salted)",
    description: "Per lb.",
    price: 3,
    category: "Miscellaneous Foods",
  },
  {
    id: 127,
    name: "Butter (unsalted)",
    description: "Per lb.",
    price: 2,
    category: "Miscellaneous Foods",
  },
  {
    id: 128,
    name: "Honey",
    description: "Per pint",
    price: 4,
    category: "Miscellaneous Foods",
  },
  {
    id: 129,
    name: "Jam",
    description: "Per pint",
    price: 5,
    category: "Miscellaneous Foods",
  },
  {
    id: 130,
    name: "Maple syrup candy",
    description: "Per lb.",
    price: 5,
    category: "Miscellaneous Foods",
  },
];

// Function to seed the database with items
export const seedItems = async (ShopItem) => {
  try {
    // Clear existing items
    await ShopItem.deleteMany({});

    // Insert new items
    await ShopItem.insertMany(items);

    console.log("Items seeded successfully");
  } catch (error) {
    console.error("Error seeding items:", error);
  }
};

export default items;

// weaponShop.js

// Import the data module
import { getClassCategory } from "./shared/classCategories.js";

// Define weapons data with all categories
export const weapons = [
  // Axes
  {
    id: 1,
    name: "Battle Axe",
    type: "Weapon",
    category: "Axes",
    handed: "Two-handed",
    length: "0.8m (2.75ft)",
    weight: "2kg (4.6lb)",
    damage: "2-12",
    price: 40,
    description: "Heavy two-handed battle axe",
    itemId: "axe_1",
  },
  {
    id: 2,
    name: "Throwing Axe",
    type: "Weapon",
    category: "Axes",
    handed: "One-handed",
    length: "0.4m (1.25ft)",
    weight: "1.4kg (3lb)",
    damage: "1-6",
    price: 8,
    description: "Balanced for throwing",
    itemId: "axe_2",
  },
  {
    id: 3,
    name: "Stone Axe",
    type: "Weapon",
    category: "Axes",
    handed: "One-handed",
    length: "0.6m (2ft)",
    weight: "1.8kg (4lb)",
    damage: "1-8",
    price: 18,
    description: "Primitive but effective axe",
    itemId: "axe_3",
  },
  {
    id: 4,
    name: "Bipennis",
    type: "Weapon",
    category: "Axes",
    handed: "One-handed",
    length: "0.8m (2.75ft)",
    weight: "2.8kg (6lb)",
    damage: "2-12",
    price: 45,
    description: "Double-headed axe",
    itemId: "axe_4",
  },

  // Pole Arms
  {
    id: 10,
    name: "Awl Pike",
    type: "Weapon",
    category: "PoleArms",
    handed: "Two-handed",
    length: "3.2m (10ft)",
    weight: "2.7kg (6lb)",
    damage: "2-12",
    price: 45,
    description: "Long thrusting polearm",
    itemId: "polearm_1",
  },
  {
    id: 11,
    name: "Beaked Axe",
    type: "Weapon",
    category: "PoleArms",
    handed: "Two-handed",
    length: "2.3m (7.5ft)",
    weight: "2.3kg (5lb)",
    damage: "2-12",
    price: 40,
    description: "Polearm with axe head",
    itemId: "polearm_2",
  },
  {
    id: 12,
    name: "Berdiche",
    type: "Weapon",
    category: "PoleArms",
    handed: "Two-handed",
    length: "2.1m (7ft)",
    weight: "3.2kg (7lb)",
    damage: "2-12",
    price: 50,
    description: "Heavy cleaving polearm",
    itemId: "polearm_3",
  },
  {
    id: 13,
    name: "Glaive",
    type: "Weapon",
    category: "PoleArms",
    handed: "Two-handed",
    length: "2.3m (7.5ft)",
    weight: "2.7kg (6lb)",
    damage: "2-12",
    price: 40,
    description: "Single-edged blade on pole",
    itemId: "polearm_4",
  },
  {
    id: 14,
    name: "Halberd",
    type: "Weapon",
    category: "PoleArms",
    handed: "Two-handed",
    length: "2.2m (7.25ft)",
    weight: "2.3kg (5lb)",
    damage: "3-18",
    price: 60,
    description: "Versatile polearm combining axe and spear",
    itemId: "polearm_5",
  },
  {
    id: 15,
    name: "Pike",
    type: "Weapon",
    category: "PoleArms",
    handed: "Two-handed",
    length: "5.0m (16ft)",
    weight: "3.6kg (8lb)",
    damage: "1-8",
    price: 45,
    description: "Extra-long thrusting spear",
    itemId: "polearm_6",
  },
  {
    id: 16,
    name: "Scythe",
    type: "Weapon",
    category: "PoleArms",
    handed: "Two-handed",
    length: "2.4m (8ft)",
    weight: "2.3kg (5lb)",
    damage: "1-8",
    price: 45,
    description: "Farming tool adapted for combat",
    itemId: "polearm_7",
  },

  // Spears
  {
    id: 20,
    name: "Short Spear",
    type: "Weapon",
    category: "Spears",
    handed: "One-handed",
    length: "1.2-1.8m (4-6ft)",
    weight: "1.8kg (4lb)",
    damage: "1-6",
    price: 30,
    description: "Versatile thrusting weapon",
    itemId: "spear_1",
  },
  {
    id: 21,
    name: "Long Spear",
    type: "Weapon",
    category: "Spears",
    handed: "Two-handed",
    length: "2.1-3.0m (7-10ft)",
    weight: "2.9kg (6.5lb)",
    damage: "1-8",
    price: 40,
    description: "Long reach spear",
    itemId: "spear_2",
  },
  {
    id: 22,
    name: "Javelin",
    type: "Weapon",
    category: "Spears",
    handed: "One-handed",
    length: "2.1m (7ft)",
    weight: "1.8kg (4lb)",
    damage: "1-6",
    price: 30,
    description: "Throwing spear",
    itemId: "spear_3",
  },

  // Knives and Daggers
  {
    id: 30,
    name: "Dagger",
    type: "Weapon",
    category: "KnivesAndDaggers",
    handed: "One-handed",
    length: "0.2-0.5m (10-20in)",
    weight: "0.5kg (1lb)",
    damage: "1-6",
    price: 10,
    description: "Standard dagger",
    itemId: "dagger_1",
  },

  // Short Swords
  {
    id: 40,
    name: "Short Sword",
    type: "Weapon",
    category: "ShortSwords",
    handed: "One-handed",
    length: "0.7m (2.5ft)",
    weight: "1.4kg (3lb)",
    damage: "1-6",
    price: 40,
    description: "Standard short sword",
    itemId: "shortsword_1",
  },

  // Large Swords
  {
    id: 50,
    name: "Bastard Sword",
    type: "Weapon",
    category: "LargeSwords",
    handed: "Two-handed",
    length: "1.0m (3.75ft)",
    weight: "2.1kg (4.5lb)",
    damage: "1-8+2",
    price: 50,
    description: "Versatile two-handed sword",
    itemId: "largesword_1",
  },

  // Blunt Weapons
  {
    id: 60,
    name: "Mace",
    type: "Weapon",
    category: "BluntWeapons",
    handed: "One-handed",
    length: "0.7m (2.5ft)",
    weight: "2.0kg (4.5lb)",
    damage: "1-8",
    price: 40,
    description: "Heavy crushing weapon",
    itemId: "mace_1",
  },

  // Missile Weapons
  {
    id: 70,
    name: "Short Bow",
    type: "Weapon",
    category: "MissileWeapons",
    handed: "Two-handed",
    weight: "1kg (2lb)",
    damage: "1-6",
    price: 30,
    description: "Standard short bow",
    itemId: "missile_1",
  },

  // Miscellaneous
  {
    id: 80,
    name: "Bull Whip",
    type: "Weapon",
    category: "Miscellaneous",
    handed: "One-handed",
    length: "2.4m (8ft)",
    weight: "1.4kg (3lb)",
    damage: "1-8",
    price: 20,
    description: "Long-range whip",
    itemId: "misc_1",
  },

  // Additional Short Swords
  {
    id: 41,
    name: "Sabre",
    type: "Weapon",
    category: "ShortSwords",
    handed: "One-handed",
    length: "0.6m (2ft)",
    weight: "1.4kg (3lb)",
    damage: "1-6",
    price: 30,
    description: "Curved slashing sword",
    itemId: "shortsword_2",
  },
  {
    id: 42,
    name: "Scimitar",
    type: "Weapon",
    category: "ShortSwords",
    handed: "One-handed",
    length: "0.7m (2.5ft)",
    weight: "1.5kg (3.5lb)",
    damage: "1-6",
    price: 35,
    description: "Curved cavalry sword",
    itemId: "shortsword_3",
  },

  // Additional Large Swords
  {
    id: 51,
    name: "Claymore",
    type: "Weapon",
    category: "LargeSwords",
    handed: "Two-handed",
    length: "1.2m (4ft)",
    weight: "2.9kg (6.5lb)",
    damage: "2-12",
    price: 60,
    description: "Scottish great sword",
    itemId: "largesword_2",
  },
  {
    id: 52,
    name: "Flamberge",
    type: "Weapon",
    category: "LargeSwords",
    handed: "Two-handed",
    length: "1.3m (4.25ft)",
    weight: "3.4kg (7.5lb)",
    damage: "3-18",
    price: 70,
    description: "Wavy-bladed two-handed sword",
    itemId: "largesword_3",
  },

  // Additional Blunt Weapons
  {
    id: 61,
    name: "Morning Star",
    type: "Weapon",
    category: "BluntWeapons",
    handed: "One-handed",
    length: "0.8m (2.75ft)",
    weight: "1.0kg (2.5lb)",
    damage: "1-8",
    price: 40,
    description: "Spiked head mace",
    itemId: "mace_2",
  },
  {
    id: 62,
    name: "Quarterstaff",
    type: "Weapon",
    category: "BluntWeapons",
    handed: "Two-handed",
    length: "1.8m (6ft)",
    weight: "1.5kg (3.5lb)",
    damage: "1-8",
    price: 30,
    description: "Long wooden staff",
    itemId: "bluntweapon_1",
  },
  {
    id: 63,
    name: "Iron Staff",
    type: "Weapon",
    category: "BluntWeapons",
    handed: "Two-handed",
    length: "1.8-2.1m (6-7ft)",
    weight: "3.2kg (7lb)",
    damage: "1-8+2",
    price: 45,
    description: "Reinforced metal staff",
    itemId: "bluntweapon_2",
  },

  // Additional Missile Weapons
  {
    id: 71,
    name: "Crossbow",
    type: "Weapon",
    category: "MissileWeapons",
    handed: "Two-handed",
    weight: "3kg (7lb)",
    damage: "1-8",
    price: 60,
    description: "Mechanical bow with trigger",
    itemId: "missile_2",
  },
  {
    id: 72,
    name: "Arrows (Dozen)",
    type: "Ammunition",
    category: "MissileWeapons",
    weight: "N/A",
    price: 15,
    description: "Standard arrows (12)",
    itemId: "ammo_1",
  },

  // Additional Miscellaneous
  {
    id: 81,
    name: "Dart",
    type: "Weapon",
    category: "Miscellaneous",
    handed: "One-handed",
    length: "0.15m (6in)",
    weight: "170g (6oz)",
    damage: "1-4",
    price: 1,
    description: "Small throwing weapon",
    itemId: "misc_2",
  },

  // KNIVES & DAGGERS
  {
    name: "Dagger/Knife",
    type: "Melee",
    twoHanded: false,
    length: "0.2-0.5m / 10-20in",
    weight: "0.5kg / 1 lb",
    damage: "1-6",
    cost: 10,
    category: "Knives & Daggers",
    itemId: "dagger_1",
  },

  // SHORT SWORDS
  {
    name: "Short Sword",
    type: "Melee",
    twoHanded: false,
    length: "0.7m / 2.5 ft",
    weight: "1.4kg / 3 lb",
    damage: "1-6",
    cost: 40,
    category: "Short Swords",
    itemId: "shortsword_1",
  },
  {
    name: "Sabre",
    type: "Melee",
    twoHanded: false,
    length: "0.6m / 2 ft",
    weight: "1.4kg / 3 lb",
    damage: "1-6",
    cost: 30,
    category: "Short Swords",
    itemId: "shortsword_2",
  },
  {
    name: "Scimitar",
    type: "Melee",
    twoHanded: false,
    length: "0.7m / 2.5 ft",
    weight: "1.5kg / 3.5 lb",
    damage: "1-6",
    cost: 35,
    category: "Short Swords",
    itemId: "shortsword_3",
  },
  {
    name: "Falchion",
    type: "Melee",
    twoHanded: false,
    length: "0.8m / 2.75 ft",
    weight: "1.8kg / 4 lb",
    damage: "1-8",
    cost: 50,
    category: "Short Swords",
    itemId: "shortsword_4",
  },
  {
    name: "Cutlass",
    type: "Melee",
    twoHanded: false,
    length: "0.6m / 2 ft",
    weight: "1.4kg / 3 lb",
    damage: "1-6",
    cost: 35,
    category: "Short Swords",
    itemId: "shortsword_5",
  },

  // LARGE SWORDS
  {
    name: "Bastard Sword",
    type: "Melee",
    twoHanded: true,
    length: "1.0m / 3.75 ft",
    weight: "2.1kg / 4.5 lb",
    damage: "1-8 + 2",
    cost: 50,
    category: "Large Swords",
    itemId: "largesword_2",
  },
  {
    name: "Broadsword",
    type: "Melee",
    twoHanded: false,
    length: "0.9m / 3 ft",
    weight: "1.6kg / 3.5 lb",
    damage: "1-8",
    cost: 40,
    category: "Large Swords",
    itemId: "largesword_1",
  },
  {
    name: "Claymore",
    type: "Melee",
    twoHanded: true,
    length: "1.2m / 4 ft",
    weight: "2.9kg / 6.5 lb",
    damage: "2-12",
    cost: 60,
    category: "Large Swords",
    itemId: "largesword_2",
  },
  {
    name: "Flamberge",
    type: "Melee",
    twoHanded: true,
    length: "1.3m / 4.25 ft",
    weight: "3.4kg / 7.5 lb",
    damage: "3-18",
    cost: 70,
    category: "Large Swords",
    itemId: "largesword_3",
  },
  {
    name: "Long Sword",
    type: "Melee",
    twoHanded: false,
    length: "0.9m / 3 ft",
    weight: "1.6kg / 3.5 lb",
    damage: "1-8 + 2",
    cost: 55,
    category: "Large Swords",
    itemId: "largesword_4",
  },
  {
    name: "Two-Handed Sword",
    type: "Melee",
    twoHanded: true,
    length: "1.2m / 4 ft",
    weight: "2.1kg / 4.5 lb",
    damage: "2-12",
    cost: 60,
    category: "Large Swords",
    itemId: "largesword_5",
  },

  // BALL AND CHAIN WEAPONS
  {
    name: "Ball and Chain",
    type: "Melee",
    twoHanded: false,
    length: "0.9m / 3 ft",
    weight: "2.1kg / 4.5 lb",
    damage: "1-8",
    cost: 50,
    category: "Ball and Chain",
    itemId: "ballandchain_1",
  },
  {
    name: "Flail",
    type: "Melee",
    twoHanded: true,
    length: "1.6m / 5.25 ft",
    weight: "2.5kg / 5.5 lb",
    damage: "2-12",
    cost: 55,
    category: "Ball and Chain",
    itemId: "ballandchain_2",
  },
  {
    name: "Goupillon Flail",
    type: "Melee",
    twoHanded: true,
    length: "0.5m / 2 ft",
    weight: "2.1kg / 4.5 lb",
    damage: "3-18",
    cost: 60,
    category: "Ball and Chain",
    itemId: "ballandchain_3",
  },
  {
    name: "Mace & Chain",
    type: "Melee",
    twoHanded: false,
    length: "0.9m / 3 ft",
    weight: "2.1kg / 4.5 lb",
    damage: "2-12",
    cost: 50,
    category: "Ball and Chain",
    itemId: "ballandchain_4",
  },
  {
    name: "Nunchaku",
    type: "Melee",
    twoHanded: true,
    length: "0.8m / 2.75 ft",
    weight: "1.1kg / 2.5 lb",
    damage: "1-8",
    cost: 30,
    category: "Ball and Chain",
    itemId: "ballandchain_5",
  },

  // BLUNT WEAPONS
  {
    name: "Arab Mace",
    type: "Melee",
    twoHanded: false,
    length: "0.6m / 2 ft",
    weight: "1.4kg / 3 lb",
    damage: "1-8",
    cost: 40,
    category: "Blunt",
    itemId: "mace_1",
  },
  {
    name: "Mace",
    type: "Melee",
    twoHanded: false,
    length: "0.7m / 2.5 ft",
    weight: "2.0kg / 4.5 lb",
    damage: "1-8",
    cost: 40,
    category: "Blunt",
    itemId: "mace_2",
  },
  {
    name: "Hercules Club",
    type: "Melee",
    twoHanded: true,
    length: "1.2m / 4 ft",
    weight: "2.5kg / 5.5 lb",
    damage: "2-12",
    cost: 60,
    category: "Blunt",
    itemId: "bluntweapon_1",
  },
  {
    name: "Morning Star",
    type: "Melee",
    twoHanded: false,
    length: "0.8m / 2.75 ft",
    weight: "1.0kg / 2.5 lb",
    damage: "1-8",
    cost: 40,
    category: "Blunt",
    itemId: "mace_2",
  },
  {
    name: "Quarterstaff",
    type: "Melee",
    twoHanded: true,
    length: "1.8m / 6 ft",
    weight: "1.5kg / 3.5 lb",
    damage: "1-8",
    cost: 30,
    category: "Blunt",
    itemId: "bluntweapon_2",
  },
  {
    name: "Iron Staff",
    type: "Melee",
    twoHanded: true,
    length: "1.8-2.1m / 6-7 ft",
    weight: "3.2kg / 7 lb",
    damage: "1-8 + 2",
    cost: 45,
    category: "Blunt",
    itemId: "bluntweapon_3",
  },

  // MISSILE WEAPONS
  {
    name: "Short Bow",
    type: "Ranged",
    twoHanded: true,
    length: "N/A",
    weight: "1kg / 2 lb",
    damage: "1-6",
    cost: 30,
    category: "Missile",
    itemId: "missile_1",
  },
  {
    name: "Long Bow",
    type: "Ranged",
    twoHanded: true,
    length: "N/A",
    weight: "2kg / 4 lb",
    damage: "2-12",
    cost: 70,
    category: "Missile",
    itemId: "missile_2",
  },
  {
    name: "Arrows (Dozen)",
    type: "Ammunition",
    twoHanded: false,
    length: "N/A",
    weight: "N/A",
    damage: "N/A",
    cost: 15,
    category: "Missile",
    itemId: "ammo_1",
  },
  {
    name: "Crossbow",
    type: "Ranged",
    twoHanded: true,
    length: "N/A",
    weight: "3kg / 7 lb",
    damage: "1-8",
    cost: 60,
    category: "Missile",
    itemId: "missile_2",
  },
  {
    name: "Bolts (Dozen)",
    type: "Ammunition",
    twoHanded: false,
    length: "N/A",
    weight: "N/A",
    damage: "N/A",
    cost: 15,
    category: "Missile",
    itemId: "ammo_1",
  },
  {
    name: "Sling",
    type: "Ranged",
    twoHanded: false,
    length: "N/A",
    weight: "57g / 2 oz",
    damage: "1-6",
    cost: 10,
    category: "Missile",
    itemId: "missile_3",
  },

  // MISCELLANEOUS
  {
    name: "Black Jack",
    type: "Melee",
    twoHanded: false,
    length: "0.25m / 10 in",
    weight: "1.4kg / 3 lb",
    damage: "1-4",
    cost: 8,
    category: "Miscellaneous",
    itemId: "misc_1",
  },
  {
    name: "Dart",
    type: "Ranged",
    twoHanded: false,
    length: "0.15m / 6 in",
    weight: "170g / 6 oz",
    damage: "1-4",
    cost: 1,
    category: "Miscellaneous",
    itemId: "misc_2",
  },
  {
    name: "Bull Whip",
    type: "Melee",
    twoHanded: false,
    length: "2.4m / 8 ft",
    weight: "1.4kg / 3 lb",
    damage: "1-8",
    cost: 20,
    category: "Miscellaneous",
    itemId: "misc_3",
  },
  {
    name: "Meat Cleaver",
    type: "Melee",
    twoHanded: false,
    length: "0.3m / 1 ft",
    weight: "0.5kg / 1 lb",
    damage: "1-6",
    cost: 2,
    category: "Miscellaneous",
    itemId: "misc_4",
  },
  {
    name: "Shovel",
    type: "Melee",
    twoHanded: true,
    length: "1.2m / 4 ft",
    weight: "2.0kg / 5 lb",
    damage: "1-6",
    cost: 10,
    category: "Miscellaneous",
    itemId: "misc_5",
  },
];

// Define starter equipment packages
export const starterEquipment = {
  // Men at Arms Category
  MenAtArms: {
    basic: [
      {
        id: "clothes_1",
        name: "Set of clothes",
        category: "Clothing",
        price: 0,
      },
      { id: "boots_1", name: "Boots", category: "Clothing", price: 0 },
      { id: "belt_1", name: "Belt", category: "Clothing", price: 0 },
      { id: "sack_1", name: "Large sack", category: "Containers", price: 0 },
      { id: "sack_2", name: "Small sack", category: "Containers", price: 0 },
      {
        id: "weapon_1",
        name: "Low-quality weapon",
        category: "Weapons",
        price: 0,
      },
    ],
    startingGold: 120,
    special: {
      Soldier: {
        additional: [
          {
            id: "uniform_1",
            name: "Military uniform",
            category: "Clothing",
            price: 0,
          },
          {
            id: "insignia_1",
            name: "Military insignia",
            category: "Equipment",
            price: 0,
          },
        ],
      },
    },
  },

  // Men of Magic Category
  MenOfMagic: {
    basic: [
      {
        id: "clothes_1",
        name: "Set of clothes",
        category: "Clothing",
        price: 0,
      },
      { id: "boots_1", name: "Boots", category: "Clothing", price: 0 },
      { id: "belt_1", name: "Belt", category: "Clothing", price: 0 },
      { id: "sack_1", name: "Large sack", category: "Containers", price: 0 },
      {
        id: "notebook_1",
        name: "Unused notebook",
        category: "Equipment",
        price: 0,
      },
      { id: "ink_1", name: "Ink", category: "Equipment", price: 0 },
      { id: "pen_1", name: "Pen and quills", category: "Equipment", price: 0 },
      { id: "chalk_1", name: "Chalk", category: "Equipment", price: 0 },
      { id: "candle_1", name: "Candle", category: "Lighting", price: 0 },
      { id: "knife_1", name: "Knife", category: "Weapons", price: 0 },
    ],
    startingGold: 110,
  },

  // Clergy Category
  Clergy: {
    basic: [
      {
        id: "clothes_1",
        name: "Set of clothes",
        category: "Clothing",
        price: 0,
      },
      { id: "boots_1", name: "Boots", category: "Clothing", price: 0 },
      { id: "belt_1", name: "Belt", category: "Clothing", price: 0 },
      { id: "backpack_1", name: "Backpack", category: "Containers", price: 0 },
      {
        id: "holywater_1",
        name: "Vial of holy water",
        category: "Equipment",
        price: 0,
      },
      {
        id: "candle_2",
        name: "Scented candle",
        category: "Lighting",
        price: 0,
      },
      { id: "bandages_1", name: "Bandages", category: "Equipment", price: 0 },
      {
        id: "incense_1",
        name: "Incense sticks (6)",
        category: "Equipment",
        price: 0,
      },
      { id: "knife_1", name: "Knife", category: "Weapons", price: 0 },
    ],
    startingGold: 105,
  },

  // Optional O.C.C.s Category
  Optional: {
    basic: [
      {
        id: "clothes_1",
        name: "Basic set of clothes",
        category: "Clothing",
        price: 0,
      },
      { id: "boots_1", name: "Boots", category: "Clothing", price: 0 },
      { id: "sack_1", name: "Sack", category: "Containers", price: 0 },
      {
        id: "weapon_1",
        name: "Low-quality weapon",
        category: "Weapons",
        price: 0,
      },
    ],
    startingGold: 50,
    special: {
      Noble: {
        startingGold: 200,
        equipment: "MenAtArms", // Uses Men at Arms equipment list
      },
    },
  },
};

// Shop object with enhanced functionality
const weaponShop = {
  name: "Weapons Shop",
  description: "A shop specializing in various weapons",
  owner: "Master Smith",

  // Get all weapons
  getItems() {
    return weapons;
  },

  // Get weapons by category
  getItemsByCategory(category) {
    return weapons.filter((weapon) => weapon.category === category);
  },

  // Get weapon by id
  getItemById(id) {
    return weapons.find((weapon) => weapon.id === id);
  },

  // Get weapons by hand type
  getItemsByHandType(handed) {
    return weapons.filter((weapon) => weapon.handed === handed);
  },

  // Get weapons by price range
  getItemsByPriceRange(minPrice, maxPrice) {
    return weapons.filter(
      (weapon) => weapon.price >= minPrice && weapon.price <= maxPrice
    );
  },

  // Get all available categories
  getCategories() {
    return [...new Set(weapons.map((weapon) => weapon.category))];
  },

  // Check if item is in stock
  isInStock(id) {
    return weapons.some((weapon) => weapon.id === id);
  },

  // Get starter equipment for a class
  getStarterEquipment(className) {
    // Find the category for the class using the backend data function
    const category = getClassCategory(className);

    if (!category || !starterEquipment[category]) {
      throw new Error(`No starter equipment found for class: ${className}`);
    }

    let equipment = [...starterEquipment[category].basic];
    let gold = starterEquipment[category].startingGold;

    // Check for special cases
    if (starterEquipment[category].special?.[className]) {
      const special = starterEquipment[category].special[className];
      if (special.additional) {
        equipment = [...equipment, ...special.additional];
      }
      if (special.startingGold) {
        gold = special.startingGold;
      }
      if (special.equipment) {
        equipment = [...starterEquipment[special.equipment].basic];
      }
    }

    return {
      equipment,
      startingGold: gold,
    };
  },

  // Calculate total cost of equipment
  calculateEquipmentCost(items) {
    return items.reduce((total, item) => total + (item.price || 0), 0);
  },

  // Selling price multiplier (items sell for 50% of their buy price)
  sellPriceMultiplier: 0.5,

  // Calculate selling price for an item
  calculateSellingPrice(item) {
    return Math.floor(item.price * this.sellPriceMultiplier);
  },

  // Sell an item
  sellItem(item) {
    if (!item || !item.id) {
      throw new Error("Invalid item");
    }

    const sellingPrice = this.calculateSellingPrice(item);

    return {
      success: true,
      message: `Sold ${item.name} for ${sellingPrice} gold`,
      soldItem: item,
      goldReceived: sellingPrice,
    };
  },

  // Sell multiple items
  sellItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Invalid items array");
    }

    const soldItems = items.map((item) => ({
      item,
      sellingPrice: this.calculateSellingPrice(item),
    }));

    const totalGold = soldItems.reduce(
      (sum, { sellingPrice }) => sum + sellingPrice,
      0
    );

    return {
      success: true,
      message: `Sold ${items.length} items for ${totalGold} gold`,
      soldItems,
      totalGoldReceived: totalGold,
    };
  },

  // Get item buy and sell prices
  getItemPrices(itemId) {
    const item = this.getItemById(itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    return {
      item: item,
      buyPrice: item.price,
      sellPrice: this.calculateSellingPrice(item),
    };
  },
};

export default weaponShop;

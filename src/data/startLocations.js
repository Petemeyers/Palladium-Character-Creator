// Palladium Fantasy RPG Starting Locations
export const startLocations = [
  // Eastern Territory
  {
    id: "tavern_eastern",
    label: "Tavern in Village",
    region: "Eastern Territory",
    description:
      "A cozy tavern in a small Eastern Territory village. Perfect for gathering rumors and meeting fellow adventurers.",
    suggestedSkills: [
      "Gambling",
      "Lore: Local",
      "Charm/Impress",
      "Detect Ambush",
      "Streetwise",
    ],
    npcTypes: [
      "Tavernkeeper",
      "Local Merchant",
      "Traveling Bard",
      "Retired Soldier",
    ],
    npcs: [
      {
        name: "Innkeeper",
        role: "Gruff but helpful, knows local rumors and gossip",
      },
      {
        name: "Barmaid",
        role: "Cheerful and talkative, loves to share stories about travelers",
      },
      {
        name: "Old Soldier",
        role: "Retired warrior with tales of past battles and military knowledge",
      },
    ],
  },
  {
    id: "inn_eastern",
    label: "Wayfarer's Inn",
    region: "Eastern Territory",
    description:
      "A well-known inn along the trade routes. Many travelers stop here.",
    suggestedSkills: [
      "Lore: Geography",
      "Charm/Impress",
      "Detect Concealment",
      "Streetwise",
    ],
    npcTypes: ["Innkeeper", "Merchant", "Caravan Guard", "Scholar"],
  },

  // Old Kingdom
  {
    id: "ruins_oldkingdom",
    label: "Ancient Ruins Camp",
    region: "Old Kingdom",
    description:
      "Camped near mysterious ruins. Ancient magic still lingers in the air.",
    suggestedSkills: [
      "Lore: Magic",
      "Detect Ambush",
      "Wilderness Survival",
      "Lore: Demons",
    ],
    npcTypes: ["Archaeologist", "Wizard", "Ruins Guide", "Treasure Hunter"],
  },
  {
    id: "village_oldkingdom",
    label: "Border Village",
    region: "Old Kingdom",
    description:
      "A small village on the edge of the Old Kingdom. People here are wary of strangers.",
    suggestedSkills: [
      "Charm/Impress",
      "Lore: Local",
      "Detect Ambush",
      "Streetwise",
    ],
    npcTypes: ["Village Elder", "Local Guard", "Herbalist", "Blacksmith"],
  },

  // Western Empire
  {
    id: "capital_inn",
    label: "Capital City Inn",
    region: "Western Empire",
    description:
      "A luxurious inn in the heart of the Western Empire's capital. Politics and intrigue abound.",
    suggestedSkills: [
      "Charm/Impress",
      "Lore: Politics",
      "Gambling",
      "Detect Concealment",
    ],
    npcTypes: ["Noble", "Courtier", "Merchant Prince", "Spy"],
    npcs: [
      {
        name: "Innkeeper",
        role: "Sophisticated and well-connected, knows political rumors and court gossip",
      },
      {
        name: "Merchant",
        role: "Shady trader with questionable goods and underworld connections",
      },
    ],
  },
  {
    id: "port_western",
    label: "Harbor District",
    region: "Western Empire",
    description: "The bustling harbor where ships from across the world dock.",
    suggestedSkills: [
      "Streetwise",
      "Lore: Geography",
      "Detect Ambush",
      "Charm/Impress",
    ],
    npcTypes: ["Ship Captain", "Dock Worker", "Merchant", "Smuggler"],
  },

  // Kingdom of Bizantium
  {
    id: "boat_bizantium",
    label: "On a Boat",
    region: "Kingdom of Bizantium",
    description:
      "Aboard a trading vessel sailing the Bizantium waters. Adventure awaits on distant shores.",
    suggestedSkills: [
      "Swimming",
      "Lore: Geography",
      "Charm/Impress",
      "Detect Ambush",
    ],
    npcTypes: ["Ship Captain", "First Mate", "Merchant", "Passenger"],
    npcs: [
      {
        name: "Captain",
        role: "Strict sailor obsessed with the sea, knows all the ports and dangers",
      },
      {
        name: "Deckhand",
        role: "Young and eager, knows local ports and loves to tell stories",
      },
      {
        name: "Merchant",
        role: "Shrewd trader with connections in distant lands",
      },
    ],
  },
  {
    id: "island_bizantium",
    label: "Island Port",
    region: "Kingdom of Bizantium",
    description:
      "A small island port where ships resupply. The locals know many secrets of the sea.",
    suggestedSkills: ["Lore: Local", "Charm/Impress", "Streetwise", "Swimming"],
    npcTypes: ["Port Master", "Fisherman", "Merchant", "Local Guide"],
  },

  // Great Northern Wilderness
  {
    id: "wilderness_camp",
    label: "Northern Wilderness Camp",
    region: "Great Northern Wilderness",
    description:
      "A remote camp in the harsh northern wilderness. Survival skills are essential here.",
    suggestedSkills: [
      "Wilderness Survival",
      "Tracking",
      "Detect Ambush",
      "Lore: Demons",
    ],
    npcTypes: ["Wilderness Guide", "Trapper", "Hermit", "Monster Hunter"],
    npcs: [
      {
        name: "Guide",
        role: "Experienced hunter who knows the wilds and its dangers",
      },
      {
        name: "Trapper",
        role: "Silent and observant, knows animal behavior and weather patterns",
      },
    ],
  },
  {
    id: "trading_post",
    label: "Frontier Trading Post",
    region: "Great Northern Wilderness",
    description:
      "A rough trading post on the edge of civilization. Only the brave venture here.",
    suggestedSkills: [
      "Streetwise",
      "Detect Ambush",
      "Charm/Impress",
      "Wilderness Survival",
    ],
    npcTypes: ["Trading Post Owner", "Frontier Scout", "Trapper", "Outlaw"],
  },

  // Yin-Sloth Jungles
  {
    id: "jungle_camp",
    label: "Jungle Encampment",
    region: "Yin-Sloth Jungles",
    description:
      "A hidden camp deep in the mysterious jungles. Ancient secrets and dangerous creatures lurk nearby.",
    suggestedSkills: [
      "Wilderness Survival",
      "Tracking",
      "Lore: Demons",
      "Detect Ambush",
    ],
    npcTypes: ["Jungle Guide", "Shaman", "Explorer", "Tribal Warrior"],
    npcs: [
      {
        name: "Scout",
        role: "Wary of monsters, knows jungle paths and hidden dangers",
      },
      {
        name: "Shaman",
        role: "Mysterious and wise, speaks in riddles and knows ancient secrets",
      },
    ],
  },
  {
    id: "ruins_jungle",
    label: "Lost Temple Ruins",
    region: "Yin-Sloth Jungles",
    description:
      "Ancient temple ruins hidden in the jungle. Powerful magic and ancient knowledge await.",
    suggestedSkills: [
      "Lore: Magic",
      "Lore: Demons",
      "Detect Concealment",
      "Wilderness Survival",
    ],
    npcTypes: ["Archaeologist", "Wizard", "Tribal Shaman", "Treasure Hunter"],
  },

  // Wolfen Empire
  {
    id: "wolfen_village",
    label: "Wolfen Border Village",
    region: "Wolfen Empire",
    description:
      "A village on the edge of Wolfen territory. The locals are fierce but honorable.",
    suggestedSkills: [
      "Charm/Impress",
      "Lore: Local",
      "Detect Ambush",
      "Streetwise",
    ],
    npcTypes: ["Village Chief", "Wolfen Warrior", "Trader", "Scout"],
  },
  {
    id: "wolfen_camp",
    label: "Wolfen War Camp",
    region: "Wolfen Empire",
    description:
      "A military camp where Wolfen warriors prepare for battle. Strength and honor are valued here.",
    suggestedSkills: [
      "Charm/Impress",
      "Lore: Military",
      "Detect Ambush",
      "Streetwise",
    ],
    npcTypes: ["War Chief", "Wolfen Warrior", "Scout", "Warrior"],
  },

  // Random/Adventure Starters
  {
    id: "caravan",
    label: "Traveling Caravan",
    region: "Various",
    description:
      "Part of a merchant caravan traveling between cities. Adventure could strike at any moment.",
    suggestedSkills: [
      "Lore: Geography",
      "Charm/Impress",
      "Detect Ambush",
      "Streetwise",
    ],
    npcTypes: ["Caravan Master", "Merchant", "Guard", "Traveler"],
  },
  {
    id: "dungeon_entrance",
    label: "Dungeon Entrance",
    region: "Various",
    description:
      "Standing before the entrance to an ancient dungeon. Treasure and danger await within.",
    suggestedSkills: [
      "Detect Concealment",
      "Lore: Magic",
      "Detect Ambush",
      "Wilderness Survival",
    ],
    npcTypes: ["Dungeon Guide", "Treasure Hunter", "Wizard", "Monster Hunter"],
  },
];

// Helper function to get locations by region
export const getLocationsByRegion = (region) => {
  return startLocations.filter(
    (location) => location.region === region || location.region === "Various"
  );
};

// Helper function to get random location
export const getRandomLocation = () => {
  const randomIndex = Math.floor(Math.random() * startLocations.length);
  return startLocations[randomIndex];
};

// Helper function to get location by ID
export const getLocationById = (id) => {
  return startLocations.find((location) => location.id === id);
};

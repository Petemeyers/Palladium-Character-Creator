class LocalChatModel {
  constructor() {
    this.responses = {
      greetings: [
        "Welcome brave adventurer! How may I assist you on your journey?",
        "Greetings, traveler! What brings you to these parts?",
        "Well met! Are you ready to begin your quest?",
      ],
      combat: [
        "Roll for initiative! Your opponent looks fierce.",
        "You ready your weapon as the enemy approaches.",
        "The air grows tense as combat begins.",
      ],
      exploration: [
        "You find yourself in a mysterious location. What do you wish to do?",
        "The path ahead holds many secrets. How do you proceed?",
        "Your surroundings hold both danger and opportunity.",
      ],
      default: [
        "What would you like to do next?",
        "The choice is yours, adventurer.",
        "Your next action could change everything.",
      ],
    };

    this.keywords = {
      greetings: ["hello", "hi", "greetings", "hey"],
      combat: ["fight", "attack", "battle", "weapon"],
      exploration: ["look", "search", "explore", "investigate"],
    };
  }

  async initialize() {
    return true;
  }

  classifyIntent(text) {
    const lowText = text.toLowerCase();
    const scores = {};

    Object.keys(this.keywords).forEach((category) => {
      scores[category] = this.keywords[category].reduce(
        (score, word) => score + (lowText.includes(word) ? 1 : 0),
        0
      );
    });

    const maxScore = Math.max(...Object.values(scores));
    const category =
      maxScore > 0
        ? Object.keys(scores).find((key) => scores[key] === maxScore)
        : "default";

    return category;
  }

  async getResponse(text, character) {
    const category = this.classifyIntent(text);
    const responses = this.responses[category];
    const randomIndex = Math.floor(Math.random() * responses.length);

    return {
      message: `[${character.name} the ${character.class}] ${responses[randomIndex]}`,
    };
  }
}

export const localChatModel = new LocalChatModel();

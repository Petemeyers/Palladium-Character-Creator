// Cryptographically secure dice rolling utility
class CryptoSecureDice {
  static rollDie(sides) {
    if (sides < 1 || sides > 1000) {
      throw new Error("Invalid die size. Must be between 1 and 1000.");
    }

    // Create a cryptographically secure random value
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);

    // Convert to 0-1 range avoiding modulo bias
    return (array[0] / (0xffffffff + 1)) * sides + 1;
  }

  static rollDice(numDice, sides) {
    if (numDice < 1 || numDice > 200) {
      throw new Error("Invalid number of dice. Must be between 1 and 200.");
    }

    const results = [];
    let total = 0;

    for (let i = 0; i < numDice; i++) {
      const roll = Math.floor(this.rollDie(sides));
      results.push(roll);
      total += roll;
    }

    return {
      individualRolls: results,
      total: total,
      formula: `${numDice}d${sides}`,
      description: `${numDice}d${sides}: ${results.join("+")} = ${total}`,
    };
  }

  static rollD20() {
    return Math.floor(this.rollDie(20));
  }

  static rollD100() {
    return Math.floor(this.rollDie(100));
  }

  static rollPercentile() {
    return Math.floor(this.rollDie(100));
  }

  static parseAndRoll(formula, bonus = 0) {
    if (formula == null) {
      throw new Error("Invalid dice formula: null");
    }

    const cleaned = String(formula).trim();
    const makeResult = (total, rolls = []) => {
      const totalWithBonus = total + bonus;
      return {
        individualRolls: rolls,
        total,
        formula: cleaned || "0",
        description: `${cleaned || "0"} = ${total}`,
        bonus,
        totalWithBonus,
        fullDescription:
          bonus && bonus !== 0
            ? `${cleaned || "0"} = ${total} + ${bonus} = ${totalWithBonus}`
            : `${cleaned || "0"} = ${total}`,
      };
    };

    if (!cleaned || /^none\b/i.test(cleaned)) {
      return makeResult(0, []);
    }

    const diceMatch = cleaned.match(/(\d+)d(\d+)([+-]\d+)?/i);
    if (diceMatch) {
      const numDice = parseInt(diceMatch[1], 10);
      const sides = parseInt(diceMatch[2], 10);
      const modifier = diceMatch[3] ? parseInt(diceMatch[3], 10) : 0;

      const diceResult = this.rollDice(numDice, sides);
      const total = diceResult.total + modifier;

      const totalWithBonus = total + bonus;
      return {
        ...diceResult,
        bonus,
        totalWithBonus,
        fullDescription:
          modifier || bonus
            ? `${diceResult.description}${
                modifier
                  ? modifier > 0
                    ? ` + ${modifier}`
                    : ` ${modifier}`
                  : ""
              }${bonus ? ` + ${bonus}` : ""} = ${totalWithBonus}`
            : diceResult.description,
      };
    }

    const numberMatch = cleaned.match(/-?\d+/);
    if (numberMatch) {
      const value = parseInt(numberMatch[0], 10);
      return makeResult(value, [value]);
    }

    return makeResult(0, []);
  }

  // Combat specific functions
  static rollInitiative(speedBonus = 0) {
    const d20 = this.rollD20();
    return d20 + speedBonus;
  }

  static rollAttack(strikeBonus = 0) {
    const d20 = this.rollD20();
    return d20 + strikeBonus;
  }

  static rollDamage(formula, damageBonus = 0) {
    const result = this.parseAndRoll(formula, damageBonus);
    return result.totalWithBonus;
  }

  static rollDamageDetailed(formula, damageBonus = 0) {
    return this.parseAndRoll(formula, damageBonus);
  }

  static rollSavingThrow(target, bonus = 0) {
    const d20 = this.rollD20();
    const total = d20 + bonus;
    return {
      d20: d20,
      bonus: bonus,
      total: total,
      success: total >= target,
    };
  }

  static isCriticalHit(d20Result) {
    return d20Result === 20;
  }

  static isFumble(d20Result) {
    return d20Result === 1;
  }
}

// Parse damage formula to extract dice notation and bonuses
export function parseDamageFormula(formula) {
  if (!formula || typeof formula !== "string") {
    return { base: "0", bonus: 0 };
  }

  const cleaned = formula.trim();
  const match = cleaned.match(/^(\d+d\d+)([+-]\d+)?/i);

  if (match) {
    return {
      base: match[1],
      bonus: match[2] ? parseInt(match[2], 10) : 0,
    };
  }

  // If it's just a number
  const numberMatch = cleaned.match(/^-?\d+$/);
  if (numberMatch) {
    return {
      base: "0",
      bonus: parseInt(numberMatch[0], 10),
    };
  }

  return { base: "0", bonus: 0 };
}

export default CryptoSecureDice;

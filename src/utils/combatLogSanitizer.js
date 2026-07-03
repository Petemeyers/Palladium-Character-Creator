const MOJIBAKE_PREFIX = /^(?:Ã|Â|â|ð|�)\S*\s+/u;
const DECORATIVE_PREFIX = /^(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}])+\s+/u;
const MOJIBAKE_TOKEN = /\S*(?:Ã|Â|â|ð|�)\S*/gu;

function normalizeCombatLogPunctuation(message) {
  const crowded = message.match(/^Crowded conditions\s*\((\d+) nearby combatants\)\.?$/i);
  if (crowded) return `Crowded conditions: ${crowded[1]} nearby combatants.`;

  const shouldEndWithPeriod =
    /^Weapon details:/i.test(message) ||
    /\bis \d+(?:\.\d+)?ft from\b/i.test(message) ||
    /\bhas \d+ melee and \d+ ranged weapons\b/i.test(message) ||
    /\bselects .+ for (?:melee|ranged) combat\b/i.test(message) ||
    /\bwill attack with\b/i.test(message);
  return shouldEndWithPeriod && !/[.!?]$/.test(message) ? `${message}.` : message;
}

export function sanitizeCombatLogMessage(message) {
  let text = String(message ?? "").trim();
  text = text.replace(MOJIBAKE_PREFIX, "").replace(DECORATIVE_PREFIX, "");
  text = text.replace(
    /(melee range:\s*)\S*(?:Ã|Â|â|ð|�)\S*/giu,
    (_, prefix) => `${prefix}5ft)`,
  );
  text = text.replace(MOJIBAKE_TOKEN, "").replace(/\s{2,}/g, " ").trim();
  return normalizeCombatLogPunctuation(text);
}

export default sanitizeCombatLogMessage;

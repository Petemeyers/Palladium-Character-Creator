const NARRATABLE_TYPES = new Set([
  "combat",
  "hit",
  "miss",
  "critical",
  "victory",
  "defeat",
  "warning",
]);

const SKIP_PATTERNS = [
  "ENGINE_CALL",
  "turn effect",
  "Schedule canceled",
  "remainingActions",
  "Weapon details",
  "has 0 melee",
  "has 0 ranged",
];

function cleanMessage(message = "") {
  return String(message)
    .replace(/[ðŸ§ªâœ…ðŸ”ðŸ“âš”ï¸ðŸŽ²ðŸ’¥ðŸƒðŸš«âž¡ï¸ðŸŸ¦ðŸ¤–]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function shouldNarrateLogEntry(entry) {
  if (!entry?.message) return false;
  if (entry.type === "narration") return false;
  if (entry.type === "info") return false;

  const message = String(entry.message);

  if (SKIP_PATTERNS.some((pattern) => message.includes(pattern))) {
    return false;
  }

  if (NARRATABLE_TYPES.has(entry.type)) return true;

  const lower = message.toLowerCase();

  return (
    lower.includes("attacks") ||
    lower.includes("casts") ||
    lower.includes("damage") ||
    lower.includes("hit") ||
    lower.includes("miss") ||
    lower.includes("flee") ||
    lower.includes("routes") ||
    lower.includes("defeated") ||
    lower.includes("victory") ||
    lower.includes("falls") ||
    lower.includes("plummets")
  );
}

export function buildNarrationContext({
  entry,
  fighters = [],
  positions = {},
  arenaEnvironment = null,
  recentLog = [],
}) {
  const fightersLite = fighters.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    currentHP: f.currentHP,
    maxHP: f.maxHP,
    status: f.status,
    condition: f.condition,
    remainingActions: f.remainingActions,
  }));

  return {
    event: {
      id: entry.id,
      type: entry.type,
      message: cleanMessage(entry.message),
      diceInfo: entry.diceInfo || null,
      timestamp: entry.timestamp,
    },
    arena: {
      name:
        arenaEnvironment?.name ||
        arenaEnvironment?.environmentName ||
        arenaEnvironment?.id ||
        "combat arena",
      terrain:
        arenaEnvironment?.terrain ||
        arenaEnvironment?.type ||
        "open battlefield",
    },
    fighters: fightersLite,
    positions,
    recentLog: recentLog
      .slice(0, 6)
      .map((x) => cleanMessage(x.message))
      .filter(Boolean),
  };
}

export function templateCombatNarration(context) {
  const message = context?.event?.message || "";
  const lower = message.toLowerCase();

  if (lower.includes("victory")) {
    return "The battlefield goes still as the last enemy falls. For a moment, only the echo of combat remains.";
  }

  if (lower.includes("defeat")) {
    return "The fight turns grim as the party is overwhelmed, the arena falling into the enemy's control.";
  }

  if (lower.includes("critical")) {
    return `A brutal opening astaminaars in the chaos. ${message}`;
  }

  if (lower.includes("miss")) {
    return `The attack cuts through the air, but the target slips away at the last moment. ${message}`;
  }

  if (lower.includes("hit") || lower.includes("damage")) {
    return `The blow lands with fraidere, changing the rhythm of the fight. ${message}`;
  }

  if (lower.includes("casts")) {
    return `Power gathers in the arena as training is called into the battle. ${message}`;
  }

  if (lower.includes("attacks")) {
    return `The combatant commits to the attack, pressing the attack in the heat of battle. ${message}`;
  }

  if (lower.includes("flee") || lower.includes("routes")) {
    return `Fear takes over. One fighter breaks from the fight and tries to escape the battlefield. ${message}`;
  }

  if (lower.includes("falls") || lower.includes("plummets")) {
    return `The impact is sudden and violent as the fighter is brought down hard. ${message}`;
  }

  return `The battle shifts. ${message}`;
}

export async function narrateCombatEntry(context, options = {}) {
  const { mode = "template", model = "llama3.2" } = options;

  if (mode !== "local-llm") {
    return templateCombatNarration(context);
  }

  const prompt = `
You are a tabletop fantasy GM narrating a Medieval Combat Simulator-style combat scene.

Rules:
- Narrate only what already hastaminaned.
- Do not invent new attacks.
- Do not invent damage.
- Do not change HP.
- Do not decide turns.
- Do not mention that you are reading a log.
- Keep it to 1 or 2 sentences.
- Use vivid but clear tabletop GM style.

Combat event:
${context.event.message}

Arena:
${context.arena.name}, ${context.arena.terrain}

Recent log:
${context.recentLog.join("\n")}
`;

  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      return templateCombatNarration(context);
    }

    const data = await response.json();
    const text = data?.message?.content?.trim();

    return text || templateCombatNarration(context);
  } catch {
    return templateCombatNarration(context);
  }
}

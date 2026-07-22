export const COMBAT_APPEARANCE_TOKENS = Object.freeze({
  light: Object.freeze({
    party: "#2563eb", partyInner: "#60a5fa", ally: "#0d9488", allyInner: "#5eead4",
    enemy: "#dc2626", enemyInner: "#f87171", neutral: "#64748b", neutralInner: "#cbd5e1",
    active: "#ffd400", selected: "#fde047", target: "#ef4444", routed: "#c2410c",
    surrenderPending: "#e2e8f0", surrendered: "#f8fafc", captured: "#7c3aed",
    grappled: "#06b6d4", prone: "#0891b2", unconscious: "#4b5563", dead: "#111827",
    wounded: "#f59e0b", critical: "#be123c",
  }),
  dark: Object.freeze({
    party: "#60a5fa", partyInner: "#93c5fd", ally: "#2dd4bf", allyInner: "#99f6e4",
    enemy: "#f87171", enemyInner: "#fca5a5", neutral: "#94a3b8", neutralInner: "#e2e8f0",
    active: "#ffdf20", selected: "#fef08a", target: "#fb7185", routed: "#ea580c",
    surrenderPending: "#f1f5f9", surrendered: "#ffffff", captured: "#a78bfa",
    grappled: "#22d3ee", prone: "#06b6d4", unconscious: "#6b7280", dead: "#030712",
    wounded: "#fbbf24", critical: "#fb7185",
  }),
});

export function getCombatAppearanceTokens(colorMode = "light") {
  return COMBAT_APPEARANCE_TOKENS[colorMode === "dark" ? "dark" : "light"];
}

export default COMBAT_APPEARANCE_TOKENS;

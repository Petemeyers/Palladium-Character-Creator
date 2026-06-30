export const COMBAT_COMMAND_LAYOUT = {
  primaryLabel: "Primary Manual Controls",
  commandCenterLabel: "Combat Command Center",
  actionCatalogLabel: "Combat Action Catalog",
  selectedActionLabel: "Selected Combat Action",
  compatibilityLabel: "Legacy / Compatibility Tools",
  compatibilityToolsLabel: "Fallback Testing",
  compatibilityDescription:
    "Older controls preserved for fallback testing.",
  defaultCompatibilityCollapsed: true,
  order: [
    "Combat Command Center",
    "Combat Action Catalog",
    "Selected Combat Action",
    "Combat Log / Status Panels",
    "Legacy / Compatibility Tools",
  ],
};

export const buildCombatCommandLayoutSummary = () => ({
  ...COMBAT_COMMAND_LAYOUT,
  order: [...COMBAT_COMMAND_LAYOUT.order],
});

export default {
  COMBAT_COMMAND_LAYOUT,
  buildCombatCommandLayoutSummary,
};

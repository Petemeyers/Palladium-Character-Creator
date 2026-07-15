export const COMBAT_COMMAND_LAYOUT = {
  primaryLabel: "Primary Manual Controls",
  commandCenterLabel: "Combat Command Center",
  actionCatalogLabel: "Combat Action Catalog",
  selectedActionLabel: "Selected Combat Action",
  compatibilityLabel: "Advanced Combat Tools",
  compatibilityToolsLabel: "Advanced Tools",
  compatibilityDescription:
    "Additional combat controls preserved for the current engine.",
  defaultCompatibilityCollapsed: true,
  order: [
    "Combat Command Center",
    "Combat Action Catalog",
    "Selected Combat Action",
    "Combat Log / Status Panels",
    "Advanced Combat Tools",
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

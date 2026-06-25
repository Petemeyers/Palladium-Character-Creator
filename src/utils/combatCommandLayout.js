export const COMBAT_COMMAND_LAYOUT = {
  primaryLabel: "Primary Manual Controls",
  commandCenterLabel: "Combat Command Center",
  actionCatalogLabel: "Combat Action Catalog",
  selectedActionLabel: "Selected Combat Action",
  compatibilityLabel: "Compatibility Combat Controls",
  compatibilityToolsLabel: "Legacy/Compatibility Tools",
  compatibilityDescription:
    "These controls are preserved for compatibility while the Combat Command Center becomes the primary manual combat flow.",
  defaultCompatibilityCollapsed: true,
  order: [
    "Combat Command Center",
    "Combat Action Catalog",
    "Selected Combat Action",
    "Combat Log / Status Panels",
    "Compatibility Combat Controls",
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

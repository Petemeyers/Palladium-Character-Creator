const toFinite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export const sumAttackModifierComponents = (components = {}) => (
  Object.values(components || {}).reduce((total, value) => total + toFinite(value), 0)
);

export const reconcileAttackRollModifierLedger = ({
  naturalRoll,
  reportedTotal,
  modifierComponents = {},
} = {}) => {
  const natural = toFinite(naturalRoll);
  const reported = toFinite(reportedTotal);
  const modifier = sumAttackModifierComponents(modifierComponents);
  const canonicalTotal = natural + modifier;
  return {
    naturalRoll: natural,
    reportedTotal: reported,
    modifier,
    canonicalTotal,
    corrected: reported !== canonicalTotal,
    delta: reported - canonicalTotal,
    modifierComponents: { ...modifierComponents },
  };
};

const hasOwn = (value, key) => Boolean(value && Object.prototype.hasOwnProperty.call(value, key));

function finiteCandidate(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function validateCanonicalNaturalD20(value, context = {}) {
  const valid = (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 20
  );
  return Object.freeze({
    ok: valid,
    naturalRoll: valid ? value : null,
    rejectedValue: valid ? null : value,
    rejectionReason: valid ? null : "invalid-natural-d20-boundary",
    ...context,
  });
}

export function normalizeCanonicalD20Roll(result, {
  actionType = null,
  actorId = null,
  executionKey = null,
  rollKind = null,
  modifier: requestedModifier = 0,
} = {}) {
  let naturalRoll = null;
  let sourceShape = "unsupported";
  if (finiteCandidate(result) !== null) {
    naturalRoll = finiteCandidate(result);
    sourceShape = typeof result === "number" ? "number" : "numeric-string";
  } else if (result && typeof result === "object") {
    const candidates = [
      ["naturalRoll", result.naturalRoll],
      ["roll", result.roll],
      ["d20", result.d20],
      ["individualRolls[0]", Array.isArray(result.individualRolls) ? result.individualRolls[0] : null],
    ];
    const supported = candidates.find(([, value]) => finiteCandidate(value) !== null);
    if (supported) {
      sourceShape = supported[0];
      naturalRoll = finiteCandidate(supported[1]);
    }
  }

  const hasEmbeddedModifier = Boolean(
    result && typeof result === "object" && (hasOwn(result, "modifier") || hasOwn(result, "bonus")),
  );
  const embeddedModifier = result && typeof result === "object"
    ? hasOwn(result, "modifier") ? result.modifier
      : hasOwn(result, "bonus") ? result.bonus
        : requestedModifier
    : requestedModifier;
  const modifier = finiteCandidate(embeddedModifier);
  let total = naturalRoll !== null && modifier !== null ? naturalRoll + modifier : null;
  if (result && typeof result === "object" && hasOwn(result, "total") && (hasEmbeddedModifier || modifier === 0)) {
    const suppliedTotal = finiteCandidate(result.total);
    if (suppliedTotal !== null) total = suppliedTotal;
  }
  const naturalBoundary = validateCanonicalNaturalD20(naturalRoll, {
    actionType,
    actorId,
    executionKey,
    rollKind,
  });
  const ok = naturalBoundary.ok && Number.isFinite(modifier) && Number.isFinite(total);
  const rejectionReason = ok
    ? null
    : !naturalBoundary.ok
      ? naturalRoll === null
        ? "missing-or-invalid-natural-roll"
        : naturalBoundary.rejectionReason
      : !Number.isFinite(modifier)
        ? "missing-or-invalid-modifier"
        : "missing-or-invalid-total";
  return Object.freeze({
    ok,
    naturalRoll,
    modifier,
    total,
    sourceShape,
    rejectionReason,
    actionType,
    actorId,
    executionKey,
    rollKind,
  });
}

export default normalizeCanonicalD20Roll;

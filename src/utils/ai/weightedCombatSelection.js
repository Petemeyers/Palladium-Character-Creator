export function selectWeightedCandidate({ candidates = [], rng } = {}) {
  const rejectedCandidates = [];
  const eligible = [];

  for (const candidate of candidates || []) {
    const weight = Number(candidate?.weight ?? candidate?.score ?? 0);
    if (!Number.isFinite(weight)) {
      rejectedCandidates.push({ ...candidate, rejected: true, reason: "non-finite-weight" });
      continue;
    }
    if (weight <= 0 || candidate?.rejected === true) {
      rejectedCandidates.push({ ...candidate, rejected: true, reason: candidate?.reason || "non-positive-weight" });
      continue;
    }
    eligible.push({ ...candidate, weight });
  }

  const totalWeight = eligible.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (!eligible.length || totalWeight <= 0 || !Number.isFinite(totalWeight)) {
    return {
      candidate: null,
      totalWeight: 0,
      draw: null,
      normalizedDraw: null,
      cumulativeStart: null,
      cumulativeEnd: null,
      cumulativeRanges: [],
      rejectedCandidates,
      reason: "no-positive-weight-candidates",
    };
  }

  const normalizedDraw = Math.max(0, Math.min(0.999999999, typeof rng === "function" ? Number(rng()) || 0 : 0));
  const draw = normalizedDraw * totalWeight;
  let cursor = draw;
  let cumulativeStart = 0;
  const cumulativeRanges = [];

  for (const candidate of eligible) {
    const cumulativeEnd = cumulativeStart + candidate.weight;
    const range = {
      id: candidate.id ?? candidate.technique,
      start: cumulativeStart,
      end: cumulativeEnd,
      weight: candidate.weight,
    };
    cumulativeRanges.push(range);
    cursor -= candidate.weight;
    if (cursor <= 0) {
      return {
        candidate,
        totalWeight,
        draw,
        normalizedDraw,
        cumulativeStart,
        cumulativeEnd,
        cumulativeRanges,
        rejectedCandidates,
      };
    }
    cumulativeStart = cumulativeEnd;
  }

  const candidate = eligible[eligible.length - 1];
  const finalRange = cumulativeRanges[cumulativeRanges.length - 1];
  return {
    candidate,
    totalWeight,
    draw,
    normalizedDraw,
    cumulativeStart: finalRange.start,
    cumulativeEnd: finalRange.end,
    cumulativeRanges,
    rejectedCandidates,
  };
}

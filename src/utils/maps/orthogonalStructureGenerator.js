import {
  applyOrthogonalStructureBoxDrag,
  buildOrthogonalStructureBoxRoute,
  cellToOrthogonalStructurePoint,
} from "./orthogonalStructureAuthority.js";

/**
 * Milestone 8C-8C.2 R5 — single-drag orthogonal wall / box authoring.
 *
 * Hex terrain does NOT dictate the wall direction.
 * - aligned drag => one straight orthogonal wall
 * - diagonal drag => one closed rectangular wall box
 *
 * This intentionally replaces the old horizontal-first / vertical-first
 * two-segment corner gesture while preserving the public function names used
 * by MapMakerPage and TacticalMap.
 */
export function applyOrthogonalHexStructureWallLine(options = {}) {
  return applyOrthogonalStructureBoxDrag({
    ...options,
    mapType: "hex",
  });
}

export function buildOrthogonalHexStructurePreview({
  startCell,
  endCell,
  step = 1,
} = {}) {
  const start = cellToOrthogonalStructurePoint(startCell, "hex", step);
  const end = cellToOrthogonalStructurePoint(endCell, "hex", step);
  return buildOrthogonalStructureBoxRoute({ start, end, step });
}

export default applyOrthogonalHexStructureWallLine;

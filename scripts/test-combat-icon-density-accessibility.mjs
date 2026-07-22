import assert from "node:assert/strict";
import fs from "node:fs";
import { getCombatIconAppearance } from "../src/utils/presentation/getCombatIconAppearance.js";

const fighter = {
  id: "dense-knight", name: "Knight #1", team: "party", currentHP: 2, maxHP: 24,
  moraleState: { status: "ROUTED" }, isProne: true,
  grappleState: { state: "grapple_ground", positionState: "ground", opponent: "enemy" },
};
const value = getCombatIconAppearance({
  fighter, activeFighterId: fighter.id, selectedFighterId: fighter.id, targetFighterId: fighter.id,
});
assert.equal(value.allegiance.baseColor, "#2563eb");
assert.ok(value.rings.length <= 2, "one primary status plus one interaction ring is the visible maximum");
assert.equal(value.rings.filter((ring) => ["routed", "grappled", "prone"].includes(ring.key)).length, 1);
assert.equal(value.rings.filter((ring) => ["active", "selected", "target"].includes(ring.key)).length, 1);
assert.equal(value.rings[0].key, "routed");
assert.equal(value.rings[0].style, "dashed");
assert.equal(value.rings[1].key, "target");
assert.ok(value.accessibleLabel.includes("Routed or panicked"));
assert.ok(value.accessibleLabel.includes("Grappled"));
assert.ok(value.accessibleLabel.includes("Grounded or prone"));
assert.doesNotMatch(value.status.marker, /ROUTE|YIELD|CAP|LINK|DOWN|KO|DEAD/);

const interactionOnly = getCombatIconAppearance({
  fighter: { id: "active-knight", name: "Active Knight", team: "party", currentHP: 24, maxHP: 24 },
  activeFighterId: "active-knight",
  selectedFighterId: "active-knight",
});
assert.equal(interactionOnly.statusMarker, null, "active and selected state is conveyed by rings, not token words");
assert.match(interactionOnly.accessibleLabel, /Active turn; Selected/);

const healthOnly = getCombatIconAppearance({
  fighter: { id: "wounded-knight", name: "Wounded Knight", team: "party", currentHP: 10, maxHP: 24 },
});
assert.doesNotMatch(healthOnly.secondaryMarkers[0]?.marker || "", /[A-Za-z]{2,}/, "health fallback uses a compact glyph");
assert.match(healthOnly.accessibleLabel, /Wounded/);

const tacticalMap = fs.readFileSync(new URL("../src/components/TacticalMap.jsx", import.meta.url), "utf8");
const labels = fs.readFileSync(new URL("../src/utils/mapCombatantLabels.js", import.meta.url), "utf8");
assert.match(tacticalMap, /iconAppearance\.statusMarker/);
assert.doesNotMatch(tacticalMap, /\{iconAppearance\.secondaryMarkers\[0\]\.marker\}/);
assert.match(tacticalMap, /width="68"/);
assert.match(tacticalMap, /L \$\{iconX\} \$\{iconY - 12\} Z/);
assert.doesNotMatch(labels, /\$\{name\} Current/);

console.log("combat icon density and accessibility passed");

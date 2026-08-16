import assert from "node:assert/strict";
import { createBattlefieldThumbnailDataUri, createBattlefieldThumbnailSvg } from "../src/utils/maps/battlefieldThumbnail.js";
import { createBattlefieldMapLibraryEntry } from "../src/utils/maps/battlefieldMapLibrary.js";

const map = { id: "thumb", name: "Thumbnail Test", width: 3, height: 2, grid: [[{ terrain: "grass" }, { terrain: "mud" }, { terrain: "water" }],[{ terrain: "forest" }, { terrain: "rubble" }, { terrain: "rock" }]] };
const a = createBattlefieldThumbnailSvg(map);
const b = createBattlefieldThumbnailSvg(map);
assert.equal(a, b);
assert(a.includes("Thumbnail Test"));
const uri = createBattlefieldThumbnailDataUri(map);
assert(uri.startsWith("data:image/svg+xml"));
const entry = createBattlefieldMapLibraryEntry(map, { savedAt: "2026-08-07T00:00:00.000Z" });
assert(entry.thumbnail?.startsWith("data:image/svg+xml"));
console.log("battlefield thumbnail: ok");

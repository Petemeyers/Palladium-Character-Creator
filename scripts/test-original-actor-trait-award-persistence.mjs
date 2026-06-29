import assert from "node:assert/strict";
import mongoose from "mongoose";

import characterRouter from "../backend/routes/characterRoutes.js";
import auth from "../backend/middleware/auth.js";
import { createPatchOriginalCharacterTraitHandler } from "../backend/controllers/originalActorTraitController.js";
import {
  addSavedOriginalTraitAward,
  isSavedCharacterOwnedByUser,
} from "../backend/utils/originalActorTraitPersistence.js";
import {
  buildSavedTraitAwardPayload,
  getSavedCharacterIdForAwardProposal,
  isAwardProposalSaveEligible,
  markAwardProposalSaveFailed,
  markAwardProposalSaved,
} from "../src/utils/originalActorTraitAwardPersistence.js";
import { getOriginalTraits } from "../src/utils/originalActorTraits.js";

const savedCharacterId = new mongoose.Types.ObjectId().toString();
const ownerId = new mongoose.Types.ObjectId().toString();
const otherOwnerId = new mongoose.Types.ObjectId().toString();
const proposal = {
  actorId: "fighter-bato",
  actorName: "Bato",
  traitId: "blooded",
  traitName: "Blooded",
  reason: "Survived combat and did not already have Blooded.",
  layer: "tempered",
  source: "combat",
  confidence: "high",
  status: "applied",
};
const savedActor = {
  id: "fighter-bato",
  name: "Bato",
  source: "saved-character",
  savedCharacterId,
  team: "party",
  generated: false,
};

assert.equal(isAwardProposalSaveEligible(savedActor, proposal, "token"), true);
assert.equal(getSavedCharacterIdForAwardProposal(savedActor, proposal), savedCharacterId);
assert.equal(
  isAwardProposalSaveEligible({ ...savedActor, savedCharacterId: "" }, proposal, "token"),
  false,
  "applied awards without a saved-character ID are not save eligible"
);
assert.equal(
  isAwardProposalSaveEligible(
    { ...savedActor, source: "normalized-legacy-actor" },
    proposal,
    "token"
  ),
  false,
  "catalog actors cannot write traits to saved characters"
);
assert.equal(
  isAwardProposalSaveEligible(
    { id: "fighter-bato", source: "saved-character", stagedEntryId: "stage-bato" },
    proposal,
    "token"
  ),
  false,
  "a staged row ID alone is not a saved-character identity"
);
assert.equal(isAwardProposalSaveEligible(savedActor, proposal, false), false);

const payload = buildSavedTraitAwardPayload(savedActor, proposal, {
  now: () => Date.parse("2026-06-29T00:00:00.000Z"),
  encounterId: "encounter-10",
});
assert.deepEqual(payload, {
  traitId: "blooded",
  source: "combat",
  reason: proposal.reason,
  encounterId: "encounter-10",
  awardedAt: "2026-06-29T00:00:00.000Z",
});

const proposalState = [proposal];
const savedState = markAwardProposalSaved(
  proposalState,
  proposal,
  { savedCharacterId },
  { now: () => 1234 }
);
assert.equal(savedState[0].saveStatus, "saved");
assert.equal(savedState[0].saveMessage, "Saved to character");
assert.equal(proposalState[0].saveStatus, undefined, "saved status updates immutably");

const failedState = markAwardProposalSaveFailed(proposalState, proposal, { status: 403 });
assert.equal(failedState[0].saveStatus, "save_failed");
assert.equal(failedState[0].saveMessage, "This saved character does not belong to the current user.");
assert.equal(proposalState[0].saveStatus, undefined, "failed status updates immutably");

const character = {
  _id: savedCharacterId,
  user: ownerId,
  name: "Bato",
  hp: 17,
  inventory: [{ name: "Spear" }],
  originalActorMetadata: {
    customHistory: "Held the north road",
    attributes: { might: 12 },
    traits: [],
  },
};
const characterSnapshot = JSON.stringify(character);
const writeResult = addSavedOriginalTraitAward(character, payload);
assert.equal(writeResult.ok, true);
assert.equal(writeResult.added, true);
assert.equal(getOriginalTraits(writeResult.character).filter((trait) => trait.id === "blooded").length, 1);
assert.equal(writeResult.character.originalActorMetadata.customHistory, "Held the north road");
assert.equal(writeResult.character.name, "Bato");
assert.equal(writeResult.character.hp, 17);
assert.deepEqual(writeResult.character.inventory, [{ name: "Spear" }]);
assert.equal(JSON.stringify(character), characterSnapshot, "writeback helper does not mutate its source");

const duplicateResult = addSavedOriginalTraitAward(writeResult.character, payload);
assert.equal(duplicateResult.added, false);
assert.equal(getOriginalTraits(duplicateResult.character).filter((trait) => trait.id === "blooded").length, 1);
assert.equal(
  getOriginalTraits(JSON.parse(JSON.stringify(duplicateResult.character))).some((trait) => trait.id === "blooded"),
  true,
  "saved-character JSON round-trip preserves the trait"
);
assert.equal(isSavedCharacterOwnedByUser(character, ownerId), true);
assert.equal(isSavedCharacterOwnedByUser(character, otherOwnerId), false);

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const authResponse = makeResponse();
let authNextCalled = false;
auth({ header: () => undefined }, authResponse, () => { authNextCalled = true; });
assert.equal(authResponse.statusCode, 401);
assert.equal(authNextCalled, false, "trait route authentication rejects missing bearer tokens");

const routeIndex = characterRouter.stack.findIndex((layer) => (
  layer.route?.path === "/:id/original-traits" && layer.route?.methods?.patch
));
const authIndex = characterRouter.stack.findIndex((layer) => layer.handle?.name === "auth");
assert.equal(routeIndex >= 0, true, "original trait PATCH route is registered");
assert.equal(authIndex >= 0 && authIndex < routeIndex, true, "auth middleware runs before trait PATCH route");

const invalidHandler = createPatchOriginalCharacterTraitHandler({
  findById: async () => { throw new Error("invalid payload should not query"); },
});
const invalidResponse = makeResponse();
await invalidHandler(
  { params: { id: savedCharacterId }, body: { traitId: "not_seeded" }, user: { userId: ownerId } },
  invalidResponse
);
assert.equal(invalidResponse.statusCode, 422);

const foreignDocument = {
  ...character,
  user: otherOwnerId,
  toObject() { return { ...this }; },
};
const foreignHandler = createPatchOriginalCharacterTraitHandler({ findById: async () => foreignDocument });
const foreignResponse = makeResponse();
await foreignHandler(
  { params: { id: savedCharacterId }, body: payload, user: { userId: ownerId } },
  foreignResponse
);
assert.equal(foreignResponse.statusCode, 403);

let savedDocument = false;
const ownedDocument = {
  ...character,
  toObject() {
    return JSON.parse(JSON.stringify({ ...this, save: undefined, markModified: undefined }));
  },
  markModified(path) {
    assert.equal(path, "originalActorMetadata");
  },
  async save() {
    savedDocument = true;
    return this;
  },
};
const ownedHandler = createPatchOriginalCharacterTraitHandler({ findById: async () => ownedDocument });
const ownedResponse = makeResponse();
await ownedHandler(
  { params: { id: savedCharacterId }, body: payload, user: { userId: ownerId } },
  ownedResponse
);
assert.equal(ownedResponse.statusCode, 200);
assert.equal(savedDocument, true);
assert.equal(ownedResponse.body.added, true);
assert.equal(ownedDocument.name, "Bato", "controller preserves non-metadata fields");
assert.equal(ownedDocument.hp, 17, "controller preserves combat fields");
assert.equal(ownedDocument.originalActorMetadata.customHistory, "Held the north road");
assert.equal(getOriginalTraits(ownedDocument).some((trait) => trait.id === "blooded"), true);

console.log("original actor trait award persistence tests passed");

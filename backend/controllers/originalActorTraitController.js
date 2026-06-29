import mongoose from "mongoose";
import Character from "../models/Character.js";
import {
  addSavedOriginalTraitAward,
  isSavedCharacterOwnedByUser,
  normalizeSavedTraitAwardPayload,
} from "../utils/originalActorTraitPersistence.js";

export function createPatchOriginalCharacterTraitHandler(CharacterModel = Character) {
  return async function patchOriginalCharacterTrait(req, res) {
    const payload = normalizeSavedTraitAwardPayload(req.body);
    if (!payload) {
      return res.status(422).json({
        success: false,
        message: "Trait payload is invalid.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: "Character not found." });
    }

    try {
      const character = await CharacterModel.findById(req.params.id);
      if (!character) {
        return res.status(404).json({ success: false, message: "Character not found." });
      }

      const userId = req.user?.userId || req.user?.id;
      if (!isSavedCharacterOwnedByUser(character, userId)) {
        return res.status(403).json({
          success: false,
          message: "This character does not belong to the current user.",
        });
      }

      const currentCharacter = typeof character.toObject === "function"
        ? character.toObject()
        : { ...character };
      const result = addSavedOriginalTraitAward(currentCharacter, payload);
      if (!result.ok) {
        return res.status(422).json({ success: false, message: "Trait payload is invalid." });
      }

      character.originalActorMetadata = result.character.originalActorMetadata;
      character.markModified?.("originalActorMetadata");
      await character.save();

      return res.status(200).json({
        success: true,
        added: result.added,
        savedCharacterId: String(character._id),
        trait: result.trait,
        character,
      });
    } catch (error) {
      const status = error?.name === "ValidationError" ? 422 : 500;
      return res.status(status).json({
        success: false,
        message: status === 422 ? "Trait payload is invalid." : "Unable to save Chronicle Award.",
      });
    }
  };
}

export const patchOriginalCharacterTrait = createPatchOriginalCharacterTraitHandler();

export default patchOriginalCharacterTrait;

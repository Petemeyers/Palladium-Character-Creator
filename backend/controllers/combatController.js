import Party from "../models/Party.js";
import Map from "../models/Map.js";
import Character from "../models/Character.js";
import { ensureActiveMapForParty } from "../services/ensureActiveMap.js";
import {
  buildCombatStateDto,
  destinationHexExists,
} from "../services/combatStateDto.js";

async function getActivePartyForUser(userId) {
  return Party.findOne({ owner: userId })
    .sort({ updatedAt: -1 })
    .populate({
      path: "members",
      select: "name level class species hp imageUrl",
    });
}

async function getActiveCharactersForUser(userId, party) {
  const memberIds = (party?.members || [])
    .map((member) => member?._id || member)
    .filter(Boolean);

  return Character.find({
    $or: [
      { _id: { $in: memberIds } },
      { partyOwner: userId, inParty: true },
    ],
  }).select("name level class species hp imageUrl");
}

function isMovableEntity(entity) {
  if (!entity?.id) return false;
  if (entity?.meta?.isFighter === false) return false;
  return ["CHARACTER", "ENEMY", "NPC", "COMBATANT"].includes(entity.kind);
}

function isDebugFallbackFighterId(fighterId) {
  return fighterId === "debug_player_1";
}

export async function getCombatState(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const party = await getActivePartyForUser(userId);
    if (!party) return res.status(404).json({ message: "No party found" });

    const map = await ensureActiveMapForParty(party._id, {
      width: 40,
      height: 30,
      terrainPreset: "OPEN_GROUND",
    });
    const activeCharacters = await getActiveCharactersForUser(userId, party);

    return res.json(buildCombatStateDto({ party, map, characters: activeCharacters }));
  } catch (err) {
    console.error("getCombatState error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function moveCombatFighter(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { fighterId } = req.params;
    const q = Number(req.body?.q);
    const r = Number(req.body?.r);

    if (!fighterId) {
      return res.status(400).json({ message: "Missing fighterId" });
    }

    if (!Number.isInteger(q) || !Number.isInteger(r)) {
      return res.status(400).json({ message: "Destination q/r must be integers" });
    }

    const party = await getActivePartyForUser(userId);
    if (!party) return res.status(404).json({ message: "No party found" });

    const activeCharacters = await getActiveCharactersForUser(userId, party);

    await ensureActiveMapForParty(party._id, {
      width: 40,
      height: 30,
      terrainPreset: "OPEN_GROUND",
    });

    const map = await Map.findOne({ partyId: party._id, isActive: true });
    if (!map) return res.status(404).json({ message: "No active map found" });

    const fighter = activeCharacters.find(
      (character) => character?._id?.toString() === fighterId,
    );
    const existingEntity = map.entities.find(
      (entity) => String(entity.id) === fighterId,
    );
    if (
      !fighter &&
      !isMovableEntity(existingEntity) &&
      !isDebugFallbackFighterId(fighterId)
    ) {
      return res.status(404).json({ message: "Fighter not found in active combat" });
    }

    if (!destinationHexExists(map, q, r)) {
      return res.status(400).json({ message: "Destination hex does not exist" });
    }

    if (existingEntity) {
      existingEntity.q = q;
      existingEntity.r = r;
      if (isDebugFallbackFighterId(fighterId)) {
        existingEntity.kind = "CHARACTER";
        existingEntity.meta = {
          ...(existingEntity.meta || {}),
          team: "player",
          armyId: "player",
          modelKey: "capsule",
          name: "Debug Player",
          hp: 10,
          isTemporaryDebugFallback: true,
        };
      }
    } else {
      const isDebugFallback = isDebugFallbackFighterId(fighterId);
      map.entities.push({
        id: fighterId,
        kind: "CHARACTER",
        q,
        r,
        facing: 0,
        meta: {
          team: "player",
          armyId: isDebugFallback ? "player" : party._id.toString(),
          modelKey: isDebugFallback
            ? "capsule"
            : fighter.imageUrl || fighter.species || "default",
          name: isDebugFallback ? "Debug Player" : fighter.name,
          hp: isDebugFallback ? 10 : fighter.hp,
          isTemporaryDebugFallback: isDebugFallback,
        },
      });
    }

    map.version += 1;
    await map.save();

    console.log(
      `move sync fighterId=${fighterId} q=${q} r=${r}`,
    );

    const combatState = buildCombatStateDto({
      party,
      map: map.toObject(),
      characters: activeCharacters,
    });

    console.log(
      `move response combatState fighters=${combatState.fighters.length}`,
    );

    return res.json({
      success: true,
      message: "Fighter moved",
      combatState,
    });
  } catch (err) {
    console.error("moveCombatFighter error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

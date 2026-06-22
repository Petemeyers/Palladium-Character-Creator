function toId(value) {
  return value?._id?.toString?.() || value?.toString?.() || String(value || "");
}

function toNumberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getEntityTeam(entity) {
  return entity?.meta?.team || entity?.meta?.teamId || null;
}

function getPublicMetadata(source) {
  const metadata = {};
  [
    "ruleset",
    "sizePolicy",
    "legacyCompatibility",
    "publicClassId",
    "publicClassName",
    "publicBackgroundId",
    "publicBackgroundName",
    "publicSkillProficiencies",
    "publicSkillChoices",
    "publicSpeciesId",
    "publicSpeciesName",
    "creatureType",
    "publicLanguages",
    "alignment",
    "size",
    "speed",
    "abilityScoreMethod",
    "baseAbilityScores",
    "backgroundAbilityBonuses",
    "finalAbilityScores",
    "abilityModifiers",
  ].forEach((key) => {
    if (source?.[key] !== undefined) metadata[key] = source[key];
  });
  return metadata;
}

function isFighterEntity(entity) {
  if (!entity?.id) return false;
  if (entity?.meta?.isFighter === false) return false;
  return ["CHARACTER", "ENEMY", "NPC", "COMBATANT"].includes(entity.kind);
}

function getDefaultSpawn(team, index, width = 40, height = 30) {
  const enemyLike =
    team === "enemy" ||
    team === "enemies" ||
    team === "opponent" ||
    team === "hostile";
  const baseQ = enemyLike ? 30 : 5;
  const baseR = 10;
  const rowOffset = Math.floor(index / 4);
  const colOffset = index % 4;

  return {
    q: Math.max(0, Math.min(width - 1, baseQ + colOffset)),
    r: Math.max(0, Math.min(height - 1, baseR + rowOffset)),
  };
}

function claimPosition({ entity, team, spawnIndex, usedPositions, width, height }) {
  const entityQ = toNumberOrNull(entity?.q);
  const entityR = toNumberOrNull(entity?.r);
  const hasEntityPosition = entityQ !== null && entityR !== null;
  const preferred = hasEntityPosition
    ? { q: entityQ, r: entityR }
    : getDefaultSpawn(team, spawnIndex, width, height);

  let q = preferred.q;
  let r = preferred.r;
  let guard = 0;

  while (usedPositions.has(`${q},${r}`) && guard < width * height) {
    q += 1;
    if (q >= width) {
      q = 0;
      r = (r + 1) % height;
    }
    guard += 1;
  }

  usedPositions.add(`${q},${r}`);
  return { q, r };
}

export function buildCombatStateDto({ party, map, characters = [] }) {
  const partyId = toId(party?._id);
  const entities = Array.isArray(map?.entities) ? map.entities : [];
  const entityById = new Map(entities.map((entity) => [String(entity.id), entity]));
  const members = Array.isArray(party?.members) ? party.members : [];
  const sourceCharacters = [];
  const characterById = new Map();

  [...members, ...characters].forEach((character) => {
    const characterId = toId(character);
    if (!characterId) return;
    if (characterById.has(characterId)) {
      const existing = characterById.get(characterId);
      if (!existing?.name && character?.name) {
        const existingIndex = sourceCharacters.findIndex(
          (sourceCharacter) => toId(sourceCharacter) === characterId,
        );
        if (existingIndex !== -1) sourceCharacters[existingIndex] = character;
        characterById.set(characterId, character);
      }
      return;
    }
    sourceCharacters.push(character);
    characterById.set(characterId, character);
  });

  const width = map?.width ?? 40;
  const height = map?.height ?? 30;
  const usedPositions = new Set();
  let playerSpawnIndex = 0;
  let enemySpawnIndex = 0;

  function makeFighter({ id, source, entity, fallbackTeam }) {
    const team = getEntityTeam(entity) || fallbackTeam || "player";
    const armyId = entity?.meta?.armyId || entity?.meta?.teamId || partyId || team;
    const spawnIndex = team === "enemy" ? enemySpawnIndex++ : playerSpawnIndex++;
    const { q, r } = claimPosition({
      entity,
      team,
      spawnIndex,
      usedPositions,
      width,
      height,
    });

    return {
      id,
      name: entity?.meta?.name || source?.name || "Unknown Fighter",
      team,
      armyId,
      q,
      r,
      hp: toNumberOrNull(entity?.meta?.hp) ?? toNumberOrNull(source?.hp) ?? 10,
      currentTurnStatus: entity?.meta?.currentTurnStatus || "waiting",
      modelKey:
        entity?.meta?.modelKey ||
        source?.modelKey ||
        source?.imageUrl ||
        source?.species ||
        entity?.kind?.toLowerCase?.() ||
        "default",
      ...getPublicMetadata(source),
    };
  }

  const fighters = sourceCharacters.map((character) => {
    const fighterId = toId(character);
    return makeFighter({
      id: fighterId,
      source: character,
      entity: entityById.get(fighterId),
      fallbackTeam: "player",
    });
  });

  entities.forEach((entity) => {
    const fighterId = String(entity.id || "");
    if (!fighterId || characterById.has(fighterId) || !isFighterEntity(entity)) return;
    const fallbackTeam = entity.kind === "ENEMY" ? "enemy" : "player";
    fighters.push(
      makeFighter({
        id: fighterId,
        source: null,
        entity,
        fallbackTeam,
      }),
    );
  });

  if (fighters.length === 0) {
    fighters.push({
      id: "debug_player_1",
      name: "Debug Player",
      team: "player",
      armyId: "player",
      q: 5,
      r: 10,
      hp: 10,
      currentTurnStatus: "waiting",
      modelKey: "capsule",
    });
    console.log("combat state fallback debug fighter created");
  }

  console.log(
    `combat state source characters=${sourceCharacters.length} mapEntities=${entities.length} fighters=${fighters.length}`,
  );

  return {
    map: {
      id: toId(map?._id),
      width,
      height,
      version: map?.version ?? 1,
      hexes: Array.isArray(map?.hexes)
        ? map.hexes.map((hex) => ({
            q: hex.q,
            r: hex.r,
            terrain: hex.terrain,
            elev: hex.elev,
          }))
        : [],
    },
    fighters,
    activeFighterId: null,
    round: 1,
    turn: {
      round: 1,
      turnIndex: 0,
      activeFighterId: null,
    },
  };
}

export function destinationHexExists(map, q, r) {
  return Array.isArray(map?.hexes)
    ? map.hexes.some((hex) => hex.q === q && hex.r === r)
    : false;
}

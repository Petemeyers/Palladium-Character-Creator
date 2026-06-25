import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Heading,
  Grid,
  GridItem,
  Divider,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { createPlayableCharacterFighter, getPlayableCharacterRollDetails } from "../utils/autoRoll";
import arenaRoster from "../data/arenaRoster.js";
import { getAllArenaRosterEntries } from "../utils/arenaRosterUtils.js";
import axiosInstance from "../utils/axiosConfig.js";
import { getPublicDerivedStatsForCharacter, formatSignedModifier } from "../utils/publicDerivedStats.js";
import { adaptPublicCharacterForAutoRoll } from "../utils/publicCharacterCombatAdapter.js";
import PUBLIC_ENEMIES from "../data/publicEnemies.js";
import { adaptPublicEnemyToRosterEntry } from "../utils/publicEnemyRosterAdapter.js";
import {
  adaptPublicCharacterToRosterEntry,
  clearStagedRosterEntries,
  getMissingSavedCharacterStagedEntries,
  loadPublicArenaRosterEntries,
  pruneStagedRosterEntriesAgainstSavedCharacters,
  removeStagedRosterEntry,
  upsertPublicArenaRosterEntry,
} from "../utils/publicRosterAdapter.js";

const PUBLIC_ABILITY_LABELS = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const COMPATIBILITY_ATTRIBUTE_ORDER = ["IQ", "ME", "MA", "PS", "PP", "PE", "PB", "Spd"];

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const formatDisplayValue = (value) => {
  if (value === undefined || value === null || value === "") return "Not set";
  if (Array.isArray(value)) return value.map(formatDisplayValue).join(", ");
  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([key, entryValue]) => `${key}: ${formatDisplayValue(entryValue)}`)
      .join(", ");
  }
  return String(value);
};

const getCompatibilityAttributeEntries = (attributeObject = {}) =>
  COMPATIBILITY_ATTRIBUTE_ORDER
    .filter((key) => attributeObject[key] !== undefined && attributeObject[key] !== null)
    .map((key) => [key, attributeObject[key]]);

const getPublicAbilityScores = (character) => character?.finalAbilityScores || character?.publicAbilityScores || null;

const getPublicAbilityModifiers = (character) => character?.abilityModifiers || character?.publicAbilityModifiers || {};

const hasLegacyRollTemplate = (character) =>
  character?.attribute_dice && Object.keys(character.attribute_dice).length > 0;

const getAutoRollReady = (character) => Boolean(character?.autoRollReady || hasLegacyRollTemplate(character));

const getAutoRollInput = (character) => character?.autoRollCharacter || character;

const hasPublicOrCompatibilitySheetData = (character) => {
  const hasClass = Boolean(character?.publicClassName || character?.class || character?.profession);
  const hasSpecies = Boolean(character?.publicSpeciesName || character?.species || character?.race || character?.category);
  const hasScores = Boolean(character?.finalAbilityScores || character?.attributes);
  const hasDerived = Boolean(
    character?.publicDerivedStats ||
    (character?.finalAbilityScores && (character?.publicClassName || character?.publicClassId))
  );
  return hasClass && hasSpecies && hasScores && hasDerived;
};

const formatPublicAbilityScores = (character) => {
  const publicScores = getPublicAbilityScores(character);
  const publicModifiers = getPublicAbilityModifiers(character);
  if (!publicScores) return "";

  return Object.entries(PUBLIC_ABILITY_LABELS)
    .map(([key, label]) => {
      const score = publicScores?.[key];
      if (score === undefined || score === null || score === "") return null;
      const modifier = publicModifiers?.[key];
      const modifierText = modifier === undefined || modifier === null ? "" : ` (${formatSignedModifier(modifier)})`;
      return `${label}: ${score}${modifierText}`;
    })
    .filter(Boolean)
    .join(", ");
};

const AutoRollDemo = () => {
  const [rolledCharacters, setRolledCharacters] = useState([]);
  const [savedCharacters, setSavedCharacters] = useState([]);
  const [loadingSavedCharacters, setLoadingSavedCharacters] = useState(false);
  const [savedCharacterError, setSavedCharacterError] = useState("");
  const [stagedRosterEntries, setStagedRosterEntries] = useState(() => loadPublicArenaRosterEntries());

  const rosterCharacters = useMemo(
    () => getAllArenaRosterEntries(arenaRoster)
      .filter((combatant) => combatant.playable)
      .map((character) => ({
        ...character,
        autoRollSource: "Roster",
        autoRollReady: hasLegacyRollTemplate(character),
        autoRollMissingFields: [],
        autoRollCharacter: character,
      })),
    []
  );
  const playableCharacters = useMemo(
    () => [
      ...rosterCharacters,
      ...savedCharacters
        .filter(hasPublicOrCompatibilitySheetData)
        .map((character) => {
          const adaptation = adaptPublicCharacterForAutoRoll(character);
          return {
            ...character,
            autoRollSource: "Saved Character",
            autoRollReady: adaptation.ready,
            autoRollMissingFields: adaptation.missingRequiredFields,
            autoRollCharacter: adaptation.combatCharacter,
          };
        }),
    ],
    [rosterCharacters, savedCharacters]
  );
  const missingStagedSavedCharacters = useMemo(
    () => getMissingSavedCharacterStagedEntries(stagedRosterEntries, savedCharacters),
    [savedCharacters, stagedRosterEntries]
  );

  const getDisplayClassName = (character) =>
    character.publicClassName || character.class || character.profession || "Class not set";
  const getDisplaySpeciesName = (character) =>
    character.publicSpeciesName || character.species || character.race || character.category || "Species not set";
  const getDisplayBackgroundName = (character) =>
    character.publicBackgroundName || character.background || character.socialBackground || "";

  const renderCompatibilityAttributes = (attributeObject) => {
    const entries = getCompatibilityAttributeEntries(attributeObject);
    if (entries.length === 0) return null;

    return (
      <Grid templateColumns="repeat(4, minmax(0, 1fr))" gap={1} w="full">
        {entries.map(([attr, value]) => (
          <GridItem key={attr}>
            <Text fontSize="xs" color="gray.500">
              <strong>{attr}:</strong> {formatDisplayValue(value)}
            </Text>
          </GridItem>
        ))}
      </Grid>
    );
  };

  useEffect(() => {
    let cancelled = false;

    async function loadSavedCharacters() {
      setLoadingSavedCharacters(true);
      setSavedCharacterError("");
      try {
        const response = await axiosInstance.get("/characters");
        if (!cancelled) {
          setSavedCharacters(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        if (!cancelled) {
          setSavedCharacterError(error?.response?.data?.message || error.message || "Unable to load saved characters.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSavedCharacters(false);
        }
      }
    }

    loadSavedCharacters();
    return () => {
      cancelled = true;
    };
  }, []);

  const rollCharacter = (characterData) => {
    if (!getAutoRollReady(characterData)) return;
    const autoRollInput = getAutoRollInput(characterData);
    const fighter = createPlayableCharacterFighter(autoRollInput);
    const rollDetails = getPlayableCharacterRollDetails(autoRollInput, fighter.attributes);
    
    const rolledCharacter = {
      ...fighter,
      rollDetails,
      finalAbilityScores: autoRollInput.finalAbilityScores || characterData.finalAbilityScores,
      abilityModifiers: autoRollInput.abilityModifiers || characterData.abilityModifiers,
      publicAbilityScores: autoRollInput.publicAbilityScores || characterData.publicAbilityScores,
      publicAbilityModifiers: autoRollInput.publicAbilityModifiers || characterData.publicAbilityModifiers,
      publicClassName: autoRollInput.publicClassName || characterData.publicClassName,
      publicSpeciesName: autoRollInput.publicSpeciesName || characterData.publicSpeciesName,
      publicBackgroundName: autoRollInput.publicBackgroundName || characterData.publicBackgroundName,
      publicDerivedStats: autoRollInput.publicDerivedStats || characterData.publicDerivedStats,
      publicDisplaySource: autoRollInput.publicDisplaySource || characterData.publicDisplaySource,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setRolledCharacters(prev => [rolledCharacter, ...prev.slice(0, 4)]); // Keep last 5
  };

  const clearRolls = () => {
    setRolledCharacters([]);
  };

  const addCharacterToArenaRoster = (event, character) => {
    event.stopPropagation();
    const rosterEntry = adaptPublicCharacterToRosterEntry(character);
    setStagedRosterEntries(upsertPublicArenaRosterEntry(rosterEntry));
  };

  const addEnemyToArenaRoster = (enemy) => {
    const rosterEntry = adaptPublicEnemyToRosterEntry(enemy);
    setStagedRosterEntries(upsertPublicArenaRosterEntry(rosterEntry));
  };

  const removeStagedEntry = (entry) => {
    setStagedRosterEntries(removeStagedRosterEntry(entry?.stagedEntryId || entry?.entryId || entry?.id));
  };

  const clearStagedRoster = () => {
    setStagedRosterEntries(clearStagedRosterEntries());
  };

  const removeMissingStagedCharacters = () => {
    setStagedRosterEntries(pruneStagedRosterEntriesAgainstSavedCharacters(savedCharacters));
  };

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Auto-Roll Demo for Playable Characters</Heading>
          <Text color="gray.600">
            Select any playable character below to generate a combat preview using the current auto-roll compatibility layer.
          </Text>
        </Box>

        <Alert status="info">
          <AlertIcon />
          <Text fontSize="sm">
            <strong>Combat Preview:</strong> HP, AC, Speed, and abilities are shown using the current core d20 compatibility layer.
          </Text>
        </Alert>
        {savedCharacterError && (
          <Alert status="warning">
            <AlertIcon />
            <Text fontSize="sm">{savedCharacterError}</Text>
          </Alert>
        )}

        <Box>
          <HStack justify="space-between" mb={4}>
            <Heading size="md">Available Playable Characters</Heading>
            <Button size="sm" colorScheme="red" variant="outline" onClick={clearRolls}>
              Clear Previews
            </Button>
          </HStack>
          {loadingSavedCharacters && (
            <Text fontSize="sm" color="gray.500" mb={3}>Loading saved characters...</Text>
          )}
          
          <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4}>
            {playableCharacters.map((character) => (
              <GridItem key={character._id || character.id}>
                <Box 
                  p={4} 
                  border="1px solid" 
                  borderColor="gray.200" 
                  borderRadius="md"
                  bg={getAutoRollReady(character) ? "white" : "gray.50"}
                  _hover={{ borderColor: getAutoRollReady(character) ? "blue.300" : "gray.300", cursor: getAutoRollReady(character) ? "pointer" : "default" }}
                  onClick={() => rollCharacter(character)}
                >
                  <VStack align="start" spacing={2}>
                    <HStack>
                      <Text fontWeight="bold">{character.name}</Text>
                      <Badge colorScheme={character.autoRollSource === "Saved Character" ? "green" : "cyan"}>
                        {character.autoRollSource}
                      </Badge>
                      <Badge colorScheme={getAutoRollReady(character) ? "blue" : "orange"}>
                        {getAutoRollReady(character) ? "Ready for auto-roll" : "Needs combat conversion"}
                      </Badge>
                    </HStack>
                    
                    <Text fontSize="sm" color="gray.600">
                      {getDisplaySpeciesName(character)} {getDisplayClassName(character)}
                    </Text>
                    {getDisplayBackgroundName(character) && (
                      <Text fontSize="xs" color="gray.500">
                        <strong>Background:</strong> {getDisplayBackgroundName(character)}
                      </Text>
                    )}
                    
                    {getPublicAbilityScores(character) ? (
                      <Text fontSize="xs" color="gray.500">
                        <strong>Ability Scores:</strong> {formatPublicAbilityScores(character)}
                      </Text>
                    ) : (
                      <Box w="full">
                        <Text fontSize="xs" color="gray.500" fontWeight="semibold">
                          Compatibility Attributes:
                        </Text>
                        {renderCompatibilityAttributes(character.attribute_dice || character.attributes || {}) || (
                          <Text fontSize="xs" color="gray.500">Not set</Text>
                        )}
                      </Box>
                    )}
                    {(() => {
                      const derived = getPublicDerivedStatsForCharacter(character);
                      return derived ? (
                        <Text fontSize="xs" color="gray.500">
                          <strong>Derived:</strong> HP {derived.hitPoints}, Hit Die {derived.hitDie}, Base AC {derived.baseArmorClass}, Initiative {formatSignedModifier(derived.initiative)}
                        </Text>
                      ) : null;
                    })()}
                    
                    <Text fontSize="xs" color="gray.500">
                      <strong>Training:</strong> {formatDisplayValue(character.training || "None")} | 
                      <strong> Tactics:</strong> {formatDisplayValue(character.tactics || "None")}
                    </Text>
                    {!getAutoRollReady(character) && (
                      <Alert status="info" borderRadius="md">
                        <AlertIcon />
                        <Text fontSize="xs">
                          This character needs combat conversion before auto-roll
                          {character.autoRollMissingFields?.length
                            ? `: missing ${character.autoRollMissingFields.join(", ")}.`
                            : "."}
                        </Text>
                      </Alert>
                    )}
                    <Button
                      size="xs"
                      colorScheme="purple"
                      variant="outline"
                      onClick={(event) => addCharacterToArenaRoster(event, character)}
                    >
                      Add to Arena Roster
                    </Button>
                  </VStack>
                </Box>
              </GridItem>
            ))}
          </Grid>
          {playableCharacters.length === 0 && (
            <Alert status="warning" mt={4}>
              <AlertIcon />
              <Text fontSize="sm">
                No playable characters found. Create one in Character Creator.
              </Text>
            </Alert>
          )}
        </Box>

        <Box>
          <HStack justify="space-between" align="center" mb={4} wrap="wrap">
            <Heading size="md">Arena Roster Staging</Heading>
            <HStack spacing={2}>
              {missingStagedSavedCharacters.length > 0 && (
                <Button size="xs" colorScheme="orange" variant="outline" onClick={removeMissingStagedCharacters}>
                  Remove Missing Characters
                </Button>
              )}
              <Button size="xs" colorScheme="red" variant="outline" onClick={clearStagedRoster} isDisabled={stagedRosterEntries.length === 0}>
                Clear Staged Roster
              </Button>
            </HStack>
          </HStack>
          {missingStagedSavedCharacters.length > 0 && (
            <Alert status="warning" mb={3}>
              <AlertIcon />
              <Text fontSize="sm">Some staged characters no longer exist in Character List.</Text>
            </Alert>
          )}
          {stagedRosterEntries.length > 0 ? (
            <Grid templateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap={3}>
              {stagedRosterEntries.map((entry) => (
                <Box key={`${entry.side}-${entry.id}`} p={3} border="1px solid" borderColor="gray.200" borderRadius="md">
                  <VStack align="stretch" spacing={2}>
                    <HStack justify="space-between" align="start">
                      <Box>
                        <Text fontWeight="bold">{entry.name}</Text>
                        <Text fontSize="xs" color="gray.500">
                          {entry.side === "player"
                            ? `${entry.publicSpeciesName || "Species not set"} ${entry.publicClassName || "Class not set"}`
                            : `${entry.size || "Size not set"} ${entry.creatureType || "Creature"}`}
                        </Text>
                      </Box>
                      <Badge colorScheme={entry.side === "player" ? "blue" : "red"}>
                        {entry.side === "player" ? "Player" : "Enemy"}
                      </Badge>
                    </HStack>
                    {missingStagedSavedCharacters.some((missing) => missing.id === entry.id && missing.side === entry.side) && (
                      <Badge alignSelf="start" colorScheme="orange">Missing saved character</Badge>
                    )}
                    <Button size="xs" variant="outline" colorScheme="red" alignSelf="start" onClick={() => removeStagedEntry(entry)}>
                      Remove from Staged Roster
                    </Button>
                  </VStack>
                </Box>
              ))}
            </Grid>
          ) : (
            <Alert status="info">
              <AlertIcon />
              <Text fontSize="sm">No staged roster entries yet.</Text>
            </Alert>
          )}
        </Box>

        <Box>
          <Heading size="md" mb={4}>SRD Enemies</Heading>
          <Grid templateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={4}>
            {PUBLIC_ENEMIES.map((enemy) => (
              <Box key={enemy.id} p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
                <VStack align="start" spacing={2}>
                  <HStack justify="space-between" w="full">
                    <Text fontWeight="bold">{enemy.name}</Text>
                    <Badge colorScheme="red">{enemy.challengeRating || "CR -"}</Badge>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    {enemy.size} {enemy.creatureType}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    AC {enemy.armorClass} | HP {enemy.hitPoints} | Speed {enemy.speed}
                  </Text>
                  <Button size="xs" colorScheme="red" variant="outline" onClick={() => addEnemyToArenaRoster(enemy)}>
                    Add Enemy to Arena Roster
                  </Button>
                  <Text fontSize="xs" color="gray.500">
                    Enemy roster integration is metadata-only in this panel.
                  </Text>
                </VStack>
              </Box>
            ))}
          </Grid>
        </Box>

        {rolledCharacters.length > 0 && (
          <Box>
            <Heading size="md" mb={4}>Recent Combat Previews</Heading>
            <VStack spacing={4} align="stretch">
              {rolledCharacters.map((character, index) => (
                <Box 
                  key={`${character.id}-${index}`}
                  p={4} 
                  border="1px solid" 
                  borderColor="blue.200" 
                  borderRadius="md"
                  bg="blue.50"
                >
                  <VStack align="start" spacing={3}>
                    <HStack justify="space-between" w="full">
                      <HStack>
                        <Text fontWeight="bold" color="blue.700">{character.name}</Text>
                        <Badge colorScheme="blue">{getDisplaySpeciesName(character)} {getDisplayClassName(character)}</Badge>
                      </HStack>
                      <Text fontSize="xs" color="gray.500">{character.timestamp}</Text>
                    </HStack>
                    
                    <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4} w="full">
                      <GridItem>
                        {getPublicAbilityScores(character) ? (
                          <>
                            <Text fontSize="sm" fontWeight="semibold" color="gray.700">Public Ability Scores:</Text>
                            <Text fontSize="xs" color="gray.600">{formatPublicAbilityScores(character)}</Text>
                          </>
                        ) : (
                          <>
                            <Text fontSize="sm" fontWeight="semibold" color="gray.700">Compatibility Attributes:</Text>
                            <VStack align="start" spacing={1}>
                              {getCompatibilityAttributeEntries(character.attributes).map(([attr, value]) => (
                                <HStack key={attr} spacing={2}>
                                  <Text fontSize="xs" minW="20px">{attr}:</Text>
                                  <Text fontSize="xs" fontWeight="bold">{formatDisplayValue(value)}</Text>
                                  <Text fontSize="xs" color="gray.500">
                                    ({formatDisplayValue(character.rollDetails.attributes[attr]?.dice)})
                                  </Text>
                                </HStack>
                              ))}
                            </VStack>
                          </>
                        )}
                      </GridItem>
                      
                      <GridItem>
                        <Text fontSize="sm" fontWeight="semibold" color="gray.700">Combat Stats:</Text>
                        <VStack align="start" spacing={1}>
                          <HStack spacing={2}>
                            <Text fontSize="xs" minW="30px">HP:</Text>
                            <Text fontSize="xs" fontWeight="bold">{character.currentHP}</Text>
                          </HStack>
                          <HStack spacing={2}>
                            <Text fontSize="xs" minW="30px">AC:</Text>
                            <Text fontSize="xs" fontWeight="bold">{character.guardRating}</Text>
                          </HStack>
                          <HStack spacing={2}>
                            <Text fontSize="xs" minW="30px">Speed:</Text>
                            <Text fontSize="xs" fontWeight="bold">{character.spd}</Text>
                          </HStack>
                          {Object.keys(character.bonuses).length > 0 && (
                            <>
                              <Divider />
                              <Text fontSize="xs" fontWeight="semibold" color="gray.600">Bonuses:</Text>
                              {Object.entries(character.bonuses).map(([bonus, value]) => (
                                <HStack key={bonus} spacing={2}>
                                  <Text fontSize="xs" minW="40px">{bonus}:</Text>
                                  <Text fontSize="xs" fontWeight="bold">+{value}</Text>
                                </HStack>
                              ))}
                            </>
                          )}
                        </VStack>
                      </GridItem>
                    </Grid>
                  </VStack>
                </Box>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default AutoRollDemo;

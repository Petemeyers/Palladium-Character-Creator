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

const PUBLIC_ABILITY_LABELS = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

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
  if (!character?.finalAbilityScores) return "";

  return Object.entries(PUBLIC_ABILITY_LABELS)
    .map(([key, label]) => {
      const score = character.finalAbilityScores?.[key];
      if (score === undefined || score === null || score === "") return null;
      const modifier = character.abilityModifiers?.[key];
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

  const getDisplayClassName = (character) =>
    character.publicClassName || character.class || character.profession || "Class not set";
  const getDisplaySpeciesName = (character) =>
    character.publicSpeciesName || character.species || character.race || character.category || "Species not set";
  const getDisplayBackgroundName = (character) =>
    character.publicBackgroundName || character.background || character.socialBackground || "";

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
      timestamp: new Date().toLocaleTimeString()
    };
    
    setRolledCharacters(prev => [rolledCharacter, ...prev.slice(0, 4)]); // Keep last 5
  };

  const clearRolls = () => {
    setRolledCharacters([]);
  };

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Auto-Roll Demo for Playable Characters</Heading>
          <Text color="gray.600">
            Click any playable character below to automatically roll their attributes, 
            calculate combat stats, and generate a ready-to-use fighter for combat!
          </Text>
        </Box>

        <Alert status="info">
          <AlertIcon />
          <Text fontSize="sm">
            <strong>Auto-Roll Features:</strong> HP, AC, Speed, and abilities are shown using the current core d20 compatibility layer.
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
              Clear Rolls
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
                    
                    {character.finalAbilityScores ? (
                      <Text fontSize="xs" color="gray.500">
                        <strong>Ability Scores:</strong> {formatPublicAbilityScores(character)}
                      </Text>
                    ) : (
                      <Text fontSize="xs" color="gray.500">
                        <strong>Attributes:</strong> {Object.entries(character.attribute_dice || character.attributes || {})
                          .slice(0, 4)
                          .map(([attr, value]) => `${attr}: ${value}`)
                          .join(", ")}
                        {Object.keys(character.attribute_dice || character.attributes || {}).length > 4 ? "..." : ""}
                      </Text>
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
                      <strong>Training:</strong> {character.training || "None"} | 
                      <strong> Tactics:</strong> {character.tactics || "None"}
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

        {rolledCharacters.length > 0 && (
          <Box>
            <Heading size="md" mb={4}>Recent Auto-Rolls</Heading>
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
                        <Text fontSize="sm" fontWeight="semibold" color="gray.700">Rolled Attributes:</Text>
                        <VStack align="start" spacing={1}>
                          {Object.entries(character.attributes).map(([attr, value]) => (
                            <HStack key={attr} spacing={2}>
                              <Text fontSize="xs" minW="20px">{attr}:</Text>
                              <Text fontSize="xs" fontWeight="bold">{value}</Text>
                              <Text fontSize="xs" color="gray.500">
                                ({character.rollDetails.attributes[attr]?.dice})
                              </Text>
                            </HStack>
                          ))}
                        </VStack>
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

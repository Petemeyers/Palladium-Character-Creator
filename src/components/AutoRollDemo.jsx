import React, { useState } from "react";
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
import bestiary from "../data/bestiary.json";
import { getAllBestiaryEntries } from "../utils/bestiaryUtils.js";

const AutoRollDemo = () => {
  const [rolledCharacters, setRolledCharacters] = useState([]);

  // Get playable characters from bestiary
  const playableCharacters = getAllBestiaryEntries(bestiary).filter(
    (creature) => creature.playable
  );

  const rollCharacter = (characterData) => {
    const fighter = createPlayableCharacterFighter(characterData);
    const rollDetails = getPlayableCharacterRollDetails(characterData, fighter.attributes);
    
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
          <Heading size="lg" mb={2}>🎲 Auto-Roll Demo for Playable Characters</Heading>
          <Text color="gray.600">
            Click any playable character below to automatically roll their attributes, 
            calculate combat stats, and generate a ready-to-use fighter for combat!
          </Text>
        </Box>

        <Alert status="info">
          <AlertIcon />
          <Text fontSize="sm">
            <strong>Auto-Roll Features:</strong> Attributes are rolled using the character&apos;s dice notation, 
            HP is calculated based on PE + class bonus, AR is determined by class and PE, 
            and combat bonuses are applied based on PS and PP attributes.
          </Text>
        </Alert>

        <Box>
          <HStack justify="space-between" mb={4}>
            <Heading size="md">Available Playable Characters</Heading>
            <Button size="sm" colorScheme="red" variant="outline" onClick={clearRolls}>
              Clear Rolls
            </Button>
          </HStack>
          
          <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4}>
            {playableCharacters.map((character) => (
              <GridItem key={character.id}>
                <Box 
                  p={4} 
                  border="1px solid" 
                  borderColor="gray.200" 
                  borderRadius="md"
                  bg="white"
                  _hover={{ borderColor: "blue.300", cursor: "pointer" }}
                  onClick={() => rollCharacter(character)}
                >
                  <VStack align="start" spacing={2}>
                    <HStack>
                      <Text fontWeight="bold">{character.name}</Text>
                      <Badge colorScheme={character.category === 'faerie_playable' ? 'pink' : 'cyan'}>
                        {character.category}
                      </Badge>
                    </HStack>
                    
                    <Text fontSize="sm" color="gray.600">
                      {character.race} {character.occ}
                    </Text>
                    
                    <Text fontSize="xs" color="gray.500">
                      <strong>Attributes:</strong> {Object.entries(character.attribute_dice || {})
                        .slice(0, 4)
                        .map(([attr, dice]) => `${attr}: ${dice}`)
                        .join(", ")}
                      {Object.keys(character.attribute_dice || {}).length > 4 ? "..." : ""}
                    </Text>
                    
                    <Text fontSize="xs" color="gray.500">
                      <strong>Magic:</strong> {character.magic || "None"} | 
                      <strong> Psionics:</strong> {character.psionics || "None"}
                    </Text>
                  </VStack>
                </Box>
              </GridItem>
            ))}
          </Grid>
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
                        <Badge colorScheme="blue">{character.race} {character.occ}</Badge>
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
                            <Text fontSize="xs" minW="30px">AR:</Text>
                            <Text fontSize="xs" fontWeight="bold">{character.AR}</Text>
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

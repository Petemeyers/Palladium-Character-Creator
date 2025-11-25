import React, { useState } from "react";
import {
  Box,
  Heading,
  Button,
  VStack,
  Text,
  HStack,
  Badge,
  Alert,
  AlertIcon,
  Divider,
} from "@chakra-ui/react";
import { useParty } from "../context/PartyContext";
import getSocket from "../utils/socket";

const socket = getSocket(); // Use centralized socket manager

const AbilitiesPanel = () => {
  const { activeParty } = useParty();

  if (!activeParty) {
    return (
      <Box className="container" p={4}>
        <Heading size="md" mb={4}>O.C.C. Abilities</Heading>
        <Text>Load a party first to access character abilities.</Text>
      </Box>
    );
  }

  const handleUseAbility = (char, ability) => {
    let msg = `✨ ${char.name} uses ${ability.name}: ${ability.bonus}`;

    // Check if ability has uses remaining
    if (ability.uses && ability.usesRemaining !== null) {
      if (ability.usesRemaining <= 0) {
        msg = `❌ ${char.name} has no uses left for ${ability.name}`;
      } else {
        msg += ` (${ability.usesRemaining}/${ability.uses} uses)`;
      }
    }

    socket.emit("partyMessage", {
      partyId: activeParty._id,
      user: "System",
      text: msg,
      type: "system",
    });
  };

  const getAbilityColorScheme = (abilityType) => {
    switch (abilityType) {
      case "magic":
        return "purple";
      case "combat":
        return "red";
      case "skill":
        return "blue";
      case "psionic":
        return "pink";
      default:
        return "gray";
    }
  };

  const getRemainingUses = (char, ability) => {
    if (!ability.uses) return null;
    return ability.usesRemaining;
  };

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>O.C.C. Abilities</Heading>
      
      {activeParty && (
        <Alert status="info" mb={4}>
          <AlertIcon />
          Managing abilities for: <strong>{activeParty.name}</strong>
        </Alert>
      )}

      <VStack spacing={6} align="stretch">
        {activeParty.members.map((char) => (
          <Box key={char._id} border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
            <VStack align="stretch" spacing={3}>
              {/* Character Header */}
              <HStack justify="space-between">
                <VStack align="start" spacing={1}>
                  <Heading size="sm">{char.name}</Heading>
                  <Text fontSize="sm" color="gray.600">
                    {char.species} {char.class} • O.C.C.: {char.occ || char.class}
                  </Text>
                </VStack>
                <Badge colorScheme="blue" size="lg">
                  {char.abilities?.length || 0} abilities
                </Badge>
              </HStack>

              <Divider />

              {/* Abilities List */}
              {char.abilities && char.abilities.length > 0 ? (
                <VStack align="stretch" spacing={2}>
                  {char.abilities.map((ability, idx) => {
                    const remainingUses = getRemainingUses(char, ability);
                    const isDisabled = ability.uses && remainingUses <= 0;
                    
                    return (
                      <Box key={idx} p={3} border="1px solid" borderColor="gray.100" borderRadius="md">
                        <HStack justify="space-between" mb={2}>
                          <HStack spacing={2}>
                            <Badge colorScheme={getAbilityColorScheme(ability.type)} size="sm">
                              {ability.type}
                            </Badge>
                            <Text fontWeight="bold">{ability.name}</Text>
                          </HStack>
                          {ability.uses && (
                            <Badge 
                              colorScheme={remainingUses > 0 ? "green" : "red"} 
                              size="sm"
                            >
                              {remainingUses}/{ability.uses} uses
                            </Badge>
                          )}
                        </HStack>
                        
                        <Text fontSize="sm" color="gray.600" mb={2}>
                          {ability.bonus}
                        </Text>
                        
                        <Button
                          onClick={() => handleUseAbility(char, ability)}
                          colorScheme={getAbilityColorScheme(ability.type)}
                          size="sm"
                          isDisabled={isDisabled}
                          width="100%"
                        >
                          {isDisabled ? "No Uses Left" : "Use Ability"}
                        </Button>
                      </Box>
                    );
                  })}
                </VStack>
              ) : (
                <Text color="gray.500" fontStyle="italic">
                  No O.C.C. abilities assigned. This character may need to be updated.
                </Text>
              )}
            </VStack>
          </Box>
        ))}
      </VStack>

      {/* Quick Reference */}
      <Box mt={6} p={4} bg="gray.50" borderRadius="md">
        <Heading size="sm" mb={3}>Ability Types Quick Reference</Heading>
        <VStack align="stretch" spacing={1}>
          <HStack justify="space-between">
            <Badge colorScheme="red" size="sm">Combat</Badge>
            <Text fontSize="sm" color="gray.600">Attack, damage, and defense bonuses</Text>
          </HStack>
          <HStack justify="space-between">
            <Badge colorScheme="purple" size="sm">Magic</Badge>
            <Text fontSize="sm" color="gray.600">Spells and magical effects</Text>
          </HStack>
          <HStack justify="space-between">
            <Badge colorScheme="blue" size="sm">Skill</Badge>
            <Text fontSize="sm" color="gray.600">Skill bonuses and special abilities</Text>
          </HStack>
          <HStack justify="space-between">
            <Badge colorScheme="pink" size="sm">Psionic</Badge>
            <Text fontSize="sm" color="gray.600">Mental powers and abilities</Text>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
};

export default AbilitiesPanel;

import React from 'react';
import { Box, Text, VStack, HStack, Badge } from '@chakra-ui/react';
import { calculateMovementPerAction } from '../utils/distanceCombatSystem.js';

/**
 * Movement Range Display Component
 * Shows official 1994 Palladium Fantasy movement calculations
 * 
 * Displays:
 * - Walking speed (combat movement)
 * - Running speed (full movement)
 * - Total movement per melee
 * - Visual rings on tactical map
 */

const MovementRangeDisplay = ({ 
  combatant, 
  position, 
  scale = 1, // pixels per foot
  showVisual = true 
}) => {
  if (!combatant || !position) return null;

  const speed = combatant.Spd || combatant.spd || combatant.attributes?.Spd || combatant.attributes?.spd || 10;
  const attacksPerMelee = combatant.attacksPerMelee || 1;
  const movement = calculateMovementPerAction(speed, attacksPerMelee, combatant);

  return (
    <VStack spacing={2} align="stretch">
      {/* Movement Info Panel */}
      <Box bg="blue.50" p={3} borderRadius="md" border="1px solid" borderColor="blue.200">
        <VStack spacing={2} align="stretch">
          <Text fontSize="sm" fontWeight="bold" color="blue.800">
            📊 {combatant.name} - Palladium Movement
          </Text>
          
          <HStack spacing={2} fontSize="xs" wrap="wrap">
            <Badge colorScheme="orange" size="sm">
              Walking: {movement.combatMovementPerAction}ft/action
            </Badge>
            <Badge colorScheme="green" size="sm">
              Running: {movement.display.feetPerAction}ft/action
            </Badge>
            <Badge colorScheme="purple" size="sm">
              Total: {movement.display.feetPerMelee}ft/melee
            </Badge>
          </HStack>
          
          <Text fontSize="xs" color="gray.600" fontStyle="italic">
            ⚡ Official 1994: Spd {speed} × 6 ÷ {attacksPerMelee} attacks = {movement.display.yardsPerAction}yds/action
          </Text>
        </VStack>
      </Box>

      {/* Visual Movement Rings */}
      {showVisual && (
        <Box position="relative" width="100%" height="200px" bg="gray.100" borderRadius="md">
          <Text fontSize="xs" fontWeight="bold" p={2} color="gray.700">
            Movement Range Visualization (Scale: {scale}px/ft)
          </Text>
          
          {/* Character Position Marker */}
          <Box
            position="absolute"
            left="50%"
            top="50%"
            transform="translate(-50%, -50%)"
            width="12px"
            height="12px"
            bg="red.500"
            borderRadius="50%"
            border="2px solid white"
            zIndex={3}
          />
          
          {/* Walking Range Ring (Combat Movement) */}
          <Box
            position="absolute"
            left="50%"
            top="50%"
            transform="translate(-50%, -50%)"
            width={`${movement.combatMovementPerAction * scale * 2}px`}
            height={`${movement.combatMovementPerAction * scale * 2}px`}
            border="2px dashed #f6ad55"
            borderRadius="50%"
            zIndex={1}
          />
          
          {/* Running Range Ring (Full Movement) */}
          <Box
            position="absolute"
            left="50%"
            top="50%"
            transform="translate(-50%, -50%)"
            width={`${movement.display.feetPerAction * scale * 2}px`}
            height={`${movement.display.feetPerAction * scale * 2}px`}
            border="2px dashed #48bb78"
            borderRadius="50%"
            zIndex={2}
          />
          
          {/* Legend */}
          <VStack spacing={1} align="start" position="absolute" top={2} right={2} fontSize="xs">
            <HStack>
              <Box width="12px" height="12px" bg="red.500" borderRadius="50%" />
              <Text>Character</Text>
            </HStack>
            <HStack>
              <Box width="12px" height="2px" bg="orange.400" border="1px dashed" />
              <Text>Walking ({movement.combatMovementPerAction}ft)</Text>
            </HStack>
            <HStack>
              <Box width="12px" height="2px" bg="green.400" border="1px dashed" />
              <Text>Running ({movement.display.feetPerAction}ft)</Text>
            </HStack>
          </VStack>
        </Box>
      )}
    </VStack>
  );
};

export default MovementRangeDisplay;

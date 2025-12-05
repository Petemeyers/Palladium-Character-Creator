import React from "react";
import PropTypes from "prop-types";
import { Box, Text, VStack, HStack, Badge } from "@chakra-ui/react";
import { calculateMovementPerAction } from "../utils/distanceCombatSystem.js";

/**
 * Movement Info Display Component
 * Shows movement information for a combatant on the tactical map.
 */
export default function MovementInfoDisplay({
  combatant,
  position,
  scale = 1,
}) {
  if (!combatant || !position) return null;

  const speed =
    combatant.Spd ||
    combatant.spd ||
    combatant.attributes?.Spd ||
    combatant.attributes?.spd ||
    10;
  const attacksPerMelee = combatant.attacksPerMelee || combatant.actions || 1;
  const movementData = calculateMovementPerAction(speed, attacksPerMelee, combatant);
  const movement =
    movementData.feetPerAction || movementData.display?.feetPerAction || 0;

  return (
    <Box
      position="absolute"
      left={position.x}
      top={position.y}
      transform={`scale(${scale})`}
      transformOrigin="top left"
      pointerEvents="none"
      zIndex={1000}
      bg="rgba(0, 0, 0, 0.7)"
      color="white"
      p={2}
      borderRadius="md"
      fontSize="xs"
      minW="120px"
    >
      <VStack spacing={1} align="stretch">
        <Text fontWeight="bold" fontSize="xs">
          {combatant.name || "Unknown"}
        </Text>
        <HStack justify="space-between" spacing={2}>
          <Text fontSize="xs">SPD:</Text>
          <Badge colorScheme="blue" fontSize="xs">
            {speed}
          </Badge>
        </HStack>
        <HStack justify="space-between" spacing={2}>
          <Text fontSize="xs">APM:</Text>
          <Badge colorScheme="green" fontSize="xs">
            {attacksPerMelee}
          </Badge>
        </HStack>
        <HStack justify="space-between" spacing={2}>
          <Text fontSize="xs">Move/Action:</Text>
          <Badge colorScheme="purple" fontSize="xs">
            {movement}ft
          </Badge>
        </HStack>
      </VStack>
    </Box>
  );
}

MovementInfoDisplay.propTypes = {
  combatant: PropTypes.shape({
    name: PropTypes.string,
    Spd: PropTypes.number,
    spd: PropTypes.number,
    attacksPerMelee: PropTypes.number,
    actions: PropTypes.number,
    attributes: PropTypes.shape({
      Spd: PropTypes.number,
      spd: PropTypes.number,
    }),
  }).isRequired,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }).isRequired,
  scale: PropTypes.number,
};
 
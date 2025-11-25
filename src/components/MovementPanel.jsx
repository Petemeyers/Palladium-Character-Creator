import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Radio,
  RadioGroup,
  Stack,
  Alert,
  AlertIcon,
  Divider
} from "@chakra-ui/react";
import { 
  MOVEMENT_ACTIONS, 
  MOVEMENT_RATES,
  calculateDistance,
  getEngagementRange
} from "../data/movementRules";
import { getAllDistances } from "../utils/positionManager";

/**
 * MovementPanel Component
 * Displays movement options and distance information
 */
const MovementPanel = ({ 
  character, 
  positions,
  allCombatants,
  onMove
}) => {
  const [selectedAction, setSelectedAction] = useState('MOVE');
  const [distances, setDistances] = useState([]);

  // Calculate distances when positions change
  useEffect(() => {
    if (positions && character) {
      const allDistances = getAllDistances(positions, character._id, allCombatants);
      setDistances(allDistances);
    }
  }, [positions, character, allCombatants]);

  if (!character || !positions[character._id]) {
    return null;
  }

  const speed = character.Spd || character.spd || character.attributes?.Spd || character.attributes?.spd || 10;
  const movement = MOVEMENT_RATES.calculateMovement(speed);
  const action = MOVEMENT_ACTIONS[selectedAction];
  const closestEnemy = distances.find(d => d.character.isEnemy !== character.isEnemy);

  return (
    <Box p={3} borderWidth="1px" borderRadius="md" bg="green.50" _dark={{ bg: "green.900" }}>
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between">
          <Text fontWeight="bold" fontSize="sm">
            🏃 Movement Options
          </Text>
          <Badge colorScheme="cyan">
            Speed: {speed}
          </Badge>
        </HStack>

        {/* Movement Rates Display */}
        <Box p={2} bg="white" borderRadius="md" fontSize="xs">
          <VStack align="stretch" spacing={1}>
            <HStack justify="space-between">
              <Text>Combat Move:</Text>
              <Badge colorScheme="blue">{movement.combat} ft</Badge>
            </HStack>
            <HStack justify="space-between">
              <Text>Full Speed:</Text>
              <Badge colorScheme="orange">{movement.fullSpeed || movement.running || "N/A"} ft</Badge>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.500">(Official Palladium: SPD × 60 feet)</Text>
            </HStack>
          </VStack>
        </Box>

        <Divider />

        {/* Movement Action Selection */}
        <Box>
          <Text fontSize="sm" fontWeight="bold" mb={2}>Movement Action:</Text>
          <RadioGroup value={selectedAction} onChange={setSelectedAction} size="sm">
            <Stack spacing={2}>
              {Object.entries(MOVEMENT_ACTIONS).map(([key, action]) => (
                <Radio key={key} value={key}>
                  <HStack spacing={2}>
                    <Text fontSize="sm">{action.name}</Text>
                    <Badge 
                      colorScheme={action.actionCost === 0 ? 'green' : 'orange'}
                      fontSize="xs"
                    >
                      {action.actionCost === 0 ? 'Free' : 
                       action.actionCost === 'all' ? 'All Actions' :
                       `${action.actionCost} Action`}
                    </Badge>
                  </HStack>
                  <Text fontSize="xs" color="gray.600" ml={6}>
                    {action.description}
                  </Text>
                </Radio>
              ))}
            </Stack>
          </RadioGroup>
        </Box>

        {/* Selected Action Info */}
        {action && (
          <Alert status="info" size="sm">
            <AlertIcon />
            <VStack align="start" spacing={1}>
              <Text fontSize="xs" fontWeight="bold">
                {action.name}: {action.description}
              </Text>
              {action.bonuses && (
                <Text fontSize="xs" color="green.600">
                  Bonuses: {Object.entries(action.bonuses).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', ')}
                </Text>
              )}
              {action.penalties && (
                <Text fontSize="xs" color="red.600">
                  Penalties: {Object.entries(action.penalties).map(([k, v]) => `${k} ${v}`).join(', ')}
                </Text>
              )}
            </VStack>
          </Alert>
        )}

        <Divider />

        {/* Distance to Enemies */}
        <Box>
          <Text fontSize="sm" fontWeight="bold" mb={2}>Distances to Enemies:</Text>
          <VStack align="stretch" spacing={1}>
            {distances.length === 0 ? (
              <Text fontSize="xs" color="gray.500">No other combatants</Text>
            ) : (
              distances
                .filter(d => d.character.isEnemy !== character.isEnemy)
                .slice(0, 5)
                .map((dist, idx) => (
                  <HStack key={idx} justify="space-between" fontSize="xs">
                    <Text>{dist.character.name}:</Text>
                    <HStack spacing={1}>
                      <Badge 
                        colorScheme={
                          dist.range.canMeleeAttack ? 'red' :
                          dist.range.canCharge ? 'orange' : 'blue'
                        }
                      >
                        {dist.distance} ft
                      </Badge>
                      <Badge colorScheme="purple" fontSize="xs">
                        {dist.range.name}
                      </Badge>
                    </HStack>
                  </HStack>
                ))
            )}
          </VStack>
        </Box>

        {/* Closest Enemy Alert */}
        {closestEnemy && (
          <Alert 
            status={closestEnemy.range.canMeleeAttack ? 'error' : 'info'} 
            size="sm"
          >
            <AlertIcon />
            <Text fontSize="xs">
              <strong>Closest Enemy:</strong> {closestEnemy.character.name} at {closestEnemy.distance} ft
              {closestEnemy.range.canMeleeAttack && " - IN MELEE RANGE!"}
              {closestEnemy.range.canCharge && " - Can charge!"}
            </Text>
          </Alert>
        )}

        {/* Movement Instructions */}
        <Box p={2} bg="gray.100" borderRadius="md" fontSize="xs" color="gray.600">
          <Text>
            <strong>💡 How to Move:</strong> Click "Show Tactical Map" above, select your character, 
            then click a highlighted cell to move. Your movement range is based on your Speed attribute.
          </Text>
        </Box>
      </VStack>
    </Box>
  );
};

MovementPanel.propTypes = {
  character: PropTypes.object.isRequired,
  positions: PropTypes.object.isRequired,
  allCombatants: PropTypes.array.isRequired,
  onMove: PropTypes.func
};

export default MovementPanel;


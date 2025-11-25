import React, { useState } from 'react';
import { Box, Button, VStack, HStack, Select, Text, Heading, FormControl, FormLabel, Input } from '@chakra-ui/react';
import { createProtectionCircle, CIRCLE_TYPES } from '../utils/protectionCircleSystem';

/**
 * CirclePlacementTool - Tool for placing protection circles on the tactical map
 * @param {Object} props
 * @param {Object} props.caster - Character creating the circle
 * @param {Function} props.onCreate - Callback when circle is created
 * @param {Object} props.mapPosition - Selected position on map {x, y}
 * @param {boolean} props.isGM - Whether user is GM
 * @param {Function} props.onClose - Callback to close the tool
 */
const CirclePlacementTool = ({
  caster,
  onCreate,
  mapPosition,
  isGM = false,
  onClose
}) => {
  const [circleType, setCircleType] = useState(CIRCLE_TYPES.PROTECTION_FROM_EVIL);
  const [radius, setRadius] = useState(5);

  if (!isGM) {
    return null;
  }

  const handleCreate = () => {
    if (!mapPosition || !caster) {
      return;
    }

    const circle = createProtectionCircle(caster, circleType, mapPosition, radius);
    if (circle) {
      // Add additional properties expected by the system
      const fullCircle = {
        ...circle,
        caster: caster.name || caster.id,
        name: circleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        bonus: 5, // Default bonus vs Horror
        remaining: 10, // Default duration in melees
      };
      
      onCreate(fullCircle);
    }
  };

  return (
    <Box
      position="absolute"
      top="10px"
      left="10px"
      bg="white"
      border="2px solid"
      borderColor="purple.400"
      borderRadius="md"
      p={4}
      boxShadow="xl"
      zIndex={2000}
      minW="300px"
    >
      <VStack align="stretch" spacing={4}>
        <Heading size="sm" color="purple.600">
          🕯️ Place Protection Circle
        </Heading>
        
        <FormControl>
          <FormLabel fontSize="sm">Circle Type</FormLabel>
          <Select
            value={circleType}
            onChange={(e) => setCircleType(e.target.value)}
            size="sm"
          >
            {Object.values(CIRCLE_TYPES).map(type => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm">Radius (feet)</FormLabel>
          <Input
            type="number"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            min={1}
            max={20}
            size="sm"
          />
        </FormControl>

        <Text fontSize="xs" color="gray.600">
          Position: {mapPosition ? `(${mapPosition.x}, ${mapPosition.y})` : 'Click on map'}
        </Text>

        <HStack spacing={2}>
          <Button
            colorScheme="purple"
            size="sm"
            onClick={handleCreate}
            isDisabled={!mapPosition || !caster}
          >
            Create Circle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};

export default CirclePlacementTool;


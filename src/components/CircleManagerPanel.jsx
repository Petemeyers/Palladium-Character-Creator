import React from 'react';
import { Box, VStack, HStack, Text, Button, Heading, Badge } from '@chakra-ui/react';

/**
 * CircleManagerPanel - Panel for managing active protection circles (GM tool)
 * @param {Object} props
 * @param {Array} props.circles - Array of active protection circles
 * @param {Function} props.onUpdate - Callback when circle is updated
 * @param {Function} props.onRemove - Callback when circle is removed
 * @param {boolean} props.isGM - Whether user is GM
 * @param {Function} props.onClose - Callback to close the panel
 */
const CircleManagerPanel = ({
  circles = [],
  onUpdate,
  onRemove,
  isGM = false,
  onClose
}) => {
  const handleExtend = (circle, melees = 5) => {
    if (onUpdate) {
      onUpdate({
        ...circle,
        remaining: (circle.remaining || 0) + melees
      });
    }
  };

  const handleRemove = (circle) => {
    if (onRemove) {
      onRemove(circle.id);
    }
  };

  return (
    <Box
      position="absolute"
      top="10px"
      right="10px"
      bg="white"
      border="2px solid"
      borderColor="blue.400"
      borderRadius="md"
      p={4}
      boxShadow="xl"
      zIndex={2000}
      minW="350px"
      maxH="600px"
      overflowY="auto"
    >
      <VStack align="stretch" spacing={3}>
        <Heading size="sm" color="blue.600">
          🕯️ Protection Circle Manager
        </Heading>

        {circles.length === 0 ? (
          <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
            No active circles
          </Text>
        ) : (
          circles.map((circle) => (
            <Box
              key={circle.id}
              p={3}
              border="1px solid"
              borderColor="gray.300"
              borderRadius="md"
              bg="gray.50"
            >
              <VStack align="stretch" spacing={2}>
                <HStack justify="space-between">
                  <Text fontWeight="bold" fontSize="sm">
                    {circle.name || circle.type}
                  </Text>
                  <Badge colorScheme={circle.remaining > 5 ? "green" : circle.remaining > 0 ? "yellow" : "red"}>
                    {circle.remaining || 0} melees
                  </Badge>
                </HStack>

                <Text fontSize="xs" color="gray.600">
                  Caster: {circle.caster}
                </Text>

                <Text fontSize="xs" color="gray.600">
                  Position: ({circle.position?.x || '?'}, {circle.position?.y || '?'})
                </Text>

                <Text fontSize="xs" color="gray.600">
                  Radius: {circle.radius || 5} ft
                </Text>

                <HStack spacing={2}>
                  <Button
                    size="xs"
                    colorScheme="green"
                    onClick={() => handleExtend(circle, 5)}
                  >
                    +5 Melees
                  </Button>
                  <Button
                    size="xs"
                    colorScheme="yellow"
                    onClick={() => handleExtend(circle, 1)}
                  >
                    +1 Melee
                  </Button>
                  <Button
                    size="xs"
                    colorScheme="red"
                    variant="outline"
                    onClick={() => handleRemove(circle)}
                  >
                    Remove
                  </Button>
                </HStack>
              </VStack>
            </Box>
          ))
        )}
      </VStack>
    </Box>
  );
};

export default CircleManagerPanel;


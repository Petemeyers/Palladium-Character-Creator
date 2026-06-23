import React, { useState } from 'react';
import { Box, VStack, HStack, Text, Button, Heading, Badge, FormControl, FormLabel, Select } from '@chakra-ui/react';

/**
 * CircleRechargePanel - Panel for recharging protection circles with stamina
 * @param {Object} props
 * @param {Object} props.caster - Character recharging the circle
 * @param {Array} props.circles - Array of active protection circles
 * @param {Function} props.onRecharge - Callback when circle is recharged
 */
const CircleRechargePanel = ({
  caster,
  circles = [],
  onRecharge
}) => {
  const [selectedCircleId, setSelectedCircleId] = useState(null);
  const [staminaCost, setPpeCost] = useState(10);

  if (!caster) {
    return null;
  }

  const selectedCircle = circles.find(c => c.id === selectedCircleId);
  const casterstamina = caster.stamina || 0;

  const handleRecharge = () => {
    if (!selectedCircle || !onRecharge) return;

    if (casterstamina < staminaCost) {
      alert(`Not enough stamina! Need ${staminaCost}, have ${casterstamina}`);
      return;
    }

    // Calculate extension based on stamina cost (roughly 1 round per 2 stamina)
    const roundsExtended = Math.floor(staminaCost / 2);
    
    const updatedCircle = {
      ...selectedCircle,
      remaining: (selectedCircle.remaining || 0) + roundsExtended
    };

    const updatedCaster = {
      ...caster,
      stamina: casterstamina - staminaCost
    };

    onRecharge(updatedCircle, updatedCaster);
    setSelectedCircleId(null);
  };

  const casterCircles = circles.filter(c => c.caster === caster.name || c.caster === caster.id);

  return (
    <Box
      position="absolute"
      top="10px"
      left="50%"
      transform="translateX(-50%)"
      bg="white"
      border="2px solid"
      borderColor="green.400"
      borderRadius="md"
      p={4}
      boxShadow="xl"
      zIndex={2000}
      minW="400px"
    >
      <VStack align="stretch" spacing={4}>
        <Heading size="sm" color="green.600">
          Recharge Protection Circle
        </Heading>

        <Text fontSize="sm">
          Caster: <strong>{caster.name}</strong> (stamina: {casterstamina})
        </Text>

        <FormControl>
          <FormLabel fontSize="sm">Select Circle</FormLabel>
          <Select
            value={selectedCircleId || ''}
            onChange={(e) => setSelectedCircleId(e.target.value)}
            size="sm"
            placeholder="Choose a circle..."
          >
            {casterCircles.map(circle => (
              <option key={circle.id} value={circle.id}>
                {circle.name || circle.type} - {circle.remaining || 0} rounds remaining
              </option>
            ))}
          </Select>
        </FormControl>

        {selectedCircle && (
          <>
            <Box p={2} bg="gray.50" borderRadius="md">
              <Text fontSize="xs" color="gray.600">
                Current: {selectedCircle.remaining || 0} rounds
              </Text>
              <Text fontSize="xs" color="gray.600">
                Position: ({selectedCircle.position?.x || '?'}, {selectedCircle.position?.y || '?'})
              </Text>
            </Box>

            <FormControl>
              <FormLabel fontSize="sm">stamina to Spend</FormLabel>
              <Select
                value={staminaCost}
                onChange={(e) => setPpeCost(Number(e.target.value))}
                size="sm"
              >
                <option value={5}>5 stamina (+2 rounds)</option>
                <option value={10}>10 stamina (+5 rounds)</option>
                <option value={20}>20 stamina (+10 rounds)</option>
                <option value={30}>30 stamina (+15 rounds)</option>
              </Select>
            </FormControl>

            <HStack spacing={2}>
              <Button
                colorScheme="green"
                size="sm"
                onClick={handleRecharge}
                isDisabled={casterstamina < staminaCost}
              >
                Recharge ({staminaCost} stamina)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCircleId(null)}
              >
                Cancel
              </Button>
            </HStack>
          </>
        )}

        {casterCircles.length === 0 && (
          <Text fontSize="sm" color="gray.500" textAlign="center" py={2}>
            No circles to recharge
          </Text>
        )}
      </VStack>
    </Box>
  );
};

export default CircleRechargePanel;


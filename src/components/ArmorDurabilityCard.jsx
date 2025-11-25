import React from "react";
import {
  Box,
  Text,
  Progress,
  Button,
  Badge,
  HStack,
  VStack,
  IconButton,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
// Using text icons instead of react-icons to avoid dependency issues
const FaShield = () => <span>🛡️</span>;
const FaWrench = () => <span>🔧</span>;
const FaRedo = () => <span>🔄</span>;
const FaExclamationTriangle = () => <span>⚠️</span>;
import useArmorDurability from "../hooks/useArmorDurability";

/**
 * ArmorDurabilityCard
 * Displays armor durability with interactive damage/repair controls
 * Integrates with Palladium 1994 armor system
 */
export default function ArmorDurabilityCard({ 
  armorData, 
  showControls = true, 
  compact = false,
  onDamageApplied = null,
  onRepairApplied = null 
}) {
  const toast = useToast();
  const { 
    armor, 
    applyDamage, 
    repairArmor, 
    resetArmor,
    getRemainingPercentage,
    canAbsorbAttack,
    calculateRepairCost,
    getEncumbranceInfo
  } = useArmorDurability(armorData, onDamageApplied, onRepairApplied);

  // Handle damage application
  const handleApplyDamage = (damageAmount) => {
    const wasBroken = armor.broken;
    const isNowBroken = applyDamage(damageAmount);
    
    if (onDamageApplied) {
      onDamageApplied(damageAmount, isNowBroken);
    }

    if (isNowBroken && !wasBroken) {
      toast({
        title: "Armor Broken!",
        description: `${armor.name} has been destroyed!`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      toast({
        title: "Damage Applied",
        description: `${armor.name} took ${damageAmount} damage`,
        status: "warning",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  // Handle repair application
  const handleRepairArmor = (repairAmount, characterGold = 0) => {
    const result = repairArmor(repairAmount, characterGold);
    
    if (onRepairApplied) {
      onRepairApplied(repairAmount, result.cost);
    }

    if (result.success) {
      toast({
        title: "Armor Repaired",
        description: `Restored ${repairAmount} S.D.C. for ${result.cost} gold`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } else {
      toast({
        title: "Repair Failed",
        description: result.message || "Not enough gold",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  // Handle full reset
  const handleResetArmor = () => {
    resetArmor();
    toast({
      title: "Armor Restored",
      description: `${armor.name} fully repaired`,
      status: "info",
      duration: 2000,
      isClosable: true,
    });
  };

  const remainingPercentage = getRemainingPercentage();
  const progressColor = armor.broken ? "red" : remainingPercentage > 50 ? "green" : "yellow";

  if (compact) {
    return (
      <Box
        p={2}
        bg="gray.800"
        borderWidth="1px"
        borderColor={armor.broken ? "red.500" : "gray.600"}
        borderRadius="md"
        color="gray.100"
        minW="200px"
      >
        <HStack justify="space-between" mb={1}>
          <Text fontSize="sm" fontWeight="bold" noOfLines={1}>
            {armor.name}
          </Text>
          <Badge 
            size="sm" 
            colorScheme={armor.broken ? "red" : "green"}
          >
            {armor.broken ? "Broken" : "OK"}
          </Badge>
        </HStack>
        
        <Progress
          value={remainingPercentage}
          colorScheme={progressColor}
          size="sm"
          borderRadius="md"
          mb={1}
        />
        
        <Text fontSize="xs" color="gray.400">
          S.D.C.: {armor.currentSDC}/{armor.sdc} | A.R.: {armor.armorRating}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      p={4}
      bg="gray.800"
      borderWidth="2px"
      borderColor={armor.broken ? "red.500" : "gray.700"}
      borderRadius="xl"
      color="gray.100"
      shadow="lg"
      textAlign="center"
      maxW="350px"
      position="relative"
    >
      {/* Broken indicator */}
      {armor.broken && (
        <Box position="absolute" top={2} right={2}>
          <Tooltip label="Armor is broken and provides no protection">
            <IconButton
              aria-label="Broken armor"
              icon={<FaExclamationTriangle />}
              size="sm"
              colorScheme="red"
              variant="ghost"
            />
          </Tooltip>
        </Box>
      )}

      {/* Armor header */}
      <VStack spacing={2} mb={3}>
        <HStack>
          <FaShield color={armor.broken ? "#e53e3e" : "#38a169"} />
          <Text fontWeight="bold" fontSize="lg">
            {armor.name}
          </Text>
        </HStack>

        <Badge 
          size="lg" 
          colorScheme={armor.broken ? "red" : "green"}
          px={3}
          py={1}
        >
          {armor.broken ? "BROKEN" : "OPERATIONAL"}
        </Badge>
      </VStack>

      {/* S.D.C. Progress */}
      <VStack spacing={2} mb={4}>
        <Progress
          value={remainingPercentage}
          colorScheme={progressColor}
          size="lg"
          borderRadius="md"
          w="100%"
        />
        
        <Text fontSize="md" fontWeight="semibold">
          S.D.C.: {armor.currentSDC}/{armor.sdc}
        </Text>
        
        {armor.broken && (
          <Text fontSize="sm" color="red.300" fontStyle="italic">
            This armor provides no protection until repaired
          </Text>
        )}
        
        {armor.encumbered && !armor.broken && (
          <Text fontSize="sm" color="orange.300" fontStyle="italic">
            Heavily damaged - movement & prowl penalties apply!
          </Text>
        )}
      </VStack>

      {/* Armor stats */}
      <VStack spacing={1} mb={4} fontSize="sm" color="gray.300">
        <HStack>
          <Text>Armor Rating:</Text>
          <Text fontWeight="bold" color={armor.broken ? "red.300" : "blue.300"}>
            {armor.broken ? "0" : armor.armorRating}
          </Text>
        </HStack>
        <HStack>
          <Text>Weight:</Text>
          <Text fontWeight="bold">{armor.weight} lbs</Text>
        </HStack>
        <HStack>
          <Text>Value:</Text>
          <Text fontWeight="bold">{armor.price || armor.value} gp</Text>
        </HStack>
      </VStack>

      {/* Interactive controls */}
      {showControls && (
        <VStack spacing={2}>
          <Text fontSize="sm" color="gray.400" mb={2}>
            Test Controls
          </Text>
          
          <HStack spacing={2} flexWrap="wrap" justify="center">
            <Button
              size="sm"
              colorScheme="red"
              leftIcon={<FaExclamationTriangle />}
              onClick={() => handleApplyDamage(10)}
              disabled={armor.broken}
            >
              -10 S.D.C.
            </Button>
            
            <Button
              size="sm"
              colorScheme="orange"
              onClick={() => handleApplyDamage(5)}
              disabled={armor.broken}
            >
              -5 S.D.C.
            </Button>
          </HStack>

          <HStack spacing={2} flexWrap="wrap" justify="center">
            <Tooltip label={`Cost: ${calculateRepairCost(10)} gold`}>
              <Button
                size="sm"
                colorScheme="green"
                leftIcon={<FaWrench />}
                onClick={() => handleRepairArmor(10)}
                disabled={armor.currentSDC >= armor.sdc}
              >
                +10 S.D.C.
              </Button>
            </Tooltip>
            
            <Tooltip label={`Cost: ${calculateRepairCost(5)} gold`}>
              <Button
                size="sm"
                colorScheme="teal"
                onClick={() => handleRepairArmor(5)}
                disabled={armor.currentSDC >= armor.sdc}
              >
                +5 S.D.C.
              </Button>
            </Tooltip>
          </HStack>

          <Button
            size="sm"
            colorScheme="gray"
            leftIcon={<FaRedo />}
            onClick={handleResetArmor}
            variant="outline"
          >
            Full Repair
          </Button>
        </VStack>
      )}
    </Box>
  );
}

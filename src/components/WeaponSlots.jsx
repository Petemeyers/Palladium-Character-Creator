import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  Tooltip,
  Button,
  Select
} from "@chakra-ui/react";
import {
  isTwoHandedWeapon,
  canUseTwoHanded,
  getTwoHandedBonus,
  canDualWield,
  getDualWieldPenalties,
  getWeaponDamage
} from "../utils/weaponSlotManager";

/**
 * WeaponSlots Component
 * Displays right hand and left hand weapon slots with visual indicators
 */
const WeaponSlots = ({ 
  character, 
  weaponSlots = { rightHand: null, leftHand: null, usingTwoHanded: false },
  onEquipWeapon,
  onToggleTwoHanded,
  compact = false
}) => {
  const rightWeapon = weaponSlots.rightHand;
  const leftWeapon = weaponSlots.leftHand;
  const usingTwoHanded = weaponSlots.usingTwoHanded;

  // Get available weapons from inventory
  const availableWeapons = character.inventory?.filter(
    item => item.type === "Weapon" || item.type === "weapon"
  ) || [];

  // Check if can dual wield
  const canDW = canDualWield(character);
  const dwPenalties = canDW ? getDualWieldPenalties(character) : null;

  // Render weapon slot
  const renderWeaponSlot = (slot, weapon, isDisabled = false) => {
    const isTwoHanded = weapon && isTwoHandedWeapon(weapon);
    const canBeTwoHanded = weapon && canUseTwoHanded(weapon);
    const damage = weapon ? getWeaponDamage(weapon, slot === 'rightHand' && usingTwoHanded) : 'Unarmed';

    return (
      <Box
        p={2}
        borderWidth="2px"
        borderRadius="md"
        borderColor={weapon ? (slot === 'rightHand' ? 'blue.400' : 'green.400') : 'gray.300'}
        bg={isDisabled ? 'gray.100' : (weapon ? 'white' : 'gray.50')}
        opacity={isDisabled ? 0.5 : 1}
        minHeight="80px"
        position="relative"
      >
        <VStack align="stretch" spacing={1}>
          {/* Slot label */}
          <HStack justify="space-between">
            <Text fontSize="xs" fontWeight="bold" color="gray.600">
              {slot === 'rightHand' ? '🤜 Right Hand' : '🤛 Left Hand'}
            </Text>
            {isTwoHanded && (
              <Badge colorScheme="purple" fontSize="xs">
                Two-Handed
              </Badge>
            )}
          </HStack>

          {/* Weapon info */}
          {weapon ? (
            <VStack align="stretch" spacing={1}>
              <Tooltip label={weapon.description || weapon.name}>
                <Text fontSize="sm" fontWeight="bold" isTruncated>
                  {weapon.name}
                </Text>
              </Tooltip>
              
              <HStack spacing={2} fontSize="xs">
                <Badge colorScheme="red">{damage}</Badge>
                {weapon.weight && (
                  <Badge colorScheme="gray">{weapon.weight} lbs</Badge>
                )}
              </HStack>

              {/* Two-handed indicator/toggle */}
              {slot === 'rightHand' && canBeTwoHanded && !compact && (
                <Tooltip label={usingTwoHanded ? 'Using two hands for +2 damage' : 'Click to use two hands'}>
                  <Button
                    size="xs"
                    colorScheme={usingTwoHanded ? 'green' : 'gray'}
                    variant={usingTwoHanded ? 'solid' : 'outline'}
                    onClick={() => onToggleTwoHanded && onToggleTwoHanded()}
                  >
                    {usingTwoHanded ? '✅ Two-Handed Grip' : 'Use Two Hands'}
                  </Button>
                </Tooltip>
              )}
            </VStack>
          ) : (
            <Text fontSize="xs" color="gray.500" fontStyle="italic">
              {isDisabled ? 'Occupied by two-handed weapon' : 'Empty'}
            </Text>
          )}

          {/* Weapon selector dropdown */}
          {!compact && !isDisabled && onEquipWeapon && (
            <Select
              size="xs"
              placeholder={weapon ? "Change weapon" : "Select weapon"}
              value={weapon?.name || ""}
              onChange={(e) => onEquipWeapon(e.target.value, slot)}
              fontSize="xs"
            >
              <option value="">— Empty —</option>
              {availableWeapons.map((w, idx) => (
                <option key={idx} value={w.name}>
                  {w.name} ({w.damage})
                </option>
              ))}
            </Select>
          )}
        </VStack>

        {/* Two-handed weapon span indicator */}
        {isTwoHanded && slot === 'rightHand' && (
          <Box
            position="absolute"
            top="50%"
            right="-12px"
            transform="translateY(-50%)"
            fontSize="xl"
            color="purple.500"
          >
            ⟷
          </Box>
        )}
      </Box>
    );
  };

  // Compact view for initiative tracker
  if (compact) {
    return (
      <HStack spacing={1} fontSize="xs">
        <Tooltip label={`Right: ${rightWeapon?.name || 'Empty'}`}>
          <Box
            px={2}
            py={1}
            bg={rightWeapon ? 'blue.100' : 'gray.100'}
            borderRadius="sm"
            borderWidth="1px"
            borderColor={rightWeapon ? 'blue.400' : 'gray.300'}
          >
            🤜 {rightWeapon?.name?.substring(0, 8) || '—'}
          </Box>
        </Tooltip>
        
        {!isTwoHandedWeapon(rightWeapon) && (
          <Tooltip label={`Left: ${leftWeapon?.name || 'Empty'}`}>
            <Box
              px={2}
              py={1}
              bg={leftWeapon ? 'green.100' : 'gray.100'}
              borderRadius="sm"
              borderWidth="1px"
              borderColor={leftWeapon ? 'green.400' : 'gray.300'}
            >
              🤛 {leftWeapon?.name?.substring(0, 8) || '—'}
            </Box>
          </Tooltip>
        )}
        
        {usingTwoHanded && (
          <Badge colorScheme="purple" fontSize="xs">2H</Badge>
        )}
      </HStack>
    );
  }

  // Full view
  return (
    <Box p={3} borderWidth="1px" borderRadius="md" bg="gray.50">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between">
          <Text fontWeight="bold" fontSize="sm">
            ⚔️ Equipped Weapons
          </Text>
          {leftWeapon && rightWeapon && canDW && (
            <Tooltip label={dwPenalties?.description}>
              <Badge colorScheme="orange" fontSize="xs">
                Dual Wielding ({dwPenalties?.rightHand}/{dwPenalties?.leftHand})
              </Badge>
            </Tooltip>
          )}
        </HStack>

        <HStack align="stretch" spacing={2}>
          {/* Right Hand Slot */}
          {renderWeaponSlot('rightHand', rightWeapon, false)}

          {/* Left Hand Slot */}
          {renderWeaponSlot(
            'leftHand', 
            leftWeapon, 
            rightWeapon && (isTwoHandedWeapon(rightWeapon) || usingTwoHanded)
          )}
        </HStack>

        {/* Weapon Info */}
        {(rightWeapon || leftWeapon) && (
          <Box p={2} bg="blue.50" borderRadius="md" fontSize="xs">
            <VStack align="stretch" spacing={1}>
              {rightWeapon && (
                <HStack justify="space-between">
                  <Text>Right Hand Damage:</Text>
                  <Badge colorScheme="red">
                    {getWeaponDamage(rightWeapon, usingTwoHanded)}
                    {usingTwoHanded && getTwoHandedBonus(rightWeapon) && ' (Two-Handed)'}
                  </Badge>
                </HStack>
              )}
              
              {leftWeapon && !usingTwoHanded && (
                <HStack justify="space-between">
                  <Text>Left Hand Damage:</Text>
                  <Badge colorScheme="green">{getWeaponDamage(leftWeapon)}</Badge>
                </HStack>
              )}

              {leftWeapon && rightWeapon && !usingTwoHanded && (
                <Text color="orange.600" fontWeight="bold">
                  ⚠️ Dual wielding: {dwPenalties?.description || 'Not trained'}
                </Text>
              )}

              {!canDW && leftWeapon && rightWeapon && (
                <Text color="red.600" fontWeight="bold">
                  ⚠️ Cannot dual wield (requires PP 16+ or dual wield ability)
                </Text>
              )}
            </VStack>
          </Box>
        )}

        {/* Quick reference */}
        <Box p={2} bg="gray.100" borderRadius="md" fontSize="xs" color="gray.600">
          <Text>
            <strong>Quick Info:</strong> Two-handed weapons occupy both slots. 
            Some one-handed weapons can be used two-handed for bonus damage.
          </Text>
        </Box>
      </VStack>
    </Box>
  );
};

WeaponSlots.propTypes = {
  character: PropTypes.object.isRequired,
  weaponSlots: PropTypes.shape({
    rightHand: PropTypes.object,
    leftHand: PropTypes.object,
    usingTwoHanded: PropTypes.bool
  }),
  onEquipWeapon: PropTypes.func,
  onToggleTwoHanded: PropTypes.func,
  compact: PropTypes.bool
};

export default WeaponSlots;


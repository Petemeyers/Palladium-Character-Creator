import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Box,
  Divider,
  useToast
} from '@chakra-ui/react';
import { getAvailableWeapons, equipWeapon, unequipWeapon, getWeaponDisplayInfo } from '../utils/weaponManager';

export default function WeaponEquipModal({ 
  isOpen, 
  onClose, 
  character, 
  onUpdateCharacter 
}) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedWeapon, setSelectedWeapon] = useState(null);
  const toast = useToast();

  const availableWeapons = getAvailableWeapons(character);
  const weaponDisplayInfo = getWeaponDisplayInfo(character);

  const handleEquipWeapon = async (weapon, slot) => {
    try {
      const updatedCharacter = equipWeapon(character, weapon, slot);
      await onUpdateCharacter(character._id, updatedCharacter);
      
      toast({
        title: "Weapon Equipped",
        description: `${weapon.name} equipped to ${slot} hand`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
      
      onClose();
    } catch (error) {
      console.error('Error equipping weapon:', error);
      toast({
        title: "Error",
        description: "Failed to equip weapon",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleUnequipWeapon = async (slot) => {
    try {
      const updatedCharacter = unequipWeapon(character, slot);
      await onUpdateCharacter(character._id, updatedCharacter);
      
      toast({
        title: "Weapon Unequipped",
        description: `Weapon unequipped from ${slot} hand`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
      
      onClose();
    } catch (error) {
      console.error('Error unequipping weapon:', error);
      toast({
        title: "Error",
        description: "Failed to unequip weapon",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setSelectedWeapon(null);
  };

  const handleWeaponSelect = (weapon) => {
    setSelectedWeapon(weapon);
  };

  const confirmEquip = () => {
    if (selectedWeapon && selectedSlot) {
      handleEquipWeapon(selectedWeapon, selectedSlot);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent bg="gray.900" color="gray.100">
        <ModalHeader>⚔️ Equip Weapons - {character.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Current Weapon Display */}
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={2}>Current Weapons</Text>
              <HStack spacing={4}>
                <Box flex={1} p={3} bg="gray.800" borderRadius="md" borderWidth="1px" borderColor="gray.700">
                  <Text fontSize="sm" color="gray.400">Right Hand</Text>
                  <Text fontWeight="bold">{weaponDisplayInfo.rightHand.name}</Text>
                  <Text fontSize="sm" color="gray.300">Damage: {weaponDisplayInfo.rightHand.damage}</Text>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    mt={2}
                    onClick={() => handleSlotClick('right')}
                    w="100%"
                  >
                    Change
                  </Button>
                </Box>
                <Box flex={1} p={3} bg="gray.800" borderRadius="md" borderWidth="1px" borderColor="gray.700">
                  <Text fontSize="sm" color="gray.400">Left Hand</Text>
                  <Text fontWeight="bold">{weaponDisplayInfo.leftHand.name}</Text>
                  <Text fontSize="sm" color="gray.300">Damage: {weaponDisplayInfo.leftHand.damage}</Text>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    mt={2}
                    onClick={() => handleSlotClick('left')}
                    w="100%"
                  >
                    Change
                  </Button>
                </Box>
              </HStack>
            </Box>

            <Divider />

            {/* Available Weapons */}
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={2}>Available Weapons</Text>
              {availableWeapons.length > 0 ? (
                <VStack spacing={2} align="stretch">
                  {availableWeapons.map((weapon, index) => (
                      <Box
                        key={index}
                        p={3}
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor="gray.700"
                        cursor="pointer"
                        onClick={() => handleWeaponSelect(weapon)}
                        bg={selectedWeapon?.name === weapon.name ? "gray.700" : "gray.800"}
                        _hover={{ bg: "gray.700" }}
                      >
                      <HStack justify="space-between">
                        <Box>
                          <Text fontWeight="bold">{weapon.name}</Text>
                          <Text fontSize="sm" color="gray.300">
                            Damage: {weapon.damage || "1d6"} | 
                            Type: {weapon.category || "weapon"}
                          </Text>
                          {weapon.description && (
                            <Text fontSize="xs" color="gray.400" mt={1}>
                              {weapon.description}
                            </Text>
                          )}
                        </Box>
                        <Badge colorScheme="green" variant="outline">
                          Available
                        </Badge>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Text color="gray.400" textAlign="center" py={4}>
                  No weapons available in inventory
                </Text>
              )}
            </Box>

            {/* Selection Summary */}
            {selectedSlot && selectedWeapon && (
              <Box p={3} bg="blue.900" borderRadius="md" borderWidth="1px" borderColor="blue.700">
                <Text fontSize="sm" color="blue.200">
                  Ready to equip <strong>{selectedWeapon.name}</strong> to <strong>{selectedSlot} hand</strong>
                </Text>
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          {selectedSlot && selectedWeapon && (
            <Button colorScheme="green" onClick={confirmEquip}>
              Equip Weapon
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

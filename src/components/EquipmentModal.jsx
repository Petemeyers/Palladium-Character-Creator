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
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Grid,
  GridItem,
  Flex,
  Heading
} from '@chakra-ui/react';
import { 
  getAvailableClothing, 
  equipItem, 
  unequipItem, 
  getEquipmentDisplayInfo,
  getTotalArmorRating,
  getTotalEquippedWeight,
  getTotalArmorSDC,
  calculateArmorPenalties,
  getContainerCapacityBonus,
  getTotalCarryingCapacity
} from '../utils/equipmentManager';
import ArmorDurabilityCard from './ArmorDurabilityCard';
import { SLOT_NAMES } from '../data/equipmentSlots';
import clothingEquipment from '../data/clothingEquipment.json';

const slotIcons = {
  head: "👤",
  torso: "👔", 
  legs: "👖",
  feet: "👟",
  hands: "🧤",
  back: "🧥"
};

export default function EquipmentModal({ 
  isOpen, 
  onClose, 
  character, 
  onUpdateCharacter 
}) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const toast = useToast();

  const availableClothing = getAvailableClothing(character);
  const equipmentDisplayInfo = getEquipmentDisplayInfo(character);
  const totalArmorRating = getTotalArmorRating(character);
  const totalWeight = getTotalEquippedWeight(character);
  const totalArmorSDC = getTotalArmorSDC(character);
  const armorPenalties = calculateArmorPenalties(character);
  const containerBonus = getContainerCapacityBonus(character);
  const totalCarryingCapacity = getTotalCarryingCapacity(character);

  // Group available items by slot
  const itemsBySlot = {};
  availableClothing.forEach(item => {
    if (item.slot) {
      if (!itemsBySlot[item.slot]) {
        itemsBySlot[item.slot] = [];
      }
      itemsBySlot[item.slot].push(item);
    }
  });

  // Get starter equipment items for each slot
  const getStarterEquipmentForSlot = (slot) => {
    const clothingItems = clothingEquipment.clothingItems[slot] || [];
    const armorItems = clothingEquipment.armorItems[slot] || [];
    return [...clothingItems, ...armorItems];
  };

  const handleEquipItem = async (item, slot) => {
    try {
      const updates = equipItem(character, item);
      await onUpdateCharacter(character._id, updates);
      
      toast({
        title: "Item Equipped",
        description: `${item.name} equipped to ${SLOT_NAMES[slot]}`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
      
      setSelectedSlot(null);
      setSelectedItem(null);
    } catch (error) {
      console.error('Error equipping item:', error);
      toast({
        title: "Error",
        description: "Failed to equip item",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleUnequipItem = async (slot) => {
    try {
      const updates = unequipItem(character, slot);
      await onUpdateCharacter(character._id, updates);
      
      toast({
        title: "Item Unequipped",
        description: `Item removed from ${SLOT_NAMES[slot]}`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error unequipping item:', error);
      toast({
        title: "Error",
        description: "Failed to unequip item",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setActiveTab(0); // Switch to inventory tab
  };

  const handleConfirmEquip = () => {
    if (selectedItem && selectedSlot) {
      handleEquipItem(selectedItem, selectedSlot);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent bg="gray.900" color="gray.100" maxH="90vh">
        <ModalHeader>👕 Equip Clothing & Armor - {character.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Current Equipment Display */}
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={2}>Current Equipment</Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                {Object.entries(equipmentDisplayInfo).map(([slot, item]) => (
                  <GridItem key={slot}>
                    <Box 
                      p={3} 
                      bg="gray.800" 
                      borderRadius="md" 
                      borderWidth="1px" 
                      borderColor="gray.700"
                      cursor="pointer"
                      _hover={{ bg: "gray.750" }}
                      onClick={() => handleSlotClick(slot)}
                    >
                      <Flex justify="space-between" align="center">
                        <VStack align="start" spacing={1}>
                          <Text fontSize="sm" color="gray.400">
                            {slotIcons[slot]} {SLOT_NAMES[slot] || slot}
                          </Text>
                          <Text fontWeight="bold" fontSize="sm">{item.name}</Text>
                          {item.armorRating > 0 && (
                            <Text fontSize="xs" color="blue.300">
                              A.R.: {item.armorRating}
                            </Text>
                          )}
                          {item.currentSDC > 0 && (
                            <Text fontSize="xs" color="green.300">
                              S.D.C.: {item.currentSDC}/{item.sdc || item.currentSDC}
                            </Text>
                          )}
                          {item.broken && (
                            <Text fontSize="xs" color="red.300">
                              BROKEN
                            </Text>
                          )}
                        </VStack>
                        <VStack spacing={1}>
                          <Button
                            size="xs"
                            colorScheme="blue"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSlotClick(slot);
                            }}
                          >
                            Change
                          </Button>
                          {item.name !== "None" && (
                            <Button
                              size="xs"
                              colorScheme="red"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnequipItem(slot);
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </VStack>
                      </Flex>
                    </Box>
                  </GridItem>
                ))}
              </Grid>
            </Box>

            {/* Equipment Stats */}
            <Box p={3} bg="gray.800" borderRadius="md">
              <VStack spacing={2}>
                <Flex justify="space-around" w="100%">
                  <Badge colorScheme="blue" p={2} borderRadius="md">
                    🛡️ Armor Rating: {totalArmorRating}
                  </Badge>
                  <Badge colorScheme="green" p={2} borderRadius="md">
                    💪 Total S.D.C.: {totalArmorSDC}
                  </Badge>
                  <Badge colorScheme="yellow" p={2} borderRadius="md">
                    ⚖️ Weight: {totalWeight.toFixed(1)} lbs
                  </Badge>
                  <Badge colorScheme="blue" p={2} borderRadius="md">
                    🎒 Capacity: {character.carryWeight?.maxWeight || 0} + {containerBonus} = {totalCarryingCapacity} lbs
                  </Badge>
                </Flex>
                {(armorPenalties.speedPenalty > 0 || armorPenalties.prowlPenalty > 0 || armorPenalties.dodgePenalty > 0) && (
                  <Flex justify="space-around" w="100%">
                    {armorPenalties.speedPenalty > 0 && (
                      <Badge colorScheme="red" p={1} borderRadius="md">
                        🏃 Speed: -{armorPenalties.speedPenalty}
                      </Badge>
                    )}
                    {armorPenalties.prowlPenalty > 0 && (
                      <Badge colorScheme="orange" p={1} borderRadius="md">
                        🕵️ Prowl: -{armorPenalties.prowlPenalty}%
                      </Badge>
                    )}
                    {armorPenalties.dodgePenalty > 0 && (
                      <Badge colorScheme="purple" p={1} borderRadius="md">
                        🤺 Dodge: -{armorPenalties.dodgePenalty}%
                      </Badge>
                    )}
                  </Flex>
                )}
              </VStack>
            </Box>

            <Divider />

            {/* Armor Durability Section */}
            {equipmentDisplayInfo.hasEquipment && (
              <Box>
                <Heading size="md" mb={4} color="blue.300">
                  🛡️ Armor Durability
                </Heading>
                <Flex wrap="wrap" gap={4} justify="center">
                  {Object.entries(equipmentDisplayInfo).map(([slot, item]) => {
                    if (slot === 'hasEquipment' || !item || item.name === "None" || !item.armorRating) {
                      return null;
                    }
                    return (
                      <ArmorDurabilityCard
                        key={slot}
                        armorData={item}
                        showControls={false}
                        compact={true}
                      />
                    );
                  })}
                </Flex>
              </Box>
            )}

            <Divider />

            {/* Equipment Selection */}
            {selectedSlot && (
              <Box>
                <Text fontSize="lg" fontWeight="bold" mb={2}>
                  Select Item for {slotIcons[selectedSlot]} {SLOT_NAMES[selectedSlot]}
                </Text>
                
                <Tabs index={activeTab} onChange={setActiveTab}>
                  <TabList>
                    <Tab>From Inventory ({itemsBySlot[selectedSlot]?.length || 0})</Tab>
                    <Tab>Starter Equipment</Tab>
                  </TabList>
                  
                  <TabPanels>
                    <TabPanel>
                      {itemsBySlot[selectedSlot] && itemsBySlot[selectedSlot].length > 0 ? (
                        <VStack spacing={2} align="stretch">
                          {itemsBySlot[selectedSlot].map((item, index) => (
                            <Box
                              key={index}
                              p={3}
                              bg={selectedItem?.name === item.name ? "blue.800" : "gray.800"}
                              borderRadius="md"
                              borderWidth="1px"
                              borderColor={selectedItem?.name === item.name ? "blue.500" : "gray.700"}
                              cursor="pointer"
                              onClick={() => setSelectedItem(item)}
                            >
                              <Flex justify="space-between" align="center">
                                <VStack align="start" spacing={1}>
                                  <Text fontWeight="bold">{item.name}</Text>
                                  <Text fontSize="sm" color="gray.300">
                                    {item.type} • Weight: {item.weight || 0} lbs
                                  </Text>
                                  {item.armorRating > 0 && (
                                    <Text fontSize="sm" color="blue.300">
                                      A.R.: {item.armorRating}
                                    </Text>
                                  )}
                                  {item.sdc > 0 && (
                                    <Text fontSize="sm" color="green.300">
                                      S.D.C.: {item.sdc}
                                    </Text>
                                  )}
                                  {item.description && (
                                    <Text fontSize="xs" color="gray.400">
                                      {item.description}
                                    </Text>
                                  )}
                                </VStack>
                                <Button
                                  size="sm"
                                  colorScheme="green"
                                  onClick={() => handleEquipItem(item, selectedSlot)}
                                >
                                  Equip
                                </Button>
                              </Flex>
                            </Box>
                          ))}
                        </VStack>
                      ) : (
                        <Text color="gray.400" textAlign="center" py={4}>
                          No items available for this slot in inventory
                        </Text>
                      )}
                    </TabPanel>
                    
                    <TabPanel>
                      <VStack spacing={2} align="stretch">
                        {getStarterEquipmentForSlot(selectedSlot).map((item, index) => (
                          <Box
                            key={index}
                            p={3}
                            bg={selectedItem?.name === item.name ? "blue.800" : "gray.800"}
                            borderRadius="md"
                            borderWidth="1px"
                            borderColor={selectedItem?.name === item.name ? "blue.500" : "gray.700"}
                            cursor="pointer"
                            onClick={() => setSelectedItem(item)}
                          >
                            <Flex justify="space-between" align="center">
                              <VStack align="start" spacing={1}>
                                <Text fontWeight="bold">{item.name}</Text>
                                <Text fontSize="sm" color="gray.300">
                                  {item.type} • Weight: {item.weight || 0} lbs • Price: {item.value || 0} gp
                                </Text>
                                {item.armorRating > 0 && (
                                  <Text fontSize="sm" color="blue.300">
                                    A.R.: {item.armorRating}
                                  </Text>
                                )}
                                {item.sdc > 0 && (
                                  <Text fontSize="sm" color="green.300">
                                    S.D.C.: {item.sdc}
                                  </Text>
                                )}
                                {item.description && (
                                  <Text fontSize="xs" color="gray.400">
                                    {item.description}
                                  </Text>
                                )}
                              </VStack>
                              <Button
                                size="sm"
                                colorScheme="purple"
                                variant="outline"
                                onClick={() => {
                                  // Add item to inventory first, then equip
                                  const itemWithSlot = { ...item, slot: selectedSlot };
                                  handleEquipItem(itemWithSlot, selectedSlot);
                                }}
                              >
                                Add & Equip
                              </Button>
                            </Flex>
                          </Box>
                        ))}
                      </VStack>
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </Box>
            )}
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <HStack spacing={2}>
            {selectedSlot && selectedItem && (
              <Button
                colorScheme="blue"
                onClick={handleConfirmEquip}
              >
                Equip {selectedItem.name}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

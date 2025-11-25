import React, { useState, useEffect } from 'react';
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
  Select,
  Flex,
  IconButton,
  Tooltip,
  Heading,
  Progress,
  Alert,
  AlertIcon
} from '@chakra-ui/react';
import { 
  getAvailableStorageOptions,
  calculateStorageCapacity,
  storeItem,
  retrieveItem,
  calculateMonthlyCosts,
  purchaseProperty,
  getStorageContents
} from '../utils/storageManager';
import { STORAGE_TYPES } from '../data/storageSystem.js';

const storageIcons = {
  BACKPACK: "🎒",
  BELT_POUCH: "👝",
  INN_ROOM: "🏨",
  INN_LOCKER: "🔒",
  GUILD_STORAGE: "🏛️",
  TEMPLE_STORAGE: "⛪",
  RENTED_WAREHOUSE: "🏬",
  SMALL_HOUSE: "🏠",
  STONE_TOWNHOUSE: "🏘️",
  MANOR_HOUSE: "🏰",
  WIZARD_TOWER: "🗼",
  THIEF_SAFEHOUSE: "🕳️",
  DIMENSIONAL_POCKET: "🌌",
  WEIGHTLESS_SACK: "🎭",
  HIDDEN_CACHE: "🗃️"
};

const StorageModal = ({ isOpen, onClose, character, onCharacterUpdate }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedStorage, setSelectedStorage] = useState(null);
  const [availableStorage, setAvailableStorage] = useState([]);
  const [storageCapacity, setStorageCapacity] = useState({});
  const [monthlyCosts, setMonthlyCosts] = useState({});
  const [storageContents, setStorageContents] = useState({});
  const toast = useToast();

  useEffect(() => {
    if (character && isOpen) {
      const storageOptions = getAvailableStorageOptions(character);
      const capacity = calculateStorageCapacity(character);
      const costs = calculateMonthlyCosts(character);
      
      setAvailableStorage(storageOptions);
      setStorageCapacity(capacity);
      setMonthlyCosts(costs);
      
      // Load storage contents for each available storage type
      const contents = {};
      storageOptions.forEach(option => {
        const key = Object.keys(STORAGE_TYPES).find(k => STORAGE_TYPES[k].name === option.name);
        if (key) {
          contents[key] = getStorageContents(character, key);
        }
      });
      setStorageContents(contents);
    }
  }, [character, isOpen]);

  const handleStoreItem = async () => {
    if (!selectedItem || !selectedStorage) {
      toast({
        title: "Error",
        description: "Please select both an item and storage location",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const result = storeItem(character, selectedItem, selectedStorage);
    
    if (result.success) {
      toast({
        title: "Success",
        description: result.message,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Remove item from inventory
      const updatedCharacter = { ...character };
      updatedCharacter.inventory = updatedCharacter.inventory.filter(item => item._id !== selectedItem._id);
      
      onCharacterUpdate(updatedCharacter);
      setSelectedItem(null);
    } else {
      toast({
        title: "Error",
        description: result.error,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleRetrieveItem = async (storageType, item) => {
    const result = retrieveItem(character, storageType, item._id || item.id);
    
    if (result.success) {
      toast({
        title: "Success",
        description: result.message,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      onCharacterUpdate({ ...character });
    } else {
      toast({
        title: "Error",
        description: result.error,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handlePurchaseProperty = async (propertyType, location) => {
    const result = purchaseProperty(character, propertyType, location);
    
    if (result.success) {
      toast({
        title: "Success",
        description: result.message,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      onCharacterUpdate({ ...character });
    } else {
      toast({
        title: "Error",
        description: result.error,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent bg="gray.800" color="white">
        <ModalHeader>
          <Heading size="lg" color="blue.300">
            🏠 Storage & Housing System
          </Heading>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <Tabs index={activeTab} onChange={setActiveTab}>
            <TabList>
              <Tab>📦 Storage Overview</Tab>
              <Tab>🎒 Store Items</Tab>
              <Tab>🏠 Purchase Property</Tab>
              <Tab>💰 Monthly Costs</Tab>
            </TabList>

            <TabPanels>
              {/* Storage Overview Tab */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Heading size="md" mb={3} color="green.300">
                      📊 Storage Capacity Summary
                    </Heading>
                    <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                      <Box bg="gray.700" p={3} borderRadius="md">
                        <Text fontWeight="bold">Total Capacity</Text>
                        <Text fontSize="2xl" color="blue.300">{storageCapacity.totalCapacity} lbs</Text>
                      </Box>
                      <Box bg="gray.700" p={3} borderRadius="md">
                        <Text fontWeight="bold">Monthly Cost</Text>
                        <Text fontSize="2xl" color="yellow.300">{monthlyCosts.totalMonthlyCost} gp</Text>
                      </Box>
                    </Grid>
                  </Box>

                  <Box>
                    <Heading size="md" mb={3} color="purple.300">
                      🏠 Available Storage Options
                    </Heading>
                    <Grid templateColumns="repeat(2, 1fr)" gap={3}>
                      {availableStorage.map((storage, index) => {
                        const icon = storageIcons[Object.keys(STORAGE_TYPES).find(k => STORAGE_TYPES[k].name === storage.name)] || "📦";
                        const contents = storageContents[Object.keys(STORAGE_TYPES).find(k => STORAGE_TYPES[k].name === storage.name)] || [];
                        const usedCapacity = contents.reduce((total, item) => total + (item.weight || 0), 0);
                        const usagePercent = (usedCapacity / storage.capacity) * 100;
                        
                        return (
                          <Box key={index} bg="gray.700" p={3} borderRadius="md">
                            <Flex justify="space-between" align="center" mb={2}>
                              <Text fontWeight="bold">{icon} {storage.name}</Text>
                              <Badge colorScheme={storage.owned ? "green" : "blue"}>
                                {storage.owned ? "Owned" : "Available"}
                              </Badge>
                            </Flex>
                            <Progress value={usagePercent} colorScheme="blue" mb={2} />
                            <Text fontSize="sm">
                              {usedCapacity}/{storage.capacity} lbs ({usagePercent.toFixed(1)}%)
                            </Text>
                            <Text fontSize="sm" color="gray.400">
                              {storage.costPerMonth > 0 ? `${storage.costPerMonth} gp/month` : "Free"}
                            </Text>
                          </Box>
                        );
                      })}
                    </Grid>
                  </Box>
                </VStack>
              </TabPanel>

              {/* Store Items Tab */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Heading size="md" mb={3} color="orange.300">
                      🎒 Store Items from Inventory
                    </Heading>
                    
                    <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                      {/* Inventory Items */}
                      <Box>
                        <Text fontWeight="bold" mb={2}>Available Items</Text>
                        <VStack spacing={2} maxH="300px" overflowY="auto">
                          {character.inventory?.map((item, index) => (
                            <Box
                              key={index}
                              bg={selectedItem?._id === item._id ? "blue.600" : "gray.700"}
                              p={2}
                              borderRadius="md"
                              cursor="pointer"
                              onClick={() => setSelectedItem(item)}
                              w="100%"
                            >
                              <Text fontSize="sm" fontWeight="bold">{item.name}</Text>
                              <Text fontSize="xs" color="gray.400">
                                Weight: {item.weight || 0} lbs
                              </Text>
                            </Box>
                          ))}
                        </VStack>
                      </Box>

                      {/* Storage Options */}
                      <Box>
                        <Text fontWeight="bold" mb={2}>Storage Locations</Text>
                        <VStack spacing={2} maxH="300px" overflowY="auto">
                          {availableStorage.map((storage, index) => {
                            const icon = storageIcons[Object.keys(STORAGE_TYPES).find(k => STORAGE_TYPES[k].name === storage.name)] || "📦";
                            const contents = storageContents[Object.keys(STORAGE_TYPES).find(k => STORAGE_TYPES[k].name === storage.name)] || [];
                            const usedCapacity = contents.reduce((total, item) => total + (item.weight || 0), 0);
                            const availableCapacity = storage.capacity - usedCapacity;
                            
                            return (
                              <Box
                                key={index}
                                bg={selectedStorage === Object.keys(STORAGE_TYPES).find(k => STORAGE_TYPES[k].name === storage.name) ? "green.600" : "gray.700"}
                                p={2}
                                borderRadius="md"
                                cursor="pointer"
                                onClick={() => setSelectedStorage(Object.keys(STORAGE_TYPES).find(k => STORAGE_TYPES[k].name === storage.name))}
                                w="100%"
                              >
                                <Text fontSize="sm" fontWeight="bold">{icon} {storage.name}</Text>
                                <Text fontSize="xs" color="gray.400">
                                  Available: {availableCapacity} lbs
                                </Text>
                              </Box>
                            );
                          })}
                        </VStack>
                      </Box>
                    </Grid>

                    {selectedItem && selectedStorage && (
                      <Box mt={4}>
                        <Alert status="info">
                          <AlertIcon />
                          Store {selectedItem.name} in {STORAGE_TYPES[selectedStorage]?.name}?
                        </Alert>
                      </Box>
                    )}
                  </Box>
                </VStack>
              </TabPanel>

              {/* Purchase Property Tab */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Heading size="md" mb={3} color="purple.300">
                      🏠 Purchase Property
                    </Heading>
                    <Text mb={4} color="gray.300">
                      Purchase permanent storage and housing. Properties provide secure storage and status benefits.
                    </Text>
                    
                    <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                      {Object.entries(STORAGE_TYPES).filter(([key, storage]) => storage.purchaseCost).map(([key, storage]) => {
                        const icon = storageIcons[key] || "🏠";
                        const canAfford = character.gold >= storage.purchaseCost;
                        
                        return (
                          <Box key={key} bg="gray.700" p={4} borderRadius="md">
                            <Flex justify="space-between" align="center" mb={2}>
                              <Text fontWeight="bold">{icon} {storage.name}</Text>
                              <Badge colorScheme={canAfford ? "green" : "red"}>
                                {storage.purchaseCost} gp
                              </Badge>
                            </Flex>
                            <Text fontSize="sm" mb={3}>{storage.description}</Text>
                            <VStack spacing={2} align="stretch">
                              <Text fontSize="xs">Capacity: {storage.capacity} lbs</Text>
                              <Text fontSize="xs">Upkeep: {storage.costPerMonth} gp/month</Text>
                              <Button
                                size="sm"
                                colorScheme={canAfford ? "green" : "gray"}
                                isDisabled={!canAfford}
                                onClick={() => handlePurchaseProperty(key, "Current Location")}
                              >
                                Purchase
                              </Button>
                            </VStack>
                          </Box>
                        );
                      })}
                    </Grid>
                  </Box>
                </VStack>
              </TabPanel>

              {/* Monthly Costs Tab */}
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Heading size="md" mb={3} color="yellow.300">
                      💰 Monthly Living & Storage Costs
                    </Heading>
                    
                    <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                      <Box bg="gray.700" p={4} borderRadius="md">
                        <Text fontWeight="bold" mb={3}>Cost Breakdown</Text>
                        <VStack spacing={2} align="stretch">
                          <Flex justify="space-between">
                            <Text>Lifestyle:</Text>
                            <Text color="blue.300">{monthlyCosts.baseLivingCost} gp</Text>
                          </Flex>
                          <Flex justify="space-between">
                            <Text>Storage:</Text>
                            <Text color="green.300">{monthlyCosts.storageCost} gp</Text>
                          </Flex>
                          <Flex justify="space-between">
                            <Text>Property Upkeep:</Text>
                            <Text color="purple.300">{monthlyCosts.propertyUpkeep} gp</Text>
                          </Flex>
                          <Divider />
                          <Flex justify="space-between" fontWeight="bold">
                            <Text>Total Monthly:</Text>
                            <Text color="yellow.300" fontSize="lg">{monthlyCosts.totalMonthlyCost} gp</Text>
                          </Flex>
                        </VStack>
                      </Box>

                      <Box bg="gray.700" p={4} borderRadius="md">
                        <Text fontWeight="bold" mb={3}>Current Gold</Text>
                        <Text fontSize="2xl" color="yellow.300" mb={2}>
                          {character.gold || 0} gp
                        </Text>
                        <Text fontSize="sm" color="gray.400">
                          Can afford {Math.floor((character.gold || 0) / monthlyCosts.totalMonthlyCost)} months of expenses
                        </Text>
                      </Box>
                    </Grid>
                  </Box>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onClose}>
            Close
          </Button>
          {activeTab === 1 && selectedItem && selectedStorage && (
            <Button colorScheme="green" onClick={handleStoreItem}>
              Store Item
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default StorageModal;

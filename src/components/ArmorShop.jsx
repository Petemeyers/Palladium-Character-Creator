import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Text, 
  Button, 
  VStack, 
  HStack, 
  Badge, 
  Grid, 
  GridItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useToast,
  Flex,
  Progress,
  Divider,
  Select,
  Heading,
  Alert,
  AlertIcon
} from '@chakra-ui/react';
import armorShopData from '../data/armorShopData.js';
import axiosInstance from '../utils/axiosConfig';

// Global style for dropdown options readability
const dropdownStyle = `
  select option {
    background-color: #2D3748 !important;
    color: #FFFFFF !important;
    padding: 10px 12px !important;
    font-size: 15px !important;
    font-weight: 500 !important;
    line-height: 1.5 !important;
  }
  select option:hover,
  select option:focus {
    background-color: #4A5568 !important;
    color: #FFFFFF !important;
  }
  select option:checked {
    background-color: #3182CE !important;
    color: #FFFFFF !important;
  }
`;

const ArmorShop = ({ characters = [], onUpdateCharacters }) => {
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [armorItems, setArmorItems] = useState([]);
  const [selectedArmor, setSelectedArmor] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const toast = useToast();

  useEffect(() => {
    // Combine all armor categories into a single array
    const allArmor = [
      ...(armorShopData.lightArmor || []),
      ...(armorShopData.mediumArmor || []),
      ...(armorShopData.heavyArmor || []),
      ...(armorShopData.shields || []),
    ];
    setArmorItems(allArmor);
  }, []);

  const filteredArmor = armorItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'light') return item.type === 'light' || item.armorRating <= 10;
    if (filter === 'medium') return item.type === 'medium' || (item.armorRating > 10 && item.armorRating <= 15);
    if (filter === 'heavy') return item.type === 'heavy' || item.armorRating > 15;
    if (filter === 'shields') return item.type === 'shield';
    if (filter === 'clothing') return item.category === 'Clothing' && item.armorRating > 0;
    return true;
  });

  const handlePurchaseArmor = async () => {
    if (!selectedCharacter || !selectedArmor) return;

    try {
      const response = await axiosInstance.post('/shop/purchase', {
        characterId: selectedCharacter._id,
        item: selectedArmor,
        quantity: 1
      });

      if (response.data.success) {
        toast({
          title: "Purchase Successful",
          description: `${selectedArmor.name} purchased for ${selectedArmor.price} gp`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });

        // Update characters list
        onUpdateCharacters();
        setShowPurchaseModal(false);
        setSelectedArmor(null);
      }
    } catch (error) {
      console.error('Error purchasing armor:', error);
      toast({
        title: "Purchase Failed",
        description: error.response?.data?.message || "Failed to purchase armor",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const getArmorTypeColor = (item) => {
    if (item.type === 'light' || item.armorRating <= 10) return 'green';
    if (item.type === 'medium' || (item.armorRating > 10 && item.armorRating <= 15)) return 'yellow';
    if (item.type === 'heavy' || item.armorRating > 15) return 'red';
    if (item.type === 'shield') return 'blue';
    return 'gray';
  };

  const getArmorTypeIcon = (item) => {
    if (item.type === 'light' || item.armorRating <= 10) return '🟢';
    if (item.type === 'medium' || (item.armorRating > 10 && item.armorRating <= 15)) return '🟡';
    if (item.type === 'heavy' || item.armorRating > 15) return '🔴';
    if (item.type === 'shield') return '🛡️';
    return '⚔️';
  };

  return (
    <Box bg="gray.800" color="white" p={6} borderRadius="xl" shadow="xl">
      <style>{dropdownStyle}</style>
      <Heading size="lg" mb={6} color="blue.300" textAlign="center">
        🛡️ Armor & Protection Shop
      </Heading>

      {/* Character Selection */}
      <Box mb={6}>
        <Text fontWeight="bold" mb={3}>Select Character:</Text>
        <Select
          placeholder="Choose a character"
          value={selectedCharacter?._id || ''}
          onChange={(e) => {
            const character = (characters || []).find(char => char._id === e.target.value);
            setSelectedCharacter(character);
          }}
          bg="gray.700"
          color="white"
          borderColor="gray.600"
          fontSize="15px"
          fontWeight="500"
          height="42px"
          _hover={{ borderColor: "blue.400" }}
          _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
          sx={{
            option: {
              bg: "gray.800",
              color: "white",
              padding: "10px",
              fontSize: "15px",
              fontWeight: "500",
              _hover: {
                bg: "gray.700",
                color: "white"
              },
              _selected: {
                bg: "blue.600",
                color: "white"
              }
            }
          }}
        >
          {(characters || []).map((character) => (
            <option key={character._id} value={character._id} style={{ backgroundColor: '#2D3748', color: '#FFFFFF' }}>
              {character.name} ({character.gold || 0} gp)
            </option>
          ))}
        </Select>
      </Box>

      {/* Filter */}
      <Box mb={6}>
        <Text fontWeight="bold" mb={3}>Filter Armor:</Text>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          bg="gray.700"
          color="white"
          borderColor="gray.600"
          fontSize="15px"
          fontWeight="500"
          height="42px"
          _hover={{ borderColor: "blue.400" }}
          _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
          sx={{
            option: {
              bg: "gray.800",
              color: "white",
              padding: "10px",
              fontSize: "15px",
              fontWeight: "500",
              _hover: {
                bg: "gray.700",
                color: "white"
              },
              _selected: {
                bg: "blue.600",
                color: "white"
              }
            }
          }}
        >
          <option value="all" style={{ backgroundColor: '#2D3748', color: '#FFFFFF' }}>All Armor</option>
          <option value="light" style={{ backgroundColor: '#2D3748', color: '#FFFFFF' }}>Light Armor (AR ≤ 10)</option>
          <option value="medium" style={{ backgroundColor: '#2D3748', color: '#FFFFFF' }}>Medium Armor (AR 11-15)</option>
          <option value="heavy" style={{ backgroundColor: '#2D3748', color: '#FFFFFF' }}>Heavy Armor (AR &gt; 15)</option>
          <option value="shields" style={{ backgroundColor: '#2D3748', color: '#FFFFFF' }}>Shields</option>
          <option value="clothing" style={{ backgroundColor: '#2D3748', color: '#FFFFFF' }}>Protective Clothing</option>
        </Select>
      </Box>

      {/* Armor Grid */}
      <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4}>
        {filteredArmor.map((armor, index) => (
          <GridItem key={index}>
            <Box
              bg="gray.700"
              p={4}
              borderRadius="lg"
              borderWidth="1px"
              borderColor="gray.600"
              _hover={{ borderColor: "blue.400", transform: "translateY(-2px)" }}
              transition="all 0.2s"
              cursor="pointer"
              onClick={() => {
                setSelectedArmor(armor);
                setShowPurchaseModal(true);
              }}
            >
              <Flex justify="space-between" align="center" mb={2}>
                <Text fontWeight="bold" fontSize="lg">
                  {getArmorTypeIcon(armor)} {armor.name}
                </Text>
                <Badge colorScheme={getArmorTypeColor(armor)}>
                  {armor.price} gp
                </Badge>
              </Flex>

              <VStack spacing={2} align="stretch">
                <Flex justify="space-between">
                  <Text fontSize="sm" color="gray.300">Armor Rating:</Text>
                  <Text fontSize="sm" fontWeight="bold" color="blue.300">
                    {armor.armorRating}
                  </Text>
                </Flex>

                <Flex justify="space-between">
                  <Text fontSize="sm" color="gray.300">S.D.C.:</Text>
                  <Text fontSize="sm" fontWeight="bold" color="green.300">
                    {armor.sdc}
                  </Text>
                </Flex>

                <Flex justify="space-between">
                  <Text fontSize="sm" color="gray.300">Weight:</Text>
                  <Text fontSize="sm" fontWeight="bold" color="yellow.300">
                    {armor.weight} lbs
                  </Text>
                </Flex>

                {armor.description && (
                  <Text fontSize="xs" color="gray.400" mt={2}>
                    {armor.description}
                  </Text>
                )}

                {/* Purchase Button */}
                <Button
                  colorScheme="blue"
                  size="sm"
                  mt={3}
                  isDisabled={!selectedCharacter || selectedCharacter.gold < armor.price}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedArmor(armor);
                    setShowPurchaseModal(true);
                  }}
                >
                  Purchase ({armor.price} gp)
                </Button>
              </VStack>
            </Box>
          </GridItem>
        ))}
      </Grid>

      {/* Purchase Modal */}
      <Modal isOpen={showPurchaseModal} onClose={() => setShowPurchaseModal(false)}>
        <ModalOverlay />
        <ModalContent bg="gray.800" color="white">
          <ModalHeader>
            <Heading size="md">Purchase Armor</Heading>
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody>
            {selectedArmor && selectedCharacter && (
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontWeight="bold" fontSize="lg" mb={2}>
                    {getArmorTypeIcon(selectedArmor)} {selectedArmor.name}
                  </Text>
                  <Text color="gray.300" mb={3}>{selectedArmor.description}</Text>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="bold" mb={2}>Armor Statistics:</Text>
                  <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                    <Flex justify="space-between">
                      <Text fontSize="sm">Armor Rating:</Text>
                      <Text fontSize="sm" fontWeight="bold" color="blue.300">
                        {selectedArmor.armorRating}
                      </Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text fontSize="sm">S.D.C.:</Text>
                      <Text fontSize="sm" fontWeight="bold" color="green.300">
                        {selectedArmor.sdc}
                      </Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text fontSize="sm">Weight:</Text>
                      <Text fontSize="sm" fontWeight="bold" color="yellow.300">
                        {selectedArmor.weight} lbs
                      </Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text fontSize="sm">Price:</Text>
                      <Text fontSize="sm" fontWeight="bold" color="purple.300">
                        {selectedArmor.price} gp
                      </Text>
                    </Flex>
                  </Grid>
                </Box>

                <Divider />

                <Box>
                  <Text fontWeight="bold" mb={2}>Character Information:</Text>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Character:</Text>
                    <Text fontSize="sm" fontWeight="bold">{selectedCharacter.name}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Current Gold:</Text>
                    <Text fontSize="sm" fontWeight="bold" color="yellow.300">
                      {selectedCharacter.gold || 0} gp
                    </Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">After Purchase:</Text>
                    <Text fontSize="sm" fontWeight="bold" color="green.300">
                      {(selectedCharacter.gold || 0) - selectedArmor.price} gp
                    </Text>
                  </Flex>
                </Box>

                {selectedCharacter.gold < selectedArmor.price && (
                  <Alert status="error">
                    <AlertIcon />
                    Insufficient gold! Need {selectedArmor.price - (selectedCharacter.gold || 0)} more gp.
                  </Alert>
                )}
              </VStack>
            )}
          </ModalBody>

          <ModalFooter>
            <Button 
              colorScheme="gray" 
              mr={3} 
              onClick={() => setShowPurchaseModal(false)}
            >
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handlePurchaseArmor}
              isDisabled={!selectedCharacter || selectedCharacter.gold < selectedArmor?.price}
            >
              Purchase {selectedArmor?.price} gp
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ArmorShop;

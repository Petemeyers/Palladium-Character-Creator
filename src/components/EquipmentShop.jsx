import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Grid,
  Card,
  CardBody,
  Text,
  Badge,
  Button,
  Select,
  Alert,
  AlertIcon,
  HStack,
  VStack,
  Divider,
} from '@chakra-ui/react';
import axiosInstance from '../utils/axios';
import { weapons } from '../data/weapons.js';
import { armors } from '../data/armor.js';

const EquipmentShop = ({ onUpdateCharacter }) => {
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await axiosInstance.get('/characters');
      setCharacters(response.data);
    } catch (err) {
      setError('Failed to fetch characters');
      console.error('Error fetching characters:', err);
    }
  };

  const handlePurchase = async (item, type) => {
    if (!selectedCharacter) {
      alert('Please select a character first');
      return;
    }

    if (selectedCharacter.gold < item.price) {
      alert('Not enough gold!');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Add item to character's inventory
      const updatedInventory = [...(selectedCharacter.inventory || []), item];
      
      // Update character with new item and reduced gold
      const updates = {
        inventory: updatedInventory,
        gold: selectedCharacter.gold - item.price,
        // Auto-equip first weapon/armor if none equipped
        equippedWeapon: type === 'weapon' && !selectedCharacter.equippedWeapon ? item.name : selectedCharacter.equippedWeapon,
        equippedArmor: type === 'armor' && !selectedCharacter.equippedArmor ? item.name : selectedCharacter.equippedArmor
      };

      const response = await axiosInstance.put(`/characters/${selectedCharacter._id}`, updates);
      
      if (response.data.success) {
        setSuccess(`${item.name} purchased successfully!`);
        setCharacters(chars => chars.map(char => 
          char._id === selectedCharacter._id ? response.data.character : char
        ));
        setSelectedCharacter(response.data.character);
        
        // Notify parent component
        if (onUpdateCharacter) {
          onUpdateCharacter(selectedCharacter._id, updates);
        }
      }
    } catch (err) {
      setError('Failed to purchase item');
      console.error('Purchase error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group weapons by category
  const weaponsByCategory = weapons.reduce((acc, weapon) => {
    const category = weapon.category || 'misc';
    if (!acc[category]) acc[category] = [];
    acc[category].push(weapon);
    return acc;
  }, {});

  // Group armors by category
  const armorsByCategory = armors.reduce((acc, armor) => {
    const category = armor.category || 'misc';
    if (!acc[category]) acc[category] = [];
    acc[category].push(armor);
    return acc;
  }, {});

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>Equipment Shop</Heading>
      
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert status="success" mb={4}>
          <AlertIcon />
          {success}
        </Alert>
      )}

      <VStack spacing={4} align="stretch">
        {/* Character Selection */}
        <Box>
          <Text fontWeight="bold" mb={2}>Select Character:</Text>
          <Select
            placeholder="Choose a character"
            value={selectedCharacter?._id || ''}
            onChange={(e) => {
              const charId = e.target.value;
              const character = characters.find(c => c._id === charId);
              setSelectedCharacter(character);
            }}
          >
            {characters.map(char => (
              <option key={char._id} value={char._id}>
                {char.name} - {char.gold || 0} gold
              </option>
            ))}
          </Select>
        </Box>

        {selectedCharacter && (
          <Box>
            <Text>
              <strong>Selected:</strong> {selectedCharacter.name} 
              ({selectedCharacter.species} {selectedCharacter.class}) - 
              <strong> {selectedCharacter.gold || 0} gold</strong>
            </Text>
          </Box>
        )}

        <Divider />

        {/* Equipment Tabs */}
        <Tabs variant="enclosed">
          <TabList>
            <Tab>Weapons</Tab>
            <Tab>Armor</Tab>
          </TabList>

          <TabPanels>
            {/* Weapons Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                {Object.entries(weaponsByCategory).map(([category, categoryWeapons]) => (
                  <Box key={category}>
                    <Heading size="md" mb={2} textTransform="capitalize">
                      {category.replace('-', ' ')} Weapons
                    </Heading>
                    <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={4}>
                      {categoryWeapons.map((weapon, index) => (
                        <Card key={index}>
                          <CardBody>
                            <VStack align="start" spacing={2}>
                              <HStack justify="space-between" width="100%">
                                <Text fontWeight="bold">{weapon.name}</Text>
                                <Badge colorScheme="blue">{weapon.price} gp</Badge>
                              </HStack>
                              
                              <Text fontSize="sm" color="gray.600">
                                <strong>Damage:</strong> {weapon.damage}
                              </Text>
                              
                              <Text fontSize="sm" color="gray.600">
                                <strong>Weight:</strong> {weapon.weight} lbs
                              </Text>
                              
                              <Text fontSize="sm" color="gray.600">
                                <strong>Category:</strong> {weapon.category}
                              </Text>

                              <Button
                                colorScheme="green"
                                size="sm"
                                onClick={() => handlePurchase(weapon, 'weapon')}
                                isDisabled={loading || !selectedCharacter || selectedCharacter.gold < weapon.price}
                                width="100%"
                              >
                                Buy ({weapon.price} gp)
                              </Button>
                            </VStack>
                          </CardBody>
                        </Card>
                      ))}
                    </Grid>
                  </Box>
                ))}
              </VStack>
            </TabPanel>

            {/* Armor Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                {Object.entries(armorsByCategory).map(([category, categoryArmors]) => (
                  <Box key={category}>
                    <Heading size="md" mb={2} textTransform="capitalize">
                      {category.replace('-', ' ')} Armor
                    </Heading>
                    <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={4}>
                      {categoryArmors.map((armor, index) => (
                        <Card key={index}>
                          <CardBody>
                            <VStack align="start" spacing={2}>
                              <HStack justify="space-between" width="100%">
                                <Text fontWeight="bold">{armor.name}</Text>
                                <Badge colorScheme="purple">{armor.price} gp</Badge>
                              </HStack>
                              
                              <Text fontSize="sm" color="gray.600">
                                <strong>Defense:</strong> +{armor.defense}
                              </Text>
                              
                              <Text fontSize="sm" color="gray.600">
                                <strong>Weight:</strong> {armor.weight} lbs
                              </Text>
                              
                              <Text fontSize="sm" color="gray.600">
                                <strong>Category:</strong> {armor.category}
                              </Text>

                              <Text fontSize="sm" color="gray.500">
                                {armor.description}
                              </Text>

                              <Button
                                colorScheme="purple"
                                size="sm"
                                onClick={() => handlePurchase(armor, 'armor')}
                                isDisabled={loading || !selectedCharacter || selectedCharacter.gold < armor.price}
                                width="100%"
                              >
                                Buy ({armor.price} gp)
                              </Button>
                            </VStack>
                          </CardBody>
                        </Card>
                      ))}
                    </Grid>
                  </Box>
                ))}
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
};

export default EquipmentShop;
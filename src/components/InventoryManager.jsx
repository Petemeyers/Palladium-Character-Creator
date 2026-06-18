import React, { useState } from "react";
import {
  Box,
  Heading,
  Select,
  Button,
  VStack,
  Text,
  HStack,
  Badge,
  Table,
  Tbody,
  Tr,
  Td,
  Th,
  Thead,
  Alert,
  AlertIcon,
  Divider,
} from "@chakra-ui/react";
import { useParty } from "../context/PartyContext";
import axiosInstance from "../utils/axios";
import { getEncumbranceInfo, formatEncumbranceDisplay } from "../utils/encumbrance";

const InventoryManager = ({ onUpdateCharacter }) => {
  const { activeParty } = useParty();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!activeParty) {
    return (
      <Box className="container" p={4}>
        <Heading size="md" mb={4}>Inventory Manager</Heading>
        <Text>Load a party first to manage character inventories.</Text>
      </Box>
    );
  }

  const handleEquip = async (charId, itemName, itemType) => {
    if (!itemName) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const update = itemType === "weapon" 
        ? { equistaminadWeapon: itemName }
        : { equistaminadArmor: itemName };
      
      await onUpdateCharacter(charId, update);
      setSuccess(`${itemName} equistaminad successfully!`);
    } catch (err) {
      setError(`Failed to equip ${itemType}. Please try again.`);
      console.error(`Error equipping ${itemType}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnequip = async (charId, itemType) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const update = itemType === "weapon" 
        ? { equistaminadWeapon: "" }
        : { equistaminadArmor: "" };
      
      await onUpdateCharacter(charId, update);
      setSuccess(`${itemType} unequistaminad successfully!`);
    } catch (err) {
      setError(`Failed to unequip ${itemType}. Please try again.`);
      console.error(`Error unequipping ${itemType}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const getWeaponStats = (weaponName, inventory) => {
    const weapon = inventory?.find(item => item.name === weaponName && item.type === "Weapon");
    return weapon;
  };

  const getWeaponsFromInventory = (inventory) => {
    return inventory?.filter(item => item.type === "Weapon") || [];
  };

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>Inventory Manager</Heading>

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

      {activeParty && (
        <Alert status="info" mb={4}>
          <AlertIcon />
          Managing inventory for: <strong>{activeParty.name}</strong>
        </Alert>
      )}

      <VStack spacing={6} align="stretch">
        {activeParty.members.map((char) => {
          const weapons = getWeaponsFromInventory(char.inventory);
          const equistaminadWeapon = getWeaponStats(char.equistaminadWeapon, char.inventory);
          const armors = char.inventory?.filter(item => item.type === "armor") || [];
          const consumables = char.inventory?.filter(item => item.type === "consumable") || [];
          const equistaminadArmor = char.inventory?.find(item => item.name === char.equistaminadArmor && item.type === "armor");
          const encumbranceInfo = getEncumbranceInfo(char);
          
          return (
            <Box key={char._id} border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
              <VStack align="stretch" spacing={3}>
                {/* Character Header */}
                <HStack justify="space-between">
                  <VStack align="start" spacing={1}>
                    <Heading size="sm">{char.name}</Heading>
                    <Text fontSize="sm" color="gray.600">
                      {char.species} {char.class} Ã¢â‚¬Â¢ Gold: {char.gold || 0}
                    </Text>
                    <Text fontSize="sm" color={encumbranceInfo.color}>
                      Weight: {formatEncumbranceDisplay(char)}
                    </Text>
                    {encumbranceInfo.totalSpeedPenalty !== 0 && (
                      <Text fontSize="xs" color="orange.500">
                        Speed Penalty: -{encumbranceInfo.totalSpeedPenalty}%
                      </Text>
                    )}
                    {encumbranceInfo.armorPenalty.fatigueRate > 1 && (
                      <Text fontSize="xs" color="red.500">
                        Fatigue Rate: {encumbranceInfo.armorPenalty.fatigueRate}x
                      </Text>
                    )}
                    {encumbranceInfo.penalty.skill < 0 && (
                      <Text fontSize="xs" color="red.600" fontWeight="bold">
                        Ã¢Å¡Â  Encumbrance Penalty: {encumbranceInfo.penalty.skill} to skills, {encumbranceInfo.penalty.initiative} to initiative
                      </Text>
                    )}
                  </VStack>
                  <VStack align="end" spacing={1}>
                    <Badge colorScheme="blue" size="lg">
                      {char.inventory?.length || 0} items
                    </Badge>
                    {encumbranceInfo.isOverloaded && (
                      <Badge colorScheme="red" size="sm">OVERLOADED</Badge>
                    )}
                  </VStack>
                </HStack>

                <Divider />

                {/* Equistaminad Items */}
                <Box>
                  <Text fontWeight="bold" mb={2}>Currently Equistaminad:</Text>
                  <VStack align="stretch" spacing={2}>
                    {/* Weapon */}
                    <HStack justify="space-between">
                      <HStack spacing={2}>
                        <Text fontSize="sm" fontWeight="semibold">Weapon:</Text>
                        {equistaminadWeapon ? (
                          <HStack spacing={2}>
                            <Badge colorScheme="green" size="sm">
                              {equistaminadWeapon.name}
                            </Badge>
                            <Text fontSize="sm">
                              {equistaminadWeapon.damage && `(${equistaminadWeapon.damage})`}
                            </Text>
                          </HStack>
                        ) : (
                          <Text fontSize="sm" color="gray.500">Unarmed (1d4)</Text>
                        )}
                      </HStack>
                      {equistaminadWeapon && (
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="outline"
                          onClick={() => handleUnequip(char._id, "weapon")}
                          isDisabled={loading}
                        >
                          Unequip
                        </Button>
                      )}
                    </HStack>

                    {/* Armor */}
                    <HStack justify="space-between">
                      <HStack spacing={2}>
                        <Text fontSize="sm" fontWeight="semibold">Armor:</Text>
                        {equistaminadArmor ? (
                          <HStack spacing={2}>
                            <Badge colorScheme="blue" size="sm">
                              {equistaminadArmor.name}
                            </Badge>
                            <Text fontSize="sm">
                              {equistaminadArmor.defense && `(+${equistaminadArmor.defense} defense)`}
                            </Text>
                          </HStack>
                        ) : (
                          <Text fontSize="sm" color="gray.500">None</Text>
                        )}
                      </HStack>
                      {equistaminadArmor && (
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="outline"
                          onClick={() => handleUnequip(char._id, "armor")}
                          isDisabled={loading}
                        >
                          Unequip
                        </Button>
                      )}
                    </HStack>
                  </VStack>
                </Box>

                {/* Item Selection */}
                <VStack align="stretch" spacing={3}>
                  {/* Weapons */}
                  {weapons.length > 0 && (
                    <Box>
                      <Text fontWeight="bold" mb={2}>Available Weapons:</Text>
                      <HStack spacing={2} wrap="wrap">
                        {weapons.map((weapon, idx) => (
                          <Button
                            key={idx}
                            size="sm"
                            colorScheme={char.equistaminadWeapon === weapon.name ? "green" : "gray"}
                            variant={char.equistaminadWeapon === weapon.name ? "solid" : "outline"}
                            onClick={() => handleEquip(char._id, weapon.name, "weapon")}
                            isDisabled={loading || char.equistaminadWeapon === weapon.name}
                          >
                            {weapon.name}
                            {weapon.damage && ` (${weapon.damage})`}
                          </Button>
                        ))}
                      </HStack>
                    </Box>
                  )}

                  {/* Armor */}
                  {armors.length > 0 && (
                    <Box>
                      <Text fontWeight="bold" mb={2}>Available Armor:</Text>
                      <HStack spacing={2} wrap="wrap">
                        {armors.map((armor, idx) => (
                          <Button
                            key={idx}
                            size="sm"
                            colorScheme={char.equistaminadArmor === armor.name ? "blue" : "gray"}
                            variant={char.equistaminadArmor === armor.name ? "solid" : "outline"}
                            onClick={() => handleEquip(char._id, armor.name, "armor")}
                            isDisabled={loading || char.equistaminadArmor === armor.name}
                          >
                            {armor.name}
                            {armor.defense && ` (+${armor.defense})`}
                          </Button>
                        ))}
                      </HStack>
                    </Box>
                  )}

                  {/* Consumables */}
                  {consumables.length > 0 && (
                    <Box>
                      <Text fontWeight="bold" mb={2}>Available Consumables:</Text>
                      <HStack spacing={2} wrap="wrap">
                        {consumables.map((consumable, idx) => (
                          <Badge
                            key={idx}
                            colorScheme="purple"
                            size="lg"
                            p={2}
                          >
                            {consumable.name}
                            {consumable.effect && ` (${consumable.effect})`}
                          </Badge>
                        ))}
                      </HStack>
                    </Box>
                  )}
                </VStack>

                {/* Full Inventory Table */}
                {char.inventory && char.inventory.length > 0 && (
                  <Box>
                    <Text fontWeight="bold" mb={2}>Full Inventory:</Text>
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Item</Th>
                          <Th>Type</Th>
                          <Th>Category</Th>
                          <Th>Stats</Th>
                          <Th>Weight</Th>
                          <Th>Price</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {char.inventory.map((item, idx) => (
                          <Tr 
                            key={idx}
                            bg={
                              item.name === char.equistaminadWeapon ? "green.50" : 
                              item.name === char.equistaminadArmor ? "blue.50" : 
                              "inherit"
                            }
                          >
                            <Td>
                              <HStack>
                                <Text fontWeight={
                                  item.name === char.equistaminadWeapon || item.name === char.equistaminadArmor ? "bold" : "normal"
                                }>
                                  {item.name}
                                </Text>
                                {item.name === char.equistaminadWeapon && (
                                  <Badge colorScheme="green" size="sm">WEAPON</Badge>
                                )}
                                {item.name === char.equistaminadArmor && (
                                  <Badge colorScheme="blue" size="sm">ARMOR</Badge>
                                )}
                              </HStack>
                            </Td>
                            <Td>
                              <Badge 
                                colorScheme={
                                  item.type === "weapon" ? "green" : 
                                  item.type === "armor" ? "blue" : 
                                  item.type === "consumable" ? "purple" : 
                                  "gray"
                                }
                                size="sm"
                              >
                                {item.type}
                              </Badge>
                            </Td>
                            <Td>{item.category}</Td>
                            <Td>
                              {item.damage && `Damage: ${item.damage}`}
                              {item.defense && `Defense: +${item.defense}`}
                              {item.effect && `Effect: ${item.effect}`}
                              {!item.damage && !item.defense && !item.effect && "-"}
                            </Td>
                            <Td>{item.weight || 0} lbs</Td>
                            <Td>{item.price || 0} gold</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}

                {(!char.inventory || char.inventory.length === 0) && (
                  <Text color="gray.500" fontStyle="italic">
                    No items in inventory. Visit the Weapon Shop to purchase equipment.
                  </Text>
                )}
              </VStack>
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
};

export default InventoryManager;

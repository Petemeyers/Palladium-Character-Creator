import React, { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Box,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Divider,
  IconButton,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import { CheckIcon, CloseIcon } from "@chakra-ui/icons";

/**
 * LootWindow Component
 * Displays loot from a defeated character/enemy
 * Can be used in combat arena or quest scenes
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {Object} props.loot - Loot object with { inventory, weapons, armor }
 * @param {string} props.sourceName - Name of the source (defeated character/enemy)
 * @param {Function} props.onTakeItem - Optional callback when item is taken (item, type)
 * @param {Function} props.onTakeAll - Optional callback when "Take All" is clicked
 * @param {boolean} props.allowSelection - Whether to allow selecting individual items (default: true)
 */
const LootWindow = ({
  isOpen,
  onClose,
  loot,
  sourceName = "Defeated Enemy",
  onTakeItem = null,
  onTakeAll = null,
  allowSelection = true,
}) => {
  const [selectedItems, setSelectedItems] = useState(new Set());
  const toast = useToast();

  // Reset selections when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedItems(new Set());
    }
  }, [isOpen]);

  if (!loot) {
    return null;
  }

  const inventory = loot.inventory || [];
  const weapons = loot.weapons || [];
  const armor = loot.armor ? [loot.armor] : [];

  const allItems = [
    ...inventory.map(item => ({ ...item, type: "inventory", category: item.type || "misc" })),
    ...weapons.map(weapon => ({ ...weapon, type: "weapon", category: "weapon" })),
    ...armor.map(armor => ({ ...armor, type: "armor", category: "armor" })),
  ];

  const totalItems = allItems.length;
  const selectedCount = selectedItems.size;

  const handleToggleItem = (itemKey) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  const handleTakeItem = (item, itemType) => {
    if (onTakeItem) {
      onTakeItem(item, itemType);
      toast({
        title: "Item Taken",
        description: `${item.name} has been added to your inventory.`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  const handleTakeSelected = () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select items to take.",
        status: "warning",
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    selectedItems.forEach((itemKey) => {
      const [index, type] = itemKey.split("::");
      const item = type === "inventory" 
        ? inventory[parseInt(index)]
        : type === "weapon"
        ? weapons[parseInt(index)]
        : armor[parseInt(index)];
      
      if (item && onTakeItem) {
        handleTakeItem(item, type);
      }
    });

    setSelectedItems(new Set());
  };

  const handleTakeAll = () => {
    if (onTakeAll) {
      onTakeAll(allItems);
      toast({
        title: "All Items Taken",
        description: `All ${totalItems} items have been added to your inventory.`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } else if (onTakeItem) {
      allItems.forEach((item) => {
        handleTakeItem(item, item.type);
      });
    }
    setSelectedItems(new Set());
  };

  const getItemKey = (item, index, type) => {
    return `${index}::${type}`;
  };

  const getItemDisplayName = (item) => {
    return item.name || "Unknown Item";
  };

  const getItemDetails = (item) => {
    const details = [];
    if (item.damage) details.push(`Damage: ${item.damage}`);
    if (item.defense || item.ar) details.push(`AR: ${item.defense || item.ar}`);
    if (item.weight) details.push(`Weight: ${item.weight} lbs`);
    if (item.effect) details.push(`Effect: ${item.effect}`);
    if (item.quantity && item.quantity > 1) details.push(`Qty: ${item.quantity}`);
    if (item.reach) details.push(`Reach: ${item.reach}ft`);
    if (item.range) details.push(`Range: ${item.range}ft`);
    return details;
  };

  const getTypeColorScheme = (type) => {
    switch (type) {
      case "weapon":
        return "red";
      case "armor":
        return "blue";
      case "consumable":
        return "green";
      case "misc":
        return "gray";
      default:
        return "purple";
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="80vh">
        <ModalHeader>
          💰 Loot from {sourceName}
          <Badge ml={2} colorScheme="yellow">
            {totalItems} item{totalItems !== 1 ? "s" : ""}
          </Badge>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {totalItems === 0 ? (
            <Box textAlign="center" py={8}>
              <Text fontSize="lg" color="gray.500" fontStyle="italic">
                No loot found. This {sourceName.toLowerCase()} had nothing of value.
              </Text>
            </Box>
          ) : (
            <VStack align="stretch" spacing={4}>
              {/* Action Buttons */}
              {allowSelection && (
                <HStack spacing={2} justify="flex-end">
                  <Button
                    size="sm"
                    colorScheme="blue"
                    variant="outline"
                    onClick={handleTakeSelected}
                    isDisabled={selectedCount === 0}
                  >
                    Take Selected ({selectedCount})
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="green"
                    onClick={handleTakeAll}
                  >
                    Take All ({totalItems})
                  </Button>
                </HStack>
              )}

              {/* Loot Table */}
              <Box overflowY="auto" maxH="400px">
                <Table variant="simple" size="sm">
                  <Thead position="sticky" top={0} bg="white" zIndex={1}>
                    <Tr>
                      {allowSelection && <Th width="50px">Select</Th>}
                      <Th>Item</Th>
                      <Th>Type</Th>
                      <Th>Details</Th>
                      {allowSelection && <Th width="100px">Action</Th>}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {allItems.map((item, index) => {
                      const itemKey = getItemKey(item, index, item.type);
                      const isSelected = selectedItems.has(itemKey);
                      const details = getItemDetails(item);

                      return (
                        <Tr
                          key={itemKey}
                          bg={isSelected ? "blue.50" : "transparent"}
                          _hover={{ bg: isSelected ? "blue.100" : "gray.50" }}
                        >
                          {allowSelection && (
                            <Td>
                              <IconButton
                                icon={isSelected ? <CheckIcon /> : <CloseIcon />}
                                size="xs"
                                colorScheme={isSelected ? "blue" : "gray"}
                                variant={isSelected ? "solid" : "outline"}
                                onClick={() => handleToggleItem(itemKey)}
                                aria-label={isSelected ? "Deselect" : "Select"}
                              />
                            </Td>
                          )}
                          <Td>
                            <Text fontWeight="bold">{getItemDisplayName(item)}</Text>
                            {item.notes && (
                              <Text fontSize="xs" color="gray.600" fontStyle="italic">
                                {item.notes}
                              </Text>
                            )}
                          </Td>
                          <Td>
                            <Badge colorScheme={getTypeColorScheme(item.category)}>
                              {item.category || item.type}
                            </Badge>
                          </Td>
                          <Td>
                            <VStack align="start" spacing={0.5}>
                              {details.map((detail, idx) => (
                                <Text key={idx} fontSize="xs" color="gray.600">
                                  {detail}
                                </Text>
                              ))}
                            </VStack>
                          </Td>
                          {allowSelection && (
                            <Td>
                              <Tooltip label={`Take ${item.name}`}>
                                <Button
                                  size="xs"
                                  colorScheme="green"
                                  onClick={() => handleTakeItem(item, item.type)}
                                >
                                  Take
                                </Button>
                              </Tooltip>
                            </Td>
                          )}
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </Box>

              {/* Summary */}
              {totalItems > 0 && (
                <>
                  <Divider />
                  <HStack justify="space-between" fontSize="sm" color="gray.600">
                    <Text>
                      <strong>Total:</strong> {totalItems} item{totalItems !== 1 ? "s" : ""}
                    </Text>
                    {allowSelection && selectedCount > 0 && (
                      <Text>
                        <strong>Selected:</strong> {selectedCount} item{selectedCount !== 1 ? "s" : ""}
                      </Text>
                    )}
                  </HStack>
                </>
              )}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="gray" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default LootWindow;


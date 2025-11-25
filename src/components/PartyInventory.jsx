import React, { useState } from "react";
import {
  Box,
  Heading,
  Table,
  Tr,
  Th,
  Td,
  Tbody,
  Select,
  Button,
  Input,
  Text,
  HStack,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { useParty } from "../context/PartyContext";
import axiosInstance from "../utils/axios";
import getSocket from "../utils/socket";

const socket = getSocket(); // Use centralized socket manager

const PartyInventory = ({ characters = [] }) => {
  const { activeParty } = useParty();
  const [selectedChar, setSelectedChar] = useState({});
  const [quantities, setQuantities] = useState({});
  const [rolloffMethod, setRolloffMethod] = useState({});

  const handleDistribute = async (item) => {
    if (!selectedChar[item.name]) return;
    try {
      const res = await axiosInstance.post(`/loot/${activeParty._id}/distribute`, {
        charId: selectedChar[item.name],
        itemName: item.name,
        quantity: quantities[item.name] || 1,
      });

      // Announce distribution to PartyChat
      const charName = characters.find(c => c._id === selectedChar[item.name])?.name || "Unknown";
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `🎁 Loot Distributed: ${quantities[item.name] || 1}x ${item.name} → ${charName}`,
        type: "system",
      });

      alert(`Distributed ${quantities[item.name] || 1} ${item.name} to ${charName}`);
    } catch (err) {
      console.error("Failed to distribute loot:", err);
      alert("Failed to distribute loot. Please try again.");
    }
  };

  const handleClaim = async (item, charId) => {
    try {
      const res = await axiosInstance.post(`/loot/${activeParty._id}/claim`, {
        charId,
        itemName: item.name,
      });

      // Announce claim to PartyChat
      const charName = characters.find(c => c._id === charId)?.name || "Someone";
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `✋ ${charName} has claimed ${item.name}`,
        type: "system",
      });
    } catch (err) {
      console.error("Failed to claim item:", err);
    }
  };

  const handleRolloff = async (item) => {
    try {
      const [method, attribute] = (
        rolloffMethod[item.name] || activeParty.defaultRolloffMethod || "d20"
      ).split(":");
      const res = await axiosInstance.post(`/loot/${activeParty._id}/rolloff`, {
        itemName: item.name,
        method,
        attribute,
        quantity: 1,
      });

      // Announce roll-off results to PartyChat
      const rollsText = res.data.rolls.map(r => `${r.charName} rolled ${r.roll}`).join(", ");
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `🎲 Loot Roll-Off (${method}${attribute ? " vs " + attribute : ""}) for ${item.name}: ${rollsText} → Winner: ${res.data.distributedTo}`,
        type: "system",
      });

      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `🎁 Loot Distributed: ${item.name} → ${res.data.distributedTo}`,
        type: "system",
      });

      alert(`Winner: ${res.data.distributedTo}`);
    } catch (err) {
      console.error("Failed roll-off:", err);
      alert("Failed to perform roll-off. Please try again.");
    }
  };

  if (!activeParty) {
    return (
      <Box className="container" p={4}>
        <Heading size="md" mb={4}>Party Inventory</Heading>
        <Text>Load a party first to access party inventory.</Text>
      </Box>
    );
  }

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>Party Inventory</Heading>
      
      {activeParty.inventory?.length === 0 ? (
        <Text color="gray.500" fontStyle="italic">
          No items in party inventory yet. Roll some loot after combat!
        </Text>
      ) : (
        <Table variant="simple">
          <thead>
            <Tr>
              <Th>Item</Th>
              <Th>Type</Th>
              <Th>Qty</Th>
              <Th>Details</Th>
              <Th>Claims</Th>
              <Th>Actions</Th>
            </Tr>
          </thead>
          <Tbody>
            {activeParty.inventory?.map((item, idx) => (
              <Tr key={idx}>
                <Td fontWeight="bold">{item.name}</Td>
                <Td>
                  <Badge colorScheme={
                    item.type === "weapon" ? "red" :
                    item.type === "armor" ? "blue" :
                    item.type === "consumable" ? "green" : "gray"
                  }>
                    {item.type}
                  </Badge>
                </Td>
                <Td>{item.quantity}</Td>
                <Td>
                  <VStack align="start" spacing={1}>
                    {item.damage && <Text fontSize="sm">Damage: {item.damage}</Text>}
                    {item.defense && <Text fontSize="sm">Defense: {item.defense}</Text>}
                    {item.effect && <Text fontSize="sm">Effect: {item.effect}</Text>}
                    {item.weight && <Text fontSize="sm">{item.weight} lbs</Text>}
                  </VStack>
                </Td>
                <Td>
                  <Text fontSize="sm" color="gray.600">
                    {item.claimedBy?.length
                      ? item.claimedBy.map((id) =>
                          characters.find((c) => c._id === id)?.name || "Unknown"
                        ).join(", ")
                      : "No claims"}
                  </Text>
                </Td>
                <Td>
                  <VStack align="stretch" spacing={2}>
                    {/* Distribution Controls */}
                    <HStack spacing={2}>
                      <Select
                        placeholder="Select Character"
                        onChange={(e) =>
                          setSelectedChar((prev) => ({ ...prev, [item.name]: e.target.value }))
                        }
                        width="150px"
                        size="sm"
                      >
                        {characters.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        width="70px"
                        placeholder="Qty"
                        value={quantities[item.name] || ""}
                        onChange={(e) =>
                          setQuantities((prev) => ({ ...prev, [item.name]: Number(e.target.value) }))
                        }
                        size="sm"
                      />
                      <Button 
                        size="sm" 
                        colorScheme="blue" 
                        onClick={() => handleDistribute(item)}
                        isDisabled={!selectedChar[item.name]}
                      >
                        Give
                      </Button>
                    </HStack>

                    {/* Roll-off Controls */}
                    {item.claimedBy?.length > 1 && (
                      <HStack spacing={2}>
                        <Select
                          placeholder="Roll-Off Method"
                          onChange={(e) =>
                            setRolloffMethod((prev) => ({ ...prev, [item.name]: e.target.value }))
                          }
                          width="160px"
                          size="sm"
                        >
                          <option value="d20">d20 (default)</option>
                          <option value="2d6">2d6</option>
                          <option value="attribute:PE">PE vs PE</option>
                          <option value="attribute:IQ">IQ vs IQ</option>
                          <option value="attribute:PP">PP vs PP</option>
                        </Select>
                        <Button
                          size="sm"
                          colorScheme="red"
                          onClick={() => handleRolloff(item)}
                        >
                          Roll-Off & Distribute
                        </Button>
                      </HStack>
                    )}

                    {/* Claim Buttons for Characters */}
                    <HStack spacing={1} wrap="wrap">
                      {characters.map((char) => (
                        <Button
                          key={char._id}
                          size="xs"
                          colorScheme="yellow"
                          onClick={() => handleClaim(item, char._id)}
                          isDisabled={item.claimedBy?.includes(char._id)}
                        >
                          {char.name} Claim
                        </Button>
                      ))}
                    </HStack>
                  </VStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  );
};

export default PartyInventory;

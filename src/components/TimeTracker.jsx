import React, { useEffect, useState } from "react";
import {
  Box,
  Heading,
  Button,
  Select,
  Text,
  HStack,
  VStack,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { useParty } from "../context/PartyContext";
import axiosInstance from "../utils/axios";
import getSocket from "../utils/socket";
import { generateEncounter, getAvailableLocations } from "../engine/encounters";

const socket = getSocket(); // Use centralized socket manager

const TimeTracker = () => {
  const { activeParty } = useParty();
  const [currentTime, setCurrentTime] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState("forest_low");
  const [advanceHours, setAdvanceHours] = useState(1);

  useEffect(() => {
    if (activeParty?.currentTime) {
      setCurrentTime(new Date(activeParty.currentTime));
    }
  }, [activeParty]);

  const handleAdvance = async () => {
    if (!activeParty?._id) return;
    try {
      const res = await axiosInstance.post(`/rest/advance-time/${activeParty._id}`, {
        hours: advanceHours,
      });
      const newT = new Date(res.data.newTime);
      setCurrentTime(newT);

      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `⏳ Time advanced ${advanceHours}h. It is now ${newT.toLocaleString()}.`,
        type: "system",
      });
    } catch (err) {
      console.error("Failed to advance time:", err);
      alert("Failed to advance time. Please try again.");
    }
  };

  const handleEncounter = () => {
    if (!activeParty?._id || !currentTime) return;
    
    // Determine time of day
    const hour = currentTime.getHours();
    const timeOfDay = hour >= 6 && hour < 18 ? 'daytime' : 'nighttime';
    
    // Generate encounter based on location and time
    const encounter = generateEncounter(selectedLocation, timeOfDay);
    if (!encounter) return;

    // Handle merchant encounters
    if (encounter.type === "Merchant") {
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `🛒 Random Encounter: ${encounter.name} — ${encounter.description}. Merchant: ${encounter.merchant.name} (${encounter.merchant.race}, ${encounter.merchant.personality.attitude})`,
        type: "system",
      });

      // Set current merchant in context for GM panel
      socket.emit("setCurrentMerchant", {
        partyId: activeParty._id,
        merchant: encounter.merchant,
      });
    } else {
      // Post encounter to chat
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `🎲 Random Encounter: ${encounter.name} (${encounter.type}) — ${encounter.description}`,
        type: "system",
      });

      // If encounter has enemies, send them to combat tracker
      if (encounter.enemies?.length > 0) {
        socket.emit("addEnemies", {
          partyId: activeParty._id,
          enemies: encounter.enemies,
        });
      }
    }
  };

  const getDayNightSymbol = (date) => {
    if (!date) return "";
    const hour = date.getHours();
    if (hour >= 6 && hour < 18) return "🌞 Daytime";
    return "🌙 Nighttime";
  };

  if (!activeParty) {
    return (
      <Box className="container" p={4}>
        <Heading size="md" mb={4}>World Time</Heading>
        <Text>Load a party first to access time tracking.</Text>
      </Box>
    );
  }

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>World Time</Heading>
      
      {activeParty && (
        <Alert status="info" mb={4}>
          <AlertIcon />
          Managing time for: <strong>{activeParty.name}</strong>
        </Alert>
      )}

      <VStack spacing={4} align="stretch">
        {/* Current Time Display */}
        <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
          <VStack align="start" spacing={2}>
            <Text fontSize="lg" fontWeight="bold">
              Current In-Game Time:
            </Text>
            <Text fontSize="xl" color="blue.600">
              {currentTime ? currentTime.toLocaleString() : "Unknown"}
            </Text>
            {currentTime && (
              <Text fontSize="lg" fontWeight="bold" color="orange.500">
                {getDayNightSymbol(currentTime)}
              </Text>
            )}
          </VStack>
        </Box>

        {/* Time Advancement Controls */}
        <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
          <VStack spacing={3}>
            <Text fontWeight="bold">Advance Time:</Text>
            <HStack spacing={3}>
              <Select
                width="150px"
                value={advanceHours}
                onChange={(e) => setAdvanceHours(Number(e.target.value))}
              >
                <option value={1}>+1 hour</option>
                <option value={4}>+4 hours</option>
                <option value={8}>+8 hours</option>
                <option value={12}>+12 hours</option>
                <option value={24}>+24 hours</option>
              </Select>
              <Button colorScheme="blue" onClick={handleAdvance}>
                Advance Time
              </Button>
            </HStack>
          </VStack>
        </Box>

        {/* Random Encounter */}
        <Box p={4} border="1px solid" borderColor="gray.200" borderRadius="md">
          <VStack spacing={3}>
            <Text fontWeight="bold">Random Encounters:</Text>
            <Select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              size="sm"
            >
              {getAvailableLocations().map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
            <Button colorScheme="red" onClick={handleEncounter}>
              🎲 Roll Random Encounter
            </Button>
            <Text fontSize="sm" color="gray.600" textAlign="center">
              Encounters vary by location and time of day. Daytime encounters are generally safer, while nighttime brings more dangerous foes.
            </Text>
          </VStack>
        </Box>

        {/* Quick Reference */}
        <Box p={4} bg="gray.50" borderRadius="md">
          <Heading size="sm" mb={3}>Time Reference</Heading>
          <VStack align="stretch" spacing={1}>
            <HStack justify="space-between">
              <Text fontSize="sm">🌞 Daytime:</Text>
              <Text fontSize="sm" color="gray.600">6:00 AM - 6:00 PM</Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="sm">🌙 Nighttime:</Text>
              <Text fontSize="sm" color="gray.600">6:00 PM - 6:00 AM</Text>
            </HStack>
            <HStack justify="space-between">
              <Text fontSize="sm">Rest Options:</Text>
              <Text fontSize="sm" color="gray.600">Short (4h), Full (8h), Extended (12h)</Text>
            </HStack>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
};

export default TimeTracker;

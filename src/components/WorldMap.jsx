import React, { useState } from "react";
import PropTypes from "prop-types";
import { Box, Button, Heading, Select, Text, Alert, AlertIcon, VStack, HStack, Input, FormControl, FormLabel } from "@chakra-ui/react";
import { startLocations } from "../data/startLocations";
import { rollDice } from "./util";
import { useParty } from "../context/PartyContext";
import PartyChat from "./PartyChat";
import axiosInstance from "../utils/axios";

const WorldMap = ({ onChooseLocation }) => {
  const [selected, setSelected] = useState("");
  const [finalLocation, setFinalLocation] = useState(null);
  const { activeParty, clearActiveParty, refreshActiveParty, refreshInterval, setRefreshInterval } = useParty();

  const handleSelect = async () => {
    if (selected) {
      const chosen = startLocations.find((loc) => loc.id === selected);
      setFinalLocation(chosen);
      
      // Send system message if active party is loaded
      if (activeParty?._id) {
        try {
          await axiosInstance.post(`/messages/${activeParty._id}/system`, {
            text: `The party sets off toward ${chosen.label} in the ${chosen.region}.`,
            type: "system",
            user: "System"
          });
        } catch (err) {
          console.error("Failed to send system message:", err);
        }
      }
      
      if (onChooseLocation) onChooseLocation(chosen);
    }
  };

  const handleRandom = async () => {
    const roll = rollDice(startLocations.length, 1);
    const chosen = startLocations[roll - 1];
    setFinalLocation(chosen);
    
    // Send system message if active party is loaded
    if (activeParty?._id) {
      try {
        await axiosInstance.post(`/messages/${activeParty._id}/system`, {
          text: `The party randomly arrives at ${chosen.label} in the ${chosen.region}.`,
          type: "system",
          user: "System"
        });
      } catch (err) {
        console.error("Failed to send system message:", err);
      }
    }
    
    if (onChooseLocation) onChooseLocation(chosen);
  };

  return (
    <>
      <Box className="container" textAlign="center" p={8}>
        <Heading mb={4}>🗺️ World Map - Choose Starting Location</Heading>
        
        {activeParty ? (
          <Alert status="info" mb={6} borderRadius="md">
            <AlertIcon />
            <VStack align="start" spacing={1}>
              <Text fontWeight="bold">
                Active Party: {activeParty.name}
              </Text>
              <Text fontSize="sm">
                Current Location: {activeParty.startLocation?.label || "Unknown"} ({activeParty.startLocation?.region || "Unknown Region"})
              </Text>
              <Text fontSize="sm">
                Members: {activeParty.members?.length || 0} characters
              </Text>
              <Button
                mt={2}
                colorScheme="yellow"
                size="sm"
                onClick={() => {
                  clearActiveParty();
                  alert("Party unloaded from session!");
                }}
              >
                Unload Party
              </Button>
              <Button
                mt={2}
                ml={2}
                colorScheme="blue"
                size="sm"
                onClick={() => {
                  refreshActiveParty();
                  alert("Party data refreshed from database!");
                }}
              >
                Refresh Party
              </Button>
              <Box mt={3} p={3} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
                <Text fontSize="sm" fontWeight="bold" color="blue.700" mb={2}>
                  Auto-Refresh Settings
                </Text>
                <HStack spacing={2}>
                  <FormControl size="sm">
                    <FormLabel fontSize="xs" mb={1}>Interval (seconds):</FormLabel>
                    <Input
                      type="number"
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Math.max(10, parseInt(e.target.value) || 60))}
                      size="sm"
                      width="80px"
                      min={10}
                      max={300}
                    />
                  </FormControl>
                  <Text fontSize="xs" color="blue.600">
                    Auto-refresh every {refreshInterval}s + Party-specific real-time updates
                  </Text>
                </HStack>
              </Box>
            </VStack>
          </Alert>
        ) : (
          <Alert status="warning" mb={6} borderRadius="md">
            <AlertIcon />
            <Text>No active party loaded. Load a party from the Party List to begin your adventure!</Text>
          </Alert>
        )}

        <Text mb={6} color="gray.600">
          Select where your party begins their adventure, or roll randomly for a surprise!
        </Text>

      <Select
        placeholder="Select a starting location"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        mb={4}
        maxW="400px"
        mx="auto"
      >
        {startLocations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.label} ({loc.region})
          </option>
        ))}
      </Select>

      <Box mb={6}>
        <Button onClick={handleSelect} mr={2} colorScheme="blue" size="lg">
          ✅ Confirm Choice
        </Button>
        <Button onClick={handleRandom} colorScheme="purple" variant="outline" size="lg">
          🎲 Random Location
        </Button>
      </Box>

      {finalLocation && (
        <Box mt={6} p={6} bg="green.50" borderRadius="lg" border="2px solid" borderColor="green.200">
          <Heading size="md" color="green.700" mb={2}>📍 Starting Point:</Heading>
          <Text fontSize="lg" fontWeight="bold" color="green.800">
            {finalLocation.label}
          </Text>
          <Text color="green.600" mb={2}>
            Region: {finalLocation.region}
          </Text>
          <Text color="gray.700" fontSize="sm">
            {finalLocation.description}
          </Text>
          
          {finalLocation.suggestedSkills && (
            <Box mt={4}>
              <Text fontWeight="bold" color="blue.700" mb={2}>Suggested Skills:</Text>
              <Text fontSize="sm" color="blue.600">
                {finalLocation.suggestedSkills.join(", ")}
              </Text>
            </Box>
          )}
          
          {finalLocation.npcTypes && (
            <Box mt={2}>
              <Text fontWeight="bold" color="purple.700" mb={2}>Common NPCs:</Text>
              <Text fontSize="sm" color="purple.600">
                {finalLocation.npcTypes.join(", ")}
              </Text>
            </Box>
          )}
        </Box>
        )}

        {/* Party Chat Section */}
        <PartyChat username="GM" />
      </Box>
    </>
  );
};

WorldMap.propTypes = {
  onChooseLocation: PropTypes.func
};

export default WorldMap;

import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Alert,
  AlertIcon,
  Select,
  Grid,
  GridItem,
  Card,
  CardBody,
  CardHeader,
  Divider,
} from "@chakra-ui/react";
import { LOCATIONS, TRAVEL_ROUTES, ENCOUNTER_TABLES } from "../data/mapData";
import { travel, getRandomEncounter } from "./util";
import axiosInstance from "../utils/axios";
import { useParty } from "../context/PartyContext";
import getSocket from "../utils/socket";

const socket = getSocket(); // Use centralized socket manager

const GMWorldMap = () => {
  const { activeParty, setActiveParty } = useParty();
  const [currentLocation, setCurrentLocation] = useState(
    activeParty?.location || "Greyford Village"
  );
  const [isTraveling, setIsTraveling] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);

  useEffect(() => {
    if (activeParty?.location) {
      setCurrentLocation(activeParty.location);
    }
  }, [activeParty?.location]);

  const getCurrentLocationData = () => {
    return LOCATIONS.find((loc) => loc.name === currentLocation);
  };

  const getAvailableDestinations = () => {
    const routes = TRAVEL_ROUTES[currentLocation] || {};
    return Object.keys(routes).map((destName) => ({
      name: destName,
      ...LOCATIONS.find((loc) => loc.name === destName),
      ...routes[destName],
    }));
  };

  const handleTravel = async (destination) => {
    if (isTraveling) return;
    
    setIsTraveling(true);
    setSelectedDestination(destination);

    try {
      // Get current location data
      const currentLoc = getCurrentLocationData();
      
      // Perform travel with encounter chance
      const travelResult = travel(activeParty, destination, destination.encounterChance || 25);
      
      // Update party location
      setCurrentLocation(destination.name);
      setActiveParty(prev => ({
        ...prev,
        location: destination.name
      }));

      // Generate travel narration
      const narrationRes = await axiosInstance.post("/api/openai/travel", {
        origin: currentLocation,
        destination: destination.name,
        encounter: travelResult.event === "encounter",
        locationType: destination.type,
      });

      // Broadcast travel to PartyChat
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "Narrator",
        text: `🗺️ Party travels from ${currentLocation} to ${destination.name} (${destination.time})\n${narrationRes.data.text}`,
        type: "flavor",
      });

      // Handle encounter if one occurred
      if (travelResult.event === "encounter") {
        const encounter = getRandomEncounter(destination.type, ENCOUNTER_TABLES);
        
        // Broadcast encounter to PartyChat
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: `⚔️ Random Encounter: ${encounter.name} (${encounter.type})`,
          type: "system",
        });

        // Add encounter to combat tracker if hostile
        if (encounter.type === "hostile") {
          socket.emit("addEnemies", {
            partyId: activeParty._id,
            enemies: [
              {
                name: encounter.name,
                hp: 20,
                weapon: "Claws",
                morale: 10,
                type: "hostile"
              }
            ]
          });
        }
      }

    } catch (error) {
      console.error("Travel failed:", error);
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `❌ Travel to ${destination.name} failed. Please try again.`,
        type: "system",
      });
    } finally {
      setIsTraveling(false);
      setSelectedDestination(null);
    }
  };

  const currentLoc = getCurrentLocationData();
  const availableDestinations = getAvailableDestinations();

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>World Map Dashboard</Heading>

      {/* Current Location Info */}
      <Card mb={6}>
        <CardHeader>
          <HStack justify="space-between">
            <Heading size="md">Current Location</Heading>
            <Badge colorScheme="blue" fontSize="lg">
              {currentLocation}
            </Badge>
          </HStack>
        </CardHeader>
        <CardBody>
          {currentLoc && (
            <VStack align="start" spacing={2}>
              <Text><strong>Type:</strong> {currentLoc.type}</Text>
              <Text><strong>Description:</strong> {currentLoc.description}</Text>
              <Text><strong>Population:</strong> {currentLoc.population}</Text>
              <Text><strong>Notable Features:</strong> {currentLoc.notable}</Text>
              <Text><strong>Encounter Chance:</strong> {currentLoc.encounterChance}%</Text>
            </VStack>
          )}
        </CardBody>
      </Card>

      {/* Travel Options */}
      <Card>
        <CardHeader>
          <Heading size="md">Available Destinations</Heading>
        </CardHeader>
        <CardBody>
          {availableDestinations.length > 0 ? (
            <Grid templateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={4}>
              {availableDestinations.map((dest, idx) => (
                <GridItem key={idx}>
                  <Card variant="outline">
                    <CardBody>
                      <VStack align="start" spacing={3}>
                        <HStack justify="space-between" width="100%">
                          <Heading size="sm">{dest.name}</Heading>
                          <Badge colorScheme="green">{dest.type}</Badge>
                        </HStack>
                        
                        <Text fontSize="sm" color="gray.600">
                          {dest.description}
                        </Text>
                        
                        <HStack spacing={4} fontSize="sm">
                          <Text><strong>Distance:</strong> {dest.distance} days</Text>
                          <Text><strong>Time:</strong> {dest.time}</Text>
                          <Text><strong>Difficulty:</strong> {dest.difficulty}</Text>
                        </HStack>
                        
                        <Text fontSize="sm">
                          <strong>Encounter Chance:</strong> {dest.encounterChance || 25}%
                        </Text>
                        
                        <Button
                          colorScheme="blue"
                          size="sm"
                          onClick={() => handleTravel(dest)}
                          isLoading={isTraveling && selectedDestination?.name === dest.name}
                          loadingText="Traveling..."
                          width="100%"
                        >
                          Travel to {dest.name}
                        </Button>
                      </VStack>
                    </CardBody>
                  </Card>
                </GridItem>
              ))}
            </Grid>
          ) : (
            <Alert status="info">
              <AlertIcon />
              No direct travel routes available from {currentLocation}. 
              You may need to travel through intermediate locations.
            </Alert>
          )}
        </CardBody>
      </Card>

      {/* All Locations Reference */}
      <Card mt={6}>
        <CardHeader>
          <Heading size="md">All Known Locations</Heading>
        </CardHeader>
        <CardBody>
          <Grid templateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={3}>
            {LOCATIONS.map((loc, idx) => (
              <GridItem key={idx}>
                <Card 
                  variant={loc.name === currentLocation ? "filled" : "outline"}
                  colorScheme={loc.name === currentLocation ? "blue" : "gray"}
                >
                  <CardBody p={3}>
                    <VStack align="start" spacing={1}>
                      <HStack justify="space-between" width="100%">
                        <Text fontWeight="bold" fontSize="sm">{loc.name}</Text>
                        <Badge size="sm" colorScheme="purple">{loc.type}</Badge>
                      </HStack>
                      <Text fontSize="xs" color="gray.600">
                        {loc.description}
                      </Text>
                      <Text fontSize="xs">
                        <strong>Encounter:</strong> {loc.encounterChance}%
                      </Text>
                    </VStack>
                  </CardBody>
                </Card>
              </GridItem>
            ))}
          </Grid>
        </CardBody>
      </Card>
    </Box>
  );
};

export default GMWorldMap;

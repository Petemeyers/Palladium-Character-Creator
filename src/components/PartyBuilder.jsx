import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Box, Heading, Text, Button, VStack, HStack, Divider } from '@chakra-ui/react';
import WorldMap from './WorldMap';
import axiosInstance from '../utils/axios';
import '../styles/PartyBuilder.css';

const PartyBuilder = ({ characters = [] }) => {
  const [parties, setParties] = useState([]);
  const [currentParty, setCurrentParty] = useState([]);
  const [partyName, setPartyName] = useState('');
  const [startLocation, setStartLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchParties = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/parties');
      setParties(response.data);
    } catch (error) {
      console.error('Error fetching parties:', error);
    }
  }, []);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  const handleAddToParty = (char) => {
    if (!currentParty.find(member => member._id === char._id)) {
      setCurrentParty([...currentParty, char]);
    }
  };

  const handleRemoveFromParty = (charId) => {
    setCurrentParty(currentParty.filter(char => char._id !== charId));
  };

  const handleChooseLocation = (location) => {
    setStartLocation(location);
  };

  const createParty = async () => {
    if (!partyName.trim() || currentParty.length === 0) {
      alert('Please enter a party name and add at least one character');
      return;
    }

    if (!startLocation) {
      alert('Please choose a starting location for your party');
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.post('/parties', {
        name: partyName.trim(),
        members: currentParty.map(char => char._id),
        startLocation: startLocation
      });

      if (response.data.success) {
        alert(`Party "${partyName}" created successfully with starting location: ${startLocation.label}`);
        setCurrentParty([]);
        setPartyName('');
        setStartLocation(null);
        fetchParties(); // Refresh the parties list
      }
    } catch (error) {
      console.error('Error creating party:', error);
      alert('Failed to create party');
    } finally {
      setLoading(false);
    }
  };

  const deleteParty = async (partyId) => {
    if (window.confirm('Are you sure you want to delete this party?')) {
      try {
        const response = await axiosInstance.delete(`/parties/${partyId}`);
        if (response.data.success) {
          fetchParties(); // Refresh the parties list
        }
      } catch (error) {
        console.error('Error deleting party:', error);
        alert('Failed to delete party');
      }
    }
  };

  return (
    <>
      <Box className="container" p={8}>
        <Heading mb={6}>👥 Party Builder</Heading>
        <Text mb={6} color="gray.600">
          Build your party and choose a starting location for your adventure!
        </Text>

        {/* Party Name Input */}
        <Box mb={6}>
          <Heading size="md" mb={3}>Party Name</Heading>
          <input
            type="text"
            placeholder="Enter party name..."
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            style={{
              padding: '10px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '16px',
              width: '300px'
            }}
          />
        </Box>

        {/* Available Characters */}
        <Box mb={6}>
          <Heading size="md" mb={3}>Available Characters</Heading>
          {characters.length === 0 ? (
            <Text color="gray.500">No characters created yet. Create some characters first!</Text>
          ) : (
            <VStack align="stretch" spacing={2}>
              {characters.map((char) => (
                <HStack key={char._id} justify="space-between" p={3} bg="gray.50" borderRadius="md">
                  <Box>
                    <Text fontWeight="bold">{char.name}</Text>
                    <Text fontSize="sm" color="gray.600">
                      Level {char.level} {char.species} {char.class}
                    </Text>
                  </Box>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    onClick={() => handleAddToParty(char)}
                    disabled={currentParty.find(member => member._id === char._id)}
                  >
                    {currentParty.find(member => member._id === char._id) ? 'Added' : 'Add to Party'}
                  </Button>
                </HStack>
              ))}
            </VStack>
          )}
        </Box>

        {/* Current Party */}
        {currentParty.length > 0 && (
          <Box mb={6}>
            <Heading size="md" mb={3}>Current Party ({currentParty.length} members)</Heading>
            <VStack align="stretch" spacing={2}>
              {currentParty.map((char) => (
                <HStack key={char._id} justify="space-between" p={3} bg="blue.50" borderRadius="md">
                  <Box>
                    <Text fontWeight="bold">{char.name}</Text>
                    <Text fontSize="sm" color="gray.600">
                      Level {char.level} {char.species} {char.class}
                    </Text>
                  </Box>
                  <Button
                    size="sm"
                    colorScheme="red"
                    variant="outline"
                    onClick={() => handleRemoveFromParty(char._id)}
                  >
                    Remove
                  </Button>
                </HStack>
              ))}
            </VStack>
          </Box>
        )}

        {/* Starting Location Selection */}
        <Box mb={6}>
          <Heading size="md" mb={3}>Choose Starting Location</Heading>
          <WorldMap onChooseLocation={handleChooseLocation} />
        </Box>

        {/* Party Summary */}
        {currentParty.length > 0 && startLocation && (
          <Box mb={6} p={6} bg="green.50" borderRadius="lg" border="2px solid" borderColor="green.200">
            <Heading size="md" color="green.700" mb={3}>🎯 Party Ready!</Heading>
            <Text fontWeight="bold" color="green.800" mb={2}>
              Party: {partyName || 'Unnamed Party'}
            </Text>
            <Text color="green.600" mb={2}>
              Members: {currentParty.length} characters
            </Text>
            <Text color="green.600" mb={2}>
              Starting Location: {startLocation.label} ({startLocation.region})
            </Text>
            <Button
              colorScheme="green"
              size="lg"
              onClick={createParty}
              isLoading={loading}
              loadingText="Creating Party..."
            >
              ✅ Create Party
            </Button>
          </Box>
        )}

        {/* Existing Parties */}
        {parties.length > 0 && (
          <Box>
            <Divider mb={4} />
            <Heading size="md" mb={3}>Existing Parties</Heading>
            <VStack align="stretch" spacing={3}>
              {parties.map((party) => (
                <Box key={party._id} p={4} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
                  <HStack justify="space-between" mb={2}>
                    <Heading size="sm">{party.name}</Heading>
                    <Button
                      size="sm"
                      colorScheme="red"
                      variant="outline"
                      onClick={() => deleteParty(party._id)}
                    >
                      Delete
                    </Button>
                  </HStack>
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    Members: {party.members.length}
                  </Text>
                  {party.startLocation && (
                    <Text fontSize="sm" color="blue.600">
                      Starting Location: {party.startLocation.label} ({party.startLocation.region})
                    </Text>
                  )}
                </Box>
              ))}
            </VStack>
          </Box>
        )}
      </Box>
    </>
  );
};

PartyBuilder.propTypes = {
  characters: PropTypes.array
};

export default PartyBuilder;
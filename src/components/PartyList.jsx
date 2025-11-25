import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Box, Heading, Text, Button, Table, Tbody, Tr, Td, Th, Alert, AlertIcon, HStack } from '@chakra-ui/react';
import axiosInstance from '../utils/axios';
import { useParty } from '../context/PartyContext';
import '../styles/CharacterList.css';

const PartyList = ({ parties: propParties, onDeleteParty: propOnDeleteParty, onLoadParty: propOnLoadParty }) => {
  const [parties, setParties] = useState(propParties || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { setActiveParty, refreshActiveParty } = useParty();

  const fetchParties = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/parties');
      if (response.data.success) {
        setParties(response.data.parties || response.data);
      } else {
        setParties(response.data);
      }
      setError(null);
    } catch (error) {
      console.error('Error fetching parties:', error);
      setError('Failed to load parties');
      setParties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!propParties) {
      fetchParties();
    } else {
      setParties(propParties);
      setLoading(false);
    }
  }, [propParties, fetchParties]);

  const handleDeleteParty = async (partyId, partyName) => {
    if (window.confirm(`Are you sure you want to delete the party "${partyName}"?`)) {
      try {
        const response = await axiosInstance.delete(`/parties/${partyId}`);
        if (response.data.success) {
          setParties(parties.filter(party => party._id !== partyId));
          // Call prop function if provided
          if (propOnDeleteParty) {
            propOnDeleteParty(partyId);
          }
        }
      } catch (error) {
        console.error('Error deleting party:', error);
        alert('Failed to delete party');
      }
    }
  };

  if (loading) {
    return (
      <>
        <Box className="container" p={8}>
          <Heading mb={4}>Party List</Heading>
          <Text>Loading parties...</Text>
        </Box>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Box className="container" p={8}>
          <Heading mb={4}>Party List</Heading>
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        </Box>
      </>
    );
  }

  if (!parties || parties.length === 0) {
    return (
      <>
        <Box className="container" p={8}>
          <Heading mb={4}>Party List</Heading>
          <Text>No parties have been created yet.</Text>
        </Box>
      </>
    );
  }

  return (
    <>
      <Box className="container" p={8}>
        <Heading mb={4}>Party List</Heading>
        
        <Box mb={4}>
          <Button
            colorScheme="blue"
            size="sm"
            onClick={() => {
              refreshActiveParty();
              alert("Active party refreshed from database!");
            }}
            mr={2}
          >
            🔄 Refresh Active Party
          </Button>
        </Box>
        <Table variant="simple" size="md">
          <thead>
            <Tr>
              <Th>Name</Th>
              <Th>Members</Th>
              <Th>Starting Location</Th>
              <Th>Actions</Th>
            </Tr>
          </thead>
          <Tbody>
            {parties.map((party) => (
              <Tr key={party._id}>
                <Td fontWeight="bold" color="blue.700">
                  {party.name}
                </Td>
                <Td>
                  {party.members && party.members.length > 0 ? (
                    <Box>
                      {party.members.map((member) => (
                        <Text key={member._id} fontSize="sm" mb={1}>
                          {member.name} – {member.species} {member.class}
                        </Text>
                      ))}
                    </Box>
                  ) : (
                    <Text color="gray.500" fontSize="sm">No members</Text>
                  )}
                </Td>
                <Td>
                  {party.startLocation ? (
                    <Box>
                      <Text fontWeight="bold" color="green.700">
                        {party.startLocation.label}
                      </Text>
                      <Text fontSize="sm" color="green.600">
                        {party.startLocation.region}
                      </Text>
                    </Box>
                  ) : (
                    <Text color="gray.500" fontSize="sm">Unknown</Text>
                  )}
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <Button
                      colorScheme="green"
                      size="sm"
                      onClick={() => {
                        setActiveParty(party);
                        if (propOnLoadParty) {
                          propOnLoadParty(party);
                        }
                        alert(`Party "${party.name}" loaded into session!`);
                      }}
                    >
                      Load
                    </Button>
                    <Button
                      colorScheme="red"
                      size="sm"
                      onClick={() => handleDeleteParty(party._id, party.name)}
                    >
                      Delete
                    </Button>
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </>
  );
};

PartyList.propTypes = {
  parties: PropTypes.array,
  onDeleteParty: PropTypes.func,
  onLoadParty: PropTypes.func,
};

export default PartyList;

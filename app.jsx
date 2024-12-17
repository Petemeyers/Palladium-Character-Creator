import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axiosInstance from './src/utils/axiosConfig';
import HomePage from './src/components/HomePage';
import Chat from './src/components/Chat';
import CharacterCreator from './src/components/CharacterCreator';
import PartyBuilder from './src/components/PartyBuilder';
import CharacterList from './src/components/CharacterList';
import TraderShop from './src/components/TraderShop';
import Login from './src/components/Login';
import PropTypes from 'prop-types';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

PrivateRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

const App = () => {
  const [characters, setCharacters] = useState([]);
  const [party, setParty] = useState([]);
  const navigate = useNavigate();

  // Fetch the characters when the component mounts
  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      // Check if user is logged in
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axiosInstance.get('/characters', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setCharacters(response.data);
    } catch (error) {
      console.error('Error fetching characters:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    }
  };

  // Function to handle updating a character
  const updateCharacter = async (characterId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axiosInstance.put(`/characters/${characterId}`, updates, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setCharacters(characters.map(char => 
        char._id === characterId ? response.data : char
      ));
      return response.data;
    } catch (error) {
      console.error('Error updating character:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
      throw error;
    }
  };

  // Function to handle adding a new character
  const addCharacter = async (newCharacter) => {
    try {
      const token = localStorage.getItem('token');
      const filteredAttributes = {};
      Object.keys(newCharacter.attributes).forEach((key) => {
        if (!key.endsWith('_highlight')) {
          filteredAttributes[key] = newCharacter.attributes[key];
        }
      });

      const characterData = {
        ...newCharacter,
        attributes: filteredAttributes,
      };

      const response = await axiosInstance.post('/characters', characterData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setCharacters([...characters, response.data]);
    } catch (error) {
      console.error('Error adding character:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    }
  };

  // Function to handle adding bulk characters
  const addBulkCharacters = async (newCharacters) => {
    try {
      const response = await axiosInstance.post('/characters/bulk', newCharacters);
      setCharacters([...characters, ...response.data.characters]);
      alert(`Successfully added ${response.data.characters.length} characters.`);
    } catch (error) {
      console.error('Error adding bulk characters:', error);
      alert('Failed to add bulk characters. Please try again.');
    }
  };

  // Function to handle deleting a character
  const deleteCharacter = async (id) => {
    try {
      const token = localStorage.getItem('token');

      if (id === 'all') {
        // Delete all characters
        await axiosInstance.delete('/characters/all', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setCharacters([]);
        setParty([]);
        return;
      }

      if (Array.isArray(id)) {
        // Bulk delete
        await axiosInstance.post('/characters/bulk-delete', 
          { characterIds: id },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        setCharacters(prev => prev.filter(char => !id.includes(char._id)));
        setParty(prev => prev.filter(char => !id.includes(char._id)));
        return;
      }

      // Single character delete
      await axiosInstance.delete(`/characters/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setCharacters(characters.filter((character) => character._id !== id));
      setParty(party.filter((character) => character._id !== id));
    } catch (error) {
      console.error('Error deleting character:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
      alert('Failed to delete character. Please try again.');
    }
  };

  // Function to handle adding a character to the party
  const addCharacterToParty = async (character) => {
    if (party.some(member => member._id === character._id)) {
      alert('This character is already in the party!');
      return;
    }

    try {
      // Update party status in backend
      const response = await axiosInstance.put(
        `/characters/${character._id}/party-status`,
        { inParty: true }
      );

      if (response.data.success) {
        setParty([...party, character]);
      }
    } catch (error) {
      console.error('Error adding to party:', error);
      alert(error.response?.data?.message || 'Failed to add character to party');
    }
  };

  // Function to remove character from party
  const removeCharacterFromParty = async (characterId) => {
    try {
      // Update party status in backend
      const response = await axiosInstance.put(
        `/characters/${characterId}/party-status`,
        { inParty: false }
      );

      if (response.data.success) {
        setParty(party.filter(character => character._id !== characterId));
      }
    } catch (error) {
      console.error('Error removing from party:', error);
      alert(error.response?.data?.message || 'Failed to remove character from party');
    }
  };

  return (
    <div>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route
          path="/character-creation"
          element={<PrivateRoute><CharacterCreator onCharacterCreate={addCharacter} /></PrivateRoute>}
        />
        <Route
          path="/party-builder"
          element={
            <PrivateRoute>
              <PartyBuilder
                characters={characters}
                onAddToParty={addCharacterToParty}
                onRemoveFromParty={removeCharacterFromParty}
              />
            </PrivateRoute>
          }
        />
        <Route
          path="/character-list"
          element={
            <PrivateRoute>
              <CharacterList
                characters={characters}
                onDelete={deleteCharacter}
                onUpdateCharacter={updateCharacter}
                onAddBulkCharacters={addBulkCharacters}
              />
            </PrivateRoute>
          }
        />
        <Route path="/trader-shop" element={<PrivateRoute><TraderShop /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </div>
  );
};

export default App;

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import HomePage from './src/components/HomePage';
import Chat from './src/components/Chat';
import CharacterCreator from './src/components/CharacterCreator';
import PartyBuilder from './src/components/PartyBuilder';
import CharacterList from './src/components/CharacterList';

const App = () => {
  const [characters, setCharacters] = useState([]);
  const [party, setParty] = useState([]);

  // Fetch the characters when the component mounts
  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/characters');
      setCharacters(response.data);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  };

  // Function to handle updating a character
  const updateCharacter = async (characterId, updates) => {
    try {
      const response = await axios.put(
        `http://localhost:5000/api/characters/${characterId}`,
        updates
      );
      setCharacters(characters.map(char => 
        char._id === characterId ? response.data : char
      ));
      return response.data;
    } catch (error) {
      console.error('Error updating character:', error);
      throw error;
    }
  };

  // Function to handle adding a new character
  const addCharacter = async (newCharacter) => {
    try {
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

      const response = await axios.post(
        'http://localhost:5000/api/characters',
        characterData
      );
      setCharacters([...characters, response.data]);
    } catch (error) {
      console.error('Error adding character:', error);
    }
  };

  // Function to handle adding bulk characters
  const addBulkCharacters = async (newCharacters) => {
    try {
      const response = await axios.post(
        'http://localhost:5000/api/characters/bulk',
        newCharacters
      );
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
      await axios.delete(`http://localhost:5000/api/characters/${id}`);
      setCharacters(characters.filter((character) => character._id !== id));
      // Also remove from party if present
      setParty(party.filter((character) => character._id !== id));
    } catch (error) {
      console.error('Error deleting character:', error);
    }
  };

  // Function to handle adding a character to the party
  const addCharacterToParty = (character) => {
    if (party.some(member => member._id === character._id)) {
      alert('This character is already in the party!');
      return;
    }
    setParty([...party, character]);
  };

  // Function to remove character from party
  const removeCharacterFromParty = (characterId) => {
    setParty(party.filter(character => character._id !== characterId));
  };

  return (
    <div>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<Chat />} />
        <Route
          path="/character-creation"
          element={<CharacterCreator onCharacterCreate={addCharacter} />}
        />
        <Route
          path="/party-builder"
          element={
            <PartyBuilder
              characters={characters}
              onAddToParty={addCharacterToParty}
              onRemoveFromParty={removeCharacterFromParty}
            />
          }
        />
        <Route
          path="/character-list"
          element={
            <CharacterList
              characters={characters}
              onDelete={deleteCharacter}
              onUpdateCharacter={updateCharacter}
              onAddBulkCharacters={addBulkCharacters}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
};

export default App;

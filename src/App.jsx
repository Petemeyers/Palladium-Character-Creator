import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import TraderShop from './components/TraderShop';
import CharacterCreator from './components/CharacterCreator';
import CharacterList from './components/CharacterList';
import Login from './components/Login';
import PrivateRoute from './components/PrivateRoute';
import WeaponShop from './components/WeaponShop';
import PartyBuilder from './components/PartyBuilder';
import Chat from './components/Chat';
import axiosInstance from './utils/axios';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const fetchCharacters = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/characters');
      setCharacters(response.data);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated && !dataLoaded) {
      fetchCharacters();
    }
  }, [isAuthenticated, dataLoaded, fetchCharacters]);

  const handleUpdateCharacter = useCallback(async (characterId, updates) => {
    try {
      const response = await axiosInstance.put(`/characters/${characterId}`, updates);
      if (response.data.success) {
        setCharacters(chars => chars.map(char => 
          char._id === characterId ? response.data.character : char
        ));
        return response.data.character;
      }
    } catch (error) {
      console.error('Error updating character:', error);
      throw error;
    }
  }, []);

  const handleAddBulkCharacters = async (characters) => {
    try {
      const response = await axiosInstance.post('/characters/bulk', characters);
      if (response.data.success) {
        setCharacters(prev => [...prev, ...response.data.characters]);
      }
    } catch (error) {
      console.error('Error adding bulk characters:', error);
    }
  };

  const handleDeleteCharacter = async (characterId) => {
    try {
      const response = await axiosInstance.delete(`/characters/${characterId}`);
      if (response.data.success) {
        setCharacters(prev => prev.filter(char => char._id !== characterId));
      }
    } catch (error) {
      console.error('Error deleting character:', error);
    }
  };

  const handleBulkDeleteCharacters = async (characterIds) => {
    try {
      const response = await axiosInstance.post('/characters/bulk-delete', { characterIds });
      if (response.data.success) {
        setCharacters(prev => prev.filter(char => !characterIds.includes(char._id)));
      }
    } catch (error) {
      console.error('Error bulk deleting characters:', error);
    }
  };

  const handleCreateCharacter = useCallback(async (newCharacter) => {
    try {
      const response = await axiosInstance.post('/characters', newCharacter);
      if (response.data) {
        setCharacters(prev => [...prev, response.data]);
        return response.data;
      }
    } catch (error) {
      console.error('Error creating character:', error);
      throw error;
    }
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/trader-shop" element={<PrivateRoute><TraderShop /></PrivateRoute>} />
      <Route path="/weapon-shop" element={<PrivateRoute><WeaponShop /></PrivateRoute>} />
      <Route path="/party-builder" element={<PrivateRoute><PartyBuilder characters={characters} /></PrivateRoute>} />
      <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
      <Route path="/character-creation" element={<PrivateRoute><CharacterCreator onCreateCharacter={handleCreateCharacter} /></PrivateRoute>} />
      <Route path="/character-list" element={
        <PrivateRoute>
          <CharacterList 
            characters={characters}
            onUpdateCharacter={handleUpdateCharacter}
            onAddBulkCharacters={handleAddBulkCharacters}
            onDeleteCharacter={handleDeleteCharacter}
            onBulkDelete={handleBulkDeleteCharacters}
          />
        </PrivateRoute>
      } />
    </Routes>
  );
}

export default App; 
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './components/HomePage';
import TraderShop from './components/TraderShop';
import ArmorShop from './components/ArmorShop';
import Login from './components/Login';
import PrivateRoute from './components/PrivateRoute';
import WeaponShop from './components/WeaponShop';
import Chat from './components/Chat';
import Navbar from './components/Navbar';
import axiosInstance from './utils/axios';
import ErrorBoundary from './components/ErrorBoundary';
import { syncEquippedWeapons } from './utils/weaponManager';

// Lazy load heavy components
import {
  CharacterCreator,
  CharacterList,
  CharacterSheet,
  PartyBuilder,
  PartyList,
  GMControlPanel,
  WorldMap,
  NpcMemoryEditor,
} from './components/LazyComponents';
import CombatPage from './pages/CombatPage';
import AutoRollDemo from './components/AutoRollDemo';
import { useParams } from 'react-router-dom';

// Wrapper component to load character data from route parameter
function CharacterSheetWrapper({ characters, onUpdateCharacter }) {
  const { characterId } = useParams();
  const character = characters.find(c => c._id === characterId);
  
  const handleSave = async (characterData) => {
    if (character?._id) {
      await onUpdateCharacter(character._id, characterData);
    }
  };

  return <CharacterSheet characterData={character} onSave={handleSave} />;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState([]);
  const [parties, setParties] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const location = useLocation();

  const fetchCharacters = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/characters');
      // Sync equippedWeapons from equipped object for all characters to ensure consistency
      const syncedCharacters = response.data.map(char => syncEquippedWeapons(char));
      setCharacters(syncedCharacters);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  }, []);

  const fetchParties = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/parties');
      if (response.data.success) {
        setParties(response.data.parties || response.data);
      } else {
        setParties(response.data);
      }
    } catch (error) {
      console.error('Error fetching parties:', error);
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
      fetchParties();
    }
  }, [isAuthenticated, dataLoaded, fetchCharacters, fetchParties]);

  const handleUpdateCharacter = useCallback(async (characterId, updates) => {
    try {
      const response = await axiosInstance.put(`/characters/${characterId}`, updates);
      if (response.data.success) {
        // Sync equippedWeapons from equipped object for the updated character
        const syncedCharacter = syncEquippedWeapons(response.data.character);
        setCharacters(chars => chars.map(char => 
          char._id === characterId ? syncedCharacter : char
        ));
        return syncedCharacter;
      } else if (response.data) {
        // Handle case where response.data is the character directly (not wrapped in success)
        const syncedCharacter = syncEquippedWeapons(response.data);
        setCharacters(chars => chars.map(char => 
          char._id === characterId ? syncedCharacter : char
        ));
        return syncedCharacter;
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

  const handleLoadParty = useCallback((party) => {
    // This will be handled by the PartyContext, but we can add any additional logic here
    console.log('Loading party:', party.name);
  }, []);

  const handleDeleteParty = useCallback(async (partyId) => {
    try {
      const response = await axiosInstance.delete(`/parties/${partyId}`);
      if (response.data.success) {
        setParties(prev => prev.filter(party => party._id !== partyId));
      }
    } catch (error) {
      console.error('Error deleting party:', error);
      throw error;
    }
  }, []);

  const handleUpdateCharacters = useCallback(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  if (loading) {
    return <div>Loading...</div>;
  }

  // Show navbar on all pages except login
  const showNavbar = isAuthenticated && location.pathname !== '/login';

  return (
    <ErrorBoundary>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
        <Route path="/trader-shop" element={<PrivateRoute><TraderShop /></PrivateRoute>} />
        <Route path="/weapon-shop" element={<PrivateRoute><WeaponShop /></PrivateRoute>} />
        <Route path="/armor-shop" element={<PrivateRoute><ArmorShop characters={characters} onUpdateCharacters={handleUpdateCharacters} /></PrivateRoute>} />
        <Route path="/party-builder" element={<PrivateRoute><PartyBuilder characters={characters} /></PrivateRoute>} />
        <Route path="/party-list" element={<PrivateRoute><PartyList parties={parties} onDeleteParty={handleDeleteParty} /></PrivateRoute>} />
        <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route path="/world-map" element={<PrivateRoute><WorldMap onChooseLocation={(location) => {
          // Store the selected location in localStorage for the Chat component to use
          localStorage.setItem('selectedLocation', JSON.stringify(location));
          // Navigate to chat after selection
          window.location.href = '/chat';
        }} /></PrivateRoute>} />
        <Route path="/npc-memory" element={<PrivateRoute><NpcMemoryEditor /></PrivateRoute>} />
        <Route path="/gm-panel" element={<PrivateRoute><GMControlPanel parties={parties} onDeleteParty={handleDeleteParty} onLoadParty={handleLoadParty} onUpdateCharacter={handleUpdateCharacter} /></PrivateRoute>} />
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
        <Route path="/character-sheet" element={
          <PrivateRoute>
            <CharacterSheet />
          </PrivateRoute>
        } />
        <Route path="/character-sheet/:characterId" element={
          <PrivateRoute>
            <CharacterSheetWrapper characters={characters} onUpdateCharacter={handleUpdateCharacter} />
          </PrivateRoute>
        } />
        <Route path="/combat" element={
          <PrivateRoute>
            <CombatPage characters={characters} />
          </PrivateRoute>
        } />
        <Route path="/auto-roll-demo" element={
          <PrivateRoute>
            <AutoRollDemo />
          </PrivateRoute>
        } />
      </Routes>
    </ErrorBoundary>
  );
}

export default App; 
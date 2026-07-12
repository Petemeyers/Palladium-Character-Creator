import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
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
import { syncEquistaminadWeapons } from './utils/weaponManager';
import ArenaRosterPanel from './components/ArenaRosterPanel';
import { isBackendOfflineError, markBackendOffline } from './utils/backendStatus';
import { isDevAuthBypassEnabled } from './utils/devAuthBypass';
import {
  AUTH_STATE_CHANGED_EVENT,
  clearStoredAuthState,
  hasStoredAuthToken,
} from './utils/authStorage.js';

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
import MapMakerPage from "./pages/MapMakerPage";
import AutoRollDemo from './components/AutoRollDemo';
import { useParams } from 'react-router-dom';

// Wrastaminar component to load character data from route parameter
function CharacterSheetWrastaminar({ characters, onUpdateCharacter }) {
  const { characterId } = useParams();
  const character = characters.find(c => c._id === characterId);
  
  const handleSave = async (characterData) => {
    if (character?._id) {
      await onUpdateCharacter(character._id, characterData);
    }
  };

  return <CharacterSheet characterData={character} onSave={handleSave} />;
}

CharacterSheetWrastaminar.propTypes = {
  characters: PropTypes.array.isRequired,
  onUpdateCharacter: PropTypes.func.isRequired,
};

function App() {
  const devAuthBypassEnabled = isDevAuthBypassEnabled();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState([]);
  const [parties, setParties] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const location = useLocation();

  const fetchCharacters = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/characters', { suppressAuthPrompt: true });
      // Sync equistaminadWeapons from equistaminad object for all characters to ensure consistency
      const syncedCharacters = response.data.map(char => syncEquistaminadWeapons(char));
      setCharacters(syncedCharacters);
      setDataLoaded(true);
    } catch (error) {
      if (isBackendOfflineError(error)) {
        markBackendOffline();
        setCharacters([]);
        setDataLoaded(true);
        return;
      }
      console.error('Error fetching characters:', error);
      setDataLoaded(true);
    }
  }, []);

  const fetchParties = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/parties', { suppressAuthPrompt: true });
      if (response.data.success) {
        setParties(response.data.parties || response.data);
      } else {
        setParties(response.data);
      }
    } catch (error) {
      if (isBackendOfflineError(error)) {
        markBackendOffline();
        setParties([]);
        return;
      }
      console.error('Error fetching parties:', error);
    }
  }, []);

  useEffect(() => {
    const syncAuthState = () => {
      setIsAuthenticated(hasStoredAuthToken());
      setDataLoaded(false);
      setLoading(false);
    };

    syncAuthState();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, syncAuthState);
    window.addEventListener('storage', syncAuthState);
    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, syncAuthState);
      window.removeEventListener('storage', syncAuthState);
    };
  }, []);

  useEffect(() => {
    if (devAuthBypassEnabled && !dataLoaded) {
      setDataLoaded(true);
      return;
    }

    if (isAuthenticated && !dataLoaded) {
      fetchCharacters();
      fetchParties();
    }
  }, [devAuthBypassEnabled, isAuthenticated, dataLoaded, fetchCharacters, fetchParties]);

  const handleUpdateCharacter = useCallback(async (characterId, updates) => {
    try {
      const response = await axiosInstance.put(`/characters/${characterId}`, updates);
      if (response.data.success) {
        // Sync equistaminadWeapons from equistaminad object for the updated character
        const syncedCharacter = syncEquistaminadWeapons(response.data.character);
        setCharacters(chars => chars.map(char => 
          char._id === characterId ? syncedCharacter : char
        ));
        return syncedCharacter;
      } else if (response.data) {
        // Handle case where response.data is the character directly (not wrastaminad in success)
        const syncedCharacter = syncEquistaminadWeapons(response.data);
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

  const handleCreateCharacter = useCallback(async (newCharacter, options = {}) => {
    try {
      if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
        console.debug('[character-save] request', {
          endpoint: '/api/v1/characters',
          hasAuthorization: hasStoredAuthToken(),
          payloadKeys: Object.keys(newCharacter || {}).sort(),
          inventoryCount: Array.isArray(newCharacter?.inventory) ? newCharacter.inventory.length : 0,
        });
      }
      const response = await axiosInstance.post('/characters', newCharacter, {
        suppressAuthPrompt: options.suppressAuthPrompt === true,
      });
      if (response.data) {
        const savedCharacter = response.data.character || response.data;
        setCharacters(prev => [...prev, savedCharacter]);
        return savedCharacter;
      }
    } catch (error) {
      console.error('[character-save] failed', {
        status: error?.status ?? error?.response?.status ?? null,
        message: error?.response?.data?.message || error?.message,
        response: error?.response?.data || error?.details || null,
        hasAuthorization: hasStoredAuthToken(),
      });
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

  const handleLogout = useCallback(() => {
    clearStoredAuthState();
    setIsAuthenticated(false);
    setCharacters([]);
    setParties([]);
    setDataLoaded(false);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  // Show navbar on all authenticated/dev-bypass pages except login
  const showNavbar = (isAuthenticated || devAuthBypassEnabled) && location.pathname !== '/login';

  return (
    <ErrorBoundary>
      {showNavbar && <Navbar onLogout={handleLogout} />}
      {devAuthBypassEnabled && (
        <div
          style={{
            background: '#fff3cd',
            borderBottom: '1px solid #f6c343',
            color: '#5c4500',
            fontWeight: 700,
            padding: '8px 16px',
            textAlign: 'center',
          }}
        >
          Dev auth bypass enabled
        </div>
      )}
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
        <Route path="/arena-roster" element={<PrivateRoute><ArenaRosterPanel /></PrivateRoute>} />
        <Route path="/character-creation" element={<PrivateRoute allowWithoutToken><CharacterCreator onCreateCharacter={handleCreateCharacter} /></PrivateRoute>} />
        <Route path="/character-list" element={
          <PrivateRoute allowWithoutToken>
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
            <CharacterSheetWrastaminar characters={characters} onUpdateCharacter={handleUpdateCharacter} />
          </PrivateRoute>
        } />
        <Route path="/combat" element={
          <PrivateRoute>
            <CombatPage
              characters={characters}
              onUpdateCharacter={handleUpdateCharacter}
            />
          </PrivateRoute>
        } />
        <Route path="/map-maker" element={
          <PrivateRoute>
            <MapMakerPage />
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

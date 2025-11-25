import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

import axiosInstance from './utils/axiosConfig';
import HomePage from './components/HomePage';
import Chat from './components/Chat';
import CharacterCreator from './components/CharacterCreator';
import PartyBuilder from './components/PartyBuilder';
import CharacterList from './components/CharacterList';
import TraderShop from './components/TraderShop';
import Login from './components/Login';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run on mount

  const fetchCharacters = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axiosInstance.get('/characters', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setCharacters(response.data);
    } catch (error) {
      console.error('Error fetching characters:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    }
  };

  const updateCharacter = async (characterId, updates) => {
    try {
      const token = localStorage.getItem('token');

      const response = await axiosInstance.put(
        `/characters/${characterId}`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setCharacters((prev) =>
        prev.map((char) =>
          char._id === characterId ? response.data : char
        )
      );

      return response.data;
    } catch (error) {
      console.error('Error updating character:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
      throw error;
    }
  };

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

      const response = await axiosInstance.post(
        '/characters',
        characterData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setCharacters((prev) => [...prev, response.data]);
    } catch (error) {
      console.error('Error adding character:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    }
  };

  const addBulkCharacters = async (newCharacters) => {
    try {
      const token = localStorage.getItem('token');

      const response = await axiosInstance.post(
        '/characters/bulk',
        newCharacters,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setCharacters((prev) => [...prev, ...response.data.characters]);
      alert(
        `Successfully added ${response.data.characters.length} characters.`
      );
    } catch (error) {
      console.error('Error adding bulk characters:', error);
      alert('Failed to add bulk characters. Please try again.');
    }
  };

  const deleteCharacter = async (id) => {
    try {
      const token = localStorage.getItem('token');

      if (id === 'all') {
        await axiosInstance.delete('/characters/all', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setCharacters([]);
        setParty([]);
        return;
      }

      if (Array.isArray(id)) {
        await axiosInstance.post(
          '/characters/bulk-delete',
          { characterIds: id },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setCharacters((prev) =>
          prev.filter((char) => !id.includes(char._id))
        );
        setParty((prev) =>
          prev.filter((char) => !id.includes(char._id))
        );
        return;
      }

      await axiosInstance.delete(`/characters/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setCharacters((prev) =>
        prev.filter((character) => character._id !== id)
      );
      setParty((prev) =>
        prev.filter((character) => character._id !== id)
      );
    } catch (error) {
      console.error('Error deleting character:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
      alert('Failed to delete character. Please try again.');
    }
  };

  const addCharacterToParty = async (character) => {
    if (party.some((member) => member._id === character._id)) {
      alert('This character is already in the party!');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      const response = await axiosInstance.put(
        `/characters/${character._id}/party-status`,
        { inParty: true },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setParty((prev) => [...prev, character]);
      }
    } catch (error) {
      console.error('Error adding to party:', error);
      alert(
        error.response?.data?.message ||
          'Failed to add character to party'
      );
    }
  };

  const removeCharacterFromParty = async (characterId) => {
    try {
      const token = localStorage.getItem('token');

      const response = await axiosInstance.put(
        `/characters/${characterId}/party-status`,
        { inParty: false },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setParty((prev) =>
          prev.filter((character) => character._id !== characterId)
        );
      }
    } catch (error) {
      console.error('Error removing from party:', error);
      alert(
        error.response?.data?.message ||
          'Failed to remove character from party'
      );
    }
  };

  return (
    <div>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<HomePage />} />

        <Route
          path="/chat"
          element={
            <PrivateRoute>
              <Chat />
            </PrivateRoute>
          }
        />

        <Route
          path="/character-creation"
          element={
            <PrivateRoute>
              <CharacterCreator onCharacterCreate={addCharacter} />
            </PrivateRoute>
          }
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

        <Route
          path="/trader-shop"
          element={
            <PrivateRoute>
              <TraderShop />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </div>
  );
};

export default App;

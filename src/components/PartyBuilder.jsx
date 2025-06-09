// PartyBuilder.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import Navbar from './Navbar'; // Import the Navbar component
import axiosInstance from '../utils/axios';
import '../styles/PartyBuilder.css';

const PartyBuilder = ({ characters = [] }) => {
  const [parties, setParties] = useState([]);
  const [currentParty, setCurrentParty] = useState([]);
  const [partyName, setPartyName] = useState('');
  const [selectedPartyIndex, setSelectedPartyIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [partiesLoaded, setPartiesLoaded] = useState(false);

  // Memoize fetchParties function
  const fetchParties = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/parties');
      setParties(response.data);
      setPartiesLoaded(true);
    } catch (error) {
      console.error('Error fetching parties:', error);
      setError('Failed to load parties');
    }
  }, []); // No dependencies needed

  // Fetch parties only once when component mounts
  useEffect(() => {
    if (!partiesLoaded) {
      fetchParties();
    }
  }, [partiesLoaded, fetchParties]);

  // Memoize party actions
  const createNewParty = useCallback(async () => {
    if (!partyName.trim() || currentParty.length === 0) {
      alert('Please enter a party name and add at least one character');
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.post('/parties', {
        name: partyName.trim(),
        members: currentParty.map(char => char._id)
      });

      if (response.data.success) {
        await fetchParties();
        setCurrentParty([]);
        setPartyName('');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to create party';
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [partyName, currentParty, fetchParties]);

  const selectParty = async (index) => {
    try {
      const party = parties[index];
      setSelectedPartyIndex(index);
      setCurrentParty(party.members); // party.members should already be populated
      setPartyName(party.name);
    } catch (error) {
      console.error('Error selecting party:', error);
      setError('Failed to select party');
    }
  };

  const updateExistingParty = async () => {
    if (selectedPartyIndex === null) return;
    
    setLoading(true);
    try {
      const party = parties[selectedPartyIndex];
      const response = await axiosInstance.put(`/parties/${party._id}`, {
        name: partyName,
        members: currentParty.map(char => char._id)
      });

      if (response.data.success) {
        await fetchParties(); // Refresh parties list
        setCurrentParty([]);
        setPartyName('');
        setSelectedPartyIndex(null);
      }
    } catch (error) {
      console.error('Error updating party:', error);
      setError('Failed to update party');
    } finally {
      setLoading(false);
    }
  };

  const deleteParty = async (index) => {
    setLoading(true);
    try {
      const party = parties[index];
      const response = await axiosInstance.delete(`/parties/${party._id}`);

      if (response.data.success) {
        await fetchParties(); // Refresh parties list
        if (selectedPartyIndex === index) {
          setSelectedPartyIndex(null);
          setCurrentParty([]);
          setPartyName('');
        }
      }
    } catch (error) {
      console.error('Error deleting party:', error);
      setError('Failed to delete party');
    } finally {
      setLoading(false);
    }
  };

  const addCharacterToCurrentParty = (character) => {
    if (currentParty.length >= 1000) {
      alert('Maximum party size is 1000 characters');
      return;
    }
    if (currentParty.some(member => member._id === character._id)) {
      alert('This character is already in the party');
      return;
    }

    // Make sure we have all required character data
    const characterToAdd = {
      _id: character._id,
      name: character.name,
      level: character.level,
      class: character.class,
      species: character.species,
      attributes: character.attributes,
      user: character.user || localStorage.getItem('userId'), // Add user ID
      ...(character.imageUrl && { imageUrl: character.imageUrl })
    };

    console.log('Adding character to party:', characterToAdd);
    setCurrentParty([...currentParty, characterToAdd]);
  };

  const removeCharacterFromCurrentParty = (characterId) => {
    setCurrentParty(currentParty.filter(char => char._id !== characterId));
  };

  return (
    <>
      <Navbar />
      <div className="main-content party-builder-container">
        <h2>Party Builder</h2>
        {error && <div className="error-message">{error}</div>}
        {loading && <div className="loading-message">Loading...</div>}
        
        <div className="party-builder-layout">
          {/* Left Side - Party Creation and Saved Parties */}
          <div className="left-panel">
            {/* Party Creation Section */}
            <div className="party-creation-section">
              <h3>{selectedPartyIndex !== null ? 'Edit Party' : 'Create New Party'}</h3>
              <input
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="Enter party name"
                className="party-name-input"
              />
              
              {/* Current Party Members Table */}
              <div className="current-party-section">
                <h4>Current Party Members ({currentParty.length})</h4>
                <div className="members-table-container">
                  <table className="members-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Class</th>
                        <th>Species</th>
                        <th>Level</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentParty.map(member => (
                        <tr key={member._id}>
                          <td>{member.name}</td>
                          <td>{member.class}</td>
                          <td>{member.species}</td>
                          <td>{member.level}</td>
                          <td>
                            <button
                              className="remove-member-btn"
                              onClick={() => removeCharacterFromCurrentParty(member._id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Buttons for party actions */}
              <div className="button-group">
                {selectedPartyIndex !== null ? (
                  <>
                    <button onClick={updateExistingParty} className="update-party-btn" disabled={loading}>
                      {loading ? 'Updating...' : 'Update Party'}
                    </button>
                    <button onClick={() => {
                      setSelectedPartyIndex(null);
                      setCurrentParty([]);
                      setPartyName('');
                    }} className="cancel-btn" disabled={loading}>
                      Cancel Edit
                    </button>
                  </>
                ) : (
                  <button onClick={createNewParty} className="create-party-btn" disabled={loading}>
                    {loading ? 'Creating...' : 'Create New Party'}
                  </button>
                )}
              </div>
            </div>

            {/* Saved Parties Section */}
            <div className="saved-parties-section">
              <h3>Saved Parties</h3>
              {parties.map((party, index) => (
                <div key={party._id} className="saved-party-card">
                  <div className="saved-party-header">
                    <h4>{party.name}</h4>
                    <div className="party-actions">
                      <button 
                        onClick={() => selectParty(index)} 
                        className="edit-party-btn"
                        disabled={selectedPartyIndex === index}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => deleteParty(index)} 
                        className="delete-party-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="members-table-container">
                    <table className="members-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Class</th>
                          <th>Species</th>
                          <th>Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {party.members.map(member => (
                          <tr key={member._id}>
                            <td>{member.name}</td>
                            <td>{member.class}</td>
                            <td>{member.species}</td>
                            <td>{member.level}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Available Characters */}
          <div className="right-panel">
            <h3>Available Characters</h3>
            <div className="characters-table-container">
              <table className="characters-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Species</th>
                    <th>Level</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {characters.map(character => (
                    <tr key={character._id}>
                      <td>{character.name}</td>
                      <td>{character.class}</td>
                      <td>{character.species}</td>
                      <td>{character.level}</td>
                      <td>
                        <button
                          className="add-character-btn"
                          onClick={() => addCharacterToCurrentParty(character)}
                          disabled={currentParty.some(member => member._id === character._id)}
                        >
                          Add to Party
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

PartyBuilder.propTypes = {
  characters: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    species: PropTypes.string.isRequired,
    class: PropTypes.string.isRequired,
    attributes: PropTypes.object.isRequired,
  })),
};

export default PartyBuilder;
